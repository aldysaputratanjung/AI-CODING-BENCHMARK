import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { DollarSign, Users, Receipt, TrendingUp, Activity as ActivityIcon } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { formatMinor, compactNumber, formatDate, formatDateTime } from "../lib/format";
import { DateRangePicker, defaultRange, KpiCard, ChartCard, EmptyState, type DateRangeValue } from "../components/DashboardWidgets";
import { Skeleton } from "../components/LoadingScreen";

interface Summary {
  total_revenue_minor: number;
  revenue_growth_pct: number | null;
  transaction_count: number;
  average_transaction_minor: number;
  total_users: number;
  active_users: number;
  range: { from: string; to: string };
}
interface RevenueCharts {
  by_day: { day: string; revenue_minor: number }[];
  by_month: { month: string; revenue_minor: number }[];
  by_category: { category_id: number; category_name: string; revenue_minor: number }[];
  status_distribution: { status: string; count: number }[];
}
interface UserStats { registrations: { day: string; count: number }[] }

const PIE_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#34d399", "#f472b6"];

export default function DashboardPage() {
  const { data: authData } = useAuth();
  const user = authData?.user;
  const [range, setRange] = useState<DateRangeValue>(defaultRange(90));
  const qs = `?from=${range.from}&to=${range.to}`;

  const canView = user && ["super_admin", "admin", "manager"].includes(user.role);

  const summary = useQuery({
    queryKey: ["dashboard", "summary", range],
    queryFn: () => api.get<Summary>(`/dashboard/summary${qs}`),
    enabled: !!canView,
  });
  const charts = useQuery({
    queryKey: ["dashboard", "revenue", range],
    queryFn: () => api.get<RevenueCharts>(`/dashboard/revenue${qs}`),
    enabled: !!canView,
  });
  const userStats = useQuery({
    queryKey: ["dashboard", "users", range],
    queryFn: () => api.get<UserStats>(`/dashboard/users${qs}`),
    enabled: !!canView,
  });
  const activities = useQuery({
    queryKey: ["dashboard", "activities"],
    queryFn: () => api.get<{ activities: any[] }>("/dashboard/activities"),
    enabled: !!canView,
  });

  if (!canView) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-slate-100">Welcome, {user?.full_name}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your account role does not include analytics access. Ask an administrator for the Manager role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Welcome back, {user?.full_name?.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-slate-400">Here's what's happening in your business.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {summary.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : summary.isError ? (
        <div className="card border-rose-800 text-sm text-rose-300">
          Failed to load dashboard data. <button className="underline" onClick={() => summary.refetch()}>Retry</button>
        </div>
      ) : summary.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value={formatMinor(summary.data.total_revenue_minor, "USD")}
            trend={summary.data.revenue_growth_pct}
            sub="vs previous period"
            icon={<DollarSign size={16} />}
          />
          <KpiCard
            label="Total Users"
            value={compactNumber(summary.data.total_users)}
            sub={`${summary.data.active_users} active`}
            icon={<Users size={16} />}
          />
          <KpiCard
            label="Transactions"
            value={compactNumber(summary.data.transaction_count)}
            sub="completed in range"
            icon={<Receipt size={16} />}
          />
          <KpiCard
            label="Avg Transaction"
            value={formatMinor(summary.data.average_transaction_minor, "USD")}
            sub="completed in range"
            icon={<TrendingUp size={16} />}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {charts.isLoading ? <Skeleton className="h-80" /> : charts.data && charts.data.by_day.length > 0 ? (
            <ChartCard title="Revenue over time" subtitle="Completed transactions">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.data.by_day}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#232a3a" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(d: string) => formatDate(d).slice(0, 6)} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v: number) => `$${compactNumber(v / 100)}`} />
                  <Tooltip
                    contentStyle={{ background: "#11151f", border: "1px solid #232a3a", borderRadius: 8 }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(v: number) => formatMinor(v, "USD")}
                  />
                  <Area type="monotone" dataKey="revenue_minor" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : <ChartCard title="Revenue over time"><EmptyState message="No revenue data in this range" /></ChartCard>}
        </div>

        <div>
          {charts.isLoading ? <Skeleton className="h-80" /> : charts.data && charts.data.by_category.length > 0 ? (
            <ChartCard title="Revenue by category">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.data.by_category}
                    dataKey="revenue_minor"
                    nameKey="category_name"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {charts.data.by_category.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#11151f", border: "1px solid #232a3a", borderRadius: 8 }}
                    formatter={(v: number) => formatMinor(v, "USD")}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : <ChartCard title="Revenue by category"><EmptyState message="No category data" /></ChartCard>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {userStats.isLoading ? <Skeleton className="h-80" /> : userStats.data && userStats.data.registrations.length > 0 ? (
            <ChartCard title="User registration trends">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userStats.data.registrations}>
                  <CartesianGrid stroke="#232a3a" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(d: string) => formatDate(d).slice(0, 6)} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#11151f", border: "1px solid #232a3a", borderRadius: 8 }} labelStyle={{ color: "#94a3b8" }} />
                  <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : <ChartCard title="User registration trends"><EmptyState message="No registrations in this range" /></ChartCard>}
        </div>

        <div>
          <div className="card">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <ActivityIcon size={16} /> Recent activity
            </h3>
            <div className="mt-4 space-y-3">
              {activities.isLoading ? (
                [...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)
              ) : activities.data && activities.data.activities.length > 0 ? (
                activities.data.activities.slice(0, 8).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <div className="min-w-0">
                      <p className="truncate text-slate-300">{a.description}</p>
                      <p className="text-slate-500">{formatDateTime(a.created_at)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No recent activity" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
