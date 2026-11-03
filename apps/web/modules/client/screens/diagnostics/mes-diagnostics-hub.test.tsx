import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MesDiagnosticsHub } from "./mes-diagnostics-hub";
const filterHrefs = { all: "/fr/client/diagnostics?organizationId=org&kind=all", complete: "/fr/client/diagnostics?organizationId=org&kind=complete", indicative: "/fr/client/diagnostics?organizationId=org&kind=indicative" };
describe("diagnostic history filters", () => {
 it("offers real keyboard accessible links preserving the tenant and selected filter", () => {
  const html = renderToStaticMarkup(<MesDiagnosticsHub locale="fr" cards={[]} history={[]} todos={[]} resources={[]} assistanceHref="/fr/aide" filterHrefs={filterHrefs} historyFilter="complete" indicativeHistory={<p>Imported intake</p>} />);
  expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/fr\/client\/diagnostics\?organizationId=org&amp;kind=complete"/u);
  expect(html).not.toContain('role="tablist"');
  expect(html).not.toContain("Imported intake");
  expect(html).toContain("Aucun diagnostic complet");
 });
 it("shows imported intakes separately from full diagnostics in Arabic", () => {
  const html = renderToStaticMarkup(<MesDiagnosticsHub locale="ar" cards={[]} history={[{id:"full",title:"Full diagnostic",meta:"",status:"completed",href:"/fr/full"}]} todos={[]} resources={[]} assistanceHref="/ar/aide" filterHrefs={filterHrefs} historyFilter="indicative" indicativeHistory={<p>Imported intake</p>} />);
  expect(html).toContain("Imported intake");
  expect(html).not.toContain("Full diagnostic");
  expect(html).toContain("تقييم أولي مستورد");
 });
 it("does not present a loading failure as an empty history", () => {
  const html = renderToStaticMarkup(<MesDiagnosticsHub locale="fr" cards={[]} history={[]} todos={[]} resources={[]} assistanceHref="/fr/aide" historyFilter="complete" historyFailed />);
  expect(html).not.toContain("Aucun diagnostic complet");
 });
});
