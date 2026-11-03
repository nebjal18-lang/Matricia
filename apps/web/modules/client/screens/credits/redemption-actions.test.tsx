import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it,vi}from"vitest";
import type{Redemption}from"@/modules/shared/lib/credits-wallet/model";
vi.mock("react",async original=>({...await original<typeof import("react")>(),useActionState:()=>[{status:"idle"},()=>{},false]}));
vi.mock("./actions",()=>({consumeAction:vi.fn(),releaseAction:vi.fn()}));
import{RedemptionActions}from"./redemption-actions";
import{messages}from"./messages";
const r:Redemption={id:"a2460000-0000-4000-8000-000000000001",organizationId:"a2460000-0000-4000-8000-000000000002",walletId:"a2460000-0000-4000-8000-000000000003",benefitVersionId:"a2460000-0000-4000-8000-000000000004",units:"1",reservedCredits:"3",status:"DELIVERED",expiresAt:"2026-12-01T00:00:00Z",proofHash:"a".repeat(64),rowVersion:"7"};
describe("accepted benefit receipt",()=>{
 it.each(["fr","ar"]as const)("shows the server receipt and never asks for a browser-created proof (%s)",locale=>{const html=renderToStaticMarkup(<RedemptionActions locale={locale} r={r} m={messages(locale)} keys={{release:"r",consume:"c"}}/>);expect(html).toContain(r.proofHash!);expect(html).toContain(messages(locale).consume);expect(html).not.toContain('name="proofHash"');expect(html).not.toContain('pattern="[0-9a-f]{64}"');});
 it("explains the missing acceptance instead of submitting an invented proof",()=>{const html=renderToStaticMarkup(<RedemptionActions locale="fr" r={{...r,proofHash:null}} m={messages("fr")} keys={{release:"r",consume:"c"}}/>);expect(html).toContain(messages("fr").proofMissing);expect(html).not.toContain('<form');});
});
