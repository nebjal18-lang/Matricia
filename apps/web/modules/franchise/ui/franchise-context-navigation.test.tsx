import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FranchiseMandateSelector } from "./franchise-access-state";
import { FranchiseAppShell } from "./franchise-app-shell";
const org="22222222-2222-4222-8222-222222222222",first="33333333-3333-4333-8333-333333333333",second="44444444-4444-4444-8444-444444444444";
const mandates=[{id:first,organizationId:org,label:"Mandat TEST A"},{id:second,organizationId:org,label:"Mandat TEST B"},{id:"55555555-5555-4555-8555-555555555555",organizationId:second,label:"Autre organisation autorisée"}];
for(const locale of ["fr","ar"] as const)describe(`Franchise explicit context ${locale}`,()=>{
 it("lists only mandates belonging to the chosen organization and requires an explicit selection",()=>{
  const html=renderToStaticMarkup(<FranchiseMandateSelector locale={locale} mandates={mandates} organizationId={org} selectedFranchiseId={null} returnPath={`/${locale}/franchise/services?q=ancien`}/>);
  expect(html).toContain(`action="/${locale}/franchise/services"`);expect(html).toContain('name="organizationId"');expect(html).toContain('name="franchiseId" required=""');expect(html).toContain('for="franchise-mandate-context"');expect(html).toContain(first);expect(html).toContain(second);expect(html).not.toContain('Autre organisation');expect(html).not.toContain('selected="" value="'+first);
 });
 it("retains the chosen mandate during global search and the exact deep page when changing language",()=>{
  const query=`?organizationId=${org}&franchiseId=${second}`;
  const path=`/${locale}/franchise/questionnaires/${first}/simulation${query}&q=texte-libre`;
  const html=renderToStaticMarkup(<FranchiseAppShell locale={locale} selectedQuery={query} selectedOrganizationId={org} userEmail={null} active="questionnaires" languagePath={path} mandates={mandates}><p>TEST</p></FranchiseAppShell>);
  expect(html).toContain(`name="franchiseId" value="${second}"`);
  const mobileSearch = html.match(/<a\b[^>]*class="client-icon-btn franchise-mobile-search"[^>]*>/u)?.[0];
  expect(mobileSearch).toContain(`href="/${locale}/franchise/recherche?organizationId=${org}&amp;franchiseId=${second}"`);
  const other=locale==="fr"?"ar":"fr";
  expect(html).toContain(`href="/${other}/franchise/questionnaires/${first}/simulation?organizationId=${org}&amp;franchiseId=${second}&amp;q=texte-libre"`);
  expect(html).toContain(locale==="ar"?'dir="rtl"':'dir="ltr"');
 });
});
