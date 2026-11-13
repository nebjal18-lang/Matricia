export function shortReference(value: string, keep = 8) {
  const clean = value.trim();
  if (!clean) return "—";
  if (clean.length <= keep * 2 + 1) return clean;
  return `${clean.slice(0, keep)}…${clean.slice(-4)}`;
}

export function formatDateTimeCasablanca(value: string, locale: "fr" | "ar") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(date);
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
