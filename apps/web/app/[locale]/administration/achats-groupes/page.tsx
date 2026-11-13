import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadAdminVolumeDemand } from "@/modules/admin/data/catalog/repository";
import { loadAdminVolume } from "@/modules/admin/data/volume/repository";
import { loadAdminProviders } from "@/modules/admin/data/providers/repository";
import { AdminVolumePanel } from "@/modules/admin/screens/achats-groupes/admin-volume-panel";
import { VolumeDemandPanel } from "@/modules/admin/screens/achats-groupes/volume-demand-panel";
import { VolumeNegotiatePanel } from "@/modules/admin/screens/achats-groupes/volume-negotiate-panel";
import { getMessages } from "@/modules/admin/screens/achats-groupes/messages";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const [result, demand, providers] = await Promise.all([loadAdminVolume(), loadAdminVolumeDemand(), loadAdminProviders()]);
  const providerOptions = providers.status === "success" ? providers.dashboard.providers.map((item) => ({ id: item.organizationId, name: item.organizationName })) : [];
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/achats-groupes` }));
  return (
    <AdminModulePage locale={locale} active="parcours" parcoursCurrent="recurring" path="achats-groupes" title={m.title} lead={m.description}>
      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{result.reason === "FORBIDDEN" ? m.forbidden : m.unavailable}</AlertTitle>
          <AlertDescription>{result.reason === "FORBIDDEN" ? m.aggregateNotice : m.unavailable}</AlertDescription>
        </Alert>
      ) : (
        <>
          <AdminVolumePanel locale={locale} dashboard={result.value} m={m} keys={{ allocate: randomUUID(), consume: randomUUID() }} />
          <VolumeNegotiatePanel locale={locale} dashboard={result.value} ownerOrganizationId={query.organizationId ?? result.value.agreements?.[0]?.owner_organization_id ?? null} providerOptions={providerOptions} keys={{ negotiate: randomUUID(), activate: randomUUID() }} />
          {demand.status === "success" ? <VolumeDemandPanel locale={locale} demand={demand.value} /> : null}
        </>
      )}
    </AdminModulePage>
  );
}
