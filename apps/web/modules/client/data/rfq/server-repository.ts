import { readAllPages,readRelatedPages } from "@/modules/shared/lib/data/read-pages";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { createClientRfqRepository } from "./repository";

export async function createServerClientRfqRepository(options?: {organizationId:string;query?:string;status?:string;page?:number;allForOrganization?:boolean}){const client=await getSupabaseServerClient();let versionIds:string[]=[];return createClientRfqRepository({
 async userId(){const{data,error}=await client.auth.getUser();return error?null:data.user?.id??null;},
 async memberships(userId){return await readAllPages((from,to)=>client.from("organization_memberships").select("id,organization_id").eq("user_id",userId).eq("status","ACTIVE").order("id").range(from,to));},
 async roles(ids){if(ids.length===0)return{data:[],error:null};return await readRelatedPages(ids,(batch,from,to)=>client.from("organization_member_roles").select("membership_id,role_code,revoked_at").in("membership_id",batch).in("role_code",["CLIENT_OWNER","CLIENT_ADMIN","CLIENT_BUYER","CLIENT_VIEWER"]).order("membership_id").order("role_code").range(from,to));},
 async organizations(ids){if(ids.length===0)return{data:[],error:null};return await readRelatedPages(ids,(batch,from,to)=>client.from("organizations").select("id,display_name").in("id",batch).order("display_name").order("id").range(from,to));},
 async requests(ids,requestId){
  if(ids.length===0)return{data:[],error:null};
  if(options&&!requestId&&!options.allForOrganization){if(!ids.includes(options.organizationId))return{data:[],error:{code:'42501',message:'FORBIDDEN'}};const r=await client.rpc('list_client_request_page',{p_organization_id:options.organizationId,p_query:options.query??'',p_status:options.status??'',p_page:options.page??1});versionIds=Array.isArray(r.data)?r.data.flatMap(x=>typeof x.current_version_id==='string'?[x.current_version_id]:[]):[];return r;}
  if(options&&!ids.includes(options.organizationId))return{data:[],error:{code:'42501',message:'FORBIDDEN'}};
  const scopedIds=options?[options.organizationId]:ids;
  const result=await readRelatedPages(scopedIds,(batch,from,to)=>{let q=client.from('service_requests').select('id,client_organization_id,library_id,service_id,current_version_id,status,created_at,row_version').in('client_organization_id',batch).order('created_at',{ascending:false}).order('id');if(requestId)q=q.eq('id',requestId);return q.range(from,to);});versionIds=(result.data??[]).flatMap(x=>x.current_version_id?[x.current_version_id]:[]);return result;
 },
 async versions(ids){if(ids.length===0)return{data:[],error:null};return await readRelatedPages(versionIds,(batch,from,to)=>client.from("service_request_versions").select("id,request_id,description,urgency,desired_date,budget_minor,currency_code").in("id",batch).order("version_number",{ascending:false}).order("id").range(from,to));},
 async matchingRuns(ids){if(ids.length===0)return{data:[],error:null};return await readRelatedPages(ids,(batch,from,to)=>client.from("matching_runs").select("id,request_id,policy_version,status,target_panel_size,started_at,completed_at").in("request_id",batch).order("started_at",{ascending:false}).order("id").range(from,to));},
 async matchingCandidates(ids){if(ids.length===0)return{data:[],error:null};return await readRelatedPages(ids,(batch,from,to)=>client.from("matching_candidates").select("matching_run_id,eligible,exclusion_reasons,score_explanation").in("matching_run_id",batch).order("id").range(from,to));},
 async rfqs(ids){if(ids.length===0)return{data:[],error:null};return await readRelatedPages(ids,(batch,from,to)=>client.from("rfqs").select("id,request_id,deadline,status").in("request_id",batch).order("version_number",{ascending:false}).order("id").range(from,to));},
 async quotes(ids){if(ids.length===0)return{data:[],error:null};return await readRelatedPages(ids,(batch,from,to)=>client.from("quotes").select("id,rfq_id,status").in("rfq_id",batch).order("id").range(from,to));},async comparisons(rfqId){return await client.rpc("get_client_quote_comparison_exact_v1",{p_rfq_id:rfqId});},async rpc(name,input){return await client.rpc(name,input)}
});}
