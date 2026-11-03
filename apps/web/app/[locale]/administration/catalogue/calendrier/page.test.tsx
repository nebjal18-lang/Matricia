import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import { calendarCopy } from "@/modules/admin/screens/catalogue-calendar/copy";
const mocks = vi.hoisted(() => ({ context: vi.fn(), load: vi.fn(), panel: vi.fn() }));
vi.mock("next/navigation", async (original) => ({ ...await original<typeof import("next/navigation")>(), redirect: (href: string) => { throw Error(`REDIRECT:${href}`); }, notFound: () => { throw Error("NOT_FOUND"); } }));
vi.mock("@/modules/admin/ui/sensitive-page-context", () => ({ sensitivePageContext: mocks.context }));
vi.mock("@/modules/admin/data/catalogue-calendar/repository", () => ({ loadCatalogCalendar: mocks.load }));
vi.mock("@/modules/admin/screens/catalogue-calendar/panel", () => ({ CatalogCalendarPanel: mocks.panel }));
const library = "11111111-1111-4111-8111-111111111111", access = { userId: library }, data = { complete: true, page: 2, pageSize: 25, hasMore: true, conflicts: [], requests: [] };
const props = (locale = "fr") => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ library, page: "2" }) });
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue({ status: "authorized", access, wrap: (children: ReactNode) => <div data-admin-shell>{children}</div> }); mocks.load.mockResolvedValue({ status: "success", value: data }); mocks.panel.mockImplementation(() => <div>CALENDAR_WORKSPACE</div>); vi.spyOn(console, "error").mockImplementation(() => undefined); });
for (const locale of ["fr", "ar"] as const)
    describe(`catalogue calendar route ${locale}`, () => {
        it("wires real native context through the protected Admin shell", async () => {
            const html = renderToStaticMarkup(await Page(props(locale)));
            expect(html).toContain("CALENDAR_WORKSPACE");
            expect(mocks.context).toHaveBeenCalledWith(expect.objectContaining({ locale, active: "catalog", roles: ["SUPER_ADMIN", "MATRICIA_ADMIN"] }));
            expect(mocks.load).toHaveBeenCalledWith({ libraryId: library, page: "2" }, access);
            expect(mocks.panel).toHaveBeenCalledWith(expect.objectContaining({ locale, context: data }), undefined);
            expect(html).toContain(`/${locale}/administration/catalogue?library=${library}`);
            expect(html).toContain(`library=${library}&amp;page=1`);
            expect(html).toContain(`library=${library}&amp;page=3`);
        });
        it("never reads business data after a role or MFA block", async () => {
            mocks.context.mockResolvedValue({ status: "blocked", view: <p>ACCESS_BLOCKED</p> });
            expect(renderToStaticMarkup(await Page(props(locale)))).toContain("ACCESS_BLOCKED");
            expect(mocks.load).not.toHaveBeenCalled();
        });
        it.each(["MFA_REQUIRED", "FORBIDDEN", "QUERY_FAILED", "CONFIGURATION", "INVALID_RESPONSE"])("keeps %s separate from an empty successful list", async (reason) => {
            mocks.load.mockResolvedValue({ status: "error", reason });
            const html = renderToStaticMarkup(await Page(props(locale)));
            expect(html).toContain(`data-workspace-failure="${reason}"`);
            expect(html).not.toContain(calendarCopy[locale].empty);
            expect(mocks.panel).not.toHaveBeenCalled();
        });
        it("offers an explicit reset for an invalid query", async () => {
            mocks.load.mockResolvedValue({ status: "error", reason: "VALIDATION" });
            const html = renderToStaticMarkup(await Page(props(locale)));
            expect(html).toContain(calendarCopy[locale].invalidQuery);
            expect(html).not.toContain("data-workspace-failure");
        });
        it("resumes the exact library and page after session expiry", async () => {
            mocks.load.mockResolvedValue({ status: "error", reason: "UNAUTHENTICATED" });
            try {
                await Page(props(locale));
                throw Error("EXPECTED_REDIRECT");
            }
            catch (error) {
                const message = (error as Error).message;
                expect(message).toMatch(/^REDIRECT:/);
                const url = new URL(message.slice(9), "https://test.invalid"), next = new URL(url.searchParams.get("next")!, "https://test.invalid");
                expect(next.pathname).toBe(`/${locale}/administration/catalogue/calendrier`);
                expect(next.searchParams.get("library")).toBe(library);
                expect(next.searchParams.get("page")).toBe("2");
            }
        });
    });
it("rejects unsupported locales before access", async () => { await expect(Page(props("en"))).rejects.toThrow("NOT_FOUND"); expect(mocks.context).not.toHaveBeenCalled(); });
