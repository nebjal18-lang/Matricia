"use client";
import { useActionState } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { replyAssistance, type AssistanceState } from "./actions";
export function AssistanceReply({ id, locale, requestKey }: { id: string; locale: Locale; requestKey: string }) {
 const [state, action, pending] = useActionState(replyAssistance, {status:"idle"} as AssistanceState);
 const ar=locale==="ar";
 return <form action={action} className="client-card client-stack"><input name="requestId" type="hidden" value={id}/><input name="locale" type="hidden" value={locale}/><input name="idempotencyKey" type="hidden" value={requestKey}/><label htmlFor="assistance-reply">{ar?"الرد على العميل":"Réponse au client"}</label><textarea id="assistance-reply" name="body" minLength={3} maxLength={10000} required rows={6}/><label><input type="checkbox" name="close"/>{ar?"إغلاق الطلب بعد الرد":"Clore la demande après la réponse"}</label><button disabled={pending}>{ar?"إرسال الرد":"Envoyer la réponse"}</button><p role={state.status==="error"?"alert":"status"} aria-live="polite">{state.status==="success"?(ar?"تم إرسال الرد.":"Réponse transmise."):state.status==="error"?(ar?"تعذر الإرسال. تحققوا من الصلاحيات والمصادقة الثنائية.":"Envoi refusé. Vérifiez les habilitations et la MFA."):""}</p></form>;
}
