"use client";
import {useActionState,useEffect} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/modules/shared/ui/button";
import {formatMinor,type PendingProviderBillingIntent} from "@/modules/provider/data/billing/model";
import {resumeBillingIntent,cancelBillingIntent,type BillingActionState} from "./actions";
import type {Locale} from "@/modules/shared/lib/i18n/locale";
const idle:BillingActionState={status:"idle"};
function Intent({item,locale}:{item:PendingProviderBillingIntent;locale:Locale}){
 const ar=locale==="ar",router=useRouter(),[state,resume,pending]=useActionState(resumeBillingIntent,idle),[cancelState,cancel,cancelling]=useActionState(cancelBillingIntent,idle);
 useEffect(()=>{if(state.status==="success"||cancelState.status==="success")router.refresh();},[state.status,cancelState.status,router]);
 const unavailable=item.expired||item.status==="REJECTED"||["INFECTED","ERROR"].includes(item.scanStatus);
 return <li className="rounded-lg border p-3"><strong>{item.kind==="PAYMENT"?(ar?"دفع":"Paiement"):(ar?"إثبات تحصيل":"Encaissement à justifier")} · {item.reference} · {formatMinor(item.amountMinor,item.currency,locale)}</strong><p>{unavailable?(ar?"الدليل منتهي أو مرفوض. ألغِ هذه النية وأرسل دليلاً جديداً.":"Justificatif expiré ou refusé. Annulez cette intention puis transmettez un nouveau fichier."):item.scanStatus==="CLEAN"?(ar?"الدليل سليم. يمكن إنهاء التسجيل.":"Justificatif contrôlé. Vous pouvez finaliser l’enregistrement."):(ar?"النية محفوظة. يمكن العودة بعد إعادة تحميل الصفحة؛ الفحص جارٍ.":"Intention sauvegardée. Vous pouvez revenir après rechargement ; l’analyse est en attente.")}</p><div className="flex flex-wrap gap-3">{!unavailable?<form action={resume}><input type="hidden" name="intentId" value={item.id}/><Button disabled={pending}>{pending?(ar?"جارٍ التحقق…":"Vérification…"):(ar?"تحقق وإنهاء":"Vérifier et finaliser")}</Button></form>:null}<form action={cancel}><input type="hidden" name="intentId" value={item.id}/><Button variant="outline" disabled={cancelling}>{ar?"إلغاء النية":"Annuler l’intention"}</Button></form></div>{state.status==="pending_scan"?<p role="status">{ar?"لا يزال الفحص جارياً؛ لم تسجل أي حركة مالية.":"Analyse toujours en attente ; aucune écriture financière enregistrée."}</p>:null}{state.status==="error"||cancelState.status==="error"?<p role="alert">{ar?"تعذرت العملية. حدّث الصفحة للتحقق من الحالة.":"Opération impossible. Actualisez pour vérifier l’état."}</p>:null}</li>;
}
export function PendingBillingIntents({items,locale}:{items:readonly PendingProviderBillingIntent[];locale:Locale}){return items.length?<section className="client-card"><h2>{locale==="ar"?"نيات الفوترة المحفوظة":"Intentions de facturation sauvegardées"}</h2><ul className="space-y-3">{items.map(item=><Intent key={item.id} item={item} locale={locale}/>)}</ul></section>:null;}
