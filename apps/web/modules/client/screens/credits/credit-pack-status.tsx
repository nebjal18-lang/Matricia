"use client";
import { useState } from "react";
import { readSubscriptionPaymentStatus } from "../abonnement/payment-status";
import { getSubscriptionMessages } from "../abonnement/messages";
import type { PaymentCaptureStatus } from "../abonnement/payment-confirmation";
export function CreditPackStatus({locale,organizationId,paymentIntentId}:{locale:"fr"|"ar";organizationId:string;paymentIntentId:string}) {
  const [status,setStatus]=useState<PaymentCaptureStatus|"REQUIRES_CONFIRMATION"|"error"|null>(null);
  const [pending,setPending]=useState(false), m=getSubscriptionMessages(locale);
  async function refresh(){setPending(true);try{const r=await readSubscriptionPaymentStatus(organizationId,paymentIntentId,"CREDIT_PACK");setStatus(r?.status??"error");}catch{setStatus("error");}finally{setPending(false);}}
  return <div className="my-2"><button type="button" className="min-h-11 rounded border p-2" disabled={pending} onClick={()=>void refresh()}>{pending?m.pending:m.refreshPaymentStatus}</button>{status?<p role={status==="error"?"alert":"status"}>{status==="CONFIRMED"?m.paymentConfirmed:status==="PENDING_WEBHOOK"?m.paymentAwaitingWebhook:status==="error"?(locale==="ar"?"تعذر التحقق من حالة العملية؛ لا تعيدوا الدفع.":"Impossible de vérifier l’opération ; ne relancez pas le paiement."):m.paymentReview}</p>:null}</div>;
}
