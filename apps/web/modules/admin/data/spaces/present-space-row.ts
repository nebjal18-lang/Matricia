import { formatAdminDateTime } from "@/modules/admin/data/command-center/view-model";
import { formatMinorAmount } from "@/modules/shared/lib/format/display";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { actorOrganizationLabel, isAdminOrgDirectoryFixture } from "./actor-presentation";

const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/u;

export function presentOrgName(name: string | null | undefined, locale: Locale): string {
  return actorOrganizationLabel(name, locale);
}

export function presentPersonPair(left: string, right: string, locale: Locale): string {
  return `${presentOrgName(left, locale)} → ${presentOrgName(right, locale)}`;
}

export function presentDateTime(value: string | null | undefined, locale: Locale, empty = "—"): string {
  if (!value?.trim()) return empty;
  if (!ISO_RE.test(value.trim()) && Number.isNaN(Date.parse(value))) return value;
  return formatAdminDateTime(value, locale);
}

export function presentDateOnly(value: string | null | undefined, locale: Locale, empty = "—"): string {
  if (!value?.trim()) return empty;
  const date = new Date(value.length <= 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeZone: "Africa/Casablanca",
  }).format(date);
}

export function presentMinor(value: string | null | undefined, currency: string | null | undefined, locale: Locale): string {
  if (!value?.trim()) return "—";
  try {
    return formatMinorAmount(value, currency?.trim() || "MAD", locale);
  } catch {
    return value;
  }
}

export function presentChannel(channel: string, locale: Locale): string {
  const key = channel.trim().toLowerCase();
  if (key === "in-app" || key === "in_app") return locale === "ar" ? "داخل التطبيق" : "Dans l’app";
  if (key === "email") return locale === "ar" ? "بريد" : "E-mail";
  if (key === "sms") return "SMS";
  return channel;
}

export function presentObligation(key: string, locale: Locale): string {
  const known: Record<string, [string, string]> = {
    DELIVERABLE_ACCEPTANCE: ["Acceptation du livrable", "قبول التسليم"],
    MILESTONE_ACCEPTANCE: ["Acceptation du jalon", "قبول المعلم"],
    PAYMENT_RELEASE: ["Libération du paiement", "تحرير الدفع"],
    REASSIGNMENT: ["Réaffectation", "إعادة التعيين"],
    MEDIATION: ["Médiation", "وساطة"],
  };
  const hit = known[key];
  if (hit) return locale === "ar" ? hit[1] : hit[0];
  return key.replaceAll("_", " ").toLowerCase().replace(/^\w/u, (char) => char.toUpperCase());
}

export function isOperationalFixtureName(...names: Array<string | null | undefined>): boolean {
  return names.some((value) => typeof value === "string" && isAdminOrgDirectoryFixture(value));
}
