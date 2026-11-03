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

export function canApplyAdminDemo() {
  void isDemoClientHomeEnabled;
  return false;
}

export const demoSupervisionOrganizations: AdminSupervisionDashboard["organizations"] = [
  { id: "11111111-1111-4111-8111-111111111111", role_codes: ["CLIENT"], display_name: "Studio Atlas", legal_name: "Studio Atlas SARL", status: "ACTIVE", created_at: "2026-09-01T10:00:00.000Z", member_count: 3, open_requests: 1, open_disputes: 0 },
  { id: "22222222-2222-4222-8222-222222222222", role_codes: ["CLIENT"], display_name: "Client · Communication", legal_name: "Client Communication SARL", status: "PENDING", created_at: "2026-09-04T10:00:00.000Z", member_count: 2, open_requests: 2, open_disputes: 0 },
  { id: "33333333-3333-4333-8333-333333333333", role_codes: ["FRANCHISE"], display_name: "Franchisé · Casablanca-Settat", legal_name: "Franchise Casablanca-Settat SARL", status: "ACTIVE", created_at: "2026-08-12T10:00:00.000Z", member_count: 4, open_requests: 0, open_disputes: 1 },
  { id: "44444444-4444-4444-8444-444444444444", role_codes: ["PROVIDER"], display_name: "Conseil Anfa", legal_name: "Conseil Anfa SARL", status: "ACTIVE", created_at: "2026-07-20T10:00:00.000Z", member_count: 5, open_requests: 1, open_disputes: 0 },
];

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
  if (/progression|تقدم/i.test(column)) return ["80 %", "45 %", "100 %", "30 %"][index] ?? "60 %";
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

export function buildDemoSpaceRows(locale: Locale, space: AdminSpaceId, query: string): SpaceRow[] {
  const columns = spaceSpec(space).columns(locale);
  return demoSupervisionOrganizations.map((org, index) => {
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
  return mapAdminOrgRows(demoSupervisionOrganizations, locale);
}

export function demoActorUsers(): ActorUserRow[] {
  return demoSupervisionOrganizations.map((org, index) => ({
    userId: `a000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
    membershipId: `b000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
    organizationId: org.id,
    organizationName: org.display_name,
    roles: index === 1 ? ["CLIENT_ADMIN"] : index === 2 ? ["FRANCHISE_OPERATOR"] : index === 3 ? ["PROVIDER_ADMIN"] : ["CLIENT_OWNER"],
    status: org.status,
    updatedAt: org.created_at,
  }));
}

export function demoClientOrganizations(locale: Locale) {
  return demoSupervisionOrganizations.filter((org) => inferOrgType(org.display_name, locale, org.role_codes) === (locale === "ar" ? "عميل" : "Client"));
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
  const org = demoSupervisionOrganizations.find((item) => item.id === organizationId);
  if (!org) return null;
  const user = demoActorUsers().find((item) => item.organizationId === organizationId);
  return {
    organization: {
      id: org.id,
      display_name: org.display_name,
      legal_name: org.legal_name,
      status: org.status,
      country_code: "MA",
      created_at: org.created_at,
      updated_at: org.created_at,
    },
    memberships: [{
      id: user?.membershipId ?? org.id,
      user_id: user?.userId ?? org.id,
      status: "ACTIVE",
      roles: user?.roles ?? ["CLIENT_OWNER"],
    }],
    requests: org.open_requests > 0
      ? [{ id: "f0000001-0000-4000-8000-000000000001", status: "OPEN", created_at: "2026-09-18T10:00:00.000Z", service_id: "f0000002-0000-4000-8000-000000000002" }]
      : [],
    missions: [],
    disputes: org.open_disputes > 0
      ? [{ id: "f0000003-0000-4000-8000-000000000003", status: "OPEN", urgency: "NORMAL", mission_id: "f0000004-0000-4000-8000-000000000004", response_due_at: "2026-09-25T10:00:00.000Z" }]
      : [],
    diagnostics: [],
    subscriptions: [{ id: "f0000005-0000-4000-8000-000000000005", status: "TRIAL", plan_version_id: null, current_period_end: null }],
    timeline: [{ at: "2026-09-18T10:00:00.000Z", kind: "REQUEST", label: "Demande ouverte", ref: "demo-request" }],
  };
}

export function demoDiagnostics(): AdminSupervisionDashboard["diagnostics"] {
  return demoSupervisionOrganizations.slice(0, 2).map((org, index) => ({
    id: itemId("diagnostics", index),
    organization_id: org.id,
    organization_name: org.display_name,
    status: index === 0 ? "IN_PROGRESS" : "COMPLETED",
    rating: index === 0 ? "B" : "A",
    overall_score: index === 0 ? 72 : 91,
    completed_at: index === 0 ? null : "2026-09-16T10:00:00.000Z",
  }));
}
