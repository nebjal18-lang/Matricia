import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("@/modules/shared/lib/credits-wallet/server-repository",()=>({createServerCreditsRepository:async()=>({load:mocks.load})}));
vi.mock("@/modules/client/data/spaces/context",()=>({resolveClientSpace:async()=>({status:"success",selectedOrganizationId:"11111111-1111-4111-8111-111111111111",selectedQuery:"?organizationId=11111111-1111-4111-8111-111111111111",userEmail:null,organizationName:"Test"})}));
vi.mock("@/modules/client/ui/client-app-shell",()=>({ClientAppShell:({children}:{children:ReactNode})=><main>{children}</main>}));
vi.mock("@/modules/shared/lib/time/server-clock",()=>({getServerTimestamp:()=>Date.parse("2026-11-02T00:00:00Z")}));
import Page from "./page";
describe("client credit failure state",()=>{
 it.each(["fr","ar"] as const)("keeps financial access denied distinct from a technical incident (%s)",async locale=>{
  mocks.load.mockResolvedValue({status:"error",reason:"FORBIDDEN"});
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({organizationId:"11111111-1111-4111-8111-111111111111"})}));
  expect(html).toContain('data-workspace-failure="FORBIDDEN"');expect(html).not.toContain('data-workspace-failure="UNAVAILABLE"');
  expect(html).not.toContain("Aucun portefeuille");
 });
 it.each(["fr","ar"] as const)("keeps a technical incident retryable in the same organization (%s)",async locale=>{
  mocks.load.mockResolvedValue({status:"error",reason:"UNAVAILABLE"});
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({})}));
  expect(html).toContain('data-workspace-failure="UNAVAILABLE"');expect(html).toContain(`/${locale}/client/credits?organizationId=11111111-1111-4111-8111-111111111111`);
 });
});
