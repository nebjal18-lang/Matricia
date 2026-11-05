import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadRewardsDashboard } from "@/modules/shared/lib/rewards-referrals-roi/repository";
import { getValueMessages } from "@/modules/client/screens/recompenses/messages";
import { ValuePanel } from "@/modules/client/screens/recompenses/value-panel";
import { RewardsBoard } from "@/modules/client/screens/spaces/rewards-board";

export default async function RewardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { locale } = await params;
  const { organizationId } = await searchParams;
  if (!isLocale(locale)) notFound();

  const space = await resolveClientSpace({ locale, organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/recompenses` }));

  const result = await loadRewardsDashboard(space.selectedOrganizationId ?? organizationId);
  const messages = getValueMessages(locale);
  const c = spaceCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";

  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/recompenses` }));

  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName} organizations={space.organizations}
      active="rewards"
      title={messages.title}
      lead={messages.intro}
      kicker={space.organizationName ?? c.kicker}
      actions={
        <Link href={`/${alternate}/client/recompenses${space.selectedQuery}`} hrefLang={alternate} lang={alternate} className="client-text-link">
          {messages.language}
        </Link>
      }
    >
      {result.status === "error" ? (
        <Alert variant={result.reason === "NO_ORGANIZATION" || result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? "default" : "destructive"}>
          <AlertTitle>{result.reason === "NO_ORGANIZATION" || result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? messages.noOrg : messages.loadError}</AlertTitle>
          <AlertDescription>{result.reason}</AlertDescription>
        </Alert>
      ) : (
        <RewardsBoard locale={locale} query={space.selectedQuery} dashboard={result.dashboard}>
          <details className="client-ops">
            <summary>{messages.rules}</summary>
            <ValuePanel dashboard={result.dashboard} locale={locale} m={messages} />
          </details>
        </RewardsBoard>
      )}
    </ClientAppShell>
  );
}
