export function normalizeEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export const emailOtpLength = 6;

export function normalizeOtp(value: string, length: 6 | 7 | 8 = emailOtpLength): string | null {
  const normalized = value.replace(/\s/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  return normalized.length === length ? normalized : null;
}

export function applyOtpDigits(current: string, index: number, raw: string, length: 6 | 7 | 8 = emailOtpLength): string {
  const digits = raw.replace(/\D/g, "");
  const chars = Array.from({ length }, (_, position) => current[position] ?? "");
  if (!digits) {
    chars[index] = "";
    return chars.join("");
  }
  for (let offset = 0; offset < digits.length && index + offset < length; offset += 1) chars[index + offset] = digits[offset] ?? "";
  return chars.join("");
}
