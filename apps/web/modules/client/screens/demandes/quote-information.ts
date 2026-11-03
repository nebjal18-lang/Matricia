import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const questionSchema = z.object({
  data_key: z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{1,159}$/u),
  required: z.boolean(),
  answer_type: z.string(),
  label_fr: z.string(),
  label_ar: z.string(),
  help_fr: z.string().nullable(),
  help_ar: z.string().nullable(),
  options: z.array(z.unknown()),
  answer: z.string(),
});

const informationSchema = z.object({
  request_id: z.string().uuid(),
  status: z.string(),
  row_version: z.number().int().positive(),
  version_number: z.number().int().positive(),
  required_fields_complete: z.boolean(),
  region_code: z.string(),
  intervention_mode: z.enum(["ONSITE","REMOTE","HYBRID"]).nullable().optional(),
  questions: z.array(questionSchema),
});

export type QuoteQuestion = {
  dataKey: string;
  required: boolean;
  answerType: string;
  label: string;
  help: string | null;
  options: string[];
  answer: string;
};

export type QuoteInformation = {
  requestId: string;
  status: string;
  rowVersion: number;
  versionNumber: number;
  complete: boolean;
  regionCode: string;
  interventionMode?: "ONSITE" | "REMOTE" | "HYBRID" | null;
  questions: QuoteQuestion[];
};

function optionLabels(options: unknown[], locale: "fr" | "ar"): string[] {
  return options.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()];
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const label = (locale === "ar" ? record.ar ?? record.label_ar : record.fr ?? record.label_fr) ?? record.label ?? record.value;
      return typeof label === "string" && label.trim() ? [label.trim()] : [];
    }
    return [];
  }).slice(0, 40);
}

export function toQuoteInformation(raw: unknown, locale: "fr" | "ar"): QuoteInformation | null {
  const parsed = informationSchema.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;
  return {
    requestId: value.request_id,
    status: value.status,
    rowVersion: value.row_version,
    versionNumber: value.version_number,
    complete: value.required_fields_complete,
    regionCode: value.region_code,
    interventionMode: value.intervention_mode ?? null,
    questions: value.questions.map((question) => ({
      dataKey: question.data_key,
      required: question.required,
      answerType: question.answer_type,
      label: locale === "ar" ? question.label_ar : question.label_fr,
      help: locale === "ar" ? question.help_ar : question.help_fr,
      options: optionLabels(question.options, locale),
      answer: question.answer,
    })),
  };
}

export async function loadQuoteInformation(requestId: string, locale: "fr" | "ar"): Promise<QuoteInformation | null> {
  if (!z.string().uuid().safeParse(requestId).success) return null;
  const client = await getSupabaseServerClient();
  const result = await client.rpc("get_service_request_quote_questions", { p_request_id: requestId });
  return result.error ? null : toQuoteInformation(result.data, locale);
}
