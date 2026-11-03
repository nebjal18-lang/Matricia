import { z } from "zod";

export const questionnaireUuid = z.string().uuid();
export const questionnaireLocale = z.enum(["fr", "ar"]);
export const databaseLocale = z.enum(["fr-MA", "ar-MA"]);
export const commandKey = z.string().min(8).max(200);
export const positiveRowVersion = z.coerce.number().int().positive();
export const answerRowVersion = z.coerce.number().int().nonnegative();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
export const sessionStatus = z.enum(["DRAFT", "IN_PROGRESS", "READY", "SUBMITTED", "ABANDONED", "EXPIRED"]);
export const answerType = z.enum([
  "YES_NO", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_TEXT", "LONG_TEXT", "INTEGER", "DECIMAL", "PERCENTAGE", "MONEY", "CURRENCY", "DATE", "DATE_RANGE", "TIME", "EMAIL", "PHONE", "URL", "ADDRESS", "GEO_AREA", "RATING_5", "RATING_10", "QUANTITY", "UNIT_VALUE", "FILE", "MULTI_FILE", "IMAGE", "TABLE", "REPEATER", "CONTACT", "ORGANIZATION", "PRODUCT_LIST", "SITE_LIST", "MILESTONE_LIST", "BUDGET_BREAKDOWN",
]);

export const startSessionInput = z.object({
  organizationId: questionnaireUuid,
  questionnaireVersionId: questionnaireUuid,
  locale: questionnaireLocale,
  dueAt: z.union([isoDate, z.literal("")]),
  siteId: z.union([questionnaireUuid, z.literal(""), z.null()]).optional(),
  idempotencyKey: commandKey,
  correlationId: questionnaireUuid,
}).strict();

export const saveAnswerInput = z.object({
  sessionId: questionnaireUuid,
  questionVersionId: questionnaireUuid,
  expectedSessionRowVersion: positiveRowVersion,
  expectedAnswerRowVersion: answerRowVersion,
  answerType,
  value: z.unknown(),
  idempotencyKey: commandKey,
  correlationId: questionnaireUuid,
}).strict();

export const submitSessionInput = z.object({
  sessionId: questionnaireUuid,
  expectedSessionRowVersion: positiveRowVersion,
  idempotencyKey: commandKey,
  correlationId: questionnaireUuid,
}).strict();

export type OrganizationOption = { id: string; name: string };
export type DocumentOption = {
  id: string;
  organizationId: string;
  name: string;
  type: "REGISTRATION_DOCUMENT" | "REPRESENTATIVE_AUTHORITY" | "TAX_DOCUMENT"|"LEGAL"|"FISCAL"|"INSURANCE"|"CERTIFICATION"|"LICENSE"|"ACCREDITATION"|"REFERENCE"|"PORTFOLIO"|"PARTNER_CONTRACT";
  mimeType: string;
  status: "PENDING_REVIEW" | "VERIFIED";
};
export type QuestionnaireOption = { id: string; version: number; titleFr: string; titleAr: string; descriptionFr: string; descriptionAr: string };
export type SessionSummary = { id: string; organizationId: string; questionnaireVersionId: string; status: z.infer<typeof sessionStatus>; locale: z.infer<typeof databaseLocale>; updatedAt: string; submittedAt: string | null; rowVersion: number; titleFr: string; titleAr: string };
export type Question = {
  id: string;
  sectionId: string;
  sortOrder: number;
  labelFr: string;
  labelAr: string;
  helpFr: string | null;
  helpAr: string | null;
  whyFr: string | null;
  whyAr: string | null;
  type: z.infer<typeof answerType>;
  required: boolean;
  nullable: boolean;
  options: string[];
  validation: Record<string, unknown>;
  structured: Record<string, unknown> | null;
  answer: { value: unknown; rowVersion: number; answeredAt: string; expiresAt: string | null; requiresRevalidation: boolean; prefilled?: boolean; source?: string } | null;
};
export type QuestionnaireSection = { id: string; labelFr: string; labelAr: string; helpFr: string | null; helpAr: string | null; sortOrder: number; questions: Question[] };
export type SessionDetail = SessionSummary & { descriptionFr: string; descriptionAr: string; sections: QuestionnaireSection[]; answeredCount: number; expiringAnswerCount: number; expiredAnswerCount: number; questionCount: number };
export type QuestionnaireDashboard = { organizations: OrganizationOption[]; documents?: DocumentOption[]; questionnaires: QuestionnaireOption[]; sessions: SessionSummary[]; selected: SessionDetail | null };

export type QuestionValidation = {
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: string;
  maximum?: string;
  pattern?: string;
};

export type StructuredField = {
  key: string;
  type: z.infer<typeof answerType>;
  nullable: boolean;
  options: string[];
  validation: QuestionValidation;
};

const boundedInteger = z.number().int().min(0).max(10_000);
const exactConstraint = z.union([z.string(), z.number()]).transform(String).refine((value) => decimalText.test(value));
const validationRecord = z.object({
  minLength: boundedInteger.optional(), maxLength: boundedInteger.optional(), minItems: boundedInteger.optional(), maxItems: boundedInteger.optional(),
  minimum: exactConstraint.optional(), maximum: exactConstraint.optional(), pattern: z.string().max(500).optional(),
  precision: boundedInteger.optional(), scale: boundedInteger.optional(), rounding: z.enum(["HALF_UP", "HALF_EVEN", "DOWN", "UP"]).optional(),
}).strict();

export function parseQuestionValidation(value: Record<string, unknown>): QuestionValidation {
  const parsed = validationRecord.safeParse(value);
  if (!parsed.success) return {};
  const constraints: QuestionValidation = {};
  if (parsed.data.minLength !== undefined) constraints.minLength = parsed.data.minLength;
  if (parsed.data.maxLength !== undefined) constraints.maxLength = parsed.data.maxLength;
  if (parsed.data.minItems !== undefined) constraints.minItems = parsed.data.minItems;
  if (parsed.data.maxItems !== undefined) constraints.maxItems = parsed.data.maxItems;
  if (parsed.data.minimum !== undefined) constraints.minimum = parsed.data.minimum;
  if (parsed.data.maximum !== undefined) constraints.maximum = parsed.data.maximum;
  if (parsed.data.pattern !== undefined) constraints.pattern = parsed.data.pattern;
  return constraints;
}

export function parseStructuredFields(question: Pick<Question, "type" | "structured">): { fields: StructuredField[]; min: number; max: number } | null {
  if ((question.type !== "TABLE" && question.type !== "REPEATER") || !question.structured) return null;
  const key = question.type === "TABLE" ? "columns" : "children";
  const countMin = question.type === "TABLE" ? "minRows" : "minItems";
  const countMax = question.type === "TABLE" ? "maxRows" : "maxItems";
  const rawFields = question.structured[key];
  const min = question.structured[countMin];
  const max = question.structured[countMax];
  if (!Array.isArray(rawFields) || !Number.isInteger(min) || !Number.isInteger(max) || Number(min) < 0 || Number(max) < Number(min) || Number(max) > 1000) return null;
  const fields: StructuredField[] = [];
  for (const raw of rawFields) {
    const parsed = z.object({ key: z.string().min(1).max(120), type: answerType, nullable: z.boolean().default(false), options: z.array(z.string().min(1)).max(1000).default([]), numeric: z.record(z.string(), z.unknown()).default({}), validation: z.record(z.string(), z.unknown()).default({}) }).strict().safeParse(raw);
    if (!parsed.success || parsed.data.type === "TABLE" || parsed.data.type === "REPEATER") return null;
    fields.push({ key: parsed.data.key, type: parsed.data.type, nullable: parsed.data.nullable, options: parsed.data.options, validation: parseQuestionValidation(parsed.data.validation) });
  }
  return fields.length ? { fields, min: Number(min), max: Number(max) } : null;
}

const integerText = /^-?(0|[1-9][0-9]*)$/u;
const decimalText = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/u;

export type RawAnswer = {
  type: z.infer<typeof answerType>;
  values: string[];
  nullable: boolean;
  required?: boolean;
  clear: boolean;
  amountMinor?: string;
  currency?: string;
  rangeStart?: string;
  rangeEnd?: string;
  localDate?: string;
  localTime?: string;
  timeZone?: string;
  dstPolicy?: string;
};

export function canonicalizeAnswer(input: RawAnswer): { success: true; value: unknown } | { success: false } {
  if (input.clear) return input.nullable ? { success: true, value: null } : { success: false };
  const first = input.values[0] ?? "";
  if (input.type === "YES_NO") return first === "true" || first === "false" ? { success: true, value: first === "true" } : { success: false };
  if (input.type === "SINGLE_CHOICE") return first.length > 0 ? { success: true, value: first } : { success: false };
  if (input.type === "MULTIPLE_CHOICE") { const values = [...new Set(input.values.filter(Boolean))]; return input.required && values.length === 0 ? { success: false } : { success: true, value: values }; }
  if (["INTEGER", "RATING_5", "RATING_10"].includes(input.type)) return integerText.test(first) ? { success: true, value: { kind: "INTEGER", value: first } } : { success: false };
  if (["DECIMAL", "PERCENTAGE", "QUANTITY", "UNIT_VALUE"].includes(input.type)) return decimalText.test(first) ? { success: true, value: { kind: "DECIMAL", value: first } } : { success: false };
  if (input.type === "MONEY") return integerText.test(input.amountMinor ?? "") && /^[A-Z]{3}$/u.test(input.currency ?? "") ? { success: true, value: { kind: "MONEY", amountMinor: input.amountMinor, currency: input.currency } } : { success: false };
  if (input.type === "DATE_RANGE") return isoDate.safeParse(input.rangeStart).success && isoDate.safeParse(input.rangeEnd).success && input.rangeStart! <= input.rangeEnd! ? { success: true, value: { kind: "DATE_RANGE", start: input.rangeStart, end: input.rangeEnd } } : { success: false };
  if (input.type === "TIME") return isoDate.safeParse(input.localDate).success && /^([01][0-9]|2[0-3]):[0-5][0-9]$/u.test(input.localTime ?? "") && /^(UTC|[^/]+\/[^/]+)$/u.test(input.timeZone ?? "") && ["EARLIER", "LATER", "REJECT"].includes(input.dstPolicy ?? "") ? { success: true, value: { kind: "LOCAL_TIME", localDate: input.localDate, localTime: input.localTime, timeZone: input.timeZone, dstPolicy: input.dstPolicy } } : { success: false };
  if (["TABLE", "REPEATER", "MULTI_FILE", "CONTACT", "ORGANIZATION", "PRODUCT_LIST", "SITE_LIST", "MILESTONE_LIST", "BUDGET_BREAKDOWN"].includes(input.type)) {
    try { return { success: true, value: JSON.parse(first) as unknown }; } catch { return { success: false }; }
  }
  if (input.type === "CURRENCY") return /^[A-Za-z]{3}$/u.test(first) ? { success: true, value: first.toUpperCase() } : { success: false };
  return first.length > 0 ? { success: true, value: first } : { success: false };
}
