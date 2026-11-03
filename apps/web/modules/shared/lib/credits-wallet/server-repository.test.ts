import{beforeEach,describe,expect,it,vi}from"vitest";
const U="a2460000-0000-4000-8000-000000000001",A="a2460000-0000-4000-8000-000000000002",B="a2460000-0000-4000-8000-000000000003",MA="a2460000-0000-4000-8000-000000000004",MB="a2460000-0000-4000-8000-000000000005",W="a2460000-0000-4000-8000-000000000006";
const mocks=vi.hoisted(()=>({client:null as unknown,queries:[]as{table:string;columns:string}[],rpc:vi.fn(async(name:string,args?:Record<string,unknown>)=>({data:name==="list_client_credit_catalog_v1"?{organization_id:args?.p_organization_id,benefits:[],boxes:[]}:[],error:null}))}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>mocks.client}));
import{createServerCreditsRepository}from"./server-repository";
const tables:Record<string,Record<string,unknown>[]>={organization_memberships:[{id:MA,organization_id:A},{id:MB,organization_id:B}],organization_member_roles:[{membership_id:MA,role_code:"CLIENT_OWNER",revoked_at:null},{membership_id:MB,role_code:"CLIENT_VIEWER",revoked_at:null}],organizations:[{id:A,display_name:"Owner organization"},{id:B,display_name:"Selected viewer organization"}],credit_wallets:[{id:W,organization_id:A,unit_code:"MATRICIA_CREDIT"}],credit_wallet_balances:[{wallet_id:W,balance:"900719925474099300000"}]};
class Query{
 private filters:((row:Record<string,unknown>)=>boolean)[]=[];private maximum=Infinity;
 constructor(private table:string){}
 select(columns:string){mocks.queries.push({table:this.table,columns});return this;}
 eq(key:string,value:unknown){this.filters.push(row=>!(key in row)||row[key]===value);return this;}
 in(key:string,values:unknown[]){this.filters.push(row=>!(key in row)||values.includes(row[key]));return this;}
 limit(value:number){this.maximum=value;return this;}
 order(){return this;}
 range(from:number,to:number){this.maximum=to+1;return this;}
 then(fulfilled:(value:{data:Record<string,unknown>[];error:null})=>unknown){return Promise.resolve({data:(tables[this.table]??[]).filter(row=>this.filters.every(test=>test(row))).slice(0,this.maximum),error:null}).then(fulfilled);}
}
beforeEach(()=>{mocks.queries.length=0;mocks.rpc.mockClear();mocks.client={auth:{getUser:async()=>({data:{user:{id:U}}})},from:(table:string)=>new Query(table),rpc:mocks.rpc};});
describe("selected financial workspace",()=>{
 it("does not fall back to an owned wallet when the chosen organization has only viewer access",async()=>{const result=await(await createServerCreditsRepository(B)).load();expect(result).toEqual({status:"error",reason:"FORBIDDEN"});expect(mocks.queries.some(query=>query.table==="credit_wallets")).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();});
 it("loads only the chosen authorized organization and requests exact bigint text",async()=>{const result=await(await createServerCreditsRepository(A)).load();expect(result.status).toBe("success");if(result.status!=="success")return;expect(result.value.organizations).toEqual([{id:A,name:"Owner organization"}]);expect(result.value.wallets[0]?.balance).toBe("900719925474099300000");expect(mocks.rpc).toHaveBeenCalledWith("list_credit_lot_funding_statuses_v1",{p_organization_ids:[A]});expect(mocks.queries).toContainEqual({table:"credit_wallet_balances",columns:"wallet_id,balance::text"});});
});

it("keeps a failed identity service distinct from a missing login",async()=>{mocks.client={auth:{getUser:async()=>({data:{user:null},error:{status:503,name:"AuthRetryableFetchError"}})},from:vi.fn(),rpc:mocks.rpc};expect(await(await createServerCreditsRepository(A)).load()).toEqual({status:"error",reason:"UNAVAILABLE"});expect(mocks.queries).toHaveLength(0);});
