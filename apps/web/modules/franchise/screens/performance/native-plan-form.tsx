"use client";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { recordNativePlanProgress, type NativePlanActionState } from "./native-plan-actions";
export function NativePlanProgressForm({ locale, planId, canProgress = true }: { locale: Locale; planId: string; canProgress?: boolean }) {
  const id = useId(); const ar = locale === "ar";
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (prior: NativePlanActionState, form: FormData) => {
    const result = await recordNativePlanProgress(prior, form);
    if (result.status === "success") setKey(crypto.randomUUID());
    return result;
  }, { status: "idle" });
  return <form action={action} className="mt-4 grid gap-3">
    <input type="hidden" name="locale" value={locale}/><input type="hidden" name="planId" value={planId}/><input type="hidden" name="idempotencyKey" value={key}/>
    <label htmlFor={`${id}-kind`}>{ar ? "نوع المتابعة" : "Type de suivi"}</label>
    <select className="min-h-11 rounded border px-3" id={`${id}-kind`} name="kind"><option value="COMMENT">{ar ? "تعليق" : "Commentaire"}</option>{canProgress ? <option value="PROGRESS">{ar ? "تقدم العمل" : "Avancement"}</option> : null}</select>
    <label htmlFor={`${id}-comment`}>{ar ? "تعليق ومراجع العمل المنجز" : "Commentaire et références du travail effectué"}</label>
    <textarea className="min-h-24 rounded border p-3" id={`${id}-comment`} name="comment" minLength={3} maxLength={2000} required/>
    {canProgress ? <><label htmlFor={`${id}-progress`}>{ar ? "نسبة التقدم عند اختيار تقدم العمل" : "Pourcentage, pour un suivi d’avancement"}</label>
    <input className="min-h-11 rounded border px-3" id={`${id}-progress`} name="progress" type="number" min={0} max={100} step={1} defaultValue={0}/></> : null}
    <button className="franchise-tool" disabled={pending}>{pending ? ar ? "جارٍ التسجيل…" : "Enregistrement…" : ar ? "تسجيل المتابعة" : "Enregistrer le suivi"}</button>
    {state.status === "success" ? <p role="status">{ar ? "سُجلت المتابعة دون تعديل الحالة التعاقدية للامتياز." : "Suivi enregistré ; le statut contractuel de la franchise reste soumis à sa gouvernance."}</p> : state.status === "error" ? <p role="alert">{state.reason === "VALIDATION" ? ar ? "تحققوا من الحقول." : "Vérifiez les champs." : state.reason === "MFA_REQUIRED" ? ar ? "أكّدوا العامل الثاني لتسجيل القرار." : "Confirmez votre second facteur pour enregistrer la décision." : state.reason === "CONFLICT" ? ar ? "تغيرت شروط الخطة أو لا تزال إعادة القياس مطلوبة. حدّثوا الصفحة وراجعوا آخر تقرير." : "Les conditions du plan ont changé ou une nouvelle mesure est encore nécessaire. Actualisez la page et consultez le dernier rapport." : state.reason === "FORBIDDEN" ? ar ? "لا تملكون صلاحية تعديل هذه الخطة." : "Vous n’êtes pas habilité à modifier ce plan." : state.reason === "UNAUTHENTICATED" ? ar ? "أعيدوا الاتصال قبل المتابعة." : "Reconnectez-vous avant de poursuivre." : ar ? "تعذر تسجيل المتابعة. يمكن إعادة المحاولة بنفس الطلب." : "Le suivi n’a pas été enregistré. Réessayez avec la même demande."}</p> : null}
    {state.status === "error" && state.reason === "MFA_REQUIRED" ? <Link className="min-h-11 underline" href={`/${locale}/securite/compte`}>{ar ? "تأكيد العامل الثاني" : "Vérifier mon second facteur"}</Link> : null}
  </form>;
}

export function NativePlanDecisionForm({ locale, planId, canApprove = true, canComplete = true, canReject = true }: { locale: Locale; planId: string; canApprove?: boolean; canComplete?: boolean; canReject?: boolean }) {
  const id = useId(); const ar = locale === "ar";
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (prior: NativePlanActionState, form: FormData) => {
    const result = await recordNativePlanProgress(prior, form);
    if (result.status === "success") setKey(crypto.randomUUID());
    return result;
  }, { status: "idle" });
  return <form action={action} className="mt-4 grid gap-3 rounded-lg border p-3">
    <input type="hidden" name="locale" value={locale}/><input type="hidden" name="planId" value={planId}/><input type="hidden" name="idempotencyKey" value={key}/>
    <label htmlFor={`${id}-decision`}>{ar ? "قرار الإدارة المخوّلة" : "Décision de l’administration habilitée"}</label>
    <select id={`${id}-decision`} name="kind" className="min-h-11 rounded border px-3">{canApprove ? <option value="APPROVED">{ar ? "اعتماد الخطة" : "Approuver le plan"}</option> : null}{canReject ? <option value="REJECTED">{ar ? "رفض المقترح" : "Refuser la proposition"}</option> : null}{canComplete ? <option value="COMPLETED">{ar ? "إقرار الإنجاز بعد التحقق" : "Constater l’achèvement après vérification"}</option> : null}</select>
    <label htmlFor={`${id}-reason`}>{ar ? "مبررات القرار ومراجع التحقق" : "Motif de décision et références de vérification"}</label>
    <textarea id={`${id}-reason`} name="comment" required minLength={3} maxLength={2000} className="min-h-24 rounded border p-3"/>
    <button type="submit" disabled={pending} className="franchise-tool">{pending ? ar ? "جارٍ التسجيل…" : "Enregistrement…" : ar ? "تسجيل القرار" : "Enregistrer la décision"}</button>
    {state.status === "success" ? <p role="status">{ar ? "سُجل القرار دون تغيير الحالة التعاقدية للامتياز." : "Décision enregistrée sans changement automatique du statut contractuel."}</p> : state.status === "error" ? <p role="alert">{state.reason === "CONFLICT" ? ar ? "يلزم التحقق من شروط الخطة وإعادة قياس الأهداف قبل إقرار الإنجاز." : "Vérifiez les conditions du plan et la nouvelle mesure des objectifs avant de constater l’achèvement." : state.reason === "MFA_REQUIRED" ? ar ? "أكّدوا العامل الثاني لتسجيل القرار." : "Confirmez votre second facteur pour enregistrer la décision." : ar ? "تعذر تسجيل القرار. تحققوا من الصلاحيات والعامل الثاني والشروط ثم أعيدوا المحاولة." : "Décision non enregistrée. Vérifiez les habilitations, le second facteur et les prérequis avant de réessayer."}</p> : null}
    {state.status === "error" && state.reason === "MFA_REQUIRED" ? <Link className="min-h-11 underline" href={`/${locale}/securite/compte`}>{ar ? "تأكيد العامل الثاني" : "Vérifier mon second facteur"}</Link> : null}
  </form>;
}
