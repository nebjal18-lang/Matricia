"use client";

import { useParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { Button } from "@/modules/shared/ui/button";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ar = useParams<{ locale: string }>().locale === "ar";
  return <main className="client-page" dir={ar ? "rtl" : "ltr"}>
    <Alert variant="destructive">
      <AlertTitle>{ar ? "تعذر تحميل مساحة الإدارة" : "Chargement de l’administration indisponible"}</AlertTitle>
      <AlertDescription>{ar ? "حدث خطأ تقني. لم يتم تأكيد غياب البيانات أو رفض الصلاحيات. أعيدوا المحاولة." : "Une erreur technique empêche le chargement. Elle ne confirme ni une absence de données ni un refus d’accès. Réessayez."}</AlertDescription>
    </Alert>
    <Button type="button" onClick={reset}>{ar ? "إعادة المحاولة" : "Réessayer"}</Button>
  </main>;
}
