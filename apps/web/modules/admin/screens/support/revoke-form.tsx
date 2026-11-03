"use client";
import { useActionState } from "react";
import { revokeSupport } from "./actions";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
export function SupportRevokeForm({locale,grantId,workId}:{locale:Locale;grantId:string;workId:string}){
 const[state,action,pending]=useActionState(revokeSupport,{status:"idle"} as {status:"idle"|"success"|"error"});const ar=locale==="ar";
 return <form action={action}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="grantId" value={grantId}/><input type="hidden" name="workId" value={workId}/><label>{ar?"سبب الإلغاء":"Motif de révocation"}<input name="reason" minLength={3} maxLength={500} required/></label><button disabled={pending}>{ar?"إلغاء الوصول فوراً":"Révoquer l’accès immédiatement"}</button><p role={state.status==="error"?"alert":"status"} aria-live="polite">{state.status==="success"?(ar?"تم إلغاء الوصول.":"Accès révoqué."):state.status==="error"?(ar?"تعذر إلغاء الوصول. تحققوا من الصلاحيات.":"Révocation refusée. Vérifiez vos habilitations."):""}</p></form>;
}
