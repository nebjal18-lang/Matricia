import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc:mocks.rpc})}));
import { loadFranchiseMessaging } from "./repository";
const franchise="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333";
const thread={id,object_type:"FRANCHISE_RFQ",object_id:id,service_request_id:id,franchise_id:franchise,subject:"Objet",status:"OPEN",contact_policy_version:"CONTACT-MASK-V1",participant_organization_id:id,participant_kind:"FRANCHISE",counterparty_alias:"PROVIDER",created_at:"2026-10-31T00:00:00Z",last_message_at:"2026-10-31T00:00:00Z",message_count:1};
beforeEach(()=>mocks.rpc.mockReset().mockImplementation(async(name:string)=>({data:name==="search_franchise_message_inbox"?{inbox:[thread],total:1,page:1,pageSize:25}:name==="get_internal_message_thread_page"?{thread,messages:[],hasMore:false,nextCursor:null,total:0}:[],error:null})));
describe("franchise explicit participant inbox",()=>{
 it("loads actual scoped conversations",async()=>{const result=await loadFranchiseMessaging({franchiseId:franchise,threadId:id});expect(result.status).toBe("success");expect(mocks.rpc).toHaveBeenCalledWith("search_franchise_message_inbox",{p_franchise_id:franchise,p_search:"",p_page:1});});
 it("denies a thread belonging to another mandate even when the actor belongs to both",async()=>{expect((await loadFranchiseMessaging({franchiseId:other,threadId:id})).status).toBe("error");});
 it("does not replace a failed inbox with an empty conversation list",async()=>{mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"57014"}});expect((await loadFranchiseMessaging({franchiseId:franchise})).status).toBe("error");});
});
