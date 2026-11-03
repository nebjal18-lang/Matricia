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
  searchParams: Promise<{ organizationId?: string }>,
) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(`/${locale}/connexion`);
  const m = getBillingMessages(locale);
  const result = await loadProviderBilling(query.organizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(`/${locale}/connexion`);
  const title = kind === "pre-releve" ? m.preReleve : kind === "factures" ? m.facturesMatricia : kind === "echeancier" ? m.echeancier : m.commissionsTitle;
  const lead = kind === "pre-releve" ? m.preReleveLead : kind === "factures" ? m.facturesMatriciaLead : kind === "echeancier" ? m.echeancierLead : m.commissionsLead;
  if (result.status === "error") {
    return (
      <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={title} lead={lead}>
        <Alert variant={result.reason === "NO_BILLING_ORGANIZATION" ? "default" : "destructive"}>
          <AlertTitle>{result.reason === "NO_BILLING_ORGANIZATION" ? m.noOrg : m.loadError}</AlertTitle>
          <AlertDescription>{result.reason}</AlertDescription>
        </Alert>
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
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={title} lead={lead}>
      <ProviderLedgerBoard locale={locale} query={space.selectedQuery} kind={kind} dashboard={result.dashboard} receipts={commissions?.status === "success" ? commissions.receipts : []} planKey={kind === "echeancier" ? crypto.randomUUID() : undefined} />
    </ProviderAppShell>
  );
}
