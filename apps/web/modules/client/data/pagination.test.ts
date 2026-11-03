import { describe, expect, it } from 'vitest';
import { readAllPages } from './pagination';
describe('tenant-scoped pagination',()=>{
 it('retrieves records beyond the old wire cap without repeating pages',async()=>{const values=Array.from({length:1201},(_,id)=>({id}));const calls:number[]=[];const r=await readAllPages(async(a,b)=>{calls.push(a);return{data:values.slice(a,b+1),error:null}});expect(r.error).toBeNull();expect(r.data).toEqual(values);expect(calls).toEqual([0,500,1000]);});
 it('does not present a failed later page as a successful partial read',async()=>{const r=await readAllPages(async(from)=>from?{data:null,error:{code:'503'}}:{data:Array.from({length:500},(_,id)=>id),error:null});expect(r.data).toBeNull();expect(r.error?.code).toBe('503');});
});
