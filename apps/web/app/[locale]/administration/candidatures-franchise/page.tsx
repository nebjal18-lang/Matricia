import { readPage, readRelatedPages } from "@/modules/shared/lib/data/read-pages";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { adminFixturesHiddenLabel } from "@/modules/admin/data/spaces/actor-presentation";
import { FranchiseApplicationInviteForm } from "@/modules/admin/screens/franchise-applications/invite-form";
import {
  FranchiseApplicationReview,
  type FranchiseApplicationReviewCopy,
  type FranchiseApplicationReviewModel,
} from "@/modules/admin/screens/franchise-applications/review-forms";
import {
  filterFranchiseApplications,
  isFranchiseApplicationSettled,
  isFranchiseApplicationTreat,
  organizationDisplayName,
} from "@/modules/admin/screens/franchise-applications/model";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { AdminStep2Gate } from "@/modules/admin/ui/admin-step2-gate";
import { moroccoRegionLabel } from "@/modules/shared/lib/geo/morocco-regions";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const rowSchema = z.object({
  id: z.string().uuid(),
  applicant_name: z.string(),
  reply_email: z.string(),
  territory_code: z.string(),
  domain_label: z.string(),
  status: z.string(),
  organization_id: z.string().uuid().nullable(),
  franchise_id: z.string().uuid().nullable(),
  row_version: z.number().int().positive(),
  created_at: z.string(),
});
const candidateSchema = z.array(z.object({ organization_id: z.string().uuid(), display_name: z.string() }));
const franchiseSchema = z.array(z.object({ id: z.string().uuid(), operator_organization_id: z.string().uuid(), territory_code: z.string(), status: z.string() }));
const approvalSchema = z.array(z.object({ id: z.string().uuid(), franchise_id: z.string().uuid(), row_version: z.number().int().positive(), requested_by: z.string().uuid() }));
const invitationSchema = z.array(z.object({ id: z.string().uuid(), franchise_id: z.string().uuid(), status: z.string(), expires_at: z.string() }));
const organizationSchema = z.array(z.object({ id: z.string().uuid(), display_name: z.string() }));

async function loadInvitations(client: Awaited<ReturnType<typeof getSupabaseServerClient>>, franchiseIds: string[]) {
  const result = franchiseIds.length
    ? await readRelatedPages(franchiseIds, (ids, from, to) => client.from("franchise_invitations").select("id,franchise_id,status,expires_at").in("franchise_id", ids).order("created_at", { ascending: false }).order("id").range(from, to))
    : { data: [], error: null };
  return { ...result, observedAt: Date.now() };
}

const statusLabels: Record<string, { fr: string; ar: string }> = {
  REGISTERED: { fr: "Inscrit", ar: "مسجّل" },
  COMPANY_REVIEW: { fr: "Revue de la société", ar: "مراجعة الشركة" },
  DOCUMENT_REVIEW: { fr: "Pièces demandées", ar: "الوثائق مطلوبة" },
  CLOSED: { fr: "Clos", ar: "مغلق" },
  CONTRACT_PENDING: { fr: "Mandat proposé", ar: "التفويض مقترح" },
  ENTRY_FEE_SETUP: { fr: "Droit d’entrée en préparation", ar: "إعداد رسم الدخول" },
  LIBRARY_ASSIGNED: { fr: "Mandat approuvé, activation attendue", ar: "التفويض معتمد في انتظار التفعيل" },
  ACTIVE: { fr: "Franchise active", ar: "الامتياز نشط" },
  FINANCIAL_RESTRICTED: { fr: "Restriction financière", ar: "تقييد مالي" },
  SUSPENDED: { fr: "Suspendue", ar: "موقوف" },
  TERMINATED: { fr: "Terminée", ar: "منتهٍ" },
};

function statusTone(status: string): "critical" | "high" | "ok" | "default" {
  if (status === "ACTIVE") return "ok";
  if (status === "CLOSED" || status === "TERMINATED" || status === "SUSPENDED" || status === "FINANCIAL_RESTRICTED") return "critical";
  if (status === "CONTRACT_PENDING" || status === "LIBRARY_ASSIGNED" || status === "DOCUMENT_REVIEW" || status === "COMPANY_REVIEW") return "high";
  return "default";
}

const pipelineSteps = ["REGISTERED", "COMPANY_REVIEW", "DOCUMENT_REVIEW", "CONTRACT_PENDING", "ACTIVE"] as const;

function pipelineIndex(status: string): number {
  if (status === "LIBRARY_ASSIGNED" || status === "ENTRY_FEE_SETUP") return 3;
  if (status === "CLOSED" || status === "TERMINATED" || status === "SUSPENDED" || status === "FINANCIAL_RESTRICTED") return -1;
  return pipelineSteps.indexOf(status as (typeof pipelineSteps)[number]);
}

function formatCreatedAt(value: string, locale: "fr" | "ar") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(date);
}

function queueHref(locale: "fr" | "ar", baseQuery: string, next: { vue?: string; fixtures?: boolean; page?: number }) {
  const params = new URLSearchParams(baseQuery.startsWith("?") ? baseQuery.slice(1) : baseQuery);
  if (!next.vue || next.vue === "all") params.delete("vue");
  else params.set("vue", next.vue);
  if (next.fixtures) params.set("fixtures", "1");
  else params.delete("fixtures");
  if (next.page && next.page > 1) params.set("page", String(next.page));
  else params.delete("page");
  const qs = params.toString();
  return `/${locale}/administration/candidatures-franchise${qs ? `?${qs}` : ""}`;
}

export default async function FranchiseApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; vue?: string; fixtures?: string; ouvrir?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, ...(query.organizationId ? { organizationId: query.organizationId } : {}) });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/candidatures-franchise` }));
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const fr = locale === "fr";
  const includeFixtures = query.fixtures === "1";
  const inviteOpen = query.ouvrir === "1";
  const vue = query.vue?.trim() || "all";
  const inviteKey = randomUUID();
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  const pageInput = z.coerce.number().int().min(1).max(20001).safeParse(query.page ?? "1");
  const page = pageInput.success ? pageInput.data : 1;
  const loaded = await readPage((from, to) => client.from("franchise_applications").select("id,applicant_name,reply_email,territory_code,domain_label,status,organization_id,franchise_id,row_version,created_at").order("created_at", { ascending: false }).order("id").range(from, to), { offset: (page - 1) * 50, pageSize: 50 });
  const rows = z.array(rowSchema).safeParse(loaded.data);
  const list = rows.success ? rows.data : [];
  const listReady = pageInput.success && !loaded.error && rows.success;
  const { visible, hiddenFixtures, treatCount } = filterFranchiseApplications(list, { vue, includeFixtures });
  const candidateRows = visible.filter((row) => !row.organization_id && ["COMPANY_REVIEW", "DOCUMENT_REVIEW"].includes(row.status));
  const candidatePairs: Array<readonly [string, Array<{ id: string; name: string }> | null]> = [];
  for (let offset = 0; offset < candidateRows.length; offset += 8) {
    const chunk = candidateRows.slice(offset, offset + 8);
    candidatePairs.push(...await Promise.all(chunk.map(async (row) => {
      const result = await client.rpc("franchise_application_organization_candidates", { p_application_id: row.id });
      const parsed = candidateSchema.safeParse(result.data);
      return [row.id, result.error || !parsed.success ? null : parsed.data.map((item) => ({ id: item.organization_id, name: item.display_name }))] as const;
    })));
  }
  const candidates = new Map(candidatePairs);
  const candidatesReady = candidatePairs.every(([, options]) => options !== null);
  const organizationIds = [...new Set(visible.flatMap((row) => row.organization_id ? [row.organization_id] : []))];
  const franchiseIds = visible.flatMap((row) => row.franchise_id ? [row.franchise_id] : []);
  const [organizationsResult, franchisesResult, approvalsResult, invitationsResult] = await Promise.all([
    organizationIds.length ? readRelatedPages(organizationIds, (ids, from, to) => client.from("organizations").select("id,display_name").in("id", ids).order("id").range(from, to)) : Promise.resolve({ data: [], error: null }),
    organizationIds.length ? readRelatedPages(organizationIds, (ids, from, to) => client.from("franchises").select("id,operator_organization_id,territory_code,status").in("operator_organization_id", ids).in("status", ["CONTRACT_PENDING", "ENTRY_FEE_SETUP", "LIBRARY_ASSIGNED", "ACTIVE"]).order("id").range(from, to)) : Promise.resolve({ data: [], error: null }),
    franchiseIds.length ? readRelatedPages(franchiseIds, (ids, from, to) => client.from("franchise_approval_requests").select("id,franchise_id,row_version,requested_by").in("franchise_id", ids).eq("status", "PENDING").order("id").range(from, to)) : Promise.resolve({ data: [], error: null }),
    loadInvitations(client, franchiseIds),
  ]);
  const organizations = new Map((organizationSchema.safeParse(organizationsResult.data).data ?? []).map((item) => [item.id, item.display_name]));
  const franchises = franchiseSchema.safeParse(franchisesResult.data).data ?? [];
  const approvals = approvalSchema.safeParse(approvalsResult.data).data ?? [];
  const invitations = invitationSchema.safeParse(invitationsResult.data).data ?? [];
  const relationsReady = candidatesReady && ![organizationsResult, franchisesResult, approvalsResult, invitationsResult].some(result => result.error)
    && organizationSchema.safeParse(organizationsResult.data).success && franchiseSchema.safeParse(franchisesResult.data).success
    && approvalSchema.safeParse(approvalsResult.data).success && invitationSchema.safeParse(invitationsResult.data).success;
  const bound = new Set(franchiseIds);
  const models: Array<{ row: z.infer<typeof rowSchema>; model: FranchiseApplicationReviewModel; keys: { propose: string; approve: string; resend: string }; organization: ReturnType<typeof organizationDisplayName> }> = visible.map((row) => {
    const approval = row.franchise_id ? approvals.find((item) => item.franchise_id === row.franchise_id) : undefined;
    const invitation = row.franchise_id ? invitations.find((item) => item.franchise_id === row.franchise_id) : undefined;
    return {
      row,
      organization: organizationDisplayName(row.organization_id, organizations, locale),
      keys: { propose: randomUUID(), approve: randomUUID(), resend: randomUUID() },
      model: {
        id: row.id,
        status: row.status,
        rowVersion: row.row_version,
        organizationId: row.organization_id,
        franchiseId: row.franchise_id,
        isIt: row.domain_label.trim().toUpperCase().startsWith("IT —") || row.domain_label.trim().toUpperCase().startsWith("IT -"),
        organizations: candidates.get(row.id) ?? [],
        franchises: franchises.filter((item) => item.operator_organization_id === row.organization_id && !bound.has(item.id)).map((item) => ({ id: item.id, label: `${moroccoRegionLabel(item.territory_code, locale) || item.territory_code} · ${statusLabels[item.status]?.[locale] ?? item.status}` })),
        approval: approval ? { id: approval.id, rowVersion: approval.row_version, requestedByMe: approval.requested_by === auth.user?.id } : null,
        invitationId: invitation?.id ?? null,
        invitationPending: Boolean(invitation && invitation.status === "SENT" && Date.parse(invitation.expires_at) > invitationsResult.observedAt),
      },
    };
  });
  const copy: FranchiseApplicationReviewCopy = {
    reason: fr ? "Motif de la décision" : "سبب القرار",
    reasonHint: fr ? "Obligatoire pour tracer la décision (audit, 3 caractères min.)." : "إلزامي لتوثيق القرار (تدقيق، 3 أحرف على الأقل).",
    company: fr ? "Passer en revue société" : "الانتقال إلى مراجعة الشركة",
    documents: fr ? "Demander les pièces" : "طلب الوثائق",
    close: fr ? "Clore" : "إغلاق",
    link: fr ? "Lier l’organisation" : "ربط المؤسسة",
    organization: fr ? "Organisation du candidat" : "مؤسسة المترشح",
    noOrganization: fr ? "Organisation non liée : le candidat doit créer puis rattacher sa société franchisée depuis son dossier." : "مؤسسة غير مرتبطة: يجب أن ينشئ المترشح شركة الامتياز ويربطها من ملفه.",
    nextStepLinkOrg: fr ? "Prochaine étape : lier une organisation avant de poursuivre le mandat." : "الخطوة التالية: ربط مؤسسة قبل متابعة التفويض.",
    documentsBlocked: fr ? "Liez une organisation avant de proposer le mandat." : "اربطوا مؤسسة قبل اقتراح التفويض.",
    bind: fr ? "Rattacher ce mandat existant" : "ربط هذا التفويض الموجود",
    franchise: fr ? "Mandat déjà proposé pour cette organisation" : "تفويض مقترح سابقاً لهذه المؤسسة",
    pending: fr ? "Enregistrement…" : "جارٍ التسجيل…",
    denied: fr ? "Ce compte ne peut pas traiter cette candidature." : "لا يمكن لهذا الحساب معالجة هذا الترشيح.",
    conflict: fr ? "Le dossier a changé. Rechargez la page avant une nouvelle action." : "تغيّر الملف. أعيدوا تحميل الصفحة قبل إجراء جديد.",
    unavailable: fr ? "Action indisponible. Réessayez." : "الإجراء غير متاح. أعيدوا المحاولة.",
    saved: fr ? "Dossier mis à jour." : "تم تحديث الملف.",
    mfa: fr ? "Confirmez votre second facteur avant cette décision." : "أكدوا العامل الثاني قبل هذا القرار.",
    mailed: fr ? "Le candidat a reçu l’e-mail." : "توصل المترشح بالبريد.",
    notMailed: fr ? "L’e-mail n’est pas parti : envoyez un nouveau code quand l’adresse est joignable." : "لم يُرسل البريد: أرسلوا رمزاً جديداً عندما يصبح العنوان متاحاً.",
    propose: fr ? "Proposer le mandat" : "اقتراح التفويض",
    proposeTitle: fr ? "Mandat proposé au candidat" : "التفويض المقترح على المترشح",
    itRule: fr ? "Franchise IT : opérateur Hatim Ahmitech, droit d’entrée nul et exonéré, partage IT 50 % / 50 %." : "امتياز تكنولوجيا المعلومات: المشغل حاتم أحميتك، رسم دخول منعدم ومعفى، وتقاسم 50٪ / 50٪.",
    entryFee: fr ? "Droit d’entrée (MAD)" : "رسم الدخول (درهم)",
    entryFeeMode: fr ? "Modalité de règlement" : "طريقة الدفع",
    entryFeeTerm: fr ? "Durée d’échelonnement (mois, 1 à 6)" : "مدة التقسيط (من 1 إلى 6 أشهر)",
    mandateTerm: fr ? "Durée du mandat (mois)" : "مدة التفويض (بالأشهر)",
    conditions: fr ? "Conditions particulières" : "شروط خاصة",
    modes: { UPFRONT: fr ? "Comptant" : "دفعة واحدة", INSTALLMENT: fr ? "Échelonnement" : "أقساط", REVENUE_WITHHOLDING: fr ? "Retenue sur recettes" : "اقتطاع من الإيرادات" },
    approveTitle: fr ? "Approbation centrale du mandat" : "الموافقة المركزية على التفويض",
    approve: fr ? "Approuver le mandat" : "اعتماد التفويض",
    reject: fr ? "Refuser" : "رفض",
    fourEyes: fr ? "Vous avez proposé ce mandat : un autre administrateur doit l’approuver." : "اقترحتم هذا التفويض: يجب أن يعتمده مسؤول آخر.",
    resend: fr ? "Envoyer un nouveau code" : "إرسال رمز جديد",
    resendTitle: fr ? "Code privé d’activation" : "رمز التفعيل الخاص",
  };
  const pills = [
    { id: "all", label: fr ? `Tous (${includeFixtures ? list.length : list.length - hiddenFixtures})` : `الكل (${includeFixtures ? list.length : list.length - hiddenFixtures})` },
    { id: "treat", label: fr ? `À traiter (${treatCount})` : `للمعالجة (${treatCount})` },
    { id: "REGISTERED", label: statusLabels.REGISTERED![locale] },
    { id: "COMPANY_REVIEW", label: statusLabels.COMPANY_REVIEW![locale] },
    { id: "DOCUMENT_REVIEW", label: statusLabels.DOCUMENT_REVIEW![locale] },
    { id: "CONTRACT_PENDING", label: statusLabels.CONTRACT_PENDING![locale] },
    { id: "ACTIVE", label: statusLabels.ACTIVE![locale] },
    { id: "CLOSED", label: statusLabels.CLOSED![locale] },
  ];
  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="franchise-applications"
      alternateHref={`/${alternate}/administration/candidatures-franchise${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/command-center${space.selectedQuery}`, label: c.crumbAdmin }, { href: `/${locale}/administration/acteurs${space.selectedQuery}`, label: c.navActors }, { label: fr ? "Candidatures franchise" : "ترشيحات الامتياز" }]} />}
    >
      <div className="client-page admin-franchise-applications">
        <AdminStep2Gate locale={locale} query={space.selectedQuery} current="candidatures" />
        <header className="admin-section-head admin-franchise-applications__head">
          <div>
            <p className="admin-franchise-applications__kicker">{fr ? "Acteurs" : "الفاعلون"}</p>
            <h1>{fr ? "Candidatures franchise" : "ترشيحات الامتياز"}</h1>
            <p>
              {fr
                ? "Ici on crée et instruit les dossiers. L’annuaire Franchisés liste seulement les actifs. Après revue société et pièces : mandat, quatre yeux, puis activation par le candidat."
                : "هنا تُنشأ الملفات وتُدرس. دليل أصحاب الامتياز يعرض النشطين فقط. بعد مراجعة الشركة والوثائق: التفويض، أربعة أعين، ثم التفعيل من المترشح."}
            </p>
            <div className="admin-franchise-applications__toolbar">
              <FranchiseApplicationInviteForm locale={locale} query={space.selectedQuery} idempotencyKey={inviteKey} open={inviteOpen} />
              <p className="client-actions">
                <Link href={`/${locale}/franchise/candidature`}>{fr ? "Formulaire public candidat" : "استمارة المترشح العامة"}</Link>
                {" · "}
                <Link href={`/${locale}/administration/franchises${space.selectedQuery}`}>{fr ? "Annuaire franchisés (actifs)" : "دليل أصحاب الامتياز (نشطون)"}</Link>
              </p>
            </div>
          </div>
          {listReady ? (
            <div className="admin-franchise-applications__stats" aria-label={fr ? "Synthèse file" : "ملخص الطابور"}>
              <div>
                <span>{fr ? "Visibles" : "الظاهرة"}</span>
                <strong>{visible.length}</strong>
              </div>
              <div data-tone={treatCount > 0 ? "high" : "ok"}>
                <span>{fr ? "À traiter" : "للمعالجة"}</span>
                <strong>{treatCount}</strong>
              </div>
            </div>
          ) : null}
        </header>
        {listReady ? (
          <nav className="admin-pills admin-franchise-applications__pills" aria-label={fr ? "Filtres candidatures" : "مرشحات الترشيحات"}>
            {pills.map((pill) => (
              <Link key={pill.id} href={queueHref(locale, space.selectedQuery, { vue: pill.id, fixtures: includeFixtures })} aria-current={vue === pill.id ? "page" : undefined}>
                {pill.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {hiddenFixtures > 0 ? (
          <p role="status" className="client-access-note">
            {adminFixturesHiddenLabel(hiddenFixtures, locale)}{" "}
            <Link className="client-text-link" href={queueHref(locale, space.selectedQuery, { vue, fixtures: true })}>
              {fr ? "Afficher les données de démo" : "إظهار بيانات العرض"}
            </Link>
          </p>
        ) : null}
        {listReady ? <nav aria-label={fr ? "Pages des candidatures" : "صفحات الترشيحات"}>
          <p>{fr ? `Page ${page} — compteurs et filtres sur cette page` : `الصفحة ${page} — الأعداد والمرشحات تخص هذه الصفحة`}</p>
          {page > 1 ? <Link href={queueHref(locale, space.selectedQuery, { vue, fixtures: includeFixtures, page: page - 1 })}>{fr ? "Précédente" : "السابق"}</Link> : null}
          {loaded.nextOffset !== null ? <Link href={queueHref(locale, space.selectedQuery, { vue, fixtures: includeFixtures, page: page + 1 })}>{fr ? "Suivante" : "التالي"}</Link> : null}
        </nav> : null}
        {!listReady ? <p role="alert" className="admin-panel">{fr ? "Les candidatures sont indisponibles." : "الترشيحات غير متاحة."}</p> : visible.length === 0 ? (
          <p className="admin-panel">
            {list.length === 0
              ? (fr ? "Aucune candidature sur cette page." : "لا يوجد ترشيح مسجّل.")
              : (fr ? "Aucune candidature ne correspond à ce filtre sur cette page." : "لا يوجد ترشيح مطابق لهذا المرشح.")}
          </p>
        ) : (
          <ul className="admin-franchise-applications__list">
            {models.map(({ row, model, keys, organization }) => {
              const status = statusLabels[row.status]?.[locale] ?? row.status;
              const settled = isFranchiseApplicationSettled(row.status);
              const treat = isFranchiseApplicationTreat(row.status);
              const tone = statusTone(row.status);
              const step = pipelineIndex(row.status);
              const initial = row.applicant_name.trim().slice(0, 1).toLocaleUpperCase(locale === "ar" ? "ar-MA" : "fr-MA") || "·";
              const pipelineLabels = {
                REGISTERED: statusLabels.REGISTERED![locale],
                COMPANY_REVIEW: fr ? "Revue" : "مراجعة",
                DOCUMENT_REVIEW: fr ? "Pièces" : "وثائق",
                CONTRACT_PENDING: fr ? "Mandat" : "تفويض",
                ACTIVE: statusLabels.ACTIVE![locale],
              } as const;
              return (
                <li key={row.id} className="admin-work-card admin-franchise-card" data-status={row.status} data-tone={tone} data-treat={treat ? "true" : undefined}>
                  <div className="admin-franchise-card__accent" aria-hidden />
                  <div className="admin-franchise-card__body">
                    <div className="admin-work-card__head">
                      <div className="admin-franchise-card__identity">
                        <span className="admin-franchise-card__avatar" data-tone={tone} aria-hidden>{initial}</span>
                        <div className="admin-work-card__title-block">
                          <h2>{row.applicant_name}</h2>
                          <p className="admin-work-card__motif admin-franchise-card__email" dir="ltr">{row.reply_email}</p>
                        </div>
                      </div>
                      <div className="admin-work-card__flags">
                        <span className="admin-badge" data-tone={tone}>{status}</span>
                        {model.isIt ? <span className="admin-badge" data-tone="default">IT</span> : null}
                        {treat ? <span className="admin-badge" data-tone="high">{fr ? "À traiter" : "للمعالجة"}</span> : null}
                      </div>
                    </div>
                    {step >= 0 ? (
                      <ol className="admin-franchise-card__pipeline" aria-label={fr ? "Étapes du dossier" : "مراحل الملف"}>
                        {pipelineSteps.map((id, index) => {
                          const state = index < step ? "done" : index === step ? "current" : "todo";
                          return (
                            <li key={id} data-state={state}>
                              <span className="admin-franchise-card__pipeline-dot" aria-hidden />
                              <span>{pipelineLabels[id]}</span>
                            </li>
                          );
                        })}
                      </ol>
                    ) : null}
                    <dl className="admin-work-meta admin-franchise-card__meta">
                      <div>
                        <dt>{fr ? "Territoire" : "الإقليم"}</dt>
                        <dd>{moroccoRegionLabel(row.territory_code, locale) || row.territory_code}</dd>
                      </div>
                      <div>
                        <dt>{fr ? "Domaine" : "المجال"}</dt>
                        <dd>{row.domain_label}</dd>
                      </div>
                      <div>
                        <dt>{fr ? "Déposée le" : "أُودعت في"}</dt>
                        <dd><time dateTime={row.created_at} dir="ltr">{formatCreatedAt(row.created_at, locale)}</time></dd>
                      </div>
                      <div>
                        <dt>{fr ? "Organisation" : "المؤسسة"}</dt>
                        <dd data-linked={organization.linked ? "true" : "false"}>
                          <span>{organization.label}</span>
                          <span className="admin-franchise-card__link-chip" data-linked={organization.linked ? "true" : "false"}>
                            {organization.linked ? (fr ? "Liée" : "مرتبطة") : (fr ? "Non liée" : "غير مرتبطة")}
                          </span>
                        </dd>
                      </div>
                    </dl>
                    {row.franchise_id ? (
                      <div className="admin-franchise-card__toolbar">
                        <a className="admin-franchise-card__gov-link" href={`/${locale}/administration/territoires${space.selectedQuery}`}>
                          {fr ? "Gouvernance du mandat" : "حوكمة التفويض"}
                        </a>
                      </div>
                    ) : null}
                    <div className="admin-franchise-card__footer" data-kind={settled ? "settled" : "action"} data-tone={settled ? tone : undefined}>
                      {settled ? (
                        <p className="admin-franchise-settled" role="status">
                          {row.status === "ACTIVE"
                            ? (fr ? "Franchise active — aucune action de revue sur cette candidature." : "امتياز نشط — لا إجراء مراجعة على هذا الترشيح.")
                            : (fr ? "Dossier clos ou restreint — aucune action de revue." : "ملف مغلق أو مقيّد — لا إجراء مراجعة.")}
                        </p>
                      ) : (
                        relationsReady ? <FranchiseApplicationReview locale={locale} application={model} copy={copy} keys={keys} /> : <p role="alert">{fr ? "Données de revue indisponibles. Rechargez le dossier." : "بيانات المراجعة غير متاحة. أعيدوا تحميل الملف."}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminAppShell>
  );
}
