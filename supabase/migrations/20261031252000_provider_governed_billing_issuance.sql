-- Shared approved issuer/numbering policy (251000) governs new Provider commission documents.
-- Commission tax remains the immutable Morocco tax-rule snapshot, never the Client subscription tax rate.
create table public.provider_billing_source_policy_bindings(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),kind text not null check(kind in('invoice','statement')),
 source_id uuid not null,source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),policy_id uuid not null references public.client_billing_policy_versions(id),policy_snapshot jsonb not null check(jsonb_typeof(policy_snapshot)='object'),document_number text not null,issued_on date not null,
 bound_by uuid not null references auth.users(id),bound_at timestamptz not null default clock_timestamp(),unique(kind,source_id)
);
alter table public.provider_billing_source_policy_bindings enable row level security;
revoke all on public.provider_billing_source_policy_bindings from public,anon,authenticated,service_role;
grant select on public.provider_billing_source_policy_bindings to authenticated;
create policy provider_billing_policy_binding_read on public.provider_billing_source_policy_bindings for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid()));
create trigger provider_billing_policy_binding_immutable before update or delete on public.provider_billing_source_policy_bindings for each row execute function private.prevent_update_delete();
alter table public.provider_billing_document_artifacts add column policy_binding_id uuid references public.provider_billing_source_policy_bindings(id);
alter table public.provider_billing_document_artifacts drop constraint provider_billing_document_artifacts_kind_source_id_locale_key;
alter table public.provider_billing_document_artifacts add constraint provider_billing_artifact_policy_locale_key unique(kind,source_id,locale,policy_binding_id);
-- Freeze the recipient alongside the issuer; later organization edits cannot alter a rendered edition.
create function private.provider_billing_recipient_snapshot(p_org uuid)returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('legal_name',o.legal_name,'country_code',o.country_code,'identifiers',coalesce((select jsonb_object_agg(identifier_type,normalized_value::text)from public.organization_identifiers where organization_id=o.id and is_active and verification_status='VERIFIED'),'{}'::jsonb))from public.organizations o where o.id=p_org
$$;
revoke all on function private.provider_billing_recipient_snapshot(uuid)from public,anon,authenticated,service_role;
alter function public.issue_provider_statement(uuid,text,date,date,character,text,uuid)rename to issue_provider_statement_pre_policy_v1;
revoke all on function public.issue_provider_statement_pre_policy_v1(uuid,text,date,date,character,text,uuid)from public,anon,authenticated,service_role;
create function public.issue_provider_statement(p_provider_organization_id uuid,p_statement_number text,p_period_start date,p_period_end date,p_currency char(3),p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare h text;r jsonb;policy jsonb;source public.provider_statements%rowtype;issued date:=(clock_timestamp()at time zone'Africa/Casablanca')::date;
begin
 if not private.provider_billing_write_access(p_provider_organization_id,auth.uid())then raise exception'PROVIDER_STATEMENT_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('org',p_provider_organization_id,'number',p_statement_number,'start',p_period_start,'end',p_period_end,'currency',p_currency));
 r:=private.begin_provider_billing_command(p_provider_organization_id,'provider.billing.governed.statement.issue',p_idempotency_key,h,auth.uid());if r is not null then return r;end if;
 policy:=private.approved_billing_policy_snapshot(p_currency,issued);if policy is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 r:=public.issue_provider_statement_pre_policy_v1(p_provider_organization_id,p_statement_number,p_period_start,p_period_end,p_currency,'governed:'||p_idempotency_key,p_correlation_id);
 select*into source from public.provider_statements where id=(r->>'statement_id')::uuid;
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(p_provider_organization_id,'statement',source.id,source.document_hash,(policy->>'policy_id')::uuid,policy||jsonb_build_object('recipient_snapshot',private.provider_billing_recipient_snapshot(p_provider_organization_id)),source.statement_number,issued,auth.uid());
 r:=r||jsonb_build_object('document_status','EDITION_PENDING','statement_number',source.statement_number,'policy_id',policy->>'policy_id');
 perform private.finish_provider_billing_command(p_provider_organization_id,'provider.billing.governed.statement.issue',p_idempotency_key,r);return r;
end$$;
alter function public.issue_provider_invoice(uuid,text,date,date,uuid,uuid,uuid,text,uuid)rename to issue_provider_invoice_pre_policy_v1;
revoke all on function public.issue_provider_invoice_pre_policy_v1(uuid,text,date,date,uuid,uuid,uuid,text,uuid)from public,anon,authenticated,service_role;
create function public.issue_provider_invoice(p_statement_id uuid,p_invoice_number text,p_issued_on date,p_due_on date,p_receivable_account_id uuid,p_revenue_account_id uuid,p_tax_liability_account_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare statement public.provider_statements%rowtype;source public.provider_invoices%rowtype;policy jsonb;number text;h text;r jsonb;
begin
 select*into statement from public.provider_statements where id=p_statement_id;
 if not found or not private.provider_billing_write_access(statement.provider_organization_id,auth.uid())then raise exception'PROVIDER_INVOICE_DENIED'using errcode='42501';end if;
 if p_invoice_number is distinct from'AUTO'then raise exception'GOVERNED_INVOICE_NUMBER_REQUIRED'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('statement',p_statement_id,'issued',p_issued_on,'due',p_due_on,'receivable',p_receivable_account_id,'revenue',p_revenue_account_id,'tax',p_tax_liability_account_id));
 r:=private.begin_provider_billing_command(statement.provider_organization_id,'provider.billing.governed.invoice.issue',p_idempotency_key,h,auth.uid());if r is not null then return r;end if;
 policy:=private.approved_billing_policy_snapshot(statement.currency,p_issued_on);if policy is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 number:=private.allocate_billing_document_number_v1((policy->>'policy_id')::uuid,'INVOICE',p_issued_on);
 r:=public.issue_provider_invoice_pre_policy_v1(p_statement_id,number,p_issued_on,p_due_on,p_receivable_account_id,p_revenue_account_id,p_tax_liability_account_id,'governed:'||p_idempotency_key,p_correlation_id);
 select*into source from public.provider_invoices where id=(r->>'invoice_id')::uuid;
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(source.provider_organization_id,'invoice',source.id,source.document_hash,(policy->>'policy_id')::uuid,policy||jsonb_build_object('recipient_snapshot',private.provider_billing_recipient_snapshot(source.provider_organization_id)),source.invoice_number,source.issued_on,auth.uid());
 r:=r||jsonb_build_object('document_status','EDITION_PENDING','invoice_number',source.invoice_number,'policy_id',policy->>'policy_id');
 perform private.finish_provider_billing_command(source.provider_organization_id,'provider.billing.governed.invoice.issue',p_idempotency_key,r);return r;
end$$;
revoke all on function public.issue_provider_statement(uuid,text,date,date,character,text,uuid),public.issue_provider_invoice(uuid,text,date,date,uuid,uuid,uuid,text,uuid)from public,anon,service_role;
grant execute on function public.issue_provider_statement(uuid,text,date,date,character,text,uuid),public.issue_provider_invoice(uuid,text,date,date,uuid,uuid,uuid,text,uuid)to authenticated;
create function public.get_provider_billing_source_policy(p_kind text,p_source_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare binding public.provider_billing_source_policy_bindings%rowtype;expected text;
begin
 if auth.role()is distinct from'service_role'then raise exception'BILLING_SOURCE_POLICY_DENIED'using errcode='42501';end if;
 select*into binding from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=p_source_id;
 if not found then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 if p_kind='invoice'then select document_hash into expected from public.provider_invoices where id=p_source_id and provider_organization_id=binding.provider_organization_id;
 elsif p_kind='statement'then select document_hash into expected from public.provider_statements where id=p_source_id and provider_organization_id=binding.provider_organization_id;
 else raise exception'INVALID_BILLING_DOCUMENT_KIND'using errcode='22023';end if;
 if expected is distinct from binding.source_hash then raise exception'BILLING_SOURCE_POLICY_HASH_MISMATCH'using errcode='22000';end if;
 return binding.policy_snapshot||jsonb_build_object('policy_binding_id',binding.id,'document_number',binding.document_number,'document_issued_on',binding.issued_on::text,'source_hash',binding.source_hash);
end$$;
revoke all on function public.get_provider_billing_source_policy(text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_provider_billing_source_policy(text,uuid)to service_role;
-- A legacy source remains readable as accounting evidence. It cannot acquire an invented fiscal identity.
create function public.adopt_legacy_provider_billing_source_policy(p_kind text,p_source_id uuid,p_reason text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare org uuid;creator uuid;number text;sourcehash text;issued date;currency char(3);policy jsonb;binding uuid;legacy_sequence bigint;
begin
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid())then raise exception'BILLING_SOURCE_ADOPTION_DENIED'using errcode='42501';end if;
 if p_kind='invoice'then select provider_organization_id,created_by,invoice_number,document_hash,issued_on,provider_invoices.currency into org,creator,number,sourcehash,issued,currency from public.provider_invoices where id=p_source_id for update;
 elsif p_kind='statement'then select provider_organization_id,created_by,statement_number,document_hash,(issued_at at time zone'Africa/Casablanca')::date,provider_statements.currency into org,creator,number,sourcehash,issued,currency from public.provider_statements where id=p_source_id for update;
 else raise exception'INVALID_BILLING_DOCUMENT_KIND'using errcode='22023';end if;
 if org is null or creator=auth.uid()or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 then raise exception'BILLING_SOURCE_ADOPTION_REQUIRES_INDEPENDENT_REVIEW'using errcode='42501';end if;
 policy:=private.approved_billing_policy_snapshot(currency,issued);if policy is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 if p_kind='invoice'then
 if number!~('^'||(policy->>'invoice_prefix')||'-'||extract(year from issued)::text||'-[0-9]{8,18}$')then raise exception'LEGACY_INVOICE_NUMBERING_REVIEW_REQUIRED'using errcode='55000';end if;
 legacy_sequence:=split_part(number,'-',3)::bigint;
 if legacy_sequence<1 then raise exception'LEGACY_INVOICE_NUMBERING_REVIEW_REQUIRED'using errcode='55000';end if;
 insert into private.billing_document_counters as counter(series_key,document_kind,fiscal_year,last_number)values(policy->>'series_key','INVOICE',extract(year from issued)::integer,legacy_sequence)on conflict(series_key,document_kind,fiscal_year)do update set last_number=greatest(counter.last_number,excluded.last_number);
 end if;
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(org,p_kind,p_source_id,sourcehash,(policy->>'policy_id')::uuid,policy||jsonb_build_object('recipient_snapshot',private.provider_billing_recipient_snapshot(org)),number,issued,auth.uid())on conflict(kind,source_id)do nothing returning id into binding;
 if binding is not null then
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,auth.uid(),'USER','provider.billing.legacy_source.adopted','provider_billing_source_policy_binding',binding::text,p_correlation_id,jsonb_build_object('source_id',p_source_id,'kind',p_kind,'policy_id',policy->>'policy_id','reason',btrim(p_reason)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,case p_kind when'invoice'then'provider_invoice'else'provider_statement'end,p_source_id::text,case p_kind when'invoice'then'ProviderInvoiceIssuedV1'else'ProviderStatementIssuedV1'end,p_correlation_id,case p_kind when'invoice'then jsonb_build_object('invoice_id',p_source_id)else jsonb_build_object('statement_id',p_source_id)end,'provider-billing-adopted:'||p_kind||':'||p_source_id::text);
 end if;return jsonb_build_object('outcome','PROVIDER_BILLING_SOURCE_POLICY_ADOPTED');
end$$;
revoke all on function public.adopt_legacy_provider_billing_source_policy(text,uuid,text,uuid)from public,anon,service_role;
grant execute on function public.adopt_legacy_provider_billing_source_policy(text,uuid,text,uuid)to authenticated;
create function public.get_provider_billing_document_states(p_provider_organization_id uuid,p_kind text,p_source_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$begin
 if not coalesce(private.provider_billing_access(p_provider_organization_id,auth.uid()),false)then raise exception'BILLING_DOCUMENT_STATES_DENIED'using errcode='42501';end if;
 if p_kind is null or p_kind not in('invoice','statement')or p_source_ids is null or cardinality(p_source_ids)>100 then raise exception'INVALID_BILLING_DOCUMENT_STATES'using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('source_id',source.id,'status',case when not exists(select 1 from public.provider_billing_source_policy_bindings b where b.kind=p_kind and b.source_id=source.id and b.provider_organization_id=p_provider_organization_id)then'LEGACY_REVIEW_REQUIRED'when(select count(*)from public.provider_billing_document_artifacts a where a.kind=p_kind and a.source_id=source.id and a.provider_organization_id=p_provider_organization_id and a.locale in('fr','ar')and a.policy_binding_id=(select id from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=source.id))=2 then'READY'else'EDITION_PENDING'end))from(select id from public.provider_invoices where p_kind='invoice'and provider_organization_id=p_provider_organization_id and id=any(p_source_ids)union all select id from public.provider_statements where p_kind='statement'and provider_organization_id=p_provider_organization_id and id=any(p_source_ids))source),'[]'::jsonb);
end$$;
revoke all on function public.get_provider_billing_document_states(uuid,text,uuid[])from public,anon,service_role;
grant execute on function public.get_provider_billing_document_states(uuid,text,uuid[])to authenticated;
create or replace function public.register_provider_billing_document_artifact(p_provider_organization_id uuid,p_kind text,p_source_id uuid,p_locale text,p_source_hash text,p_pdf_sha256 text,p_storage_path text,p_snapshot jsonb,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare result public.provider_billing_document_artifacts%rowtype;expected text;source_actor uuid;source_total text;source_subtotal text;source_tax text;source_currency text;binding public.provider_billing_source_policy_bindings%rowtype;correlation uuid:=extensions.gen_random_uuid();
begin
 if auth.role() is distinct from 'service_role'then raise exception'BILLING_ARTIFACT_DENIED'using errcode='42501';end if;
 if p_kind='invoice'then select document_hash,created_by,total_minor::text,subtotal_minor::text,tax_minor::text,currency::text into expected,source_actor,source_total,source_subtotal,source_tax,source_currency from public.provider_invoices where id=p_source_id and provider_organization_id=p_provider_organization_id;
 elsif p_kind='statement'then select document_hash,created_by,total_minor::text,subtotal_minor::text,tax_minor::text,currency::text into expected,source_actor,source_total,source_subtotal,source_tax,source_currency from public.provider_statements where id=p_source_id and provider_organization_id=p_provider_organization_id;
 else raise exception'INVALID_BILLING_ARTIFACT_KIND'using errcode='22023';end if;
 if not coalesce(private.provider_billing_access(p_provider_organization_id,p_actor_id),false)and p_actor_id is distinct from source_actor then raise exception'BILLING_ARTIFACT_DENIED'using errcode='42501';end if;
 if expected is null or expected<>p_source_hash or (p_snapshot->>'sourceHash') is distinct from expected then raise exception'BILLING_ARTIFACT_SOURCE_MISMATCH'using errcode='22000';end if;
 select*into binding from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=p_source_id and provider_organization_id=p_provider_organization_id and source_hash=expected;
 if not found or(p_snapshot->>'policyBindingId')is distinct from binding.id::text or(p_snapshot->>'policyContentHash')is distinct from(binding.policy_snapshot->>'content_hash')or(p_snapshot->>'number')is distinct from binding.document_number or(p_snapshot->>'issuedOn')is distinct from binding.issued_on::text
 or(p_snapshot#>>'{issuer,name}')is distinct from(binding.policy_snapshot#>>'{issuer_snapshot,legal_name}')or(p_snapshot#>>'{issuer,address}')is distinct from(binding.policy_snapshot#>>'{issuer_snapshot,address}')or(p_snapshot#>>'{issuer,ice}')is distinct from(binding.policy_snapshot#>>'{issuer_snapshot,ice}')or(p_snapshot#>>'{issuer,version}')is distinct from(binding.policy_snapshot->>'version')
 or(p_snapshot->>'recipient')is distinct from(binding.policy_snapshot#>>'{recipient_snapshot,legal_name}')
 or(p_snapshot#>>'{issuer,legalForm}')is distinct from(binding.policy_snapshot#>>'{issuer_snapshot,legal_form}')or(p_snapshot#>>'{issuer,ifNumber}')is distinct from(binding.policy_snapshot#>>'{issuer_snapshot,if_number}')or(p_snapshot#>>'{issuer,rcNumber}')is distinct from(binding.policy_snapshot#>>'{issuer_snapshot,rc_number}')or(p_snapshot#>>'{issuer,contactEmail}')is distinct from(binding.policy_snapshot#>>'{issuer_snapshot,contact_email}')then raise exception'BILLING_ARTIFACT_APPROVED_POLICY_REQUIRED'using errcode='55000';end if;
 if(p_snapshot->>'kind')is distinct from p_kind or(p_snapshot->>'currency')is distinct from source_currency or(p_snapshot->>'totalMinor')is distinct from source_total or jsonb_typeof(p_snapshot->'lines')is distinct from'array'or jsonb_array_length(p_snapshot->'lines')<>2 or(p_snapshot#>>'{lines,0,amountMinor}')is distinct from source_subtotal or(p_snapshot#>>'{lines,1,amountMinor}')is distinct from source_tax then raise exception'BILLING_ARTIFACT_FINANCIAL_SNAPSHOT_MISMATCH'using errcode='22000';end if;
 if p_storage_path is distinct from p_provider_organization_id::text||'/'||p_kind||'/'||p_source_id::text||'/'||p_locale||'/'||p_pdf_sha256||'.pdf'then raise exception'BILLING_ARTIFACT_PATH_MISMATCH'using errcode='22000';end if;
 if not exists(select 1 from storage.objects where bucket_id='provider-billing'and name=p_storage_path and metadata->>'mimetype'='application/pdf')then raise exception'BILLING_ARTIFACT_UPLOAD_REQUIRED'using errcode='23514';end if;
 insert into public.provider_billing_document_artifacts(provider_organization_id,kind,source_id,locale,source_hash,pdf_sha256,storage_path,snapshot,created_by,policy_binding_id)
 values(p_provider_organization_id,p_kind,p_source_id,p_locale,p_source_hash,p_pdf_sha256,p_storage_path,p_snapshot,p_actor_id,binding.id)on conflict(kind,source_id,locale,policy_binding_id)do nothing returning * into result;
 if found then
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_provider_organization_id,p_actor_id,'SERVICE','provider.billing.pdf.archived','provider_billing_document_artifact',result.id::text,correlation,jsonb_build_object('source_id',p_source_id,'kind',p_kind,'locale',p_locale,'source_hash',p_source_hash,'pdf_sha256',p_pdf_sha256),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_provider_organization_id,'provider_billing_document_artifact',result.id::text,'ProviderBillingPdfArchivedV1',correlation,jsonb_build_object('artifact_id',result.id,'source_id',p_source_id,'kind',p_kind,'locale',p_locale,'pdf_sha256',p_pdf_sha256),'provider-billing-pdf:'||p_kind||':'||p_source_id::text||':'||p_locale||':'||binding.id::text);
 end if;
 select * into result from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and locale=p_locale and policy_binding_id=binding.id;
 return jsonb_build_object('storage_path',result.storage_path,'pdf_sha256',result.pdf_sha256);
end$$;

create or replace function public.complete_provider_billing_document_issue(p_kind text,p_source_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare sourcehash text;org uuid;artifact uuid;binding uuid;
begin
 if auth.role()is distinct from'service_role'then raise exception'BILLING_DOCUMENT_ISSUE_DENIED'using errcode='42501';end if;
 if p_kind='invoice'then select document_hash,provider_organization_id into sourcehash,org from public.provider_invoices where id=p_source_id;
 elsif p_kind='statement'then select document_hash,provider_organization_id into sourcehash,org from public.provider_statements where id=p_source_id;
 else raise exception'INVALID_BILLING_DOCUMENT_KIND'using errcode='22023';end if;
 select id into binding from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=p_source_id and source_hash=sourcehash and provider_organization_id=org;
 if binding is null or sourcehash is null or(select count(*)from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and provider_organization_id=org and source_hash=sourcehash and locale in('fr','ar')and policy_binding_id=binding)<>2 then raise exception'BILLING_TRANSLATIONS_NOT_ARCHIVED'using errcode='55000';end if;
 select id into artifact from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and locale='fr'and policy_binding_id=binding;
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values(org,'provider_billing_document',p_source_id::text,'ProviderBillingDocumentsReadyV1',p_correlation_id,jsonb_build_object('artifact_id',artifact,'kind',p_kind,'source_id',p_source_id),'provider-billing-documents-ready:'||p_kind||':'||p_source_id::text||':'||binding::text,binding)on conflict do nothing;
 return jsonb_build_object('outcome','PROVIDER_BILLING_DOCUMENTS_READY','artifact_id',artifact);
end$$;
revoke all on function public.complete_provider_billing_document_issue(text,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.complete_provider_billing_document_issue(text,uuid,uuid)to service_role;

create or replace function public.enqueue_provider_billing_pdf_notification(p_artifact_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare artifact public.provider_billing_document_artifacts%rowtype;recipient uuid;recipient_locale text;
begin
 if auth.role()is distinct from'service_role'then raise exception'PROVIDER_BILLING_NOTIFICATION_DENIED'using errcode='42501';end if;
 select * into artifact from public.provider_billing_document_artifacts where id=p_artifact_id;
 if not found then raise exception'PROVIDER_BILLING_ARTIFACT_NOT_FOUND'using errcode='P0002';end if;
 if artifact.policy_binding_id is null then raise exception'BILLING_ARTIFACT_APPROVED_POLICY_REQUIRED'using errcode='55000';end if;
 -- An arbitrary accounting email never grants access. Only a verified active billing member receives the link.
 select om.user_id,case when coalesce(u.raw_user_meta_data->>'locale','fr')in('ar','ar-MA')then'ar'else'fr'end into recipient,recipient_locale from public.organization_memberships om
 join auth.users u on u.id=om.user_id and u.email_confirmed_at is not null
 join public.provider_profiles p on p.provider_organization_id=om.organization_id
 where om.organization_id=artifact.provider_organization_id and om.status='ACTIVE'
 and exists(select 1 from public.organization_member_roles r where r.membership_id=om.id and r.revoked_at is null and r.role_code in('PROVIDER_OWNER','PROVIDER_ACCOUNTING'))
 order by (lower(u.email)=lower(p.accounting_contact_email::text))desc nulls last,
  exists(select 1 from public.organization_member_roles r where r.membership_id=om.id and r.revoked_at is null and r.role_code='PROVIDER_OWNER')desc,om.user_id limit 1;
 if recipient is null then raise exception'PROVIDER_BILLING_VERIFIED_RECIPIENT_REQUIRED'using errcode='55000';end if;
 select * into artifact from public.provider_billing_document_artifacts where provider_billing_document_artifacts.kind=artifact.kind and provider_billing_document_artifacts.source_id=artifact.source_id and provider_billing_document_artifacts.locale=recipient_locale and provider_billing_document_artifacts.policy_binding_id=artifact.policy_binding_id;
 if not found then raise exception'BILLING_RECIPIENT_TRANSLATION_NOT_ARCHIVED'using errcode='55000';end if;
 return public.enqueue_notification(recipient,artifact.provider_organization_id,'PROVIDER_BILLING_PDF','ProviderBillingPdfReadyV1',artifact.locale||'-MA',jsonb_build_object('number',artifact.snapshot->>'number','kind',artifact.kind,'source_id',artifact.source_id::text,'locale',artifact.locale),'provider-billing-pdf-ready:'||artifact.kind||':'||artifact.source_id::text||':'||artifact.policy_binding_id::text,'provider_billing_document_artifact',artifact.id::text,p_correlation_id);
end$$;
notify pgrst,'reload schema';
