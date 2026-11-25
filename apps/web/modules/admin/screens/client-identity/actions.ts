"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ClientIdentityState } from "@/modules/admin/screens/client-identity/model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export async function reviewClientIdentity(
  _: ClientIdentityState,
  form: FormData,
): Promise<ClientIdentityState> {
  const text = (key: string) => String(form.get(key) ?? "");

  let documents: unknown;
  try {
    documents = JSON.parse(text("documents"));
  } catch {
    return { status: "error", reason: "VALIDATION" };
  }

  const input = z
    .object({
      id: z.string().uuid(),
      caseVersion: z.coerce.number().int().positive(),
      profileVersion: z.coerce.number().int().positive(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      documents: z.array(z.string().uuid()).length(3),
      reason: z.string().trim().min(10).max(2000),
      key: z.string().uuid(),
      confirmed: z.literal("yes"),
      locale: z.enum(["fr", "ar"]),
    })
    .safeParse({
      id: text("caseId"),
      caseVersion: text("caseVersion"),
      profileVersion: text("profileVersion"),
      hash: text("identityHash"),
      documents,
      reason: text("reason"),
      key: text("idempotencyKey"),
      confirmed: text("confirmed"),
      locale: text("locale"),
    });

  if (!input.success) return { status: "error", reason: "VALIDATION" };

  const value = input.data;
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "FORBIDDEN" };

  const result = await client.rpc("review_client_canonical_identifiers_v1", {
    p_compliance_case_id: value.id,
    p_expected_case_row_version: value.caseVersion,
    p_expected_profile_version: value.profileVersion,
    p_expected_identity_hash: value.hash,
    p_document_ids: value.documents,
    p_reason: value.reason,
    p_idempotency_key: value.key,
  });

  if (result.error) {
    return {
      status: "error",
      reason:
        result.error.code === "42501"
          ? "FORBIDDEN"
          : (result.error.code === "40001" || result.error.code === "PT409")
            ? "STALE"
            : result.error.code === "55000"
              ? "DOCUMENTS_REQUIRED"
              : "FAILED",
    };
  }

  const parsed = z
    .object({
      outcome: z.literal("CLIENT_CANONICAL_IDENTIFIERS_VERIFIED"),
      identity_hash: z.literal(value.hash),
      proof_hash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .safeParse(result.data);

  if (!parsed.success) return { status: "error", reason: "FAILED" };

  revalidatePath(`/${value.locale}/administration/conformite-clients`);
  revalidatePath(
    `/${value.locale}/administration/conformite-clients/${value.id}/identite`,
  );
  revalidatePath(`/${value.locale}/administration/conformite-clients/${value.id}`);

  return { status: "success", proofHash: parsed.data.proof_hash };
}
