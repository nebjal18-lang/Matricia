import { describe, expect, it, vi } from "vitest";

vi.mock("./regions-repository",()=>({loadProviderRegions:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));

import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { diagnoseProviderDashboardProjection, diagnoseProviderServiceLabelCoverage, loadProviderDashboard } from "./repository";

const organizationId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const providerServiceId = "33333333-3333-4333-8333-333333333333";
const qualificationId = "44444444-4444-4444-8444-444444444444";
const versionId = "55555555-5555-4555-8555-555555555555";

const fixtureProjection = {
  profile: {
    company_status: "VERIFIED", overall_status: "ACTIVE", activity_summary: "Prestation de qualification E2E contrôlée",
    team_size: 4, years_experience: 6, secondary_subcontracting_allowed: false, accounting_contact_email: null,
    partner_contract_status: "SIGNED", row_version: 1,
  },
  services: [{
    id: providerServiceId, service_id: serviceId, request_status: "DECIDED", catalog_services: { code: "E2E_SERVICE" },
    provider_qualifications: { id: qualificationId, provider_qualification_decisions: { status: "APPROVED" } },
    provider_capacity_versions: [],
  }],
  documents: [{
    id: versionId, version_number: 1, status: "VERIFIED", expires_on: null,
    provider_document_families: { document_kind: "LEGAL", code: "E2E_LEGAL" },
  }],
  catalog: [{
    id: serviceId, code: "E2E_SERVICE", library_id: organizationId, primary_subcategory_id: providerServiceId,
    current_published_version_id: versionId,
  }],
};

describe("provider dashboard projection diagnostics", () => {
  it("accepts the fully qualified MAT-FUNC-020 fixture before capacity is declared", () => {
    expect(diagnoseProviderDashboardProjection(fixtureProjection)).toBeNull();
    expect(diagnoseProviderServiceLabelCoverage([serviceId], new Set([serviceId]))).toBeNull();
  });

  it("accepts the native one-to-one qualification object or null, never a fabricated collection", () => {
    expect(diagnoseProviderDashboardProjection({ ...fixtureProjection, services: [{ ...fixtureProjection.services[0], provider_qualifications: null }] })).toBeNull();
    expect(diagnoseProviderDashboardProjection({ ...fixtureProjection, services: [{ ...fixtureProjection.services[0], provider_qualifications: [fixtureProjection.services[0]!.provider_qualifications] }] })).toBe("SERVICES_SHAPE_INVALID");
  });

  it("reports the exact safe projection boundary instead of leaking response content", () => {
    expect(diagnoseProviderDashboardProjection({ ...fixtureProjection, services: [{ ...fixtureProjection.services[0], provider_capacity_versions: [{ capacity_status: "AVAILABLE", available_units: "8", lead_time_days: 3 }] }] })).toBe("SERVICES_SHAPE_INVALID");
    expect(diagnoseProviderServiceLabelCoverage([serviceId], new Set())).toBe("PROVIDER_SERVICE_LABEL_MISSING");
  });
});

function providerReadClient(qualification: unknown = fixtureProjection.services[0]!.provider_qualifications) {
  const responses: Record<string, { data: unknown; error: unknown }> = {
    organization_memberships: { data: [{ id: providerServiceId, organization_id: organizationId, organizations: { display_name: "Provider" },organization_member_roles:[{role_code:"PROVIDER_OWNER",revoked_at:null}] }], error: null },
    provider_profiles: { data: fixtureProjection.profile, error: null },
    provider_services: { data: [{ ...fixtureProjection.services[0], provider_qualifications: qualification }], error: null },
    provider_document_versions: { data: fixtureProjection.documents, error: null },
    provider_work_scope_versions:{data:null,error:null},
    provider_intervention_mode_versions: { data: null, error: null },
    catalog_services: { data: fixtureProjection.catalog, error: null },
    catalog_libraries: { data: [{ id: organizationId, current_published_version_id: versionId }], error: null },
    catalog_subcategories: { data: [{ id: providerServiceId, current_published_version_id: versionId }], error: null },
    catalog_service_versions: { data: [{ id: versionId, name_fr: "Service autorisé", name_ar: "خدمة مخولة" }], error: null },
    catalog_library_versions: { data: [{ id: versionId, name_fr: "Domaine", name_ar: "مجال" }], error: null },
    catalog_subcategory_versions: { data: [{ id: versionId, name_fr: "Catégorie", name_ar: "فئة" }], error: null },
  };
  const from = vi.fn((table: string) => {
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query),
      in: vi.fn(() => query), not: vi.fn(() => query), order: vi.fn(() => query),
      limit: vi.fn(() => query), range: vi.fn(() => query), maybeSingle: vi.fn(() => query),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(responses[table]).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn(async (name: string) => ({
    data: name==="list_provider_entry_documents_v1"?{items:fixtureProjection.documents,required_documents_complete:true}:name === "get_my_provider_identity_status_v1"
      ? { verified: true, last_verified_at: null }
      : { eligible: true, reasons: [], qualification_status: "APPROVED", capacity_status: "AVAILABLE",capacity_available_units:8,capacity_lead_time_days:3,qualification_decision_version:4,rule_version:"TEST-RULE",qualification_rationale:"Pièce professionnelle à compléter",qualification_blocking_conditions:["Nouvelle attestation"],qualification_expires_at:"2027-01-01T00:00:00Z" },
    error: null,
  }));
  const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: organizationId } } })) }, from, rpc };
  vi.mocked(getSupabaseServerClient).mockResolvedValue(client as never);
  return { responses, from,rpc };
}

describe("provider dashboard read contract", () => {
  it.each([[503, "AUTH_QUERY_FAILED"], [401, "UNAUTHENTICATED"]] as const)("classifies Auth %s before querying qualification records", async (status, reason) => {
    const from = vi.fn();
    vi.mocked(getSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: { status } }) }, from } as never);
    expect(await loadProviderDashboard(organizationId)).toEqual({ status: "error", reason });
    expect(from).not.toHaveBeenCalled();
  });

  it("loads the PostgREST one-to-one qualification and retains its authorized organization", async () => {
    providerReadClient();
    const result = await loadProviderDashboard(organizationId);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.dashboard.organizationId).toBe(organizationId);
      expect(result.dashboard.services[0]).toMatchObject({ qualificationId, label: { fr: "Service autorisé", ar: "خدمة مخولة" },availableUnits:8,leadTimeDays:3,eligibility:expect.objectContaining({decisionVersion:4,ruleVersion:"TEST-RULE"}),qualificationRationale:"Pièce professionnelle à compléter",blockingConditions:["Nouvelle attestation"] });
    }
  });

  it("keeps a service with no qualification readable instead of rejecting null as a collection", async () => {
    providerReadClient(null);
    const result = await loadProviderDashboard(organizationId);
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.dashboard.services[0]?.qualificationId).toBeNull();
  });

  it("distinguishes no authorized membership from malformed membership data and query failure", async () => {
    const { responses, from } = providerReadClient();
    responses.organization_memberships = { data: [], error: null };
    expect(await loadProviderDashboard()).toEqual({ status: "error", reason: "NO_PROVIDER_ORGANIZATION" });
    expect(from).not.toHaveBeenCalledWith("provider_profiles");
    responses.organization_memberships = { data: [{ organization_id: "invalid" }], error: null };
    expect(await loadProviderDashboard()).toEqual({ status: "error", reason: "MEMBERSHIP_SHAPE_INVALID" });
    responses.organization_memberships = { data: null, error: { code: "503" } };
    expect(await loadProviderDashboard()).toEqual({ status: "error", reason: "MEMBERSHIP_QUERY_FAILED" });
  });

  it("filters documents before pagination and preserves readonly Provider membership",async()=>{
    const {responses,rpc}=providerReadClient();
    responses.organization_memberships={data:[{id:providerServiceId,organization_id:organizationId,organizations:{display_name:"Provider"},organization_member_roles:[{role_code:"PROVIDER_VIEWER",revoked_at:null}]}],error:null};
    const result=await loadProviderDashboard(organizationId,2,{search:"ATTESTATION",kinds:["CERTIFICATION"]});
    expect(result.status).toBe("success");if(result.status==="success")expect(result.dashboard.canManage).toBe(false);
    expect(rpc).toHaveBeenCalledWith("list_provider_entry_documents_v1",{p_provider_organization_id:organizationId,p_page:2,p_search:"ATTESTATION",p_kinds:["CERTIFICATION"]});
  });

  it("does not query another tenant when the requested scope is unauthorized", async () => {
    const { from } = providerReadClient();
    expect(await loadProviderDashboard(serviceId)).toEqual({ status: "error", reason: "NO_PROVIDER_ORGANIZATION" });
    expect(from).not.toHaveBeenCalledWith("provider_profiles");
  });
});
