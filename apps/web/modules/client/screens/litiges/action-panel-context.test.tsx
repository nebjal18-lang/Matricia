import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it,vi}from"vitest";
vi.mock("./actions",()=>({activateAction:vi.fn(),appealAction:vi.fn(),approveAction:vi.fn(),decideAction:vi.fn(),proposeAction:vi.fn(),respondAction:vi.fn()}));
import{ActionPanel}from"./action-panel";
import{getDisputeMessages}from"./messages";
import type{DisputeDetail}from"@/modules/shared/lib/disputes/model";
const id="fa349000-0000-4000-8000-000000000001";
describe("Provider/Client dispute action context",()=>{
 it.each(["fr","ar"] as const)("passes authorized canonical proof choices and actual locale into both forms (%s)",(locale)=>{
  const d={id,capabilities:{respond:true,appeal:true},evidenceOptions:{organizationId:id,party:"provider",documents:[{id,name:"Pièce libre محفوظ"}],messages:[{id,name:"Message libre محفوظ"}],deliveries:[{id,name:"Livraison libre محفوظ",version:2}]}}as unknown as DisputeDetail;
  const html=renderToStaticMarkup(<ActionPanel locale={locale} d={d} m={getDisputeMessages(locale)} keys={{respond:id,appeal:id}}/>);
  expect(html.match(/name="documentId"/g)).toHaveLength(2);expect(html.match(/name="sourceMessageId"/g)).toHaveLength(2);expect(html.match(/name="deliveryProofId"/g)).toHaveLength(2);expect(html.match(/name="evidenceOrganizationId"/g)).toHaveLength(2);expect(html.match(/name="confirmDocumentSharing"/g)).toHaveLength(2);expect(html).toContain(locale==="ar"?"وثائق الخزنة المتحقق منها":"Pièces vérifiées du coffre");expect(html).toContain("Pièce libre محفوظ");expect(html).not.toContain('name="evidenceHash"');
 });
 it("translates pricing and candidate system states while retaining the human organization name",()=>{
  const d={id,capabilities:{propose:true},reassignment:{id,rowVersion:1,originalCostMinor:"125050",currency:"MAD"},candidates:[{organizationId:id,displayName:"Entreprise libre محفوظ",qualificationStatus:"VERIFIED",capacityStatus:"AVAILABLE"}]}as unknown as DisputeDetail;
  const html=renderToStaticMarkup(<ActionPanel locale="ar" d={d} m={getDisputeMessages("ar")} keys={{propose:id}}/>);
  expect(html).toContain("تعريفة اتفاقية الإطار");expect(html).toContain("عرض سعر جديد");expect(html).toContain("تأهيل معتمد");expect(html).toContain("Entreprise libre محفوظ");expect(html).not.toContain('>FRAMEWORK_RATE<');expect(html).not.toContain('>NEW_QUOTE<');
 });
});
