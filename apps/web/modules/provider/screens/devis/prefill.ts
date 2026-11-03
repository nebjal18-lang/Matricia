import { instantToBusinessLocal } from "./business-time";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { minorToMoneyInput } from "./money";

const uuid = z.string().uuid();
const version = z.object({
  id:uuid,solution_fr:z.string(),solution_ar:z.string().nullable(),deliverables:z.array(z.string()),inclusions:z.array(z.string()),exclusions:z.array(z.string()),prerequisites:z.array(z.string()),
  warranty_fr:z.string(),warranty_ar:z.string().nullable(),correction_terms_fr:z.string(),correction_terms_ar:z.string().nullable(),proposed_start_date:z.string(),duration_days:z.number().int(),valid_until:z.string(),change_reason:z.string(),currency:z.string().length(3),
});
const item = z.object({ quote_version_id:uuid,line_number:z.number().int().positive(),item_kind:z.enum(["ONE_TIME","RECURRING"]),label_fr:z.string(),label_ar:z.string().nullable(),quantity:z.string().regex(/^\d+(?:\.\d+)?$/u),unit_code:z.string(),unit_price_minor:z.string().regex(/^\d+$/u),tax_rule_version_id:uuid,recurrence_interval:z.enum(["MONTH","QUARTER","YEAR"]).nullable() });
export type QuotePrefill = { currency?:string;solution:string;deliverables:string;inclusions:string;exclusions:string;prerequisites:string;warranty:string;correctionTerms:string;proposedStartDate:string;durationDays:string;validUntil:string;changeReason:string;lines:{label:string;quantity:string;unitCode:string;unitPrice:string;taxRuleVersionId:string;itemKind:"ONE_TIME"|"RECURRING";recurrenceInterval:""|"MONTH"|"QUARTER"|"YEAR"}[] };

export async function loadQuotePrefills(organizationId:string, currentVersions:{ invitationId:string;versionId:string }[], locale:"fr"|"ar"):Promise<Record<string,QuotePrefill>> {
  if (!uuid.safeParse(organizationId).success || currentVersions.length === 0) return {};
  const ids = currentVersions.map((entry)=>entry.versionId).filter((id)=>uuid.safeParse(id).success).slice(0,100);
  const client = await getSupabaseServerClient();
  const [versionsResult,itemsResult]=await Promise.all([
    client.from("quote_versions").select("id,solution_fr,solution_ar,deliverables,inclusions,exclusions,prerequisites,warranty_fr,warranty_ar,correction_terms_fr,correction_terms_ar,proposed_start_date,duration_days,valid_until,change_reason,currency").eq("provider_organization_id",organizationId).in("id",ids).limit(100),
    client.from("quote_items").select("quote_version_id,line_number,item_kind,label_fr,label_ar,quantity::text,unit_code,unit_price_minor::text,tax_rule_version_id,recurrence_interval").in("quote_version_id",ids).order("line_number").limit(5000),
  ]);
  if (versionsResult.error || itemsResult.error) return {};
  const versions=z.array(version).max(100).safeParse(versionsResult.data),items=z.array(item).max(5000).safeParse(itemsResult.data);
  if (!versions.success || !items.success) return {};
  const invitationByVersion=new Map(currentVersions.map((entry)=>[entry.versionId,entry.invitationId]));
  return Object.fromEntries(versions.data.flatMap((current)=>{
    const invitationId=invitationByVersion.get(current.id);if(!invitationId)return [];
    const source=(ar:string|null,fr:string)=>locale==="ar"&&ar?.trim()?ar:fr;
    return [[invitationId,{currency:current.currency,solution:source(current.solution_ar,current.solution_fr),deliverables:current.deliverables.join("\n"),inclusions:current.inclusions.join("\n"),exclusions:current.exclusions.join("\n"),prerequisites:current.prerequisites.join("\n"),warranty:source(current.warranty_ar,current.warranty_fr),correctionTerms:source(current.correction_terms_ar,current.correction_terms_fr),proposedStartDate:current.proposed_start_date,durationDays:String(current.duration_days),validUntil:instantToBusinessLocal(current.valid_until),changeReason:current.change_reason,lines:items.data.filter((line)=>line.quote_version_id===current.id).map((line)=>({label:source(line.label_ar,line.label_fr),quantity:line.quantity,unitCode:line.unit_code,unitPrice:minorToMoneyInput(line.unit_price_minor,current.currency),taxRuleVersionId:line.tax_rule_version_id,itemKind:line.item_kind,recurrenceInterval:line.recurrence_interval??""}))} satisfies QuotePrefill]];
  }));
}
