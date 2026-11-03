import { z } from "zod";
import {getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
export const openContextSchema=z.object({organization_id:z.string().uuid(),missions:z.array(z.object({id:z.string().uuid(),status:z.string(),policy_ready:z.boolean(),obligations:z.array(z.object({key:z.string(),label_fr:z.string(),label_ar:z.string()}))})),documents:z.array(z.object({id:z.string().uuid(),name:z.string()}))});
export type DisputeOpenContext=z.infer<typeof openContextSchema>;
export async function loadDisputeOpenContext(organizationId:string){
 const c=await getSupabaseServerClient();const result=await c.rpc("get_client_dispute_open_context_v1",{p_organization_id:organizationId});const parsed=openContextSchema.safeParse(result.data);
 return !result.error&&parsed.success&&parsed.data.organization_id===organizationId?parsed.data:null;
}
