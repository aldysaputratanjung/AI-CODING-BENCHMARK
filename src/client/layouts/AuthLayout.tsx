import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">A</div>
          <span className="text-xl font-semibold text-slate-100">Acme Analytics</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
