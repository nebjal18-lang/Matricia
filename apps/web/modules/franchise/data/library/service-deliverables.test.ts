import { describe, expect, it } from "vitest";
import { serviceFulfillmentRecordSchema } from "./service-deliverables";
import { serviceDetails } from "./service-details";
describe("native bilingual service deliverables",()=>{
 it("retains approved bilingual labels and legacy free text without translation",()=>{const value={schema_version:1,deliverables:["Ancien texte libre",{label_fr:"Rapport technique",label_ar:"تقرير تقني"}]};expect(serviceFulfillmentRecordSchema.parse(value)).toEqual(value);});
 it.each([null,{},[null],[7],[{label_fr:"FR"}],[{label_fr:"FR",label_ar:" "}],[{label_fr:"FR",label_ar:"AR",extra:"unexpected"}],[{label_fr:"FR",label_ar:7}],["x".repeat(501)]])("rejects malformed deliverables %j at reader and writer",deliverables=>{
  expect(serviceFulfillmentRecordSchema.safeParse({schema_version:1,deliverables}).success).toBe(false);
  expect(serviceDetails({fulfillmentConfig:JSON.stringify({schema_version:1,deliverables})},null,{fr:"FR",ar:"AR"})).toBeNull();
 });
 it("retains old catalogue records that do not define a deliverables array",()=>expect(serviceFulfillmentRecordSchema.parse({standard_deliverables_fr:"Texte source"})).toEqual({standard_deliverables_fr:"Texte source"}));
});
