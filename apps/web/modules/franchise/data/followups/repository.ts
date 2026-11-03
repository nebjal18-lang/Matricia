import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { collectOperationPages } from "../operations/paging";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { FollowupDashboard } from "./model";

const id=z.string().uuid(), integerArray=z.array(z.number().int());
const franchise=z.object({id,operator_organization_id:id,operator_code:z.string()});
const prospect=z.object({id,franchise_id:id,display_name:z.string(),prospect_type:z.enum(["CLIENT","PROVIDER"]),pipeline_stage:z.string(),next_followup_at:z.string().nullable()});
const policy=z.object({id,franchise_id:id,version:z.number().int(),status:z.enum(["PENDING_APPROVAL","ACTIVE","REJECTED","RETIRED"]),eligible_stages:z.array(z.string()),reminder_delays_minutes:integerArray,retry_delays_minutes:integerArray,maximum_attempts:z.number().int(),maximum_reminders_per_7_days:z.number().int(),lease_seconds:z.number().int(),effective_from:z.string(),effective_until:z.string().nullable(),proposed_by:id,approved_by:id.nullable()});
const preference=z.object({id,prospect_id:id,version:z.number().int(),contact_allowed:z.boolean(),email_allowed:z.boolean(),locale:z.enum(["fr","ar"]),time_zone:z.string(),quiet_hours_start:z.string(),quiet_hours_end:z.string(),maximum_reminders_per_7_days:z.number().int()});
const job=z.object({id,prospect_id:id,policy_version_id:id,reminder_ordinal:z.number().int(),locale:z.enum(["fr","ar"]),status:z.enum(["PENDING","LEASED","RETRY","SUCCEEDED","CANCELLED","DEAD_LETTER"]),next_attempt_at:z.string(),attempt_count:z.number().int(),last_error_code:z.string().nullable()});
const membership=z.object({organization_id:id,organization_member_roles:z.array(z.object({role_code:z.string(),revoked_at:z.string().nullable()}))});

export type FollowupLoadResult={status:"success";dashboard:FollowupDashboard}|{status:"error";reason:"UNAUTHENTICATED"|"FORBIDDEN"|"QUERY_FAILED"|"INVALID_RESPONSE"};
async function readFranchiseFollowups(franchiseId?: string):Promise<FollowupLoadResult>{
 const client=await getSupabaseServerClient(),{data:auth,error:authError}=await client.auth.getUser();if(authError)return{status:"error",reason:classifyAuthReadFailure(authError)==="UNAUTHENTICATED"?"UNAUTHENTICATED":"QUERY_FAILED"};if(!auth.user)return{status:"error",reason:"UNAUTHENTICATED"};
 const capabilitiesResult=franchiseId?await client.rpc("franchise_actor_capabilities",{p_franchise_id:franchiseId}):null;
 const capabilities=capabilitiesResult?z.object({read:z.boolean(),write:z.boolean()}).safeParse(capabilitiesResult.data):null;
 if(capabilitiesResult?.error)return{status:"error",reason:capabilitiesResult.error.code==="42501"?"FORBIDDEN":"QUERY_FAILED"};
 if(capabilities&&!capabilities.success)return{status:"error",reason:"INVALID_RESPONSE"};
 if(capabilities?.success&&!capabilities.data.read)return{status:"error",reason:"FORBIDDEN"};
 const [franchises,prospects,policies,preferences,jobs,memberships]=await Promise.all([
  collectOperationPages((from,to)=>client.from("franchises").select("id,operator_organization_id,operator_code").match(franchiseId ? { id: franchiseId } : {}).order("created_at",{ascending:false}).order("id").range(from,to)),
  collectOperationPages((from,to)=>client.from("franchise_crm_prospects").select("id,franchise_id,display_name,prospect_type,pipeline_stage,next_followup_at").match(franchiseId ? { franchise_id: franchiseId } : {}).order("updated_at",{ascending:false}).order("id").range(from,to)),
  collectOperationPages((from,to)=>client.from("franchise_followup_policy_versions").select("id,franchise_id,version,status,eligible_stages,reminder_delays_minutes,retry_delays_minutes,maximum_attempts,maximum_reminders_per_7_days,lease_seconds,effective_from,effective_until,proposed_by,approved_by").match(franchiseId ? { franchise_id: franchiseId } : {}).order("version",{ascending:false}).order("id").range(from,to)),
  collectOperationPages((from,to)=>client.from("franchise_followup_preference_versions").select("id,prospect_id,version,contact_allowed,email_allowed,locale,time_zone,quiet_hours_start,quiet_hours_end,maximum_reminders_per_7_days").match(franchiseId?{franchise_id:franchiseId}:{}).order("version",{ascending:false}).order("id").range(from,to)),
  collectOperationPages((from,to)=>client.from("franchise_followup_jobs").select("id,prospect_id,policy_version_id,reminder_ordinal,locale,status,next_attempt_at,attempt_count,last_error_code").match(franchiseId?{franchise_id:franchiseId}:{}).order("created_at",{ascending:false}).order("id").range(from,to)),
  collectOperationPages((from,to)=>client.from("organization_memberships").select("organization_id,organization_member_roles(role_code,revoked_at)").eq("user_id",auth.user.id).eq("status","ACTIVE").order("id").range(from,to)),
 ]);
 if([franchises,prospects,policies,preferences,jobs,memberships].some((result)=>result.error))return{status:"error",reason:"QUERY_FAILED"};
 const fs=z.array(franchise).safeParse(franchises.data),ps=z.array(prospect).safeParse(prospects.data),rs=z.array(policy).safeParse(policies.data),prefs=z.array(preference).safeParse(preferences.data),js=z.array(job).safeParse(jobs.data),ms=z.array(membership).safeParse(memberships.data);
 if(!fs.success||!ps.success||!rs.success||!prefs.success||!js.success||!ms.success)return{status:"error",reason:"INVALID_RESPONSE"};
 const writableOrganizations=new Set(ms.data.filter((row)=>row.organization_member_roles.some((role)=>!role.revoked_at&&["FRANCHISE_OWNER","FRANCHISE_MANAGER"].includes(role.role_code))).map((row)=>row.organization_id));
 const canApprove=false,franchiseRows=fs.data.map((row)=>({id:row.id,operatorCode:row.operator_code,canWrite:capabilities?.success?capabilities.data.write:writableOrganizations.has(row.operator_organization_id)}));
 if(!franchiseRows.length&&!canApprove)return{status:"error",reason:"FORBIDDEN"};
 return{status:"success",dashboard:{currentUserId:auth.user.id,canApprove,franchises:franchiseRows,prospects:ps.data.map((row)=>{const pref=prefs.data.find((item)=>item.prospect_id===row.id);return{id:row.id,franchiseId:row.franchise_id,displayName:row.display_name,type:row.prospect_type,stage:row.pipeline_stage,nextFollowupAt:row.next_followup_at,preference:pref?{id:pref.id,version:pref.version,contactAllowed:pref.contact_allowed,emailAllowed:pref.email_allowed,locale:pref.locale,timeZone:pref.time_zone,quietStart:pref.quiet_hours_start,quietEnd:pref.quiet_hours_end,weeklyLimit:pref.maximum_reminders_per_7_days}:null}}),policies:rs.data.map((row)=>({id:row.id,franchiseId:row.franchise_id,version:row.version,status:row.status,eligibleStages:row.eligible_stages,reminderDelaysMinutes:row.reminder_delays_minutes,retryDelaysMinutes:row.retry_delays_minutes,maximumAttempts:row.maximum_attempts,weeklyLimit:row.maximum_reminders_per_7_days,leaseSeconds:row.lease_seconds,effectiveFrom:row.effective_from,effectiveUntil:row.effective_until,proposedBy:row.proposed_by,approvedBy:row.approved_by})),jobs:js.data.filter(row=>ps.data.some(prospect=>prospect.id===row.prospect_id)).map((row)=>({id:row.id,prospectId:row.prospect_id,policyVersionId:row.policy_version_id,reminderOrdinal:row.reminder_ordinal,locale:row.locale,status:row.status,nextAttemptAt:row.next_attempt_at,attemptCount:row.attempt_count,lastErrorCode:row.last_error_code}))}};
}

/** A transport rejection is an incident, never a successful empty workspace. */
export async function loadFranchiseFollowups(franchiseId?:string):Promise<FollowupLoadResult>{
 try{return await readFranchiseFollowups(franchiseId);}catch{return{status:"error",reason:"QUERY_FAILED"};}
}
