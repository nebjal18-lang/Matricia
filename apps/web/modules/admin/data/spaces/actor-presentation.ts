import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  fixturesHiddenLabel,
  isDirectoryFixture,
  isDirectoryOrgFixture,
  organizationDisplayLabel,
  personAvatarInitial,
  personContactLine,
  personDisplayLabel,
  scopeLabelsLine,
} from "@/modules/shared/lib/directory-presentation";
import type { ActorAccountSummary, ActorUserRow } from "./actor-user-model";

const ROLE_LABELS = {
  fr: {
    CLIENT_OWNER: "Propriétaire client",
    CLIENT_ADMIN: "Admin client",
    CLIENT_BUYER: "Acheteur",
    CLIENT_ACCOUNTING: "Comptabilité client",
    CLIENT_MEMBER: "Membre client",
    CLIENT_VIEWER: "Lecteur client",
    PROVIDER_OWNER: "Propriétaire prestataire",
    PROVIDER_MANAGER: "Manager prestataire",
    PROVIDER_SALES: "Commercial prestataire",
    PROVIDER_TECHNICIAN: "Technicien",
    PROVIDER_ACCOUNTING: "Comptabilité prestataire",
    PROVIDER_VIEWER: "Lecteur prestataire",
    FRANCHISE_OWNER: "Propriétaire franchise",
    FRANCHISE_MANAGER: "Manager franchise",
    FRANCHISE_EXPERT: "Expert franchise",
    FRANCHISE_PROVIDER_MANAGER: "Réseau prestataires",
    FRANCHISE_ACCOUNTING: "Comptabilité franchise",
    FRANCHISE_VIEWER: "Lecteur franchise",
    SUPER_ADMIN: "Super admin",
    MATRICIA_ADMIN: "Admin Matricia",
    FINANCE_MANAGER: "Finance",
    COMPLIANCE_MANAGER: "Conformité",
    READ_ONLY_AUDITOR: "Auditeur",
  },
  ar: {
    CLIENT_OWNER: "مالك العميل",
    CLIENT_ADMIN: "مشرف العميل",
    CLIENT_BUYER: "مشترٍ",
    CLIENT_ACCOUNTING: "محاسبة العميل",
    CLIENT_MEMBER: "عضو عميل",
    CLIENT_VIEWER: "قارئ عميل",
    PROVIDER_OWNER: "مالك المقاول",
    PROVIDER_MANAGER: "مدير المقاول",
    PROVIDER_SALES: "مبيعات المقاول",
    PROVIDER_TECHNICIAN: "تقني",
    PROVIDER_ACCOUNTING: "محاسبة المقاول",
    PROVIDER_VIEWER: "قارئ المقاول",
    FRANCHISE_OWNER: "مالك الامتياز",
    FRANCHISE_MANAGER: "مدير الامتياز",
    FRANCHISE_EXPERT: "خبير الامتياز",
    FRANCHISE_PROVIDER_MANAGER: "شبكة المقاولين",
    FRANCHISE_ACCOUNTING: "محاسبة الامتياز",
    FRANCHISE_VIEWER: "قارئ الامتياز",
    SUPER_ADMIN: "مشرف أعلى",
    MATRICIA_ADMIN: "إدارة ماتريسيا",
    FINANCE_MANAGER: "المالية",
    COMPLIANCE_MANAGER: "الامتثال",
    READ_ONLY_AUDITOR: "مدقق",
  },
} as const;

export function isAdminDirectoryFixture(row: Pick<ActorUserRow, "email" | "displayName" | "organizationName" | "givenName" | "familyName">): boolean {
  return isDirectoryFixture(row);
}

export function isAdminOrgDirectoryFixture(name: string, legalName = ""): boolean {
  return isDirectoryOrgFixture(name, legalName);
}

export function adminFixturesHiddenLabel(count: number, locale: Locale): string {
  return fixturesHiddenLabel(count, locale);
}

export function actorAccountTitle(
  row: Pick<ActorUserRow | ActorAccountSummary, "displayName" | "email" | "givenName" | "familyName">,
  locale: Locale,
): string {
  return personDisplayLabel(row, locale);
}

export function actorAccountSubtitle(row: Pick<ActorUserRow | ActorAccountSummary, "email" | "userId" | "phone" | "preferredLocale">): string {
  return personContactLine(row);
}

export function actorMembershipOrganizationsLabel(
  memberships: readonly { organizationName: string | null }[],
  locale: Locale,
): string {
  const empty = locale === "ar" ? "بدون مؤسسة" : "Sans organisation";
  const names = [...new Set(memberships.map((item) => organizationDisplayLabel(item.organizationName, locale)).filter((name) => name !== empty))];
  if (!names.length) return empty;
  if (names.length <= 2) return names.join(" · ");
  return `${names[0]} · +${names.length - 1}`;
}

export function actorMembershipRolesLabel(
  memberships: readonly { roles: readonly string[] }[],
  locale: Locale,
): string {
  const roles = [...new Set(memberships.flatMap((item) => item.roles))];
  return actorRolesLabel(roles, locale);
}

export function actorRoleLabel(role: string, locale: Locale): string {
  const table = ROLE_LABELS[locale];
  return (table as Record<string, string>)[role] ?? role;
}

export function actorRolesLabel(roles: readonly string[], locale: Locale): string {
  if (!roles.length) return "—";
  return roles.map((role) => actorRoleLabel(role, locale)).join(" · ");
}

export function actorOrganizationLabel(name: string | null, locale: Locale): string {
  return organizationDisplayLabel(name, locale);
}

export function actorAvatarInitial(
  row: Pick<ActorUserRow | ActorAccountSummary, "displayName" | "email" | "givenName" | "familyName">,
  locale: Locale,
): string {
  return personAvatarInitial(row, locale);
}

export function actorScopeLabels(scopes: readonly string[] | undefined, locale: Locale): string {
  return scopeLabelsLine(scopes ?? [], locale === "ar" ? "غير محدد" : "Non défini");
}
