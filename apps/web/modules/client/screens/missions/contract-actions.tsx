"use client";
import{useActionState,useState,useSyncExternalStore}from"react";
import{Button}from"@/modules/shared/ui/button";
import type{Locale}from"@/modules/shared/lib/i18n/locale";
import type{ContractMissionDashboard}from"@/modules/shared/lib/contracts-missions/model";
import{SignatureReadinessNotice}from"@/modules/shared/ui/signature-readiness-notice";
import{submitContract,type MissionActionState}from"./actions";
import type{MissionMessages}from"./messages";
const idle:MissionActionState={status:"idle"},subscribe=()=>()=>{},serverSnapshot=()=>false,clientSnapshot=()=>true;
type Contract=ContractMissionDashboard["contracts"][number];
export function SubmitContractForm({contract,locale,messages}:{contract:Contract;locale:Locale;messages:MissionMessages}){
 const[state,action,pending]=useActionState(submitContract,idle),[key]=useState(()=>crypto.randomUUID()),hydrated=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot),ready=contract.signatureReadiness?.ready&&contract.signatureReadiness.status==="READY_TO_SUBMIT";
 if(!ready)return<SignatureReadinessNotice locale={locale} readiness={contract.signatureReadiness}/>;
 return<div className="grid gap-3"><SignatureReadinessNotice locale={locale} readiness={contract.signatureReadiness}/><form action={action} className="space-y-3"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="idempotencyKey" value={hydrated?key:""}/><input type="hidden" name="contractId" value={contract.id}/><input type="hidden" name="rowVersion" value={contract.rowVersion}/><Button disabled={pending||!hydrated} className="min-h-11 w-full">{pending?messages.pending:messages.submit}</Button>{state.status==="error"?<p role="alert">{state.reason==="SIGNATURE_PREREQUISITES"?(locale==="fr"?"Les prérequis de signature ont changé. Rechargez pour consulter l’état exact.":"تغيرت متطلبات التوقيع. أعيدوا التحميل لعرض الحالة الدقيقة."):state.reason==="CONFLICT"?messages.conflict:state.reason==="FORBIDDEN"?messages.forbidden:messages.failed}</p>:state.status==="success"?<p role="status">{locale==="fr"?"La version a été transmise au circuit de signature configuré. La signature reste en attente de sa preuve vérifiée.":"تم إرسال النسخة إلى مسار التوقيع المعد. ويبقى التوقيع بانتظار إثباته المتحقق منه."}</p>:null}</form></div>;
}
/** Signing is imported from the verified provider callback; no browser evidence is accepted. */
export function SignContractForm({contract,locale}:{contract:Contract;organizationId:string;locale:Locale;messages:MissionMessages}){return<SignatureReadinessNotice locale={locale} readiness={contract.signatureReadiness}/>;}
