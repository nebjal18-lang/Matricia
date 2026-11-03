import Requests from "@/app/[locale]/franchise/demandes/page";
import Quality from "@/app/[locale]/franchise/qualite/page";
import Finance from "@/app/[locale]/franchise/finance/page";
import Perimeter from "@/app/[locale]/franchise/perimetre/page";
import Network from "@/app/[locale]/franchise/reseau/page";
import Followups from "@/app/[locale]/franchise/relances/page";
import Digest from "@/app/[locale]/franchise/digest/page";
import Performance from "@/app/[locale]/franchise/performance/page";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FranchiseLibraryLoadResult, FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
import Home from "@/app/[locale]/franchise/accueil/page";
import Library from "@/app/[locale]/franchise/bibliotheque/page";
import Services from "@/app/[locale]/franchise/services/page";
import Questionnaires from "@/app/[locale]/franchise/questionnaires/page";
import Rules from "@/app/[locale]/franchise/regles/page";
import Validations from "@/app/[locale]/franchise/validations/page";
import Documents from "@/app/[locale]/franchise/documents/page";
import Governance from "@/app/[locale]/franchise/gouvernance/page";
import Marketing from "@/app/[locale]/franchise/marketing/page";

const organizationId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  library: { status: "error", reason: "NO_MANDATE" } as FranchiseLibraryLoadResult,
  governance: vi.fn(), live: vi.fn(), marketing: vi.fn(),
  organizations: [] as Array<{ id: string; name: string }>, selectedOrganizationId: null as string | null,
}));
vi.mock("@/modules/franchise/screens/library/page-helper", () => ({
  requireFranchiseLibrary: async (input: { locale: string; returnPath?: string }) => ({ space: { currentPath: input.returnPath ?? `/${input.locale}/franchise/accueil`, mandates: [], selectedQuery: "", selectedOrganizationId: mocks.selectedOrganizationId, userEmail: null, organizations: mocks.organizations, errorReason: null }, result: mocks.library }),
  franchiseMandateName: (result: FranchiseLibraryLoadResult) => result.status === "success" ? result.workspace.mandate.libraryName : null,
  loadFranchiseSpaceFromLibrary: mocks.live,
}));
vi.mock("@/modules/franchise/data/governance/repository", () => ({ loadFranchiseDashboard: mocks.governance }));
vi.mock("@/modules/shared/lib/marketing-autopilot/repository", () => ({ loadWorkspaceMarketingDashboard: mocks.marketing }));
vi.mock("@/modules/franchise/screens/spaces/boards", () => ({ GovernanceBoard: () => <p>GOVERNANCE_SUCCESS_BOARD</p>, DocumentsBoard: () => <p>DOCUMENTS_SUCCESS_BOARD</p> }));
vi.mock("@/modules/franchise/screens/gouvernance/governance-panel", () => ({ GovernancePanel: () => <p>GOVERNANCE_SUCCESS_PANEL</p> }));
vi.mock("@/modules/franchise/ui/franchise-app-shell", () => ({ FranchiseAppShell: ({ children, locale }: { children: ReactNode; locale: string }) => <div dir={locale === "ar" ? "rtl" : "ltr"}>{children}</div>, FranchiseActions: () => <a href="#gouvernance">PREPARE_ACTION</a> }));

beforeEach(() => {
  mocks.library = { status: "error", reason: "NO_MANDATE" }; mocks.organizations = []; mocks.selectedOrganizationId = null;
  mocks.governance.mockReset().mockResolvedValue({ status: "error", reason: "QUERY_FAILED" });
  mocks.live.mockReset(); mocks.marketing.mockReset().mockResolvedValue({ status: "error", reason: "NO_ORGANIZATION" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => { vi.restoreAllMocks(); });

const pages = [Home, Library, Services, Questionnaires, Rules, Validations, Documents, Requests, Quality, Finance, Perimeter, Network, Followups, Digest, Performance];
for (const locale of ["fr", "ar"] as const) describe(`Franchise readiness ${locale}`, () => {
  it.each(pages.map((page, index) => [index, page] as const))("page %i explains the missing mandate and provides a real regularization path", async (_, Page) => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
    expect(html).toContain(`href="/${locale}/franchise/candidature"`);
    expect(html).toContain(`href="/${locale}/contact"`);
    expect(html).not.toContain(locale === "fr" ? "La bibliothèque mandatée est temporairement indisponible" : "المكتبة المكلَّفة غير متاحة مؤقتاً");
    expect(html).toContain(locale === "fr" ? "Aucun mandat de bibliothèque actif accessible" : "لا يوجد تكليف نشط بمكتبة متاح لهذا الحساب");
  });
  it("never requests governance for a fabricated franchise when the mandate is absent", async () => {
    const html = renderToStaticMarkup(await Governance({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
    expect(mocks.governance).not.toHaveBeenCalled(); expect(mocks.live).not.toHaveBeenCalled();
    expect(html).not.toContain("GOVERNANCE_SUCCESS_BOARD"); expect(html).not.toContain("PREPARE_ACTION");
  });
  it("does not present an active mandate or empty successful board after governance RPC failure", async () => {
    mocks.library = { status: "success", workspace: { mandate: { franchiseId: "33333333-3333-4333-8333-333333333333", operatorOrganizationId: organizationId, libraryId: "44444444-4444-4444-8444-444444444444", libraryName: "SYNTHETIC" } } as FranchiseLibraryWorkspace };
    const html = renderToStaticMarkup(await Governance({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
    expect(mocks.governance).toHaveBeenCalledWith(locale, expect.objectContaining({ organizationId }));
    expect(mocks.live).not.toHaveBeenCalled(); expect(html).not.toContain("GOVERNANCE_SUCCESS_BOARD"); expect(html).not.toContain("GOVERNANCE_SUCCESS_PANEL");
    expect(html.replace(/<[^>]+>/g, "")).not.toContain("QUERY_FAILED");
    expect(html).toContain(`href="/${locale}/franchise/gouvernance"`);
  });
  it("provides a labelled authorized organization selector when marketing lacks an unambiguous context", async () => {
    mocks.organizations = [{ id: organizationId, name: "Organisation A" }, { id: "55555555-5555-4555-8555-555555555555", name: "Organisation B" }];
    const html = renderToStaticMarkup(await Marketing({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
    expect(html).toContain(`action="/${locale}/franchise/marketing"`); expect(html).toContain('for="franchise-organization-context"');
    expect(html).toContain(`value="${organizationId}"`); expect(html).toContain('name="organizationId"');
    expect(html).not.toContain(`href="/${locale}/franchise/candidature"`);
  });
  it("gives a concrete regularization path when marketing has no authorized organization", async () => {
    const html = renderToStaticMarkup(await Marketing({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
    expect(html).toContain(`href="/${locale}/franchise/candidature"`); expect(html).toContain(`href="/${locale}/contact"`);
    expect(html).not.toContain('name="organizationId"');
  });
});

for (const locale of ["fr", "ar"] as const) describe(`Franchise incident recovery ${locale}`, () => {
  it.each(pages.map((page, index) => [index, page] as const))("page %i keeps a technical failure visible without a successful empty board", async (_, Page) => {
    mocks.library = { status: "error", reason: "QUERY_FAILED" };
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
    expect(html).toContain('data-workspace-failure="QUERY_FAILED"');
    expect(html).not.toContain(`href="/${locale}/franchise/candidature"`);
    expect(mocks.live).not.toHaveBeenCalled();
    expect(mocks.governance).not.toHaveBeenCalled();
    expect(html).not.toContain('GOVERNANCE_SUCCESS_BOARD');
  });
});
