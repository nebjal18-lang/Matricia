"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseMoneyInput } from "@/modules/shared/lib/money-input";
import type { QuestionnaireFailure } from "@/modules/shared/lib/questionnaire-sessions/contracts";
import { canonicalizeAnswer, answerType, answerRowVersion, commandKey, isoDate, positiveRowVersion, questionnaireLocale, questionnaireUuid, type RawAnswer } from "@/modules/shared/lib/questionnaire-sessions/model";
import { createServerQuestionnaireSessionsRepository } from "@/modules/shared/lib/questionnaire-sessions/server-repository";

export type QuestionnaireActionState = { status: "idle" } | { status: "success"; operation: "STARTED" | "SAVED" | "SUBMITTED"; sessionId: string; serverRowVersion?: number; answerRowVersion?: number } | { status: "error"; reason: QuestionnaireFailure | "VALIDATION" };

const identity = z.object({ locale: questionnaireLocale, idempotencyKey: commandKey, correlationId: questionnaireUuid }).strict();
const text = (form: FormData, name: string) => form.get(name);
function refresh(locale: "fr" | "ar", sessionId?: string) { revalidatePath(`/${locale}/sous-traitant/qualification`); revalidatePath(`/${locale}/sous-traitant/questionnaires`); if (sessionId) revalidatePath(`/${locale}/sous-traitant/questionnaires?session=${sessionId}`); }

export async function startQuestionnaireAction(_: QuestionnaireActionState, form: FormData): Promise<QuestionnaireActionState> {
  const base = identity.safeParse({ locale: text(form, "locale"), idempotencyKey: text(form, "idempotencyKey"), correlationId: text(form, "correlationId") });
  const input = z.object({ organizationId: questionnaireUuid, questionnaireVersionId: questionnaireUuid, dueAt: z.union([isoDate, z.literal("")]), siteId: z.union([questionnaireUuid, z.literal("")]).optional() }).strict().safeParse({ organizationId: text(form, "organizationId"), questionnaireVersionId: text(form, "questionnaireVersionId"), dueAt: text(form, "dueAt"), siteId: text(form, "siteId") ?? "" });
  if (!base.success || !input.success) return { status: "error", reason: "VALIDATION" };
  const result = await (await createServerQuestionnaireSessionsRepository("PROVIDER")).start({ ...input.data, locale: base.data.locale, dueAt: input.data.dueAt || null, siteId: input.data.siteId || null, idempotencyKey: base.data.idempotencyKey, correlationId: base.data.correlationId });
  if (result.status === "error") return { status: "error", reason: result.reason };
  refresh(base.data.locale, result.value.sessionId); return { status: "success", operation: "STARTED", sessionId: result.value.sessionId };
}

export async function saveQuestionnaireAnswerAction(_: QuestionnaireActionState, form: FormData): Promise<QuestionnaireActionState> {
  const base = identity.safeParse({ locale: text(form, "locale"), idempotencyKey: text(form, "idempotencyKey"), correlationId: text(form, "correlationId") });
  const metadata = z.object({ sessionId: questionnaireUuid, questionVersionId: questionnaireUuid, expectedSessionRowVersion: positiveRowVersion, expectedAnswerRowVersion: answerRowVersion, answerType, nullable: z.enum(["true", "false"]), required: z.enum(["true", "false"]), clear: z.enum(["true", "false"]).default("false") }).strict().safeParse({ sessionId: text(form, "sessionId"), questionVersionId: text(form, "questionVersionId"), expectedSessionRowVersion: text(form, "expectedSessionRowVersion"), expectedAnswerRowVersion: text(form, "expectedAnswerRowVersion"), answerType: text(form, "answerType"), nullable: text(form, "nullable"), required: text(form, "required") ?? "false", clear: text(form, "clear") ?? "false" });
  if (!base.success || !metadata.success) return { status: "error", reason: "VALIDATION" };
  const raw: RawAnswer = { type: metadata.data.answerType, values: form.getAll("answerValue").filter((value): value is string => typeof value === "string"), nullable: metadata.data.nullable === "true", required: metadata.data.required === "true", clear: metadata.data.clear === "true", amountMinor: String(text(form, "amountMinor") ?? ""), currency: String(text(form, "currency") ?? "").toUpperCase(), rangeStart: String(text(form, "rangeStart") ?? ""), rangeEnd: String(text(form, "rangeEnd") ?? ""), localDate: String(text(form, "localDate") ?? ""), localTime: String(text(form, "localTime") ?? ""), timeZone: String(text(form, "timeZone") ?? ""), dstPolicy: String(text(form, "dstPolicy") ?? "") };
  if (raw.type === "MONEY" && form.has("amountMajor")) {
    const minor = parseMoneyInput(String(text(form, "amountMajor") ?? ""), raw.currency ?? "");
    if (minor === null && !raw.clear) return { status: "error", reason: "VALIDATION" };
    raw.amountMinor = minor ?? "";
  }
  const canonical = canonicalizeAnswer(raw);
  if (!canonical.success) return { status: "error", reason: "VALIDATION" };
  const result = await (await createServerQuestionnaireSessionsRepository("PROVIDER")).save({ sessionId: metadata.data.sessionId, questionVersionId: metadata.data.questionVersionId, expectedSessionRowVersion: metadata.data.expectedSessionRowVersion, expectedAnswerRowVersion: metadata.data.expectedAnswerRowVersion, answerType: metadata.data.answerType, value: canonical.value, idempotencyKey: base.data.idempotencyKey, correlationId: base.data.correlationId });
  if (result.status === "error") return { status: "error", reason: result.reason };
  refresh(base.data.locale, result.value.sessionId); return { status: "success", operation: "SAVED", sessionId: result.value.sessionId, serverRowVersion: result.value.serverRowVersion, answerRowVersion: result.value.answerRowVersion };
}

export async function submitQuestionnaireAction(_: QuestionnaireActionState, form: FormData): Promise<QuestionnaireActionState> {
  const base = identity.safeParse({ locale: text(form, "locale"), idempotencyKey: text(form, "idempotencyKey"), correlationId: text(form, "correlationId") });
  const input = z.object({ sessionId: questionnaireUuid, expectedSessionRowVersion: positiveRowVersion }).strict().safeParse({ sessionId: text(form, "sessionId"), expectedSessionRowVersion: text(form, "expectedSessionRowVersion") });
  if (!base.success || !input.success) return { status: "error", reason: "VALIDATION" };
  const result = await (await createServerQuestionnaireSessionsRepository("PROVIDER")).submit({ ...input.data, idempotencyKey: base.data.idempotencyKey, correlationId: base.data.correlationId });
  if (result.status === "error") return { status: "error", reason: result.reason };
  refresh(base.data.locale, result.value.sessionId); return { status: "success", operation: "SUBMITTED", sessionId: result.value.sessionId };
}
