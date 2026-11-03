import { describe, expect, it } from "vitest";
import type { FranchiseDashboard } from "../governance/model";
import type { FranchiseCrmDashboard } from "../crm/model";
import type { FollowupDashboard } from "../followups/model";
import type { FranchiseDigestDashboard } from "../digest/model";
import { scopeFranchiseDashboards } from "./scoped-dashboard";

function fixture(){
 const governance={franchises:[{id:"mandate-a",organizationId:"org-a"},{id:"mandate-b",organizationId:"org-a"},{id:"mandate-c",organizationId:"org-c"}],books:[{id:"book-a",organizationId:"org-a",libraryId:"library-a"},{id:"book-b",organizationId:"org-a",libraryId:"library-b"},{id:"book-c",organizationId:"org-c",libraryId:"library-c"}],approvals:[{franchiseId:"mandate-a"},{franchiseId:"mandate-b"}],invitations:[{franchiseId:"mandate-a"},{franchiseId:"mandate-c"}]} as unknown as FranchiseDashboard;
 const crm={franchises:governance.franchises,prospects:[{id:"prospect-a",franchiseId:"mandate-a"},{id:"prospect-b",franchiseId:"mandate-b"}],snapshots:[{franchiseId:"mandate-a"},{franchiseId:"mandate-b"}],alerts:[{franchiseId:"mandate-a"},{franchiseId:"mandate-b"}],objectives:[{franchiseId:"mandate-a"},{franchiseId:"mandate-b"}]} as unknown as FranchiseCrmDashboard;
 const followups={franchises:governance.franchises,prospects:crm.prospects,policies:crm.alerts,jobs:[{prospectId:"prospect-a"},{prospectId:"prospect-b"}]} as unknown as FollowupDashboard;
 const digest={franchises:governance.franchises,configurations:[{franchise_id:"mandate-a"},{franchise_id:"mandate-b"}],digests:[{franchise_id:"mandate-a"},{franchise_id:"mandate-c"}],jobs:[{franchise_id:"mandate-a"},{franchise_id:"mandate-c"}]} as unknown as FranchiseDigestDashboard;
 return{governance,crm,followups,digest,plans:null};
}
describe("selected franchise mandate",()=>{
 it("isolates two mandates in the same organization, including automation and finance",()=>{
  const scoped=scopeFranchiseDashboards({...fixture(),organizationId:"org-a",libraryId:"library-a",franchiseId:"mandate-a"});
  expect(scoped.governance?.franchises.map(f=>f.id)).toEqual(["mandate-a"]);
  expect(scoped.governance?.books.map(b=>b.id)).toEqual(["book-a"]);
  expect(scoped.governance?.approvals).toHaveLength(1);
  expect(scoped.governance?.invitations).toHaveLength(1);
  expect(scoped.crm?.prospects.map(p=>p.id)).toEqual(["prospect-a"]);
  expect(scoped.crm?.alerts).toHaveLength(1);
  expect(scoped.crm?.snapshots).toHaveLength(1);
  expect(scoped.crm?.objectives).toHaveLength(1);
  expect(scoped.followups?.jobs).toEqual([{prospectId:"prospect-a"}]);
  expect(scoped.digest?.configurations).toEqual([{franchise_id:"mandate-a"}]);
  expect(scoped.digest?.jobs).toEqual([{franchise_id:"mandate-a"}]);
 });
 it("never falls back to another authorized organization",()=>{
  expect(()=>scopeFranchiseDashboards({...fixture(),organizationId:"foreign-org"})).toThrow("FRANCHISE_SCOPE_FORBIDDEN");
  expect(()=>scopeFranchiseDashboards({...fixture(),organizationId:"org-a",franchiseId:"mandate-c"})).toThrow("FRANCHISE_SCOPE_FORBIDDEN");
 });
 it("fails closed when the scope query is unavailable",()=>{
  expect(()=>scopeFranchiseDashboards({...fixture(),governance:null,organizationId:"org-a"})).toThrow("FRANCHISE_SCOPE_UNAVAILABLE");
 });
});
