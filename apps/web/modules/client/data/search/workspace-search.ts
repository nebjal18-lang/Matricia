import { getClientOnboardingMessages } from "@/modules/client/screens/onboarding/messages";
import { workflowStatusLabel } from "@/modules/shared/lib/i18n/workflow-statuses";
import { loadClientDocumentVault } from "@/modules/client/data/documents/server-repository";
import { filterClientFacingActions } from "@/modules/client/data/home/view-model";
import { createServerClientRfqRepository } from "@/modules/client/data/rfq/server-repository";
import { loadUserActionCenterWithinBudget } from "@/modules/shared/lib/action-center/repository";
import { loadContractMissions } from "@/modules/shared/lib/contracts-missions/repository";
import { createInternalMessagingRepository } from "@/modules/shared/lib/internal-messaging/server-repository";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type ClientSearchKind = "action" | "request" | "mission" | "contract" | "document" | "message";

export type ClientSearchHit = {
  id: string;
  kind: ClientSearchKind;
  title: string;
  detail: string;
  href: string;
};

export type ClientSearchResult = {
  query: string;
  hits: ClientSearchHit[];
  unavailable: ClientSearchKind[];
  moreResults?: Array<{kind:ClientSearchKind;href:string;total?:number}>;
};

const MIN_QUERY = 2;

export function normalizeSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function matchesClientSearch(haystack: string, query: string): boolean {
  const needle = normalizeSearchQuery(query).toLowerCase();
  if (needle.length < MIN_QUERY) return false;
  return haystack.toLowerCase().includes(needle);
}

function queryWithOrg(href: string, selectedQuery: string): string {
  if (!selectedQuery) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${selectedQuery.replace(/^\?/, "")}`;
}

export async function searchClientWorkspace(input: {
  locale: Locale;
  organizationId: string | null;
  selectedQuery: string;
  query: string;
  now?: string;
}): Promise<ClientSearchResult> {
  const query = normalizeSearchQuery(input.query);
  if (query.length < MIN_QUERY) {
    return { query, hits: [], unavailable: [] };
  }

  const now = input.now ?? new Date().toISOString();
  const hits: ClientSearchHit[] = [];
  const unavailable: ClientSearchKind[] = [];
  const moreResults:NonNullable<ClientSearchResult["moreResults"]>=[];
  const org = input.organizationId ?? undefined;
  const q = input.selectedQuery;

  const [actions, requests, missions, documents, messages] = await Promise.all([
    loadUserActionCenterWithinBudget(input.locale, now, org),
    (await createServerClientRfqRepository(org ? {organizationId:org,query} : undefined)).list(),
    loadContractMissions(input.locale, org),
    loadClientDocumentVault(org,1,{query}),
    (await createInternalMessagingRepository()).search(query,org,1),
  ]);

  if (actions.status === "success") {
    for (const item of filterClientFacingActions(actions.value.items, false)) {
      if (!matchesClientSearch(`${item.title} ${item.detail} ${item.organizationName ?? ""}`, query)) continue;
      hits.push({
        id: `action:${item.id}`,
        kind: "action",
        title: item.title,
        detail: item.detail,
        href: queryWithOrg(item.href, q),
      });
    }
  } else {
    unavailable.push("action");
  }

  if (requests.status === "success") {
    if(requests.value.requests.length>20)moreResults.push({kind:"request",href:`/${input.locale}/client/demandes?${new URLSearchParams({organizationId:org??"",q:query})}`});
    for (const request of requests.value.requests.slice(0,20)) {
      if (org && request.organizationId !== org) continue;
      if (!matchesClientSearch(`${request.description} ${request.status} ${request.id}`, query)) continue;
      hits.push({
        id: `request:${request.id}`,
        kind: "request",
        title: request.description,
        detail: request.status,
        href: `/${input.locale}/client/demandes/${request.id}${q}`,
      });
    }
  } else {
    unavailable.push("request");
  }

  if (missions.status === "success") {
    for (const contract of missions.dashboard.contracts) {
      if (!matchesClientSearch(`${contract.id} ${contract.title??""} ${contract.providerOrganizationName??""} ${contract.status} ${workflowStatusLabel(contract.status,input.locale)} ${contract.changeReason}`, query)) continue;
      hits.push({
        id: `contract:${contract.id}`,
        kind: "contract",
        title: contract.title || (input.locale==="fr"?"Contrat — objet à préciser":"عقد — موضوع يحتاج إلى توضيح"),
        detail: `${workflowStatusLabel(contract.status,input.locale)} · ${contract.changeReason}`,
        href: `/${input.locale}/client/contrats${q}#contrat-${contract.id}`,
      });
    }
    for (const mission of missions.dashboard.missions) {
      const hay = [
        mission.status, mission.title??"", workflowStatusLabel(mission.status,input.locale),
        ...mission.milestones.map((item) => item.title),
        ...mission.deliverables.map((item) => item.label),
      ].join(" ");
      if (!matchesClientSearch(hay, query)) continue;
      hits.push({
        id: `mission:${mission.id}`,
        kind: "mission",
        title: mission.title || mission.milestones[0]?.title || (input.locale==="fr"?"Mission — objet à préciser":"مهمة — موضوع يحتاج إلى توضيح"),
        detail: workflowStatusLabel(mission.status,input.locale),
        href: `/${input.locale}/client/missions/${mission.id}${q}`,
      });
    }
  } else {
    unavailable.push("mission", "contract");
  }

  if (documents.status === "success") {
    if(documents.value.hasNext)moreResults.push({kind:"document",href:`/${input.locale}/client/documents?${new URLSearchParams({organizationId:org??"",q:query})}`});
    const evidenceTypes=getClientOnboardingMessages(input.locale).evidenceTypes;
    for (const document of documents.value.documents) {
      if (org && document.organizationId !== org) continue;
      if (!matchesClientSearch(`${document.fileName} ${document.type} ${document.id}`, query)) continue;
      hits.push({
        id: `document:${document.id}`,
        kind: "document",
        title: document.fileName,
        detail: Object.hasOwn(evidenceTypes,document.type)?evidenceTypes[document.type as keyof typeof evidenceTypes]:(input.locale==="fr"?"Document de conformité":"وثيقة امتثال"),
        href: `/api/client/documents/${document.id}`,
      });
    }
  } else {
    unavailable.push("document");
  }

  if (messages.status === "success") {
    if(messages.value.total>messages.value.pageSize)moreResults.push({kind:"message",total:messages.value.total,href:`/${input.locale}/messagerie?${new URLSearchParams({organizationId:org??"",q:query})}`});
    for (const thread of messages.value.inbox) {
      hits.push({
        id: `message:${thread.id}`,
        kind: "message",
        title: thread.subject,
        detail: workflowStatusLabel(thread.status,input.locale),
        href: `/${input.locale}/messagerie?fil=${encodeURIComponent(thread.id)}${org ? `&organizationId=${encodeURIComponent(org)}` : ""}`,
      });
    }
  } else {
    unavailable.push("message");
  }

  return { query, hits, unavailable,moreResults };
}
