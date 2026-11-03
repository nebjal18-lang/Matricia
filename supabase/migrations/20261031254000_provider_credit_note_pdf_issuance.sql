-- Credit notes preserve the original invoice issuer/recipient and share the approved CREDIT_NOTE sequence.
alter table public.provider_billing_source_policy_bindings drop constraint provider_billing_source_policy_bindings_kind_check;
alter table public.provider_billing_source_policy_bindings add check(kind in('invoice','statement','credit_note'));
alter table public.provider_billing_document_artifacts drop constraint provider_billing_document_artifacts_kind_check;
alter table public.provider_billing_document_artifacts add check(kind in('invoice','statement','credit_note'));
grant select on public.provider_credit_notes to service_role;
alter function public.issue_provider_credit_note(uuid,text,date,bigint,bigint,text,text,uuid)rename to issue_provider_credit_note_pre_policy_v1;
revoke all on function public.issue_provider_credit_note_pre_policy_v1(uuid,text,date,bigint,bigint,text,text,uuid)from public,anon,authenticated,service_role;
create or replace function public.issue_provider_credit_note_pre_policy_v1(
  p_invoice_id uuid,
  p_credit_number text,
  p_issued_on date,
  p_subtotal_minor bigint,
  p_tax_minor bigint,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  invoice public.provider_invoices%rowtype;
  hashed text;
  cached jsonb;
  note uuid;
  journal uuid := extensions.gen_random_uuid();
  receivable uuid;
  revenue uuid;
  tax_account uuid;
  already bigint;
  already_subtotal numeric;
  already_tax numeric;
  source_rule uuid;
  resolved jsonb;
  tax_minor bigint;
begin
  select * into invoice from public.provider_invoices where id = p_invoice_id for update;
  if actor is null or not found or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'], actor) then
    raise exception 'PROVIDER_CREDIT_NOTE_DENIED' using errcode = '42501';
  end if;
  if p_subtotal_minor < 0 or p_subtotal_minor > invoice.subtotal_minor or p_issued_on < invoice.issued_on or length(btrim(p_reason)) < 10 then
    raise exception 'INVALID_CREDIT_NOTE' using errcode = '22023';
  end if;
  select coalesce(sum(n.subtotal_minor),0),coalesce(sum(n.tax_minor),0)into already_subtotal,already_tax from public.provider_credit_notes n where n.invoice_id=invoice.id;
  if already_subtotal+p_subtotal_minor>invoice.subtotal_minor then raise exception 'CREDIT_NOTE_EXCEEDS_INVOICE'using errcode='23514';end if;
  if invoice.tax_minor=0 or invoice.subtotal_minor=0 or p_subtotal_minor=0 then tax_minor:=0;
  else
    source_rule:=nullif(invoice.tax_rule_snapshot->0->>'tax_rule_version_id','')::uuid;
    if source_rule is null then raise exception'CREDIT_NOTE_SOURCE_RULE_REQUIRED'using errcode='22023';end if;
    -- Validate the original rule as of the original invoice; a later expiry does not rewrite a past tax snapshot.
    resolved:=private.resolve_morocco_tax('CREDIT_NOTE',invoice.issued_on,-p_subtotal_minor,source_rule);
    tax_minor:=floor((already_subtotal+p_subtotal_minor)*invoice.tax_minor::numeric/invoice.subtotal_minor::numeric+0.5)::bigint-already_tax::bigint;
  end if;
  if tax_minor<0 then raise exception'CREDIT_NOTE_LEGACY_TAX_REVIEW_REQUIRED'using errcode='55000';end if;
  -- p_tax_minor is retained for signature stability; the versioned engine is authoritative.
  if p_subtotal_minor + tax_minor <= 0 or tax_minor > invoice.tax_minor then
    raise exception 'INVALID_CREDIT_NOTE' using errcode = '22023';
  end if;
  already := private.provider_invoice_credited_minor(invoice.id);
  if already + p_subtotal_minor + tax_minor > invoice.total_minor then
    raise exception 'CREDIT_NOTE_EXCEEDS_INVOICE' using errcode = '23514';
  end if;
  select e.account_id into receivable from public.financial_entries e where e.journal_id = invoice.journal_id and e.direction = 'DEBIT' and e.amount_minor = invoice.total_minor limit 1;
  select e.account_id into revenue from public.financial_entries e where e.journal_id = invoice.journal_id and e.direction = 'CREDIT' and e.amount_minor = invoice.subtotal_minor limit 1;
  if invoice.tax_minor > 0 then
    select e.account_id into tax_account from public.financial_entries e where e.journal_id = invoice.journal_id and e.direction = 'CREDIT' and e.amount_minor = invoice.tax_minor limit 1;
  end if;
  if receivable is null or (p_subtotal_minor > 0 and revenue is null) or (tax_minor > 0 and tax_account is null) then
    raise exception 'INVALID_PROVIDER_LEDGER_ACCOUNT' using errcode = '23514';
  end if;
  hashed := private.canonical_request_hash(jsonb_build_object('invoice', invoice.id, 'number', p_credit_number, 'issued', p_issued_on, 'subtotal', p_subtotal_minor, 'tax', tax_minor, 'reason', btrim(p_reason)));
  cached := private.begin_provider_billing_command(invoice.provider_organization_id, 'provider.billing.credit_note.issue', p_idempotency_key, hashed, actor);
  if cached is not null then return cached; end if;
  insert into public.financial_journals(id, organization_id, journal_type, currency, idempotency_scope, idempotency_key, correlation_id, effective_at, description, created_by)
  values (journal, invoice.provider_organization_id, 'PROVIDER_CREDIT_NOTE', invoice.currency, 'provider.billing.credit_note.issue', p_idempotency_key, p_correlation_id, p_issued_on::timestamptz, 'Provider credit note '||p_credit_number, actor);
  insert into public.financial_entries(organization_id, journal_id, account_id, direction, amount_minor, currency)
  values (invoice.provider_organization_id, journal, receivable, 'CREDIT', p_subtotal_minor + tax_minor, invoice.currency);
  if p_subtotal_minor > 0 then
    insert into public.financial_entries(organization_id, journal_id, account_id, direction, amount_minor, currency)
    values (invoice.provider_organization_id, journal, revenue, 'DEBIT', p_subtotal_minor, invoice.currency);
  end if;
  if tax_minor > 0 then
    insert into public.financial_entries(organization_id, journal_id, account_id, direction, amount_minor, currency)
    values (invoice.provider_organization_id, journal, tax_account, 'DEBIT', tax_minor, invoice.currency);
  end if;
  insert into public.provider_credit_notes(provider_organization_id, invoice_id, credit_number, currency, subtotal_minor, tax_minor, total_minor, reason, issued_on, journal_id, document_hash, correlation_id, created_by)
  values (invoice.provider_organization_id, invoice.id, p_credit_number, invoice.currency, p_subtotal_minor, tax_minor, p_subtotal_minor + tax_minor, btrim(p_reason), p_issued_on, journal, hashed, p_correlation_id, actor)
  returning id into note;
  cached := jsonb_build_object('outcome', 'PROVIDER_CREDIT_NOTE_ISSUED', 'credit_note_id', note, 'invoice_id', invoice.id, 'journal_id', journal, 'subtotal_minor', p_subtotal_minor, 'tax_minor', tax_minor, 'total_minor', p_subtotal_minor + tax_minor, 'tax_rule_version_id', source_rule);
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (invoice.provider_organization_id, actor, 'USER', 'provider.credit_note.issued', 'provider_credit_note', note::text, p_correlation_id, cached, repeat('0', 64));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (invoice.provider_organization_id, 'provider_credit_note', note::text, 'ProviderCreditNoteIssuedV1', p_correlation_id, cached, p_idempotency_key);
  perform private.finish_provider_billing_command(invoice.provider_organization_id, 'provider.billing.credit_note.issue', p_idempotency_key, cached);
  return cached;
end$$;

create function public.issue_provider_credit_note(p_invoice_id uuid,p_credit_number text,p_issued_on date,p_subtotal_minor bigint,p_tax_minor bigint,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare invoice public.provider_invoices%rowtype;binding public.provider_billing_source_policy_bindings%rowtype;source public.provider_credit_notes%rowtype;r jsonb;h text;number text;
begin
 select*into invoice from public.provider_invoices where id=p_invoice_id for update;
 if invoice.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'],auth.uid())then raise exception'PROVIDER_CREDIT_NOTE_DENIED'using errcode='42501';end if;
 if p_credit_number is distinct from'AUTO'then raise exception'GOVERNED_CREDIT_NUMBER_REQUIRED'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('invoice',p_invoice_id,'issued',p_issued_on,'subtotal',p_subtotal_minor,'reason',btrim(p_reason)));
 r:=private.begin_provider_billing_command(invoice.provider_organization_id,'provider.billing.governed.credit.issue',p_idempotency_key,h,auth.uid());if r is not null then return r;end if;
 select*into binding from public.provider_billing_source_policy_bindings where kind='invoice'and source_id=invoice.id and source_hash=invoice.document_hash and provider_organization_id=invoice.provider_organization_id;
 if not found then raise exception'BILLING_ORIGINAL_INVOICE_POLICY_REQUIRED'using errcode='55000';end if;
 number:=private.allocate_billing_document_number_v1(binding.policy_id,'CREDIT_NOTE',p_issued_on);
 r:=public.issue_provider_credit_note_pre_policy_v1(invoice.id,number,p_issued_on,p_subtotal_minor,p_tax_minor,p_reason,'governed:'||p_idempotency_key,p_correlation_id);
 select*into source from public.provider_credit_notes where id=(r->>'credit_note_id')::uuid;
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(source.provider_organization_id,'credit_note',source.id,source.document_hash,binding.policy_id,binding.policy_snapshot||jsonb_build_object('original_invoice_id',invoice.id,'original_invoice_number',invoice.invoice_number,'original_invoice_hash',invoice.document_hash),source.credit_number,source.issued_on,auth.uid());
 r:=r||jsonb_build_object('credit_number',source.credit_number,'document_status','EDITION_PENDING');
 perform private.finish_provider_billing_command(source.provider_organization_id,'provider.billing.governed.credit.issue',p_idempotency_key,r);return r;
end$$;
revoke all on function public.issue_provider_credit_note(uuid,text,date,bigint,bigint,text,text,uuid)from public,anon,service_role;
grant execute on function public.issue_provider_credit_note(uuid,text,date,bigint,bigint,text,text,uuid)to authenticated;

create or replace function public.get_provider_billing_source_policy(p_kind text,p_source_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare binding public.provider_billing_source_policy_bindings%rowtype;expected text;
begin
 if auth.role()is distinct from'service_role'then raise exception'BILLING_SOURCE_POLICY_DENIED'using errcode='42501';end if;
 select*into binding from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=p_source_id;
 if not found then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 if p_kind='invoice'then select document_hash into expected from public.provider_invoices where id=p_source_id and provider_organization_id=binding.provider_organization_id;
 elsif p_kind='credit_note'then select document_hash into expected from public.provider_credit_notes where id=p_source_id and provider_organization_id=binding.provider_organization_id;
 elsif p_kind='statement'then select document_hash into expected from public.provider_statements where id=p_source_id and provider_organization_id=binding.provider_organization_id;
 else raise exception'INVALID_BILLING_DOCUMENT_KIND'using errcode='22023';end if;
 if expected is distinct from binding.source_hash then raise exception'BILLING_SOURCE_POLICY_HASH_MISMATCH'using errcode='22000';end if;
 return binding.policy_snapshot||jsonb_build_object('policy_binding_id',binding.id,'document_number',binding.document_number,'document_issued_on',binding.issued_on::text,'source_hash',binding.source_hash);
end$$;

create or replace function public.register_provider_billing_document_artifact(p_provider_organization_id uuid,p_kind text,p_source_id uuid,p_locale text,p_source_hash text,p_pdf_sha256 text,p_storage_path text,p_snapshot jsonb,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare result public.provider_billing_document_artifacts%rowtype;expected text;source_actor uuid;source_total text;source_subtotal text;source_tax text;source_currency text;binding public.provider_billing_source_policy_bindings%rowtype;correlation uuid:=extensions.gen_random_uuid();
begin
 if auth.role() is distinct from 'service_role'then raise exception'BILLING_ARTIFACT_DENIED'using errcode='42501';end if;
 if p_kind='invoice'then select document_hash,created_by,total_minor::text,subtotal_minor::text,tax_minor::text,currency::text into expected,source_actor,source_total,source_subtotal,source_tax,source_currency from public.provider_invoices where id=p_source_id and provider_organization_id=p_provider_organization_id;
 elsif p_kind='credit_note'then select document_hash,created_by,total_minor::text,subtotal_minor::text,tax_minor::text,currency::text into expected,source_actor,source_total,source_subtotal,source_tax,source_currency from public.provider_credit_notes where id=p_source_id and provider_organization_id=p_provider_organization_id;
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
 if p_kind='credit_note'and(p_snapshot->>'originalInvoiceNumber')is distinct from(binding.policy_snapshot->>'original_invoice_number')then raise exception'BILLING_CREDIT_ORIGINAL_REFERENCE_MISMATCH'using errcode='22000';end if;
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
 elsif p_kind='credit_note'then select document_hash,provider_organization_id into sourcehash,org from public.provider_credit_notes where id=p_source_id;
 elsif p_kind='statement'then select document_hash,provider_organization_id into sourcehash,org from public.provider_statements where id=p_source_id;
 else raise exception'INVALID_BILLING_DOCUMENT_KIND'using errcode='22023';end if;
 select id into binding from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=p_source_id and source_hash=sourcehash and provider_organization_id=org;
 if binding is null or sourcehash is null or(select count(*)from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and provider_organization_id=org and source_hash=sourcehash and locale in('fr','ar')and policy_binding_id=binding)<>2 then raise exception'BILLING_TRANSLATIONS_NOT_ARCHIVED'using errcode='55000';end if;
 select id into artifact from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and locale='fr'and policy_binding_id=binding;
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values(org,'provider_billing_document',p_source_id::text,'ProviderBillingDocumentsReadyV1',p_correlation_id,jsonb_build_object('artifact_id',artifact,'kind',p_kind,'source_id',p_source_id),'provider-billing-documents-ready:'||p_kind||':'||p_source_id::text||':'||binding::text,binding)on conflict do nothing;
 return jsonb_build_object('outcome','PROVIDER_BILLING_DOCUMENTS_READY','artifact_id',artifact);
end$$;

create or replace function public.get_provider_billing_document_states(p_provider_organization_id uuid,p_kind text,p_source_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$begin
 if not coalesce(private.provider_billing_access(p_provider_organization_id,auth.uid()),false)then raise exception'BILLING_DOCUMENT_STATES_DENIED'using errcode='42501';end if;
 if p_kind is null or p_kind not in('invoice','statement','credit_note')or p_source_ids is null or cardinality(p_source_ids)>100 then raise exception'INVALID_BILLING_DOCUMENT_STATES'using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('source_id',source.id,'status',case when not exists(select 1 from public.provider_billing_source_policy_bindings b where b.kind=p_kind and b.source_id=source.id and b.provider_organization_id=p_provider_organization_id)then'LEGACY_REVIEW_REQUIRED'when(select count(*)from public.provider_billing_document_artifacts a where a.kind=p_kind and a.source_id=source.id and a.provider_organization_id=p_provider_organization_id and a.locale in('fr','ar')and a.policy_binding_id=(select id from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=source.id))=2 then'READY'else'EDITION_PENDING'end))from(select id from public.provider_invoices where p_kind='invoice'and provider_organization_id=p_provider_organization_id and id=any(p_source_ids)union all select id from public.provider_statements where p_kind='statement'and provider_organization_id=p_provider_organization_id and id=any(p_source_ids)union all select id from public.provider_credit_notes where p_kind='credit_note'and provider_organization_id=p_provider_organization_id and id=any(p_source_ids))source),'[]'::jsonb);
end$$;

create or replace function public.adopt_legacy_provider_billing_source_policy(p_kind text,p_source_id uuid,p_reason text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare org uuid;creator uuid;number text;sourcehash text;issued date;currency char(3);policy jsonb;binding uuid;legacy_sequence bigint;original_invoice uuid;original_binding public.provider_billing_source_policy_bindings%rowtype;
begin
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid())then raise exception'BILLING_SOURCE_ADOPTION_DENIED'using errcode='42501';end if;
 if p_kind='invoice'then select provider_organization_id,created_by,invoice_number,document_hash,issued_on,provider_invoices.currency into org,creator,number,sourcehash,issued,currency from public.provider_invoices where id=p_source_id for update;
 elsif p_kind='credit_note'then select provider_organization_id,created_by,credit_number,document_hash,issued_on,provider_credit_notes.currency,invoice_id into org,creator,number,sourcehash,issued,currency,original_invoice from public.provider_credit_notes where id=p_source_id for update;
 elsif p_kind='statement'then select provider_organization_id,created_by,statement_number,document_hash,(issued_at at time zone'Africa/Casablanca')::date,provider_statements.currency into org,creator,number,sourcehash,issued,currency from public.provider_statements where id=p_source_id for update;
 else raise exception'INVALID_BILLING_DOCUMENT_KIND'using errcode='22023';end if;
 if org is null or creator=auth.uid()or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 then raise exception'BILLING_SOURCE_ADOPTION_REQUIRES_INDEPENDENT_REVIEW'using errcode='42501';end if;
 if p_kind='credit_note'then select*into original_binding from public.provider_billing_source_policy_bindings where kind='invoice'and source_id=original_invoice and provider_organization_id=org;if not found then raise exception'BILLING_ORIGINAL_INVOICE_POLICY_REQUIRED'using errcode='55000';end if;policy:=original_binding.policy_snapshot||jsonb_build_object('original_invoice_id',original_invoice,'original_invoice_number',original_binding.document_number,'original_invoice_hash',original_binding.source_hash);else policy:=private.approved_billing_policy_snapshot(currency,issued);end if;if policy is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 if p_kind in('invoice','credit_note')then
 if number!~('^'||(policy->>case p_kind when'credit_note'then'credit_prefix'else'invoice_prefix'end)||'-'||extract(year from issued)::text||'-[0-9]{8,18}$')then raise exception'LEGACY_INVOICE_NUMBERING_REVIEW_REQUIRED'using errcode='55000';end if;
 legacy_sequence:=split_part(number,'-',3)::bigint;
 if legacy_sequence<1 then raise exception'LEGACY_INVOICE_NUMBERING_REVIEW_REQUIRED'using errcode='55000';end if;
 insert into private.billing_document_counters as counter(series_key,document_kind,fiscal_year,last_number)values(policy->>'series_key',case p_kind when'credit_note'then'CREDIT_NOTE'else'INVOICE'end,extract(year from issued)::integer,legacy_sequence)on conflict(series_key,document_kind,fiscal_year)do update set last_number=greatest(counter.last_number,excluded.last_number);
 end if;
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(org,p_kind,p_source_id,sourcehash,(policy->>'policy_id')::uuid,case p_kind when'credit_note'then policy else policy||jsonb_build_object('recipient_snapshot',private.provider_billing_recipient_snapshot(org))end,number,issued,auth.uid())on conflict(kind,source_id)do nothing returning id into binding;
 if binding is not null then
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,auth.uid(),'USER','provider.billing.legacy_source.adopted','provider_billing_source_policy_binding',binding::text,p_correlation_id,jsonb_build_object('source_id',p_source_id,'kind',p_kind,'policy_id',policy->>'policy_id','reason',btrim(p_reason)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,case p_kind when'invoice'then'provider_invoice'when'credit_note'then'provider_credit_note'else'provider_statement'end,p_source_id::text,case p_kind when'invoice'then'ProviderInvoiceIssuedV1'when'credit_note'then'ProviderCreditNoteIssuedV1'else'ProviderStatementIssuedV1'end,p_correlation_id,case p_kind when'invoice'then jsonb_build_object('invoice_id',p_source_id)when'credit_note'then jsonb_build_object('credit_note_id',p_source_id)else jsonb_build_object('statement_id',p_source_id)end,'provider-billing-adopted:'||p_kind||':'||p_source_id::text);
 end if;return jsonb_build_object('outcome','PROVIDER_BILLING_SOURCE_POLICY_ADOPTED');
end$$;
notify pgrst,'reload schema';
