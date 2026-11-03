import {describe,it,expect} from "vitest";
import {readBoxSelections,boxConfigurationSchema} from "./model";
const id="b2560000-0000-4000-8000-000000000001";
describe("Box configuration submission",()=>{
 it("keeps exact quantities and ignores unselected zero quantities",()=>{const f=new FormData();f.append(`choice:CORE:${id}`,"9007199254740993");f.append("choice:EXTRA:b2560000-0000-4000-8000-000000000002","0");expect(readBoxSelections(f)).toEqual([{slot_code:"CORE",benefit_version_id:id,units:"9007199254740993"}]);});
 it("refuses duplicate form fields instead of silently choosing one",()=>{const f=new FormData();f.append(`choice:CORE:${id}`,"1");f.append(`choice:CORE:${id}`,"2");expect(readBoxSelections(f)).toBeNull();});
 it.each(["-1","1.5","1e3","1000000000000000000","", "1;DROP TABLE"])("rejects malformed or out-of-bound quantity %s",value=>{const f=new FormData();f.append(`choice:CORE:${id}`,value);expect(readBoxSelections(f)).toBeNull();});
 it("does not accept a supposed successful context without its authoritative source",()=>{expect(boxConfigurationSchema.safeParse({organization_id:id,status:"CONFIGURABLE",options:[]}).success).toBe(false);});
 it("accepts an explicit configuration prerequisite without inventing defaults",()=>{expect(boxConfigurationSchema.safeParse({organization_id:id,status:"BOX_APPROVED_CONFIGURATION_REQUIRED",options:[]}).success).toBe(true);});
});
