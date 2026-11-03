import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: mocks.access, hasPlatformRole: (roles: Set<string>, allowed: string[]) => allowed.some(role => roles.has(role)) }));
vi.mock("@/modules/admin/ui/admin-app-shell", () => ({ AdminAppShell: ({ children }: { children: ReactNode }) => <div data-shell="administration">{children}</div> }));
vi.mock("@/modules/admin/screens/signatures/forms", () => ({ SignaturePolicyForms: () => <div>protected policies</div> }));
import SignaturePoliciesPage from "./page";
beforeEach(() => { vi.clearAllMocks(); });
describe("signature governance authorization keeps navigation without relaxing access", () => {
  it.each(["fr", "ar"])("retains the Admin shell and MFA continuation before querying policies in %s", async locale => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["SUPER_ADMIN"]), requirementSatisfied: false, email: "admin@example.invalid", client: { rpc: mocks.rpc } });
    const html = renderToStaticMarkup(await SignaturePoliciesPage({ params: Promise.resolve({ locale }) }));
    expect(html).toContain('data-shell="administration"');
    expect(html).toContain('data-workspace-failure="MFA_REQUIRED"');
    expect(html).toContain(`next=${encodeURIComponent(`/${locale}/administration/signatures`)}`);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not grant policy access to another platform role", async () => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["FINANCE_MANAGER"]), requirementSatisfied: true, client: { rpc: mocks.rpc } });
    const html = renderToStaticMarkup(await SignaturePoliciesPage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).toContain('data-shell="administration"');
    expect(html).toContain('data-workspace-failure="FORBIDDEN"');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never represents a technical access failure as an empty or forbidden policy list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.access.mockResolvedValue({ status: "error", reason: "QUERY_FAILED" });
    const html = renderToStaticMarkup(await SignaturePoliciesPage({ params: Promise.resolve({ locale: "ar" }) }));
    expect(html).toContain('data-workspace-failure="QUERY_FAILED"');
    expect(html).not.toContain('data-workspace-failure="FORBIDDEN"');
    expect(mocks.rpc).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
