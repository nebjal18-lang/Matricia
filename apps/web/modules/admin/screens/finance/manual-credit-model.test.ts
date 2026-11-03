import{describe,it,expect}from"vitest";
import{manualCreditRequest,manualCreditOutcome}from"./manual-credit-model";
const org="b2510000-0000-4000-8000-000000000001",wallet="c2510000-0000-4000-8000-000000000001",id="d2510000-0000-4000-8000-000000000001";
const input={walletId:wallet,sourceType:"ADMIN_GRANT",quantity:"9007199254740993",expiresAt:"2027-11-01T12:00:00Z",sourceReference:"TEST_REFERENCE_251",reason:"Synthetic manual gift request for review"};
describe("manual credit grant authority",()=>{
 it("derives the tenant from the selected wallet and excludes fabricated revenue or approval",()=>expect(manualCreditRequest({...input,organizationId:id,revenueValueMinor:"99999",approvalReference:"APPROVED",ruleVersion:"FREE"},[{wallet_id:wallet,organization_id:org}])).toEqual({p_organization_id:org,p_wallet_id:wallet,p_source_type:"ADMIN_GRANT",p_quantity:"9007199254740993",p_expires_at:input.expiresAt,p_library_id:null,p_source_reference:input.sourceReference,p_reason:input.reason}));
 it("rejects a wallet outside the authorized projection",()=>expect(()=>manualCreditRequest(input,[])).toThrow());
 it.each(["SUBSCRIPTION_GRANT","EXTRA_PURCHASE"])("keeps %s on its authoritative native path",sourceType=>expect(()=>manualCreditRequest({...input,sourceType},[{wallet_id:wallet,organization_id:org}])).toThrow());
 it.each(["1e20","9223372036854775808","-1","0"])("rejects invalid exact quantity %s",quantity=>expect(()=>manualCreditRequest({...input,quantity},[{wallet_id:wallet,organization_id:org}])).toThrow());
 it("keeps approval distinct from execution",()=>expect(manualCreditOutcome({outcome:"MANUAL_CREDIT_GRANT_REVIEWED",request_id:id,status:"APPROVED"}).status).toBe("APPROVED"));
 it.each([{outcome:"MANUAL_CREDIT_GRANT_EXECUTED",request_id:id,status:"EXECUTED"},{outcome:"MANUAL_CREDIT_GRANT_REQUESTED",request_id:id,status:"EXECUTED",credit_lot_id:id},{outcome:"MANUAL_CREDIT_GRANT_REVIEWED",request_id:id,status:"PENDING_REVIEW"}])("requires a consistent execution proof %j",result=>expect(()=>manualCreditOutcome(result)).toThrow());
});
