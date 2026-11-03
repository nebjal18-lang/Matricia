import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), rpc: vi.fn(), selects: [] as string[] }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc }),
}));

import { loadAdminProviders } from "./repository";

const userId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const serviceId = "33333333-3333-4333-8333-333333333333";
const providerServiceId = "44444444-4444-4444-8444-444444444444";
const qualificationId = "55555555-5555-4555-8555-555555555555";
const decisionId = "66666666-6666-4666-8666-666666666666";
const documentId = "77777777-7777-4777-8777-777777777777";
const familyId = "88888888-8888-4888-8888-888888888888";
const invoiceId = "99999999-9999-4999-8999-999999999999";
const statementId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const paymentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const accountId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function thenable(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const next = () => chain;
  for (const method of ["select", "eq", "is", "in", "order", "limit", "range"]) {
    chain[method] = method === "select"
      ? (columns: string) => {
          mocks.selects.push(columns);
          return chain;
        }
      : next;
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function empty() {
  return thenable({ data: [], error: null });
}

describe("loadAdminProviders", () => {
  beforeEach(() => {
    mocks.selects.length = 0;
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: userId } } });
    mocks.rpc.mockReset().mockImplementation(async (name: string) => {
      if (name === "get_my_account_security_requirement") {
        return { data: [{ requirement_satisfied: true, matched_role_codes: ["MATRICIA_ADMIN"] }], error: null };
      }
      if (name === "list_admin_provider_organization_names_v1") {
        return { data: { organizations: [{ id: orgId, display_name: "Atelier Atlas" }] }, error: null };
      }
      return { data: { eligible: false, reasons: ["CAPACITY_NOT_DECLARED"], qualification_status: "APPROVED" }, error: null };
    });
    mocks.from.mockReset().mockImplementation((table: string) => {
      if (table === "platform_user_roles") return thenable({ data: [{ role_code: "MATRICIA_ADMIN" }], error: null });
      if (table === "provider_profiles") return thenable({ data: [{ provider_organization_id: orgId, company_status: "VERIFIED", overall_status: "ACTIVE", partner_contract_status: "SIGNED", row_version: 2 }], error: null });
      if (table === "provider_services") return thenable({ data: [{ id: providerServiceId, provider_organization_id: orgId, service_id: serviceId, request_status: "DECIDED" }], error: null });
      if (table === "provider_document_versions") return thenable({ data: [{ id: documentId, provider_organization_id: orgId, family_id: familyId, version_number: 1, status: "SUBMITTED", expires_on: null }], error: null });
      if (table === "provider_statements") return thenable({ data: [{ id: statementId, provider_organization_id: orgId, statement_number: "REL-1", period_start: "2026-09-01", period_end: "2026-09-30", currency: "MAD", total_minor: 125050 }], error: null });
      if (table === "provider_invoice_balances") return thenable({ data: [{ id: invoiceId, provider_organization_id: orgId, statement_id: statementId, invoice_number: "F-1", currency: "MAD", total_minor: 125050, paid_minor: 0, outstanding_minor: 125050, payment_status: "ISSUED", due_on: "2026-10-15" }], error: null });
      if (table === "provider_payments") return thenable({ data: [{ id: paymentId, provider_organization_id: orgId, payment_reference: "VIR-1", currency: "MAD", amount_minor: "50000", paid_on: "2026-09-18" }], error: null });
      if (table === "provider_payment_allocations") return thenable({ data: [], error: null });
      if (table === "financial_accounts") return thenable({ data: [{ id: accountId, organization_id: orgId, code: "411000", currency: "MAD" }], error: null });
      if (table === "catalog_services") return thenable({ data: [{ id: serviceId, code: "IT_SUPPORT" }], error: null });
      if (table === "provider_qualifications") return thenable({ data: [{ id: qualificationId, provider_service_id: providerServiceId, row_version: 3, current_decision_id: decisionId }], error: null });
      if (table === "provider_qualification_decisions") return thenable({ data: [{ id: decisionId, status: "APPROVED" }], error: null });
      if (table === "provider_document_families") return thenable({ data: [{ id: familyId, document_kind: "LEGAL", code: "RC" }], error: null });
      return empty();
    });
  });

  it("does not query tenant data without authentication", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(loadAdminProviders()).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("fails closed on a role query error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(loadAdminProviders()).resolves.toEqual({ status: "error", reason: "QUERY_FAILED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("loads the dashboard without nested PostgREST joins and accepts numeric money", async () => {
    const result = await loadAdminProviders();
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.dashboard.providers[0]).toMatchObject({ organizationName: "Atelier Atlas", companyStatus: "VERIFIED" });
    expect(result.dashboard.services[0]).toMatchObject({ serviceCode: "IT_SUPPORT", qualificationId, eligible: false, eligibilityReasons: ["CAPACITY_NOT_DECLARED"] });
    expect(result.dashboard.documents[0]).toMatchObject({ kind: "LEGAL", code: "RC" });
    expect(result.dashboard.statements[0]?.totalMinor).toBe("125050");
    expect(result.dashboard.invoices[0]?.outstandingMinor).toBe("125050");
    expect(result.dashboard.payments[0]?.unallocatedMinor).toBe("50000");
    expect(mocks.selects.some((columns) => columns.includes("organizations!inner") || columns.includes("catalog_services!inner") || columns.includes("provider_qualification_decisions!"))).toBe(false);
  });

  it("keeps the page when catalogue or eligibility embeds are unavailable", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "catalog_services") return thenable({ data: null, error: { code: "PGRST200" } });
      if (table === "platform_user_roles") return thenable({ data: [{ role_code: "MATRICIA_ADMIN" }], error: null });
      if (table === "provider_profiles") return thenable({ data: [{ provider_organization_id: orgId, company_status: "UNDER_REVIEW", overall_status: "QUALIFICATION_IN_PROGRESS", partner_contract_status: "PENDING", row_version: 1 }], error: null });
      if (table === "provider_services") return thenable({ data: [{ id: providerServiceId, provider_organization_id: orgId, service_id: serviceId, request_status: "SUBMITTED" }], error: null });
      return empty();
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_my_account_security_requirement") return { data: [{ requirement_satisfied: true, matched_role_codes: ["MATRICIA_ADMIN"] }], error: null };
      if (name === "explain_provider_service_eligibility") return { data: null, error: { code: "42501" } };
      return { data: { organizations: [] }, error: null };
    });
    const result = await loadAdminProviders();
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.dashboard.services[0]?.serviceCode).toBe(serviceId.slice(0, 8));
    expect(result.dashboard.services[0]?.eligibilityReasons).toEqual(["ELIGIBILITY_UNAVAILABLE"]);
    expect(result.dashboard.providers[0]?.organizationName).toBe(orgId.slice(0, 8));
  });
});
