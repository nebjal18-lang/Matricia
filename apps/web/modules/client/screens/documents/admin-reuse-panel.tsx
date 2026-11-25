"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { shortReference } from "@/modules/shared/lib/format/display";
import { respondDocumentReuse, type ReuseState } from "./admin-reuse-actions";

const reuseTargetLabels: Record<"fr" | "ar", Record<string, string>> = {
  fr: {
    SERVICE_REQUEST: "Demande de service",
    CONTRACT_VERSION: "Version de contrat",
    MISSION: "Mission contractuelle",
  },
  ar: {
    SERVICE_REQUEST: "طلب خدمة",
    CONTRACT_VERSION: "إصدار عقد",
    MISSION: "مهمة تعاقدية",
  },
};

function reuseTargetLabel(locale: "fr" | "ar", value: string) {
  return reuseTargetLabels[locale][value] ?? (locale === "ar" ? "ملف غير معروف" : "Dossier non reconnu");
}
export type DocumentReuseRequest = { id: string; document_id: string; target_type: string; target_id: string; purpose: string; status: string; created_at: string };
export function AdminReusePanel({ locale, requests, keys }: { locale: "fr" | "ar"; requests: DocumentReuseRequest[]; keys: Record<string, string> }) {
  return <section className="client-card"><h2>{locale === "fr" ? "Autorisations de partage demandées" : "طلبات إذن المشاركة"}</h2><p>{locale === "fr" ? "Chaque accord autorise uniquement le document, le dossier et l’usage indiqués. Vous pouvez refuser." : "تقتصر كل موافقة على المستند والملف والغرض المبين. يمكنكم الرفض."}</p>{requests.length ? requests.map(request => <ReuseRequest key={request.id} locale={locale} request={request} keyValue={keys[request.id]} />) : <p>{locale === "fr" ? "Aucune demande en attente." : "لا توجد طلبات معلقة."}</p>}</section>;
}
function ReuseRequest({ locale, request, keyValue }: { locale: "fr" | "ar"; request: DocumentReuseRequest; keyValue: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (previous: ReuseState, form: FormData) => { const result = await respondDocumentReuse(previous, form); if (result.status === "success") router.refresh(); return result; }, { status: "idle" });
  return <form action={action} className="mt-4 grid gap-3 rounded-lg border p-4"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="key" value={keyValue} /><a href={`/api/client/documents/${request.document_id}`} className="underline">{locale === "fr" ? "Consulter le document" : "عرض المستند"}</a><p>{reuseTargetLabel(locale, request.target_type)} · <span dir="ltr">{shortReference(request.target_id)}</span></p><p>{request.purpose}</p><div className="flex flex-wrap gap-4"><button type="submit" name="accept" value="true" disabled={pending} className="min-h-11 rounded-md border px-4">{locale === "fr" ? "Autoriser ce partage" : "السماح بهذه المشاركة"}</button><button type="submit" name="accept" value="false" disabled={pending} className="min-h-11 rounded-md border px-4">{locale === "fr" ? "Refuser" : "رفض"}</button></div>{state.status === "error" ? <p role="alert">{state.mfa ? <Link href={`/${locale}/securite/compte`}>{locale === "fr" ? "Vérifiez vos droits et votre authentification renforcée avant de réessayer." : "تحققوا من الصلاحيات والمصادقة المعززة قبل المحاولة."}</Link> : locale === "fr" ? "La demande n’a pas pu être traitée. Actualisez la page et réessayez." : "تعذرت معالجة الطلب. حدّثوا الصفحة وحاولوا مجدداً."}</p> : null}{state.status === "success" ? <p role="status">{locale === "fr" ? "Votre décision est enregistrée." : "تم تسجيل قراركم."}</p> : null}</form>;
}
