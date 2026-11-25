import { casablancaInitialOffsetSeconds, casablancaTransitions } from "./display-casablanca-data";

// Stable FR/AR display contract: no host CLDR abbreviation/punctuation changes at hydration.
const civilMonths = {
  fr: ["jan.", "fév.", "mar.", "avr.", "mai", "jui.", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"],
} as const;

export function shortReference(value: string, keep = 8) {
  const clean = value.trim();
  if (!clean) return "—";
  if (clean.length <= keep * 2 + 1) return clean;
  return `${clean.slice(0, keep)}…${clean.slice(-4)}`;
}

/**
 * Formats an instant as Casablanca wall clock.
 * Uses the bundled, versioned IANA transitions on both server and browser.
 * Host ICU timezone databases must not decide the civil date independently.
 */
export function formatDateTimeCasablanca(value: string, locale: "fr" | "ar") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  let offset = casablancaInitialOffsetSeconds;
  for (const [instant, civilOffset] of casablancaTransitions) {
    if (date.getTime() < instant * 1000) break;
    offset = civilOffset;
  }
  const wall = new Date(date.getTime() + offset * 1000);
  if (Number.isNaN(wall.getTime())) return value;
  // UTC getters read the already-resolved civil fields, never the host timezone.
  const day = wall.getUTCDate();
  const month = civilMonths[locale][wall.getUTCMonth()];
  const year = wall.getUTCFullYear();
  const hour = String(wall.getUTCHours()).padStart(2, "0");
  const minute = String(wall.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}${locale === "ar" ? "،" : ","} ${hour}:${minute}`;
}

export function formatMinorAmount(minor: string | number | bigint, currency: string, locale: "fr" | "ar") {
  if (typeof minor === "number" && !Number.isSafeInteger(minor)) {
    throw new RangeError("Minor amounts must be safe integers; use a string or bigint for larger amounts.");
  }
  const raw = String(minor).replace(/\s/g, "");
  if (!/^[+-]?\d+$/.test(raw)) {
    return `${minor} ${currency}`.trim();
  }
  const language = locale === "ar" ? "ar-MA" : "fr-MA";
  const formatter = new Intl.NumberFormat(language, { style: "currency", currency: currency || "MAD" });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(digits);
  const amount = BigInt(raw);
  const whole = amount / scale;
  const fraction = (amount < 0n ? -amount : amount) % scale;
  const localizedFraction = new Intl.NumberFormat(language, {
    useGrouping: false, minimumIntegerDigits: Math.max(1, digits), maximumFractionDigits: 0,
  }).format(fraction);
  // Negative sub-unit amounts need negative zero to retain the localized sign.
  return formatter.formatToParts(amount < 0n && whole === 0n ? -0 : whole)
    .map(part => part.type === "fraction" ? localizedFraction : part.value).join("");
}
