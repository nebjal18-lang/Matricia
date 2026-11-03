"use server";
import{referencedQuestionVersions}from"@/modules/franchise/data/library/server-page";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadFranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace";
import { parseFranchiseRulePayload } from "@/modules/franchise/data/library/rule-payload";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
const input=z.object({locale:z.enum(["fr","ar"]),organizationId:z.string().uuid().or(z.literal("")),libraryId:z.string().uuid(),ruleId:z.string().uuid().or(z.literal("")),versionId:z.string().uuid().or(z.literal("")),ruleKey:z.string().regex(/^[A-Z][A-Z0-9_.-]{1,119}$/),identityRowVersion:z.coerce.number().int().positive(),versionRowVersion:z.coerce.number().int().positive(),idempotencyKey:z.string().uuid(),payload:z.string().max(262144),changeReason:z.string().trim().min(3).max(500)});
export type RuleEditorState={status:"idle"}|{status:"success";ruleId:string;versionId:string;identityRowVersion:number;versionRowVersion:number}|{status:"error";reason:"VALIDATION"|"FORBIDDEN"|"UNAVAILABLE"|"CONFLICT"};
export async function saveFranchiseRuleAction(_state:RuleEditorState,form:FormData):Promise<RuleEditorState>{
 const parsed=input.safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",reason:"VALIDATION"};const v=parsed.data;
 const workspace=await loadFranchiseLibraryWorkspace({locale:v.locale,organizationId:v.organizationId||undefined,libraryId:v.libraryId,catalog:{kind:"RULE",objectId:v.ruleId||undefined}});
 if(workspace.status!=="success"||workspace.workspace.mandate.libraryId!==v.libraryId)return{status:"error",reason:"FORBIDDEN"};
 const rule=v.ruleId?workspace.workspace.rules.find((r)=>r.id===v.ruleId):null;
 if(v.ruleId&&!rule)return{status:"error",reason:"FORBIDDEN"};
 const client=await getSupabaseServerClient();let references:string[];try{references=referencedQuestionVersions(JSON.parse(v.payload));}catch{return{status:"error",reason:"VALIDATION"};}if(references.length>5000)return{status:"error",reason:"VALIDATION"};
 const approved=references.length?await client.from("question_versions").select("id").eq("library_id",v.libraryId).in("id",references).in("status",["DRAFT","APPROVED","PUBLISHED"]):{data:[],error:null};if(approved.error)return{status:"error",reason:"UNAVAILABLE"};
 const payload=parseFranchiseRulePayload(v.payload,new Set((approved.data??[]).map((row:{id:string})=>row.id)));
 if(!payload)return{status:"error",reason:"VALIDATION"};
 const result=v.ruleId?await client.rpc("save_catalog_rule_draft",{p_rule_id:v.ruleId,p_source_version_id:v.versionId,p_payload:payload,p_change_reason:v.changeReason,p_expected_identity_row_version:v.identityRowVersion,p_expected_source_row_version:v.versionRowVersion,p_idempotency_key:v.idempotencyKey}):await client.rpc("create_catalog_rule",{p_library_id:v.libraryId,p_rule_key:v.ruleKey,p_payload:payload,p_change_reason:v.changeReason,p_idempotency_key:v.idempotencyKey});
 if(result.error)return{status:"error",reason:result.error.code==="40001"?"CONFLICT":result.error.code==="42501"?"FORBIDDEN":"UNAVAILABLE"};
 const response=z.object({rule_id:z.string().uuid(),version_id:z.string().uuid(),identity_row_version:z.number().int().positive(),version_row_version:z.number().int().positive()}).safeParse(result.data);
 if(!response.success)return{status:"error",reason:"UNAVAILABLE"};
 revalidatePath(`/${v.locale}/franchise/regles`);return{status:"success",ruleId:response.data.rule_id,versionId:response.data.version_id,identityRowVersion:response.data.identity_row_version,versionRowVersion:response.data.version_row_version};
}
