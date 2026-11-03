import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { listOrganizationRoles } from "@/app/[locale]/organisation/roles/actions";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { getPurchaseMessages, ProviderPurchasesBoard } from "@/modules/provider/screens/achats/purchases-board";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadSubscriptionDashboard } from "@/modules/shared/lib/subscriptions/repository";
import { loadVolumeProcurement } from "@/modules/shared/lib/volume-procurement/repository";

const CLIENT_ROLES = new Set(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING", "CLIENT_MEMBER", "CLIENT_VIEWER"]);

export default async function ProviderPurchasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/achats` }));
  const roles = await listOrganizationRoles();
  if (roles.status === "error" && roles.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/achats` }));
  const organizationId = space.selectedOrganizationId ?? (roles.status === "success" ? roles.organizations[0]?.id : null);
  const current = roles.status === "success" ? roles.organizations.find((item) => item.id === organizationId) ?? roles.organizations[0] : null;
  const hasClient = current?.currentRoles.some((role) => CLIENT_ROLES.has(role)) ?? false;
  const [subscription, volume] = hasClient && organizationId
    ? await Promise.all([loadSubscriptionDashboard(organizationId), loadVolumeProcurement(organizationId)])
    : [null, null];
  const m = getPurchaseMessages(locale);
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="purchases" title={m.title} lead={m.lead}>
      <ProviderPurchasesBoard
        locale={locale}
        query={space.selectedQuery}
        hasClientRole={hasClient}
        subscription={subscription?.status === "success" ? subscription.dashboard : null}
        volume={volume?.status === "success" ? volume.dashboard : null}
      />
    </ProviderAppShell>
  );
}
