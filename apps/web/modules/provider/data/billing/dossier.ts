import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
const uuid=z.string().uuid(),minor=z.string().regex(/^\d+$/),hash=z.string().regex(/^[0-9a-f]{64}$/);
const invoice=z.object({id:uuid,statement_id:uuid,issued_on:z.string(),document_hash:hash,tax_rule_snapshot:z.array(z.object({tax_rule_version_id:uuid,rate_basis_points:z.number().int().min(0).max(10000)})),subtotal_minor:minor,tax_minor:minor,total_minor:minor});
const statement=z.object({id:uuid,statement_number:z.string(),period_start:z.string(),period_end:z.string(),document_hash:hash});
const line=z.object({id:minor,payable_event_id:uuid,subtotal_minor:minor,tax_minor:minor,total_minor:minor});
const payable=z.object({id:uuid,mission_id:uuid,occurred_on:z.string(),event_type:z.string(),client_receipt_reference:z.string(),proof_hash:hash});
const allocation=z.object({id:minor,payment_id:uuid,amount_minor:minor,created_at:z.string()});
const payment=z.object({id:uuid,payment_reference:z.string(),paid_on:z.string(),amount_minor:minor});
const proof=z.object({id:uuid,payment_id:uuid,sha256:hash,original_file_name:z.string(),scan_result_id:uuid.nullable()});
const receiptProof=proof.omit({payment_id:true}).extend({payable_event_id:uuid});
const credit=z.object({id:uuid,credit_number:z.string(),issued_on:z.string(),total_minor:minor});
const delivery=z.object({id:uuid,mission_id:uuid,label_fr:z.string(),label_ar:z.string(),current_version:z.number().int(),status:z.string()});
const acceptance=z.object({id:uuid,deliverable_id:uuid,criterion_key:z.string(),status:z.string(),comment:z.string().nullable(),decided_at:z.string().nullable()});
const receipt=z.object({id:uuid,matricia_receipt_reference:z.string(),recorded_at:z.string(),commission_amount_minor:minor,tax_amount_minor:minor});
const dispute=z.object({id:uuid,mission_id:uuid,status:z.string(),description:z.string(),opened_at:z.string()});
const collection=z.object({id:uuid,reason:z.string(),opened_at:z.string()});
const correctionSchema=z.object({id:uuid,original_invoice_id:uuid,original_statement_id:uuid,cancellation_credit_note_id:uuid,replacement_invoice_id:uuid,prior_credit_subtotal_minor:minor,prior_credit_tax_minor:minor});
const transferSchema=z.object({id:uuid,source_invoice_id:uuid,target_invoice_id:uuid,amount_minor:minor});
export type ProviderInvoiceDossier={correction?:z.infer<typeof correctionSchema>;replacedBy?:z.infer<typeof correctionSchema>;creditTransfers?:z.infer<typeof transferSchema>[];originalArtifacts?:Array<{id:string;locale:string}>;editionStates?:{invoice:string;statement:string;credits?:Record<string,string>};source:z.infer<typeof invoice>;statement:z.infer<typeof statement>;lines:Array<z.infer<typeof line>&{event:z.infer<typeof payable>}>;allocations:Array<z.infer<typeof allocation>&{payment:z.infer<typeof payment>}>;proofs:z.infer<typeof proof>[];receiptProofs:z.infer<typeof receiptProof>[];credits:z.infer<typeof credit>[];deliveries:z.infer<typeof delivery>[];acceptances:z.infer<typeof acceptance>[];receipts:z.infer<typeof receipt>[];collections:z.infer<typeof collection>[];disputes:z.infer<typeof dispute>[]};
export async function loadProviderInvoiceDossier(organizationId:string,invoiceId:string):Promise<ProviderInvoiceDossier|null>{
 if(!uuid.safeParse(organizationId).success||!uuid.safeParse(invoiceId).success)return null;
 const c=await getSupabaseServerClient();
 const source=await c.from("provider_invoices").select("id,statement_id,issued_on,document_hash,tax_rule_snapshot,subtotal_minor::text,tax_minor::text,total_minor::text").eq("provider_organization_id",organizationId).eq("id",invoiceId).maybeSingle();
 const parsed=invoice.safeParse(source.data);if(source.error||!parsed.success)return null;
 const correctionResult=await c.from("provider_invoice_recipient_corrections").select("id,original_invoice_id,original_statement_id,cancellation_credit_note_id,replacement_invoice_id,prior_credit_subtotal_minor::text,prior_credit_tax_minor::text").eq("provider_organization_id",organizationId).eq("replacement_invoice_id",invoiceId).maybeSingle();
 const corrections=correctionSchema.nullable().safeParse(correctionResult.data);if(correctionResult.error||!corrections.success)return null;
 const correction=corrections.data??undefined;
 const [replacedResult,transfersResult]=await Promise.all([
 c.from("provider_invoice_recipient_corrections").select("id,original_invoice_id,original_statement_id,cancellation_credit_note_id,replacement_invoice_id,prior_credit_subtotal_minor::text,prior_credit_tax_minor::text").eq("provider_organization_id",organizationId).eq("original_invoice_id",invoiceId).maybeSingle(),
 c.from("provider_invoice_credit_transfers").select("id,source_invoice_id,target_invoice_id,amount_minor::text").eq("provider_organization_id",organizationId).or(`source_invoice_id.eq.${invoiceId},target_invoice_id.eq.${invoiceId}`)]);
 const replaced=correctionSchema.nullable().safeParse(replacedResult.data),transfers=z.array(transferSchema).safeParse(transfersResult.data);
 if(replacedResult.error||transfersResult.error||!replaced.success||!transfers.success)return null;
 const [s,l,a,cr,re,co]=await Promise.all([
  c.from("provider_statements").select("id,statement_number,period_start,period_end,document_hash").eq("provider_organization_id",organizationId).eq("id",parsed.data.statement_id).maybeSingle(),
  c.from("provider_statement_lines").select("id::text,payable_event_id,subtotal_minor::text,tax_minor::text,total_minor::text").eq("provider_organization_id",organizationId).eq("statement_id",correction?.original_statement_id??parsed.data.statement_id).order("id"),
  c.from("provider_payment_allocations").select("id::text,payment_id,amount_minor::text,created_at").eq("provider_organization_id",organizationId).eq("invoice_id",invoiceId).order("created_at"),
  c.from("provider_credit_notes").select("id,credit_number,issued_on,total_minor::text").eq("provider_organization_id",organizationId).eq("invoice_id",invoiceId).order("issued_on"),
  c.from("provider_commission_receipts").select("id,matricia_receipt_reference,recorded_at,commission_amount_minor::text,tax_amount_minor::text").eq("provider_organization_id",organizationId).eq("provider_invoice_id",invoiceId).order("recorded_at"),
  c.from("provider_collection_cases").select("id,reason,opened_at").eq("provider_organization_id",organizationId).eq("invoice_id",invoiceId).order("opened_at"),
 ]);
 const ps=statement.safeParse(s.data),pl=z.array(line).safeParse(l.data),pa=z.array(allocation).safeParse(a.data),pc=z.array(credit).safeParse(cr.data),pr=z.array(receipt).safeParse(re.data),pco=z.array(collection).safeParse(co.data);
 if([s,l,a,cr,re,co].some(x=>x.error)||!ps.success||!pl.success||!pa.success||!pc.success||!pr.success||!pco.success)return null;
 const netDeduction=BigInt(correction?.prior_credit_subtotal_minor??"0"),taxDeduction=BigInt(correction?.prior_credit_tax_minor??"0");
 if(pl.data.reduce((sum,x)=>sum+BigInt(x.subtotal_minor),BigInt(0))-netDeduction!==BigInt(parsed.data.subtotal_minor)||pl.data.reduce((sum,x)=>sum+BigInt(x.tax_minor),BigInt(0))-taxDeduction!==BigInt(parsed.data.tax_minor))return null;
 const paymentIds=[...new Set(pa.data.map(x=>x.payment_id))],eventIds=pl.data.map(x=>x.payable_event_id);
 const [p,ev,pf,rpf]=await Promise.all([
  paymentIds.length?c.from("provider_payments").select("id,payment_reference,paid_on,amount_minor::text").eq("provider_organization_id",organizationId).in("id",paymentIds):{data:[],error:null},
  eventIds.length?c.from("provider_payable_events").select("id,mission_id,occurred_on,event_type,client_receipt_reference,proof_hash").eq("provider_organization_id",organizationId).in("id",eventIds):{data:[],error:null},
  paymentIds.length?c.from("provider_payment_proofs").select("id,payment_id,sha256,original_file_name,scan_result_id").eq("provider_organization_id",organizationId).in("payment_id",paymentIds):{data:[],error:null},
  eventIds.length?c.from("provider_payable_event_proofs").select("id,payable_event_id,sha256,original_file_name,scan_result_id").eq("provider_organization_id",organizationId).in("payable_event_id",eventIds):{data:[],error:null},
 ]);
 const prpf=z.array(receiptProof).safeParse(rpf.data);
 const pp=z.array(payment).safeParse(p.data),pe=z.array(payable).safeParse(ev.data),pfp=z.array(proof).safeParse(pf.data);if([p,ev,pf,rpf].some(x=>x.error)||!pp.success||!pe.success||!pfp.success||!prpf.success)return null;
 const payments=new Map(pp.data.map(x=>[x.id,x])),events=new Map(pe.data.map(x=>[x.id,x]));if(pa.data.some(x=>!payments.has(x.payment_id))||pl.data.some(x=>!events.has(x.payable_event_id)))return null;
 const missionIds=[...new Set(pe.data.map(x=>x.mission_id))];
 const disputesResult=missionIds.length?await c.from("dispute_cases").select("id,mission_id,status,description,opened_at").eq("provider_organization_id",organizationId).in("mission_id",missionIds):{data:[],error:null};
 const disputes=z.array(dispute).safeParse(disputesResult.data);if(disputesResult.error||!disputes.success)return null;
 const d=missionIds.length?await c.from("deliverables").select("id,mission_id,label_fr,label_ar,current_version,status").in("mission_id",missionIds):{data:[],error:null};
 const pd=z.array(delivery).safeParse(d.data);if(d.error||!pd.success)return null;
 const ac=pd.data.length?await c.from("acceptance_checklists").select("id,deliverable_id,criterion_key,status,comment,decided_at").in("deliverable_id",pd.data.map(x=>x.id)):{data:[],error:null};const pac=z.array(acceptance).safeParse(ac.data);if(ac.error||!pac.success)return null;
 const states=await Promise.all(([['invoice',[invoiceId]],['statement',[parsed.data.statement_id]],['credit_note',pc.data.map(x=>x.id)]]as const).map(([kind,ids])=>ids.length?c.rpc("get_provider_billing_document_states",{p_provider_organization_id:organizationId,p_kind:kind,p_source_ids:ids}):{data:[],error:null}));
 const parsedStates=states.map(result=>z.array(z.object({source_id:uuid,status:z.enum(["READY","EDITION_PENDING","LEGACY_REVIEW_REQUIRED","CORRECTION_REQUIRED","CORRECTED"]),original_artifacts:z.array(z.object({id:uuid,locale:z.enum(["fr","ar"])})).optional()})).safeParse(result.data));
 if(states.some(result=>result.error)||parsedStates.some(result=>!result.success))return null;
 const statusAt=(index:number)=>{const result=parsedStates[index];return result?.success?result.data[0]?.status??"LEGACY_REVIEW_REQUIRED":"LEGACY_REVIEW_REQUIRED";};
 const invoiceState=parsedStates[0];
 return {correction,replacedBy:replaced.data??undefined,creditTransfers:transfers.data,originalArtifacts:invoiceState?.success?invoiceState.data[0]?.original_artifacts:[],editionStates:{invoice:statusAt(0),statement:statusAt(1),credits:Object.fromEntries(parsedStates[2]?.success?parsedStates[2].data.map(x=>[x.source_id,x.status]):[])},source:parsed.data,statement:ps.data,lines:pl.data.map(x=>({...x,event:events.get(x.payable_event_id)!})),allocations:pa.data.map(x=>({...x,payment:payments.get(x.payment_id)!})),proofs:pfp.data,receiptProofs:prpf.data,credits:pc.data,deliveries:pd.data,acceptances:pac.data,receipts:pr.data,collections:pco.data,disputes:disputes.data};
}
