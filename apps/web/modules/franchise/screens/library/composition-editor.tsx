"use client";
import{useDraftAutosave,DraftAutosaveControl}from"./use-draft-autosave";
import{CatalogBankSearch}from"./bank-search";
import { useActionState, useRef, useState, type SetStateAction } from "react";
import{catalogStatusLabel}from"@/modules/franchise/data/library/workspace-model";
import type { FranchiseCatalogRow, FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { saveFranchiseCompositionAction, type CompositionState } from "./composition-actions";

type Section = { key: string; labelFr: string; labelAr: string;helpFr?:string;helpAr?:string };
type Question = { versionId: string; sectionKey: string; required: boolean };
export function QuestionnaireCompositionEditor({ workspace, selected, locale, organizationId }: {
 workspace: FranchiseLibraryWorkspace; selected: FranchiseCatalogRow; locale: "fr" | "ar"; organizationId: string | null;
}) {
 const ar=locale==="ar";const versionId=selected.draftVersionId ?? selected.questionnaireVersionId ?? "";
 const initialSections=(workspace.compositionSections ?? []).filter((s)=>s.versionId===versionId);
 const [sections,updateSections]=useState<Section[]>(initialSections.length?initialSections:[{key:"GENERAL",labelFr:"Questions générales",labelAr:"أسئلة عامة"}]);
 const [questions,updateQuestions]=useState<Question[]>((workspace.compositionQuestions ?? []).filter((q)=>q.versionId===versionId).sort((a,b)=>a.sortOrder-b.sortOrder).map((q)=>({versionId:q.questionVersionId,sectionKey:q.sectionKey,required:q.required})));
 const [dirty,setDirty]=useState(false);
 const [savedAt,setSavedAt]=useState<string|null>(null);
 useUnsavedChanges(dirty,locale);
 const [rules,setRules]=useState<string[]>((workspace.compositionRules??[]).filter((r)=>r.versionId===versionId).sort((a,b)=>a.order-b.order).map((r)=>r.ruleVersionId));
 function setSections(value:SetStateAction<Section[]>){setDirty(true);updateSections(value);}
 function setQuestions(value:SetStateAction<Question[]>){setDirty(true);updateQuestions(value);}
 const [search,setSearch]=useState(""); const [key,setKey]=useState(()=>crypto.randomUUID());
 const[rowVersion,setRowVersion]=useState(selected.versionRowVersion??1);
 const [state,action,pending]=useActionState(async(previous:CompositionState,data:FormData)=>{let result:CompositionState;try{result=await saveFranchiseCompositionAction(previous,data);}catch{result={status:"error",reason:"UNAVAILABLE"};}if(result.status==="success"){setRowVersion(result.rowVersion);setKey(crypto.randomUUID());setDirty(false);setSavedAt(new Date().toISOString());}return result;},{status:"idle"}as CompositionState);
 const[bank,setBank]=useState((workspace.questionVersionBank ?? []).filter((q)=>["DRAFT","APPROVED","PUBLISHED"].includes(q.status)));
 const[ruleBank,setRuleBank]=useState(workspace.ruleVersionBank??[]);
 const label=(id:string)=>{const q=bank.find((q)=>q.id===id);return q?(ar?q.labelAr:q.labelFr):(ar?"نسخة محفوظة غير متاحة":"Version conservée indisponible");};
 const editable=selected.status==="DRAFT";
 const formRef=useRef<HTMLFormElement>(null);
 const autosave=useDraftAutosave({formRef,dirty,pending,signature:JSON.stringify({sections,questions,rules}),allowed:editable,failed:state.status==="error"});
 function move(index:number,delta:number){setQuestions((rows)=>{const next=[...rows];const to=index+delta;if(to<0||to>=next.length)return rows;[next[index],next[to]]=[next[to]!,next[index]!];return next;});}
 return <form ref={formRef} action={action} className="client-card space-y-5">
  <h2>{ar?"تركيب الاستبيان وإصداره":"Composition et version du questionnaire"}</h2>
  <p>{ar?"يُحفظ الترتيب والمحتوى في الخادم. الإصدارات المنشورة غير قابلة للتعديل.":"L’ordre et la composition sont enregistrés sur le serveur. Les versions publiées restent immuables."}</p>
  <DraftAutosaveControl autosave={autosave} locale={locale}/><input type="hidden" name="locale" value={locale}/><input type="hidden" name="organizationId" value={organizationId??""}/><input type="hidden" name="libraryId" value={workspace.mandate.libraryId}/><input type="hidden" name="versionId" value={versionId}/><input type="hidden" name="expectedRowVersion" value={rowVersion}/><input type="hidden" name="idempotencyKey" value={key}/><input type="hidden" name="sections" value={JSON.stringify(sections)}/><input type="hidden" name="questions" value={JSON.stringify(questions)}/><input type="hidden" name="rules" value={JSON.stringify(rules)}/>
  <fieldset disabled={!editable||pending} className="space-y-4"><legend>{ar?"الأقسام والأسئلة":"Sections et questions"}</legend>
   {sections.map((section,index)=><div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
    <label>{ar?"رمز القسم":"Code de section"}<input required value={section.key} pattern="[A-Z][A-Z0-9_-]{1,79}" dir="ltr" onChange={(e)=>{const value=e.target.value;setSections((rows)=>rows.map((s,i)=>i===index?{...s,key:value}:s));setQuestions((rows)=>rows.map((q)=>q.sectionKey===section.key?{...q,sectionKey:value}:q));}} className="min-h-11 w-full rounded border px-3"/></label>
    <label>Français<input required maxLength={240} value={section.labelFr} onChange={(e)=>setSections((rows)=>rows.map((s,i)=>i===index?{...s,labelFr:e.target.value}:s))} className="min-h-11 w-full rounded border px-3"/></label>
    <label>العربية<input required dir="rtl" maxLength={240} value={section.labelAr} onChange={(e)=>setSections((rows)=>rows.map((s,i)=>i===index?{...s,labelAr:e.target.value}:s))} className="min-h-11 w-full rounded border px-3"/></label>
   </div>)}
   <button type="button" className="franchise-tool" onClick={()=>setSections((rows)=>[...rows,{key:`SECTION_${rows.length+1}`,labelFr:"Nouvelle section",labelAr:"قسم جديد"}])}>{ar?"إضافة قسم":"Ajouter une section"}</button>
   <CatalogBankSearch franchiseId={workspace.mandate.franchiseId} kind="QUESTION" ar={ar} onResults={items=>setBank(previous=>[...previous.filter(q=>!items.some(i=>i.id===q.id)),...items.map(i=>({id:i.id,questionId:i.objectId,labelFr:i.labelFr,labelAr:i.labelAr,answerType:i.answerType??"SHORT_TEXT",status:i.status}))])}/><ol className="space-y-3">{questions.map((q,index)=><li key={q.versionId} className="rounded-lg border p-3"><strong>{index+1}. {label(q.versionId)}</strong><div className="mt-3 flex flex-wrap gap-3">
    <label>{ar?"القسم":"Section"}<select value={q.sectionKey} onChange={(e)=>setQuestions((rows)=>rows.map((item,i)=>i===index?{...item,sectionKey:e.target.value}:item))} className="min-h-11 rounded border px-3">{sections.map((s)=><option key={s.key} value={s.key}>{ar?s.labelAr:s.labelFr}</option>)}</select></label>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={q.required} onChange={(e)=>setQuestions((rows)=>rows.map((item,i)=>i===index?{...item,required:e.target.checked}:item))}/>{ar?"إلزامي":"Obligatoire"}</label>
    <button type="button" className="franchise-tool" disabled={index===0} onClick={()=>move(index,-1)}>{ar?"رفع":"Monter"}</button><button type="button" className="franchise-tool" disabled={index===questions.length-1} onClick={()=>move(index,1)}>{ar?"خفض":"Descendre"}</button><button type="button" className="franchise-tool" onClick={()=>setQuestions((rows)=>rows.filter((item)=>item.versionId!==q.versionId))}>{ar?"إزالة من هذا الإصدار":"Retirer de cette version"}</button>
   </div></li>)}</ol>
   <label>{ar?"تصفية المراجع المحملة":"Filtrer les références déjà chargées"}<input value={search} onChange={(e)=>setSearch(e.target.value)} className="min-h-11 w-full rounded border px-3"/></label>
   <ul className="max-h-80 overflow-y-auto">{bank.filter((q)=>!questions.some((item)=>bank.find((b)=>b.id===item.versionId)?.questionId===q.questionId)&&`${q.labelFr} ${q.labelAr}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((q)=><li key={q.id} className="flex items-center justify-between gap-3 border-b py-2"><span>{ar?q.labelAr:q.labelFr} · {catalogStatusLabel(q.status,locale)}</span><button type="button" className="franchise-tool" onClick={()=>setQuestions((rows)=>[...rows,{versionId:q.id,sectionKey:sections[0]!.key,required:true}])}>{ar?"إضافة":"Ajouter"}</button></li>)}</ul>
   <section className="space-y-3"><h3>{ar?"قواعد هذا الإصدار حسب ترتيب التنفيذ":"Règles de cette version dans l’ordre d’exécution"}</h3>
    <CatalogBankSearch franchiseId={workspace.mandate.franchiseId} kind="RULE" ar={ar} onResults={items=>setRuleBank(previous=>[...previous.filter(q=>!items.some(i=>i.id===q.id)),...items.map(i=>({id:i.id,title:i.code,status:i.status,version:i.version}))])}/><ol>{rules.map((id,index)=><li key={id} className="flex flex-wrap items-center gap-3 border-b py-2"><strong>{ruleBank.find((r)=>r.id===id)?.title??(ar?"نسخة محفوظة غير متاحة":"Version conservée indisponible")}</strong><button type="button" disabled={index===0} className="franchise-tool" onClick={()=>{const next=[...rules];[next[index-1],next[index]]=[next[index]!,next[index-1]!];setRules(next);setDirty(true);}}>{ar?"رفع":"Monter"}</button><button type="button" className="franchise-tool" onClick={()=>{setRules(rules.filter((r)=>r!==id));setDirty(true);}}>{ar?"إزالة":"Retirer"}</button></li>)}</ol>
    <ul>{ruleBank.filter((r)=>["DRAFT","APPROVED","PUBLISHED"].includes(r.status)&&!rules.includes(r.id)).map((r)=><li key={r.id} className="flex items-center justify-between gap-3 border-b py-2"><span>{r.title} · v{r.version} · {catalogStatusLabel(r.status,locale)}</span><button type="button" className="franchise-tool" onClick={()=>{setRules([...rules,r.id]);setDirty(true);}}>{ar?"إضافة":"Ajouter"}</button></li>)}</ul>
   </section>
   <button type="submit" className="franchise-tool franchise-tool-primary" disabled={pending}>{pending?(ar?"جارٍ الحفظ…":"Enregistrement…"):(ar?"حفظ التركيب":"Enregistrer la composition")}</button>
  </fieldset>
  {!editable?<p role="status">{ar?"هذه نسخة ثابتة. أنشئوا مسودة جديدة قبل التعديل.":"Cette version est figée. Créez une nouvelle version brouillon avant de modifier sa composition."}</p>:null}
  {state.status==="error"?<p role="alert">{state.reason==="CONFLICT"?(ar?"تغير الإصدار. أعيدوا تحميله قبل المحاولة.":"La version a changé. Rechargez-la avant de réessayer."):(ar?"تعذر الحفظ. بقيت تعديلاتكم في الشاشة.":"Enregistrement impossible. Vos modifications restent dans cet écran.")}</p>:null}
  {pending?<p role="status">{ar?"جارٍ الحفظ في الخادم…":"Enregistrement en cours sur le serveur…"}</p>:dirty?<p role="status">{ar?"تعديلات غير محفوظة":"Modifications non enregistrées"}</p>:state.status==="success"?<p role="status">{ar?"تم الحفظ في الخادم":"Composition enregistrée sur le serveur"} {savedAt?<time dateTime={savedAt}>{new Intl.DateTimeFormat(ar?"ar-MA":"fr-MA",{timeStyle:"medium"}).format(new Date(savedAt))}</time>:null}</p>:null}

 </form>;
}
