import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({read:vi.fn(),pdf:vi.fn()}));
vi.mock("@/modules/shared/lib/signer-preparation/repository",()=>({readSignerPreparation:mocks.read,PreparationReadError:class extends Error {constructor(readonly code:string){super(code);}}}));
vi.mock("@/modules/shared/lib/signature-documents/http",()=>({signatureDocumentResponse:mocks.pdf}));
import {GET}from"./route";
const id="03940000-0000-4000-8000-000000000001",foreign="03940000-0000-4000-8000-000000000002",sha="a".repeat(64);
const workspace={envelopeId:id,signerId:id,contractId:id,amendmentId:null,status:"DRAFT",canConfigure:true,documents:[{id,sha256:sha,fileName:"source.pdf",contractVersionId:id,locale:"ar"}]};
const context={params:Promise.resolve({envelopeId:id,documentId:id})};
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue(workspace);mocks.pdf.mockImplementation(async()=>new Response("%PDF-exact-source",{headers:{"content-type":"application/pdf",etag:`"${sha}"`}}));});
it("serves only the authorized exact PDF inline with a strict same-origin framing policy",async()=>{
 const response=await GET(new Request("https://app.example/api?locale=fr"),context);expect(response.status).toBe(200);expect(response.headers.get("content-disposition")).toContain("inline");expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");expect(response.headers.get("cache-control")).toContain("no-store");expect(mocks.pdf).toHaveBeenCalledWith(expect.any(Request),{kind:"CONTRACT",contractId:id,contractVersionId:id});expect(mocks.pdf.mock.calls[0]![0].url).toContain("locale=ar");expect(mocks.read).toHaveBeenCalledTimes(2);
});
it("does not look up a foreign document outside the own-signer projection",async()=>{
 expect((await GET(new Request("https://app.example/api"),{params:Promise.resolve({envelopeId:id,documentId:foreign})})).status).toBe(404);expect(mocks.pdf).not.toHaveBeenCalled();
});
it("refuses a different PDF hash even if the canonical document route returns success",async()=>{
 mocks.pdf.mockResolvedValue(new Response("%PDF-other",{headers:{"content-type":"application/pdf",etag:`"${"b".repeat(64)}"`}}));expect((await GET(new Request("https://app.example/api"),context)).status).toBe(409);
});
it("rechecks current ownership after document IO and refuses revoked access",async()=>{
 mocks.read.mockResolvedValueOnce(workspace).mockRejectedValueOnce(new Error("session revoked"));const response=await GET(new Request("https://app.example/api"),context);expect(response.status).toBe(503);expect(await response.text()).not.toContain("%PDF");
});
it("rejects malformed identifiers before authentication or privileged document IO",async()=>{
 expect((await GET(new Request("https://app.example/api"),{params:Promise.resolve({envelopeId:"../../other",documentId:id})})).status).toBe(404);expect(mocks.read).not.toHaveBeenCalled();expect(mocks.pdf).not.toHaveBeenCalled();
});
