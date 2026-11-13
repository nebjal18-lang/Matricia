import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { FranchiseApplicationReview, type FranchiseApplicationReviewCopy, type FranchiseApplicationReviewModel } from "@/modules/admin/screens/franchise-applications/review-forms";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
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
    ? await client.from("franchise_invitations").select("id,franchise_id,status,expires_at").in("franchise_id", franchiseIds).order("created_at", { ascending: false })
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

function formatCreatedAt(value: string, locale: "fr" | "ar") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(date);
}

export default async function FranchiseApplicationsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/candidatures-franchise` }));
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const fr = locale === "fr";
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  const loaded = await client.from("franchise_applications").select("id,applicant_name,reply_email,territory_code,domain_label,status,organization_id,franchise_id,row_version,created_at").order("created_at", { ascending: false }).order("id").limit(50);
  const rows = z.array(rowSchema).safeParse(loaded.data);
  const list = rows.success ? rows.data : [];
  const candidateRows = list.filter((row) => !row.organization_id && ["COMPANY_REVIEW", "DOCUMENT_REVIEW"].includes(row.status));
  const candidates = new Map(await Promise.all(candidateRows.map(async (row) => {
    const result = await client.rpc("franchise_application_organization_candidates", { p_application_id: row.id });
    const parsed = candidateSchema.safeParse(result.data);
    return [row.id, result.error || !parsed.success ? [] : parsed.data.map((item) => ({ id: item.organization_id, name: item.display_name }))] as const;
  })));
  const organizationIds = [...new Set(list.flatMap((row) => row.organization_id ? [row.organization_id] : []))];
  const franchiseIds = list.flatMap((row) => row.franchise_id ? [row.franchise_id] : []);
  const [organizationsResult, franchisesResult, approvalsResult, invitationsResult] = await Promise.all([
    organizationIds.length ? client.from("organizations").select("id,display_name").in("id", organizationIds) : Promise.resolve({ data: [], error: null }),
    organizationIds.length ? client.from("franchises").select("id,operator_organization_id,territory_code,status").in("operator_organization_id", organizationIds).in("status", ["CONTRACT_PENDING", "ENTRY_FEE_SETUP", "LIBRARY_ASSIGNED", "ACTIVE"]) : Promise.resolve({ data: [], error: null }),
    franchiseIds.length ? client.from("franchise_approval_requests").select("id,franchise_id,row_version,requested_by").in("franchise_id", franchiseIds).eq("status", "PENDING") : Promise.resolve({ data: [], error: null }),
    loadInvitations(client, franchiseIds),
  ]);
  const organizations = new Map((organizationSchema.safeParse(organizationsResult.data).data ?? []).map((item) => [item.id, item.display_name]));
  const franchises = franchiseSchema.safeParse(franchisesResult.data).data ?? [];
  const approvals = approvalSchema.safeParse(approvalsResult.data).data ?? [];
  const invitations = invitationSchema.safeParse(invitationsResult.data).data ?? [];
  const bound = new Set(franchiseIds);
  const models: Array<{ row: z.infer<typeof rowSchema>; model: FranchiseApplicationReviewModel; keys: { propose: string; approve: string; resend: string } }> = list.map((row) => {
    const approval = row.franchise_id ? approvals.find((item) => item.franchise_id === row.franchise_id) : undefined;
    const invitation = row.franchise_id ? invitations.find((item) => item.franchise_id === row.franchise_id) : undefined;
    return {
      row,
      keys: { propose: randomUUID(), approve: randomUUID(), resend: randomUUID() },
      model: {
        id: row.id,
        status: row.status,
        rowVersion: row.row_version,
        organizationId: row.organization_id,
        franchiseId: row.franchise_id,
        isIt: row.domain_label.trim().toUpperCase().startsWith("IT —"),
        organizations: candidates.get(row.id) ?? [],
        franchises: franchises.filter((item) => item.operator_organization_id === row.organization_id && !bound.has(item.id)).map((item) => ({ id: item.id, label: `${moroccoRegionLabel(item.territory_code, locale) || item.territory_code} · ${statusLabels[item.status]?.[locale] ?? item.status}` })),
        approval: approval ? { id: approval.id, rowVersion: approval.row_version, requestedByMe: approval.requested_by === auth.user?.id } : null,
        invitationId: invitation?.id ?? null,
        invitationPending: Boolean(invitation && invitation.status === "SENT" && Date.parse(invitation.expires_at) > invitationsResult.observedAt),
      },
    };
  });
  const copy: FranchiseApplicationReviewCopy = {
    reason: fr ? "Motif" : "السبب",
    company: fr ? "Passer en revue société" : "الانتقال إلى مراجعة الشركة",
    documents: fr ? "Demander les pièces" : "طلب الوثائق",
    close: fr ? "Clore" : "إغلاق",
    link: fr ? "Lier l’organisation" : "ربط المؤسسة",
    organization: fr ? "Organisation du candidat" : "مؤسسة المترشح",
    noOrganization: fr ? "Le candidat n’a pas encore créé sa société franchisée. Il la rattache depuis son dossier après connexion." : "لم ينشئ المترشح شركة الامتياز بعد. سيربطها من ملفه بعد تسجيل الدخول.",
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
  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="parcours"
      parcoursCurrent="franchise-applications"
      alternateHref={`/${alternate}/administration/candidatures-franchise${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/command-center${space.selectedQuery}`, label: c.crumbAdmin }, { href: `/${locale}/administration/parcours${space.selectedQuery}`, label: c.navParcours }, { label: fr ? "Candidatures franchise" : "ترشيحات الامتياز" }]} />}
    >
      <main className="client-page admin-franchise-applications">
        <header className="admin-section-head">
          <div>
            <h1>{fr ? "Candidatures franchise" : "ترشيحات الامتياز"}</h1>
            <p>{fr ? "Chaque dépôt ouvre un dossier inscrit. Après la revue société et les pièces, le mandat est proposé depuis le dossier, approuvé par un second administrateur, puis activé par le candidat avec son code privé." : "كل إيداع يفتح ملفاً بحالة مسجّل. بعد مراجعة الشركة والوثائق يُقترح التفويض من الملف، ويعتمده مسؤول ثانٍ، ثم يفعّله المترشح برمزه الخاص."}</p>
          </div>
        </header>
        {loaded.error || !rows.success ? <p role="alert" className="admin-panel">{fr ? "Les candidatures sont indisponibles." : "الترشيحات غير متاحة."}</p> : list.length === 0 ? <p className="admin-panel">{fr ? "Aucune candidature enregistrée." : "لا يوجد ترشيح مسجّل."}</p> : (
          <ul className="admin-franchise-applications__list">
            {models.map(({ row, model, keys }) => {
              const status = statusLabels[row.status]?.[locale] ?? row.status;
              return (
                <li key={row.id} className="admin-work-card admin-franchise-card">
                  <div className="admin-work-card__head">
                    <div className="admin-work-card__title-block">
                      <h2>{row.applicant_name}</h2>
                      <p className="admin-work-card__motif" dir="ltr">{row.reply_email}</p>
                    </div>
                    <div className="admin-work-card__flags">
                      <span className="admin-badge" data-tone={statusTone(row.status)}>{status}</span>
                      {model.isIt ? <span className="admin-badge" data-tone="default">IT</span> : null}
                    </div>
                  </div>
                  <dl className="admin-work-meta">
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
                    {row.organization_id ? (
                      <div>
                        <dt>{fr ? "Organisation" : "المؤسسة"}</dt>
                        <dd>{organizations.get(row.organization_id) ?? (fr ? "Organisation rattachée" : "مؤسسة مرتبطة")}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {row.franchise_id ? (
                    <div className="admin-work-links">
                      <a className="admin-btn-outline !min-h-10 !px-3 !text-sm" href={`/${locale}/administration/territoires${space.selectedQuery}`}>
                        {fr ? "Ouvrir la gouvernance du mandat" : "فتح حوكمة التفويض"}
                      </a>
                    </div>
                  ) : null}
                  <FranchiseApplicationReview locale={locale} application={model} copy={copy} keys={keys} />
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AdminAppShell>
  );
}
