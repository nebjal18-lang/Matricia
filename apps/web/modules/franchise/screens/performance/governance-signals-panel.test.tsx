import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { governanceSignalFixture } from "@/modules/franchise/data/governance-signals/fixture";
import { FranchiseGovernanceSignalsPanel } from "./governance-signals-panel";
import { GovernanceInspector } from "./governance-inspector";
vi.mock("./governance-signal-actions", () => ({ requestGovernanceReview: vi.fn(), proposeGovernanceReview: vi.fn(), approveGovernanceReview: vi.fn(), inspectGovernanceSources: vi.fn() }));
describe("descriptive governance facts FR/AR", () => {
  it.each(["fr", "ar"] as const)("exposes missing approved thresholds and unmeasured ratios without private declarations in %s", locale => {
    const html = renderToStaticMarkup(<FranchiseGovernanceSignalsPanel locale={locale} result={governanceSignalFixture()} returnPath={`/${locale}/franchise/performance`}/>);
    expect(html).toContain(locale === "fr" ? "Non mesuré" : "غير مقاس"); expect(html).toContain(locale === "fr" ? "Les seuils" : "عتبات"); expect(html).toContain(locale === "fr" ? "sans attribution au territoire" : "دون إسناد إلى الإقليم"); expect(html).not.toContain("CONFLICT_DISCLOSURE"); expect(html).not.toContain('name="reason"'); expect(html).toContain(`/${locale}/securite/compte`);
  });
  it.each(["fr", "ar"] as const)("requires an explicit purpose before any private inspection in %s", locale => {
    const html = renderToStaticMarkup(<GovernanceInspector locale={locale} requestId={governanceSignalFixture().snapshot.id}/>);
    expect(html).toContain('name="purpose"'); expect(html).toContain(locale === "fr" ? "Aucune preuve privée n’a été lue" : "لم تُقرأ أي أدلة خاصة"); expect(html).not.toContain("PRIVATE-CONFLICT-REASON");
  });
  it("does not turn the missing report into empty measured counters", () => {
    const html = renderToStaticMarkup(<FranchiseGovernanceSignalsPanel locale="fr" result={{ status: "NOT_AVAILABLE", franchiseId: governanceSignalFixture().franchiseId }} returnPath="/fr/franchise/performance"/>);
    expect(html).toContain("pas encore disponibles"); expect(html).not.toContain("Missions hors annulations");
  });
});
