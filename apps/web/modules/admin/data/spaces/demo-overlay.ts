import { demoRegionalIds } from "@/app/[locale]/connexion/demo-regional-ensure";
import { listAllDemoRegionalActors } from "@/app/[locale]/connexion/demo-regional-directory";
import { isDemoClientHomeEnabled } from "@/modules/client/data/home/demo-scenario";
import type { AdminClientCase } from "@/modules/admin/data/clients/model";
import type { AdminSpaceId } from "./admin-nav";
import { ADMIN_SPACE_IDS } from "./admin-nav";
import type { ActorUserRow } from "./actors-repository";
import { inferOrgType } from "./directory";
import { spaceHref, spaceSpec, statusTone } from "./screen-catalog";
import type { SpaceRow } from "./space-data";
import type { AdminOrganizationFiche, AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { SafeComplianceCase } from "@/modules/admin/screens/conformite-clients/actions";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { mapAdminOrgRows, type AdminOrgRow } from "./view-model";
import { buildDemoOrganizationFiche, buildDemoSupervisionOrganizations } from "./demo-supervision";

export function canApplyAdminDemo() {
  return isDemoClientHomeEnabled();
}

/** Catalogue démo = 12 régions × (1 franchisé + 3 ST + 6 clients). */
export function listDemoSupervisionOrganizations(): AdminSupervisionDashboard["organizations"] {
  return buildDemoSupervisionOrganizations();
}

/** @deprecated Prefer listDemoSupervisionOrganizations(); kept for existing imports. */
export const demoSupervisionOrganizations = buildDemoSupervisionOrganizations();

const demoStatuses = ["UNDER_REVIEW", "ACTIVE", "PENDING", "COMPLETED"] as const;

function itemId(space: AdminSpaceId, index: number) {
  const salt = ADMIN_SPACE_IDS.indexOf(space) + 1;
  return `d0000000-0000-4000-8000-${String(salt * 10 + index + 1).padStart(12, "0")}`;
}

function cellFor(column: string, org: AdminSupervisionDashboard["organizations"][number], locale: Locale, index: number) {
  const fr = locale === "fr";
  const status = demoStatuses[index % demoStatuses.length]!;
  if (/organisation|مؤسسة|prestataire|مقدم|client|عميل|franchis|امتياز/i.test(column)) return org.display_name;
  if (/état|statut|حالة|status/i.test(column)) return status;
  if (/type|نوع/i.test(column)) return inferOrgType(org.display_name, locale, org.role_codes);
  if (/progression|score|resultat|نتيجة|تقدم/i.test(column)) return ["80 %", "45 %", "100 %", "30 %"][index] ?? "60 %";
  if (/priorit|أولوي/i.test(column)) return fr ? ["Élevée", "Moyenne", "Faible", "Élevée"][index] ?? "Moyenne" : ["مرتفعة", "متوسطة", "منخفضة", "مرتفعة"][index] ?? "متوسطة";
  if (/version|نسخة/i.test(column)) return `v${index + 1}`;
  if (/document|وثيق/i.test(column)) return String(2 + index);
  if (/mission|مهام/i.test(column)) return String(index + 1);
  if (/activité|نشاط|dernière|آخر/i.test(column)) return "2026-09-18";
  if (/service|خدم/i.test(column)) return fr ? "Communication" : "التواصل";
  if (/qualification|تأهيل/i.test(column)) return status;
  if (/capacité|قدرة/i.test(column)) return fr ? "Déclarée" : "مصرّح بها";
  if (/territoire|إقليم/i.test(column)) return "Casablanca-Settat";
  if (/action|إجراء/i.test(column)) return fr ? "Ouvrir" : "فتح";
  return org.legal_name;
}

function orgsForSpace(space: AdminSpaceId) {
  const orgs = listDemoSupervisionOrganizations();
  if (/franchis|franchise/i.test(space)) return orgs.filter((org) => (org.role_codes ?? []).includes("FRANCHISE"));
  if (/provider|prestataire|sous-trait|capacite|qualification/i.test(space)) {
    return orgs.filter((org) => (org.role_codes ?? []).includes("PROVIDER"));
  }
  if (/client|conformit|diagnostic/i.test(space)) {
    return orgs.filter((org) => (org.role_codes ?? []).includes("CLIENT"));
  }
  return orgs;
}

export function buildDemoSpaceRows(locale: Locale, space: AdminSpaceId, query: string): SpaceRow[] {
  const columns = spaceSpec(space).columns(locale);
  return orgsForSpace(space).map((org, index) => {
    const status = demoStatuses[index % demoStatuses.length]!;
    const id = itemId(space, index);
    return {
      id,
      href: spaceHref(locale, space, query, id),
      title: org.display_name,
      cells: columns.map((column) => cellFor(column, org, locale, index)),
      status,
      tone: statusTone(status),
      organizationId: org.id,
      treat: index < 2,
    };
  });
}

export function demoAdminOrgRows(locale: Locale): AdminOrgRow[] {
  if (!canApplyAdminDemo()) return [];
  return mapAdminOrgRows(listDemoSupervisionOrganizations(), locale);
}

function rolesForOrg(org: AdminSupervisionDashboard["organizations"][number]) {
  if ((org.role_codes ?? []).includes("FRANCHISE")) return ["FRANCHISE_OPERATOR"];
  if ((org.role_codes ?? []).includes("PROVIDER")) return ["PROVIDER_ADMIN"];
  return ["CLIENT_OWNER"];
}

export function demoActorUsers(): ActorUserRow[] {
  return listDemoSupervisionOrganizations().map((org) => {
    const actor = listAllDemoRegionalActors().find((item) => demoRegionalIds(item).organizationId === org.id);
    const ids = actor ? demoRegionalIds(actor) : null;
    return {
      userId: ids?.userIdSeed ?? org.id,
      membershipId: ids?.membershipId ?? org.id,
      organizationId: org.id,
      organizationName: org.display_name,
      roles: rolesForOrg(org),
      status: org.status,
      updatedAt: org.created_at,
    };
  });
}

export function demoClientOrganizations(locale: Locale) {
  return listDemoSupervisionOrganizations().filter(
    (org) => inferOrgType(org.display_name, locale, org.role_codes) === (locale === "ar" ? "عميل" : "Client"),
  );
}

export function demoClientCases(): AdminClientCase[] {
  return demoClientOrganizations("fr").map((org, index) => ({
    id: `c000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
    organizationName: org.display_name,
    status: index === 0 ? "UNDER_REVIEW" : "VERIFIED",
    profileVersion: 1,
    submittedAt: "2026-09-12T10:00:00.000Z",
    updatedAt: "2026-09-18T10:00:00.000Z",
    publicReason: null,
    canDecide: true,
    documents: [],
    questions: [],
  }));
}

export function demoComplianceCases(): SafeComplianceCase[] {
  return demoClientOrganizations("fr").map((org, index) => ({
    id: `e000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
    organizationName: org.display_name,
    status: index === 0 ? "UNDER_REVIEW" : "QUESTION_REQUIRED",
    profileVersion: 1,
    submittedAt: "2026-09-12T10:00:00.000Z",
    publicReason: null,
    createdAt: org.created_at,
    updatedAt: "2026-09-18T10:00:00.000Z",
    evidence: [{ type: "REGISTRATION_DOCUMENT", status: index === 0 ? "VERIFIED" : "PENDING" }],
    anomalies: [],
    questions: [],
  }));
}

export function demoOrganizationFiche(organizationId: string): AdminOrganizationFiche | null {
  return buildDemoOrganizationFiche(organizationId);
}

export function demoDiagnostics(): AdminSupervisionDashboard["diagnostics"] {
  return listDemoSupervisionOrganizations().filter((org) => (org.role_codes ?? []).includes("CLIENT")).slice(0, 2).map((org, index) => ({
    id: itemId("diagnostics", index),
    organization_id: org.id,
    organization_name: org.display_name,
    status: index === 0 ? "IN_PROGRESS" : "COMPLETED",
    rating: index === 0 ? "ATTENTION" : "IMPORTANT",
    overall_score: index === 0 ? 72 : 55,
    completed_at: index === 0 ? null : "2026-09-16T10:00:00.000Z",
    questionnaire_version_id: `d0000000-0000-4000-8000-${String(900 + index + 1).padStart(12, "0")}`,
    questionnaire_version: index === 0 ? 1 : 2,
    questionnaire_title_fr: "Diagnostic entreprise",
    questionnaire_title_ar: "تشخيص مؤسسي",
  }));
}
