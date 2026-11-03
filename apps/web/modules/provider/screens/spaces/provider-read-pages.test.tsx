import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { scope, qualification, quotes } = vi.hoisted(() => ({ scope: vi.fn(), qualification: vi.fn(), quotes: vi.fn() }));
vi.mock("@/modules/provider/data/spaces/context", () => ({ resolveProviderSpace: scope }));
vi.mock("@/modules/provider/data/qualification/repository", () => ({ loadProviderDashboard: qualification }));
vi.mock("@/modules/provider/data/quotes/repository", () => ({ loadProviderQuotes: quotes }));
vi.mock("@/modules/provider/data/qualification/regions-repository", () => ({ loadProviderRegions: vi.fn() }));
vi.mock("@/modules/provider/screens/devis/prefill", () => ({ loadQuotePrefills: vi.fn() }));
vi.mock("@/modules/provider/screens/devis/quote-panel", () => ({ QuotePanel: () => null }));
vi.mock("@/modules/provider/screens/qualification/qualification-forms", () => ({ QualificationForms: () => null }));
vi.mock("@/modules/provider/screens/qualification/regions-form", () => ({ RegionsForm: () => null }));
vi.mock("@/modules/provider/screens/qualification/intervention-form", () => ({ InterventionForm: () => null }));
vi.mock("@/modules/provider/ui/provider-profile-rail", () => ({ ProviderProfileRail: () => null }));
vi.mock("@/modules/provider/ui/provider-app-shell", () => ({
  ProviderAppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  ProviderActions: () => null,
}));
vi.mock("@/modules/provider/screens/spaces/boards", () => {
  const successfulBoard = () => { throw new Error("FAILED_READ_MUST_NOT_RENDER_SUCCESSFUL_BOARD"); };
  return { QualificationBoard: successfulBoard, ConsultationsBoard: successfulBoard, QuotesBoard: successfulBoard, ProviderDocumentsBoard: successfulBoard };
});

import QualificationPage from "@/app/[locale]/sous-traitant/qualification/page";
import ConsultationsPage from "@/app/[locale]/sous-traitant/consultations/page";
import QuotesPage from "@/app/[locale]/sous-traitant/devis/page";
import DocumentsPage from "@/app/[locale]/sous-traitant/documents/page";

const organizationId = "11111111-1111-4111-8111-111111111111";
const selectedScope = { status: "success", readError: null, organizations: [{ id: organizationId, name: "Provider" }], selectedOrganizationId: organizationId, selectedQuery: `?organizationId=${organizationId}`, userEmail: null };
const pages = [QualificationPage, ConsultationsPage, QuotesPage, DocumentsPage];

beforeEach(() => {
  vi.clearAllMocks();
  scope.mockResolvedValue(selectedScope);
  qualification.mockResolvedValue({ status: "error", reason: "SERVICES_SHAPE_INVALID" });
  quotes.mockResolvedValue({ status: "error", reason: "QUERY_FAILED" });
});

describe.each(["fr", "ar"] as const)("provider read failures in %s", (locale) => {
  it("uses the shell's selected tenant and never renders a successful empty or profile board on error", async () => {
    for (const Page of pages) {
      const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
      expect(html).toContain('role="alert"');
      expect(html).toContain(locale === "ar" ? "التحميل غير متاح" : "Chargement indisponible");
      expect(html).toContain(`organizationId=${organizationId}`);
    }
    expect(qualification).toHaveBeenCalledWith(organizationId);
    expect(quotes).toHaveBeenCalledWith(organizationId);
  });

  it("requests an explicit choice for multiple memberships without querying an arbitrary tenant", async () => {
    scope.mockResolvedValue({ ...selectedScope, selectedOrganizationId: null, selectedQuery: "", organizations: [selectedScope.organizations[0], { id: "22222222-2222-4222-8222-222222222222", name: "Other provider" }] });
    for (const Page of pages) {
      const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
      expect(html).toContain(locale === "ar" ? "اختاروا مؤسسة" : "Choisissez une organisation");
      expect(html).not.toContain('role="alert"');
    }
    expect(qualification).not.toHaveBeenCalled();
    expect(quotes).not.toHaveBeenCalled();
  });

  it("keeps membership transport failures distinct from a successful absence of membership", async () => {
    for (const readError of ["QUERY_FAILED", null]) {
      scope.mockResolvedValue({ ...selectedScope, selectedOrganizationId: null, selectedQuery: "", organizations: [], readError });
      const html = renderToStaticMarkup(await DocumentsPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
      expect(html).toContain(readError ? (locale === "ar" ? "التحميل غير متاح" : "Chargement indisponible") : (locale === "ar" ? "لا توجد مؤسسة مقدم خدمة مخولة" : "Aucune organisation prestataire autorisée"));
    }
    expect(qualification).not.toHaveBeenCalled();
  });
});
