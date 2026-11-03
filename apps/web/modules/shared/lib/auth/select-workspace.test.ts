import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), set: vi.fn(), destination: vi.fn(), redirect: vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("./workspace-navigation-server", () => ({ readWorkspaceNavigation: mocks.read }));
vi.mock("@/app/[locale]/connexion/actions", () => ({ postLoginDestination: mocks.destination }));
import { selectWorkspace } from "./select-workspace";
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue({ status: "ok", navigation: { options: [{ kind: "client", href: "/fr/tableau-de-bord?workspace=client&organizationId=member-org" }] } }); mocks.destination.mockImplementation(async (_locale: string, next: string) => next); });
function form(workspace: string) { const data = new FormData(); data.set("locale", "fr"); data.set("workspace", workspace); data.set("organizationId", "forged-org"); return data; }
describe("authorized workspace switch", () => {
  it("rejects a forged role without writing a preference or granting access", async () => {
    await expect(selectWorkspace(form("administration"))).rejects.toThrow("REDIRECT:/fr/tableau-de-bord?navigation=role-fallback");
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.destination).not.toHaveBeenCalled();
  });
  it("uses the server-derived organization and the MFA-aware destination", async () => {
    mocks.destination.mockResolvedValue("/fr/securite/compte?next=protected-target");
    await expect(selectWorkspace(form("client"))).rejects.toThrow("REDIRECT:/fr/securite/compte?next=protected-target");
    expect(mocks.destination).toHaveBeenCalledWith("fr", "/fr/tableau-de-bord?workspace=client&organizationId=member-org");
    expect(mocks.set).toHaveBeenCalledWith("matricia.workspace", "client", expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
  });
});
