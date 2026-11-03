import{readQuoteOptionPricing}from"@/modules/shared/lib/contracts-missions/quote-option-pricing";
import{readQuoteCommercialTerms}from"@/modules/shared/lib/contracts-missions/quote-commercial-terms";
import {readRelatedPages} from "@/modules/shared/lib/data/read-pages";
import { instantToBusinessLocal } from "./business-time";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { minorToMoneyInput } from "./money";

const uuid = z.string().uuid();
const version = z.object({
  sla:z.unknown().optional(),id:uuid,solution_fr:z.string(),solution_ar:z.string().nullable(),deliverables:z.array(z.string()),inclusions:z.array(z.string()),exclusions:z.array(z.string()),prerequisites:z.array(z.string()),
  warranty_fr:z.string(),warranty_ar:z.string().nullable(),correction_terms_fr:z.string(),correction_terms_ar:z.string().nullable(),proposed_start_date:z.string(),duration_days:z.number().int(),valid_until:z.string(),change_reason:z.string(),currency:z.string().length(3),
});
const item = z.object({ quote_version_id:uuid,line_number:z.number().int().positive(),item_kind:z.enum(["ONE_TIME","RECURRING"]),label_fr:z.string(),label_ar:z.string().nullable(),quantity:z.string().regex(/^\d+(?:\.\d+)?$/u),unit_code:z.string(),unit_price_minor:z.string().regex(/^\d+$/u),tax_rule_version_id:uuid,recurrence_interval:z.enum(["MONTH","QUARTER","YEAR"]).nullable() });
export type QuotePrefill = { optionPriceBasis?:"EXCLUDING_TAX"|null; options?:{label:string;price:string}[];attachments?:{id:string;documentVersionId:string;title:string}[]; paymentTerms?:string;maintenanceTerms?:string; currency?:string;solution:string;deliverables:string;inclusions:string;exclusions:string;prerequisites:string;warranty:string;correctionTerms:string;proposedStartDate:string;durationDays:string;validUntil:string;changeReason:string;lines:{label:string;quantity:string;unitCode:string;unitPrice:string;taxRuleVersionId:string;itemKind:"ONE_TIME"|"RECURRING";recurrenceInterval:""|"MONTH"|"QUARTER"|"YEAR"}[] };

export async function loadQuotePrefills(organizationId:string, currentVersions:{ invitationId:string;versionId:string }[], locale:"fr"|"ar"):Promise<Record<string,QuotePrefill> | null> {
  if (!uuid.safeParse(organizationId).success) return null;
  if (currentVersions.length === 0) return {};
  if (currentVersions.length > 100 || currentVersions.some(entry=>!uuid.safeParse(entry.versionId).success || !uuid.safeParse(entry.invitationId).success)) return null;
  const ids = currentVersions.map((entry)=>entry.versionId).filter((id)=>uuid.safeParse(id).success).slice(0,100);
  const client = await getSupabaseServerClient();
  const [versionsResult,itemsResult,optionsResult,attachmentsResult]=await Promise.all([
    readRelatedPages(ids,(batch,from,to)=>client.from("quote_versions").select("sla,id,solution_fr,solution_ar,deliverables,inclusions,exclusions,prerequisites,warranty_fr,warranty_ar,correction_terms_fr,correction_terms_ar,proposed_start_date,duration_days,valid_until,change_reason,currency").eq("provider_organization_id",organizationId).in("id",batch).order("id").range(from,to)),
    readRelatedPages(ids,(batch,from,to)=>client.from("quote_items").select("quote_version_id,line_number,item_kind,label_fr,label_ar,quantity::text,unit_code,unit_price_minor::text,tax_rule_version_id,recurrence_interval").in("quote_version_id",batch).order("quote_version_id").order("line_number").range(from,to)),
    readRelatedPages(ids,(batch,from,to)=>client.from("quote_options").select("quote_version_id,option_key,label_fr,label_ar,amount_minor::text,currency").in("quote_version_id",batch).order("quote_version_id").order("option_key").range(from,to)),
    readRelatedPages(ids,(batch,from,to)=>client.from("quote_attachments").select("id,quote_version_id,document_version_id,title").in("quote_version_id",batch).order("id").range(from,to)),
  ]);
  if (versionsResult.error || itemsResult.error || optionsResult.error || attachmentsResult.error) return null;
  const versions=z.array(version).max(100).safeParse(versionsResult.data),items=z.array(item).max(5000).safeParse(itemsResult.data);
  const options=z.array(z.object({quote_version_id:uuid,option_key:z.string(),label_fr:z.string(),label_ar:z.string().nullable(),amount_minor:z.string().regex(/^\d+$/u),currency:z.string().length(3)})).max(2000).safeParse(optionsResult.data);
  const attachments=z.array(z.object({id:uuid,quote_version_id:uuid,document_version_id:uuid,title:z.string()})).max(2000).safeParse(attachmentsResult.data);
  if (!attachments.success || !options.success || !versions.success || !items.success || new Set(versions.data.map(row=>row.id)).size !== new Set(ids).size || ids.some(id=>!items.data.some(item=>item.quote_version_id===id))) return null;
  const invitationByVersion=new Map(currentVersions.map((entry)=>[entry.versionId,entry.invitationId]));
  return Object.fromEntries(versions.data.flatMap((current)=>{
    const invitationId=invitationByVersion.get(current.id);if(!invitationId)return [];
    const commercial=readQuoteCommercialTerms(current.sla);
    const source=(ar:string|null,fr:string)=>locale==="ar"&&ar?.trim()?ar:fr;
    return [[invitationId,{optionPriceBasis:readQuoteOptionPricing(current.sla),attachments:attachments.data.filter(row=>row.quote_version_id===current.id).map(row=>({id:row.id,documentVersionId:row.document_version_id,title:row.title})),options:options.data.filter(option=>option.quote_version_id===current.id).map(option=>({label:source(option.label_ar,option.label_fr),price:minorToMoneyInput(option.amount_minor,option.currency)})),paymentTerms:commercial?.payment_terms??"",maintenanceTerms:commercial?.maintenance_terms??"",currency:current.currency,solution:source(current.solution_ar,current.solution_fr),deliverables:current.deliverables.join("\n"),inclusions:current.inclusions.join("\n"),exclusions:current.exclusions.join("\n"),prerequisites:current.prerequisites.join("\n"),warranty:source(current.warranty_ar,current.warranty_fr),correctionTerms:source(current.correction_terms_ar,current.correction_terms_fr),proposedStartDate:current.proposed_start_date,durationDays:String(current.duration_days),validUntil:instantToBusinessLocal(current.valid_until),changeReason:current.change_reason,lines:items.data.filter((line)=>line.quote_version_id===current.id).map((line)=>({label:source(line.label_ar,line.label_fr),quantity:line.quantity,unitCode:line.unit_code,unitPrice:minorToMoneyInput(line.unit_price_minor,current.currency),taxRuleVersionId:line.tax_rule_version_id,itemKind:line.item_kind,recurrenceInterval:line.recurrence_interval??""}))} satisfies QuotePrefill]];
  }));
}
