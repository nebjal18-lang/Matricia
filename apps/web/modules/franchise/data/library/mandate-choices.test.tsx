import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mandateChoicesSchema,mandateChoiceOptions } from "./mandate-choices";
import { FranchiseMandateSelector } from "@/modules/franchise/ui/franchise-access-state";
const org="22222222-2222-4222-8222-222222222222",lib="44444444-4444-4444-8444-444444444444";
const value={complete:true,items:["33333333-3333-4333-8333-333333333333","33333333-3333-4333-8333-333333333334"].map((id,index)=>({id,organization_id:org,library_id:lib,territory_code:index===0?"TEST_NORD":"TEST_SUD",territory_fr:index===0?"Territoire Nord":"Territoire Sud",territory_ar:index===0?"النطاق الشمالي":"النطاق الجنوبي",library_code:"CATALOGUE_TEST",library_fr:"Catalogue TEST",library_ar:"كتالوج اختبار",roles:[{code:"FRANCHISE_OWNER",label_fr:"Propriétaire franchisé",label_ar:"مالك الامتياز"}]}))};
describe("mandate choices from exact approved descriptors",()=>{
 it.each(["fr","ar"]as const)("renders distinct territories sharing one organization/library in %s",locale=>{
  const options=mandateChoiceOptions(mandateChoicesSchema.parse(value),locale);
  const html=renderToStaticMarkup(<FranchiseMandateSelector locale={locale} mandates={options} organizationId={org} selectedFranchiseId={options[1]!.id} returnPath={`/${locale}/franchise/services`}/>);
  expect(options[0]?.label).not.toBe(options[1]?.label);
  for(const option of options)expect(html).toContain(option.label);
  expect(html).toContain(locale==="ar"?'dir="rtl"':'dir="ltr"');
  expect(html).toContain(`value="${options[1]!.id}" selected=""`);
  expect(html).not.toContain("FRANCHISEE");expect(html).not.toContain("FRANCHISE_OWNER");
 });
 it("does not translate free catalogue labels or substitute another language when the approved territory name is absent",()=>{
  const parsed=mandateChoicesSchema.parse(value);parsed.items[0]!.territory_ar="";
  expect(mandateChoiceOptions(parsed,"ar")[0]?.label).toContain("اسم النطاق غير متوفر");
  expect(mandateChoiceOptions(parsed,"ar")[0]?.label).not.toContain("Territoire Nord");
 });
 it("rejects incomplete/partial descriptor responses instead of inventing identical operator labels",()=>{
  expect(mandateChoicesSchema.safeParse({complete:false,items:value.items}).success).toBe(false);
  expect(mandateChoicesSchema.safeParse({complete:true,items:[{...value.items[0],roles:[]}]}).success).toBe(false);
 });
});
