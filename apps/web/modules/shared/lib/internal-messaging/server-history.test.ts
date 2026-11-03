import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),user:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc:mocks.rpc,auth:{getUser:mocks.user}})}));
import{createInternalMessagingRepository}from"./server-repository";
const id="11111111-1111-4111-8111-111111111111";
const page={thread:{id,object_type:"RFQ",object_id:id,service_request_id:id,subject:"Objet",status:"OPEN",contact_policy_version:"CONTACT-MASK-V1",participant_organization_id:id,participant_kind:"CLIENT",counterparty_alias:"PROVIDER",created_at:"2026-11-01T00:00:00Z"},messages:[],hasMore:false,nextCursor:null,total:0};
beforeEach(()=>{mocks.user.mockReset().mockResolvedValue({data:{user:{id}},error:null});mocks.rpc.mockReset().mockResolvedValue({data:page,error:null});});
describe("authorized immutable message history pages",()=>{
 it("retains Auth transport failure as unavailable instead of logging an authenticated member out",async()=>{mocks.user.mockResolvedValue({data:{user:null},error:{status:503}});expect(await(await createInternalMessagingRepository()).history(id)).toEqual({status:"error",reason:"UNAVAILABLE"});expect(mocks.rpc).not.toHaveBeenCalled();});
 it("passes explicit organization to the guarded canonical-history wrapper",async()=>{const repository=await createInternalMessagingRepository();expect((await repository.history(id,undefined,id)).status).toBe("success");expect(mocks.rpc).toHaveBeenCalledWith("get_internal_message_thread_page_for_organization_v1",{p_thread_id:id,p_organization_id:id,p_before_created_at:null,p_before_message_id:null,p_page_size:50});});
 it("preserves the exact tuple cursor including microseconds",async()=>{const repository=await createInternalMessagingRepository();const cursor={createdAt:"2026-11-01T00:00:00.123456Z",id};expect((await repository.history(id,cursor)).status).toBe("success");expect(mocks.rpc).toHaveBeenCalledWith("get_internal_message_thread_page",{p_thread_id:id,p_before_created_at:cursor.createdAt,p_before_message_id:id,p_page_size:50});});
 it("does not replace a rejected cursor with an empty successful page",async()=>{mocks.rpc.mockResolvedValue({data:null,error:{code:"22023"}});const repository=await createInternalMessagingRepository();expect(await repository.history(id,{createdAt:"2026-11-01T00:00:00Z",id})).toEqual({status:"error",reason:"UNAVAILABLE"});});
 it("retains explicit participant denial",async()=>{mocks.rpc.mockResolvedValue({data:null,error:{code:"42501"}});expect(await(await createInternalMessagingRepository()).history(id)).toEqual({status:"error",reason:"FORBIDDEN"});});
 it("requires authentication before reading history",async()=>{mocks.user.mockResolvedValue({data:{user:null},error:null});expect(await(await createInternalMessagingRepository()).history(id)).toEqual({status:"error",reason:"UNAUTHENTICATED"});expect(mocks.rpc).not.toHaveBeenCalled();});
});
