import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { planning, space } = vi.hoisted(() => ({ planning: vi.fn(), space: vi.fn() }));
vi.mock("@/modules/provider/data/planning/repository", () => ({ loadProviderPlanning: planning }));
vi.mock("@/modules/provider/data/spaces/context", () => ({ resolveProviderSpace: space }));
vi.mock("@/modules/provider/ui/provider-app-shell", () => ({
  ProviderAppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
import ProviderPlanningPage from "@/app/[locale]/sous-traitant/planning/page";

const organizationId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  space.mockResolvedValue({ status: "success", organizations: [], selectedOrganizationId: organizationId, selectedQuery: `?organizationId=${organizationId}`, userEmail: null });
});

describe("provider planning source states", () => {
  it.each(["fr", "ar"])("does not present failed calendar reads as an empty week in %s", async (locale) => {
    planning.mockResolvedValue({ status: "error" });
    const html = renderToStaticMarkup(await ProviderPlanningPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ week: "2026-11-02" }) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(locale === "ar" ? "تعذر تحميل المواعيد" : "Impossible de charger les échéances");
    expect(html).not.toContain(locale === "ar" ? "لا مواعيد" : "Aucune échéance");
    expect(html).not.toContain(locale === "ar" ? "لا حدث" : "Aucun événement");
    expect(html).toContain(`/${locale}/sous-traitant/planning?organizationId=${organizationId}&amp;week=2026-11-02`);
  });

  it.each(["fr", "ar"])("shows the empty week only after a successful read in %s", async (locale) => {
    planning.mockResolvedValue({ status: "success", events: [], hasMore: false, page: 1, billingVisible: true, operationalScopeIncomplete: false });
    const html = renderToStaticMarkup(await ProviderPlanningPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ week: "2026-11-02" }) }));
    expect(html).toContain(locale === "ar" ? "لا مواعيد في هذا الأسبوع" : "Aucune échéance sur cette semaine");
    expect(html).not.toContain('role="alert"');
  });
  it.each(["fr", "ar"])("keeps held scope partial without false empty-day claims in %s", async (locale) => {
    planning.mockResolvedValue({ status: "success", events: [], hasMore: false, page: 1, billingVisible: true, operationalScopeIncomplete: true });
    const html = renderToStaticMarkup(await ProviderPlanningPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ week: "2026-11-02" }) }));
    expect(html).toContain(locale === "ar" ? "التخطيط جزئي" : "Planning partiel");
    expect(html).toContain(locale === "ar" ? "التخطيط غير مكتمل" : "Le planning reste incomplet");
    expect(html).toContain(`/${locale}/sous-traitant/missions?organizationId=${organizationId}`);
    expect(html).not.toContain(locale === "ar" ? "لا مواعيد في هذا الأسبوع" : "Aucune échéance sur cette semaine");
    expect(html).not.toContain(locale === "ar" ? "لا حدث" : "Aucun événement");
  });

});
