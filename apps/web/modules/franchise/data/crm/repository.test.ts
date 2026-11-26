import {describe,expect,it,vi} from "vitest";
const access=vi.hoisted(()=>vi.fn());
vi.mock("@/modules/shared/lib/account-security/platform-access",()=>({loadMyPlatformAccess:access}));
import {loadFranchiseCrm} from "./repository";
const id=(n:number)=>`e0360000-0000-4000-8000-${String(n).padStart(12,"0")}`;
function setup(deliveryMode:string|null){
 const rows:Record<string,unknown[]>={
  organization_memberships:[{organization_id:id(2),organization_member_roles:[{role_code:"FRANCHISE_OWNER",revoked_at:null}]}],
  franchises:[{id:id(3),operator_organization_id:id(2),franchise_type:"STANDARD",operator_code:"FRANCHISEE"}],
  franchise_crm_prospects:[{id:id(4),linked_organization_id:null,created_at:"2026-11-23T00:00:00Z",franchise_id:id(3),territory_version_id:id(5),prospect_type:"CLIENT",display_name:"Contact",contact_email:"contact@example.invalid",organization_name:null,source_code:"INVITE",pipeline_stage:"SENT",next_followup_at:null,row_version:1}],
  franchise_network_invitations:[{id:id(6),prospect_id:id(4),status:"QUEUED",delivery_mode:deliveryMode,expires_at:"2026-12-23T00:00:00Z",sent_at:null}],
 };
 const client={rpc:vi.fn(async()=>({data:{read:true,write:true},error:null})),from:(table:string)=>{
  const query={select:()=>query,match:()=>query,in:()=>query,eq:()=>query,order:()=>query,range:async(from:number,to:number)=>({data:(rows[table]??[]).slice(from,to+1),error:null})};return query;
 }};
 access.mockResolvedValue({status:"success",client,userId:id(1),requirementSatisfied:true,roles:new Set<string>()});
}
describe("franchise CRM invitation loading",()=>{
 it.each([null,"EXTERNAL","NON_CONTRACTUAL_DEMO"])("keeps a queued invitation visible with delivery mode %s",async mode=>{
  setup(mode);const result=await loadFranchiseCrm(id(3));expect(result.status).toBe("success");
  if(result.status!=="success")throw new Error("CRM_DASHBOARD_REQUIRED");
  expect(result.dashboard.prospects[0]?.invitation).toEqual({id:id(6),status:"QUEUED",deliveryMode:mode,expiresAt:"2026-12-23T00:00:00Z",sentAt:null});
 });
 it("still rejects unknown delivery modes",async()=>{setup("UNKNOWN");expect(await loadFranchiseCrm(id(3))).toEqual({status:"error",reason:"INVALID_RESPONSE"});});
});
