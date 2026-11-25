import { describe, expect, it, vi } from "vitest";
import { collectOperationIds, collectOperationPages } from "./paging";

describe("complete bounded franchise operation lists",()=>{
 it("refuses an oversized history without returning its first 5000 rows",async()=>{
  const query=vi.fn(async(from:number,to:number)=>({data:Array.from({length:to-from+1},(_,i)=>from+i),error:null}));
  expect(await collectOperationPages(query)).toEqual({data:[],error:{code:"READ_LIMIT_EXCEEDED"}});
  expect(query).toHaveBeenCalledTimes(51);
  expect(query).toHaveBeenLastCalledWith(5000,5000);
 });
 it("accepts exactly 5000 rows after checking the empty sentinel",async()=>{
  const result=await collectOperationPages(async(from,to)=>({data:Array.from({length:Math.max(0,Math.min(to+1,5000)-from)},(_,i)=>from+i),error:null}));
  expect(result.error).toBeNull();expect(result.data).toHaveLength(5000);
 });
 it("shares the row budget across parent batches",async()=>{
  const query=vi.fn(async(group:string[],from:number,to:number)=>({data:Array.from({length:Math.max(0,Math.min(to+1,3000)-from)},(_,i)=>`${group[0]}:${from+i}`),error:null}));
  expect(await collectOperationIds(Array.from({length:81},(_,i)=>String(i)),query)).toEqual({data:[],error:{code:"READ_LIMIT_EXCEEDED"}});
  expect(query.mock.calls.length).toBeLessThanOrEqual(52);
 });
 it("rejects excessive parent scope before querying and deduplicates it",async()=>{
  const query=vi.fn(async(group:string[])=>({data:group,error:null}));
  expect((await collectOperationIds(Array.from({length:5001},(_,i)=>String(i)),query)).error).toEqual({code:"READ_LIMIT_EXCEEDED"});
  expect(query).not.toHaveBeenCalled();
  expect(await collectOperationIds(["a","a"],query)).toEqual({data:["a"],error:null});
 });
 it("does not retain successful early pages after a later page fails",async()=>{
  const error={code:"08006"};
  const result=await collectOperationPages(async(from)=>from===0?{data:Array.from({length:100},(_,id)=>id),error:null}:{data:null,error});
  expect(result).toEqual({data:[],error});
 });
 it("treats a missing payload as an incident, distinct from an empty successful page",async()=>{
  expect((await collectOperationPages(async()=>({data:null,error:null}))).error).toBeInstanceOf(Error);
  expect(await collectOperationPages(async()=>({data:[],error:null}))).toEqual({data:[],error:null});
 });
 it("splits large parent filters while retaining the final partial batch",async()=>{
  const ids=Array.from({length:161},(_,i)=>String(i));
  const sizes:number[]=[];
  const result=await collectOperationIds(ids,async(group)=>{sizes.push(group.length);return{data:group,error:null};});
  expect(result.data).toEqual(ids);expect(sizes).toEqual([80,80,1]);
 });
});
