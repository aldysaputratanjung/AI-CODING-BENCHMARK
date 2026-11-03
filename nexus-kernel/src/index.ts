import { Agent, routeAgentRequest, callable } from "agents";
import { listTools, getTool, type TraceEntry, type Env } from "./registry";

export class NexusAgent extends Agent<Env, { initialized: boolean }> {
  initialState = { initialized: false };

  override onStateUpdate(state, source) {
    this.trace("state_change", { source, initialized: state.initialized });
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
}

export default {
  fetch: (req, env) => routeAgentRequest(req, env) ?? new Response("NEXUS kernel: not found", { status: 404 }),
};
