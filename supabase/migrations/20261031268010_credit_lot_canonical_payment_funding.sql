-- A credit balance is historical. Eligibility of an unspent subscription lot is
-- evaluated from its own immutable capture, never from the current subscription.
begin;

create table public.credit_lot_payment_sources_v1(
 credit_lot_id uuid primary key references public.credit_lots(id)on delete restrict,
 organization_id uuid not null references public.organizations(id)on delete restrict,
 payment_event_id bigint not null references public.subscription_payment_events(id)on delete restrict,
 subscription_cycle_id uuid not null references public.subscription_cycles(id)on delete restrict,
 source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),
 source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),
 resolution_method text not null check(resolution_method in('CANONICAL_REFERENCE','EXACT_LEGACY_REFERENCE')),
 grant_month_index integer check(grant_month_index between 1 and 12),
 check(resolution_method<>'CANONICAL_REFERENCE'or grant_month_index is not null),
 linked_by uuid references auth.users(id),linked_at timestamptz not null default clock_timestamp()
);
create index credit_lot_payment_sources_org_idx on public.credit_lot_payment_sources_v1(organization_id,payment_event_id);
create unique index credit_lot_payment_sources_month_unique on public.credit_lot_payment_sources_v1(payment_event_id,grant_month_index)where grant_month_index is not null;
alter table public.credit_lot_payment_sources_v1 enable row level security;
revoke all on public.credit_lot_payment_sources_v1 from public,anon,authenticated,service_role;
grant select on public.credit_lot_payment_sources_v1 to authenticated;
create policy credit_lot_payment_sources_read on public.credit_lot_payment_sources_v1 for select to authenticated
 using(private.credits_client_access(organization_id)or private.credits_admin_access());
create trigger credit_lot_payment_sources_immutable before update or delete on public.credit_lot_payment_sources_v1
 for each row execute function private.prevent_update_delete();

-- Resolve the precise native payment/cycle fact. A non-unique human reference
-- cannot become evidence, including during the additive legacy metadata import.
create function private.resolve_subscription_credit_source_v1(p_organization_id uuid,p_source_reference text,p_legacy boolean default false)
returns table(payment_event_id bigint,subscription_cycle_id uuid,source_snapshot jsonb)
language sql stable security definer set search_path=pg_catalog,private set timezone='UTC' as $$
 with candidates as(
  select e.id payment_event_id,c.id subscription_cycle_id,jsonb_build_object(
   'payment_event_id',e.id::text,'subscription_cycle_id',c.id,'subscription_id',c.subscription_id,
   'organization_id',c.organization_id,'gateway',e.gateway,'provider_environment',e.provider_environment,
   'deployment_environment',e.deployment_environment,'payment_reference',e.payment_reference,
   'payload_hash',e.payload_hash,'period_start',c.period_start,'period_end',c.period_end,
   'currency',e.currency,'amount_minor',e.amount_minor::text)source_snapshot
  from public.subscription_payment_events e
  join public.subscription_payment_intents i on i.id=e.payment_intent_id and i.organization_id=e.organization_id
  join public.subscription_cycles c on c.organization_id=e.organization_id and c.payment_reference=e.payment_reference
   and c.payment_proof_hash=e.payload_hash and c.amount_minor=e.amount_minor and c.currency=e.currency
   and c.subscription_id::text=e.activation_result->>'subscription_id'
   and c.cycle_number::text=e.activation_result->>'cycle_number'
  where e.organization_id=p_organization_id and e.event_type='PAYMENT_SUCCEEDED'and c.id=private.subscription_payment_cycle_v1(e.id)
   and((p_source_reference~'^subscription-payment:[0-9]+(:month:([1-9]|1[0-2]))?$'and split_part(p_source_reference,':month:',1)='subscription-payment:'||e.id::text)or(p_legacy and
    p_source_reference in(e.payment_reference,c.id::text)))
 )select c.*from candidates c where(select count(*)from candidates)=1
$$;
revoke all on function private.resolve_subscription_credit_source_v1(uuid,text,boolean)from public,anon,authenticated,service_role;

create function private.subscription_credit_grant_terms_v1(p_organization_id uuid,p_payment_event_id bigint,p_month_index integer)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare source record;c public.subscription_cycles%rowtype;pay public.subscription_payment_events%rowtype;
 plan public.subscription_plan_versions%rowtype;intent public.subscription_payment_intents%rowtype;box_rule record;rule_count integer;
 starts timestamptz;ends timestamptz;expires timestamptz;snapshot jsonb;h text;
begin
 select*into source from private.resolve_subscription_credit_source_v1(p_organization_id,'subscription-payment:'||p_payment_event_id::text,false);
 if not found then raise exception'CREDIT_SUBSCRIPTION_PAYMENT_SOURCE_REQUIRED'using errcode='55000';end if;
 select*into c from public.subscription_cycles where id=source.subscription_cycle_id;
 select*into pay from public.subscription_payment_events where id=source.payment_event_id;
 select*into intent from public.subscription_payment_intents where id=pay.payment_intent_id;
 select*into plan from public.subscription_plan_versions where id=c.plan_version_id;
 if plan.id is null or plan.id is distinct from intent.plan_version_id or plan.monthly_credit_grant<=0 then raise exception'CREDIT_SUBSCRIPTION_PLAN_GRANT_REQUIRED'using errcode='55000';end if;
 if p_month_index is null or p_month_index<1 or p_month_index>(case when intent.billing_interval='ANNUAL'then 12 else 1 end)then raise exception'CREDIT_SUBSCRIPTION_GRANT_MONTH_INVALID'using errcode='22023';end if;
 starts:=c.period_start+make_interval(months=>p_month_index-1);
 ends:=least(c.period_end,c.period_start+make_interval(months=>p_month_index));
 select count(*)into rule_count from public.plan_box_rules r join public.box_versions b on b.id=r.box_version_id
 where r.plan_version_id=plan.id and r.status in('ACTIVE','RETIRED')and b.status in('ACTIVE','RETIRED')
  and r.created_at<=pay.paid_at and b.created_at<=pay.paid_at and r.effective_from<=pay.paid_at and(r.effective_to is null or r.effective_to>pay.paid_at)
  and b.effective_from<=pay.paid_at and(b.effective_to is null or b.effective_to>pay.paid_at);
 if rule_count<>1 then raise exception'CREDIT_SUBSCRIPTION_ROLLOVER_POLICY_REQUIRED'using errcode='55000';end if;
 select r.id,r.rule_snapshot,r.effective_from,r.effective_to,b.id box_version_id,b.rollover_months,b.content_hash box_content_hash
 into box_rule from public.plan_box_rules r join public.box_versions b on b.id=r.box_version_id
 where r.plan_version_id=plan.id and r.status in('ACTIVE','RETIRED')and b.status in('ACTIVE','RETIRED')
  and r.created_at<=pay.paid_at and b.created_at<=pay.paid_at and r.effective_from<=pay.paid_at and(r.effective_to is null or r.effective_to>pay.paid_at)
  and b.effective_from<=pay.paid_at and(b.effective_to is null or b.effective_to>pay.paid_at);
 expires:=ends+make_interval(months=>box_rule.rollover_months);
 snapshot:=source.source_snapshot||jsonb_build_object('plan_version_id',plan.id,'plan_content_hash',plan.content_hash,
  'grant_month_index',p_month_index,'grant_period_start',starts,'grant_period_end',ends,'quantity',plan.monthly_credit_grant::text,
  'expires_at',expires,'rollover_policy',to_jsonb(box_rule),'revenue_value_minor','0',
  'revenue_recognition','ALREADY_RECOGNIZED_IN_SUBSCRIPTION_LEDGER',
  'core_allocation_basis_points',plan.core_allocation_basis_points,'benefit_pool_allocation_basis_points',plan.benefit_pool_allocation_basis_points);
 h:=private.canonical_request_hash(snapshot);
 return snapshot||jsonb_build_object('source_reference','subscription-payment:'||pay.id::text||':month:'||p_month_index::text,
  'rule_version','SUBSCRIPTION_CREDIT_V1:'||h,'terms_hash',h);
end$$;
revoke all on function private.subscription_credit_grant_terms_v1(uuid,bigint,integer)from public,anon,authenticated,service_role;

-- Existing lots are not rewritten or reissued. Only an exact, unique source can
-- receive additive provenance. All other legacy lots retain SOURCE_UNVERIFIED.
insert into public.credit_lot_payment_sources_v1(credit_lot_id,organization_id,payment_event_id,subscription_cycle_id,source_snapshot,source_hash,resolution_method)
select l.id,l.organization_id,s.payment_event_id,s.subscription_cycle_id,s.source_snapshot,
 private.canonical_request_hash(s.source_snapshot),'EXACT_LEGACY_REFERENCE'
from public.credit_lots l cross join lateral private.resolve_subscription_credit_source_v1(l.organization_id,l.source_reference,true)s
where l.source_type='SUBSCRIPTION_GRANT';

create function private.bind_subscription_credit_payment_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
declare s record;h text;correlation uuid;terms jsonb;month_index integer;
begin
 if new.source_type<>'SUBSCRIPTION_GRANT'then return new;end if;
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_admin_access()then
  raise exception'CREDIT_SUBSCRIPTION_GRANT_DENIED'using errcode='42501';
 end if;
 if not exists(select 1 from public.organizations where id=new.organization_id and status='ACTIVE')then raise exception'CREDIT_SUBSCRIPTION_ORGANIZATION_NOT_ACTIVE'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.organization_id::text,0));
 select correlation_id into correlation from public.credit_ledger_entries
 where id=new.grant_entry_id and organization_id=new.organization_id and wallet_id=new.wallet_id
  and entry_type='GRANT'and quantity=new.quantity and reference_type=new.source_type and reference_id=new.source_reference;
 if not found then raise exception'CREDIT_SUBSCRIPTION_GRANT_SOURCE_MISMATCH'using errcode='23514';end if;
 select*into s from private.resolve_subscription_credit_source_v1(new.organization_id,new.source_reference,false);
 if not found then raise exception'CREDIT_SUBSCRIPTION_PAYMENT_SOURCE_REQUIRED'using errcode='55000';end if;
 if not private.subscription_payment_funding_environment_compatible_v1(s.payment_event_id)then
  raise exception'CREDIT_SUBSCRIPTION_PAYMENT_INCOMPATIBLE'using errcode='55000';
 end if;
 month_index:=coalesce(nullif(split_part(new.source_reference,':month:',2),'')::integer,1);
 terms:=private.subscription_credit_grant_terms_v1(new.organization_id,s.payment_event_id,month_index);
 if new.quantity is distinct from(terms->>'quantity')::bigint or new.revenue_value_minor<>0
  or new.rule_version is distinct from terms->>'rule_version'or new.expires_at is distinct from(terms->>'expires_at')::timestamptz
  or new.library_id is not null or new.currency is distinct from(terms->>'currency')::char(3)then
  raise exception'CREDIT_SUBSCRIPTION_GRANT_TERMS_MISMATCH'using errcode='23514';
 end if;
 if(terms->>'grant_period_start')::timestamptz>clock_timestamp()or(terms->>'expires_at')::timestamptz<=clock_timestamp()then raise exception'CREDIT_SUBSCRIPTION_GRANT_NOT_DUE'using errcode='55000';end if;
 -- Unattributed historical grants cannot silently authorize another installment.
 if exists(select 1 from public.credit_lot_payment_sources_v1 where payment_event_id=s.payment_event_id and resolution_method='EXACT_LEGACY_REFERENCE')then raise exception'CREDIT_SUBSCRIPTION_LEGACY_GRANT_REVIEW_REQUIRED'using errcode='55000';end if;
 if exists(select 1 from public.credit_lot_payment_sources_v1 where payment_event_id=s.payment_event_id and grant_month_index=month_index)then raise exception'CREDIT_SUBSCRIPTION_GRANT_ALREADY_ISSUED'using errcode='55000';end if;
 h:=private.canonical_request_hash(terms);
 insert into public.credit_lot_payment_sources_v1(credit_lot_id,organization_id,payment_event_id,subscription_cycle_id,source_snapshot,source_hash,resolution_method,grant_month_index,linked_by)
 values(new.id,new.organization_id,s.payment_event_id,s.subscription_cycle_id,terms,h,'CANONICAL_REFERENCE',month_index,auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(new.organization_id,auth.uid(),case when auth.uid()is null then'SERVICE'else'USER'end,
 'credit.subscription_payment_bound','credit_lot',new.id::text,correlation,jsonb_build_object('payment_event_id',s.payment_event_id::text,'subscription_cycle_id',s.subscription_cycle_id,'source_hash',h),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(new.organization_id,'credit_lot',new.id::text,'CreditLotPaymentBoundV1',correlation,jsonb_build_object('credit_lot_id',new.id,'payment_event_id',s.payment_event_id::text,'source_hash',h),'credit-lot-payment:'||new.id::text);
 return new;
end$$;
create trigger credit_lot_subscription_payment_binding after insert on public.credit_lots for each row execute function private.bind_subscription_credit_payment_v1();
revoke all on function private.bind_subscription_credit_payment_v1()from public,anon,authenticated,service_role;

create function private.prepare_subscription_credit_currency_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
declare s record;
begin
 if new.source_type='SUBSCRIPTION_GRANT'then
  select*into s from private.resolve_subscription_credit_source_v1(new.organization_id,new.source_reference,false);
  if found then new.currency:=(s.source_snapshot->>'currency')::char(3);end if;
 end if;
 return new;
end$$;
create trigger credit_lot_subscription_currency before insert on public.credit_lots for each row execute function private.prepare_subscription_credit_currency_v1();
revoke all on function private.prepare_subscription_credit_currency_v1()from public,anon,authenticated,service_role;

create function private.credit_lot_funding_status_v1(p_credit_lot_id uuid)returns text language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare l public.credit_lots%rowtype;s public.credit_lot_payment_sources_v1%rowtype;
begin
 select*into l from public.credit_lots where id=p_credit_lot_id;
 if not found then return'SOURCE_UNVERIFIED';end if;
 if l.source_type<>'SUBSCRIPTION_GRANT'then return'ELIGIBLE';end if;
 select*into s from public.credit_lot_payment_sources_v1 where credit_lot_id=l.id and organization_id=l.organization_id;
 if not found then return'SOURCE_UNVERIFIED';end if;
 -- A payment reference alone does not prove the old caller's quantity or grant
 -- policy. Preserve the traced source, require independent review of its terms.
 if s.resolution_method='EXACT_LEGACY_REFERENCE'then return'SOURCE_UNVERIFIED';end if;
 if not private.subscription_payment_funding_environment_compatible_v1(s.payment_event_id)then return'ENVIRONMENT_INCOMPATIBLE';end if;
 if exists(select 1 from public.subscription_financial_holds where payment_event_id=s.payment_event_id and active)then return'PAYMENT_HELD';end if;
 return'ELIGIBLE';
end$$;
revoke all on function private.credit_lot_funding_status_v1(uuid)from public,anon,authenticated,service_role;

create function private.guard_credit_lot_funding_movement_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
declare l public.credit_lots%rowtype;d public.benefit_redemptions%rowtype;
begin
 if new.movement_type in('RESERVE','CONSUME')then
  perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.organization_id::text,0));
 end if;
 select*into l from public.credit_lots where id=new.credit_lot_id;
 select*into d from public.benefit_redemptions where id=new.redemption_id;
 if l.id is null or d.id is null or l.organization_id is distinct from new.organization_id
  or d.organization_id is distinct from new.organization_id or l.wallet_id is distinct from d.wallet_id then
  raise exception'CREDIT_LOT_REDEMPTION_SCOPE_MISMATCH'using errcode='23514';
 end if;
 if new.movement_type in('RESERVE','CONSUME')and private.credit_lot_funding_status_v1(l.id)<>'ELIGIBLE'then
  raise exception'CREDIT_LOT_FUNDING_NOT_ADMISSIBLE'using errcode='55000';
 end if;
 return new;
end$$;
create trigger credit_lot_funding_movement_guard before insert on public.credit_lot_movements for each row execute function private.guard_credit_lot_funding_movement_v1();
revoke all on function private.guard_credit_lot_funding_movement_v1()from public,anon,authenticated,service_role;

-- Preserve the mature command, grants, idempotency, accounting and outbox. Filter
-- before FEFO allocation: an ineligible older lot must not hide an eligible gift.
do $$declare d text;needle text;
begin
 d:=pg_get_functiondef('public.reserve_benefit_credits(uuid,uuid,uuid,bigint,timestamptz,text,uuid)'::regprocedure);
 needle:='and(l.library_id is null or l.library_id=b.library_id)order by';
 if position(needle in d)=0 then raise exception'CREDIT_RESERVE_FUNDING_PATCH_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'and(l.library_id is null or l.library_id=b.library_id)and private.credit_lot_funding_status_v1(l.id)=''ELIGIBLE''order by');
 needle:='perform 1 from public.credit_wallets';
 if position(needle in d)=0 then raise exception'CREDIT_RESERVE_LOCK_PATCH_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'perform pg_advisory_xact_lock(hashtextextended(''subscription-financial:''||p_organization_id::text,0));perform 1 from public.credit_wallets');
 execute d;
 d:=pg_get_functiondef('public.issue_credits(uuid,uuid,text,bigint,timestamptz,uuid,text,bigint,text,text,text,uuid)'::regprocedure);
 needle:='if p_source_type not in';
 if position(needle in d)=0 then raise exception'CREDIT_ISSUE_FUNDING_PATCH_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'if p_source_type=''SUBSCRIPTION_GRANT''and auth.jwt()->>''aal''is distinct from''aal2''then raise exception''CREDIT_SUBSCRIPTION_GRANT_DENIED''using errcode=''42501'';end if;if p_source_type not in');
 needle:='select wallet_type into wallet_kind from public.credit_wallets';
 if position(needle in d)=0 then raise exception'CREDIT_ISSUE_LOCK_PATCH_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'perform pg_advisory_xact_lock(hashtextextended(''subscription-financial:''||p_organization_id::text,0));select wallet_type into wallet_kind from public.credit_wallets');
 execute d;
 -- The reward command is an existing caller of issue_credits and used to lock
 -- its wallet first. Acquire the same organization lock before that first lock.
 d:=pg_get_functiondef('public.award_reward(uuid,uuid,uuid,text,text,text,jsonb,text,text,uuid)'::regprocedure);
 needle:='expected_wallet:=case when';
 if position(needle in d)=0 then raise exception'REWARD_CREDIT_LOCK_PATCH_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'perform pg_advisory_xact_lock(hashtextextended(''subscription-financial:''||p_organization_id::text,0));expected_wallet:=case when');
 execute d;
 d:=pg_get_functiondef('public.consume_benefit_credits(uuid,text,text,uuid)'::regprocedure);
 needle:='  select * into d from public.benefit_redemptions where id = p_redemption_id for update;';
 if position(needle in d)=0 then raise exception'CREDIT_CONSUME_LOCK_PATCH_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'  perform pg_advisory_xact_lock(hashtextextended(''subscription-financial:''||r.organization_id::text,0))from public.benefit_redemptions r where r.id=p_redemption_id and private.credits_client_access(r.organization_id,a);'||chr(10)||needle);
 needle:='  for x in'||chr(10)||'    select credit_lot_id, quantity';
 if position(needle in d)=0 then raise exception'CREDIT_CONSUME_PROOF_PATCH_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'  if d.delivery_proof_hash is null or d.delivery_proof_hash is distinct from p_delivery_proof_hash then raise exception''BENEFIT_ACCEPTED_DELIVERY_PROOF_REQUIRED''using errcode=''55000'';end if;'||chr(10)||needle);
 execute d;
end$$;

create function public.get_subscription_credit_grant_context_v1(p_organization_id uuid,p_payment_event_id bigint,p_month_index integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare terms jsonb;wallet uuid;issued boolean;legacy boolean;blocked text[]:='{}';
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_admin_access()then raise exception'CREDIT_SUBSCRIPTION_GRANT_DENIED'using errcode='42501';end if;
 terms:=private.subscription_credit_grant_terms_v1(p_organization_id,p_payment_event_id,p_month_index);
 select id into wallet from public.credit_wallets where organization_id=p_organization_id and wallet_type='CLIENT';
 select exists(select 1 from public.credit_lot_payment_sources_v1 where payment_event_id=p_payment_event_id and grant_month_index=p_month_index),
 exists(select 1 from public.credit_lot_payment_sources_v1 where payment_event_id=p_payment_event_id and resolution_method='EXACT_LEGACY_REFERENCE')into issued,legacy;
 if wallet is null then blocked:=array_append(blocked,'CLIENT_WALLET_NOT_FOUND');end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and status='ACTIVE')then blocked:=array_append(blocked,'CREDIT_SUBSCRIPTION_ORGANIZATION_NOT_ACTIVE');end if;
 if issued then blocked:=array_append(blocked,'CREDIT_SUBSCRIPTION_GRANT_ALREADY_ISSUED');end if;
 if legacy then blocked:=array_append(blocked,'CREDIT_SUBSCRIPTION_LEGACY_GRANT_REVIEW_REQUIRED');end if;
 if not private.subscription_payment_funding_environment_compatible_v1(p_payment_event_id)then blocked:=array_append(blocked,'CREDIT_SUBSCRIPTION_PAYMENT_INCOMPATIBLE');end if;
 if(terms->>'grant_period_start')::timestamptz>clock_timestamp()or(terms->>'expires_at')::timestamptz<=clock_timestamp()then blocked:=array_append(blocked,'CREDIT_SUBSCRIPTION_GRANT_NOT_DUE');end if;
 if not private.subscription_financially_clear(p_organization_id)then blocked:=array_append(blocked,'SUBSCRIPTION_FINANCIAL_HOLD');end if;
 if not private.client_identity_allows_new_operations(p_organization_id)then blocked:=array_append(blocked,'CLIENT_IDENTITY_REVIEW_REQUIRED');end if;
 return jsonb_build_object('terms',terms,'wallet_id',wallet,'already_issued',issued,'legacy_review_required',legacy,'can_issue',cardinality(blocked)=0,'blocked_reasons',to_jsonb(blocked));
end$$;
create function public.issue_subscription_credit_grant_v1(p_organization_id uuid,p_payment_event_id bigint,p_month_index integer,p_expected_terms_hash text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare terms jsonb;wallet uuid;h text;result jsonb;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_admin_access()then raise exception'CREDIT_SUBSCRIPTION_GRANT_DENIED'using errcode='42501';end if;
 if p_expected_terms_hash is null or p_expected_terms_hash!~'^[0-9a-f]{64}$'or length(coalesce(p_idempotency_key,''))not between 8 and 180 then raise exception'INVALID_SUBSCRIPTION_CREDIT_GRANT_COMMAND'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 h:=private.canonical_request_hash(jsonb_build_object('organization_id',p_organization_id,'payment_event_id',p_payment_event_id::text,'month_index',p_month_index,'expected_terms_hash',p_expected_terms_hash));
 result:=private.begin_credit_command(p_organization_id,'credits.subscription.issue',p_idempotency_key,h,auth.uid());
 if result is not null then return result;end if;
 select id into wallet from public.credit_wallets where organization_id=p_organization_id and wallet_type='CLIENT'for update;
 if wallet is null then raise exception'CLIENT_WALLET_NOT_FOUND'using errcode='55000';end if;
 terms:=private.subscription_credit_grant_terms_v1(p_organization_id,p_payment_event_id,p_month_index);
 if terms->>'terms_hash'is distinct from p_expected_terms_hash then raise exception'STALE_SUBSCRIPTION_CREDIT_GRANT_TERMS'using errcode='40001';end if;
 result:=public.issue_credits(p_organization_id,wallet,'SUBSCRIPTION_GRANT',(terms->>'quantity')::bigint,(terms->>'expires_at')::timestamptz,
  null,terms->>'source_reference',0,terms->>'rule_version',null,p_idempotency_key||':lot',p_correlation_id);
 perform private.finish_credit_command(p_organization_id,'credits.subscription.issue',p_idempotency_key,result);
 return result;
end$$;
revoke all on function public.get_subscription_credit_grant_context_v1(uuid,bigint,integer),public.issue_subscription_credit_grant_v1(uuid,bigint,integer,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_subscription_credit_grant_context_v1(uuid,bigint,integer),public.issue_subscription_credit_grant_v1(uuid,bigint,integer,text,text,uuid)to authenticated;

create function public.list_credit_lot_funding_statuses_v1(p_organization_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare org uuid;result jsonb;
begin
 if auth.uid()is null or p_organization_ids is null or cardinality(p_organization_ids)>50 then raise exception'CREDIT_FUNDING_READ_DENIED'using errcode='42501';end if;
 foreach org in array p_organization_ids loop
  if org is null or not(private.credits_client_access(org)or private.credits_admin_access())then raise exception'CREDIT_FUNDING_READ_DENIED'using errcode='42501';end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('credit_lot_id',l.id,'status',private.credit_lot_funding_status_v1(l.id))order by l.id),'[]'::jsonb)into result
 from public.credit_lots l where l.organization_id=any(p_organization_ids);
 return result;
end$$;
revoke all on function public.list_credit_lot_funding_statuses_v1(uuid[])from public,anon,authenticated,service_role;
grant execute on function public.list_credit_lot_funding_statuses_v1(uuid[])to authenticated;
notify pgrst,'reload schema';
commit;
