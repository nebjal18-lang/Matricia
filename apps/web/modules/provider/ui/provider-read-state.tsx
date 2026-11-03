import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ProviderReadState as ReadState } from "@/modules/provider/data/spaces/organization-context";

const messages = {
  fr: {
    unavailable: ["Chargement indisponible", "Les données n’ont pas pu être chargées. Réessayez dans quelques instants."],
    forbidden: ["Accès non autorisé", "Votre rôle ne permet pas de consulter ce dossier dans l’organisation demandée. Vérifiez l’organisation sélectionnée ou contactez son responsable."],
    "choose-organization": ["Choisissez une organisation", "Sélectionnez une organisation prestataire dans le sélecteur ci-dessus pour consulter son dossier."],
    "no-organization": ["Aucune organisation prestataire autorisée", "Aucune organisation prestataire n’est associée à vos habilitations actuelles. Contactez le responsable de votre organisation pour vérifier votre rattachement."],
    retry: "Réessayer",
    choose: "Choisir une organisation",
    contact: "Contacter l’assistance",
  },
  ar: {
    unavailable: ["التحميل غير متاح", "تعذر تحميل البيانات. أعد المحاولة بعد قليل."],
    forbidden: ["الوصول غير مسموح", "لا يتيح دوركم الاطلاع على هذا الملف في المؤسسة المطلوبة. تحققوا من المؤسسة المحددة أو تواصلوا مع مسؤولها."],
    "choose-organization": ["اختاروا مؤسسة", "حددوا مؤسسة مقدم الخدمة من أداة الاختيار أعلاه للاطلاع على ملفها."],
    "no-organization": ["لا توجد مؤسسة مقدم خدمة مخولة", "لا ترتبط أي مؤسسة مقدم خدمة بصلاحياتكم الحالية. تواصلوا مع مسؤول مؤسستكم للتحقق من ارتباط حسابكم."],
    retry: "إعادة المحاولة",
    choose: "اختيار مؤسسة",
    contact: "التواصل مع الدعم",
  },
} as const;

export function ProviderReadState({ locale, state, retryHref, reason, unavailableMessage }: {
  locale: Locale; state: ReadState; retryHref: string; reason?: string; unavailableMessage?: string;
}) {
  const copy = messages[locale];
  const [title, detail] = copy[state];
  return (
    <section className="client-card" role={state === "choose-organization" || state === "no-organization" ? "status" : "alert"} data-error-reason={reason}>
      <h2>{title}</h2>
      <p>{state === "unavailable" && unavailableMessage ? unavailableMessage : detail}</p>
      {state === "unavailable" ? <Link href={retryHref} className="client-ghost-link">{copy.retry}</Link> : null}
      {state === "choose-organization" ? <a href="#provider-organization-selector" className="client-ghost-link">{copy.choose}</a> : null}
      {state === "no-organization" || state === "forbidden" ? <Link href={`/${locale}/contact`} className="client-ghost-link">{copy.contact}</Link> : null}
    </section>
  );
}
