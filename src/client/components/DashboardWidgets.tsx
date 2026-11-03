import { useMemo } from "react";
import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

export interface DateRangeValue { from: string; to: string }

export function defaultRange(days = 90): DateRangeValue {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const PRESETS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "365d", days: 365 },
];

export function DateRangePicker({ value, onChange }: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}) {
  const currentPreset = useMemo(
    () => PRESETS.find((p) => defaultRange(p.days).from === value.from && defaultRange(p.days).to === value.to)?.days,
    [value],
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface p-1">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              currentPreset === p.days ? "bg-accent text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => onChange(defaultRange(p.days))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <CalendarDays size={14} />
        <input
          type="date"
          className="input w-auto py-1 text-xs"
          value={value.from}
          max={value.to}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          aria-label="From date"
        />
        <span>→</span>
        <input
          type="date"
          className="input w-auto py-1 text-xs"
          value={value.to}
          min={value.from}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          aria-label="To date"
        />
      </div>
    </div>
  );
}

export function KpiCard({ label, value, sub, icon, trend }: {
  label: string; value: ReactNode; sub?: string; icon?: ReactNode; trend?: number | null;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend !== undefined && trend !== null && (
          <span className={trend >= 0 ? "text-emerald-400" : "text-rose-400"}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}

export function ChartCard({ title, children, subtitle }: {
  title: string; subtitle?: string; children: ReactNode;
}) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center rounded-lg border border-dashed border-surface-border p-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
