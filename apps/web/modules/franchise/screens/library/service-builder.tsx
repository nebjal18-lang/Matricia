"use client";
import { namespacedCommandUuid } from "@/modules/shared/lib/catalogue-builder/namespaced-command-uuid";
import { editorialFailureMessage } from "./command-errors";

import { useActionState, useId,useRef,useState,type ChangeEvent } from "react";
import{useDraftAutosave,DraftAutosaveControl}from"./use-draft-autosave";
import { ServiceDetailsFields } from "./service-details-fields";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import type { FranchiseCatalogRow, FranchiseLibraryWorkspace,FranchiseServiceCommand } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  createFranchiseServiceAction,
  saveFranchiseServiceDraftAction,
  simulateFranchiseServiceImpactAction,
  submitFranchiseCatalogServiceAction,
  type FranchiseServiceActionState,
} from "./actions";

function useDraftFields(initial:Record<string,string>,locale:Locale){
 const[values,setValues]=useState(initial);const[dirty,setDirty]=useState(false);
 useUnsavedChanges(dirty,locale);
 const field=(name:string)=>({value:values[name]??"",onChange:(event:ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>{setValues(previous=>({...previous,[name]:event.target instanceof HTMLInputElement&&event.target.type==="checkbox"?(event.target.checked?"yes":""):event.target.value}));setDirty(true);}});
 return{field,dirty,setDirty,values};
}

function initialDetails(command?:FranchiseServiceCommand|null){
 const deliverables=Array.isArray(command?.fulfillmentConfig.deliverables)?command.fulfillmentConfig.deliverables:[];
 const labels=(key:string)=>deliverables.flatMap((d:unknown)=>d&&typeof d==="object"&&typeof(d as Record<string,unknown>)[key]==="string"?[(d as Record<string,string>)[key]!]:[]).join("\n");
 return{serviceType:command?.serviceType??"ADVISORY",unitLabelFr:command?.unitLabelFr??"unité",unitLabelAr:command?.unitLabelAr??"وحدة",baseCurrency:command?.baseCurrency??"MAD",sortOrder:String(command?.sortOrder??1),longDescriptionFr:command?.longDescriptionFr??"",longDescriptionAr:command?.longDescriptionAr??"",deliverablesFr:labels("label_fr"),deliverablesAr:labels("label_ar"),fulfillmentConfig:JSON.stringify(command?.fulfillmentConfig??{schema_version:1},null,2),visibilityRules:JSON.stringify(command?.visibilityRules??{schema_version:1},null,2),creditEligible:command?.creditEligible?"yes":"",volumeEligible:command?.volumeEligible?"yes":"",recurringEligible:command?.recurringEligible?"yes":"",trialEligible:command?.trialEligible?"yes":"",rfqRequired:command?(command.rfqRequired?"yes":""):"yes",fixedFulfillmentAllowed:command?.fixedFulfillmentAllowed?"yes":"",sensitive:command?.sensitive?"yes":""};
}

const initialState: FranchiseServiceActionState = { status: "idle" };

export function FranchiseServiceDraftForm({
  locale,
  workspace,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const fields=useDraftFields({...initialDetails(),nameFr:"",nameAr:"",code:"",subcategoryId:workspace.categories.flatMap(c=>c.children)[0]?.id??"",descriptionFr:"",descriptionAr:"",changeReason:""},locale);
  const [state,action,pending]=useActionState(async(previous:FranchiseServiceActionState,data:FormData)=>{let result:FranchiseServiceActionState;try{result=await createFranchiseServiceAction(previous,data);}catch{result={status:"error",reason:"UNAVAILABLE"};}if(result.status==="success")fields.setDirty(false);return result;},initialState);
  const prefix = useId();
  const subcategories = workspace.categories.flatMap((category) => category.children.map((child) => ({ ...child, category: category.title })));
  const error = state.status === "error"
    ? state.reason === "MANDATE_REQUIRED" || state.reason === "UNAUTHENTICATED" ? editorialFailureMessage(state.reason,locale) : state.reason === "VALIDATION" ? (locale === "ar" ? "تحققوا من الحقول الإلزامية بالفرنسية والعربية." : "Complétez les champs obligatoires en FR et AR.")
      : state.reason === "FORBIDDEN" ? c.forbidden
        : c.unavailable
    : null;
  if (subcategories.length === 0) return <p>{c.emptySubcategories}</p>;
  return (
    <form action={action} className="franchise-props-form" aria-describedby={`${prefix}-status`}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="idempotencyKey" defaultValue={commandIdentity.idempotencyKey} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <div>
        <Label htmlFor={`${prefix}-fr`}>{c.servicesTitle} (FR)</Label>
        <Input id={`${prefix}-fr`} name="nameFr" {...fields.field("nameFr")} required maxLength={240} dir="ltr" className="min-h-11" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-ar`}>{c.servicesTitle} (AR)</Label>
        <Input id={`${prefix}-ar`} name="nameAr" {...fields.field("nameAr")} required maxLength={240} dir="rtl" lang="ar" className="min-h-11" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-code`}>{c.technicalKey}</Label>
        <Input id={`${prefix}-code`} name="code" {...fields.field("code")} required pattern="[A-Z][A-Z0-9_-]{1,79}" dir="ltr" className="min-h-11 font-mono" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-sub`}>{c.linked}</Label>
        <select id={`${prefix}-sub`} name="subcategoryId" {...fields.field("subcategoryId")} required className="min-h-11 w-full rounded-md border border-input bg-background px-3">
          {subcategories.map((item) => <option key={item.id} value={item.id}>{item.category} / {item.title}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-desc-fr`}>{locale === "ar" ? "الوصف (FR)" : "Description (FR)"}</Label>
        <Textarea id={`${prefix}-desc-fr`} name="descriptionFr" {...fields.field("descriptionFr")} required maxLength={1000} dir="ltr" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-desc-ar`}>{locale === "ar" ? "الوصف (AR)" : "Description (AR)"}</Label>
        <Textarea id={`${prefix}-desc-ar`} name="descriptionAr" {...fields.field("descriptionAr")} required maxLength={1000} dir="rtl" lang="ar" />
      </div>
      <ServiceDetailsFields fields={fields} locale={locale}/>
      <div>
        <Label htmlFor={`${prefix}-reason`}>{locale === "ar" ? "سبب التغيير" : "Motif de la version"}</Label>
        <Input id={`${prefix}-reason`} name="changeReason" {...fields.field("changeReason")} required minLength={3} maxLength={500} className="min-h-11" />
      </div>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.submitValidation} · {c.scope}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.newService}</Button>
      <div id={`${prefix}-status`} role={error ? "alert" : "status"} aria-live="polite">{error ?? (state.status === "success" ? c.serviceCreated : null)}</div>
    </form>
  );
}

function actionMessage(state: FranchiseServiceActionState, locale: Locale, success: string) {
  const c = libraryCopy(locale);
  if (state.status === "error") {
    if (state.reason === "MANDATE_REQUIRED" || state.reason === "UNAUTHENTICATED") return editorialFailureMessage(state.reason,locale);
    if (state.reason === "VALIDATION") return locale === "ar" ? "تحققوا من الحقول الإلزامية بالفرنسية والعربية." : "Complétez les champs obligatoires en FR et AR.";
    if (state.reason === "FORBIDDEN") return c.forbidden;
    if (state.reason === "CONFLICT") return c.conflict;
    if (state.reason === "LOCKED") return c.locked;
    return c.unavailable;
  }
  if (state.status === "success") return success;
  return null;
}

export function FranchiseServiceCommandForms({
  locale,
  workspace,
  service,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  service: FranchiseCatalogRow;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const command = service.command;
  const fields=useDraftFields({...initialDetails(command),nameFr:service.nameFr??"",nameAr:service.nameAr??"",subcategoryId:service.subcategoryId??"",descriptionFr:command?.descriptionFr??"",descriptionAr:command?.descriptionAr??"",changeReason:locale==="ar"?"تحديث المسودة":"Mise à jour du brouillon"},locale);
  const [saveKey,setSaveKey]=useState(commandIdentity.idempotencyKey);
  const [savedAt,setSavedAt]=useState<string|null>(null);
  const [revision,setRevision]=useState<NonNullable<Extract<FranchiseServiceActionState,{status:"success"}>["command"]>|null>(null);
  const [saveState,saveAction,savePending]=useActionState(async(previous:FranchiseServiceActionState,data:FormData)=>{let result:FranchiseServiceActionState;try{result=await saveFranchiseServiceDraftAction(previous,data);}catch{result={status:"error",reason:"UNAVAILABLE"};}if(result.status==="success"&&result.command){setRevision(result.command);setSaveKey(crypto.randomUUID());setSavedAt(new Date().toISOString());fields.setDirty(false);}return result;},initialState);
  const formRef=useRef<HTMLFormElement>(null);
 const autosave=useDraftAutosave({formRef,dirty:fields.dirty,pending:savePending,signature:JSON.stringify(fields.values),allowed:service.status==="DRAFT",failed:saveState.status==="error"});
  const [simState, simAction, simPending] = useActionState(simulateFranchiseServiceImpactAction, initialState);
  const [submitState, submitAction, submitPending] = useActionState(submitFranchiseCatalogServiceAction, initialState);
  const prefix = useId();
  if (!command) return null;
  const subcategories = workspace.categories.flatMap((category) => category.children.map((child) => ({ ...child, category: category.title })));
  const draft = service.status === "DRAFT";
  const editable = service.status !== "IN_REVIEW";
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="serviceId" value={service.id} />
      <input type="hidden" name="draftVersionId" value={revision?.draftVersionId??command.draftVersionId} />
      <input type="hidden" name="identityRowVersion" value={String(revision?.identityRowVersion??command.identityRowVersion)} />
      <input type="hidden" name="versionRowVersion" value={String(revision?.versionRowVersion??command.versionRowVersion)} />
    </>
  );
  return (
    <div className="franchise-command-stack">
      <form ref={formRef} id={`${prefix}-save`} action={saveAction} className="franchise-props-form" aria-describedby={`${prefix}-save-status`}>
        <fieldset disabled={savePending} className="space-y-3"><DraftAutosaveControl autosave={autosave} locale={locale}/>{hidden}
        <input type="hidden" name="idempotencyKey" value={saveKey} />
        <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
        <input type="hidden" name="code" value={service.code} />
        <div>
          <Label htmlFor={`${prefix}-fr`}>{c.labelFr}</Label>
          <Input id={`${prefix}-fr`} name="nameFr" required maxLength={240} dir="ltr" className="min-h-11" {...fields.field("nameFr")} readOnly={!editable} />
        </div>
        <div>
          <Label htmlFor={`${prefix}-ar`}>{c.labelAr}</Label>
          <Input id={`${prefix}-ar`} name="nameAr" required maxLength={240} dir="rtl" lang="ar" className="min-h-11" {...fields.field("nameAr")} readOnly={!editable} />
        </div>
        <div>
          <Label htmlFor={`${prefix}-sub`}>{c.linked}</Label>
          <select id={`${prefix}-sub`} name="subcategoryId" required className="min-h-11 w-full rounded-md border border-input bg-background px-3" {...fields.field("subcategoryId")} disabled={!editable}>
            {subcategories.map((item) => <option key={item.id} value={item.id}>{item.category} / {item.title}</option>)}
          </select>
          {!editable ? <input type="hidden" name="subcategoryId" value={service.subcategoryId ?? ""} /> : null}
        </div>
        <div>
          <Label htmlFor={`${prefix}-desc-fr`}>{c.helpFr}</Label>
          <Textarea id={`${prefix}-desc-fr`} name="descriptionFr" required maxLength={1000} dir="ltr" {...fields.field("descriptionFr")} readOnly={!editable} />
        </div>
        <div>
          <Label htmlFor={`${prefix}-desc-ar`}>{c.helpAr}</Label>
          <Textarea id={`${prefix}-desc-ar`} name="descriptionAr" required maxLength={1000} dir="rtl" lang="ar" {...fields.field("descriptionAr")} readOnly={!editable} />
        </div>
        <ServiceDetailsFields fields={fields} locale={locale} editable={editable}/>
        <div>
          <Label htmlFor={`${prefix}-reason`}>{locale === "ar" ? "سبب التغيير" : "Motif de la version"}</Label>
          <Input id={`${prefix}-reason`} name="changeReason" required minLength={3} maxLength={500} className="min-h-11" {...fields.field("changeReason")} />
        </div>
        {editable ? <Button type="submit" disabled={savePending} className="min-h-11">{c.saveDraft}</Button> : null}
        <div id={`${prefix}-save-status`} role={saveState.status === "error" ? "alert" : "status"} aria-live="polite">{savePending?(locale==="ar"?"جارٍ الحفظ في الخادم…":"Enregistrement en cours sur le serveur…"):saveState.status==="error"?actionMessage(saveState,locale,c.serviceSaved):fields.dirty?(locale==="ar"?"تغييرات غير محفوظة":"Modifications non enregistrées"):actionMessage(saveState,locale,c.serviceSaved)} {savedAt&&!fields.dirty?<time dateTime={savedAt}>{new Intl.DateTimeFormat(locale==="ar"?"ar-MA":"fr-MA",{timeStyle:"medium"}).format(new Date(savedAt))}</time>:null}</div>
              </fieldset>
      </form>
      <form action={simAction} className="franchise-props-form">
        {hidden}
        <input type="hidden" name="idempotencyKey" value={namespacedCommandUuid(saveKey, "service-impact")} />
        <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
        <Button type="submit" disabled={simPending} className="min-h-11" variant="outline">{c.runSimulation}</Button>
        <div role={simState.status === "error" ? "alert" : "status"} aria-live="polite">{actionMessage(simState, locale, c.impactSimulated)}</div>
      </form>
      {draft ? (
        <form action={submitAction} className="franchise-props-form">
          {hidden}
          <input type="hidden" name="idempotencyKey" value={namespacedCommandUuid(saveKey, "service-submit")} />
          <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
          <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
            <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
            <span>{c.submitMatricia} · {c.scope}</span>
          </label>
          <Button type="submit" disabled={submitPending} className="min-h-11">{c.submitMatricia}</Button>
          <div role={submitState.status === "error" ? "alert" : "status"} aria-live="polite">{actionMessage(submitState, locale, c.serviceSubmitted)}</div>
        </form>
      ) : service.status === "APPROVED" ? (
        <p className="client-access-note">{c.publishSnapshot} · {c.publishedImmutable}</p>
      ) : <p className="client-access-note">{service.status === "PUBLISHED" ? c.publishedImmutable : c.locked}</p>}
    </div>
  );
}
