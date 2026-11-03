import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Toast { id: number; message: string; type: "success" | "error" | "info" }

let counter = 0;
let push: ((t: Toast) => void) | null = null;

export function toast(message: string, type: Toast["type"] = "success") {
  push?.({ id: ++counter, message, type });
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    push = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    return () => { push = null; };
  }, []);

  if (toasts.length === 0) return null;
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
            t.type === "success"
              ? "border-emerald-700 bg-emerald-900/90 text-emerald-100"
              : t.type === "error"
                ? "border-rose-700 bg-rose-900/90 text-rose-100"
                : "border-surface-border bg-surface-overlay text-slate-200"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}
