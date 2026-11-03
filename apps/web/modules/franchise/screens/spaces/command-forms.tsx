"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  decideFranchiseProviderQualification,
  instructFranchiseDispute,
  inviteFranchiseMandateMember,
  proposeFranchiseVolumePurchase,
  upsertFranchiseAnomalyDefinition,
  upsertFranchiseRecommendationDefinition,
  upsertFranchiseRiskDefinition,
  type FranchiseCommandState,
} from "./commands";

const idle: FranchiseCommandState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border border-input bg-background px-3";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Feedback({ state, locale, success }: { state: FranchiseCommandState; locale: Locale; success: string }) {
  const c = franchiseCopy(locale);
  const value = state.status === "success"
    ? success
    : state.status === "error"
      ? state.reason === "VALIDATION" ? c.commandInvalid
        : state.reason === "FORBIDDEN" ? c.commandForbidden
          : state.reason === "CONFLICT" ? c.commandConflict
            : state.reason === "UNAUTHENTICATED" ? c.commandForbidden
              : c.commandFailed
      : "";
  return <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{value}</p>;
}

type CommandKeys = { idempotencyKey: string; correlationId: string };

function useCommand(command: (state: FranchiseCommandState, data: FormData) => Promise<FranchiseCommandState>) {
  const [keys, setKeys] = useState<CommandKeys>(() => ({ idempotencyKey: crypto.randomUUID(), correlationId: crypto.randomUUID() }));
  const [state, action, pending] = useActionState(async (previous: FranchiseCommandState, data: FormData) => {
    const result = await command(previous, data);
    if (result.status === "success") setKeys({ idempotencyKey: crypto.randomUUID(), correlationId: crypto.randomUUID() });
    return result;
  }, idle);
  return { state, action, pending, keys };
}

function HiddenScope({
  locale, libraryId, organizationId, extra, keys,
}: {
  locale: Locale; libraryId?: string; organizationId?: string | null; extra?: Record<string, string>; keys: CommandKeys;
}) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      {libraryId ? <input type="hidden" name="libraryId" value={libraryId} /> : null}
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="idempotencyKey" value={keys.idempotencyKey} />
      <input type="hidden" name="correlationId" value={keys.correlationId} />
      {extra ? Object.entries(extra).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />) : null}
    </>
  );
}

export function FranchiseAnomalyDefinitionForm({ locale, libraryId, organizationId }: { locale: Locale; libraryId: string; organizationId?: string | null }) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const { state, action, pending, keys } = useCommand(upsertFranchiseAnomalyDefinition);
  if (!uuidPattern.test(libraryId)) return null;
  return (
    <form action={action} className="franchise-props-form">
      <HiddenScope locale={locale} libraryId={libraryId} organizationId={organizationId} keys={keys} />
      <div><Label htmlFor={`${prefix}-key`}>{c.definitionKey}</Label><Input id={`${prefix}-key`} name="definitionKey" required pattern="[A-Z][A-Z0-9_.-]{1,119}" dir="ltr" className="min-h-11 font-mono" /></div>
      <div><Label htmlFor={`${prefix}-sev`}>{c.severity}</Label><select id={`${prefix}-sev`} name="severity" className={control}><option value="INFO">INFO</option><option value="MINOR">MINOR</option><option value="IMPORTANT">IMPORTANT</option><option value="CRITICAL">CRITICAL</option></select></div>
      <div><Label htmlFor={`${prefix}-fr`}>{c.titleFr}</Label><Input id={`${prefix}-fr`} name="titleFr" required minLength={2} maxLength={240} /></div>
      <div><Label htmlFor={`${prefix}-ar`}>{c.titleAr}</Label><Input id={`${prefix}-ar`} name="titleAr" required minLength={2} maxLength={240} /></div>
      <div><Label htmlFor={`${prefix}-dfr`}>{c.descriptionFr}</Label><textarea id={`${prefix}-dfr`} name="descriptionFr" required minLength={3} maxLength={4000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-dar`}>{c.descriptionAr}</Label><textarea id={`${prefix}-dar`} name="descriptionAr" required minLength={3} maxLength={4000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-block`}>{c.blocking}</Label><select id={`${prefix}-block`} name="blocking" className={control}><option value="no">{c.approvalNo}</option><option value="yes">{c.approvalYes}</option></select></div>
      <div><Label htmlFor={`${prefix}-ev`}>{c.evidenceRequired}</Label><select id={`${prefix}-ev`} name="evidenceRequired" className={control}><option value="no">{c.approvalNo}</option><option value="yes">{c.approvalYes}</option></select></div>
      <div><Label htmlFor={`${prefix}-rule`}>{c.detectedByRule}</Label><Input id={`${prefix}-rule`} name="detectedByRuleKey" pattern="[A-Z][A-Z0-9_.-]{1,119}" dir="ltr" className="min-h-11 font-mono" /></div>
      <div><Label htmlFor={`${prefix}-reason`}>{c.changeReason}</Label><Input id={`${prefix}-reason`} name="changeReason" required minLength={3} maxLength={500} /></div>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required /><span>{c.confirmCommand}</span></label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.createDefinition}</Button>
      <Feedback state={state} locale={locale} success={c.definitionCreated} />
    </form>
  );
}

export function FranchiseRiskDefinitionForm({ locale, libraryId, organizationId }: { locale: Locale; libraryId: string; organizationId?: string | null }) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const { state, action, pending, keys } = useCommand(upsertFranchiseRiskDefinition);
  if (!uuidPattern.test(libraryId)) return null;
  return (
    <form action={action} className="franchise-props-form">
      <HiddenScope locale={locale} libraryId={libraryId} organizationId={organizationId} keys={keys} />
      <div><Label htmlFor={`${prefix}-key`}>{c.definitionKey}</Label><Input id={`${prefix}-key`} name="definitionKey" required pattern="[A-Z][A-Z0-9_.-]{1,119}" dir="ltr" className="min-h-11 font-mono" /></div>
      <div><Label htmlFor={`${prefix}-imp`}>{c.impact}</Label><select id={`${prefix}-imp`} name="impact" className={control}><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option></select></div>
      <div><Label htmlFor={`${prefix}-pro`}>{c.probability}</Label><select id={`${prefix}-pro`} name="probability" className={control}><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option></select></div>
      <div><Label htmlFor={`${prefix}-fr`}>{c.titleFr}</Label><Input id={`${prefix}-fr`} name="titleFr" required minLength={2} maxLength={240} /></div>
      <div><Label htmlFor={`${prefix}-ar`}>{c.titleAr}</Label><Input id={`${prefix}-ar`} name="titleAr" required minLength={2} maxLength={240} /></div>
      <div><Label htmlFor={`${prefix}-dfr`}>{c.descriptionFr}</Label><textarea id={`${prefix}-dfr`} name="descriptionFr" required minLength={3} maxLength={4000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-dar`}>{c.descriptionAr}</Label><textarea id={`${prefix}-dar`} name="descriptionAr" required minLength={3} maxLength={4000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-reason`}>{c.changeReason}</Label><Input id={`${prefix}-reason`} name="changeReason" required minLength={3} maxLength={500} /></div>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required /><span>{c.confirmCommand}</span></label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.createRisk}</Button>
      <Feedback state={state} locale={locale} success={c.riskCreated} />
    </form>
  );
}

export function FranchiseRecommendationDefinitionForm({
  locale, libraryId, organizationId, services, anomalies,
}: {
  locale: Locale; libraryId: string; organizationId?: string | null; services: Array<{ id: string; title: string }>; anomalies?: Array<{ id: string; title: string }>;
}) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const { state, action, pending, keys } = useCommand(upsertFranchiseRecommendationDefinition);
  const serviceRows = services.filter((item) => uuidPattern.test(item.id));
  const anomalyRows = (anomalies ?? []).filter((item) => uuidPattern.test(item.id));
  if (!uuidPattern.test(libraryId) || serviceRows.length === 0) return <p className="client-access-note">{c.emptyServicesForReco}</p>;
  return (
    <form action={action} className="franchise-props-form">
      <HiddenScope locale={locale} libraryId={libraryId} organizationId={organizationId} keys={keys} />
      <div><Label htmlFor={`${prefix}-key`}>{c.definitionKey}</Label><Input id={`${prefix}-key`} name="definitionKey" required pattern="[A-Z][A-Z0-9_.-]{1,119}" dir="ltr" className="min-h-11 font-mono" /></div>
      <div>
        <Label htmlFor={`${prefix}-svc`}>{c.linkedService}</Label>
        <select id={`${prefix}-svc`} name="serviceId" required className={control}>
          {serviceRows.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-anom`}>{c.linkedAnomaly}</Label>
        <select id={`${prefix}-anom`} name="anomalyDefinitionId" className={control}>
          <option value="">{c.noneOption}</option>
          {anomalyRows.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <div><Label htmlFor={`${prefix}-lvl`}>{c.solutionLevel}</Label><select id={`${prefix}-lvl`} name="solutionLevel" className={control}><option value="ESSENTIAL">ESSENTIAL</option><option value="STANDARD">STANDARD</option><option value="ADVANCED">ADVANCED</option></select></div>
      <div><Label htmlFor={`${prefix}-prio`}>{c.priority}</Label><Input id={`${prefix}-prio`} name="priority" type="number" min={1} max={100} defaultValue={10} required /></div>
      <div><Label htmlFor={`${prefix}-fr`}>{c.titleFr}</Label><Input id={`${prefix}-fr`} name="titleFr" required minLength={2} maxLength={240} /></div>
      <div><Label htmlFor={`${prefix}-ar`}>{c.titleAr}</Label><Input id={`${prefix}-ar`} name="titleAr" required minLength={2} maxLength={240} /></div>
      <div><Label htmlFor={`${prefix}-cfr`}>{c.clientText}</Label><textarea id={`${prefix}-cfr`} name="clientTextFr" required minLength={3} maxLength={4000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-car`}>{c.clientTextAr}</Label><textarea id={`${prefix}-car`} name="clientTextAr" required minLength={3} maxLength={4000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-tfr`}>{c.technicalText}</Label><textarea id={`${prefix}-tfr`} name="technicalTextFr" required minLength={3} maxLength={4000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-tar`}>{c.technicalTextAr}</Label><textarea id={`${prefix}-tar`} name="technicalTextAr" required minLength={3} maxLength={4000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-reason`}>{c.changeReason}</Label><Input id={`${prefix}-reason`} name="changeReason" required minLength={3} maxLength={500} /></div>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required /><span>{c.confirmCommand}</span></label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.createRecommendation}</Button>
      <Feedback state={state} locale={locale} success={c.recommendationCreated} />
    </form>
  );
}

export function FranchiseIncidentInstructForm({
  locale, organizationId, incidents,
}: {
  locale: Locale; organizationId?: string | null; incidents: Array<{ id: string; title: string; status?: string }>;
}) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const { state, action, pending, keys } = useCommand(instructFranchiseDispute);
  const open = incidents.filter((item) => uuidPattern.test(item.id) && !["DECIDED", "CLOSED"].includes(item.status ?? ""));
  if (open.length === 0) return <p className="client-access-note">{c.openingClientOnly}</p>;
  return (
    <form action={action} className="franchise-props-form">
      <HiddenScope locale={locale} organizationId={organizationId} keys={keys} />
      <div>
        <Label htmlFor={`${prefix}-case`}>{c.incidents}</Label>
        <select id={`${prefix}-case`} name="disputeCaseId" required className={control}>
          {open.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <div><Label htmlFor={`${prefix}-st`}>{c.incidentStatement}</Label><textarea id={`${prefix}-st`} name="statement" required minLength={10} maxLength={4000} className={control} /></div>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required /><span>{c.confirmCommand}</span></label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.instructIncident}</Button>
      <Feedback state={state} locale={locale} success={c.incidentInstructed} />
    </form>
  );
}

export function FranchiseQualificationDecisionForm({
  locale, organizationId, qualifications,
}: {
  locale: Locale; organizationId?: string | null; qualifications: Array<{ id: string; title: string; status: string; rowVersion?: number }>;
}) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const { state, action, pending, keys } = useCommand(decideFranchiseProviderQualification);
  const rows = qualifications.filter((item) => uuidPattern.test(item.id) && item.rowVersion);
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  if (rows.length === 0) return null;
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0];
  return (
    <form action={action} className="franchise-props-form">
      <HiddenScope locale={locale} organizationId={organizationId} extra={{ expectedRowVersion: String(selected?.rowVersion ?? 1) }} keys={keys} />
      <div>
        <Label htmlFor={`${prefix}-q`}>{c.stepQual}</Label>
        <select id={`${prefix}-q`} name="qualificationId" required className={control} value={selected?.id} onChange={(event) => setSelectedId(event.target.value)}>
          {rows.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-st`}>{c.state}</Label>
        <select id={`${prefix}-st`} name="status" required className={control}>
          <option value="INFORMATION_REQUIRED">INFORMATION_REQUIRED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="CONDITIONAL">CONDITIONAL</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>
      <div><Label htmlFor={`${prefix}-sess`}>{c.questionnaireSession}</Label><Input id={`${prefix}-sess`} name="questionnaireSessionId" dir="ltr" className="min-h-11 font-mono" /></div>
      <div><Label htmlFor={`${prefix}-score`}>{c.scoreBps}</Label><Input id={`${prefix}-score`} name="scoreBasisPoints" type="number" min={0} max={10000} /></div>
      <div><Label htmlFor={`${prefix}-rule`}>{c.ruleVersion}</Label><Input id={`${prefix}-rule`} name="ruleVersion" required defaultValue="QUAL-FR-001" pattern="[A-Z0-9][A-Z0-9._-]{2,79}" dir="ltr" className="min-h-11 font-mono" /></div>
      <div><Label htmlFor={`${prefix}-rat`}>{c.rationale}</Label><textarea id={`${prefix}-rat`} name="rationale" required minLength={3} maxLength={2000} className={control} /></div>
      <div><Label htmlFor={`${prefix}-block`}>{c.blockingCondition}</Label><Input id={`${prefix}-block`} name="blockingCondition" maxLength={500} /></div>
      <div><Label htmlFor={`${prefix}-mand`}>{c.mandatoryPassed}</Label><select id={`${prefix}-mand`} name="mandatoryPassed" className={control}><option value="no">{c.approvalNo}</option><option value="yes">{c.approvalYes}</option></select></div>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required /><span>{c.confirmCommand}</span></label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.decideQualification}</Button>
      <Feedback state={state} locale={locale} success={c.qualificationDecided} />
    </form>
  );
}

export function FranchiseMandateInviteForm({ locale, organizationId }: { locale: Locale; organizationId: string }) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const { state, action, pending, keys } = useCommand(inviteFranchiseMandateMember);
  if (!uuidPattern.test(organizationId)) return null;
  return (
    <form action={action} className="franchise-props-form">
      <HiddenScope locale={locale} organizationId={organizationId} keys={keys} />
      <div><Label htmlFor={`${prefix}-email`}>{c.memberEmail}</Label><Input id={`${prefix}-email`} name="invitedEmail" type="email" required maxLength={320} /></div>
      <div>
        <Label htmlFor={`${prefix}-role`}>{c.memberRole}</Label>
        <select id={`${prefix}-role`} name="roleCode" required className={control}>
          <option value="FRANCHISE_EXPERT">FRANCHISE_EXPERT</option>
          <option value="FRANCHISE_PROVIDER_MANAGER">FRANCHISE_PROVIDER_MANAGER</option>
          <option value="FRANCHISE_ACCOUNTING">FRANCHISE_ACCOUNTING</option>
          <option value="FRANCHISE_MANAGER">FRANCHISE_MANAGER</option>
          <option value="FRANCHISE_VIEWER">FRANCHISE_VIEWER</option>
        </select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-exp`}>{c.expiryDays}</Label>
        <select id={`${prefix}-exp`} name="expiryDays" className={control}>
          <option value="7">7</option>
          <option value="1">1</option>
          <option value="14">14</option>
          <option value="30">30</option>
        </select>
      </div>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required /><span>{c.confirmCommand}</span></label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.inviteMember}</Button>
      <Feedback state={state} locale={locale} success={c.memberInvited} />
    </form>
  );
}

export function FranchiseVolumeProposeForm({
  locale, libraryId, organizationId, skus,
}: {
  locale: Locale; libraryId: string; organizationId?: string | null; skus: Array<{ id: string; title: string }>;
}) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const { state, action, pending, keys } = useCommand(proposeFranchiseVolumePurchase);
  const rows = skus.filter((item) => uuidPattern.test(item.id));
  if (!uuidPattern.test(libraryId) || rows.length === 0) return <p className="client-access-note">{c.proposeVolume}</p>;
  return (
    <form action={action} className="franchise-props-form">
      <HiddenScope locale={locale} libraryId={libraryId} organizationId={organizationId} keys={keys} />
      <div>
        <Label htmlFor={`${prefix}-sku`}>{c.sku}</Label>
        <select id={`${prefix}-sku`} name="skuId" required className={control}>
          {rows.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <div><Label htmlFor={`${prefix}-fc`}>{c.forecastUnits}</Label><Input id={`${prefix}-fc`} name="forecastUnits" type="number" min={1} step="1" required /></div>
      <div><Label htmlFor={`${prefix}-min`}>{c.minUnits}</Label><Input id={`${prefix}-min`} name="minimumCommitmentUnits" type="number" min={0} step="1" required /></div>
      <div><Label htmlFor={`${prefix}-max`}>{c.maxUnits}</Label><Input id={`${prefix}-max`} name="maximumUnits" type="number" min={1} step="1" required /></div>
      <div>
        <Label htmlFor={`${prefix}-pay`}>{c.paymentModel}</Label>
        <select id={`${prefix}-pay`} name="paymentModel" className={control}>
          <option value="PAY_PER_USE">PAY_PER_USE</option>
          <option value="PREPAID">PREPAID</option>
          <option value="HYBRID">HYBRID</option>
        </select>
      </div>
      <div><Label htmlFor={`${prefix}-from`}>{c.periodStart}</Label><Input id={`${prefix}-from`} name="periodStart" type="date" required /></div>
      <div><Label htmlFor={`${prefix}-to`}>{c.periodEnd}</Label><Input id={`${prefix}-to`} name="periodEnd" type="date" required /></div>
      <div><Label htmlFor={`${prefix}-why`}>{c.volumeRationale}</Label><textarea id={`${prefix}-why`} name="rationale" required minLength={10} maxLength={4000} className={control} /></div>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required /><span>{c.confirmCommand}</span></label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.pending : c.proposeVolumeAction}</Button>
      <Feedback state={state} locale={locale} success={c.volumeProposed} />
    </form>
  );
}
