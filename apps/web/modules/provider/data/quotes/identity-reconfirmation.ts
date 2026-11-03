import {z} from "zod";
import {getSupabaseBrowserClient} from "@/modules/shared/lib/supabase/client";

const uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/u);
export const reconfirmationPartySchema=z.object({
  organization_id:uuid,legal_name:z.string(),country_code:z.string(),
  identifiers:z.record(z.string(),z.string().nullable()),
  registered_address:z.string().nullable().optional(),
  verified_identity_hash:hash,identity_review_id:uuid.nullable(),
  verified_at:z.string().nullable(),
});
const proposalSchema=z.object({
  id:uuid,content_hash:hash,context_hash:hash,provider_reason:z.string(),
  proposed_at:z.string(),proposed_by:uuid,client_party:reconfirmationPartySchema,
  provider_party:reconfirmationPartySchema,decision:z.enum(["ACCEPT","DECLINE"]).nullable(),
  decision_reason:z.string().nullable(),responded_by:uuid.nullable(),responded_at:z.string().nullable(),
  current:z.boolean(),effective:z.boolean(),
});
export const selectedQuoteIdentityContextSchema=z.object({
  quote_version_id:uuid,request_id:uuid,client_organization_id:uuid,provider_organization_id:uuid,
  source_quote_hash:hash,selection_hash:hash,context_hash:hash,
  current_client_party:reconfirmationPartySchema.nullable(),provider_party_base:reconfirmationPartySchema,
  canonical_provider_address:z.string().nullable(),previous_provider_address:z.string().nullable(),
  blocked_reasons:z.array(z.string()),original_provider_current:z.boolean(),can_propose_provider:z.boolean(),
  proposals:z.array(proposalSchema).max(25),effective_proposal:proposalSchema.nullable(),
  page:z.number().int().positive(),page_size:z.literal(25),total:z.number().int().nonnegative(),has_next:z.boolean(),
});
export type SelectedQuoteIdentityContext=z.infer<typeof selectedQuoteIdentityContextSchema>;
export type ReconfirmationParty=z.infer<typeof reconfirmationPartySchema>;
const proposeInput=z.object({
  quoteVersionId:uuid,contextHash:hash,registeredAddress:z.string().trim().min(5).max(1000),
  reason:z.string().trim().min(10).max(1000),confirmed:z.literal(true),idempotencyKey:uuid,correlationId:uuid,
});
async function bounded<T>(promise:PromiseLike<T>):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([Promise.resolve(promise),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("QUOTE_IDENTITY_UNAVAILABLE")),12000);})]);}
  finally{clearTimeout(timer);}
}
export async function loadSelectedQuoteIdentity(quoteVersionId:string,organizationId:string,page:number):Promise<SelectedQuoteIdentityContext>{
  uuid.parse(quoteVersionId);uuid.parse(organizationId);z.number().int().min(1).max(1000000).parse(page);
  const result=await bounded<{data:unknown;error:{message:string}|null}>(getSupabaseBrowserClient().rpc("get_selected_quote_identity_reconfirmation_context_v1",{p_quote_version_id:quoteVersionId,p_page:page}));
  if(result.error)throw new Error(result.error.message);
  const context=selectedQuoteIdentityContextSchema.parse(result.data);
  if(context.quote_version_id!==quoteVersionId||context.provider_organization_id!==organizationId||context.page!==page)throw new Error("QUOTE_IDENTITY_SCOPE_MISMATCH");
  return context;
}
export async function proposeSelectedQuoteIdentity(input:Omit<z.input<typeof proposeInput>,"confirmed">&{confirmed:boolean}):Promise<void>{
  const parsed=proposeInput.parse(input);
  const result=await bounded<{data:unknown;error:{message:string}|null}>(getSupabaseBrowserClient().rpc("propose_selected_quote_identity_reconfirmation_v1",{
    p_quote_version_id:parsed.quoteVersionId,p_expected_context_hash:parsed.contextHash,
    p_registered_address:parsed.registeredAddress,p_reason:parsed.reason,
    p_idempotency_key:parsed.idempotencyKey,p_correlation_id:parsed.correlationId,
  }));
  if(result.error)throw new Error(result.error.message);
  z.object({outcome:z.literal("SELECTED_QUOTE_IDENTITY_PROPOSED"),proposal_id:uuid,content_hash:hash,status:z.literal("PENDING_CLIENT_RESPONSE")}).parse(result.data);
}
