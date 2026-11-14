"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { presentDateTime } from "@/modules/admin/data/spaces/present-space-row";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import { shortReference } from "@/modules/shared/lib/format/display";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { manageEditorialReview } from "./actions";
import type { EditorialDetail, EditorialState } from "./model";

const KIND_LABELS: Record<string, [string, string]> = {
  LIBRARY: ["Bibliothèque", "مكتبة"],
  CATEGORY: ["Catégorie", "فئة"],
  SUBCATEGORY: ["Sous-catégorie", "فئة فرعية"],
  SERVICE: ["Service", "خدمة"],
  RULE: ["Règle", "قاعدة"],
  RELEASE: ["Publication", "نشر"],
};

const FIELD_LABELS: Record<string, [string, string]> = {
  title_fr: ["Titre FR", "العنوان FR"],
  title_ar: ["Titre AR", "العنوان AR"],
  name_fr: ["Nom FR", "الاسم FR"],
  name_ar: ["Nom AR", "الاسم AR"],
  label_fr: ["Libellé FR", "التسمية FR"],
  label_ar: ["Libellé AR", "التسمية AR"],
  description_fr: ["Description FR", "الوصف FR"],
  description_ar: ["Description AR", "الوصف AR"],
  code: ["Code", "الرمز"],
  version: ["Version", "النسخة"],
  status: ["Statut", "الحالة"],
  audience: ["Audience", "الجمهور"],
};

function kindLabel(kind: string, locale: Locale) {
  const hit = KIND_LABELS[kind];
  return hit ? (locale === "ar" ? hit[1] : hit[0]) : kind;
}

function fieldLabel(key: string, locale: Locale) {
  const hit = FIELD_LABELS[key];
  if (hit) return locale === "ar" ? hit[1] : hit[0];
  return key.replaceAll("_", " ");
}

function BusinessFields({ value, locale }: { value: Record<string, unknown>; locale: Locale }) {
  const entries = Object.entries(value).filter(([key]) => !["id", "row_version", "content_hash", "snapshot_hash"].includes(key));
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, raw]) => {
        let display = "—";
        if (typeof raw === "string") display = key === "status" ? localizeStatus(raw, locale) : raw;
        else if (typeof raw === "number" || typeof raw === "boolean") display = String(raw);
        else if (raw == null) display = "—";
        else display = JSON.stringify(raw);
        return (
          <div key={key}>
            <dt className="font-medium">{fieldLabel(key, locale)}</dt>
            <dd className="whitespace-pre-wrap break-words">{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function EditorialReviewDetail({ locale, detail, idempotencyKey, scheduleKey }: { locale: Locale; detail: EditorialDetail; idempotencyKey: string; scheduleKey: string }) {
  const [state, action, pending] = useActionState(manageEditorialReview, { status: "idle" } as EditorialState);
  const router = useRouter();
  const ar = locale === "ar";
  const t = (fr: string, arabic: string) => (ar ? arabic : fr);
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);
  const status = String(detail.version.status ?? "");
  return (
    <section className="client-card">
      <h2>
        {t("Contenu exact soumis à revue", "المحتوى الدقيق المعروض للمراجعة")} · {kindLabel(detail.request.targetType, locale)}
      </h2>
      <p role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {state.status === "error"
          ? t("Décision refusée. Vérifiez la MFA, les droits, l’indépendance et la version courante.", "رُفض القرار. تحققوا من المصادقة والصلاحيات والاستقلالية والنسخة الحالية.")
          : state.status === "success"
            ? state.reason === "CATALOG_RELEASE_SCHEDULED"
              ? t("Publication programmée. La publication effective dépend du traitement et reste observable dans son statut réel.", "جرت برمجة النشر. يبقى النشر الفعلي مرتبطاً بالمعالجة وبحالته الحقيقية.")
              : t("Décision enregistrée avec preuve. L’approbation d’une version ne signifie pas sa publication.", "سجل القرار مع إثباته. لا يعني اعتماد النسخة نشرها.")
            : ""}
      </p>
      {state.proofHash ? (
        <p>
          {t("Preuve", "الإثبات")} : <bdi dir="ltr">{shortReference(state.proofHash, 12)}</bdi>
        </p>
      ) : null}
      <p>
        {localizeStatus(status || detail.request.status || "IN_REVIEW", locale)} · {presentDateTime(detail.request.requestedAt, locale)}
      </p>
      <h3>{t("Identité", "الهوية")}</h3>
      <BusinessFields value={detail.identity} locale={locale} />
      <h3>{t("Version proposée : textes FR/AR et contenu métier", "النسخة المقترحة: النصوص الفرنسية والعربية ومحتوى العمل")}</h3>
      <BusinessFields value={detail.version} locale={locale} />
      {detail.previousVersion ? (
        <details>
          <summary>{t("Comparer à la version précédente", "المقارنة بالنسخة السابقة")}</summary>
          <BusinessFields value={detail.previousVersion} locale={locale} />
        </details>
      ) : null}
      {detail.releaseItems.length ? (
        <section>
          <h3>{t("Éléments de la publication", "عناصر النشر")}</h3>
          {detail.releaseItems.map((item, index) => (
            <details key={index}>
              <summary>{String(item.identity.code ?? index + 1)}</summary>
              <BusinessFields value={item.identity} locale={locale} />
              <BusinessFields value={item.version} locale={locale} />
            </details>
          ))}
        </section>
      ) : null}
      {detail.reviewedSnapshot ? (
        <details>
          <summary>{t("Preuve immuable du contenu examiné lors de la décision", "الإثبات غير القابل للتغيير للمحتوى المفحوص وقت القرار")}</summary>
          <BusinessFields value={detail.reviewedSnapshot} locale={locale} />
        </details>
      ) : null}
      {!detail.reviewedSnapshot && (!detail.request.status || detail.request.status === "IN_REVIEW") ? (
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="requestId" value={detail.request.id} />
          <input type="hidden" name="rowVersion" value={detail.request.rowVersion} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <label>
            {t("Motif de décision", "سبب القرار")}
            <textarea name="reason" required minLength={10} maxLength={2000} />
          </label>
          <label>
            <input type="checkbox" name="reviewConfirmed" />
            {t("J’ai vérifié les textes FR/AR, les dépendances, les conditions et tous les éléments affichés de cette version.", "راجعت النصوص الفرنسية والعربية والاعتماديات والشروط وجميع عناصر هذه النسخة المعروضة.")}
          </label>
          <button name="intent" value="APPROVE" disabled={pending}>
            {t("Approuver la version revue", "اعتماد النسخة المراجعة")}
          </button>
          <button name="intent" value="REJECT" disabled={pending}>
            {t("Refuser avec motif", "الرفض مع سبب")}
          </button>
        </form>
      ) : null}
      {detail.request.targetType === "RELEASE" && status === "APPROVED" && detail.snapshotHash && detail.releaseRowVersion ? (
        <form action={action} className="mt-4 border-t pt-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="intent" value="schedule" />
          <input type="hidden" name="releaseId" value={String(detail.version.id)} />
          <input type="hidden" name="rowVersion" value={detail.releaseRowVersion} />
          <input type="hidden" name="snapshotHash" value={detail.snapshotHash} />
          <input type="hidden" name="idempotencyKey" value={scheduleKey} />
          <h3>{t("Programmer la publication revue", "برمجة نشر النسخة المراجعة")}</h3>
          <p>{t("Audience enregistrée, relue et figée par le serveur", "الجمهور المسجل الذي يعيد الخادم التحقق منه وتثبيته")}</p>
          {detail.version.audience != null ? <BusinessFields value={{ audience: detail.version.audience }} locale={locale} /> : null}
          <label>
            {t("Début en UTC", "البداية بالتوقيت العالمي UTC")}
            <input name="effectiveFrom" type="datetime-local" required />
          </label>
          <label>
            {t("Fin en UTC, facultative", "النهاية بالتوقيت العالمي UTC، اختيارية")}
            <input name="effectiveUntil" type="datetime-local" />
          </label>
          <label>
            <input type="checkbox" name="scheduleConfirmed" required />
            {t("Je confirme ces dates UTC et l’audience enregistrée de cette version.", "أؤكد التواريخ بالتوقيت العالمي والجمهور المسجل لهذه النسخة.")}
          </label>
          <button disabled={pending}>{t("Programmer la publication", "برمجة النشر")}</button>
        </form>
      ) : null}
    </section>
  );
}
