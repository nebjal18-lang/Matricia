import Link from "next/link";
import { notFound } from "next/navigation";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";

export default async function SessionUnavailablePage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{next?:string}>}) {
  const [{locale},query]=await Promise.all([params,searchParams]);
  if(!isLocale(locale))notFound();
  const path=safeReturnPath(query.next,locale)??`/${locale}/`;
  return <main className="mx-auto grid min-h-dvh max-w-3xl content-center gap-6 px-4 py-12" dir={locale==="ar"?"rtl":"ltr"}>
    <Link href={`/${locale}`} className="inline-flex min-h-11 items-center text-xl font-semibold">Matricia</Link>
    <h1 className="text-2xl font-semibold">{locale==="ar"?"التحقق من الولوج غير متاح مؤقتاً":"Vérification de l’accès temporairement indisponible"}</h1>
    <p>{locale==="ar"?"تعذر التحقق من جلستكم حالياً. أعيدوا المحاولة للرجوع إلى الصفحة المطلوبة.":"La vérification de votre session n’a pas abouti. Réessayez pour reprendre la page demandée."}</p>
    <WorkspaceFailure locale={locale} reason="UNAVAILABLE" returnPath={path} supportReference="SESSION_ACCESS_CHECK"/>
  </main>;
}
