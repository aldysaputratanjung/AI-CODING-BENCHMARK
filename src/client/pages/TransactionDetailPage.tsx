import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "../services/api";
import { formatMinor, formatDateTime } from "../lib/format";
import { Skeleton } from "../components/LoadingScreen";
import type { TransactionDTO } from "@shared/schemas";

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tx = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => api.get<{ transaction: TransactionDTO }>(`/transactions/${id}`),
    enabled: !!id,
  });

  if (tx.isLoading) return <Skeleton className="h-64" />;
  if (tx.isError || !tx.data) {
    return (
      <div className="card text-sm text-rose-400">
        Transaction not found. <Link className="underline" to="/transactions">Back to list</Link>
      </div>
    );
  }

  const t = tx.data.transaction;
  const rows: [string, string][] = [
    ["Transaction ID", t.id],
    ["Customer", t.customer_name],
    ["Customer email", t.customer_email ?? "—"],
    ["Amount", formatMinor(t.amount_minor, t.currency)],
    ["Currency", t.currency],
    ["Category", t.category_name],
    ["Status", t.status],
    ["Payment date", t.payment_date],
    ["Note", t.note ?? "—"],
    ["Created", formatDateTime(t.created_at)],
    ["Updated", formatDateTime(t.updated_at)],
  ];

  return (
    <div className="space-y-4">
      <Link to="/transactions" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft size={15} /> Back to transactions
      </Link>
      <div className="card">
        <h1 className="text-xl font-semibold text-slate-100">{t.customer_name}</h1>
        <p className="mt-1 text-2xl font-semibold text-accent-hover">{formatMinor(t.amount_minor, t.currency)}</p>
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-surface-border/50 py-2 text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
