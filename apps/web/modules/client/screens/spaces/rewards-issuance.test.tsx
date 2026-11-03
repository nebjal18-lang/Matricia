import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it}from"vitest";
import{RewardsBoard}from"./rewards-board";
import type{RewardsDashboard}from"@/modules/shared/lib/rewards-referrals-roi/model";
const id="a3340000-0000-4000-8000-000000000001";
const dashboard:RewardsDashboard={organizationId:id,organizationName:"Entreprise test",currentUserId:id,aal:"aal1",canCreateReferral:false,canSubmitBaseline:false,canReviewSensitive:false,canCalculateRoi:false,rules:[],grants:[],links:[],conversions:[{id,referral_link_id:id,source_organization_id:id,target_organization_id:id,conversion_stage:"ACTIVE",origin_snapshot:{},registered_by:id,registered_at:"2026-11-02T12:00:00Z",row_version:4}],conversionEvents:[],sourceEvents:[],approvals:[],submissions:[],decisions:[],baselines:[],roiSnapshots:[],recommendations:[],wallets:[],referralRewardStatuses:[]};
const decision:NonNullable<RewardsDashboard["referralRewardStatuses"]>[number]={approval_id:id,source_event_id:id,rule_version_id:id,rule_code:"TEST_REWARD",state:"APPROVED_PENDING_EXECUTION",quantity:"5",decided_at:"2026-11-02T12:00:00Z",granted_at:null};
describe("reward journey follows real credit issuance",()=>{
 it("does not complete reward step merely because a conversion is ACTIVE",()=>{
  const html=renderToStaticMarkup(<RewardsBoard locale="fr" query="" dashboard={dashboard}/>);
  expect(html).toContain('<li data-state="todo"><span>4</span>');
 });
 it("shows the financial queue while a real decision is pending",()=>{
  const html=renderToStaticMarkup(<RewardsBoard locale="fr" query="" dashboard={{...dashboard,referralRewardStatuses:[decision]}}/>);
  expect(html).toContain('<li data-state="current"><span>4</span>');expect(html).toContain("émission des crédits en attente");
 });
 it("completes the step only with a persisted grant status",()=>{
  const html=renderToStaticMarkup(<RewardsBoard locale="ar" query="" dashboard={{...dashboard,referralRewardStatuses:[{...decision,state:"GRANTED",granted_at:"2026-11-02T12:00:01Z"}]}}/>);
  expect(html).toContain('<li data-state="done"><span>4</span>');expect(html).not.toContain("إصدار الرصيد ينتظر");
 });
});
