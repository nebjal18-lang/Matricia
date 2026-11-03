import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({from:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:"actor"}},error:null})},from:mocks.from})}));
import{loadDiagnosticsEvolution}from"./repository";
const uid=(n:number)=>`a0000000-0000-4000-8000-${n.toString(16).padStart(12,"0")}`,org=uid(1),library=uid(2);
function backend(failLater=false){
 const runs=Array.from({length:535},(_,i)=>({id:uid(100+i),organization_id:org,library_id:library,overall_score:String(i===0?100:0),rating:"GOOD",status:"COMPLETED",completed_at:new Date(Date.UTC(2026,9,31,12)-i*1000).toISOString(),scoring_policy_snapshot:{basis:i===0||i===534?"compatible-old":"different"}}));
 const tables:Record<string,unknown[]>={organization_memberships:[{id:uid(3),organization_id:org}],organization_member_roles:[{membership_id:uid(3),role_code:"CLIENT_OWNER"}],diagnostic_runs:runs,diagnostic_anomalies:Array.from({length:2201},()=>({diagnostic_run_id:runs[0]!.id,severity:"CRITICAL",status:"OPEN"})),catalog_libraries:[{id:library,code:"EVO"}]};
 mocks.from.mockImplementation((table:string)=>{let start=0,end=499,records=tables[table]??[];const chain:Record<string,unknown>={};for(const method of["select","eq","is","order"])chain[method]=vi.fn(()=>chain);chain.in=vi.fn((field:string,ids:string[])=>{if(field==="diagnostic_run_id")records=records.filter(row=>ids.includes((row as{diagnostic_run_id:string}).diagnostic_run_id));return chain;});chain.range=vi.fn((from:number,to:number)=>{start=from;end=to;return chain;});chain.then=(resolve:(value:unknown)=>unknown)=>resolve(failLater&&table==="diagnostic_runs"&&start===500?{data:null,error:{code:"NETWORK"}}:{data:records.slice(start,end+1),error:null});return chain;});
}
beforeEach(()=>mocks.from.mockReset());
describe("complete evolution series",()=>{
 it("compares with the compatible predecessor beyond200 runs and counts anomalies beyond2000",async()=>{backend();const result=await loadDiagnosticsEvolution(org);expect(result.status).toBe("success");if(result.status!=="success")return;expect(result.value.truncated).toBe(false);expect(result.value.series[0]?.points).toHaveLength(535);expect(result.value.series[0]?.points[0]).toMatchObject({deltaHundredths:10000,openAnomalies:2201,criticalAnomalies:2201});});
 it("never returns a partially loaded positive summary if a later transport page fails",async()=>{backend(true);expect(await loadDiagnosticsEvolution(org)).toEqual({status:"error",reason:"UNAVAILABLE"});});
});
