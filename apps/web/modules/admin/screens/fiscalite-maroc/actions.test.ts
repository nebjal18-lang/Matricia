import {beforeEach,describe,expect,it,vi} from "vitest";
const {rpc,getUser}=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser},rpc})}));
import {decideTaxRule,proposeTaxRule} from "./actions";
const id="11111111-1111-4111-8111-111111111111";
const initial={status:"idle"}as const;
function proposal(context="PLATFORM"){
 const f=new FormData();for(const[k,v]of Object.entries({locale:"fr",contextKind:context,categoryCode:"SERVICE",ruleType:"VAT",rateBasisPoints:"2000",priority:"100",legalReference:"TEST professional reference",effectiveFrom:"2026-01-01",effectiveTo:"",changeReason:"TEST explicit fiscal rule proposal",idempotencyKey:id}))f.set(k,v);return f;
}
describe("Admin fiscal context",()=>{
 beforeEach(()=>{vi.clearAllMocks();getUser.mockResolvedValue({data:{user:{id}}});rpc.mockResolvedValue({data:{outcome:"MOROCCO_TAX_RULE_PROPOSED"},error:null});});
 it("passes a global audit context without an organization",async()=>{const result=await proposeTaxRule(initial,proposal());expect(result.status).toBe("success");expect(rpc).toHaveBeenCalledWith("propose_morocco_tax_rule",expect.objectContaining({p_audit_organization_id:null}));});
 it("preserves an explicitly selected organization context",async()=>{const form=proposal("ORGANIZATION");form.set("organizationId",id);await proposeTaxRule(initial,form);expect(rpc).toHaveBeenCalledWith("propose_morocco_tax_rule",expect.objectContaining({p_audit_organization_id:id}));});
 it("never infers a scope for legacy forms missing context",async()=>{const form=proposal();form.delete("contextKind");expect(await proposeTaxRule(initial,form)).toEqual({status:"error",reason:"VALIDATION"});expect(rpc).not.toHaveBeenCalled();});
 it("rejects contradictory global and organization fields",async()=>{const form=proposal();form.set("organizationId",id);expect(await proposeTaxRule(initial,form)).toEqual({status:"error",reason:"VALIDATION"});expect(rpc).not.toHaveBeenCalled();});
 it("requires the explicit organization identifier in organization mode",async()=>{expect(await proposeTaxRule(initial,proposal("ORGANIZATION"))).toEqual({status:"error",reason:"VALIDATION"});expect(rpc).not.toHaveBeenCalled();});
 it("preserves global context for an independent rule decision",async()=>{const f=new FormData();for(const[k,v]of Object.entries({locale:"ar",contextKind:"PLATFORM",taxRuleVersionId:id,decision:"APPROVE",professionalValidationStatus:"VALIDATED",validationReference:"TEST-REVIEW",reason:"TEST independent accountant review",rowVersion:"1",idempotencyKey:id}))f.set(k,v);expect((await decideTaxRule(initial,f)).status).toBe("success");expect(rpc).toHaveBeenCalledWith("decide_morocco_tax_rule",expect.objectContaining({p_audit_organization_id:null,p_tax_rule_version_id:id}));});
 it("does not submit an unauthenticated global mutation",async()=>{getUser.mockResolvedValue({data:{user:null}});expect(await proposeTaxRule(initial,proposal())).toEqual({status:"error",reason:"UNAUTHENTICATED"});expect(rpc).not.toHaveBeenCalled();});
});
