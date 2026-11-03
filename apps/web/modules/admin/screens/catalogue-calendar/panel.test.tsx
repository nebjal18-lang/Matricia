import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCalendarDateLabels } from "@/modules/admin/data/catalogue-calendar/date-labels";
import { CatalogCalendarPanel } from "./panel";
import { calendarCopy } from "./copy";
import type { CalendarContext } from "./model";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/shared/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => { throw Error("UNEXPECTED_CLIENT"); } }));
const id = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222", hash = "a".repeat(64), time = "2026-11-03T10:00:00+00:00";
const source = (): CalendarContext => ({ complete: true, page: 1, pageSize: 25, hasMore: false, conflicts: [{ releaseId: id, libraryId: other, libraryCode: "TEST Catalogue", releaseKey: "Ancien TEST", expectedSnapshotHash: hash, rowVersion: 2, effectiveFrom: time, effectiveUntil: null, currentReleaseId: other, currentReleaseKey: "Courant TEST", canRequest: true }], requests: [{ id: other, libraryId: other, libraryCode: "TEST Catalogue", releaseId: id, releaseKey: "Ancien TEST", currentReleaseKey: "Courant TEST", sourceHash: hash, reason: "Motif utilisateur français غير مترجم", requestedBy: id, requestedAt: time, status: "PENDING", canDecide: true, sourceChanged: false, decisionReason: null, closedAt: null }] });
for (const locale of ["fr", "ar"] as const)
    describe(`catalogue calendar panel ${locale}`, () => {
        it("labels native sources in business terms, preserves free text and never asks for a hash or UUID", () => {
            const html = renderToStaticMarkup(<CatalogCalendarPanel locale={locale} context={source()} dateLabels={{[id]:{from:"Date serveur approuvée",until:null}}} returnPath={`/${locale}/administration/catalogue/calendrier`}/>);
            expect(html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
            expect(html).toContain(calendarCopy[locale].choose);
            expect(html).toContain("TEST Catalogue · Ancien TEST");
            expect(html).toContain("Motif utilisateur français غير مترجم");
            expect(html).toContain('dir="auto"');
            expect(html).not.toContain(hash);
            expect(html).not.toContain('type="text"');
        });
        it("permits rejection but disables stale approval", () => {
            const context = source();
            context.requests[0]!.sourceChanged = true;
            const html = renderToStaticMarkup(<CatalogCalendarPanel locale={locale} context={context} dateLabels={{[id]:{from:"Date serveur approuvée",until:null}}} returnPath={`/${locale}/administration/catalogue/calendrier`}/>);
            expect(html).toMatch(/value="approve" disabled=""/);
            expect(html).toContain('value="reject">');
            expect(html).toContain(calendarCopy[locale].changed);
        });
        it("keeps an author's pending review read-only without an independent capability", () => {
            const context = source();
            context.requests[0]!.canDecide = false;
            const html = renderToStaticMarkup(<CatalogCalendarPanel locale={locale} context={context} dateLabels={{[id]:{from:"Date serveur approuvée",until:null}}} returnPath={`/${locale}/administration/catalogue/calendrier`}/>);
            expect(html).not.toContain('value="approve"');
            expect(html).not.toContain('value="reject"');
            expect(html).toContain(calendarCopy[locale].independent);
        });
        it("shows genuine empty success only for loaded empty collections", () => {
            const context = source();
            context.conflicts = [];
            context.requests = [];
            const html = renderToStaticMarkup(<CatalogCalendarPanel locale={locale} context={context} dateLabels={{[id]:{from:"Date serveur approuvée",until:null}}} returnPath={`/${locale}/administration/catalogue/calendrier`}/>);
            expect(html).toContain(calendarCopy[locale].empty);
            expect(html).toContain(calendarCopy[locale].noRequests);
        });
    });

for (const locale of ["fr", "ar"] as const) it(`serializes server date labels once despite different browser timezone data in ${locale}`, () => {
    const context = source(), original = JSON.stringify(context);
    const factory = vi.spyOn(Intl, "DateTimeFormat");
    factory.mockImplementation(function () { return { format: () => "1 nov. 2026, 22:57" } as unknown as Intl.DateTimeFormat; });
    const dateLabels = JSON.parse(JSON.stringify(formatCalendarDateLabels(locale, context)));
    const server = renderToStaticMarkup(<CatalogCalendarPanel locale={locale} context={context} dateLabels={dateLabels} returnPath="/fr/administration/catalogue/calendrier"/>);
    factory.mockImplementation(function () { return { format: () => "1 nov. 2026, 21:57" } as unknown as Intl.DateTimeFormat; });
    const browser = renderToStaticMarkup(<CatalogCalendarPanel locale={locale} context={JSON.parse(original)} dateLabels={dateLabels} returnPath="/fr/administration/catalogue/calendrier"/>);
    expect(browser).toBe(server);
    expect(browser).toContain("1 nov. 2026, 22:57");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(context)).toBe(original);
});
afterEach(() => vi.restoreAllMocks());
