"use client";
import { useActionState, useState } from "react";
import { requestReplay, approveReplay, type ReplayState } from "./replay-actions";
const initial: ReplayState = { status: "idle" };
type ReplayProps = { locale: "fr" | "ar"; eventId?: string; requestId?: string; initialKey: string };
export function ReplayForm(props: ReplayProps) {
  const [key, setKey] = useState(props.initialKey);
  return <ReplayFormContent key={key} {...props} intentKey={key} onRestart={() => setKey(crypto.randomUUID())}/>;
}
function ReplayFormContent({ locale, eventId, requestId, intentKey, onRestart }: ReplayProps & { intentKey: string; onRestart: () => void }) {
  const key = intentKey;
  const [state, action, pending] = useActionState(requestId ? approveReplay : requestReplay, initial);
  return <form action={action} className="mt-3 space-y-3">
    <input type="hidden" name="locale" value={locale}/><input type="hidden" name="idempotencyKey" value={key}/>
    {requestId ? <input type="hidden" name="requestId" value={requestId}/> : <><input type="hidden" name="eventId" value={eventId}/><label className="block text-sm">{locale === "ar" ? "سبب إعادة المحاولة" : "Motif de la reprise"}<textarea name="reason" required minLength={10} maxLength={1000} className="mt-1 min-h-20 w-full rounded border bg-background p-2"/></label></>}
    <button type="submit" disabled={pending || !key} className="min-h-11 rounded border px-4 font-medium disabled:opacity-50">{pending ? (locale === "ar" ? "جارٍ المعالجة…" : "Traitement…") : requestId ? (locale === "ar" ? "الموافقة وإعادة الجدولة" : "Approuver et replanifier") : (locale === "ar" ? "طلب إعادة المحاولة" : "Demander une reprise")}</button>
    {state.status === "success" && !requestId ? <button type="button" onClick={onRestart} className="min-h-11 rounded border px-4">{locale === "ar" ? "طلب جديد عند حادث آخر" : "Nouvelle demande pour un autre incident"}</button> : null}
    <p role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? (locale === "ar" ? "تم تسجيل الإجراء." : "Action enregistrée.") : state.status === "error" ? (locale === "ar" ? "تعذر تنفيذ الإجراء. تحققوا من الصلاحيات والحالة ورقابة الشخصين." : "Action refusée ou indisponible. Vérifiez les droits, l’état et l’approbation par un autre administrateur.") : ""}</p>
  </form>;
}
