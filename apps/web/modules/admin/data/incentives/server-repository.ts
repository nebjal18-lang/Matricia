import { readAllPages } from "@/modules/shared/lib/data/read-pages";
import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";

const list = z.array(z.record(z.string(), z.unknown()));
const organizationList = z.array(z.object({
 id: z.string().uuid(), display_name: z.string(), status: z.string(),
 provider_profiles: z.object({provider_organization_id:z.string().uuid()}).nullable(),
}));
export type AdminIncentives = { organizations:Record<string,unknown>[];rules:Record<string,unknown>[];policies:Record<string,unknown>[];evaluations:Record<string,unknown>[];decisions:Record<string,unknown>[];reputations:Record<string,unknown>[];reputationPolicies:Record<string,unknown>[];serviceVersions:Record<string,unknown>[] };
export async function loadAdminIncentives():Promise<{status:"success";value:AdminIncentives}|{status:"error";reason:"UNAUTHENTICATED"|"MFA_REQUIRED"|"FORBIDDEN"|"UNAVAILABLE"}>{
 const access=await loadMyPlatformAccess();if(access.status==="error")return{status:"error",reason:access.reason==="UNAUTHENTICATED"?"UNAUTHENTICATED":"UNAVAILABLE"};
 if(!hasPlatformRole(access.roles,["SUPER_ADMIN","MATRICIA_ADMIN"]))return{status:"error",reason:"FORBIDDEN"};
 if(!access.requirementSatisfied)return{status:"error",reason:"MFA_REQUIRED"};
 const c=access.client;
 const q=await Promise.all([
  readAllPages((from,to)=>c.from("organizations").select("id,display_name,status,provider_profiles(provider_organization_id)").eq("status","ACTIVE").order("display_name").order("id").range(from,to)),
  readAllPages((from,to)=>c.from("reward_rule_versions").select("id,rule_code,version_number,status,trigger_event,audience_type,bonus_credits::text,per_recipient_cap_credits::text,global_cap_credits::text,window_days,cooldown_hours,credit_validity_days,requires_approval,effective_from,effective_until,change_reason").order("created_at",{ascending:false}).order("id").range(from,to)),
  readAllPages((from,to)=>c.from("provider_badge_policy_versions").select("id,badge_code,version_number,label_fr,label_ar,dimension,minimum_basis_points,minimum_evidence_count,effective_from,effective_until").order("created_at",{ascending:false}).order("id").range(from,to)),
  readAllPages((from,to)=>c.from("provider_badge_evaluations").select("id,provider_organization_id,service_id,badge_policy_id,reputation_snapshot_id,evaluation_version,eligible,evaluated_basis_points,evaluated_at").order("evaluated_at",{ascending:false}).order("id").range(from,to)),
  readAllPages((from,to)=>c.from("provider_badge_decisions").select("id,evaluation_id,provider_organization_id,decision_version,action,rationale,decided_at").order("decision_version",{ascending:false}).order("id").range(from,to)),
  readAllPages((from,to)=>c.from("provider_reputation_snapshots").select("id,provider_organization_id,service_id,version_number,overall_basis_points,evidence_count,calculated_at").order("calculated_at",{ascending:false}).order("id").range(from,to)),
  readAllPages((from,to)=>c.from("provider_reputation_policy_versions").select("policy_version,effective_from,effective_until").order("effective_from",{ascending:false}).order("policy_version").range(from,to)),
  readAllPages((from,to)=>c.from("catalog_service_versions").select("id,service_id,version,name_fr,name_ar,status").eq("status","PUBLISHED").order("name_fr").order("id").range(from,to)),
  readAllPages((from,to)=>c.from("provider_profiles").select("provider_organization_id").order("provider_organization_id").range(from,to)),
 ]);
 if(q.some(x=>x.error))return{status:"error",reason:"UNAVAILABLE"};const p=q.map(x=>list.safeParse(x.data));if(p.some(x=>!x.success))return{status:"error",reason:"UNAVAILABLE"};
 const organizations=organizationList.safeParse(q[0]?.data);
 if(!organizations.success||organizations.data.some(row=>row.provider_profiles!==null&&row.provider_profiles.provider_organization_id!==row.id))return{status:"error",reason:"UNAVAILABLE"};
 const profiles=z.array(z.object({provider_organization_id:z.string().uuid()})).safeParse(q[8]?.data);
 if(!profiles.success)return{status:"error",reason:"UNAVAILABLE"};
 const providerIds=profiles.data.map(row=>row.provider_organization_id);
 const projected=providerIds.length?await c.rpc("list_admin_provider_organization_names_v1",{p_organization_ids:providerIds}):{data:{organizations:[]},error:null};
 const names=z.object({organizations:z.array(z.object({id:z.string().uuid(),display_name:z.string()}))}).safeParse(projected.data);
 if(projected.error||!names.success)return{status:"error",reason:"UNAVAILABLE"};
 const allowed=new Set(providerIds),namesById=new Map(names.data.organizations.map(row=>[row.id,row]));
 if(namesById.size!==allowed.size||names.data.organizations.some(row=>!allowed.has(row.id)))return{status:"error",reason:"UNAVAILABLE"};
 const choices=new Map<string,Record<string,unknown>>(organizations.data.map(({provider_profiles,...row})=>[row.id,{...row,kind:provider_profiles?"PROVIDER":null}]));
 for(const row of names.data.organizations)choices.set(row.id,{...choices.get(row.id),...row,kind:"PROVIDER"});
 return{status:"success",value:{organizations:[...choices.values()],rules:p[1]!.data!,policies:p[2]!.data!,evaluations:p[3]!.data!,decisions:p[4]!.data!,reputations:p[5]!.data!,reputationPolicies:p[6]!.data!,serviceVersions:p[7]!.data!}};
}
