"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SolutionFailure } from "@/modules/shared/lib/solution-insights/contracts";
import { createServerSolutionInsightsRepository } from "@/modules/shared/lib/solution-insights/server-repository";
import { solutionDecision, solutionLevel, uuid } from "@/modules/shared/lib/solution-insights/model";

export type ActionReason = "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "UNAVAILABLE";
export type State = { status: "idle" } | { status: "success" } | { status: "error"; reason: ActionReason };

const input = z.object({ locale: z.enum(["fr", "ar"]), solutionSetId: uuid, level: solutionLevel, decision: solutionDecision, reason: z.string().trim().min(3).max(2000), deferredUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/u), z.literal("")]), idempotencyKey: z.string().min(8).max(200) });
function actionReason(reason: SolutionFailure): ActionReason {
  if (reason === "UNAUTHENTICATED" || reason === "FORBIDDEN" || reason === "CONFLICT") return reason;
  return "UNAVAILABLE";
}
export async function decideAction(_: State, form: FormData): Promise<State> {
  const parsed = input.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success || (parsed.data.decision === "DEFERRED") !== Boolean(parsed.data.deferredUntil)) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data;
  const result = await (await createServerSolutionInsightsRepository()).decide({ solutionSetId: value.solutionSetId, level: value.level, decision: value.decision, reason: value.reason, deferredUntil: value.deferredUntil ? `${value.deferredUntil}T23:59:59Z` : null, idempotencyKey: value.idempotencyKey, correlationId: randomUUID() });
  if (result.status === "error") return { status: "error", reason: actionReason(result.reason) };
  revalidatePath(`/${value.locale}/client/diagnostics/solutions`);
  return { status: "success" };
}
