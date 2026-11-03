"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveHumanAssistance, replyHumanAssistance, withdrawHumanAssistance, type HumanAssistanceState } from "./human-actions";
export type HumanRequest = { id: string; subject: string; body: string; status: string; row_version: number; document_ids: string[]; created_by: string };
const idle: HumanAssistanceState = { status: "idle" };
function Feedback({ state, locale }: { state: HumanAssistanceState; locale: "fr" | "ar" }) {
  if (state.status === "idle") return null;
  const errors = locale === "fr" ? { VALIDATION: "Vérifiez les champs et votre consentement.", FORBIDDEN: "Vous ne pouvez pas modifier cette demande.", CONFLICT: "La demande a changé. Rechargez avant de continuer.", UNAVAILABLE: "Enregistrement indisponible. Votre saisie est conservée ; réessayez." } : { VALIDATION: "تحققوا من الحقول والموافقة.", FORBIDDEN: "لا يمكنكم تعديل هذا الطلب.", CONFLICT: "تغير الطلب. أعيدوا التحميل قبل المتابعة.", UNAVAILABLE: "الحفظ غير متاح. تم الاحتفاظ بالإدخال؛ حاولوا مجدداً." };
  return <p role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? (locale === "fr" ? "Demande enregistrée." : "تم حفظ الطلب.") : errors[state.reason]}</p>;
}
export function HumanAssistanceForm({ locale, organizationId, request, documents, keyValue }: { locale: "fr" | "ar"; organizationId: string; request?: HumanRequest; documents: { id: string; fileName: string }[]; keyValue: string }) {
  const fr = locale === "fr", router = useRouter();
  const [key, setKey] = useState(keyValue);
  const [state, action, pending] = useActionState(async (previous: HumanAssistanceState, form: FormData) => { const result = await saveHumanAssistance(previous, form).catch(() => ({ status: "error" as const, reason: "UNAVAILABLE" as const })); if (result.status === "success") { setKey(crypto.randomUUID()); router.replace(`/${locale}/client/diagnostics/assistance?organizationId=${organizationId}&requestId=${result.id}`); router.refresh(); } return result; }, idle);
  const [subject, setSubject] = useState(request?.subject ?? "");
  const [body, setBody] = useState(request?.body ?? "");
  const [selectedDocuments, setSelectedDocuments] = useState(request?.document_ids ?? []);
  const [consent, setConsent] = useState(false);
  const availableDocuments = [...documents, ...selectedDocuments.filter(id => !documents.some(document => document.id === id)).map(id => ({ id, fileName: `${fr ? "Pièce à vérifier dans le coffre" : "مستند للتحقق في الخزنة"} · ${id.slice(0,8)}` }))];
  return <form action={action} className="grid gap-4">
    <input type="hidden" name="locale" value={locale}/><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="requestId" value={request?.id ?? ""}/><input type="hidden" name="version" value={request?.row_version ?? 0}/><input type="hidden" name="key" value={key}/>
    <label className="grid gap-2">{fr ? "Objet de votre demande" : "موضوع الطلب"}<input className="min-h-11 rounded-md border p-3" name="subject" required minLength={3} maxLength={200} value={subject} onChange={event => setSubject(event.target.value)}/></label>
    <label className="grid gap-2">{fr ? "Question et contexte de la relecture" : "السؤال وسياق المراجعة"}<textarea className="min-h-32 rounded-md border p-3" name="body" required minLength={10} maxLength={10000} value={body} onChange={event => setBody(event.target.value)}/></label>
    <fieldset className="grid gap-2"><legend>{fr ? "Pièces privées vérifiées à joindre" : "مستندات خاصة تم التحقق منها"}</legend>{availableDocuments.map(d => <label key={d.id} className="flex min-h-11 items-center gap-3"><input type="checkbox" name="documents" value={d.id} checked={selectedDocuments.includes(d.id)} onChange={event => setSelectedDocuments(current => event.target.checked ? [...current,d.id] : current.filter(id => id !== d.id))}/>{d.fileName}</label>)}<Link href={`/${locale}/client/onboarding?organizationId=${organizationId}`} className="underline">{fr ? "Ajouter une pièce au coffre et attendre sa vérification" : "إضافة مستند إلى الخزنة وانتظار التحقق"}</Link><p className="text-sm">{fr ? "Seules les pièces privées validées et analysées CLEAN peuvent être partagées avec le conseiller." : "يمكن مشاركة المستندات الخاصة المعتمدة والسليمة بعد الفحص مع المستشار فقط."}</p></fieldset>
    <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="consent" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1"/><span>{fr ? "J’autorise le conseiller habilité à lire cette demande et les seules pièces sélectionnées." : "أسمح للمستشار المخول بقراءة هذا الطلب والمستندات المختارة فقط."}</span></label>
    <div className="flex flex-wrap gap-3"><button name="intent" value="save" disabled={pending || state.status === "success"} className="diag-conn-btn-outline">{fr ? "Enregistrer le brouillon" : "حفظ المسودة"}</button><button name="intent" value="submit" disabled={pending || state.status === "success"} className="diag-conn-btn-grad">{pending ? (fr ? "Enregistrement…" : "جارٍ الحفظ…") : fr ? "Envoyer ma demande" : "إرسال طلبي"}</button></div><Feedback state={state} locale={locale}/>
  </form>;
}
export function HumanReplyForm({ locale, requestId, keyValue }: { locale: "fr" | "ar"; requestId: string; keyValue: string }) {
  const router = useRouter(); const [key, setKey] = useState(keyValue);
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState(async (previous: HumanAssistanceState, form: FormData) => { const result = await replyHumanAssistance(previous, form).catch(() => ({ status: "error" as const, reason: "UNAVAILABLE" as const })); if (result.status === "success") { setKey(crypto.randomUUID()); setBody(""); router.refresh(); } return result; }, idle);
  return <form action={action} className="grid gap-3"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="key" value={key}/><label className="grid gap-2">{locale === "fr" ? "Votre réponse au conseiller" : "ردكم على المستشار"}<textarea value={body} onChange={event => setBody(event.target.value)} name="body" required minLength={1} maxLength={10000} className="min-h-24 border p-3"/></label><button disabled={pending} className="diag-conn-btn-grad">{locale === "fr" ? "Envoyer la réponse" : "إرسال الرد"}</button><Feedback state={state} locale={locale}/></form>;
}

export function WithdrawAssistanceConsent({ locale, requestId, version, keyValue }: { locale: "fr"|"ar"; requestId: string; version: number; keyValue: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async(previous: HumanAssistanceState, form: FormData) => {
    const result = await withdrawHumanAssistance(previous,form).catch(() => ({status:"error" as const,reason:"UNAVAILABLE" as const}));
    if (result.status === "success") router.refresh();
    return result;
  },idle);
  return <form action={action} className="mt-5 grid gap-3 rounded-lg border p-4"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="version" value={version}/><input type="hidden" name="key" value={keyValue}/><label className="flex min-h-11 items-start gap-3"><input type="checkbox" required name="confirmed"/><span>{locale === "fr" ? "Je retire l’accès du conseiller à ma demande et aux pièces jointes. La demande sera clôturée et la preuve de ma décision conservée." : "أسحب وصول المستشار إلى طلبي ومرفقاته. سيتم إغلاق الطلب والاحتفاظ بإثبات قراري."}</span></label><button disabled={pending || state.status === "success"} className="min-h-11 rounded-md border px-4">{locale === "fr" ? "Retirer mon autorisation" : "سحب إذني"}</button>{state.status === "error" ? <Feedback state={state} locale={locale}/> : state.status === "success" ? <p role="status">{locale === "fr" ? "Votre autorisation est retirée." : "تم سحب إذنكم."}</p> : null}</form>;
}
