"use client";
import{useEffect,useRef,useState,type RefObject}from"react";
/** Schedule one attempt for an exact valid draft. Failed/uncertain writes require an explicit retry. */
export function scheduleDraftSave(form:Pick<HTMLFormElement,"checkValidity"|"requestSubmit">,attempt:()=>void,delay=2000){const timer=setTimeout(()=>{if(form.checkValidity()){attempt();form.requestSubmit();}},delay);return()=>clearTimeout(timer);}
export function useDraftAutosave({formRef,dirty,pending,signature,allowed,failed}:{formRef:RefObject<HTMLFormElement|null>;dirty:boolean;pending:boolean;signature:string;allowed:boolean;failed:boolean}){
 const lastAttempt=useRef<string|null>(null);const[enabled,setEnabled]=useState(true);
 useEffect(()=>{if(!allowed||!enabled||!dirty||pending||failed||lastAttempt.current===signature||!formRef.current)return;return scheduleDraftSave(formRef.current,()=>{lastAttempt.current=signature;});},[formRef,allowed,enabled,dirty,pending,failed,signature]);
 return{enabled,setEnabled,allowed,failed};
}
export function DraftAutosaveControl({autosave,locale}:{autosave:ReturnType<typeof useDraftAutosave>;locale:"fr"|"ar"}){if(!autosave.allowed)return null;const ar=locale==="ar";return<div className="space-y-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={autosave.enabled} onChange={e=>autosave.setEnabled(e.target.checked)}/>{ar?"حفظ المسودة تلقائياً":"Enregistrer automatiquement le brouillon"}</label>{autosave.failed?<p role="status">{ar?"توقف الحفظ التلقائي بعد خطأ. راجعوا الرسالة ثم أعيدوا المحاولة بزر الحفظ.":"L’enregistrement automatique est suspendu après une erreur. Consultez le message puis réessayez avec le bouton Enregistrer."}</p>:autosave.enabled?<p className="client-access-note">{ar?"تُحفظ التعديلات المكتملة بعد توقف الكتابة. يبقى الإرسال للمراجعة إجراءً منفصلاً.":"Les modifications complètes sont enregistrées après une pause de saisie. L’envoi en revue reste une action distincte."}</p>:null}</div>;}
