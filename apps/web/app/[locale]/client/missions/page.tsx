import { workflowStatusLabel } from "@/modules/shared/lib/i18n/workflow-statuses";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { expiredDocuments } from "@/modules/client/data/documents/expiry";
import { loadClientDocumentVault } from "@/modules/client/data/documents/server-repository";
import { loadClientAmendments } from "@/modules/shared/lib/contracts-missions/amendments";
import { loadContractMissions } from "@/modules/shared/lib/contracts-missions/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { AmendmentPanel } from "@/modules/client/screens/missions/amendment-panel";
import { getMissionMessages } from "@/modules/client/screens/missions/messages";
import { MilestoneDecisions } from "@/modules/client/screens/missions/milestone-decisions";
import { MissionPanel } from "@/modules/client/screens/missions/mission-panel";
import { MissionsBoard, SpaceActions } from "@/modules/client/screens/spaces/boards";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";

export default async function ClientMissionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/missions` }));
  const messages = getMissionMessages(locale);
  const c = spaceCopy(locale);
  const [result, amendments, vault] = await Promise.all([loadContractMissions(locale, space.selectedOrganizationId), loadClientAmendments(space.selectedOrganizationId), loadClientDocumentVault(space.selectedOrganizationId)]);
  const expired = vault.status === "success" ? expiredDocuments(vault.value.documents) : [];
  return (
    <ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="missions" title={c.misTitle} lead={c.misLead} kicker={c.kicker} actions={<SpaceActions href={`/${locale}/client/demandes${space.selectedQuery}`} label={c.openFolder} />}>
      {expired.length > 0 ? (
        <Alert>
          <AlertTitle>{messages.expiredDocumentTitle}</AlertTitle>
          <AlertDescription>{messages.expiredDocumentLead}</AlertDescription>
        </Alert>
      ) : null}
      <MissionsBoard locale={locale} query={space.selectedQuery} organizationName={space.organizationName} view={result.status === "success" ? {
        validations: result.dashboard.missions.flatMap((mission) => [
          ...mission.deliverables.filter((item) => item.status !== "ACCEPTED" && item.status !== "DONE" && item.status !== "COMPLETED").map((item) => ({
            id: item.id,
            title: item.label,
            detail: workflowStatusLabel(item.status,locale),
            href: `/${locale}/client/missions/${mission.id}/jalons${space.selectedQuery}`,
          })),
          ...mission.milestones.filter((item) => item.status === "SUBMITTED" || item.status === "IN_REVIEW" || item.status === "IN_PROGRESS").map((item) => ({
            id: item.id,
            title: item.title,
            detail: workflowStatusLabel(item.status,locale),
            href: `/${locale}/client/missions/${mission.id}/jalons${space.selectedQuery}`,
          })),
        ]).slice(0, 4),
        steps: (result.dashboard.missions[0]?.milestones ?? []).map((item, index, all) => {
          const done = item.status === "ACCEPTED" || item.status === "DONE" || item.status === "COMPLETED";
          const current = !done && (index === 0 || all.slice(0, index).every((row) => row.status === "ACCEPTED" || row.status === "DONE" || row.status === "COMPLETED"));
          return { id: item.id, title: item.title, detail: workflowStatusLabel(item.status,locale), state: (done ? "done" : current ? "current" : "upcoming") as "done" | "current" | "upcoming" };
        }),
        decision: result.dashboard.missions.flatMap((mission) => mission.milestones.filter((item) => item.status === "SUBMITTED" || item.status === "IN_REVIEW")).map((item) => ({
          title: item.title,
          context: workflowStatusLabel(item.status,locale),
          impact: item.dueAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(item.dueAt)) : messages.empty,
          href: `/${locale}/client/missions${space.selectedQuery}`,
        }))[0] ?? null,
        files: result.dashboard.missions.flatMap((mission) => mission.deliverables.map((item) => ({
          id: item.id,
          title: item.label,
          href: `/${locale}/client/documents${space.selectedQuery}`,
          kind: "file" as const,
        }))).slice(0, 6),
      } : undefined} />
      <details className="client-ops">
        <summary>{c.opsMissions}</summary>
        {result.status === "error" ? (
          <Alert><AlertTitle>{messages.noOrg}</AlertTitle><AlertDescription>{result.reason}</AlertDescription></Alert>
        ) : (
          <div className="space-y-6">
            <MissionPanel d={result.dashboard} locale={locale} m={messages} />
            <MilestoneDecisions dashboard={result.dashboard} locale={locale} messages={messages} />
            {amendments.status==="error"?<p role="alert">{locale==="fr"?"Les avenants sont momentanément indisponibles ou nécessitent une nouvelle vérification de vos droits. Les autres données restent consultables.":"ملاحق العقود غير متاحة مؤقتاً أو تتطلب التحقق مجدداً من الصلاحيات. ما تزال البيانات الأخرى متاحة."}</p>:null}
              {amendments.status === "success" && amendments.value.organizationId === result.dashboard.organizationId ? (
              <AmendmentPanel d={amendments.value} locale={locale} keys={Object.fromEntries(amendments.value.items.flatMap((item) => [[`submit:${item.id}`, randomUUID()], [`sign:${item.id}`, randomUUID()]]))} />
            ) : null}
          </div>
        )}
      </details>
    </ClientAppShell>
  );
}
