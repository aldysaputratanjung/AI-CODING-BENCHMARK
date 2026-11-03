import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../services/api";
import { registerSchema, type RegisterInput } from "@shared/schemas";
import { toast } from "../components/Toast";

export default function RegisterPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterInput) => api.post("/auth/register", data),
    onSuccess: () => {
      toast("Account created. Please sign in.");
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate("/login");
    },
    onError: (e: ApiError) => toast(e.message || "Registration failed", "error"),
  });

  return (
    <div className="card">
      <h1 className="text-lg font-semibold text-slate-100">Create account</h1>
      <p className="mt-1 text-sm text-slate-400">New accounts receive the User role</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit((d) => registerMutation.mutate(d))} noValidate>
        <div>
          <label className="label" htmlFor="full_name">Full name</label>
          <input id="full_name" className="input" autoComplete="name" {...register("full_name")} />
          {errors.full_name && <p className="mt-1 text-xs text-rose-400">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="reg-email">Email</label>
          <input id="reg-email" type="email" className="input" autoComplete="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="reg-password">Password</label>
          <input id="reg-password" type="password" className="input" autoComplete="new-password" {...register("password")} />
          {errors.password
            ? <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
            : <p className="mt-1 text-xs text-slate-500">Min 10 chars, upper, lower, and a number</p>}
        </div>
        <button className="btn-primary w-full" disabled={isSubmitting || registerMutation.isPending}>
          {registerMutation.isPending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        Have an account? <Link to="/login" className="text-accent-hover hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
