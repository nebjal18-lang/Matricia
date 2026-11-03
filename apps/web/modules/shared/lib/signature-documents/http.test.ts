import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),server:vi.fn(),admin:vi.fn(),archive:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:mocks.server}));
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:mocks.admin}));
vi.mock("./archive",()=>({getOrArchiveSignatureDocument:mocks.archive}));
import{signatureDocumentResponse}from"./http";
const id="bb410000-0000-4000-8000-000000000001";
describe("private source PDF HTTP boundary",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.server.mockResolvedValue({auth:{getUser:mocks.getUser}});mocks.getUser.mockResolvedValue({data:{user:{id}},error:null});mocks.archive.mockResolvedValue({ok:true,sourceId:id,bytes:Buffer.from("%PDF-source"),artifact:{pdf_sha256:"a".repeat(64)}});});
 it("requires validated native authentication before touching documents",async()=>{mocks.getUser.mockResolvedValue({data:{user:null},error:null});const result=await signatureDocumentResponse(new Request("http://localhost/api?locale=ar"),{kind:"CONTRACT",contractId:id});expect(result.status).toBe(401);expect(mocks.archive).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled();});
 it.each(["xx","fr%00"])("rejects malformed locale %s before authentication",async locale=>{const result=await signatureDocumentResponse(new Request(`http://localhost/api?locale=${locale}`),{kind:"CONTRACT",contractId:id});expect(result.status).toBe(404);expect(mocks.server).not.toHaveBeenCalled();});
 it("rejects arbitrary identifiers before privileged lookup",async()=>{expect((await signatureDocumentResponse(new Request("http://localhost/api"),{kind:"CONTRACT",contractId:"../other"})).status).toBe(404);expect(mocks.archive).not.toHaveBeenCalled();});
 it("returns a private source document, exact historical version and hash",async()=>{const result=await signatureDocumentResponse(new Request("http://localhost/api?locale=ar"),{kind:"CONTRACT",contractId:id,contractVersionId:id});expect(result.status).toBe(200);expect(result.headers.get("cache-control")).toContain("no-store");expect(result.headers.get("x-matricia-document-kind")).toBe("UNSIGNED_SOURCE_DOCUMENT");expect(result.headers.get("content-disposition")).toContain(`contract-source-${id}-ar.pdf`);expect(result.headers.get("etag")).toBe(`"${"a".repeat(64)}"`);expect(mocks.archive).toHaveBeenCalledWith(expect.anything(),expect.any(Function),{kind:"CONTRACT",contractId:id,contractVersionId:id},"ar",id);});
 it("reports an archive failure without returning any PDF",async()=>{mocks.archive.mockResolvedValue({ok:false,code:"SIGNATURE_DOCUMENT_INTEGRITY_FAILED"});const result=await signatureDocumentResponse(new Request("http://localhost/api"),{kind:"AMENDMENT",amendmentId:id});expect(result.status).toBe(503);expect(result.headers.get("content-type")).toContain("application/json");expect(await result.json()).toEqual({code:"SIGNATURE_DOCUMENT_INTEGRITY_FAILED"});});
});
