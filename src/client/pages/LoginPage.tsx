import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../services/api";
import { loginSchema, type LoginInput } from "@shared/schemas";
import { toast } from "../components/Toast";

export default function LoginPage() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const login = useMutation({
    mutationFn: (data: LoginInput) => api.post<{ user: unknown }>("/auth/login", data),
    onSuccess: () => {
      toast("Welcome back!");
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (e: ApiError) => toast(e.message || "Login failed", "error"),
  });

  return (
    <div className="card">
      <h1 className="text-lg font-semibold text-slate-100">Sign in</h1>
      <p className="mt-1 text-sm text-slate-400">Access your analytics dashboard</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit((d) => login.mutate(d))} noValidate>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
        </div>
        <button className="btn-primary w-full" disabled={isSubmitting || login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        No account? <Link to="/register" className="text-accent-hover hover:underline">Create one</Link>
      </p>
    </div>
  );
}
