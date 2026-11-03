import { describe, expect, it } from "vitest";
import { readAllPages } from "./read-pages";
describe("complete tenant projection", () => {
 it("reads beyond legacy 2000 cap including the final short page", async () => {
  const values=Array.from({length:2501},(_,id)=>({id}));
  const result=await readAllPages(async(from,to)=>({data:values.slice(from,to+1),error:null}));
  expect(result).toEqual({data:values,error:null});
 });
 it("rejects a later page failure rather than returning misleading totals",async()=>{
  const failure={code:"42501"};
  expect(await readAllPages(async from=>from===0?{data:Array.from({length:500},(_,i)=>i),error:null}:{data:null,error:failure})).toEqual({data:null,error:failure});
 });
 it("does not treat a transport exception as empty data",async()=>{
  expect((await readAllPages<number>(async()=>{throw new Error("network")})).data).toBeNull();
 });
});
