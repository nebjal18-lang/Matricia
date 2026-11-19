"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { reviewClientIdentity } from "@/modules/admin/screens/client-identity/actions";
import type { ClientIdentityMessages } from "@/modules/admin/screens/client-identity/messages";
import {
  type ClientIdentityContext,
  type ClientIdentityState,
} from "@/modules/admin/screens/client-identity/model";
import { OrganizationIdentityBlock } from "@/modules/shared/ui/organization-identity";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

type Props = {
  data: ClientIdentityContext;
  locale: Locale;
  requestKey: string;
  messages: ClientIdentityMessages;
};

function statusTone(status: string): "ok" | "warn" | "danger" | "neutral" | "violet" {
  if (status === "VERIFIED" || status === "CLEAN") return "ok";
  if (status === "REJECTED" || status === "INFECTED" || status === "FAILED" || status === "SUSPENDED") {
    return "danger";
  }
  if (
    status === "PENDING_REVIEW" ||
    status === "PENDING" ||
    status === "UNDER_REVIEW" ||
    status === "DOCUMENTS_REQUIRED" ||
    status === "QUESTION_REQUIRED"
  ) {
    return "warn";
  }
  if (status === "PROFILE_IN_PROGRESS") return "violet";
  return "neutral";
}

export function ClientIdentityPanel({ data, locale, requestKey, messages }: Props) {
  const formId = useId();
  const [state, action, pending] = useActionState(
    reviewClientIdentity,
    { status: "idle" } as ClientIdentityState,
  );
  const display = data.profile_display;
  const canMutate = display.can_mutate !== false;
  const ready =
    data.identity_snapshot.documents.length === 3 &&
    data.identity_snapshot.documents.every(
      (doc) => doc.status === "VERIFIED" && doc.scan_status === "CLEAN",
    );
  const caseStatusLabel =
    messages.statuses[data.status as keyof typeof messages.statuses] ?? data.status;
  const decisionHref = `/${locale}/administration/conformite-clients/${data.compliance_case_id}`;

  const errorMessage =
    state.status === "error"
      ? state.reason === "STALE"
        ? messages.errors.STALE
        : state.reason === "DOCUMENTS_REQUIRED"
          ? messages.errors.DOCUMENTS_REQUIRED
          : state.reason === "VALIDATION"
            ? messages.errors.VALIDATION
            : state.reason === "FORBIDDEN"
              ? messages.errors.FORBIDDEN
              : messages.errors.FAILED
      : null;

  return (
    <div className="admin-identity-review">
      <header className="client-card admin-identity-review-hero mat-hero" data-tone="violet">
        <p className="admin-eyebrow">{messages.title}</p>
        <h2>{data.identity_snapshot.legal_name}</h2>
        <p>{messages.lead}</p>
        <p className="admin-inline-note" role="note">
          {messages.disclaimer}
        </p>
        <div className="mat-status-row" aria-label={messages.caseStatus}>
          <span className="admin-status" data-tone={statusTone(data.status)}>
            {caseStatusLabel}
          </span>
          <span className="admin-status" data-tone="sky">
            {messages.profileVersion} {data.profile_version}
          </span>
        </div>
      </header>

      <OrganizationIdentityBlock
        locale={locale}
        idPrefix={`${formId}-org`}
        identity={{
          legalName: data.identity_snapshot.legal_name,
          displayName: display.display_name,
          countryCode: data.identity_snapshot.country_code,
          legalForm: display.legal_form,
          incorporationDate: display.incorporation_date,
          activity: display.activity,
          sector: display.sector,
          registeredCity: display.registered_city,
          registeredAddress: display.registered_address,
          identifiers: data.identity_snapshot.identifiers,
          representative: display.representative,
        }}
      />

      <section className="admin-fiche-grid" aria-label={messages.documents}>
        <article className="client-card" data-tone="sky" id="documents">
          <header>
            <h2 id={`${formId}-docs`}>{messages.documents}</h2>
          </header>
          {data.identity_snapshot.documents.length === 0 ? (
            <p className="admin-inline-note" role="status">
              {messages.missingDocs}
            </p>
          ) : (
            <ul className="admin-req-list">
              {data.identity_snapshot.documents.map((doc) => {
                const typeLabel =
                  messages.documentTypes[doc.type as keyof typeof messages.documentTypes] ??
                  doc.type;
                const docStatus =
                  messages.documentStatuses[
                    doc.status as keyof typeof messages.documentStatuses
                  ] ?? doc.status;
                const scanStatus =
                  messages.scanStatuses[doc.scan_status as keyof typeof messages.scanStatuses] ??
                  doc.scan_status;
                return (
                  <li key={doc.id}>
                    <span>
                      <strong>{typeLabel}</strong>
                      <small>
                        {messages.version} {doc.version}
                        {" · "}
                        {doc.expires_on
                          ? `${messages.expires} ${doc.expires_on.slice(0, 10)}`
                          : messages.expires}
                        {" · "}
                        <span dir="ltr">
                          {messages.fingerprint} {doc.sha256.slice(0, 12)}…{doc.sha256.slice(-8)}
                        </span>
                      </small>
                    </span>
                    <span className="admin-identity-doc-meta">
                      <span className="admin-status" data-tone={statusTone(doc.status)}>
                        {docStatus}
                      </span>
                      <span className="admin-status" data-tone={statusTone(doc.scan_status)}>
                        {scanStatus}
                      </span>
                      <a
                        className="admin-text-link"
                        href={`/api/client/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {messages.openDocument}
                      </a>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {!ready ? (
            <p className="admin-banner" data-tone="warn" role="alert">
              {messages.missingDocs}
            </p>
          ) : null}
        </article>

        {canMutate ? (
          <article className="client-card" data-tone="peach">
            <header>
              <h2 id={`${formId}-review`}>{messages.review}</h2>
            </header>
            <form action={action} className="admin-form-grid" noValidate>
              <input type="hidden" name="caseId" value={data.compliance_case_id} />
              <input type="hidden" name="caseVersion" value={String(data.case_row_version)} />
              <input type="hidden" name="profileVersion" value={String(data.profile_version)} />
              <input type="hidden" name="identityHash" value={data.identity_hash} />
              <input
                type="hidden"
                name="documents"
                value={JSON.stringify(data.identity_snapshot.documents.map((doc) => doc.id))}
              />
              <input type="hidden" name="idempotencyKey" value={requestKey} />
              <input type="hidden" name="locale" value={locale} />

              <label className="admin-check" data-span>
                <input
                  type="checkbox"
                  name="confirmed"
                  value="yes"
                  required
                  disabled={pending || !ready}
                />
                <span>{messages.confirm}</span>
              </label>

              <div className="admin-field" data-span>
                <label htmlFor={`${formId}-reason`}>{messages.reason}</label>
                <textarea
                  id={`${formId}-reason`}
                  name="reason"
                  rows={4}
                  minLength={10}
                  maxLength={2000}
                  required
                  disabled={pending || !ready}
                />
              </div>

              <div className="admin-form-foot" data-span>
                <button type="submit" className="admin-primary-cta" disabled={pending || !ready}>
                  {pending ? messages.submitting : messages.submit}
                </button>
                <Link className="admin-soft-cta" href={decisionHref}>
                  {messages.backDecision}
                </Link>
              </div>

              {errorMessage ? (
                <p className="admin-error" role="alert" data-span>
                  {errorMessage}
                </p>
              ) : null}
              {state.status === "success" ? (
                <p className="admin-banner" data-tone="ok" role="status" data-span>
                  {messages.success}
                  <code dir="ltr">{state.proofHash}</code>
                </p>
              ) : null}
            </form>
          </article>
        ) : (
          <article className="client-card" data-tone="peach">
            <header>
              <h2 id={`${formId}-readonly`}>{messages.review}</h2>
            </header>
            <p className="admin-inline-note" role="status">
              {messages.readOnly}
            </p>
            <Link className="admin-soft-cta" href={decisionHref}>
              {messages.backDecision}
            </Link>
          </article>
        )}
      </section>
    </div>
  );
}
