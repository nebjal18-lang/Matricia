"use client";
import { useActionState, useState } from "react";
import { submitRefundAction, submitRefundReconciliationAction, type RefundState } from "./refund-actions";
const initial: RefundState = { status: "idle" };
type RefundProps = { locale: "fr" | "ar"; paymentId?: string; requestId?: string; currency?: string; initialKey: string };
export function RefundForm(props: RefundProps) {
  const [key, setKey] = useState(props.initialKey);
  return <RefundFormContent key={key} {...props} intentKey={key} onRestart={() => setKey(crypto.randomUUID())}/>;
}
function RefundFormContent({ locale, paymentId, requestId, currency, intentKey, onRestart }: RefundProps & { intentKey: string; onRestart: () => void }) {
  const key = intentKey;
  const [state, action, pending] = useActionState(submitRefundAction, initial);
  const ar = locale === "ar";
  return <form action={action} className="mt-3 space-y-3">
    <input type="hidden" name="locale" value={locale}/><input type="hidden" name="key" value={key}/>
    {requestId ? <input type="hidden" name="requestId" value={requestId}/> : <><input type="hidden" name="paymentId" value={paymentId}/><input type="hidden" name="action" value="request"/>
      <label className="block">{ar ? "المبلغ" : "Montant"} ({currency})<input name="amount" dir="ltr" inputMode="decimal" required pattern="(?:0|[1-9][0-9]*)[.][0-9]{2}" aria-describedby={`amount-help-${paymentId}`} className="mt-1 block min-h-11 w-full rounded border bg-background p-2"/></label>
      <p id={`amount-help-${paymentId}`} className="text-sm text-muted-foreground">{ar ? "اكتبوا المبلغ بمنزلتين عشريتين، مثل 12.50." : "Saisissez deux décimales, par exemple 12.50."}</p>
      <label className="block">{ar ? "سبب الاسترداد" : "Motif du remboursement"}<textarea name="reason" required minLength={10} maxLength={1000} className="mt-1 min-h-20 w-full rounded border bg-background p-2"/></label></>}
    <div className="flex flex-wrap gap-3"><button type="submit" name={requestId ? "action" : undefined} value={requestId ? "approve" : undefined} disabled={pending || !key} className="min-h-11 rounded border px-4 font-medium disabled:opacity-50">{requestId ? (ar ? "الموافقة على الاسترداد" : "Approuver le remboursement") : (ar ? "طلب الاسترداد" : "Demander le remboursement")}</button>{requestId ? <button type="submit" name="action" value="cancel" disabled={pending || !key} className="min-h-11 rounded border px-4">{ar ? "رفض" : "Refuser"}</button> : null}</div>
    {state.status === "success" && !requestId ? <button type="button" onClick={onRestart} className="min-h-11 rounded border px-4">{ar ? "طلب استرداد آخر" : "Nouvelle demande de remboursement"}</button> : null}
    <p role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? (ar ? "تم تسجيل القرار. يتم تأكيد الاسترداد بعد التحقق من المزود." : "Décision enregistrée. Le remboursement sera confirmé après vérification du fournisseur.") : state.status === "error" ? (ar ? "تم رفض الإجراء أو تعذر تنفيذه. تحققوا من الحالة والصلاحيات ورقابة شخصين." : "Action refusée ou indisponible. Vérifiez l’état, les droits et l’approbation distincte.") : ""}</p>
  </form>;
}

type ReconciliationProps = { locale: "fr" | "ar"; refundRequestId?: string; reconciliationId?: string; initialKey: string };
export function RefundReconciliationForm(props: ReconciliationProps) {
  const [key, setKey] = useState(props.initialKey);
  return <RefundReconciliationContent key={key} {...props} intentKey={key} onRestart={() => setKey(crypto.randomUUID())}/>;
}
function RefundReconciliationContent({ locale, refundRequestId, reconciliationId, intentKey, onRestart }: ReconciliationProps & { intentKey: string; onRestart: () => void }) {
  const key = intentKey;
  const [state, action, pending] = useActionState(submitRefundReconciliationAction, initial);
  const ar = locale === "ar";
  return <form action={action} className="mt-3 space-y-3 rounded border p-3">
    <input type="hidden" name="locale" value={locale}/><input type="hidden" name="key" value={key}/>
    {reconciliationId ? <input type="hidden" name="reconciliationId" value={reconciliationId}/> : <><input type="hidden" name="refundRequestId" value={refundRequestId}/><input type="hidden" name="action" value="request"/>
      <p>{ar ? "انسخوا معرّف الاسترداد الفعلي من حساب PayPal. لا يتم إرسال استرداد جديد؛ تتحقق المنصة من العملية عبر API." : "Copiez l’identifiant du remboursement réel depuis le compte PayPal. La plateforme vérifie l’opération par API ; aucun nouveau remboursement n’est envoyé."}</p>
      <label className="block">{ar ? "معرّف استرداد PayPal" : "Identifiant de remboursement PayPal"}<input name="providerRefundId" dir="ltr" required pattern="[A-Z0-9-]{8,200}" maxLength={200} className="mt-1 block min-h-11 w-full rounded border bg-background p-2"/></label>
      <label className="block">{ar ? "سبب المصالحة" : "Motif du rapprochement"}<textarea name="reason" required minLength={10} maxLength={1000} className="mt-1 min-h-20 w-full rounded border bg-background p-2"/></label></>}
    <div className="flex flex-wrap gap-3"><button type="submit" name={reconciliationId ? "action" : undefined} value={reconciliationId ? "approve" : undefined} disabled={pending || !key} className="min-h-11 rounded border px-4">{reconciliationId ? (ar ? "الموافقة على التحقق لدى PayPal" : "Approuver la vérification PayPal") : (ar ? "طلب المصالحة" : "Demander le rapprochement")}</button>{reconciliationId ? <button type="submit" name="action" value="cancel" disabled={pending || !key} className="min-h-11 rounded border px-4">{ar ? "رفض" : "Refuser"}</button> : null}</div>
    {state.status === "success" && !reconciliationId ? <button type="button" onClick={onRestart} className="min-h-11 rounded border px-4">{ar ? "التحقق من معرّف آخر" : "Vérifier un autre identifiant"}</button> : null}
    <p role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? (ar ? "تم تسجيل الطلب. ستتحقق المنصة من الإثبات لدى PayPal." : "Demande enregistrée. La plateforme vérifiera la preuve auprès de PayPal.") : state.status === "error" ? (ar ? "المصالحة مرفوضة أو غير متاحة." : "Rapprochement refusé ou indisponible.") : ""}</p>
  </form>;
}
