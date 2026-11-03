import { z } from "zod";
import { legalPublicationLabel } from "@/modules/public/data/legal/publication-copy";
import { legalPublicationFields } from "@/modules/public/data/legal/publication";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export const preparationSections = ["CATALOG_SERVICE_AR", "CATALOG_CATEGORY_AR", "LEGAL", "BOX", "INTEGRATION", "RELEASE"] as const;
export type PreparationSection = (typeof preparationSections)[number];
export const integrationKeys = ["SIGNATURE", "PAYMENT", "EMAIL", "ANTIVIRUS", "SOCIAL"] as const;
export const releaseKeys = ["CNDP", "TAX", "STAGING", "ACCEPTANCE"] as const;
const arabicLetter = /[\u0600-\u06FF]/u;
const boxKey = /^PLAN:[A-Z][A-Z0-9_-]{1,40}:(QUOTA|PRIVILEGES|CONDITIONS)$/u;

export const preparationItemSchema = z.object({
  key: z.string().min(1).max(160),
  reference: z.string().nullable(),
  value: z.string().nullable(),
  row_version: z.number().int().nonnegative(),
  secret_present: z.boolean(),
});
export const preparationListSchema = z.object({ total: z.number().int().nonnegative(), items: z.array(preparationItemSchema) });
export const preparationOverviewSchema = z.object({
  services_pending: z.number().int().nonnegative(),
  services_drafted: z.number().int().nonnegative(),
  categories_pending: z.number().int().nonnegative(),
  categories_drafted: z.number().int().nonnegative(),
  legal_drafted: z.number().int().nonnegative(),
  legal_total: z.literal(11),
  box_drafted: z.number().int().nonnegative(),
  integrations_drafted: z.number().int().nonnegative(),
  integrations_secret: z.number().int().nonnegative(),
  integrations_total: z.literal(5),
  release_drafted: z.number().int().nonnegative(),
  release_total: z.literal(4),
});
export type PreparationItem = z.infer<typeof preparationItemSchema>;
export type PreparationOverview = z.infer<typeof preparationOverviewSchema>;

const inputSchema = z.object({
  locale: z.enum(["fr", "ar"]),
  section: z.enum(preparationSections),
  itemKey: z.string().trim().min(1).max(160),
  valueText: z.string().trim().min(1).max(4000),
  secret: z.string().max(4000),
  rowVersion: z.coerce.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
});

export type PreparationInput = z.infer<typeof inputSchema>;

export function parsePreparationInput(formData: FormData): PreparationInput | null {
  const parsed = inputSchema.safeParse({
    locale: formData.get("locale"),
    section: formData.get("section"),
    itemKey: formData.get("itemKey"),
    valueText: formData.get("valueText"),
    secret: formData.get("secret") ?? "",
    rowVersion: formData.get("rowVersion"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return null;
  const value = parsed.data;
  if (value.secret !== "" && (value.section !== "INTEGRATION" || value.secret.trim().length < 8 || value.secret.trim() === value.valueText)) return null;
  if ((value.section === "CATALOG_SERVICE_AR" || value.section === "CATALOG_CATEGORY_AR") && !arabicLetter.test(value.valueText)) return null;
  if (value.section === "LEGAL" && !(legalPublicationFields as readonly string[]).includes(value.itemKey)) return null;
  if (value.section === "LEGAL" && value.itemKey === "LEGAL_PRIVACY_EMAIL" && !z.string().email().safeParse(value.valueText).success) return null;
  if (value.section === "LEGAL" && value.itemKey === "LEGAL_RETENTION_AR" && !arabicLetter.test(value.valueText)) return null;
  if (value.section === "BOX" && !boxKey.test(value.itemKey)) return null;
  if (value.section === "INTEGRATION" && !(integrationKeys as readonly string[]).includes(value.itemKey)) return null;
  if (value.section === "RELEASE" && !(releaseKeys as readonly string[]).includes(value.itemKey)) return null;
  return value;
}

export function integrationLabel(locale: Locale, key: (typeof integrationKeys)[number]) {
  const fr = locale === "fr";
  const labels = {
    SIGNATURE: fr ? "Signature contractuelle" : "التوقيع التعاقدي",
    PAYMENT: fr ? "Paiement" : "الدفع",
    EMAIL: fr ? "Envoi d’e-mails" : "إرسال البريد",
    ANTIVIRUS: fr ? "Antivirus des fichiers" : "مضاد فيروسات الملفات",
    SOCIAL: fr ? "Publication sur les réseaux sociaux" : "النشر على الشبكات الاجتماعية",
  } as const;
  return labels[key];
}

export function releaseLabel(locale: Locale, key: (typeof releaseKeys)[number]) {
  const fr = locale === "fr";
  const labels = {
    CNDP: fr ? "Règles CNDP validées" : "قواعد اللجنة الوطنية المعتمدة",
    TAX: fr ? "Fiscalité validée" : "الضرائب المعتمدة",
    STAGING: fr ? "Environnement de préproduction" : "بيئة ما قبل الإنتاج",
    ACCEPTANCE: fr ? "Procès-verbal de réception" : "محضر الاستلام",
  } as const;
  return labels[key];
}

export function boxFieldLabel(locale: Locale, field: "QUOTA" | "PRIVILEGES" | "CONDITIONS") {
  const fr = locale === "fr";
  if (field === "QUOTA") return fr ? "Quotas" : "الحصص";
  if (field === "PRIVILEGES") return fr ? "Privilèges" : "الامتيازات";
  return fr ? "Conditions contractuelles" : "الشروط التعاقدية";
}

export function preparationFieldLabel(locale: Locale, section: PreparationSection, key: string) {
  if (section === "LEGAL" && (legalPublicationFields as readonly string[]).includes(key)) return legalPublicationLabel(locale, key as (typeof legalPublicationFields)[number]);
  if (section === "INTEGRATION" && (integrationKeys as readonly string[]).includes(key)) return integrationLabel(locale, key as (typeof integrationKeys)[number]);
  if (section === "RELEASE" && (releaseKeys as readonly string[]).includes(key)) return releaseLabel(locale, key as (typeof releaseKeys)[number]);
  if (section === "BOX") {
    const field = key.split(":")[2];
    if (field === "QUOTA" || field === "PRIVILEGES" || field === "CONDITIONS") return `${key.split(":")[1]} · ${boxFieldLabel(locale, field)}`;
  }
  return key;
}
