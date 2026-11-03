import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: mocks.access, hasPlatformRole: (roles: Set<string>, allowed: readonly string[]) => allowed.some(role => roles.has(role)) }));
vi.mock("./admin-app-shell", () => ({ AdminAppShell: ({ children }: { children: ReactNode }) => <div data-shell="administration">{children}</div> }));
import { sensitivePageContext, adminReadFailure } from "./sensitive-page-context";
beforeEach(() => vi.clearAllMocks());
describe("sensitive administration error states", () => {
  it.each(["fr", "ar"] as const)("keeps the verified Admin shell and exact MFA return in %s", async locale => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["SUPER_ADMIN"]), requirementSatisfied: false });
    const result = await sensitivePageContext({ locale, path: "confidentialite", active: "settings", title: "Privacy", roles: ["SUPER_ADMIN"] });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      const html = renderToStaticMarkup(result.view);
      expect(html).toContain('data-shell="administration"');
      expect(html).toContain('data-workspace-failure="MFA_REQUIRED"');
      expect(html).toContain(`next=${encodeURIComponent(`/${locale}/administration/confidentialite`)}`);
    }
  });
  it("does not call an unauthorized role an MFA failure", async () => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["SUPPORT_AGENT"]), requirementSatisfied: false });
    const result = await sensitivePageContext({ locale: "fr", path: "fiscalite-maroc", active: "finance", title: "Fiscalité", roles: ["FINANCE_MANAGER"] });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(renderToStaticMarkup(result.view)).toContain('data-workspace-failure="FORBIDDEN"');
  });
  it.each([["42501", "FORBIDDEN"], ["PGRST202", "CONFIGURATION"], ["42883", "CONFIGURATION"], ["PGRST301", "UNAUTHENTICATED"], ["08006", "QUERY_FAILED"]])("classifies %s safely as %s", (code, reason) => {
    expect(adminReadFailure({ code })).toBe(reason);
  });
});
