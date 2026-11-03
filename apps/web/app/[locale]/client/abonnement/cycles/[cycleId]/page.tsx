import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { SubscriptionInvoice } from "@/modules/client/screens/abonnement/subscription-invoice";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadSubscriptionDashboard } from "@/modules/shared/lib/subscriptions/repository";

export default async function SubscriptionInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; cycleId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { locale, cycleId } = await params;
  const { organizationId } = await searchParams;
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/abonnement/cycles/${cycleId}` }));
  const result = await loadSubscriptionDashboard(organizationId ?? space.selectedOrganizationId ?? undefined);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/abonnement/cycles/${cycleId}` }));
  const c = spaceCopy(locale);
  if (result.status === "error") {
    return (
      <ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="finance" title={c.latestInvoices} lead={c.subPageLead} kicker={c.kicker}>
        <p role="alert" className="client-card">{locale === "ar" ? "تعذر عرض تفاصيل الدورة." : "Le détail du cycle ne peut pas être affiché."}</p>
      </ClientAppShell>
    );
  }
  const cycle = result.dashboard.subscription?.cycles.find((item) => item.id === cycleId);
  if (!cycle) notFound();
  return (
    <ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="finance" title={c.latestInvoices} lead={result.dashboard.organizationName} kicker={c.kicker}>
      <SubscriptionInvoice locale={locale} query={space.selectedQuery} organizationName={result.dashboard.organizationName} cycle={cycle} />
    </ClientAppShell>
  );
}
