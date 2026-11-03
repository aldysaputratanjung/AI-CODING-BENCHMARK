import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { PaginationMeta } from "@shared/schemas";
import { formatDateTime } from "../lib/format";
import { Skeleton } from "../components/LoadingScreen";

interface Activity {
  id: string;
  actor_email: string | null;
  action: string;
  category: string;
  description: string;
  ip_address: string | null;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  auth: "bg-sky-500/15 text-sky-400",
  user: "bg-violet-500/15 text-violet-400",
  transaction: "bg-emerald-500/15 text-emerald-400",
  system: "bg-slate-500/15 text-slate-400",
};

export default function ActivityLogsPage() {
  const { data: authData } = useAuth();
  const me = authData?.user;
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");

  const canView = ["super_admin", "admin"].includes(me?.role ?? "");
  const list = useQuery({
    queryKey: ["activities", page, category],
    queryFn: () =>
      api.get<{ activities: Activity[]; pagination: PaginationMeta }>(
        `/activities?page=${page}&page_size=20${category ? `&category=${category}` : ""}`,
      ),
    enabled: !!canView,
  });

  if (!canView) {
    return <div className="card text-sm text-slate-400">Activity logs require Admin role or higher.</div>;
  }

  const p = list.data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-100">Activity Logs</h1>
        <select className="input w-auto" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Filter category">
          <option value="">All categories</option>
          <option value="auth">Auth</option>
          <option value="user">User</option>
          <option value="transaction">Transaction</option>
          <option value="system">System</option>
        </select>
      </div>

      <div className="card">
        {list.isLoading ? (
          [...Array(8)].map((_, i) => <Skeleton key={i} className="mb-2 h-10" />)
        ) : list.data && list.data.activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No activity found.</p>
        ) : (
          <ul className="divide-y divide-surface-border/50">
            {list.data?.activities.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                <span className={`badge shrink-0 ${CATEGORY_COLORS[a.category] ?? CATEGORY_COLORS.system}`}>
                  {a.category}
                </span>
                <span className="min-w-0 flex-1 text-slate-300">{a.description}</span>
                <span className="text-xs text-slate-500">{a.actor_email ?? "system"}</span>
                <span className="text-xs text-slate-600">{a.ip_address ?? ""}</span>
                <span className="text-xs text-slate-500">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}

        {p && p.total_pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Page {p.page} of {p.total_pages} — {p.total} entries</span>
            <div className="flex gap-1">
              <button className="btn-secondary px-2 py-1" disabled={page <= 1} onClick={() => setPage((x) => x - 1)} aria-label="Previous page">
                <ChevronLeft size={14} />
              </button>
              <button className="btn-secondary px-2 py-1" disabled={page >= p.total_pages} onClick={() => setPage((x) => x + 1)} aria-label="Next page">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
