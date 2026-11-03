import { describe, expect, it } from "vitest";
import { collectOperationIds, collectOperationPages } from "./paging";

describe("complete bounded franchise operation lists",()=>{
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
