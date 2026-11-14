"use client";

import { useActionState, useState } from "react";
import {
  bindFranchiseApplicationMandate,
  decideFranchiseApplicationMandate,
  linkFranchiseApplicationOrganization,
  proposeFranchiseFromApplication,
  resendFranchiseInvitationCode,
  reviewFranchiseApplication,
  type FranchiseApplicationReviewState,
} from "./actions";
import { isFranchiseApplicationOpen } from "./model";

const idle: FranchiseApplicationReviewState = { status: "idle" };
const control = "mt-1 min-h-11 w-full rounded-md border border-[var(--ad-border,var(--mat-border))] bg-background px-3";

export type FranchiseApplicationReviewCopy = {
  reason: string; reasonHint: string; company: string; documents: string; close: string; link: string; organization: string; noOrganization: string;
  bind: string; franchise: string; pending: string; denied: string; conflict: string; unavailable: string; saved: string; mfa: string;
  mailed: string; notMailed: string; propose: string; proposeTitle: string; itRule: string; entryFee: string; entryFeeMode: string;
  entryFeeTerm: string; mandateTerm: string; conditions: string; modes: Record<"UPFRONT" | "INSTALLMENT" | "REVENUE_WITHHOLDING", string>;
  approveTitle: string; approve: string; reject: string; fourEyes: string; resend: string; resendTitle: string;
};
export type FranchiseApplicationReviewModel = {
  id: string;
  status: string;
  rowVersion: number;
  organizationId: string | null;
  franchiseId: string | null;
  isIt: boolean;
  organizations: Array<{ id: string; name: string }>;
  franchises: Array<{ id: string; label: string }>;
  approval: { id: string; rowVersion: number; requestedByMe: boolean } | null;
  invitationId: string | null;
  invitationPending: boolean;
};

function Notice({ state, copy }: { state: FranchiseApplicationReviewState; copy: FranchiseApplicationReviewCopy }) {
  if (state.status === "idle") return null;
  if (state.status === "success") return <p role="status" className="text-sm text-[var(--ad-forest,var(--mat-navy))]">{copy.saved}{state.mailed === undefined ? "" : ` ${state.mailed ? copy.mailed : copy.notMailed}`}</p>;
  const text = { DENIED: copy.denied, CONFLICT: copy.conflict, VALIDATION: copy.reason, MFA_REQUIRED: copy.mfa, UNAVAILABLE: copy.unavailable }[state.reason];
  return <p role="alert" className="text-sm text-destructive">{text}</p>;
}

function Hidden({ locale, application }: { locale: "fr" | "ar"; application: FranchiseApplicationReviewModel }) {
  return <><input type="hidden" name="locale" value={locale} /><input type="hidden" name="applicationId" value={application.id} /><input type="hidden" name="rowVersion" value={application.rowVersion} /></>;
}

function ProposeMandate({ locale, application, copy, idempotencyKey }: { locale: "fr" | "ar"; application: FranchiseApplicationReviewModel; copy: FranchiseApplicationReviewCopy; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(proposeFranchiseFromApplication, idle);
  const [mode, setMode] = useState<"UPFRONT" | "INSTALLMENT" | "REVENUE_WITHHOLDING">("UPFRONT");
  const prefix = `propose-${application.id}`;
  return (
    <details className="admin-franchise-action" open>
      <summary>{copy.proposeTitle}</summary>
      <form action={action} className="admin-franchise-action__body">
        <Hidden locale={locale} application={application} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        {application.isIt ? (
          <><p className="text-sm text-muted-foreground">{copy.itRule}</p><input type="hidden" name="entryFeeMode" value="EXEMPT" /><input type="hidden" name="entryFee" value="0" /><input type="hidden" name="entryFeeTermMonths" value="0" /></>
        ) : (
          <>
            <label htmlFor={`${prefix}-fee`} className="text-sm font-medium">{copy.entryFee}</label>
            <input id={`${prefix}-fee`} name="entryFee" required inputMode="decimal" className={control} dir="ltr" />
            <label htmlFor={`${prefix}-mode`} className="text-sm font-medium">{copy.entryFeeMode}</label>
            <select id={`${prefix}-mode`} name="entryFeeMode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className={control}>
              {(["UPFRONT", "INSTALLMENT", "REVENUE_WITHHOLDING"] as const).map((value) => <option key={value} value={value}>{copy.modes[value]}</option>)}
            </select>
            {mode === "UPFRONT" ? <input type="hidden" name="entryFeeTermMonths" value="0" /> : (
              <><label htmlFor={`${prefix}-term`} className="text-sm font-medium">{copy.entryFeeTerm}</label>
              <input id={`${prefix}-term`} name="entryFeeTermMonths" type="number" min={1} max={6} required defaultValue={3} className={control} /></>
            )}
          </>
        )}
        <label htmlFor={`${prefix}-duration`} className="text-sm font-medium">{copy.mandateTerm}</label>
        <input id={`${prefix}-duration`} name="mandateTermMonths" type="number" min={12} max={120} required defaultValue={36} className={control} />
        <label htmlFor={`${prefix}-conditions`} className="text-sm font-medium">{copy.conditions}</label>
        <textarea id={`${prefix}-conditions`} name="specialConditions" maxLength={2000} rows={3} className={control} />
        <label htmlFor={`${prefix}-reason`} className="text-sm font-medium">{copy.reason}</label>
        <input id={`${prefix}-reason`} name="reason" required minLength={3} maxLength={1000} className={control} />
        <button disabled={pending || state.status === "success"} className="client-cta w-fit">{pending ? copy.pending : copy.propose}</button>
        <Notice state={state} copy={copy} />
      </form>
    </details>
  );
}

function ApproveMandate({ locale, application, copy, idempotencyKey }: { locale: "fr" | "ar"; application: FranchiseApplicationReviewModel; copy: FranchiseApplicationReviewCopy; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(decideFranchiseApplicationMandate, idle);
  if (!application.approval || !application.invitationId) return null;
  const reasonId = `approve-${application.id}-reason`;
  return (
    <details className="admin-franchise-action" open>
      <summary>{copy.approveTitle}</summary>
      <form action={action} className="admin-franchise-action__body">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="invitationId" value={application.invitationId} />
        <input type="hidden" name="approvalRequestId" value={application.approval.id} />
        <input type="hidden" name="rowVersion" value={application.approval.rowVersion} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        {application.approval.requestedByMe ? <p className="text-sm text-muted-foreground">{copy.fourEyes}</p> : (
          <>
            <label htmlFor={reasonId} className="text-sm font-medium">{copy.reason}</label>
            <input id={reasonId} name="reason" required minLength={3} maxLength={1000} className={control} />
            <div className="flex flex-wrap gap-2">
              <button name="decision" value="APPROVE" disabled={pending || state.status === "success"} className="client-cta">{pending ? copy.pending : copy.approve}</button>
              <button name="decision" value="REJECT" disabled={pending || state.status === "success"} className="admin-btn-outline">{copy.reject}</button>
            </div>
          </>
        )}
        <Notice state={state} copy={copy} />
      </form>
    </details>
  );
}

function ResendCode({ locale, application, copy, idempotencyKey }: { locale: "fr" | "ar"; application: FranchiseApplicationReviewModel; copy: FranchiseApplicationReviewCopy; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(resendFranchiseInvitationCode, idle);
  const reasonId = `resend-${application.id}-reason`;
  return (
    <details className="admin-franchise-action">
      <summary>{copy.resendTitle}</summary>
      <form action={action} className="admin-franchise-action__body">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <label htmlFor={reasonId} className="text-sm font-medium">{copy.reason}</label>
        <input id={reasonId} name="reason" required minLength={3} maxLength={1000} className={control} />
        <button disabled={pending || state.status === "success"} className="admin-btn-outline w-fit">{pending ? copy.pending : copy.resend}</button>
        <Notice state={state} copy={copy} />
      </form>
    </details>
  );
}

export function FranchiseApplicationReview({ locale, application, copy, keys }: { locale: "fr" | "ar"; application: FranchiseApplicationReviewModel; copy: FranchiseApplicationReviewCopy; keys: { propose: string; approve: string; resend: string } }) {
  const [review, reviewAction, reviewPending] = useActionState(reviewFranchiseApplication, idle);
  const [link, linkAction, linkPending] = useActionState(linkFranchiseApplicationOrganization, idle);
  const [bind, bindAction, bindPending] = useActionState(bindFranchiseApplicationMandate, idle);
  const open = isFranchiseApplicationOpen(application.status);
  const needsOrganization = !application.organizationId && ["COMPANY_REVIEW", "DOCUMENT_REVIEW"].includes(application.status);
  const canPropose = application.status === "DOCUMENT_REVIEW" && Boolean(application.organizationId) && !application.franchiseId;
  const canApprove = application.status === "CONTRACT_PENDING";
  const canResend = application.invitationPending && ["CONTRACT_PENDING", "LIBRARY_ASSIGNED"].includes(application.status);
  if (!open && !needsOrganization && !canPropose && !canApprove && !canResend) return null;
  const prefix = `review-${application.id}`;
  return (
    <div className="admin-franchise-review" data-status={application.status}>
      {open ? (
        <form action={reviewAction} className="admin-franchise-review__primary">
          <Hidden locale={locale} application={application} />
          <label htmlFor={`${prefix}-reason`} className="text-sm font-medium">{copy.reason}</label>
          <p className="admin-franchise-review__hint">{copy.reasonHint}</p>
          <div className="admin-franchise-review__row">
            <input id={`${prefix}-reason`} name="reason" required minLength={3} maxLength={1000} className={control} placeholder={copy.reasonHint} />
            <div className="admin-franchise-review__actions">
              {application.status === "REGISTERED" ? <button name="toStatus" value="COMPANY_REVIEW" disabled={reviewPending} className="client-cta">{reviewPending ? copy.pending : copy.company}</button> : null}
              {application.status === "COMPANY_REVIEW" ? <button name="toStatus" value="DOCUMENT_REVIEW" disabled={reviewPending} className="client-cta">{copy.documents}</button> : null}
              <button name="toStatus" value="CLOSED" disabled={reviewPending} className="admin-btn-outline">{copy.close}</button>
            </div>
          </div>
          <Notice state={review} copy={copy} />
        </form>
      ) : null}
      {needsOrganization ? (
        application.organizations.length ? (
          <details className="admin-franchise-action">
            <summary>{copy.link}</summary>
            <form action={linkAction} className="admin-franchise-action__body">
              <Hidden locale={locale} application={application} />
              <label htmlFor={`${prefix}-organization`} className="text-sm font-medium">{copy.organization}</label>
              <select id={`${prefix}-organization`} name="organizationId" required className={control}>
                {application.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
              </select>
              <label htmlFor={`${prefix}-link-reason`} className="text-sm font-medium">{copy.reason}</label>
              <input id={`${prefix}-link-reason`} name="reason" required minLength={3} maxLength={1000} className={control} />
              <button disabled={linkPending} className="client-cta w-fit">{linkPending ? copy.pending : copy.link}</button>
              <Notice state={link} copy={copy} />
            </form>
          </details>
        ) : <p className="admin-franchise-review__hint" role="status">{copy.noOrganization}</p>
      ) : null}
      {canPropose ? (
        <>
          <ProposeMandate locale={locale} application={application} copy={copy} idempotencyKey={keys.propose} />
          {application.franchises.length ? (
            <details className="admin-franchise-action">
              <summary>{copy.bind}</summary>
              <form action={bindAction} className="admin-franchise-action__body">
                <Hidden locale={locale} application={application} />
                <label htmlFor={`${prefix}-franchise`} className="text-sm font-medium">{copy.franchise}</label>
                <select id={`${prefix}-franchise`} name="franchiseId" required className={control}>
                  {application.franchises.map((franchise) => <option key={franchise.id} value={franchise.id}>{franchise.label}</option>)}
                </select>
                <label htmlFor={`${prefix}-bind-reason`} className="text-sm font-medium">{copy.reason}</label>
                <input id={`${prefix}-bind-reason`} name="reason" required minLength={3} maxLength={1000} className={control} />
                <button disabled={bindPending} className="client-cta w-fit">{bindPending ? copy.pending : copy.bind}</button>
                <Notice state={bind} copy={copy} />
              </form>
            </details>
          ) : null}
        </>
      ) : null}
      {canApprove ? <ApproveMandate locale={locale} application={application} copy={copy} idempotencyKey={keys.approve} /> : null}
      {canResend ? <ResendCode locale={locale} application={application} copy={copy} idempotencyKey={keys.resend} /> : null}
    </div>
  );
}
