import{renderToStaticMarkup}from"react-dom/server";
import{describe,it,expect,vi}from"vitest";
vi.mock("./actions",()=>({managePrivacy:async()=>({status:"idle"})}));
import{PrivacyPanel}from"./panel";
const id="b2580000-0000-4000-8000-000000000001";
describe("privacy actions reflect actual execution capabilities",()=>{
 it.each(["fr","ar"]as const)("does not offer a false fulfilled action in %s",locale=>{const html=renderToStaticMarkup(<PrivacyPanel locale={locale} requests={["OPPOSITION","CONSENT_WITHDRAWAL","OTHER","ERASURE","RESTRICTION"].map((request_type,i)=>({id:`d2580000-0000-4000-8000-00000000000${i}`,organization_id:id,request_type,status:"IN_REVIEW",due_at:"2026-11-01",row_version:1,export_reference:"TEST_REFERENCE_ONLY"}))} policies={[]} organizations={[{id,display_name:"TEST"}]} keys={Array.from({length:8},(_,i)=>`TEST-${i}`)} retentionActions={[]}/>);expect(html).not.toMatch(/<option[^>]*>FULFILLED<\/option>/u);expect(html).toContain(`/${locale}/administration/confidentialite/restrictions`);expect(html).not.toContain("Preuve d’export générée");expect(html).not.toContain("إثبات تصدير مولد");expect(html).toContain(locale==="fr"?"sans attestation d’exécution":"دون إثبات تنفيذ");});
});
