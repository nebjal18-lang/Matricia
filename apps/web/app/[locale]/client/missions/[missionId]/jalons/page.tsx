import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { loadClientAmendments } from "@/modules/shared/lib/contracts-missions/amendments";
import { loadContractMissions } from "@/modules/shared/lib/contracts-missions/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { AmendmentPanel } from "@/modules/client/screens/missions/amendment-panel";
import { getMissionMessages } from "@/modules/client/screens/missions/messages";
import { MilestoneDecisions } from "@/modules/client/screens/missions/milestone-decisions";
import { MissionPanel } from "@/modules/client/screens/missions/mission-panel";
import { JalonsBoard } from "@/modules/client/screens/spaces/milestones-board";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";

export default async function ClientMissionJalonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; missionId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale, missionId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !missionId) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/missions/${missionId}/jalons` }));
  const messages = getMissionMessages(locale);
  const c = spaceCopy(locale);
  const [result, amendments] = await Promise.all([loadContractMissions(locale, space.selectedOrganizationId), loadClientAmendments(space.selectedOrganizationId)]);
  const dashboard = result.status === "success"
    ? { ...result.dashboard, missions: result.dashboard.missions.filter((item) => item.id === missionId) }
    : null;
  const mission = dashboard?.missions[0] ?? null;

  return (
    <ClientAppShell languagePath={`/${locale}/client/missions/${missionId}/jalons${space.selectedQuery}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="missions" title={c.jalonsTitle} lead={c.jalonsLead} kicker={c.kicker}>
      <JalonsBoard locale={locale} query={space.selectedQuery} organizationName={space.organizationName} mission={mission} messages={messages} assistanceHref={`/${locale}/client/diagnostics/assistance${space.selectedQuery}`}>
        {result.status === "error" ? (
          <Alert><AlertTitle>{messages.noOrg}</AlertTitle><AlertDescription>{result.reason}</AlertDescription></Alert>
        ) : dashboard && dashboard.missions.length === 0 ? (
          <p role="status">{messages.empty}</p>
        ) : dashboard ? (
          <details className="client-ops">
            <summary>{c.opsMissions}</summary>
            <div className="space-y-6">
              <MissionPanel d={dashboard} locale={locale} m={messages} />
              <MilestoneDecisions dashboard={dashboard} locale={locale} messages={messages} />
              {amendments.status==="error"?<p role="alert">{locale==="fr"?"Les avenants sont momentanément indisponibles ou nécessitent une nouvelle vérification de vos droits. Les autres données restent consultables.":"ملاحق العقود غير متاحة مؤقتاً أو تتطلب التحقق مجدداً من الصلاحيات. ما تزال البيانات الأخرى متاحة."}</p>:null}
              {amendments.status === "success" && amendments.value.organizationId === dashboard.organizationId ? (
                <AmendmentPanel d={amendments.value} locale={locale} keys={Object.fromEntries(amendments.value.items.flatMap((item) => [[`submit:${item.id}`, randomUUID()], [`sign:${item.id}`, randomUUID()]]))} />
              ) : null}
            </div>
          </details>
        ) : null}
      </JalonsBoard>
    </ClientAppShell>
  );
}
