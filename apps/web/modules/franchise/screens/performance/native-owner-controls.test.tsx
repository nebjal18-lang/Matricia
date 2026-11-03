import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlanOwnerContext } from "@/modules/franchise/data/performance/owner-context";
import { NativePlanOwnerControls } from "./native-owner-controls";
vi.mock("./native-owner-actions", () => ({ proposeNativePlanOwner: vi.fn(), reviewNativePlanOwner: vi.fn(), searchNativePlanOwners: vi.fn() }));
const planId = "a3731000-0000-4000-8000-000000000001";
function fixture(): PlanOwnerContext { return { organizationId: "b3650000-0000-4000-8000-000000000002", version: 0, ownerUserId: null, ownerName: null, ownerActive: false, ownerConfirmed: false, historicalSuggestedOwnerUserId: null, canProgress: false, canProposeAssignment: false, canApprovePlan: false, canCompletePlan: false, canRejectPlan: false, candidates: [], candidateCount: 0, requests: [], assignmentRequestCount: 0, nextRequestCursor: null }; }
describe("responsible member recovery FR/AR", () => {
  it.each(["fr", "ar"] as const)("explains missing or revoked responsibility without offering self-approval in %s", locale => {
    const html = renderToStaticMarkup(<NativePlanOwnerControls locale={locale} planId={planId} context={fixture()}/>);
    expect(html).toContain(locale === "fr" ? "L’avancement reste bloqué" : "يتوقف تسجيل التقدم"); expect(html).not.toContain('name="ownerUserId"'); expect(html).not.toContain('name="decision"');
  });
  it.each(["fr", "ar"] as const)("offers a named scoped selection rather than a text UUID in %s", locale => {
    const context = fixture(); context.canProposeAssignment = true; context.candidates = [{ id: "a3732000-0000-4000-8000-000000000001", name: "Nom libre français du membre", index: 1 }]; context.candidateCount = 1;
    const html = renderToStaticMarkup(<NativePlanOwnerControls locale={locale} planId={planId} context={context}/>);
    expect(html).toContain('<select'); expect(html).toContain('name="ownerUserId"'); expect(html).toContain("Nom libre français du membre"); expect(html.replace(/<[^>]+>/g, "")).not.toContain(context.candidates[0]!.id);
    expect(html).toContain(locale === "fr" ? "Un second administrateur indépendant" : "مسؤول إدارة مستقل ثانٍ");
  });
  it("provides a concrete exact-organization regularization link when there are no eligible members", () => {
    const context = fixture(); context.canProposeAssignment = true;
    const html = renderToStaticMarkup(<NativePlanOwnerControls locale="fr" planId={planId} context={context}/>);
    expect(html).toContain(`/fr/administration/entreprises/${context.organizationId}`);
  });
});
