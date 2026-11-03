"use client";
import { editorialFailureMessage } from "./command-errors";
import{useDraftAutosave,DraftAutosaveControl}from"./use-draft-autosave";
import{CatalogBankSearch}from"./bank-search";
import { useActionState, useRef, useState } from "react";
import type { FranchiseCatalogRow, FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { FranchiseVisualRuleControls } from "./rule-controls";
import { saveFranchiseRuleAction, type RuleEditorState } from "./rule-editor-actions";

export function FranchiseRuleEditor({locale,workspace,selected,organizationId}:{locale:"fr"|"ar";workspace:FranchiseLibraryWorkspace;selected:FranchiseCatalogRow|null;organizationId:string|null}){
 const ar=locale==="ar";
 const [payload,setPayload]=useState(()=>JSON.stringify(selected?.rulePayload??{condition_ast:{group:"AND",conditions:[]},actions:[],dependency_graph:{},priority:100,sensitive:false},null,2));
 const [key,setKey]=useState(()=>crypto.randomUUID());
 const [dirty,setDirty]=useState(false);
 const [savedAt,setSavedAt]=useState<string|null>(null);
 const [ruleKey,setRuleKey]=useState(selected?.code??"");const[reason,setReason]=useState("");
 useUnsavedChanges(dirty,locale);
 const[revision,setRevision]=useState({ruleId:selected?.id??"",versionId:selected?.draftVersionId??"",identityRowVersion:selected?.identityRowVersion??1,versionRowVersion:selected?.versionRowVersion??1});
 const [state,action,pending]=useActionState(async(previous:RuleEditorState,form:FormData)=>{let result:RuleEditorState;try{result=await saveFranchiseRuleAction(previous,form);}catch{result={status:"error",reason:"UNAVAILABLE"};}if(result.status==="success"){setRevision(result);setKey(crypto.randomUUID());setDirty(false);setSavedAt(new Date().toISOString());}return result;},{status:"idle"}as RuleEditorState);
 const[bank,setBank]=useState((workspace.questionVersionBank??[]).filter((q)=>["DRAFT","APPROVED","PUBLISHED"].includes(q.status)));
 const formRef=useRef<HTMLFormElement>(null);
 const autosave=useDraftAutosave({formRef,dirty,pending,signature:JSON.stringify({payload,ruleKey,reason}),allowed:selected?.status==="DRAFT"||state.status==="success",failed:state.status==="error"});
 return <form ref={formRef} action={action} className="client-card space-y-4">
  <h2>{ar?"شروط القاعدة وإجراءاتها":"Conditions et actions de la règle"}</h2>
  <p>{ar?"تُحفظ كل مراجعة كمسودة مستقلة. تُراجع المراجع والإجراءات في الخادم قبل الحفظ. يمكن تحرير المجموعات AND وOR والمقارنات والأوزان في تعريف القاعدة.":"Chaque révision crée un brouillon distinct. Les références et les actions sont validées avant l’enregistrement. Le contrat permet les groupes AND/OR, comparaisons, scores et dépendances."}</p>
  <DraftAutosaveControl autosave={autosave} locale={locale}/><input type="hidden" name="locale" value={locale}/><input type="hidden" name="organizationId" value={organizationId??""}/><input type="hidden" name="libraryId" value={workspace.mandate.libraryId}/><input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId}/><input type="hidden" name="ruleId" value={revision.ruleId}/><input type="hidden" name="versionId" value={revision.versionId}/><input type="hidden" name="identityRowVersion" value={revision.identityRowVersion}/><input type="hidden" name="versionRowVersion" value={revision.versionRowVersion}/><input type="hidden" name="idempotencyKey" value={key}/>
  <fieldset disabled={pending} className="space-y-4">
   <label className="franchise-field">{ar?"رمز القاعدة":"Code de la règle"}<input name="ruleKey" value={ruleKey} onChange={(e)=>{setRuleKey(e.target.value);setDirty(true);}} required pattern="[A-Z][A-Z0-9_.-]{1,119}" maxLength={120} dir="ltr" readOnly={!!revision.ruleId}/></label>
   <CatalogBankSearch franchiseId={workspace.mandate.franchiseId} kind="QUESTION" ar={ar} onResults={items=>setBank(previous=>[...previous.filter(q=>!items.some(i=>i.id===q.id)),...items.map(i=>({id:i.id,questionId:i.objectId,labelFr:i.labelFr,labelAr:i.labelAr,answerType:i.answerType??"SHORT_TEXT",status:i.status}))])}/><FranchiseVisualRuleControls raw={payload} bank={bank} ar={ar} onChange={(value)=>{setPayload(value);setDirty(true);}}/>
   <details><summary>{ar?"تعريف تقني متقدم":"Définition technique avancée"}</summary><label className="franchise-field">{ar?"العقد الكامل للقاعدة":"Contrat complet de la règle"}<textarea name="payload" value={payload} onChange={(e)=>{setPayload(e.target.value);setDirty(true);}} rows={20} required maxLength={262144} dir="ltr" spellCheck={false} className="w-full rounded-lg border p-3 font-mono"/></label></details>
   <details><summary>{ar?"مرجع العقد":"Référence du contrat"}</summary><p>{ar?"العقد: condition_ast وactions وdependency_graph وpriority وsensitive. المقارنة: operator وquestion_version_id وvalue. المجموعات: group وconditions.":"Contrat : condition_ast, actions, dependency_graph, priority, sensitive. Comparaison : operator, question_version_id, value. Groupe : group, conditions. Opérateurs : EQ, NEQ, GT, GTE, LT, LTE, IN, CONTAINS, EMPTY, NOT_EMPTY, REGEX, DATE_BEFORE, DATE_AFTER, CHANGED. Actions : SHOW, HIDE, REQUIRED, OPTIONAL, SCORE, ANOMALY, RISK, RECOMMENDATION, OPPORTUNITY, SOLUTION_LEVEL, REQUIRE_DOCUMENT, HUMAN_REVIEW, BLOCK_PUBLICATION, BLOCK_RFQ, SUGGEST_SERVICE, START_CHILD_DIAGNOSTIC, SET_VALIDITY_DAYS."}</p></details>
   <label className="franchise-field">{ar?"سبب التعديل":"Motif de la révision"}<input name="changeReason" value={reason} onChange={(e)=>{setReason(e.target.value);setDirty(true);}} required minLength={3} maxLength={500}/></label>
   <button className="franchise-tool franchise-tool-primary" type="submit">{pending?(ar?"جارٍ الحفظ…":"Enregistrement…"):(ar?"حفظ المسودة":"Enregistrer le brouillon")}</button>
  </fieldset>
  <p role={state.status==="error"?"alert":"status"}>{state.status==="error"?editorialFailureMessage(state.reason,locale):dirty?(ar?"تغييرات غير محفوظة":"Modifications non enregistrées"):state.status==="success"?(ar?"تم حفظ مسودة مستقلة في الخادم":"Un nouveau brouillon a été enregistré sur le serveur"):null}</p>
 {savedAt&&!dirty?<time dateTime={savedAt}>{new Intl.DateTimeFormat(ar?"ar-MA":"fr-MA",{timeStyle:"medium"}).format(new Date(savedAt))}</time>:null}
 </form>;
}
