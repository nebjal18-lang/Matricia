import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { hasPlatformRole, loadMyPlatformAccess, mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { ClonePanel, type CloneChoices } from "@/modules/admin/screens/clonage/clone-panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep1Gate } from "@/modules/admin/ui/admin-step1-gate";

const MUTATION_ROLES = new Set(["SUPER_ADMIN", "MATRICIA_ADMIN", "LIBRARY_MANAGER"]);

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const access = await loadMyPlatformAccess();
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/clonage` }));
  const needsMfa = access.status === "ok" && hasPlatformRole(access.roles, [...MUTATION_ROLES, "READ_ONLY_AUDITOR"]) && !access.requirementSatisfied;
  const client = access.status === "ok" && !needsMfa ? access.client : null;
  const empty = { data: [], error: access.status === "error" ? { code: "42501" } : null };
  const [questionnaireVersions, releases, contractVersions, clauseVersions, checklistTemplates, serviceVersions, organizations] = client
    ? await Promise.all([
    client.from("questionnaire_versions").select("id,library_id,version,status,title_fr,title_ar").in("status", ["DRAFT", "LOCAL_TEST", "FRANCHISE_REVIEW", "CENTRAL_REVIEW", "APPROVED", "PUBLISHED"]).order("created_at", { ascending: false }).limit(200),
    client.from("catalog_releases").select("id,library_id,release_key,status").in("status", ["DRAFT", "IN_REVIEW", "APPROVED"]).order("created_at", { ascending: false }).limit(100),
    client.from("contract_versions").select("id,contract_id,version").order("created_at", { ascending: false }).limit(200),
    client.from("contract_clause_set_versions").select("id,version").order("created_at", { ascending: false }).limit(200),
    client.from("service_checklist_templates").select("id,service_version_id,version").order("created_at", { ascending: false }).limit(200),
    client.from("catalog_service_versions").select("id,version,status,name_fr,name_ar").in("status", ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED"]).order("created_at", { ascending: false }).limit(200),
    client.from("organizations").select("id,display_name").eq("status", "ACTIVE").order("display_name").limit(200),
  ])
    : [empty, empty, empty, empty, empty, empty, empty];
  const failed = needsMfa ? null : [questionnaireVersions, releases, contractVersions, clauseVersions, checklistTemplates, serviceVersions, organizations].find((query) => query.error)?.error;
  const canMutate = access.status === "ok" && access.requirementSatisfied && hasPlatformRole(access.roles, [...MUTATION_ROLES]);
  const serviceNames = new Map((serviceVersions.data ?? []).map((row) => [String(row.id), locale === "ar" ? String(row.name_ar) : String(row.name_fr)]));
  const choices: CloneChoices = {
    questionnaires: (questionnaireVersions.data ?? []).map((row) => ({ value: String(row.id), label: `${locale === "ar" ? row.title_ar : row.title_fr} · v${row.version} · ${row.status}`, scope: String(row.library_id) })),
    releases: (releases.data ?? []).map((row) => ({ value: String(row.id), label: `${row.release_key} · ${row.status}`, scope: String(row.library_id) })),
    contracts: (contractVersions.data ?? []).map((row) => ({ value: String(row.id), label: `${ar ? "عقد" : "Contrat"} ${String(row.contract_id).slice(0, 8)} · v${row.version}` })),
    clauseSets: (clauseVersions.data ?? []).map((row) => ({ value: String(row.id), label: `${ar ? "مجموعة بنود" : "Jeu de clauses"} · v${row.version}` })),
    checklists: (checklistTemplates.data ?? []).map((row) => ({ value: String(row.id), label: `${serviceNames.get(String(row.service_version_id)) ?? (ar ? "خدمة" : "Service")} · ${ar ? "قائمة" : "checklist"} v${row.version}` })),
    services: (serviceVersions.data ?? []).map((row) => ({ value: String(row.id), label: `${locale === "ar" ? row.name_ar : row.name_fr} · v${row.version} · ${row.status}` })),
    organizations: (organizations.data ?? []).map((row) => ({ value: String(row.id), label: String(row.display_name) })),
  };
  return (
    <AdminModulePage
      locale={locale}
      active="catalog"
      path="clonage"
      title={ar ? "استنساخ المحتوى مع المصدر" : "Clonage de contenu avec provenance"}
      lead={ar ? "اختر محتوى موجوداً ووجهته. يتحقق الخادم من الصلاحيات والمصدر قبل إنشاء إصدار جديد." : "Choisissez un contenu existant et sa destination. Le serveur revalide les droits et la provenance avant de créer une nouvelle version."}
    >
      <AdminStep1Gate locale={locale} current="clonage" />
      {needsMfa ? (
        <Alert variant="destructive">
          <AlertTitle>{mfaRequiredMessage(locale)}</AlertTitle>
          <AlertDescription>{ar ? "الاستنساخ يبقى مغلقاً حتى تفعيل العامل الثاني." : "Le clonage reste fermé tant que le second facteur n’est pas actif."}</AlertDescription>
        </Alert>
      ) : failed ? (
        <Alert variant="destructive">
          <AlertTitle>{ar ? "تعذر تحميل خيارات الاستنساخ" : "Impossible de charger les choix de clonage"}</AlertTitle>
          <AlertDescription>{failed.code === "42501" ? (ar ? "لا يسمح دورك بالوصول إلى هذه البيانات." : "Votre rôle ne permet pas d’accéder à ces données.") : (ar ? "أعد المحاولة لاحقاً؛ لم يتم تنفيذ أي استنساخ." : "Réessayez plus tard ; aucun clonage n’a été exécuté.")}</AlertDescription>
        </Alert>
      ) : (
        <ClonePanel locale={locale} keys={[randomUUID(), randomUUID(), randomUUID()]} choices={choices} canMutate={canMutate} />
      )}
    </AdminModulePage>
  );
}
