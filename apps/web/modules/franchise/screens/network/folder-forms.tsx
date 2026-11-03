"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { ACTIVITY_TYPES, nextPipelineStage, PIPELINE_STAGES, type PipelineStage } from "@/modules/franchise/data/crm/model";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { franchiseStageLabel } from "@/modules/franchise/data/spaces/labels";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { advanceFranchiseFolderPipeline, recordFranchiseFolderActivity, linkFranchiseProviderOrganization, type FranchiseInviteState } from "./actions";
import { canMutateFranchiseFolder } from "./folder-guards";

export { canMutateFranchiseFolder };

const idle: FranchiseInviteState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border border-input bg-background px-3";

const activityLabels = {
  fr: { CALL: "Appel", EMAIL: "Courriel", MEETING: "Réunion", NOTE: "Note", FOLLOW_UP: "Relance", INVITATION: "Invitation" },
  ar: { CALL: "مكالمة", EMAIL: "بريد", MEETING: "اجتماع", NOTE: "ملاحظة", FOLLOW_UP: "متابعة", INVITATION: "دعوة" },
} as const;

const reasonOptions = {
  fr: [
    { value: "CONTACT_CONFIRMED", label: "Contact confirmé" },
    { value: "INFORMATION_COMPLETED", label: "Informations complétées" },
    { value: "ELIGIBILITY_CONFIRMED", label: "Éligibilité confirmée" },
    { value: "PROSPECT_AGREEMENT", label: "Accord du prospect" },
  ],
  ar: [
    { value: "CONTACT_CONFIRMED", label: "تم تأكيد التواصل" },
    { value: "INFORMATION_COMPLETED", label: "اكتملت المعلومات" },
    { value: "ELIGIBILITY_CONFIRMED", label: "تم تأكيد الأهلية" },
    { value: "PROSPECT_AGREEMENT", label: "موافقة العميل المحتمل" },
  ],
} as const;

function Feedback({ state, locale, success }: { state: FranchiseInviteState; locale: Locale; success: string }) {
  const c = franchiseCopy(locale);
  const value = state.status === "success"
    ? success
    : state.status === "error"
      ? state.reason === "VALIDATION" ? c.folderInvalid
        : state.reason === "FORBIDDEN" ? c.folderForbidden
          : state.reason === "CONFLICT" ? c.folderConflict
            : c.folderFailed
      : "";
  return <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{value}</p>;
}

export function FranchiseFolderActivityForm({
  locale,
  organizationId,
  prospectId,
  defaultType = "NOTE",
}: {
  locale: Locale;
  organizationId?: string | null;
  prospectId: string;
  defaultType?: (typeof ACTIVITY_TYPES)[number];
}) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (previous: FranchiseInviteState, data: FormData) => {
    const result = await recordFranchiseFolderActivity(previous, data);
    if (result.status === "success") setKey(crypto.randomUUID());
    return result;
  }, idle);
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="prospectId" value={prospectId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <div>
        <Label htmlFor={`${prefix}-type`}>{c.activityType}</Label>
        <select id={`${prefix}-type`} name="activityType" defaultValue={defaultType} className={control}>
          {ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{activityLabels[locale][type]}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-at`}>{c.occurredAt}</Label>
        <Input id={`${prefix}-at`} name="occurredAt" type="datetime-local" required className={control} />
      </div>
      <div>
        <Label htmlFor={`${prefix}-summary`}>{c.activitySummary}</Label>
        <textarea id={`${prefix}-summary`} name="summary" required minLength={3} maxLength={2000} className={`${control} min-h-24 py-2`} />
      </div>
      <div>
        <Label htmlFor={`${prefix}-evidence`}>{c.evidenceRef}</Label>
        <Input id={`${prefix}-evidence`} name="evidenceReference" maxLength={500} className={control} />
      </div>
      <div>
        <Label htmlFor={`${prefix}-followup`}>{c.inviteFollowup}</Label>
        <Input id={`${prefix}-followup`} name="nextFollowupAt" type="datetime-local" className={control} />
      </div>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.recordActivity}</Button>
      <Feedback state={state} locale={locale} success={c.activitySaved} />
    </form>
  );
}

export function FranchiseFolderAdvanceForm({
  locale,
  organizationId,
  prospectId,
  stage,
  rowVersion,
}: {
  locale: Locale;
  organizationId?: string | null;
  prospectId: string;
  stage: string;
  rowVersion: number;
}) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const next = PIPELINE_STAGES.includes(stage as PipelineStage) ? nextPipelineStage(stage as PipelineStage) : null;
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (previous: FranchiseInviteState, data: FormData) => {
    const result = await advanceFranchiseFolderPipeline(previous, data);
    if (result.status === "success") setKey(crypto.randomUUID());
    return result;
  }, idle);
  if (!next) return <p className="client-access-note">{c.pipelineComplete}</p>;
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="prospectId" value={prospectId} />
      <input type="hidden" name="toStage" value={next} />
      <input type="hidden" name="rowVersion" value={String(rowVersion)} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <p>{c.nextStage}: <strong>{franchiseStageLabel(next, locale)}</strong></p>
      <div>
        <Label htmlFor={`${prefix}-reason`}>{c.reasonCode}</Label>
        <select id={`${prefix}-reason`} name="reasonCode" className={control}>
          {reasonOptions[locale].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-evidence`}>{c.evidenceRef}</Label>
        <Input id={`${prefix}-evidence`} name="evidenceReference" maxLength={500} className={control} />
      </div>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.advanceStage}</Button>
      <Feedback state={state} locale={locale} success={c.pipelineAdvanced} />
    </form>
  );
}

export function FranchiseFolderTimeline({
  locale,
  activities,
  events,
}: {
  locale: Locale;
  activities?: Array<{ id: string; type: string; occurredAt: string; summary: string; evidence: string[] }>;
  events?: Array<{ id: string; from: string | null; to: string; reasonCode: string; occurredAt: string; evidence: string[] }>;
}) {
  const c = franchiseCopy(locale);
  const stamp = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
  };
  return (
    <>
      {events?.length ? (
        <ol className="franchise-activity">
          {events.map((event) => (
            <li key={event.id}>
              <span className="franchise-dot" data-tone="violet" />
              <span>
                <strong>{franchiseStageLabel(event.from ?? "SENT", locale)} → {franchiseStageLabel(event.to, locale)}</strong>
                <small>{event.reasonCode} · {stamp(event.occurredAt)}</small>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {activities?.length ? (
        <ul className="client-feed">
          {activities.map((activity) => (
            <li key={activity.id}>
              <span>
                <strong>{activityLabels[locale][activity.type as keyof typeof activityLabels.fr] ?? activity.type}</strong>
                <small>{activity.summary}</small>
                <small>{stamp(activity.occurredAt)}</small>
                {activity.evidence.length ? <small>{activity.evidence.join(" · ")}</small> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!events?.length && !activities?.length ? <p className="franchise-empty-panel">{c.consultationEmpty}</p> : null}
    </>
  );
}

export function FranchiseProviderLinkForm({locale,prospectId,rowVersion,organizationId,options}:{locale:Locale;prospectId:string;rowVersion:number;organizationId:string|null;options:Array<{organizationId:string;name:string}>}){
 const ar=locale==="ar";const[key,setKey]=useState(()=>crypto.randomUUID());const[state,action,pending]=useActionState(async(previous:FranchiseInviteState,form:FormData)=>{const result=await linkFranchiseProviderOrganization(previous,form);if(result.status==="success")setKey(crypto.randomUUID());return result;},idle);
 return <form action={action} className="franchise-props-form"><h3>{ar?"ربط الملف بمنظمة مقدم الخدمة":"Relier ce dossier à l’organisation prestataire"}</h3><p>{ar?"اختاروا المنظمة المؤكدة. لن يتم الربط بالاسم أو البريد تلقائياً.":"Choisissez l’organisation confirmée. Le nom et le courriel ne créent aucun rapprochement automatique."}</p><input type="hidden" name="locale" value={locale}/><input type="hidden" name="organizationId" value={organizationId??""}/><input type="hidden" name="prospectId" value={prospectId}/><input type="hidden" name="rowVersion" value={rowVersion}/><input type="hidden" name="idempotencyKey" value={key}/><fieldset disabled={pending||options.length===0}><label className="franchise-field">{ar?"المنظمة":"Organisation"}<select name="providerOrganizationId" required>{options.map((o)=><option key={o.organizationId} value={o.organizationId}>{o.name} · {o.organizationId.slice(0,8).toUpperCase()}</option>)}</select></label><label className="franchise-field">{ar?"دليل التحقق من الربط":"Motif et preuve du rapprochement"}<input name="reason" required minLength={3} maxLength={500}/></label><Button type="submit" disabled={pending}>{ar?"حفظ الربط الصريح":"Enregistrer le lien explicite"}</Button></fieldset><Feedback state={state} locale={locale} success={ar?"حُفظ الربط في الخادم":"Lien enregistré sur le serveur"}/></form>;
}
