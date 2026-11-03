import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it}from"vitest";
import{ReferralStatusPanel}from"./referral-status-panel";
import type{RewardsDashboard}from"@/modules/shared/lib/rewards-referrals-roi/model";
const pending:NonNullable<RewardsDashboard["referralRewardStatuses"]>[number]={approval_id:"a3340000-0000-4000-8000-000000000001",source_event_id:"a3340000-0000-4000-8000-000000000002",rule_version_id:"a3340000-0000-4000-8000-000000000003",rule_code:"TEST_REWARD",state:"APPROVED_PENDING_EXECUTION",quantity:"9007199254740993",decided_at:"2026-11-02T12:00:00Z",granted_at:null};
describe("real Client referral issuance status",()=>{
 it("explains a pending decision without certifying an actual credit",()=>{
  const html=renderToStaticMarkup(<ReferralStatusPanel locale="fr" rows={[pending]}/>);
  expect(html).toContain("Approuvée, crédits en attente d’émission");expect(html).toContain("Cette décision ne crédite pas encore le portefeuille");expect(html).not.toContain("Crédits effectivement émis");expect(html).toContain(new Intl.NumberFormat("fr-MA").format(BigInt(pending.quantity)));
 });
 it("labels an actual grant distinctly in Arabic",()=>{
  const html=renderToStaticMarkup(<ReferralStatusPanel locale="ar" rows={[{...pending,state:"GRANTED",granted_at:"2026-11-02T12:00:01Z"}]}/>);
  expect(html).toContain("تم إصدار الرصيد");expect(html).not.toContain("هذه الموافقة لا تزيد رصيد المحفظة");
 });
 it("distinguishes an unavailable read model from a successful empty result",()=>{
  expect(renderToStaticMarkup(<ReferralStatusPanel locale="fr" rows={undefined}/>)).toContain("ne sont pas disponibles");
  expect(renderToStaticMarkup(<ReferralStatusPanel locale="fr" rows={[]}/>)).toContain("Aucune décision de récompense");
 });
});
