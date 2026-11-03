import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { createServerQuestionnaireSessionsRepository } from "@/modules/shared/lib/questionnaire-sessions/server-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { getQuestionnaireMessages } from "@/modules/client/screens/questionnaires/messages";
import { QuestionnairePanel } from "@/modules/client/screens/questionnaires/questionnaire-panel";
import { loadClientPortfolio } from "@/modules/client/data/portfolio/server-repository";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import "@/modules/client/screens/diagnostics/diagnostic-connected.css";

export default async function ClientQuestionnairesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ session?: string; organizationId?: string }> }) {
  const { locale } = await params;
  const { session, organizationId } = await searchParams;
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/questionnaires` }));
  const messages = getQuestionnaireMessages(locale);
  const repository = await createServerQuestionnaireSessionsRepository();
  const [result, portfolio] = await Promise.all([repository.load(session, space.selectedOrganizationId), loadClientPortfolio(organizationId ?? space.selectedOrganizationId ?? undefined)]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/questionnaires` }));
  const sites = portfolio.status === "success" ? portfolio.value.sites.map((site) => ({ id: site.id, nameFr: site.nameFr, nameAr: site.nameAr })) : [];
  const alternate = locale === "fr" ? "ar" : "fr";
  const query = new URLSearchParams({ ...(session ? { session } : {}), ...(organizationId ? { organizationId } : {}) }).toString();
  const organizationQuery = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="needs"
      title={messages.title}
      lead={messages.description}
      kicker={spaceCopy(locale).kicker}
      actions={<Link href={`/${alternate}/client/questionnaires${query ? `?${query}` : ""}`} hrefLang={alternate} className="client-soft-link">{messages.language}</Link>}
    >
      <main className="client-page space-y-6">
        <div className="diag-conn">
          <div className="diag-conn-progress-bar" aria-hidden="true">
            <span>{locale === "fr" ? "Questionnaire versionné" : "استبيان بإصدار"}</span>
            <span>{locale === "fr" ? "Autosauvegarde active" : "حفظ تلقائي نشط"}</span>
            <span>{locale === "fr" ? "Méthodologie versionnée" : "منهجية بإصدار"}</span>
          </div>
        </div>
        <Alert>
          <AlertTitle>{messages.privacyTitle}</AlertTitle>
          <AlertDescription>{messages.privacy}</AlertDescription>
        </Alert>
        {result.status === "error" ? (
          <Alert variant={result.reason === "NO_CLIENT_ORGANIZATION" || result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? "default" : "destructive"}>
            <AlertTitle>
              {result.reason === "FORBIDDEN" ? messages.forbidden
                : result.reason === "BOUNDS_EXCEEDED" ? messages.bounds
                : result.reason === "NO_CLIENT_ORGANIZATION" ? messages.noOrg
                : result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? messages.selectOrg
                : messages.loadError}
            </AlertTitle>
            <AlertDescription>
              {result.reason === "ORGANIZATION_SELECTION_REQUIRED" && result.organizations?.length ? (
                <ul className="mt-3 grid gap-2">
                  {result.organizations.map((organization) => (
                    <li key={organization.id}>
                      <Link className="underline" href={`/${locale}/client/questionnaires?organizationId=${encodeURIComponent(organization.id)}`}>{organization.name}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Link className="underline" href={`/${locale}/client/questionnaires${organizationQuery}`}>{messages.retry}</Link>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <QuestionnairePanel
            locale={locale}
            dashboard={result.value}
            messages={messages}
            sites={sites}
            identities={{
              start: { idempotencyKey: randomUUID(), correlationId: randomUUID() },
              submit: { idempotencyKey: randomUUID(), correlationId: randomUUID() },
              answers: Object.fromEntries((result.value.selected?.sections ?? []).flatMap((section) => section.questions.map((question) => [question.id, { idempotencyKey: randomUUID(), correlationId: randomUUID() }]))),
            }}
          />
        )}
      </main>
    </ClientAppShell>
  );
}
