import{describe,expect,it}from"vitest";
import{missionAssignments,missionPreparationSchema}from"./preparation";
const id="00000000-0000-4000-8000-000000000001";
function form(){const f=new FormData();f.append("deliverableKey","REPORT");f.set("dueAt:REPORT","2026-12-01");f.set("owner:REPORT",id);f.append("criterion:REPORT","QUALITY");return f;}
describe("mission preparation references",()=>{
 it("converts a business date and preserves selected checklist references",()=>{expect(missionAssignments(form())).toMatchObject({success:true,data:[{deliverable_key:"REPORT",owner_organization_id:id,due_at:"2026-12-01T23:59:00.000Z",criterion_keys:["QUALITY"]}]});});
 it("rejects a missing criterion, a duplicate delivery and a malformed owner",()=>{for(const mutate of[(f:FormData)=>f.delete("criterion:REPORT"),(f:FormData)=>f.append("deliverableKey","REPORT"),(f:FormData)=>f.set("owner:REPORT","outside")]){const f=form();mutate(f);expect(missionAssignments(f).success).toBe(false);}});
});

it("distinguishes a verified signed scope without operational work from an unavailable executable preparation",()=>{expect(missionPreparationSchema.safeParse({contract_id:"e1000000-0000-4000-8000-000000000001",contract_version_id:"e1000000-0000-4000-8000-000000000002",no_mission_required:true}).success).toBe(true);expect(missionPreparationSchema.safeParse({contract_id:"e1000000-0000-4000-8000-000000000001",contract_version_id:"e1000000-0000-4000-8000-000000000002",no_mission_required:false}).success).toBe(false)});
