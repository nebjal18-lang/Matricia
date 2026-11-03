"use server";
import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
const uuid=z.string().uuid();
const input=z.object({organizationId:uuid,query:z.string().trim().max(160),after:z.string().max(100).nullable()});
const row=z.object({id:uuid,organization_id:uuid,target_type:z.enum(["MISSION","MISSION_MILESTONE","INVOICE","DOCUMENT","RFQ"]),label_fr:z.string(),label_ar:z.string(),cursor_key:z.string()});
export type TargetSearchResult={status:"success";targets:Array<{id:string;organizationId:string;type:"MISSION"|"MISSION_MILESTONE"|"INVOICE"|"DOCUMENT"|"RFQ";labelFr:string;labelAr:string}>;next:string|null}|{status:"error";reason:"FORBIDDEN"|"UNAVAILABLE"};
export async function searchAllocationTargets(value:unknown):Promise<TargetSearchResult>{
 const p=input.safeParse(value);if(!p.success)return{status:"error",reason:"FORBIDDEN"};
 const client=await getSupabaseServerClient(),auth=await client.auth.getUser();
 if(auth.error||!auth.data.user)return{status:"error",reason:"FORBIDDEN"};
 const result=await client.rpc("search_client_allocation_targets_v1",{p_organization_id:p.data.organizationId,p_search:p.data.query,p_after:p.data.after,p_limit:50});
 if(result.error)return{status:"error",reason:result.error.code==="42501"?"FORBIDDEN":"UNAVAILABLE"};
 const parsed=z.array(row).max(50).safeParse(result.data);
 if(!parsed.success||parsed.data.some(item=>item.organization_id!==p.data.organizationId))return{status:"error",reason:"UNAVAILABLE"};
 return{status:"success",targets:parsed.data.map(item=>({id:item.id,organizationId:item.organization_id,type:item.target_type,labelFr:item.label_fr,labelAr:item.label_ar})),next:parsed.data.length===50?parsed.data.at(-1)!.cursor_key:null};
}
