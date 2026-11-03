import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { formatMinor, compactNumber } from "../lib/format";
import { DateRangePicker, defaultRange, ChartCard, EmptyState, type DateRangeValue } from "../components/DashboardWidgets";
import { Skeleton } from "../components/LoadingScreen";

interface Charts {
  by_month: { month: string; revenue_minor: number }[];
  by_category: { category_id: number; category_name: string; revenue_minor: number }[];
  status_distribution: { status: string; count: number }[];
}

export default function AnalyticsPage() {
  const { data: authData } = useAuth();
  const me = authData?.user;
  const [range, setRange] = useState<DateRangeValue>(defaultRange(365));

  const canView = ["super_admin", "admin", "manager"].includes(me?.role ?? "");
  const charts = useQuery({
    queryKey: ["analytics", "revenue", range],
    queryFn: () => api.get<Charts>(`/dashboard/revenue?from=${range.from}&to=${range.to}`),
    enabled: !!canView,
  });

  if (!canView) {
    return <div className="card text-sm text-slate-400">Analytics requires Manager role or higher.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-100">Analytics</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {charts.isLoading ? <Skeleton className="h-80" /> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title="Monthly revenue comparison" subtitle="Completed transactions per month">
            {charts.data && charts.data.by_month.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.data.by_month}>
                  <CartesianGrid stroke="#232a3a" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v: number) => `$${compactNumber(v / 100)}`} />
                  <Tooltip
                    contentStyle={{ background: "#11151f", border: "1px solid #232a3a", borderRadius: 8 }}
                    formatter={(v: number) => formatMinor(v, "USD")}
                  />
                  <Bar dataKey="revenue_minor" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No revenue data in this range" />}
          </ChartCard>

          <ChartCard title="Transaction status distribution" subtitle="All transactions in range">
            {charts.data && charts.data.status_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.data.status_distribution}>
                  <CartesianGrid stroke="#232a3a" strokeDasharray="3 3" />
                  <XAxis dataKey="status" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#11151f", border: "1px solid #232a3a", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No transactions in this range" />}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
