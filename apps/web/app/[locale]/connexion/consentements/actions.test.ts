import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn(),ensure:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
vi.mock("@/modules/shared/lib/auth/consent/current-documents",()=>({ensureCurrentConsentDocuments:mocks.ensure}));vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import{acceptUpdatedLegalDocuments}from"./actions";
const id="a2070000-0000-4000-8000-000000000001",hash="a".repeat(64);
function form(){const f=new FormData();Object.entries({locale:"ar",documentSetId:id,sourceHash:hash,idempotencyKey:id,accepted:"ACCEPTED"}).forEach(([k,v])=>f.set(k,v));return f;}
beforeEach(()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id}},error:null});mocks.ensure.mockResolvedValue({id,source_hash:hash});mocks.rpc.mockResolvedValue({data:{outcome:"LEGAL_CONSENT_RECORDED",acceptance_id:id},error:null});});
describe("explicit versioned legal reacceptance",()=>{
 it("binds the authenticated actor to exact server-prepared text identifiers",async()=>{expect(await acceptUpdatedLegalDocuments({status:"idle"},form())).toEqual({status:"success"});expect(mocks.rpc).toHaveBeenCalledWith("accept_account_legal_consent_v1",{p_document_set_id:id,p_source_hash:hash,p_consent:true,p_idempotency_key:id});});
 it("refuses an unchecked box before any mutation",async()=>{const f=form();f.delete("accepted");expect(await acceptUpdatedLegalDocuments({status:"idle"},f)).toEqual({status:"error",reason:"EXPLICIT"});expect(mocks.rpc).not.toHaveBeenCalled();});
 it("rejects a stale displayed text even when its identifiers are syntactically valid",async()=>{mocks.ensure.mockResolvedValue({id:"b2070000-0000-4000-8000-000000000001",source_hash:hash});expect(await acceptUpdatedLegalDocuments({status:"idle"},form())).toEqual({status:"error",reason:"STALE"});expect(mocks.rpc).not.toHaveBeenCalled();});
 it("never reports successful acceptance on network or RPC failure",async()=>{mocks.rpc.mockRejectedValue(new Error("network"));expect(await acceptUpdatedLegalDocuments({status:"idle"},form())).toEqual({status:"error",reason:"UNAVAILABLE"});expect(mocks.revalidate).not.toHaveBeenCalled();});
});
