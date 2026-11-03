-- Already issued immutable financial documents are rendered by their durable Outbox events.
-- The trusted service may archive on behalf of the original issuer even after that actor's later revocation.
-- It cannot create or modify a financial source or change its hash.
grant select on public.provider_invoices,public.provider_statements,public.organizations,public.provider_billing_document_artifacts to service_role;
create or replace function public.register_provider_billing_document_artifact(p_provider_organization_id uuid,p_kind text,p_source_id uuid,p_locale text,p_source_hash text,p_pdf_sha256 text,p_storage_path text,p_snapshot jsonb,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare result public.provider_billing_document_artifacts%rowtype;expected text;source_actor uuid;correlation uuid:=extensions.gen_random_uuid();
begin
 if auth.role() is distinct from 'service_role'then raise exception'BILLING_ARTIFACT_DENIED'using errcode='42501';end if;
 if p_kind='invoice'then select document_hash,created_by into expected,source_actor from public.provider_invoices where id=p_source_id and provider_organization_id=p_provider_organization_id;
 elsif p_kind='statement'then select document_hash,created_by into expected,source_actor from public.provider_statements where id=p_source_id and provider_organization_id=p_provider_organization_id;
 else raise exception'INVALID_BILLING_ARTIFACT_KIND'using errcode='22023';end if;
 if not coalesce(private.provider_billing_access(p_provider_organization_id,p_actor_id),false)and p_actor_id is distinct from source_actor then raise exception'BILLING_ARTIFACT_DENIED'using errcode='42501';end if;
 if expected is null or expected<>p_source_hash or (p_snapshot->>'sourceHash') is distinct from expected then raise exception'BILLING_ARTIFACT_SOURCE_MISMATCH'using errcode='22000';end if;
 if p_storage_path is distinct from p_provider_organization_id::text||'/'||p_kind||'/'||p_source_id::text||'/'||p_locale||'/'||p_pdf_sha256||'.pdf'then raise exception'BILLING_ARTIFACT_PATH_MISMATCH'using errcode='22000';end if;
 if not exists(select 1 from storage.objects where bucket_id='provider-billing'and name=p_storage_path and metadata->>'mimetype'='application/pdf')then raise exception'BILLING_ARTIFACT_UPLOAD_REQUIRED'using errcode='23514';end if;
 insert into public.provider_billing_document_artifacts(provider_organization_id,kind,source_id,locale,source_hash,pdf_sha256,storage_path,snapshot,created_by)
 values(p_provider_organization_id,p_kind,p_source_id,p_locale,p_source_hash,p_pdf_sha256,p_storage_path,p_snapshot,p_actor_id)on conflict(kind,source_id,locale)do nothing returning * into result;
 if found then
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_provider_organization_id,p_actor_id,'SERVICE','provider.billing.pdf.archived','provider_billing_document_artifact',result.id::text,correlation,jsonb_build_object('source_id',p_source_id,'kind',p_kind,'locale',p_locale,'source_hash',p_source_hash,'pdf_sha256',p_pdf_sha256),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_provider_organization_id,'provider_billing_document_artifact',result.id::text,'ProviderBillingPdfArchivedV1',correlation,jsonb_build_object('artifact_id',result.id,'source_id',p_source_id,'kind',p_kind,'locale',p_locale,'pdf_sha256',p_pdf_sha256),'provider-billing-pdf:'||p_kind||':'||p_source_id::text||':'||p_locale);
 end if;
 select * into result from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and locale=p_locale;
 return jsonb_build_object('storage_path',result.storage_path,'pdf_sha256',result.pdf_sha256);
end$$;

create function public.complete_provider_billing_document_issue(p_kind text,p_source_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare sourcehash text;org uuid;artifact uuid;
begin
 if auth.role()is distinct from'service_role'then raise exception'BILLING_DOCUMENT_ISSUE_DENIED'using errcode='42501';end if;
 if p_kind='invoice'then select document_hash,provider_organization_id into sourcehash,org from public.provider_invoices where id=p_source_id;
 elsif p_kind='statement'then select document_hash,provider_organization_id into sourcehash,org from public.provider_statements where id=p_source_id;
 else raise exception'INVALID_BILLING_DOCUMENT_KIND'using errcode='22023';end if;
 if sourcehash is null or(select count(*)from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and provider_organization_id=org and source_hash=sourcehash and locale in('fr','ar'))<>2 then raise exception'BILLING_TRANSLATIONS_NOT_ARCHIVED'using errcode='55000';end if;
 select id into artifact from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and locale='fr';
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'provider_billing_document',p_source_id::text,'ProviderBillingDocumentsReadyV1',p_correlation_id,jsonb_build_object('artifact_id',artifact,'kind',p_kind,'source_id',p_source_id),'provider-billing-documents-ready:'||p_kind||':'||p_source_id::text)on conflict do nothing;
 return jsonb_build_object('outcome','PROVIDER_BILLING_DOCUMENTS_READY','artifact_id',artifact);
end$$;
revoke all on function public.complete_provider_billing_document_issue(text,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.complete_provider_billing_document_issue(text,uuid,uuid)to service_role;
-- Historical issued sources observed by the old terminal consumer are explicitly scheduled for completion.
insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 select provider_organization_id,'provider_invoice',id::text,'ProviderInvoiceIssuedV1',extensions.gen_random_uuid(),jsonb_build_object('invoice_id',id),'provider-billing-pdf-backfill:invoice:'||id::text from public.provider_invoices i where not exists(select 1 from public.event_outbox e where e.organization_id=i.provider_organization_id and e.event_type='ProviderBillingDocumentsReadyV1'and e.aggregate_id=i.id::text)on conflict do nothing;
insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 select provider_organization_id,'provider_statement',id::text,'ProviderStatementIssuedV1',extensions.gen_random_uuid(),jsonb_build_object('statement_id',id),'provider-billing-pdf-backfill:statement:'||id::text from public.provider_statements s where not exists(select 1 from public.event_outbox e where e.organization_id=s.provider_organization_id and e.event_type='ProviderBillingDocumentsReadyV1'and e.aggregate_id=s.id::text)on conflict do nothing;

create or replace function public.enqueue_provider_billing_pdf_notification(p_artifact_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare artifact public.provider_billing_document_artifacts%rowtype;recipient uuid;recipient_locale text;
begin
 if auth.role()is distinct from'service_role'then raise exception'PROVIDER_BILLING_NOTIFICATION_DENIED'using errcode='42501';end if;
 select * into artifact from public.provider_billing_document_artifacts where id=p_artifact_id;
 if not found then raise exception'PROVIDER_BILLING_ARTIFACT_NOT_FOUND'using errcode='P0002';end if;
 -- An arbitrary accounting email never grants access. Only a verified active billing member receives the link.
 select om.user_id,case when coalesce(u.raw_user_meta_data->>'locale','fr')in('ar','ar-MA')then'ar'else'fr'end into recipient,recipient_locale from public.organization_memberships om
 join auth.users u on u.id=om.user_id and u.email_confirmed_at is not null
 join public.provider_profiles p on p.provider_organization_id=om.organization_id
 where om.organization_id=artifact.provider_organization_id and om.status='ACTIVE'
 and exists(select 1 from public.organization_member_roles r where r.membership_id=om.id and r.revoked_at is null and r.role_code in('PROVIDER_OWNER','PROVIDER_ACCOUNTING'))
 order by (lower(u.email)=lower(p.accounting_contact_email::text))desc nulls last,
  exists(select 1 from public.organization_member_roles r where r.membership_id=om.id and r.revoked_at is null and r.role_code='PROVIDER_OWNER')desc,om.user_id limit 1;
 if recipient is null then raise exception'PROVIDER_BILLING_VERIFIED_RECIPIENT_REQUIRED'using errcode='55000';end if;
 select * into artifact from public.provider_billing_document_artifacts where provider_billing_document_artifacts.kind=artifact.kind and provider_billing_document_artifacts.source_id=artifact.source_id and provider_billing_document_artifacts.locale=recipient_locale;
 if not found then raise exception'BILLING_RECIPIENT_TRANSLATION_NOT_ARCHIVED'using errcode='55000';end if;
 return public.enqueue_notification(recipient,artifact.provider_organization_id,'PROVIDER_BILLING_PDF','ProviderBillingPdfReadyV1',artifact.locale||'-MA',jsonb_build_object('number',artifact.snapshot->>'number','kind',artifact.kind,'source_id',artifact.source_id::text,'locale',artifact.locale),'provider-billing-pdf-ready:'||artifact.kind||':'||artifact.source_id::text,'provider_billing_document_artifact',artifact.id::text,p_correlation_id);
end$$;
notify pgrst,'reload schema';
