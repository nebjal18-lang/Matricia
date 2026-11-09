import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), load: vi.fn(), rethrow: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, unstable_rethrow: mocks.rethrow }));
vi.mock("@/modules/admin/ui/sensitive-page-context", () => ({ sensitivePageContext: mocks.context }));
vi.mock("@/modules/shared/lib/platform-configuration/repository", () => ({ loadConfigurationDashboard: mocks.load }));
vi.mock("@/modules/admin/screens/configuration/panel", () => ({ ConfigurationPanel: ({ locale }: { locale: string }) => <div data-panel={locale}/> }));
import Page from "./page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ status: "authorized", selfPath: "/fr/administration/configuration", wrap: (children: ReactNode) => <main>{children}</main> });
  mocks.load.mockResolvedValue({ environment: "STAGING", actor_id: "1", can_write: true, sections: [] });
});
describe("configuration page security boundary", () => {
  it("does not query configuration when platform access is blocked", async () => {
    mocks.context.mockResolvedValue({ status: "blocked", view: <p>Accès refusé</p> });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).toContain("Accès refusé"); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("requires administrator roles and renders the Arabic configuration after authorization", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "ar" }) }));
    expect(mocks.context).toHaveBeenCalledWith(expect.objectContaining({ roles: ["SUPER_ADMIN", "MATRICIA_ADMIN"], path: "configuration" }));
    expect(html).toContain('data-panel="ar"'); expect(mocks.load).toHaveBeenCalledOnce();
  });
  it("keeps database errors and internal response details out of the page", async () => {
    mocks.load.mockRejectedValue(Object.assign(new Error("PRIVATE_PROVIDER_RESPONSE"), { code: "CONFIGURATION_MIGRATION_MISSING" }));
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).not.toContain("PRIVATE_PROVIDER_RESPONSE"); expect(html).not.toContain("CONFIGURATION_MIGRATION_MISSING"); expect(html).not.toContain("data-panel");
  });
});
