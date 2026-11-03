import{describe,expect,it}from"vitest";
import{filterAdminOrgRows,mapAdminOrgRows}from"./view-model";
import type{AdminSupervisionDashboard}from"../supervision/types";
const org:AdminSupervisionDashboard["organizations"][number]={id:"11111111-1111-4111-8111-111111111111",display_name:"Provider dans le nom",legal_name:"Société test",status:"ACTIVE",created_at:"2026-10-31T00:00:00Z",role_codes:["CLIENT","PROVIDER"],member_count:2,open_requests:0,open_disputes:0};
describe("canonical organization directory",()=>{it("does not attest compliance merely because no dispute exists",()=>{const row=mapAdminOrgRows([org],"fr")[0]!;expect(row.complianceCode).toBe("UNKNOWN");expect(row.compliance).toBe("Non vérifié");});it("requires all current role identities to be verified",()=>{expect(mapAdminOrgRows([{...org,client_compliance_status:"VERIFIED",provider_identity_verified:false,canonical_identity_verified:true}],"fr")[0]?.complianceCode).toBe("REVIEW");});it("preserves multi-role and status filters across FR/AR",()=>{for(const locale of["fr","ar"]as const){const rows=mapAdminOrgRows([org],locale);expect(filterAdminOrgRows(rows,{type:"CLIENT",status:"ACTIVE"})).toHaveLength(1);expect(filterAdminOrgRows(rows,{type:"PROVIDER",status:"ACTIVE"})).toHaveLength(1);}});it("includes archived organizations only when explicitly requested",()=>{const rows=mapAdminOrgRows([{...org,status:"ARCHIVED"}],"fr");expect(filterAdminOrgRows(rows,{})).toEqual([]);expect(filterAdminOrgRows(rows,{},undefined,true)).toHaveLength(1);expect(rows[0]?.status).toBe("Archivée");});});

import { mapAdminTreatQueue, organizationJourney } from "./view-model";
import type { AdminOrganizationFiche } from "../supervision/types";
import type { AdminWorkItem } from "../command-center/model";
const fiche: AdminOrganizationFiche = {
  organization: { ...org, country_code: "MA", updated_at: null },
  memberships: [], requests: [], missions: [], disputes: [], diagnostics: [], subscriptions: [], timeline: [],
};
const work: AdminWorkItem = {
  id: "work-1", queueKey: "OPS", queueLabelFr: "Ops", queueLabelAr: "عمليات", organizationId: null,
  sourceKind: "EXCEPTION", resourceType: "client_assistance_request", resourceId: "case-1",
  titleFr: "Assistance", titleAr: "المساعدة", priority: "LOW", status: "OPEN", dueAt: "2026-11-03T10:00:00Z",
  assignedTo: null, rowVersion: 1,
};
for (const locale of ["fr", "ar"] as const) {
  describe(`organization facts in ${locale}`, () => {
    it("does not treat the absence of disputes or the presence of a draft as verification", () => {
      const journey = organizationJourney({ ...fiche, diagnostics: [{ id: org.id, status: "DRAFT", rating: "", overall_score: 0, completed_at: null }] }, locale);
      expect(journey.find(step => step.id === "compliance")?.state).toBe("pending");
      expect(journey.find(step => step.id === "diag")?.state).toBe("current");
      expect(journey.some(step => step.id === "signup")).toBe(false);
    });
    it("requires both Client and Provider identity and rejects a stale client snapshot", () => {
      const verified = { ...fiche.organization, client_compliance_status: "VERIFIED", provider_identity_verified: true, canonical_identity_verified: true };
      expect(organizationJourney({ ...fiche, organization: verified }, locale).find(step => step.id === "compliance")?.state).toBe("done");
      expect(organizationJourney({ ...fiche, organization: { ...verified, provider_identity_verified: false } }, locale).find(step => step.id === "compliance")?.state).toBe("current");
      const snapshot = { case_id: org.id, status: "VERIFIED", profile_version: 1, document_count: 3, verified_document_count: 0, currently_verified: false, required_actions: [] };
      expect(organizationJourney({ ...fiche, organization: { ...verified, client_compliance_snapshot: snapshot } }, locale).find(step => step.id === "compliance")?.state).toBe("current");
    });
    it("does not invalidate verified identity because of an unrelated dispute", () => {
      const journey = organizationJourney({ ...fiche,
        organization: { ...fiche.organization, client_compliance_status: "VERIFIED", provider_identity_verified: true, canonical_identity_verified: true },
        disputes: [{ id: org.id, mission_id: org.id, status: "OPEN", urgency: "HIGH", response_due_at: work.dueAt }],
      }, locale);
      expect(journey.find(step => step.id === "compliance")?.state).toBe("done");
    });
    it("opens the actionable task with its context and ranks critical alerts first", () => {
      const items = mapAdminTreatQueue({ locale, query: `?organizationId=${org.id}`, organizations: [], requests: [], workItems: [work, { ...work, id: "critical", priority: "CRITICAL" }] });
      expect(items[0]?.id).toBe("critical");
      expect(items[1]?.href).toBe(`/${locale}/administration/command-center?organizationId=${org.id}#work-work-1`);
    });
  });
}
