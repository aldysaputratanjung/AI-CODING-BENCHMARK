// Formatting helpers (money, dates) — shared across UI components.

export function formatMinor(amountMinor: number, currency: string): string {
  const zeroDecimal = currency === "JPY" || currency === "IDR";
  const value = zeroDecimal ? amountMinor : amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, maximumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function compactNumber(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
}

export function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z")).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function pct(n: number | null): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
