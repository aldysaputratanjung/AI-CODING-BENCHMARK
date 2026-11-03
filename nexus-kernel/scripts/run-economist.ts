/**
 * ECONOMIST v1 — Cost & Governance Agent (read-only)
 * Sumber: AI Gateway config (REST) + aiGatewayRequestsAdaptiveGroups (GraphQL)
 */
const ACCOUNT = "07bdc837db356c2489a48bd14dd18525";
const GATEWAY = "aldyst";

async function main() {
  const token = process.env.CF_API_TOKEN as string;
  const since = "2026-10-27T00:00:00Z";

  // 1. Konfigurasi gateway (REST)
  const gwRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai-gateway/gateways/${GATEWAY}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const gwJson = await gwRes.json() as any;
  const gw = gwJson.result;

  // 2. Usage 7 hari (GraphQL)
  const q = `query{viewer{accounts(filter:{accountTag:"${ACCOUNT}"}){requests:aiGatewayRequestsAdaptiveGroups(limit:100,filter:{datetimeHour_geq:"${since}"}){count dimensions{model provider gateway}}}}}`;
  const gqlRes = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  const gql = await gqlRes.json() as any;
  const rows: Array<{ count: number; model: string; provider: string; gateway: string }> =
    (gql?.data?.viewer?.accounts?.[0]?.requests ?? []).map((r: any) => ({
      count: r.count,
      model: r.dimensions.model,
      provider: r.dimensions.provider,
      gateway: r.dimensions.gateway,
    }));

  const total = rows.reduce((s, r) => s + r.count, 0);
  const g = rows.filter((r) => r.gateway === GATEWAY);
  const gTotal = g.reduce((s, r) => s + r.count, 0);
  const byModel = [...g].sort((a, b) => b.count - a.count);

  console.log(`ECONOMIST REPORT — gateway '${GATEWAY}' — sejak ${since}`);
  console.log(`Total request semua gateway (7 hari): ${total}`);
  console.log(`Request via '${GATEWAY}': ${gTotal}`);
  console.log(`\nTop model di '${GATEWAY}' (7 hari):`);
  byModel.forEach((r) => console.log(`  - ${r.model}: ${r.count} (${r.provider})`));
  console.log(`\nKonfigurasi gateway:`);
  console.log(`  cache_ttl: ${gw.cache_ttl}s, collect_logs: ${gw.collect_logs}, auth: ${gw.authentication}`);
  console.log(`  spend_limits: ${JSON.stringify(gw.spend_limits)}`);
  console.log(`  log_classification: ${gw.log_classification}, log_management cap: ${gw.log_management}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
