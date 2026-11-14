import { summarizeAdminWork } from "@/modules/admin/data/command-center/view-model";
import type { AdminWorkItem } from "@/modules/admin/data/command-center/model";
import type { AdminOrganizationFiche, AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { actorOrganizationLabel, isAdminOrgDirectoryFixture } from "./actor-presentation";
import { adminCopy } from "./copy";
import { inferOrgType, normalizeOrgTypeCodes, ORG_TYPE_NONE, orgTypeFilterCodes } from "./directory";

export type AdminOrgRow = {
  id: string;
  name: string;
  legalName: string;
  type: string;
  typeTone?: "mint" | "sky" | "peach" | "violet";
  typeCodes?:string[];statusCode?:string;complianceCode?:"CURRENT"|"REVIEW"|"UNKNOWN";planCode?:string;
  status: string;
  statusTone: "mint" | "sky" | "peach" | "violet";
  compliance: string;
  complianceTone: "mint" | "peach" | "sky";
  plan: string;
  lastAction: string;
  fixture?: boolean;
};

export type AdminTreatItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "sky" | "peach" | "mint" | "violet";
};

export function localizeStatus(status: string, locale: Locale) {
  const c = adminCopy(locale);
  const key = status.toUpperCase().replace(/\s+/gu, "_");
  const ar = locale === "ar";
  if (key === "ACTIVE") return c.statusActive;
  if (key === "PENDING" || key === "PENDING_APPROVAL") return c.statusPending;
  if (key === "PROPOSED") return ar ? "مقترح" : "Proposé";
  if (key === "SUSPENDED") return c.statusSuspended;
  if (key === "ARCHIVED") return ar ? "مؤرشفة" : "Archivée";
  if (key === "RETIRED") return ar ? "متقاعد" : "Retiré";
  if (key === "APPROVED" || key === "AUTHORIZED") return ar ? "مصادق" : "Approuvé";
  if (key === "REJECTED") return ar ? "مرفوض" : "Refusé";
  if (key === "INFORMATION_REQUIRED") return ar ? "معلومات مطلوبة" : "Complément demandé";
  if (key === "COMPLETED" || key === "DONE" || key === "TERMINE" || key === "TERMINÉ") return ar ? "منتهٍ" : "Terminé";
  if (key === "SUPERSEDED") return ar ? "مستبدل" : "Remplacé";
  if (key === "DRAFT") return ar ? "مسودة" : "Brouillon";
  if (key === "IN_PROGRESS" || key === "STARTED" || key === "RUNNING") return ar ? "جارٍ" : "En cours";
  if (key === "UNDER_REVIEW" || key === "IN_REVIEW" || key === "REVIEW" || key === "STALE") return ar ? "قيد المراجعة" : "En revue";
  if (key === "SUBMITTED") return ar ? "مُرسل" : "Soumis";
  if (key === "OPEN") return ar ? "مفتوح" : "Ouvert";
  if (key === "CLOSED") return ar ? "مغلق" : "Clos";
  if (key === "BLOCKED") return ar ? "محظور" : "Bloqué";
  if (key === "CANCELLED" || key === "CANCELED") return ar ? "ملغى" : "Annulé";
  if (key === "IMPORTANT") return ar ? "مهم" : "Importante";
  if (key === "CRITICAL" || key === "HIGH") return ar ? "حرج" : "Critique";
  if (key === "MEDIUM" || key === "MODERATE") return ar ? "متوسط" : "Modérée";
  if (key === "LOW") return ar ? "منخفض" : "Faible";
  if (key === "VERIFIED" || key === "VALID" || key === "CLEAN") return ar ? "متحقق" : "Vérifié";
  if (key === "EXPIRED") return ar ? "منتهٍ" : "Expiré";
  if (key === "EXPIRING") return ar ? "ينتهي قريباً" : "Expire bientôt";
  if (key === "QUARANTINED") return ar ? "محجور" : "Quarantaine";
  if (key === "ACCEPTED") return ar ? "مقبول" : "Accepté";
  if (key === "RECEIVED") return ar ? "مستلم" : "Reçu";
  if (key === "SIGNATURE" || key === "SIGNATURE_PENDING" || key === "PENDING_SIGNATURE") return ar ? "بانتظار التوقيع" : "Signature en attente";
  if (key === "NONE") return ar ? "غير محدد" : "Non renseigné";
  if (key === "URGENT") return ar ? "عاجل" : "Urgent";
  if (key === "UNREAD") return ar ? "غير مقروء" : "Non lu";
  if (key === "PUBLISHED") return ar ? "منشور" : "Publié";
  if (key === "RESERVED") return ar ? "محجوز" : "Réservé";
  if (key === "REDEEMED") return ar ? "مستعمل" : "Utilisé";
  if (key === "CONFIGURED") return ar ? "مهيأ" : "Configuré";
  if (key === "READY") return ar ? "جاهز" : "Prêt";
  if (key === "FAILED") return ar ? "فشل" : "Échoué";
  if (key === "SUCCEEDED" || key === "SUCCESS") return ar ? "ناجح" : "Réussi";
  if (key === "PAUSED") return ar ? "متوقف" : "En pause";
  if (key === "QUESTION_REQUIRED" || key === "RESPONSE_RECEIVED") return key === "QUESTION_REQUIRED" ? (ar ? "سؤال مطلوب" : "Question requise") : (ar ? "رد مستلم" : "Réponse reçue");
  if (key === "PENDING_REVIEW" || key === "PENDING_VERIFICATION") return ar ? "بانتظار المراجعة" : "En attente de revue";
  if (key === "ANSWERED") return ar ? "مجاب" : "Répondu";
  if (key === "FIXED") return ar ? "ثابتة" : "Fixe";
  if (key === "SEMI_CUSTOM") return ar ? "شبه مخصصة" : "Semi-personnalisée";
  if (key === "CUSTOM") return ar ? "مخصصة" : "Personnalisée";
  if (key === "ENTERPRISE") return ar ? "مؤسسات" : "Entreprise";
  if (key === "MULTI_USER") return ar ? "متعدد المستخدمين" : "Multi-utilisateurs";
  if (key === "MULTI_LIBRARY") return ar ? "متعدد المكتبات" : "Multi-bibliothèques";
  if (key === "MANDATORY") return ar ? "إلزامي" : "Obligatoire";
  if (key === "OPTIONAL") return ar ? "اختياري" : "Facultatif";
  if (key === "PLATFORM_FEATURE") return ar ? "ميزة المنصة" : "Fonction plateforme";
  if (key === "SERVICE_UNIT") return ar ? "وحدة خدمة" : "Unité de service";
  if (key === "CREDIT_SERVICE") return ar ? "خدمة بالرصيد" : "Service à crédits";
  if (key === "PRIORITY") return ar ? "أولوية" : "Priorité";
  if (key === "QUOTA") return ar ? "حصة" : "Quota";
  if (key === "ACCESS_RIGHT") return ar ? "حق وصول" : "Droit d’accès";
  if (key === "SERVICE_SUBSIDY") return ar ? "دعم خدمة" : "Subvention de service";
  if (key === "CONSULTATION") return ar ? "استشارة" : "Consultation";
  if (key === "REPORT") return ar ? "تقرير" : "Rapport";
  if (key === "AUTOMATED_PLATFORM") return ar ? "منصة آلية" : "Plateforme automatisée";
  if (key === "MATRICIA_INTERNAL") return ar ? "داخلي ماتريسيا" : "Interne Matricia";
  if (key === "DIRECT_PROVIDER") return ar ? "مقدم مباشر" : "Prestataire direct";
  if (key === "SUBCONTRACTOR_POOL") return ar ? "مجمع مقاولين" : "Pool sous-traitants";
  if (key === "VOLUME_POOL") return ar ? "مجمع حجم" : "Pool volume";
  if (key === "RFQ") return ar ? "طلب عروض" : "Appel d’offres";
  if (key === "OVERALL") return ar ? "إجمالي" : "Global";
  if (key === "QUALITY") return ar ? "جودة" : "Qualité";
  if (key === "DELIVERY") return ar ? "تسليم" : "Livraison";
  if (key === "COMPLIANCE") return ar ? "امتثال" : "Conformité";
  if (key === "RESPONSIVENESS") return ar ? "استجابة" : "Réactivité";
  if (key === "SATISFACTION") return ar ? "رضا" : "Satisfaction";
  if (key === "FINANCE") return ar ? "مالية" : "Finance";
  if (key === "REFERRED_CLIENT") return ar ? "عميل مُحال" : "Client parrainé";
  if (key === "REFERRED_PROVIDER") return ar ? "مقدم مُحال" : "Prestataire parrainé";
  if (key === "CLIENT_ORGANIZATION") return ar ? "مؤسسة عميل" : "Organisation client";
  if (key === "REVOKED") return ar ? "ملغى" : "Révoqué";
  if (key === "APPROVE") return ar ? "اعتماد" : "Approuver";
  if (key === "DISMISSED") return ar ? "مستبعد" : "Écarté";
  if (key === "ISSUED") return ar ? "مُصدر" : "Émis";
  if (key === "ACCRUAL") return ar ? "استحقاق" : "Provision";
  if (key === "REVERSAL") return ar ? "عكس" : "Contrepassation";
  if (key === "CREDIT") return ar ? "دائن" : "Crédit";
  if (key === "DEBIT") return ar ? "مدين" : "Débit";
  if (key === "STANDARD") return ar ? "قياسي" : "Standard";
  if (key === "IT") return "IT";
  if (key === "FRAMEWORK_DRAFT_CREATED") return ar ? "مسودة إطار أُنشئت" : "Brouillon cadre créé";
  if (key === "POOL_ACTIVE") return ar ? "المجمع نشط" : "Pool activé";
  if (key === "USER" || key === "ORGANIZATION" || key === "IP" || key === "DEVICE") {
    const fr: Record<string, string> = { USER: "Utilisateur", ORGANIZATION: "Organisation", IP: "Adresse IP", DEVICE: "Appareil" };
    const arLabels: Record<string, string> = { USER: "مستخدم", ORGANIZATION: "مؤسسة", IP: "عنوان IP", DEVICE: "جهاز" };
    return (ar ? arLabels : fr)[key] ?? status;
  }
  if (key === "REVIEW" || key === "BLOCK" || key === "ALLOW") {
    const fr: Record<string, string> = { REVIEW: "Revue", BLOCK: "Blocage", ALLOW: "Autoriser" };
    const arLabels: Record<string, string> = { REVIEW: "مراجعة", BLOCK: "حظر", ALLOW: "سماح" };
    return (ar ? arLabels : fr)[key] ?? status;
  }
  if (key === "REFUND" || key === "CHARGE" || key === "ADJUSTMENT" || key === "CAPTURE" || key === "PAYMENT") {
    const fr: Record<string, string> = { REFUND: "Remboursement", CHARGE: "Débit", ADJUSTMENT: "Ajustement", CAPTURE: "Capture", PAYMENT: "Paiement" };
    const arLabels: Record<string, string> = { REFUND: "استرداد", CHARGE: "خصم", ADJUSTMENT: "تعديل", CAPTURE: "تحصيل", PAYMENT: "دفع" };
    return (ar ? arLabels : fr)[key] ?? status;
  }
  return status;
}

export function localizeDiagnosticRating(rating: string, locale: Locale): string {
  const trimmed = rating.trim();
  if (!trimmed) return "—";
  const label = localizeStatus(trimmed, locale);
  if (label === trimmed && !/^[A-Z_]+$/u.test(trimmed)) return trimmed;
  return locale === "ar" ? `أولوية ${label}` : `Priorité ${label}`;
}

export function formatDiagnosticProgress(score: number | string, locale: Locale): { label: string; percent: number } {
  const raw = typeof score === "number" ? score : Number.parseFloat(String(score).replace("%", "").trim());
  if (!Number.isFinite(raw) || raw < 0) {
    return { label: "—", percent: 0 };
  }
  const percent = Math.max(0, Math.min(100, raw > 100 ? raw / 100 : raw));
  const label = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    maximumFractionDigits: percent % 1 === 0 ? 0 : 2,
  }).format(percent);
  return { label: `${label} %`, percent };
}

function normalizeTypeFilter(value: string | undefined) {
  if (!value || value === "all") return null;
  if (value === ORG_TYPE_NONE || value === "Non renseigné" || value === "غير محدد") return ORG_TYPE_NONE;
  return (value.split("_")[0] ?? value).toUpperCase();
}

export function mapAdminOrgRows(orgs: AdminSupervisionDashboard["organizations"], locale: Locale): AdminOrgRow[] {
  const c = adminCopy(locale);
  return orgs.map((org) => {
    const typeCodes = normalizeOrgTypeCodes(org.role_codes);
    const states: Array<boolean | null> = [];
    if (typeCodes.includes("CLIENT")) states.push(org.client_compliance_status ? org.client_compliance_status === "VERIFIED" : null);
    if (typeCodes.includes("PROVIDER")) states.push(org.provider_identity_verified ?? null);
    const complianceCode: "CURRENT" | "REVIEW" | "UNKNOWN" = states.length && states.every((v) => v === true) && org.canonical_identity_verified === true ? "CURRENT" : states.some((v) => v !== null) ? "REVIEW" : "UNKNOWN";
    const type = inferOrgType(`${org.display_name} ${org.legal_name}`, locale, org.role_codes);
    const typeUnset = typeCodes.length === 0;
    return ({
    id: org.id,
    name: actorOrganizationLabel(org.display_name, locale),
    legalName: org.legal_name,
    type,
    typeTone: typeUnset ? "peach" : "violet",
    status: localizeStatus(org.status, locale),
    statusCode: org.status,
    typeCodes,
    complianceCode,
    planCode: undefined,
    statusTone: org.status.toUpperCase() === "ACTIVE" ? "mint" : org.status.toUpperCase() === "PENDING" ? "sky" : "peach",
    compliance: complianceCode === "CURRENT" ? c.complianceOk : complianceCode === "REVIEW" ? c.complianceReview : locale === "ar" ? "غير متحقق" : "Non vérifié",
    complianceTone: complianceCode === "CURRENT" ? "mint" : complianceCode === "REVIEW" ? "sky" : "peach",
    plan: c.unknownPlan,
    lastAction: org.open_disputes > 0 ? c.lastDispute : org.open_requests > 0 ? c.lastOpenRequest : c.lastCreated,
    fixture: isAdminOrgDirectoryFixture(org.display_name, org.legal_name),
  });});
}

function localizePlanCode(code: string, locale: Locale) {
  const key = code.toUpperCase();
  const ar = locale === "ar";
  if (key === "GOLD") return ar ? "ذهبي" : "Or";
  if (key === "SILVER") return ar ? "فضي" : "Argent";
  if (key === "BRONZE") return ar ? "برونزي" : "Bronze";
  if (key === "PREMIUM") return ar ? "مميز" : "Premium";
  if (key === "STANDARD") return ar ? "قياسي" : "Standard";
  if (key === "BASIC" || key === "STARTER") return ar ? "أساسي" : "Essentiel";
  if (key === "TRIAL") return ar ? "تجريبي" : "Essai";
  if (key === "ENTERPRISE") return ar ? "مؤسسات" : "Entreprise";
  return localizeStatus(code, locale);
}

export function applyOrganizationPlanCodes(
  rows: AdminOrgRow[],
  plansByOrg: ReadonlyMap<string, string>,
  locale: Locale,
): AdminOrgRow[] {
  const c = adminCopy(locale);
  return rows.map((row) => {
    const code = plansByOrg.get(row.id)?.trim().toUpperCase();
    if (!code) return { ...row, planCode: undefined, plan: c.unknownPlan };
    return { ...row, planCode: code, plan: localizePlanCode(code, locale) };
  });
}

export function filterAdminOrgRows(rows: AdminOrgRow[], filters: { type?: string; status?: string; compliance?: string; plan?: string }, search?: string, includeArchived = false) {
  const wantedType = normalizeTypeFilter(filters.type);
  const wantedStatus = filters.status && filters.status !== "all" ? filters.status.toUpperCase() : null;
  const wantedCompliance = filters.compliance && filters.compliance !== "all" ? filters.compliance.toUpperCase() : null;
  const wantedPlan = filters.plan && filters.plan !== "all" ? filters.plan.toUpperCase() : null;
  const needle = search?.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (!includeArchived && row.statusCode === "ARCHIVED") return false;
    if (wantedType && !orgTypeFilterCodes(row.typeCodes ?? []).includes(wantedType) && row.type !== filters.type) return false;
    if (wantedStatus && (row.statusCode ?? "").toUpperCase() !== wantedStatus && row.status.toUpperCase() !== wantedStatus && row.status !== filters.status) return false;
    if (wantedCompliance && (row.complianceCode ?? "").toUpperCase() !== wantedCompliance && row.compliance !== filters.compliance) return false;
    if (wantedPlan && (row.planCode ?? "").toUpperCase() !== wantedPlan && row.plan !== filters.plan) return false;
    return !needle || `${row.name} ${row.legalName} ${row.type} ${row.status} ${row.id}`.toLocaleLowerCase().includes(needle);
  });
}

export function mapAdminTreatQueue(input: {
  locale: Locale;
  query: string;
  organizations: AdminSupervisionDashboard["organizations"];
  requests: AdminSupervisionDashboard["requests"];
  workItems: AdminWorkItem[];
}): AdminTreatItem[] {
  const { locale, query, organizations, requests, workItems } = input;
  const tones = ["sky", "peach", "mint", "violet"] as const;
  const fromWork = summarizeAdminWork(workItems, new Date().toISOString()).ordered.slice(0, 6).map((item, index) => ({
    id: item.id,
    title: actorOrganizationLabel(locale === "ar" ? item.titleAr : item.titleFr, locale),
    detail: item.resourceType,
    href: `/${locale}/administration/command-center${query}#work-${encodeURIComponent(item.id)}`,
    tone: tones[index % tones.length]!,
  }));
  if (fromWork.length > 0) return fromWork;
  const fromRequests = requests.slice(0, 6).map((item, index) => ({
    id: item.id,
    title: actorOrganizationLabel(item.organization_name, locale),
    detail: item.status,
    href: `/${locale}/administration/demandes/${item.id}${query}`,
    tone: tones[index % tones.length]!,
  }));
  if (fromRequests.length > 0) return fromRequests;
  return organizations.filter((org) => org.open_disputes > 0 || org.open_requests > 0).slice(0, 6).map((org, index) => ({
    id: org.id,
    title: actorOrganizationLabel(org.display_name, locale),
    detail: org.open_disputes > 0 ? adminCopy(locale).lastDispute : adminCopy(locale).lastOpenRequest,
    href: `/${locale}/administration/entreprises/${org.id}${query}`,
    tone: tones[index % tones.length]!,
  }));
}

export function demoAdminTreatQueue(): AdminTreatItem[] {
  return [];
}

export function organizationJourney(fiche: AdminOrganizationFiche, locale: Locale) {
  const c = adminCopy(locale);
  const org = fiche.organization;
  // A dispute says nothing about the current identity verification. A stale
  // client case must also override an old VERIFIED label in the projection.
  const row = mapAdminOrgRows([{
    ...org,
    client_compliance_status: org.client_compliance_snapshot
      ? org.client_compliance_snapshot.currently_verified ? "VERIFIED" : "PENDING"
      : org.client_compliance_status,
    member_count: fiche.memberships.length,
    open_requests: fiche.requests.length,
    open_disputes: fiche.disputes.length,
  }], locale)[0]!;
  const recorded = (count: number) => locale === "ar" ? `${count} سجل` : `${count} enregistrement(s)`;
  return [
    { id: "org", label: c.orgStep, detail: org.created_at, state: "done" as const },
    { id: "compliance", label: c.compliance, detail: row.compliance,
      state: row.complianceCode === "CURRENT" ? "done" as const : row.complianceCode === "REVIEW" ? "current" as const : "pending" as const },
    { id: "diag", label: c.diag, detail: recorded(fiche.diagnostics.length), state: fiche.diagnostics.length > 0 ? "current" as const : "pending" as const },
    { id: "requests", label: c.requests, detail: recorded(fiche.requests.length), state: fiche.requests.length > 0 ? "current" as const : "pending" as const },
    { id: "missions", label: c.missions, detail: recorded(fiche.missions.length), state: fiche.missions.length > 0 ? "current" as const : "pending" as const },
  ];
}
