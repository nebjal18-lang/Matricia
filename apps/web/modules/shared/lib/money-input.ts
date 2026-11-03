/** Convert localized amounts without ever representing money as a JS number. */
export function currencyFractionDigits(currency: string): number | null {
  if (!/^[A-Z]{3}$/u.test(currency)) return null;
  try {
    return new Intl.NumberFormat("fr-MA", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? null;
  } catch { return null; }
}

function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/٫/gu, ".").replace(/−/gu, "-");
}

/** Group separators are intentionally rejected: 1,234 cannot silently mean 1234. */
export function parseMoneyInput(value: string, currency: string): string | null {
  const digits = currencyFractionDigits(currency);
  if (digits === null) return null;
  const normalized = normalizeDigits(value.trim());
  const match = /^(-?)([0-9]+)(?:[.,]([0-9]*))?$/u.exec(normalized);
  if (!match || (match[3]?.length ?? 0) > digits || (digits === 0 && match[3] !== undefined)) return null;
  const amount = BigInt(`${match[2]}${(match[3] ?? "").padEnd(digits, "0")}`);
  return (match[1] === "-" ? -amount : amount).toString();
}

/** Editable major-unit text; no grouping, currency sign or floating-point conversion. */
export function formatMoneyInput(amountMinor: string, currency: string): string {
  const digits = currencyFractionDigits(currency);
  if (digits === null || !/^-?[0-9]+$/u.test(amountMinor)) return "";
  const amount = BigInt(amountMinor), negative = amount < BigInt(0);
  const absolute = (negative ? -amount : amount).toString().padStart(digits + 1, "0");
  return `${negative ? "-" : ""}${digits === 0 ? absolute : `${absolute.slice(0, -digits)}.${absolute.slice(-digits)}`}`;
}
