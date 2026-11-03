// Tool registry — runtime-agnostic (tidak import "agents") agar bisa dites di Node/Vitest.
export interface NexusTool {
  name: string;
  description: string;
  // Semua tool HARUS pure read-only pada Tahap 0-3
  run(args: Record<string, unknown>, env: unknown): Promise<unknown>;
}

const tools = new Map<string, NexusTool>();
export function registerTool(t: NexusTool) { tools.set(t.name, t); }
export function listTools(): NexusTool[] { return [...tools.values()]; }
export function getTool(name: string): NexusTool | undefined { return tools.get(name); }

export interface TraceEntry {
  ts: number;
  action: string;
  detail: Record<string, unknown>;
}

export interface Env {
  NEXUS_AGENT: DurableObjectNamespace;
  CF_API_TOKEN?: string;
  AI?: unknown;
}

// Placeholder tool (Tahap 2 diganti tool CF API nyata)
registerTool({
  name: "ping",
  description: "Sanity check kernel",
  async run() { return { pong: true, ts: Date.now() }; },
});
