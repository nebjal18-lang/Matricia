"use client";
import { useParams } from "next/navigation";
import { Button } from "@/modules/shared/ui/button";
export default function ClientError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ar = useParams<{ locale: string }>().locale === "ar";
  return <main className="client-page" dir={ar ? "rtl" : "ltr"}>
    <h1>{ar ? "تعذر تحميل مساحة العميل" : "Chargement de l’espace client indisponible"}</h1>
    <p role="alert">{ar ? "حدث خطأ تقني. لا يعني ذلك غياب الملفات أو رفض صلاحياتكم. أعيدوا المحاولة أو اتصلوا بالدعم مع ذكر المرجع CLIENT-LOAD." : "Une erreur technique empêche le chargement. Elle ne signifie ni une absence de dossiers ni un refus de vos droits. Réessayez ou contactez l’assistance avec la référence CLIENT-LOAD."}</p>
    <Button type="button" onClick={reset}>{ar ? "إعادة المحاولة" : "Réessayer"}</Button>
    <a href={ar ? "/ar/contact" : "/fr/contact"}>{ar ? "الاتصال بالدعم" : "Contacter l’assistance"}</a>
  </main>;
}
