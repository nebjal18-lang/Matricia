import {describe,it,expect}from"vitest";
import {subscriptionGrantCommand,subscriptionGrantInput}from"./subscription-grant-model";
const org="b2400000-0000-4000-8000-000000000001";
const value={organizationId:org,paymentEventId:"9007199254740993",monthIndex:1};
const context={terms:{payment_event_id:value.paymentEventId,subscription_cycle_id:org,plan_version_id:org,plan_content_hash:"f".repeat(64),grant_month_index:1,grant_period_start:"2026-11-01",grant_period_end:"2026-12-01",quantity:"9007199254740993",expires_at:"2027-01-01",currency:"MAD",revenue_value_minor:"0",revenue_recognition:"ALREADY_RECOGNIZED_IN_SUBSCRIPTION_LEDGER",source_reference:"subscription-payment:9007199254740993:month:1",rule_version:"RULE_TEST",terms_hash:"a".repeat(64),core_allocation_basis_points:6000,benefit_pool_allocation_basis_points:4000,rollover_policy:{rollover_months:2}},wallet_id:org,already_issued:false,legacy_review_required:false,can_issue:true,blocked_reasons:[]};
describe("paid subscription grant command",()=>{
 it("keeps the large payment reference exact and sends no financial override",()=>{expect(subscriptionGrantCommand({...value,quantity:"1",expiry:"2000-01-01",revenue:"999"},context)).toEqual({p_organization_id:org,p_payment_event_id:value.paymentEventId,p_month_index:1,p_expected_terms_hash:"a".repeat(64)});});
 it.each([{...value,paymentEventId:"9223372036854775808"},{...value,paymentEventId:"1e20"},{...value,monthIndex:13},{...value,monthIndex:0}])("rejects invalid source or monthly slot %j",input=>expect(subscriptionGrantInput.safeParse(input).success).toBe(false));
 it.each([{...context,already_issued:true},{...context,legacy_review_required:true},{...context,can_issue:false},{...context,terms:{...context.terms,grant_month_index:2}},{...context,terms:{...context.terms,payment_event_id:"8"}}])("requires the exact usable reviewed context",review=>expect(()=>subscriptionGrantCommand(value,review)).toThrow());
 it("rejects a forged revenue recognition context",()=>expect(()=>subscriptionGrantCommand(value,{...context,terms:{...context.terms,revenue_value_minor:"1"}})).toThrow());
});
