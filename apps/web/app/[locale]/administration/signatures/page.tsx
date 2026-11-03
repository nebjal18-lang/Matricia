import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { AdminAppShell } from "@/modules/admin/ui/admin-app-shell";
import { SignaturePolicyForms } from "@/modules/admin/screens/signatures/forms";
import { governanceSchema, policyRoles } from "@/modules/admin/screens/signatures/model";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { PLATFORM_ADMIN_ROLES } from "@/modules/shared/lib/connected-space/workspace-landing";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";

export default async function SignaturePoliciesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await loadMyPlatformAccess();
  const ar = locale === "ar";
  const selfPath = `/${locale}/administration/signatures`;
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: selfPath }));
  // A verified platform role is required even to present the Administration shell.
  if (access.status === "error" || !hasPlatformRole(access.roles, PLATFORM_ADMIN_ROLES)) return <main dir={ar ? "rtl" : "ltr"} className="mx-auto max-w-3xl p-6"><WorkspaceFailure locale={locale} reason={access.status === "error" ? access.reason : "FORBIDDEN"} returnPath={selfPath} /></main>;
  const canRead = hasPlatformRole(access.roles, [...policyRoles, "READ_ONLY_AUDITOR"]);
  const shell = { locale, selectedQuery: "", selectedOrganizationId: null, userEmail: access.email, active: "settings" as const, alternateHref: `/${ar ? "fr" : "ar"}/administration/signatures`, title: ar ? "سياسات التوقيع" : "Signatures et politiques", lead: ar ? "سياسات محددة الإصدار والبيئة بمراجعة مستقلة." : "Politiques versionnées, liées à l’environnement et soumises à une revue indépendante." };
  if (!canRead || !access.requirementSatisfied) return <AdminAppShell {...shell}><WorkspaceFailure locale={locale} reason={!canRead ? "FORBIDDEN" : "MFA_REQUIRED"} returnPath={selfPath} /></AdminAppShell>;
  const result = await access.client.rpc("list_signature_policy_governance_v1");
  const parsed = governanceSchema.safeParse(result.data);
  return <AdminAppShell {...shell}><div className="space-y-6">
    <p role="note">{ar ? "لم يُعتمد بعد مزوّد حقيقي أو مستوى قانوني. المحاكاة غير تعاقدية ومؤقتة في التطوير أو الاختبار فقط. إدخال مرجع لا يثبت تثبيت موصل حقيقي ولا موافقة قانونية." : "Le fournisseur et le niveau juridique réels restent à valider. La simulation est temporaire et non contractuelle, en développement ou staging uniquement. Saisir une référence ne prouve ni un adaptateur installé ni une approbation juridique réelle."}</p>
    {result.error || !parsed.success ? <WorkspaceFailure locale={locale} reason={result.error ? "QUERY_FAILED" : "INVALID_RESPONSE"} returnPath={selfPath} /> : <><p>{ar ? "بيئة قاعدة البيانات" : "Environnement de la base"} : {parsed.data.environment ?? (ar ? "غير مهيأة" : "non configuré")}</p>{!parsed.data.can_write ? <p>{ar ? "قراءة فقط." : "Lecture seule."}</p> : null}<SignaturePolicyForms locale={locale} data={parsed.data} proposalKey={randomUUID()} simulationKey={randomUUID()} cancellationKeys={Object.fromEntries(parsed.data.local_envelopes.map(envelope => [envelope.id, randomUUID()]))} /></>}
  </div></AdminAppShell>;
}
