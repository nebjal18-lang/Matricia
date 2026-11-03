import { z } from "zod";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { commercialSourceSchema } from "./model";
import { archiveClientCommercialDocument } from "./artifacts";
/** A durable retry finishes both private translations before document readiness. */
export async function consumeClientCommercialDocumentIssued(documentId:string):Promise<{ok:boolean;code:string}>{
 if(!z.string().uuid().safeParse(documentId).success)return{ok:false,code:"CLIENT_DOCUMENT_INVALID"};
 const admin=getSupabaseAdminClient(),response=await admin.rpc("get_client_commercial_document_for_archive_v1",{p_document_id:documentId});
 const source=commercialSourceSchema.safeParse(response.data);
 if(response.error||!source.success||source.data.id!==documentId)return{ok:false,code:"CLIENT_BILLING_UNAVAILABLE"};
 for(const locale of["fr","ar"]as const){const archived=await archiveClientCommercialDocument(source.data,admin,locale);if(!archived.ok)return archived;}
 const completed=await admin.rpc("complete_client_commercial_document_issue_v1",{p_document_id:documentId});
 return !completed.error&&completed.data?.outcome==="CLIENT_COMMERCIAL_DOCUMENT_READY"?{ok:true,code:"CLIENT_COMMERCIAL_DOCUMENT_READY"}:{ok:false,code:"CLIENT_BILLING_READINESS_PENDING"};
}
