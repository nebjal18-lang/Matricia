import{readQuoteCommercialTerms}from"@/modules/shared/lib/contracts-missions/quote-commercial-terms";
import { z } from "zod";
import {readContractRelations}from"@/modules/shared/lib/contracts-missions/read-pages";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { uuidSchema } from "./model";
import { localizedText, textList } from "./quote-detail-model";
import { quoteCompleteness, type QuoteCompleteness } from "./quote-completeness";

const versionRow = z.object({
  sla:z.unknown().optional(),id: uuidSchema,
  solution_fr: z.string(),
  solution_ar: z.string().nullable(),
  deliverables: z.unknown(),
  exclusions: z.unknown(),
  warranty_fr: z.string(),
  warranty_ar: z.string().nullable(),
  correction_terms_fr: z.string(),
  proposed_start_date: z.string(),
  duration_days: z.number().int(),
  valid_until: z.string(),
}).strict();
const itemRow = z.object({
  quote_version_id: uuidSchema,
  item_kind: z.enum(["ONE_TIME", "RECURRING"]),
  label_fr: z.string(), label_ar: z.string().nullable(),
  subtotal_minor: z.union([z.string().regex(/^\d+$/u), z.number().int().safe().nonnegative()]).transform(String),
  recurrence_interval: z.enum(["MONTH", "QUARTER", "YEAR"]).nullable(),
}).passthrough();

export type ComparisonOfferFacts = {
  quoteVersionId: string;
  completeness: QuoteCompleteness;
  deliverables: string[];
  exclusions: string[];
  warranty: string;
  recurringLines?: Array<{label:string; subtotalMinor:string; interval:"MONTH"|"QUARTER"|"YEAR"}>;
  corrections?: string;
  paymentTerms?:string;maintenanceTerms?:string;
};

export async function loadComparisonOfferFacts(
  versionIds: string[],
  locale: Locale,
): Promise<Map<string, ComparisonOfferFacts>> {
  const ids = versionIds.filter((id) => uuidSchema.safeParse(id).success).slice(0, 100);
  const facts = new Map<string, ComparisonOfferFacts>();
  if (ids.length === 0) return facts;
  const client = await getSupabaseServerClient();
  const [versionsResult, itemsResult] = await Promise.all([
    client
      .from("quote_versions")
      .select("sla,id,solution_fr,solution_ar,deliverables,exclusions,warranty_fr,warranty_ar,correction_terms_fr,proposed_start_date,duration_days,valid_until")
      .in("id", ids)
      .limit(100),
    readContractRelations(ids,(group,from,to)=>client.from("quote_items").select("quote_version_id,item_kind,label_fr,label_ar,subtotal_minor::text,recurrence_interval").in("quote_version_id",group).order("quote_version_id").order("line_number").range(from,to)),
  ]);
  if (versionsResult.error || itemsResult.error) return facts;
  const versions = z.array(versionRow).max(100).safeParse(versionsResult.data);
  if (!versions.success) return facts;
  const counts = new Map<string, number>();
  const itemIds = z.array(itemRow).safeParse(itemsResult.data);
  if (itemIds.success) {
    for (const item of itemIds.data) counts.set(item.quote_version_id, (counts.get(item.quote_version_id) ?? 0) + 1);
  }
  for (const version of versions.data) {
    const deliverables = textList(version.deliverables);
    facts.set(version.id, {
      quoteVersionId: version.id,
      completeness: quoteCompleteness({
        solution: localizedText(locale, version.solution_fr, version.solution_ar),
        deliverablesCount: deliverables.length,
        warranty: localizedText(locale, version.warranty_fr, version.warranty_ar),
        corrections: version.correction_terms_fr,
        startDate: version.proposed_start_date,
        durationDays: version.duration_days,
        validUntil: version.valid_until,
        lineCount: counts.get(version.id) ?? 0,
      }),
      deliverables,
      exclusions: textList(version.exclusions),
      warranty: localizedText(locale, version.warranty_fr, version.warranty_ar),
      corrections: version.correction_terms_fr,
      paymentTerms:readQuoteCommercialTerms(version.sla)?.payment_terms,
      maintenanceTerms:readQuoteCommercialTerms(version.sla)?.maintenance_terms,
      recurringLines: itemIds.success ? itemIds.data.filter(item=>item.quote_version_id===version.id && item.item_kind==="RECURRING" && item.recurrence_interval!==null).map(item=>({label:localizedText(locale,item.label_fr,item.label_ar),subtotalMinor:item.subtotal_minor,interval:item.recurrence_interval!})) : undefined,
    });
  }
  return facts;
}
