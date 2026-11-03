import{describe,expect,it}from"vitest";
import{referralRewardQueueSchema}from"./model";
const row={source_event_id:"a3340000-0000-4000-8000-000000000001",rule_version_id:"a3340000-0000-4000-8000-000000000002",approval_id:null,organization_name:"Entreprise test",referral_code:"TEST_334",audience_type:"REFERRED_CLIENT",rule_code:"TEST_REWARD",rule_version:1,bonus_credits:"9007199254740993",granted_credits:null,occurred_at:"2026-11-02T12:00:00Z",state:"AWAITING_REVIEW",can_decide:true,can_execute:false,blocked_reason:null};
describe("native referral queue contract",()=>{
 it("accepts an undecided source without an invented approval or grant",()=>{
  const parsed=referralRewardQueueSchema.parse({page:1,has_next:false,rows:[row]});
  expect(parsed.rows[0].approval_id).toBeNull();expect(parsed.rows[0].granted_credits).toBeNull();expect(parsed.rows[0].bonus_credits).toBe("9007199254740993");
 });
 it.each([{can_execute:null},{bonus_credits:9007199254740992},{state:"SUCCESS"}])("rejects ambiguous or lossy native response %o",patch=>{
  expect(referralRewardQueueSchema.safeParse({page:1,has_next:false,rows:[{...row,...patch}]}).success).toBe(false);
 });
});
