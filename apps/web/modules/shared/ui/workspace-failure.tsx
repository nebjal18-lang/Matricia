import { randomUUID } from "node:crypto";
import Link from "next/link";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type WorkspaceFailureReason = "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "CONFIGURATION" | "QUERY_FAILED" | "UNAVAILABLE" | "INVALID_RESPONSE" | "NO_ORGANIZATION";

const copy = {
  fr: {
    UNAUTHENTICATED: ["Reconnectez-vous pour continuer", "Votre session n’est plus disponible. Retrouvez cette page après votre connexion."],
    MFA_REQUIRED: ["Vérification renforcée nécessaire", "Confirmez votre second facteur pour accéder à cette fonction. Vos habilitations restent inchangées."],
    FORBIDDEN: ["Accès non autorisé à cette fonction", "Votre compte ne dispose pas des habilitations nécessaires. Contactez le responsable de votre organisation si cet accès est attendu."],
    CONFIGURATION: ["Configuration nécessaire", "Cette fonction attend une configuration validée par un responsable habilité. Aucun droit supplémentaire n’a été accordé."],
    QUERY_FAILED: ["Chargement temporairement indisponible", "Nous n’avons pas pu lire les données. Cela ne signifie pas que votre dossier est vide ou que vos droits ont changé."],
    UNAVAILABLE: ["Chargement temporairement indisponible", "Nous n’avons pas pu lire les données. Réessayez ; si le problème persiste, transmettez la référence ci-dessous à l’assistance."],
    INVALID_RESPONSE: ["Chargement temporairement indisponible", "Les données reçues ne peuvent pas être affichées de façon fiable. Réessayez ou contactez l’assistance."],
    NO_ORGANIZATION: ["Organisation à sélectionner", "Choisissez une organisation à laquelle votre compte est rattaché, ou demandez votre rattachement avant de continuer."],
    signIn: "Me reconnecter", mfa: "Configurer ou vérifier mon second facteur", retry: "Réessayer le chargement", organization: "Mes organisations", support: "Contacter l’assistance", reference: "Référence assistance",
  },
  ar: {
    UNAUTHENTICATED: ["أعيدوا الاتصال للمتابعة", "جلستكم غير متاحة الآن. ستعودون إلى هذه الصفحة بعد الاتصال."],
    MFA_REQUIRED: ["يلزم تحقق معزّز", "أكّدوا العامل الثاني لفتح هذه الوظيفة. تظل صلاحياتكم كما هي."],
    FORBIDDEN: ["الوصول إلى هذه الوظيفة غير مسموح", "لا يملك حسابكم الصلاحيات اللازمة. تواصلوا مع مسؤول مؤسستكم إذا كنتم تحتاجون هذا الوصول."],
    CONFIGURATION: ["يلزم إعداد معتمد", "تنتظر هذه الوظيفة إعداداً معتمداً من مسؤول مخوّل. لم تُمنح أي صلاحية إضافية."],
    QUERY_FAILED: ["التحميل غير متاح مؤقتاً", "تعذرت قراءة البيانات. لا يعني ذلك أن ملفكم فارغ أو أن صلاحياتكم تغيرت."],
    UNAVAILABLE: ["التحميل غير متاح مؤقتاً", "تعذرت قراءة البيانات. أعيدوا المحاولة، وإذا استمر العطل أرسلوا المرجع أدناه إلى الدعم."],
    INVALID_RESPONSE: ["التحميل غير متاح مؤقتاً", "لا يمكن عرض البيانات المستلمة بشكل موثوق. أعيدوا المحاولة أو تواصلوا مع الدعم."],
    NO_ORGANIZATION: ["يلزم اختيار مؤسسة", "اختاروا مؤسسة يرتبط بها حسابكم، أو اطلبوا الانضمام قبل المتابعة."],
    signIn: "إعادة الاتصال", mfa: "إعداد العامل الثاني أو تأكيده", retry: "إعادة التحميل", organization: "مؤسساتي", support: "الاتصال بالدعم", reference: "مرجع الدعم",
  },
} as const;

export function WorkspaceFailure({ locale, reason, returnPath, supportReference }: {
  locale: Locale;
  reason: WorkspaceFailureReason;
  returnPath: string;
  supportReference?: string;
}) {
  const m = copy[locale];
  const path = safeReturnPath(returnPath, locale) ?? `/${locale}/tableau-de-bord`;
  const technical = ["QUERY_FAILED", "UNAVAILABLE", "INVALID_RESPONSE"].includes(reason);
  const reference = /^[A-Za-z0-9][A-Za-z0-9_.-]{5,79}$/.test(supportReference ?? "") ? supportReference! : randomUUID();
  if (technical || reason === "CONFIGURATION") console.error(JSON.stringify({ event: "workspace.read.failed", reference, category: reason, route: new URL(path, "https://matricia.invalid").pathname.split("/").slice(0, 4).map(segment => /^[a-z-]+$/.test(segment) ? segment : "resource").join("/") }));
  const title = m[reason][0];
  const description = m[reason][1];
  return <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950" data-workspace-failure={reason}>
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="mt-2 leading-7">{description}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      {reason === "UNAUTHENTICATED" ? <Link className="min-h-11 rounded-md border px-3 py-2 font-semibold underline" href={connexionHref(locale, { next: path })}>{m.signIn}</Link> : null}
      {reason === "MFA_REQUIRED" ? <Link className="min-h-11 rounded-md border px-3 py-2 font-semibold underline" href={`/${locale}/securite/compte?${new URLSearchParams({ next: path })}`}>{m.mfa}</Link> : null}
      {technical || reason === "CONFIGURATION" ? <a className="min-h-11 rounded-md border px-3 py-2 font-semibold underline" href={path}>{m.retry}</a> : null}
      {reason === "NO_ORGANIZATION" ? <Link className="min-h-11 rounded-md border px-3 py-2 font-semibold underline" href={`/${locale}/organisation`}>{m.organization}</Link> : null}
      <Link className="min-h-11 rounded-md border px-3 py-2 font-semibold underline" href={`/${locale}/contact`}>{m.support}</Link>
    </div>
    {technical || reason === "CONFIGURATION" ? <p className="mt-3 text-sm">{m.reference} : <span className="font-mono" dir="ltr">{reference}</span></p> : null}
  </section>;
}
