begin;
-- A credit refund reverses one consumed benefit, not the underlying payment.
-- Commercial eligibility is explicitly proposed and independently approved;
-- no duration, eligibility policy, cash payout or expiration extension is seeded.
create table public.benefit_refund_policies_v1(
 id uuid primary key default extensions.gen_random_uuid(),benefit_version_id uuid not null references public.benefit_versions(id),
 version integer not null check(version>0),refund_window_seconds bigint not null check(refund_window_seconds between 1 and 315360000),
 expiry_treatment text not null check(expiry_treatment='PRESERVE_ORIGINAL_DENY_EXPIRED'),
 effective_from timestamptz not null,effective_until timestamptz,reference text not null check(length(btrim(reference))between 10 and 1000),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 unique(benefit_version_id,version),check(effective_until is null or effective_until>effective_from)
);
create table public.benefit_refund_policy_decisions_v1(
 policy_id uuid primary key references public.benefit_refund_policies_v1(id),approved boolean not null,content_hash text not null,
 reason text not null check(length(btrim(reason))between 10 and 2000),decided_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table public.benefit_refund_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 redemption_id uuid not null references public.benefit_redemptions(id),policy_id uuid not null references public.benefit_refund_policies_v1(id),
 reason text not null check(length(btrim(reason))between 10 and 2000),source_snapshot jsonb not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table public.benefit_refund_decisions_v1(
 request_id uuid primary key references public.benefit_refund_requests_v1(id),approved boolean not null,content_hash text not null,
 reason text not null check(length(btrim(reason))between 10 and 2000),decided_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table public.benefit_refund_executions_v1(
 redemption_id uuid primary key references public.benefit_redemptions(id),request_id uuid not null unique references public.benefit_refund_requests_v1(id),
 organization_id uuid not null references public.organizations(id),refund_entry_id bigint not null unique references public.credit_ledger_entries(id),
 quantity bigint not null check(quantity>0),reversed_allocation_ids uuid[] not null,source_hash text not null,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null
);
-- Transient, private authority is scoped to this backend, transaction, actor,
-- exact immutable request and command. It is never a credit or financial ledger.
create table private.benefit_refund_write_capabilities_v1(
 backend_pid integer not null,transaction_id bigint not null,redemption_id uuid not null references public.benefit_redemptions(id),
 request_id uuid not null references public.benefit_refund_requests_v1(id),actor_id uuid not null references auth.users(id),
 content_hash text not null,idempotency_key text not null,correlation_id uuid not null,
 primary key(backend_pid,transaction_id,redemption_id)
);
alter table private.benefit_refund_write_capabilities_v1 enable row level security;
revoke all on private.benefit_refund_write_capabilities_v1 from public,anon,authenticated,service_role;
do $$declare t text;begin foreach t in array array['benefit_refund_policies_v1','benefit_refund_policy_decisions_v1','benefit_refund_requests_v1','benefit_refund_decisions_v1','benefit_refund_executions_v1']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',left(t,44)||'_immutable',t);
end loop;end$$;
-- Browser readers receive only the request envelope. In particular, a Buyer
-- cannot select the stored accounting snapshot through their own request row.
revoke select on public.benefit_refund_requests_v1 from authenticated;
grant select(id,organization_id,redemption_id,policy_id,reason,content_hash,created_by,created_at)on public.benefit_refund_requests_v1 to authenticated;
create policy benefit_refund_policy_read on public.benefit_refund_policies_v1 for select to authenticated using(private.credit_revenue_finance_access_v1()or exists(select 1 from public.benefit_redemptions r where r.benefit_version_id=benefit_refund_policies_v1.benefit_version_id and private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'])));
create policy benefit_refund_policy_decision_read on public.benefit_refund_policy_decisions_v1 for select to authenticated using(exists(select 1 from public.benefit_refund_policies_v1 p where p.id=policy_id));
create policy benefit_refund_request_read on public.benefit_refund_requests_v1 for select to authenticated using(private.credit_revenue_finance_access_v1()or private.has_org_role(organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'])or(created_by=auth.uid()and private.has_org_role(organization_id,array['CLIENT_BUYER'])));
create policy benefit_refund_decision_read on public.benefit_refund_decisions_v1 for select to authenticated using(exists(select 1 from public.benefit_refund_requests_v1 r where r.id=request_id));
create policy benefit_refund_execution_read on public.benefit_refund_executions_v1 for select to authenticated using(private.credit_revenue_finance_access_v1()or private.has_org_role(organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'])or exists(select 1 from public.benefit_refund_requests_v1 q where q.id=request_id));
create unique index credit_economic_one_reversal_v1 on public.credit_economic_allocations_v1(reverses_allocation_id)where reverses_allocation_id is not null;
alter table public.credit_ledger_entries drop constraint credit_ledger_entries_entry_type_check;
alter table public.credit_ledger_entries add constraint credit_ledger_entries_entry_type_check check(entry_type in('GRANT','RESERVE','RELEASE','CONSUME','EXPIRE','ADJUSTMENT','REFUND'));
-- REFUND is new to this credit ABI. Preserve all existing entry directions;
-- only the governed benefit return may carry a positive REFUND quantity.
alter table public.credit_ledger_entries drop constraint credit_entry_sign_check;
alter table public.credit_ledger_entries add constraint credit_entry_sign_check check(
 (entry_type in('GRANT','RELEASE')and quantity>0)
 or(entry_type in('RESERVE','CONSUME','EXPIRE')and quantity<0)
 or(entry_type='ADJUSTMENT'and quantity<>0)
 or(entry_type='REFUND'and quantity>0 and reference_type='BENEFIT_REDEMPTION'and idempotency_scope='benefit.refund.execute')
);
alter table public.credit_lot_movements drop constraint credit_lot_movements_movement_type_check;
alter table public.credit_lot_movements add constraint credit_lot_movements_movement_type_check check(movement_type in('RESERVE','RELEASE','CONSUME','REFUND'));

create function private.guard_benefit_refund_write_v1()returns trigger language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare redemption uuid;cap private.benefit_refund_write_capabilities_v1%rowtype;r public.benefit_redemptions%rowtype;begin
 if tg_table_name='credit_lot_movements'then
  if new.movement_type<>'REFUND'then return new;end if;redemption:=new.redemption_id;
 else
  if new.entry_type<>'REFUND'then return new;end if;
  if new.reference_type<>'BENEFIT_REDEMPTION'or new.reference_id!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then raise exception'CANONICAL_BENEFIT_REFUND_WRITE_REQUIRED'using errcode='42501';end if;redemption:=new.reference_id::uuid;
 end if;
 select*into cap from private.benefit_refund_write_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and redemption_id=redemption;
 select*into r from public.benefit_redemptions where id=redemption;
 if cap.redemption_id is null or cap.actor_id is distinct from auth.uid()or not coalesce(private.credit_revenue_finance_access_v1(auth.uid(),true),false)
  or r.status<>'CONSUMED'or new.organization_id is distinct from r.organization_id or new.created_by is distinct from cap.actor_id
  or new.idempotency_scope is distinct from'benefit.refund.execute'or new.idempotency_key is distinct from cap.idempotency_key or new.correlation_id is distinct from cap.correlation_id
  or not exists(select 1 from public.benefit_refund_requests_v1 q where q.id=cap.request_id and q.redemption_id=r.id and q.organization_id=r.organization_id and q.created_by<>cap.actor_id and q.content_hash=cap.content_hash)
 then raise exception'CANONICAL_BENEFIT_REFUND_WRITE_REQUIRED'using errcode='42501';end if;
 if tg_table_name='credit_lot_movements'then
  if not exists(select 1 from public.credit_lot_movements m where m.redemption_id=r.id and m.organization_id=r.organization_id and m.credit_lot_id=new.credit_lot_id and m.movement_type='CONSUME'and m.quantity=new.quantity)then raise exception'CANONICAL_BENEFIT_REFUND_WRITE_REQUIRED'using errcode='42501';end if;
 elsif new.wallet_id is distinct from r.wallet_id or new.quantity is distinct from r.reserved_credits or new.execution_actor_type is distinct from'USER'then raise exception'CANONICAL_BENEFIT_REFUND_WRITE_REQUIRED'using errcode='42501';end if;
 return new;
end$$;
create trigger benefit_refund_movement_source_guard_v1 before insert on public.credit_lot_movements for each row execute function private.guard_benefit_refund_write_v1();
create trigger benefit_refund_ledger_source_guard_v1 before insert on public.credit_ledger_entries for each row execute function private.guard_benefit_refund_write_v1();

create function private.benefit_refund_client_access_v1(p_org uuid,p_redemption uuid default null)returns boolean language sql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
 select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and(private.has_org_role(p_org,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'])or(private.has_org_role(p_org,array['CLIENT_BUYER'])and exists(select 1 from public.benefit_redemptions r join public.customer_box_redemption_allocations_v1 a on a.redemption_id=r.id and a.organization_id=r.organization_id where r.id=p_redemption and r.organization_id=p_org and r.created_by=auth.uid())))
 and exists(select 1 from auth.users where id=auth.uid()and deleted_at is null and(banned_until is null or banned_until<=statement_timestamp()))
$$;
create function private.benefit_refund_policy_v1(p_benefit uuid)returns public.benefit_refund_policies_v1 language sql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
 select p from public.benefit_refund_policies_v1 p join public.benefit_refund_policy_decisions_v1 d on d.policy_id=p.id and d.approved and d.content_hash=p.content_hash and d.decided_by<>p.created_by
 where p.benefit_version_id=p_benefit and p.effective_from<=statement_timestamp()and(p.effective_until is null or p.effective_until>statement_timestamp())order by p.version desc limit 1
$$;
create function private.record_benefit_refund_event_v1(p_org uuid,p_id uuid,p_event text,p_payload jsonb,p_key text,p_correlation uuid)returns void language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$begin
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_org,auth.uid(),'USER',p_event,'benefit_refund',p_id::text,p_correlation,p_payload,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_org,'benefit_refund',p_id::text,p_event,p_correlation,p_payload,p_key);
end$$;
create function public.propose_benefit_refund_policy_v1(p_benefit_version_id uuid,p_refund_window_seconds bigint,p_expiry_treatment text,p_effective_from timestamptz,p_effective_until timestamptz,p_reference text)returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare x uuid;v integer;s jsonb;h text;begin
 if not coalesce(private.credit_revenue_finance_access_v1(auth.uid(),true),false)then raise exception'BENEFIT_REFUND_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 perform private.lock_credit_revenue_finance_actor_v1();
 if p_refund_window_seconds is null or p_refund_window_seconds not between 1 and 315360000 or p_expiry_treatment is distinct from'PRESERVE_ORIGINAL_DENY_EXPIRED'or p_effective_from is null or p_effective_until<=p_effective_from or length(btrim(coalesce(p_reference,'')))not between 10 and 1000 or not exists(select 1 from public.benefit_versions where id=p_benefit_version_id)then raise exception'INVALID_BENEFIT_REFUND_POLICY'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('benefit-refund-policy:'||p_benefit_version_id::text,0));
 select coalesce(max(version),0)+1 into v from public.benefit_refund_policies_v1 where benefit_version_id=p_benefit_version_id;
 s:=jsonb_build_object('benefit',p_benefit_version_id,'version',v,'window_seconds',p_refund_window_seconds::text,'expiry_treatment',p_expiry_treatment,'effective_from',p_effective_from,'effective_until',p_effective_until,'reference',btrim(p_reference));h:=private.canonical_request_hash(s);
 insert into public.benefit_refund_policies_v1(benefit_version_id,version,refund_window_seconds,expiry_treatment,effective_from,effective_until,reference,content_hash,created_by)values(p_benefit_version_id,v,p_refund_window_seconds,p_expiry_treatment,p_effective_from,p_effective_until,btrim(p_reference),h,auth.uid())returning id into x;
 perform private.record_benefit_refund_event_v1(null,x,'BenefitRefundPolicyProposedV1',jsonb_build_object('policy_id',x,'content_hash',h),'benefit-refund-policy:'||x::text,extensions.gen_random_uuid());
 return jsonb_build_object('outcome','BENEFIT_REFUND_POLICY_PROPOSED','policy_id',x,'content_hash',h);
end$$;
create function public.decide_benefit_refund_policy_v1(p_policy_id uuid,p_expected_hash text,p_approve boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare p public.benefit_refund_policies_v1%rowtype;begin
 if not coalesce(private.credit_revenue_finance_access_v1(auth.uid(),true),false)then raise exception'BENEFIT_REFUND_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 perform private.lock_credit_revenue_finance_actor_v1();select*into p from public.benefit_refund_policies_v1 where id=p_policy_id for update;
 if p.id is null or p.created_by=auth.uid()then raise exception'INDEPENDENT_BENEFIT_REFUND_POLICY_REVIEW_REQUIRED'using errcode='42501';end if;
 if p.content_hash is distinct from p_expected_hash then raise exception'STALE_BENEFIT_REFUND_POLICY'using errcode='40001';end if;
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_REFUND_REVIEW'using errcode='22023';end if;
 insert into public.benefit_refund_policy_decisions_v1(policy_id,approved,content_hash,reason,decided_by)values(p.id,p_approve,p.content_hash,btrim(p_reason),auth.uid());
 perform private.record_benefit_refund_event_v1(null,p.id,'BenefitRefundPolicyDecidedV1',jsonb_build_object('policy_id',p.id,'approved',p_approve,'content_hash',p.content_hash),'benefit-refund-policy-review:'||p.id::text,extensions.gen_random_uuid());
 return jsonb_build_object('outcome','BENEFIT_REFUND_POLICY_DECIDED','policy_id',p.id,'approved',p_approve);
end$$;

create function private.benefit_refund_source_v1(p_redemption uuid)returns jsonb language sql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
 select jsonb_build_object('redemption',to_jsonb(r),'consumptions',coalesce((select jsonb_agg(jsonb_build_object('movement',to_jsonb(m),'lot',to_jsonb(l),'funding_status',private.credit_lot_funding_status_v1(l.id),'fact',to_jsonb(f))order by m.id)from public.credit_lot_movements m join public.credit_lots l on l.id=m.credit_lot_id left join public.credit_economic_consumption_facts_v1 f on f.movement_id=m.id where m.redemption_id=r.id and m.organization_id=r.organization_id and m.movement_type='CONSUME'),'[]'::jsonb),
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('allocation',to_jsonb(a),'pnl_entry',to_jsonb(p))order by a.id)from public.credit_economic_consumption_facts_v1 f join public.credit_economic_allocations_v1 a on a.consumption_fact_id=f.id left join private.credit_economic_pnl_sources_v1 s on s.allocation_id=a.id left join public.franchise_pnl_entries p on p.id=s.pnl_entry_id where f.redemption_id=r.id),'[]'::jsonb))
 from public.benefit_redemptions r where r.id=p_redemption
$$;
create function public.request_benefit_refund_v1(p_organization_id uuid,p_redemption_id uuid,p_expected_row_version bigint,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare r public.benefit_redemptions%rowtype;p public.benefit_refund_policies_v1%rowtype;s jsonb;h text;result jsonb;x uuid;begin
 select*into r from public.benefit_redemptions where id=p_redemption_id and organization_id=p_organization_id;
 if r.id is null or not coalesce(private.benefit_refund_client_access_v1(r.organization_id,r.id),false)then raise exception'BENEFIT_REFUND_REQUEST_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||r.organization_id::text,0));perform id from public.credit_wallets where id=r.wallet_id for update;
 select*into r from public.benefit_redemptions where id=p_redemption_id for update;
 if not coalesce(private.benefit_refund_client_access_v1(r.organization_id,r.id),false)then raise exception'BENEFIT_REFUND_REQUEST_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('redemption',r.id,'version',p_expected_row_version,'reason',p_reason,'actor',auth.uid()));result:=private.begin_credit_command(r.organization_id,'benefit.refund.request',p_idempotency_key,h,auth.uid());if result is not null then return result;end if;
 if r.row_version is distinct from p_expected_row_version then raise exception'STALE_BENEFIT_REFUND_SOURCE'using errcode='40001';end if;
 if r.status<>'CONSUMED'then raise exception'CONSUMED_BENEFIT_REFUND_REQUIRED'using errcode='55000';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_REFUND_REASON'using errcode='22023';end if;
 p:=private.benefit_refund_policy_v1(r.benefit_version_id);
 if p.id is null then raise exception'APPROVED_BENEFIT_REFUND_POLICY_REQUIRED'using errcode='55000';end if;
 if not exists(select 1 from public.benefit_redemption_events e where e.redemption_id=r.id and e.to_status='CONSUMED'and e.occurred_at+make_interval(secs=>p.refund_window_seconds::double precision)>clock_timestamp())then raise exception'BENEFIT_REFUND_WINDOW_ELAPSED'using errcode='55000';end if;
 if exists(select 1 from public.credit_lot_movements m join public.credit_lots l on l.id=m.credit_lot_id where m.redemption_id=r.id and m.movement_type='CONSUME'and l.expires_at<=clock_timestamp())then raise exception'BENEFIT_REFUND_ORIGINAL_LOT_EXPIRED'using errcode='55000';end if;
 s:=private.benefit_refund_source_v1(r.id);h:=private.canonical_request_hash(jsonb_build_object('source',s,'policy_id',p.id,'policy_hash',p.content_hash,'reason',btrim(p_reason),'requester',auth.uid()));
 insert into public.benefit_refund_requests_v1(organization_id,redemption_id,policy_id,reason,source_snapshot,source_hash,content_hash,created_by)values(r.organization_id,r.id,p.id,btrim(p_reason),s,private.canonical_request_hash(s),h,auth.uid())returning id into x;
 result:=jsonb_build_object('outcome','BENEFIT_REFUND_REQUESTED','request_id',x,'redemption_id',r.id,'content_hash',h);
 perform private.record_benefit_refund_event_v1(r.organization_id,x,'BenefitRefundRequestedV1',result,p_idempotency_key,extensions.gen_random_uuid());
 perform private.finish_credit_command(r.organization_id,'benefit.refund.request',p_idempotency_key,result);return result;
end$$;

-- Reverse exactly the immutable allocation and its original book entry. The
-- legal payment journal remains the source: a credit return is not a cash refund.
create function private.reverse_benefit_economic_allocation_v1(p_allocation uuid,p_request uuid,p_correlation uuid)returns uuid language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare a public.credit_economic_allocations_v1%rowtype;original public.franchise_pnl_entries%rowtype;funding public.credit_economic_funding_sources_v1%rowtype;x uuid:=extensions.gen_random_uuid();pnl uuid:=extensions.gen_random_uuid();s jsonb;h text;begin
 select*into a from public.credit_economic_allocations_v1 where id=p_allocation;
 if a.id is null or a.allocation_kind='REVERSAL'or exists(select 1 from public.credit_economic_allocations_v1 where reverses_allocation_id=a.id)then raise exception'BENEFIT_REFUND_ALLOCATION_NOT_REVERSIBLE'using errcode='55000';end if;
 select e.*into original from private.credit_economic_pnl_sources_v1 source join public.franchise_pnl_entries e on e.id=source.pnl_entry_id where source.allocation_id=a.id;
 select*into funding from public.credit_economic_funding_sources_v1 where id=a.funding_source_id;
 if original.id is null or original.effect_type<>'REVENUE'or original.amount_minor<>a.amount_minor or original.book_id<>a.book_id or original.currency<>a.currency or original.source_id<>a.id::text or original.financial_journal_id<>funding.financial_journal_id or exists(select 1 from public.franchise_pnl_entries where reverses_entry_id=original.id)or a.content_hash<>private.canonical_request_hash(a.allocation_snapshot)then raise exception'BENEFIT_REFUND_ECONOMIC_SOURCE_MISMATCH'using errcode='23514';end if;
 perform id from public.franchise_pnl_books where id=a.book_id and status='OPEN'for update;if not found then raise exception'BENEFIT_REFUND_ORIGINAL_BOOK_CLOSED'using errcode='55000';end if;
 s:=jsonb_build_object('request_id',p_request,'original_allocation',to_jsonb(a),'original_pnl_entry',to_jsonb(original),'effective_on',current_date);h:=private.canonical_request_hash(s);
 insert into public.credit_economic_allocations_v1(id,funding_source_id,classification_id,consumption_fact_id,allocation_policy_id,book_route_policy_id,library_id,book_id,allocation_kind,amount_minor,currency,source_id,reverses_allocation_id,allocation_snapshot,content_hash,created_by,correlation_id)
 values(x,a.funding_source_id,a.classification_id,a.consumption_fact_id,a.allocation_policy_id,a.book_route_policy_id,a.library_id,a.book_id,'REVERSAL',a.amount_minor,a.currency,p_request::text||':'||a.id::text,a.id,s,h,auth.uid(),p_correlation);
 insert into public.credit_revenue_ledger_v1(funding_source_id,classification_id,allocation_id,entry_type,revenue_class,amount_minor,currency,source_key,source_hash,correlation_id)values
 (a.funding_source_id,a.classification_id,x,'REVERSE','LIBRARY_ALLOCATED_REVENUE',-a.amount_minor,a.currency,x::text,h,p_correlation),
 (a.funding_source_id,a.classification_id,x,'REVERSE',case a.allocation_kind when'PURCHASE_CONSUMPTION'then'UNALLOCATED_CREDIT_REVENUE'else'BENEFIT_POOL_REVENUE'end,a.amount_minor,a.currency,x::text,h,p_correlation);
 insert into private.credit_economic_pnl_write_capabilities_v1(backend_pid,transaction_id,allocation_id)values(pg_backend_pid(),txid_current(),x);
 insert into public.franchise_pnl_entries(id,book_id,effect_type,category,amount_minor,currency,financial_journal_id,source_type,source_id,effective_on,reason,reverses_entry_id,correlation_id,created_by)
 values(pnl,a.book_id,'REVERSAL_REVENUE','COLLECTED_NET_REVENUE',a.amount_minor,a.currency,funding.financial_journal_id,'CREDIT_ECONOMIC_ALLOCATION_V1',x::text,current_date,'Approved independent consumed-benefit credit refund',original.id,p_correlation,auth.uid());
 delete from private.credit_economic_pnl_write_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and allocation_id=x;
 insert into private.credit_economic_pnl_sources_v1(allocation_id,pnl_entry_id)values(x,pnl);return x;
end$$;

create function public.decide_benefit_refund_v1(p_request_id uuid,p_expected_hash text,p_approve boolean,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare q public.benefit_refund_requests_v1%rowtype;r public.benefit_redemptions%rowtype;p public.benefit_refund_policies_v1%rowtype;result jsonb;h text;x record;entry bigint;reversals uuid[]:='{}';correlation uuid:=extensions.gen_random_uuid();begin
 if not coalesce(private.credit_revenue_finance_access_v1(auth.uid(),true),false)then raise exception'BENEFIT_REFUND_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 select*into q from public.benefit_refund_requests_v1 where id=p_request_id;
 if q.id is null or q.created_by=auth.uid()then raise exception'INDEPENDENT_BENEFIT_REFUND_REVIEW_REQUIRED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||q.organization_id::text,0));
 select*into r from public.benefit_redemptions where id=q.redemption_id;perform id from public.credit_wallets where id=r.wallet_id for update;
 select*into r from public.benefit_redemptions where id=q.redemption_id for update;
 for x in select distinct funding_source_id id from public.credit_economic_consumption_facts_v1 where redemption_id=r.id and funding_source_id is not null order by funding_source_id loop perform pg_advisory_xact_lock(hashtextextended('credit-economic-funding:'||x.id::text,0));end loop;
 perform private.lock_credit_revenue_finance_actor_v1();
 h:=private.canonical_request_hash(jsonb_build_object('request_id',q.id,'hash',p_expected_hash,'approved',p_approve,'reason',p_reason,'reviewer',auth.uid()));result:=private.begin_credit_command(q.organization_id,'benefit.refund.decide',p_idempotency_key,h,auth.uid());if result is not null then return result;end if;
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_REFUND_REVIEW'using errcode='22023';end if;
 if q.content_hash is distinct from p_expected_hash or q.source_hash<>private.canonical_request_hash(q.source_snapshot)or(p_approve and q.source_hash is distinct from private.canonical_request_hash(private.benefit_refund_source_v1(r.id)))then raise exception'STALE_BENEFIT_REFUND_SOURCE'using errcode='40001';end if;
 if p_approve and(r.status<>'CONSUMED'or exists(select 1 from public.benefit_refund_executions_v1 where redemption_id=r.id))then raise exception'CONSUMED_BENEFIT_REFUND_REQUIRED'using errcode='55000';end if;
 select*into p from public.benefit_refund_policies_v1 where id=q.policy_id;
 if p_approve then
  if not exists(select 1 from public.benefit_refund_policy_decisions_v1 d where d.policy_id=p.id and d.approved and d.decided_by<>p.created_by and d.content_hash=p.content_hash)or p.effective_from>q.created_at or p.effective_until<=q.created_at then raise exception'APPROVED_BENEFIT_REFUND_POLICY_REQUIRED'using errcode='55000';end if;
  if not exists(select 1 from public.benefit_redemption_events e where e.redemption_id=r.id and e.to_status='CONSUMED'and e.occurred_at+make_interval(secs=>p.refund_window_seconds::double precision)>clock_timestamp())then raise exception'BENEFIT_REFUND_WINDOW_ELAPSED'using errcode='55000';end if;
  if(select coalesce(sum(quantity),0)from public.credit_lot_movements where redemption_id=r.id and organization_id=r.organization_id and movement_type='CONSUME')<>r.reserved_credits then raise exception'BENEFIT_REFUND_QUANTITY_MISMATCH'using errcode='23514';end if;
  insert into private.benefit_refund_write_capabilities_v1(backend_pid,transaction_id,redemption_id,request_id,actor_id,content_hash,idempotency_key,correlation_id)values(pg_backend_pid(),txid_current(),r.id,q.id,auth.uid(),q.content_hash,p_idempotency_key,correlation);
  for x in select m.*,l.expires_at,l.wallet_id,private.credit_lot_funding_status_v1(l.id)funding_status,f.id fact_id,f.source_hash,f.source_snapshot from public.credit_lot_movements m join public.credit_lots l on l.id=m.credit_lot_id and l.organization_id=m.organization_id left join public.credit_economic_consumption_facts_v1 f on f.movement_id=m.id where m.redemption_id=r.id and m.organization_id=r.organization_id and m.movement_type='CONSUME'order by m.credit_lot_id loop
   if x.expires_at<=clock_timestamp()then raise exception'BENEFIT_REFUND_ORIGINAL_LOT_EXPIRED'using errcode='55000';end if;
   if x.wallet_id<>r.wallet_id or x.funding_status<>'ELIGIBLE'or x.fact_id is null or x.source_hash<>private.canonical_request_hash(x.source_snapshot)then raise exception'BENEFIT_REFUND_FUNDING_SOURCE_REQUIRED'using errcode='55000';end if;
   insert into public.credit_lot_movements(organization_id,credit_lot_id,redemption_id,movement_type,quantity,idempotency_scope,idempotency_key,correlation_id,created_by)values(r.organization_id,x.credit_lot_id,r.id,'REFUND',x.quantity,'benefit.refund.execute',p_idempotency_key,correlation,auth.uid());
  end loop;
  for x in select a.id from public.credit_economic_allocations_v1 a join public.credit_economic_consumption_facts_v1 f on f.id=a.consumption_fact_id where f.redemption_id=r.id and a.allocation_kind<>'REVERSAL'order by a.id loop reversals:=array_append(reversals,private.reverse_benefit_economic_allocation_v1(x.id,q.id,correlation));end loop;
  -- Aggregated pool allocations cannot be guessed into per-benefit reversals.
  if exists(select 1 from public.credit_economic_allocations_v1 a where a.allocation_kind='SUBSCRIPTION_POOL'and a.consumption_fact_id is null and a.funding_source_id in(select funding_source_id from public.credit_economic_consumption_facts_v1 where redemption_id=r.id))then raise exception'BENEFIT_REFUND_POOL_ATTRIBUTION_REQUIRED'using errcode='55000';end if;
  insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)values(r.organization_id,r.wallet_id,'REFUND',r.reserved_credits,'benefit.refund.execute',p_idempotency_key,correlation,'BENEFIT_REDEMPTION',r.id::text,auth.uid())returning id into entry;
  insert into public.benefit_refund_executions_v1(redemption_id,request_id,organization_id,refund_entry_id,quantity,reversed_allocation_ids,source_hash,created_by,correlation_id)values(r.id,q.id,r.organization_id,entry,r.reserved_credits,reversals,q.source_hash,auth.uid(),correlation);
  update public.benefit_redemptions set status='REFUNDED',row_version=row_version+1,updated_at=clock_timestamp()where id=r.id;
  insert into public.benefit_redemption_events(organization_id,redemption_id,from_status,to_status,reason_code,proof_hash,idempotency_key,correlation_id,actor_user_id)values(r.organization_id,r.id,'CONSUMED','REFUNDED','INDEPENDENT_FINANCE_APPROVED',q.content_hash,p_idempotency_key,correlation,auth.uid());
 end if;
 insert into public.benefit_refund_decisions_v1(request_id,approved,content_hash,reason,decided_by)values(q.id,p_approve,q.content_hash,btrim(p_reason),auth.uid());
 delete from private.benefit_refund_write_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and redemption_id=r.id;
 result:=jsonb_build_object('outcome',case when p_approve then'BENEFIT_REFUNDED'else'BENEFIT_REFUND_REJECTED'end,'request_id',q.id,'redemption_id',r.id,'refund_entry_id',entry,'quantity',case when p_approve then r.reserved_credits::text else'0'end,'reversed_allocation_ids',reversals);
 perform private.record_benefit_refund_event_v1(r.organization_id,q.id,case when p_approve then'BenefitRefundedV1'else'BenefitRefundRejectedV1'end,result,p_idempotency_key,correlation);
 perform private.finish_credit_command(r.organization_id,'benefit.refund.decide',p_idempotency_key,result);return result;
end$$;

-- FEFO and expiry keep the original lot. REFUND frees the quantity originally
-- withheld by RESERVE; CONSUME remains immutable and is never erased.
do $$declare f record;d text;n integer:=0;needle text;begin
 for f in select p.oid from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname in('public','private')and p.prokind='f'and p.prosrc like'%credit_lot_movements%'loop
  d:=pg_get_functiondef(f.oid);
  needle:='when m.movement_type=''RELEASE''then-m.quantity';
  if strpos(d,needle)>0 then d:=replace(d,needle,'when m.movement_type in(''RELEASE'',''REFUND'')then-m.quantity');n:=n+1;end if;
  needle:='when''RELEASE''then-m.quantity';
  if strpos(d,needle)>0 then d:=replace(d,needle,'when''RELEASE''then-m.quantity when''REFUND''then-m.quantity');n:=n+1;end if;
  if d<>pg_get_functiondef(f.oid)then execute d;end if;
 end loop;
 if n<3 then raise exception'BENEFIT_REFUND_LOT_AVAILABILITY_SOURCE_CONTRACT_MISMATCH';end if;
end$$;
create or replace view public.client_credit_lot_positions_v1 with(security_invoker=true)as
select l.id,l.organization_id,l.wallet_id,l.source_type,l.quantity::text as quantity,l.expires_at,l.library_id,
 (l.quantity-coalesce(sum(case when m.movement_type='RESERVE'then m.quantity when m.movement_type in('RELEASE','REFUND')then-m.quantity else 0 end),0))::text as available,
 coalesce(sum(case when m.movement_type='RESERVE'then m.quantity when m.movement_type in('RELEASE','CONSUME')then-m.quantity else 0 end),0)::text as reserved
from public.credit_lots l left join public.credit_lot_movements m on m.credit_lot_id=l.id and m.organization_id=l.organization_id group by l.id;

-- Re-spending returned credits must not count the original, reversed consumption
-- twice. Existing allocations are replayed verbatim; new allocations recognize
-- the remaining exact funded amount, with the same cumulative-floor convention.
create function private.credit_economic_refund_aware_amount_v1(p_fact uuid,p_classification uuid)returns bigint language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare f public.credit_economic_consumption_facts_v1%rowtype;l public.credit_lots%rowtype;c public.credit_economic_classifications_v1%rowtype;qty numeric;recognized numeric;available numeric;begin
 select*into f from public.credit_economic_consumption_facts_v1 where id=p_fact;select*into l from public.credit_lots where id=f.credit_lot_id;select*into c from public.credit_economic_classifications_v1 where id=p_classification;
 select coalesce(sum(case when movement_type='CONSUME'then quantity when movement_type='REFUND'then-quantity else 0 end),0)into qty from public.credit_lot_movements where credit_lot_id=l.id and id<=f.movement_id;
 select coalesce(sum(case when a.allocation_kind='REVERSAL'then-a.amount_minor else a.amount_minor end),0)into recognized from public.credit_economic_allocations_v1 a join public.credit_economic_consumption_facts_v1 fact on fact.id=a.consumption_fact_id where fact.credit_lot_id=l.id;
 select coalesce(sum(amount_minor),0)into available from public.credit_revenue_ledger_v1 where funding_source_id=f.funding_source_id and revenue_class='UNALLOCATED_CREDIT_REVENUE';
 return greatest(0,least(available,floor(c.unallocated_credit_minor::numeric*qty/l.quantity)-recognized))::bigint;
end$$;
do $$declare d text;needle text;replacement text;begin
 select pg_get_functiondef('private.allocate_credit_economic_consumption_v1(uuid,uuid)'::regprocedure)into d;
 needle:=' if fact.source_hash<>private.canonical_request_hash(fact.source_snapshot)then raise exception''CREDIT_CONSUMPTION_SOURCE_HASH_MISMATCH''using errcode=''23514'';end if;';
 if strpos(d,needle)=0 then raise exception'BENEFIT_REFUND_ECONOMIC_REPLAY_SOURCE_CONTRACT_MISMATCH';end if;
 replacement:=needle||chr(10)||' if exists(select 1 from public.credit_lot_movements m where m.credit_lot_id=fact.credit_lot_id and m.redemption_id=fact.redemption_id and m.movement_type=''REFUND'')then return jsonb_build_object(''status'',''REVERSED'',''consumption_fact_id'',fact.id);end if;'||chr(10)||' select id into allocation from public.credit_economic_allocations_v1 where consumption_fact_id=fact.id and allocation_kind=''PURCHASE_CONSUMPTION'';'||chr(10)||' if allocation is not null then return jsonb_build_object(''status'',''READY'',''allocation_id'',allocation,''consumption_fact_id'',fact.id);end if;';
 d:=replace(d,needle,replacement);
 needle:='if(select coalesce(sum(consumed_quantity),0)from public.credit_economic_consumption_facts_v1 where credit_lot_id=l.id)>l.quantity';
 if strpos(d,needle)=0 then raise exception'BENEFIT_REFUND_ECONOMIC_QUANTITY_SOURCE_CONTRACT_MISMATCH';end if;
 d:=replace(d,needle,'if(select coalesce(sum(case when movement_type=''CONSUME''then quantity when movement_type=''REFUND''then-quantity else 0 end),0)from public.credit_lot_movements where credit_lot_id=l.id)>l.quantity');
 needle:='amount:=floor(c.unallocated_credit_minor::numeric*(before_qty+fact.consumed_quantity)/l.quantity)::bigint-floor(c.unallocated_credit_minor::numeric*before_qty/l.quantity)::bigint;';
 if strpos(d,needle)=0 then raise exception'BENEFIT_REFUND_ECONOMIC_AMOUNT_SOURCE_CONTRACT_MISMATCH';end if;
 d:=replace(d,needle,'if exists(select 1 from public.credit_lot_movements where credit_lot_id=l.id and movement_type=''REFUND'')then amount:=private.credit_economic_refund_aware_amount_v1(fact.id,c.id);else '||needle||'end if;');execute d;
end$$;
create function private.guard_benefit_refund_transition_v1()returns trigger language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$begin
 if new.status='REFUNDED'and old.status is distinct from new.status and(old.status<>'CONSUMED'or not exists(select 1 from private.benefit_refund_write_capabilities_v1 cap where cap.backend_pid=pg_backend_pid()and cap.transaction_id=txid_current()and cap.redemption_id=new.id and cap.actor_id=auth.uid())or not exists(select 1 from public.benefit_refund_executions_v1 e join public.benefit_refund_requests_v1 q on q.id=e.request_id where e.redemption_id=new.id and e.organization_id=new.organization_id and e.quantity=new.reserved_credits and e.created_by=auth.uid()and q.created_by<>auth.uid()))then raise exception'CANONICAL_BENEFIT_REFUND_REQUIRED'using errcode='55000';end if;return new;
end$$;
create trigger benefit_refund_transition_guard_v1 before update of status on public.benefit_redemptions for each row execute function private.guard_benefit_refund_transition_v1();

create function public.list_benefit_refunds_v1(p_organization_id uuid default null,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;total bigint;finance boolean:=coalesce(private.credit_revenue_finance_access_v1(),false);begin
 if auth.uid()is null or(p_organization_id is null and not finance)or(p_organization_id is not null and not finance and not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING','CLIENT_BUYER']))then raise exception'BENEFIT_REFUND_READ_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_BENEFIT_REFUND_PAGE'using errcode='22023';end if;
 select count(*)into total from public.benefit_redemptions r where r.status in('CONSUMED','REFUNDED')and(p_organization_id is null or r.organization_id=p_organization_id)and(finance or private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'])or(r.created_by=auth.uid()and exists(select 1 from public.customer_box_redemption_allocations_v1 a where a.redemption_id=r.id and a.organization_id=r.organization_id)));
 select coalesce(jsonb_agg(item order by created_at desc,id),'[]'::jsonb)into result from(
 select r.id,r.created_at,jsonb_build_object('id',r.id,'organization_id',r.organization_id,'organization_name',o.display_name,'name_fr',b.name_fr,'name_ar',b.name_ar,'status',r.status,'row_version',r.row_version::text,'quantity',r.reserved_credits::text,
 'policy_ready',policy.id is not null,'policy_reference',policy.reference,'expiry_treatment',policy.expiry_treatment,
 'can_request',coalesce(private.benefit_refund_client_access_v1(r.organization_id,r.id),false)and r.status='CONSUMED'and policy.id is not null and(q.id is null or d.request_id is not null or q.source_hash is distinct from private.canonical_request_hash(private.benefit_refund_source_v1(r.id))),
 'requires_mfa',auth.jwt()->>'aal'is distinct from'aal2',
 'request',case when q.id is null then null else jsonb_build_object('id',q.id,'content_hash',q.content_hash,'reason',q.reason,'created_at',q.created_at,'approved',d.approved,'decision_reason',d.reason,'source_stale',q.source_hash is distinct from private.canonical_request_hash(private.benefit_refund_source_v1(r.id)),'can_decide',coalesce(private.credit_revenue_finance_access_v1(auth.uid(),true),false)and q.created_by<>auth.uid()and d.request_id is null and r.status='CONSUMED')end,
 'economic_reversals',case when finance then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'book_id',a.book_id,'book_organization',operator.display_name,'library_code',library.code,'amount_minor',a.amount_minor::text,'currency',a.currency)order by a.id)from public.credit_economic_allocations_v1 a join public.credit_economic_consumption_facts_v1 f on f.id=a.consumption_fact_id join public.franchise_pnl_books book on book.id=a.book_id join public.organizations operator on operator.id=book.franchise_organization_id join public.catalog_libraries library on library.id=a.library_id where f.redemption_id=r.id and a.allocation_kind<>'REVERSAL'),'[]'::jsonb)else null end,
 'original_lots',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'source_type',l.source_type,'quantity',m.quantity::text,'expires_at',l.expires_at,'library_id',l.library_id)order by l.expires_at,l.id)from public.credit_lot_movements m join public.credit_lots l on l.id=m.credit_lot_id where m.redemption_id=r.id and m.movement_type='CONSUME'),'[]'::jsonb),
 'refunded',case when e.redemption_id is null then null else jsonb_build_object('quantity',e.quantity::text,'created_at',e.created_at,'reversed_allocations',cardinality(e.reversed_allocation_ids))end)item
 from public.benefit_redemptions r join public.benefit_versions b on b.id=r.benefit_version_id join public.organizations o on o.id=r.organization_id
 left join lateral(select*from private.benefit_refund_policy_v1(r.benefit_version_id))policy on true
 left join lateral(select*from public.benefit_refund_requests_v1 request where request.redemption_id=r.id order by request.created_at desc,request.id limit 1)q on true
 left join public.benefit_refund_decisions_v1 d on d.request_id=q.id left join public.benefit_refund_executions_v1 e on e.redemption_id=r.id
 where r.status in('CONSUMED','REFUNDED')and(p_organization_id is null or r.organization_id=p_organization_id)and(finance or private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'])or(r.created_by=auth.uid()and exists(select 1 from public.customer_box_redemption_allocations_v1 a where a.redemption_id=r.id and a.organization_id=r.organization_id)))order by r.created_at desc,r.id limit 20 offset(p_page-1)*20
 )items;
 return jsonb_build_object('page',p_page,'has_next',total>p_page*20,'total',total::text,'rows',result);
end$$;

do $$declare f regprocedure;begin foreach f in array array[
 'private.guard_benefit_refund_write_v1()'::regprocedure,'private.benefit_refund_client_access_v1(uuid,uuid)'::regprocedure,'private.benefit_refund_policy_v1(uuid)'::regprocedure,
 'private.record_benefit_refund_event_v1(uuid,uuid,text,jsonb,text,uuid)'::regprocedure,'private.benefit_refund_source_v1(uuid)'::regprocedure,
 'private.reverse_benefit_economic_allocation_v1(uuid,uuid,uuid)'::regprocedure,'private.credit_economic_refund_aware_amount_v1(uuid,uuid)'::regprocedure,'private.guard_benefit_refund_transition_v1()'::regprocedure,
 'public.propose_benefit_refund_policy_v1(uuid,bigint,text,timestamptz,timestamptz,text)'::regprocedure,'public.decide_benefit_refund_policy_v1(uuid,text,boolean,text)'::regprocedure,
 'public.request_benefit_refund_v1(uuid,uuid,bigint,text,text)'::regprocedure,'public.decide_benefit_refund_v1(uuid,text,boolean,text,text)'::regprocedure,'public.list_benefit_refunds_v1(uuid,integer)'::regprocedure]loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid=f and n.nspname='public')then execute format('grant execute on function %s to authenticated',f);end if;
end loop;end$$;
notify pgrst,'reload schema';
commit;
