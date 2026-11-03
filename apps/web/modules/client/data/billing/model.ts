import { z } from "zod";
import type { BillingPdfSnapshot } from "@/modules/shared/lib/commercial-documents/pdf";
const uuid = z.string().uuid();
const hash = z.string().regex(/^[0-9a-f]{64}$/u);
const minor = z.string().regex(/^\d{1,19}$/u);
const identity = z.object({ legal_name:z.string().min(2).max(200),legal_form:z.string().min(2).max(100),address:z.string().min(3).max(1000),ice:z.string().regex(/^\d{15}$/u),if_number:z.string().regex(/^\d{6,20}$/u),rc_number:z.string().min(2).max(80) });
export const commercialSnapshotSchema = z.object({
 id:uuid,number:z.string().regex(/^[A-Z0-9]{2,12}-\d{4}-\d{8,19}$/u),kind:z.enum(["INVOICE","CREDIT_NOTE"]),issued_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),currency:z.string().regex(/^[A-Z]{3}$/u),
 subtotal_minor:minor,tax_minor:minor,total_minor:minor,tax_rate_bps:z.number().int().min(0).max(10000),tax_label_fr:z.string().min(2),tax_label_ar:z.string().min(2),tax_jurisdiction:z.string().min(2),rounding_rule:z.literal("HALF_UP"),price_basis:z.literal("GROSS_INCLUDES_TAX"),tax_rounding_basis:z.literal("TAX_FROM_GROSS"),
 policy_version_id:uuid,policy_version:z.number().int().positive(),issuer:identity.extend({contact_email:z.string().email()}),buyer:identity.extend({profile_version_id:uuid}),label_fr:z.string().min(3),label_ar:z.string().min(3),original_invoice_number:z.string().min(1).max(100).nullable(),payment_reference:z.string().min(3),paid_at:z.string().datetime({offset:true}),payment_event_id:z.string().regex(/^\d+$/u),adjustment_id:uuid.nullable(),
}).superRefine((value,ctx)=>{
 if(BigInt(value.subtotal_minor)+BigInt(value.tax_minor)!==BigInt(value.total_minor)||BigInt(value.total_minor)<=BigInt(0))ctx.addIssue({code:"custom",message:"Invalid exact totals"});
 if(value.kind==="INVOICE"?(value.adjustment_id!==null||value.original_invoice_number!==null):(value.adjustment_id===null||value.original_invoice_number===null))ctx.addIssue({code:"custom",message:"Invalid source relationship"});
});
export const commercialArtifactSchema=z.object({document_id:uuid,locale:z.enum(["fr","ar"]),source_hash:hash,pdf_sha256:hash,size_bytes:z.number().int().min(100).max(5242880),storage_path:z.string().min(30).max(500),renderer_version:z.literal("CLIENT_BILLING_PDF_V1")});
export const commercialSourceSchema=z.object({id:uuid,organization_id:uuid,snapshot:commercialSnapshotSchema,source_hash:hash,artifacts:z.array(commercialArtifactSchema).max(2)}).superRefine((value,ctx)=>{
 if(value.id!==value.snapshot.id||value.artifacts.some(artifact=>artifact.document_id!==value.id||artifact.source_hash!==value.source_hash||artifact.storage_path!==`${value.organization_id}/${value.id}/${artifact.locale}/${value.source_hash}.pdf`))ctx.addIssue({code:"custom",message:"Invalid artifact scope"});
});
export type CommercialSource=z.infer<typeof commercialSourceSchema>;
export type CommercialArtifact=z.infer<typeof commercialArtifactSchema>;
export function clientBillingPdfSnapshot(source:CommercialSource,locale:"fr"|"ar"):BillingPdfSnapshot{
 const value=source.snapshot,issuer=value.issuer,buyer=value.buyer,ar=locale==="ar";
 const rate=`${Math.trunc(value.tax_rate_bps/100)}.${String(value.tax_rate_bps%100).padStart(2,"0")}%`;
 return {kind:value.kind==="INVOICE"?"invoice":"credit_note",number:value.number,issuer:{name:`${issuer.legal_name} · ${issuer.legal_form} · IF ${issuer.if_number} · RC ${issuer.rc_number}`,address:`${issuer.address}\n${issuer.contact_email}`,ice:issuer.ice,version:`${value.policy_version_id}:v${value.policy_version}`},recipient:[buyer.legal_name,buyer.legal_form,buyer.address,`ICE ${buyer.ice} · IF ${buyer.if_number} · RC ${buyer.rc_number}`,value.original_invoice_number?`${ar?"مرجع الفاتورة":"Facture d’origine"}: ${value.original_invoice_number}`:`${ar?"مرجع الدفع المؤكد":"Paiement confirmé"}: ${value.payment_reference}`].join("\n"),currency:value.currency,totalMinor:value.total_minor,issuedOn:value.issued_on,sourceHash:source.source_hash,lines:[{label:ar?value.label_ar:value.label_fr,amountMinor:value.subtotal_minor},{label:`${ar?value.tax_label_ar:value.tax_label_fr} (${rate})`,amountMinor:value.tax_minor}]};
}
