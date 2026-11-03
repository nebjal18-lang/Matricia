import { providerContextReadState } from "@/modules/provider/data/spaces/organization-context";
import { ProviderReadState } from "@/modules/provider/ui/provider-read-state";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadProviderDashboard } from "@/modules/provider/data/qualification/repository";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { ProviderDocumentsBoard } from "@/modules/provider/screens/spaces/boards";
import { ProviderActions, ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderDocumentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; q?: string; vue?: string; page?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/documents` }));
  const contextState = providerContextReadState(space, query.organizationId);
  const result = contextState ? { status: "error" as const, reason: "NO_PROVIDER_ORGANIZATION" as const } : await loadProviderDashboard(space.selectedOrganizationId ?? undefined, /^\d{1,6}$/.test(query.page??"")?Number(query.page):1,{search:(query.q??"").slice(0,120),kinds:query.vue==="qualification"?["LEGAL","FISCAL","INSURANCE","CERTIFICATION","LICENSE","ACCREDITATION"]:[]});
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/documents` }));
  const c = providerCopy(locale);
  const view = query.vue === "qualification" ? "qualification" as const : "all" as const;
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="documents" title={c.docsTitle} lead={c.docsLead} kicker={c.kicker} actions={<ProviderActions href={`/${locale}/sous-traitant/qualification${space.selectedQuery}#documents`} label={c.addPiece} />}>
      {result.status === "success" ? <ProviderDocumentsBoard page={result.dashboard.documentPage} hasMore={result.dashboard.documentsHasMore} locale={locale} query={space.selectedQuery} documents={result.dashboard.documents} search={query.q ?? ""} view={view} /> : <ProviderReadState locale={locale} state={contextState ?? (result.status === "error" && result.reason === "NO_PROVIDER_ORGANIZATION" ? "forbidden" : "unavailable")} retryHref={`/${locale}/sous-traitant/documents${space.selectedQuery}`} unavailableMessage={c.docsLoadError} reason={space.readError ?? (result.status === "error" ? result.reason : undefined)} />}
    </ProviderAppShell>
  );
}
