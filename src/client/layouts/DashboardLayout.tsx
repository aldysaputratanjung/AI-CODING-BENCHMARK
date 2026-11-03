import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, BarChart3, Users, CreditCard, ScrollText, Settings,
  LogOut, Search, Menu, X,
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import ToastHost from "../components/Toast";
import Modal from "../components/Modal";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/users", label: "Users", icon: Users },
  { to: "/transactions", label: "Transactions", icon: CreditCard },
  { to: "/activities", label: "Activity Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout() {
  const { data } = useAuth();
  const user = data?.user;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
  });

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-surface-border bg-surface-raised transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-surface-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-bold text-white">A</div>
          <span className="font-semibold text-slate-100">Acme Analytics</span>
          <button
            className="ml-auto rounded p-1 text-slate-400 hover:text-slate-200 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={"end" in rest ? rest.end : false}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-accent/15 text-accent-hover" : "text-slate-400 hover:bg-surface-overlay hover:text-slate-200"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-surface-border bg-surface-raised/80 px-4 backdrop-blur lg:px-6">
          <button
            className="rounded p-1 text-slate-400 hover:text-slate-200 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="relative hidden w-full max-w-sm md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9"
              placeholder="Search… (press /)"
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/transactions?search=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="badge hidden bg-surface-overlay text-slate-300 sm:inline-flex">
              {user?.role?.replace("_", " ")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-hover">
              {user?.full_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <button
              className="btn-secondary px-2 py-1.5"
              onClick={() => setConfirmLogout(true)}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <Modal open={confirmLogout} title="Confirm logout" onClose={() => setConfirmLogout(false)}>
        <p className="text-sm text-slate-400">You will be signed out of your account.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setConfirmLogout(false)}>Cancel</button>
          <button className="btn-primary" onClick={() => logout.mutate()}>Logout</button>
        </div>
      </Modal>
      <ToastHost />
    </div>
  );
}
