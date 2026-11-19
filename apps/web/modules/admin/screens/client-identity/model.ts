import { z } from "zod";

const optionalText = z.string().nullable().optional();

const addressSchema = z
  .object({
    line1: optionalText,
    line2: optionalText,
    city: optionalText,
    postal_code: optionalText,
    country_code: optionalText,
  })
  .passthrough()
  .default({});

const representativeSchema = z
  .object({
    first_name: optionalText,
    last_name: optionalText,
    title: optionalText,
    email: optionalText,
    phone: optionalText,
    power: optionalText,
  })
  .passthrough()
  .default({});

export const clientIdentityContextSchema = z.object({
  compliance_case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  case_row_version: z.number().int().positive(),
  profile_version: z.number().int().positive(),
  status: z.string(),
  identity_hash: z.string().regex(/^[a-f0-9]{64}$/),
  created_by: z.string().uuid().nullable().optional(),
  identity_snapshot: z.object({
    legal_name: z.string(),
    country_code: z.string(),
    identifiers: z.record(z.string(), z.string()),
    documents: z.array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        sha256: z.string(),
        status: z.string(),
        scan_status: z.string(),
        version: z.number().int(),
        expires_on: z.string().nullable(),
      }),
    ),
  }),
  profile_display: z
    .object({
      display_name: optionalText,
      legal_form: optionalText,
      incorporation_date: optionalText,
      activity: optionalText,
      sector: optionalText,
      registered_city: optionalText,
      registered_address: addressSchema,
      representative: representativeSchema,
      can_mutate: z.boolean().default(true),
    })
    .default({
      display_name: null,
      legal_form: null,
      incorporation_date: null,
      activity: null,
      sector: null,
      registered_city: null,
      registered_address: {},
      representative: {},
      can_mutate: true,
    }),
});

export type ClientIdentityContext = z.infer<typeof clientIdentityContextSchema>;

export type ClientIdentityState =
  | { status: "idle" }
  | { status: "success"; proofHash: string }
  | {
      status: "error";
      reason: "VALIDATION" | "FORBIDDEN" | "STALE" | "DOCUMENTS_REQUIRED" | "FAILED";
    };

export function formatAddress(
  address: ClientIdentityContext["profile_display"]["registered_address"],
  empty: string,
): string {
  const parts = [address.line1, address.line2, address.postal_code, address.city]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : empty;
}

export function displayValue(value: string | null | undefined, empty: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : empty;
}
