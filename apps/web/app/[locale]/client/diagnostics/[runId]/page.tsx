import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { createServerDiagnosticsRepository } from "@/modules/shared/lib/diagnostics-opportunities/server-repository";
import { createServerAssistedIntelligenceRepository } from "@/modules/shared/lib/assisted-intelligence/server-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { AnalyseDetailleeView } from "@/modules/client/screens/diagnostics/analyse-detaillee-view";
import { AssistanceCue } from "@/modules/client/screens/diagnostics/assistance-cue";
import { messages } from "@/modules/client/screens/diagnostics/messages";
import {uuid}from"@/modules/shared/lib/diagnostics-opportunities/model";
import {getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import { clientHref } from "@/modules/client/screens/diagnostics/journey";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";

export default async function Result({ params, searchParams }: { params: Promise<{ locale: string; runId: string }>; searchParams: Promise<{ organizationId?: string; anomalyId?: string }> }) {
  const [{ locale, runId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)||!uuid.safeParse(runId).success||(query.organizationId&&!uuid.safeParse(query.organizationId).success)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/diagnostics/${runId}?${new URLSearchParams({...query})}` }));
  const [result, assistanceResult] = await Promise.all([
    (await createServerDiagnosticsRepository(query.organizationId??undefined)).detail(runId),
    createServerAssistedIntelligenceRepository().then((repository) => repository.dashboard()),
  ]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/diagnostics/${runId}?${new URLSearchParams({...query})}` }));
  if(result.status==="error"){if(result.reason==="INVALID_INPUT"||result.reason==="FORBIDDEN")notFound();return<ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="needs"><main className="client-page"><p role="alert">{locale==="fr"?"Le diagnostic est momentanément indisponible. Réessayez pour relire le bilan conservé.":"التشخيص غير متاح مؤقتاً. حاولوا مجدداً لقراءة التشخيص المحفوظ."}</p></main></ClientAppShell>;}
  if(!result.value)notFound();
  const detail = result.value;
  if(detail.organizationId!==space.selectedOrganizationId){if(query.organizationId)notFound();redirect(`/${locale}/client/diagnostics/${runId}?${new URLSearchParams({organizationId:detail.organizationId,...(query.anomalyId?{anomalyId:query.anomalyId}:{})})}`);}
  const versionId=uuid.safeParse(detail.explanation.questionnaire_version_id),client=await getSupabaseServerClient();
  const scope=versionId.success?await client.from("questionnaire_versions").select("title_fr,title_ar").eq("id",versionId.data).eq("library_id",detail.libraryId).maybeSingle():null;
  const scopeName=!scope?.error&&scope?.data?(locale==="fr"?scope.data.title_fr:scope.data.title_ar):null;
  const m = messages(locale);
  const c = spaceCopy(locale);
  const solutionsHref = clientHref(`/${locale}/client/diagnostics/solutions`, space.selectedQuery);
  const assistanceHref = clientHref(`/${locale}/client/diagnostics/assistance`, space.selectedQuery);
  const evolutionHref = clientHref(`/${locale}/client/diagnostics/evolution`, space.selectedQuery);
  const listHref = clientHref(`/${locale}/client/diagnostics`, space.selectedQuery);
  const proposedCount = assistanceResult.status === "success" ? assistanceResult.value.suggestions.filter((item) => item.status === "PROPOSED").length : 0;
  const reassessmentCount = assistanceResult.status === "success" ? assistanceResult.value.reassessmentCandidates.length : 0;

  return (
    <ClientAppShell
      languagePath={`/${locale}/client/diagnostics/${runId}${space.selectedQuery}`}
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      organizationName={space.organizationName}
      active="needs"
      kicker={c.kicker}
    >
      <main className="client-page">
        <AssistanceCue locale={locale} href={assistanceHref} proposedCount={proposedCount} reassessmentCount={reassessmentCount} context="diagnostic" />
        <AnalyseDetailleeView
          detail={detail}
          locale={locale}
          m={m}
          solutionsHref={solutionsHref}
          assistanceHref={assistanceHref}
          evolutionHref={evolutionHref}
          listHref={listHref}
          anomalyId={query.anomalyId}
          scopeName={scopeName}
          decisionKeys={Array.from({ length: 4 }, () => randomUUID())}
        />
      </main>
    </ClientAppShell>
  );
}
