// Tool Mesh v1 — tool nyata Cloudflare API (semua READ-ONLY).
// Env-agnostic: env.CF_API_TOKEN dibaca saat runtime di Worker (secret), di sandbox dari file.
import { registerTool, type NexusTool } from "./registry";

const CF_API = "https://api.cloudflare.com/client/v4";
const ZONE_ID = "123c99bb48577cb8b3596b48087f10ce"; // westconid.cftenant.com

export function getToken(env: any): string {
  const t = env?.CF_API_TOKEN ?? process.env.CF_API_TOKEN;
  if (!t) throw new Error("CF_API_TOKEN tidak tersedia");
  return String(t);
}

async function cfFetch(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${CF_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`CF API ${path} → HTTP ${res.status}`);
  return res.json();
}

async function gql(query: string, token: string): Promise<unknown> {
  const res = await fetch(`${CF_API}/graphql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GraphQL → HTTP ${res.status}`);
  return res.json();
}

// --- Tool: info zone ---
registerTool({
  name: "zone_info",
  description: "Info zone westconid.cftenant.com (status, nameservers, tenant)",
  async run(_args, env) {
    const data: any = await cfFetch(`/zones/${ZONE_ID}`, getToken(env));
    const z = data.result;
    return {
      id: z.id, name: z.name, status: z.status,
      nameservers: z.name_servers, tenant: z.tenant?.name,
      account: z.account?.name,
    };
  },
});

// --- Tool: DNS records ---
registerTool({
  name: "dns_records",
  description: "Daftar DNS records zone (max 20)",
  async run(args, env) {
    const page = Math.min(Number(args?.page ?? 1) || 1, 50);
    const data: any = await cfFetch(`/zones/${ZONE_ID}/dns_records?per_page=20&page=${page}`, getToken(env));
    return (data.result ?? []).map((r: any) => ({
      name: r.name, type: r.type, content: r.content, proxied: r.proxied,
    }));
  },
});

// --- Tool: WAF custom rules (read) ---
registerTool({
  name: "waf_custom_rules",
  description: "Daftar custom rules WAF zone (read-only)",
  async run(_args, env) {
    const data: any = await cfFetch(
      `/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint`, getToken(env));
    return (data.result?.rules ?? []).map((r: any) => ({
      id: r.id, description: r.description, enabled: r.enabled, action: r.action,
      expression: r.expression, last_updated: r.last_updated,
    }));
  },
});

// --- Tool: firewall events (24 jam terakhir) via GraphQL ---
registerTool({
  name: "firewall_events_24h",
  description: "Agregat firewall events 24 jam terakhir (action & source)",
  async run(_args, env) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const q = `query { viewer { zones(filter: {zoneTag: "${ZONE_ID}"}) {
      firewallEventsAdaptiveGroups(limit: 10, filter: {datetime_geq: "${since}"}) {
        count dimensions { action source }
      } } } }`;
    const data: any = await gql(q, getToken(env));
    return data.data?.viewer?.zones?.[0]?.firewallEventsAdaptiveGroups?.map((g: any) => ({
      count: g.count, action: g.dimensions.action, source: g.dimensions.source,
    }));
  },
});
