"use server";
import{revalidatePath}from"next/cache";
import{z}from"zod";
import{ensureCurrentConsentDocuments}from"@/modules/shared/lib/auth/consent/current-documents";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
export type ConsentState={status:"idle"}|{status:"success"}|{status:"error";reason:"EXPLICIT"|"STALE"|"UNAVAILABLE"};
const input=z.object({locale:z.enum(["fr","ar"]),documentSetId:z.string().uuid(),sourceHash:z.string().regex(/^[0-9a-f]{64}$/u),idempotencyKey:z.string().uuid(),accepted:z.literal("ACCEPTED")});
export async function acceptUpdatedLegalDocuments(_:ConsentState,form:FormData):Promise<ConsentState>{
 const p=input.safeParse(Object.fromEntries(form.entries()));if(!p.success)return{status:"error",reason:"EXPLICIT"};
 try{const client=await getSupabaseServerClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)return{status:"error",reason:"UNAVAILABLE"};
  const current=await ensureCurrentConsentDocuments(p.data.locale);if(current.id!==p.data.documentSetId||current.source_hash!==p.data.sourceHash)return{status:"error",reason:"STALE"};
  const result=await client.rpc("accept_account_legal_consent_v1",{p_document_set_id:current.id,p_source_hash:current.source_hash,p_consent:true,p_idempotency_key:p.data.idempotencyKey});
  if(result.error)return{status:"error",reason:result.error.message.includes("OUTDATED")||result.error.message.includes("HASH_MISMATCH")?"STALE":"UNAVAILABLE"};
  if(!z.object({outcome:z.enum(["LEGAL_CONSENT_RECORDED","LEGAL_CONSENT_ALREADY_RECORDED"]),acceptance_id:z.string().uuid()}).safeParse(result.data).success)return{status:"error",reason:"UNAVAILABLE"};
  revalidatePath(`/${p.data.locale}/connexion/consentements`);return{status:"success"};
 }catch{return{status:"error",reason:"UNAVAILABLE"};}
}
