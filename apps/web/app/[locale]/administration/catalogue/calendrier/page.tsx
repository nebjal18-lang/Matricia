import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { sensitivePageContext } from "@/modules/admin/ui/sensitive-page-context";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { formatCalendarDateLabels } from "@/modules/admin/data/catalogue-calendar/date-labels";
import { loadCatalogCalendar } from "@/modules/admin/data/catalogue-calendar/repository";
import { calendarRoles } from "@/modules/admin/screens/catalogue-calendar/model";
import { calendarCopy } from "@/modules/admin/screens/catalogue-calendar/copy";
import { CatalogCalendarPanel } from "@/modules/admin/screens/catalogue-calendar/panel";
export const dynamic = "force-dynamic";
export default async function CatalogCalendarPage({ params, searchParams }: {
    params: Promise<{
        locale: string;
    }>;
    searchParams: Promise<{
        library?: string;
        page?: string;
    }>;
}) {
    const [{ locale }, query] = await Promise.all([params, searchParams]);
    if (!isLocale(locale))
        notFound();
    const c = calendarCopy[locale], parameters = new URLSearchParams();
    if (typeof query.library === "string")
        parameters.set("library", query.library);
    if (typeof query.page === "string")
        parameters.set("page", query.page);
    const path = `catalogue/calendrier${parameters.size ? `?${parameters}` : ""}`, self = `/${locale}/administration/${path}`;
    const context = await sensitivePageContext({ locale, active: "catalog", path, title: c.title, lead: c.lead, roles: calendarRoles });
    if (context.status === "blocked")
        return context.view;
    const result = await loadCatalogCalendar({ libraryId: query.library, page: query.page }, context.access);
    if (result.status === "error" && result.reason === "UNAUTHENTICATED")
        redirect(connexionHref(locale, { next: self }));
    const href = (page: number) => { const next = new URLSearchParams(parameters); next.set("page", String(page)); return `/${locale}/administration/catalogue/calendrier?${next}`; };
    return context.wrap(<main className="client-page min-w-0 space-y-5"><Link href={`/${locale}/administration/catalogue${typeof query.library === "string" ? `?${new URLSearchParams({ library: query.library })}` : ""}`} className="inline-flex min-h-11 items-center underline">{c.back}</Link>
 {result.status === "error" ? result.reason === "VALIDATION" ? <section role="alert" className="rounded-xl border p-4"><p>{c.invalidQuery}</p><Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/administration/catalogue/calendrier`}>{c.refresh}</Link></section> : <WorkspaceFailure locale={locale} reason={result.reason === "CONFLICT" ? "QUERY_FAILED" : result.reason} returnPath={self} supportReference="CATALOG_RELEASE_CALENDAR"/> : <><CatalogCalendarPanel locale={locale} context={result.value} dateLabels={formatCalendarDateLabels(locale, result.value)} returnPath={self}/><nav aria-label={c.pages} className="flex flex-wrap items-center gap-4"><span>{c.page} {result.value.page}</span>{result.value.page > 1 ? <Link className="inline-flex min-h-11 items-center underline" href={href(result.value.page - 1)}>{c.previous}</Link> : null}{result.value.hasMore && result.value.page < 10000 ? <Link className="inline-flex min-h-11 items-center underline" href={href(result.value.page + 1)}>{c.next}</Link> : null}</nav>{result.value.hasMore && result.value.page === 10000 ? <p role="status">{c.refine}</p> : null}</>}
 </main>);
}
