import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import {
  createTransactionSchema, TRANSACTION_STATUSES, CURRENCIES,
  type CreateTransactionInput, type TransactionDTO, type PaginationMeta,
} from "@shared/schemas";
import { toast } from "../components/Toast";
import Modal from "../components/Modal";
import { formatMinor } from "../lib/format";
import { Skeleton } from "../components/LoadingScreen";

export default function TransactionsPage() {
  const { data: authData } = useAuth();
  const me = authData?.user;
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const canCreate = ["super_admin", "admin", "manager"].includes(me?.role ?? "");
  const canDelete = ["super_admin", "admin"].includes(me?.role ?? "");

  const list = useQuery({
    queryKey: ["transactions", page, search, statusFilter],
    queryFn: () =>
      api.get<{ transactions: TransactionDTO[]; pagination: PaginationMeta }>(
        `/transactions?page=${page}&page_size=10${search ? `&search=${encodeURIComponent(search)}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`,
      ),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => { toast("Transaction deleted"); queryClient.invalidateQueries({ queryKey: ["transactions"] }); },
    onError: (e: ApiError) => toast(e.message, "error"),
  });

  const p = list.data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-100">Transactions</h1>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New transaction
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9"
              placeholder="Search customer or transaction ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="input w-auto" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filter status">
            <option value="">All statuses</option>
            {TRANSACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          {list.isLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="mb-2 h-12" />)
          ) : list.isError ? (
            <p className="py-8 text-center text-sm text-rose-400">Failed to load transactions.</p>
          ) : list.data && list.data.transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No transactions found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Payment date</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-surface-border/50">
                    <td className="py-3 pr-4">
                      <Link to={`/transactions/${t.id}`} className="font-medium text-slate-200 hover:text-accent-hover">
                        {t.customer_name}
                      </Link>
                      <p className="text-xs text-slate-500">{t.id.slice(0, 8)}…</p>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-200">{formatMinor(t.amount_minor, t.currency)}</td>
                    <td className="py-3 pr-4 text-slate-400">{t.category_name}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 pr-4 text-slate-400">{t.payment_date}</td>
                    <td className="py-3 text-right">
                      {canDelete && (
                        <button
                          className="text-xs text-rose-400 hover:text-rose-300"
                          onClick={() => { if (confirm("Delete this transaction?")) del.mutate(t.id); }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {p && p.total_pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Page {p.page} of {p.total_pages} — {p.total} transactions</span>
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

      <CreateTransactionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["transactions"] })}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-400",
    pending: "bg-amber-500/15 text-amber-400",
    failed: "bg-rose-500/15 text-rose-400",
    refunded: "bg-sky-500/15 text-sky-400",
  };
  return <span className={`badge ${styles[status] ?? "bg-slate-500/15 text-slate-400"}`}>{status}</span>;
}

function CreateTransactionModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: { currency: "USD", status: "completed", payment_date: new Date().toISOString().slice(0, 10) },
  });
  const create = useMutation({
    mutationFn: (data: CreateTransactionInput) => api.post("/transactions", data),
    onSuccess: () => { toast("Transaction created"); reset({ currency: "USD", status: "completed", payment_date: new Date().toISOString().slice(0, 10) }); onClose(); onCreated(); },
    onError: (e: ApiError) => toast(e.message, "error"),
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: { id: number; name: string }[] }>("/transactions/categories"),
    enabled: open,
  });

  return (
    <Modal open={open} title="New transaction" onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit((d) => create.mutate(d))} noValidate>
        <div>
          <label className="label" htmlFor="tx-customer">Customer name</label>
          <input id="tx-customer" className="input" {...register("customer_name")} />
          {errors.customer_name && <p className="mt-1 text-xs text-rose-400">{errors.customer_name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="tx-amount">Amount</label>
            <input id="tx-amount" type="number" step="0.01" min="0" className="input" {...register("amount", { valueAsNumber: true })} />
            {errors.amount && <p className="mt-1 text-xs text-rose-400">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="tx-currency">Currency</label>
            <select id="tx-currency" className="input" {...register("currency")}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="tx-category">Category</label>
            <select id="tx-category" className="input" {...register("category_id", { valueAsNumber: true })}>
              <option value="">Select…</option>
              {categories.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.category_id && <p className="mt-1 text-xs text-rose-400">{errors.category_id.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="tx-status">Status</label>
            <select id="tx-status" className="input" {...register("status")}>
              {TRANSACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="tx-date">Payment date</label>
          <input id="tx-date" type="date" className="input" {...register("payment_date")} />
          {errors.payment_date && <p className="mt-1 text-xs text-rose-400">{errors.payment_date.message}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
