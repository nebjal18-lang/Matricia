import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { hasPlatformRole, loadMyPlatformAccess, mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import {
  buildDemoAbuseCases,
  buildDemoAbuseRules,
  canApplyAdminDemoAntiAbuse,
} from "@/modules/admin/data/spaces/demo-anti-abuse";
import { AntiAbusePanel } from "@/modules/admin/screens/anti-abus/anti-abuse-panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminOffFilmGate } from "@/modules/admin/ui/admin-off-film-gate";
import { adminCopy } from "@/modules/admin/data/spaces/copy";

const MUTATION_ROLES = new Set(["SUPER_ADMIN", "MATRICIA_ADMIN"]);

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await loadMyPlatformAccess();
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/anti-abus` }));
  const client = access.status === "ok" ? access.client : null;
  const needsMfa = access.status === "ok" && hasPlatformRole(access.roles, [...MUTATION_ROLES, "COMPLIANCE_MANAGER", "READ_ONLY_AUDITOR"]) && !access.requirementSatisfied;
  const [rules, cases] = client && !needsMfa
    ? await Promise.all([
        client.from("abuse_rule_versions").select("id,rule_code,version,event_type,window_seconds,max_events,review_score,block_score,status").order("created_at", { ascending: false }).limit(100),
        client.from("abuse_review_cases").select("id,subject_type,subject_hash,risk_score,event_count,recommended_action,status,row_version,opened_at").eq("status", "OPEN").order("risk_score", { ascending: false }).limit(100),
      ])
    : [{ error: access.status === "error" ? { code: "42501" } : null, data: [] }, { error: null, data: [] }];

  const demoOn = canApplyAdminDemoAntiAbuse();
  const failed = demoOn || needsMfa ? null : (rules.error ?? cases.error);
  const canMutate = access.status === "ok" && access.requirementSatisfied && hasPlatformRole(access.roles, [...MUTATION_ROLES]);
  const ruleRows = demoOn ? buildDemoAbuseRules() : ((rules.data ?? []) as never[]);
  const caseRows = demoOn ? buildDemoAbuseCases() : ((cases.data ?? []) as never[]);
  const ar = locale === "ar";
  const c = adminCopy(locale);

  return (
    <AdminModulePage
      locale={locale}
      active="pilot"
      path="anti-abus"
      title={ar ? "مراقبة إساءة الاستخدام" : "Contrôle des abus"}
      lead={c.hubPilotLead}
    >
      <AdminOffFilmGate
        locale={locale}
        role={ar ? "مراقبة إساءة الاستخدام وحماية المنصة" : "Contrôle des abus et protection de la plateforme"}
      />
      {needsMfa ? (
        <Alert variant="destructive">
          <AlertTitle>{mfaRequiredMessage(locale)}</AlertTitle>
          <AlertDescription>{ar ? "الملفات تبقى مخفية حتى تفعيل العامل الثاني." : "Les files restent masquées tant que le second facteur n’est pas actif."}</AlertDescription>
        </Alert>
      ) : failed ? (
        <Alert variant="destructive">
          <AlertTitle>{ar ? (failed.code === "42501" ? "الوصول مرفوض" : "تعذر التحميل") : (failed.code === "42501" ? "Accès refusé" : "Chargement impossible")}</AlertTitle>
          <AlertDescription>{ar ? "لم يتم عرض أي نجاح أو قائمة فارغة مصطنعة. تحقق من صلاحياتك أو أعد المحاولة." : "Aucun succès ni liste vide artificielle n’est affiché. Vérifiez vos droits ou réessayez."}</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          <section className="admin-panel space-y-4" data-tone="coral" aria-labelledby="anti-abuse-work-title">
            <div className="admin-section-head">
              <div>
                <h2 id="anti-abuse-work-title">{ar ? "القواعد والحالات المفتوحة" : "Règles et cas ouverts"}</h2>
                <p>
                  {ar
                    ? "مراجعة بشرية قبل أي قرار. لا تُعرض قائمة فارغة مصطنعة عند فشل التحميل."
                    : "Revue humaine avant toute décision. Aucune liste vide artificielle en cas d’échec de chargement."}
                </p>
              </div>
            </div>
            <AntiAbusePanel locale={locale} rules={ruleRows as never} cases={caseRows as never} canMutate={canMutate && !demoOn} />
          </section>
          <details id="rls" className="client-card scroll-mt-24 p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">{ar ? "الصفوف والتحكم في الوصول" : "RLS et contrôle des accès"}</summary>
          <section className="mt-4 space-y-3" aria-labelledby="anti-abuse-rls-title">
            <div className="admin-section-head">
              <div>
                <h2 id="anti-abuse-rls-title">{ar ? "الصفوف والتحكم في الوصول" : "RLS et contrôle des accès"}</h2>
                <p>
                  {ar
                    ? "الإدارة لا تتجاوز سياسات الصفوف. القواعد والحالات أعلاه تُقرأ بالدور الحالي فقط."
                    : "L’administration ne contourne pas les politiques RLS. Les règles et cas ci-dessus sont lus avec le rôle courant uniquement."}
                </p>
              </div>
            </div>
          </section>
          </details>
        </div>
      )}
    </AdminModulePage>
  );
}
