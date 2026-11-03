import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {QuoteRevisionNotice} from "./quote-revision-notice";
import {ComparisonPanel} from "./comparison-panel";
import {getClientRfqMessages} from "./messages";
const request="f3460000-0000-4000-8000-000000000001",rfq="f3460000-0000-4000-8000-000000000002",quote="f3460000-0000-4000-8000-000000000003",version="f3460000-0000-4000-8000-000000000004",organization="f3460000-0000-4000-8000-000000000005";
describe("published history during Provider revision",()=>{
 it.each(["fr","ar"]as const)("keeps an authorized history link in the %s notice",locale=>{const html=renderToStaticMarkup(<QuoteRevisionNotice locale={locale} requestId={request} query={`?organizationId=${organization}`} revisions={[{quoteId:quote,publishedVersionId:version}]}/>);expect(html).toContain(`/${locale}/client/demandes/${request}/offres/${quote}?organizationId=${organization}&amp;versionId=${version}`);expect(html).toContain('role="status"');expect(html).toContain(locale==="fr"?"brouillons restent privés":"المسودات الجديدة خاصة");});
 it("keeps a cached published comparison readable while removing its stale selection action",()=>{
  const html=renderToStaticMarkup(<ComparisonPanel locale="fr" requestId={request} rfqId={rfq} messages={getClientRfqMessages("fr")} canManage initialComparison={{snapshotId:rfq,rfqId:rfq,normalizationVersion:"v1",currency:"MAD",createdAt:"2026-11-02T00:00:00Z",rows:[{quoteId:quote,quoteVersionId:version,versionNumber:1,currency:"MAD",subtotalMinor:"10000",taxMinor:"2000",totalMinor:"12000",recurringSubtotalMinor:"0",durationDays:10,deliverablesCount:1,validUntil:"2027-01-01T00:00:00Z",priceRank:1}]}} nowIso="2026-11-02T00:00:00Z" compareKey={rfq} selectKeys={[rfq]} selectedQuery={`?organizationId=${organization}`} requestTitle="Dossier de recette" requestHref="/fr/client/demandes" revisingQuoteIds={[quote]} offerFacts={{[version]:{quoteVersionId:version,completeness:{basisPoints:10000,checks:[]},deliverables:["Rapport publié V1"],exclusions:[],warranty:"Garantie de recette"}}}/>);
  expect(html).toContain("Rapport publié V1");expect(html).toContain("révisions en préparation");expect(html).toContain("cette version publiée reste consultable");expect(html).not.toContain('name="selectionReason"');expect(html).toContain(`versionId=${version}`);
 });
});
