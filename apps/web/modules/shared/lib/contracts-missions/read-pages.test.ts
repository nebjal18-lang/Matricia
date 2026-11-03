import{describe,expect,it,vi}from"vitest";
import{readContractPages,readContractRelations}from"./read-pages";
describe("complete contractual reads",()=>{
 it("reads old rows beyond the transport page and never drops row1001",async()=>{const records=Array.from({length:1001},(_,id)=>({id})),query=vi.fn(async(from,to)=>({data:records.slice(from,to+1),error:null}));expect((await readContractPages(query)).data).toHaveLength(1001);expect(query).toHaveBeenLastCalledWith(1000,1499);});
 it("fails the whole read when a later page fails",async()=>{const query=vi.fn().mockResolvedValueOnce({data:Array(500).fill({}),error:null}).mockResolvedValueOnce({data:null,error:{code:"42501"}});expect(await readContractPages(query)).toEqual({data:null,error:{code:"42501"}});});
 it("bounds IN-list length and preserves all parents without duplicate requests",async()=>{const ids=Array.from({length:301},(_,i)=>String(i)),query=vi.fn(async(values:string[])=>({data:values,error:null}));expect((await readContractRelations([...ids,...ids],query)).data).toEqual(ids);expect(query).toHaveBeenCalledTimes(4);expect(query.mock.calls.every(([values])=>values.length<=100)).toBe(true);});
});
