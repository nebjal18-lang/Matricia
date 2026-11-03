import { summarizeAdminWork } from "@/modules/admin/data/command-center/view-model";
import type { AdminWorkItem } from "@/modules/admin/data/command-center/model";
import type { AdminOrganizationFiche, AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { adminCopy } from "./copy";
import { inferOrgType } from "./directory";

export type AdminOrgRow = {
  id: string;
  name: string;
  legalName: string;
  type: string;
  typeCodes?:string[];statusCode?:string;complianceCode?:"CURRENT"|"REVIEW"|"UNKNOWN";planCode?:string;
  status: string;
  statusTone: "mint" | "sky" | "peach" | "violet";
  compliance: string;
  complianceTone: "mint" | "peach";
  plan: string;
  lastAction: string;
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
  if (key === "PENDING") return c.statusPending;
  if (key === "SUSPENDED") return c.statusSuspended;
  if (key === "ARCHIVED") return locale==="ar"?"مؤرشفة":"Archivée";
  return status;
}

export function mapAdminOrgRows(orgs: AdminSupervisionDashboard["organizations"], locale: Locale): AdminOrgRow[] {
  const c = adminCopy(locale);
  return orgs.map((org) => {
    const states:Array<boolean|null>=[];
    if(org.role_codes?.includes("CLIENT"))states.push(org.client_compliance_status?org.client_compliance_status==="VERIFIED":null);
    if(org.role_codes?.includes("PROVIDER"))states.push(org.provider_identity_verified??null);
    const complianceCode: "CURRENT"|"REVIEW"|"UNKNOWN" = states.length&&states.every(v=>v===true)&&org.canonical_identity_verified===true?"CURRENT":states.some(v=>v!==null)?"REVIEW":"UNKNOWN";
    return ({
    id: org.id,
    name: org.display_name,
    legalName: org.legal_name,
    type: inferOrgType(`${org.display_name} ${org.legal_name}`, locale, org.role_codes),
    status: localizeStatus(org.status, locale),statusCode:org.status,typeCodes:org.role_codes??[],complianceCode,planCode:"UNKNOWN",
    statusTone: org.status.toUpperCase() === "ACTIVE" ? "mint" : org.status.toUpperCase() === "PENDING" ? "sky" : "peach",
    compliance: complianceCode==="CURRENT"?c.complianceOk:complianceCode==="REVIEW"?c.complianceReview:locale==="ar"?"غير متحقق":"Non vérifié",
    complianceTone: complianceCode==="CURRENT"?"mint":"peach",
    plan: c.unknownPlan,
    lastAction: org.open_disputes > 0 ? c.lastDispute : org.open_requests > 0 ? c.lastOpenRequest : c.lastCreated,
  });});
}

export function filterAdminOrgRows(rows:AdminOrgRow[],filters:{type?:string;status?:string;compliance?:string;plan?:string},search?:string,includeArchived=false){
 return rows.filter(row=>{
  if(!includeArchived&&row.statusCode==="ARCHIVED")return false;
  if(filters.type&&filters.type!=="all"&&!row.typeCodes?.includes(filters.type)&&row.type!==filters.type)return false;
  if(filters.status&&filters.status!=="all"&&row.statusCode!==filters.status&&row.status!==filters.status)return false;
  if(filters.compliance&&filters.compliance!=="all"&&row.complianceCode!==filters.compliance&&row.compliance!==filters.compliance)return false;
  if(filters.plan&&filters.plan!=="all"&&row.planCode!==filters.plan&&row.plan!==filters.plan)return false;
  return!search||`${row.name} ${row.legalName} ${row.type} ${row.status} ${row.id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
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
    title: locale === "ar" ? item.titleAr : item.titleFr,
    detail: item.resourceType,
    href: `/${locale}/administration/command-center${query}#work-${encodeURIComponent(item.id)}`,
    tone: tones[index % tones.length]!,
  }));
  if (fromWork.length > 0) return fromWork;
  const fromRequests = requests.slice(0, 6).map((item, index) => ({
    id: item.id,
    title: item.organization_name,
    detail: item.status,
    href: `/${locale}/administration/demandes/${item.id}${query}`,
    tone: tones[index % tones.length]!,
  }));
  if (fromRequests.length > 0) return fromRequests;
  return organizations.filter((org) => org.open_disputes > 0 || org.open_requests > 0).slice(0, 6).map((org, index) => ({
    id: org.id,
    title: org.display_name,
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
