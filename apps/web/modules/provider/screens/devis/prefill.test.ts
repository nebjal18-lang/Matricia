import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({from:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({from:mocks.from})}));
import {loadQuotePrefills} from "./prefill";
const id=(n:number)=>`f3460000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const versions=Array.from({length:26},(_,n)=>({id:id(n+1),solution_fr:`Solution ${n+1}`,solution_ar:null,deliverables:["Rapport"],inclusions:[],exclusions:[],prerequisites:[],warranty_fr:"Garantie",warranty_ar:null,correction_terms_fr:"Corrections",correction_terms_ar:null,proposed_start_date:"2026-12-01",duration_days:10,valid_until:"2027-01-01T00:00:00Z",change_reason:"Version native",currency:"MAD"}));
const items=versions.flatMap(version=>Array.from({length:50},(_,n)=>({quote_version_id:version.id,line_number:n+1,item_kind:"ONE_TIME",label_fr:`Ligne ${n+1}`,label_ar:null,quantity:"1.0000",unit_code:"FORFAIT",unit_price_minor:"125050",tax_rule_version_id:id(1000),recurrence_interval:null})));
const options=versions.flatMap(version=>Array.from({length:20},(_,n)=>({quote_version_id:version.id,option_key:`OPTION_${n+1}`,label_fr:`Option ${n+1}`,label_ar:null,amount_minor:"12345678901234567",currency:"MAD"})));
const attachments=versions.flatMap((version,n)=>Array.from({length:20},(_,m)=>({id:id(2000+n*20+m),quote_version_id:version.id,document_version_id:id(3000+n*20+m),title:`Référence ${m+1}.pdf`})));
const rows={quote_versions:versions,quote_items:items,quote_options:options,quote_attachments:attachments};
const current=versions.map(row=>({invitationId:row.id,versionId:row.id}));
function query(table:string){const chain:Record<string,unknown>={};for(const method of["select","eq","in","order"])chain[method]=vi.fn(()=>chain);chain.range=vi.fn(async(from:number,to:number)=>({data:rows[table as keyof typeof rows]?.slice(from,to+1),error:null}));return chain;}
beforeEach(()=>{mocks.from.mockReset().mockImplementation(query);});
describe("quote revision source reads",()=>{
 it("reads every authorized line, option and attachment beyond the transport cap",async()=>{const result=await loadQuotePrefills(id(100),current,"fr");expect(Object.keys(result??{})).toHaveLength(26);expect(result?.[id(26)]?.lines).toHaveLength(50);expect(result?.[id(26)]?.options).toHaveLength(20);expect(result?.[id(26)]?.attachments).toHaveLength(20);expect(result?.[id(26)]?.options?.[19]?.price).toBe("123456789012345.67");});
 it("preserves user content in the Arabic interface without translating it",async()=>{const result=await loadQuotePrefills(id(100),current,"ar");expect(result?.[id(26)]?.solution).toBe("Solution 26");expect(result?.[id(26)]?.lines[49]?.label).toBe("Ligne 50");});
 it("returns no editable source on a failed transport page",async()=>{mocks.from.mockImplementation((table:string)=>{const chain=query(table);if(table==="quote_items")chain.range=async()=>({data:null,error:{code:"UNAVAILABLE"}});return chain;});expect(await loadQuotePrefills(id(100),current,"fr")).toBeNull();});
 it("does not turn a missing version into a new empty quote",async()=>{mocks.from.mockImplementation((table:string)=>{const chain=query(table);if(table==="quote_versions")chain.range=async()=>({data:versions.slice(1),error:null});return chain;});expect(await loadQuotePrefills(id(100),current,"fr")).toBeNull();});
 it("uses an empty result only when no source version was requested",async()=>{expect(await loadQuotePrefills(id(100),[],"fr")).toEqual({});expect(mocks.from).not.toHaveBeenCalled();});
});
