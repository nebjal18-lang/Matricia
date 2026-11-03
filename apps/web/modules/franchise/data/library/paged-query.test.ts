import { describe, expect, it, vi } from "vitest";
import { collectCatalogPages } from "./paged-query";

describe("collectCatalogPages",()=>{
 it("reads past the PostgREST row cap without losing catalogue versions",async()=>{
  const rows=Array.from({length:1251},(_,id)=>({id}));
  const query=vi.fn(async(from:number,to:number)=>({data:rows.slice(from,to+1),error:null}));
  const result=await collectCatalogPages(query);
  expect(result.data).toEqual(rows);
  expect(query.mock.calls).toEqual([[0,499],[500,999],[1000,1499]]);
 });
 it("rejects a failed continuation instead of returning a plausible partial catalogue",async()=>{
  const unavailable={code:"57014"};
  const result=await collectCatalogPages(async(from)=>from===0?{data:Array.from({length:500},(_,id)=>id),error:null}:{data:null,error:unavailable});
  expect(result).toEqual({data:[],error:unavailable});
 });
 it("does not confuse a missing payload with an empty page",async()=>{
  expect((await collectCatalogPages(async()=>({data:null,error:null}))).error).toBeInstanceOf(Error);
 });
});
