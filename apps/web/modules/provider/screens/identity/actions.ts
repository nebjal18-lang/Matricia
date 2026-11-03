"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { organizationLegalProfileSchema } from "@/modules/shared/lib/organization-identity/profile";
import type { ProfileActionState } from "@/modules/client/screens/onboarding/actions";
import { identityError, type IdentitySubmitState } from "./model";
const command = z.object({ organizationId: z.string().uuid(), locale: z.enum(["fr", "ar"]), version: z.coerce.number().int().nonnegative(), key: z.string().uuid() });
function base(form: FormData) { return command.safeParse({ organizationId: form.get("organizationId"), locale: form.get("locale"), version: form.get("expectedProfileVersion"), key: form.get("idempotencyKey") }); }
export async function saveProviderLegalProfile(_: ProfileActionState, form: FormData): Promise<ProfileActionState> {
  const input = base(form), text = (name: string) => typeof form.get(name) === "string" ? String(form.get(name)).trim() : "";
  if (!input.success || text("accuracyConfirmed") !== "yes" || text("representationAuthorized") !== "yes") return { status: "error", reason: "VALIDATION" };
  const employeeCount = text("employeeCount");
  if (!/^\d{1,9}$/u.test(employeeCount)) return { status: "error", reason: "VALIDATION" };
  const profile = organizationLegalProfileSchema.safeParse({ legal_form: text("legalForm"), incorporation_date: text("incorporationDate"), activity: text("activity"), sector: text("sector"), employee_count: Number(employeeCount), registered_city: text("registeredCity"), registered_address: { line1: text("addressLine1"), postal_code: text("postalCode"), country_code: "MA" }, contact: { phone: text("contactPhone"), email: text("contactEmail").toLowerCase() }, representative: { first_name: text("representativeFirstName"), last_name: text("representativeLastName"), title: text("representativeTitle"), email: text("representativeEmail").toLowerCase(), phone: text("representativePhone"), power: text("representativePower") }, declarations: { accuracy_confirmed: true, representation_authorized: true }, if_number: text("ifNumber"), rc_number: text("rcNumber"), ...(text("website") ? { website: text("website") } : {}) });
  if (!profile.success) return { status: "error", reason: "VALIDATION" };
  try {
    const client = await getSupabaseServerClient(), user = await client.auth.getUser();
    if (user.error || !user.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const result = await client.rpc("save_provider_legal_profile_v1", { p_organization_id: input.data.organizationId, p_profile: profile.data, p_expected_profile_version: input.data.version, p_idempotency_key: input.data.key, p_correlation_id: randomUUID() });
    const parsed = z.object({ outcome: z.literal("CLIENT_PROFILE_VERSION_CREATED"), profile_version: z.number().int().positive() }).safeParse(result.data);
    if (result.error || !parsed.success) return { status: "error", reason: "UNAVAILABLE" };
    revalidatePath(`/${input.data.locale}/sous-traitant/identite`);
    return { status: "success", profileVersion: parsed.data.profile_version };
  } catch { return { status: "error", reason: "UNAVAILABLE" }; }
}
export async function submitProviderLegalIdentity(_: IdentitySubmitState, form: FormData): Promise<IdentitySubmitState> {
  const input = base(form);
  if (!input.success || input.data.version < 1 || form.get("confirmed") !== "yes") return { status: "error", reason: "VALIDATION" };
  try {
    const client = await getSupabaseServerClient(), user = await client.auth.getUser();
    if (user.error || !user.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const result = await client.rpc("submit_provider_legal_identity_v1", { p_organization_id: input.data.organizationId, p_expected_profile_version: input.data.version, p_idempotency_key: input.data.key, p_correlation_id: randomUUID() });
    if (result.error) return { status: "error", reason: identityError(result.error) };
    if (!z.object({ outcome: z.literal("PROVIDER_LEGAL_IDENTITY_SUBMITTED"), submission_id: z.string().uuid(), profile_version: z.literal(input.data.version) }).safeParse(result.data).success) return { status: "error", reason: "FAILED" };
    revalidatePath(`/${input.data.locale}/sous-traitant/identite`);
    return { status: "success" };
  } catch { return { status: "error", reason: "FAILED" }; }
}
