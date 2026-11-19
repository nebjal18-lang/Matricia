"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { revalidateProviderIdentity } from "@/modules/admin/screens/provider-identity/actions";
import {
  getProviderIdentityMessages,
  type ProviderIdentityMessages,
} from "@/modules/admin/screens/provider-identity/messages";
import type {
  ProviderIdentityReview,
  ProviderIdentityReviewState,
} from "@/modules/admin/screens/provider-identity/model";
import { OrganizationIdentityBlock } from "@/modules/shared/ui/organization-identity";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

type Props = {
  data: ProviderIdentityReview;
  locale: Locale;
  requestKey: string;
  messages?: ProviderIdentityMessages;
};

export function ProviderIdentityReviewPanel({
  data,
  locale,
  requestKey,
  messages: messagesProp,
}: Props) {
  const formId = useId();
  const messages = messagesProp ?? getProviderIdentityMessages(locale);
  const [state, action, pending] = useActionState(
    revalidateProviderIdentity,
    { status: "idle" } as ProviderIdentityReviewState,
  );
  const profile = data.canonical_organization_profile?.profile;
  const legal = data.canonical_client_legal_profile;
  const ready = Boolean(data.document_version_ids && data.company_decision_id);
  const backHref = `/${locale}/administration/providers`;

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

  const address =
    profile?.registered_address ??
    (legal?.registered_address as
      | { line1?: string; city?: string; postal_code?: string; country_code?: string }
      | null
      | undefined);

  return (
    <div className="admin-identity-review">
      <header className="client-card admin-identity-review-hero mat-hero" data-tone="mint">
        <p className="admin-eyebrow">{messages.title}</p>
        <h2>{data.identity_snapshot.legal_name}</h2>
        <p>{messages.lead}</p>
        <div className="mat-status-row">
          <span
            className="admin-status"
            data-tone={data.currently_verified ? "ok" : "warn"}
          >
            {data.currently_verified ? messages.verified : messages.revalidation}
          </span>
          <span className="admin-status" data-tone="sky">
            {data.organization_status}
          </span>
          {data.canonical_organization_profile ? (
            <span className="admin-status" data-tone="violet">
              v{data.canonical_organization_profile.version}
            </span>
          ) : null}
        </div>
        <details className="admin-inline-note">
          <summary>{messages.fingerprint}</summary>
          <p dir="ltr" className="break-all">
            {data.identity_hash}
          </p>
        </details>
      </header>

      <OrganizationIdentityBlock
        locale={locale}
        idPrefix={`${formId}-provider`}
        identity={{
          legalName: data.identity_snapshot.legal_name,
          displayName: data.identity_snapshot.legal_name,
          countryCode: data.identity_snapshot.country_code,
          legalForm: profile?.legal_form ?? legal?.legal_form,
          incorporationDate: profile?.incorporation_date,
          activity: profile?.activity,
          sector: profile?.sector,
          registeredCity: profile?.registered_city ?? legal?.registered_city,
          registeredAddress: address ?? null,
          identifiers: data.identity_snapshot.identifiers,
          representative: profile?.representative,
        }}
      />

      {profile ? (
        <p className="admin-banner" data-tone="sky" role="note">
          {messages.declarations}
        </p>
      ) : null}

      <section className="admin-fiche-grid">
        <article className="client-card" data-tone="sky">
          <header>
            <h2 id={`${formId}-docs`}>{messages.documents}</h2>
          </header>
          {data.document_version_ids ? (
            <ul className="admin-req-list">
              {data.document_version_ids.map((id) => (
                <li key={id}>
                  <span>
                    <strong>{messages.openDocument}</strong>
                    <small dir="ltr">{id}</small>
                  </span>
                  <a
                    className="admin-text-link"
                    href={`/api/provider/documents/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {messages.openDocument}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-banner" data-tone="warn" role="alert">
              {messages.missingDocs}
            </p>
          )}
        </article>

        <article className="client-card" data-tone="peach">
          <header>
            <h2 id={`${formId}-review`}>{messages.title}</h2>
          </header>
          <form action={action} className="admin-form-grid" noValidate>
            <input type="hidden" name="organizationId" value={data.organization_id} />
            <input
              type="hidden"
              name="organizationVersion"
              value={String(data.organization_row_version)}
            />
            <input
              type="hidden"
              name="profileVersion"
              value={String(data.profile_row_version)}
            />
            <input type="hidden" name="identityHash" value={data.identity_hash} />
            <input type="hidden" name="decisionId" value={data.company_decision_id ?? ""} />
            <input type="hidden" name="idempotencyKey" value={requestKey} />
            <input type="hidden" name="locale" value={locale} />

            <label className="admin-check" data-span>
              <input type="checkbox" name="confirmed" value="yes" required disabled={pending || !ready} />
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
              <Link className="admin-soft-cta" href={backHref}>
                {messages.backProviders}
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
              </p>
            ) : null}
          </form>
        </article>
      </section>
    </div>
  );
}
