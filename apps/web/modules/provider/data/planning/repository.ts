import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{workflowStatusLabel}from"@/modules/shared/lib/i18n/workflow-statuses";
import{businessLocalToInstant}from"../../screens/devis/business-time";
import{addCalendarDays,planningKindLabel,type PlanningEvent}from"./events";
const row=z.object({source_id:z.string().uuid(),kind:z.enum(["consultation","quote","milestone","document","invoice","renewal"]),label_fr:z.string(),label_ar:z.string(),due_at:z.string(),parent_id:z.string().uuid().nullable(),state:z.string()}).superRefine((value,ctx)=>{if(value.kind==="milestone"&&value.parent_id===null)ctx.addIssue({code:"custom",message:"MISSION_REFERENCE_REQUIRED"});const dateOnly=["document","invoice"].includes(value.kind),valid=dateOnly?z.string().date().safeParse(value.due_at).success:z.string().datetime({offset:true}).safeParse(value.due_at).success;if(!valid)ctx.addIssue({code:"custom",message:"PLANNING_DATE_INVALID"});});
export async function loadProviderPlanning(locale:"fr"|"ar",organizationId:string|null,monday:string,page=1):Promise<{status:"success";events:PlanningEvent[];hasMore:boolean;page:number;billingVisible:boolean}|{status:"error"}>{
 if(!z.string().uuid().safeParse(organizationId).success||!z.string().date().safeParse(monday).success||!Number.isInteger(page)||page<1||page>100000)return{status:"error"};
 const until=addCalendarDays(monday,7);let fromInstant:string,untilInstant:string;try{fromInstant=businessLocalToInstant(`${monday}T00:00`);untilInstant=businessLocalToInstant(`${until}T00:00`);}catch{return{status:"error"};}
 const client=await getSupabaseServerClient();
 const result=await client.rpc("get_my_provider_planning_v1",{p_provider_organization_id:organizationId,p_from:fromInstant,p_until:untilInstant,p_from_date:monday,p_until_date:until,p_page:page,p_page_size:200});
 const parsed=z.object({events:z.array(row).max(200),has_more:z.boolean(),page:z.number().int().positive(),billing_visible:z.boolean()}).safeParse(result.data);if(result.error||!parsed.success)return{status:"error"};
 const query=`?organizationId=${encodeURIComponent(organizationId!)}`;
 const events=parsed.data.events.map(item=>{const route=item.kind==="consultation"?`consultations/${item.source_id}`:item.kind==="quote"?`devis/${item.source_id}`:item.kind==="milestone"?`missions/${item.parent_id}`:item.kind==="document"?`documents/${item.source_id}`:item.kind==="invoice"?`facturation/${item.source_id}`:"entreprise/contrat";return{id:`${item.kind}:${item.source_id}`,kind:item.kind,kindLabel:planningKindLabel(locale,item.kind),label:`${locale==="ar"?item.label_ar:item.label_fr} · ${workflowStatusLabel(item.state,locale)}`,dueAt:item.due_at,href:`/${locale}/sous-traitant/${route}${query}`};});
 return{status:"success",events,hasMore:parsed.data.has_more,page:parsed.data.page,billingVisible:parsed.data.billing_visible};
}
