import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),rpc:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},from:mocks.from,rpc:mocks.rpc})}));
import{loadContractMissions}from"./repository";
function query(result:{data:unknown;error:unknown}){const chain:Record<string,unknown>={};for(const method of["select","eq","is","in","order","limit","range"])chain[method]=vi.fn(()=>chain);chain.maybeSingle=vi.fn(async()=>result);chain.then=(resolve:(v:unknown)=>unknown)=>resolve(result);return chain}
describe("client contract mission repository",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.rpc.mockResolvedValue({data:[],error:null});mocks.getUser.mockResolvedValue({data:{user:{id:"11111111-1111-4111-8111-111111111111"}}})});
 it("fails before every query when the session is missing",async()=>{mocks.getUser.mockResolvedValue({data:{user:null}});await expect(loadContractMissions("fr")).resolves.toEqual({status:"error",reason:"UNAUTHENTICATED"});expect(mocks.from).not.toHaveBeenCalled()});
 it("rejects a malformed membership response instead of widening tenant scope",async()=>{mocks.from.mockReturnValue(query({data:{organization_id:"not-a-uuid",organizations:{display_name:"Client"}},error:null}));await expect(loadContractMissions("fr")).resolves.toEqual({status:"error",reason:"INVALID_RESPONSE"});expect(mocks.from).toHaveBeenCalledTimes(1)});
 it("fails closed on a membership query error",async()=>{mocks.from.mockReturnValue(query({data:null,error:{code:"42501"}}));await expect(loadContractMissions("ar")).resolves.toEqual({status:"error",reason:"QUERY_FAILED"})});
 it("rejects a forged organization without falling back to an authorized tenant",async()=>{mocks.from.mockReturnValue(query({data:[{organization_id:"22222222-2222-4222-8222-222222222222",organizations:{display_name:"Client A"}}],error:null}));await expect(loadContractMissions("fr","33333333-3333-4333-8333-333333333333")).resolves.toEqual({status:"error",reason:"FORBIDDEN_ORGANIZATION"});expect(mocks.from).toHaveBeenCalledTimes(1)});
 it("requires a selection when two client organizations are authorized",async()=>{mocks.from.mockReturnValue(query({data:[{organization_id:"22222222-2222-4222-8222-222222222222",organizations:{display_name:"Client A"}},{organization_id:"33333333-3333-4333-8333-333333333333",organizations:{display_name:"Client B"}}],error:null}));await expect(loadContractMissions("fr")).resolves.toEqual({status:"error",reason:"ORGANIZATION_SELECTION_REQUIRED"});expect(mocks.from).toHaveBeenCalledTimes(1)});
});

describe("complete contract graph and frozen business labels",()=>{
 it("keeps an old101st contract,501versions,1001items and1001proofs with bounded scoped queries",async()=>{
  const uid=(n:number)=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,"0")}`,org=uid(1),provider=uid(2),quote=uid(3),rfq=uid(4),requestVersion=uid(5),mission=uid(6),deliverable=uid(7),deliveryVersion=uid(8);
  const contracts=Array.from({length:101},(_,i)=>({id:uid(100+i),provider_organization_id:provider,status:"ACTIVE",current_version:i===0?401:1,row_version:1}));
  const baseVersion={selected_quote_version_id:quote,price_minor:"12000",currency:"MAD",content_hash:"a".repeat(64),change_reason:"Source contractuelle",created_at:"2026-10-31T22:56:00Z"};
  const versions=[...Array.from({length:401},(_,i)=>({...baseVersion,id:uid(1000+i),contract_id:contracts[0]!.id,version:i+1})),...contracts.slice(1).map((c,i)=>({...baseVersion,id:uid(2000+i),contract_id:c.id,version:1}))];
  const currentVersion=versions[400]!.id;
  const tables:Record<string,Record<string,unknown>[]>={organization_memberships:[{organization_id:org,organizations:{display_name:"Client propre"}}],contracts,contract_versions:versions,contract_signatures:[],missions:[{id:mission,contract_id:contracts[0]!.id,contract_version_id:currentVersion,status:"ACTIVE",started_at:null,completed_at:null}],contract_items:Array.from({length:1001},(_,i)=>({id:uid(3000+i),contract_version_id:currentVersion,item_key:`ITEM_${i}`,item_type:"DELIVERABLE",label_fr:`Livrable${i}`,label_ar:`نتيجة${i}`,sort_order:i+1})),mission_milestones:[],deliverables:[{id:deliverable,mission_id:mission,deliverable_key:"REPORT",label_fr:"Rapport",label_ar:"تقرير",status:"SUBMITTED",current_version:1}],acceptance_checklists:[],delivery_versions:[{id:deliveryVersion,deliverable_id:deliverable,version:1}],delivery_proofs:Array.from({length:1001},(_,i)=>({id:uid(5000+i),delivery_version_id:deliveryVersion,scan_status:"CLEAN"})),quote_versions:[{id:quote,rfq_id:rfq}],rfqs:[{id:rfq,request_version_id:requestVersion}],service_request_versions:[{id:requestVersion,client_organization_id:org,description:"Mise en conformité du dossier"}],contract_parties:[{contract_version_id:currentVersion,organization_id:provider,party_role:"PROVIDER",legal_snapshot:{legal_name:"Prestataire figé au contrat"}}]};
  const observed:Array<{table:string;ids:string[]}> = [];
  mocks.rpc.mockImplementation(async(_name,args)=>({error:null,data:args.p_contract_ids.map((contract_id:string)=>({contract_id,ready:false,status:"NOT_CONFIGURED",environment:"STAGING"}))}));
  mocks.getUser.mockResolvedValue({data:{user:{id:uid(9)}}});
  mocks.from.mockImplementation((table:string)=>{
   let result=tables[table]??[],start=0,end=499;const chain:Record<string,unknown>={};
   for(const method of["select","is","order","limit"])chain[method]=vi.fn(()=>chain);
   chain.eq=vi.fn((column:string,value:unknown)=>{if(result.some(row=>Object.hasOwn(row,column)))result=result.filter(row=>row[column]===value);return chain;});
   chain.in=vi.fn((column:string,ids:string[])=>{observed.push({table,ids});if(result.some(row=>Object.hasOwn(row,column)))result=result.filter(row=>ids.includes(String(row[column])));return chain;});
   chain.range=vi.fn((from:number,to:number)=>{start=from;end=to;return chain;});chain.then=(resolve:(value:unknown)=>unknown)=>resolve({data:result.slice(start,end+1),error:null});return chain;
  });
  const result=await loadContractMissions("fr",org);expect(result.status).toBe("success");if(result.status!=="success")return;
  expect(result.dashboard.contracts).toHaveLength(101);expect(mocks.rpc.mock.calls.every(([,args])=>args.p_contract_ids.length<=100)).toBe(true);expect(result.dashboard.contracts[0]?.signatureReadiness?.status).toBe("NOT_CONFIGURED");expect(result.dashboard.contracts[0]?.history).toHaveLength(401);expect(result.dashboard.contracts[0]?.items).toHaveLength(1001);expect(result.dashboard.contracts[0]?.title).toBe("Mise en conformité du dossier");expect(result.dashboard.contracts[0]?.providerOrganizationName).toBe("Prestataire figé au contrat");expect(result.dashboard.missions[0]?.deliverables[0]?.proofScanStatus).toBe("CLEAN");expect(result.dashboard.missions[0]?.title).toBe("Mise en conformité du dossier");expect(observed.every(call=>call.ids.length<=100)).toBe(true);
 });
});
