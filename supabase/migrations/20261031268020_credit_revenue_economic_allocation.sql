begin;
-- Economic attribution is distinct from the immutable legal cash journals.
-- No production mapping, fiscal rate or allocation policy is seeded here.

create function private.credit_revenue_finance_access_v1(p_actor uuid default auth.uid(),p_write boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select p_actor is not null and auth.uid()is not null and auth.jwt()->>'aal'='aal2'
 and private.has_platform_role(case when p_write then array['SUPER_ADMIN','FINANCE_MANAGER']else array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR']end,p_actor)
 and(not p_write or not private.has_platform_role(array['READ_ONLY_AUDITOR'],p_actor))
 and exists(select 1 from auth.users where id=p_actor and deleted_at is null and(banned_until is null or banned_until<=statement_timestamp()))
$$;
revoke all on function private.credit_revenue_finance_access_v1(uuid,boolean)from public,anon,authenticated,service_role;
grant execute on function private.credit_revenue_finance_access_v1(uuid,boolean)to authenticated;

create table public.credit_revenue_policy_versions_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 policy_kind text not null check(policy_kind in('POSTING','FISCAL','ALLOCATION','BOOK_ROUTE')),
 source_kind text not null check(source_kind in('SUBSCRIPTION','CREDIT_PACK','LIBRARY')),
 source_version_id uuid not null,scope_organization_id uuid references public.organizations(id),
 version integer not null check(version>0),currency char(3)not null check(currency~'^[A-Z]{3}$'),
 environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 valid_from date not null,valid_until date,policy_snapshot jsonb not null check(jsonb_typeof(policy_snapshot)='object'),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),reason text not null check(length(btrim(reason))between 10 and 2000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 idempotency_key text not null,correlation_id uuid not null,
 unique nulls not distinct(policy_kind,source_kind,source_version_id,scope_organization_id,currency,environment,version),
 unique(created_by,idempotency_key),check(valid_until is null or valid_until>=valid_from),
 check((policy_kind='BOOK_ROUTE')=(source_kind='LIBRARY'and scope_organization_id is not null)),
 check(policy_kind='BOOK_ROUTE'or(scope_organization_id is null and source_kind<>'LIBRARY'))
);
create table public.credit_revenue_policy_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),policy_version_id uuid not null references public.credit_revenue_policy_versions_v1(id),
 operation text not null check(operation in('ACTIVATE','REVOKE')),request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 reason text not null check(length(btrim(reason))between 10 and 2000),requested_by uuid not null references auth.users(id),
 requested_at timestamptz not null default clock_timestamp(),idempotency_key text not null,correlation_id uuid not null,
 unique(policy_version_id,operation),unique(requested_by,idempotency_key)
);
create table public.credit_revenue_policy_decisions_v1(
 request_id uuid primary key references public.credit_revenue_policy_requests_v1(id),
 decision text not null check(decision in('APPROVE','REJECT')),reason text not null check(length(btrim(reason))between 10 and 2000),
 decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp(),
 source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),result jsonb not null
);

create table private.payment_posting_contexts_v1(
 id uuid primary key default extensions.gen_random_uuid(),preparation_id uuid not null,
 organization_id uuid not null references public.organizations(id),source_kind text not null check(source_kind in('SUBSCRIPTION','CREDIT_PACK')),
 source_version_id uuid not null,policy_version_id uuid not null references public.credit_revenue_policy_versions_v1(id),
 currency char(3)not null check(currency~'^[A-Z]{3}$'),gateway text not null check(gateway in('DEMO','PAYPAL','CMI')),
 provider_environment text not null check(provider_environment in('DEMO','SANDBOX','LIVE')),
 deployment_environment text not null check(deployment_environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 cash_account_id uuid not null references public.financial_accounts(id),suspense_account_id uuid not null references public.financial_accounts(id),
 context_snapshot jsonb not null,context_hash text not null check(context_hash~'^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 unique(source_kind,preparation_id),check(cash_account_id<>suspense_account_id)
);
create table private.payment_suspense_journal_sources_v1(
 source_kind text not null check(source_kind in('SUBSCRIPTION','CREDIT_PACK')),source_id text not null,
 posting_context_id uuid not null references private.payment_posting_contexts_v1(id),
 financial_journal_id uuid not null unique references public.financial_journals(id),
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(source_kind,source_id)
);

create table public.credit_pack_payment_preparations_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 pack_version_id uuid not null references public.credit_pack_versions(id),actor_id uuid not null references auth.users(id),
 idempotency_key text not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 gateway text not null check(gateway in('DEMO','PAYPAL','CMI')),provider_environment text not null check(provider_environment in('DEMO','SANDBOX','LIVE')),
 deployment_environment text not null check(deployment_environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 amount_minor bigint not null check(amount_minor>0),currency char(3)not null check(currency~'^[A-Z]{3}$'),
 pack_snapshot jsonb not null,posting_context_id uuid not null references private.payment_posting_contexts_v1(id),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 unique(organization_id,idempotency_key),check(expires_at>created_at)
);
create table public.credit_pack_payment_intents_v1(
 id uuid primary key default extensions.gen_random_uuid(),preparation_id uuid not null unique references public.credit_pack_payment_preparations_v1(id),
 organization_id uuid not null references public.organizations(id),pack_version_id uuid not null references public.credit_pack_versions(id),
 gateway text not null check(gateway in('DEMO','PAYPAL','CMI')),provider_environment text not null check(provider_environment in('DEMO','SANDBOX','LIVE')),
 deployment_environment text not null check(deployment_environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 provider_intent_id text not null check(length(provider_intent_id)between 8 and 200),
 amount_minor bigint not null check(amount_minor>0),currency char(3)not null check(currency~'^[A-Z]{3}$'),
 source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 correlation_id uuid not null,unique(gateway,provider_environment,provider_intent_id)
);
create table public.credit_pack_payment_events_v1(
 id uuid primary key default extensions.gen_random_uuid(),payment_intent_id uuid not null unique references public.credit_pack_payment_intents_v1(id),
 organization_id uuid not null references public.organizations(id),pack_version_id uuid not null references public.credit_pack_versions(id),
 gateway text not null check(gateway in('DEMO','PAYPAL','CMI')),provider_environment text not null check(provider_environment in('DEMO','SANDBOX','LIVE')),
 deployment_environment text not null check(deployment_environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 provider_intent_id text not null,provider_event_id text not null,payment_reference text not null,
 amount_minor bigint not null check(amount_minor>0),currency char(3)not null check(currency~'^[A-Z]{3}$'),paid_at timestamptz not null,
 payload_hash text not null check(payload_hash~'^[a-f0-9]{64}$'),signature_fingerprint text,
 verification_method text not null check(verification_method in('WEBHOOK_SIGNATURE','API_OAUTH2_TLS','DEMO_SIMULATION')),
 verification_evidence_hash text not null check(verification_evidence_hash~'^[a-f0-9]{64}$'),
 wallet_id uuid not null references public.credit_wallets(id),grant_entry_id bigint not null references public.credit_ledger_entries(id),
 credit_lot_id uuid not null unique references public.credit_lots(id)deferrable initially deferred,
 financial_journal_id uuid not null unique references public.financial_journals(id),pack_snapshot jsonb not null,
 source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 correlation_id uuid not null,unique(gateway,provider_environment,provider_event_id),
 check((verification_method='WEBHOOK_SIGNATURE')=(signature_fingerprint is not null))
);
create table private.credit_pack_payment_notifications_v1(
 gateway text not null,provider_environment text not null,provider_event_id text not null,
 payment_event_id uuid not null references public.credit_pack_payment_events_v1(id),
 payload_hash text not null,notification_hash text not null,verification_method text not null,verification_evidence_hash text not null,created_at timestamptz not null default clock_timestamp(),
 primary key(gateway,provider_environment,provider_event_id)
);
create table public.credit_pack_payment_adjustments_v1(
 id uuid primary key default extensions.gen_random_uuid(),payment_event_id uuid not null references public.credit_pack_payment_events_v1(id),
 organization_id uuid not null references public.organizations(id),event_type text not null,
 gateway text not null,provider_environment text not null,provider_event_id text not null,provider_adjustment_id text not null,
 amount_minor bigint not null check(amount_minor>=0),currency char(3)not null check(currency~'^[A-Z]{3}$'),occurred_at timestamptz not null,
 payload_hash text not null,signature_fingerprint text not null,source_hash text not null,
 financial_journal_id uuid references public.financial_journals(id),created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null,
 unique(gateway,provider_environment,provider_event_id),unique(gateway,provider_environment,provider_adjustment_id,event_type)
);
create table public.credit_pack_native_resolutions_v1(
 id uuid primary key default extensions.gen_random_uuid(),preparation_id uuid not null references public.credit_pack_payment_preparations_v1(id),
 payment_intent_id uuid not null references public.credit_pack_payment_intents_v1(id),organization_id uuid not null references public.organizations(id),
 provider_environment text not null check(provider_environment in('SANDBOX','LIVE')),provider_intent_id text not null,
 native_status text not null check(native_status in('CREATED','APPROVED','PAYER_ACTION_REQUIRED','VOIDED','COMPLETED')),
 verification_method text not null check(verification_method='API_OAUTH2_TLS'),response_hash text not null check(response_hash~'^[a-f0-9]{64}$'),
 observed_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null,
 unique(payment_intent_id,native_status,response_hash)
);

create table public.credit_economic_funding_sources_v1(
 id uuid primary key default extensions.gen_random_uuid(),source_kind text not null check(source_kind in('SUBSCRIPTION','CREDIT_PACK')),
 source_id text not null,organization_id uuid not null references public.organizations(id),source_version_id uuid not null,
 financial_journal_id uuid not null references public.financial_journals(id),gross_minor bigint not null check(gross_minor>0),
 currency char(3)not null check(currency~'^[A-Z]{3}$'),paid_at timestamptz not null,
 source_snapshot jsonb not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null,unique(source_kind,source_id)
);
create table public.credit_economic_classifications_v1(
 id uuid primary key default extensions.gen_random_uuid(),funding_source_id uuid not null references public.credit_economic_funding_sources_v1(id),
 version integer not null check(version>0),fiscal_policy_id uuid references public.credit_revenue_policy_versions_v1(id),
 source_document_id uuid references public.client_commercial_documents(id),allocation_policy_id uuid not null references public.credit_revenue_policy_versions_v1(id),
 gross_minor bigint not null check(gross_minor>0),net_minor bigint not null check(net_minor>=0),tax_minor bigint not null check(tax_minor>=0),
 core_minor bigint not null check(core_minor>=0),benefit_pool_minor bigint not null check(benefit_pool_minor>=0),unallocated_credit_minor bigint not null check(unallocated_credit_minor>=0),
 classification_snapshot jsonb not null,content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),created_by uuid references auth.users(id),correlation_id uuid not null,
 unique(funding_source_id,version),check(gross_minor=net_minor+tax_minor),check(net_minor=core_minor+benefit_pool_minor+unallocated_credit_minor),
 check(fiscal_policy_id is not null or source_document_id is not null)
);
create table public.credit_economic_funding_evidence_v1(
 id uuid primary key default extensions.gen_random_uuid(),funding_source_id uuid not null references public.credit_economic_funding_sources_v1(id),
 evidence_kind text not null check(evidence_kind in('NATIVE_CAPTURE','SUBSCRIPTION_APPLIED','FISCAL_DOCUMENT','FISCAL_CONTEXT')),
 evidence_id text not null,evidence_hash text not null check(evidence_hash~'^[a-f0-9]{64}$'),evidence_snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null,
 unique(funding_source_id,evidence_kind,evidence_id)
);
create table public.credit_economic_processing_events_v1(
 id bigint generated always as identity primary key,funding_source_id uuid references public.credit_economic_funding_sources_v1(id),
 redemption_id uuid references public.benefit_redemptions(id),
 status text not null check(status in('PENDING_FISCAL_REVIEW','PENDING_ALLOCATION_POLICY','PENDING_MANDATE','PENDING_PERIOD_CLOSE','SOURCE_REVIEW_REQUIRED','READY')),
 reason_code text not null check(reason_code~'^[A-Z][A-Z0-9_]{2,100}$'),context_hash text not null check(context_hash~'^[a-f0-9]{64}$'),
 details jsonb not null default'{}',created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null,
 check(funding_source_id is not null or redemption_id is not null),unique nulls not distinct(funding_source_id,redemption_id,status,context_hash)
);
create table public.credit_economic_consumption_facts_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 redemption_id uuid not null references public.benefit_redemptions(id),movement_id bigint not null unique references public.credit_lot_movements(id),
 credit_lot_id uuid not null references public.credit_lots(id),funding_source_id uuid references public.credit_economic_funding_sources_v1(id),
 benefit_version_id uuid not null references public.benefit_versions(id),library_id uuid references public.catalog_libraries(id),
 consumed_quantity bigint not null check(consumed_quantity>0),units bigint not null check(units>0),
 currency char(3)not null check(currency~'^[A-Z]{3}$'),consumed_at timestamptz not null,delivery_proof_hash text not null check(delivery_proof_hash~'^[a-f0-9]{64}$'),
 source_snapshot jsonb not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null
);
create table public.credit_economic_allocations_v1(
 id uuid primary key default extensions.gen_random_uuid(),funding_source_id uuid not null references public.credit_economic_funding_sources_v1(id),
 classification_id uuid not null references public.credit_economic_classifications_v1(id),consumption_fact_id uuid references public.credit_economic_consumption_facts_v1(id),
 allocation_policy_id uuid not null references public.credit_revenue_policy_versions_v1(id),book_route_policy_id uuid references public.credit_revenue_policy_versions_v1(id),
 library_id uuid not null references public.catalog_libraries(id),book_id uuid references public.franchise_pnl_books(id),
 allocation_kind text not null check(allocation_kind in('PURCHASE_CONSUMPTION','SUBSCRIPTION_POOL','REVERSAL')),
 amount_minor bigint not null check(amount_minor>0),currency char(3)not null check(currency~'^[A-Z]{3}$'),
 source_id text not null,reverses_allocation_id uuid references public.credit_economic_allocations_v1(id),
 allocation_snapshot jsonb not null,content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),created_by uuid references auth.users(id),correlation_id uuid not null,
 unique(funding_source_id,allocation_kind,source_id),check((allocation_kind='REVERSAL')=(reverses_allocation_id is not null))
);
create table public.credit_revenue_ledger_v1(
 id bigint generated always as identity primary key,funding_source_id uuid not null references public.credit_economic_funding_sources_v1(id),
 classification_id uuid references public.credit_economic_classifications_v1(id),allocation_id uuid references public.credit_economic_allocations_v1(id),
 entry_type text not null check(entry_type in('CAPTURE','CLASSIFY','ALLOCATE','REFUND','REVERSE')),
 revenue_class text not null check(revenue_class in('CAPTURE_GROSS_PENDING','CORE_SUBSCRIPTION_REVENUE','BENEFIT_POOL_REVENUE','UNALLOCATED_CREDIT_REVENUE','LIBRARY_ALLOCATED_REVENUE','TAX_EXCLUDED')),
 amount_minor bigint not null check(amount_minor<>0),currency char(3)not null check(currency~'^[A-Z]{3}$'),
 source_key text not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null,
 unique(funding_source_id,entry_type,revenue_class,source_key)
);
create table private.credit_economic_pnl_sources_v1(
 allocation_id uuid primary key references public.credit_economic_allocations_v1(id),
 pnl_entry_id uuid not null unique references public.franchise_pnl_entries(id),created_at timestamptz not null default clock_timestamp()
);
create table private.credit_economic_pnl_write_capabilities_v1(
 backend_pid integer not null,transaction_id bigint not null,allocation_id uuid not null references public.credit_economic_allocations_v1(id),
 primary key(backend_pid,transaction_id,allocation_id)
);

-- All fact tables are append-only. Browser clients never receive direct write
-- grants; the private transient capability table is not a financial ledger.
do $$declare t text;begin
 foreach t in array array['credit_revenue_policy_versions_v1','credit_revenue_policy_requests_v1','credit_revenue_policy_decisions_v1','credit_pack_payment_preparations_v1','credit_pack_payment_intents_v1','credit_pack_payment_events_v1','credit_pack_payment_adjustments_v1','credit_pack_native_resolutions_v1','credit_economic_funding_sources_v1','credit_economic_classifications_v1','credit_economic_funding_evidence_v1','credit_economic_processing_events_v1','credit_economic_consumption_facts_v1','credit_economic_allocations_v1','credit_revenue_ledger_v1']loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',t||'_immutable',t);
  execute format('create policy finance_read on public.%I for select to authenticated using(private.credit_revenue_finance_access_v1())',t);
 end loop;
 foreach t in array array['payment_posting_contexts_v1','payment_suspense_journal_sources_v1','credit_pack_payment_notifications_v1','credit_economic_pnl_sources_v1']loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger %I before update or delete on private.%I for each row execute function private.prevent_update_delete()',t||'_immutable',t);
 end loop;
end$$;
revoke all on private.credit_economic_pnl_write_capabilities_v1 from public,anon,authenticated,service_role;

create index credit_economic_funding_org_idx on public.credit_economic_funding_sources_v1(organization_id,paid_at desc,id);
create index credit_economic_consumption_redemption_idx on public.credit_economic_consumption_facts_v1(redemption_id,movement_id);
create index credit_economic_allocation_source_idx on public.credit_economic_allocations_v1(funding_source_id,library_id,id);
create index credit_economic_processing_source_idx on public.credit_economic_processing_events_v1(funding_source_id,id desc);
create index credit_economic_processing_redemption_idx on public.credit_economic_processing_events_v1(redemption_id,id desc);

create function private.validate_credit_revenue_policy_v1(p_kind text,p_source_kind text,p_source uuid,p_scope uuid,p_currency char(3),p_snapshot jsonb)
returns void language plpgsql stable security definer set search_path=pg_catalog as $$
declare source_currency char(3);billing public.client_billing_policy_versions%rowtype;book public.franchise_pnl_books%rowtype;f public.franchises%rowtype;k text;begin
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object'or p_kind is null or p_kind not in('POSTING','FISCAL','ALLOCATION','BOOK_ROUTE')
  or p_source_kind is null or p_source_kind not in('SUBSCRIPTION','CREDIT_PACK','LIBRARY')or p_source is null or p_currency is null or p_currency!~'^[A-Z]{3}$'
 then raise exception'INVALID_CREDIT_REVENUE_POLICY'using errcode='22023';end if;
 if p_source_kind='SUBSCRIPTION'then select currency into source_currency from public.subscription_plan_versions where id=p_source;
 elsif p_source_kind='CREDIT_PACK'then select currency into source_currency from public.credit_pack_versions where id=p_source;
 elsif not exists(select 1 from public.catalog_libraries where id=p_source)then raise exception'CREDIT_POLICY_SOURCE_NOT_FOUND'using errcode='22023';end if;
 if p_source_kind<>'LIBRARY'and source_currency is distinct from p_currency then raise exception'CREDIT_POLICY_SOURCE_CURRENCY_MISMATCH'using errcode='22023';end if;
 if(p_kind='BOOK_ROUTE')is distinct from(p_source_kind='LIBRARY'and p_scope is not null)or(p_kind<>'BOOK_ROUTE'and(p_source_kind='LIBRARY'or p_scope is not null))then raise exception'CREDIT_POLICY_SCOPE_MISMATCH'using errcode='22023';end if;
 if p_kind='POSTING'then
  if(select array_agg(key order by key)from jsonb_object_keys(p_snapshot)key)is distinct from array['cash_account_code','cash_name_ar','cash_name_fr','suspense_account_code','suspense_name_ar','suspense_name_fr']::text[]
   or coalesce(p_snapshot->>'cash_account_code','')!~'^[A-Z][A-Z0-9_]{2,60}$'or coalesce(p_snapshot->>'suspense_account_code','')!~'^[A-Z][A-Z0-9_]{2,60}$'
   or p_snapshot->>'cash_account_code'=p_snapshot->>'suspense_account_code'
  then raise exception'INVALID_CREDIT_POSTING_MAPPING'using errcode='22023';end if;
  foreach k in array array['cash_name_fr','cash_name_ar','suspense_name_fr','suspense_name_ar']loop
   if length(btrim(coalesce(p_snapshot->>k,'')))not between 2 and 200 then raise exception'INVALID_CREDIT_POSTING_LABEL'using errcode='22023';end if;
  end loop;
 elsif p_kind='FISCAL'then
  if(select array_agg(key order by key)from jsonb_object_keys(p_snapshot)key)is distinct from array['billing_policy_version_id']::text[]or coalesce(p_snapshot->>'billing_policy_version_id','')!~*'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then raise exception'INVALID_CREDIT_FISCAL_CONTEXT'using errcode='22023';end if;
  select*into billing from public.client_billing_policy_versions where id=(p_snapshot->>'billing_policy_version_id')::uuid and currency=p_currency;
  if billing.id is null or not exists(select 1 from public.client_billing_policy_approvals where policy_id=billing.id and decision='APPROVED'and decided_by<>billing.created_by)
   or billing.price_basis<>'GROSS_INCLUDES_TAX'or billing.tax_rounding_basis<>'TAX_FROM_GROSS'or billing.rounding_rule<>'HALF_UP'
  then raise exception'APPROVED_CREDIT_FISCAL_CONTEXT_REQUIRED'using errcode='55000';end if;
 elsif p_kind='ALLOCATION'then
  if jsonb_typeof(p_snapshot->'accepted_evidence_kinds')is distinct from'array'or jsonb_typeof(p_snapshot->'fulfillment_modes')is distinct from'array'then raise exception'EXPLICIT_FULFILLMENT_EVIDENCE_POLICY_REQUIRED'using errcode='22023';end if;
  if jsonb_array_length(p_snapshot->'accepted_evidence_kinds')=0 or jsonb_array_length(p_snapshot->'fulfillment_modes')=0
   or exists(select 1 from jsonb_array_elements_text(p_snapshot->'accepted_evidence_kinds')v where v is distinct from'OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT')
   or exists(select 1 from jsonb_array_elements_text(p_snapshot->'fulfillment_modes')v where v is null or v not in('AUTOMATED_PLATFORM','MATRICIA_INTERNAL','DIRECT_PROVIDER','SUBCONTRACTOR_POOL','VOLUME_POOL','RFQ'))
  then raise exception'UNSUPPORTED_FULFILLMENT_EVIDENCE_POLICY'using errcode='22023';end if;
  if p_source_kind='CREDIT_PACK'then
   if p_snapshot-'accepted_evidence_kinds'-'fulfillment_modes'is distinct from jsonb_build_object('purchase_rounding','CUMULATIVE_FLOOR_REMAINDER')then raise exception'INVALID_CREDIT_PURCHASE_ALLOCATION_POLICY'using errcode='22023';end if;
  elsif p_snapshot-'accepted_evidence_kinds'-'fulfillment_modes'is distinct from jsonb_build_object('split_rounding','CORE_FLOOR_POOL_REMAINDER','pool_period','SOURCE_CYCLE_AND_CREDIT_EXPIRY','pool_valuation','REFERENCE_VALUE_WEIGHTED_BY_SUBSCRIPTION_CREDITS','pool_rounding','LARGEST_REMAINDER_LIBRARY_UUID')then
   raise exception'INVALID_SUBSCRIPTION_POOL_ALLOCATION_POLICY'using errcode='22023';
  end if;
 elsif p_kind='BOOK_ROUTE'then
  if(select array_agg(key order by key)from jsonb_object_keys(p_snapshot)key)is distinct from array['book_id','franchise_id','mandate_version_id']::text[]then raise exception'INVALID_CREDIT_BOOK_ROUTE'using errcode='22023';end if;
  foreach k in array array['book_id','franchise_id','mandate_version_id']loop if coalesce(p_snapshot->>k,'')!~*'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then raise exception'INVALID_CREDIT_BOOK_ROUTE'using errcode='22023';end if;end loop;
  select*into book from public.franchise_pnl_books where id=(p_snapshot->>'book_id')::uuid;
  select*into f from public.franchises where id=(p_snapshot->>'franchise_id')::uuid;
  if book.id is null or f.id is null or book.library_id<>p_source or f.library_id<>p_source or book.franchise_organization_id<>f.operator_organization_id or book.currency<>p_currency
   or not exists(select 1 from public.franchise_mandate_versions m where m.id=(p_snapshot->>'mandate_version_id')::uuid and m.franchise_id=f.id)
  then raise exception'CREDIT_BOOK_MANDATE_SCOPE_MISMATCH'using errcode='22023';end if;
 end if;
end$$;
revoke all on function private.validate_credit_revenue_policy_v1(text,text,uuid,uuid,character,jsonb)from public,anon,authenticated,service_role;

create function public.create_credit_revenue_policy_v1(p_policy_kind text,p_source_kind text,p_source_version_id uuid,p_scope_organization_id uuid,p_currency char(3),p_environment text,p_version integer,p_valid_from date,p_valid_until date,p_policy_snapshot jsonb,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();env text;h text;p public.credit_revenue_policy_versions_v1%rowtype;req uuid;rh text;result jsonb;begin
 if not private.credit_revenue_finance_access_v1(actor,true)then raise exception'CREDIT_REVENUE_POLICY_CREATE_DENIED'using errcode='42501';end if;
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null or p_environment is distinct from env then raise exception'CREDIT_REVENUE_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
 if p_version is null or p_version<1 or p_valid_from is null or(p_valid_until is not null and p_valid_until<p_valid_from)or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_CREDIT_REVENUE_POLICY'using errcode='22023';end if;
 perform private.validate_credit_revenue_policy_v1(p_policy_kind,p_source_kind,p_source_version_id,p_scope_organization_id,p_currency,p_policy_snapshot);
 h:=private.canonical_request_hash(jsonb_build_object('kind',p_policy_kind,'source_kind',p_source_kind,'source',p_source_version_id,'scope',p_scope_organization_id,'currency',p_currency,'environment',env,'version',p_version,'from',p_valid_from,'until',p_valid_until,'snapshot',p_policy_snapshot,'reason',btrim(p_reason)));
 perform pg_advisory_xact_lock(hashtextextended('credit-revenue-policy-create:'||actor::text||':'||p_idempotency_key,0));
 select*into p from public.credit_revenue_policy_versions_v1 where created_by=actor and idempotency_key=p_idempotency_key;
 if p.id is not null then
  if p.content_hash<>h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
  select id,request_hash into req,rh from public.credit_revenue_policy_requests_v1 where policy_version_id=p.id and operation='ACTIVATE';
  return jsonb_build_object('outcome','CREDIT_REVENUE_POLICY_PROPOSED','policy_version_id',p.id,'request_id',req,'request_hash',rh,'replayed',true);
 end if;
 insert into public.credit_revenue_policy_versions_v1(policy_kind,source_kind,source_version_id,scope_organization_id,version,currency,environment,valid_from,valid_until,policy_snapshot,content_hash,reason,created_by,idempotency_key,correlation_id)
 values(p_policy_kind,p_source_kind,p_source_version_id,p_scope_organization_id,p_version,p_currency,env,p_valid_from,p_valid_until,p_policy_snapshot,h,btrim(p_reason),actor,p_idempotency_key,p_correlation_id)returning*into p;
 rh:=private.canonical_request_hash(jsonb_build_object('policy',p.id,'hash',h,'operation','ACTIVATE','reason',btrim(p_reason)));
 insert into public.credit_revenue_policy_requests_v1(policy_version_id,operation,request_hash,reason,requested_by,idempotency_key,correlation_id)
 values(p.id,'ACTIVATE',rh,btrim(p_reason),actor,'activate:'||p_idempotency_key,p_correlation_id)returning id into req;
 result:=jsonb_build_object('outcome','CREDIT_REVENUE_POLICY_PROPOSED','policy_version_id',p.id,'request_id',req,'request_hash',rh,'replayed',false);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(actor,'USER','credit.revenue_policy.proposed','credit_revenue_policy',p.id::text,p_correlation_id,result,repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('credit_revenue_policy',p.id::text,'CreditRevenuePolicyProposedV1',p_correlation_id,result,'credit-policy:'||p.id::text);
 return result;
end$$;

create function public.request_credit_revenue_policy_revocation_v1(p_policy_version_id uuid,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();p public.credit_revenue_policy_versions_v1%rowtype;r public.credit_revenue_policy_requests_v1%rowtype;h text;begin
 if not private.credit_revenue_finance_access_v1(actor,true)then raise exception'CREDIT_REVENUE_POLICY_REVOKE_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_POLICY_REVOCATION_REQUEST'using errcode='22023';end if;
 select*into p from public.credit_revenue_policy_versions_v1 where id=p_policy_version_id;
 if p.id is null or p.environment is distinct from(select environment from private.admin_execution_environment_v1 where singleton)then raise exception'CREDIT_REVENUE_POLICY_NOT_FOUND'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('policy',p.id,'hash',p.content_hash,'operation','REVOKE','reason',btrim(p_reason)));
 perform pg_advisory_xact_lock(hashtextextended('credit-revenue-policy:'||p.id::text,0));
 select*into r from public.credit_revenue_policy_requests_v1 where policy_version_id=p.id and operation='REVOKE';
 if r.id is not null then
  if r.requested_by<>actor or r.request_hash<>h or r.idempotency_key<>p_idempotency_key then raise exception'POLICY_REVOCATION_ALREADY_REQUESTED'using errcode='55000';end if;
 else
  insert into public.credit_revenue_policy_requests_v1(policy_version_id,operation,request_hash,reason,requested_by,idempotency_key,correlation_id)values(p.id,'REVOKE',h,btrim(p_reason),actor,p_idempotency_key,p_correlation_id)returning*into r;
  insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(actor,'USER','credit.revenue_policy.revocation_requested','credit_revenue_policy',p.id::text,p_correlation_id,jsonb_build_object('request_id',r.id,'request_hash',h),repeat('0',64));
  insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('credit_revenue_policy',p.id::text,'CreditRevenuePolicyRevocationRequestedV1',p_correlation_id,jsonb_build_object('request_id',r.id,'policy_version_id',p.id),'credit-policy-revoke:'||p.id::text);
 end if;
 return jsonb_build_object('outcome','CREDIT_REVENUE_REVOCATION_PROPOSED','policy_version_id',p.id,'request_id',r.id,'request_hash',r.request_hash);
end$$;

create function public.decide_credit_revenue_policy_v1(p_request_id uuid,p_approve boolean,p_expected_hash text,p_reason text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();r public.credit_revenue_policy_requests_v1%rowtype;p public.credit_revenue_policy_versions_v1%rowtype;d public.credit_revenue_policy_decisions_v1%rowtype;decision text;result jsonb;begin
 if not private.credit_revenue_finance_access_v1(actor,true)then raise exception'CREDIT_REVENUE_REVIEW_DENIED'using errcode='42501';end if;
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_CREDIT_REVENUE_REVIEW'using errcode='22023';end if;
 -- Same security serialization boundary as native platform role decisions.
 perform pg_advisory_xact_lock(hashtextextended('platform.account.access',0));
 select*into r from public.credit_revenue_policy_requests_v1 where id=p_request_id for key share;
 if r.id is null or r.requested_by=actor or not private.credit_revenue_finance_access_v1(actor,true)or not private.credit_revenue_finance_access_v1(r.requested_by,true)then raise exception'CREDIT_REVENUE_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 perform id from auth.users where id in(actor,r.requested_by)order by id for share;
 perform user_id from public.platform_user_roles where user_id in(actor,r.requested_by)and role_code in('SUPER_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR')order by user_id,role_code for share;
 if not private.credit_revenue_finance_access_v1(actor,true)or not private.credit_revenue_finance_access_v1(r.requested_by,true)then raise exception'CREDIT_REVENUE_REVIEW_DENIED'using errcode='42501';end if;
 if p_expected_hash is distinct from r.request_hash then raise exception'STALE_CREDIT_REVENUE_POLICY_REQUEST'using errcode='40001';end if;
 select*into p from public.credit_revenue_policy_versions_v1 where id=r.policy_version_id;
 if p.environment is distinct from(select environment from private.admin_execution_environment_v1 where singleton)then raise exception'CREDIT_REVENUE_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
 decision:=case when p_approve then'APPROVE'else'REJECT'end;
 select*into d from public.credit_revenue_policy_decisions_v1 where request_id=r.id;
 if d.request_id is not null then if d.decided_by<>actor or d.decision<>decision or d.reason<>btrim(p_reason)then raise exception'CREDIT_REVENUE_POLICY_ALREADY_DECIDED'using errcode='55000';end if;return d.result;end if;
 if p_approve and r.operation='ACTIVATE'then perform private.validate_credit_revenue_policy_v1(p.policy_kind,p.source_kind,p.source_version_id,p.scope_organization_id,p.currency,p.policy_snapshot);end if;
 result:=jsonb_build_object('outcome','CREDIT_REVENUE_POLICY_'||case when p_approve then case r.operation when'ACTIVATE'then'APPROVED'else'REVOKED'end else'REJECTED'end,'policy_version_id',p.id,'request_id',r.id,'operation',r.operation,'source_hash',r.request_hash);
 insert into public.credit_revenue_policy_decisions_v1(request_id,decision,reason,decided_by,source_hash,result)values(r.id,decision,btrim(p_reason),actor,r.request_hash,result);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(actor,'USER','credit.revenue_policy.decided','credit_revenue_policy',p.id::text,p_correlation_id,result,repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('credit_revenue_policy',p.id::text,'CreditRevenuePolicyDecidedV1',p_correlation_id,result,'credit-policy-decision:'||r.id::text);
 return result;
end$$;

create function private.approved_credit_revenue_policy_v1(p_kind text,p_source_kind text,p_source uuid,p_currency char(3),p_source_on date,p_scope uuid default null)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select to_jsonb(p)||jsonb_build_object('activation_request_id',r.id,'approval',to_jsonb(d))
 from public.credit_revenue_policy_versions_v1 p
 join public.credit_revenue_policy_requests_v1 r on r.policy_version_id=p.id and r.operation='ACTIVATE'
 join public.credit_revenue_policy_decisions_v1 d on d.request_id=r.id and d.decision='APPROVE'and d.decided_by<>r.requested_by and d.source_hash=r.request_hash
 where p.policy_kind=p_kind and p.source_kind=p_source_kind and p.source_version_id=p_source and p.currency=p_currency and p.scope_organization_id is not distinct from p_scope
 and p.environment=(select environment from private.admin_execution_environment_v1 where singleton)
 and p.valid_from<=p_source_on and(p.valid_until is null or p.valid_until>=p_source_on)
 and not exists(select 1 from public.credit_revenue_policy_requests_v1 revoked join public.credit_revenue_policy_decisions_v1 decision on decision.request_id=revoked.id and decision.decision='APPROVE'where revoked.policy_version_id=p.id and revoked.operation='REVOKE')
 order by p.version desc,p.id desc limit 1
$$;
revoke all on function private.approved_credit_revenue_policy_v1(text,text,uuid,character,date,uuid)from public,anon,authenticated,service_role;

do $$declare f regprocedure;begin foreach f in array array[
 'public.create_credit_revenue_policy_v1(text,text,uuid,uuid,character,text,integer,date,date,jsonb,text,text,uuid)'::regprocedure,
 'public.request_credit_revenue_policy_revocation_v1(uuid,text,text,uuid)'::regprocedure,
 'public.decide_credit_revenue_policy_v1(uuid,boolean,text,text,uuid)'::regprocedure]loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 execute format('grant execute on function %s to authenticated',f);
end loop;end$$;

create function private.prepare_payment_posting_context_v1(p_preparation_id uuid,p_organization_id uuid,p_source_kind text,p_source_version_id uuid,p_currency char(3),p_gateway text,p_provider_environment text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();env text;policy jsonb;payload jsonb;c private.payment_posting_contexts_v1%rowtype;
 cash_id uuid;suspense_id uuid;context_id uuid:=extensions.gen_random_uuid();snapshot jsonb;h text;begin
 if actor is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)then raise exception'PAYMENT_POSTING_PREPARATION_DENIED'using errcode='42501';end if;
 if p_preparation_id is null or p_source_kind is null or p_source_kind not in('SUBSCRIPTION','CREDIT_PACK')or p_source_version_id is null then raise exception'INVALID_PAYMENT_POSTING_CONTEXT'using errcode='22023';end if;
 env:=private.assert_payment_runtime_v1(p_gateway,p_provider_environment,false);
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 select*into c from private.payment_posting_contexts_v1 where source_kind=p_source_kind and preparation_id=p_preparation_id;
 if c.id is not null then
  if c.organization_id<>p_organization_id or c.source_version_id<>p_source_version_id or c.currency<>p_currency or c.gateway<>p_gateway or c.provider_environment<>p_provider_environment or c.deployment_environment<>env or c.created_by<>actor then raise exception'PAYMENT_POSTING_CONTEXT_REUSED'using errcode='22000';end if;
  return jsonb_build_object('posting_context_id',c.id,'posting_context_hash',c.context_hash);
 end if;
 if not private.client_identity_allows_new_operations(p_organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 policy:=private.approved_credit_revenue_policy_v1('POSTING',p_source_kind,p_source_version_id,p_currency,(clock_timestamp()at time zone'Africa/Casablanca')::date,null);
 if policy is null then raise exception'APPROVED_PAYMENT_POSTING_MAPPING_REQUIRED'using errcode='55000';end if;
 payload:=policy->'policy_snapshot';
 perform private.validate_credit_revenue_policy_v1('POSTING',p_source_kind,p_source_version_id,null,p_currency,payload);
 insert into public.financial_accounts(organization_id,code,name,account_type,currency)values
 (p_organization_id,payload->>'cash_account_code',payload->>'cash_name_fr','ASSET',p_currency),
 (p_organization_id,payload->>'suspense_account_code',payload->>'suspense_name_fr','LIABILITY',p_currency)
 on conflict(organization_id,code)do nothing;
 select id into cash_id from public.financial_accounts where organization_id=p_organization_id and code=payload->>'cash_account_code'and account_type='ASSET'and currency=p_currency;
 select id into suspense_id from public.financial_accounts where organization_id=p_organization_id and code=payload->>'suspense_account_code'and account_type='LIABILITY'and currency=p_currency;
 if cash_id is null or suspense_id is null or cash_id=suspense_id then raise exception'PAYMENT_POSTING_ACCOUNTS_INCOMPATIBLE'using errcode='55000';end if;
 snapshot:=jsonb_build_object('posting_context_id',context_id,'preparation_id',p_preparation_id,'organization_id',p_organization_id,'source_kind',p_source_kind,'source_version_id',p_source_version_id,
 'policy',policy,'currency',p_currency,'gateway',p_gateway,'provider_environment',p_provider_environment,'deployment_environment',env,'cash_account_id',cash_id,'suspense_account_id',suspense_id,'prepared_by',actor);
 h:=private.canonical_request_hash(snapshot);
 insert into private.payment_posting_contexts_v1(id,preparation_id,organization_id,source_kind,source_version_id,policy_version_id,currency,gateway,provider_environment,deployment_environment,cash_account_id,suspense_account_id,context_snapshot,context_hash,created_by)
 values(context_id,p_preparation_id,p_organization_id,p_source_kind,p_source_version_id,(policy->>'id')::uuid,p_currency,p_gateway,p_provider_environment,env,cash_id,suspense_id,snapshot,h,actor);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(p_organization_id,actor,'USER','payment.posting_context_prepared','payment_posting_context',context_id::text,p_preparation_id,jsonb_build_object('source_kind',p_source_kind,'source_version_id',p_source_version_id,'policy_version_id',policy->>'id','context_hash',h),repeat('0',64));
 return jsonb_build_object('posting_context_id',context_id,'posting_context_hash',h);
end$$;

create function private.get_payment_posting_context_v1(p_source_kind text,p_preparation_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select to_jsonb(c)||jsonb_build_object('posting_context_id',c.id,'posting_context_hash',c.context_hash)
 from private.payment_posting_contexts_v1 c where c.source_kind=p_source_kind and c.preparation_id=p_preparation_id
$$;

create function private.post_verified_payment_suspense_v1(p_posting_context_id uuid,p_organization_id uuid,p_source_kind text,p_source_id text,p_gross_minor bigint,p_currency char(3),p_effective_at timestamptz,p_actor uuid,p_correlation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare c private.payment_posting_contexts_v1%rowtype;prior private.payment_suspense_journal_sources_v1%rowtype;
 env text;h text;j uuid:=extensions.gen_random_uuid();begin
 if p_source_kind is null or p_source_kind not in('SUBSCRIPTION','CREDIT_PACK')or p_gross_minor is null or p_gross_minor<=0 or p_effective_at is null or p_actor is null or p_correlation_id is null or length(coalesce(p_source_id,''))not between 10 and 500 then raise exception'INVALID_VERIFIED_PAYMENT_POSTING'using errcode='22023';end if;
 select*into c from private.payment_posting_contexts_v1 where id=p_posting_context_id;
 if c.id is null or c.organization_id is distinct from p_organization_id or c.source_kind is distinct from p_source_kind or c.currency is distinct from p_currency
  or c.context_hash<>private.canonical_request_hash(c.context_snapshot)
  or left(p_source_id,length(c.gateway||':'||c.provider_environment||':'))<>c.gateway||':'||c.provider_environment||':'
 then raise exception'PAYMENT_POSTING_SOURCE_CONTEXT_MISMATCH'using errcode='23514';end if;
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null or(c.provider_environment<>'LIVE'and(env not in('DEVELOPMENT','STAGING')or c.deployment_environment<>env))then raise exception'PAYMENT_POSTING_ENVIRONMENT_INCOMPATIBLE'using errcode='42501';end if;
 if not exists(select 1 from public.financial_accounts where id=c.cash_account_id and organization_id=p_organization_id and currency=p_currency and account_type='ASSET')or not exists(select 1 from public.financial_accounts where id=c.suspense_account_id and organization_id=p_organization_id and currency=p_currency and account_type='LIABILITY')then raise exception'PAYMENT_POSTING_ACCOUNTS_INCOMPATIBLE'using errcode='23514';end if;
 h:=private.canonical_request_hash(jsonb_build_object('context_id',c.id,'context_hash',c.context_hash,'organization',p_organization_id,'source_kind',p_source_kind,'source_id',p_source_id,'amount_minor',p_gross_minor::text,'currency',p_currency,'effective_at',p_effective_at,'actor',p_actor,'correlation_id',p_correlation_id));
 perform pg_advisory_xact_lock(hashtextextended('verified-payment-posting:'||p_source_kind||':'||p_source_id,0));
 select*into prior from private.payment_suspense_journal_sources_v1 where source_kind=p_source_kind and source_id=p_source_id;
 if prior.financial_journal_id is not null then if prior.request_hash<>h then raise exception'PAYMENT_POSTING_REPLAY_MISMATCH'using errcode='22000';end if;return prior.financial_journal_id;end if;
 -- The frozen mapping remains authoritative for an already-prepared payment,
 -- even if its policy has since expired or has been revoked. This records cash
 -- against a liability; fiscal revenue recognition is a separate governed step.
 insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)
 values(j,p_organization_id,case p_source_kind when'SUBSCRIPTION'then'SUBSCRIPTION_PAYMENT'else'CREDIT_PACK_PAYMENT'end,p_currency,'verified.payment.capture',p_source_kind||':'||p_source_id,p_correlation_id,p_effective_at,'Verified payment retained pending economic classification',p_actor);
 insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values
 (p_organization_id,j,c.cash_account_id,'DEBIT',p_gross_minor,p_currency),(p_organization_id,j,c.suspense_account_id,'CREDIT',p_gross_minor,p_currency);
 insert into private.payment_suspense_journal_sources_v1(source_kind,source_id,posting_context_id,financial_journal_id,request_hash)values(p_source_kind,p_source_id,c.id,j,h);
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(p_organization_id,'SERVICE','financial.journal.posted','financial_journal',j::text,p_correlation_id,jsonb_build_object('source_kind',p_source_kind,'posting_context_id',c.id,'gross_minor',p_gross_minor::text,'currency',p_currency,'classification','PENDING_FISCAL_REVIEW'),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(p_organization_id,'financial_journal',j::text,'FinancialJournalPostedV1',p_correlation_id,jsonb_build_object('journal_id',j,'organization_id',p_organization_id,'currency',p_currency,'debit_minor',p_gross_minor::text,'source_kind',p_source_kind),'payment-journal:'||j::text);
 return j;
end$$;
revoke all on function private.prepare_payment_posting_context_v1(uuid,uuid,text,uuid,character,text,text),private.get_payment_posting_context_v1(text,uuid),private.post_verified_payment_suspense_v1(uuid,uuid,text,text,bigint,character,timestamp with time zone,uuid,uuid)from public,anon,authenticated,service_role;

create table private.payment_provider_targets_v1(
 gateway text not null,provider_environment text not null,reference_kind text not null check(reference_kind in('INTENT','CAPTURE')),
 provider_reference text not null,source_kind text not null check(source_kind in('SUBSCRIPTION','CREDIT_PACK')),payment_intent_id uuid not null,
 source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(gateway,provider_environment,reference_kind,provider_reference)
);
create table private.payment_provider_reference_conflicts_v1(
 gateway text not null,provider_environment text not null,reference_kind text not null,provider_reference text not null,
 source_hash text not null,created_at timestamptz not null default clock_timestamp(),
 primary key(gateway,provider_environment,reference_kind,provider_reference)
);
alter table private.payment_provider_targets_v1 enable row level security;
alter table private.payment_provider_reference_conflicts_v1 enable row level security;
alter table private.credit_economic_pnl_write_capabilities_v1 enable row level security;
revoke all on private.payment_provider_targets_v1,private.payment_provider_reference_conflicts_v1 from public,anon,authenticated,service_role;
create trigger payment_provider_targets_immutable before update or delete on private.payment_provider_targets_v1 for each row execute function private.prevent_update_delete();
create trigger payment_provider_reference_conflicts_immutable before update or delete on private.payment_provider_reference_conflicts_v1 for each row execute function private.prevent_update_delete();

create function private.register_payment_provider_target_v1(p_source_kind text,p_payment_intent_id uuid,p_gateway text,p_provider_environment text,p_reference_kind text,p_reference text,p_source_hash text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare prior private.payment_provider_targets_v1%rowtype;begin
 if p_source_kind is null or p_source_kind not in('SUBSCRIPTION','CREDIT_PACK')or p_payment_intent_id is null or p_gateway is null or p_gateway not in('DEMO','PAYPAL','CMI')or p_provider_environment is null or p_provider_environment not in('DEMO','SANDBOX','LIVE')or p_reference_kind is null or p_reference_kind not in('INTENT','CAPTURE')or length(coalesce(p_reference,''))not between 3 and 500 or coalesce(p_source_hash,'')!~'^[a-f0-9]{64}$'then raise exception'INVALID_NATIVE_PAYMENT_TARGET'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('payment-target:'||p_gateway||':'||p_provider_environment||':'||p_reference_kind||':'||p_reference,0));
 if exists(select 1 from private.payment_provider_reference_conflicts_v1 where gateway=p_gateway and provider_environment=p_provider_environment and reference_kind=p_reference_kind and provider_reference=p_reference)then raise exception'PAYMENT_PROVIDER_REFERENCE_AMBIGUOUS'using errcode='23514';end if;
 select*into prior from private.payment_provider_targets_v1 where gateway=p_gateway and provider_environment=p_provider_environment and reference_kind=p_reference_kind and provider_reference=p_reference;
 if prior.payment_intent_id is not null then
  if prior.source_kind is distinct from p_source_kind or prior.payment_intent_id is distinct from p_payment_intent_id then raise exception'PAYMENT_PROVIDER_REFERENCE_ALREADY_BOUND'using errcode='23514';end if;
  return;
 end if;
 insert into private.payment_provider_targets_v1(gateway,provider_environment,reference_kind,provider_reference,source_kind,payment_intent_id,source_hash)
 values(p_gateway,p_provider_environment,p_reference_kind,p_reference,p_source_kind,p_payment_intent_id,p_source_hash);
end$$;
revoke all on function private.register_payment_provider_target_v1(text,uuid,text,text,text,text,text)from public,anon,authenticated,service_role;

create function private.bind_payment_provider_target_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare kind text;begin
 if new.provider_environment='UNVERIFIED'then return new;end if;
 kind:=case when tg_table_name like'credit_pack_%'then'CREDIT_PACK'else'SUBSCRIPTION'end;
 if tg_table_name in('subscription_payment_intents','credit_pack_payment_intents_v1')then
  perform private.register_payment_provider_target_v1(kind,new.id,new.gateway,new.provider_environment,'INTENT',new.provider_intent_id,private.canonical_request_hash(to_jsonb(new)));
 else
  perform private.register_payment_provider_target_v1(kind,new.payment_intent_id,new.gateway,new.provider_environment,'CAPTURE',new.payment_reference,private.canonical_request_hash(to_jsonb(new)));
 end if;
 return new;
end$$;
revoke all on function private.bind_payment_provider_target_v1()from public,anon,authenticated,service_role;
create trigger subscription_payment_intent_kind_binding after insert on public.subscription_payment_intents for each row execute function private.bind_payment_provider_target_v1();
create trigger subscription_payment_capture_kind_binding after insert on public.subscription_payment_events for each row execute function private.bind_payment_provider_target_v1();
create trigger credit_pack_payment_intent_kind_binding after insert on public.credit_pack_payment_intents_v1 for each row execute function private.bind_payment_provider_target_v1();
create trigger credit_pack_payment_capture_kind_binding after insert on public.credit_pack_payment_events_v1 for each row execute function private.bind_payment_provider_target_v1();

-- This is routing provenance only, never proof of a paid credit grant. Retain
-- ambiguous historical capture references as blocked rather than picking one.
insert into private.payment_provider_targets_v1(gateway,provider_environment,reference_kind,provider_reference,source_kind,payment_intent_id,source_hash)
select gateway,provider_environment,'INTENT',provider_intent_id,'SUBSCRIPTION',id,private.canonical_request_hash(to_jsonb(i))from public.subscription_payment_intents i where provider_environment in('DEMO','SANDBOX','LIVE');
insert into private.payment_provider_reference_conflicts_v1(gateway,provider_environment,reference_kind,provider_reference,source_hash)
select gateway,provider_environment,'CAPTURE',payment_reference,private.canonical_request_hash(jsonb_agg(payment_intent_id order by payment_intent_id))
from public.subscription_payment_events where provider_environment in('DEMO','SANDBOX','LIVE')group by gateway,provider_environment,payment_reference having count(distinct payment_intent_id)>1;
insert into private.payment_provider_targets_v1(gateway,provider_environment,reference_kind,provider_reference,source_kind,payment_intent_id,source_hash)
select gateway,provider_environment,'CAPTURE',payment_reference,'SUBSCRIPTION',(array_agg(payment_intent_id order by payment_intent_id))[1],private.canonical_request_hash(jsonb_agg(id order by id))
from public.subscription_payment_events where provider_environment in('DEMO','SANDBOX','LIVE')group by gateway,provider_environment,payment_reference having count(distinct payment_intent_id)=1;

create function public.resolve_verified_payment_kind_v1(p_gateway text,p_provider_environment text,p_provider_intent_id text default null,p_payment_reference text default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare targets jsonb;begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_PAYMENT_CALLBACK_REQUIRED'using errcode='42501';end if;
 perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,false);
 if(p_provider_intent_id is null and p_payment_reference is null)or(p_provider_intent_id is not null and length(p_provider_intent_id)not between 3 and 500)or(p_payment_reference is not null and length(p_payment_reference)not between 3 and 500)then raise exception'INVALID_NATIVE_PAYMENT_REFERENCE'using errcode='22023';end if;
 if exists(select 1 from private.payment_provider_reference_conflicts_v1 where gateway=p_gateway and provider_environment=p_provider_environment and((reference_kind='INTENT'and provider_reference=p_provider_intent_id)or(reference_kind='CAPTURE'and provider_reference=p_payment_reference)))then raise exception'PAYMENT_PROVIDER_REFERENCE_AMBIGUOUS'using errcode='23514';end if;
 select coalesce(jsonb_agg(target),'[]')into targets from(select distinct jsonb_build_object('kind',source_kind,'payment_intent_id',payment_intent_id)target from private.payment_provider_targets_v1 where gateway=p_gateway and provider_environment=p_provider_environment and((reference_kind='INTENT'and provider_reference=p_provider_intent_id)or(reference_kind='CAPTURE'and provider_reference=p_payment_reference)))resolved;
 if jsonb_array_length(targets)<>1 then raise exception'PAYMENT_PROVIDER_TARGET_NOT_UNIQUE'using errcode='P0002';end if;
 return targets->0;
end$$;
revoke all on function public.resolve_verified_payment_kind_v1(text,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.resolve_verified_payment_kind_v1(text,text,text,text)to service_role;

create function public.prepare_credit_pack_payment_intent_v1(p_organization_id uuid,p_pack_version_id uuid,p_gateway text,p_provider_environment text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();env text;p public.credit_pack_versions%rowtype;prior public.credit_pack_payment_preparations_v1%rowtype;paid public.credit_pack_payment_events_v1%rowtype;registered public.credit_pack_payment_intents_v1%rowtype;
 v_preparation_id uuid:=extensions.gen_random_uuid();h text;posting jsonb;snapshot jsonb;result jsonb;begin
 if actor is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)then raise exception'CREDIT_PACK_CHECKOUT_DENIED'using errcode='42501';end if;
 if p_pack_version_id is null or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_CREDIT_PACK_CHECKOUT'using errcode='22023';end if;
 env:=private.assert_payment_runtime_v1(p_gateway,p_provider_environment,false);
 h:=private.canonical_request_hash(jsonb_build_object('organization',p_organization_id,'pack_version',p_pack_version_id,'actor',actor,'gateway',p_gateway,'provider_environment',p_provider_environment,'deployment_environment',env));
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 select*into prior from public.credit_pack_payment_preparations_v1 where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if prior.id is not null then
  if prior.request_hash<>h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
  if exists(select 1 from public.credit_pack_native_resolutions_v1 where preparation_id=prior.id and native_status='VOIDED')and not exists(select 1 from public.credit_pack_native_resolutions_v1 where preparation_id=prior.id and native_status='COMPLETED')and not exists(select 1 from public.credit_pack_payment_events_v1 e join public.credit_pack_payment_intents_v1 i on i.id=e.payment_intent_id where i.preparation_id=prior.id)then raise exception'CREDIT_PACK_ATTEMPT_NATIVE_VOIDED'using errcode='55000';end if;
  select*into registered from public.credit_pack_payment_intents_v1 where preparation_id=prior.id;
  select e.*into paid from public.credit_pack_payment_events_v1 e join public.credit_pack_payment_intents_v1 i on i.id=e.payment_intent_id where i.preparation_id=prior.id;
  return jsonb_build_object('preparation_id',prior.id,'amount_minor',prior.amount_minor::text,'currency',prior.currency,'gateway',prior.gateway,'provider_environment',prior.provider_environment,'purchase_kind','CREDIT_PACK','pack_version_id',prior.pack_version_id,'expires_at',prior.expires_at,'payment_intent_id',registered.id,'provider_intent_id',registered.provider_intent_id,'capture_result',paid.result,'replayed',true,'create_attempt_id',prior.id,'create_authorized',false,'creation_state',case when paid.id is not null then'CAPTURED'when registered.id is not null then'REGISTERED'else'CREATE_REQUESTED_UNKNOWN'end);
 end if;
 if not private.client_identity_allows_new_operations(p_organization_id)or not private.subscription_financially_clear(p_organization_id)then raise exception'CREDIT_PACK_CHECKOUT_ADMISSION_REQUIRED'using errcode='55000';end if;
 select*into p from public.credit_pack_versions where id=p_pack_version_id and status='ACTIVE';
 if p.id is null or p.price_minor<=0 or not exists(select 1 from public.credit_pack_definitions where id=p.pack_id and status='ACTIVE'and current_version=p.version)then raise exception'ACTIVE_PAID_CREDIT_PACK_REQUIRED'using errcode='55000';end if;
 -- Do not create another payable preparation for the same purchase while an
 -- earlier native order is unresolved. Expiry is not evidence of PSP cancellation.
 if exists(select 1 from public.credit_pack_payment_preparations_v1 q where q.organization_id=p_organization_id and q.pack_version_id=p_pack_version_id and not exists(select 1 from public.credit_pack_payment_intents_v1 i join public.credit_pack_payment_events_v1 e on e.payment_intent_id=i.id where i.preparation_id=q.id)
 and not(exists(select 1 from public.credit_pack_native_resolutions_v1 where preparation_id=q.id and native_status='VOIDED')and not exists(select 1 from public.credit_pack_native_resolutions_v1 where preparation_id=q.id and native_status='COMPLETED')))then raise exception'CREDIT_PACK_PAYMENT_ATTEMPT_ALREADY_PENDING'using errcode='55000';end if;
 posting:=private.prepare_payment_posting_context_v1(v_preparation_id,p_organization_id,'CREDIT_PACK',p.id,p.currency,p_gateway,p_provider_environment);
 snapshot:=to_jsonb(p)||jsonb_build_object('pack_code',(select code from public.credit_pack_definitions where id=p.pack_id));
 insert into public.credit_pack_payment_preparations_v1(id,organization_id,pack_version_id,actor_id,idempotency_key,request_hash,gateway,provider_environment,deployment_environment,amount_minor,currency,pack_snapshot,posting_context_id,expires_at)
 values(v_preparation_id,p_organization_id,p.id,actor,p_idempotency_key,h,p_gateway,p_provider_environment,env,p.price_minor,p.currency,snapshot,(posting->>'posting_context_id')::uuid,clock_timestamp()+interval'30 minutes');
 select*into prior from public.credit_pack_payment_preparations_v1 where id=v_preparation_id;
 -- Inserting the immutable preparation is the durable CREATE_REQUESTED marker.
 -- Only this first return may POST a provider order. Replaying even the same
 -- idempotency key must GET an existing order or reconcile the unknown attempt;
 -- provider idempotency retention is not assumed to last forever.
 result:=jsonb_build_object('preparation_id',v_preparation_id,'amount_minor',p.price_minor::text,'currency',p.currency,'gateway',p_gateway,'provider_environment',p_provider_environment,'purchase_kind','CREDIT_PACK','pack_version_id',p.id,'expires_at',prior.expires_at,'payment_intent_id',null,'provider_intent_id',null,'capture_result',null,'replayed',false,'create_attempt_id',v_preparation_id,'create_authorized',true,'creation_state','CREATE_REQUESTED');
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,actor,'USER','credit.pack_checkout_prepared','credit_pack_payment_preparation',v_preparation_id::text,v_preparation_id,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'credit_pack_payment_preparation',v_preparation_id::text,'CreditPackPaymentPreparedV1',v_preparation_id,result,'credit-pack-prepare:'||v_preparation_id::text);
 return result;
end$$;

create function public.register_credit_pack_payment_intent_v1(p_preparation_id uuid,p_provider_environment text,p_provider_intent_id text,p_amount_minor bigint,p_currency char(3),p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p public.credit_pack_payment_preparations_v1%rowtype;i public.credit_pack_payment_intents_v1%rowtype;env text;h text;begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_PAYMENT_REGISTRATION_REQUIRED'using errcode='42501';end if;
 select*into p from public.credit_pack_payment_preparations_v1 where id=p_preparation_id;
 if p.id is null then raise exception'CREDIT_PACK_PREPARATION_REQUIRED'using errcode='P0002';end if;
 env:=private.assert_payment_runtime_v1(p.gateway,p_provider_environment,false);
 if p.provider_environment is distinct from p_provider_environment or p.deployment_environment is distinct from env or p.amount_minor is distinct from p_amount_minor or p.currency is distinct from p_currency or length(coalesce(p_provider_intent_id,''))not between 8 and 200 then raise exception'CREDIT_PACK_PROVIDER_CONTEXT_MISMATCH'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p.organization_id::text,0));
 select*into i from public.credit_pack_payment_intents_v1 where preparation_id=p.id;
 if i.id is not null then
  if i.provider_intent_id<>p_provider_intent_id then raise exception'CREDIT_PACK_PREPARATION_ALREADY_REGISTERED'using errcode='23514';end if;
  return jsonb_build_object('payment_intent_id',i.id,'replayed',true);
 end if;
 -- A native response may arrive after preparation expiry. It still belongs to
 -- that same paid attempt; never release an ambiguous provider order by timeout.
 h:=private.canonical_request_hash(jsonb_build_object('preparation_id',p.id,'request_hash',p.request_hash,'posting_context_id',p.posting_context_id,'provider_intent_id',p_provider_intent_id,'amount_minor',p_amount_minor::text,'currency',p_currency,'provider_environment',p_provider_environment));
 insert into public.credit_pack_payment_intents_v1(preparation_id,organization_id,pack_version_id,gateway,provider_environment,deployment_environment,provider_intent_id,amount_minor,currency,source_hash,created_by,correlation_id)
 values(p.id,p.organization_id,p.pack_version_id,p.gateway,p.provider_environment,p.deployment_environment,p_provider_intent_id,p.amount_minor,p.currency,h,p.actor_id,p_correlation_id)returning*into i;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p.organization_id,'SERVICE','credit.pack_provider_registered','credit_pack_payment_intent',i.id::text,p_correlation_id,jsonb_build_object('preparation_id',p.id,'source_hash',h),repeat('0',64));
 return jsonb_build_object('payment_intent_id',i.id,'replayed',false);
end$$;

do $$declare f regprocedure;begin foreach f in array array[
 'public.prepare_credit_pack_payment_intent_v1(uuid,uuid,text,text,text)'::regprocedure,
 'public.register_credit_pack_payment_intent_v1(uuid,text,text,bigint,character,uuid)'::regprocedure]loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 execute format('grant execute on function %s to %I',f,case when f::text like'%register_%'then'service_role'else'authenticated'end);
end loop;end$$;

create function public.record_credit_pack_native_resolution_v1(p_request_id uuid,p_provider_environment text,p_provider_intent_id text,p_native_status text,p_response_hash text,p_observed_at timestamptz,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p public.credit_pack_payment_preparations_v1%rowtype;i public.credit_pack_payment_intents_v1%rowtype;r public.credit_pack_native_resolutions_v1%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_NATIVE_PAYMENT_LOOKUP_REQUIRED'using errcode='42501';end if;
 if p_provider_environment is null or p_provider_environment not in('SANDBOX','LIVE')or p_native_status is null or p_native_status not in('CREATED','APPROVED','PAYER_ACTION_REQUIRED','VOIDED','COMPLETED')or coalesce(p_response_hash,'')!~'^[a-f0-9]{64}$'or p_observed_at is null or p_observed_at>clock_timestamp()+interval'5 minutes'then raise exception'INVALID_NATIVE_PAYMENT_OBSERVATION'using errcode='22023';end if;
 select*into p from public.credit_pack_payment_preparations_v1 where id=p_request_id;
 select*into i from public.credit_pack_payment_intents_v1 where preparation_id=p.id;
 if p.id is null or i.id is null or i.provider_environment is distinct from p_provider_environment or i.provider_intent_id is distinct from p_provider_intent_id or p_observed_at<i.created_at-interval'5 minutes'then raise exception'NATIVE_CREDIT_PACK_ORDER_CONTEXT_MISMATCH'using errcode='23514';end if;
 perform private.assert_payment_runtime_v1(i.gateway,p_provider_environment,false);
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p.organization_id::text,0));
 if p_native_status='VOIDED'and(exists(select 1 from public.credit_pack_payment_events_v1 where payment_intent_id=i.id)or exists(select 1 from public.credit_pack_native_resolutions_v1 where payment_intent_id=i.id and native_status='COMPLETED'))then raise exception'NATIVE_COMPLETED_PAYMENT_CANNOT_BE_RELEASED'using errcode='55000';end if;
 select*into r from public.credit_pack_native_resolutions_v1 where payment_intent_id=i.id and native_status=p_native_status and response_hash=p_response_hash;
 if r.id is null then
  insert into public.credit_pack_native_resolutions_v1(preparation_id,payment_intent_id,organization_id,provider_environment,provider_intent_id,native_status,verification_method,response_hash,observed_at,correlation_id)
  values(p.id,i.id,p.organization_id,p_provider_environment,p_provider_intent_id,p_native_status,'API_OAUTH2_TLS',p_response_hash,p_observed_at,p_correlation_id)returning*into r;
  insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p.organization_id,'SERVICE','credit.pack_native_order_observed','credit_pack_payment_intent',i.id::text,p_correlation_id,jsonb_build_object('observation_id',r.id,'native_status',p_native_status,'verification_method','API_OAUTH2_TLS','response_hash',p_response_hash),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p.organization_id,'credit_pack_payment_intent',i.id::text,'CreditPackNativeOrderObservedV1',p_correlation_id,jsonb_build_object('observation_id',r.id,'payment_intent_id',i.id,'native_status',p_native_status,'verification_method','API_OAUTH2_TLS'),'credit-pack-native:'||r.id::text);
 end if;
 return jsonb_build_object('outcome','CREDIT_PACK_NATIVE_ORDER_OBSERVED','observation_id',r.id,'native_status',r.native_status,'verification_method',r.verification_method,'new_attempt_allowed',r.native_status='VOIDED');
end$$;
revoke all on function public.record_credit_pack_native_resolution_v1(uuid,text,text,text,text,timestamp with time zone,uuid)from public,anon,authenticated,service_role;
grant execute on function public.record_credit_pack_native_resolution_v1(uuid,text,text,text,text,timestamp with time zone,uuid)to service_role;

create function private.register_payment_economic_capture_v1(p_source_kind text,p_source_id text,p_organization_id uuid,p_source_version_id uuid,p_financial_journal_id uuid,p_gross_minor bigint,p_currency char(3),p_paid_at timestamptz,p_source_snapshot jsonb,p_source_hash text,p_correlation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare f public.credit_economic_funding_sources_v1%rowtype;h text;snapshot jsonb;begin
 if p_source_kind is null or p_source_kind not in('SUBSCRIPTION','CREDIT_PACK')or length(coalesce(p_source_id,''))not between 10 and 500 or p_gross_minor is null or p_gross_minor<=0 or p_paid_at is null or p_source_snapshot is null or jsonb_typeof(p_source_snapshot)<>'object'or octet_length(p_source_snapshot::text)>32768 or p_source_hash is distinct from private.canonical_request_hash(p_source_snapshot)then raise exception'INVALID_NATIVE_ECONOMIC_CAPTURE'using errcode='22023';end if;
 if not exists(select 1 from public.financial_journals j where j.id=p_financial_journal_id and j.organization_id=p_organization_id and j.currency=p_currency and j.status='POSTED'and j.effective_at=p_paid_at
  and(select coalesce(sum(amount_minor)filter(where direction='DEBIT'),0)=p_gross_minor and coalesce(sum(amount_minor)filter(where direction='CREDIT'),0)=p_gross_minor from public.financial_entries where journal_id=j.id and organization_id=p_organization_id and currency=p_currency))then raise exception'ECONOMIC_CAPTURE_JOURNAL_MISMATCH'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('economic-funding:'||p_source_kind||':'||p_source_id,0));
 select*into f from public.credit_economic_funding_sources_v1 where source_kind=p_source_kind and source_id=p_source_id;
 if f.id is not null then
  if f.organization_id is distinct from p_organization_id or f.source_version_id is distinct from p_source_version_id or f.financial_journal_id is distinct from p_financial_journal_id or f.gross_minor is distinct from p_gross_minor or f.currency is distinct from p_currency or f.paid_at is distinct from p_paid_at or f.correlation_id is distinct from p_correlation_id then raise exception'ECONOMIC_NATIVE_CAPTURE_REPLAY_MISMATCH'using errcode='22000';end if;
 else
  snapshot:=jsonb_build_object('source_kind',p_source_kind,'source_id',p_source_id,'organization_id',p_organization_id,'source_version_id',p_source_version_id,'financial_journal_id',p_financial_journal_id,'gross_minor',p_gross_minor::text,'currency',p_currency,'paid_at',p_paid_at,'first_evidence',p_source_snapshot,'first_evidence_hash',p_source_hash);
  h:=private.canonical_request_hash(snapshot);
  insert into public.credit_economic_funding_sources_v1(source_kind,source_id,organization_id,source_version_id,financial_journal_id,gross_minor,currency,paid_at,source_snapshot,source_hash,correlation_id)
  values(p_source_kind,p_source_id,p_organization_id,p_source_version_id,p_financial_journal_id,p_gross_minor,p_currency,p_paid_at,snapshot,h,p_correlation_id)returning*into f;
  insert into public.credit_revenue_ledger_v1(funding_source_id,entry_type,revenue_class,amount_minor,currency,source_key,source_hash,correlation_id)values(f.id,'CAPTURE','CAPTURE_GROSS_PENDING',f.gross_minor,f.currency,'capture:'||f.id::text,f.source_hash,p_correlation_id);
  insert into public.credit_economic_processing_events_v1(funding_source_id,status,reason_code,context_hash,details,correlation_id)values(f.id,'PENDING_FISCAL_REVIEW','CANONICAL_FISCAL_SOURCE_REQUIRED',f.source_hash,jsonb_build_object('captured_gross_minor',f.gross_minor::text,'currency',f.currency,'not_profit',true),p_correlation_id);
  insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,'SERVICE','credit.economic_capture_retained','credit_economic_funding_source',f.id::text,p_correlation_id,jsonb_build_object('source_kind',f.source_kind,'source_hash',f.source_hash,'gross_minor',f.gross_minor::text,'classification','PENDING_FISCAL_REVIEW'),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'credit_economic_funding_source',f.id::text,'CreditEconomicFundingCapturedV1',p_correlation_id,jsonb_build_object('funding_source_id',f.id,'source_kind',f.source_kind,'gross_minor',f.gross_minor::text,'currency',f.currency,'classification','PENDING_FISCAL_REVIEW'),'economic-capture:'||f.id::text);
 end if;
 insert into public.credit_economic_funding_evidence_v1(funding_source_id,evidence_kind,evidence_id,evidence_hash,evidence_snapshot,correlation_id)
 values(f.id,'NATIVE_CAPTURE',p_source_hash,p_source_hash,p_source_snapshot,p_correlation_id)on conflict do nothing;
 return f.id;
end$$;
revoke all on function private.register_payment_economic_capture_v1(text,text,uuid,uuid,uuid,bigint,character,timestamp with time zone,jsonb,text,uuid)from public,anon,authenticated,service_role;

create function private.process_credit_pack_payment_context_core_v1(p_provider_environment text,p_gateway text,p_provider_event_id text,p_provider_intent_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_payment_reference text,p_payload_hash text,p_verification_evidence_hash text,p_correlation_id uuid,p_verification_method text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i public.credit_pack_payment_intents_v1%rowtype;p public.credit_pack_payment_preparations_v1%rowtype;e public.credit_pack_payment_events_v1%rowtype;
 notification private.credit_pack_payment_notifications_v1%rowtype;env text;nh text;source_key text;wallet uuid;grant_entry bigint;lot uuid:=extensions.gen_random_uuid();event_id uuid:=extensions.gen_random_uuid();journal uuid;
 issued timestamptz:=clock_timestamp();expires timestamptz;pack jsonb;snapshot jsonb;source_hash text;result jsonb;funding uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_CREDIT_PACK_CAPTURE_REQUIRED'using errcode='42501';end if;
 if p_event_type is distinct from'PAYMENT_SUCCEEDED'or p_verification_method is null or p_verification_method not in('WEBHOOK_SIGNATURE','API_OAUTH2_TLS','DEMO_SIMULATION')or length(coalesce(p_provider_event_id,''))not between 8 and 200 or length(coalesce(p_provider_intent_id,''))not between 8 and 200 or p_amount_minor is null or p_amount_minor<=0 or p_currency is null or p_currency!~'^[A-Z]{3}$'or length(btrim(coalesce(p_payment_reference,'')))not between 3 and 200 or coalesce(p_payload_hash,'')!~'^[a-f0-9]{64}$'or coalesce(p_verification_evidence_hash,'')!~'^[a-f0-9]{64}$'or p_paid_at is null or p_paid_at>clock_timestamp()+interval'5 minutes'or p_correlation_id is null then raise exception'INVALID_VERIFIED_CREDIT_PACK_CAPTURE'using errcode='22023';end if;
 env:=private.assert_payment_runtime_v1(p_gateway,p_provider_environment,false);
 if(p_gateway='DEMO')is distinct from(p_verification_method='DEMO_SIMULATION')or(p_verification_method='API_OAUTH2_TLS'and p_gateway<>'PAYPAL')then raise exception'CREDIT_PACK_VERIFICATION_METHOD_MISMATCH'using errcode='23514';end if;
 select*into i from public.credit_pack_payment_intents_v1 where gateway=p_gateway and provider_environment=p_provider_environment and provider_intent_id=p_provider_intent_id;
 if i.id is null then raise exception'CREDIT_PACK_PAYMENT_INTENT_NOT_FOUND'using errcode='P0002';end if;
 if i.amount_minor is distinct from p_amount_minor or i.currency is distinct from p_currency or(i.provider_environment<>'LIVE'and i.deployment_environment is distinct from env)or p_paid_at<i.created_at-interval'5 minutes'then raise exception'CREDIT_PACK_CAPTURE_CONTEXT_MISMATCH'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||i.organization_id::text,0));
 select*into p from public.credit_pack_payment_preparations_v1 where id=i.preparation_id;
 if p.id is null or p.organization_id<>i.organization_id or p.pack_version_id<>i.pack_version_id or p.amount_minor<>i.amount_minor or p.currency<>i.currency then raise exception'CREDIT_PACK_PREPARATION_BINDING_MISMATCH'using errcode='23514';end if;
 nh:=private.canonical_request_hash(jsonb_build_object('intent',i.id,'event_id',p_provider_event_id,'event_type',p_event_type,'amount',p_amount_minor::text,'currency',p_currency,'paid_at',p_paid_at,'payment_reference',p_payment_reference,'payload_hash',p_payload_hash,'verification_method',p_verification_method));
 select*into notification from private.credit_pack_payment_notifications_v1 where gateway=p_gateway and provider_environment=p_provider_environment and provider_event_id=p_provider_event_id;
 select*into e from public.credit_pack_payment_events_v1 where payment_intent_id=i.id;
 if notification.payment_event_id is not null then
  if notification.notification_hash<>nh or e.id is distinct from notification.payment_event_id then raise exception'CREDIT_PACK_CAPTURE_REPLAY_MISMATCH'using errcode='22000';end if;
  return e.result||jsonb_build_object('replayed',true);
 end if;
 if e.id is not null then
  if e.amount_minor<>p_amount_minor or e.currency<>p_currency or e.payment_reference<>p_payment_reference or e.paid_at<>p_paid_at then raise exception'CREDIT_PACK_SECOND_CAPTURE_CONFLICT'using errcode='23514';end if;
  insert into private.credit_pack_payment_notifications_v1(gateway,provider_environment,provider_event_id,payment_event_id,payload_hash,notification_hash,verification_method,verification_evidence_hash)values(p_gateway,p_provider_environment,p_provider_event_id,e.id,p_payload_hash,nh,p_verification_method,p_verification_evidence_hash);
  return e.result||jsonb_build_object('replayed',true);
 end if;
 source_key:=p_gateway||':'||p_provider_environment||':'||p_payment_reference;
 journal:=private.post_verified_payment_suspense_v1(p.posting_context_id,p.organization_id,'CREDIT_PACK',source_key,p_amount_minor,p_currency,p_paid_at,p.actor_id,p_correlation_id);
 insert into public.credit_wallets(organization_id,wallet_type)values(p.organization_id,'CLIENT')on conflict(organization_id,wallet_type)do nothing;
 select id into wallet from public.credit_wallets where organization_id=p.organization_id and wallet_type='CLIENT'for update;
 if wallet is null then raise exception'CREDIT_PACK_WALLET_REQUIRED'using errcode='23514';end if;
 expires:=issued+make_interval(days=>(p.pack_snapshot->>'validity_days')::integer);
 pack:=p.pack_snapshot||jsonb_build_object('credit_issued_at',issued,'credit_expires_at',expires,'posting_context_id',p.posting_context_id,'verification_method',p_verification_method);
 insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)
 values(p.organization_id,wallet,'GRANT',(pack->>'quantity')::bigint,'credits.pack.capture',event_id::text,p_correlation_id,'EXTRA_PURCHASE','credit-pack-payment:'||event_id::text,p.actor_id)returning id into grant_entry;
 snapshot:=jsonb_build_object('payment_intent_id',i.id,'intent_hash',i.source_hash,'preparation_id',p.id,'preparation_hash',p.request_hash,'organization_id',p.organization_id,'pack_version_id',p.pack_version_id,'provider_event_id',p_provider_event_id,'provider_intent_id',p_provider_intent_id,'gateway',p_gateway,'provider_environment',p_provider_environment,'deployment_environment',i.deployment_environment,'amount_minor',p_amount_minor::text,'currency',p_currency,'paid_at',p_paid_at,'payment_reference',p_payment_reference,'payload_hash',p_payload_hash,'verification_method',p_verification_method,'verification_evidence_hash',p_verification_evidence_hash,'wallet_id',wallet,'grant_entry_id',grant_entry::text,'credit_lot_id',lot,'financial_journal_id',journal,'pack_snapshot',pack);
 source_hash:=private.canonical_request_hash(snapshot);
 result:=jsonb_build_object('outcome','CREDIT_PACK_CAPTURED','payment_event_id',event_id,'payment_intent_id',i.id,'credit_lot_id',lot,'wallet_id',wallet,'financial_journal_id',journal,'economic_status','PENDING_FISCAL_REVIEW','amount_minor',p_amount_minor::text,'currency',p_currency,'verification_method',p_verification_method,'replayed',false);
 insert into public.credit_pack_payment_events_v1(id,payment_intent_id,organization_id,pack_version_id,gateway,provider_environment,deployment_environment,provider_intent_id,provider_event_id,payment_reference,amount_minor,currency,paid_at,payload_hash,signature_fingerprint,verification_method,verification_evidence_hash,wallet_id,grant_entry_id,credit_lot_id,financial_journal_id,pack_snapshot,source_hash,result,correlation_id)
 values(event_id,i.id,p.organization_id,p.pack_version_id,p_gateway,p_provider_environment,i.deployment_environment,p_provider_intent_id,p_provider_event_id,p_payment_reference,p_amount_minor,p_currency,p_paid_at,p_payload_hash,case when p_verification_method='WEBHOOK_SIGNATURE'then p_verification_evidence_hash else null end,p_verification_method,p_verification_evidence_hash,wallet,grant_entry,lot,journal,pack,source_hash,result,p_correlation_id);
 -- Value zero here means "not yet fiscally valued", never a free purchased
 -- pack. Later valuations are append-only and cannot rewrite the credit lot.
 insert into public.credit_lots(id,organization_id,wallet_id,grant_entry_id,source_type,source_reference,quantity,expires_at,library_id,revenue_value_minor,currency,rule_version,created_by)
 values(lot,p.organization_id,wallet,grant_entry,'EXTRA_PURCHASE','credit-pack-payment:'||event_id::text,(pack->>'quantity')::bigint,expires,null,0,p_currency,'VERIFIED_CREDIT_PACK_V1:'||source_hash,p.actor_id);
 insert into private.credit_pack_payment_notifications_v1(gateway,provider_environment,provider_event_id,payment_event_id,payload_hash,notification_hash,verification_method,verification_evidence_hash)
 values(p_gateway,p_provider_environment,p_provider_event_id,event_id,p_payload_hash,nh,p_verification_method,p_verification_evidence_hash);
 snapshot:=snapshot||jsonb_build_object('payment_event_id',event_id);
 funding:=private.register_payment_economic_capture_v1('CREDIT_PACK',source_key,p.organization_id,p.pack_version_id,journal,p_amount_minor,p_currency,p_paid_at,snapshot,private.canonical_request_hash(snapshot),p_correlation_id);
 if exists(select 1 from public.credit_pack_native_resolutions_v1 where payment_intent_id=i.id and native_status='VOIDED')then
  insert into public.credit_economic_processing_events_v1(funding_source_id,status,reason_code,context_hash,details,correlation_id)values(funding,'SOURCE_REVIEW_REQUIRED','NATIVE_CAPTURE_AFTER_VOID',source_hash,jsonb_build_object('payment_event_id',event_id,'retained_cash',true),p_correlation_id)on conflict do nothing;
 end if;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p.organization_id,'SERVICE','credit.pack_capture_recorded','credit_pack_payment_event',event_id::text,p_correlation_id,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p.organization_id,'credit_pack_payment_event',event_id::text,'CreditPackPaymentCapturedV1',p_correlation_id,result,'credit-pack-capture:'||event_id::text);
 return result;
end$$;
revoke all on function private.process_credit_pack_payment_context_core_v1(text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid,text)from public,anon,authenticated,service_role;

create function public.process_verified_credit_pack_payment_v1(p_provider_environment text,p_gateway text,p_provider_event_id text,p_provider_intent_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_payment_reference text,p_payload_hash text,p_signature_fingerprint text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_CREDIT_PACK_CAPTURE_REQUIRED'using errcode='42501';end if;
 return private.process_credit_pack_payment_context_core_v1(p_provider_environment,p_gateway,p_provider_event_id,p_provider_intent_id,p_event_type,p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_payload_hash,p_signature_fingerprint,p_correlation_id,case when p_gateway='DEMO'then'DEMO_SIMULATION'else'WEBHOOK_SIGNATURE'end);
end$$;
create function public.process_native_credit_pack_payment_v1(p_provider_environment text,p_provider_intent_id text,p_payment_reference text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_response_hash text,p_observed_at timestamptz,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare i public.credit_pack_payment_intents_v1%rowtype;event_key text;begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_NATIVE_PAYMENT_LOOKUP_REQUIRED'using errcode='42501';end if;
 select*into i from public.credit_pack_payment_intents_v1 where gateway='PAYPAL'and provider_environment=p_provider_environment and provider_intent_id=p_provider_intent_id;
 if i.id is null then raise exception'CREDIT_PACK_PAYMENT_INTENT_NOT_FOUND'using errcode='P0002';end if;
 perform public.record_credit_pack_native_resolution_v1(i.preparation_id,p_provider_environment,p_provider_intent_id,'COMPLETED',p_response_hash,p_observed_at,p_correlation_id);
 event_key:='native-api:'||encode(extensions.digest(convert_to('PAYPAL:'||p_provider_environment||':'||p_payment_reference||':'||p_response_hash,'UTF8'),'sha256'),'hex');
 return private.process_credit_pack_payment_context_core_v1(p_provider_environment,'PAYPAL',event_key,p_provider_intent_id,'PAYMENT_SUCCEEDED',p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_response_hash,p_response_hash,p_correlation_id,'API_OAUTH2_TLS');
end$$;
create function public.prepare_credit_pack_payment_capture_v1(p_payment_intent_id uuid,p_provider_environment text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i public.credit_pack_payment_intents_v1%rowtype;e public.credit_pack_payment_events_v1%rowtype;begin
 select*into i from public.credit_pack_payment_intents_v1 where id=p_payment_intent_id;
 if auth.uid()is null or i.id is null or not private.has_org_role(i.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'CREDIT_PACK_CAPTURE_DENIED'using errcode='42501';end if;
 perform private.assert_payment_runtime_v1(i.gateway,p_provider_environment,false);
 if i.gateway<>'PAYPAL'or i.provider_environment is distinct from p_provider_environment then raise exception'PAYPAL_CREDIT_PACK_INTENT_REQUIRED'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||i.organization_id::text,0));
 select*into e from public.credit_pack_payment_events_v1 where payment_intent_id=i.id;
 if e.id is null and(not private.client_identity_allows_new_operations(i.organization_id)or not private.subscription_financially_clear(i.organization_id))then raise exception'CREDIT_PACK_CAPTURE_ADMISSION_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('payment_intent_id',i.id,'provider_intent_id',i.provider_intent_id,'amount_minor',i.amount_minor::text,'currency',i.currency,'gateway',i.gateway,'provider_environment',i.provider_environment,'replayed',e.id is not null,'capture_result',e.result);
end$$;
do $$declare f regprocedure;begin foreach f in array array[
 'public.process_verified_credit_pack_payment_v1(text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid)'::regprocedure,
 'public.process_native_credit_pack_payment_v1(text,text,text,bigint,character,timestamp with time zone,text,timestamp with time zone,uuid)'::regprocedure,
 'public.prepare_credit_pack_payment_capture_v1(uuid,text)'::regprocedure]loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 execute format('grant execute on function %s to %I',f,case when f::text like'%prepare_%'then'authenticated'else'service_role'end);
end loop;end$$;

create table public.credit_lot_extra_payment_sources_v1(
 credit_lot_id uuid primary key references public.credit_lots(id),organization_id uuid not null references public.organizations(id),
 payment_event_id uuid not null unique references public.credit_pack_payment_events_v1(id),
 source_snapshot jsonb not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),linked_at timestamptz not null default clock_timestamp()
);
alter table public.credit_lot_extra_payment_sources_v1 enable row level security;
revoke all on public.credit_lot_extra_payment_sources_v1 from public,anon,authenticated,service_role;
grant select on public.credit_lot_extra_payment_sources_v1 to authenticated;
create policy credit_lot_extra_payment_sources_read on public.credit_lot_extra_payment_sources_v1 for select to authenticated using(private.credits_client_access(organization_id)or private.credit_revenue_finance_access_v1());
create trigger credit_lot_extra_payment_sources_immutable before update or delete on public.credit_lot_extra_payment_sources_v1 for each row execute function private.prevent_update_delete();

create function private.credit_pack_payment_source_v1(p_payment_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare e public.credit_pack_payment_events_v1%rowtype;i public.credit_pack_payment_intents_v1%rowtype;p public.credit_pack_payment_preparations_v1%rowtype;snapshot jsonb;begin
 select*into e from public.credit_pack_payment_events_v1 where id=p_payment_event_id;
 select*into i from public.credit_pack_payment_intents_v1 where id=e.payment_intent_id;
 select*into p from public.credit_pack_payment_preparations_v1 where id=i.preparation_id;
 if e.id is null or i.id is null or p.id is null or e.organization_id is distinct from i.organization_id or e.organization_id is distinct from p.organization_id or e.pack_version_id is distinct from i.pack_version_id or e.pack_version_id is distinct from p.pack_version_id
  or e.gateway is distinct from i.gateway or e.provider_environment is distinct from i.provider_environment or e.deployment_environment is distinct from i.deployment_environment or e.provider_intent_id is distinct from i.provider_intent_id
  or e.amount_minor is distinct from i.amount_minor or e.amount_minor is distinct from p.amount_minor or e.currency is distinct from i.currency or e.currency is distinct from p.currency
  or e.pack_snapshot->>'id'is distinct from p.pack_version_id::text or e.pack_snapshot->>'currency'is distinct from btrim(e.currency::text)or(e.pack_snapshot->>'price_minor')::numeric is distinct from e.amount_minor::numeric
  or e.pack_snapshot-'credit_issued_at'-'credit_expires_at'-'posting_context_id'-'verification_method'is distinct from p.pack_snapshot
  or(e.pack_snapshot->>'posting_context_id')::uuid is distinct from p.posting_context_id
 then return null;end if;
 if not exists(select 1 from public.credit_ledger_entries g where g.id=e.grant_entry_id and g.organization_id=e.organization_id and g.wallet_id=e.wallet_id and g.entry_type='GRANT'and g.reference_type='EXTRA_PURCHASE'and g.reference_id='credit-pack-payment:'||e.id::text and g.quantity=(e.pack_snapshot->>'quantity')::bigint and g.created_by=p.actor_id)
  or not exists(select 1 from public.credit_wallets w where w.id=e.wallet_id and w.organization_id=e.organization_id and w.wallet_type='CLIENT')
  or not exists(select 1 from private.payment_suspense_journal_sources_v1 s join private.payment_posting_contexts_v1 c on c.id=s.posting_context_id where s.financial_journal_id=e.financial_journal_id and s.source_kind='CREDIT_PACK'and s.source_id=e.gateway||':'||e.provider_environment||':'||e.payment_reference and c.id=p.posting_context_id and c.organization_id=e.organization_id and c.source_version_id=e.pack_version_id and c.currency=e.currency)
  or not exists(select 1 from public.financial_journals j where j.id=e.financial_journal_id and j.organization_id=e.organization_id and j.journal_type='CREDIT_PACK_PAYMENT'and j.currency=e.currency and j.effective_at=e.paid_at and j.correlation_id=e.correlation_id and j.status='POSTED'
   and(select coalesce(sum(amount_minor)filter(where direction='DEBIT'),0)=e.amount_minor and coalesce(sum(amount_minor)filter(where direction='CREDIT'),0)=e.amount_minor from public.financial_entries where journal_id=j.id and organization_id=e.organization_id and currency=e.currency))
 then return null;end if;
 snapshot:=jsonb_build_object('payment_intent_id',i.id,'intent_hash',i.source_hash,'preparation_id',p.id,'preparation_hash',p.request_hash,'organization_id',p.organization_id,'pack_version_id',p.pack_version_id,'provider_event_id',e.provider_event_id,'provider_intent_id',e.provider_intent_id,'gateway',e.gateway,'provider_environment',e.provider_environment,'deployment_environment',e.deployment_environment,'amount_minor',e.amount_minor::text,'currency',e.currency,'paid_at',e.paid_at,'payment_reference',e.payment_reference,'payload_hash',e.payload_hash,'verification_method',e.verification_method,'verification_evidence_hash',e.verification_evidence_hash,'wallet_id',e.wallet_id,'grant_entry_id',e.grant_entry_id::text,'credit_lot_id',e.credit_lot_id,'financial_journal_id',e.financial_journal_id,'pack_snapshot',e.pack_snapshot);
 if e.source_hash is distinct from private.canonical_request_hash(snapshot)then return null;end if;
 return snapshot||jsonb_build_object('payment_event_id',e.id,'source_hash',e.source_hash,'created_by',p.actor_id);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then return null;
end$$;
revoke all on function private.credit_pack_payment_source_v1(uuid)from public,anon,authenticated,service_role;

create function private.guard_credit_lot_extra_purchase_terms_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare event_id uuid;s jsonb;begin
 if new.source_type<>'EXTRA_PURCHASE'then return new;end if;
 if new.source_reference!~'^credit-pack-payment:[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then raise exception'CREDIT_PACK_CANONICAL_PAYMENT_REQUIRED'using errcode='55000';end if;
 event_id:=substring(new.source_reference from length('credit-pack-payment:')+1)::uuid;
 s:=private.credit_pack_payment_source_v1(event_id);
 if s is null then raise exception'CREDIT_PACK_CANONICAL_PAYMENT_REQUIRED'using errcode='55000';end if;
 if new.id is distinct from(s->>'credit_lot_id')::uuid or new.organization_id is distinct from(s->>'organization_id')::uuid or new.wallet_id is distinct from(s->>'wallet_id')::uuid
  or new.grant_entry_id is distinct from(s->>'grant_entry_id')::bigint or new.quantity is distinct from(s#>>'{pack_snapshot,quantity}')::bigint
  or new.expires_at is distinct from(s#>>'{pack_snapshot,credit_expires_at}')::timestamptz or new.currency is distinct from(s->>'currency')::char(3)
  or new.created_by is distinct from(s->>'created_by')::uuid or new.library_id is not null or new.revenue_value_minor<>0
  or new.rule_version is distinct from'VERIFIED_CREDIT_PACK_V1:'||(s->>'source_hash')
 then raise exception'CREDIT_PURCHASE_TERMS_MISMATCH'using errcode='23514';end if;
 return new;
end$$;
create function private.bind_credit_lot_extra_purchase_source_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare event_id uuid;s jsonb;h text;begin
 if new.source_type<>'EXTRA_PURCHASE'then return new;end if;
 event_id:=substring(new.source_reference from length('credit-pack-payment:')+1)::uuid;
 s:=private.credit_pack_payment_source_v1(event_id);
 if s is null or new.id is distinct from(s->>'credit_lot_id')::uuid then raise exception'CREDIT_PACK_CANONICAL_PAYMENT_REQUIRED'using errcode='55000';end if;
 h:=private.canonical_request_hash(s);
 insert into public.credit_lot_extra_payment_sources_v1(credit_lot_id,organization_id,payment_event_id,source_snapshot,source_hash)values(new.id,new.organization_id,event_id,s,h);
 return new;
end$$;
revoke all on function private.guard_credit_lot_extra_purchase_terms_v1(),private.bind_credit_lot_extra_purchase_source_v1()from public,anon,authenticated,service_role;
create trigger credit_lot_extra_purchase_terms_guard_v1 before insert on public.credit_lots for each row execute function private.guard_credit_lot_extra_purchase_terms_v1();
create trigger credit_lot_extra_purchase_source_binding_v1 after insert on public.credit_lots for each row execute function private.bind_credit_lot_extra_purchase_source_v1();

create function private.credit_pack_payment_funding_environment_compatible_v1(p_payment_event_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare s jsonb;env text;begin
 s:=private.credit_pack_payment_source_v1(p_payment_event_id);
 if s is null then return false;end if;
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null or env not in('DEVELOPMENT','STAGING','PRODUCTION')then return false;end if;
 if s->>'provider_environment'='LIVE'and s->>'gateway'in('PAYPAL','CMI')then return true;end if;
 return env in('DEVELOPMENT','STAGING')and s->>'deployment_environment'=env and((s->>'provider_environment'='DEMO'and s->>'gateway'='DEMO')or(s->>'provider_environment'='SANDBOX'and s->>'gateway'in('PAYPAL','CMI')));
end$$;
create function private.credit_lot_extra_funding_status_v1(p_credit_lot_id uuid)
returns text language plpgsql stable security definer set search_path=pg_catalog as $$
declare l public.credit_lots%rowtype;s public.credit_lot_extra_payment_sources_v1%rowtype;e public.credit_pack_payment_events_v1%rowtype;begin
 select*into l from public.credit_lots where id=p_credit_lot_id and source_type='EXTRA_PURCHASE';
 select*into s from public.credit_lot_extra_payment_sources_v1 where credit_lot_id=l.id and organization_id=l.organization_id;
 if l.id is null or s.credit_lot_id is null or s.source_hash is distinct from private.canonical_request_hash(s.source_snapshot)or private.credit_pack_payment_source_v1(s.payment_event_id)is null then return'SOURCE_UNVERIFIED';end if;
 if not private.credit_pack_payment_funding_environment_compatible_v1(s.payment_event_id)then return'ENVIRONMENT_INCOMPATIBLE';end if;
 select*into e from public.credit_pack_payment_events_v1 where id=s.payment_event_id;
 if exists(select 1 from public.credit_pack_payment_adjustments_v1 where payment_event_id=e.id and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED','DISPUTE_OPENED'))or exists(select 1 from public.credit_pack_native_resolutions_v1 where payment_intent_id=e.payment_intent_id and native_status='VOIDED')then return'PAYMENT_HELD';end if;
 return'ELIGIBLE';
end$$;
revoke all on function private.credit_pack_payment_funding_environment_compatible_v1(uuid),private.credit_lot_extra_funding_status_v1(uuid)from public,anon,authenticated,service_role;

do $$declare d text;needle text:='if l.source_type<>''SUBSCRIPTION_GRANT''then return''ELIGIBLE'';end if;';replacement text;begin
 select pg_get_functiondef('private.credit_lot_funding_status_v1(uuid)'::regprocedure)into d;
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception'CREDIT_LOT_FUNDING_SOURCE_CONTRACT_MISMATCH';end if;
 replacement:='if l.source_type=''EXTRA_PURCHASE''then return private.credit_lot_extra_funding_status_v1(l.id);end if;'||chr(10)||' '||needle;
 execute replace(d,needle,replacement);
end$$;

-- Int268001 owns the public durable-receipt wrapper. Replace only the unique
-- legacy journal block inside its stable APPLIED core, preserving that OID and
-- every activation check. A previously-posted pending receipt is reused.
do $$declare d text;opening text:='  insert into public.financial_accounts(organization_id,code,name,account_type,currency)';closing text:='  period_end := case';a integer;b integer;replacement text;old_block text;begin
 select pg_get_functiondef('private.process_subscription_payment_context_core_v1(text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid)'::regprocedure)into d;
 if(length(d)-length(replace(d,opening,'')))/length(opening)<>1 or(length(d)-length(replace(d,closing,'')))/length(closing)<>1 then raise exception'SUBSCRIPTION_APPLIED_JOURNAL_SOURCE_CONTRACT_MISMATCH';end if;
 a:=strpos(d,opening);b:=strpos(d,closing);
 if a<=0 or b<=a then raise exception'SUBSCRIPTION_APPLIED_JOURNAL_SOURCE_CONTRACT_MISMATCH';end if;
 old_block:=substring(d from a for b-a);
 if strpos(old_block,'SUBSCRIPTION_REVENUE_')=0 or strpos(old_block,'insert into public.financial_entries')=0 or strpos(old_block,'FinancialJournalPostedV1')=0 then raise exception'SUBSCRIPTION_APPLIED_JOURNAL_SOURCE_CONTRACT_MISMATCH';end if;
 replacement:=$journal$
  journal_id := private.post_verified_payment_suspense_v1(
    (private.get_payment_posting_context_v1('SUBSCRIPTION',(
      select prepared.id from public.subscription_payment_preparations prepared
      where prepared.organization_id=intent.organization_id
        and prepared.idempotency_key=intent.idempotency_key and prepared.actor_id=intent.created_by
        and prepared.plan_version_id=intent.plan_version_id and prepared.billing_interval=intent.billing_interval
        and prepared.gateway=intent.gateway and prepared.provider_environment=intent.provider_environment
        and prepared.amount_minor=intent.amount_minor and prepared.currency=intent.currency
    ))->>'posting_context_id')::uuid,
    intent.organization_id,'SUBSCRIPTION',p_gateway||':'||p_provider_environment||':'||p_payment_reference,
    intent.amount_minor,intent.currency,p_paid_at,intent.created_by,p_correlation_id
  );

$journal$;
 execute substring(d from 1 for a-1)||replacement||substring(d from b);
end$$;

create function private.bind_subscription_economic_capture_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare i public.subscription_payment_intents%rowtype;source_snapshot jsonb;funding uuid;cycle uuid;begin
 if new.event_type<>'PAYMENT_SUCCEEDED'then return new;end if;
 select*into i from public.subscription_payment_intents where id=new.payment_intent_id;
 if i.id is null then raise exception'SUBSCRIPTION_ECONOMIC_CAPTURE_INTENT_REQUIRED'using errcode='23514';end if;
 cycle:=private.subscription_payment_cycle_v1(new.id);
 source_snapshot:=jsonb_build_object('subscription_payment_event',to_jsonb(new),'payment_intent_hash',i.request_hash,'plan_version_id',i.plan_version_id,'subscription_cycle_id',cycle);
 funding:=private.register_payment_economic_capture_v1('SUBSCRIPTION',new.gateway||':'||new.provider_environment||':'||new.payment_reference,new.organization_id,i.plan_version_id,(new.activation_result->>'financial_journal_id')::uuid,new.amount_minor,new.currency,new.paid_at,source_snapshot,private.canonical_request_hash(source_snapshot),new.correlation_id);
 if cycle is not null then
  insert into public.credit_economic_funding_evidence_v1(funding_source_id,evidence_kind,evidence_id,evidence_hash,evidence_snapshot,correlation_id)
  values(funding,'SUBSCRIPTION_APPLIED',new.id::text,private.canonical_request_hash(source_snapshot),source_snapshot,new.correlation_id)on conflict do nothing;
 else
  insert into public.credit_economic_processing_events_v1(funding_source_id,status,reason_code,context_hash,details,correlation_id)
  values(funding,'SOURCE_REVIEW_REQUIRED','SUBSCRIPTION_CYCLE_CAPTURE_NOT_ADMITTED',private.canonical_request_hash(source_snapshot),jsonb_build_object('subscription_payment_event_id',new.id::text,'not_profit',true),new.correlation_id)on conflict do nothing;
 end if;
 return new;
end$$;
revoke all on function private.bind_subscription_economic_capture_v1()from public,anon,authenticated,service_role;
create trigger subscription_economic_capture_source_binding after insert on public.subscription_payment_events for each row execute function private.bind_subscription_economic_capture_v1();

create policy credit_pack_preparation_owner_read on public.credit_pack_payment_preparations_v1 for select to authenticated using(private.credits_client_access(organization_id));
create policy credit_pack_intent_owner_read on public.credit_pack_payment_intents_v1 for select to authenticated using(private.credits_client_access(organization_id));
create policy credit_pack_capture_owner_read on public.credit_pack_payment_events_v1 for select to authenticated using(private.credits_client_access(organization_id));
create policy credit_pack_native_owner_read on public.credit_pack_native_resolutions_v1 for select to authenticated using(private.credits_client_access(organization_id));
create policy credit_pack_adjustment_owner_read on public.credit_pack_payment_adjustments_v1 for select to authenticated using(private.credits_client_access(organization_id));
create policy credit_economic_allocation_book_read on public.credit_economic_allocations_v1 for select to authenticated using(book_id is not null and private.franchise_book_access(book_id));

create function public.prepare_credit_pack_native_order_review_v1(p_preparation_id uuid,p_provider_environment text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare p public.credit_pack_payment_preparations_v1%rowtype;i public.credit_pack_payment_intents_v1%rowtype;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'then raise exception'CREDIT_PACK_NATIVE_REVIEW_DENIED'using errcode='42501';end if;
 select*into p from public.credit_pack_payment_preparations_v1 where id=p_preparation_id;
 if p.id is null or not(private.has_org_role(p.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())or private.credit_revenue_finance_access_v1(auth.uid(),true))then raise exception'CREDIT_PACK_NATIVE_REVIEW_DENIED'using errcode='42501';end if;
 perform private.assert_payment_runtime_v1(p.gateway,p_provider_environment,false);
 if p.gateway<>'PAYPAL'or p.provider_environment is distinct from p_provider_environment then raise exception'NATIVE_PAYMENT_ORDER_REVIEW_UNSUPPORTED'using errcode='22023';end if;
 select*into i from public.credit_pack_payment_intents_v1 where preparation_id=p.id;
 return jsonb_build_object('preparation_id',p.id,'organization_id',p.organization_id,'pack_version_id',p.pack_version_id,'idempotency_key',p.idempotency_key,'amount_minor',p.amount_minor::text,'currency',p.currency,'gateway',p.gateway,'provider_environment',p.provider_environment,'payment_intent_id',i.id,'provider_intent_id',i.provider_intent_id);
end$$;
revoke all on function public.prepare_credit_pack_native_order_review_v1(uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.prepare_credit_pack_native_order_review_v1(uuid,text)to authenticated;

notify pgrst,'reload schema';
commit;
