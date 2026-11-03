/** A return location is a path in the current language, never an external URL. */
export function safeReturnPath(value: unknown, locale: string): string | undefined {
  if (typeof value !== "string" || !["fr", "ar"].includes(locale)) return undefined;
  const candidate = value.trim();
  if (candidate.length > 4096 || !candidate.startsWith(`/${locale}/`)) return undefined;
  try {
    if (/[\\\x00-\x1f\x7f]/u.test(decodeURIComponent(candidate))) return undefined;
    const url = new URL(candidate, "https://matricia.invalid");
    return url.origin === "https://matricia.invalid" && url.pathname.startsWith(`/${locale}/`) ? candidate : undefined;
  } catch { return undefined; }
}
