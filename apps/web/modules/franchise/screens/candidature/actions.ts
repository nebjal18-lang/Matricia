"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type CandidateLinkState = { status: "idle" } | { status: "success" } | { status: "error"; reason: "VALIDATION" | "DENIED" | "CONFLICT" | "UNAVAILABLE" };

const inputSchema = z.object({
  locale: z.enum(["fr", "ar"]),
  applicationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  rowVersion: z.coerce.number().int().positive(),
  idempotencyKey: z.string().uuid(),
});

export async function linkMyFranchiseApplicationOrganization(_: CandidateLinkState, formData: FormData): Promise<CandidateLinkState> {
  const parsed = inputSchema.safeParse({
    locale: formData.get("locale"),
    applicationId: formData.get("applicationId"),
    organizationId: formData.get("organizationId"),
    rowVersion: formData.get("rowVersion"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const result = await (await getSupabaseServerClient()).rpc("link_my_franchise_application_organization", {
    p_application_id: parsed.data.applicationId,
    p_organization_id: parsed.data.organizationId,
    p_expected_row_version: parsed.data.rowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) {
    const code = result.error.code ?? "";
    return { status: "error", reason: code === "42501" ? "DENIED" : code === "40001" ? "CONFLICT" : code === "22023" ? "VALIDATION" : "UNAVAILABLE" };
  }
  revalidatePath(`/${parsed.data.locale}/franchise/candidature`);
  return { status: "success" };
}
