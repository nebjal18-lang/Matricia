import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({path:"",query:"",space:vi.fn(),roles:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>mocks.path,useSearchParams:()=>new URLSearchParams(mocks.query),notFound:()=>{throw Error("NOT_FOUND")},redirect:(href:string)=>{throw Error(`REDIRECT:${href}`)}}));
vi.mock("@/modules/shared/ui/workspace-account-menu",()=>({WorkspaceAccountMenu:({returnTo}:{returnTo:string})=><div data-account-return={returnTo}/> }));
vi.mock("@/modules/provider/data/spaces/context",()=>({resolveProviderSpace:mocks.space}));
vi.mock("@/app/[locale]/organisation/roles/actions",()=>({listOrganizationRoles:mocks.roles}));
vi.mock("@/modules/provider/screens/mode-client/activate-form",()=>({ActivateClientRoleForm:()=>null}));
import { ProviderAppShell } from "./provider-app-shell";
import { buildProviderNav } from "./provider-nav";
import ModePage from "@/app/[locale]/sous-traitant/mode-client/page";
const org="ab970000-0000-4000-8000-000000000001";
const query=`?organizationId=${org}&q=mission&page=4&workspace=administration`;
const links=(html:string)=>[...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gu)].map(match=>({url:new URL(match[1]!.replaceAll("&amp;","&"),"https://matricia.invalid"),label:match[2]!.replace(/<[^>]*>/gu,"")}));
function shell(locale:"fr"|"ar",languagePath?:string,children:ReactNode=null){return <ProviderAppShell locale={locale} selectedQuery={query} languagePath={languagePath} organizations={[{id:org,name:"Test organization"}]} selectedOrganizationId={org} userEmail={null} active="home">{children}</ProviderAppShell>}
beforeEach(()=>{
 mocks.path="";mocks.query="";
 mocks.space.mockResolvedValue({status:"success",readError:null,selectedOrganizationId:org,selectedQuery:query,userEmail:null,organizationName:"Test organization",organizations:[{id:org,name:"Test organization"}]});
 mocks.roles.mockResolvedValue({status:"success",organizations:[{id:org,displayName:"Test organization",currentRoles:["PROVIDER_OWNER","CLIENT_OWNER"]}],requests:[]});
});
describe("Provider dashboard entry remains explicit for a dual-role member",()=>{
 it.each(["fr","ar"] as const)("forces Provider for nav, brand, fallback and both language links in %s",locale=>{
  const nav=new URL(buildProviderNav(locale,query).find(item=>item.key==="home")!.href,"https://matricia.invalid");expect(nav.searchParams.get("workspace")).toBe("provider");expect(nav.searchParams.get("organizationId")).toBe(org);
  const html=renderToStaticMarkup(shell(locale));
  const homeLinks=links(html).filter(({url})=>/^\/(fr|ar)\/tableau-de-bord$/u.test(url.pathname));
  expect(homeLinks.length).toBeGreaterThanOrEqual(5);for(const {url}of homeLinks){expect(url.searchParams.getAll("workspace")).toEqual(["provider"]);expect(url.searchParams.get("organizationId")).toBe(org);expect(url.searchParams.get("q")).toBe("mission");expect(url.searchParams.get("page")).toBe("4");}
  expect(html.match(/name="workspace" value="provider"/gu)).toHaveLength(2);
 });
 it.each(["fr","ar"] as const)("replaces a wrong workspace in an explicit home languagePath but preserves detail paths in %s",locale=>{
  const home=`/${locale}/tableau-de-bord${query}#priorities`;mocks.path=`/${locale}/tableau-de-bord`;mocks.query=query.slice(1);
  const homeHtml=renderToStaticMarkup(shell(locale,home));expect(homeHtml).toContain(`data-account-return="/${locale}/tableau-de-bord?organizationId=${org}&amp;q=mission&amp;page=4&amp;workspace=provider#priorities"`);
  const detail=`/${locale}/sous-traitant/missions/${org}?organizationId=${org}&page=2&workspace=client#proofs`;mocks.path=`/${locale}/sous-traitant/missions/${org}`;mocks.query=`organizationId=${org}&page=2&workspace=client`;
  const html=renderToStaticMarkup(shell(locale,detail));expect(html).toContain(`data-account-return="${detail.replaceAll("&","&amp;")}"`);
  for(const {url}of links(html).filter(({url})=>url.pathname.includes(`/missions/${org}`))){expect(url.searchParams.get("workspace")).toBe("client");expect(url.searchParams.get("page")).toBe("2");}
  expect(links(html).find(({url})=>url.pathname===`/${locale}/tableau-de-bord`)?.url.searchParams.get("workspace")).toBe("provider");
 });
 it.each(["fr","ar"] as const)("gives the same dual-role member distinct Provider return and Client entry links in %s",async locale=>{
  mocks.path=`/${locale}/sous-traitant/mode-client`;mocks.query=query.slice(1);
  const html=renderToStaticMarkup(await ModePage({params:Promise.resolve({locale}),searchParams:Promise.resolve({organizationId:org})}));
  const entries=links(html);
  const provider=entries.find(({label})=>label.includes(locale==="ar"?"البقاء كمقدّم خدمة":"Rester en mode professionnel"))!.url;
  const client=entries.find(({label})=>label.includes(locale==="ar"?"متابعة كعميل":"Continuer en Mode Client"))!.url;
  expect(provider.searchParams.getAll("workspace")).toEqual(["provider"]);expect(client.searchParams.getAll("workspace")).toEqual(["client"]);
  for(const url of [provider,client]){expect(url.pathname).toBe(`/${locale}/tableau-de-bord`);expect(url.searchParams.get("organizationId")).toBe(org);expect(url.searchParams.get("q")).toBe("mission");expect(url.searchParams.get("page")).toBe("4");}
 });
});
