import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import { financeCostProofCopy } from "@/modules/admin/screens/pnl/finance-cost-proof-copy";
const mocks=vi.hoisted(()=>({context:vi.fn(),load:vi.fn(),panel:vi.fn()}));
vi.mock("next/navigation",async original=>({...await original<typeof import("next/navigation")>(),redirect:(href:string)=>{throw new Error(`REDIRECT:${href}`);},notFound:()=>{throw new Error("NOT_FOUND");}}));
vi.mock("@/modules/admin/ui/sensitive-page-context",()=>({sensitivePageContext:mocks.context}));
vi.mock("@/modules/admin/data/finance-cost-proofs/repository",()=>({financeCostReadRoles:["SUPER_ADMIN","MATRICIA_ADMIN","FINANCE_MANAGER","READ_ONLY_AUDITOR"],loadAdminFinanceCostTargets:mocks.load}));
vi.mock("@/modules/admin/screens/pnl/finance-cost-proof-panel",()=>({FinanceCostProofPanel:mocks.panel}));
const id="11111111-1111-4111-8111-111111111111",access={userId:id,roles:new Set(["FINANCE_MANAGER"]),requirementSatisfied:true};
const source=()=>({status:"success",value:{targets:[{id,component:"PSP_FEE",label:"Encaissement TEST"}],canUpload:true,page:2,pageSize:20,hasMore:true,search:"Société & reçu"}});
beforeEach(()=>{
 vi.clearAllMocks();mocks.context.mockResolvedValue({status:"authorized",access,wrap:(children:ReactNode)=><div data-admin-shell>{children}</div>});mocks.load.mockResolvedValue(source());mocks.panel.mockImplementation(()=> <section>PROOF_WORKSPACE</section>);vi.spyOn(console,"error").mockImplementation(()=>undefined);
});
const props=(locale="fr")=>({params:Promise.resolve({locale}),searchParams:Promise.resolve({q:"Société & reçu",page:"2"})});
for(const locale of ["fr","ar"] as const)describe(`Finance cost route ${locale}`,()=>{
 it("uses the protected Admin context and wires real targets with server capabilities",async()=>{
  const html=renderToStaticMarkup(await Page(props(locale)));expect(html).toContain("PROOF_WORKSPACE");expect(html).toContain('data-admin-shell');
  expect(mocks.context).toHaveBeenCalledWith(expect.objectContaining({locale,active:"finance",roles:expect.arrayContaining(["FINANCE_MANAGER","READ_ONLY_AUDITOR"])}));
  expect(mocks.load).toHaveBeenCalledWith({locale,page:"2",search:"Société & reçu"},access);
  expect(mocks.panel).toHaveBeenCalledWith(expect.objectContaining({locale,workspace:{status:"success",targets:source().value.targets,canUpload:true}}),undefined);
  expect(html).toContain(`href="/${locale}/administration/finance"`);
 });
 it("keeps the same search and page context in previous, next and authentication resume links",async()=>{
  const html=renderToStaticMarkup(await Page(props(locale)));const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]!.replaceAll('&amp;','&'));
  for(const page of [1,3]){const path=hrefs.find(href=>href.startsWith(`/${locale}/administration/finance/rapprochements-couts?`)&&new URL(href,"https://matricia.invalid").searchParams.get("page")===String(page))!;expect(new URL(path,"https://matricia.invalid").searchParams.get("q")).toBe("Société & reçu");}
 });
 it("never calls the business loader after the shared role or MFA context blocks",async()=>{
  mocks.context.mockResolvedValue({status:"blocked",view:<p>PRECONDITION_BLOCKED</p>});const html=renderToStaticMarkup(await Page(props(locale)));expect(html).toContain("PRECONDITION_BLOCKED");expect(mocks.load).not.toHaveBeenCalled();expect(mocks.panel).not.toHaveBeenCalled();
 });
 it.each(["FORBIDDEN","MFA_REQUIRED","QUERY_FAILED","INVALID_RESPONSE","CONFIGURATION"])("does not display an empty successful workspace for %s",async reason=>{
  mocks.load.mockResolvedValue({status:"error",reason});const html=renderToStaticMarkup(await Page(props(locale)));expect(mocks.panel).not.toHaveBeenCalled();expect(html).toContain(`data-workspace-failure="${reason}"`);expect(html).not.toContain(financeCostProofCopy[locale].emptyTargetPage);
  if(reason==="MFA_REQUIRED")expect(html).toContain(`/${locale}/securite/compte?`);
 });
 it("shows a genuine empty page and keeps a route back to earlier matching pages",async()=>{
  mocks.load.mockResolvedValue({status:"success",value:{...source().value,targets:[],hasMore:false}});const html=renderToStaticMarkup(await Page(props(locale)));expect(html).toContain(financeCostProofCopy[locale].emptyTargetPage);expect(mocks.panel).not.toHaveBeenCalled();expect(html).toContain('page=1');expect(html).not.toContain('page=3');
 });
 it("provides a precise reset for an invalid query rather than calling it a backend incident",async()=>{
  mocks.load.mockResolvedValue({status:"error",reason:"VALIDATION"});const html=renderToStaticMarkup(await Page(props(locale)));expect(html).toContain(financeCostProofCopy[locale].invalidQuery);expect(html).not.toContain('data-workspace-failure');expect(mocks.panel).not.toHaveBeenCalled();
 });
 it("does not offer an invalid next page or silently hide the remaining target limit",async()=>{
  mocks.load.mockResolvedValue({status:"success",value:{...source().value,page:10000,hasMore:true}});const html=renderToStaticMarkup(await Page(props(locale)));expect(html).toContain(financeCostProofCopy[locale].refineSearch);expect(html).toContain('page=9999');expect(html).not.toContain('page=10001');
 });
 it("resumes this search after a session expires between context and projection",async()=>{
  mocks.load.mockResolvedValue({status:"error",reason:"UNAUTHENTICATED"});await expect(Page(props(locale))).rejects.toThrow("REDIRECT:");
  try{await Page(props(locale));}catch(error){const url=new URL((error as Error).message.slice(9),"https://matricia.invalid");const next=new URL(url.searchParams.get("next")!,"https://matricia.invalid");expect(next.pathname).toBe(`/${locale}/administration/finance/rapprochements-couts`);expect(next.searchParams.get("q")).toBe("Société & reçu");expect(next.searchParams.get("page")).toBe("2");}
 });
});
it("rejects an unsupported locale before requesting access",async()=>{await expect(Page(props("en"))).rejects.toThrow("NOT_FOUND");expect(mocks.context).not.toHaveBeenCalled();});
