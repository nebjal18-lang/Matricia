import { z } from "zod";
import { workflowStatusLabel } from "@/modules/shared/lib/i18n/workflow-statuses";
import { readAllPages } from "@/modules/shared/lib/data/read-pages";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
const row=z.object({id:z.string().uuid(),status:z.string(),started_at:z.string().nullable(),contract_versions:z.object({currency:z.string().regex(/^[A-Z]{3}$/),request_snapshot:z.record(z.string(),z.unknown())})});
export type MissionOption={id:string;label:string;currency?:string};
export async function loadBillingMissionOptions(organizationId:string,locale:"fr"|"ar"):Promise<MissionOption[]>{
 if(!z.string().uuid().safeParse(organizationId).success)return[];
 const client=await getSupabaseServerClient();
 const result=await readAllPages((from,to)=>client.from("missions").select("id,status,started_at,contract_versions!missions_contract_version_id_fkey(currency,request_snapshot)").eq("provider_organization_id",organizationId).not("status","in","(PLANNED,CANCELLED)").order("updated_at",{ascending:false}).order("id").range(from,to));
 const parsed=z.array(row).safeParse(result.data);if(result.error||!parsed.success)return[];
 return parsed.data.map((mission,index)=>{const description=mission.contract_versions.request_snapshot.description,title=typeof description==="string"&&description.trim()?description.trim():`${locale==="ar"?"المهمة":"Mission"} ${index+1}`;return{id:mission.id,currency:mission.contract_versions.currency,label:`${title} · ${workflowStatusLabel(mission.status,locale)} · ${mission.contract_versions.currency}`};});
}
