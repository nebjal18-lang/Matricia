import type { Locale } from "@/modules/shared/lib/i18n/locale";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;
const DEMO_NAME_RE = /\bdémo\b|\bdemo\b/iu;

export type DirectoryPersonInput = {
  email?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
};

/** E2E / lab / Démo identities that must not flood operational directories by default. */
export function isDirectoryFixture(row: DirectoryPersonInput): boolean {
  const email = (row.email ?? "").toLowerCase();
  const local = email.split("@")[0] ?? "";
  const name = `${row.displayName ?? ""} ${row.givenName ?? ""} ${row.familyName ?? ""}`.toLowerCase();
  const org = (row.organizationName ?? "").toLowerCase();
  if (email.endsWith("@example.invalid") || email.endsWith("@example.com") || email.includes(".invalid")) return true;
  if (/\be2e\b/u.test(email) || /\be2e\b/u.test(name) || /\be2e\b/u.test(org)) return true;
  if (/p0\d[\s_-]?e2e/iu.test(name) || /p0\d[\s_-]?e2e/iu.test(org)) return true;
  if (local.startsWith("demo.") || local.startsWith("demo_") || local.includes(".demo.")) return true;
  if (DEMO_NAME_RE.test(name) || DEMO_NAME_RE.test(org)) return true;
  return false;
}

/** Lab / E2E organizations whose technical names stay out of default directories. */
export function isDirectoryOrgFixture(name: string, legalName = ""): boolean {
  const blob = `${name} ${legalName}`;
  if (isDirectoryFixture({ email: "", displayName: name, organizationName: legalName || name })) return true;
  UUID_RE.lastIndex = 0;
  if (UUID_RE.test(blob)) {
    UUID_RE.lastIndex = 0;
    return true;
  }
  if (/^p\d{2}\b/iu.test(name.trim()) && /provider\s+cible|cible\s+provider|fixture|seed/iu.test(blob)) return true;
  if (/^prestataire\s*[-–]\s*biblioth/iu.test(name.trim())) return true;
  if (/\bbiblioth[eè]que concurrence\b/iu.test(blob)) return true;
  return false;
}

export function fixturesHiddenLabel(count: number, locale: Locale): string {
  return locale === "ar"
    ? `${count} عنصر اختبار / تجريبي مخفي.`
    : `${count} élément(s) de test / démo masqué(s).`;
}

function looksLikeTechnicalIdentity(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.includes("@")) return true;
  if (UUID_RE.test(trimmed)) return true;
  UUID_RE.lastIndex = 0;
  if (/\be2e\b/iu.test(trimmed)) return true;
  return false;
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

/** Human organization label (never a raw UUID / E2E blob). */
export function organizationDisplayLabel(name: string | null | undefined, locale: Locale): string {
  if (!name?.trim()) return locale === "ar" ? "بدون مؤسسة" : "Sans organisation";
  if (!looksLikeTechnicalIdentity(name) && !/\be2e\b/iu.test(name)) return name.trim();
  const cleaned = name
    .replace(UUID_RE, " ")
    .replace(/\be2e\b/giu, " ")
    .replace(/\b(SUPERSEDED|COMPLETED|ARCHIVED|ACTIVE|DRAFT|PENDING|IN_PROGRESS|IN_REVIEW|RETIRED|TERMINATED)\b/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : (locale === "ar" ? "بدون مؤسسة" : "Sans organisation");
}

/** Human person label from ORG-002 fields (given/family) or cleaned display/email. */
export function personDisplayLabel(
  row: Pick<DirectoryPersonInput, "displayName" | "email" | "givenName" | "familyName">,
  locale: Locale,
): string {
  const given = row.givenName?.trim();
  const family = row.familyName?.trim();
  if (given && family) return `${given} ${family}`;
  if (given || family) return (given || family)!;
  const display = row.displayName?.trim();
  if (display && !looksLikeTechnicalIdentity(display)) return display;
  const email = row.email?.trim();
  if (email) {
    const local = email.split("@")[0] ?? "";
    const cleaned = local
      .replace(UUID_RE, " ")
      .replace(/\be2e\b/giu, " ")
      .replace(/[_.-]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (cleaned.length >= 2) return titleCaseWords(cleaned);
  }
  return locale === "ar" ? "حساب" : "Compte";
}

export function personContactLine(row: { email?: string | null; phone?: string | null; preferredLocale?: string | null; userId?: string }): string {
  const parts = [row.email?.trim(), row.phone?.trim(), row.preferredLocale?.trim()].filter(Boolean);
  return parts.join(" · ") || "—";
}

/** Stable avatar glyph from given name first, never from an org/email blob when a person name exists. */
export function personAvatarInitial(
  row: Pick<DirectoryPersonInput, "displayName" | "email" | "givenName" | "familyName">,
  locale: Locale,
): string {
  const given = row.givenName?.trim();
  if (given) return given.charAt(0).toLocaleUpperCase(locale === "ar" ? "ar" : "fr");
  const family = row.familyName?.trim();
  if (family) return family.charAt(0).toLocaleUpperCase(locale === "ar" ? "ar" : "fr");
  const label = personDisplayLabel(row, locale).trim();
  return (label.charAt(0) || "?").toLocaleUpperCase(locale === "ar" ? "ar" : "fr");
}

export function scopeLabelsLine(scopes: readonly string[], empty: string): string {
  const clean = [...new Set(scopes.map((item) => item.trim()).filter(Boolean))];
  return clean.length ? clean.join(" · ") : empty;
}
