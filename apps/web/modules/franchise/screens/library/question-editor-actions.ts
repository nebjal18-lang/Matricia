"use server";
import { editorialRpcFailure, type EditorialFailureReason } from "./command-errors";
import{z}from"zod";
import{revalidatePath}from"next/cache";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
const input=z.object({locale:z.enum(["fr","ar"]),franchiseId:z.string().uuid(),questionId:z.string().uuid(),versionId:z.string().uuid(),scope:z.string(),identityRowVersion:z.coerce.number().int().positive(),versionRowVersion:z.coerce.number().int().positive(),idempotencyKey:z.string().uuid(),reason:z.string().trim().min(3).max(500),payload:z.string().max(262144),operation:z.enum(["SAVE","ARCHIVE","RESTORE"]).default("SAVE")});
export type QuestionEditorState={status:"idle"}|{status:"success";versionId:string;identityRowVersion:number;versionRowVersion:number;versionNumber?:number;archived:boolean}|{status:"error";reason:EditorialFailureReason};
export async function saveFranchiseQuestion(_state:QuestionEditorState,form:FormData):Promise<QuestionEditorState>{const parsed=input.safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",reason:"VALIDATION"};const v=parsed.data;let payload:Record<string,unknown>;try{payload=z.record(z.string(),z.unknown()).parse(JSON.parse(v.payload));}catch{return{status:"error",reason:"VALIDATION"};}
 const client=await getSupabaseServerClient();const scope=await client.rpc("franchise_question_detail",{p_franchise_id:v.franchiseId,p_question_id:v.questionId});if(scope.error)return{status:"error",reason:editorialRpcFailure(scope.error)};
 const result=v.operation==="SAVE"?await client.rpc("save_catalog_question_draft",{p_question_id:v.questionId,p_source_version_id:v.versionId,p_scope:v.scope,p_payload:payload,p_change_reason:v.reason,p_expected_identity_row_version:v.identityRowVersion,p_expected_source_row_version:v.versionRowVersion,p_idempotency_key:v.idempotencyKey}):await client.rpc("set_catalog_question_archived",{p_question_id:v.questionId,p_expected_identity_row_version:v.identityRowVersion,p_archived:v.operation==="ARCHIVE",p_change_reason:v.reason,p_idempotency_key:v.idempotencyKey});
 if(result.error)return{status:"error",reason:editorialRpcFailure(result.error)};
 const response=z.object({version_id:z.string().uuid().optional(),identity_row_version:z.number().int().positive(),version_row_version:z.number().int().positive().optional(),version_number:z.number().int().positive().optional()}).safeParse(result.data);if(!response.success)return{status:"error",reason:"UNAVAILABLE"};revalidatePath(`/${v.locale}/franchise/questions`);return{status:"success",versionId:response.data.version_id??v.versionId,identityRowVersion:response.data.identity_row_version,versionRowVersion:response.data.version_row_version??v.versionRowVersion,versionNumber:response.data.version_number??(_state.status==="success"?_state.versionNumber:undefined),archived:v.operation==="ARCHIVE"};
}

const duplicateInput = z.object({
 locale:z.enum(["fr","ar"]),franchiseId:z.string().uuid(),questionId:z.string().uuid(),versionId:z.string().uuid(),
 questionKey:z.string().trim().regex(/^[A-Z][A-Z0-9_.-]{1,119}$/),dataKey:z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_.-]{1,159}$/),
 reason:z.string().trim().min(3).max(500),idempotencyKey:z.string().uuid(),
});
export type QuestionDuplicateState={status:"idle"}|{status:"success";questionId:string}|{status:"error";reason:EditorialFailureReason};
export async function duplicateFranchiseQuestion(_:QuestionDuplicateState,form:FormData):Promise<QuestionDuplicateState>{
 const parsed=duplicateInput.safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",reason:"VALIDATION"};
 const v=parsed.data,client=await getSupabaseServerClient();
 const scope=await client.rpc("franchise_question_detail",{p_franchise_id:v.franchiseId,p_question_id:v.questionId});
 if(scope.error)return{status:"error",reason:editorialRpcFailure(scope.error)};
 const result=await client.rpc("duplicate_catalog_question",{p_question_id:v.questionId,p_source_version_id:v.versionId,p_new_question_key:v.questionKey,p_new_data_key:v.dataKey,p_change_reason:v.reason,p_idempotency_key:v.idempotencyKey});
 if(result.error)return{status:"error",reason:editorialRpcFailure(result.error)};
 const response=z.object({outcome:z.literal("CATALOG_QUESTION_DUPLICATED"),question_id:z.string().uuid()}).safeParse(result.data);
 if(!response.success)return{status:"error",reason:"UNAVAILABLE"};
 revalidatePath(`/${v.locale}/franchise/questions`);
 return{status:"success",questionId:response.data.question_id};
}
