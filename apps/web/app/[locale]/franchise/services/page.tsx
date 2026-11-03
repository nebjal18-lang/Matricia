import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { FranchiseServicesWorkbench } from "@/modules/franchise/screens/library/library-workbenches";
import { requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseSecurityPanel } from "@/modules/franchise/screens/library/library-chrome";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseServicesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string;page?:string;q?:string;status?:string;category?:string;language?:string;completeness?:string;validation?:string; serviceId?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ locale, organizationId: query.organizationId, franchiseId:query.franchiseId,catalog:{kind:"SERVICE",page:query.page,search:query.q,status:query.status,categoryId:query.category,language:query.language,completeness:query.completeness,validation:query.validation,objectId:query.serviceId} });
  const c = libraryCopy(locale);
  return (
    <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="services" title={c.servicesTitle} lead={c.servicesLead} kicker={c.scope} mandateName={result.status === "success" ? result.workspace.mandate.libraryName : null} actions={result.status === "success" ? <FranchiseSecurityPanel locale={locale} /> : null}>
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/services`} />
      {result.status === "error" ? (
        <FranchiseAccessState locale={locale} reason={result.reason} returnPath={`/${locale}/franchise/services${space.selectedQuery}`} />
      ) : (
        <FranchiseServicesWorkbench
          locale={locale}
          query={space.selectedQuery}
          workspace={result.workspace}
          selectedId={query.serviceId ?? null}
          createMode={false}
          organizationId={space.selectedOrganizationId}
          commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }}
        />
      )}
    </FranchiseAppShell>
  );
}
