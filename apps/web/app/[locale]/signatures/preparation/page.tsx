import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { PreparationReadError, readSignerPreparations } from "@/modules/shared/lib/signer-preparation/repository";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
export const dynamic = "force-dynamic";
export default async function MySignaturePreparationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const ar = locale === "ar", path = `/${locale}/signatures/preparation`;
  let rows;
  try {
    rows = await readSignerPreparations();
  } catch (error) {
    if (error instanceof PreparationReadError && error.code === "UNAUTHENTICATED") redirect(connexionHref(locale,{next:path}));

  }
  const content = rows ? rows.length ? <ul className="space-y-4">{rows.map(row => <li key={row.envelopeId} className="space-y-3 rounded-xl border bg-card p-5"><p className="font-semibold">{row.amendmentId ? ar ? "ملحق للتوقيع" : "Avenant à signer" : ar ? "عقد للتوقيع" : "Contrat à signer"}</p><p className="text-sm">{row.configured ? ar ? "تم إعداد هويتكم ومواضع توقيعكم." : "Votre identité et vos emplacements sont préparés." : ar ? "يلزم إدخال هويتكم واختيار مواضع التوقيع." : "Votre identité et vos emplacements restent à préparer."}</p><p className="break-all text-xs text-muted-foreground"><bdi>{row.contractId}</bdi></p><Link href={`/${locale}/signatures/${row.envelopeId}/preparation`} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">{row.canConfigure ? ar ? "إعداد توقيعي" : "Préparer ma signature" : ar ? "قراءة إعدادي" : "Consulter ma préparation"}</Link></li>)}</ul> : <p className="rounded-xl border p-5">{ar ? "لا توجد حاليا وثيقة YouSign متاحة للإعداد ضمن تفويضات توقيعكم. تظهر الوثائق هنا بعد تعيينكم موقّعا للنسخة التعاقدية." : "Aucun document YouSign à préparer dans vos habilitations actuelles. Vos documents apparaissent ici lorsque vous êtes désigné signataire de la version contractuelle."}</p> : <WorkspaceFailure locale={locale} reason="UNAVAILABLE" returnPath={path}/>;
  return <main dir={ar ? "rtl" : "ltr"} className="mx-auto max-w-4xl space-y-6 px-4 py-8"><nav className="flex flex-wrap justify-between gap-4"><Link href={`/${locale}/tableau-de-bord`} className="min-h-11 py-2 underline">{ar ? "لوحة التحكم" : "Mon tableau de bord"}</Link><Link href={`/${ar ? "fr" : "ar"}/signatures/preparation`} className="min-h-11 py-2 underline">{ar ? "Français" : "العربية"}</Link></nav><h1 className="text-2xl font-semibold">{ar ? "إعداد توقيعاتي" : "Préparer mes signatures"}</h1><p className="leading-7">{ar ? "راجعوا وثائقكم التعاقدية وأعدّوا توقيعكم دون مغادرة التطبيق. إرسال الدعوة والتوقيع الفعلي يخضعان لاعتمادات الملف." : "Consultez vos documents contractuels et préparez votre signature depuis l’application. L’envoi de l’invitation et la signature restent soumis aux validations du dossier."}</p>{content}</main>;
}
