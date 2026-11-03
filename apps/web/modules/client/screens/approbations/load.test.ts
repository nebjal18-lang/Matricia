import {beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({response:{data:[] as unknown,error:null as null|{code:string}},ranges:[] as number[][],orgs:[] as string[]}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc:async()=>({data:[],error:null}),from:()=>{const q={select:()=>q,eq:(key:string,value:string)=>{if(key==="organization_id")mock.orgs.push(value);return q;},order:()=>q,range:async(from:number,to:number)=>{mock.ranges.push([from,to]);return mock.response;}};return q;}})}));
import {loadClientApprovals} from "./load";
const id=(i:number)=>`a3270000-0000-4000-8000-${String(i).padStart(12,"0")}`;
const row=(i:number)=>({id:id(i),status:"PENDING",row_version:1,resource_type:"QUOTE_SELECTION",resource_id:id(999),amount_minor:"9007199254740993123",currency:"MAD",requested_at:"2026-11-02T10:00:00Z"});
beforeEach(()=>{mock.response={data:[],error:null};mock.ranges=[];mock.orgs=[];});
describe("Client approval history",()=>{
 it("distinguishes missing context, successful empty, access refusal and incident",async()=>{
  expect(await loadClientApprovals(null)).toEqual({status:"organization_required"});
  expect(await loadClientApprovals(id(1))).toEqual({status:"success",items:[],page:1,hasNext:false});
  mock.response={data:null,error:{code:"42501"}};expect(await loadClientApprovals(id(1))).toEqual({status:"forbidden"});
  mock.response={data:null,error:{code:"08006"}};expect(await loadClientApprovals(id(1))).toEqual({status:"unavailable"});
 });
 it("pages scoped rows with a lookahead and retains exact bigint text",async()=>{
  mock.response.data=Array.from({length:26},(_,i)=>row(i+1));
  const result=await loadClientApprovals(id(40),3);
  expect(mock.ranges).toEqual([[50,75]]);expect(mock.orgs).toEqual([id(40)]);
  expect(result.status).toBe("success");if(result.status!=="success")return;
  expect(result.items).toHaveLength(25);expect(result.hasNext).toBe(true);expect(result.items[0]?.amountMinor).toBe("9007199254740993123");
 });
 it("refuses an already rounded numeric response and accepts cancelled history",async()=>{
  mock.response.data=[{...row(1),amount_minor:9007199254740992}];expect(await loadClientApprovals(id(40))).toEqual({status:"unavailable"});
  mock.response.data=[{...row(1),status:"CANCELLED"}];const result=await loadClientApprovals(id(40));expect(result.status).toBe("success");
 });
});
