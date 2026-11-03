import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
const mocks=vi.hoisted(()=>({detail:vi.fn(),list:vi.fn(),notFound:vi.fn(()=>{throw new Error("NOT_FOUND")}),redirect:vi.fn(()=>{throw new Error("REDIRECT")})}));
vi.mock("next/navigation",()=>({notFound:mocks.notFound,redirect:mocks.redirect}));
vi.mock("@/modules/client/data/spaces/context",()=>({resolveClientSpace:async()=>({status:"success",selectedOrganizationId:"00000000-0000-4000-8000-000000000001",selectedQuery:"?organizationId=00000000-0000-4000-8000-000000000001",organizationName:"Société test",userEmail:"owner@example.invalid"})}));
vi.mock("@/modules/shared/lib/disputes/server-repository",()=>({createServerDisputesRepository:async()=>({detail:mocks.detail,list:mocks.list})}));
vi.mock("@/modules/client/ui/client-app-shell",()=>({ClientAppShell:({children}:{children:ReactNode})=><div>{children}</div>}));
import Page from "./page";
const input=(locale="fr")=>({params:Promise.resolve({locale,caseId:"00000000-0000-4000-8000-000000000002"}),searchParams:Promise.resolve({organizationId:"00000000-0000-4000-8000-000000000001"})});
beforeEach(()=>{vi.clearAllMocks();mocks.list.mockResolvedValue({status:"error",reason:"UNAVAILABLE"});mocks.detail.mockResolvedValue({status:"error",reason:"UNAVAILABLE"});});
describe("Client dispute incident states",()=>{
 it.each(["fr","ar"])("does not turn a technical dossier failure into404 in %s",async locale=>{const html=renderToStaticMarkup(await Page(input(locale)));expect(mocks.notFound).not.toHaveBeenCalled();expect(mocks.redirect).not.toHaveBeenCalled();expect(html).toContain('role="alert"');expect(html).toContain(locale==="ar"?"إعادة المحاولة":"Réessayer");expect(html).toContain("organizationId=00000000-0000-4000-8000-000000000001");});
 it("does not invite retrying a malformed dossier reference",async()=>{mocks.detail.mockResolvedValue({status:"error",reason:"INVALID_INPUT"});await expect(Page(input())).rejects.toThrow("NOT_FOUND");});
 it("preserves privacy for an absent or RLS-hidden dossier",async()=>{mocks.detail.mockResolvedValue({status:"success",value:null});await expect(Page(input())).rejects.toThrow("NOT_FOUND");expect(mocks.notFound).toHaveBeenCalledOnce();});
});
