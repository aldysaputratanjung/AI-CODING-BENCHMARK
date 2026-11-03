import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { api, ApiError } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import {
  ROLES, USER_STATUSES, createUserSchema, type CreateUserInput, type UserDTO,
  type PaginationMeta, type Role,
} from "@shared/schemas";
import { toast } from "../components/Toast";
import Modal from "../components/Modal";
import { formatDateTime } from "../lib/format";
import { Skeleton } from "../components/LoadingScreen";

export default function UsersPage() {
  const { data: authData } = useAuth();
  const me = authData?.user;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const canManage = me?.role === "super_admin" || me?.role === "admin";

  const users = useQuery({
    queryKey: ["users", page, search, roleFilter, statusFilter],
    queryFn: () =>
      api.get<{ users: UserDTO[]; pagination: PaginationMeta }>(
        `/users?page=${page}&page_size=10${search ? `&search=${encodeURIComponent(search)}` : ""}${roleFilter ? `&role=${roleFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`,
      ),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { toast("User deleted"); invalidate(); },
    onError: (e: ApiError) => toast(e.message, "error"),
  });

  if (me?.role === "user") {
    return (
      <div className="card text-sm text-slate-400">
        You do not have permission to manage users (requires Manager role or higher).
      </div>
    );
  }

  const p = users.data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-100">User Management</h1>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New user
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9"
              placeholder="Search email or name…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="input w-auto" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} aria-label="Filter role">
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
          <select className="input w-auto" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filter status">
            <option value="">All statuses</option>
            {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          {users.isLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="mb-2 h-12" />)
          ) : users.isError ? (
            <p className="py-8 text-center text-sm text-rose-400">Failed to load users.</p>
          ) : users.data && users.data.users.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No users match your filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Created</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.data?.users.map((u) => (
                  <tr key={u.id} className="border-b border-surface-border/50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-200">{u.full_name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="badge bg-accent/15 text-accent-hover">{u.role.replace("_", " ")}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${
                        u.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                        : u.status === "suspended" ? "bg-rose-500/15 text-rose-400"
                        : "bg-slate-500/15 text-slate-400"
                      }`}>{u.status}</span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{formatDateTime(u.created_at)}</td>
                    <td className="py-3 text-right">
                      {canManage && u.id !== me?.id && (
                        <button
                          className="text-xs text-rose-400 hover:text-rose-300"
                          onClick={() => { if (confirm(`Delete ${u.email}?`)) del.mutate(u.id); }}
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
            <span>Page {p.page} of {p.total_pages} — {p.total} users</span>
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

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={invalidate} myRole={me?.role as Role} />
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated, myRole }: {
  open: boolean; onClose: () => void; onCreated: () => void; myRole: Role | undefined;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });
  const create = useMutation({
    mutationFn: (data: CreateUserInput) => api.post("/users", data),
    onSuccess: () => { toast("User created"); reset(); onClose(); onCreated(); },
    onError: (e: ApiError) => toast(e.message, "error"),
  });

  const assignableRoles = myRole === "super_admin" ? ROLES : ROLES.filter((r) => r !== "super_admin");

  return (
    <Modal open={open} title="Create user" onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit((d) => create.mutate(d))} noValidate>
        <div>
          <label className="label" htmlFor="cu-name">Full name</label>
          <input id="cu-name" className="input" {...register("full_name")} />
          {errors.full_name && <p className="mt-1 text-xs text-rose-400">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="cu-email">Email</label>
          <input id="cu-email" type="email" className="input" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="cu-password">Temporary password</label>
          <input id="cu-password" type="password" className="input" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="cu-role">Role</label>
          <select id="cu-role" className="input" {...register("role")}>
            {assignableRoles.map((r: string) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
          {myRole !== "super_admin" && (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Shield size={12} /> Only super admins can assign the super_admin role
            </p>
          )}
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
