import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { PreparationReadError, readSignerPreparation } from "@/modules/shared/lib/signer-preparation/repository";
import { SignerPreparationPanel } from "@/modules/shared/ui/signer-preparation/panel";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
export const dynamic = "force-dynamic";
export default async function SignerPreparationPage({ params }: { params: Promise<{ locale: string; envelopeId: string }> }) {
  const { locale, envelopeId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(envelopeId).success) notFound();
  const path = `/${locale}/signatures/${envelopeId}/preparation`;
  let initial;
  try { initial = await readSignerPreparation(envelopeId); }
  catch (error) {
    if (error instanceof PreparationReadError && error.code === "UNAUTHENTICATED") redirect(connexionHref(locale,{next:path}));
    if (error instanceof PreparationReadError && error.code === "NOT_FOUND") notFound();

  }
  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-5xl space-y-6 px-4 py-8"><nav className="flex flex-wrap items-center justify-between gap-4"><Link href={`/${locale}/signatures/preparation`} className="min-h-11 py-2 underline">{locale === "ar" ? "توقيعاتي" : "Mes signatures"}</Link><Link href={`/${locale === "fr" ? "ar" : "fr"}/signatures/${envelopeId}/preparation`} hrefLang={locale === "fr" ? "ar" : "fr"} className="min-h-11 py-2 underline">{locale === "fr" ? "العربية" : "Français"}</Link></nav>{initial ? <SignerPreparationPanel initial={initial} locale={locale}/> : <WorkspaceFailure locale={locale} reason="UNAVAILABLE" returnPath={path}/>}</main>;
}
