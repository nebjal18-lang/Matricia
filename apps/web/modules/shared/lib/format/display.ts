/** Matricia V1 displays civil time in Morocco. Platform timezone is permanently UTC+1. */
const CASABLANCA_OFFSET_MS = 60 * 60 * 1000;

export function shortReference(value: string, keep = 8) {
  const clean = value.trim();
  if (!clean) return "—";
  if (clean.length <= keep * 2 + 1) return clean;
  return `${clean.slice(0, keep)}…${clean.slice(-4)}`;
}

/**
 * Formats an instant as Casablanca wall clock.
 * Uses a fixed UTC+1 offset (not Intl timeZone) so Node SSR and the browser
 * always emit the same string and avoid hydration mismatches.
 */
export function formatDateTimeCasablanca(value: string, locale: "fr" | "ar") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const wall = new Date(date.getTime() + CASABLANCA_OFFSET_MS);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(wall);
}

export function formatMinorAmount(minor: string | number, currency: string, locale: "fr" | "ar") {
  const raw = typeof minor === "number" ? minor : Number(String(minor).replace(/\s/g, ""));
  if (!Number.isFinite(raw)) return `${minor} ${currency}`.trim();
  return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    style: "currency",
    currency: currency || "MAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(raw / 100);
}
