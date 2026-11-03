"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const uuid = z.string().uuid();
export type PublicDiagnosticState =
  | { status: "idle" }
  | { status: "success"; opportunityId?: string; needIntakeId?: string; serviceCode?: string }
  | { status: "error"; reason: "VALIDATION" | "DENIED" | "CONFLICT" | "UNAVAILABLE" };
const decisionSchema = z.object({ need_intake_id: uuid.nullable(), service_code: z.string().regex(/^[A-Z][A-Z0-9_-]{1,79}$/u).nullable() });

function reason(message: string): "VALIDATION" | "DENIED" | "CONFLICT" | "UNAVAILABLE" {
  if (message.includes("DENIED") || message.includes("42501")) return "DENIED";
  if (message.includes("TRANSITION") || message.includes("STALE") || message.includes("55000") || message.includes("40001")) return "CONFLICT";
  if (message.includes("INVALID") || message.includes("22023")) return "VALIDATION";
  return "UNAVAILABLE";
}

export async function promotePublicDiagnostic(_: PublicDiagnosticState, formData: FormData): Promise<PublicDiagnosticState> {
  const parsed = z.object({ locale: z.enum(["fr", "ar"]), intakeId: uuid, idempotencyKey: uuid }).safeParse({
    locale: formData.get("locale"),
    intakeId: formData.get("intakeId"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const result = await (await getSupabaseServerClient()).rpc("promote_public_diagnostic_intake", {
    p_intake_id: parsed.data.intakeId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) return { status: "error", reason: reason(result.error.message) };
  revalidatePath(`/${parsed.data.locale}/client/diagnostics`);
  return { status: "success" };
}

export async function actOnPublicDiagnosticOpportunity(_: PublicDiagnosticState, formData: FormData): Promise<PublicDiagnosticState> {
  const parsed = z.object({
    locale: z.enum(["fr", "ar"]),
    opportunityId: uuid,
    action: z.enum(["CLOSE", "DEFER", "REQUEST_QUOTES"]),
    deferredUntil: z.string(),
    rowVersion: z.coerce.number().int().positive(),
    idempotencyKey: uuid,
  }).safeParse({
    locale: formData.get("locale"),
    opportunityId: formData.get("opportunityId"),
    action: formData.get("action"),
    deferredUntil: formData.get("deferredUntil") ?? "",
    rowVersion: formData.get("rowVersion"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  if (parsed.data.action === "DEFER" && !/^\d{4}-\d{2}-\d{2}$/u.test(parsed.data.deferredUntil)) return { status: "error", reason: "VALIDATION" };
  const result = await (await getSupabaseServerClient()).rpc("act_on_public_diagnostic_opportunity", {
    p_opportunity_id: parsed.data.opportunityId,
    p_action: parsed.data.action,
    p_deferred_until: parsed.data.action === "DEFER" ? parsed.data.deferredUntil : null,
    p_expected_row_version: parsed.data.rowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) return { status: "error", reason: reason(result.error.message) };
  revalidatePath(`/${parsed.data.locale}/client/diagnostics`);
  if (parsed.data.action !== "REQUEST_QUOTES") return { status: "success", opportunityId: parsed.data.opportunityId };
  const decision = decisionSchema.safeParse(result.data);
  if (!decision.success || !decision.data.need_intake_id || !decision.data.service_code) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${parsed.data.locale}/client/demandes`);
  return { status: "success", opportunityId: parsed.data.opportunityId, needIntakeId: decision.data.need_intake_id, serviceCode: decision.data.service_code };
}
