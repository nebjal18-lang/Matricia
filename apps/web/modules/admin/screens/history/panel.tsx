"use client";
import{useState,useTransition}from"react";
import type{Locale}from"@/modules/shared/lib/i18n/locale";
import{loadAdminHistoryPage}from"./actions";
import type{AdminHistoryPage}from"./model";
export function AdminDecisionHistory({resourceId,organizationId,locale,initial}:{resourceId:string;organizationId?:string;locale:Locale;initial?:AdminHistoryPage|null}){
 const[page,setPage]=useState(initial);const[error,setError]=useState(!initial);const[pending,start]=useTransition();const ar=locale==="ar";
 const older=()=>start(async()=>{const r=await loadAdminHistoryPage(resourceId,organizationId,page?.nextBefore);if(r.status==="error"){setError(true);return;}setError(false);setPage({...r.page,events:[...r.page.events,...(page?.events??[])]});});
 return <div>{error?<p role="alert">{ar?"تعذر تحميل السجل ضمن صلاحياتكم.":"Historique indisponible avec vos droits."}</p>:null}{page?.hasMore?<button disabled={pending}onClick={older}>{ar?"تحميل القرارات السابقة":"Charger les décisions précédentes"}</button>:null}<ol className="admin-cycle">{page?.events.map(e=><li key={e.id}><div><strong>{e.action}</strong><small>{e.occurredAt} · {e.actorLabel??e.actorType}{e.reason?` · ${e.reason}`:""}</small></div></li>)}{page&&!page.events.length?<li>{ar?"لا يوجد قرار مسجل لهذا الملف.":"Aucune décision enregistrée pour ce dossier."}</li>:null}</ol></div>;
}
