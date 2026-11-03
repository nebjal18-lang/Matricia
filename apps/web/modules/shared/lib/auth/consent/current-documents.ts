import { z } from "zod";
import { getLegalDocument } from "@/modules/public/data/legal/documents";
import { legalPublication } from "@/modules/public/data/legal/publication";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { TERMS_VERSION,PRIVACY_VERSION } from "../legal-consent";
export const currentSetSchema=z.object({id:z.string().uuid(),terms_version:z.string(),privacy_version:z.string(),locale:z.enum(["fr","ar"]),source_hash:z.string().regex(/^[0-9a-f]{64}$/u)});
export function currentConsentSnapshot(locale:"fr"|"ar"){
 const publication=legalPublication();
 return {terms:getLegalDocument(locale,"conditions"),privacy:getLegalDocument(locale,"confidentialite"),publication:{values:publication.values,missing:publication.missing,configuration_complete:publication.ready}};
}
/** Text/config changes under an existing version fail closed; bump the approved version explicitly. */
export async function ensureCurrentConsentDocuments(locale:"fr"|"ar"){
 const snapshot=currentConsentSnapshot(locale),result=await getSupabaseAdminClient().rpc("register_legal_consent_documents_v1",{p_terms_version:TERMS_VERSION,p_privacy_version:PRIVACY_VERSION,p_locale:locale,p_snapshot:snapshot});
 const parsed=currentSetSchema.safeParse(result.data);
 if(result.error||!parsed.success||parsed.data.terms_version!==TERMS_VERSION||parsed.data.privacy_version!==PRIVACY_VERSION||parsed.data.locale!==locale)throw new Error("LEGAL_DOCUMENT_SET_UNAVAILABLE");
 return{...parsed.data,snapshot};
}
