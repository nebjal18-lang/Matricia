import { ProviderListPagination } from "@/modules/provider/ui/list-pagination";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { loadProviderBilling } from "@/modules/provider/data/billing/repository";
import { BillingBoard } from "@/modules/provider/screens/spaces/boards";
import { BillingPanel } from "@/modules/provider/screens/facturation/billing-panel";
import { getBillingMessages } from "@/modules/provider/screens/facturation/messages";
import { loadBillingMissionOptions } from "@/modules/provider/screens/facturation/options";
import { ProviderActions, ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderBillingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string;page?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/facturation` }));
  const m = getBillingMessages(locale);
  const c = providerCopy(locale);
  const result = await loadProviderBilling(query.organizationId,undefined,/^\d{1,6}$/.test(query.page??"")?Number(query.page):1);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/facturation` }));
  const missions = result.status === "success" ? await loadBillingMissionOptions(result.dashboard.organizationId, locale) : [];
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={c.finTitle} lead={c.finLead} kicker={c.kicker} actions={<ProviderActions href="#facturation-operation" label={c.createInvoice} />}>
      {result.status==="success"?<ProviderListPagination locale={locale} path={`/${locale}/sous-traitant/facturation`} query={space.selectedQuery} page={result.dashboard.listPage??1} hasMore={Boolean(result.dashboard.hasMoreInvoices)}/>:null}
      <BillingBoard locale={locale} query={space.selectedQuery} dashboard={result.status === "success" ? result.dashboard : null} />
      <details id="facturation-operation" className="client-ops">
        <summary>{c.opsBilling}</summary>
        {result.status === "error" ? (
          <Alert variant={result.reason === "NO_BILLING_ORGANIZATION" ? "default" : "destructive"}><AlertTitle>{result.reason === "NO_BILLING_ORGANIZATION" ? m.noOrg : m.loadError}</AlertTitle><AlertDescription>{result.reason}</AlertDescription></Alert>
        ) : (
          <BillingPanel dashboard={result.dashboard} missions={missions} locale={locale} m={m} keys={Array.from({ length: 6 }, () => crypto.randomUUID())} />
        )}
      </details>
    </ProviderAppShell>
  );
}
