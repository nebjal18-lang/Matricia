import { describe,expect,it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PerformanceBoard } from "@/modules/franchise/screens/spaces/boards";
import { emptyFranchiseSpaces } from "./live";
import { supervisionMetrics } from "./metrics";
const id="11111111-1111-4111-8111-111111111111";
describe("measured franchise performance",()=>{
 it("uses actual completed missions, availability and provider organization attribution",()=>{
  const board=emptyFranchiseSpaces("fr","");board.metrics=supervisionMetrics.parse({methodologyVersion:"FRANCHISE_SUPERVISION_V1",grain:"LIBRARY_ALL_HISTORY",franchiseId:id,libraryId:id,asOf:"2026-10-31T12:00:00Z",requestCount:251,conversionDenominator:10,convertedRequests:2,missionCount:2,completedMissions:1,capacityProviders:2,availableProviders:0,responseAverageSeconds:3600,qualitySnapshot:{scoreBasisPoints:6700,modelVersion:"MEASURED_V1",periodStart:"2026-01-01",periodEnd:"2026-01-31"},byService:[{id,titleFr:"Service réel",titleAr:"خدمة حقيقية",requests:251}],byProvider:[{organizationId:id,name:"Prestataire attribué",missions:1}]});
  const html=renderToStaticMarkup(<PerformanceBoard locale="fr" query="" board={board}/>);
  expect(html).toContain("1 / 2");expect(html).toContain("Prestataire attribué");expect(html).toContain("Service réel");expect(html).toContain("MEASURED_V1");expect(html).toContain("Conversion : demandes avec prestataire sélectionné / demandes ayant une consultation");
 });
 it("does not turn unavailable metrics into zero counts or substitute CRM objectives",()=>{
  const board=emptyFranchiseSpaces("fr","");board.performance=[{id:"objective",title:"Objectif CRM sans volume",status:"ACTIVE",next:""}];
  const html=renderToStaticMarkup(<PerformanceBoard locale="fr" query="" board={board}/>);
  expect(html).toContain("Mesures indisponibles");expect(html).toContain("Objectif CRM sans volume");expect(html).not.toContain('<td dir="ltr">0</td>');
 });
});
