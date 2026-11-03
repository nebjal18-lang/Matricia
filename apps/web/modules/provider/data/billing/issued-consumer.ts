import {z} from "zod";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
import {archiveProviderBillingDocument} from "./artifacts";
/** Replayed financial issuance events finish both immutable translations before notification readiness. */
export async function consumeProviderBillingIssued(kind:"invoice"|"statement"|"credit_note",sourceId:string):Promise<{ok:boolean;code:string}>{
 if(!z.string().uuid().safeParse(sourceId).success)return{ok:false,code:"BILLING_SOURCE_INVALID"};
 const admin=getSupabaseAdminClient();
 const policy=await admin.rpc("get_provider_billing_source_policy",{p_kind:kind,p_source_id:sourceId});
 if(policy.error)return{ok:false,code:policy.error.code==="55000"?"BILLING_POLICY_REQUIRED":"BILLING_SOURCE_POLICY_UNAVAILABLE"};
 const concordance=z.object({recipient_concordance:z.enum(["OK","LEGACY_REVIEW_REQUIRED","CORRECTION_REQUIRED","CORRECTED"])}).safeParse(policy.data);
 if(!concordance.success)return{ok:false,code:"BILLING_SOURCE_POLICY_UNAVAILABLE"};
 if(concordance.data.recipient_concordance==="CORRECTED")return{ok:true,code:"BILLING_ORIGINAL_RETAINED_BY_CORRECTION"};
 if(concordance.data.recipient_concordance!=="OK")return{ok:false,code:"BILLING_RECIPIENT_REVIEW_OR_CORRECTION_REQUIRED"};
 for(const locale of["fr","ar"]as const){const result=await archiveProviderBillingDocument(admin,admin,kind,sourceId,locale);if(!result.ok)return result;}
 const ready=await admin.rpc("complete_provider_billing_document_issue",{p_kind:kind,p_source_id:sourceId});
 return !ready.error&&ready.data?.outcome==="PROVIDER_BILLING_DOCUMENTS_READY"?{ok:true,code:"PROVIDER_BILLING_DOCUMENTS_READY"}:{ok:false,code:"BILLING_NOTIFICATION_READINESS_FAILED"};
}
