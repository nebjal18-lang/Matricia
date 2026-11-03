import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { questionDetail } from "@/modules/franchise/data/library/question-detail";
import { FranchiseQuestionEditor } from "@/modules/franchise/screens/library/question-editor";
import { requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { FranchiseAccessState } from "@/modules/franchise/ui/franchise-access-state";

export default async function QuestionPage({ params, searchParams }: {
  params: Promise<{ locale: string; questionId: string }>;
  searchParams: Promise<{ organizationId?: string; franchiseId?: string }>;
}) {
  const [{ locale, questionId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !z.string().uuid().safeParse(questionId).success) notFound();
  const { space, result } = await requireFranchiseLibrary({returnPath:`/${locale}/franchise/questions/${questionId}`,returnQuery:query, locale, organizationId: query.organizationId, franchiseId: query.franchiseId, catalog: {kind:"QUESTION",objectId:questionId} });
  const path = `/${locale}/franchise/questions/${questionId}${space.selectedQuery}`;
  let detail = null;
  let reason = result.status === "error" ? result.reason : null;
  if (result.status === "success") {
    const client = await getSupabaseServerClient();
    const response = await client.rpc("franchise_question_detail", { p_franchise_id: result.workspace.mandate.franchiseId, p_question_id: questionId });
    const parsed = questionDetail.safeParse(response.data);
    if (response.error) reason = response.error.code === "42501" ? "FORBIDDEN" : "QUERY_FAILED";
    else if (!parsed.success || parsed.data.id !== questionId || parsed.data.libraryId !== result.workspace.mandate.libraryId) reason = "INVALID_RESPONSE";
    else detail = parsed.data;
  }
  return <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} languagePath={path} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="questionnaires" title={locale === "ar" ? "تحرير السؤال" : "Éditer la question"} mandateName={result.status === "success" ? result.workspace.mandate.libraryName : null}>
    {reason ? <FranchiseAccessState locale={locale} reason={reason} returnPath={path} /> : detail && result.status === "success" ? <main className="client-page"><FranchiseQuestionEditor detail={detail} franchiseId={result.workspace.mandate.franchiseId} locale={locale} /></main> : null}
    <Link className="franchise-tool m-4" href={`/${locale}/franchise/questions${space.selectedQuery}`}>{locale === "ar" ? "العودة إلى البنك" : "Retour à la banque"}</Link>
  </FranchiseAppShell>;
}
