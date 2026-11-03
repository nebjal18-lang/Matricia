"use client";
import { useActionState } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { resolveCapabilityReview } from "./actions";
export function CapabilityResolutionForm({locale,reviewId,roles}:{locale:Locale;reviewId:string;roles:string[]}){
 const[state,action,pending]=useActionState(resolveCapabilityReview,{status:"idle"} as {status:"idle"|"success"|"error"});const ar=locale==="ar";
 return <form action={action}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="reviewId" value={reviewId}/><label>{ar?"القرار":"Décision"}<select name="resolution"><option value="REJECTED">{ar?"رفض القدرات الإضافية":"Refuser les capacités supplémentaires"}</option><option value="CANONICAL_ROLE_APPLIED">{ar?"دور معتمد مطبق بالفعل":"Rôle autorisé effectivement appliqué"}</option></select></label><label>{ar?"الدور المطبق":"Rôle appliqué"}<select name="canonicalRole"><option value="">—</option>{roles.map((role)=><option key={role}>{role}</option>)}</select></label><label>{ar?"التعليل":"Motif"}<textarea name="reason" required minLength={3} maxLength={500}/></label><button disabled={pending}>{ar?"إغلاق المراجعة":"Clore la revue"}</button><p role={state.status==="error"?"alert":"status"} aria-live="polite">{state.status==="error"?(ar?"تعذر تسجيل القرار. تحققوا من الدور المطبق والمصادقة.":"Décision refusée. Vérifiez le rôle effectivement appliqué et la MFA."):state.status==="success"?(ar?"تم تسجيل المراجعة.":"Revue enregistrée."):""}</p></form>;
}
