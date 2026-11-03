"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localeSchema, uuidSchema } from "@/modules/client/data/rfq/model";
import { isMoroccoRegionCode } from "@/modules/shared/lib/geo/morocco-regions";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type CompleteInformationState =
  | { status: "idle" }
  | { status: "success"; complete: boolean; missing: string[] }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "TAX_ORIGIN_REVIEW" | "UNAVAILABLE" };

const inputSchema = z.object({
  locale: localeSchema,
  requestId: uuidSchema,
  rowVersion: z.coerce.number().int().positive(),
  regionCode: z.string().trim().refine((value) => value === "" || isMoroccoRegionCode(value)),
  interventionMode: z.enum(["", "ONSITE", "REMOTE", "HYBRID"]).optional(),
  idempotencyKey: uuidSchema,
});
const outputSchema = z.object({ status: z.string(), missing_quote_keys: z.array(z.string()) }).passthrough();
const answerKey = /^answer:([A-Za-z][A-Za-z0-9_.-]{1,159})$/u;

export async function completeRequestInformationAction(_: CompleteInformationState, form: FormData): Promise<CompleteInformationState> {
  const parsed = inputSchema.safeParse({
    locale: form.get("locale"),
    requestId: form.get("requestId"),
    rowVersion: form.get("rowVersion"),
    regionCode: form.get("regionCode") ?? "",
    interventionMode: form.has("interventionMode") ? form.get("interventionMode") : undefined,
    idempotencyKey: form.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const answers: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    const match = answerKey.exec(key);
    if (!match || typeof value !== "string") continue;
    const text = value.trim().slice(0, 1200);
    if (text) answers[match[1]!] = answers[match[1]!] ? `${answers[match[1]!]}, ${text}` : text;
    if (Object.keys(answers).length > 60) return { status: "error", reason: "VALIDATION" };
  }
  if(parsed.data.interventionMode!==undefined) answers.intervention_mode=parsed.data.interventionMode;
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const result = await client.rpc("complete_service_request_information", {
    p_request_id: parsed.data.requestId,
    p_expected_row_version: parsed.data.rowVersion,
    p_answers: answers,
    p_region_code: parsed.data.regionCode,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (result.error) {
    if(result.error.message?.includes("SERVICE_TAX_ORIGIN_REVIEW_REQUIRED")||result.error.message?.includes("SERVICE_TAX_EXACT_SOURCE_REQUIRED"))return{status:"error",reason:"TAX_ORIGIN_REVIEW"};
    if (result.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    if (result.error.code === "40001" || result.error.code === "55000") return { status: "error", reason: "CONFLICT" };
    if (result.error.code === "22023") return { status: "error", reason: "VALIDATION" };
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const output = outputSchema.safeParse(result.data);
  if (!output.success) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${parsed.data.locale}/client/demandes/${parsed.data.requestId}`);
  return { status: "success", complete: output.data.missing_quote_keys.length === 0 && output.data.status === "DRAFT", missing: output.data.missing_quote_keys };
}
