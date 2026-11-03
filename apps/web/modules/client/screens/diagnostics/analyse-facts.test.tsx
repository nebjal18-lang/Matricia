import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it,vi}from"vitest";
vi.mock("./actions",()=>({opportunityAction:vi.fn()}));
vi.mock("next/link",()=>({default:({href,children,...props}:{href:string;children:React.ReactNode})=><a href={href}{...props}>{children}</a>}));
import{AnalyseDetailleeView}from"./analyse-detaillee-view";
import{messages}from"./messages";
import{reportFixture}from"@/modules/client/data/diagnostic-report/pdf.test-fixture";
describe("actual diagnostic findings",()=>{
 it.each(["fr","ar"]as const)("does not turn the first warning into a strength or invent proof/confidence in %s",locale=>{const detail=reportFixture(),html=renderToStaticMarkup(<AnalyseDetailleeView detail={detail} locale={locale} m={messages(locale)} scopeName="Processus" solutionsHref="/solutions" assistanceHref="/assistance" evolutionHref="/evolution" listHref="/list" decisionKeys={[]}/>);expect(html).not.toContain("Confiance élevée");expect(html).not.toContain("3 preuves");expect(html).not.toContain("ثقة عالية");const title=locale==="fr"?"Vérification du processus":"مراجعة العملية";expect(html.split(title)).toHaveLength(2);expect(html).toContain(`/api/client/diagnostics/${detail.id}/report?locale=${locale}&amp;organizationId=${detail.organizationId}`);expect(html).toContain('href="#diagnostic-snapshot"');expect(html).toContain(`organizationId=${detail.organizationId}&amp;anomalyId=`);});
 it("renders findings past the former six-record cap",()=>{const detail=reportFixture();detail.anomalies=Array.from({length:21},(_,i)=>({...detail.anomalies[0]!,id:`finding-${i}`,titleFr:`ACTUAL_FINDING_${i}`}));const html=renderToStaticMarkup(<AnalyseDetailleeView detail={detail} locale="fr" m={messages("fr")} solutionsHref="/solutions" assistanceHref="/assistance" evolutionHref="/evolution" listHref="/list" decisionKeys={[]}/>);expect(html).toContain("ACTUAL_FINDING_20");expect(html).not.toContain("Confiance élevée");});
});
