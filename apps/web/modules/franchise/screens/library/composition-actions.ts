"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadFranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const section=z.object({key:z.string().regex(/^[A-Z][A-Z0-9_-]{1,79}$/),labelFr:z.string().trim().min(1).max(240),labelAr:z.string().trim().min(1).max(240),helpFr:z.string().max(4000).optional(),helpAr:z.string().max(4000).optional()});
const question=z.object({versionId:z.string().uuid(),sectionKey:z.string(),required:z.boolean()});
const payload=z.object({locale:z.enum(["fr","ar"]),organizationId:z.string().uuid().or(z.literal("")),libraryId:z.string().uuid(),versionId:z.string().uuid(),expectedRowVersion:z.coerce.number().int().positive(),idempotencyKey:z.string().uuid(),sections:z.string().max(100000),questions:z.string().max(1000000),rules:z.string().max(100000)});
export type CompositionState={status:"idle"}|{status:"success";rowVersion:number}|{status:"error";reason:"VALIDATION"|"FORBIDDEN"|"UNAVAILABLE"|"CONFLICT"};
export async function saveFranchiseCompositionAction(_state:CompositionState,form:FormData):Promise<CompositionState>{
 const input=payload.safeParse(Object.fromEntries(form));if(!input.success)return{status:"error",reason:"VALIDATION"};
 let sections,questions,rules;try{rules=z.array(z.string().uuid()).max(500).parse(JSON.parse(input.data.rules));sections=z.array(section).min(1).max(100).parse(JSON.parse(input.data.sections));questions=z.array(question).max(5000).parse(JSON.parse(input.data.questions));}catch{return{status:"error",reason:"VALIDATION"};}
 const workspace=await loadFranchiseLibraryWorkspace({locale:input.data.locale,organizationId:input.data.organizationId||undefined,libraryId:input.data.libraryId,catalog:{kind:"QUESTIONNAIRE",objectId:input.data.versionId}});
 if(workspace.status!=="success"||workspace.workspace.mandate.libraryId!==input.data.libraryId||!workspace.workspace.questionnaires.some((q)=>q.draftVersionId===input.data.versionId))return{status:"error",reason:"FORBIDDEN"};
 const client=await getSupabaseServerClient();const result=await client.rpc("save_franchise_questionnaire_composition",{p_version_id:input.data.versionId,p_sections:sections,p_questions:questions,p_rules:rules,p_expected_row_version:input.data.expectedRowVersion,p_idempotency_key:input.data.idempotencyKey});
 if(result.error)return{status:"error",reason:result.error.code==="40001"?"CONFLICT":result.error.code==="42501"?"FORBIDDEN":"UNAVAILABLE"};
 const response=z.object({row_version:z.number().int().positive()}).safeParse(result.data);if(!response.success)return{status:"error",reason:"UNAVAILABLE"};
 revalidatePath(`/${input.data.locale}/franchise/questionnaires`);return{status:"success",rowVersion:response.data.row_version};
}
