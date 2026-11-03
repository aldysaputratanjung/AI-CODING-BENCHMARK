import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { api, ApiError } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { toast } from "../components/Toast";

interface Profile {
  display_name: string | null;
  bio: string | null;
  avatar_key: string | null;
  timezone: string | null;
  updated_at: string;
}

export default function SettingsPage() {
  const { data: authData } = useAuth();
  const me = authData?.user;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ display_name: "", bio: "", timezone: "" });

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<{ profile: Profile }>("/profile"),
  });

  const save = useMutation({
    mutationFn: () => api.put("/profile", {
      display_name: form.display_name || undefined,
      bio: form.bio || undefined,
      timezone: form.timezone || undefined,
    }),
    onSuccess: () => { toast("Profile saved"); queryClient.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: ApiError) => toast(e.message, "error"),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post<{ avatar_key: string }>("/profile/avatar", fd);
    },
    onSuccess: () => { toast("Avatar updated"); queryClient.invalidateQueries({ queryKey: ["profile"] }); queryClient.invalidateQueries({ queryKey: ["auth"] }); },
    onError: (e: ApiError) => toast(e.message, "error"),
  });

  const p = profile.data?.profile;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-100">Settings</h1>

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200">Account</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="text-slate-200">{me?.full_name}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="text-slate-200">{me?.email}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Role</dt><dd className="text-slate-200">{me?.role?.replace("_", " ")}</dd></div>
        </dl>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200">Profile picture</h2>
        <div className="mt-4 flex items-center gap-4">
          <img
            src="/api/v1/profile/avatar"
            alt="Avatar"
            className="h-16 w-16 rounded-full border border-surface-border bg-surface-overlay object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
          />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }}
            />
            <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              <Camera size={15} /> {upload.isPending ? "Uploading…" : "Upload new image"}
            </button>
            <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP or GIF — max 2 MB</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200">Profile details</h2>
        {profile.isLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="display_name">Display name</label>
              <input
                id="display_name"
                className="input"
                placeholder={p?.display_name ?? me?.full_name}
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                className="input min-h-20"
                placeholder={p?.bio ?? "Tell us about yourself"}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="timezone">Timezone</label>
              <input
                id="timezone"
                className="input"
                placeholder={p?.timezone ?? "e.g. Asia/Jakarta"}
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </div>
            <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
