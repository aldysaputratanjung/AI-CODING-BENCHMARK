// Central API client — fetch wrapper with typed responses & error handling.
// No secrets ever live here; auth uses HttpOnly cookies (no tokens in JS).

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }) },
    ...init,
  });
  const data = (await res.json().catch(() => null)) as { error?: { code: string; message: string; details?: unknown } } | T;
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string; details?: unknown } })?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? `HTTP ${res.status}`, err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
