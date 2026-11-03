import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),access:vi.fn()}));
vi.mock("@/modules/shared/lib/account-security/platform-access",()=>({loadMyPlatformAccess:mocks.access}));
import{loadFranchiseDashboard}from"./repository";
const snapshot=()=>({complete:true,snapshotAt:"2026-11-01T00:00:00Z",balances:[],fs:[],ls:[],lvs:[],ts:[],ms:[],aps:[],decisions:[],ins:[],rs:[],bs:[],fees:[],cs:[],als:[],ledgers:[],feeLedgers:[]});
beforeEach(()=>{mocks.access.mockReset().mockResolvedValue({status:"ok",requirementSatisfied:true,roles:new Set(["MATRICIA_ADMIN"]),client:{rpc:mocks.rpc}});mocks.rpc.mockReset().mockResolvedValue({data:snapshot(),error:null});});
describe("complete franchise dashboard snapshot",()=>{
 it("reads all domain data from one snapshot with server-validated franchise scope",async()=>{expect((await loadFranchiseDashboard("fr",{franchiseId:"11111111-1111-4111-8111-111111111111"})).status).toBe("success");expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("franchise_governance_dashboard_snapshot",{p_franchise_id:"11111111-1111-4111-8111-111111111111"});});
 it("never presents a budget failure or unavailable snapshot as an empty healthy dashboard",async()=>{mocks.rpc.mockResolvedValue({data:null,error:{code:"54000"}});expect(await loadFranchiseDashboard("fr")).toEqual({status:"error",reason:"QUERY_FAILED"});});
 it("rejects partial snapshots explicitly",async()=>{mocks.rpc.mockResolvedValue({data:{...snapshot(),complete:false},error:null});expect(await loadFranchiseDashboard("ar")).toEqual({status:"error",reason:"INVALID_RESPONSE"});});
 it("preserves large exact monetary strings in the snapshot",async()=>{const data=snapshot();const id="11111111-1111-4111-8111-111111111111";mocks.rpc.mockResolvedValue({data:{...data,bs:[{id,library_id:id,franchise_organization_id:id,franchise_type:"STANDARD",operator_code:"FRANCHISEE",currency:"MAD",opened_under_rule_version_id:id,status:"OPEN"}],balances:[{book_id:id,beneficiary_code:"FRANCHISEE",balance_minor:"9007199254740993"}],ledgers:[{id:"9007199254740995",book_id:id,closure_version_id:null,beneficiary_code:"FRANCHISEE",entry_type:"ACCRUAL",amount_minor:"9007199254740993",reference_type:"TEST",reference_id:"one",proof_hash:null,created_at:"2026-11-01"}]},error:null});const result=await loadFranchiseDashboard("fr");expect(result.status).toBe("success");if(result.status!=="success")return;expect(result.dashboard.books[0]?.balances[0]?.amountMinor).toBe("9007199254740993");expect(result.dashboard.books[0]?.ledgerEntries[0]?.id).toBe("9007199254740995");});
});


describe("governance read prerequisites",()=>{
 it("asks a permitted platform reader for MFA before the snapshot instead of a technical failure",async()=>{
  mocks.access.mockResolvedValue({status:"ok",roles:new Set(["FINANCE_MANAGER"]),requirementSatisfied:false,client:{rpc:mocks.rpc}});
  expect(await loadFranchiseDashboard("fr")).toEqual({status:"error",reason:"MFA_REQUIRED"}); expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("retains a scoped franchise read at AAL1 when no platform security requirement applies",async()=>{
  mocks.access.mockResolvedValue({status:"ok",roles:new Set(),requirementSatisfied:true,client:{rpc:mocks.rpc}});
  const id="11111111-1111-4111-8111-111111111111";
  mocks.rpc.mockResolvedValue({data:{...snapshot(),fs:[{id,library_id:id,operator_organization_id:id,franchise_type:"STANDARD",operator_code:"FRANCHISEE",territory_code:"TEST",status:"ACTIVE",current_mandate_version_id:null,row_version:1}]},error:null});
  const result=await loadFranchiseDashboard("ar",{franchiseId:id}); expect(result.status).toBe("success"); if(result.status==="success"){expect(result.dashboard.canApprove).toBe(false);expect(result.dashboard.canManageFinance).toBe(false);}
 });
 it("does not convert an unrelated platform role and an empty RLS result into an authorized empty dashboard",async()=>{
  mocks.access.mockResolvedValue({status:"ok",roles:new Set(["SUPPORT_MANAGER"]),requirementSatisfied:true,client:{rpc:mocks.rpc}});
  expect(await loadFranchiseDashboard("fr")).toEqual({status:"error",reason:"FORBIDDEN"});
 });
 it("keeps a genuine server denial and a transport incident distinct",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"FRANCHISE_DASHBOARD_SCOPE_DENIED"}});
  expect(await loadFranchiseDashboard("fr")).toEqual({status:"error",reason:"FORBIDDEN"});
  mocks.rpc.mockRejectedValue(new Error("transport unavailable"));
  expect(await loadFranchiseDashboard("fr")).toEqual({status:"error",reason:"QUERY_FAILED"});
 });
 it.each(["UNAUTHENTICATED","QUERY_FAILED","INVALID_RESPONSE"])("preserves security reader %s without a snapshot",async reason=>{
  mocks.access.mockResolvedValue({status:"error",reason});
  expect(await loadFranchiseDashboard("fr")).toEqual({status:"error",reason}); expect(mocks.rpc).not.toHaveBeenCalled();
 });
});

describe("mandate basis evidence",()=>{
 it("does not turn a pre-binding server response into a healthy certification",async()=>{
  const result=await loadFranchiseDashboard("fr");expect(result.status).toBe("success");
  if(result.status==="success")expect(result.dashboard.bookBindingReviewRequired).toBeNull();
 });
 it.each([true,false])("preserves an explicit server review flag %s and its book mandate",async flag=>{
  const id="11111111-1111-4111-8111-111111111111";
  mocks.rpc.mockResolvedValue({data:{...snapshot(),bookBindingReviewRequired:flag,bs:[{id,franchise_id:id,binding_review_required:flag,library_id:id,franchise_organization_id:id,franchise_type:"STANDARD",operator_code:"FRANCHISEE",currency:"MAD",opened_under_rule_version_id:id,status:"OPEN"}]},error:null});
  const result=await loadFranchiseDashboard("fr");expect(result.status).toBe("success");
  if(result.status==="success"){expect(result.dashboard.bookBindingReviewRequired).toBe(flag);expect(result.dashboard.books[0]).toMatchObject({franchiseId:id,bindingReviewRequired:flag});}
 });
 it("rejects a malformed certification rather than coercing it",async()=>{
  mocks.rpc.mockResolvedValue({data:{...snapshot(),bookBindingReviewRequired:"false"},error:null});
  expect(await loadFranchiseDashboard("ar")).toEqual({status:"error",reason:"INVALID_RESPONSE"});
 });
});

describe("entry fee execution basis",()=>{
 const id="11111111-1111-4111-8111-111111111111";
 const book={id,library_id:id,franchise_organization_id:id,franchise_type:"STANDARD",operator_code:"FRANCHISEE",currency:"MAD",opened_under_rule_version_id:id,status:"OPEN"};
 const fee={id,book_id:id,mode:"UPFRONT",principal_minor:"100000",deposit_minor:"100000",starts_on:"2026-11-03",due_on:"2026-11-03"};
 it("keeps an older schedule legally uncertified",async()=>{
  mocks.rpc.mockResolvedValue({data:{...snapshot(),bs:[book],fees:[fee]},error:null});const result=await loadFranchiseDashboard("fr");expect(result.status).toBe("success");
  if(result.status==="success")expect(result.dashboard.books[0]?.entryFee).toMatchObject({executionMode:null,executionEnvironment:null});
 });
 it("carries an explicitly non-contractual development schedule to the interface",async()=>{
  mocks.rpc.mockResolvedValue({data:{...snapshot(),bs:[book],fees:[{...fee,execution_mode:"NON_CONTRACTUAL_DEMO",execution_environment:"DEVELOPMENT"}]},error:null});const result=await loadFranchiseDashboard("ar");expect(result.status).toBe("success");
  if(result.status==="success")expect(result.dashboard.books[0]?.entryFee).toMatchObject({executionMode:"NON_CONTRACTUAL_DEMO",executionEnvironment:"DEVELOPMENT"});
 });
 it("rejects a non-contractual production debt response",async()=>{
  mocks.rpc.mockResolvedValue({data:{...snapshot(),bs:[book],fees:[{...fee,execution_mode:"NON_CONTRACTUAL_DEMO",execution_environment:"PRODUCTION"}]},error:null});expect(await loadFranchiseDashboard("fr")).toEqual({status:"error",reason:"INVALID_RESPONSE"});
 });
});
