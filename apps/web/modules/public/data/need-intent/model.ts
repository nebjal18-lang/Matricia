import type { Locale } from "@/modules/shared/lib/i18n/locale";
import servicesSource from "@/modules/public/data/catalogue/services.json";
import { getStaticPublicCatalogue } from "@/modules/public/data/catalogue/static-projection";
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
  return { source: PUBLIC_NEED_INTENT_SOURCE, libraryCode, libraryName, serviceCode: service.serviceCode, serviceName: publicCatalogueLabel(service.serviceName, locale) };
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
      || normalize(publicCatalogueLabel(candidate.serviceName, locale)) === normalize(requestedService));
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
    initialNeed: q || (service ? publicCatalogueLabel(service.serviceName, locale) : ""),
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

export function publicNeedRequestHref(locale: Locale, intakeId: string, serviceCode?: string | null): string {
  const params = new URLSearchParams({ intakeId });
  if (serviceCode && /^[A-Z][A-Z0-9_-]{1,79}$/u.test(serviceCode)) params.set("serviceCode", serviceCode);
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

export function assistanceTokens(text: string): string[] {
  return [...new Set(text.normalize("NFKC").toLocaleLowerCase("fr").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3))];
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

export function formatNeedScoreBasisPoints(scoreBasisPoints: number, locale: Locale): string {
  if (!Number.isInteger(scoreBasisPoints) || scoreBasisPoints < 0 || scoreBasisPoints > 10_000) return "";
  const whole = Math.trunc(scoreBasisPoints / 100);
  const fraction = scoreBasisPoints % 100;
  const body = fraction === 0 ? String(whole) : `${whole},${String(fraction).padStart(2, "0").replace(/0+$/u, "")}`;
  return locale === "ar" ? `${body}٪` : `${body} %`;
}

export function rankPublicNeedServices(need: string, locale: Locale, limit = 5): NeedServiceSuggestion[] {
  const text = need.trim();
  if (text.length < 10 || limit < 1) return [];
  const names = libraryNames(locale);
  const namesFr = libraryNames("fr");
  const namesAr = libraryNames("ar");
  return services
    .map((service) => ({
      libraryCode: service.libraryCode,
      serviceCode: service.serviceCode,
      serviceName: publicCatalogueLabel(service.serviceName, locale),
      libraryName: names.get(service.libraryCode) ?? service.libraryCode,
      scoreBasisPoints: Math.max(
        overlapBasisPoints(text, `${service.serviceName} ${service.serviceCode}`),
        overlapBasisPoints(text, namesFr.get(service.libraryCode) ?? ""),
        overlapBasisPoints(text, namesAr.get(service.libraryCode) ?? ""),
      ),
    }))
    .filter((candidate) => candidate.scoreBasisPoints > 0)
    .sort((left, right) => right.scoreBasisPoints - left.scoreBasisPoints || left.serviceCode.localeCompare(right.serviceCode))
    .slice(0, Math.min(20, limit));
}
