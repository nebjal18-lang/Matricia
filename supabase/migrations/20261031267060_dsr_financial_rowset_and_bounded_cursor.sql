begin;
-- One canonical subject-only rowset is shared by bounded JSON responses and
-- materialized batch captures. The batch owner must materialize all rows in one
-- statement/MVCC cut before the worker pages any frozen records.
create function private.dsr_subject_financial_rows_v2(p_request_id uuid)
returns table(source text,record_id text,record jsonb)language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare d public.data_subject_requests%rowtype;subject_user uuid;
begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 select*into d from public.data_subject_requests where id=p_request_id;
 subject_user:=private.dsr_account_subject_v1(d.id);
 if d.id is null or d.status<>'IN_REVIEW'or d.verified_at is null or d.request_type not in('ACCESS','PORTABILITY')or subject_user is null then raise exception'PRIVACY_VERIFIED_EXPORT_SUBJECT_REQUIRED'using errcode='42501';end if;
 return query select q.source,q.record_id,q.record from(
  select 'PAYMENT_INTENT' source,p.id::text record_id,
   jsonb_build_object('source','PAYMENT_INTENT','id',p.id,'gateway',p.gateway,
   'amount_minor',p.amount_minor::text,'currency',p.currency,'billing_interval',p.billing_interval,'created_at',p.created_at) record
  from public.subscription_payment_intents p where p.organization_id=d.organization_id and p.created_by=subject_user
  union all
  select 'CREDIT_ENTRY',c.id::text,jsonb_build_object('source','CREDIT_ENTRY','id',c.id::text,
   'entry_type',c.entry_type,'quantity',c.quantity::text,'reference_type',c.reference_type,'reference_id',c.reference_id,'occurred_at',c.occurred_at)
  from public.credit_ledger_entries c where c.organization_id=d.organization_id and c.created_by=subject_user
  union all
  select 'CLIENT_DOCUMENT',c.id::text,jsonb_build_object('source','CLIENT_DOCUMENT','id',c.id,'kind',c.kind,
   'number',c.document_number,'issued_on',c.issued_on,'currency',c.currency,
   'subtotal_minor',c.subtotal_minor::text,'tax_minor',c.tax_minor::text,'total_minor',c.total_minor::text,
   'original_invoice_id',c.original_invoice_id,'source_hash',c.source_hash,'created_at',c.created_at)
  from public.client_commercial_documents c where c.organization_id=d.organization_id and c.created_by=subject_user
  union all
  select 'PROVIDER_INVOICE',c.id::text,jsonb_build_object('source','PROVIDER_INVOICE','id',c.id,
   'number',c.invoice_number,'issued_on',c.issued_on,'due_on',c.due_on,'currency',c.currency,
   'subtotal_minor',c.subtotal_minor::text,'tax_minor',c.tax_minor::text,'total_minor',c.total_minor::text,
   'document_hash',c.document_hash,'created_at',c.created_at)
  from public.provider_invoices c where c.provider_organization_id=d.organization_id and c.created_by=subject_user
  union all
  select 'PROVIDER_CREDIT_NOTE',c.id::text,jsonb_build_object('source','PROVIDER_CREDIT_NOTE','id',c.id,
   'number',c.credit_number,'invoice_id',c.invoice_id,'issued_on',c.issued_on,'currency',c.currency,
   'subtotal_minor',c.subtotal_minor::text,'tax_minor',c.tax_minor::text,'total_minor',c.total_minor::text,
   'document_hash',c.document_hash,'created_at',c.created_at)
  from public.provider_credit_notes c where c.provider_organization_id=d.organization_id and c.created_by=subject_user
  union all
  select 'CONTRACT_SIGNATURE',s.id::text,jsonb_build_object('source','CONTRACT_SIGNATURE','id',s.id,
   'contract_id',s.contract_id,'contract_version_id',s.contract_version_id,'signer_role',s.signer_role,
   'contract_hash',s.contract_hash,'signed_at',s.signed_at)
  from public.contract_signatures s where s.organization_id=d.organization_id and s.signer_user_id=subject_user
  union all
  select 'AMENDMENT_SIGNATURE',s.id::text,jsonb_build_object('source','AMENDMENT_SIGNATURE','id',s.id,
   'amendment_id',s.amendment_id,'signer_role',s.signer_role,'amendment_hash',s.amendment_hash,'signed_at',s.signed_at)
  from public.contract_amendment_signatures s where s.organization_id=d.organization_id and s.signer_user_id=subject_user
  union all
  select 'CONTRACT_AUTHORSHIP',v.id::text,jsonb_build_object('source','CONTRACT_AUTHORSHIP','id',v.id,
   'contract_id',v.contract_id,'version',v.version,'price_minor',v.price_minor::text,'currency',v.currency,
   'content_hash',v.content_hash,'created_at',v.created_at)
  from public.contract_versions v join public.contracts c on c.id=v.contract_id
  where d.organization_id in(c.client_organization_id,c.provider_organization_id) and v.created_by=subject_user
  union all
  select 'SUBSCRIPTION_ACTION',e.id::text,jsonb_build_object('source','SUBSCRIPTION_ACTION','id',e.id::text,
   'subscription_id',e.subscription_id,'from_status',e.from_status,'to_status',e.to_status,'reason_code',e.reason_code,'occurred_at',e.occurred_at)
  from public.subscription_state_events e where e.organization_id=d.organization_id and e.actor_user_id=subject_user
  union all
  select 'AI_USAGE',e.id::text,jsonb_build_object('source','AI_USAGE','id',e.id::text,'model_code',e.model_code,
   'meter_code',e.meter_code,'quantity',e.quantity::text,'cost_minor',e.cost_minor::text,'currency',e.currency,'occurred_at',e.occurred_at)
  from public.ai_usage_events e where e.organization_id=d.organization_id and e.user_id=subject_user

  union all
  select 'AMENDMENT_AUTHORSHIP',a.id::text,jsonb_build_object('source','AMENDMENT_AUTHORSHIP','id',a.id,
   'contract_id',a.contract_id,'base_contract_version_id',a.base_contract_version_id,'amendment_number',a.amendment_number,
   'status',a.status,'price_delta_minor',a.price_delta_minor::text,'deadline_delta_days',a.deadline_delta_days,
   'content_hash',a.content_hash,'created_at',a.created_at)
  from public.contract_amendments a join public.contracts c on c.id=a.contract_id
  where d.organization_id in(c.client_organization_id,c.provider_organization_id) and a.created_by=subject_user
  union all
  select 'PROVIDER_PAYMENT',p.id::text,jsonb_build_object('source','PROVIDER_PAYMENT','id',p.id,
   'paid_on',p.paid_on,'payment_method',p.payment_method,'currency',p.currency,
   'amount_minor',p.amount_minor::text,'proof_hash',p.proof_hash,'recorded_at',p.recorded_at)
  from public.provider_payments p where p.provider_organization_id=d.organization_id and p.recorded_by=subject_user
  union all
  select 'PROVIDER_RECONCILIATION',r.id::text,jsonb_build_object('source','PROVIDER_RECONCILIATION','id',r.id,
   'payment_id',r.payment_id,'allocated_minor',r.allocated_minor::text,'reconciled_at',r.reconciled_at)
  from public.provider_reconciliation_batches r where r.provider_organization_id=d.organization_id and r.reconciled_by=subject_user
  union all
  select 'PROVIDER_STATEMENT',r.id::text,jsonb_build_object('source','PROVIDER_STATEMENT','id',r.id,
   'statement_number',r.statement_number,'period_start',r.period_start,'period_end',r.period_end,
   'currency',r.currency,'subtotal_minor',r.subtotal_minor::text,'tax_minor',r.tax_minor::text,
   'total_minor',r.total_minor::text,'document_hash',r.document_hash,'issued_at',r.issued_at)
  from public.provider_statements r where r.provider_organization_id=d.organization_id and r.created_by=subject_user
  union all
  select 'DIRECT_PAYMENT',p.id::text,jsonb_build_object('source','DIRECT_PAYMENT','id',p.id,
   'mission_id',p.mission_id,'contract_version_id',p.contract_version_id,'currency',p.currency,
   'contractual_amount_minor',p.contractual_amount_minor::text,'declared_paid_minor',p.declared_paid_minor::text,
   'confirmation_status',p.confirmation_status,'cash_boundary',p.cash_boundary,'paid_at',p.paid_at,'recorded_at',p.recorded_at)
  from public.direct_client_provider_payments p
  where d.organization_id in(p.client_organization_id,p.provider_organization_id) and p.recorded_by=subject_user
  union all
  select 'CREDIT_LOT',p.id::text,jsonb_build_object('source','CREDIT_LOT','id',p.id,
   'source_type',p.source_type,'quantity',p.quantity::text,'expires_at',p.expires_at,
   'revenue_value_minor',p.revenue_value_minor::text,'currency',p.currency,'created_at',p.created_at)
  from public.credit_lots p where p.organization_id=d.organization_id and p.created_by=subject_user
  union all
  select 'CREDIT_MOVEMENT',p.id::text,jsonb_build_object('source','CREDIT_MOVEMENT','id',p.id::text,
   'credit_lot_id',p.credit_lot_id,'movement_type',p.movement_type,'quantity',p.quantity::text,'occurred_at',p.occurred_at)
  from public.credit_lot_movements p where p.organization_id=d.organization_id and p.created_by=subject_user
  union all
  select 'FINANCIAL_JOURNAL',p.id::text,jsonb_build_object('source','FINANCIAL_JOURNAL','id',p.id,
   'journal_type',p.journal_type,'status',p.status,'currency',p.currency,'effective_at',p.effective_at,'created_at',p.created_at)
  from public.financial_journals p where p.organization_id=d.organization_id and p.created_by=subject_user
  union all
  select 'PAYMENT_PREPARATION',p.id::text,jsonb_build_object('source','PAYMENT_PREPARATION','id',p.id,
   'gateway',p.gateway,'billing_interval',p.billing_interval,'amount_minor',p.amount_minor::text,'currency',p.currency,'created_at',p.created_at)
  from public.subscription_payment_preparations p where p.organization_id=d.organization_id and p.actor_id=subject_user
  union all
  select 'SUPPLIER_INVOICE',p.id::text,jsonb_build_object('source','SUPPLIER_INVOICE','id',p.id,
   'invoice_reference',p.invoice_reference,'invoice_date',p.invoice_date,'due_date',p.due_date,'currency',p.currency,
   'subtotal_minor',p.subtotal_minor::text,'tax_minor',p.tax_minor::text,'total_minor',p.total_minor::text,
   'fiscal_status',p.fiscal_status,'status',p.status,'created_at',p.created_at)
  from public.supplier_invoices p where p.organization_id=d.organization_id and p.created_by=subject_user
  union all
  select 'ACCOUNTS_PAYABLE',p.id::text,jsonb_build_object('source','ACCOUNTS_PAYABLE','id',p.id,
   'supplier_invoice_id',p.supplier_invoice_id,'currency',p.currency,'amount_due_minor',p.amount_due_minor::text,
   'due_on',p.due_on,'scheduled_on',p.scheduled_on,'status',p.status,'created_at',p.created_at)
  from public.accounts_payable p where p.organization_id=d.organization_id and p.created_by=subject_user
  union all
  select 'OUTBOUND_PAYMENT',p.id::text,jsonb_build_object('source','OUTBOUND_PAYMENT','id',p.id,
   'amount_minor',p.amount_minor::text,'currency',p.currency,'status',p.status,'paid_at',p.paid_at,'created_at',p.created_at)
  from public.outbound_payments p where p.organization_id=d.organization_id and p.created_by=subject_user
  union all
  select 'OUTBOUND_PAYMENT_SCHEDULE',p.id::text,jsonb_build_object('source','OUTBOUND_PAYMENT_SCHEDULE','id',p.id,
   'outbound_payment_id',p.outbound_payment_id,'scheduled_amount_minor',p.scheduled_amount_minor::text,'scheduled_at',p.scheduled_at)
  from public.outbound_payment_schedules p where p.organization_id=d.organization_id and p.scheduled_by=subject_user
  union all
  select 'OUTBOUND_PAYMENT_EVENT',p.id::text,jsonb_build_object('source','OUTBOUND_PAYMENT_EVENT','id',p.id,
   'outbound_payment_id',p.outbound_payment_id,'event_type',p.event_type,'occurred_at',p.occurred_at,'recorded_at',p.recorded_at)
  from public.outbound_payment_state_events p where p.organization_id=d.organization_id and p.recorded_by=subject_user
  union all
  select 'PAYMENT_RECONCILIATION_RUN',p.id::text,jsonb_build_object('source','PAYMENT_RECONCILIATION_RUN','id',p.id,
   'provider',p.provider,'period_start',p.period_start,'period_end',p.period_end,'status',p.status,'started_at',p.started_at)
  from public.payment_reconciliation_runs p where p.organization_id=d.organization_id and p.started_by=subject_user
  union all
  select 'CLIENT_PROJECT_CONTRACT_LINK',p.id::text,jsonb_build_object('source','CLIENT_PROJECT_CONTRACT_LINK','id',p.id,
   'project_id',p.project_id,'contract_id',p.contract_id,'linked_at',p.linked_at)
  from public.client_project_contracts p where p.organization_id=d.organization_id and p.linked_by=subject_user
 )q;
end$$;
revoke all on function private.dsr_subject_financial_rows_v2(uuid)from public,anon,authenticated,service_role;

create function private.dsr_subject_financial_page_v2(p_request_id uuid,p_after_source text default null,p_after_record_id text default null,p_page_size integer default 250)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare rows jsonb;has_next boolean;cursor jsonb;
begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 if p_page_size is null or p_page_size not between 1 and 1000 or(p_after_source is null)is distinct from(p_after_record_id is null)or(p_after_source is not null and(p_after_source!~'^[A-Z][A-Z0-9_]{2,79}$'or length(p_after_record_id)not between 1 and 128))then raise exception'INVALID_DSR_FINANCIAL_CURSOR'using errcode='22023';end if;
 with selected as materialized(
  select f.source,f.record_id,f.record from private.dsr_subject_financial_rows_v2(p_request_id)f
  where p_after_source is null or(f.source collate "C",f.record_id collate "C")>(p_after_source collate "C",p_after_record_id collate "C")
  order by f.source collate "C",f.record_id collate "C"limit p_page_size+1
 ),page as(select*from selected order by source collate "C",record_id collate "C"limit p_page_size)
 select coalesce((select jsonb_agg(jsonb_build_object('source',source,'record_id',record_id,'record',record)order by source collate "C",record_id collate "C")from page),'[]'),
  (select count(*)>p_page_size from selected),
  (select jsonb_build_object('source',source,'record_id',record_id)from page order by source collate "C"desc,record_id collate "C"desc limit 1)
 into rows,has_next,cursor;
 return jsonb_build_object('format','MATRICIA_SUBJECT_FINANCIAL_PAGE_V2','request_id',p_request_id,'records',rows,'has_next',has_next,'next_cursor',case when has_next then cursor else null end,'selection','PERSONALLY_AUTHORED_OR_SIGNED_IN_REQUEST_ORGANIZATION','capture_semantics','LIVE_DIAGNOSTIC_PAGE_NOT_A_COMPLETE_MATERIALIZED_CAPTURE');
end$$;
revoke all on function private.dsr_subject_financial_page_v2(uuid,text,text,integer)from public,anon,authenticated,service_role;

create or replace function private.dsr_subject_financial_records_v1(p_request_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare d public.data_subject_requests%rowtype; subject_user uuid; records jsonb;
begin
 if not private.dsr_response_staff_v1() then
  raise exception 'DSR_RESPONSE_STAFF_REQUIRED' using errcode='42501';
 end if;
 select * into d from public.data_subject_requests where id=p_request_id;
 subject_user:=private.dsr_account_subject_v1(d.id);
 if d.id is null or d.status<>'IN_REVIEW' or d.verified_at is null
 or d.request_type not in('ACCESS','PORTABILITY') or subject_user is null then
  raise exception 'PRIVACY_VERIFIED_EXPORT_SUBJECT_REQUIRED' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(record order by source,record_id),'[]'::jsonb) into records
 from private.dsr_subject_financial_rows_v2(p_request_id) personal_records;
 if jsonb_array_length(records)>20000 or octet_length(records::text)>12000000 then
  raise exception 'PRIVACY_EXPORT_REQUIRES_BATCH_JOB' using errcode='55000';
 end if;
 return jsonb_build_object('format','MATRICIA_SUBJECT_FINANCIAL_RECORDS_V1','organization_id',d.organization_id,
  'selection','PERSONALLY_AUTHORED_OR_SIGNED_IN_REQUEST_ORGANIZATION','records',records,
  'restrictions',jsonb_build_array('OTHER_PERSONS_AND_ORGANIZATION_LEDGER_EXCLUDED','PROVIDER_TOKENS_AND_RAW_SIGNATURE_PROOFS_EXCLUDED'),
  'retention','DISCLOSURE_DOES_NOT_ALTER_IMMUTABLE_LEDGER_OR_RETENTION');
end $$;

notify pgrst,'reload schema';
commit;
