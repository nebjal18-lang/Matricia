import servicesSource from "@/modules/public/data/catalogue/services.json";
import categoryMapSource from "./category-map.json";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { getStaticPublicCatalogue } from "@/modules/public/data/catalogue/static-projection";
import { publicCatalogueLabel } from "@/modules/public/data/catalogue/localized-label";

export const PROVIDER_INTENT_KEY = "matricia.provider-intent.v2";
export const PROVIDER_INTENT_LEGACY_KEY = "matricia.provider-intent";
export const PROVIDER_INTENT_VERSION = 2;
export const PROVIDER_INTENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_PROVIDER_SERVICES = 12;

export type PublicProviderService = {
  code: string;
  libraryCode: string;
  name: string;
  description: string;
};

export type PublicProviderCategory = { code: string; name: string; services: PublicProviderService[] };

export type ProviderIntentDraft = {
  schemaVersion: typeof PROVIDER_INTENT_VERSION;
  updatedAt: string;
  expiresAt: string;
  serviceCodes: string[];
  otherService: string;
};

const services: PublicProviderService[] = servicesSource.map((service) => ({
  code: service.code,
  libraryCode: service.library,
  name: service.name,
  description: service.description,
}));
const serviceByCode = new Map(services.map((service) => [service.code, service]));

export function getPublicProviderTaxonomy(locale: Locale) {
  const projection = getStaticPublicCatalogue(locale);
  return {
    libraries: projection.libraries.map((library) => {
      const categories = new Map<string, PublicProviderCategory>();
      for (const service of services.filter((candidate) => candidate.libraryCode === library.code)) {
        const category = (categoryMapSource as Record<string, { code: string; name: string }>)[service.code];
        if (!category) continue;
        const group = categories.get(category.code) ?? { code: category.code, name: publicCatalogueLabel(category.name, locale), services: [] };
        group.services.push({ ...service, name: publicCatalogueLabel(service.name, locale) });
        categories.set(category.code, group);
      }
      return { code: library.code, name: library.name, categories: [...categories.values()] };
    }),
  };
}

export function createProviderIntentDraft(input: { serviceCodes: string[]; otherService: string }, now = new Date()): ProviderIntentDraft {
  const serviceCodes = [...new Set(input.serviceCodes)]
    .filter((code) => serviceByCode.has(code))
    .slice(0, MAX_PROVIDER_SERVICES);
  const otherService = input.otherService.trim().slice(0, 500);
  return {
    schemaVersion: PROVIDER_INTENT_VERSION,
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PROVIDER_INTENT_TTL_MS).toISOString(),
    serviceCodes,
    otherService,
  };
}

export function parseProviderIntentDraft(raw: string | null, now = new Date()): ProviderIntentDraft | null {
  if (!raw || raw.length > 8_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== PROVIDER_INTENT_VERSION || typeof candidate.expiresAt !== "string"
      || typeof candidate.updatedAt !== "string" || typeof candidate.otherService !== "string"
      || !Array.isArray(candidate.serviceCodes) || candidate.serviceCodes.some((code) => typeof code !== "string")) return null;
    const expiresAt = Date.parse(candidate.expiresAt);
    const updatedAt = Date.parse(candidate.updatedAt);
    if (!Number.isFinite(expiresAt) || !Number.isFinite(updatedAt) || expiresAt <= now.getTime() || updatedAt > now.getTime() + 60_000) return null;
    const normalized = createProviderIntentDraft({ serviceCodes: candidate.serviceCodes as string[], otherService: candidate.otherService }, new Date(updatedAt));
    return { ...normalized, expiresAt: candidate.expiresAt };
  } catch {
    return null;
  }
}

export function summarizeProviderIntent(draft: ProviderIntentDraft, locale: Locale): string {
  const selected = draft.serviceCodes.map((code) => serviceByCode.get(code)?.name).filter((name): name is string => Boolean(name)).map((name) => publicCatalogueLabel(name, locale));
  const lines = locale === "ar"
    ? [selected.length ? `الخدمات المختارة: ${selected.join("، ")}` : "", draft.otherService ? `خدمة غير مدرجة: ${draft.otherService}` : ""]
    : [selected.length ? `Services sélectionnés : ${selected.join(", ")}` : "", draft.otherService ? `Service non répertorié : ${draft.otherService}` : ""];
  return lines.filter(Boolean).join("\n").slice(0, 2_000);
}
