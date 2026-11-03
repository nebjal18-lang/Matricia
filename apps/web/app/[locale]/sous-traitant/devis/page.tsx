import { providerContextReadState } from "@/modules/provider/data/spaces/organization-context";
import { ProviderReadState } from "@/modules/provider/ui/provider-read-state";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { loadProviderQuotes } from "@/modules/provider/data/quotes/repository";
import { filterInvitationsByQuoteTab, filterListRows, providerSearchQuery, quoteRowsFromInvitations } from "@/modules/provider/data/spaces/list-rows";
import { QuotesBoard } from "@/modules/provider/screens/spaces/boards";
import { getProviderQuoteMessages } from "@/modules/provider/screens/devis/messages";
import { loadQuotePrefills } from "@/modules/provider/screens/devis/prefill";
import { QuotePanel } from "@/modules/provider/screens/devis/quote-panel";
import { ProviderActions, ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderQuotesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; q?: string; tab?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/devis` }));
  const contextState = providerContextReadState(space, query.organizationId);
  const result = contextState ? { status: "error" as const, reason: "NO_ORGANIZATION" as const } : await loadProviderQuotes(space.selectedOrganizationId ?? undefined);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/devis` }));
  const m = getProviderQuoteMessages(locale);
  const c = providerCopy(locale);
  const boardQuery = providerSearchQuery(space.selectedQuery, { q: query.q, tab: query.tab });
  const prefills = result.status === "success"
    ? await loadQuotePrefills(result.dashboard.organizationId, result.dashboard.invitations.flatMap((item) => (item.quote?.currentVersionId ? [{ invitationId: item.id, versionId: item.quote.currentVersionId }] : [])), locale)
    : {};
  const rows = result.status === "success"
    ? filterListRows(quoteRowsFromInvitations(filterInvitationsByQuoteTab(result.dashboard.invitations, query.tab), locale, space.selectedQuery), query.q ?? "")
    : [];
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="quotes" title={c.quotesTitle} lead={c.quotesLead} kicker={c.kicker} actions={<ProviderActions href={`/${locale}/sous-traitant/devis/nouveau${space.selectedQuery}`} label={c.createQuote} />}>
      {result.status === "success" ? <QuotesBoard locale={locale} query={boardQuery} rows={rows} tab={query.tab} /> : <ProviderReadState locale={locale} state={contextState ?? (result.status === "error" && result.reason === "NO_ORGANIZATION" ? "forbidden" : "unavailable")} retryHref={`/${locale}/sous-traitant/devis${space.selectedQuery}`} unavailableMessage={m.loadError} reason={space.readError ?? (result.status === "error" ? result.reason : undefined)} />}
      {result.status === "success" ? <details id="devis-operation" className="client-ops">
        <summary>{c.opsQuotes}</summary>
          <QuotePanel dashboard={result.dashboard} locale={locale} m={m} prefills={prefills} identities={Object.fromEntries(result.dashboard.invitations.map((item) => [item.id, { decision: randomUUID(), revision: randomUUID(), submit: randomUUID(), correlation: randomUUID() }]))} />
      </details> : null}
    </ProviderAppShell>
  );
}
