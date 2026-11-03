import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
const m = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/modules/admin/ui/sensitive-page-context", () => ({ sensitivePageContext: m.context }));
vi.mock("@/modules/franchise/screens/performance/governance-inspector", () => ({ GovernanceInspector: ({ requestId }: { requestId: string }) => <p>Purpose-gated inspector {requestId}</p> }));
const requestId = "a3711000-0000-4000-8000-000000000001";
beforeEach(() => { vi.clearAllMocks(); m.context.mockResolvedValue({ status: "authorized", wrap: (child: unknown) => child }); });
describe("private governance case routing", () => {
  it("keeps the Admin and AAL2 denial before offering private inspection", async () => {
    m.context.mockResolvedValue({ status: "blocked", view: <p>MFA_REQUIRED</p> }); const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr", requestId }) })); expect(html).toContain("MFA_REQUIRED"); expect(html).not.toContain("Purpose-gated");
  });
  it.each(["fr", "ar"] as const)("opens only the purpose form for the exact case in %s", async locale => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale, requestId }) })); expect(m.context).toHaveBeenCalledWith(expect.objectContaining({ path: `gouvernance-franchise/signalements/${requestId}`, roles: ["SUPER_ADMIN", "MATRICIA_ADMIN"] })); expect(html).toContain(`Purpose-gated inspector ${requestId}`); expect(html).toContain(`/${locale}/administration/command-center`);
  });
});
