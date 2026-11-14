"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, LockKeyhole, Send } from "lucide-react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { submitContactRequest, type ContactActionState } from "./actions";

const initial: ContactActionState = { status: "idle" };

const copy = {
  fr: {
    title: "Votre demande",
    motif: "Catégorie de la demande",
    motifLegacy: "Objet de la demande",
    motifs: {
      ABOUT: "Question sur Matricia",
      CLIENT: "Accompagnement d’une entreprise",
      PROVIDER: "Assistance inscription",
      FRANCHISE: "Candidature Franchise",
      LOGIN: "Difficulté de connexion",
      OTHER: "Autre demande",
    },
    replyMethod: "Méthode de réponse souhaitée",
    byEmail: "Par e-mail",
    byPhone: "Par téléphone",
    name: "Nom complet",
    email: "Adresse e-mail",
    emailLegacy: "Adresse de réponse",
    emailError: "Veuillez saisir une adresse e-mail valide.",
    company: "Entreprise (optionnel)",
    companyHint: "Votre organisation (facultatif)",
    phone: "Téléphone",
    message: "Votre message",
    messageHint: "Décrivez votre demande",
    consent: "J’accepte que mes données soient traitées pour répondre à ma demande, conformément à notre Politique de confidentialité.",
    plan: "Offre concernée",
    help: "N’ajoutez aucune pièce ni donnée sensible ici. Pour une mission ou une facture, utilisez votre espace sécurisé.",
    send: "Envoyer la demande",
    pending: "Envoi en cours…",
    success: "Demande enregistrée. Référence",
    delivery: "Transmission au service d’envoi effectuée lorsque le canal est configuré ; cette confirmation porte d’abord sur l’enregistrement.",
    validation: "Vérifiez le nom, le courriel, l’objet et un message d’au moins 20 caractères.",
    rate: "Trop de demandes ont été enregistrées récemment. Réessayez plus tard.",
    unavailable: "Une erreur est survenue. Veuillez réessayer dans quelques instants.",
    secureTitle: "Demandes liées à un compte ou des données sensibles ?",
    secureText: "Pour des raisons de sécurité, merci d’utiliser votre espace connecté. Ne partagez jamais vos identifiants par e-mail.",
    delayTitle: "Quel est le délai de réponse ?",
    delayText: "Nous accusons réception de votre demande et revenons vers vous dans les meilleurs délais. Le délai peut varier selon la nature de votre demande.",
    login: "Se connecter",
  },
  ar: {
    title: "طلبكم",
    motif: "فئة الطلب",
    motifLegacy: "موضوع الطلب",
    motifs: {
      ABOUT: "سؤال عن ماتريسيا",
      CLIENT: "مرافقة مؤسسة",
      PROVIDER: "مساعدة التسجيل",
      FRANCHISE: "ترشيح امتياز",
      LOGIN: "صعوبة في تسجيل الدخول",
      OTHER: "طلب آخر",
    },
    replyMethod: "طريقة الرد المفضلة",
    byEmail: "عبر البريد",
    byPhone: "عبر الهاتف",
    name: "الاسم الكامل",
    email: "البريد الإلكتروني",
    emailLegacy: "بريد الرد",
    emailError: "يرجى إدخال بريد صالح.",
    company: "المؤسسة (اختياري)",
    companyHint: "منظمتكم (اختياري)",
    phone: "الهاتف",
    message: "رسالتكم",
    messageHint: "صفوا طلبكم",
    consent: "أوافق على معالجة بياناتي للرد على طلبي وفق سياسة الخصوصية.",
    plan: "العرض المعني",
    help: "لا تضيفوا وثائق أو بيانات حساسة هنا. لمهمة أو فاتورة استخدموا مساحتكم الآمنة.",
    send: "إرسال الطلب",
    pending: "جارٍ الإرسال…",
    success: "تم تسجيل الطلب. المرجع",
    delivery: "يتم الإرسال إلى خدمة الإشعار عند تهيئة القناة؛ يخص هذا التأكيد التسجيل أولاً.",
    validation: "تحققوا من الاسم والبريد والموضوع ورسالة من 20 حرفاً على الأقل.",
    rate: "تم تسجيل طلبات كثيرة مؤخراً. حاولوا لاحقاً.",
    unavailable: "حدث خطأ. أعيدوا المحاولة بعد لحظات.",
    secureTitle: "طلبات مرتبطة بحساب أو بيانات حساسة؟",
    secureText: "لأسباب أمنية استخدموا مساحتكم المتصلة. لا تشاركوا معرفاتكم عبر البريد.",
    delayTitle: "ما مهلة الرد؟",
    delayText: "نؤكد الاستلام ونعود إليكم في أقرب أجل. قد تختلف المهلة حسب طبيعة الطلب.",
    login: "تسجيل الدخول",
  },
} as const;

const motifToCategory = {
  ABOUT: "OTHER",
  CLIENT: "CLIENT",
  PROVIDER: "PROVIDER",
  FRANCHISE: "FRANCHISE",
  LOGIN: "OTHER",
  OTHER: "OTHER",
} as const;

type Motif = keyof typeof motifToCategory;

export function ContactForm({
  locale,
  initialMotif = "CLIENT",
  initialPlan,
}: {
  locale: Locale;
  initialMotif?: Motif;
  initialPlan?: string;
}) {
  const [state, action, pending] = useActionState(submitContactRequest, initial);
  const [motif, setMotif] = useState<Motif>(initialMotif);
  const [replyMethod, setReplyMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState(initialPlan ? (locale === "ar" ? `العرض المقصود: ${initialPlan}\n\n` : `Offre envisagée : ${initialPlan}\n\n`) : "");
  const messages = copy[locale];
  const category = useMemo(() => motifToCategory[motif], [motif]);
  const emailInvalid = email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);

  return (
    <div className="public-contact-board">
      <section aria-labelledby="contact-form-title" className="public-card max-w-none">
        <h2 id="contact-form-title">{messages.title}</h2>
        <p className="public-muted mt-2">{messages.help}</p>
        {initialPlan ? <p role="status" className="mt-3 text-sm font-medium text-blue-900">{messages.plan} : <span dir="ltr">{initialPlan}</span></p> : null}
        <form
          action={action}
          className="mt-7"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const data = new FormData(form);
            if (!form.checkValidity()) return;
            const composed = [
              `${messages.motif}: ${messages.motifs[motif]}`,
              `${messages.replyMethod}: ${replyMethod === "phone" ? messages.byPhone : messages.byEmail}`,
              `${messages.name}: ${String(data.get("displayName") ?? "").trim()}`,
              data.get("company") ? `${messages.company}: ${data.get("company")}` : null,
              data.get("phone") ? `${messages.phone}: ${data.get("phone")}` : null,
              initialPlan ? `${messages.plan}: ${initialPlan}` : null,
              "",
              body.trim(),
            ]
              .filter((line) => line !== null)
              .join("\n");
            (form.elements.namedItem("message") as HTMLInputElement).value = composed;
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="sourcePath" value={`/${locale}/contact`} />
          <input type="hidden" name="message" defaultValue="" />
          <div className="absolute -start-[10000px]" aria-hidden="true">
            <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <div className="public-form-grid">
            <label className="block font-medium">
              {messages.motif} *
              <span className="sr-only">{messages.motifLegacy}</span>
              <select className="mt-2 w-full" value={motif} onChange={(event) => setMotif(event.target.value as Motif)}>
                {Object.entries(messages.motifs).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <fieldset className="block font-medium">
              <legend>{messages.replyMethod} *</legend>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="replyMethod" checked={replyMethod === "email"} onChange={() => setReplyMethod("email")} />{messages.byEmail}</label>
                <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="replyMethod" checked={replyMethod === "phone"} onChange={() => setReplyMethod("phone")} />{messages.byPhone}</label>
              </div>
            </fieldset>
            <label className="block font-medium">
              {messages.name} *
              <input name="displayName" type="text" required minLength={2} maxLength={120} autoComplete="name" placeholder={locale === "ar" ? "اسمكم" : "Votre nom"} className="mt-2 w-full" />
            </label>
            <label className="block font-medium">
              {messages.email} *
              <span className="sr-only">{messages.emailLegacy}</span>
              <input name="replyEmail" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="votre@email.com" aria-invalid={emailInvalid} className={`mt-2 w-full ${emailInvalid ? "border-red-500" : ""}`} />
              {emailInvalid ? <p role="status" className="mt-1 text-sm text-red-700">{messages.emailError}</p> : null}
            </label>
            <label className="is-full block font-medium">
              {messages.company}
              <input name="company" maxLength={200} placeholder={messages.companyHint} className="mt-2 w-full" />
            </label>
            {replyMethod === "phone" ? (
              <label className="is-full block font-medium">
                {messages.phone}
                <input name="phone" type="tel" maxLength={40} autoComplete="tel" className="mt-2 w-full" />
              </label>
            ) : null}
            <label className="is-full block font-medium">
              {messages.message} *
              <textarea required minLength={20} maxLength={2000} rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder={messages.messageHint} className="mt-2 w-full" />
              <span className="journey-charcount">{body.length}/2000</span>
            </label>
            <label className="is-full flex items-start gap-3 text-sm leading-6">
              <input type="checkbox" required className="mt-1 size-4" />
              <span>{messages.consent} *</span>
            </label>
          </div>
          <button type="submit" disabled={pending} className="journey-primary mt-6">
            <Send size={16} aria-hidden="true" />
            {pending ? messages.pending : messages.send}
          </button>
          {state.status === "success" ? (
            <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-900">
              {messages.success} <strong dir="ltr">{state.reference}</strong>. {messages.delivery}
            </p>
          ) : null}
          {state.status === "error" ? (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-900">
              {state.reason === "VALIDATION" ? messages.validation : state.reason === "RATE_LIMITED" ? messages.rate : messages.unavailable}
            </p>
          ) : null}
        </form>
      </section>
      <aside className="grid gap-4">
        <article className="public-card">
          <LockKeyhole className="text-[var(--mat-violet)]" aria-hidden="true" />
          <h2 className="mt-3">{messages.secureTitle}</h2>
          <p className="public-muted mt-2">{messages.secureText}</p>
          <Link href={`/${locale}/connexion`} className="journey-primary mt-4">{messages.login}</Link>
        </article>
        <article className="public-card">
          <Clock3 className="text-[var(--mat-rose)]" aria-hidden="true" />
          <h2 className="mt-3">{messages.delayTitle}</h2>
          <p className="public-muted mt-2">{messages.delayText}</p>
        </article>
      </aside>
    </div>
  );
}
