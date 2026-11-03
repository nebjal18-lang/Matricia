import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLatestFinanceCostProofPageReader, decideFinanceZeroCost, downloadFinanceCostEvidence, proposeFinanceZeroCost, readFinanceCostProofPage } from "./review-commands";
const target="11111111-1111-4111-8111-111111111111",upload="22222222-2222-4222-8222-222222222222",proposal="33333333-3333-4333-8333-333333333333",hash="a".repeat(64),rpc=vi.fn(),client={rpc} as unknown as SupabaseClient;
const reason="Frais exonérés dans le justificatif fourni";
const input=()=>({component:"PSP_FEE" as const,targetId:target,uploadId:upload,reason,idempotencyKey:`finance-zero-cost:${upload}`});
const receipt=(outcome="CREDIT_ECONOMIC_COST_PROPOSED")=>({outcome,proposal_id:proposal,source_hash:hash,net_cost_minor:"0",currency:"MAD"});
const proof={upload_id:upload,file_name:"Pièce originale.pdf",sha256:hash,mime_type:"application/pdf",size_bytes:12};
const page=()=>({page:1,page_size:20,has_more:false,documents:[{...proof,status:"UPLOADED",scan_status:"CLEAN",revoked:false}],proposals:[{id:proposal,component:"PSP_FEE",target_id:target,source_hash:hash,currency:"MAD",status:"PENDING",can_decide:true,proof}]});
beforeEach(()=>rpc.mockReset().mockResolvedValue({data:receipt(),error:null}));
describe("governed zero cost commands",()=>{
 it("submits an immutable document reference and original free text without a caller amount or proof boolean",async()=>{
  expect(await proposeFinanceZeroCost(client,input())).toEqual({ok:true,proposalId:proposal,outcome:"PROPOSED"});
  expect(rpc).toHaveBeenCalledWith("propose_credit_economic_zero_cost_v1",{p_component:"PSP_FEE",p_target_id:target,p_upload_id:upload,p_reason:reason,p_idempotency_key:`finance-zero-cost:${upload}`});
  expect(rpc.mock.calls[0]![1]).not.toHaveProperty("p_amount_minor");expect(rpc.mock.calls[0]![1]).not.toHaveProperty("p_document_read");
 });
 it("rejects invalid scope or missing explanation before a mutation",async()=>{
  expect(await proposeFinanceZeroCost(client,{...input(),targetId:"wrong"})).toEqual({ok:false,code:"VALIDATION"});expect(await proposeFinanceZeroCost(client,{...input(),reason:"court"})).toEqual({ok:false,code:"VALIDATION"});expect(rpc).not.toHaveBeenCalled();
 });
 it("refuses a nonzero or malformed proposal receipt instead of presenting a false approved cost",async()=>{
  rpc.mockResolvedValue({data:{...receipt(),net_cost_minor:"1200"},error:null});expect(await proposeFinanceZeroCost(client,input())).toEqual({ok:false,code:"INVALID_RESPONSE"});
 });
 it.each([["42501","MFA_AAL2_REQUIRED","MFA_REQUIRED"],["42501","INDEPENDENT_FINANCE_REQUIRED","FORBIDDEN"],["40001","SOURCE_CHANGED","CONFLICT"],["55000","FINANCE_COST_DOCUMENT_READ_RECEIPT_REQUIRED","EVIDENCE_REQUIRED"],["55000","ADVERSE_FUNDING_REVIEW_REQUIRED","CONFLICT"]])("keeps failed prerequisites precise %s/%s",async(code,message,expected)=>{
  rpc.mockResolvedValue({data:null,error:{code,message}});expect(await proposeFinanceZeroCost(client,input())).toEqual({ok:false,code:expected});
 });
 it("pins approval to the exact expected source with a reason and no invented read receipt",async()=>{
  rpc.mockResolvedValue({data:receipt("CREDIT_ECONOMIC_COST_RECONCILED"),error:null});
  expect(await decideFinanceZeroCost(client,{proposalId:proposal,sourceHash:hash,approved:true,reason})).toEqual({ok:true,proposalId:proposal,outcome:"APPROVED"});
  expect(rpc).toHaveBeenCalledWith("decide_credit_economic_cost_v1",{p_proposal_id:proposal,p_expected_source_hash:hash,p_approved:true,p_reason:reason});
 });
 it("does not call an unexpected response or a different proposal successful",async()=>{
  rpc.mockResolvedValue({data:receipt("CREDIT_ECONOMIC_COST_REJECTED"),error:null});expect(await decideFinanceZeroCost(client,{proposalId:proposal,sourceHash:hash,approved:true,reason})).toEqual({ok:false,code:"INVALID_RESPONSE"});
  rpc.mockResolvedValue({data:{...receipt("CREDIT_ECONOMIC_COST_RECONCILED"),proposal_id:target},error:null});expect(await decideFinanceZeroCost(client,{proposalId:proposal,sourceHash:hash,approved:true,reason})).toEqual({ok:false,code:"INVALID_RESPONSE"});
 });
 it("preserves a real refusal rather than translating it into an approval",async()=>{
  rpc.mockResolvedValue({data:receipt("CREDIT_ECONOMIC_COST_REJECTED"),error:null});expect(await decideFinanceZeroCost(client,{proposalId:proposal,sourceHash:hash,approved:false,reason})).toEqual({ok:true,proposalId:proposal,outcome:"REJECTED"});
 });
});
describe("scoped paginated evidence review",()=>{
 it("validates the selected component/target and preserves raw filenames",async()=>{
  rpc.mockResolvedValue({data:page(),error:null});const value=await readFinanceCostProofPage(client,{id:target,component:"PSP_FEE",label:"Encaissement validé"},1);
  expect(value).toMatchObject({ok:true,value:{hasMore:false,documents:[{fileName:"Pièce originale.pdf"}],proposals:[{targetLabel:"Encaissement validé",canDecide:true}]}});
  expect(rpc).toHaveBeenLastCalledWith("get_finance_cost_documents_v1",{p_component:"PSP_FEE",p_target_id:target,p_page:1});
 });
 it("does not filter out foreign response rows and pretend the dossier has no requests",async()=>{
  const data=page();data.proposals[0]!.target_id=upload;rpc.mockResolvedValue({data,error:null});expect(await readFinanceCostProofPage(client,{id:target,component:"PSP_FEE",label:"TEST"},1)).toEqual({ok:false,code:"INVALID_RESPONSE"});
 });
 it("requires complete page metadata and keeps a failure distinct from a genuine empty result",async()=>{
  rpc.mockResolvedValue({data:{...page(),has_more:undefined},error:null});expect(await readFinanceCostProofPage(client,{id:target,component:"PSP_FEE",label:"TEST"},1)).toEqual({ok:false,code:"INVALID_RESPONSE"});
  rpc.mockResolvedValue({data:null,error:{code:"08006"}});expect(await readFinanceCostProofPage(client,{id:target,component:"PSP_FEE",label:"TEST"},1)).toEqual({ok:false,code:"UNAVAILABLE"});
  rpc.mockResolvedValue({data:{...page(),documents:[],proposals:[]},error:null});expect(await readFinanceCostProofPage(client,{id:target,component:"PSP_FEE",label:"TEST"},1)).toMatchObject({ok:true,value:{documents:[],proposals:[]}});
 });
});
describe("audited evidence bytes",()=>{
 const bytes="%PDF-1.7\nTEST",evidence={uploadId:upload,fileName:"Original.pdf",sha256:createHash("sha256").update(bytes).digest("hex"),mimeType:"application/pdf" as const,sizeBytes:bytes.length};
 it("downloads through the scoped API and checks the actual received hash and bytes",async()=>{
  const request=vi.fn(async()=>new Response(bytes,{headers:{"content-type":"application/pdf"}}));const result=await downloadFinanceCostEvidence(evidence,request);
  expect(result.ok).toBe(true);expect(request).toHaveBeenCalledWith(`/api/finance/cost-proofs/${upload}`,{credentials:"same-origin",cache:"no-store"});
 });
 it("refuses changed bytes even when the name, mime and size look identical",async()=>{
  const request=vi.fn(async()=>new Response(bytes.replace("TEST","FAKE"),{headers:{"content-type":"application/pdf"}}));expect(await downloadFinanceCostEvidence(evidence,request)).toEqual({ok:false,code:"INVALID_RESPONSE"});
 });
 it("does not present a denied or unclean document as reviewed",async()=>{
  const request=vi.fn(async()=>new Response(null,{status:409}));expect(await downloadFinanceCostEvidence(evidence,request)).toEqual({ok:false,code:"EVIDENCE_REQUIRED"});
 });
});


describe("a changing Finance dossier",()=>{
 it("ignores a slower previous dossier response rather than putting its requests into the new selection",async()=>{
  let firstResolve!:(value:unknown)=>void,secondResolve!:(value:unknown)=>void;
  rpc.mockImplementationOnce(()=>new Promise(resolve=>{firstResolve=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{secondResolve=resolve;}));
  const reader=createLatestFinanceCostProofPageReader();
  const first=reader.read(client,{id:target,component:"PSP_FEE",label:"Dossier A"},1);
  const second=reader.read(client,{id:upload,component:"PSP_FEE",label:"Dossier B"},1);
  const secondPage=page();secondPage.proposals[0]!.target_id=upload;
  secondResolve({data:secondPage,error:null});expect(await second).toMatchObject({ok:true,value:{proposals:[{targetId:upload,targetLabel:"Dossier B"}]}});
  firstResolve({data:page(),error:null});expect(await first).toBeNull();
 });
 it("does not publish a pending result after leaving its scope",async()=>{
  let resolve!:(value:unknown)=>void;rpc.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const reader=createLatestFinanceCostProofPageReader(),pending=reader.read(client,{id:target,component:"PSP_FEE",label:"Dossier"},1);reader.invalidate();resolve({data:page(),error:null});expect(await pending).toBeNull();
 });
});


describe("a Finance proof second-factor prerequisite",()=>{
 it("does not confuse a missing factor with a missing dossier authorization on download",async()=>{
  const evidence={uploadId:upload,fileName:"TEST.pdf",sha256:hash,mimeType:"application/pdf" as const,sizeBytes:12};
  const request=vi.fn(async()=>new Response(JSON.stringify({code:"FINANCE_COST_MFA_REQUIRED"}),{status:403}));
  expect(await downloadFinanceCostEvidence(evidence,request)).toEqual({ok:false,code:"MFA_REQUIRED"});
 });
});
