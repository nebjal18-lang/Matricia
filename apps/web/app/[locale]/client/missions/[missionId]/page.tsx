import { randomUUID } from "node:crypto";
import Link from "next/link";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { loadClientAmendments } from "@/modules/shared/lib/contracts-missions/amendments";
import { loadContractMissions } from "@/modules/shared/lib/contracts-missions/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { AmendmentPanel } from "@/modules/client/screens/missions/amendment-panel";
import { getMissionMessages } from "@/modules/client/screens/missions/messages";
import { MilestoneDecisions } from "@/modules/client/screens/missions/milestone-decisions";
import { MissionPanel } from "@/modules/client/screens/missions/mission-panel";
import { SpaceActions } from "@/modules/client/screens/spaces/boards";
import { FollowBoard } from "@/modules/client/screens/spaces/follow-board";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";

export default async function ClientMissionFollowPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; missionId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale, missionId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !z.string().uuid().safeParse(missionId).success) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") {
    const queryString = query.organizationId ? `?${new URLSearchParams({ organizationId: query.organizationId })}` : "";
    redirect(connexionHref(locale, { next: `/${locale}/client/missions/${missionId}${queryString}` }));
  }
  const messages = getMissionMessages(locale);
  const c = spaceCopy(locale);
  const [result, amendments] = await Promise.all([loadContractMissions(locale, space.selectedOrganizationId), loadClientAmendments(space.selectedOrganizationId)]);
  const followPath = `/${locale}/client/missions/${missionId}${space.selectedQuery}`;
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: followPath }));
  const dashboard = result.status === "success"
    ? { ...result.dashboard, missions: result.dashboard.missions.filter((item) => item.id === missionId) }
    : null;
  const mission = dashboard?.missions[0] ?? null;
  if (result.status === "success" && !mission) notFound();

  return (
    <ClientAppShell languagePath={followPath} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="missions" theme="follow" title={c.followTitle} lead={c.followLead} kicker={c.kicker} actions={<SpaceActions href={`/${locale}/besoin${space.selectedQuery}`} label={locale === "ar" ? "وصف حاجتي" : "Décrire mon besoin"} />}>
      {result.status === "error" && result.reason === "FORBIDDEN_ORGANIZATION" ? <>
        <WorkspaceFailure locale={locale} reason="FORBIDDEN" returnPath={followPath} />
        <Link href={`/${locale}/organisation/roles`} className="client-ghost-link">{locale === "ar" ? "طلب صلاحية مناسبة" : "Demander une habilitation"}</Link>
      </> : result.status === "error" && result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? <>
        <WorkspaceFailure locale={locale} reason="NO_ORGANIZATION" returnPath={followPath} />
        <Link href={`/${locale}/tableau-de-bord`} className="client-ghost-link">{locale === "ar" ? "اختيار مؤسسة مصرح بها" : "Choisir une organisation autorisée"}</Link>
      </> : result.status === "error" && result.reason === "NO_CLIENT_ORGANIZATION" ? <>
        <WorkspaceFailure locale={locale} reason="NO_ORGANIZATION" returnPath={followPath} />
        <Link href={`/${locale}/organisation/rattachements`} className="client-ghost-link">{locale === "ar" ? "طلب الانضمام إلى مؤسسة" : "Demander un rattachement à une organisation"}</Link>
      </> : result.status === "error" ? (
        <Alert>
          <AlertTitle>{locale === "ar" ? "متابعة المهمة غير متاحة" : "Suivi de mission indisponible"}</AlertTitle>
          <AlertDescription>
            <p>{locale === "ar" ? "تعذر تحميل الملف والتحقق من حالته. أعد المحاولة؛ لا يعني ذلك أن المهمة خالية من الإجراءات." : "Le dossier et son état n’ont pas pu être chargés. Réessayez ; cela ne signifie pas que la mission est sans action à traiter."}</p>
            <Link href={followPath} className="client-ghost-link">{locale === "ar" ? "إعادة المحاولة" : "Réessayer"}</Link>
          </AlertDescription>
        </Alert>
      ) : dashboard && mission ? <>
        <FollowBoard locale={locale} query={space.selectedQuery} organizationName={space.organizationName} mission={mission} />
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
      </> : null}
    </ClientAppShell>
  );
}
