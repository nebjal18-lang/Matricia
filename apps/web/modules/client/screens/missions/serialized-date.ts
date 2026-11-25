/** Prefer the server label; otherwise localize for FR/AR with Casablanca timezone. */
export function serializedDateLabel(value: string, serverLabel?: string, locale: "fr" | "ar" = "fr") {
  if (serverLabel) return serverLabel;
  const normalized = /T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(date);
}
