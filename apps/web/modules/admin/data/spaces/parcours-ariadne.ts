import type { AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { spaceHref } from "./screen-catalog";

export type ParcoursChainLink = {
  key: "demande" | "matching" | "devis" | "contrat" | "mission";
  label: string;
  href: string;
};

export type ParcoursFilmIds = {
  requestId?: string | null;
  matchingId?: string | null;
  quoteId?: string | null;
  contractId?: string | null;
  missionId?: string | null;
};

export type ParcoursFilmIndex = {
  byRequest: Map<string, ParcoursFilmIds>;
  byMatching: Map<string, ParcoursFilmIds>;
  byQuote: Map<string, ParcoursFilmIds>;
  byContract: Map<string, ParcoursFilmIds>;
  byMission: Map<string, ParcoursFilmIds>;
};

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

function emptyIds(): ParcoursFilmIds {
  return {
    requestId: null,
    matchingId: null,
    quoteId: null,
    contractId: null,
    missionId: null,
  };
}

function mergeIds(base: ParcoursFilmIds, patch: ParcoursFilmIds): ParcoursFilmIds {
  return {
    requestId: patch.requestId ?? base.requestId ?? null,
    matchingId: patch.matchingId ?? base.matchingId ?? null,
    quoteId: patch.quoteId ?? base.quoteId ?? null,
    contractId: patch.contractId ?? base.contractId ?? null,
    missionId: patch.missionId ?? base.missionId ?? null,
  };
}

function remember(map: Map<string, ParcoursFilmIds>, key: string | null | undefined, ids: ParcoursFilmIds) {
  if (!key) return;
  map.set(key, mergeIds(map.get(key) ?? emptyIds(), ids));
}

/** Indexe le snapshot supervision pour reconstituter le fil demande → mission. */
export function buildParcoursFilmIndex(dash: AdminSupervisionDashboard | null | undefined): ParcoursFilmIndex {
  const byRequest = new Map<string, ParcoursFilmIds>();
  const byMatching = new Map<string, ParcoursFilmIds>();
  const byQuote = new Map<string, ParcoursFilmIds>();
  const byContract = new Map<string, ParcoursFilmIds>();
  const byMission = new Map<string, ParcoursFilmIds>();
  if (!dash) return { byRequest, byMatching, byQuote, byContract, byMission };

  for (const item of dash.requests ?? []) {
    remember(byRequest, item.id, { requestId: item.id });
  }
  for (const item of dash.matching ?? []) {
    const ids = { requestId: item.request_id, matchingId: item.id };
    remember(byRequest, item.request_id, ids);
    remember(byMatching, item.id, ids);
  }
  for (const item of dash.quotes ?? []) {
    const ids = { requestId: item.request_id, quoteId: item.id };
    remember(byRequest, item.request_id, ids);
    remember(byQuote, item.id, ids);
  }
  for (const item of dash.contracts ?? []) {
    const ids = { contractId: item.id, missionId: item.mission_id };
    remember(byContract, item.id, ids);
    if (item.mission_id) remember(byMission, item.mission_id, ids);
  }
  for (const item of dash.missions ?? []) {
    const ids = { contractId: item.contract_id, missionId: item.id };
    remember(byContract, item.contract_id, ids);
    remember(byMission, item.id, ids);
  }
  for (const item of dash.amendments ?? []) {
    const known = byContract.get(item.contract_id) ?? emptyIds();
    remember(byContract, item.contract_id, known);
  }
  for (const item of dash.messages ?? []) {
    const known = byRequest.get(item.service_request_id) ?? emptyIds();
    remember(byRequest, item.service_request_id, { ...known, requestId: item.service_request_id });
  }

  // Propagate across maps once related keys are known.
  for (const [requestId, seed] of byRequest) {
    const matching = [...byMatching.values()].find((row) => row.requestId === requestId);
    const quote = [...byQuote.values()].find((row) => row.requestId === requestId);
    const merged = mergeIds(seed, {
      matchingId: matching?.matchingId,
      quoteId: quote?.quoteId,
      contractId: matching?.contractId ?? quote?.contractId ?? seed.contractId,
      missionId: matching?.missionId ?? quote?.missionId ?? seed.missionId,
    });
    // Best-effort: attach contract/mission from quote territory via amendments/missions when quote alone.
    if (!merged.contractId) {
      const contract = [...byContract.values()].find((row) => row.requestId === requestId);
      if (contract) {
        merged.contractId = contract.contractId;
        merged.missionId = contract.missionId ?? merged.missionId;
      }
    }
    remember(byRequest, requestId, merged);
    if (merged.matchingId) remember(byMatching, merged.matchingId, merged);
    if (merged.quoteId) remember(byQuote, merged.quoteId, merged);
    if (merged.contractId) remember(byContract, merged.contractId, mergeIds(byContract.get(merged.contractId) ?? emptyIds(), merged));
    if (merged.missionId) remember(byMission, merged.missionId, mergeIds(byMission.get(merged.missionId) ?? emptyIds(), merged));
  }

  // Second pass: fill request onto contracts/missions via quote→request when film has both.
  for (const quote of dash.quotes ?? []) {
    const contract = dash.contracts.find((item) =>
      item.client_organization_id
      && dash.requests.some((request) => request.id === quote.request_id && request.organization_id === item.client_organization_id)
      && item.provider_organization_id === quote.provider_organization_id
    );
    if (!contract) continue;
    const mission = contract.mission_id
      ? dash.missions.find((item) => item.id === contract.mission_id)
      : dash.missions.find((item) => item.contract_id === contract.id);
    const matching = dash.matching.find((item) => item.request_id === quote.request_id);
    const ids: ParcoursFilmIds = {
      requestId: quote.request_id,
      matchingId: matching?.id ?? null,
      quoteId: quote.id,
      contractId: contract.id,
      missionId: mission?.id ?? contract.mission_id,
    };
    remember(byRequest, quote.request_id, ids);
    if (matching) remember(byMatching, matching.id, ids);
    remember(byQuote, quote.id, ids);
    remember(byContract, contract.id, ids);
    if (ids.missionId) remember(byMission, ids.missionId, ids);
  }

  return { byRequest, byMatching, byQuote, byContract, byMission };
}

export function resolveParcoursFilmIds(
  index: ParcoursFilmIndex,
  seed: ParcoursFilmIds,
): ParcoursFilmIds {
  const fromRequest = seed.requestId ? index.byRequest.get(seed.requestId) : undefined;
  const fromMatching = seed.matchingId ? index.byMatching.get(seed.matchingId) : undefined;
  const fromQuote = seed.quoteId ? index.byQuote.get(seed.quoteId) : undefined;
  const fromContract = seed.contractId ? index.byContract.get(seed.contractId) : undefined;
  const fromMission = seed.missionId ? index.byMission.get(seed.missionId) : undefined;
  return [seed, fromRequest, fromMatching, fromQuote, fromContract, fromMission]
    .filter(Boolean)
    .reduce<ParcoursFilmIds>((acc, part) => mergeIds(acc, part as ParcoursFilmIds), emptyIds());
}

export function buildParcoursAriadneChain(
  locale: Locale,
  query: string,
  ids: ParcoursFilmIds,
): ParcoursChainLink[] {
  const links: ParcoursChainLink[] = [];
  if (ids.requestId) {
    links.push({
      key: "demande",
      label: t(locale, "Demande", "طلب"),
      href: spaceHref(locale, "demandes", query, ids.requestId),
    });
  }
  if (ids.matchingId) {
    links.push({
      key: "matching",
      label: t(locale, "Matching", "مطابقة"),
      href: spaceHref(locale, "matching", query, ids.matchingId),
    });
  }
  if (ids.quoteId) {
    links.push({
      key: "devis",
      label: t(locale, "Devis", "عرض"),
      href: spaceHref(locale, "devis", query, ids.quoteId),
    });
  }
  if (ids.contractId) {
    links.push({
      key: "contrat",
      label: t(locale, "Contrat", "عقد"),
      href: spaceHref(locale, "contrats", query, ids.contractId),
    });
  }
  if (ids.missionId) {
    links.push({
      key: "mission",
      label: t(locale, "Mission", "مهمة"),
      href: spaceHref(locale, "missions", query, ids.missionId),
    });
  }
  return links;
}

export function formatScoreBasisPoints(scoreBasisPoints: number | null | undefined, locale: Locale): string {
  if (scoreBasisPoints == null || !Number.isFinite(scoreBasisPoints)) return "—";
  const percent = Math.round(scoreBasisPoints / 100);
  return locale === "ar" ? `${percent}٪` : `${percent} %`;
}

export function formatExclusionReasons(reasons: string[] | null | undefined, locale: Locale): string {
  if (!reasons?.length) return locale === "ar" ? "بدون استبعاد" : "Aucune exclusion";
  return reasons.slice(0, 2).join(" · ");
}

export function formatCompleteness(percent: number | null | undefined, locale: Locale): string {
  if (percent == null || !Number.isFinite(percent)) return "—";
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  return locale === "ar" ? `${safe}٪` : `${safe} %`;
}
