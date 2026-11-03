import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { refreshSupabaseSession } from "./proxy";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),create:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createServerClient:(...args:unknown[])=>{mocks.create(...args);return{auth:{getUser:mocks.getUser}};}}));
vi.mock("@/modules/shared/lib/env",()=>({getPublicEnvironment:()=>({NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"test-public-key"})}));
beforeEach(()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:null},error:null});});
const org="22222222-2222-4222-8222-222222222222";
const franchise="33333333-3333-4333-8333-333333333333";
for(const locale of ["fr","ar"] as const)describe(`session verification proxy ${locale}`,()=>{
 it.each(["client/demandes","sous-traitant/documents","franchise/services","administration/entreprises"])("does not turn Auth503 into a login redirect for %s",async route=>{
  mocks.getUser.mockResolvedValue({data:{user:null},error:{status:503,name:"AuthRetryableFetchError"}});
  const request=new NextRequest(`https://matricia.example/${locale}/${route}?organizationId=${org}&franchiseId=${franchise}`,{headers:{cookie:"test-session=preserved"}});
  const response=await refreshSupabaseSession(request);
  expect(response.status).toBe(503);expect(response.headers.has("location")).toBe(false);
  const target=new URL(response.headers.get("x-middleware-rewrite")!);
  expect(target.pathname).toBe(`/${locale}/indisponible`);
  expect(target.searchParams.get("next")).toBe(`/${locale}/${route}?organizationId=${org}&franchiseId=${franchise}`);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.cookies.getAll().some(cookie=>cookie.name==="test-session"&&cookie.value==="")).toBe(false);
 });
 it("returns a technical failure when Auth transport rejects rather than bypassing the protected route",async()=>{
  mocks.getUser.mockRejectedValue(new TypeError("Synthetic local transport failure"));
  const response=await refreshSupabaseSession(new NextRequest(`https://matricia.example/${locale}/franchise/accueil`));
  expect(response.status).toBe(503);expect(response.headers.has("location")).toBe(false);expect(response.headers.get("x-middleware-rewrite")).toContain(`/${locale}/indisponible`);
 });
 it("still redirects a genuinely absent session to login with the exact deep link",async()=>{
  const path=`/${locale}/franchise/services?organizationId=${org}&franchiseId=${franchise}`;
  const response=await refreshSupabaseSession(new NextRequest(`https://matricia.example${path}`));
  expect(response.status).toBe(307);const target=new URL(response.headers.get("location")!);expect(target.pathname).toBe(`/${locale}/connexion`);expect(target.searchParams.get("next")).toBe(path);
 });
 it("does not treat a cached user as authenticated after a known invalid-session response",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:org}},error:{status:401}});
  const response=await refreshSupabaseSession(new NextRequest(`https://matricia.example/${locale}/franchise/services`));
  expect(response.status).toBe(307);expect(response.headers.get("location")).toContain(`/${locale}/connexion`);
 });
 it("keeps public recovery independent of the unavailable Auth service",async()=>{
  const response=await refreshSupabaseSession(new NextRequest(`https://matricia.example/${locale}/indisponible`));
  expect(response.status).toBe(200);expect(mocks.getUser).not.toHaveBeenCalled();
 });
 it("forwards an actually authenticated protected request",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:org}},error:null});
  const response=await refreshSupabaseSession(new NextRequest(`https://matricia.example/${locale}/franchise/services`));
  expect(response.status).toBe(200);expect(response.headers.get("x-middleware-next")).toBe("1");expect(response.headers.has("location")).toBe(false);
 });
});


for (const locale of ["fr", "ar"]) describe(`post-OTP action ${locale}`, () => {
  const path = `/${locale}/franchise/services?organizationId=${org}&franchiseId=${franchise}`;
  it("does not intercept the authenticated Server Action before its role and MFA checks", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: org } }, error: null });
    const response = await refreshSupabaseSession(new NextRequest(`https://matricia.example/${locale}/connexion?${new URLSearchParams({ next: path })}`, { method: "POST", headers: { "next-action": "test-post-login-action", "content-type": "text/plain;charset=UTF-8" }, body: "[]" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.has("location")).toBe(false);
  });
  it.each(["GET", "HEAD"])("retains the existing authenticated %s navigation redirect", async method => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: org } }, error: null });
    const response = await refreshSupabaseSession(new NextRequest(`https://matricia.example/${locale}/connexion?${new URLSearchParams({ next: path })}`, { method }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe(`/${locale}/franchise/services`);
  });
});
