import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { listClientComplianceReviews } from "@/modules/admin/screens/conformite-clients/actions";
import { ComplianceFigmaForm } from "@/modules/admin/screens/conformite-clients/figma-decision-form";
import {
  CreateComplianceQuestionForm,
  EvaluateComplianceForm,
  ReviewComplianceResponseForm,
} from "@/modules/admin/screens/conformite-clients/workflow-forms";
import { getComplianceMessages } from "@/modules/admin/screens/conformite-clients/messages";
import { ComplianceDecisionBoard } from "@/modules/admin/screens/spaces/actor-boards";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ClientComplianceDecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; caseId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale, caseId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !z.string().uuid().safeParse(caseId).success) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/conformite-clients/${caseId}` }));
  const result = await listClientComplianceReviews({caseId});
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/conformite-clients/${caseId}` }));
  const a = actorCopy(locale);
  const messages = getComplianceMessages(locale);
  const alternate = locale === "ar" ? "fr" : "ar";
  const item = result.status === "success" ? result.cases.find((entry) => entry.id === caseId) : null;
  if (result.status === "success" && !item) notFound();

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="compliance"
      searchAction={`/${locale}/administration/conformite-clients`}
      searchPlaceholder={messages.navigation}
      alternateHref={`/${alternate}/administration/conformite-clients/${caseId}${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/conformite-clients${space.selectedQuery}`, label: a.complianceTitle }, { label: a.decisionTitle }]} />}
      title={a.decisionTitle}
      lead={a.decisionPageLead}
      kicker={item ? messages.statuses[item.status] : a.inInstruction}
    >
      {result.status === "error" ? (
        <main className="client-page">
          <Alert variant="destructive">
            <AlertTitle>{result.reason === "FORBIDDEN" ? messages.forbiddenTitle : result.reason === "MFA_REQUIRED" ? messages.mfaTitle : messages.unavailableTitle}</AlertTitle>
            <AlertDescription>{result.reason}</AlertDescription>
          </Alert>
        </main>
      ) : item ? (
        <>
          <Link className="admin-soft-cta" href={`/${locale}/administration/conformite-clients/${item.id}/identite`}>{locale==="ar"?"مراجعة ICE وIF وRC والوثائق":"Revoir ICE, IF, RC et les pièces"}</Link>
          <ComplianceDecisionBoard
            locale={locale}
            query={space.selectedQuery}
            item={item}
            form={<ComplianceFigmaForm complianceCaseId={item.id} locale={locale} idempotencyKey={randomUUID()} />}
          />
          <details className="client-ops">
            <summary>{messages.evaluateTitle}</summary>
            <EvaluateComplianceForm complianceCaseId={item.id} idempotencyKey={randomUUID()} locale={locale} messages={messages} />
            {item.anomalies.map((anomaly) => (
              anomaly.status === "OPEN" ? (
                <CreateComplianceQuestionForm key={anomaly.id} anomalyId={anomaly.id} idempotencyKey={randomUUID()} requestAnchor={new Date().toISOString()} locale={locale} messages={messages} />
              ) : null
            ))}
            {item.questions.map((question) => (
              question.status === "ANSWERED" && question.latestResponse ? (
                <ReviewComplianceResponseForm key={question.id} questionId={question.id} idempotencyKey={randomUUID()} locale={locale} messages={messages} />
              ) : null
            ))}
          </details>
        </>
      ) : null}
    </AdminAppShell>
  );
}
