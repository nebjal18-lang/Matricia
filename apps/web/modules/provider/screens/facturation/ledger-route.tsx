import{providerContextReadState}from"@/modules/provider/data/spaces/organization-context";
import{ProviderReadState}from"@/modules/provider/ui/provider-read-state";
import{connexionHref}from"@/modules/shared/lib/auth/connexion-href";
import{loadBillingWorkspace}from"@/modules/provider/data/billing/workspace";
import{ProviderBillingWorkspace}from"./workspace-panel";
import{ProviderListPagination}from"@/modules/provider/ui/list-pagination";
import { notFound, redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { loadProviderBilling, loadProviderCommissions } from "@/modules/provider/data/billing/repository";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { ProviderLedgerBoard, type LedgerKind } from "@/modules/provider/screens/facturation/ledger-board";
import { getBillingMessages } from "@/modules/provider/screens/facturation/messages";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export async function renderProviderLedgerPage(
  kind: LedgerKind,
  params: Promise<{ locale: string }>,
  searchParams: Promise<{ organizationId?: string;page?:string }>,
) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  const path=`/${locale}/sous-traitant/facturation/${kind==="factures"?"factures-matricia":kind==="commissions"?"commissions":kind}`;
  const retryHref=path+(query.organizationId?`?organizationId=${encodeURIComponent(query.organizationId)}`:"")+(query.page?`${query.organizationId?"&":"?"}page=${encodeURIComponent(query.page)}`:"");
  if (space.status === "unauthenticated") redirect(connexionHref(locale,{next:retryHref}));
  const m = getBillingMessages(locale);
  const title = kind === "pre-releve" ? m.preReleve : kind === "factures" ? m.facturesMatricia : kind === "echeancier" ? m.echeancier : m.commissionsTitle;
  const lead = kind === "pre-releve" ? m.preReleveLead : kind === "factures" ? m.facturesMatriciaLead : kind === "echeancier" ? m.echeancierLead : m.commissionsLead;
  const blocked=providerContextReadState(space,query.organizationId);
  if(blocked)return<ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={title} lead={lead}><ProviderReadState locale={locale} state={blocked} retryHref={retryHref}/></ProviderAppShell>;
  const result = await loadProviderBilling(space.selectedOrganizationId!,undefined,Math.max(1,Math.min(100000,Number.parseInt(query.page??"1",10)||1)));
  if(result.status==="error"&&result.reason==="UNAUTHENTICATED")redirect(connexionHref(locale,{next:retryHref}));
  if (result.status === "error") {
    return (
      <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={title} lead={lead}>
        <ProviderReadState locale={locale} state={result.reason==="FORBIDDEN"?"forbidden":result.reason==="NO_BILLING_ORGANIZATION"?"no-organization":"unavailable"} retryHref={retryHref}/>
      </ProviderAppShell>
    );
  }
  const commissions = kind === "commissions" ? await loadProviderCommissions(result.dashboard.organizationId) : null;
  if (commissions && commissions.status === "error") {
    return (
      <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={title} lead={lead}>
        <Alert variant="destructive"><AlertTitle>{m.loadError}</AlertTitle><AlertDescription>{commissions.reason}</AlertDescription></Alert>
      </ProviderAppShell>
    );
  }
  const workspace=kind==="pre-releve"?await loadBillingWorkspace(result.dashboard.organizationId):null;
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={title} lead={lead}>
      {kind==="pre-releve"?(workspace?<ProviderBillingWorkspace value={workspace} locale={locale} organizationId={result.dashboard.organizationId}/>:<p role="alert">{locale==="ar"?"تعذر تحميل الكشف الأولي.":"Impossible de charger le pré-relevé."}</p>):null}
      <ProviderListPagination locale={locale} path={`/${locale}/sous-traitant/facturation/${kind==="factures"?"factures-matricia":kind==="commissions"?"commissions":kind}`} query={space.selectedQuery} page={result.dashboard.listPage??1} hasMore={Boolean(result.dashboard.hasMoreInvoices)}/>
      <ProviderLedgerBoard locale={locale} query={space.selectedQuery} kind={kind} dashboard={result.dashboard} receipts={commissions?.status === "success" ? commissions.receipts : []} planKey={kind === "echeancier" ? crypto.randomUUID() : undefined} />
    </ProviderAppShell>
  );
}
