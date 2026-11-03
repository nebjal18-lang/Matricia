import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { ClientOfferDetailView } from "@/modules/client/screens/demandes/offer-detail";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { loadClientOfferDetail } from "@/modules/client/data/rfq/quote-detail-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; requestId: string; quoteId: string }>;
  searchParams: Promise<{ organizationId?: string;versionId?:string }>;
}) {
  const [{ locale, requestId, quoteId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const selectedOrganizationId = typeof query.organizationId === "string" ? query.organizationId : null;
  const selectedQuery = selectedOrganizationId ? `?organizationId=${encodeURIComponent(selectedOrganizationId)}` : "";
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  const organizationName = selectedOrganizationId
    ? (await client.from("organizations").select("display_name").eq("id", selectedOrganizationId).limit(1)).data?.[0]?.display_name ?? null
    : null;
  const result = await loadClientOfferDetail({
    locale,
    requestId,
    quoteId,
    organizationQuery: selectedQuery,
    organizationName,
    versionId:query.versionId,
  });
  if (result.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/demandes/${requestId}/offres/${quoteId}` }));
  if (result.status === "not_found") notFound();
  if (result.status === "error") {
    return (
      <ClientAppShell
        locale={locale}
        selectedQuery={selectedQuery}
        selectedOrganizationId={selectedOrganizationId}
        userEmail={auth.user?.email ?? null}
        organizationName={organizationName}
        active="requests"
        title={locale === "ar" ? "عرض التفصيل" : "Détail de l’offre"}
        lead={locale === "ar" ? "تعذر تحميل هذا العرض." : "Impossible de charger cette offre."}
      >
        <main className="client-page"><p role="alert" className="client-card">{locale === "ar" ? "تعذر تحميل تفاصيل العرض." : "Impossible de charger le détail de l’offre."}</p></main>
      </ClientAppShell>
    );
  }
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={selectedQuery}
      selectedOrganizationId={selectedOrganizationId}
      userEmail={auth.user?.email ?? null}
      organizationName={organizationName}
      active="requests"
    >
      <ClientOfferDetailView locale={locale} selectedQuery={selectedQuery} detail={result.value} />
    </ClientAppShell>
  );
}
