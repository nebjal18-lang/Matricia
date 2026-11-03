import "server-only";
import {getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import {fulfillmentSchema}from"./model";
import {defaultBenefitSchedule}from"./time";
import type{Locale}from"@/modules/shared/lib/i18n/locale";
export async function loadBenefitFulfillment(locale:Locale,organizationId:string|null,page:number){
 const c=await getSupabaseServerClient();const r=await c.rpc("list_benefit_fulfillment_v1",{p_organization_id:organizationId,p_page:page});const parsed=fulfillmentSchema.safeParse(r.data);
 if(r.error||!parsed.success)return null;
 const formatter=new Intl.DateTimeFormat(locale==="ar"?"ar-MA":"fr-MA",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Casablanca"});
 const label=(value:string|null|undefined)=>value?formatter.format(new Date(value)):"—";
 const defaultSchedule=defaultBenefitSchedule(Date.now());
 return{...parsed.data,rows:parsed.data.rows.map(row=>({...row,scheduled_label:label(row.scheduled_for),completed_label:label(row.proposal?.completed_at),receipt_label:label(row.receipt?.created_at),default_schedule_local:defaultSchedule}))};
}
