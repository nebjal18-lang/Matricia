"use client";

import { useActionState, useId, useMemo } from "react";
import Link from "next/link";
import { moroccoRegions } from "@/modules/shared/lib/geo/morocco-regions";
import { getPublicProviderTaxonomy } from "@/modules/public/data/provider-intent/model";
import { openFranchiseApplicationInvite, type FranchiseApplicationInviteState } from "./invite-action";

const idle: FranchiseApplicationInviteState = { status: "idle" };
const control = "mt-1 min-h-11 w-full rounded-md border border-[var(--ad-border,var(--mat-border))] bg-background px-3";

export function FranchiseApplicationInviteForm({
  locale,
  query,
  idempotencyKey,
  open,
}: {
  locale: "fr" | "ar";
  query: string;
  idempotencyKey: string;
  open: boolean;
}) {
  const fr = locale === "fr";
  const [state, action, pending] = useActionState(openFranchiseApplicationInvite, idle);
  const formId = useId();
  const domains = useMemo(() => getPublicProviderTaxonomy(locale).libraries, [locale]);
  const closeHref = `/${locale}/administration/candidatures-franchise${query}`;
  const openHref = (() => {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    params.set("ouvrir", "1");
    const qs = params.toString();
    return `/${locale}/administration/candidatures-franchise${qs ? `?${qs}` : ""}`;
  })();

  if (!open && state.status !== "success") {
    return (
      <div className="admin-franchise-invite-cta">
        <Link href={openHref} className="admin-primary-cta">
          {fr ? "Ouvrir / inviter un dossier" : "فتح / دعوة ملف"}
        </Link>
      </div>
    );
  }

  return (
    <section className="client-card admin-franchise-invite" aria-labelledby={`${formId}-title`}>
      <div className="admin-franchise-invite__head">
        <h2 id={`${formId}-title`}>{fr ? "Ouvrir / inviter un dossier franchise" : "فتح / دعوة ملف امتياز"}</h2>
        <p>
          {fr
            ? "Crée un dossier Inscrit et envoie un e-mail au candidat. La revue, le mandat et l’activation restent obligatoires."
            : "ينشئ ملفاً مسجّلاً ويرسل بريداً للمترشح. تبقى المراجعة والتفويض والتفعيل إلزامية."}
        </p>
      </div>
      {state.status === "success" ? (
        <p role="status" className="text-sm">
          {fr
            ? `Dossier ${state.reference} ouvert${state.replayed ? " (déjà existant aujourd’hui)" : ""}${state.mailed ? " · e-mail envoyé" : state.replayed ? "" : " · e-mail non parti"}.`
            : `الملف ${state.reference} مفتوح${state.replayed ? " (موجود اليوم)" : ""}${state.mailed ? " · أُرسل البريد" : state.replayed ? "" : " · لم يُرسل البريد"}.`}
          {" "}
          <Link href={closeHref} className="client-text-link">{fr ? "Retour à la file" : "العودة إلى القائمة"}</Link>
        </p>
      ) : (
        <form action={action} className="admin-franchise-invite__form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <label htmlFor={`${formId}-name`} className="text-sm font-medium">{fr ? "Nom du candidat" : "اسم المترشح"}</label>
          <input id={`${formId}-name`} name="applicantName" required minLength={2} maxLength={120} className={control} autoComplete="name" />
          <label htmlFor={`${formId}-email`} className="text-sm font-medium">{fr ? "E-mail" : "البريد"}</label>
          <input id={`${formId}-email`} name="replyEmail" type="email" required maxLength={254} className={control} dir="ltr" autoComplete="email" />
          <label htmlFor={`${formId}-territory`} className="text-sm font-medium">{fr ? "Territoire" : "الإقليم"}</label>
          <select id={`${formId}-territory`} name="territoryCode" required className={control} defaultValue="">
            <option value="" disabled>{fr ? "Sélectionnez un territoire" : "اختاروا إقليماً"}</option>
            {moroccoRegions.map((region) => (
              <option key={region.code} value={region.code}>{fr ? region.nameFr : region.nameAr}</option>
            ))}
          </select>
          <label htmlFor={`${formId}-domain`} className="text-sm font-medium">{fr ? "Bibliothèque / domaine" : "المكتبة / المجال"}</label>
          <select id={`${formId}-domain`} name="domainLabel" required className={control} defaultValue="">
            <option value="" disabled>{fr ? "Sélectionnez une bibliothèque" : "اختاروا مكتبة"}</option>
            {domains.map((library) => (
              <option key={library.code} value={`${library.code} — ${library.name}`}>{library.name}</option>
            ))}
          </select>
          <label htmlFor={`${formId}-reason`} className="text-sm font-medium">{fr ? "Motif admin" : "سبب الإدارة"}</label>
          <p className="admin-franchise-review__hint">
            {fr ? "Obligatoire pour l’audit (3 caractères min.)." : "إلزامي للتدقيق (3 أحرف على الأقل)."}
          </p>
          <textarea id={`${formId}-reason`} name="reason" required minLength={3} maxLength={1000} rows={3} className={control} />
          {state.status === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {state.reason === "MFA_REQUIRED"
                ? (fr ? "Confirmez votre second facteur (AAL2) avant d’inviter." : "أكدوا العامل الثاني قبل الدعوة.")
                : state.reason === "DENIED"
                  ? (fr ? "Ce compte ne peut pas ouvrir de dossier franchise." : "لا يمكن لهذا الحساب فتح ملف امتياز.")
                  : state.reason === "VALIDATION"
                    ? (fr ? "Vérifiez les champs du formulaire." : "تحققوا من حقول النموذج.")
                    : (fr ? "Invitation indisponible. Réessayez." : "الدعوة غير متاحة. أعيدوا المحاولة.")}
            </p>
          ) : null}
          <div className="admin-franchise-invite__actions">
            <button type="submit" className="admin-primary-cta" disabled={pending}>
              {pending ? (fr ? "Ouverture…" : "جارٍ الفتح…") : (fr ? "Créer le dossier et inviter" : "إنشاء الملف والدعوة")}
            </button>
            <Link href={closeHref} className="client-ghost-link">{fr ? "Annuler" : "إلغاء"}</Link>
          </div>
        </form>
      )}
    </section>
  );
}
