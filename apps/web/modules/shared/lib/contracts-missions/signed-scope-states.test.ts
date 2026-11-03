import { describe, expect, it, vi } from "vitest";
import { readMissionSignedScopeStates } from "./signed-scope-states";
const id=(n:number)=>`a9700000-0000-4000-8000-${String(n).padStart(12,"0")}`;

describe("bounded signed scope state reads", () => {
  it("preserves true and explicit false across exact batches, without reading for an empty scope", async () => {
    const ids=Array.from({length:201},(_,n)=>id(n));
    const read=vi.fn(async(batch:string[])=>({data:[...batch].reverse().map(mission_id=>({mission_id,signed_scope_pending:mission_id===id(100)})),error:null}));
    const result=await readMissionSignedScopeStates(ids,read);
    expect(read.mock.calls.map(([batch])=>batch.length)).toEqual([100,100,1]);
    expect(result.status).toBe("success");if(result.status!=="success")return;
    expect(result.states.size).toBe(201);expect(result.states.get(id(100))).toBe(true);expect(result.states.get(id(0))).toBe(false);
    read.mockClear();expect(await readMissionSignedScopeStates([],read)).toEqual({status:"success",states:new Map()});expect(read).not.toHaveBeenCalled();
  });
  it.each([
    [],[{mission_id:id(1),signed_scope_pending:true},{mission_id:id(1),signed_scope_pending:false}],
    [{mission_id:id(1),signed_scope_pending:true},{mission_id:id(3),signed_scope_pending:false}],
    [{mission_id:id(1),signed_scope_pending:true},{mission_id:id(2),signed_scope_pending:"false"}],
    [{mission_id:id(1),signed_scope_pending:true},{mission_id:id(2)}],null,
  ].map(data=>({data})))("rejects omitted, duplicate, foreign or malformed answers: $data",async({data})=>{
    expect(await readMissionSignedScopeStates([id(1),id(2)],async()=>({data,error:null}))).toEqual({status:"error"});
  });
  it("fails the entire read on a later batch outage rather than returning a partial false",async()=>{
    const read=vi.fn().mockImplementationOnce(async(batch:string[])=>({data:batch.map(mission_id=>({mission_id,signed_scope_pending:false})),error:null})).mockResolvedValueOnce({data:null,error:{code:"503"}});
    expect(await readMissionSignedScopeStates(Array.from({length:101},(_,n)=>id(n)),read)).toEqual({status:"error"});
    expect(await readMissionSignedScopeStates([id(1)],async()=>{throw new Error("offline")})).toEqual({status:"error"});
  });
  it("rejects invalid or duplicate request identifiers before any RPC",async()=>{
    const read=vi.fn();for(const ids of [[id(1),id(1)],["invalid"]])expect(await readMissionSignedScopeStates(ids,read)).toEqual({status:"error"});expect(read).not.toHaveBeenCalled();
  });
});
