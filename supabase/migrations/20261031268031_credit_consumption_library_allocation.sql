begin;
-- This hook observes immutable consumption. It never spends credits or advances
-- delivery, and cannot turn an operational receipt into a physical-file proof.
create function private.credit_economic_book_route_v1(p_library uuid,p_client uuid,p_currency char(3),p_consumed_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare route jsonb;b public.franchise_pnl_books%rowtype;f public.franchises%rowtype;m public.franchise_mandate_versions%rowtype;begin
 route:=private.approved_credit_revenue_policy_v1('BOOK_ROUTE','LIBRARY',p_library,p_currency,p_consumed_at::date,p_client);
 if route is null then return null;end if;
 select*into b from public.franchise_pnl_books where id=(route#>>'{policy_snapshot,book_id}')::uuid and library_id=p_library and currency=p_currency and status='OPEN';
 select*into f from public.franchises where id=(route#>>'{policy_snapshot,franchise_id}')::uuid and library_id=p_library and operator_organization_id=b.franchise_organization_id and status='ACTIVE';
 select*into m from public.franchise_mandate_versions where id=(route#>>'{policy_snapshot,mandate_version_id}')::uuid and franchise_id=f.id and mandate_status='ACTIVE'and effective_from<=p_consumed_at and(effective_until is null or effective_until>p_consumed_at);
 if b.id is null or f.id is null or m.id is null or not private.franchise_activation_mode_allowed_v1(f.id)or f.current_mandate_version_id is distinct from m.id or not exists(select 1 from public.organizations where id=f.operator_organization_id and status='ACTIVE')then return null;end if;
 return route||jsonb_build_object('book',to_jsonb(b),'franchise',to_jsonb(f),'mandate',to_jsonb(m));
end$$;
revoke all on function private.credit_economic_book_route_v1(uuid,uuid,character,timestamp with time zone)from public,anon,authenticated,service_role;

create function private.guard_credit_economic_pnl_source_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare allocation public.credit_economic_allocations_v1%rowtype;funding public.credit_economic_funding_sources_v1%rowtype;begin
 if new.source_type<>'CREDIT_ECONOMIC_ALLOCATION_V1'then return new;end if;
 if new.source_id!~*'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then raise exception'CANONICAL_CREDIT_ECONOMIC_PNL_SOURCE_REQUIRED'using errcode='42501';end if;
 select*into allocation from public.credit_economic_allocations_v1 where id=new.source_id::uuid;
 select*into funding from public.credit_economic_funding_sources_v1 where id=allocation.funding_source_id;
 if allocation.id is null or not exists(select 1 from private.credit_economic_pnl_write_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and allocation_id=allocation.id)
  or new.book_id is distinct from allocation.book_id or new.amount_minor is distinct from allocation.amount_minor or new.currency is distinct from allocation.currency or new.financial_journal_id is distinct from funding.financial_journal_id or new.effect_type is distinct from(case when allocation.allocation_kind='REVERSAL'then'REVERSAL_REVENUE'else'REVENUE'end)or new.category<>'COLLECTED_NET_REVENUE'
 then raise exception'CANONICAL_CREDIT_ECONOMIC_PNL_SOURCE_REQUIRED'using errcode='42501';end if;
 return new;
end$$;
revoke all on function private.guard_credit_economic_pnl_source_v1()from public,anon,authenticated,service_role;
create trigger credit_economic_pnl_reserved_source_guard before insert on public.franchise_pnl_entries for each row execute function private.guard_credit_economic_pnl_source_v1();

create function private.post_credit_economic_allocation_v1(p_funding uuid,p_classification uuid,p_fact uuid,p_kind text,p_source_id text,p_amount bigint,p_library uuid,p_route jsonb,p_snapshot jsonb,p_effective_on date,p_correlation uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare f public.credit_economic_funding_sources_v1%rowtype;c public.credit_economic_classifications_v1%rowtype;a public.credit_economic_allocations_v1%rowtype;new_allocation_id uuid:=extensions.gen_random_uuid();pnl uuid:=extensions.gen_random_uuid();actor uuid;h text;snapshot jsonb;available numeric;begin
 select*into f from public.credit_economic_funding_sources_v1 where id=p_funding;
 select*into c from public.credit_economic_classifications_v1 where id=p_classification and funding_source_id=f.id;
 if f.id is null or c.id is null or p_kind not in('PURCHASE_CONSUMPTION','SUBSCRIPTION_POOL')or p_amount is null or p_amount<=0 or p_library is null or p_route is null or(p_route#>>'{book,currency}')is distinct from f.currency::text then raise exception'INVALID_CANONICAL_CREDIT_ALLOCATION'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-funding:'||f.id::text,0));
 select*into a from public.credit_economic_allocations_v1 where funding_source_id=f.id and allocation_kind=p_kind and source_id=p_source_id;
 if a.id is not null then
  if a.classification_id<>c.id or a.consumption_fact_id is distinct from p_fact or a.amount_minor<>p_amount or a.library_id<>p_library or a.book_id<>(p_route#>>'{book,id}')::uuid then raise exception'CREDIT_ALLOCATION_REPLAY_MISMATCH'using errcode='22000';end if;
  return a.id;
 end if;
 select coalesce(sum(amount_minor),0)into available from public.credit_revenue_ledger_v1 where funding_source_id=f.id and revenue_class=case p_kind when'PURCHASE_CONSUMPTION'then'UNALLOCATED_CREDIT_REVENUE'else'BENEFIT_POOL_REVENUE'end;
 if available<p_amount then raise exception'CREDIT_ALLOCATION_EXCEEDS_FUNDED_NET'using errcode='23514';end if;
 actor:=c.created_by;
 snapshot:=jsonb_build_object('funding_source_id',f.id,'funding_source_hash',f.source_hash,'classification_id',c.id,'classification_hash',c.content_hash,'consumption_fact_id',p_fact,'kind',p_kind,'source_id',p_source_id,'amount_minor',p_amount::text,'currency',f.currency,'library_id',p_library,'route',p_route,'evidence',p_snapshot,'effective_on',p_effective_on);
 h:=private.canonical_request_hash(snapshot);
 insert into public.credit_economic_allocations_v1(id,funding_source_id,classification_id,consumption_fact_id,allocation_policy_id,book_route_policy_id,library_id,book_id,allocation_kind,amount_minor,currency,source_id,allocation_snapshot,content_hash,created_by,correlation_id)
 values(new_allocation_id,f.id,c.id,p_fact,c.allocation_policy_id,(p_route->>'id')::uuid,p_library,(p_route#>>'{book,id}')::uuid,p_kind,p_amount,f.currency,p_source_id,snapshot,h,actor,p_correlation);
 insert into public.credit_revenue_ledger_v1(funding_source_id,classification_id,allocation_id,entry_type,revenue_class,amount_minor,currency,source_key,source_hash,correlation_id)values
 (f.id,c.id,new_allocation_id,'ALLOCATE',case p_kind when'PURCHASE_CONSUMPTION'then'UNALLOCATED_CREDIT_REVENUE'else'BENEFIT_POOL_REVENUE'end,-p_amount,f.currency,new_allocation_id::text,h,p_correlation),
 (f.id,c.id,new_allocation_id,'ALLOCATE','LIBRARY_ALLOCATED_REVENUE',p_amount,f.currency,new_allocation_id::text,h,p_correlation);
 -- Attribution of the client's real journal is an analytical revenue source,
 -- not a synthetic receipt or a transfer to the franchisee's bank account.
 insert into private.credit_economic_pnl_write_capabilities_v1(backend_pid,transaction_id,allocation_id)values(pg_backend_pid(),txid_current(),new_allocation_id);
 insert into public.franchise_pnl_entries(id,book_id,effect_type,category,amount_minor,currency,financial_journal_id,source_type,source_id,effective_on,reason,correlation_id,created_by)
 values(pnl,(p_route#>>'{book,id}')::uuid,'REVENUE','COLLECTED_NET_REVENUE',p_amount,f.currency,f.financial_journal_id,'CREDIT_ECONOMIC_ALLOCATION_V1',new_allocation_id::text,p_effective_on,'Canonical library allocation of fiscally classified verified payment',p_correlation,actor);
 delete from private.credit_economic_pnl_write_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and allocation_id=new_allocation_id;
 insert into private.credit_economic_pnl_sources_v1(allocation_id,pnl_entry_id)values(new_allocation_id,pnl);
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.organization_id,'SERVICE','credit.economic.allocated','credit_economic_allocation',new_allocation_id::text,p_correlation,jsonb_build_object('content_hash',h,'library_id',p_library,'amount_minor',p_amount::text,'currency',f.currency),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.organization_id,'credit_economic_allocation',new_allocation_id::text,'CreditEconomicAllocatedV1',p_correlation,jsonb_build_object('allocation_id',new_allocation_id,'library_id',p_library,'book_id',(p_route#>>'{book,id}')::uuid,'content_hash',h),'credit-economic-allocation:'||new_allocation_id::text);
 return new_allocation_id;
end$$;
revoke all on function private.post_credit_economic_allocation_v1(uuid,uuid,uuid,text,text,bigint,uuid,jsonb,jsonb,date,uuid)from public,anon,authenticated,service_role;

create function private.allocate_credit_economic_consumption_v1(p_fact_id uuid,p_correlation uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare fact public.credit_economic_consumption_facts_v1%rowtype;funding public.credit_economic_funding_sources_v1%rowtype;c public.credit_economic_classifications_v1%rowtype;l public.credit_lots%rowtype;b public.benefit_versions%rowtype;
 policy public.credit_revenue_policy_versions_v1%rowtype;route jsonb;classification jsonb;receipt jsonb;before_qty numeric;amount bigint;allocation uuid;context jsonb;
begin
 select*into fact from public.credit_economic_consumption_facts_v1 where id=p_fact_id;
 if fact.id is null then raise exception'CREDIT_CONSUMPTION_SOURCE_NOT_FOUND'using errcode='42501';end if;
 context:=jsonb_build_object('consumption_fact_id',fact.id,'source_hash',fact.source_hash);
 if fact.source_hash<>private.canonical_request_hash(fact.source_snapshot)then raise exception'CREDIT_CONSUMPTION_SOURCE_HASH_MISMATCH'using errcode='23514';end if;
 if fact.funding_source_id is null then return private.credit_economic_pending_v1(null,fact.redemption_id,'SOURCE_REVIEW_REQUIRED','CONSUMED_CREDIT_HAS_NO_CANONICAL_PAYMENT',context,p_correlation);end if;
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-funding:'||fact.funding_source_id::text,0));
 select*into funding from public.credit_economic_funding_sources_v1 where id=fact.funding_source_id;
 select*into l from public.credit_lots where id=fact.credit_lot_id and organization_id=fact.organization_id;
 select*into b from public.benefit_versions where id=fact.benefit_version_id;
 receipt:=private.benefit_accepted_receipt_v1(fact.redemption_id,fact.delivery_proof_hash);
 if receipt is null or private.credit_lot_funding_status_v1(l.id)<>'ELIGIBLE'or b.currency<>funding.currency or fact.currency<>funding.currency then return private.credit_economic_pending_v1(funding.id,fact.redemption_id,'SOURCE_REVIEW_REQUIRED','CONSUMPTION_PAYMENT_OR_RECEIPT_NOT_ADMISSIBLE',context,p_correlation);end if;
 classification:=private.classify_credit_economic_funding_v1(funding.id,p_correlation);
 select*into c from public.credit_economic_classifications_v1 where funding_source_id=funding.id order by version desc limit 1;
 if c.id is null then return private.credit_economic_pending_v1(funding.id,fact.redemption_id,classification->>'status',classification->>'reason_code',context,p_correlation);end if;
 select*into policy from public.credit_revenue_policy_versions_v1 where id=c.allocation_policy_id;
 if not(policy.policy_snapshot->'accepted_evidence_kinds'?coalesce(receipt->>'evidence_kind',''))or not(policy.policy_snapshot->'fulfillment_modes'?b.fulfillment_mode)then return private.credit_economic_pending_v1(funding.id,fact.redemption_id,'PENDING_ALLOCATION_POLICY','RECEIPT_KIND_OR_FULFILLMENT_NOT_APPROVED',context||jsonb_build_object('evidence_kind',receipt->>'evidence_kind','fulfillment_mode',b.fulfillment_mode),p_correlation);end if;
 if funding.source_kind='SUBSCRIPTION'then return private.credit_economic_pending_v1(funding.id,fact.redemption_id,'PENDING_PERIOD_CLOSE','SUBSCRIPTION_POOL_AWAITS_GOVERNED_PERIOD_CLOSE',context,p_correlation);end if;
 if fact.library_id is null then return private.credit_economic_pending_v1(funding.id,fact.redemption_id,'PENDING_MANDATE','CONSUMED_BENEFIT_LIBRARY_REQUIRED',context,p_correlation);end if;
 route:=private.credit_economic_book_route_v1(fact.library_id,fact.organization_id,fact.currency,fact.consumed_at);
 if route is null then return private.credit_economic_pending_v1(funding.id,fact.redemption_id,'PENDING_MANDATE','APPROVED_EXACT_LIBRARY_BOOK_MANDATE_REQUIRED',context,p_correlation);end if;
 if(select coalesce(sum(consumed_quantity),0)from public.credit_economic_consumption_facts_v1 where credit_lot_id=l.id)>l.quantity then raise exception'ECONOMIC_CONSUMPTION_EXCEEDS_CREDIT_LOT'using errcode='23514';end if;
 select coalesce(sum(consumed_quantity),0)into before_qty from public.credit_economic_consumption_facts_v1 where credit_lot_id=l.id and movement_id<fact.movement_id;
 amount:=floor(c.unallocated_credit_minor::numeric*(before_qty+fact.consumed_quantity)/l.quantity)::bigint-floor(c.unallocated_credit_minor::numeric*before_qty/l.quantity)::bigint;
 if amount>0 then allocation:=private.post_credit_economic_allocation_v1(funding.id,c.id,fact.id,'PURCHASE_CONSUMPTION',fact.id::text,amount,fact.library_id,route,jsonb_build_object('consumption',fact.source_snapshot,'receipt',receipt,'before_quantity',before_qty::text,'lot_quantity',l.quantity::text,'rounding',policy.policy_snapshot->>'purchase_rounding'),fact.consumed_at::date,p_correlation);end if;
 perform private.credit_economic_pending_v1(funding.id,fact.redemption_id,'READY','PURCHASE_CONSUMPTION_ALLOCATED',context||jsonb_build_object('allocation_id',allocation,'amount_minor',amount::text),p_correlation);
 return jsonb_build_object('status','READY','allocation_id',allocation,'amount_minor',amount::text,'consumption_fact_id',fact.id);
end$$;
revoke all on function private.allocate_credit_economic_consumption_v1(uuid,uuid)from public,anon,authenticated,service_role;

create function private.observe_credit_economic_consumption_v1(p_redemption uuid,p_correlation uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare d public.benefit_redemptions%rowtype;b public.benefit_versions%rowtype;receipt jsonb;movement public.credit_lot_movements%rowtype;l public.credit_lots%rowtype;funding uuid;fact uuid;snapshot jsonb;source_hash text;result jsonb;items jsonb:='[]';
begin
 select*into d from public.benefit_redemptions where id=p_redemption;
 if d.id is null or d.status<>'CONSUMED'then raise exception'CONSUMED_REDEMPTION_REQUIRED'using errcode='55000';end if;
 receipt:=private.benefit_accepted_receipt_v1(d.id,d.delivery_proof_hash);
 if receipt is null then return private.credit_economic_pending_v1(null,d.id,'SOURCE_REVIEW_REQUIRED','NATIVE_INDEPENDENT_BENEFIT_RECEIPT_REQUIRED',jsonb_build_object('redemption_id',d.id,'proof_hash',d.delivery_proof_hash),p_correlation);end if;
 select*into b from public.benefit_versions where id=d.benefit_version_id;
 if(select coalesce(sum(quantity),0)from public.credit_lot_movements where redemption_id=d.id and organization_id=d.organization_id and movement_type='CONSUME')<>d.reserved_credits then raise exception'ECONOMIC_CONSUMPTION_MOVEMENT_TOTAL_MISMATCH'using errcode='23514';end if;
 for movement in select*from public.credit_lot_movements where redemption_id=d.id and organization_id=d.organization_id and movement_type='CONSUME'order by id loop
  select*into l from public.credit_lots where id=movement.credit_lot_id and organization_id=d.organization_id and wallet_id=d.wallet_id;
  if l.id is null then raise exception'ECONOMIC_CONSUMPTION_WALLET_MISMATCH'using errcode='23514';end if;
  funding:=null;
  if l.source_type='EXTRA_PURCHASE'then
   select f.id into funding from public.credit_lot_extra_payment_sources_v1 s join public.credit_pack_payment_events_v1 e on e.id=s.payment_event_id join public.credit_economic_funding_sources_v1 f on f.source_kind='CREDIT_PACK'and f.source_id=e.gateway||':'||e.provider_environment||':'||e.payment_reference where s.credit_lot_id=l.id and s.organization_id=d.organization_id;
  elsif l.source_type='SUBSCRIPTION_GRANT'then
   select f.id into funding from public.credit_lot_payment_sources_v1 s join public.subscription_payment_events e on e.id=s.payment_event_id join public.credit_economic_funding_sources_v1 f on f.source_kind='SUBSCRIPTION'and f.source_id=e.gateway||':'||e.provider_environment||':'||e.payment_reference where s.credit_lot_id=l.id and s.organization_id=d.organization_id;
  end if;
  snapshot:=jsonb_build_object('redemption_id',d.id,'organization_id',d.organization_id,'benefit_version',to_jsonb(b),'credit_lot_id',l.id,'credit_source_type',l.source_type,'movement',to_jsonb(movement),'funding_source_id',funding,'units',d.units::text,'reserved_credits',d.reserved_credits::text,'receipt',receipt,'library_id',b.library_id,'currency',b.currency);
  source_hash:=private.canonical_request_hash(snapshot);
  select id into fact from public.credit_economic_consumption_facts_v1 where movement_id=movement.id;
  if fact is null then
   insert into public.credit_economic_consumption_facts_v1(organization_id,redemption_id,movement_id,credit_lot_id,funding_source_id,benefit_version_id,library_id,consumed_quantity,units,currency,consumed_at,delivery_proof_hash,source_snapshot,source_hash,correlation_id)
   values(d.organization_id,d.id,movement.id,l.id,funding,b.id,b.library_id,movement.quantity,d.units,b.currency,movement.occurred_at,d.delivery_proof_hash,snapshot,source_hash,p_correlation)returning id into fact;
  elsif not exists(select 1 from public.credit_economic_consumption_facts_v1 stored where stored.id=fact and stored.source_hash=private.canonical_request_hash(stored.source_snapshot))then raise exception'ECONOMIC_CONSUMPTION_FACT_HASH_MISMATCH'using errcode='23514';end if;
  result:=private.allocate_credit_economic_consumption_v1(fact,p_correlation);items:=items||jsonb_build_array(result);
 end loop;
 return jsonb_build_object('redemption_id',d.id,'items',items);
end$$;
revoke all on function private.observe_credit_economic_consumption_v1(uuid,uuid)from public,anon,authenticated,service_role;
create function private.capture_credit_economic_consumption_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if new.status='CONSUMED'and old.status is distinct from new.status then perform private.observe_credit_economic_consumption_v1(new.id,new.correlation_id);end if;return new;
end$$;
revoke all on function private.capture_credit_economic_consumption_v1()from public,anon,authenticated,service_role;
create trigger credit_economic_consumption_capture after update of status on public.benefit_redemptions for each row execute function private.capture_credit_economic_consumption_v1();
create function public.reconcile_credit_economic_consumption_v1(p_redemption_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare funding uuid;begin
 if not private.credit_revenue_finance_access_v1(auth.uid(),true)then raise exception'CREDIT_ECONOMIC_RECONCILIATION_DENIED'using errcode='42501';end if;
 for funding in select distinct source_id from(
  select funding_source_id source_id from public.credit_economic_consumption_facts_v1 where redemption_id=p_redemption_id
  union select f.id from public.credit_lot_movements m join public.credit_lot_extra_payment_sources_v1 s on s.credit_lot_id=m.credit_lot_id join public.credit_pack_payment_events_v1 e on e.id=s.payment_event_id join public.credit_economic_funding_sources_v1 f on f.source_kind='CREDIT_PACK'and f.source_id=e.gateway||':'||e.provider_environment||':'||e.payment_reference where m.redemption_id=p_redemption_id and m.movement_type='CONSUME'
  union select f.id from public.credit_lot_movements m join public.credit_lot_payment_sources_v1 s on s.credit_lot_id=m.credit_lot_id join public.subscription_payment_events e on e.id=s.payment_event_id join public.credit_economic_funding_sources_v1 f on f.source_kind='SUBSCRIPTION'and f.source_id=e.gateway||':'||e.provider_environment||':'||e.payment_reference where m.redemption_id=p_redemption_id and m.movement_type='CONSUME'
 )sources where source_id is not null order by source_id loop
  perform pg_advisory_xact_lock(hashtextextended('credit-economic-funding:'||funding::text,0));
 end loop;
 perform private.lock_credit_revenue_finance_actor_v1();
 return private.observe_credit_economic_consumption_v1(p_redemption_id,p_correlation_id);
end$$;
revoke all on function public.reconcile_credit_economic_consumption_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.reconcile_credit_economic_consumption_v1(uuid,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
