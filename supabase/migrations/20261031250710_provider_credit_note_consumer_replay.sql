-- Credit-note issuance archives are idempotent, source-bound and safe to resume after configuration repair.
create or replace function private.operational_event_replay_is_safe(p_type text,p_error text)returns boolean language sql immutable set search_path=pg_catalog as $$
 select p_type in('ClientCommercialDocumentIssuedV1','SocialNativeVerificationRequestedV1','AdminActionAuthorizedV1','DocumentUploadedV1','ProviderBillingPdfArchivedV1','ProviderInvoiceIssuedV1','ProviderStatementIssuedV1','ProviderCreditNoteIssuedV1','ProviderBillingDocumentsReadyV1','PrivacyRetentionActionRequestedV1','SubscriptionRefundAuthorizedV1','SubscriptionRefundReconciliationAuthorizedV1')or coalesce(p_error in('INVITATION_LOAD_FAILED','INVITATION_LOAD_INVALID','EMAIL_MODE_UNCONFIGURED','EMAIL_LIVE_DISABLED','EMAIL_RECIPIENT_NOT_ALLOWLISTED','EMAIL_PROVIDER_NOT_CONFIGURED','DOMAIN_CONSUMER_REQUIRED'),false)
$$;
revoke all on function private.operational_event_replay_is_safe(text,text)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
