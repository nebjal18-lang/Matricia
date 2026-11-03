import { randomUUID } from "node:crypto";
import { loadBenefitRequestContext } from "@/modules/client/screens/demandes/benefit-context";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerClientRfqRepository } from "@/modules/client/data/rfq/server-repository";
import { loadClientPortfolio } from "@/modules/client/data/portfolio/server-repository";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getClientRfqMessages } from "@/modules/client/screens/demandes/messages";
import { loadNeedRequestContext } from "@/modules/client/screens/demandes/need-context";
import { loadOpportunityRequestContext } from "@/modules/client/screens/demandes/opportunity-context";
import { RequestForm } from "@/modules/client/screens/demandes/request-form";
import { expiredDocuments } from "@/modules/client/data/documents/expiry";
import { loadClientDocumentVault } from "@/modules/client/data/documents/server-repository";
import { newRequestBlockReason } from "@/modules/client/screens/abonnement/entitlement";
import { loadSubscriptionDashboard } from "@/modules/shared/lib/subscriptions/repository";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";

function nouvelleQuery(query: { benefitRedemptionId?:string; opportunityId?: string; intakeId?: string; serviceCode?: string; organizationId?: string }): string {
  const params = new URLSearchParams();
  if (query.benefitRedemptionId) params.set("benefitRedemptionId",query.benefitRedemptionId);
  if (query.opportunityId) params.set("opportunityId", query.opportunityId);
  if (query.intakeId) params.set("intakeId", query.intakeId);
  if (query.serviceCode) params.set("serviceCode", query.serviceCode);
  if (query.organizationId) params.set("organizationId", query.organizationId);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export default async function NewRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ benefitRedemptionId?:string; opportunityId?: string; intakeId?: string; serviceCode?: string; organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  const nextPath = `/${locale}/client/demandes/nouvelle${nouvelleQuery(query)}`;
  if (space.status === "unauthenticated") {
    redirect(`/${locale}/connexion?next=${encodeURIComponent(nextPath)}`);
  }
  const result = await (await createServerClientRfqRepository()).list();
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") {
    redirect(`/${locale}/connexion?next=${encodeURIComponent(nextPath)}`);
  }
  const messages = getClientRfqMessages(locale);
  const c = spaceCopy(locale);
  const benefit=query.benefitRedemptionId&&!query.opportunityId&&!query.intakeId?await loadBenefitRequestContext(query.benefitRedemptionId,space.selectedOrganizationId):null;
  if(benefit?.existing_request_id)redirect(`/${locale}/client/demandes/${benefit.existing_request_id}?organizationId=${benefit.organization_id}`);
  const opportunity = !query.benefitRedemptionId&&query.opportunityId ? await loadOpportunityRequestContext(query.opportunityId,space.selectedOrganizationId) : null;
  if(opportunity&&opportunity.organizationId!==space.selectedOrganizationId){if(query.organizationId)notFound();redirect(`/${locale}/client/demandes/nouvelle?${new URLSearchParams({opportunityId:opportunity.opportunityId,organizationId:opportunity.organizationId})}`);}
  if(opportunity?.existingRequestId)redirect(`/${locale}/client/demandes/${opportunity.existingRequestId}?organizationId=${opportunity.organizationId}`);
  const need = !opportunity && query.intakeId
    ? await loadNeedRequestContext(query.intakeId, query.serviceCode, space.selectedOrganizationId ?? undefined)
    : null;
  const organizationId = benefit?.organization_id ?? opportunity?.organizationId ?? need?.organizationId;
  const organization = organizationId && result.status === "success"
    ? result.value.organizations.find((item) => item.id === organizationId)
    : null;
  const formContext = benefit && organization ? {source:"benefit" as const,redemptionId:benefit.redemption_id,rowVersion:benefit.row_version,idempotencyKey:randomUUID(),organizationId:benefit.organization_id,organizationName:organization.name,serviceName:locale==="ar"?benefit.service_name_ar:benefit.service_name_fr,title:locale==="ar"?benefit.benefit_name_ar:benefit.benefit_name_fr,description:""} : opportunity && organization
    ? {
        source: "opportunity" as const,
        opportunityId: opportunity.opportunityId,
        organizationId: opportunity.organizationId,
        organizationName: organization.name,
        serviceName: locale === "ar" ? opportunity.serviceNameAr : opportunity.serviceNameFr,
        title: locale === "ar" ? opportunity.titleAr : opportunity.titleFr,
        description: locale === "ar" ? opportunity.descriptionAr : opportunity.descriptionFr,
        siteId: opportunity.siteId,
      }
    : need && organization
      ? {
          source: "need" as const,
          intakeId: need.intakeId,
          serviceCode: need.serviceCode,
          organizationId: need.organizationId,
          organizationName: organization.name,
          serviceName: locale === "ar" ? need.serviceNameAr : need.serviceNameFr,
          title: locale === "ar" ? need.titleAr : need.titleFr,
          description: need.description,
          regionCode: need.regionCode,
        }
      : null;
  const portfolio = formContext ? await loadClientPortfolio(formContext.organizationId) : null;
  const sites = portfolio?.status === "success"
    ? portfolio.value.sites.map((site) => ({ id: site.id, nameFr: site.nameFr, nameAr: site.nameAr }))
    : [];
  const entitlementOrgId = formContext?.organizationId ?? space.selectedOrganizationId;
  const subscription = entitlementOrgId ? await loadSubscriptionDashboard(entitlementOrgId) : { status: "error" as const, reason: "UNAVAILABLE" as const };
  const vault = entitlementOrgId ? await loadClientDocumentVault(entitlementOrgId) : { status: "error" as const, reason: "UNAVAILABLE" as const };
  const block = newRequestBlockReason({
    subscriptionStatus: subscription.status === "success" ? subscription.dashboard.subscription?.status : undefined,
    expiredDocumentCount: vault.status === "success" ? vault.value.expiredDocumentCount ?? expiredDocuments(vault.value.documents).length : 0,
  });
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="requests"
      title={c.newRequestTitle}
      lead={c.newRequestLead}
      kicker={c.kicker}
      actions={<Link href={`/${locale}/client/demandes${space.selectedQuery}`} className="client-ghost-link">{c.backToRequests}</Link>}
    >
      <main className="client-page">
        {block ? (
          <article className="client-card" role="alert">
            <p>{block === "document" ? messages.expiredDocumentBlock : messages.trialExpiredBlock}</p>
            <div className="client-offer-actions">
              <Link href={`/${locale}/client/${block === "document" ? "documents" : "abonnement"}${space.selectedQuery}`} className="client-cta">{block === "document" ? c.addDoc : messages.reactivateGold}</Link>
              <Link href={`/${locale}/client/demandes${space.selectedQuery}`} className="client-ghost-link">{c.backToRequests}</Link>
            </div>
          </article>
        ) : formContext ? (
          <RequestForm locale={locale} context={formContext} messages={messages} sites={sites} />
        ) : result.status === "error" ? (
          <p role="alert" className="client-card">{messages.loadError}</p>
        ) : (
          <article className="client-card" role="status">
            <p>{query.benefitRedemptionId || query.opportunityId || query.intakeId ? messages.contextError : messages.contextRequired}</p>
            <div className="client-offer-actions">
              <Link href={`/${locale}/client/diagnostics${space.selectedQuery}`} className="client-cta">{messages.openAnalysis}</Link>
              <Link href={`/${locale}/besoin${space.selectedQuery}`} className="client-ghost-link">{messages.describeNeed}</Link>
            </div>
          </article>
        )}
      </main>
    </ClientAppShell>
  );
}
