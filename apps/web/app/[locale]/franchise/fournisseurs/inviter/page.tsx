import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { loadFranchiseCrm } from "@/modules/franchise/data/crm/repository";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { FranchiseInviteForms } from "@/modules/franchise/screens/network/invite-form";
import { franchiseMandateName, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { MandateBanner } from "@/modules/franchise/screens/library/library-boards";
import { FranchiseMandateRail } from "@/modules/franchise/screens/library/library-chrome";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchiseInvitePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  const crm = await loadFranchiseCrm();
  if (crm.status === "error" && crm.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/franchise/fournisseurs/inviter` }));
  const c = franchiseCopy(locale);
  const mandateName = franchiseMandateName(result);
  const writable = crm.status === "success" ? crm.dashboard.franchises.find((item) => item.canWrite && item.territory) : null;
  return (
    <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="network" title={c.inviteTitle} lead={c.inviteLead} kicker={c.inviteHint} mandateName={mandateName}>
      <main className="client-page">
        <MandateBanner locale={locale} name={mandateName ?? c.mandate} />
        <section className="franchise-workbench">
          <article className="client-card">
            <header><h2>{c.inviteTitle}</h2></header>
            {crm.status === "error" ? (
              <Alert variant="destructive">
                <AlertTitle>{crm.reason}</AlertTitle>
                <AlertDescription>{c.inviteUnavailable}</AlertDescription>
              </Alert>
            ) : !writable?.territory ? (
              <p>{c.inviteUnavailable}</p>
            ) : (
              <FranchiseInviteForms
                locale={locale}
                organizationId={space.selectedOrganizationId}
                franchiseId={writable.id}
                territoryVersionId={writable.territory.id}
                ownerUserId={crm.dashboard.currentUserId}
                keys={{ invite: randomUUID(), csv: randomUUID() }}
              />
            )}
          </article>
          <FranchiseMandateRail locale={locale} name={mandateName} />
        </section>
      </main>
    </FranchiseAppShell>
  );
}
