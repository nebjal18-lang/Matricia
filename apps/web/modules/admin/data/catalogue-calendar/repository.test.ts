import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCatalogCalendar } from "./repository";
const mocks = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: mocks.access, hasPlatformRole: (roles: Set<string>, allowed: readonly string[]) => allowed.some(role => roles.has(role)) }));
const data = () => ({ complete: true, page: 1, pageSize: 25, hasMore: false, conflicts: [], requests: [] });
const access = (roles = ["MATRICIA_ADMIN"], assured = true) => ({ status: "ok", client: { rpc: mocks.rpc }, roles: new Set(roles), requirementSatisfied: assured });
beforeEach(() => { mocks.access.mockReset().mockResolvedValue(access()); mocks.rpc.mockReset().mockResolvedValue({ data: data(), error: null }); });
describe("catalogue calendar native projection", () => {
    it("reads a bounded native page without interpreting empty success as an outage", async () => {
        expect(await loadCatalogCalendar({ page: 1 })).toEqual({ status: "success", value: data() });
        expect(mocks.rpc).toHaveBeenCalledWith("get_catalog_release_window_context_v1", { p_library_id: null, p_page: 1 });
    });
    it("checks role before asking for MFA", async () => {
        mocks.access.mockResolvedValue(access(["FRANCHISE_MEMBER"], false));
        expect(await loadCatalogCalendar({})).toEqual({ status: "error", reason: "FORBIDDEN" });
        expect(mocks.rpc).not.toHaveBeenCalled();
        mocks.access.mockResolvedValue(access(["SUPER_ADMIN"], false));
        expect(await loadCatalogCalendar({})).toEqual({ status: "error", reason: "MFA_REQUIRED" });
        expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it.each(["UNAUTHENTICATED", "QUERY_FAILED", "INVALID_RESPONSE"] as const)("preserves %s access errors", async (reason) => {
        mocks.access.mockResolvedValue({ status: "error", reason });
        expect(await loadCatalogCalendar({})).toEqual({ status: "error", reason });
        expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it("never hides malformed or failed data in empty arrays", async () => {
        for (const payload of [{ ...data(), complete: false }, { ...data(), page: 2 }, { ...data(), conflicts: null }, { ...data(), pageSize: 100 }]) {
            mocks.rpc.mockResolvedValue({ data: payload, error: null });
            expect(await loadCatalogCalendar({})).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
        }
        mocks.rpc.mockRejectedValue(new Error("internal detail"));
        expect(await loadCatalogCalendar({})).toEqual({ status: "error", reason: "QUERY_FAILED" });
    });
    it.each([{ page: 0 }, { page: 10001 }, { page: ["1", "2"] }, { libraryId: "invalid" }])("validates filter %j before native access", async (input) => { expect(await loadCatalogCalendar(input)).toEqual({ status: "error", reason: "VALIDATION" }); expect(mocks.rpc).not.toHaveBeenCalled(); });
    it.each([["42501", "CENTRAL_MFA_REQUIRED", "MFA_REQUIRED"], ["42501", "CATALOG_SCOPE_DENIED", "FORBIDDEN"], ["42501", "CATALOG_AUTH_REQUIRED", "UNAUTHENTICATED"], ["42P01", "MISSING", "CONFIGURATION"]])("retains backend state %s/%s", async (code, message, reason) => { mocks.rpc.mockResolvedValue({ data: null, error: { code, message } }); expect(await loadCatalogCalendar({})).toEqual({ status: "error", reason }); });
});
