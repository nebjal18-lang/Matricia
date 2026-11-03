import { beforeEach,describe,expect,it,vi } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { source } from "./__fixtures__/source";
const mocks=vi.hoisted(()=>({render:vi.fn(),upload:vi.fn(),download:vi.fn(),rpc:vi.fn()}));
vi.mock("@/modules/shared/lib/commercial-documents/pdf",()=>({renderBillingPdf:mocks.render}));
import { archiveClientCommercialDocument } from "./artifacts";
const bytes=Buffer.from("%PDF-1.7\n"+"fixture-content".repeat(20));
const sha=createHash("sha256").update(bytes).digest("hex");
const artifact={document_id:source.id,locale:"fr"as const,source_hash:source.source_hash,pdf_sha256:sha,size_bytes:bytes.length,storage_path:`${source.organization_id}/${source.id}/fr/${source.source_hash}.pdf`,renderer_version:"CLIENT_BILLING_PDF_V1"as const};
const admin={storage:{from:()=>({upload:mocks.upload,download:mocks.download})},rpc:mocks.rpc}as unknown as SupabaseClient;
describe("private client PDF archive",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.render.mockResolvedValue(bytes);mocks.upload.mockResolvedValue({error:null});mocks.download.mockResolvedValue({data:new Blob([bytes]),error:null});mocks.rpc.mockResolvedValue({data:artifact,error:null});});
 it("archives only an uploaded exact snapshot with server computed hash",async()=>{const result=await archiveClientCommercialDocument(source,admin,"fr");expect(result.ok).toBe(true);expect(mocks.upload).toHaveBeenCalledWith(artifact.storage_path,bytes,expect.objectContaining({upsert:false}));expect(mocks.rpc).toHaveBeenCalledWith("record_client_commercial_artifact_v1",expect.objectContaining({p_pdf_sha256:sha,p_source_hash:source.source_hash,p_size_bytes:bytes.length}));});
 it("finishes an upload whose first response was lost",async()=>{mocks.upload.mockResolvedValue({error:{statusCode:"409"}});expect((await archiveClientCommercialDocument(source,admin,"fr")).ok).toBe(true);expect(mocks.download).toHaveBeenCalledWith(artifact.storage_path);});
 it("serves archived bytes without applying today's issuer or re-rendering",async()=>{expect((await archiveClientCommercialDocument({...source,artifacts:[artifact]},admin,"fr")).ok).toBe(true);expect(mocks.render).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();});
 it("rejects damaged archived bytes without replacing the official document",async()=>{mocks.download.mockResolvedValue({data:new Blob(["%PDF-corrupted"]),error:null});expect(await archiveClientCommercialDocument({...source,artifacts:[artifact]},admin,"fr")).toEqual({ok:false,code:"CLIENT_BILLING_CORRUPTED"});expect(mocks.render).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();});
 it("does not report archive success when metadata could not be recorded",async()=>{mocks.rpc.mockResolvedValue({data:null,error:{code:"503"}});expect((await archiveClientCommercialDocument(source,admin,"fr")).ok).toBe(false);});
});
