import { z } from "zod";

const minor = z.string().regex(/^\d+$/u);
const idText = z.string().min(1);

export const wholesaleOfferSchema = z.object({
  commitment_id: idText,
  provider_organization_id: idText,
  provider_name: z.string().min(1),
  franchise_organization_id: idText.optional(),
  franchise_name: z.string().min(1).optional(),
  agreement_id: idText,
  agreement_code: z.string().min(1),
  sku_id: idText,
  sku_code: z.string().min(1),
  unit_code: z.string().min(1),
  pack_quantity: z.string(),
  sku_currency: z.string().length(3),
  reference_cost_minor: minor,
  wholesale_unit_price_minor: minor,
  currency: z.string().length(3),
  capacity_units: z.string(),
  remaining_units: z.string(),
  region_codes: z.array(z.string()),
  library_code: z.string().min(1),
  category_code: z.string().min(1),
  category_name_fr: z.string().min(1),
  category_name_ar: z.string().min(1),
  service_name_fr: z.string().min(1),
  service_name_ar: z.string().min(1),
  proposed_pack_price_minor: minor,
});

export const demoValidationDocumentSchema = z.object({
  code: z.string().min(1),
  kind: z.string().min(1),
  label_fr: z.string().min(1),
  label_ar: z.string().min(1),
  status: z.enum(["VERIFIED", "SUBMITTED", "EXPIRED"]),
  reference: z.string().min(1),
  issued_on: z.string().min(8),
  expires_on: z.string().nullable(),
});

export const demoActorProfileSchema = z.object({
  organization_id: idText,
  role: z.enum(["FRANCHISEE", "PROVIDER"]),
  display_name: z.string().min(1),
  legal_name: z.string().min(1),
  territory_code: z.string().min(1),
  sector_code: z.string().min(1),
  sector_name_fr: z.string().min(1),
  sector_name_ar: z.string().min(1),
  city: z.string().min(1),
  address_fr: z.string().min(1),
  address_ar: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(8),
  manager_name: z.string().min(1),
  manager_cin: z.string().min(4),
  ice: z.string().regex(/^\d{15}$/u),
  tax_id: z.string().min(6),
  trade_register: z.string().min(2),
  rib: z.string().min(10),
  cnss: z.string().min(4),
  validation_status: z.enum(["ACTIVE", "DOCUMENT_REVIEW", "COMPANY_REVIEW"]),
  documents: z.array(demoValidationDocumentSchema).min(1),
});

export const wholesaleCatalogSchema = z.object({
  generated_at: z.string().min(10),
  territory_code: z.string().min(1),
  subject: z.string().nullable(),
  margin_bps: z.number().int().positive(),
  margin_source: z.enum(["PLATFORM_PARAMETER", "DEFAULT"]),
  territories: z.array(
    z.object({
      code: z.string().min(1),
      name_fr: z.string().min(1).optional(),
      name_ar: z.string().min(1).optional(),
    }),
  ),
  offers: z.array(wholesaleOfferSchema),
  actors: z.array(demoActorProfileSchema).default([]),
});

export type WholesaleOffer = z.infer<typeof wholesaleOfferSchema>;
export type DemoValidationDocument = z.infer<typeof demoValidationDocumentSchema>;
export type DemoActorProfile = z.infer<typeof demoActorProfileSchema>;
export type WholesaleCatalog = z.infer<typeof wholesaleCatalogSchema>;
export type WholesaleResult<T> =
  | { status: "success"; value: T }
  | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "INVALID_INPUT" | "UNAVAILABLE" | "INVALID_RESPONSE" };
