"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { submitFranchiseApplication, type FranchiseApplicationActionState } from "./actions";
import { getFranchisePresentation } from "@/modules/public/data/franchise-presentation";
import { getPublicProviderTaxonomy } from "@/modules/public/data/provider-intent/model";
import { moroccoRegionLabel, moroccoRegions } from "@/modules/franchise/data/territories/morocco-regions";

const initial: FranchiseApplicationActionState = { status: "idle" };
const profiles = {
  fr: ["Dirigeant", "Professionnel indépendant", "Porteur de projet", "Autre parcours"],
  ar: ["مسير", "مهني مستقل", "صاحب مشروع", "مسار آخر"],
} as const;
const availability = {
  fr: ["Immédiate", "1 à 3 mois", "3 à 6 mois", "À préciser ensemble"],
  ar: ["فورية", "من شهر إلى 3 أشهر", "من 3 إلى 6 أشهر", "تُحدَّد معاً"],
} as const;

const copy = {
  fr: {
    title: "Votre candidature",
    intro: "Ce formulaire ouvre un dossier au statut inscrit et vous envoie sa référence par e-mail. Connectez-vous ensuite avec la même adresse pour rattacher votre société ; Matricia vous propose alors le mandat.",
    name: "Nom et prénom",
    email: "Adresse e-mail",
    city: "Territoire",
    profile: "Parcours professionnel",
    availability: "Disponibilité estimée",
    motivation: "Votre motivation",
    consent: "Je confirme l’exactitude des informations fournies et j’accepte d’être recontacté(e) par l’équipe Matricia dans le cadre de l’étude de ma candidature.",
    send: "Enregistrer la candidature",
    pending: "Enregistrement…",
    success: "Candidature enregistrée au statut inscrit. Référence",
    mailed: "Cette référence vient de vous être envoyée par e-mail.",
    mailPending: "Conservez cette référence affichée. L’e-mail n’a pas pu partir maintenant.",
    next: "Prochaine étape : examen par Matricia. Aucune contractualisation n’est engagée à ce stade. Déposer une candidature ne garantit pas son acceptation.",
    validation: "Complétez les champs requis (motivation ≥ 40 caractères) et confirmez l’exactitude des informations.",
    rate: "Trop de candidatures récemment. Réessayez plus tard.",
    unavailable: "Enregistrement indisponible. Vous pouvez réessayer sans perdre votre saisie.",
    required: "Champs obligatoires",
  },
  ar: {
    title: "ترشيحكم",
    intro: "يفتح هذا النموذج ملفاً بحالة مسجّل ويرسل مرجعه إلى بريدكم. سجّلوا الدخول بعد ذلك بالعنوان نفسه لربط شركتكم، ثم تقترح عليكم ماتريسيا التفويض.",
    name: "الاسم والنسب",
    email: "البريد الإلكتروني",
    city: "الإقليم",
    profile: "المسار المهني",
    availability: "التوفر التقديري",
    motivation: "دافعكم",
    consent: "أؤكد دقة المعلومات وأوافق على أن يتواصل فريق ماتريسيا في إطار دراسة الترشيح.",
    send: "تسجيل الترشيح",
    pending: "جارٍ التسجيل…",
    success: "تم تسجيل الترشيح بحالة مسجّل. المرجع",
    mailed: "أُرسل هذا المرجع إلى بريدكم.",
    mailPending: "احتفظوا بالمرجع الظاهر. تعذر إرسال البريد الآن.",
    next: "الخطوة التالية: مراجعة ماتريسيا. لا تعاقد في هذه المرحلة. إيداع ترشيح لا يضمن القبول.",
    validation: "أكملوا الحقول المطلوبة (الدافع ≥ 40 حرفاً) وأكدوا دقة المعلومات.",
    rate: "ترشيحات كثيرة مؤخراً. حاولوا لاحقاً.",
    unavailable: "التسجيل غير متاح. يمكن إعادة المحاولة دون فقدان الإدخال.",
    required: "حقول إلزامية",
  },
} as const;

export function FranchiseApplicationForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(submitFranchiseApplication, initial);
  const presentation = getFranchisePresentation(locale);
  const messages = { ...copy[locale], domain: presentation.domain, motivationHint: presentation.motivationHint };
  const domains = getPublicProviderTaxonomy(locale).libraries;
  const [motivation, setMotivation] = useState("");

  return (
    <section aria-labelledby="franchise-form-title" className="public-card max-w-none">
      <h2 id="franchise-form-title">{messages.title}</h2>
      <p className="public-muted mt-2">{messages.intro}</p>
      <form
        action={action}
        className="mt-7"
      >
        <input type="hidden" name="locale" value={locale} />
        <div className="absolute -start-[10000px]" aria-hidden="true">
          <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <div className="public-form-grid">
          <label className="block font-medium">
            {messages.name} *
            <input name="displayName" required minLength={2} maxLength={120} autoComplete="name" placeholder={locale === "ar" ? "اسمكم الكامل" : "Votre nom complet"} className="mt-2 w-full" />
          </label>
          <label className="block font-medium">
            {messages.email} *
            <input name="replyEmail" type="email" required autoComplete="email" placeholder="votre@email.ma" className="mt-2 w-full" />
          </label>
          <label className="block font-medium">
            {messages.city} *
            <select name="zone" required className="mt-2 w-full">
              <option value="">{locale === "ar" ? "اختاروا جهة" : "Sélectionnez une région"}</option>
              {moroccoRegions.map((region) => (
                <option key={region.code} value={region.code}>{moroccoRegionLabel(region.code, locale)}</option>
              ))}
            </select>
          </label>
          <label className="block font-medium">
            {messages.profile} *
            <select name="profile" required className="mt-2 w-full">
              <option value="">{locale === "ar" ? "اختاروا مساركم" : "Sélectionnez votre profil"}</option>
              {profiles[locale].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block font-medium">
            {messages.domain} *
            <select name="domain" required className="mt-2 w-full">
              <option value="">{locale === "ar" ? "اختاروا مجالاً" : "Sélectionnez un domaine"}</option>
              {domains.map((library) => (
                <option key={library.code} value={`${library.code} — ${library.name}`}>{library.name}</option>
              ))}
            </select>
          </label>
          <label className="block font-medium">
            {messages.availability} *
            <select name="availability" required className="mt-2 w-full">
              <option value="">{locale === "ar" ? "اختاروا التوفر" : "Sélectionnez votre disponibilité"}</option>
              {availability[locale].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="is-full block font-medium">
            {messages.motivation} *
            <textarea name="motivation" required minLength={40} maxLength={800} rows={6} value={motivation} onChange={(event) => setMotivation(event.target.value.slice(0, 800))} placeholder={messages.motivationHint} className="mt-2 w-full" />
            <span className="journey-charcount">{motivation.length}/800</span>
          </label>
          <label className="is-full flex items-start gap-3 text-sm leading-6">
            <input type="checkbox" required className="mt-1 size-4" />
            <span>{messages.consent} *</span>
          </label>
        </div>
        <button type="submit" disabled={pending} className="journey-primary is-coral mt-6">
          {pending ? messages.pending : messages.send}
        </button>
        <p className="mt-3 text-xs text-slate-500">* {messages.required}</p>
        {state.status === "success" ? (
          <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-900">
            {messages.success} <strong dir="ltr">{state.reference}</strong>. {state.mailed ? messages.mailed : messages.mailPending} {messages.next}{" "}
            <Link className="font-semibold underline" href={`/${locale}/connexion?next=${encodeURIComponent(`/${locale}/franchise/candidature`)}`}>
              {locale === "fr" ? "Continuer par code sécurisé" : "المتابعة برمز آمن"}
            </Link>
          </p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-900">
            {state.reason === "VALIDATION" ? messages.validation : state.reason === "RATE_LIMITED" ? messages.rate : messages.unavailable}
          </p>
        ) : null}
      </form>
    </section>
  );
}
