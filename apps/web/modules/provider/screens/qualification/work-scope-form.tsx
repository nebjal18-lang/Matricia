"use client";
import{useActionState,useEffect,useState}from"react";
import{useRouter}from"next/navigation";
import{declareProviderWorkScope,type ProviderActionState}from"./actions";
import{Button}from"@/modules/shared/ui/button";
import{Input}from"@/modules/shared/ui/input";
import{Textarea}from"@/modules/shared/ui/textarea";
import type{ProviderDashboard}from"@/modules/provider/data/qualification/model";
export function WorkScopeForm({dashboard,locale,idempotencyKey}:{dashboard:ProviderDashboard;locale:"fr"|"ar";idempotencyKey:string}){
 const[state,action,pending]=useActionState(declareProviderWorkScope,{status:"idle"}as ProviderActionState),router=useRouter(),[key,setKey]=useState(idempotencyKey),ar=locale==="ar",scope=dashboard.workScope;
 useEffect(()=>{if(state.status!=="success")return;const timer=setTimeout(()=>{setKey(crypto.randomUUID());router.refresh();},0);return()=>clearTimeout(timer);},[state.status,router]);
 return <section className="client-card"><h2>{ar?"نطاق المهام المصرّح به":"Périmètre des missions déclaré"}</h2><p>{ar?"تساعد هذه المعلومات الفريق في مراجعة التأهيل. لا تمنح التصريحات موافقة تلقائية.":"Ces informations aident l’équipe à examiner la qualification. Une déclaration ne donne aucune approbation automatique."}</p><fieldset className="contents" disabled={dashboard.canManage===false}><form action={action}className="grid gap-4"><input type="hidden" name="organizationId"value={dashboard.organizationId}/><input type="hidden"name="locale"value={locale}/><input type="hidden"name="expectedVersion"value={scope?.version??0}/><input type="hidden"name="idempotencyKey"value={key}/><label>{ar?"نطاق التدخل المعتاد بالكيلومتر (اختياري)":"Rayon habituel d’intervention en km (facultatif)"}<Input type="number"name="radiusKm"min={0}step={1}defaultValue={scope?.radiusKm??""}/></label><label>{ar?"حجم المهام التي يمكنكم تنفيذها":"Taille des missions que vous pouvez prendre en charge"}<Textarea name="missionSizeSummary"required minLength={3}maxLength={1000}defaultValue={scope?.missionSizeSummary??""}/></label><label>{ar?"سبب التصريح":"Motif de cette déclaration"}<Textarea name="reason"required minLength={3}maxLength={500}/></label><Button disabled={pending}>{ar?"حفظ التصريح":"Enregistrer la déclaration"}</Button><p role={state.status==="error"?"alert":"status"}>{state.status==="success"?(ar?"حُفظ التصريح.":"Déclaration enregistrée."):state.status==="error"?(ar?"راجعوا المدخلات والصلاحيات، أو حدّثوا النسخة إذا تغيرت.":"Vérifiez la saisie et vos droits, ou actualisez si la version a changé."):""}</p></form></fieldset></section>;
}
