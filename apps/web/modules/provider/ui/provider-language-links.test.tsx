import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({path:"/fr/sous-traitant/messages/11111111-1111-4111-8111-111111111111",params:"organizationId=22222222-2222-4222-8222-222222222222&q=libre&page=5&before=2026-11-01T00%3A00%3A00.123456Z&beforeId=33333333-3333-4333-8333-333333333333"}));
vi.mock("next/navigation",()=>({usePathname:()=>state.path,useSearchParams:()=>new URLSearchParams(state.params)}));
import { ProviderLanguageLinks } from "./provider-language-links";
describe("Provider language continuity",()=>{
 it("keeps dossier, selected organization, filters, page and exact microsecond history cursor",()=>{
  const html=renderToStaticMarkup(<ProviderLanguageLinks locale="fr" fallback="/fr/sous-traitant/messages"/>);
  expect(html).toContain('/ar/sous-traitant/messages/11111111-1111-4111-8111-111111111111?organizationId=22222222-2222-4222-8222-222222222222');
  expect(html).toContain('page=5');expect(html).toContain('00.123456Z');expect(html).toContain('q=libre');
 });
 it("preserves a planning week and an Arabic route when returning to French",()=>{
  state.path="/ar/sous-traitant/planning";state.params="week=2026-11-09&organizationId=22222222-2222-4222-8222-222222222222";
  const html=renderToStaticMarkup(<ProviderLanguageLinks locale="ar" fallback="/ar/sous-traitant/planning"/>);
  expect(html).toContain('/fr/sous-traitant/planning?week=2026-11-09');expect(html).toContain('aria-current="page"');
 });
 it.each(["fr","ar"] as const)("retains the Provider workspace on live dashboard language navigation in %s",locale=>{
  state.path=`/${locale}/tableau-de-bord`;state.params="organizationId=22222222-2222-4222-8222-222222222222&q=mission&workspace=client";
  const html=renderToStaticMarkup(<ProviderLanguageLinks locale={locale} fallback={`/${locale}/tableau-de-bord?workspace=provider`}/>);
  const links=[...html.matchAll(/href="([^"]+)"/gu)].map(match=>new URL(match[1]!.replaceAll("&amp;","&"),"https://matricia.invalid"));
  expect(links).toHaveLength(2);for(const url of links){expect(url.searchParams.get("workspace")).toBe("provider");expect(url.searchParams.get("q")).toBe("mission");expect(url.searchParams.get("organizationId")).toBe("22222222-2222-4222-8222-222222222222");}
 });

});
