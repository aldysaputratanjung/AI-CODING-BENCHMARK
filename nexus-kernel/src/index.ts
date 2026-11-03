import { Agent, routeAgentRequest, callable } from "agents";
import { listTools, getTool, type TraceEntry, type Env } from "./registry";
import "./tools"; // side-effect: registrasi 4 tool CF API (zone_info, dns_records, waf_custom_rules, firewall_events_24h)

export class NexusAgent extends Agent<Env, { initialized: boolean }> {
  initialState = { initialized: false };

  override onStateUpdate(state: { initialized: boolean } | undefined, source: unknown) {
    this.trace("state_change", { source, initialized: state?.initialized });
  }

  // Trace engine: setiap aksi dicatat permanen di DO SQLite (audit trail)
  trace(action: string, detail: Record<string, unknown> = {}) {
    this.sql`CREATE TABLE IF NOT EXISTS traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL
    )`;
    this.sql`INSERT INTO traces (ts, action, detail) VALUES (${Date.now()}, ${action}, ${JSON.stringify(detail)})`;
  }

  @callable()
  async getTraces(limit = 50): Promise<TraceEntry[]> {
    const rows = this.sql`SELECT ts, action, detail FROM traces ORDER BY id DESC LIMIT ${limit}`;
    return rows.map((r: any) => ({ ts: r.ts, action: r.action, detail: JSON.parse(r.detail) }));
  }

  // Tool-calling runtime: menjalankan tool dari registry, selalu di-trace
  @callable()
  async invokeTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const tool = getTool(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    this.trace("tool_call", { tool: name, args });
    try {
      const result = await tool.run(args, this.env);
      this.trace("tool_result", { tool: name, ok: true });
      return result;
    } catch (e: any) {
      this.trace("tool_error", { tool: name, error: String(e?.message ?? e) });
      throw e;
    }
  }

  @callable()
  async listRegisteredTools(): Promise<{ name: string; description: string }[]> {
    return listTools().map((t) => ({ name: t.name, description: t.description }));
  }

  @callable()
  async init() {
    this.trace("agent_init", { agent: "NexusAgent" });
    this.setState({ initialized: true });
    return this.state;
  }

  // HTTP GET langsung ke DO instance → info agent (bukan 404)
  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/internal/tool" && request.method === "POST") {
      const { tool, body } = (await request.json()) as { tool: string; body: Record<string, unknown> };
      const toolDef = getTool(tool);
      if (!toolDef) return Response.json({ ok: false, error: `Unknown tool: ${tool}` }, { status: 404 });
      this.trace("tool_call", { tool, args: body ?? {} });
      try {
        const result = await toolDef.run(body ?? {}, this.env);
        this.trace("tool_result", { tool, ok: true });
        return Response.json({ ok: true, tool, result });
      } catch (e: any) {
        this.trace("tool_error", { tool, error: String(e?.message ?? e) });
        return Response.json({ ok: false, tool, error: String(e?.message ?? e) }, { status: 502 });
      }
    }
    if (request.method === "GET") {
      this.trace("http_info");
      const traces = await this.getTraces(5);
      return Response.json({
        ok: true,
        agent: "NexusAgent",
        name: this.name,
        state: this.state,
        tools: listTools().map((t) => ({ name: t.name, description: t.description })),
        recent_traces: traces,
        rpc: `/agents/nexus/${this.name}/rpc/<method>`,
      });
    }
    return new Response("Not found", { status: 404 });
  }
}

export default {
  fetch: async (req: Request, env: Env): Promise<Response> => {
    const url = new URL(req.url);

    // Alias: /agents/nexus/* -> /agents/nexus-agent/* (binding NEXUS_AGENT di-kebab-case)
    if (url.pathname.startsWith("/agents/nexus/")) {
      // HTTP tool invocation (RPC @callable di agents versi ini hanya via WebSocket):
      // POST /agents/nexus/<name>/tool/<toolName>  body: {"args": {...}}
      const m = url.pathname.match(/^\/agents\/nexus\/([^/]+)\/tool\/([a-z0-9_]+)$/);
      if (m && req.method === "POST") {
        const [, agentName, toolName] = m;
        const stub = env.NEXUS_AGENT.get(env.NEXUS_AGENT.idFromName(agentName));
        return stub.fetch("https://do/internal/tool", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-partykit-namespace": "nexus-agent", // nama class DO di-kebab-case
            "x-partykit-room": agentName,
          },
          body: JSON.stringify({ tool: toolName, body: await req.json().catch(() => ({})) }),
        });
      }
      const rewritten = new Request(
        url.origin + url.pathname.replace(/^\/agents\/nexus\//, "/agents/nexus-agent/") + url.search,
        req,
      );
      return (await routeAgentRequest(rewritten, env, { cors: true })) ?? new Response("Not found", { status: 404 });
    }

    if (url.pathname === "/agents") {
      return Response.json({
        agent: "NEXUS kernel",
        routes: {
          base: "/agents/nexus/<name>",
          health: "/agents/nexus/zone-westconid",
          rpc: "/agents/nexus/zone-westconid/rpc/<method>",
        },
        tools: listTools().map((t) => t.name),
      });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        ok: true,
        agent: "NEXUS kernel",
        version: "1.1.0",
        zone: "westconid.cftenant.com",
      });
    }

    return (await routeAgentRequest(req, env, { cors: true })) ?? new Response("NEXUS kernel: not found", { status: 404 });
  },
};
