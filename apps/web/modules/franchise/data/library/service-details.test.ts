import {describe,it,expect} from "vitest";
import {serviceDetails} from "./service-details";
import type {FranchiseServiceCommand} from "./workspace-model";
const existing={serviceType:"ADVISORY",unitLabelFr:"jour",unitLabelAr:"يوم",baseCurrency:"MAD",sortOrder:3,longDescriptionFr:"Texte",longDescriptionAr:"نص",fulfillmentConfig:{deliverables:["legacy"],schema_version:1},visibilityRules:{schema_version:1},creditEligible:true,volumeEligible:true,rfqRequired:true}as unknown as FranchiseServiceCommand;
describe("service details",()=>{
 it("preserves legacy deliverables and does not mutate the source",()=>{const result=serviceDetails({deliverablesFr:"",deliverablesAr:""},existing,{fr:"FR",ar:"AR"});expect(result?.fulfillmentConfig.deliverables).toEqual(["legacy"]);expect(result?.fulfillmentConfig).not.toBe(existing.fulfillmentConfig);});
 it("pairs bilingual deliverables and applies explicit unchecked flags",()=>{const result=serviceDetails({serviceOptionsPresent:"yes",deliverablesFr:"Rapport\nAtelier",deliverablesAr:"تقرير\nورشة",creditEligible:"yes"},existing,{fr:"FR",ar:"AR"});expect(result?.fulfillmentConfig.deliverables).toEqual([{label_fr:"Rapport",label_ar:"تقرير"},{label_fr:"Atelier",label_ar:"ورشة"}]);expect(result?.volumeEligible).toBe(false);expect(existing.fulfillmentConfig.deliverables).toEqual(["legacy"]);});
 it("rejects incomplete bilingual output or malformed configuration",()=>{expect(serviceDetails({deliverablesFr:"Rapport",deliverablesAr:""},existing,{fr:"FR",ar:"AR"})).toBeNull();expect(serviceDetails({visibilityRules:"[]"},existing,{fr:"FR",ar:"AR"})).toBeNull();});
});
