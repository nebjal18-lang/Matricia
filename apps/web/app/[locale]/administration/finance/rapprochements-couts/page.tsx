import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { sensitivePageContext } from "@/modules/admin/ui/sensitive-page-context";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { financeCostReadRoles, loadAdminFinanceCostTargets } from "@/modules/admin/data/finance-cost-proofs/repository";
import { FinanceCostProofPanel } from "@/modules/admin/screens/pnl/finance-cost-proof-panel";
import { financeCostProofCopy } from "@/modules/admin/screens/pnl/finance-cost-proof-copy";

export const dynamic = "force-dynamic";

export default async function FinanceCostReconciliationPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar", c = financeCostProofCopy[locale], path = "finance/rapprochements-couts";
  const parameters = new URLSearchParams();
  if (typeof query.q === "string") parameters.set("q", query.q);
  if (typeof query.page === "string" && /^\d{1,5}$/.test(query.page)) parameters.set("page", query.page);
  const self = `/${locale}/administration/${path}${parameters.size ? `?${parameters}` : ""}`;
  const context = await sensitivePageContext({ locale, active: "finance", path: `${path}${parameters.size ? `?${parameters}` : ""}`, title: c.routeTitle, lead: c.lead, roles: financeCostReadRoles });
  if (context.status === "blocked") return context.view;
  const result = await loadAdminFinanceCostTargets({ locale, page: query.page, search: query.q }, context.access);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: self }));
  const href = (page: number) => {
    const selected = new URLSearchParams();
    if (typeof query.q === "string" && query.q.trim()) selected.set("q", query.q.trim());
    selected.set("page", String(page));
    return `/${locale}/administration/${path}?${selected}`;
  };
  return context.wrap(<main className="client-page space-y-5">
    <Link href={`/${locale}/administration/finance`} className="inline-flex min-h-11 items-center underline">{c.backFinance}</Link>
    <form method="get" action={`/${locale}/administration/${path}`} role="search" className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
      <label htmlFor="finance-cost-target-search" className="grid min-w-0 flex-1 gap-2">{c.searchTargets}<input id="finance-cost-target-search" name="q" defaultValue={typeof query.q === "string" ? query.q : ""} maxLength={100} className="min-h-11 rounded border px-3"/></label>
      <button type="submit" className="admin-btn-outline inline-flex min-h-11 items-center">{c.search}</button>
    </form>
    {result.status === "error" ? result.reason === "VALIDATION" ? <section role="alert" className="space-y-3 rounded-xl border p-4"><p>{c.invalidQuery}</p><Link href={`/${locale}/administration/${path}`} className="inline-flex min-h-11 items-center underline">{c.resetQuery}</Link></section> : <WorkspaceFailure locale={locale} reason={result.reason} returnPath={self} supportReference="FINANCE_COST_TARGETS"/> : <>
      {result.value.targets.length ? <FinanceCostProofPanel locale={locale} workspace={{ status: "success", targets: result.value.targets, canUpload: result.value.canUpload }} returnPath={self}/> : <p role="status">{c.emptyTargetPage}</p>}
      <nav className="flex flex-wrap items-center gap-4" aria-label={c.targetPages}>
        <span>{ar ? "الصفحة" : "Page"} {result.value.page}</span>
        {result.value.page > 1 ? <Link className="inline-flex min-h-11 items-center underline" href={href(result.value.page - 1)}>{c.previous}</Link> : null}
        {result.value.hasMore && result.value.page < 10000 ? <Link className="inline-flex min-h-11 items-center underline" href={href(result.value.page + 1)}>{c.next}</Link> : null}
      </nav>
      {result.value.hasMore && result.value.page >= 10000 ? <p role="status">{c.refineSearch}</p> : null}
    </>}
  </main>);
}
