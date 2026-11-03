import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it,vi}from"vitest";
vi.mock("./contract-generation-actions",()=>({generateSelectedQuoteContract:vi.fn()}));
import{ContractGenerationForm}from"./contract-generation-form";
const uid="a2580000-0000-4000-8000-000000000001",base={organizationId:uid,requestId:uid,quoteVersionId:uid,requestRowVersion:1,canGenerate:true,idempotencyKey:uid};
describe("Client selected quote contract form",()=>{
 it("keeps missing approved legal and financial conditions explicit without a fake draft",()=>{const html=renderToStaticMarkup(<ContractGenerationForm {...base} locale="fr" templates={[]} policies={[]}/>);expect(html).toContain("Aucune version de conditions contractuelles approuvée");expect(html).toContain("conditions financières applicables");expect(html).toContain('disabled=""');expect(html).not.toContain("a été créé");expect(html).not.toContain("JSON");});
 it("presents approved localized conditions in Arabic and references rather than JSON",()=>{const html=renderToStaticMarkup(<ContractGenerationForm {...base} locale="ar" templates={[{id:uid,code:"TEMPLATE",version:2,title_fr:"Conditions approuvées",title_ar:"شروط معتمدة"}]} policies={[{id:uid,code:"COMMISSION",version:1,basis_points:750}]}/>);expect(html).toContain("شروط معتمدة");expect(html).not.toContain("7.50%");expect(html).toContain('name="commissionPolicyVersionId"');expect(html).not.toContain('<select name="commissionPolicyVersionId"');expect(html).not.toContain('name="priceMinor"');expect(html).not.toContain('name="providerSnapshot"');});
});
