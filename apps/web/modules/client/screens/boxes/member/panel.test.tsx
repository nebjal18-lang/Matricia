import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it}from"vitest";
import{MemberBoxPanel}from"./panel";
import type{MemberBoxWorkspace}from"./model";
import{buildClientUtilityNav}from"@/modules/client/ui/client-nav";
const org="a3300000-0000-4000-8000-000000000001";
const data:MemberBoxWorkspace={organization_id:org,aal2:true,next:null,boxes:[{id:"a3300000-0000-4000-8000-000000000002",name_fr:"Box de test",name_ar:"صندوق الاختبار",period_start:"2026-11-02T00:00:00Z",period_end:"2026-12-02T00:00:00Z",funding_ready:true,credit_limit:"3",used:"0",available:"3",benefits:[{id:"a3300000-0000-4000-8000-000000000003",name_fr:"Prestation de test",name_ar:"خدمة الاختبار",credit_cost:"3"}],redemptions:[]}]};
describe("member Box workspace",()=>{
 it.each(["fr","ar"]as const)("presents scoped choices without exposing the general wallet in %s",locale=>{const html=renderToStaticMarkup(<MemberBoxPanel locale={locale}data={data}/>);expect(html).toContain(locale==="ar"?"خدمة الاختبار":"Prestation de test");expect(html).toContain('name="boxId"');expect(html).not.toContain('name="walletId"');expect(html).not.toContain('name="creditLimit"');expect(html).toContain("avantages/remboursements");});
 it("keeps an unallocated state truthful and actionable",()=>{const html=renderToStaticMarkup(<MemberBoxPanel locale="fr"data={{...data,boxes:[]}}/>);expect(html).toContain("Aucune enveloppe ne vous est attribuée");expect(html).toContain("organisation/roles?organizationId=");});
 it("shows step-up and funding requirements before reserving",()=>{const html=renderToStaticMarkup(<MemberBoxPanel locale="fr"data={{...data,aal2:false,boxes:data.boxes.map(b=>({...b,funding_ready:false}))}}/>);expect(html).toContain("second facteur");expect(html).toContain("financement");expect(html).toContain("disabled");});
 it.each(["fr","ar"]as const)("makes the member workspace discoverable without losing its tenant in %s",locale=>{const link=buildClientUtilityNav({locale,selectedQuery:`?organizationId=${org}`}).find(item=>item.key==="memberBoxes");expect(link?.href).toBe(`/${locale}/client/boxes/mon-enveloppe?organizationId=${org}`);expect(link?.label).toBe(locale==="ar"?"مخصصاتي في الصندوق":"Mon enveloppe Box");});
});
