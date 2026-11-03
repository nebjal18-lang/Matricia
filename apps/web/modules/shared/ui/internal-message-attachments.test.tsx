import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {MessageAttachments} from "./internal-message-attachments";
const id="11111111-1111-4111-8111-111111111111";
describe("message attachment readiness labels",()=>{
 it("does not make a malware CLEAN verdict equivalent to a private download authorization",()=>{const html=renderToStaticMarkup(<MessageAttachments locale="fr" attachments={[{id,name:"preuve.pdf",scan_status:"CLEAN",download_ready:false}]}/>);expect(html).not.toContain('href=');expect(html).toContain("autorisation manquante");});
 it("offers the authenticated byte route only for native download_ready, without a storage URL",()=>{const html=renderToStaticMarkup(<MessageAttachments locale="ar" attachments={[{id,name:"وثيقة.pdf",scan_status:"CLEAN",download_ready:true}]}/>);expect(html).toContain(`/api/internal-messages/attachments/${id}`);expect(html).not.toContain("storage/v1");expect(html).toContain("تنزيل");});
 it("labels rejected attachments truthfully and leaves them unavailable",()=>{const html=renderToStaticMarkup(<MessageAttachments locale="fr" attachments={[{id,name:"bad.pdf",scan_status:"REJECTED",download_ready:false}]}/>);expect(html).toContain("Pièce rejetée");expect(html).not.toContain('href=');});
});
