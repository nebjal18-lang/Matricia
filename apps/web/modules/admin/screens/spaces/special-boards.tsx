"use client";

import{ProductionReference}from"./production-reference";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import {
  CheckCircle2, Eye, FileText, Lock, Plus, RefreshCw, Send, ShieldCheck, Users,
} from "lucide-react";
import { requestSpaceMutation, type AdminActionState } from "./space-actions";
import { PipelineGlyph } from "./pipeline-step";
import type { SpaceRow } from "@/modules/admin/data/spaces/space-data";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

const idle: AdminActionState = { status: "idle" };

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

function Feedback({ state, locale }: { state: { status: string; reason?: string }; locale: Locale }) {
  if (state.status === "success") return <p className="admin-banner" data-tone="ok" role="status">{t(locale, "Action enregistrée.", "تم تسجيل الإجراء.")}</p>;
  if (state.status !== "error") return null;
  return <p className="admin-banner" data-tone="danger" role="alert">{state.reason ?? t(locale, "Exécution refusée.", "تعذر التنفيذ.")}</p>;
}

function HiddenIdentity({
  locale, space, itemId, organizationId, view, resourceType,
}: {
  locale: Locale; space: string; itemId: string; organizationId?: string; view: string; resourceType: string;
}) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} /><ProductionReference locale={locale}/>
      <input type="hidden" name="space" value={space} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="organizationId" value={organizationId ?? ""} />
      <input type="hidden" name="resourceId" value={itemId} />
      <input type="hidden" name="resourceType" value={resourceType} />
      <input type="hidden" name="view" value={view} />
    </>
  );
}

const consultationSteps = (locale: Locale) => [
  { label: t(locale, "Destinataires", "المستلمون"), hint: t(locale, "Prestataires sélectionnés", "مقدمو الخدمات المختارون"), tone: "violet" as const },
  { label: t(locale, "Contenu partagé", "المحتوى المشترك"), hint: t(locale, "Documents et informations", "وثائق ومعلومات"), tone: "sky" as const },
  { label: t(locale, "Questions", "الأسئلة"), hint: t(locale, "Cahier de réponses", "دفتر الردود"), tone: "peach" as const },
  { label: t(locale, "Échéance", "الأجل"), hint: t(locale, "Délai et modalités", "المهلة والكيفيات"), tone: "mint" as const },
  { label: t(locale, "Validation", "المصادقة"), hint: t(locale, "Contrôles et revue", "رقابة ومراجعة"), tone: "violet" as const },
  { label: t(locale, "Envoi", "الإرسال"), hint: t(locale, "Invitation des prestataires", "دعوة مقدمي الخدمات"), tone: "sky" as const },
];

const reuseSteps = (locale: Locale) => [
  { label: t(locale, "Destination", "الوجهة"), hint: t(locale, "Où utiliser le document", "أين يُستخدم المستند"), tone: "violet" as const },
  { label: t(locale, "Usage", "الاستخدام"), hint: t(locale, "Contexte et lien", "السياق والربط"), tone: "sky" as const },
  { label: t(locale, "Version", "النسخة"), hint: t(locale, "Choix et fraîcheur", "الاختيار والحداثة"), tone: "peach" as const },
  { label: t(locale, "Permissions", "الصلاحيات"), hint: t(locale, "Accès et sécurité", "الوصول والأمن"), tone: "mint" as const },
  { label: t(locale, "Validation", "المصادقة"), hint: t(locale, "Récapitulatif", "الملخص"), tone: "violet" as const },
];

export type NotificationTemplateRow = {
  id: string;
  template_code: string;
  event_type: string;
  category_code: string;
  locale: string;
  version: number;
  status: string;
  mandatory: boolean;
  channels: string[];
};

export function ConsultationSendBoard({
  locale, query, row,
}: {
  locale: Locale; query: string; row: SpaceRow;
}) {
  const [state, action, pending] = useActionState(requestSpaceMutation, idle);
  const steps = consultationSteps(locale);
  type Candidate = { provider_organization_id: string; provider_name: string; eligible: boolean; score_basis_points: number; exclusion_reasons: string[] };
  let candidates: Candidate[] = [];
  try {
    const parsed = JSON.parse(row.extras?.candidates ?? "[]") as Candidate[];
    if (Array.isArray(parsed)) candidates = parsed;
  } catch {
    candidates = [];
  }
  const recipients = candidates.length
    ? candidates.map((item) => ({
      id: item.provider_organization_id,
      name: item.provider_name,
      status: item.eligible ? t(locale, "Éligible", "مؤهل") : t(locale, "Exclu", "مستبعد"),
      reason: item.eligible
        ? `${item.score_basis_points}/10000`
        : (item.exclusion_reasons[0] ?? t(locale, "Règle d’exclusion", "قاعدة استبعاد")),
      tone: item.eligible ? "mint" as const : "peach" as const,
      eligible: item.eligible,
    }))
    : [];
  return (
    <main className="client-page" data-admin-layout="consultation" data-admin-space="matching">
      <ol className="admin-pipeline" data-count="6">
        {steps.map((step, index) => (
          <li key={step.label} data-current={index === 0 ? "true" : undefined}>
            <PipelineGlyph index={index} tone={step.tone} />
            <strong>{index + 1}. {step.label}</strong>
            <small>{step.hint}</small>
          </li>
        ))}
      </ol>
      <form action={action} className="admin-form-layout">
        <HiddenIdentity locale={locale} space="matching" itemId={row.id} organizationId={row.organizationId} view="consultation" resourceType="MATCHING" />
        <section className="client-stack">
          <article className="client-card">
            <header className="client-priority-head">
              <h2>{t(locale, "Destinataires sélectionnés", "المستلمون المختارون")}</h2>
              <Link href={`/${locale}/administration/providers${query}`} className="admin-soft-cta"><Plus className="size-4" aria-hidden />{t(locale, "Ajouter des prestataires", "إضافة مقدمي خدمات")}</Link>
            </header>
            <p>{t(locale, "Prestataires issus du matching explicable. L’envoi ouvre une demande à quatre yeux. Après approbation, seuls les destinataires approuvés et encore éligibles sont invités.", "مقدمو الخدمات من المطابقة القابلة للتفسير. الإرسال يطلب تحققاً بأربعة أعين. بعد الموافقة تتم دعوة الجهات المعتمدة والتي لا تزال مؤهلة فقط.")}</p>
            {recipients.length === 0 ? (
              <p className="admin-banner" data-tone="warn">{t(locale, "Aucun candidat de matching n’est encore disponible pour cette demande.", "لا يوجد مرشح مطابقة لهذه الطلب بعد.")}</p>
            ) : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{t(locale, "Prestataire", "مقدم الخدمة")}</th>
                    <th>{t(locale, "Statut d’éligibilité", "حالة الأهلية")}</th>
                    <th>{t(locale, "Score / exclusion", "النتيجة / الاستبعاد")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <label className="admin-check">
                          <input type="checkbox" name="providerIds" value={item.id} defaultChecked={item.eligible} />
                          <Users className="size-4" aria-hidden />
                          <strong>{item.name}</strong>
                        </label>
                      </td>
                      <td><span className="client-status-chip" data-tone={item.tone}>{item.status}</span></td>
                      <td>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </article>
          <article className="client-card">
            <header className="client-priority-head">
              <h2>{t(locale, "Contenu partagé", "المحتوى المشترك")}</h2>
              <Link href={`/${locale}/administration/documents${query}`} className="admin-soft-cta"><FileText className="size-4" aria-hidden />{t(locale, "Ouvrir le coffre", "فتح الخزينة")}</Link>
            </header>
            <p>{t(locale, "Les documents réellement partagés sont ceux du dossier de la demande. Aucun pack illustratif n’est inventé ici.", "الوثائق المشتركة هي وثائق ملف الطلب. لا تُخترع حزمة توضيحية هنا.")}</p>
          </article>
          <article className="client-card">
            <header><h2>{t(locale, "Détails de la consultation", "تفاصيل الاستشارة")}</h2></header>
            <div className="admin-form-grid" data-cols="3">
              <div className="admin-field">
                <label htmlFor="consult-object">{t(locale, "Objectif de la consultation", "هدف الاستشارة")}</label>
                <textarea id="consult-object" name="note" required minLength={3} defaultValue={row.title} />
              </div>
              <div className="admin-field">
                <label htmlFor="consult-constraints">{t(locale, "Contraintes particulières", "قيود خاصة")}</label>
                <textarea id="consult-constraints" name="context" minLength={3} defaultValue={row.cells[3] ?? ""} />
              </div>
              <div className="admin-field">
                <label htmlFor="consult-due">{t(locale, "Délai de réponse souhaité", "أجل الرد المطلوب")}</label>
                <input id="consult-due" name="dueAt" type="date" required />
                <label htmlFor="consult-channel">{t(locale, "Canal de questions", "قناة الأسئلة")}</label>
                <select id="consult-channel" name="channel" defaultValue="platform">
                  <option value="platform">{t(locale, "Via la plateforme Matricia", "عبر منصة ماتريسيا")}</option>
                </select>
              </div>
            </div>
          </article>
        </section>
        <aside className="client-stack">
          <article className="client-card">
            <header><h2>{t(locale, "Rappels et garanties", "تذكيرات وضمانات")}</h2></header>
            <ul className="admin-impact">
              <li><ShieldCheck className="size-4" aria-hidden /><span><strong>{t(locale, "Revue humaine", "مراجعة بشرية")}</strong><small>{t(locale, "Cette consultation sera soumise à une revue humaine avant envoi, conformément à nos règles de qualité.", "ستُعرض هذه الاستشارة على مراجعة بشرية قبل الإرسال وفق قواعد الجودة.")}</small></span></li>
              <li><Lock className="size-4" aria-hidden /><span><strong>{t(locale, "Confidentialité", "السرية")}</strong><small>{t(locale, "Les informations partagées sont strictement confidentielles. Elles ne seront visibles que par les prestataires invités.", "المعلومات المشتركة سرية تماماً ولا يراها إلا المدعوون.")}</small></span></li>
              <li><Eye className="size-4" aria-hidden /><span><strong>{t(locale, "Aucune offre concurrente visible", "لا عرض منافس ظاهر")}</strong><small>{t(locale, "Les réponses des prestataires restent anonymes entre eux.", "تبقى ردود مقدمي الخدمات مجهولة فيما بينهم.")}</small></span></li>
              <li><RefreshCw className="size-4" aria-hidden /><span><strong>{t(locale, "Invitation idempotente", "دعوة غير قابلة للتكرار")}</strong><small>{t(locale, "En cas de nouvel envoi aux mêmes prestataires, aucune invitation ne sera plus envoyée par duplication.", "عند إعادة الإرسال لنفس المدعوين لا تُنشأ دعوة مكررة.")}</small></span></li>
            </ul>
          </article>
          <article className="client-card admin-preview-card">
            <header className="client-priority-head">
              <h2>{t(locale, "Aperçu du message d’invitation", "معاينة رسالة الدعوة")}</h2>
              <nav className="admin-pills" aria-label={t(locale, "Langue de l’aperçu", "لغة المعاينة")}>
                <a href="#preview-fr" aria-current={locale === "fr" ? "page" : undefined}>Français</a>
                <a href="#preview-ar" aria-current={locale === "ar" ? "page" : undefined}>العربية</a>
              </nav>
            </header>
            <div id="preview-fr" className="admin-preview-pane" hidden={locale === "ar"}>
              <p><strong>{t(locale, "Objet", "الموضوع")} :</strong> {t(locale, "Invitation à répondre à une consultation", "دعوة للرد على استشارة")}</p>
              <p>{t(locale, "Bonjour, vous êtes invités à répondre à une consultation sur la plateforme Matricia. Vous trouverez ci-joint les documents partagés, l’objectif, les livrables attendus, les contraintes et les modalités de réponse.", "مرحباً، أنتم مدعوون للرد على استشارة عبر منصة ماتريسيا. ستجدون الوثائق المشتركة والهدف والتسليمات والقيود وكيفيات الرد.")}</p>
            </div>
            <div id="preview-ar" className="admin-preview-pane" hidden={locale !== "ar"} dir="rtl">
              <p><strong>الموضوع :</strong> دعوة للمشاركة في استشارة</p>
              <p>ندعوكم للمشاركة في استشارة عبر منصة ماتريسيا. ستجدون رفق هذا الرسالة الهدف، المخرجات المتوقعة، القيود وشروط الرد.</p>
            </div>
          </article>
        </aside>
        <div className="admin-form-foot" data-span="2">
          <Link href={`/${locale}/administration/matching${query}`} className="client-ghost-link">{t(locale, "Retour au matching", "العودة إلى المطابقة")}</Link>
          <button type="submit" name="intent" value="CHANGE_CONFIGURATION" className="admin-soft-cta" disabled={pending}>{t(locale, "Enregistrer le brouillon", "حفظ المسودة")}</button>
          <button type="submit" name="decision" value="SUBMIT" className="admin-danger-cta" disabled={pending}>{t(locale, "Soumettre la proposition à validation", "إرسال المقترح للمصادقة")}</button>
          <button type="submit" name="decision" value="SEND" className="admin-primary-cta" disabled={pending}><Send className="size-4" aria-hidden />{pending ? "…" : t(locale, "Ouvrir la consultation après approbation", "فتح الاستشارة بعد الموافقة")}</button>
        </div>
        <Feedback state={state} locale={locale} />
      </form>
    </main>
  );
}

export function DocumentReuseBoard({
  locale, query, row,
}: {
  locale: Locale; query: string; row?: SpaceRow | null;
}) {
  const [state, action, pending] = useActionState(requestSpaceMutation, idle);
  const steps = reuseSteps(locale);
  const itemId = row?.id ?? crypto.randomUUID();
  const destinations = [
    {value:"COMPLIANCE_CASE",label:t(locale,"Conformité","الامتثال"),hint:t(locale,"Lier au dossier de conformité existant","ربط ملف الامتثال الموجود"),tone:"violet"as const},
    { value: "SERVICE_REQUEST", label: t(locale, "Demande", "طلب"), hint: t(locale, "Attacher à un besoin ou une demande", "ربطه بحاجة أو طلب"), tone: "sky" as const },
    { value: "CONTRACT_VERSION", label: t(locale, "Contrat", "عقد"), hint: t(locale, "Lier à un contrat existant", "ربطه بعقد قائم"), tone: "peach" as const },
    { value: "MISSION", label: t(locale, "Mission", "مهمة"), hint: t(locale, "Lier à une mission en cours", "ربطه بمهمة جارية"), tone: "mint" as const },
  ];
  return (
    <main className="client-page" data-admin-layout="document-reuse" data-admin-space="documents">
      <ol className="admin-pipeline" data-count="5">
        {steps.map((step, index) => (
          <li key={step.label} data-current={index === 0 ? "true" : undefined}>
            <PipelineGlyph index={index} tone={step.tone} />
            <strong>{index + 1}. {step.label}</strong>
            <small>{step.hint}</small>
          </li>
        ))}
      </ol>
      <form action={action} className="admin-form-layout">
        <HiddenIdentity locale={locale} space="documents" itemId={itemId} organizationId={row?.organizationId} view="reutilisation" resourceType="DOCUMENT" />
        <section className="client-stack">
          <article className="client-card">
            <header className="client-priority-head">
              <div>
                <h2>{t(locale, "1. Sélection du document existant", "1. اختيار الوثيقة القائمة")}</h2>
                <p>{t(locale, "Choisissez un document déjà présent dans votre coffre et autorisé à être réutilisé.", "اختاروا وثيقة موجودة في الخزينة ومصرّحاً بإعادة استخدامها.")}</p>
              </div>
              <Link href={`/${locale}/administration/documents${query}`} className="admin-soft-cta">{t(locale, "Parcourir le coffre", "تصفح الخزينة")}</Link>
            </header>
            <div className="admin-field">
              <label htmlFor="reuse-document">{t(locale, "Document", "الوثيقة")} *</label>
              <select id="reuse-document" name="documentId" required defaultValue={row?.id ?? ""}>
                <option value={row?.id ?? ""}>{row?.title ?? t(locale, "Document du coffre", "وثيقة الخزينة")}</option>
              </select>
            </div>
            <p className="admin-banner" data-tone="sky">{t(locale, "Vous réutilisez le document existant. Aucun duplicata ne sera créé, seul un lien sécurisé sera établi.", "تعيدون استخدام الوثيقة القائمة. لن يُنشأ أي نسخة، بل رابط آمن فقط.")}</p>
          </article>
          <article className="client-card">
            <header>
              <h2>{t(locale, "2. Destination", "2. الوجهة")}</h2>
              <p>{t(locale, "Indiquez où vous souhaitez réutiliser ce document.", "حدّدوا أين تريدون إعادة استخدام هذه الوثيقة.")}</p>
            </header>
            <div className="admin-radio-row" data-cards="true">
              {destinations.map((item, index) => (
                <label key={item.value} data-tone={item.tone}>
                  <input type="radio" name="destination" value={item.value} defaultChecked={index === 0} />
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </label>
              ))}
            </div>
            <div className="admin-field">
              <label htmlFor="reuse-target">{t(locale, "Élément de destination", "عنصر الوجهة")} *</label>
              <input id="reuse-target" name="targetId" required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" placeholder={t(locale, "Référence de la demande, version de contrat ou mission", "مرجع الطلب أو نسخة العقد أو المهمة")} />
            </div>
          </article>
          <div className="admin-field"><label htmlFor="reuse-purpose">{t(locale, "Finalité de la réutilisation", "غرض إعادة الاستخدام")}</label><textarea id="reuse-purpose" name="purpose" required minLength={3} maxLength={500}/></div>
          <article className="admin-banner" data-tone="danger">
            <strong>{t(locale, "Vérification du périmètre d’organisation", "التحقق من نطاق المؤسسة")}</strong>
            <p>{t(locale, "Le serveur vérifie l’organisation propriétaire, la destination et l’état antivirus. Le propriétaire doit ensuite consentir dans son coffre.", "يتحقق الخادم من المؤسسة والوجهة وحالة فحص الملف. ثم يلزم موافقة المالك في الخزينة.")}</p>
            <p>{t(locale, "Les destinations d’une autre organisation sont refusées lors de la vérification.", "تُرفض وجهات المؤسسات الأخرى أثناء التحقق.")}</p>
          </article>
        </section>
        <aside className="client-stack">
          <article className="client-card" data-tone="peach">
            <header><h2>{t(locale, "Informations sur le document", "معلومات الوثيقة")}</h2></header>
            <dl className="admin-dl">
              <div><dt>{t(locale, "Nom", "الاسم")}</dt><dd>{row?.title ?? "—"}</dd></div>
              <div><dt>{t(locale, "Type", "النوع")}</dt><dd>{row?.cells[2] ?? "—"}</dd></div>
              <div><dt>{t(locale, "Taille", "الحجم")}</dt><dd>{row?.cells[4] ?? "—"}</dd></div>
              <div><dt>{t(locale, "Dernière mise à jour", "آخر تحديث")}</dt><dd>{row?.cells[8] ?? row?.status ?? "—"}</dd></div>
              <div><dt>{t(locale, "Source / provenance", "المصدر")}</dt><dd>{row?.cells[1] ?? "—"}</dd></div>
              <div><dt>{t(locale, "Organisation propriétaire", "المؤسسة المالكة")}</dt><dd>{row?.cells[1] ?? "—"}</dd></div>
            </dl>
            <p className="admin-banner" data-tone="ok">{t(locale, "La validité sera contrôlée lors du consentement du propriétaire.", "سيتم التحقق من الصلاحية عند موافقة المالك.")}</p>
          </article>
          <article className="client-card">
            <header><h2>{t(locale, "Politique de fraîcheur", "سياسة الحداثة")}</h2></header>
            <dl className="admin-dl">
              <div><dt>{t(locale, "Statut actuel", "الحالة الحالية")}</dt><dd><span className="client-status-chip" data-tone="mint">{row?.status ?? "—"}</span></dd></div>
              <div><dt>{t(locale, "Dernière mise à jour", "آخر تحديث")}</dt><dd>{row?.status ?? "—"}</dd></div>
              <div><dt>{t(locale, "Durée de validité", "مدة الصلاحية")}</dt><dd>{row?.cells[8] ?? "—"}</dd></div>
              <div><dt>{t(locale, "Expiration", "الانتهاء")}</dt><dd>{row?.cells[8] ?? "—"}</dd></div>
            </dl>
            <p className="admin-banner" data-tone="sky">{t(locale, "Une alerte sera affichée si le document est expiré lors de son utilisation.", "سيظهر تنبيه إذا انتهت صلاحية الوثيقة عند الاستخدام.")}</p>
          </article>
          <article className="client-card">
            <header><h2>{t(locale, "Droits qui seront recalculés", "حقوق سيعاد حسابها")}</h2></header>
            <ul className="admin-impact">
              <li><CheckCircle2 className="size-4" aria-hidden />{t(locale, "Accès hérités du document", "صلاحيات موروثة من الوثيقة")}</li>
              <li><CheckCircle2 className="size-4" aria-hidden />{t(locale, "Règles spécifiques à la destination", "قواعد خاصة بالوجهة")}</li>
              <li><CheckCircle2 className="size-4" aria-hidden />{t(locale, "Restrictions d’organisation", "قيود المؤسسة")}</li>
              <li><CheckCircle2 className="size-4" aria-hidden />{t(locale, "Accès temporaire (si activé)", "وصول مؤقت إن فُعّل")}</li>
            </ul>
          </article>
        </aside>
        <div className="admin-form-foot" data-span="2">
          <Link href={`/${locale}/administration/documents${query}`} className="client-ghost-link">{t(locale, "Annuler", "إلغاء")}</Link>

          <button type="submit" name="decision" value="LINK" className="admin-primary-cta" disabled={pending}>{pending ? "…" : t(locale, "Demander le consentement du propriétaire", "طلب موافقة المالك")}</button>
        </div>
        <Feedback state={state} locale={locale} />
      </form>
    </main>
  );
}

export function NotificationPreferencesBoard({
  locale, query, templates = [],
}: {
  locale: Locale; query: string; templates?: NotificationTemplateRow[];
}) {
  const [state, action, pending] = useActionState(requestSpaceMutation, idle);
  const selected = templates[0];
  return (
    <main className="client-page" data-admin-layout="notification-preferences" data-admin-space="messagerie">
      <form action={action} className="admin-form-layout">
        <HiddenIdentity locale={locale} space="messagerie" itemId="preferences" view="preferences" resourceType="NOTIFICATION_TEMPLATE" />
        <section className="client-stack" id="regles">
          <article className="client-card">
            <header>
              <h2>{t(locale, "Modèles de notification publiés", "قوالب الإشعارات المنشورة")}</h2><Link href={`/${locale}/administration/notifications/modeles`} className="admin-soft-cta">{t(locale,"Ouvrir l’éditeur FR/AR et les approbations","فتح محرر الفرنسية والعربية والموافقات")}</Link>
              <p>{t(locale, "Versions actives conservées. Révisez les textes FR/AR dans l’éditeur dédié ; l’activation exige des approbations indépendantes.", "تُحفظ النسخ النشطة. راجعوا النصوص الفرنسية والعربية في المحرر المخصص؛ يتطلب التفعيل موافقات مستقلة.")}</p>
            </header>
            {templates.length === 0 ? (
              <p className="admin-banner" data-tone="warn">{t(locale, "Aucun modèle actif n’est visible avec vos droits actuels.", "لا يظهر أي قالب نشط بصلاحياتك الحالية.")}</p>
            ) : (
              <div className="client-table-wrap">
                <table className="client-space-table">
                  <thead>
                    <tr>
                      <th>{t(locale, "Code", "الرمز")}</th>
                      <th>{t(locale, "Événement", "الحدث")}</th>
                      <th>{t(locale, "Catégorie", "الفئة")}</th>
                      <th>{t(locale, "Locale", "اللغة")}</th>
                      <th>{t(locale, "Canaux", "القنوات")}</th>
                      <th>{t(locale, "Version", "النسخة")}</th>
                      <th>{t(locale, "Statut", "الحالة")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.template_code}</strong></td>
                        <td>{item.event_type}</td>
                        <td>{item.category_code}</td>
                        <td dir="ltr">{item.locale}</td>
                        <td>{item.channels.join(" · ")}</td>
                        <td dir="ltr">v{item.version}</td>
                        <td><span className="client-status-chip" data-tone={item.mandatory ? "peach" : "mint"}>{item.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          <article className="client-card">
            <header><h2>{t(locale, "Demande de revue d’un modèle", "طلب مراجعة قالب")}</h2></header>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label htmlFor="rule-event">{t(locale, "Modèle concerné", "القالب المعني")}</label>
                <select id="rule-event" name="note" defaultValue={selected?.id ?? ""} disabled={templates.length === 0}>
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>{item.template_code} · {item.locale} · v{item.version}</option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <label htmlFor="rule-reason">{t(locale, "Motif de la revue", "سبب المراجعة")}</label>
                <textarea id="rule-reason" name="justification" required minLength={10} maxLength={1000} />
              </div>
            </div>
            <div className="admin-form-foot">
              <Link href={`/${locale}/administration/messagerie${query}`} className="client-ghost-link">{t(locale, "Retour à la messagerie", "العودة إلى المراسلة")}</Link>
              <button type="submit" name="intent" value="CHANGE_CONFIGURATION" className="admin-primary-cta" disabled={pending || templates.length === 0}>
                {pending ? "…" : t(locale, "Soumettre la proposition à validation", "إرسال المقترح للمصادقة")}
              </button>
            </div>
          </article>
        </section>
        <Feedback state={state} locale={locale} />
      </form>
    </main>
  );
}

export function SpecialBoardActions({ locale, kind }: { locale: Locale; kind: "consultation" | "reuse" | "preferences" }): ReactNode {
  if (kind !== "preferences") return null;
  return <Link href={`/${locale}/administration/messagerie`} className="admin-soft-cta">{t(locale, "Retour à la messagerie", "العودة إلى المراسلة")}</Link>;
}
