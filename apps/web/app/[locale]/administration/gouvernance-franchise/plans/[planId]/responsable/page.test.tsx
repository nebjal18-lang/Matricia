import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
const m = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/admin/ui/sensitive-page-context", () => ({ sensitivePageContext: m.context, adminReadFailure: (e: { code?: string } | null) => e?.code === "42501" ? "FORBIDDEN" : "INVALID_RESPONSE" }));
vi.mock("@/modules/franchise/screens/performance/native-owner-controls", () => ({ NativePlanOwnerControls: () => <p>Scoped named owner control</p> }));
vi.mock("@/modules/franchise/screens/performance/native-plan-form", () => ({ NativePlanDecisionForm: () => <p>Independent plan decision</p> }));
vi.mock("@/modules/shared/ui/workspace-failure", () => ({ WorkspaceFailure: ({ reason }: { reason: string }) => <p>{reason}</p> }));
const planId = "a3731000-0000-4000-8000-000000000001";
beforeEach(() => { vi.clearAllMocks(); m.context.mockResolvedValue({ status: "authorized", access: { client: { rpc: m.rpc } }, wrap: (child: unknown) => child, selfPath: "/fr/administration/plan" }); });
describe("independent Admin plan page", () => {
  it("does not query a plan before the Admin and AAL2 page guard succeeds", async () => {
    m.context.mockResolvedValue({ status: "blocked", view: <p>MFA_REQUIRED</p> });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr", planId }) }));
    expect(html).toContain("MFA_REQUIRED"); expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each(["fr", "ar"] as const)("preserves the exact plan and Admin navigation in %s", async locale => {
    m.rpc.mockResolvedValue({ data: { organizationId: "b3650000-0000-4000-8000-000000000002", version: 0, ownerUserId: null, ownerName: null, ownerActive: false, ownerConfirmed: false, historicalSuggestedOwnerUserId: null, canProgress: false, canProposeAssignment: true, canApprovePlan: false, canCompletePlan: false, canRejectPlan: true, candidates: [], candidateCount: 0, requests: [], assignmentRequestCount: 0, nextRequestCursor: null }, error: null });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale, planId }) }));
    expect(m.context).toHaveBeenCalledWith(expect.objectContaining({ path: `gouvernance-franchise/plans/${planId}/responsable`, roles: ["SUPER_ADMIN", "MATRICIA_ADMIN"] }));
    expect(m.rpc).toHaveBeenCalledWith("get_franchise_control_owner_context_v1", { p_plan_id: planId });
    expect(html).toContain("Scoped named owner control"); expect(html).toContain("Independent plan decision"); expect(html).toContain(`/${locale}/administration/command-center`);
  });
  it("presents a denied projection without fabricating a responsible member", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr", planId }) }));
    expect(html).toContain("FORBIDDEN"); expect(html).not.toContain("Scoped named owner control");
  });
});
