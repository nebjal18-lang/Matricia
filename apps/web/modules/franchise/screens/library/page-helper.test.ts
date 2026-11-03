import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireFranchiseLibrary } from "./page-helper";

const mocks = vi.hoisted(() => ({ space: vi.fn(), library: vi.fn(), redirect: vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modules/franchise/data/spaces/context", () => ({ resolveFranchiseSpace: mocks.space }));
vi.mock("@/modules/franchise/data/library/workspace", () => ({ loadFranchiseLibraryWorkspace: mocks.library }));
vi.mock("@/modules/franchise/data/crm/repository", () => ({ loadFranchiseCrm: vi.fn() }));
vi.mock("@/modules/franchise/data/digest/repository", () => ({ loadFranchiseDigest: vi.fn() }));
vi.mock("@/modules/franchise/data/followups/repository", () => ({ loadFranchiseFollowups: vi.fn() }));
vi.mock("@/modules/franchise/data/governance/repository", () => ({ loadFranchiseDashboard: vi.fn() }));
vi.mock("@/modules/franchise/data/operations/repository", () => ({ loadFranchiseOperations: vi.fn() }));
vi.mock("@/modules/franchise/data/quality/repository", () => ({ loadFranchiseCorrectivePlans: vi.fn() }));

const org = "22222222-2222-4222-8222-222222222222";
const franchise = "33333333-3333-4333-8333-333333333333";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.space.mockResolvedValue({ status: "success", userEmail: "member@example.invalid", selectedOrganizationId: org, selectedQuery: `?organizationId=${org}`, organizations: [{ id: org, name: "TEST" }], errorReason: null });
  mocks.library.mockResolvedValue({ status: "error", reason: "NO_MANDATE" });
});

describe("Franchise deep-link and failure recovery", () => {
  it.each(["fr", "ar"] as const)("preserves a deep link, mandate and search after login in %s", async locale => {
    mocks.space.mockResolvedValue({ status: "unauthenticated" });
    const path = `/${locale}/franchise/validations/corrections`;
    await expect(requireFranchiseLibrary({ locale, organizationId: org, franchiseId: franchise, returnPath: path, returnQuery: { q: "Texte libre français", page: "2" } })).rejects.toThrow("REDIRECT:");
    const href = mocks.redirect.mock.calls[0]![0];
    const next = new URL(href, "https://matricia.invalid").searchParams.get("next")!;
    const parsed = new URL(next, "https://matricia.invalid");
    expect(parsed.pathname).toBe(path);
    expect(parsed.searchParams.get("organizationId")).toBe(org);
    expect(parsed.searchParams.get("franchiseId")).toBe(franchise);
    expect(parsed.searchParams.get("q")).toBe("Texte libre français");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(mocks.library).not.toHaveBeenCalled();
  });
  it("keeps an Auth incident visible instead of redirecting or querying the library", async () => {
    const space = { status: "success", selectedOrganizationId: null, selectedQuery: "", organizations: [], errorReason: "QUERY_FAILED" };
    mocks.space.mockResolvedValue(space);
    expect(await requireFranchiseLibrary({ locale: "fr" })).toMatchObject({ space, result: { status: "error", reason: "QUERY_FAILED" } });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.library).not.toHaveBeenCalled();
  });
  it("asks for an explicit organization instead of choosing between memberships", async () => {
    mocks.space.mockResolvedValue({ status: "success", selectedOrganizationId: null, selectedQuery: "", organizations: [{ id: org }, { id: franchise }], errorReason: null });
    const result = await requireFranchiseLibrary({ locale: "ar" });
    expect(result.result).toEqual({ status: "error", reason: "ORGANIZATION_REQUIRED" });
    expect(mocks.library).not.toHaveBeenCalled();
  });
  it("preserves the requested page if the session expires between the two authorized reads", async () => {
    mocks.library.mockResolvedValue({ status: "error", reason: "UNAUTHENTICATED" });
    await expect(requireFranchiseLibrary({ locale: "fr", returnPath: "/fr/franchise/finance/releves", organizationId: org, franchiseId: franchise })).rejects.toThrow("REDIRECT:");
    const next = new URL(mocks.redirect.mock.calls[0]![0], "https://matricia.invalid").searchParams.get("next");
    expect(next).toContain("/fr/franchise/finance/releves?");
    expect(next).toContain(`franchiseId=${franchise}`);
  });
  it("rejects an external return destination", async () => {
    mocks.space.mockResolvedValue({ status: "unauthenticated" });
    await expect(requireFranchiseLibrary({ locale: "fr", returnPath: "https://outside.invalid/" })).rejects.toThrow("REDIRECT:");
    expect(new URL(mocks.redirect.mock.calls[0]![0], "https://matricia.invalid").searchParams.get("next")).toBe("/fr/franchise/accueil");
  });
});


describe("Franchise mandate selection", () => {
  const first = { id: franchise, organizationId: org, libraryId: "44444444-4444-4444-8444-444444444444", label: "TEST-A" };
  const second = { ...first, id: "55555555-5555-4555-8555-555555555555", label: "TEST-B" };
  const foreign = { ...first, id: "66666666-6666-4666-8666-666666666666", organizationId: "77777777-7777-4777-8777-777777777777", label: "OTHER-AUTHORIZED-ORG" };
  it("requires an explicit choice instead of silently exposing the first library", async () => {
    mocks.library.mockResolvedValue({ status: "success", workspace: { mandate: { franchiseId: franchise, operatorOrganizationId: org }, availableMandates: [first, second, foreign] } });
    const result = await requireFranchiseLibrary({ locale: "fr", organizationId: org });
    expect(result.result).toEqual({ status: "error", reason: "MANDATE_REQUIRED" });
    expect(result.space.mandates).toEqual([first, second]);
    expect(result.space.selectedQuery).not.toContain("franchiseId");
  });
  it("keeps the explicitly authorized mandate pinned in all subsequent links", async () => {
    mocks.library.mockResolvedValue({ status: "success", workspace: { mandate: { franchiseId: second.id, operatorOrganizationId: org }, availableMandates: [first, second] } });
    const result = await requireFranchiseLibrary({ locale: "ar", organizationId: org, franchiseId: second.id, returnPath: "/ar/franchise/services" });
    expect(result.result.status).toBe("success");
    expect(new URLSearchParams(result.space.selectedQuery).get("franchiseId")).toBe(second.id);
    expect(result.space.currentPath).toContain("/ar/franchise/services?");
  });
  it("does not load or enumerate mandates for an organization the actor cannot select", async () => {
    mocks.space.mockResolvedValue({ status: "success", organizations: [], selectedOrganizationId: null, selectedQuery: "", errorReason: "FORBIDDEN" });
    const result = await requireFranchiseLibrary({ locale: "fr", organizationId: foreign.organizationId });
    expect(result.result).toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(result.space.mandates).toEqual([]);
    expect(mocks.library).not.toHaveBeenCalled();
  });
});
