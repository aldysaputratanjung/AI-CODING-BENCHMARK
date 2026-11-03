// SENTRY v1 — Observability Agent Logic.
// Jalankan semua sensor (tool read-only), bangun naratif operasional, semua ter-trace.
import { listTools, getTool, type TraceEntry } from "./registry";
import "../src/tools"; // registrasi tool CF

export interface SentryReport {
  ts: number;
  zone: string;
  status: string;
  dns_count: number;
  waf_rules: { enabled: number; total: number };
  firewall_24h: { count: number; action: string; source: string }[];
  narrative: string;
}

function narrative(r: Omit<SentryReport, "narrative" | "ts" | "zone">, zone: string): string {
  const lines: string[] = [];
  lines.push(`SENTRY REPORT — ${zone} — ${new Date().toISOString()}`);
  lines.push(`Status zone: ${r.status}. DNS: ${r.dns_count} record terbaca.`);
  lines.push(`WAF: ${r.waf_rules.enabled}/${r.waf_rules.total} custom rule aktif.`);
  const blocked = r.firewall_24h.filter(f => f.action === "block").reduce((a, f) => a + f.count, 0);
  const challenged = r.firewall_24h.filter(f => f.action === "managed_challenge").reduce((a, f) => a + f.count, 0);
  const top = [...r.firewall_24h].sort((a, b) => b.count - a.count)[0];
  lines.push(`24 jam terakhir: ${blocked} block, ${challenged} managed_challenge.`);
  if (top) lines.push(`Sumber dominan: ${top.source} (${top.action}) x${top.count}.`);
  const custom = r.firewall_24h.filter(f => f.source === "firewallCustom").reduce((a, f) => a + f.count, 0);
  if (custom > 0) lines.push(`CATATAN: ${custom} request kena custom rules — cek apakah sesuai kebijakan.`);
  return lines.join("\n");
}

export async function runSentry(env: any): Promise<SentryReport> {
  const zone: any = await getTool("zone_info")!.run({}, env);
  const dns: any = await getTool("dns_records")!.run({}, env);
  const waf: any = await getTool("waf_custom_rules")!.run({}, env);
  const fw: any = await getTool("firewall_events_24h")!.run({}, env);

  const base = {
    status: zone.status,
    dns_count: Array.isArray(dns) ? dns.length : 0,
    waf_rules: { enabled: waf.filter((r: any) => r.enabled).length, total: waf.length },
    firewall_24h: fw ?? [],
  };
  return {
    ts: Date.now(),
    zone: zone.name,
    ...base,
    narrative: narrative(base, zone.name),
  };
}
