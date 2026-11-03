import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadClientPortfolio } from "@/modules/client/data/portfolio/server-repository";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { getMessages } from "@/modules/client/screens/portefeuille/messages";
import { PortfolioPanel } from "@/modules/client/screens/portefeuille/portfolio-panel";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ClientPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/portefeuille` }));
  const result = await loadClientPortfolio(space.selectedOrganizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/portefeuille` }));
  const m = getMessages(locale);
  if (result.status === "error") {
    return (
      <ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="portfolio" title={m.title} lead={m.intro} kicker={spaceCopy(locale).kicker}>
        <main className="client-page"><p role="alert" className="client-card">{locale === "ar" ? "تعذر تحميل المحفظة." : "Impossible de charger le portefeuille."}</p></main>
      </ClientAppShell>
    );
  }
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="portfolio"
      title={m.title}
      lead={m.intro}
      kicker={spaceCopy(locale).kicker}
    >
      <PortfolioPanel
        locale={locale}
        data={result.value}
        m={m}
        embedded
        keys={{ site: randomUUID(), project: randomUUID(), task: randomUUID(), contract: randomUUID(), budget: randomUUID(), center: randomUUID(), allocation: randomUUID(), event: randomUUID() }}
      />
    </ClientAppShell>
  );
}
