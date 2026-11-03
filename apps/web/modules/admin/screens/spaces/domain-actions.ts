"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { executeDisputeDecision } from "@/modules/shared/lib/dispute-economics/command";
import { outcomeSchema, uuidSchema } from "@/modules/shared/lib/disputes/model";

export type DomainActionState = { status: "idle" } | { status: "success" } | { status: "error"; reason: string };

export async function decideAdminDispute(_: DomainActionState, form: FormData): Promise<DomainActionState> {
  const parsed = z.object({
    locale: z.enum(["fr", "ar"]),
    caseId: uuidSchema,
    outcome: outcomeSchema,
    reason: z.string().trim().min(10).max(2000),
    evidenceIds: z.array(uuidSchema).min(1),
    idempotencyKey: uuidSchema,
  }).safeParse({
    locale: form.get("locale"),
    caseId: form.get("caseId"),
    outcome: form.get("outcome"),
    reason: form.get("reason"),
    evidenceIds: form.getAll("evidenceIds").map(String),
    idempotencyKey: form.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const evidenceIds = parsed.data.evidenceIds;
  const result = await executeDisputeDecision({ ...parsed.data, evidenceIds });
  if (result.status === "error") return result;
  revalidatePath(`/${parsed.data.locale}/administration/litiges/${parsed.data.caseId}/decision`);
  revalidatePath(`/${parsed.data.locale}/administration/litiges/${parsed.data.caseId}`);
  revalidatePath(`/${parsed.data.locale}/administration/litiges`);
  return { status: "success" };
}
