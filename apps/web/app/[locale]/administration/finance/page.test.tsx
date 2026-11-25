import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ finance: vi.fn(), supervision: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/modules/admin/data/finance/repository", () => ({ loadAdminFinanceDashboard: mocks.finance }));
vi.mock("@/modules/admin/data/supervision/repository", () => ({ loadAdminSupervisionDashboard: mocks.supervision }));
vi.mock("@/modules/admin/data/pnl/repository", () => ({ loadAdminPnlDashboard: async () => ({ status: "error", reason: "UNAVAILABLE" }) }));
vi.mock("@/modules/admin/data/closure/repository", () => ({ loadAdminClosureDashboard: async () => ({ status: "error", reason: "UNAVAILABLE" }) }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({
  loadMyPlatformAccess: async () => ({ status: "ok", requirementSatisfied: true }),
  mfaRequiredMessage: () => "MFA",
}));
vi.mock("@/modules/admin/ui/admin-module-page", () => ({
  AdminModulePage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/modules/admin/screens/finance/finance-panel", () => ({
  FinancePanel: () => <p>Existing financial records remain readable</p>,
}));
vi.mock("@/modules/admin/screens/finance/finance-sorties", () => ({ FinanceSorties: () => null }));

import Page from "./page";

const id = "11111111-1111-4111-8111-111111111111";
const walletOrg = "22222222-2222-4222-8222-222222222222";
const props = (organizationId?: string) => ({
  params: Promise.resolve({ locale: "fr" }),
  searchParams: Promise.resolve({ organizationId }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.finance.mockResolvedValue({ status: "success", value: { subscriptions: [{ organization_id: walletOrg }] } });
  mocks.supervision.mockResolvedValue({
    status: "success",
    value: { organizations: [{ id, display_name: "Real issuing company", legal_name: "Real company SARL", status: "ACTIVE" }] },
  });
});

describe("finance hub page", () => {
  it("points offer creation to the dedicated workshop instead of embedding it", async () => {
    const html = renderToStaticMarkup(await Page(props(id)));
    expect(html).toContain("Existing financial records remain readable");
    expect(html).toContain(`/fr/administration/finance/offres?organizationId=${id}`);
    expect(html).toContain("/fr/administration/finance/credits");
    expect(html).toContain("Créer une offre Box");
    expect(html).toContain('id="boxes"');
    expect(html).toContain('id="credits"');
    expect(html).toContain('id="plans"');
    expect(html).not.toContain("data-testid=\"boxes-audit\"");
  });

  it("preserves financial ops when organization projection fails", async () => {
    mocks.supervision.mockResolvedValue({ status: "error", reason: "UNAVAILABLE" });
    const html = renderToStaticMarkup(await Page(props(walletOrg)));
    expect(html).toContain("Existing financial records remain readable");
    expect(html).toContain("Impossible de charger les entreprises autorisées");
    expect(html).toContain("/fr/administration/finance/offres");
  });

  it("keeps company creation reachable when the directory is empty", async () => {
    mocks.supervision.mockResolvedValue({ status: "success", value: { organizations: [] } });
    const html = renderToStaticMarkup(await Page(props()));
    expect(html).toContain("/fr/administration/entreprises/nouvelle");
    expect(html).toContain("Existing financial records remain readable");
  });

  it("does not pass an invalid query UUID into the workshop links as selected context", async () => {
    const html = renderToStaticMarkup(await Page(props("invalid-uuid")));
    expect(html).toContain("La sélection est invalide");
    expect(html).toContain("/fr/administration/finance/offres\"");
    expect(html).toContain("Existing financial records remain readable");
  });
});
