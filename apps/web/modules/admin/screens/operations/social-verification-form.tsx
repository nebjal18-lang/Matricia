"use client";
import { useActionState, useState } from "react";
import { requestSocialVerification, type SocialVerificationState } from "./social-verification-actions";
const initial: SocialVerificationState = { status: "idle" };
type SocialProps = { locale: "fr" | "ar"; jobId: string; initialKey: string };
export function SocialVerificationForm(props: SocialProps) {
 const [key, setKey] = useState(props.initialKey);
 return <SocialVerificationContent key={key} {...props} intentKey={key} onRestart={() => setKey(crypto.randomUUID())}/>;
}
function SocialVerificationContent({ locale, jobId, intentKey, onRestart }: SocialProps & { intentKey: string; onRestart: () => void }) {
 const key = intentKey;
 const [state, action, pending] = useActionState(requestSocialVerification, initial), ar = locale === "ar";
 return <form action={action} className="mt-3 space-y-3"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="jobId" value={jobId}/><input type="hidden" name="key" value={key}/><label className="block">{ar ? "معرّف المنشور الموجود لدى المزود" : "Identifiant de la publication existante chez le fournisseur"}<input name="publicationId" dir="ltr" required minLength={3} maxLength={300} className="mt-1 block min-h-11 w-full rounded border bg-background p-2"/></label><button disabled={pending || !key} className="min-h-11 rounded border px-4 disabled:opacity-50">{ar ? "التحقق دون إعادة النشر" : "Vérifier sans republier"}</button>{state.status === "success" ? <button type="button" onClick={onRestart} className="min-h-11 rounded border px-4">{ar ? "التحقق من معرّف آخر" : "Vérifier un autre identifiant"}</button> : null}<p role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? (ar ? "تم تسجيل طلب التحقق. لم يتم إنشاء أي منشور جديد." : "Vérification demandée. Aucune nouvelle publication n’a été créée.") : state.status === "error" ? (ar ? "الطلب مرفوض أو الإثبات غير متاح." : "Demande refusée ou preuve indisponible.") : ""}</p></form>;
}
