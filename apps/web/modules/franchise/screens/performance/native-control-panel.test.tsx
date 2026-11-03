import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FranchiseNativePerformancePanel } from "./native-control-panel";
import { nativeControlFixture } from "@/modules/franchise/data/performance/native-control.fixture";
vi.mock("./native-owner-controls", () => ({ NativePlanOwnerControls: () => <section data-owner-context="true"/> }));
vi.mock("./native-plan-form", () => ({ NativePlanProgressForm: () => <form data-native-plan="true"/>, NativePlanDecisionForm: () => <form data-native-decision="true"/> }));
describe("native control FR/AR states", () => {
  it.each(["fr", "ar"] as const)("renders missing measurements and actual source zero separately in %s", locale => {
    const html = renderToStaticMarkup(<FranchiseNativePerformancePanel locale={locale} result={{ status: "success", dashboard: nativeControlFixture() }} returnPath={`/${locale}/franchise/performance`}/>);
    expect(html).toContain(locale === "fr" ? "Non mesuré" : "غير مقاس");
    expect(html).toContain(locale === "fr" ? "Couverture partielle" : "تغطية جزئية");
    expect(html).not.toContain(">0%<"); expect(html).toContain("<dd>0</dd>");
    expect(html).toContain("/api/franchise/control-reports/a3651000-0000-4000-8000-000000000001");
  });
  it.each(["fr", "ar"] as const)("has a concrete worker recovery message before the first report in %s", locale => {
    const dashboard = nativeControlFixture(); dashboard.reports = [];
    const html = renderToStaticMarkup(<FranchiseNativePerformancePanel locale={locale} result={{ status: "success", dashboard }} returnPath={`/${locale}/franchise/performance`}/>);
    expect(html).toContain(locale === "fr" ? "Les rapports ne sont pas encore disponibles" : "التقارير غير متاحة بعد");
    expect(html).not.toContain(locale === "fr" ? "Les six axes sont mesurés" : "المحاور الستة مقاسة");
  });
});


it("uses server capabilities for plan controls and preserves free text in Arabic", () => {
  const dashboard = nativeControlFixture();
  dashboard.plans = [{ id: "a3652000-0000-4000-8000-000000000001", franchise_id: dashboard.franchiseId, report_id: dashboard.reports[0]!.id, due_on: "2026-12-03", origin: "SYSTEM_PROPOSAL", suggested_owner_user_id: null, objectives: [{ axis: "LIBRARY_QUALITY", observedScoreBps: 0, targetScoreBps: 6000, completionCriterion: "REMEASURE_NATIVE_SOURCE_AT_OR_ABOVE_TARGET" }], ownerContext: { organizationId: "b3650000-0000-4000-8000-000000000002", version: 0, ownerUserId: null, ownerName: null, ownerActive: false, ownerConfirmed: false, historicalSuggestedOwnerUserId: null, canProgress: false, canProposeAssignment: false, canApprovePlan: false, canCompletePlan: false, canRejectPlan: false, candidates: [], candidateCount: 0, requests: [], assignmentRequestCount: 0, nextRequestCursor: null }, eventCount: 1, nextEventAfter: null, events: [{ id: 1, kind: "COMMENT", comment: "Texte libre français conservé", progress_percent: null, created_at: "2026-11-03T10:00:00Z" }] }];
  const render = () => renderToStaticMarkup(<FranchiseNativePerformancePanel locale="ar" result={{ status: "success", dashboard }} returnPath="/ar/franchise/performance"/>);
  expect(render()).toContain("Texte libre français conservé");
  expect(render()).not.toContain("data-native-plan"); expect(render()).not.toContain("data-native-decision");
  dashboard.capabilities.canWrite = true;
  expect(render()).toContain("data-native-plan"); expect(render()).not.toContain("data-native-decision");
  dashboard.capabilities.canDecide = true; dashboard.plans[0]!.ownerContext.canRejectPlan = true;
  expect(render()).toContain("data-native-decision");
});
