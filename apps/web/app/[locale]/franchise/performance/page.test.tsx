import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { governanceSignalFixture } from "@/modules/franchise/data/governance-signals/fixture";
import Page from "./page";
const m = vi.hoisted(() => ({ library: vi.fn(), native: vi.fn(), signals: vi.fn(), crm: vi.fn(), board: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: m.redirect }));
vi.mock("@/modules/franchise/screens/library/page-helper", () => ({ requireFranchiseLibrary: m.library, loadFranchiseSpaceFromLibrary: m.board, franchiseMandateName: () => "Mandat TEST" }));
vi.mock("@/modules/franchise/data/performance/native-control", () => ({ loadNativeFranchiseControl: m.native }));
vi.mock("@/modules/franchise/data/governance-signals/repository", () => ({ loadFranchiseGovernanceSignals: m.signals }));
vi.mock("@/modules/franchise/data/crm/repository", () => ({ loadFranchiseCrm: m.crm }));
vi.mock("@/modules/franchise/ui/franchise-app-shell", () => ({ FranchiseAppShell: ({ children, locale, languagePath }: { children: ReactNode; locale: string; languagePath: string }) => <main dir={locale === "ar" ? "rtl" : "ltr"} data-current-path={languagePath}>{children}</main> }));
vi.mock("@/modules/franchise/ui/franchise-access-page", () => ({ FranchiseAccessPage: ({ reason }: { reason: string }) => <p data-access={reason}>MANDATE_ACCESS_REQUIRED</p> }));
vi.mock("@/modules/franchise/screens/performance/native-control-panel", () => ({ FranchiseNativePerformancePanel: () => <p>Native performance</p> }));
vi.mock("@/modules/franchise/screens/spaces/boards", () => ({ PerformanceBoard: () => <p>Authorized operations</p> }));
vi.mock("@/modules/franchise/screens/performance/performance-panel", () => ({ FranchisePerformancePanel: () => <p>Operational follow-up</p> }));
vi.mock("@/modules/franchise/screens/performance/governance-signal-actions", () => ({ requestGovernanceReview: vi.fn(), proposeGovernanceReview: vi.fn(), approveGovernanceReview: vi.fn() }));
const franchiseId = governanceSignalFixture().franchiseId, organizationId = "b3650000-0000-4000-8000-000000000002";
function fixture(locale: "fr" | "ar") {
  const selectedQuery = `?organizationId=${organizationId}&franchiseId=${franchiseId}`;
  return { space: { selectedQuery, selectedOrganizationId: organizationId, currentPath: `/${locale}/franchise/performance${selectedQuery}`, userEmail: "test@example.invalid", mandates: [] }, result: { status: "success", workspace: { mandate: { franchiseId, libraryName: "TEST" } } } };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.library.mockResolvedValue(fixture("fr")); m.native.mockResolvedValue({ status: "success", dashboard: {} }); m.signals.mockResolvedValue(governanceSignalFixture());
  m.crm.mockResolvedValue({ status: "success", dashboard: { franchises: [], prospects: [] } }); m.board.mockResolvedValue({ status: "success" });
  m.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
});
for (const locale of ["fr", "ar"] as const) describe(`performance page governance integration ${locale}`, () => {
  beforeEach(() => { m.library.mockResolvedValue(fixture(locale)); });
  async function page(query: Record<string, string> = {}) { return renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) })); }
  it("reads all three projections with the exact authorized mandate rather than a caller-supplied reference", async () => {
    const html = await page({ organizationId: "untrusted-organization", franchiseId: "untrusted-franchise", before: "2026-11-01T10:00:00Z", beforeId: "a3711000-0000-4000-8000-000000000001" });
    expect(m.library).toHaveBeenCalledWith(expect.objectContaining({ locale, organizationId: "untrusted-organization", franchiseId: "untrusted-franchise" }));
    expect(m.native).toHaveBeenCalledWith(franchiseId, expect.objectContaining({ before: "2026-11-01T10:00:00Z", id: "a3711000-0000-4000-8000-000000000001" }));
    expect(m.signals).toHaveBeenCalledWith(franchiseId); expect(m.crm).toHaveBeenCalledWith(franchiseId);
    expect(html).toContain(locale === "fr" ? "Répartition d’activité et faits de gouvernance" : "وقائع توزيع النشاط والحكامة"); expect(html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`); expect(html).toContain(governanceSignalFixture().snapshot.source_evidence_hash);
  });
  it("does not start projection reads before the mandate guard succeeds", async () => {
    m.library.mockResolvedValue({ ...fixture(locale), result: { status: "error", reason: "FORBIDDEN" } });
    expect(await page()).toContain('data-access="FORBIDDEN"'); expect(m.native).not.toHaveBeenCalled(); expect(m.signals).not.toHaveBeenCalled(); expect(m.crm).not.toHaveBeenCalled(); expect(m.board).not.toHaveBeenCalled();
  });
  it.each(["QUERY_FAILED", "FORBIDDEN"] as const)("preserves a precise %s while other authorized projections remain visible", async reason => {
    m.signals.mockResolvedValue({ status: "error", reason }); const html = await page();
    expect(html).toContain(`data-workspace-failure="${reason}"`); expect(html).toContain("Native performance"); expect(html).toContain("Authorized operations"); expect(html).not.toContain(locale === "fr" ? "Missions hors annulations" : "المهام غير الملغاة"); expect(m.redirect).not.toHaveBeenCalled();
    if (reason === "QUERY_FAILED") { expect(html).toContain("FRANCHISE_GOVERNANCE_SIGNALS"); expect(html).toContain(locale === "fr" ? "Réessayer le chargement" : "إعادة التحميل"); }
  });
  it("distinguishes a pending report from an unavailable query without inventing counters", async () => {
    m.signals.mockResolvedValue({ status: "NOT_AVAILABLE", franchiseId }); const html = await page();
    expect(html).toContain(locale === "fr" ? "observations ne sont pas encore disponibles" : "الملاحظات غير متاحة بعد"); expect(html).not.toContain('data-workspace-failure='); expect(html).not.toContain(locale === "fr" ? "Missions hors annulations" : "المهام غير الملغاة");
  });
  it("keeps a CRM incident actionable without hiding the independently loaded facts", async () => {
    m.crm.mockResolvedValue({ status: "error", reason: "QUERY_FAILED" }); const html = await page();
    expect(html).toContain('data-workspace-failure="QUERY_FAILED"'); expect(html).toContain("FRANCHISE_PERFORMANCE_CRM"); expect(html).toContain(governanceSignalFixture().snapshot.source_evidence_hash); expect(html).not.toContain("Operational follow-up");
  });
  it.each(["signals", "native", "crm"] as const)("resumes the exact selected deep link when %s reports a missing session", async name => {
    m[name].mockResolvedValue({ status: "error", reason: "UNAUTHENTICATED" }); await expect(page()).rejects.toThrow("REDIRECT:");
    const url = new URL(m.redirect.mock.calls[0]![0] as string, "https://matricia.invalid"); expect(url.pathname).toBe(`/${locale}/connexion`); expect(url.searchParams.get("next")).toBe(fixture(locale).space.currentPath); expect(m.board).not.toHaveBeenCalled();
  });
});
