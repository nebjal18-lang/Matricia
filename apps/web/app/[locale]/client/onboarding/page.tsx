import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { Badge } from "@/modules/shared/ui/badge";
import { buttonVariants } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import { cn } from "@/modules/shared/lib/utils";
import { listClientOnboarding, type ClientOnboardingOrganization, type ComplianceStatus } from "@/modules/client/screens/onboarding/actions";
import { formatVersionMessage, getClientOnboardingMessages, type ClientOnboardingMessages } from "@/modules/client/screens/onboarding/messages";
import { ClientProfileForm } from "@/modules/client/screens/onboarding/profile-form";
import { ClientDocumentUploadForm } from "@/modules/client/screens/onboarding/document-upload-form";
import { SubmitComplianceForm } from "@/modules/client/screens/onboarding/submit-form";
import { ClientQuestionResponseForm } from "@/modules/client/screens/onboarding/question-response-form";
import { onboardingProgressIndex } from "@/modules/client/screens/onboarding/progress";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";

const editableStatuses = new Set<ComplianceStatus>([
  "PROFILE_IN_PROGRESS", "DOCUMENTS_REQUIRED", "QUESTION_REQUIRED", "REJECTED",
]);
const submittableStatuses = new Set<ComplianceStatus>(["PROFILE_IN_PROGRESS", "DOCUMENTS_REQUIRED"]);

function dateLabel(value: string | null, locale: Locale): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Progress({ organizationId, status, trialStatus, locale, messages }: { organizationId: string; status: ComplianceStatus | null; trialStatus?: "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | null; locale: Locale; messages: ClientOnboardingMessages }) {
  const current = onboardingProgressIndex(status, trialStatus);
  return (
    <section aria-labelledby={`progress-${organizationId}`} className="space-y-3">
      <h3 id={`progress-${organizationId}`} className="font-semibold">{messages.progressTitle}</h3>
      <ol className="grid gap-2 text-sm sm:grid-cols-5">
        {messages.progress.map((label, index) => (
          <li key={label} aria-current={index === current ? "step" : undefined} className={cn(
            "rounded-lg border p-3",
            index <= current ? "border-primary/40 bg-primary/5 text-foreground" : "bg-muted/30 text-muted-foreground",
          )}>
            <span className="font-semibold" aria-hidden="true">{new Intl.NumberFormat(locale === "fr" ? "fr-MA" : "ar-MA").format(index + 1)}. </span>{label}
          </li>
        ))}
      </ol>
    </section>
  );
}

function OrganizationOnboarding({ organization, locale, messages }: {
  organization: ClientOnboardingOrganization;
  locale: Locale;
  messages: ClientOnboardingMessages;
}) {
  const complianceCase = organization.complianceCase;
  const editable = !complianceCase || editableStatuses.has(complianceCase.status);
  const canSubmit = Boolean(complianceCase?.currentProfileVersion && submittableStatuses.has(complianceCase.status));
  return (
    <article className="space-y-6" aria-labelledby={`organization-${organization.id}`}>
      <Card className="overflow-hidden shadow-lg">
        <CardHeader className="border-b bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle id={`organization-${organization.id}`} className="break-words text-xl">{organization.displayName}</CardTitle>
              <CardDescription>{organization.legalName}</CardDescription>
            </div>
            <Badge variant="outline">{messages.organizationStatuses[organization.organizationStatus]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <section aria-labelledby={`passport-${organization.id}`} className="space-y-3">
            <h2 id={`passport-${organization.id}`} className="text-lg font-semibold">{messages.passportTitle}</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{messages.legalName}</dt><dd className="mt-1 break-words font-medium">{organization.legalName}</dd></div>
              <div><dt className="text-muted-foreground">{messages.tradeName}</dt><dd className="mt-1 break-words font-medium">{organization.displayName}</dd></div>
              <div><dt className="text-muted-foreground">{messages.organizationStatus}</dt><dd className="mt-1 font-medium">{messages.organizationStatuses[organization.organizationStatus]}</dd></div>
              <div><dt className="text-muted-foreground">{messages.ice}</dt><dd className="mt-1 flex flex-wrap items-center gap-2 font-medium" dir="ltr"><span className="break-all">{organization.ice ?? messages.iceUnknown}</span>{organization.iceVerificationStatus ? <Badge variant="secondary">{messages.identifierStatuses[organization.iceVerificationStatus]}</Badge> : null}</dd></div>
            </dl>
          </section>

          <section aria-labelledby={`questions-${organization.id}`} className="space-y-4">
            <div><h2 id={`questions-${organization.id}`} className="text-lg font-semibold">{messages.questionsTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{messages.questionsDescription}</p></div>
            {organization.anomalies.length === 0 && organization.questions.length === 0 ? <p className="text-sm text-muted-foreground">{messages.questionsEmpty}</p> : null}
            {organization.anomalies.length > 0 ? (
              <ul className="grid gap-3">
                {organization.anomalies.map((anomaly, index) => (
                  <li key={`${anomaly.createdAt}-${index}`} className="flex flex-col gap-2 rounded-lg border p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
                    <p className="break-words">{anomaly.message}</p>
                    <div className="flex shrink-0 flex-wrap gap-2"><Badge variant={anomaly.blocking ? "destructive" : "outline"}>{messages.anomalySeverities[anomaly.severity]}</Badge><Badge variant="outline">{messages.anomalyStatuses[anomaly.status]}</Badge></div>
                  </li>
                ))}
              </ul>
            ) : null}
            {organization.questions.map((question) => (
              <article key={question.id} className="space-y-4 rounded-xl border bg-muted/20 p-4" aria-labelledby={`question-${question.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><h3 id={`question-${question.id}`} className="max-w-3xl break-words font-semibold">{question.text}</h3><Badge>{messages.questionStatuses[question.status]}</Badge></div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">{messages.questionDue}</dt><dd><time dateTime={question.dueAt}>{dateLabel(question.dueAt, locale) ?? messages.unavailable}</time></dd></div>
                  {question.expectedDocumentType ? <div><dt className="text-muted-foreground">{messages.questionExpectedDocument}</dt><dd className="break-words">{messages.evidenceTypes[question.expectedDocumentType as keyof typeof messages.evidenceTypes] ?? question.expectedDocumentType}</dd></div> : null}
                  {question.latestResponseVersion ? <div><dt className="text-muted-foreground">{messages.questionLatestResponse}</dt><dd>{formatVersionMessage(messages.questionResponseVersion, question.latestResponseVersion)}</dd></div> : null}
                </dl>
                {question.status === "OPEN" || question.status === "ANSWERED" ? <ClientQuestionResponseForm questionId={question.id} locale={locale} idempotencyKey={randomUUID()} messages={messages} /> : null}
              </article>
            ))}
          </section>

          <Progress organizationId={organization.id} status={complianceCase?.status ?? null} trialStatus={organization.trial?.status ?? null} locale={locale} messages={messages} />

          <section aria-labelledby={`case-${organization.id}`} className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`case-${organization.id}`} className="text-lg font-semibold">{messages.caseTitle}</h2>
              {complianceCase ? <Badge>{messages.statuses[complianceCase.status]}</Badge> : null}
            </div>
            {complianceCase ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">{messages.caseStatus}</dt><dd className="mt-1 font-medium">{messages.statuses[complianceCase.status]}</dd></div>
                <div><dt className="text-muted-foreground">{messages.version}</dt><dd className="mt-1 font-medium">{complianceCase.currentProfileVersion ?? messages.unavailable}</dd></div>
                <div><dt className="text-muted-foreground">{messages.updated}</dt><dd className="mt-1 font-medium"><time dateTime={complianceCase.updatedAt}>{dateLabel(complianceCase.updatedAt, locale) ?? messages.unavailable}</time></dd></div>
                {complianceCase.submittedAt ? <div><dt className="text-muted-foreground">{messages.submitted}</dt><dd className="mt-1 font-medium"><time dateTime={complianceCase.submittedAt}>{dateLabel(complianceCase.submittedAt, locale) ?? messages.unavailable}</time></dd></div> : null}
              </dl>
            ) : <p className="text-sm text-muted-foreground">{messages.noCase}</p>}
            {complianceCase?.decisionReasonPublic ? <p role="status" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><span className="font-semibold">{messages.reason} : </span>{complianceCase.decisionReasonPublic}</p> : null}
            {complianceCase?.status === "VERIFIED" ? <p role="status" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{messages.validationResultOk}</p> : null}
            {complianceCase?.status === "REJECTED" ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{messages.validationResultRejected}</p> : null}
          </section>

          <section aria-labelledby={`evidence-${organization.id}`} className="space-y-3">
            <h2 id={`evidence-${organization.id}`} className="text-lg font-semibold">{messages.evidenceTitle}</h2>
            {organization.evidence.length === 0 ? <p className="text-sm text-muted-foreground">{messages.evidenceEmpty}</p> : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {organization.evidence.map((item) => (
                  <li key={item.type} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span>{messages.evidenceTypes[item.type]}</span>
                    <Badge variant="outline">{messages.evidenceStatuses[item.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {organization.documents.length > 0 ? (
              <ul className="grid gap-3">
                {organization.documents.map((document) => (
                  <li key={`${document.type}-${document.version}`} className="space-y-3 rounded-lg border p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{messages.evidenceTypes[document.type]}</span>
                      <Badge variant="outline">{messages.documentStatuses[document.status]}</Badge>
                    </div>
                    <dl className="grid gap-2 sm:grid-cols-2">
                      <div><dt className="text-muted-foreground">{messages.documentVersion}</dt><dd>{document.version}</dd></div>
                      <div><dt className="text-muted-foreground">{messages.documentNumber}</dt><dd className="break-words">{document.documentNumber ?? messages.unavailable}</dd></div>
                      <div><dt className="text-muted-foreground">{messages.documentIssuer}</dt><dd className="break-words">{document.issuer ?? messages.unavailable}</dd></div>
                      <div><dt className="text-muted-foreground">{messages.documentFileName}</dt><dd className="break-all">{document.originalFileName}</dd></div>
                      <div><dt className="text-muted-foreground">{messages.documentIssuedOn}</dt><dd>{document.issuedOn ?? messages.unavailable}</dd></div>
                      <div><dt className="text-muted-foreground">{messages.documentExpiresOn}</dt><dd>{document.expiresOn ?? messages.unavailable}</dd></div>
                    </dl>
                    {document.rejectionReasonPublic ? <p role="status" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">{document.rejectionReasonPublic}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {complianceCase && editable ? (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <h3 className="font-semibold">{messages.documentUploadTitle}</h3>
                <ClientDocumentUploadForm complianceCaseId={complianceCase.id} locale={locale} idempotencyKey={randomUUID()} messages={messages} />
              </div>
            ) : null}
          </section>

          <section aria-labelledby={`profile-${organization.id}`} className="space-y-4">
            <div><h2 id={`profile-${organization.id}`} className="text-lg font-semibold">{messages.profileTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{messages.profileDescription}</p></div>
            {editable ? <ClientProfileForm organizationId={organization.id} locale={locale} idempotencyKey={randomUUID()} profile={organization.latestProfile?.data ?? null} messages={messages} />
              : <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{messages.lockedProfile}</p>}
          </section>

          {canSubmit && complianceCase ? (
            <section aria-labelledby={`submit-${organization.id}`} className="space-y-4 border-t pt-6">
              <div><h2 id={`submit-${organization.id}`} className="text-lg font-semibold">{messages.submitTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{messages.submitDescription}</p></div>
              <SubmitComplianceForm complianceCaseId={complianceCase.id} locale={locale} idempotencyKey={randomUUID()} messages={messages} />
            </section>
          ) : null}

          <section aria-labelledby={`trial-${organization.id}`} className="space-y-3 border-t pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 id={`trial-${organization.id}`} className="text-lg font-semibold">{messages.trialTitle}</h2>{organization.trial ? <Badge>{messages.trialStatuses[organization.trial.status]}</Badge> : null}</div>
            {organization.trial ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">{messages.trialStarted}</dt><dd className="mt-1 font-medium"><time dateTime={organization.trial.startedAt}>{dateLabel(organization.trial.startedAt, locale) ?? messages.unavailable}</time></dd></div>
                <div><dt className="text-muted-foreground">{messages.trialEnds}</dt><dd className="mt-1 font-medium"><time dateTime={organization.trial.endsAt}>{dateLabel(organization.trial.endsAt, locale) ?? messages.unavailable}</time></dd></div>
              </dl>
            ) : <p className="text-sm text-muted-foreground">{messages.trialNotStarted}</p>}
            {organization.trial?.status === "TRIAL_EXPIRED" ? (
              <Link href={`/${locale}/client/abonnement?organizationId=${encodeURIComponent(organization.id)}`} className={cn(buttonVariants(), "min-h-11 w-full sm:w-auto")}>{messages.reactivateGold}</Link>
            ) : null}
            <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{messages.noCard}</p>
          </section>
        </CardContent>
      </Card>
    </article>
  );
}

export default async function ClientOnboardingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/onboarding` }));
  const result = await listClientOnboarding(locale);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/onboarding` }));
  const messages = getClientOnboardingMessages(locale);
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName} organizations={space.organizations}
      active="company"
      title={messages.title}
      lead={messages.description}
      kicker={messages.eyebrow}
    >
      <main className="client-page space-y-8">
        <p className="rounded-lg border border-primary/20 bg-card p-3 text-sm text-muted-foreground">{messages.privacyNotice}</p>
        {result.status === "error" ? (
          <Alert variant="destructive"><AlertTitle>{messages.loadErrorTitle}</AlertTitle><AlertDescription><p>{messages.loadError}</p><Link href={`/${locale}/client/onboarding${space.selectedQuery}`} className={cn(buttonVariants({ variant: "outline" }), "mt-3 min-h-11")}>{messages.retry}</Link></AlertDescription></Alert>
        ) : (() => {
          const scoped = result.organizations.filter((organization) => organization.id === space.selectedOrganizationId);
          if (scoped.length === 0) {
            return <Card><CardHeader><CardTitle>{messages.emptyTitle}</CardTitle><CardDescription>{messages.emptyDescription}</CardDescription></CardHeader><CardContent><Link href={`/${locale}/organisation${space.selectedQuery}`} className={cn(buttonVariants(), "min-h-11 w-full sm:w-auto")}>{messages.organizationAction}</Link></CardContent></Card>;
          }
          return <div className="space-y-10">{scoped.map((organization) => <OrganizationOnboarding key={organization.id} organization={organization} locale={locale} messages={messages} />)}</div>;
        })()}
      </main>
    </ClientAppShell>
  );
}
