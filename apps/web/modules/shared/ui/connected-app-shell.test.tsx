import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ navigation: vi.fn(), space: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/modules/shared/lib/account-security/connected-space", () => ({ resolveConnectedSpace: mocks.space }));
vi.mock("@/modules/shared/lib/auth/workspace-navigation-server", () => ({ readWorkspaceNavigation: mocks.navigation }));
vi.mock("@/modules/admin/ui/admin-app-shell", () => ({ AdminAppShell: ({ children, alternateHref }: { children: ReactNode; alternateHref: string }) => <div data-shell="administration" data-alternate={alternateHref}>{children}</div> }));
vi.mock("@/modules/client/ui/client-app-shell", () => ({ ClientAppShell: () => <div data-shell="client"/> }));
vi.mock("@/modules/provider/ui/provider-app-shell", () => ({ ProviderAppShell: () => <div data-shell="provider"/> }));
vi.mock("@/modules/franchise/ui/franchise-app-shell", () => ({ FranchiseAppShell: () => <div data-shell="franchise"/> }));
import { ConnectedAppShell } from "./connected-app-shell";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.space.mockResolvedValue({ status: "success", selectedOrganizationId: null, selectedQuery: "", organizationName: null, userEmail: "admin@example.invalid" });
  mocks.navigation.mockResolvedValue({ status: "ok", navigation: { landing: "administration", options: [] } });
});
describe("shared account security shell", () => {
  it("loads every role shell stylesheet on a direct shared security navigation", () => {
    const source = readFileSync(new URL("./connected-app-shell.tsx", import.meta.url), "utf8");
    for (const sheet of ["client/ui/client-experience.css", "provider/ui/provider-experience.css", "franchise/ui/franchise-experience.css", "admin/ui/admin-experience.css", "shared/shell/admin-experience.css"]) expect(source).toContain(`import "@/modules/${sheet}"`);
  });
  it("resolves the Provider membership selected by the authorized preference rather than the first Client organization", async () => {
    mocks.navigation.mockResolvedValue({ status: "ok", navigation: { landing: "provider", options: [{ kind: "client", href: "/fr/tableau-de-bord?workspace=client&organizationId=org-client" }, { kind: "provider", href: "/fr/tableau-de-bord?workspace=provider&organizationId=org-provider" }] } });
    const html = renderToStaticMarkup(await ConnectedAppShell({ locale: "fr", workspace: "provider", title: "Sécurité", currentPath: "/fr/securite/sessions?workspace=provider", providerActive: "company", franchiseActive: "governance", children: "sessions" }));
    expect(mocks.navigation).toHaveBeenCalledWith("fr", undefined, "provider");
    expect(mocks.space).toHaveBeenCalledWith({ locale: "fr", organizationId: "org-provider", allowDirectoryFailure: false });
    expect(html).toContain('data-shell="provider"');
  });
  it("keeps verified personal security content usable when the directory is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.navigation.mockResolvedValue({ status: "error", reason: "QUERY_FAILED" });
    const html = renderToStaticMarkup(await ConnectedAppShell({ locale: "fr", title: "Sécurité", allowContextFailure: true, currentPath: "/fr/securite/compte", providerActive: "company", franchiseActive: "governance", children: <form aria-label="personal MFA">MFA remains available</form> }));
    expect(html).toContain('data-workspace-failure="QUERY_FAILED"');
    expect(html).toContain("MFA remains available");
    expect(html).not.toContain('data-shell="client"');
    expect(html).not.toContain('data-shell="administration"');
    vi.restoreAllMocks();
  });
  it("does not read a substitute organization if the explicit role and organization pairing is forbidden", async () => {
    mocks.navigation.mockResolvedValue({ status: "error", reason: "FORBIDDEN" });
    const html = renderToStaticMarkup(await ConnectedAppShell({ locale: "ar", workspace: "provider", organizationId: "org-client", title: "أمان", currentPath: "/ar/securite/sessions?workspace=provider&organizationId=org-client", providerActive: "company", franchiseActive: "governance", children: "sessions" }));
    expect(mocks.navigation).toHaveBeenCalledWith("ar", "org-client", "provider");
    expect(mocks.space).not.toHaveBeenCalled();
    expect(html).toContain('data-workspace-failure="FORBIDDEN"');
  });
  it.each(["compte", "sessions"])("keeps verified Admin navigation and exact AR route for %s", async page => {
    const current = `/fr/securite/${page}?${new URLSearchParams({ next: "/fr/administration/entreprises/nouvelle", workspace: "administration" })}`;
    const html = renderToStaticMarkup(await ConnectedAppShell({ locale: "fr", currentPath: current, workspace: "administration", title: "Sécurité", providerActive: "company", franchiseActive: "governance", children: "account content" }));
    expect(html).toContain('data-shell="administration"');
    expect(html).not.toContain('data-shell="client"');
    expect(html).toContain(`/ar/securite/${page}?next=%2Far%2Fadministration%2Fentreprises%2Fnouvelle`);
    expect(mocks.navigation).toHaveBeenCalledWith("fr", undefined, "administration");
  });
});
