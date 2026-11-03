import type{CatalogPageInput}from "@/modules/franchise/data/library/server-page";
import { scopeFranchiseDashboards } from "@/modules/franchise/data/spaces/scoped-dashboard";
import { redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { loadFranchiseCrm } from "@/modules/franchise/data/crm/repository";
import { loadFranchiseDigest } from "@/modules/franchise/data/digest/repository";
import { loadFranchiseFollowups } from "@/modules/franchise/data/followups/repository";
import { loadFranchiseDashboard } from "@/modules/franchise/data/governance/repository";
import { loadFranchiseOperations } from "@/modules/franchise/data/operations/repository";
import { loadFranchiseCorrectivePlans } from "@/modules/franchise/data/quality/repository";
import { resolveFranchiseSpace } from "@/modules/franchise/data/spaces/context";
import { buildFranchiseSpaceBoard, emptyFranchiseSpaces } from "@/modules/franchise/data/spaces/live";
import { loadFranchiseLibraryWorkspace, type FranchiseLibraryLoadResult } from "@/modules/franchise/data/library/workspace";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export async function requireFranchiseLibrary(input: { locale: Locale; organizationId?: string;franchiseId?:string;catalog?:CatalogPageInput;returnPath?:string;returnQuery?:Record<string,string|undefined> }) {
  const destination = new URL(safeReturnPath(input.returnPath, input.locale) ?? `/${input.locale}/franchise/accueil`, "https://matricia.invalid");
  for (const [key, value] of Object.entries(input.returnQuery ?? {})) if (typeof value === "string") destination.searchParams.set(key, value);
  if (input.organizationId) destination.searchParams.set("organizationId", input.organizationId);
  if (input.franchiseId) destination.searchParams.set("franchiseId", input.franchiseId);
  const next = `${destination.pathname}${destination.search}${destination.hash}`;
  const resolved = await resolveFranchiseSpace(input);
  if (resolved.status === "unauthenticated") redirect(connexionHref(input.locale, { next }));
  const space = { ...resolved, currentPath: next, mandates: [] as Array<{id:string;organizationId:string;libraryId:string;label:string}> };
  if (space.errorReason) return { space, result: { status: "error" as const, reason: space.errorReason } };
  if (space.organizations.length > 1 && !space.selectedOrganizationId) {
    return { space, result: { status: "error" as const, reason: "ORGANIZATION_REQUIRED" as const } };
  }
  const result = await loadFranchiseLibraryWorkspace({ locale: input.locale, organizationId: space.selectedOrganizationId ?? undefined,franchiseId:input.franchiseId,catalog:input.catalog });
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(input.locale, { next }));
  if (result.status === "error" && result.reason === "MANDATE_REQUIRED") return {
    space: { ...space, mandates: (result.availableMandates ?? []).filter(item => item.organizationId === space.selectedOrganizationId) },
    result,
  };
  if (result.status === "success") {
    const organizationId = result.workspace.mandate.operatorOrganizationId ?? null;
    const mandates = (result.workspace.availableMandates ?? []).filter(item => item.organizationId === organizationId);
    if (mandates.length > 1 && !input.franchiseId) return {
      space: { ...space, mandates },
      result: { status: "error" as const, reason: "MANDATE_REQUIRED" as const },
    };
    const selected = new URLSearchParams();
    if (organizationId) selected.set("organizationId", organizationId);
    selected.set("franchiseId", result.workspace.mandate.franchiseId);
    return { space: { ...space, mandates, selectedOrganizationId: organizationId, selectedQuery: `?${selected}` }, result };
  }
  return { space, result };
}

export function franchiseMandateName(result: FranchiseLibraryLoadResult): string | null {
  return result.status === "success" ? result.workspace.mandate.libraryName : null;
}

export function franchiseCommandScope(result: FranchiseLibraryLoadResult, fallbackOrganizationId: string | null) {
  if (result.status !== "success") {
    return { libraryId: null as string | null, organizationId: fallbackOrganizationId, services: [] as Array<{ id: string; title: string }> };
  }
  return {
    libraryId: result.workspace.mandate.libraryId,
    organizationId: result.workspace.mandate.operatorOrganizationId ?? fallbackOrganizationId,
    services: result.workspace.services.map((item) => ({ id: item.id, title: item.title })),
  };
}

export function franchiseSpaceLiveArgs(input: {
  locale: Locale;
  query: string;
  result: FranchiseLibraryLoadResult;
}) {
  const libraryName = franchiseMandateName(input.result);
  if (input.result.status !== "success") {
    return { locale: input.locale, query: input.query, libraryName };
  }
  const workspace = input.result.workspace;
  return {
    locale: input.locale,
    query: input.query,
    libraryName,
    libraryId: workspace.mandate.libraryId,
    franchiseId: workspace.mandate.franchiseId,
    operatorOrganizationId: workspace.mandate.operatorOrganizationId ?? null,
    volumeServices: workspace.services
      .filter((item) => item.command?.volumeEligible)
      .map((item) => ({ id: item.id, title: item.title, status: item.status, href: item.href })),
    catalogRules: workspace.rules.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      href: item.href,
      actions: (item.ruleActions ?? []).map((action) => ({ type: action.type, target: action.target })),
    })),
  };
}

export async function loadFranchiseSpaceFromLibrary(input: {
  locale: Locale;
  query: string;
  result: FranchiseLibraryLoadResult;
}) {
  if(input.result.status!=="success")return emptyFranchiseSpaces(input.locale,input.query);
  const selected=new URLSearchParams(input.query.replace(/^\?/,""));selected.set("organizationId",input.result.workspace.mandate.operatorOrganizationId??"");selected.set("franchiseId",input.result.workspace.mandate.franchiseId);
  return loadFranchiseSpaceLive(franchiseSpaceLiveArgs({...input,query:`?${selected}`}));
}

function readSection<T>(read: Promise<T>): Promise<T | {status:"error";reason:"QUERY_FAILED"}> {
  return read.catch(() => ({status:"error",reason:"QUERY_FAILED"} as const));
}

export async function loadFranchiseSpaceLive(input: {
  locale: Locale;
  query: string;
  libraryName?: string | null;
  libraryId?: string | null;
  franchiseId?: string | null;
  operatorOrganizationId?: string | null;
  volumeServices?: Array<{ id: string; title: string; status: string; href: string }>;
  catalogRules?: Array<{ id: string; title: string; status: string; href: string; actions?: Array<{ type: string; target?: string }> }>;
}) {
  const [crm, followups, governance, plans, digest, operations] = await Promise.all([
    readSection(loadFranchiseCrm(input.franchiseId ?? undefined)),
    readSection(loadFranchiseFollowups(input.franchiseId ?? undefined)),
    readSection(loadFranchiseDashboard(input.locale,input.franchiseId?{franchiseId:input.franchiseId,libraryId:input.libraryId ?? undefined,organizationId:input.operatorOrganizationId ?? undefined}:undefined)),
    readSection(loadFranchiseCorrectivePlans(input.franchiseId ?? undefined)),
    readSection(loadFranchiseDigest(input.franchiseId ?? undefined)),
    input.libraryId ? loadFranchiseOperations({ libraryId: input.libraryId, operatorOrganizationId: input.operatorOrganizationId,franchiseId:input.franchiseId }).then((value)=>({status:"success"as const,value})).catch(()=>({status:"error"as const})) : Promise.resolve(null),
  ]);
  const scoped = scopeFranchiseDashboards({
    organizationId: input.operatorOrganizationId, libraryId: input.libraryId, franchiseId: input.franchiseId,
    governance: governance.status === "success" ? governance.dashboard : null,
    crm: crm.status === "success" ? crm.dashboard : null,
    followups: followups.status === "success" ? followups.dashboard : null,
    digest: digest.status === "success" ? digest.dashboard : null,
    plans: plans.status === "success" ? plans.plans : null,
  });
  return buildFranchiseSpaceBoard({
    locale: input.locale,
    query: input.query,
    libraryName: input.libraryName,
    crm: scoped.crm,
    followups: scoped.followups,
    governance: scoped.governance,
    plans: scoped.plans,
    digest: scoped.digest,
    operations:operations?.status==="success"?operations.value:null,
    unavailableSections:[...(crm.status==="error"?["CRM"]:[]),...(followups.status==="error"?["FOLLOWUPS"]:[]),...(governance.status==="error"?["GOVERNANCE"]:[]),...(plans.status==="error"?["QUALITY"]:[]),...(digest.status==="error"?["DIGEST"]:[]),...(operations?.status==="error"?["OPERATIONS"]:[])],
    volumeServices: input.volumeServices,
    catalogRules: input.catalogRules,
  });
}
