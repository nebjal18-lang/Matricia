import type { Locale } from "@/modules/shared/lib/i18n/locale";
import servicesSource from "@/modules/public/data/catalogue/services.json";
import { getStaticPublicCatalogue } from "@/modules/public/data/catalogue/static-projection";
import { approvedServiceNameAr } from "@/modules/public/data/catalogue/approved-ar";
import { publicCatalogueLabel } from "@/modules/public/data/catalogue/localized-label";

export const PUBLIC_NEED_INTENT_SOURCE = "PUBLIC_SERVICE_PROJECTION" as const;

export type PublicNeedClassification = {
  source: typeof PUBLIC_NEED_INTENT_SOURCE;
  libraryCode: string;
  libraryName: string;
  serviceCode: string | null;
  serviceName: string | null;
};

type QueryValue = string | string[] | undefined;
type NeedQuery = { q?: QueryValue; serviceCode?: QueryValue; service?: QueryValue; library?: QueryValue };

const services = servicesSource.map((service) => ({
  serviceCode: service.code,
  libraryCode: service.library,
  serviceName: service.name,
}));
const serviceByCode = new Map(services.map((service) => [service.serviceCode, service]));

function scalar(value: QueryValue, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("fr");
}

function libraryNames(locale: Locale): Map<string, string> {
  return new Map(getStaticPublicCatalogue(locale).libraries.map((library) => [library.code, library.name]));
}

export function canonicalizePublicNeedClassification(
  input: { libraryCode?: unknown; serviceCode?: unknown } | null | undefined,
  locale: Locale,
): PublicNeedClassification | null {
  if (!input || typeof input.libraryCode !== "string") return null;
  const names = libraryNames(locale);
  const libraryCode = input.libraryCode.trim().toUpperCase();
  const libraryName = names.get(libraryCode);
  if (!libraryName) return null;
  if (input.serviceCode === null || input.serviceCode === undefined || input.serviceCode === "") {
    return { source: PUBLIC_NEED_INTENT_SOURCE, libraryCode, libraryName, serviceCode: null, serviceName: null };
  }
  if (typeof input.serviceCode !== "string") return null;
  const service = serviceByCode.get(input.serviceCode.trim().toUpperCase());
  if (!service || service.libraryCode !== libraryCode) return null;
  return { source: PUBLIC_NEED_INTENT_SOURCE, libraryCode, libraryName, serviceCode: service.serviceCode, serviceName: publicCatalogueLabel(service.serviceName, locale, approvedServiceNameAr(service.serviceCode)) };
}

export function resolvePublicNeedQuery(query: NeedQuery, locale: Locale): {
  initialNeed: string;
  classification: PublicNeedClassification | null;
  invalidSelection: boolean;
} {
  const q = scalar(query.q, 500);
  const requestedCode = scalar(query.serviceCode, 100).toUpperCase();
  const requestedService = scalar(query.service, 200);
  const requestedLibrary = scalar(query.library, 40).toUpperCase();
  const names = libraryNames(locale);
  let service = requestedCode ? serviceByCode.get(requestedCode) : undefined;
  if (!service && !requestedCode && requestedService) {
    const candidates = services.filter((candidate) => normalize(candidate.serviceName) === normalize(requestedService)
      || normalize(publicCatalogueLabel(candidate.serviceName, locale, approvedServiceNameAr(candidate.serviceCode))) === normalize(requestedService));
    if (candidates.length === 1) service = candidates[0];
  }
  if (requestedCode && !service) return { initialNeed: q, classification: null, invalidSelection: true };
  if (requestedService && !service && !requestedCode) return { initialNeed: q, classification: null, invalidSelection: true };
  if (requestedLibrary && !names.has(requestedLibrary)) return { initialNeed: q, classification: null, invalidSelection: true };
  if (service && requestedLibrary && requestedLibrary !== service.libraryCode) {
    return { initialNeed: q, classification: null, invalidSelection: true };
  }
  const libraryCode = service?.libraryCode ?? requestedLibrary;
  const classification = libraryCode
    ? canonicalizePublicNeedClassification({ libraryCode, serviceCode: service?.serviceCode ?? null }, locale)
    : null;
  return {
    initialNeed: q || (service ? publicCatalogueLabel(service.serviceName, locale, approvedServiceNameAr(service.serviceCode)) : ""),
    classification,
    invalidSelection: false,
  };
}

export function classificationSnapshot(classification: PublicNeedClassification, locale: Locale): string {
  if (locale === "ar") {
    return classification.serviceCode
      ? `الخدمة المحددة: ${classification.serviceName} (${classification.serviceCode}). المجال: ${classification.libraryName} (${classification.libraryCode}).`
      : `المجال المحدد: ${classification.libraryName} (${classification.libraryCode}).`;
  }
  return classification.serviceCode
    ? `Service présélectionné : ${classification.serviceName} (${classification.serviceCode}). Domaine : ${classification.libraryName} (${classification.libraryCode}).`
    : `Domaine présélectionné : ${classification.libraryName} (${classification.libraryCode}).`;
}

export function serviceCodeFromNeedSnapshot(text: string): string | null {
  const match = text.match(/\(([A-Z][A-Z0-9_-]*-[A-Z0-9_-]+)\)/u);
  return match?.[1] ?? null;
}

export function publicNeedRequestHref(
  locale: Locale,
  intakeId: string,
  serviceCode?: string | null,
  organizationId?: string | null,
): string {
  const params = new URLSearchParams({ intakeId });
  if (serviceCode && /^[A-Z][A-Z0-9_-]{1,79}$/u.test(serviceCode)) params.set("serviceCode", serviceCode);
  if (organizationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(organizationId)) {
    params.set("organizationId", organizationId);
  }
  return `/${locale}/client/demandes/nouvelle?${params.toString()}`;
}

export type NeedServiceSuggestion = {
  libraryCode: string;
  serviceCode: string;
  serviceName: string;
  libraryName: string;
  scoreBasisPoints: number;
  serviceVersionId?: string;
  serviceId?: string;
};

export type NeedQuestionSuggestion = {
  questionVersionId: string;
  serviceId: string;
  dataKey: string;
  label: string;
  help: string | null;
  requiredForQuote: boolean;
  answerType: string;
  options: string[];
  scoreBasisPoints: number;
  prefill: { value: string; source: string } | null;
};

export type NeedDiscovery = {
  algorithm: "TOKEN_OVERLAP_V1";
  humanConfirmationRequired: true;
  services: NeedServiceSuggestion[];
  questions: NeedQuestionSuggestion[];
  knownCount: number;
  locationPrefill: string | null;
};

/** Domain cue tokens (FR/AR). Used only as a boost on service-name overlap — never as a sole score source. */
const DOMAIN_SIGNAL_TOKENS: Readonly<Record<string, readonly string[]>> = {
  IT: [
    "informatique", "cyber", "cybersécurité", "réseau", "reseaux", "poste", "postes", "ordinateur", "ordinateurs",
    "logiciel", "logiciels", "cloud", "serveur", "serveurs", "digital", "numérique", "helpdesk", "parc",
    "données", "data", "web", "mobile", "erp", "crm", "si", "lan", "wifi",
    "معلوماتية", "معلوماتي", "حاسوب", "أجهزة", "جهاز", "سيبراني", "شبكة", "برمجيات", "خادم",
  ],
  ACC: [
    "comptable", "comptabilité", "comptables", "fiscal", "fiscalité", "clôture", "cloture", "bilan", "tva",
    "finance", "financière", "paie", "محاسبة", "ضريبة", "إقفال", "مالية",
  ],
  BTP: [
    "bâtiment", "batiment", "bâtiments", "chantier", "électrique", "electrique", "plomberie", "architecte",
    "architecturale", "travaux", "immeuble", "immobilier", "incendie", "énergétique", "energetique",
    "géotechnique", "construction", "rénovation", "renovation",
    "مبنى", "بناء", "كهرباء", "كهربائي", "عقار", "ورش", "حريق",
  ],
  COM: ["marketing", "communication", "marque", "contenu", "publicité", "publicite", "branding", "تسويق", "تواصل", "إعلان"],
  LEGAL: ["juridique", "contrat", "contrats", "conformité", "conformite", "litige", "gouvernance", "قانوني", "عقد", "امتثال"],
  HR: ["rh", "recrutement", "formation", "paie", "compétences", "competences", "ressources", "توظيف", "تكوين", "موارد"],
  INS: ["assurance", "sinistre", "risque", "risques", "police", "تأمين", "خطر"],
  LOG: ["logistique", "achat", "achats", "approvisionnement", "stock", "supply", "لوجستيك", "مشتريات", "مخزون"],
  QHSE: ["qualité", "qualite", "hse", "sécurité", "securite", "certification", "iso", "جودة", "سلامة"],
  SALES: ["commercial", "vente", "ventes", "client", "clients", "crm", "تجارة", "مبيعات", "زبون"],
};

/** Generic cues that must not alone promote a whole library (e.g. BTP name contains « maintenance »). */
const AMBIGUOUS_OPERATIONAL_TOKENS = new Set([
  "maintenance", "entretien", "support", "assistance", "service", "services", "besoin", "besoins",
  "entreprise", "entreprises", "projet", "projets", "demande", "صيانة", "دعم", "خدمة", "احتياج", "مؤسسة",
]);

function normalizeAssistanceToken(token: string): string {
  let value = token.normalize("NFKC").toLocaleLowerCase("fr");
  // Arabic definite article — « المعلوماتي » must match cue « معلوماتي ».
  if (value.startsWith("ال") && value.length > 4) value = value.slice(2);
  return value;
}

function expandAssistanceToken(token: string): string[] {
  const values = [token];
  // Light Arabic adjective morphology: معلوماتية ↔ معلوماتي.
  if (/^[\u0600-\u06FF]+$/u.test(token) && token.endsWith("ية") && token.length > 3) {
    values.push(`${token.slice(0, -2)}ي`);
  } else if (/^[\u0600-\u06FF]+$/u.test(token) && token.endsWith("ي") && token.length > 2) {
    values.push(`${token}ة`);
  }
  return values;
}

export function assistanceTokens(text: string): string[] {
  const tokens = text
    .normalize("NFKC")
    .toLocaleLowerCase("fr")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3)
    .map(normalizeAssistanceToken);
  return [...new Set(tokens.flatMap(expandAssistanceToken))];
}

export function overlapBasisPoints(left: string, right: string): number {
  const leftTokens = new Set(assistanceTokens(left));
  const rightTokens = new Set(assistanceTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  const union = leftTokens.size + rightTokens.size - intersection;
  return union === 0 ? 0 : Math.trunc((intersection * 10_000) / union);
}

export function overlapTokenCount(left: string, right: string): number {
  const leftTokens = new Set(assistanceTokens(left));
  const rightTokens = new Set(assistanceTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection;
}

export function domainAffinityBasisPoints(needTokens: ReadonlySet<string>, libraryCode: string): number {
  const signals = DOMAIN_SIGNAL_TOKENS[libraryCode];
  if (!signals) return 0;
  let hits = 0;
  for (const signal of signals) {
    if (!needTokens.has(signal)) continue;
    if (AMBIGUOUS_OPERATIONAL_TOKENS.has(signal)) continue;
    hits += 1;
  }
  if (hits === 0) return 0;
  return Math.min(4_500, hits * 1_500);
}

export function formatNeedScoreBasisPoints(scoreBasisPoints: number, locale: Locale): string {
  if (!Number.isInteger(scoreBasisPoints) || scoreBasisPoints < 0 || scoreBasisPoints > 10_000) return "";
  const whole = Math.trunc(scoreBasisPoints / 100);
  const fraction = scoreBasisPoints % 100;
  const body = fraction === 0 ? String(whole) : `${whole},${String(fraction).padStart(2, "0").replace(/0+$/u, "")}`;
  return locale === "ar" ? `${body}٪` : `${body} %`;
}

/**
 * Rank published catalogue services for free-text need orientation.
 * Scores come from service labels only; library names are never used as a sole score
 * (BTP’s library label contains « maintenance » and previously flooded weak matches).
 * Domain cue tokens boost an already positive service overlap.
 */
export function rankPublicNeedServices(need: string, locale: Locale, limit = 5): NeedServiceSuggestion[] {
  const text = need.trim();
  if (text.length < 10 || limit < 1) return [];
  const names = libraryNames(locale);
  const needTokens = new Set(assistanceTokens(text));
  const distinctiveNeedTokens = [...needTokens].filter((token) => !AMBIGUOUS_OPERATIONAL_TOKENS.has(token));
  const ambiguousOnly = distinctiveNeedTokens.length === 0;

  const ranked = services
    .map((service) => {
      const frenchLabel = `${service.serviceName} ${service.serviceCode}`;
      const arabicLabel = approvedServiceNameAr(service.serviceCode) ?? "";
      const nameScore = Math.max(overlapBasisPoints(text, frenchLabel), overlapBasisPoints(text, arabicLabel));
      const tokenHits = Math.max(overlapTokenCount(text, frenchLabel), overlapTokenCount(text, arabicLabel));
      const affinity = domainAffinityBasisPoints(needTokens, service.libraryCode);
      // Never invent a score from domain/library alone — avoids filling five weak BTP slots.
      if (nameScore <= 0) {
        return {
          libraryCode: service.libraryCode,
          serviceCode: service.serviceCode,
          serviceName: publicCatalogueLabel(service.serviceName, locale, approvedServiceNameAr(service.serviceCode)),
          libraryName: names.get(service.libraryCode) ?? service.libraryCode,
          scoreBasisPoints: 0,
          tokenHits: 0,
        };
      }
      // Single ambiguous token (e.g. bare « maintenance ») is not enough to propose a shortlist.
      if (ambiguousOnly && tokenHits < 2 && affinity === 0) {
        return {
          libraryCode: service.libraryCode,
          serviceCode: service.serviceCode,
          serviceName: publicCatalogueLabel(service.serviceName, locale, approvedServiceNameAr(service.serviceCode)),
          libraryName: names.get(service.libraryCode) ?? service.libraryCode,
          scoreBasisPoints: 0,
          tokenHits,
        };
      }
      return {
        libraryCode: service.libraryCode,
        serviceCode: service.serviceCode,
        serviceName: publicCatalogueLabel(service.serviceName, locale, approvedServiceNameAr(service.serviceCode)),
        libraryName: names.get(service.libraryCode) ?? service.libraryCode,
        scoreBasisPoints: Math.min(10_000, nameScore + affinity),
        tokenHits,
      };
    })
    .filter((candidate) => candidate.scoreBasisPoints > 0)
    .sort((left, right) =>
      right.scoreBasisPoints - left.scoreBasisPoints
      || right.tokenHits - left.tokenHits
      || left.serviceCode.localeCompare(right.serviceCode));

  return ranked.slice(0, Math.min(20, limit)).map(({ tokenHits: _tokenHits, ...candidate }) => candidate);
}
