"use server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { qualificationReviewContext, type QualificationReviewReadResult } from "./model";
async function readQualificationQuestionnaireReview(input:{qualificationId:string;sessionId?:string;page?:number}):Promise<QualificationReviewReadResult>{
  const parsed=z.object({qualificationId:z.string().uuid(),sessionId:z.string().uuid().optional(),page:z.number().int().min(1).max(100000).default(1)}).safeParse(input);
  if(!parsed.success)return{status:"error",reason:"VALIDATION"};
  const client=await getSupabaseServerClient(),auth=await client.auth.getUser(),authFailure=classifyAuthReadFailure(auth.error);
  if(authFailure||!auth.data.user)return{status:"error",reason:authFailure==="UNAVAILABLE"?"UNAVAILABLE":"UNAUTHENTICATED"};
  const response=await client.rpc("get_provider_qualification_questionnaire_review_v1",{p_qualification_id:parsed.data.qualificationId,p_session_id:parsed.data.sessionId??null,p_page:parsed.data.page});
  if(response.error)return{status:"error",reason:response.error.message?.includes("MFA_REQUIRED")?"MFA_REQUIRED":response.error.code==="42501"?"FORBIDDEN":"UNAVAILABLE"};
  const context=qualificationReviewContext.safeParse(response.data);
  if(!context.success||context.data.qualificationId!==parsed.data.qualificationId||context.data.page!==parsed.data.page||parsed.data.sessionId&&context.data.selected?.id!==parsed.data.sessionId)return{status:"error",reason:"UNAVAILABLE"};
  return{status:"success",context:context.data};
}

export async function loadQualificationQuestionnaireReview(input:{qualificationId:string;sessionId?:string;page?:number}):Promise<QualificationReviewReadResult>{
 try{return await readQualificationQuestionnaireReview(input);}catch{return{status:"error",reason:"UNAVAILABLE"};}
}
