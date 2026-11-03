import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc:mocks.rpc})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import{prepareMerge,decideMerge,recordMergeException}from"./actions";
import{mergeBlockerLabel}from"./model";
const id="a2120000-0000-4000-8000-000000000001",target="a2120000-0000-4000-8000-000000000002",hash="a".repeat(64);
function form(extra:Record<string,string>){const f=new FormData();for(const[k,v]of Object.entries({locale:"fr",key:id,...extra}))f.set(k,v);return f;}
const prepare={source:id,target,contextHash:hash,proof:`PROVIDER:${id}`,legalReference:"Approbation juridique de fixture",reason:"Doublon inutilisé de la même entreprise",confirm:"CONFIRMED"};
beforeEach(()=>{vi.clearAllMocks();});
describe("controlled unused duplicate merge",()=>{
 it("submits a reviewed context and real document reference without identity or money JSON",async()=>{mocks.rpc.mockResolvedValue({data:{outcome:"ORGANIZATION_MERGE_PREPARED",request_id:id},error:null});expect(await prepareMerge({status:"idle"},form(prepare))).toEqual({status:"success",outcome:"ORGANIZATION_MERGE_PREPARED",requestId:id});expect(mocks.rpc).toHaveBeenCalledWith("prepare_organization_merge_v1",{p_source_organization_id:id,p_target_organization_id:target,p_expected_context_hash:hash,p_proof_kind:"PROVIDER",p_proof_id:id,p_legal_reference:prepare.legalReference,p_reason:prepare.reason,p_idempotency_key:id});});
 it("requires explicit confirmation and different organizations before the RPC",async()=>{expect(await prepareMerge({status:"idle"},form({...prepare,source:target}))).toEqual({status:"error",reason:"VALIDATION"});expect(await prepareMerge({status:"idle"},form({...prepare,confirm:""}))).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();});
 it("never equates an unknown command outcome with a completed merge",async()=>{mocks.rpc.mockResolvedValue({data:{outcome:"OK"},error:null});expect(await decideMerge({status:"idle"},form({requestId:id,requestHash:hash,accept:"yes",reason:"Décision indépendante de fixture",confirm:"CONFIRMED"}))).toEqual({status:"error",reason:"UNAVAILABLE"});});
 it.each([["42501","FORBIDDEN"],["40001","CONFLICT"],["55000","EXCEPTION_PLAN"]])("keeps %s as a refusal",async(code,reason)=>{mocks.rpc.mockResolvedValue({data:null,error:{code}});expect(await prepareMerge({status:"idle"},form(prepare))).toEqual({status:"error",reason});});
 it("uses explicit business labels for blocked historical cases in both languages",()=>{expect(mergeBlockerLabel("SOURCE_HISTORY_REQUIRES_ARCHIVE_ACCESS_PLAN","fr")).toContain("historique métier");expect(mergeBlockerLabel("SOURCE_HISTORY_REQUIRES_ARCHIVE_ACCESS_PLAN","ar")).toContain("الأرشيف");expect(mergeBlockerLabel("UNKNOWN","fr")).not.toContain("UNKNOWN");});
});

it("records a blocked case without claiming a completed merge",async()=>{mocks.rpc.mockResolvedValue({data:{outcome:"ORGANIZATION_MERGE_EXCEPTION_RECORDED",case_id:id},error:null});expect(await recordMergeException({status:"idle"},form({source:id,target,contextHash:hash,reason:"Lecture historique à définir avant fusion"}))).toEqual({status:"success",outcome:"ORGANIZATION_MERGE_EXCEPTION_RECORDED",requestId:id});});
