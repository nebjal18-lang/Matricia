"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {classifyCommandFailure} from "@/modules/shared/lib/auth/command-failure";
export type ResumeState={status:"idle"|"completed"|"pending"}|{status:"error";reason:"UNAUTHENTICATED"|"MFA_REQUIRED"|"FORBIDDEN"|"VALIDATION"|"CONFLICT"|"FAILED"};
const input=z.object({locale:z.enum(["fr","ar"]),approvalRequestId:z.string().uuid(),rowVersion:z.coerce.number().int().positive()});
export async function resumeClientCommitment(_previous:ResumeState,form:FormData):Promise<ResumeState>{
 const value=input.safeParse(Object.fromEntries(form.entries()));if(!value.success)return{status:"error",reason:"VALIDATION"};
 try{
  const client=await getSupabaseServerClient(),auth=await client.auth.getUser();
  if(auth.error)return{status:"error",reason:classifyCommandFailure(auth.error)};
  if(!auth.data.user)return{status:"error",reason:"UNAUTHENTICATED"};
  const aal=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(aal.error)return{status:"error",reason:"FAILED"};
  if(aal.data.currentLevel!=="aal2")return{status:"error",reason:"MFA_REQUIRED"};
  const result=await client.rpc("execute_client_approved_commitment_v1",{p_approval_request_id:value.data.approvalRequestId,p_expected_row_version:value.data.rowVersion});
  if(result.error)return{status:"error",reason:classifyCommandFailure(result.error)};
  const parsed=z.object({outcome:z.enum(["CLIENT_APPROVAL_REQUIRED","QUOTE_SELECTED","SELECTED_QUOTE_CONTRACT_DRAFTED","CLIENT_COST_ALLOCATED","CLIENT_TYPED_COST_ALLOCATED"])}).safeParse(result.data);
  if(!parsed.success)return{status:"error",reason:"FAILED"};
  for(const path of ["actions","demandes","contrats","missions","portefeuille"])revalidatePath(`/${value.data.locale}/client/${path}`);
  return{status:parsed.data.outcome==="CLIENT_APPROVAL_REQUIRED"?"pending":"completed"};
 }catch{return{status:"error",reason:"FAILED"};}
}
