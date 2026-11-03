import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it,vi}from"vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("./actions",()=>({openThreadAction:vi.fn(),sendMessageAction:vi.fn()}));
import{OpenThreadForm}from"./messaging-forms";
import{getMessagingMessages}from"./messages";
const id="fa352000-0000-4000-8000-000000000001";
describe("Contract and consultation conversation choices",()=>{
 it.each(["fr","ar"]as const)("labels real contract and RFQ options in %s without raw context codes",locale=>{
  const html=renderToStaticMarkup(<OpenThreadForm locale={locale} organizationId={id} m={getMessagingMessages(locale)} options={[{rfqId:id,providerOrganizationId:id,senderOrganizationId:id,label:"internal label",context:"CONTRACT"},{rfqId:"fa352000-0000-4000-8000-000000000002",providerOrganizationId:id,senderOrganizationId:id,label:"internal label",context:"RFQ"}]}/>);
  expect(html).toContain(locale==="ar"?"ملف عقد":"Dossier contractuel");expect(html).toContain(locale==="ar"?"استشارة":"Consultation");expect(html).not.toContain("internal label");expect(html).not.toContain(">CONTRACT<");
 });
});
