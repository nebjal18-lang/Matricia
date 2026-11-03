import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadProviderDashboard } from "@/modules/provider/data/qualification/repository";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { providerSearchQuery } from "@/modules/provider/data/spaces/list-rows";
import { ServicesBoard } from "@/modules/provider/screens/spaces/boards";
import { ProviderActions, ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderServicesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; q?: string; domain?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/services` }));
  const result = await loadProviderDashboard(query.organizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/services` }));
  const c = providerCopy(locale);
  const needle = (query.q ?? "").trim().toLocaleLowerCase();
  const domain = (query.domain ?? "").trim();
  const services = result.status === "success"
    ? result.dashboard.services.filter((service) => !needle || `${service.code} ${service.label.fr} ${service.label.ar} ${service.libraryLabel.fr} ${service.libraryLabel.ar}`.toLocaleLowerCase().includes(needle))
    : [];
  const boardQuery = providerSearchQuery(space.selectedQuery, { q: query.q, domain: query.domain });
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="services" title={c.svcTitle} lead={c.svcLead} kicker={c.kicker} actions={<ProviderActions href={`/${locale}/sous-traitant/qualification${space.selectedQuery}#capacite`} label={c.addService} />}>
      <ServicesBoard regions={result.status==="success"?result.dashboard.regionCodes:[]} interventionModes={result.status==="success"?result.dashboard.interventionModes:[]} locale={locale} query={boardQuery} services={services} domain={domain || undefined} />
    </ProviderAppShell>
  );
}
