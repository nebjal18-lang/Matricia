import { z } from "zod";
import { organizationLegalProfileSchema } from "@/modules/shared/lib/organization-identity/profile";
export const providerLegalIdentitySchema = z.object({
  organization_id: z.string().uuid(), legal_name: z.string(), ice: z.string().nullable(),
  profile_version: z.number().int().nonnegative(), profile: organizationLegalProfileSchema.nullable(),
  case_status: z.string().nullable(), provider_profile_ready: z.boolean(), currently_verified: z.boolean(),
  submission: z.object({ id: z.string().uuid(), profile_version: z.number().int().positive(), submitted_at: z.string() }).nullable(),
});
export type ProviderLegalIdentity = z.infer<typeof providerLegalIdentitySchema>;
export type IdentityError = "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "DOCUMENTS_REQUIRED" | "FAILED";
export type IdentitySubmitState = { status: "idle" | "success" } | { status: "error"; reason: IdentityError };
export function identityError(error: { code?: string; message?: string }): IdentityError {
  if (error.code === "42501") return "FORBIDDEN";
  if (error.code === "40001" || error.code === "23505" || error.code === "22000") return "CONFLICT";
  if (error.code === "55000") return "DOCUMENTS_REQUIRED";
  if (error.code === "22023") return "VALIDATION";
  return "FAILED";
}
