import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), access: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: mocks.access, hasPlatformRole: (roles: Set<string>, allowed: string[]) => allowed.some(role => roles.has(role)) }));
import { loadMoroccoTaxDashboard } from "./repository";
describe("central fiscal dashboard", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["FINANCE_MANAGER"]), requirementSatisfied: true, client: { rpc: mocks.rpc } }); });
  it("loads the actual platform catalogue without a tenant query", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "get_morocco_tax_context_v1" ? { data: { kind: "PLATFORM" }, error: null } : { data: { categories: [], rules: [] }, error: null });
    expect(await loadMoroccoTaxDashboard()).toEqual({ status: "success", dashboard: { context: { kind: "PLATFORM" }, categories: [], rules: [] } });
    expect(mocks.rpc.mock.calls.map(call => call[0])).toEqual(["get_morocco_tax_context_v1", "list_morocco_tax_rules"]);
  });
  it("does not infer MFA from an ambiguous database denial", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "MOROCCO_TAX_ADMIN_AAL2_REQUIRED" } });
    expect(await loadMoroccoTaxDashboard()).toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("requires MFA only from the independently verified policy and avoids sensitive RPCs", async () => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["FINANCE_MANAGER"]), requirementSatisfied: false, client: { rpc: mocks.rpc } });
    expect(await loadMoroccoTaxDashboard()).toEqual({ status: "error", reason: "AAL2_REQUIRED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not misrepresent an unauthorized role as missing MFA", async () => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["SUPPORT_AGENT"]), requirementSatisfied: false, client: { rpc: mocks.rpc } });
    expect(await loadMoroccoTaxDashboard()).toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps an authentication outage technical instead of asking for another login", async () => {
    mocks.access.mockResolvedValue({ status: "error", reason: "QUERY_FAILED" });
    expect(await loadMoroccoTaxDashboard()).toEqual({ status: "error", reason: "QUERY_FAILED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects a hybrid platform and tenant context", async () => {
    mocks.rpc.mockResolvedValue({ data: { kind: "PLATFORM", organizationId: "11111111-1111-4111-8111-111111111111" }, error: null });
    expect(await loadMoroccoTaxDashboard()).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
