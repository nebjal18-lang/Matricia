import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.user},rpc:mocks.rpc})}));
import { GET } from "@/app/api/signatures/yousign/envelopes/[envelopeId]/preparation/route";
const context={params:Promise.resolve({envelopeId:"03940000-0000-4000-8000-000000000001"})};
beforeEach(()=>vi.clearAllMocks());
it.each([{name:"AuthRetryableFetchError",status:503},{name:"TypeError",status:0}])("preserves technical authentication failure as HTTP503 %#",async error=>{
 mocks.user.mockResolvedValue({data:{user:null},error});const response=await GET(new Request("https://app.example/api"),context);expect(response.status).toBe(503);expect(await response.json()).toEqual({code:"PREPARATION_UNAVAILABLE"});expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([{name:"AuthSessionMissingError"},{name:"AuthApiError",status:401}])("asks for login only when the session is actually missing %#",async error=>{
 mocks.user.mockResolvedValue({data:{user:null},error});const response=await GET(new Request("https://app.example/api"),context);expect(response.status).toBe(401);expect(await response.json()).toEqual({code:"UNAUTHENTICATED"});expect(mocks.rpc).not.toHaveBeenCalled();
});
it("recognizes an absent authenticated user without a transport error",async()=>{
 mocks.user.mockResolvedValue({data:{user:null},error:null});expect((await GET(new Request("https://app.example/api"),context)).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
});
