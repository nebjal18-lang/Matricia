import { summarizeAdminWork } from "@/modules/admin/data/command-center/view-model";
import type { AdminWorkItem } from "@/modules/admin/data/command-center/model";
import type { AdminOrganizationFiche, AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { actorOrganizationLabel, isAdminOrgDirectoryFixture } from "./actor-presentation";
import { adminCopy } from "./copy";
import { inferOrgType, normalizeOrgTypeCodes, ORG_TYPE_NONE, orgTypeFilterCodes } from "./directory";

export type AdminOrgRow = {
  id: string;
  name: string;
  legalName: string;
  type: string;
  typeTone?: "mint" | "sky" | "peach" | "violet";
  typeCodes?:string[];statusCode?:string;complianceCode?:"CURRENT"|"REVIEW"|"UNKNOWN";planCode?:string;
  status: string;
  statusTone: "mint" | "sky" | "peach" | "violet";
  compliance: string;
  complianceTone: "mint" | "peach" | "sky";
  plan: string;
  lastAction: string;
  fixture?: boolean;
};

export type AdminTreatItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "sky" | "peach" | "mint" | "violet";
};

export function localizeStatus(status: string, locale: Locale) {
  const c = adminCopy(locale);
  const key = status.toUpperCase();
  if (key === "ACTIVE") return c.statusActive;
  if (key === "PENDING" || key === "PENDING_APPROVAL") return c.statusPending;
  if (key === "PROPOSED") return locale === "ar" ? "مقترح" : "Proposé";
  if (key === "SUSPENDED") return c.statusSuspended;
  if (key === "ARCHIVED" || key === "RETIRED") return locale === "ar" ? "مؤرشفة" : "Archivée";
  if (key === "APPROVED" || key === "AUTHORIZED") return locale === "ar" ? "مصادق" : "Approuvé";
  if (key === "REJECTED") return locale === "ar" ? "مرفوض" : "Refusé";
  if (key === "INFORMATION_REQUIRED") return locale === "ar" ? "معلومات مطلوبة" : "Complément demandé";
  return status;
}

function normalizeTypeFilter(value: string | undefined) {
  if (!value || value === "all") return null;
  if (value === ORG_TYPE_NONE || value === "Non renseigné" || value === "غير محدد") return ORG_TYPE_NONE;
  return (value.split("_")[0] ?? value).toUpperCase();
}

export function mapAdminOrgRows(orgs: AdminSupervisionDashboard["organizations"], locale: Locale): AdminOrgRow[] {
  const c = adminCopy(locale);
  return orgs.map((org) => {
    const typeCodes = normalizeOrgTypeCodes(org.role_codes);
    const states: Array<boolean | null> = [];
    if (typeCodes.includes("CLIENT")) states.push(org.client_compliance_status ? org.client_compliance_status === "VERIFIED" : null);
    if (typeCodes.includes("PROVIDER")) states.push(org.provider_identity_verified ?? null);
    const complianceCode: "CURRENT" | "REVIEW" | "UNKNOWN" = states.length && states.every((v) => v === true) && org.canonical_identity_verified === true ? "CURRENT" : states.some((v) => v !== null) ? "REVIEW" : "UNKNOWN";
    const type = inferOrgType(`${org.display_name} ${org.legal_name}`, locale, org.role_codes);
    const typeUnset = typeCodes.length === 0;
    return ({
    id: org.id,
    name: actorOrganizationLabel(org.display_name, locale),
    legalName: org.legal_name,
    type,
    typeTone: typeUnset ? "peach" : "violet",
    status: localizeStatus(org.status, locale),
    statusCode: org.status,
    typeCodes,
    complianceCode,
    planCode: "UNKNOWN",
    statusTone: org.status.toUpperCase() === "ACTIVE" ? "mint" : org.status.toUpperCase() === "PENDING" ? "sky" : "peach",
    compliance: complianceCode === "CURRENT" ? c.complianceOk : complianceCode === "REVIEW" ? c.complianceReview : locale === "ar" ? "غير متحقق" : "Non vérifié",
    complianceTone: complianceCode === "CURRENT" ? "mint" : complianceCode === "REVIEW" ? "sky" : "peach",
    plan: c.unknownPlan,
    lastAction: org.open_disputes > 0 ? c.lastDispute : org.open_requests > 0 ? c.lastOpenRequest : c.lastCreated,
    fixture: isAdminOrgDirectoryFixture(org.display_name, org.legal_name),
  });});
}

export function filterAdminOrgRows(rows: AdminOrgRow[], filters: { type?: string; status?: string; compliance?: string; plan?: string }, search?: string, includeArchived = false) {
  const wantedType = normalizeTypeFilter(filters.type);
  const wantedStatus = filters.status && filters.status !== "all" ? filters.status.toUpperCase() : null;
  const wantedCompliance = filters.compliance && filters.compliance !== "all" ? filters.compliance.toUpperCase() : null;
  const wantedPlan = filters.plan && filters.plan !== "all" ? filters.plan.toUpperCase() : null;
  const needle = search?.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (!includeArchived && row.statusCode === "ARCHIVED") return false;
    if (wantedType && !orgTypeFilterCodes(row.typeCodes ?? []).includes(wantedType) && row.type !== filters.type) return false;
    if (wantedStatus && (row.statusCode ?? "").toUpperCase() !== wantedStatus && row.status.toUpperCase() !== wantedStatus && row.status !== filters.status) return false;
    if (wantedCompliance && (row.complianceCode ?? "").toUpperCase() !== wantedCompliance && row.compliance !== filters.compliance) return false;
    if (wantedPlan && (row.planCode ?? "").toUpperCase() !== wantedPlan && row.plan !== filters.plan) return false;
    return !needle || `${row.name} ${row.legalName} ${row.type} ${row.status} ${row.id}`.toLocaleLowerCase().includes(needle);
  });
}

export function mapAdminTreatQueue(input: {
  locale: Locale;
  query: string;
  organizations: AdminSupervisionDashboard["organizations"];
  requests: AdminSupervisionDashboard["requests"];
  workItems: AdminWorkItem[];
}): AdminTreatItem[] {
  const { locale, query, organizations, requests, workItems } = input;
  const tones = ["sky", "peach", "mint", "violet"] as const;
  const fromWork = summarizeAdminWork(workItems, new Date().toISOString()).ordered.slice(0, 6).map((item, index) => ({
    id: item.id,
    title: actorOrganizationLabel(locale === "ar" ? item.titleAr : item.titleFr, locale),
    detail: item.resourceType,
    href: `/${locale}/administration/command-center${query}#work-${encodeURIComponent(item.id)}`,
    tone: tones[index % tones.length]!,
  }));
  if (fromWork.length > 0) return fromWork;
  const fromRequests = requests.slice(0, 6).map((item, index) => ({
    id: item.id,
    title: actorOrganizationLabel(item.organization_name, locale),
    detail: item.status,
    href: `/${locale}/administration/demandes/${item.id}${query}`,
    tone: tones[index % tones.length]!,
  }));
  if (fromRequests.length > 0) return fromRequests;
  return organizations.filter((org) => org.open_disputes > 0 || org.open_requests > 0).slice(0, 6).map((org, index) => ({
    id: org.id,
    title: actorOrganizationLabel(org.display_name, locale),
    detail: org.open_disputes > 0 ? adminCopy(locale).lastDispute : adminCopy(locale).lastOpenRequest,
    href: `/${locale}/administration/entreprises/${org.id}${query}`,
    tone: tones[index % tones.length]!,
  }));
}

export function demoAdminTreatQueue(): AdminTreatItem[] {
  return [];
}

export function organizationJourney(fiche: AdminOrganizationFiche, locale: Locale) {
  const c = adminCopy(locale);
  const org = fiche.organization;
  // A dispute says nothing about the current identity verification. A stale
  // client case must also override an old VERIFIED label in the projection.
  const row = mapAdminOrgRows([{
    ...org,
    client_compliance_status: org.client_compliance_snapshot
      ? org.client_compliance_snapshot.currently_verified ? "VERIFIED" : "PENDING"
      : org.client_compliance_status,
    member_count: fiche.memberships.length,
    open_requests: fiche.requests.length,
    open_disputes: fiche.disputes.length,
  }], locale)[0]!;
  const recorded = (count: number) => locale === "ar" ? `${count} سجل` : `${count} enregistrement(s)`;
  return [
    { id: "org", label: c.orgStep, detail: org.created_at, state: "done" as const },
    { id: "compliance", label: c.compliance, detail: row.compliance,
      state: row.complianceCode === "CURRENT" ? "done" as const : row.complianceCode === "REVIEW" ? "current" as const : "pending" as const },
    { id: "diag", label: c.diag, detail: recorded(fiche.diagnostics.length), state: fiche.diagnostics.length > 0 ? "current" as const : "pending" as const },
    { id: "requests", label: c.requests, detail: recorded(fiche.requests.length), state: fiche.requests.length > 0 ? "current" as const : "pending" as const },
    { id: "missions", label: c.missions, detail: recorded(fiche.missions.length), state: fiche.missions.length > 0 ? "current" as const : "pending" as const },
  ];
}
