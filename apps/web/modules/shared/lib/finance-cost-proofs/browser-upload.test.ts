import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { financeCostUploadReplayKey, inspectFinanceCostFile, readFinanceCostUpload, uploadFinanceCostProof } from "./browser-upload";
const actor="11111111-1111-4111-8111-111111111111",target="22222222-2222-4222-8222-222222222222",uploadId="33333333-3333-4333-8333-333333333333";
const bytes="%PDF-1.7\nTEST Finance cost proof",sha=createHash("sha256").update(bytes).digest("hex"),rpc=vi.fn(),store=vi.fn(),request=vi.fn();
const client={rpc,storage:{from:vi.fn(()=>({upload:store}))}} as unknown as SupabaseClient;
const file=()=>new File([bytes],"Justification comptable.pdf",{type:"application/pdf"});
const slot=()=>({upload_id:uploadId,bucket:"finance-cost-proofs",path:`finance-cost/${uploadId}`,status:"RESERVED",scan_status:"PENDING",sha256:sha,size_bytes:new TextEncoder().encode(bytes).length,mime_type:"application/pdf"});
const input=()=>({actorId:actor,component:"PSP_FEE" as const,targetId:target,file:file()});
const receipt=()=>new Response(JSON.stringify({outcome:"FINANCE_COST_DOCUMENT_UPLOADED",upload_id:uploadId,scan_status:"PENDING"}),{status:200,headers:{"content-type":"application/json"}});
beforeEach(()=>{vi.clearAllMocks();rpc.mockResolvedValue({data:slot(),error:null});store.mockResolvedValue({error:null});request.mockImplementation(async()=>receipt());});
describe("private Finance cost evidence upload",()=>{
 it.each([new File([],"vide.pdf",{type:"application/pdf"}),new File(["not a PDF"],"faux.pdf",{type:"application/pdf"}),new File(["<script>"],"image.svg",{type:"image/svg+xml"}),new File([new Uint8Array(10485761)],"large.pdf",{type:"application/pdf"})])("rejects unsuitable file %s before reserving or uploading",async candidate=>{
  expect(await uploadFinanceCostProof(client,{...input(),file:candidate},request)).toEqual({ok:false,code:"INVALID_FILE"});expect(rpc).not.toHaveBeenCalled();expect(store).not.toHaveBeenCalled();
 });
 it("uses actual bytes and a private, non-overwriting object then waits for trusted commit",async()=>{
  const phases:string[]=[];const result=await uploadFinanceCostProof(client,{...input(),onPhase:phase=>phases.push(phase)},request);
  expect(result).toMatchObject({ok:true,upload:{upload_id:uploadId,status:"UPLOADED",scan_status:"PENDING"}});
  expect(rpc).toHaveBeenCalledWith("reserve_finance_cost_document_v1",expect.objectContaining({p_component:"PSP_FEE",p_target_id:target,p_file_name:"Justification comptable.pdf",p_sha256:sha,p_size_bytes:file().size,p_mime_type:"application/pdf"}));
  expect(store).toHaveBeenCalledWith(`finance-cost/${uploadId}`,expect.any(File),{contentType:"application/pdf",cacheControl:"0",upsert:false});
  expect(request).toHaveBeenCalledWith(`/api/finance/cost-proofs/uploads/${uploadId}`,expect.objectContaining({method:"POST",credentials:"same-origin",body:"{}"}));
  expect(phases).toEqual(["HASHING","RESERVING","UPLOADING","VERIFYING"]);expect(rpc).toHaveBeenCalledTimes(1);
 });
 it("derives stable scoped UUIDv8 keys without persisting the document or a session",async()=>{
  const metadata=(await inspectFinanceCostFile(file()))!;
  const key=await financeCostUploadReplayKey(actor,"PSP_FEE",target,metadata);
  expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(await financeCostUploadReplayKey(actor,"PSP_FEE",target,metadata)).toBe(key);
  for(const values of [[target,"PSP_FEE",target,metadata],[actor,"FULFILLMENT_COST",target,metadata],[actor,"PSP_FEE",actor,metadata],[actor,"PSP_FEE",target,{...metadata,sha256:"a".repeat(64)}],[actor,"PSP_FEE",target,{...metadata,fileName:"Autre nom.pdf"}]] as const)expect(await financeCostUploadReplayKey(values[0],values[1],values[2],values[3])).not.toBe(key);
 });
 it("resumes the same reservation after a lost commit response and rechecks bytes on storage409",async()=>{
  request.mockRejectedValueOnce(new Error("response lost")).mockImplementationOnce(async()=>receipt());
  expect(await uploadFinanceCostProof(client,input(),request)).toEqual({ok:false,code:"CONNECTION_INTERRUPTED",uploadId});
  store.mockResolvedValueOnce({error:{statusCode:409}});
  expect(await uploadFinanceCostProof(client,input(),request)).toMatchObject({ok:true,upload:{scan_status:"PENDING"}});
  expect(rpc.mock.calls[0]![1].p_idempotency_key).toBe(rpc.mock.calls[1]![1].p_idempotency_key);expect(request).toHaveBeenCalledTimes(2);
 });
 it("does not call a mismatched reservation or arbitrary storage bucket trustworthy",async()=>{
  rpc.mockResolvedValue({data:{...slot(),sha256:"0".repeat(64)},error:null});
  expect(await uploadFinanceCostProof(client,input(),request)).toEqual({ok:false,code:"INVALID_RESPONSE"});expect(store).not.toHaveBeenCalled();
  rpc.mockResolvedValue({data:{...slot(),bucket:"public"},error:null});expect(await uploadFinanceCostProof(client,input(),request)).toEqual({ok:false,code:"INVALID_RESPONSE"});
 });
 it.each([["42501","FRANCHISE_MFA_REQUIRED","MFA_REQUIRED"],["42501","NO_ACCESS","FORBIDDEN"],["40001","STALE","CONFLICT"]])("keeps reservation prerequisites distinct: %s/%s",async(code,message,expected)=>{
  rpc.mockResolvedValue({data:null,error:{code,message}});expect(await uploadFinanceCostProof(client,input(),request)).toEqual({ok:false,code:expected});expect(store).not.toHaveBeenCalled();
 });
 it("does not finalize an unsuccessful physical upload",async()=>{
  store.mockResolvedValue({error:{statusCode:503}});expect(await uploadFinanceCostProof(client,input(),request)).toEqual({ok:false,code:"UPLOAD_FAILED",uploadId});expect(request).not.toHaveBeenCalled();
 });
 it.each([401,403,409,503])("does not certify a failed finalization HTTP%s",async status=>{
  request.mockResolvedValue(new Response("",{status}));expect((await uploadFinanceCostProof(client,input(),request)).ok).toBe(false);
 });
 it("does not certify a receipt from another upload",async()=>{
  request.mockResolvedValue(new Response(JSON.stringify({outcome:"FINANCE_COST_DOCUMENT_UPLOADED",upload_id:target,scan_status:"CLEAN"}),{status:200}));
  expect(await uploadFinanceCostProof(client,input(),request)).toEqual({ok:false,code:"INVALID_RESPONSE",uploadId});
 });
 it("keeps server rejection and scan failure as actual outcomes rather than clean",async()=>{
  for(const scan_status of ["REJECTED","ERROR"]){request.mockImplementation(async()=>new Response(JSON.stringify({outcome:"FINANCE_COST_DOCUMENT_UPLOADED",upload_id:uploadId,scan_status}),{status:200}));expect(await uploadFinanceCostProof(client,input(),request)).toMatchObject({ok:true,upload:{scan_status}});}
 });
 it("polls only the requested upload and refuses a cross-target response",async()=>{
  rpc.mockResolvedValue({data:{...slot(),status:"UPLOADED",scan_status:"CLEAN"},error:null});expect(await readFinanceCostUpload(client,uploadId)).toMatchObject({ok:true,upload:{scan_status:"CLEAN"}});expect(rpc).toHaveBeenLastCalledWith("get_finance_cost_upload_context_v1",{p_upload_id:uploadId});
  rpc.mockResolvedValue({data:{...slot(),upload_id:target},error:null});expect(await readFinanceCostUpload(client,uploadId)).toEqual({ok:false,code:"INVALID_RESPONSE",uploadId});
 });
});


describe("a protected Finance upload response",()=>{
 it("uses the explicit server MFA code without reinterpreting every403",async()=>{
  request.mockResolvedValue(new Response(JSON.stringify({code:"FINANCE_COST_MFA_REQUIRED"}),{status:403}));
  expect(await uploadFinanceCostProof(client,input(),request)).toEqual({ok:false,code:"MFA_REQUIRED",uploadId});
  request.mockResolvedValue(new Response(JSON.stringify({code:"FINANCE_COST_DOCUMENT_ACCESS_DENIED"}),{status:403}));
  expect(await uploadFinanceCostProof(client,input(),request)).toEqual({ok:false,code:"FORBIDDEN",uploadId});
 });
});

describe("real scanner retry",()=>{
 it("reschedules the same uploaded document, preserves the audit reason and asks the server to recheck its bytes",async()=>{
  const {retryFinanceCostScan}=await import("./browser-upload");rpc.mockResolvedValue({data:{outcome:"FINANCE_COST_DOCUMENT_RETRY_SCHEDULED",upload_id:uploadId,scan_status:"PENDING"},error:null});
  expect(await retryFinanceCostScan(client,uploadId,"Reprise après indisponibilité du contrôle",request)).toEqual({ok:true,uploadId,scanStatus:"PENDING",retryScheduled:true});
  expect(rpc).toHaveBeenCalledWith("retry_finance_cost_document_scan_v1",{p_upload_id:uploadId,p_reason:"Reprise après indisponibilité du contrôle"});expect(store).not.toHaveBeenCalled();expect(request).toHaveBeenCalledWith(`/api/finance/cost-proofs/uploads/${uploadId}`,expect.objectContaining({method:"POST",body:"{}"}));
 });
 it("does not certify a scan when scheduling succeeded but its immediate server check failed",async()=>{
  const {retryFinanceCostScan}=await import("./browser-upload");rpc.mockResolvedValue({data:{outcome:"FINANCE_COST_DOCUMENT_RETRY_SCHEDULED",upload_id:uploadId,scan_status:"PENDING"},error:null});request.mockResolvedValue(new Response(null,{status:503}));
  expect(await retryFinanceCostScan(client,uploadId,"Reprise après incident du scanner",request)).toEqual({ok:false,code:"UPLOAD_UNCONFIRMED",uploadId,retryScheduled:true});
 });
 it("does not recheck bytes after a foreign owner or busy lease refusal",async()=>{
  const {retryFinanceCostScan}=await import("./browser-upload");
  for(const code of ["42501","55P03"]){rpc.mockResolvedValue({data:null,error:{code}});const response=await retryFinanceCostScan(client,uploadId,"Reprise document en attente",request);expect(response).toMatchObject({ok:false,retryScheduled:false});}
  expect(request).not.toHaveBeenCalled();
 });
 it("validates the reason and never trusts a receipt for a different document",async()=>{
  const {retryFinanceCostScan}=await import("./browser-upload");expect(await retryFinanceCostScan(client,uploadId,"court",request)).toMatchObject({ok:false,code:"VALIDATION",retryScheduled:false});expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({data:{outcome:"FINANCE_COST_DOCUMENT_RETRY_SCHEDULED",upload_id:target,scan_status:"PENDING"},error:null});expect(await retryFinanceCostScan(client,uploadId,"Reprise document en attente",request)).toMatchObject({ok:false,code:"INVALID_RESPONSE",retryScheduled:false});expect(request).not.toHaveBeenCalled();
 });
});
