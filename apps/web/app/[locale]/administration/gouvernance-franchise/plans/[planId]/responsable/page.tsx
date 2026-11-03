import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { sensitivePageContext, adminReadFailure } from "@/modules/admin/ui/sensitive-page-context";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { planOwnerContextSchema } from "@/modules/franchise/data/performance/owner-context";
import { NativePlanOwnerControls } from "@/modules/franchise/screens/performance/native-owner-controls";
import { NativePlanDecisionForm } from "@/modules/franchise/screens/performance/native-plan-form";
export default async function NativePlanOwnerPage({ params }: { params: Promise<{ locale: string; planId: string }> }) {
  const { locale, planId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(planId).success) notFound();
  const ar = locale === "ar";
  const context = await sensitivePageContext({ locale, active: "pilot", path: `gouvernance-franchise/plans/${planId}/responsable`, title: ar ? "مسؤول الخطة التصحيحية" : "Responsable du plan correctif", lead: ar ? "إسناد مؤرخ يراجعه مسؤولان مستقلان، دون تعديل الاقتراح التاريخي." : "Affectation versionnée, revue par deux administrateurs indépendants, sans modifier la proposition historique.", roles: ["SUPER_ADMIN", "MATRICIA_ADMIN"] });
  if (context.status === "blocked") return context.view;
  const response = await context.access.client.rpc("get_franchise_control_owner_context_v1", { p_plan_id: planId });
  const parsed = response.error ? null : planOwnerContextSchema.safeParse(response.data);
  return context.wrap(<main className="client-page space-y-5"><Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/administration/command-center`}>{ar ? "العودة إلى المهام الإدارية" : "Retour aux tâches administratives"}</Link>
    {parsed?.success ? <><NativePlanOwnerControls locale={locale} planId={planId} context={parsed.data}/>{parsed.data.canApprovePlan || parsed.data.canCompletePlan || parsed.data.canRejectPlan ? <NativePlanDecisionForm locale={locale} planId={planId} canApprove={parsed.data.canApprovePlan} canReject={parsed.data.canRejectPlan} canComplete={parsed.data.canCompletePlan}/> : <p>{ar ? "تعتمد الإجراءات المتاحة على الإسناد المعتمد وحقوق المراجع والتحقق من الأهداف." : "Les actions disponibles dépendent de l’affectation approuvée, de l’indépendance du réviseur et de la mesure des objectifs."}</p>}</> : <WorkspaceFailure locale={locale} reason={adminReadFailure(response.error)} returnPath={context.selfPath} supportReference="FRANCHISE_PLAN_OWNER"/>}
  </main>);
}
