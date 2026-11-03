-- Financial recipients come from the contractual offer, never a later organization identity.
-- Historical attestations add evidence; issued statements/invoices/PDFs are never rewritten.
create table public.provider_billing_contract_recipient_reviews(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),contract_version_id uuid not null references public.contract_versions(id),source_contract_hash text not null check(source_contract_hash~'^[0-9a-f]{64}$'),
 recipient_snapshot jsonb not null check(jsonb_typeof(recipient_snapshot)='object'),evidence_document_version_id uuid not null references public.provider_document_versions(id),evidence_sha256 text not null check(evidence_sha256~'^[0-9a-f]{64}$'),reason text not null check(length(btrim(reason))between 10 and 1000),
 content_hash text not null check(content_hash~'^[0-9a-f]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),idempotency_key uuid not null,unique(provider_organization_id,idempotency_key)
);
create index provider_billing_recipient_review_contract_idx on public.provider_billing_contract_recipient_reviews(contract_version_id,created_at desc,id);
create table public.provider_billing_contract_recipient_decisions(
 review_id uuid primary key references public.provider_billing_contract_recipient_reviews(id),decision text not null check(decision in('APPROVED','REJECTED')),reason text not null check(length(btrim(reason))between 10 and 1000),decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp()
);
create table public.provider_invoice_recipient_correction_requests(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),original_invoice_id uuid not null references public.provider_invoices(id),source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),issued_on date not null,due_on date not null,transfer_paid_credit boolean not null,reason text not null check(length(btrim(reason))between 10 and 1000),requested_by uuid not null references auth.users(id),requested_at timestamptz not null default clock_timestamp(),idempotency_key uuid not null,unique(provider_organization_id,idempotency_key),check(due_on>=issued_on)
);
create table public.provider_invoice_recipient_correction_decisions(
 request_id uuid primary key references public.provider_invoice_recipient_correction_requests(id),decision text not null check(decision in('APPROVED','REJECTED')),reason text not null check(length(btrim(reason))between 10 and 1000),decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp(),response_body jsonb not null
);
create table public.provider_invoice_recipient_corrections(
 id uuid primary key references public.provider_invoice_recipient_correction_requests(id),provider_organization_id uuid not null references public.organizations(id),original_invoice_id uuid not null unique references public.provider_invoices(id),original_statement_id uuid not null references public.provider_statements(id),cancellation_credit_note_id uuid not null unique references public.provider_credit_notes(id),replacement_invoice_id uuid not null unique references public.provider_invoices(id),replacement_statement_id uuid not null unique references public.provider_statements(id),prior_credit_subtotal_minor bigint not null check(prior_credit_subtotal_minor>=0),prior_credit_tax_minor bigint not null check(prior_credit_tax_minor>=0),recipient_snapshot jsonb not null,source_snapshot_hash text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),check(original_invoice_id<>replacement_invoice_id)
);
create table public.provider_invoice_credit_transfers(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),source_invoice_id uuid not null references public.provider_invoices(id),target_invoice_id uuid not null references public.provider_invoices(id),correction_request_id uuid not null unique references public.provider_invoice_recipient_correction_requests(id),amount_minor bigint not null check(amount_minor>0),approved_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),unique(source_invoice_id,target_invoice_id),unique(target_invoice_id),check(source_invoice_id<>target_invoice_id)
);
create function private.provider_billing_legal_reviewer_v1()returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'],auth.uid())$$;
revoke all on function private.provider_billing_legal_reviewer_v1()from public,anon,authenticated,service_role;
do $$declare name text;begin foreach name in array array['provider_billing_contract_recipient_reviews','provider_billing_contract_recipient_decisions','provider_invoice_recipient_correction_requests','provider_invoice_recipient_correction_decisions','provider_invoice_recipient_corrections','provider_invoice_credit_transfers']loop
 execute format('alter table public.%I enable row level security',name);execute format('revoke all on public.%I from public,anon,authenticated,service_role',name);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',left(name,44)||'_immutable',name);
 end loop;end$$;
grant select on public.provider_invoice_recipient_corrections,public.provider_invoice_credit_transfers to authenticated;
create policy provider_invoice_correction_read on public.provider_invoice_recipient_corrections for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid()));
create policy provider_invoice_credit_transfer_read on public.provider_invoice_credit_transfers for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid()));
-- Finance can inspect the exact already-reviewed legal/fiscal evidence before a historical attestation.
create policy provider_finance_legal_family_read on public.provider_document_families for select to authenticated using(document_kind in('LEGAL','FISCAL')and private.provider_billing_legal_reviewer_v1());
create policy provider_finance_legal_version_read on public.provider_document_versions for select to authenticated using(private.provider_billing_legal_reviewer_v1()and exists(select 1 from public.provider_document_families f where f.id=family_id and f.document_kind in('LEGAL','FISCAL')));
create policy provider_finance_legal_scan_read on public.provider_document_scan_jobs for select to authenticated using(private.provider_billing_legal_reviewer_v1()and exists(select 1 from public.provider_document_versions v join public.provider_document_families f on f.id=v.family_id where v.storage_object_path=provider_document_scan_jobs.storage_object_path and f.document_kind in('LEGAL','FISCAL')));
create function private.normalize_provider_contract_recipient_v1(p_snapshot jsonb)returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare name text:=btrim(p_snapshot->>'legal_name');country text:=p_snapshot->>'country_code';identifiers jsonb:=p_snapshot->'identifiers';address text:=btrim(p_snapshot->>'registered_address');begin
 if jsonb_typeof(p_snapshot)is distinct from'object'or length(coalesce(name,''))not between 2 and 200 or coalesce(country,'')!~'^[A-Z]{2}$'or jsonb_typeof(identifiers)is distinct from'object'or coalesce(identifiers->>'ICE','')!~'^[0-9]{15}$'or coalesce(identifiers->>'IF','')!~'^[0-9]{6,20}$'or length(btrim(coalesce(identifiers->>'RC','')))not between 2 and 80 or length(coalesce(address,''))not between 5 and 1000 then return null;end if;
 return jsonb_build_object('legal_name',name,'country_code',country,'identifiers',jsonb_build_object('ICE',identifiers->>'ICE','IF',identifiers->>'IF','RC',identifiers->>'RC'),'registered_address',address);
end$$;
create function private.provider_contract_anchored_recipient_v1(p_contract_version_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v public.contract_versions%rowtype;party jsonb;anchor jsonb;begin
 select*into v from public.contract_versions where id=p_contract_version_id;
 select p.legal_snapshot into party from public.contract_parties p join public.contracts c on c.id=v.contract_id where p.contract_version_id=v.id and p.party_role='PROVIDER'and p.organization_id=c.provider_organization_id;
 if to_regprocedure('private.provider_quote_identity_snapshot_v1(uuid)')is null then return null;end if;
 execute'select private.provider_quote_identity_snapshot_v1($1)'into anchor using v.selected_quote_version_id;
 if anchor is null or party is distinct from anchor then return null;end if;
 return private.normalize_provider_contract_recipient_v1(party);
end$$;
create function private.provider_contract_recipient_snapshot_v1(p_contract_version_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare recipient jsonb;begin
 recipient:=private.provider_contract_anchored_recipient_v1(p_contract_version_id);if recipient is not null then return recipient;end if;
 select r.recipient_snapshot into recipient from public.provider_billing_contract_recipient_reviews r join public.provider_billing_contract_recipient_decisions d on d.review_id=r.id and d.decision='APPROVED'join public.contract_versions v on v.id=r.contract_version_id and v.content_hash=r.source_contract_hash join public.provider_document_versions document on document.id=r.evidence_document_version_id and document.provider_organization_id=r.provider_organization_id and document.content_hash=r.evidence_sha256 and document.status='VERIFIED'
 where r.contract_version_id=p_contract_version_id and private.provider_document_is_clean(document.storage_object_path,document.content_hash)order by d.decided_at desc,r.id desc limit 1;
 return recipient;
end$$;
create function private.provider_statement_contractual_recipient_v1(p_statement_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare recipient jsonb;previous jsonb;version uuid;original_statement uuid;begin
 select recipient_snapshot into recipient from public.provider_invoice_recipient_corrections where replacement_statement_id=p_statement_id;if found then return recipient;end if;
 for version in select distinct e.contract_version_id from public.provider_statement_lines l join public.provider_payable_events e on e.id=l.payable_event_id and e.provider_organization_id=l.provider_organization_id where l.statement_id=coalesce(original_statement,p_statement_id)and l.provider_organization_id=(select provider_organization_id from public.provider_statements where id=coalesce(original_statement,p_statement_id))loop
  recipient:=private.provider_contract_recipient_snapshot_v1(version);if recipient is null then return null;end if;
  if previous is not null and recipient is distinct from previous then raise exception'BILLING_MIXED_CONTRACT_RECIPIENTS'using errcode='55000';end if;previous:=recipient;
 end loop;return previous;
end$$;
create function private.provider_expected_billing_recipient_v1(p_kind text,p_source_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare statement uuid;invoice uuid;recipient jsonb;begin
 if p_kind='statement'then statement:=p_source_id;
 elsif p_kind='invoice'then select statement_id into statement from public.provider_invoices where id=p_source_id;
 elsif p_kind='credit_note'then select invoice_id into invoice from public.provider_credit_notes where id=p_source_id;select policy_snapshot->'recipient_snapshot'into recipient from public.provider_billing_source_policy_bindings where kind='invoice'and source_id=invoice;return recipient;
 else return null;end if;
 return private.provider_statement_contractual_recipient_v1(statement);
end$$;
create function public.request_provider_billing_recipient_review_v1(p_contract_version_id uuid,p_expected_contract_hash text,p_recipient_snapshot jsonb,p_evidence_document_version_id uuid,p_reason text,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v public.contract_versions%rowtype;org uuid;document public.provider_document_versions%rowtype;recipient jsonb;h text;prior public.provider_billing_contract_recipient_reviews%rowtype;review uuid;
begin
 if not private.provider_billing_legal_reviewer_v1()then raise exception'BILLING_RECIPIENT_REVIEW_DENIED'using errcode='42501';end if;
 select*into v from public.contract_versions where id=p_contract_version_id;select provider_organization_id into org from public.contracts where id=v.contract_id;
 if v.id is null or v.content_hash is distinct from p_expected_contract_hash then raise exception'BILLING_CONTRACT_SOURCE_CHANGED'using errcode='40001';end if;
 if private.provider_contract_anchored_recipient_v1(v.id)is not null then raise exception'ANCHORED_CONTRACT_RECIPIENT_IMMUTABLE'using errcode='55000';end if;
 recipient:=private.normalize_provider_contract_recipient_v1(p_recipient_snapshot);
 if recipient is null or p_idempotency_key is null or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 then raise exception'INVALID_BILLING_RECIPIENT_REVIEW'using errcode='22023';end if;
 select d.*into document from public.provider_document_versions d join public.provider_document_families f on f.id=d.family_id and f.document_kind in('LEGAL','FISCAL')where d.id=p_evidence_document_version_id and d.provider_organization_id=org and d.status='VERIFIED';
 if document.id is null or not private.provider_document_is_clean(document.storage_object_path,document.content_hash)then raise exception'BILLING_RECIPIENT_CLEAN_LEGAL_EVIDENCE_REQUIRED'using errcode='55000';end if;
 h:=private.canonical_request_hash(jsonb_build_object('contract',v.id,'source_hash',v.content_hash,'recipient',recipient,'evidence',document.id,'sha256',document.content_hash,'reason',btrim(p_reason),'actor',auth.uid()));
 perform pg_advisory_xact_lock(hashtextextended('billing-recipient-review:'||org::text||':'||p_idempotency_key::text,0));select*into prior from public.provider_billing_contract_recipient_reviews where provider_organization_id=org and idempotency_key=p_idempotency_key;
 if found then if prior.content_hash is distinct from h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;review:=prior.id;else
 insert into public.provider_billing_contract_recipient_reviews(provider_organization_id,contract_version_id,source_contract_hash,recipient_snapshot,evidence_document_version_id,evidence_sha256,reason,content_hash,created_by,idempotency_key)values(org,v.id,v.content_hash,recipient,document.id,document.content_hash,btrim(p_reason),h,auth.uid(),p_idempotency_key)returning id into review;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,auth.uid(),'USER','provider.billing.historical_recipient_review_requested','provider_billing_recipient_review',review::text,review,jsonb_build_object('contract_version_id',v.id,'source_hash',v.content_hash,'review_hash',h,'evidence_document_version_id',document.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,causation_id)values(org,'provider_billing_recipient_review',review::text,'ProviderBillingRecipientReviewRequestedV1',review,jsonb_build_object('review_id',review),review);
 end if;return jsonb_build_object('outcome','PROVIDER_BILLING_RECIPIENT_REVIEW_REQUESTED','review_id',review);
end$$;
create function public.decide_provider_billing_recipient_review_v1(p_review_id uuid,p_expected_review_hash text,p_approve boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.provider_billing_contract_recipient_reviews%rowtype;v public.contract_versions%rowtype;prior public.provider_billing_contract_recipient_decisions%rowtype;decision text:=case when p_approve then'APPROVED'else'REJECTED'end;
begin
 if not private.provider_billing_legal_reviewer_v1()then raise exception'BILLING_RECIPIENT_REVIEW_DENIED'using errcode='42501';end if;
 select*into r from public.provider_billing_contract_recipient_reviews where id=p_review_id for update;select*into v from public.contract_versions where id=r.contract_version_id;
 if r.id is null or r.created_by=auth.uid()or v.created_by=auth.uid()then raise exception'FOUR_EYES_REQUIRED'using errcode='42501';end if;
 if r.content_hash is distinct from p_expected_review_hash or v.content_hash is distinct from r.source_contract_hash then raise exception'BILLING_RECIPIENT_REVIEW_CHANGED'using errcode='40001';end if;
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 then raise exception'INVALID_BILLING_RECIPIENT_DECISION'using errcode='22023';end if;
 select*into prior from public.provider_billing_contract_recipient_decisions where review_id=r.id;if found then if prior.decision is distinct from decision or prior.decided_by is distinct from auth.uid()or prior.reason is distinct from btrim(p_reason)then raise exception'BILLING_RECIPIENT_REVIEW_ALREADY_DECIDED'using errcode='55000';end if;return jsonb_build_object('outcome','PROVIDER_BILLING_RECIPIENT_REVIEW_'||decision,'review_id',r.id);end if;
 if p_approve and not exists(select 1 from public.provider_document_versions d where d.id=r.evidence_document_version_id and d.provider_organization_id=r.provider_organization_id and d.status='VERIFIED'and d.content_hash=r.evidence_sha256 and private.provider_document_is_clean(d.storage_object_path,d.content_hash))then raise exception'BILLING_RECIPIENT_CLEAN_LEGAL_EVIDENCE_REQUIRED'using errcode='55000';end if;
 insert into public.provider_billing_contract_recipient_decisions(review_id,decision,reason,decided_by)values(r.id,decision,btrim(p_reason),auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.provider_organization_id,auth.uid(),'USER','provider.billing.historical_recipient_review_decided','provider_billing_recipient_review',r.id::text,r.id,jsonb_build_object('decision',decision,'review_hash',r.content_hash,'reason',btrim(p_reason)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,causation_id)values(r.provider_organization_id,'provider_billing_recipient_review',r.id::text,'ProviderBillingRecipientReviewDecidedV1',r.id,jsonb_build_object('review_id',r.id,'decision',decision),r.id);
 return jsonb_build_object('outcome','PROVIDER_BILLING_RECIPIENT_REVIEW_'||decision,'review_id',r.id);
end$$;
grant execute on function private.provider_billing_legal_reviewer_v1()to authenticated;
-- Transfers reclassify an already recorded credit between immutable invoices. They do not move cash.
create or replace view public.provider_invoice_balances with(security_invoker=true)as
select i.*,totals.paid_minor,greatest(i.total_minor-totals.paid_minor-coalesce(credited.credited_minor,0),0)::bigint outstanding_minor,
 case when i.total_minor-totals.paid_minor-coalesce(credited.credited_minor,0)<=0 then'PAID'
 when exists(select 1 from public.provider_payment_plans plan join lateral(select d.status from public.provider_payment_plan_decisions d where d.plan_id=plan.id order by d.decision_version desc limit 1)latest on true where plan.invoice_id=i.id and latest.status='APPROVED')then'PAYMENT_PLAN'
 when i.due_on<current_date then'OVERDUE'when totals.paid_minor+coalesce(credited.credited_minor,0)>0 then'PARTIALLY_PAID'else'ISSUED'end payment_status,
 coalesce(credited.credited_minor,0)::bigint credited_minor,greatest(totals.paid_minor+coalesce(credited.credited_minor,0)-i.total_minor,0)::bigint available_credit_minor
from public.provider_invoices i
left join(select invoice_id,sum(amount_minor)::bigint paid_minor from public.provider_payment_allocations group by invoice_id)paid on paid.invoice_id=i.id
left join(select invoice_id,sum(total_minor)::bigint credited_minor from public.provider_credit_notes group by invoice_id)credited on credited.invoice_id=i.id
left join(select target_invoice_id,sum(amount_minor)::bigint amount from public.provider_invoice_credit_transfers group by target_invoice_id)incoming on incoming.target_invoice_id=i.id
left join(select source_invoice_id,sum(amount_minor)::bigint amount from public.provider_invoice_credit_transfers group by source_invoice_id)outgoing on outgoing.source_invoice_id=i.id
cross join lateral(select(coalesce(paid.paid_minor,0)+coalesce(incoming.amount,0)-coalesce(outgoing.amount,0))::bigint paid_minor)totals;
create function private.provider_recipient_correction_source_v1(p_invoice_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare i public.provider_invoices%rowtype;b public.provider_billing_source_policy_bindings%rowtype;recipient jsonb;credit_sub bigint;credit_tax bigint;paid bigint;
begin
 select*into i from public.provider_invoices where id=p_invoice_id;select*into b from public.provider_billing_source_policy_bindings where kind='invoice'and source_id=i.id and source_hash=i.document_hash and provider_organization_id=i.provider_organization_id;
 if i.id is null or b.id is null then raise exception'BILLING_ORIGINAL_INVOICE_POLICY_REQUIRED'using errcode='55000';end if;
 recipient:=private.provider_statement_contractual_recipient_v1(i.statement_id);if recipient is null then raise exception'BILLING_CONTRACT_RECIPIENT_REVIEW_REQUIRED'using errcode='55000';end if;
 select coalesce(sum(subtotal_minor),0),coalesce(sum(tax_minor),0)into credit_sub,credit_tax from public.provider_credit_notes where invoice_id=i.id;
 select coalesce((select sum(amount_minor)from public.provider_payment_allocations where provider_organization_id=i.provider_organization_id and invoice_id=i.id),0)+coalesce((select sum(amount_minor)from public.provider_invoice_credit_transfers where target_invoice_id=i.id),0)-coalesce((select sum(amount_minor)from public.provider_invoice_credit_transfers where source_invoice_id=i.id),0)into paid;
 return jsonb_build_object('original_invoice_id',i.id,'original_invoice_number',i.invoice_number,'original_source_hash',i.document_hash,'original_statement_id',i.statement_id,'original_binding_id',b.id,'currency',i.currency,'original_issued_on',i.issued_on::text,'recipient_snapshot',recipient,'original_recipient_snapshot',b.policy_snapshot->'recipient_snapshot','issuer_snapshot',b.policy_snapshot->'issuer_snapshot','prior_credit_subtotal_minor',credit_sub::text,'prior_credit_tax_minor',credit_tax::text,'remaining_subtotal_minor',(i.subtotal_minor-credit_sub)::text,'remaining_tax_minor',(i.tax_minor-credit_tax)::text,'paid_minor',paid::text);
end$$;
create function public.request_provider_invoice_recipient_correction_v1(p_invoice_id uuid,p_expected_source_hash text,p_issued_on date,p_due_on date,p_transfer_paid_credit boolean,p_reason text,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare i public.provider_invoices%rowtype;snapshot jsonb;h text;prior public.provider_invoice_recipient_correction_requests%rowtype;request uuid;
begin
 if not private.provider_billing_legal_reviewer_v1()then raise exception'BILLING_RECIPIENT_CORRECTION_DENIED'using errcode='42501';end if;
 select*into i from public.provider_invoices where id=p_invoice_id for update;
 select*into prior from public.provider_invoice_recipient_correction_requests where provider_organization_id=i.provider_organization_id and idempotency_key=p_idempotency_key;
 if found then if prior.original_invoice_id is distinct from p_invoice_id or prior.source_hash is distinct from p_expected_source_hash or prior.issued_on is distinct from p_issued_on or prior.due_on is distinct from p_due_on or prior.transfer_paid_credit is distinct from p_transfer_paid_credit or prior.reason is distinct from btrim(p_reason)or prior.requested_by is distinct from auth.uid()then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','PROVIDER_INVOICE_RECIPIENT_CORRECTION_REQUESTED','request_id',prior.id);end if;
 snapshot:=private.provider_recipient_correction_source_v1(i.id);
 if i.id is null or private.canonical_request_hash(snapshot)is distinct from p_expected_source_hash then raise exception'BILLING_RECIPIENT_CORRECTION_SOURCE_CHANGED'using errcode='40001';end if;
 if snapshot->'recipient_snapshot'is not distinct from snapshot->'original_recipient_snapshot'then raise exception'BILLING_RECIPIENT_CORRECTION_NOT_REQUIRED'using errcode='55000';end if;
 if p_issued_on is null or p_due_on is null or p_issued_on<i.issued_on or p_due_on<p_issued_on or p_transfer_paid_credit is null or p_idempotency_key is null or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 then raise exception'INVALID_BILLING_RECIPIENT_CORRECTION'using errcode='22023';end if;
 if(snapshot->>'remaining_subtotal_minor')::bigint+(snapshot->>'remaining_tax_minor')::bigint<=0 then raise exception'NO_REMAINING_COMMISSION_TO_REISSUE'using errcode='55000';end if;
 h:=private.canonical_request_hash(jsonb_build_object('source',snapshot,'issued',p_issued_on,'due',p_due_on,'transfer_paid_credit',p_transfer_paid_credit,'reason',btrim(p_reason),'actor',auth.uid()));
 perform pg_advisory_xact_lock(hashtextextended('provider-recipient-correction:'||i.provider_organization_id::text||':'||p_idempotency_key::text,0));
 select*into prior from public.provider_invoice_recipient_correction_requests where provider_organization_id=i.provider_organization_id and idempotency_key=p_idempotency_key;
 if found then if private.canonical_request_hash(jsonb_build_object('source',prior.source_snapshot,'issued',prior.issued_on,'due',prior.due_on,'transfer_paid_credit',prior.transfer_paid_credit,'reason',prior.reason,'actor',prior.requested_by))is distinct from h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;request:=prior.id;
 else insert into public.provider_invoice_recipient_correction_requests(provider_organization_id,original_invoice_id,source_snapshot,source_hash,issued_on,due_on,transfer_paid_credit,reason,requested_by,idempotency_key)values(i.provider_organization_id,i.id,snapshot,p_expected_source_hash,p_issued_on,p_due_on,p_transfer_paid_credit,btrim(p_reason),auth.uid(),p_idempotency_key)returning id into request;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(i.provider_organization_id,auth.uid(),'USER','provider.billing.recipient_correction_requested','provider_invoice_recipient_correction',request::text,request,jsonb_build_object('original_invoice_id',i.id,'source_hash',p_expected_source_hash,'transfer_paid_credit',p_transfer_paid_credit),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,causation_id)values(i.provider_organization_id,'provider_invoice_recipient_correction',request::text,'ProviderInvoiceRecipientCorrectionRequestedV1',request,jsonb_build_object('request_id',request,'original_invoice_id',i.id),request);
 end if;return jsonb_build_object('outcome','PROVIDER_INVOICE_RECIPIENT_CORRECTION_REQUESTED','request_id',request);
end$$;
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
  select e.account_id into receivable from public.financial_entries e join public.financial_accounts account on account.id=e.account_id and account.account_type='ASSET' where e.journal_id = invoice.journal_id and e.direction = 'DEBIT' and e.amount_minor = invoice.total_minor limit 1;
  select e.account_id into revenue from public.financial_entries e join public.financial_accounts account on account.id=e.account_id and account.account_type='REVENUE' where e.journal_id = invoice.journal_id and e.direction = 'CREDIT' and e.amount_minor = invoice.subtotal_minor limit 1;
  if invoice.tax_minor > 0 then
    select e.account_id into tax_account from public.financial_entries e join public.financial_accounts account on account.id=e.account_id and account.account_type='LIABILITY' where e.journal_id = invoice.journal_id and e.direction = 'CREDIT' and e.amount_minor = invoice.tax_minor limit 1;
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

create function private.execute_provider_invoice_recipient_correction_v1(p_request_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare request public.provider_invoice_recipient_correction_requests%rowtype;i public.provider_invoices%rowtype;s public.provider_statements%rowtype;snapshot jsonb;policy jsonb;credit jsonb;net bigint;tax bigint;paid bigint;transfer bigint;new_statement uuid:=extensions.gen_random_uuid();new_invoice uuid:=extensions.gen_random_uuid();journal uuid:=extensions.gen_random_uuid();number text;hash text;receivable uuid;revenue uuid;liability uuid;response jsonb;
begin
 select*into request from public.provider_invoice_recipient_correction_requests where id=p_request_id;select*into i from public.provider_invoices where id=request.original_invoice_id for update;
 if not private.provider_billing_legal_reviewer_v1()or i.id is null then raise exception'BILLING_RECIPIENT_CORRECTION_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('provider-billing-send:invoice:'||i.id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('provider-billing-send:statement:'||i.statement_id::text,0));
 snapshot:=private.provider_recipient_correction_source_v1(i.id);if private.canonical_request_hash(snapshot)is distinct from request.source_hash then raise exception'BILLING_RECIPIENT_CORRECTION_SOURCE_CHANGED'using errcode='40001';end if;
 if exists(select 1 from public.provider_invoice_recipient_corrections where original_invoice_id=i.id)then raise exception'BILLING_RECIPIENT_CORRECTION_ALREADY_EXECUTED'using errcode='55000';end if;
 net:=(snapshot->>'remaining_subtotal_minor')::bigint;tax:=(snapshot->>'remaining_tax_minor')::bigint;paid:=(snapshot->>'paid_minor')::bigint;
 if net+tax<=0 then raise exception'NO_REMAINING_COMMISSION_TO_REISSUE'using errcode='55000';end if;
 policy:=private.approved_billing_policy_snapshot(i.currency,request.issued_on);if policy is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 if(policy#>>'{issuer_snapshot,ice}')is distinct from(snapshot#>>'{issuer_snapshot,ice}')then raise exception'BILLING_CORRECTION_ISSUER_CHANGED_REVIEW_REQUIRED'using errcode='55000';end if;
 select e.account_id into receivable from public.financial_entries e join public.financial_accounts a on a.id=e.account_id and a.account_type='ASSET'where e.journal_id=i.journal_id and e.direction='DEBIT'and e.amount_minor=i.total_minor limit 1;
 select e.account_id into revenue from public.financial_entries e join public.financial_accounts a on a.id=e.account_id and a.account_type='REVENUE'where e.journal_id=i.journal_id and e.direction='CREDIT'and e.amount_minor=i.subtotal_minor limit 1;
 if tax>0 then select e.account_id into liability from public.financial_entries e join public.financial_accounts a on a.id=e.account_id and a.account_type='LIABILITY'where e.journal_id=i.journal_id and e.direction='CREDIT'and e.amount_minor=i.tax_minor limit 1;end if;
 if receivable is null or(net>0 and revenue is null)or(tax>0 and liability is null)then raise exception'INVALID_PROVIDER_LEDGER_ACCOUNT'using errcode='23514';end if;
 credit:=public.issue_provider_credit_note(i.id,'AUTO',request.issued_on,net,0,'Correction du destinataire : '||request.reason,'recipient-correction-credit:'||request.id::text,request.id);
 if(credit->>'tax_minor')::bigint is distinct from tax then raise exception'BILLING_CORRECTION_SOURCE_TAX_MISMATCH'using errcode='22000';end if;
 number:=private.allocate_billing_document_number_v1((policy->>'policy_id')::uuid,'INVOICE',request.issued_on);
 select*into s from public.provider_statements where id=i.statement_id;
 hash:=private.canonical_request_hash(jsonb_build_object('correction_request_id',request.id,'original_invoice_hash',i.document_hash,'cancellation_credit_note_id',credit->>'credit_note_id','new_number',number,'recipient',snapshot->'recipient_snapshot','net',net::text,'tax',tax::text,'issued',request.issued_on,'due',request.due_on,'policy_id',policy->>'policy_id'));
 insert into public.provider_statements(id,provider_organization_id,statement_number,period_start,period_end,currency,subtotal_minor,tax_minor,total_minor,document_hash,correlation_id,created_by)values(new_statement,i.provider_organization_id,'CORR-'||number,s.period_start,s.period_end,i.currency,net,tax,net+tax,hash,request.id,auth.uid());
 insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)values(journal,i.provider_organization_id,'PROVIDER_COMMISSION_INVOICE',i.currency,'provider.billing.recipient_correction',request.id::text,request.id,request.issued_on::timestamptz,'Correction invoice '||number,auth.uid());
 insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(i.provider_organization_id,journal,receivable,'DEBIT',net+tax,i.currency);
 if net>0 then insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(i.provider_organization_id,journal,revenue,'CREDIT',net,i.currency);end if;
 if tax>0 then insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(i.provider_organization_id,journal,liability,'CREDIT',tax,i.currency);end if;
 insert into public.provider_invoices(id,provider_organization_id,statement_id,invoice_number,currency,subtotal_minor,tax_minor,total_minor,issued_on,due_on,tax_rule_snapshot,document_hash,journal_id,correlation_id,created_by)values(new_invoice,i.provider_organization_id,new_statement,number,i.currency,net,tax,net+tax,request.issued_on,request.due_on,i.tax_rule_snapshot,hash,journal,request.id,auth.uid());
 insert into public.provider_invoice_recipient_corrections(id,provider_organization_id,original_invoice_id,original_statement_id,cancellation_credit_note_id,replacement_invoice_id,replacement_statement_id,prior_credit_subtotal_minor,prior_credit_tax_minor,recipient_snapshot,source_snapshot_hash,created_by)values(request.id,i.provider_organization_id,i.id,i.statement_id,(credit->>'credit_note_id')::uuid,new_invoice,new_statement,(snapshot->>'prior_credit_subtotal_minor')::bigint,(snapshot->>'prior_credit_tax_minor')::bigint,snapshot->'recipient_snapshot',request.source_hash,auth.uid());
 policy:=policy||jsonb_build_object('recipient_snapshot',snapshot->'recipient_snapshot','replacement_for_invoice_number',i.invoice_number,'cancellation_credit_number',credit->>'credit_number','recipient_correction_request_id',request.id);
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(i.provider_organization_id,'statement',new_statement,hash,(policy->>'policy_id')::uuid,policy,'CORR-'||number,request.issued_on,auth.uid()),(i.provider_organization_id,'invoice',new_invoice,hash,(policy->>'policy_id')::uuid,policy,number,request.issued_on,auth.uid());
 transfer:=case when request.transfer_paid_credit then least(paid,net+tax)else 0 end;
 if transfer>0 then insert into public.provider_invoice_credit_transfers(provider_organization_id,source_invoice_id,target_invoice_id,correction_request_id,amount_minor,approved_by)values(i.provider_organization_id,i.id,new_invoice,request.id,transfer,auth.uid());end if;
 response:=jsonb_build_object('outcome','PROVIDER_INVOICE_RECIPIENT_CORRECTED','original_invoice_id',i.id,'credit_note_id',credit->>'credit_note_id','replacement_invoice_id',new_invoice,'replacement_statement_id',new_statement,'replacement_invoice_number',number,'transferred_credit_minor',transfer::text,'retained_credit_minor',(paid-transfer)::text,'document_status','EDITION_PENDING');
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(i.provider_organization_id,auth.uid(),'USER','provider.billing.recipient_corrected_with_credit_and_new_invoice','provider_invoice_recipient_correction',request.id::text,request.id,response||jsonb_build_object('source_hash',request.source_hash,'reason',request.reason),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values(i.provider_organization_id,'provider_statement',new_statement::text,'ProviderStatementIssuedV1',request.id,jsonb_build_object('statement_id',new_statement),'recipient-correction-statement:'||request.id::text,new_statement),(i.provider_organization_id,'provider_invoice',new_invoice::text,'ProviderInvoiceIssuedV1',request.id,jsonb_build_object('invoice_id',new_invoice),'recipient-correction-invoice:'||request.id::text,new_invoice),(i.provider_organization_id,'provider_invoice_recipient_correction',request.id::text,'ProviderInvoiceRecipientCorrectedV1',request.id,response,'recipient-correction:'||request.id::text,request.id);
 return response;
end$$;
create function public.decide_provider_invoice_recipient_correction_v1(p_request_id uuid,p_expected_source_hash text,p_approve boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare request public.provider_invoice_recipient_correction_requests%rowtype;prior public.provider_invoice_recipient_correction_decisions%rowtype;i public.provider_invoices%rowtype;response jsonb;decision text:=case when p_approve then'APPROVED'else'REJECTED'end;
begin
 if not private.provider_billing_legal_reviewer_v1()then raise exception'BILLING_RECIPIENT_CORRECTION_DENIED'using errcode='42501';end if;
 select*into request from public.provider_invoice_recipient_correction_requests where id=p_request_id for update;select*into i from public.provider_invoices where id=request.original_invoice_id;
 if request.id is null or request.requested_by=auth.uid()or i.created_by=auth.uid()then raise exception'FOUR_EYES_REQUIRED'using errcode='42501';end if;
 if request.source_hash is distinct from p_expected_source_hash then raise exception'BILLING_RECIPIENT_CORRECTION_SOURCE_CHANGED'using errcode='40001';end if;
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 then raise exception'INVALID_BILLING_RECIPIENT_DECISION'using errcode='22023';end if;
 select*into prior from public.provider_invoice_recipient_correction_decisions where request_id=request.id;
 if found then if prior.decision is distinct from decision or prior.decided_by is distinct from auth.uid()or prior.reason is distinct from btrim(p_reason)then raise exception'BILLING_RECIPIENT_CORRECTION_ALREADY_DECIDED'using errcode='55000';end if;return prior.response_body;end if;
 response:=case when p_approve then private.execute_provider_invoice_recipient_correction_v1(request.id)else jsonb_build_object('outcome','PROVIDER_INVOICE_RECIPIENT_CORRECTION_REJECTED','request_id',request.id)end;
 insert into public.provider_invoice_recipient_correction_decisions(request_id,decision,reason,decided_by,response_body)values(request.id,decision,btrim(p_reason),auth.uid(),response);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(request.provider_organization_id,auth.uid(),'USER','provider.billing.recipient_correction_decided','provider_invoice_recipient_correction',request.id::text,request.id,jsonb_build_object('decision',decision,'reason',btrim(p_reason),'source_hash',request.source_hash),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,causation_id)values(request.provider_organization_id,'provider_invoice_recipient_correction',request.id::text,'ProviderInvoiceRecipientCorrectionDecidedV1',request.id,jsonb_build_object('request_id',request.id,'decision',decision),request.id);
 return response;
end$$;
create function private.provider_billing_recipient_concordance_v1(p_kind text,p_source_id uuid)returns text language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare expected jsonb;actual jsonb;begin
 if(p_kind='invoice'and exists(select 1 from public.provider_invoice_recipient_corrections where original_invoice_id=p_source_id))or(p_kind='statement'and exists(select 1 from public.provider_invoice_recipient_corrections where original_statement_id=p_source_id))then return'CORRECTED';end if;
 begin expected:=private.provider_expected_billing_recipient_v1(p_kind,p_source_id);exception when sqlstate'55000'then return'LEGACY_REVIEW_REQUIRED';end;
 if expected is null then return'LEGACY_REVIEW_REQUIRED';end if;
 select policy_snapshot->'recipient_snapshot'into actual from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=p_source_id;
 if actual is null then return'LEGACY_REVIEW_REQUIRED';end if;
 return case when expected=actual then'OK'else'CORRECTION_REQUIRED'end;
end$$;
create function public.get_provider_billing_recipient_review_context_v1(p_provider_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;item record;snapshot jsonb;invoices jsonb:='[]';begin
 if not private.provider_billing_legal_reviewer_v1()then raise exception'BILLING_RECIPIENT_REVIEW_DENIED'using errcode='42501';end if;
 for item in select id from public.provider_invoices where provider_organization_id=p_provider_organization_id order by created_at desc,id desc limit 100 loop
  begin snapshot:=private.provider_recipient_correction_source_v1(item.id);invoices:=invoices||jsonb_build_array(snapshot||jsonb_build_object('source_snapshot_hash',private.canonical_request_hash(snapshot),'concordance',private.provider_billing_recipient_concordance_v1('invoice',item.id)));
  exception when sqlstate'55000'then invoices:=invoices||jsonb_build_array(jsonb_build_object('original_invoice_id',item.id,'concordance','LEGACY_REVIEW_REQUIRED','reason',sqlerrm));end;
 end loop;
 result:=jsonb_build_object('organization_id',p_provider_organization_id,'today',(clock_timestamp()at time zone'Africa/Casablanca')::date::text,'contracts',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'contract_id',c.id,'title',q.title,'version',v.version,'content_hash',v.content_hash,'anchored',private.provider_contract_anchored_recipient_v1(v.id)is not null,'original_legal_snapshot',p.legal_snapshot)order by v.created_at desc)from public.contract_versions v join public.contracts c on c.id=v.contract_id left join public.quote_versions q on q.id=v.selected_quote_version_id left join public.contract_parties p on p.contract_version_id=v.id and p.party_role='PROVIDER'and p.organization_id=c.provider_organization_id where c.provider_organization_id=p_provider_organization_id),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'code',f.code,'version',v.version_number,'sha256',v.content_hash)order by v.created_at desc)from public.provider_document_versions v join public.provider_document_families f on f.id=v.family_id where v.provider_organization_id=p_provider_organization_id and f.document_kind in('LEGAL','FISCAL')and v.status='VERIFIED'and private.provider_document_is_clean(v.storage_object_path,v.content_hash)),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'contract_version_id',r.contract_version_id,'recipient_snapshot',r.recipient_snapshot,'evidence_document_version_id',r.evidence_document_version_id,'content_hash',r.content_hash,'reason',r.reason,'decision',d.decision,'can_decide',r.created_by<>auth.uid()and v.created_by<>auth.uid())order by r.created_at desc)from public.provider_billing_contract_recipient_reviews r join public.contract_versions v on v.id=r.contract_version_id left join public.provider_billing_contract_recipient_decisions d on d.review_id=r.id where r.provider_organization_id=p_provider_organization_id),'[]'::jsonb),
 'invoices',invoices,'corrections',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'source_snapshot',r.source_snapshot,'source_hash',r.source_hash,'issued_on',r.issued_on::text,'due_on',r.due_on::text,'transfer_paid_credit',r.transfer_paid_credit,'reason',r.reason,'decision',d.decision,'can_decide',r.requested_by<>auth.uid()and i.created_by<>auth.uid(),'response',d.response_body)order by r.requested_at desc)from public.provider_invoice_recipient_correction_requests r join public.provider_invoices i on i.id=r.original_invoice_id left join public.provider_invoice_recipient_correction_decisions d on d.request_id=r.id where r.provider_organization_id=p_provider_organization_id),'[]'::jsonb));return result;
end$$;

create or replace function public.issue_provider_statement(p_provider_organization_id uuid,p_statement_number text,p_period_start date,p_period_end date,p_currency char(3),p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare h text;r jsonb;policy jsonb;source public.provider_statements%rowtype;recipient jsonb;issued date:=(clock_timestamp()at time zone'Africa/Casablanca')::date;
begin
 if not private.provider_billing_write_access(p_provider_organization_id,auth.uid())then raise exception'PROVIDER_STATEMENT_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('org',p_provider_organization_id,'number',p_statement_number,'start',p_period_start,'end',p_period_end,'currency',p_currency));
 r:=private.begin_provider_billing_command(p_provider_organization_id,'provider.billing.governed.statement.issue',p_idempotency_key,h,auth.uid());if r is not null then return r;end if;
 policy:=private.approved_billing_policy_snapshot(p_currency,issued);if policy is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 r:=public.issue_provider_statement_pre_policy_v1(p_provider_organization_id,p_statement_number,p_period_start,p_period_end,p_currency,'governed:'||p_idempotency_key,p_correlation_id);
 select*into source from public.provider_statements where id=(r->>'statement_id')::uuid;
 recipient:=private.provider_statement_contractual_recipient_v1(source.id);if recipient is null then raise exception'BILLING_CONTRACT_RECIPIENT_REVIEW_REQUIRED'using errcode='55000';end if;
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(p_provider_organization_id,'statement',source.id,source.document_hash,(policy->>'policy_id')::uuid,policy||jsonb_build_object('recipient_snapshot',recipient),source.statement_number,issued,auth.uid());
 r:=r||jsonb_build_object('document_status','EDITION_PENDING','statement_number',source.statement_number,'policy_id',policy->>'policy_id');
 perform private.finish_provider_billing_command(p_provider_organization_id,'provider.billing.governed.statement.issue',p_idempotency_key,r);return r;
end$$;

create or replace function public.issue_provider_invoice(p_statement_id uuid,p_invoice_number text,p_issued_on date,p_due_on date,p_receivable_account_id uuid,p_revenue_account_id uuid,p_tax_liability_account_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare statement public.provider_statements%rowtype;source public.provider_invoices%rowtype;policy jsonb;number text;h text;r jsonb;recipient jsonb;
begin
 select*into statement from public.provider_statements where id=p_statement_id;
 if not found or not private.provider_billing_write_access(statement.provider_organization_id,auth.uid())then raise exception'PROVIDER_INVOICE_DENIED'using errcode='42501';end if;
 if p_invoice_number is distinct from'AUTO'then raise exception'GOVERNED_INVOICE_NUMBER_REQUIRED'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('statement',p_statement_id,'issued',p_issued_on,'due',p_due_on,'receivable',p_receivable_account_id,'revenue',p_revenue_account_id,'tax',p_tax_liability_account_id));
 r:=private.begin_provider_billing_command(statement.provider_organization_id,'provider.billing.governed.invoice.issue',p_idempotency_key,h,auth.uid());if r is not null then return r;end if;
 recipient:=private.provider_statement_contractual_recipient_v1(statement.id);if recipient is null then raise exception'BILLING_CONTRACT_RECIPIENT_REVIEW_REQUIRED'using errcode='55000';end if;
 policy:=private.approved_billing_policy_snapshot(statement.currency,p_issued_on);if policy is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 number:=private.allocate_billing_document_number_v1((policy->>'policy_id')::uuid,'INVOICE',p_issued_on);
 r:=public.issue_provider_invoice_pre_policy_v1(p_statement_id,number,p_issued_on,p_due_on,p_receivable_account_id,p_revenue_account_id,p_tax_liability_account_id,'governed:'||p_idempotency_key,p_correlation_id);
 select*into source from public.provider_invoices where id=(r->>'invoice_id')::uuid;
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(source.provider_organization_id,'invoice',source.id,source.document_hash,(policy->>'policy_id')::uuid,policy||jsonb_build_object('recipient_snapshot',recipient),source.invoice_number,source.issued_on,auth.uid());
 r:=r||jsonb_build_object('document_status','EDITION_PENDING','invoice_number',source.invoice_number,'policy_id',policy->>'policy_id');
 perform private.finish_provider_billing_command(source.provider_organization_id,'provider.billing.governed.invoice.issue',p_idempotency_key,r);return r;
end$$;

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
 return binding.policy_snapshot||jsonb_build_object('recipient_concordance',private.provider_billing_recipient_concordance_v1(p_kind,p_source_id),'policy_binding_id',binding.id,'document_number',binding.document_number,'document_issued_on',binding.issued_on::text,'source_hash',binding.source_hash);
end$$;

create or replace function public.adopt_legacy_provider_billing_source_policy(p_kind text,p_source_id uuid,p_reason text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare org uuid;creator uuid;number text;sourcehash text;issued date;currency char(3);policy jsonb;binding uuid;legacy_sequence bigint;recipient jsonb;original_invoice uuid;original_binding public.provider_billing_source_policy_bindings%rowtype;
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
 recipient:=private.provider_expected_billing_recipient_v1(p_kind,p_source_id);if recipient is null then raise exception'BILLING_CONTRACT_RECIPIENT_REVIEW_REQUIRED'using errcode='55000';end if;
 if not exists(select 1 from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=p_source_id)and exists(select 1 from public.provider_billing_document_artifacts a where a.kind=p_kind and a.source_id=p_source_id and(a.snapshot->>'recipient')is distinct from(recipient->>'legal_name'))then raise exception'BILLING_ORIGINAL_RECIPIENT_POLICY_REVIEW_REQUIRED'using errcode='55000';end if;
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(org,p_kind,p_source_id,sourcehash,(policy->>'policy_id')::uuid,case p_kind when'credit_note'then policy else policy||jsonb_build_object('recipient_snapshot',recipient)end,number,issued,auth.uid())on conflict(kind,source_id)do nothing returning id into binding;
 if binding is not null then
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,auth.uid(),'USER','provider.billing.legacy_source.adopted','provider_billing_source_policy_binding',binding::text,p_correlation_id,jsonb_build_object('source_id',p_source_id,'kind',p_kind,'policy_id',policy->>'policy_id','reason',btrim(p_reason)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,case p_kind when'invoice'then'provider_invoice'when'credit_note'then'provider_credit_note'else'provider_statement'end,p_source_id::text,case p_kind when'invoice'then'ProviderInvoiceIssuedV1'when'credit_note'then'ProviderCreditNoteIssuedV1'else'ProviderStatementIssuedV1'end,p_correlation_id,case p_kind when'invoice'then jsonb_build_object('invoice_id',p_source_id)when'credit_note'then jsonb_build_object('credit_note_id',p_source_id)else jsonb_build_object('statement_id',p_source_id)end,'provider-billing-adopted:'||p_kind||':'||p_source_id::text);
 end if;return jsonb_build_object('outcome','PROVIDER_BILLING_SOURCE_POLICY_ADOPTED');
end$$;

create or replace function public.get_provider_billing_document_states(p_provider_organization_id uuid,p_kind text,p_source_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$begin
 if not coalesce(private.provider_billing_access(p_provider_organization_id,auth.uid()),false)then raise exception'BILLING_DOCUMENT_STATES_DENIED'using errcode='42501';end if;
 if p_kind is null or p_kind not in('invoice','statement','credit_note')or p_source_ids is null or cardinality(p_source_ids)>100 then raise exception'INVALID_BILLING_DOCUMENT_STATES'using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('source_id',source.id, 'original_artifacts',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'locale',a.locale)order by a.created_at),'[]'::jsonb)from public.provider_billing_document_artifacts a where a.kind=p_kind and a.source_id=source.id and a.provider_organization_id=p_provider_organization_id),'status',case when private.provider_billing_recipient_concordance_v1(p_kind,source.id)in('LEGACY_REVIEW_REQUIRED','CORRECTION_REQUIRED','CORRECTED')then private.provider_billing_recipient_concordance_v1(p_kind,source.id)when(select count(*)from public.provider_billing_document_artifacts a where a.kind=p_kind and a.source_id=source.id and a.provider_organization_id=p_provider_organization_id and a.locale in('fr','ar')and a.policy_binding_id=(select id from public.provider_billing_source_policy_bindings where kind=p_kind and source_id=source.id))=2 then'READY'else'EDITION_PENDING'end))from(select id from public.provider_invoices where p_kind='invoice'and provider_organization_id=p_provider_organization_id and id=any(p_source_ids)union all select id from public.provider_statements where p_kind='statement'and provider_organization_id=p_provider_organization_id and id=any(p_source_ids)union all select id from public.provider_credit_notes where p_kind='credit_note'and provider_organization_id=p_provider_organization_id and id=any(p_source_ids))source),'[]'::jsonb);
end$$;

create or replace function public.register_provider_billing_document_artifact(p_provider_organization_id uuid,p_kind text,p_source_id uuid,p_locale text,p_source_hash text,p_pdf_sha256 text,p_storage_path text,p_snapshot jsonb,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare result public.provider_billing_document_artifacts%rowtype;expected text;source_actor uuid;source_total text;source_subtotal text;source_tax text;source_currency text;binding public.provider_billing_source_policy_bindings%rowtype;recipient_details jsonb;correlation uuid:=extensions.gen_random_uuid();
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
 recipient_details:=case when binding.policy_snapshot#>>'{recipient_snapshot,registered_address}'is null then'[]'::jsonb else jsonb_build_array(binding.policy_snapshot#>>'{recipient_snapshot,registered_address}')end||coalesce((select jsonb_agg(key||': '||value order by key collate "C")from jsonb_each_text(binding.policy_snapshot#>'{recipient_snapshot,identifiers}')),'[]'::jsonb)||jsonb_build_array(binding.policy_snapshot#>>'{recipient_snapshot,country_code}');
 if p_snapshot->'recipientDetails'is distinct from recipient_details then raise exception'BILLING_ARTIFACT_RECIPIENT_IDENTITY_MISMATCH'using errcode='22000';end if;
 if(p_snapshot->>'kind')is distinct from p_kind or(p_snapshot->>'currency')is distinct from source_currency or(p_snapshot->>'totalMinor')is distinct from source_total or jsonb_typeof(p_snapshot->'lines')is distinct from'array'or jsonb_array_length(p_snapshot->'lines')<>2 or(p_snapshot#>>'{lines,0,amountMinor}')is distinct from source_subtotal or(p_snapshot#>>'{lines,1,amountMinor}')is distinct from source_tax then raise exception'BILLING_ARTIFACT_FINANCIAL_SNAPSHOT_MISMATCH'using errcode='22000';end if;
 if p_kind='credit_note'and(p_snapshot->>'originalInvoiceNumber')is distinct from(binding.policy_snapshot->>'original_invoice_number')then raise exception'BILLING_CREDIT_ORIGINAL_REFERENCE_MISMATCH'using errcode='22000';end if;
 if private.provider_billing_recipient_concordance_v1(p_kind,p_source_id)is distinct from'OK'then raise exception'BILLING_RECIPIENT_REVIEW_OR_CORRECTION_REQUIRED'using errcode='55000';end if;
 if(p_snapshot->>'replacementForInvoiceNumber')is distinct from(binding.policy_snapshot->>'replacement_for_invoice_number')or(p_snapshot->>'cancellationCreditNumber')is distinct from(binding.policy_snapshot->>'cancellation_credit_number')then raise exception'BILLING_CORRECTION_DOCUMENT_REFERENCES_MISMATCH'using errcode='22000';end if;
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
revoke all on function private.normalize_provider_contract_recipient_v1(jsonb),private.provider_contract_anchored_recipient_v1(uuid),private.provider_contract_recipient_snapshot_v1(uuid),private.provider_statement_contractual_recipient_v1(uuid),private.provider_expected_billing_recipient_v1(text,uuid),private.provider_recipient_correction_source_v1(uuid),private.execute_provider_invoice_recipient_correction_v1(uuid),private.provider_billing_recipient_concordance_v1(text,uuid)from public,anon,authenticated,service_role;
revoke all on function public.request_provider_billing_recipient_review_v1(uuid,text,jsonb,uuid,text,uuid),public.decide_provider_billing_recipient_review_v1(uuid,text,boolean,text),public.request_provider_invoice_recipient_correction_v1(uuid,text,date,date,boolean,text,uuid),public.decide_provider_invoice_recipient_correction_v1(uuid,text,boolean,text),public.get_provider_billing_recipient_review_context_v1(uuid)from public,anon,service_role;
grant execute on function public.request_provider_billing_recipient_review_v1(uuid,text,jsonb,uuid,text,uuid),public.decide_provider_billing_recipient_review_v1(uuid,text,boolean,text),public.request_provider_invoice_recipient_correction_v1(uuid,text,date,date,boolean,text,uuid),public.decide_provider_invoice_recipient_correction_v1(uuid,text,boolean,text),public.get_provider_billing_recipient_review_context_v1(uuid)to authenticated;
create or replace function public.complete_provider_billing_document_issue(p_kind text,p_source_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare sourcehash text;org uuid;artifact uuid;binding uuid;
begin
 if auth.role()is distinct from'service_role'then raise exception'BILLING_DOCUMENT_ISSUE_DENIED'using errcode='42501';end if;
 if private.provider_billing_recipient_concordance_v1(p_kind,p_source_id)='CORRECTED'then return jsonb_build_object('outcome','BILLING_ORIGINAL_RETAINED_BY_CORRECTION');end if;
 if private.provider_billing_recipient_concordance_v1(p_kind,p_source_id)is distinct from'OK'then raise exception'BILLING_RECIPIENT_REVIEW_OR_CORRECTION_REQUIRED'using errcode='55000';end if;
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

create or replace function public.enqueue_provider_billing_pdf_notification(p_artifact_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare artifact public.provider_billing_document_artifacts%rowtype;recipient uuid;recipient_locale text;
begin
 if auth.role()is distinct from'service_role'then raise exception'PROVIDER_BILLING_NOTIFICATION_DENIED'using errcode='42501';end if;
 select * into artifact from public.provider_billing_document_artifacts where id=p_artifact_id;
 if not found then raise exception'PROVIDER_BILLING_ARTIFACT_NOT_FOUND'using errcode='P0002';end if;
 if artifact.policy_binding_id is null then raise exception'BILLING_ARTIFACT_APPROVED_POLICY_REQUIRED'using errcode='55000';end if;
 if private.provider_billing_recipient_concordance_v1(artifact.kind,artifact.source_id)='CORRECTED'then return jsonb_build_object('outcome','BILLING_ORIGINAL_RETAINED_BY_CORRECTION');end if;
 if private.provider_billing_recipient_concordance_v1(artifact.kind,artifact.source_id)is distinct from'OK'then raise exception'BILLING_RECIPIENT_REVIEW_OR_CORRECTION_REQUIRED'using errcode='55000';end if;
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


-- Rechecked by the transport authorization transaction, immediately before an external send.
-- The lock orders a correction against authorization; an authorization already returned can be in flight.
create function private.provider_billing_notification_send_authorized_v1(p_notification_id uuid)returns boolean language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare notification public.notification_instances%rowtype;artifact public.provider_billing_document_artifacts%rowtype;binding public.provider_billing_source_policy_bindings%rowtype;source_hash text;begin
 select*into notification from public.notification_instances where id=p_notification_id;if not found then return false;end if;
 if notification.event_type is distinct from'ProviderBillingPdfReadyV1'and notification.source_aggregate_type is distinct from'provider_billing_document_artifact'then return true;end if;
 if notification.event_type is distinct from'ProviderBillingPdfReadyV1'or notification.source_aggregate_type is distinct from'provider_billing_document_artifact'then return false;end if;
 select*into artifact from public.provider_billing_document_artifacts where id::text=notification.source_aggregate_id and provider_organization_id=notification.organization_id;
 if not found then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('provider-billing-send:'||artifact.kind||':'||artifact.source_id::text,0));
 if private.provider_billing_recipient_concordance_v1(artifact.kind,artifact.source_id)is distinct from'OK'then return false;end if;
 select*into binding from public.provider_billing_source_policy_bindings b where b.id=artifact.policy_binding_id and b.kind=artifact.kind and b.source_id=artifact.source_id and b.provider_organization_id=notification.organization_id and b.source_hash=artifact.source_hash;if not found then return false;end if;
 if artifact.kind='invoice'then select document_hash into source_hash from public.provider_invoices where id=artifact.source_id and provider_organization_id=notification.organization_id;
 elsif artifact.kind='statement'then select document_hash into source_hash from public.provider_statements where id=artifact.source_id and provider_organization_id=notification.organization_id;
 elsif artifact.kind='credit_note'then select document_hash into source_hash from public.provider_credit_notes where id=artifact.source_id and provider_organization_id=notification.organization_id;
 else return false;end if;
 if source_hash is distinct from binding.source_hash then return false;end if;
 return exists(select 1 from public.organization_memberships membership join auth.users account on account.id=membership.user_id and account.email_confirmed_at is not null where membership.organization_id=notification.organization_id and membership.user_id=notification.recipient_user_id and membership.status='ACTIVE'and exists(select 1 from public.organization_member_roles role where role.membership_id=membership.id and role.revoked_at is null and role.role_code in('PROVIDER_OWNER','PROVIDER_ACCOUNTING')));
end$$;
revoke all on function private.provider_billing_notification_send_authorized_v1(uuid)from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
