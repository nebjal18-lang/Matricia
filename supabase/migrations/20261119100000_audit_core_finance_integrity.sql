-- FIN-01..05: canonical recognition, immutable corrections and stable command receipts.
BEGIN;

create or replace function public.post_platform_core_pot_entry(
 p_book_id uuid,
 p_effect_type text,
 p_category text,
 p_amount_minor bigint,
 p_financial_journal_id uuid,
 p_source_type text,
 p_source_id text,
 p_effective_on date,
 p_reason text,
 p_reverses_entry_id uuid,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();b public.platform_core_pot_books%rowtype;j public.financial_journals%rowtype;x public.platform_core_pot_entries%rowtype;h text;r jsonb;e uuid;
begin
 select * into b from public.platform_core_pot_books where id=p_book_id;
 select * into j from public.financial_journals where id=p_financial_journal_id;
 if a is null or b.id is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or (auth.jwt()->>'aal')is distinct from 'aal2'then
  raise exception 'PLATFORM_CORE_POT_POST_DENIED'using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('platform-core-integrity-v1',0));
 h:=private.canonical_request_hash(jsonb_build_object(
  'book',b.id,'effect',p_effect_type,'category',p_category,'amount',p_amount_minor,'journal',j.id,
  'source_type',p_source_type,'source_id',p_source_id,'effective_on',p_effective_on,'reason',p_reason,'reverses',p_reverses_entry_id
 ));
 r:=private.begin_contract_command(b.audit_organization_id,'platform.core_pot.post.'||b.id::text,p_idempotency_key,h,a);
 if r is not null then return r;end if;
 if b.status<>'OPEN'or p_effect_type not in('REVENUE','COST','REVERSAL_REVENUE','REVERSAL_COST')
  or p_category not in('CORE_SUBSCRIPTION_REVENUE_ACQUIRED','ENTRY_FEE_ACQUIRED','REFUND_CREDIT_NOTE','MARKETING_COST','OPERATING_CHARGE')
  or p_amount_minor<=0 or j.id is null or j.organization_id<>b.audit_organization_id or j.currency<>b.currency or j.status<>'POSTED'
  or length(btrim(coalesce(p_reason,'')))not between 3 and 1000
 then raise exception 'INVALID_PLATFORM_CORE_POT_ENTRY'using errcode='22023';end if;
 -- Entry fees from IT books must never enter this pot (IT entry fee is structurally zero / exempt).
 if p_category='ENTRY_FEE_ACQUIRED'and p_source_type='FRANCHISE_ENTRY_FEE_PAYMENT'and exists(
  select 1 from public.franchise_entry_fee_ledger_entries fe
  join public.franchise_entry_fee_schedules s on s.id=fe.schedule_id
  join public.franchise_pnl_books pb on pb.id=s.book_id
  where fe.id::text=p_source_id and pb.franchise_type='IT'
 )then raise exception 'IT_ENTRY_FEE_EXCLUDED_FROM_PLATFORM_POT'using errcode='23514';end if;
 if p_effect_type in('REVERSAL_REVENUE','REVERSAL_COST')then
  select * into x from public.platform_core_pot_entries where id=p_reverses_entry_id and book_id=b.id;
  if not found or x.amount_minor<>p_amount_minor
   or(p_effect_type='REVERSAL_REVENUE'and x.effect_type<>'REVENUE')
   or(p_effect_type='REVERSAL_COST'and x.effect_type<>'COST')
   or exists(select 1 from public.platform_core_pot_entries where reverses_entry_id=x.id)
  then raise exception 'INVALID_PLATFORM_CORE_POT_REVERSAL'using errcode='22023';end if;
 elsif p_reverses_entry_id is not null then raise exception 'INVALID_PLATFORM_CORE_POT_REVERSAL'using errcode='22023';
 end if;
 insert into public.platform_core_pot_entries(
  book_id,effect_type,category,amount_minor,currency,financial_journal_id,source_type,source_id,effective_on,reason,reverses_entry_id,correlation_id,created_by
 )values(b.id,p_effect_type,p_category,p_amount_minor,b.currency,j.id,p_source_type,p_source_id,p_effective_on,p_reason,p_reverses_entry_id,p_correlation_id,a)
 returning id into e;
 r:=jsonb_build_object('outcome','PLATFORM_CORE_POT_ENTRY_POSTED','entry_id',e,'book_id',b.id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(b.audit_organization_id,a,'USER','platform.core_pot.entry.posted','platform_core_pot_entry',e::text,p_correlation_id,jsonb_build_object('category',p_category,'amount_minor',p_amount_minor),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(b.audit_organization_id,'platform_core_pot_book',b.id::text,'PlatformCorePotEntryPostedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(b.audit_organization_id,'platform.core_pot.post.'||b.id::text,p_idempotency_key,r);
 return r;
end$$;

create or replace function public.close_platform_core_pot_period(
 p_book_id uuid,
 p_period_start date,
 p_period_end date,
 p_rule_version_id uuid,
 p_entry_cutoff_at timestamptz,
 p_reason text,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
 a uuid:=auth.uid();b public.platform_core_pot_books%rowtype;rv public.platform_core_pot_rule_versions%rowtype;
 prior public.platform_core_pot_closure_versions%rowtype;h text;r jsonb;c uuid;ver integer;
 revenue bigint;costs bigint;profit bigint;dist bigint;na bigint;aa bigint;rem bigint;benef text;alloc uuid;oldamt bigint;
begin
 select * into b from public.platform_core_pot_books where id=p_book_id;
 select * into rv from public.platform_core_pot_rule_versions where id=p_rule_version_id;
 if a is null or b.id is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or (auth.jwt()->>'aal')is distinct from 'aal2'then
  raise exception 'PLATFORM_CORE_POT_CLOSE_DENIED'using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('platform-core-integrity-v1',0));
 h:=private.canonical_request_hash(jsonb_build_object('book',b.id,'period_start',p_period_start,'period_end',p_period_end,'rule',p_rule_version_id,'cutoff',p_entry_cutoff_at,'reason',p_reason));
 r:=private.begin_contract_command(b.audit_organization_id,'platform.core_pot.close.'||b.id::text||'.'||p_period_start::text||'.'||p_period_end::text,p_idempotency_key,h,a);
 if r is not null then return r;end if;
 if p_period_start is null or p_period_end is null or p_entry_cutoff_at is null then raise exception 'INVALID_PLATFORM_CORE_POT_CLOSURE' using errcode='22023';end if;
 perform private.assert_core_sources_v1(b.id,false);
 if exists(select 1 from public.platform_core_pot_entries e where e.book_id=b.id and e.effective_on between p_period_start and p_period_end and e.created_at>p_entry_cutoff_at)then
  raise exception 'CORE_POT_CUTOFF_EXCLUDES_ENTRIES' using errcode='23514';end if;
 if exists(select 1 from public.platform_core_pot_closure_versions c where c.book_id=b.id and daterange(c.period_start,c.period_end,'[]') && daterange(p_period_start,p_period_end,'[]') and (c.period_start,c.period_end)<>(p_period_start,p_period_end))then
  raise exception 'CORE_POT_PERIOD_OVERLAP' using errcode='23514';end if;
 if b.status<>'OPEN'or rv.id is null or rv.status<>'ACTIVE'
  or p_period_start<rv.effective_from or(rv.effective_to is not null and p_period_end>rv.effective_to)
  or p_period_end<p_period_start or p_period_end>=p_period_start+interval'1 year'
  or p_entry_cutoff_at>clock_timestamp()or length(btrim(coalesce(p_reason,'')))not between 10 and 1000
 then raise exception 'INVALID_PLATFORM_CORE_POT_CLOSURE'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(b.id::text||':core-pot:'||p_period_start::text||':'||p_period_end::text,0));
 select * into prior from public.platform_core_pot_closure_versions
  where book_id=b.id and period_start=p_period_start and period_end=p_period_end order by version desc limit 1;
 ver:=coalesce(prior.version,0)+1;
 select
  coalesce(sum(case when effect_type='REVENUE'then amount_minor when effect_type='REVERSAL_REVENUE'then-amount_minor else 0 end),0),
  coalesce(sum(case when effect_type='COST'then amount_minor when effect_type='REVERSAL_COST'then-amount_minor else 0 end),0)
 into revenue,costs
 from public.platform_core_pot_entries
 where book_id=b.id and effective_on between p_period_start and p_period_end and created_at<=p_entry_cutoff_at;
 if costs<0 then raise exception 'NEGATIVE_NET_COSTS_REQUIRE_REVIEW'using errcode='23514';end if;
 profit:=revenue-costs;
 insert into public.platform_core_pot_closure_versions(
  book_id,period_start,period_end,version,supersedes_closure_id,rule_version_id,rule_snapshot,formula_snapshot,
  entry_cutoff_at,gross_revenue_ex_tax_minor,costs_and_refunds_minor,distributable_remainder_minor,content_hash,closed_by
 )values(
  b.id,p_period_start,p_period_end,ver,prior.id,rv.id,to_jsonb(rv)-array['id','approved_by'],rv.formula_snapshot,
  p_entry_cutoff_at,revenue,costs,profit,private.canonical_request_hash(jsonb_build_object('request_hash',h,'version',ver,'rule',to_jsonb(rv),'revenue',revenue,'costs',costs,'profit',profit)),a
 )returning id into c;
 dist:=greatest(profit,0);
 na:=dist*rv.neoxa_jalil_share_bps/10000;
 aa:=dist*rv.asma_matricia_share_bps/10000;
 rem:=dist-na-aa;
 aa:=aa+rem;
 for benef in select * from unnest(array['NEOXA_JALIL','ASMA_MATRICIA'])loop
  insert into public.platform_core_pot_allocations(
   closure_version_id,beneficiary_code,share_bps,amount_minor,currency,rounding_adjustment_minor,rights_snapshot
  )values(
   c,benef,
   case when benef='NEOXA_JALIL'then rv.neoxa_jalil_share_bps else rv.asma_matricia_share_bps end,
   case when benef='NEOXA_JALIL'then na else aa end,
   b.currency,
   case when benef='ASMA_MATRICIA'then rem else 0 end,
   jsonb_build_object('rule_version_id',rv.id,'rule_hash',rv.content_hash,'distribution_basis',rv.distribution_basis)
  )returning id into alloc;
  select coalesce(pa.amount_minor,0)into oldamt from public.platform_core_pot_allocations pa
   where pa.closure_version_id=prior.id and pa.beneficiary_code=benef;
  if not found then oldamt:=0;end if;
  if(case when benef='NEOXA_JALIL'then na else aa end)-oldamt<>0 then
   insert into public.platform_core_pot_distribution_ledger_entries(
    book_id,closure_version_id,allocation_id,beneficiary_code,entry_type,amount_minor,currency,reference_type,reference_id,correlation_id,created_by
   )values(
    b.id,c,alloc,benef,case when prior.id is null then'ACCRUAL'else'ADJUSTMENT'end,
    (case when benef='NEOXA_JALIL'then na else aa end)-oldamt,b.currency,'PLATFORM_CORE_POT_CLOSURE',c::text,p_correlation_id,a
   );
  end if;
 end loop;
 r:=jsonb_build_object(
  'outcome','PLATFORM_CORE_POT_CLOSED','closure_version_id',c,'version',ver,
  'gross_revenue_ex_tax_minor',revenue,'costs_and_refunds_minor',costs,'distributable_remainder_minor',profit
 );
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(b.audit_organization_id,a,'USER','platform.core_pot.closed','platform_core_pot_closure',c::text,p_correlation_id,jsonb_build_object('version',ver,'rule_version_id',rv.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(b.audit_organization_id,'platform_core_pot_closure',c::text,'PlatformCorePotClosedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(b.audit_organization_id,'platform.core_pot.close.'||b.id::text||'.'||p_period_start::text||'.'||p_period_end::text,p_idempotency_key,r);
 return r;
end$$;

create or replace function public.record_platform_core_pot_payout(
 p_book_id uuid,
 p_beneficiary_code text,
 p_amount_minor bigint,
 p_financial_journal_id uuid,
 p_reference text,
 p_proof_hash text,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();b public.platform_core_pot_books%rowtype;j public.financial_journals%rowtype;bal bigint;h text;r jsonb;e bigint;
begin
 select * into b from public.platform_core_pot_books where id=p_book_id;
 select * into j from public.financial_journals where id=p_financial_journal_id;
 if a is null or b.id is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or (auth.jwt()->>'aal')is distinct from 'aal2'then
  raise exception 'PLATFORM_CORE_POT_PAYOUT_DENIED'using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('platform-core-integrity-v1',0));
 h:=private.canonical_request_hash(jsonb_build_object(
  'book',b.id,'beneficiary',p_beneficiary_code,'amount',p_amount_minor,'journal',j.id,'reference',p_reference,'proof_hash',p_proof_hash
 ));
 r:=private.begin_contract_command(b.audit_organization_id,'platform.core_pot.payout.'||b.id::text,p_idempotency_key,h,a);
 if r is not null then return r;end if;
 perform private.assert_core_sources_v1(b.id,true);
 if p_beneficiary_code not in('NEOXA_JALIL','ASMA_MATRICIA')or p_amount_minor<=0
  or j.id is null or j.organization_id<>b.audit_organization_id or j.currency<>b.currency or j.status<>'POSTED'
  or length(btrim(coalesce(p_reference,'')))<3 or p_proof_hash!~'^[0-9a-f]{64}$'
 then raise exception 'INVALID_PLATFORM_CORE_POT_PAYOUT'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(b.id::text||':core-pot:'||p_beneficiary_code,0));
 select coalesce(sum(amount_minor),0)into bal from public.platform_core_pot_distribution_ledger_entries
  where book_id=b.id and beneficiary_code=p_beneficiary_code;
 if bal<p_amount_minor then raise exception 'INSUFFICIENT_PLATFORM_CORE_POT_BALANCE'using errcode='23514';end if;
 insert into public.platform_core_pot_distribution_ledger_entries(
  book_id,beneficiary_code,entry_type,amount_minor,currency,financial_journal_id,reference_type,reference_id,proof_hash,correlation_id,created_by
 )values(b.id,p_beneficiary_code,'PAYOUT',-p_amount_minor,b.currency,j.id,'PAYOUT',p_reference,p_proof_hash,p_correlation_id,a)
 returning id into e;
 r:=jsonb_build_object('outcome','PLATFORM_CORE_POT_PAYOUT_RECORDED','ledger_entry_id',e,'remaining_balance_minor',bal-p_amount_minor);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(b.audit_organization_id,a,'USER','platform.core_pot.payout.recorded','platform_core_pot_distribution_entry',e::text,p_correlation_id,jsonb_build_object('beneficiary_code',p_beneficiary_code,'amount_minor',p_amount_minor),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(b.audit_organization_id,'platform_core_pot_book',b.id::text,'PlatformCorePotPayoutRecordedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(b.audit_organization_id,'platform.core_pot.payout.'||b.id::text,p_idempotency_key,r);
 return r;
end$$;

create or replace function public.allocate_provider_from_pool(p_reservation_id uuid,p_provider_commitment_id uuid,p_units numeric,p_rule_snapshot jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();rs public.service_reservations%rowtype;p public.service_inventory_pools%rowtype;c public.provider_capacity_commitments%rowtype;av public.framework_agreement_versions%rowtype;already numeric;h text;r jsonb;aid uuid;fully boolean;
begin
  if a is null or not private.volume_admin_access(a) then raise exception 'PROVIDER_ALLOCATION_DENIED' using errcode='42501';end if;
  if p_units is null or p_units<=0 or jsonb_typeof(p_rule_snapshot)<>'object' then raise exception 'INVALID_PROVIDER_ALLOCATION' using errcode='22023';end if;
  select * into rs from public.service_reservations where id=p_reservation_id for update;if not found then raise exception 'RESERVATION_NOT_ALLOCATABLE' using errcode='55000';end if;
  select * into p from public.service_inventory_pools where id=rs.pool_id for update;
  h:=private.canonical_request_hash(jsonb_build_object('reservation',rs.id,'commitment',p_provider_commitment_id,'units',p_units,'rule',p_rule_snapshot));r:=private.begin_volume_command(p.owner_organization_id,'volume.pool.provider.allocate',p_idempotency_key,h,a);if r is not null then return r;end if;
  if rs.status<>'RESERVED'or rs.expires_at<=clock_timestamp()then raise exception 'RESERVATION_NOT_ALLOCATABLE' using errcode='55000';end if;
  select * into c from public.provider_capacity_commitments where id=p_provider_commitment_id for update;
  if not found or c.status<>'ACTIVE'or c.agreement_version_id<>p.agreement_version_id or c.committed_units+c.consumed_units+p_units>c.capacity_units then raise exception 'PROVIDER_CAPACITY_EXCEEDED_OR_INELIGIBLE' using errcode='23514';end if;
  select coalesce(sum(allocated_units),0)into already from public.service_provider_allocations where reservation_id=rs.id;
  if already+p_units>rs.reserved_units then raise exception 'RESERVATION_OVERALLOCATED' using errcode='23514';end if;
  select * into av from public.framework_agreement_versions where id=p.agreement_version_id;
  insert into public.service_provider_allocations(reservation_id,agreement_version_id,provider_commitment_id,provider_organization_id,allocated_units,unit_price_minor,currency,allocation_rule_snapshot,correlation_id,allocated_by)values(rs.id,p.agreement_version_id,c.id,c.provider_organization_id,p_units,c.unit_price_minor,av.currency,p_rule_snapshot,p_correlation_id,a)returning id into aid;
  update public.provider_capacity_commitments set committed_units=committed_units+p_units where id=c.id;
  fully:=(already+p_units=rs.reserved_units);
  if fully then update public.service_reservations set status='COMMITTED'where id=rs.id;update public.service_inventory_pools set reserved_units=reserved_units-rs.reserved_units,committed_units=committed_units+rs.reserved_units,row_version=row_version+1 where id=p.id;insert into public.service_inventory_transactions(pool_id,reservation_id,transaction_type,units,state_before,state_after,idempotency_key,correlation_id,actor_user_id)values(p.id,rs.id,'COMMITTED',rs.reserved_units,'RESERVED','COMMITTED',p_idempotency_key,p_correlation_id,a);end if;
  r:=jsonb_build_object('outcome','PROVIDER_UNITS_ALLOCATED','allocation_id',aid,'reservation_id',rs.id,'provider_commitment_id',c.id,'units',p_units,'fully_allocated',fully);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p.owner_organization_id,a,'USER','volume.provider_allocated','service_provider_allocation',aid::text,p_correlation_id,jsonb_build_object('reservation_id',rs.id,'provider_organization_id',c.provider_organization_id,'units',p_units),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p.owner_organization_id,'service_reservation',rs.id::text,'ProviderAllocatedFromPoolV1',p_correlation_id,r,p_idempotency_key);
  perform private.finish_volume_command(p.owner_organization_id,'volume.pool.provider.allocate',p_idempotency_key,r);return r;
end$$;

create or replace function public.consume_service_units(p_reservation_id uuid,p_provider_consumptions jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();rs public.service_reservations%rowtype;p public.service_inventory_pools%rowtype;x jsonb;al public.service_provider_allocations%rowtype;used numeric;qty numeric;total numeric:=0;cost bigint:=0;line_cost bigint;h text;r jsonb;next_status text;
begin
  select * into rs from public.service_reservations where id=p_reservation_id for update;
  if a is null or not found or not(private.has_org_role(rs.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'],a)or private.volume_admin_access(a))then raise exception 'VOLUME_CONSUMPTION_DENIED' using errcode='42501';end if;
  h:=private.canonical_request_hash(jsonb_build_object('reservation',rs.id,'provider_consumptions',p_provider_consumptions));r:=private.begin_volume_command(rs.client_organization_id,'volume.pool.consume',p_idempotency_key,h,a);if r is not null then return r;end if;
  if rs.status not in('COMMITTED','PARTIALLY_CONSUMED')or jsonb_typeof(p_provider_consumptions)<>'array'or jsonb_array_length(p_provider_consumptions)=0 then raise exception 'RESERVATION_NOT_CONSUMABLE' using errcode='55000';end if;
  select * into p from public.service_inventory_pools where id=rs.pool_id for update;
  for x in select * from jsonb_array_elements(p_provider_consumptions)loop
    qty:=coalesce((x->>'units')::numeric,0);if qty<=0 then raise exception 'INVALID_CONSUMPTION_UNITS' using errcode='22023';end if;
    select * into al from public.service_provider_allocations where id=(x->>'allocation_id')::uuid and reservation_id=rs.id for update;if not found then raise exception 'PROVIDER_ALLOCATION_NOT_FOUND' using errcode='P0002';end if;
    select coalesce(sum(consumed_units),0)into used from public.service_provider_consumptions where allocation_id=al.id;if used+qty>al.allocated_units then raise exception 'PROVIDER_ALLOCATION_OVERCONSUMED' using errcode='23514';end if;
    line_cost:=round(qty*al.unit_price_minor)::bigint;total:=total+qty;cost:=cost+line_cost;
    insert into public.service_provider_consumptions(reservation_id,allocation_id,provider_commitment_id,consumed_units,unit_cost_minor,total_cost_minor,idempotency_key,correlation_id,consumed_by)values(rs.id,al.id,al.provider_commitment_id,qty,al.unit_price_minor,line_cost,p_idempotency_key,p_correlation_id,a);
    update public.provider_capacity_commitments set committed_units=committed_units-qty,consumed_units=consumed_units+qty where id=al.provider_commitment_id;
  end loop;
  if rs.consumed_units+total>rs.reserved_units then raise exception 'RESERVATION_OVERCONSUMED' using errcode='23514';end if;
  next_status:=case when rs.consumed_units+total=rs.reserved_units then 'CONSUMED'else'PARTIALLY_CONSUMED'end;
  update public.service_reservations set consumed_units=consumed_units+total,status=next_status where id=rs.id;
  update public.service_inventory_pools set committed_units=committed_units-total,consumed_units=consumed_units+total,row_version=row_version+1 where id=p.id;
  insert into public.service_inventory_transactions(pool_id,reservation_id,transaction_type,units,state_before,state_after,idempotency_key,correlation_id,actor_user_id)values(p.id,rs.id,'CONSUMED',total,rs.status,next_status,p_idempotency_key,p_correlation_id,a);
  r:=jsonb_build_object('outcome','SERVICE_UNITS_CONSUMED','reservation_id',rs.id,'units',total,'cost_minor',cost,'status',next_status);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(rs.client_organization_id,a,'USER','volume.units_consumed','service_reservation',rs.id::text,p_correlation_id,jsonb_build_object('units',total,'cost_minor',cost),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(rs.client_organization_id,'service_reservation',rs.id::text,'ServiceUnitConsumedV1',p_correlation_id,r,p_idempotency_key);
  perform private.finish_volume_command(rs.client_organization_id,'volume.pool.consume',p_idempotency_key,r);return r;
end$$;

-- Only the caller-bound RLS predicate is callable; constraint checks run as owner.
create or replace function private.platform_core_pot_access(p_book uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select p_actor=auth.uid() and exists(select 1 from public.platform_core_pot_books where id=p_book)
 and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())
$$;
grant execute on function private.platform_core_pot_access(uuid,uuid) to authenticated;
alter function private.assert_platform_core_pot_allocation_total() security definer;
alter function private.assert_platform_core_pot_allocation_total() set search_path=pg_catalog,public;

-- Returns the exact admissible net amount, never a caller-selected gross amount.
create function private.core_source_amount_v1(p_type text,p_source text,p_journal uuid,p_category text)
returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare l public.credit_revenue_ledger_v1%rowtype; f public.credit_economic_funding_sources_v1%rowtype;
 c public.credit_economic_classifications_v1%rowtype; j public.financial_journals%rowtype;
 fe public.franchise_entry_fee_ledger_entries%rowtype; amount bigint; core_code text;
begin
 select * into j from public.financial_journals where id=p_journal;
 if j.id is null or j.status<>'POSTED' then raise exception 'CORE_SOURCE_JOURNAL_INVALID' using errcode='23514';end if;
 if p_type='CREDIT_REVENUE_LEDGER' and p_category='CORE_SUBSCRIPTION_REVENUE_ACQUIRED' then
  select * into l from public.credit_revenue_ledger_v1 where id::text=p_source;
  select * into f from public.credit_economic_funding_sources_v1 where id=l.funding_source_id;
  select * into c from public.credit_economic_classifications_v1 where id=l.classification_id;
  if l.id is null or l.entry_type<>'CLASSIFY' or l.revenue_class<>'CORE_SUBSCRIPTION_REVENUE' or l.amount_minor<=0
   or f.source_kind<>'SUBSCRIPTION' or c.id is null or c.funding_source_id<>f.id or c.core_minor<>l.amount_minor
   or l.currency<>f.currency or j.currency<>f.currency or j.organization_id<>f.organization_id or j.effective_at<>f.paid_at
   or c.gross_minor<>f.gross_minor or c.content_hash<>l.source_hash
   or not exists(select 1 from private.credit_economic_classification_journals_v1 x where x.classification_id=c.id and x.financial_journal_id=j.id and x.source_hash=c.content_hash)
  then raise exception 'CORE_SOURCE_CANONICAL_MISMATCH' using errcode='23514';end if;
  if exists(select 1 from public.credit_economic_processing_events_v1 e where e.funding_source_id=f.id and e.status='SOURCE_REVIEW_REQUIRED')
   or exists(select 1 from public.credit_revenue_ledger_v1 r where r.funding_source_id=f.id and r.entry_type in('REFUND','REVERSE'))
  then raise exception 'CORE_SOURCE_INVALIDATED' using errcode='23514';end if;
  core_code:=c.classification_snapshot#>>'{fiscal_policy,policy_snapshot,recognition_accounts,core,code}';
  select coalesce(sum(case when e.direction='CREDIT'then e.amount_minor else -e.amount_minor end),0) into amount
   from public.financial_entries e join public.financial_accounts a on a.id=e.account_id
   where e.journal_id=j.id and a.code=core_code and a.account_type='REVENUE' and a.currency=f.currency and e.currency=f.currency and e.organization_id=f.organization_id;
  if amount<>c.core_minor then raise exception 'CORE_SOURCE_NET_MISMATCH' using errcode='23514';end if;
 elsif p_type='FRANCHISE_ENTRY_FEE_PAYMENT' and p_category='ENTRY_FEE_ACQUIRED' then
  select * into fe from public.franchise_entry_fee_ledger_entries where id::text=p_source;
  if fe.id is null or fe.entry_type not in('PAYMENT','WITHHOLDING') or fe.amount_minor>=0 or fe.financial_journal_id is distinct from j.id
   or not exists(select 1 from public.franchise_entry_fee_schedules s join public.franchise_pnl_books b on b.id=s.book_id where s.id=fe.schedule_id and b.franchise_type='STANDARD' and b.currency=j.currency)
  then raise exception 'CORE_SOURCE_CANONICAL_MISMATCH' using errcode='23514';end if;
  if exists(select 1 from public.franchise_entry_fee_ledger_entries x where x.schedule_id=fe.schedule_id and x.entry_type='REVERSAL')then raise exception 'CORE_SOURCE_INVALIDATED' using errcode='23514';end if;
  select coalesce(sum(e.amount_minor),0) into amount from public.financial_entries e join public.financial_accounts a on a.id=e.account_id where e.journal_id=j.id and e.direction='CREDIT' and a.account_type='REVENUE';
  -- Gross collection = net recognition + tax liabilities. Mixed journals are refused.
  if amount<=0 or amount>-fe.amount_minor or
   (select coalesce(sum(amount_minor),0) from public.financial_entries where journal_id=j.id and direction='CREDIT')<>-fe.amount_minor or
   exists(select 1 from public.financial_entries e join public.financial_accounts a on a.id=e.account_id where e.journal_id=j.id and e.direction='CREDIT' and a.account_type not in('REVENUE','LIABILITY'))
  then raise exception 'CORE_SOURCE_NET_MISMATCH' using errcode='23514';end if;
 elsif p_type='FINANCIAL_JOURNAL' and p_source=j.id::text and p_category in('MARKETING_COST','OPERATING_CHARGE')then
  select coalesce(sum(case when e.direction='DEBIT'then e.amount_minor else -e.amount_minor end),0) into amount from public.financial_entries e join public.financial_accounts a on a.id=e.account_id where e.journal_id=j.id and a.account_type='EXPENSE';
  if amount<=0 then raise exception 'CORE_SOURCE_NET_MISMATCH' using errcode='23514';end if;
 else raise exception 'CORE_SOURCE_CANONICAL_REQUIRED' using errcode='23514';
 end if;
 return amount;
end$$;

create function private.guard_core_entry_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare b public.platform_core_pot_books%rowtype;j public.financial_journals%rowtype;x public.platform_core_pot_entries%rowtype;amount bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('platform-core-integrity-v1',0));
 select * into b from public.platform_core_pot_books where id=new.book_id;
 select * into j from public.financial_journals where id=new.financial_journal_id;
 if j.organization_id is distinct from b.audit_organization_id or j.currency is distinct from b.currency or new.currency is distinct from b.currency
  or (new.reverses_entry_id is null and new.effective_on is distinct from (j.effective_at at time zone 'Africa/Casablanca')::date) then raise exception 'CORE_SOURCE_CONTEXT_MISMATCH' using errcode='23514';end if;
 if new.reverses_entry_id is null then
  amount:=private.core_source_amount_v1(new.source_type,new.source_id,new.financial_journal_id,new.category);
  if amount<>new.amount_minor then raise exception 'CORE_SOURCE_NET_MISMATCH' using errcode='23514';end if;
  if (new.effect_type='REVENUE') is distinct from (new.category in('CORE_SUBSCRIPTION_REVENUE_ACQUIRED','ENTRY_FEE_ACQUIRED'))then raise exception 'CORE_SOURCE_EFFECT_MISMATCH' using errcode='23514';end if;
  if exists(select 1 from public.platform_core_pot_entries where financial_journal_id=j.id and reverses_entry_id is null)then raise exception 'CORE_SOURCE_ALREADY_RECOGNIZED' using errcode='23514';end if;
 else
  select * into x from public.platform_core_pot_entries where id=new.reverses_entry_id;
  if x.id is null or x.book_id<>new.book_id or x.category<>new.category or x.amount_minor<>new.amount_minor or new.effective_on<>x.effective_on
   or new.effect_type<>(case x.effect_type when 'REVENUE'then 'REVERSAL_REVENUE'when 'COST'then 'REVERSAL_COST'else ''end)
  then raise exception 'INVALID_PLATFORM_CORE_POT_REVERSAL' using errcode='23514';end if;
  -- Economic invalidation reverses recognition, not cash, at its original period.
  if new.source_type='CORE_SOURCE_INVALIDATION' then
   if new.source_id<>x.id::text or new.financial_journal_id<>x.financial_journal_id then raise exception 'CORE_SOURCE_CANONICAL_MISMATCH' using errcode='23514';end if;
   begin
    perform private.core_source_amount_v1(x.source_type,x.source_id,x.financial_journal_id,x.category);
    raise exception 'CORE_SOURCE_NOT_INVALIDATED' using errcode='23514';
   exception when check_violation then
    if sqlerrm<>'CORE_SOURCE_INVALIDATED'then raise;end if;
   end;
  else
   -- A manual correction must reverse every original accounting line exactly.
   if new.source_type<>'FINANCIAL_JOURNAL'or new.source_id<>j.id::text or j.id=x.financial_journal_id or exists(
    (select account_id,direction,sum(amount_minor) from public.financial_entries where journal_id=j.id group by account_id,direction
     except select account_id,case direction when 'DEBIT'then 'CREDIT'else 'DEBIT'end,sum(amount_minor) from public.financial_entries where journal_id=x.financial_journal_id group by account_id,direction)
    union all
    (select account_id,case direction when 'DEBIT'then 'CREDIT'else 'DEBIT'end,sum(amount_minor) from public.financial_entries where journal_id=x.financial_journal_id group by account_id,direction
     except select account_id,direction,sum(amount_minor) from public.financial_entries where journal_id=j.id group by account_id,direction)
   )then raise exception 'CORE_REVERSAL_JOURNAL_MISMATCH' using errcode='23514';end if;
  end if;
 end if;
 return new;
end$$;
create trigger core_entry_canonical before insert on public.platform_core_pot_entries for each row execute function private.guard_core_entry_v1();
create index core_source_lookup on public.platform_core_pot_entries(source_type,source_id)where effect_type='REVENUE';
create unique index core_entry_single_reversal on public.platform_core_pot_entries(reverses_entry_id) where reverses_entry_id is not null;

create function private.assert_core_sources_v1(p_book uuid,p_payout boolean)returns void language plpgsql security definer set search_path=pg_catalog as $$
declare e public.platform_core_pot_entries%rowtype; amount bigint;
begin
 for e in select * from public.platform_core_pot_entries x where x.book_id=p_book and x.reverses_entry_id is null and not exists(select 1 from public.platform_core_pot_entries r where r.reverses_entry_id=x.id) loop
  amount:=private.core_source_amount_v1(e.source_type,e.source_id,e.financial_journal_id,e.category);
  if amount<>e.amount_minor then raise exception 'CORE_SOURCE_NET_MISMATCH' using errcode='23514';end if;
 end loop;
 if p_payout and exists(select 1 from public.platform_core_pot_entries ent where ent.book_id=p_book and not exists(
  select 1 from public.platform_core_pot_closure_versions c where c.book_id=p_book and ent.effective_on between c.period_start and c.period_end
   and c.entry_cutoff_at>=ent.created_at and c.version=(select max(v.version) from public.platform_core_pot_closure_versions v where v.book_id=c.book_id and v.period_start=c.period_start and v.period_end=c.period_end)
 ))then raise exception 'CORE_POT_CORRECTIVE_CLOSE_REQUIRED' using errcode='23514';end if;
end$$;

-- The same lock covers invalidation and distribution, so a concurrent refund
-- cannot commit between source validation and a new financial distribution.
create function private.lock_core_source_change_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin perform pg_advisory_xact_lock(hashtextextended('platform-core-integrity-v1',0));return new;end$$;
create trigger core_processing_lock before insert on public.credit_economic_processing_events_v1 for each row execute function private.lock_core_source_change_v1();
create trigger core_revenue_lock before insert on public.credit_revenue_ledger_v1 for each row execute function private.lock_core_source_change_v1();
create trigger core_fee_lock before insert on public.franchise_entry_fee_ledger_entries for each row execute function private.lock_core_source_change_v1();

create function private.reverse_invalid_core_sources_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare e public.platform_core_pot_entries%rowtype; rid uuid; org uuid;
begin
 for e in select * from public.platform_core_pot_entries x where x.effect_type='REVENUE' and not exists(select 1 from public.platform_core_pot_entries r where r.reverses_entry_id=x.id)
 and ((x.source_type='CREDIT_REVENUE_LEDGER' and exists(select 1 from public.credit_revenue_ledger_v1 l where l.id::text=x.source_id and l.funding_source_id::text=to_jsonb(new)->>'funding_source_id'))
 or (x.source_type='FRANCHISE_ENTRY_FEE_PAYMENT' and exists(select 1 from public.franchise_entry_fee_ledger_entries fe where fe.id::text=x.source_id and fe.schedule_id::text=to_jsonb(new)->>'schedule_id')))
 order by x.id loop
  begin
   perform private.core_source_amount_v1(e.source_type,e.source_id,e.financial_journal_id,e.category);
  exception when check_violation then
   if sqlerrm<>'CORE_SOURCE_INVALIDATED'then continue;end if;
   insert into public.platform_core_pot_entries(book_id,effect_type,category,amount_minor,currency,financial_journal_id,source_type,source_id,effective_on,reason,reverses_entry_id,correlation_id,created_by)
   values(e.book_id,'REVERSAL_REVENUE',e.category,e.amount_minor,e.currency,e.financial_journal_id,'CORE_SOURCE_INVALIDATION',e.id::text,e.effective_on,'Canonical source invalidated; corrective closure required',e.id,new.correlation_id,e.created_by) returning id into rid;
   select audit_organization_id into org from public.platform_core_pot_books where id=e.book_id;
   insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
   values(org,'SERVICE','platform.core_pot.source.invalidated','platform_core_pot_entry',rid::text,new.correlation_id,jsonb_build_object('reverses_entry_id',e.id),repeat('0',64));
   insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
   values(org,'platform_core_pot_book',e.book_id::text,'PlatformCorePotSourceInvalidatedV1',new.correlation_id,jsonb_build_object('entry_id',rid,'reverses_entry_id',e.id),'core-invalidation:'||e.id::text);
  end;
 end loop;
 return new;
end$$;
create trigger core_processing_reversal after insert on public.credit_economic_processing_events_v1 for each row when(new.status='SOURCE_REVIEW_REQUIRED') execute function private.reverse_invalid_core_sources_v1();
create trigger core_revenue_reversal after insert on public.credit_revenue_ledger_v1 for each row when(new.entry_type in('REFUND','REVERSE')) execute function private.reverse_invalid_core_sources_v1();
create trigger core_fee_reversal after insert on public.franchise_entry_fee_ledger_entries for each row when(new.entry_type='REVERSAL') execute function private.reverse_invalid_core_sources_v1();

revoke all on function private.core_source_amount_v1(text,text,uuid,text),private.guard_core_entry_v1(),private.assert_core_sources_v1(uuid,boolean),private.lock_core_source_change_v1(),private.reverse_invalid_core_sources_v1() from public,anon,authenticated,service_role;

-- Ingestion uses the same canonical net source as direct posting.
create or replace function public.ingest_platform_core_pot_sources_v1(
 p_book_id uuid,
 p_financial_journal_id uuid,
 p_credit_revenue_ledger_id bigint default null,
 p_franchise_entry_fee_ledger_id bigint default null,
 p_reason text default '',
 p_idempotency_key text default '',
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
 a uuid:=auth.uid();b public.platform_core_pot_books%rowtype;
 j public.financial_journals%rowtype;
 l public.credit_revenue_ledger_v1%rowtype;
 f public.credit_economic_funding_sources_v1%rowtype;
 fe public.franchise_entry_fee_ledger_entries%rowtype;
 pb public.franchise_pnl_books%rowtype;
 amount bigint;category text;source_type text;source_id text;effective_on date;
 inner_key text;r jsonb;
begin
 if a is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or (auth.jwt()->>'aal')is distinct from 'aal2'then
  raise exception 'PLATFORM_CORE_POT_INGEST_DENIED'using errcode='42501';
 end if;
 select*into b from public.platform_core_pot_books where id=p_book_id;
 select*into j from public.financial_journals where id=p_financial_journal_id;
 if b.id is null or j.id is null or b.status<>'OPEN'or length(btrim(coalesce(p_reason,'')))not between 3 and 1000
  or length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200
 then raise exception 'INVALID_PLATFORM_CORE_POT_INGEST'using errcode='22023';end if;
 if(p_credit_revenue_ledger_id is null)=(p_franchise_entry_fee_ledger_id is null)then
  raise exception 'PLATFORM_CORE_POT_INGEST_SOURCE_REQUIRED'using errcode='22023';
 end if;
 if p_credit_revenue_ledger_id is not null then
  select*into l from public.credit_revenue_ledger_v1 where id=p_credit_revenue_ledger_id;
  if not found or l.revenue_class<>'CORE_SUBSCRIPTION_REVENUE'or l.amount_minor<=0
   or l.entry_type in('REFUND','REVERSE')or l.currency<>b.currency
  then raise exception 'INVALID_CORE_SUBSCRIPTION_POT_SOURCE'using errcode='22023';end if;
  select*into f from public.credit_economic_funding_sources_v1 where id=l.funding_source_id;
  if not found then raise exception 'INVALID_CORE_SUBSCRIPTION_POT_SOURCE'using errcode='22023';end if;
  amount:=l.amount_minor;category:='CORE_SUBSCRIPTION_REVENUE_ACQUIRED';source_type:='CREDIT_REVENUE_LEDGER';source_id:=l.id::text;
 else
  select*into fe from public.franchise_entry_fee_ledger_entries where id=p_franchise_entry_fee_ledger_id;
  if not found or fe.entry_type not in('PAYMENT','WITHHOLDING')or fe.amount_minor>=0 or fe.financial_journal_id is null
  then raise exception 'INVALID_ENTRY_FEE_POT_SOURCE'using errcode='22023';end if;
  select b.* into pb from public.franchise_pnl_books b join public.franchise_entry_fee_schedules s on s.book_id=b.id where s.id=fe.schedule_id;
  if not found or pb.franchise_type='IT'or pb.currency<>b.currency
  then raise exception 'IT_ENTRY_FEE_EXCLUDED_FROM_PLATFORM_POT'using errcode='23514';end if;
  amount:=-fe.amount_minor;category:='ENTRY_FEE_ACQUIRED';source_type:='FRANCHISE_ENTRY_FEE_PAYMENT';source_id:=fe.id::text;
 end if;
 if source_type='FRANCHISE_ENTRY_FEE_PAYMENT'then
  select coalesce(sum(e.amount_minor),0)into amount from public.financial_entries e join public.financial_accounts ac on ac.id=e.account_id where e.journal_id=j.id and e.direction='CREDIT'and ac.account_type='REVENUE';
 end if;
 effective_on:=(j.effective_at at time zone'Africa/Casablanca')::date;
 inner_key:='platform-core-pot-ingest-v1:'||btrim(p_idempotency_key);
 r:=public.post_platform_core_pot_entry(
  b.id,'REVENUE',category,amount,p_financial_journal_id,source_type,source_id,effective_on,p_reason,null,inner_key,p_correlation_id
 );
 return jsonb_build_object(
  'outcome','PLATFORM_CORE_POT_SOURCE_INGESTED','source_type',source_type,'source_id',source_id,'amount_minor',amount,'category',category,'post',r
 );
end$$;


-- Database-level protection also applies at stronger transaction isolation.
create unique index core_single_journal_recognition on public.platform_core_pot_entries(financial_journal_id) where source_type<>'CORE_SOURCE_INVALIDATION';
create table private.core_periods_v1(
 book_id uuid not null references public.platform_core_pot_books(id),
 period daterange not null,
 primary key(book_id,period),
 exclude using gist(book_id with =,period with &&)
);
alter table private.core_periods_v1 enable row level security;
revoke all on private.core_periods_v1 from public,anon,authenticated,service_role;
insert into private.core_periods_v1 select distinct book_id,daterange(period_start,period_end,'[]') from public.platform_core_pot_closure_versions;
create function private.guard_core_period_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into private.core_periods_v1(book_id,period)values(new.book_id,daterange(new.period_start,new.period_end,'[]'))on conflict(book_id,period)do nothing;
 return new;
end$$;
create trigger core_period_claim before insert on public.platform_core_pot_closure_versions for each row execute function private.guard_core_period_v1();
revoke all on function private.guard_core_period_v1()from public,anon,authenticated,service_role;
create unique index core_single_payout_journal on public.platform_core_pot_distribution_ledger_entries(financial_journal_id) where entry_type='PAYOUT';
create function private.guard_core_payout_journal_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare debit numeric;credit numeric;
begin
 if new.entry_type<>'PAYOUT'then return new;end if;
 select coalesce(sum(e.amount_minor)filter(where e.direction='DEBIT'and a.account_type in('LIABILITY','EQUITY')),0),coalesce(sum(e.amount_minor)filter(where e.direction='CREDIT'and a.account_type='ASSET'),0)
 into debit,credit from public.financial_entries e join public.financial_accounts a on a.id=e.account_id where e.journal_id=new.financial_journal_id and e.currency=new.currency and a.currency=new.currency;
 if debit<>-new.amount_minor or credit<>-new.amount_minor or (select sum(amount_minor)from public.financial_entries where journal_id=new.financial_journal_id)<>debit+credit then raise exception 'CORE_PAYOUT_JOURNAL_MISMATCH'using errcode='23514';end if;
 return new;
end$$;
create trigger core_payout_journal before insert on public.platform_core_pot_distribution_ledger_entries for each row execute function private.guard_core_payout_journal_v1();
revoke all on function private.guard_core_payout_journal_v1()from public,anon,authenticated,service_role;
COMMIT;
