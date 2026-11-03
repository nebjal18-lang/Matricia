import { describe,expect,it } from "vitest";
import { matchesFranchiseNetwork,networkFilterOptions } from "./filters";
import type { PersonRow } from "../spaces/demo";
const row:PersonRow={id:"TEST",name:"Nom libre français",services:"SERVICE_A",stage:"ACTIVE",status:"ACTIVE",next:"",tone:"mint",dossier:{organizationId:"a3621000-0000-4000-8000-000000000001",name:"Nom libre français",companyStatus:"VERIFIED",status:"ACTIVE",createdAt:"2026-10-01T00:00:00Z",teamSize:2,regions:["MA-06"],qualifications:[{id:"a3622000-0000-4000-8000-000000000001",serviceId:"a3623000-0000-4000-8000-000000000001",serviceCode:"SERVICE_A",status:"APPROVED",rowVersion:1}],capacities:[{id:"a3622000-0000-4000-8000-000000000002",serviceId:"a3623000-0000-4000-8000-000000000001",serviceCode:"SERVICE_A",status:"LIMITED",availableUnits:2,leadTimeDays:1}],documents:[{id:"a3622000-0000-4000-8000-000000000003",kind:"INSURANCE",code:"PROOF_A",status:"VERIFIED",expiresOn:"2026-11-02"}]}};
describe("real franchise network filters",()=>{
 it("combines service, actual profile state, capacity, region and actual document expiry",()=>{
  const filters={service:"SERVICE_A",status:"ACTIVE",capacity:"LIMITED",zone:"MA-06",docs:"EXPIRED"};
  expect(matchesFranchiseNetwork(row,filters,"2026-11-03")).toBe(true);
  for(const field of Object.keys(filters))expect(matchesFranchiseNetwork(row,{...filters,[field]:"OTHER"},"2026-11-03")).toBe(false);
 });
 it("offers only actual options and never grants documents to an unlinked CRM prospect",()=>{
  const prospect={...row,dossier:undefined,stage:"SENT"};
  expect(networkFilterOptions([row,prospect],"2026-11-03")).toEqual({services:["SERVICE_A"],statuses:["ACTIVE","SENT"],capacities:["LIMITED"],zones:["MA-06"],documents:["EXPIRED","NONE"]});
  expect(matchesFranchiseNetwork(prospect,{docs:"NONE"},"2026-11-03")).toBe(true);
  expect(matchesFranchiseNetwork(prospect,{service:"SERVICE_A"},"2026-11-03")).toBe(false);
 });
});
