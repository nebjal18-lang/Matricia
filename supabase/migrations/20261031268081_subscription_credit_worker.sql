begin;
-- Automatic fulfillment is a service actor, never an impersonated Finance session.
-- The paid plan and the commercial anchor frozen before PSP are the only authority.
create table private.subscription_credit_schedules_v1(
 payment_event_id bigint primary key references public.subscription_payment_events(id),organization_id uuid not null references public.organizations(id),
 subscription_cycle_id uuid not null references public.subscription_cycles(id),source_actor_user_id uuid not null references auth.users(id),
 source_snapshot jsonb not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),slot_count integer not null check(slot_count between 0 and 12),created_at timestamptz not null default clock_timestamp()
);
create table private.subscription_credit_jobs_v1(
 id uuid primary key default extensions.gen_random_uuid(),payment_event_id bigint not null references private.subscription_credit_schedules_v1(payment_event_id),
 organization_id uuid not null references public.organizations(id),month_index integer not null check(month_index between 1 and 12),due_at timestamptz not null,
 state text not null default'PENDING'check(state in('PENDING','RUNNING','RETRY_PENDING','DEAD_LETTER','COMPLETED','EXPIRED')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 5),next_attempt_at timestamptz not null default clock_timestamp(),last_error_code text,
 worker_id uuid,lease_token uuid,leased_until timestamptz,row_version bigint not null default 1,
 terms_snapshot jsonb,terms_hash text,credit_lot_id uuid references public.credit_lots(id),grant_entry_id bigint references public.credit_ledger_entries(id),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(payment_event_id,month_index),check((lease_token is null)=(worker_id is null)),check((lease_token is null)=(leased_until is null))
);
create index subscription_credit_jobs_claim_v1 on private.subscription_credit_jobs_v1(next_attempt_at,due_at,id)where state in('PENDING','RUNNING','RETRY_PENDING');
create table private.subscription_credit_job_executions_v1(
 job_id uuid not null references private.subscription_credit_jobs_v1(id),lease_token uuid not null,worker_id uuid not null,
 expected_row_version bigint not null,result jsonb not null,execution_actor_type text not null default'SERVICE'check(execution_actor_type='SERVICE'),
 source_actor_user_id uuid not null references auth.users(id),source_hash text not null,correlation_id uuid not null,executed_at timestamptz not null default clock_timestamp(),primary key(job_id,lease_token)
);
create table private.subscription_credit_job_context_v1(
 backend_pid integer not null,transaction_id bigint not null,job_id uuid not null references private.subscription_credit_jobs_v1(id),
 lease_token uuid not null,worker_id uuid not null,row_version bigint not null,wallet_id uuid not null references public.credit_wallets(id),terms jsonb not null,grant_entry_id bigint,
 primary key(backend_pid,transaction_id),unique(job_id,lease_token)
);
create table private.subscription_credit_discovery_cursor_v1(singleton boolean primary key default true check(singleton),last_payment_id bigint not null default 0);
insert into private.subscription_credit_discovery_cursor_v1(singleton)values(true);
create table private.subscription_credit_retry_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),job_id uuid not null references private.subscription_credit_jobs_v1(id),source_hash text not null,expected_job_row_version bigint not null,
 reason text not null check(length(btrim(reason))between 10 and 1000),requested_by uuid not null references auth.users(id),requested_at timestamptz not null default clock_timestamp(),
 approved_by uuid references auth.users(id),decided_at timestamptz,status text not null default'PENDING'check(status in('PENDING','AUTHORIZED','REJECTED')),idempotency_key text not null,unique(requested_by,idempotency_key),check(approved_by is null or approved_by<>requested_by)
);
revoke all on private.subscription_credit_schedules_v1,private.subscription_credit_jobs_v1,private.subscription_credit_job_executions_v1,private.subscription_credit_job_context_v1,private.subscription_credit_discovery_cursor_v1,private.subscription_credit_retry_requests_v1 from public,anon,authenticated,service_role;
create trigger subscription_credit_schedules_immutable before update or delete on private.subscription_credit_schedules_v1 for each row execute function private.prevent_update_delete();
create trigger subscription_credit_executions_immutable before update or delete on private.subscription_credit_job_executions_v1 for each row execute function private.prevent_update_delete();
create function private.guard_subscription_credit_retry_source_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if tg_op='DELETE'or row(new.id,new.job_id,new.source_hash,new.expected_job_row_version,new.reason,new.requested_by,new.requested_at,new.idempotency_key)is distinct from row(old.id,old.job_id,old.source_hash,old.expected_job_row_version,old.reason,old.requested_by,old.requested_at,old.idempotency_key)or old.status<>'PENDING'then raise exception'SC_RETRY_REQUEST_IMMUTABLE'using errcode='55000';end if;return new;end$$;
create trigger subscription_credit_retry_source_immutable before update or delete on private.subscription_credit_retry_requests_v1 for each row execute function private.guard_subscription_credit_retry_source_v1();
revoke all on function private.guard_subscription_credit_retry_source_v1()from public,anon,authenticated,service_role;
create function private.guard_subscription_credit_job_source_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if tg_op='DELETE'or row(new.id,new.payment_event_id,new.organization_id,new.month_index,new.due_at,new.created_at)is distinct from row(old.id,old.payment_event_id,old.organization_id,old.month_index,old.due_at,old.created_at)then raise exception'SC_JOB_SOURCE_IMMUTABLE'using errcode='55000';end if;
 if old.terms_hash is not null and row(new.terms_hash,new.terms_snapshot)is distinct from row(old.terms_hash,old.terms_snapshot)then raise exception'SC_JOB_TERMS_IMMUTABLE'using errcode='55000';end if;return new;
end$$;
create trigger subscription_credit_job_source_immutable before update or delete on private.subscription_credit_jobs_v1 for each row execute function private.guard_subscription_credit_job_source_v1();
revoke all on function private.guard_subscription_credit_job_source_v1()from public,anon,authenticated,service_role;
-- Manual entries retain their required human principal. Only a native leased job may write
-- an explicitly SERVICE row with no human creator; original payment initiator is separate.
alter table public.credit_ledger_entries add column execution_actor_type text not null default'USER'check(execution_actor_type in('USER','SERVICE')),add column service_job_id uuid references private.subscription_credit_jobs_v1(id);
alter table public.credit_ledger_entries alter column created_by drop not null;
alter table public.credit_ledger_entries add constraint credit_entry_execution_actor_v1 check((execution_actor_type='USER'and created_by is not null and service_job_id is null)or(execution_actor_type='SERVICE'and created_by is null and service_job_id is not null and entry_type='GRANT'and reference_type='SUBSCRIPTION_GRANT'));
alter table public.credit_lots add column execution_actor_type text not null default'USER'check(execution_actor_type in('USER','SERVICE')),add column service_job_id uuid references private.subscription_credit_jobs_v1(id);
alter table public.credit_lots alter column created_by drop not null;
alter table public.credit_lots add constraint credit_lot_execution_actor_v1 check((execution_actor_type='USER'and created_by is not null and service_job_id is null)or(execution_actor_type='SERVICE'and created_by is null and service_job_id is not null and source_type='SUBSCRIPTION_GRANT'));
create function private.subscription_credit_service_context_valid_v1(p_job_id uuid,p_organization_id uuid,p_wallet_id uuid,p_source_reference text,p_quantity bigint)returns boolean language plpgsql volatile security definer set search_path=pg_catalog,private as $$
declare c private.subscription_credit_job_context_v1%rowtype;j private.subscription_credit_jobs_v1%rowtype;begin
 if auth.role()is distinct from'service_role'or auth.uid()is not null then return false;end if;
 select*into c from private.subscription_credit_job_context_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and job_id=p_job_id;
 select*into j from private.subscription_credit_jobs_v1 where id=c.job_id;
 return c.job_id is not null and j.state='RUNNING'and j.organization_id=p_organization_id and c.wallet_id=p_wallet_id and c.lease_token=j.lease_token and c.worker_id=j.worker_id and c.row_version=j.row_version and j.leased_until>clock_timestamp()and c.terms->>'source_reference'=p_source_reference and(c.terms->>'quantity')::bigint=p_quantity and c.terms->>'terms_hash'=j.terms_hash and private.canonical_request_hash(c.terms)=private.canonical_request_hash(j.terms_snapshot);
end$$;
create function private.guard_subscription_credit_service_row_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$declare c private.subscription_credit_job_context_v1%rowtype;begin
 if new.execution_actor_type<>'SERVICE'then return new;end if;
 if tg_table_name='credit_ledger_entries'then
  if not private.subscription_credit_service_context_valid_v1(new.service_job_id,new.organization_id,new.wallet_id,new.reference_id,new.quantity)or new.entry_type<>'GRANT'or new.reference_type<>'SUBSCRIPTION_GRANT'or new.created_by is not null then raise exception'SC_NATIVE_SERVICE_CONTEXT_REQUIRED'using errcode='42501';end if;
 else
  if not private.subscription_credit_service_context_valid_v1(new.service_job_id,new.organization_id,new.wallet_id,new.source_reference,new.quantity)or new.created_by is not null or new.source_type<>'SUBSCRIPTION_GRANT'then raise exception'SC_NATIVE_SERVICE_CONTEXT_REQUIRED'using errcode='42501';end if;
  select*into c from private.subscription_credit_job_context_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current();
  if new.grant_entry_id is distinct from c.grant_entry_id or new.library_id is not null or new.revenue_value_minor<>0 or new.rule_version is distinct from c.terms->>'rule_version'or new.expires_at is distinct from(c.terms->>'expires_at')::timestamptz or new.currency is distinct from(c.terms->>'currency')::char(3)then raise exception'SC_NATIVE_SERVICE_TERMS_MISMATCH'using errcode='23514';end if;
 end if;return new;
end$$;
create trigger credit_entry_service_actor_guard before insert on public.credit_ledger_entries for each row execute function private.guard_subscription_credit_service_row_v1();
create trigger credit_lot_service_actor_guard before insert on public.credit_lots for each row execute function private.guard_subscription_credit_service_row_v1();
revoke all on function private.subscription_credit_service_context_valid_v1(uuid,uuid,uuid,text,bigint),private.guard_subscription_credit_service_row_v1()from public,anon,authenticated,service_role;
-- Extend only the actor gate of the mature binder. Every payment, environment,
-- adverse-fact, quantity, expiry and monthly uniqueness check remains in place.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('private.bind_subscription_credit_payment_v1()'::regprocedure);
 needle:='if auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not private.credits_admin_access()then';
 if position(needle in definition)=0 then raise exception'SC_SERVICE_BINDER_PATCH_MISMATCH';end if;
 definition:=replace(definition,needle,'if not private.subscription_credit_service_context_valid_v1(new.service_job_id,new.organization_id,new.wallet_id,new.source_reference,new.quantity)and(auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not private.credits_admin_access())then');
 execute definition;
end$$;
create function private.require_subscription_credit_service_v1()returns void language plpgsql stable security definer set search_path=pg_catalog as $$begin
 if auth.role()is distinct from'service_role'or auth.uid()is not null then raise exception'SC_SERVICE_REQUIRED'using errcode='42501';end if;
end$$;
create function private.schedule_subscription_payment_credits_v1(p_payment_event_id bigint)returns jsonb language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare pay public.subscription_payment_events%rowtype;cycle public.subscription_cycles%rowtype;intent public.subscription_payment_intents%rowtype;plan public.subscription_plan_versions%rowtype;snapshot jsonb;slots integer;begin
 perform private.require_subscription_credit_service_v1();
 select*into pay from public.subscription_payment_events where id=p_payment_event_id;
 if pay.id is null then raise exception'SC_PAYMENT_REQUIRED'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||pay.organization_id::text,0));
 select*into cycle from public.subscription_cycles where id=private.subscription_payment_cycle_v1(pay.id);
 select*into intent from public.subscription_payment_intents where id=pay.payment_intent_id;
 select*into plan from public.subscription_plan_versions where id=cycle.plan_version_id;
 if cycle.id is null or intent.id is null or intent.created_by is null or plan.id is null then raise exception'SC_CANONICAL_PAYMENT_REQUIRED'using errcode='55000';end if;
 slots:=case when plan.monthly_credit_grant=0 then 0 when intent.billing_interval='ANNUAL'then 12 else 1 end;
 snapshot:=jsonb_build_object('payment_event_id',pay.id::text,'organization_id',pay.organization_id,'subscription_cycle_id',cycle.id,'subscription_id',cycle.subscription_id,'plan_version_id',plan.id,'plan_content_hash',plan.content_hash,'monthly_credit_grant',plan.monthly_credit_grant::text,'billing_interval',intent.billing_interval,'currency',pay.currency,'amount_minor',pay.amount_minor::text,'payload_hash',pay.payload_hash,'provider_environment',pay.provider_environment,'gateway',pay.gateway,'payment_reference',pay.payment_reference,'period_start',cycle.period_start,'period_end',cycle.period_end,'activation_result',pay.activation_result);
 insert into private.subscription_credit_schedules_v1(payment_event_id,organization_id,subscription_cycle_id,source_actor_user_id,source_snapshot,source_hash,slot_count)
 values(pay.id,pay.organization_id,cycle.id,intent.created_by,snapshot,private.canonical_request_hash(snapshot),slots)on conflict do nothing;
 if not exists(select 1 from private.subscription_credit_schedules_v1 where payment_event_id=pay.id and source_hash=private.canonical_request_hash(snapshot)and slot_count=slots)then raise exception'SC_PAYMENT_SOURCE_MISMATCH'using errcode='23514';end if;
 insert into private.subscription_credit_jobs_v1(payment_event_id,organization_id,month_index,due_at)
 select pay.id,pay.organization_id,n,cycle.period_start+make_interval(months=>n-1)from generate_series(1,slots)n on conflict(payment_event_id,month_index)do nothing;
 return jsonb_build_object('outcome','SUBSCRIPTION_CREDIT_JOBS_TRACKED','payment_event_id',pay.id::text,'job_count',slots,'source_hash',private.canonical_request_hash(snapshot));
end$$;
create function public.track_subscription_paid_credit_jobs_v1(p_outbox_id bigint,p_subscription_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare event public.event_outbox%rowtype;ids bigint[];begin
 perform private.require_subscription_credit_service_v1();select*into event from public.event_outbox where id=p_outbox_id;
 if event.id is null or event.event_type<>'SubscriptionPaidV1'or event.aggregate_id is distinct from p_subscription_id::text then raise exception'SC_PAID_EVENT_REQUIRED'using errcode='55000';end if;
 select array_agg(pay.id)into ids from public.subscription_payment_events pay where pay.organization_id=event.organization_id and pay.activation_result=event.payload and pay.activation_result->>'subscription_id'=p_subscription_id::text and pay.correlation_id=event.correlation_id and private.subscription_payment_cycle_v1(pay.id)is not null;
 if cardinality(ids)is distinct from 1 then raise exception'SC_PAID_EVENT_BINDING_REQUIRED'using errcode='55000';end if;
 return private.schedule_subscription_payment_credits_v1(ids[1]);
end$$;
create function public.discover_subscription_credit_jobs_v1(p_limit integer default 10)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare cursor_id bigint;pay record;processed integer:=0;begin
 perform private.require_subscription_credit_service_v1();if p_limit is null or p_limit not between 1 and 25 then raise exception'SC_DISCOVERY_LIMIT_INVALID'using errcode='22023';end if;
 select last_payment_id into cursor_id from private.subscription_credit_discovery_cursor_v1 where singleton for update;
 for pay in select id from public.subscription_payment_events where id>cursor_id order by id limit p_limit loop
  if private.subscription_payment_cycle_v1(pay.id)is not null then perform private.schedule_subscription_payment_credits_v1(pay.id);processed:=processed+1;end if;cursor_id:=pay.id;
 end loop;
 update private.subscription_credit_discovery_cursor_v1 set last_payment_id=cursor_id where singleton;
 return jsonb_build_object('outcome','SUBSCRIPTION_CREDIT_DISCOVERY_COMPLETED','scheduled_payments',processed);
end$$;
create function public.claim_subscription_credit_jobs_v1(p_worker_id uuid,p_limit integer default 1,p_lease_seconds integer default 120)returns setof jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare j private.subscription_credit_jobs_v1%rowtype;begin
 perform private.require_subscription_credit_service_v1();if p_worker_id is null or p_limit is null or p_limit not between 1 and 5 or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then raise exception'SC_CLAIM_ARGUMENTS_INVALID'using errcode='22023';end if;
 update private.subscription_credit_jobs_v1 set state='DEAD_LETTER',last_error_code='SC_LEASE_ATTEMPTS_EXHAUSTED',worker_id=null,lease_token=null,leased_until=null,row_version=row_version+1,updated_at=clock_timestamp()where state='RUNNING'and leased_until<=clock_timestamp()and attempt_count>=5;
 for j in select*from private.subscription_credit_jobs_v1 where due_at<=clock_timestamp()and next_attempt_at<=clock_timestamp()and attempt_count<5 and(state in('PENDING','RETRY_PENDING')or(state='RUNNING'and leased_until<=clock_timestamp()))order by due_at,id for update skip locked limit p_limit loop
  update private.subscription_credit_jobs_v1 set state='RUNNING',attempt_count=attempt_count+1,worker_id=p_worker_id,lease_token=extensions.gen_random_uuid(),leased_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),row_version=row_version+1,updated_at=clock_timestamp()where id=j.id returning*into j;
  return next jsonb_build_object('job_id',j.id,'worker_id',j.worker_id,'lease_token',j.lease_token,'row_version',j.row_version::text);
 end loop;
end$$;
create function public.execute_subscription_credit_job_v1(p_job_id uuid,p_worker_id uuid,p_lease_token uuid,p_expected_row_version bigint,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare j private.subscription_credit_jobs_v1%rowtype;s private.subscription_credit_schedules_v1%rowtype;terms jsonb;anchor jsonb;wallet uuid;entry_id bigint;lot_id uuid;result jsonb;failure text;begin
 perform private.require_subscription_credit_service_v1();if p_correlation_id is null then raise exception'SC_CORRELATION_REQUIRED'using errcode='22023';end if;
 select*into j from private.subscription_credit_jobs_v1 where id=p_job_id;
 if j.id is null then raise exception'SC_LEASE_INVALID'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||j.organization_id::text,0));
 select*into j from private.subscription_credit_jobs_v1 where id=p_job_id for update;
 select e.result into result from private.subscription_credit_job_executions_v1 e where e.job_id=j.id and e.lease_token=p_lease_token and e.worker_id=p_worker_id and e.expected_row_version=p_expected_row_version;
 if result is not null then return result||jsonb_build_object('replayed',true);end if;
 if j.state is distinct from'RUNNING'or j.worker_id is distinct from p_worker_id or j.lease_token is distinct from p_lease_token or j.row_version is distinct from p_expected_row_version or j.leased_until<=clock_timestamp()then raise exception'SC_LEASE_INVALID'using errcode='55000';end if;
 select*into s from private.subscription_credit_schedules_v1 where payment_event_id=j.payment_event_id;
 begin
  if private.subscription_payment_cycle_v1(j.payment_event_id)is distinct from s.subscription_cycle_id then raise exception'SC_CANONICAL_PAYMENT_REQUIRED'using errcode='55000';end if;
  -- Reconcile an already issued canonical slot before new-value admission. This
  -- records an existing fact, including when later holds block further grants.
  select l.id,l.grant_entry_id into lot_id,entry_id from public.credit_lot_payment_sources_v1 source join public.credit_lots l on l.id=source.credit_lot_id and l.organization_id=source.organization_id join public.credit_ledger_entries e on e.id=l.grant_entry_id and e.organization_id=l.organization_id and e.wallet_id=l.wallet_id and e.entry_type='GRANT'and e.quantity=l.quantity and e.reference_type=l.source_type and e.reference_id=l.source_reference
  where source.payment_event_id=j.payment_event_id and source.grant_month_index=j.month_index and source.organization_id=j.organization_id and source.subscription_cycle_id=s.subscription_cycle_id and source.source_hash=private.canonical_request_hash(source.source_snapshot)and source.resolution_method='CANONICAL_REFERENCE'and l.quantity=(s.source_snapshot->>'monthly_credit_grant')::bigint and l.revenue_value_minor=0 and l.source_type='SUBSCRIPTION_GRANT'and l.source_reference='subscription-payment:'||j.payment_event_id::text||':month:'||j.month_index::text;
  if lot_id is not null then result:=jsonb_build_object('outcome','SUBSCRIPTION_CREDIT_ALREADY_ISSUED','job_id',j.id,'credit_lot_id',lot_id,'entry_id',entry_id::text);
  else
  if not private.subscription_payment_funding_environment_compatible_v1(j.payment_event_id)then raise exception'SC_PAYMENT_ENVIRONMENT_INCOMPATIBLE'using errcode='55000';end if;
  if private.subscription_credit_payment_held_v1(j.payment_event_id)or not private.subscription_financially_clear(j.organization_id)then raise exception'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
  if not exists(select 1 from public.organizations where id=j.organization_id and status='ACTIVE')or not private.client_identity_allows_new_operations(j.organization_id)then raise exception'SC_CURRENT_CLIENT_IDENTITY_REQUIRED'using errcode='55000';end if;
  if to_regprocedure('private.subscription_prepared_box_terms_for_payment_v1(bigint)')is null then raise exception'SC_PRE_PSP_TERMS_REQUIRED'using errcode='55000';end if;
  anchor:=private.subscription_prepared_box_terms_for_payment_v1(j.payment_event_id);
  if anchor is null or anchor->>'plan_content_hash'is distinct from s.source_snapshot->>'plan_content_hash'or anchor->>'plan_monthly_credit_grant'is distinct from s.source_snapshot->>'monthly_credit_grant'then raise exception'SC_PRE_PSP_TERMS_REQUIRED'using errcode='55000';end if;
  terms:=private.subscription_credit_grant_terms_v1(j.organization_id,j.payment_event_id,j.month_index);
  if terms->>'quantity'is distinct from s.source_snapshot->>'monthly_credit_grant'or(terms->>'revenue_value_minor')::bigint<>0 or terms#>>'{rollover_policy,checkout_terms_hash}'is distinct from anchor->>'source_hash'then raise exception'SC_PRE_PSP_TERMS_MISMATCH'using errcode='23514';end if;
  if(terms->>'grant_period_start')::timestamptz>clock_timestamp()then raise exception'SC_GRANT_NOT_DUE'using errcode='55000';end if;
  if j.terms_hash is not null and(j.terms_hash is distinct from terms->>'terms_hash'or j.terms_snapshot is distinct from terms)then raise exception'SC_JOB_TERMS_MISMATCH'using errcode='23514';end if;
  update private.subscription_credit_jobs_v1 set terms_snapshot=terms,terms_hash=terms->>'terms_hash'where id=j.id;
  if(terms->>'expires_at')::timestamptz<=clock_timestamp()then
   result:=jsonb_build_object('outcome','SUBSCRIPTION_CREDIT_SLOT_EXPIRED','job_id',j.id);
  else
   insert into public.credit_wallets(organization_id,wallet_type)values(j.organization_id,'CLIENT')on conflict(organization_id,wallet_type)do nothing;
   select id into wallet from public.credit_wallets where organization_id=j.organization_id and wallet_type='CLIENT'for update;
   insert into private.subscription_credit_job_context_v1(backend_pid,transaction_id,job_id,lease_token,worker_id,row_version,wallet_id,terms)values(pg_backend_pid(),txid_current(),j.id,p_lease_token,p_worker_id,j.row_version,wallet,terms);
   insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by,execution_actor_type,service_job_id)
   values(j.organization_id,wallet,'GRANT',(terms->>'quantity')::bigint,'subscription.credit.worker',j.id::text,p_correlation_id,'SUBSCRIPTION_GRANT',terms->>'source_reference',null,'SERVICE',j.id)returning id into entry_id;
   update private.subscription_credit_job_context_v1 set grant_entry_id=entry_id where backend_pid=pg_backend_pid()and transaction_id=txid_current();
   insert into public.credit_lots(organization_id,wallet_id,grant_entry_id,source_type,source_reference,quantity,expires_at,library_id,revenue_value_minor,currency,rule_version,created_by,execution_actor_type,service_job_id)
   values(j.organization_id,wallet,entry_id,'SUBSCRIPTION_GRANT',terms->>'source_reference',(terms->>'quantity')::bigint,(terms->>'expires_at')::timestamptz,null,0,(terms->>'currency')::char(3),terms->>'rule_version',null,'SERVICE',j.id)returning id into lot_id;
   delete from private.subscription_credit_job_context_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current();
   result:=jsonb_build_object('outcome','SUBSCRIPTION_CREDIT_ISSUED','job_id',j.id,'credit_lot_id',lot_id,'entry_id',entry_id::text,'quantity',terms->>'quantity');
   insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(j.organization_id,null,'SERVICE','credits.subscription_automatically_issued','credit_lot',lot_id::text,p_correlation_id,jsonb_build_object('job_id',j.id,'payment_event_id',j.payment_event_id::text,'source_hash',s.source_hash),repeat('0',64));
   insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(j.organization_id,'credit_wallet',wallet::text,'CreditsGrantedV1',p_correlation_id,result,'subscription-credit-worker:'||j.id::text);
  end if;
  end if;
  insert into private.subscription_credit_job_executions_v1(job_id,lease_token,worker_id,expected_row_version,result,source_actor_user_id,source_hash,correlation_id)values(j.id,p_lease_token,p_worker_id,p_expected_row_version,result,s.source_actor_user_id,s.source_hash,p_correlation_id);
  update private.subscription_credit_jobs_v1 set state=case when result->>'outcome'='SUBSCRIPTION_CREDIT_SLOT_EXPIRED'then'EXPIRED'else'COMPLETED'end,credit_lot_id=lot_id,grant_entry_id=entry_id,worker_id=null,lease_token=null,leased_until=null,row_version=row_version+1,last_error_code=null,updated_at=clock_timestamp()where id=j.id;
  return result;
 exception when others then
  get stacked diagnostics failure=message_text;
  failure:=case when failure~'^[A-Z][A-Z0-9_]{2,100}$'then failure else'SC_ISSUANCE_FAILED'end;
  update private.subscription_credit_jobs_v1 set state=case when attempt_count>=5 then'DEAD_LETTER'else'RETRY_PENDING'end,last_error_code=failure,next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,30*(2^least(attempt_count,6))::integer)),worker_id=null,lease_token=null,leased_until=null,row_version=row_version+1,updated_at=clock_timestamp()where id=j.id;
  return jsonb_build_object('outcome',case when j.attempt_count>=5 then'SUBSCRIPTION_CREDIT_DEAD_LETTERED'else'SUBSCRIPTION_CREDIT_RETRY_SCHEDULED'end,'job_id',j.id,'reason_code',failure);
 end;
end$$;
create function private.subscription_credit_retry_write_access_v1(p_actor uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],p_actor)and not private.has_platform_role(array['READ_ONLY_AUDITOR'],p_actor)$$;
revoke all on function private.subscription_credit_retry_write_access_v1(uuid)from public,anon,authenticated,service_role;
create function public.get_subscription_credit_worker_operations_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not(private.has_platform_role(array['FINANCE_MANAGER','SUPER_ADMIN','READ_ONLY_AUDITOR'],auth.uid()))then raise exception'SC_OPERATIONS_DENIED'using errcode='42501';end if;
 return jsonb_build_object('can_act',private.subscription_credit_retry_write_access_v1(auth.uid()),'requests',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select id,job_id,source_hash,status,reason,requested_by<>auth.uid() can_review from private.subscription_credit_retry_requests_v1 where status='PENDING'order by requested_at,id limit 100)x),'counts',(select coalesce(jsonb_object_agg(state,n),'{}')from(select state,count(*)::text n from private.subscription_credit_jobs_v1 group by state)x),'jobs',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select j.id,j.payment_event_id::text,j.organization_id,j.month_index,j.state,j.attempt_count,j.due_at,j.last_error_code,s.source_hash from private.subscription_credit_jobs_v1 j join private.subscription_credit_schedules_v1 s using(payment_event_id)where j.state not in('COMPLETED','EXPIRED')order by j.due_at,j.id limit 100)x));
end$$;
revoke all on function private.require_subscription_credit_service_v1(),private.schedule_subscription_payment_credits_v1(bigint),public.track_subscription_paid_credit_jobs_v1(bigint,uuid),public.discover_subscription_credit_jobs_v1(integer),public.claim_subscription_credit_jobs_v1(uuid,integer,integer),public.execute_subscription_credit_job_v1(uuid,uuid,uuid,bigint,uuid),public.get_subscription_credit_worker_operations_v1()from public,anon,authenticated,service_role;
grant execute on function public.track_subscription_paid_credit_jobs_v1(bigint,uuid),public.discover_subscription_credit_jobs_v1(integer),public.claim_subscription_credit_jobs_v1(uuid,integer,integer),public.execute_subscription_credit_job_v1(uuid,uuid,uuid,bigint,uuid)to service_role;
grant execute on function public.get_subscription_credit_worker_operations_v1()to authenticated;
create function public.request_subscription_credit_retry_v1(p_job_id uuid,p_expected_source_hash text,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare j private.subscription_credit_jobs_v1%rowtype;s private.subscription_credit_schedules_v1%rowtype;r private.subscription_credit_retry_requests_v1%rowtype;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.subscription_credit_retry_write_access_v1(auth.uid())then raise exception'SC_RETRY_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 1000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'SC_RETRY_INPUT_INVALID'using errcode='22023';end if;
 select*into j from private.subscription_credit_jobs_v1 where id=p_job_id;select*into s from private.subscription_credit_schedules_v1 where payment_event_id=j.payment_event_id;
 if j.id is null or s.source_hash is distinct from p_expected_source_hash then raise exception'SC_RETRY_SOURCE_MISMATCH'using errcode='40001';end if;
 select*into r from private.subscription_credit_retry_requests_v1 where requested_by=auth.uid()and idempotency_key=p_idempotency_key;
 if r.id is not null then if r.job_id is distinct from j.id or r.source_hash is distinct from p_expected_source_hash or r.reason is distinct from p_reason then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','SC_RETRY_REQUESTED','request_id',r.id,'source_hash',r.source_hash);end if;
 if j.state<>'DEAD_LETTER'then raise exception'SC_DEAD_LETTER_REQUIRED'using errcode='55000';end if;
 insert into private.subscription_credit_retry_requests_v1(job_id,source_hash,expected_job_row_version,reason,requested_by,idempotency_key)values(j.id,s.source_hash,j.row_version,p_reason,auth.uid(),p_idempotency_key)returning*into r;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(j.organization_id,auth.uid(),'USER','credits.subscription_retry_requested','subscription_credit_job',j.id::text,extensions.gen_random_uuid(),jsonb_build_object('request_id',r.id,'source_hash',r.source_hash),repeat('0',64));
 return jsonb_build_object('outcome','SC_RETRY_REQUESTED','request_id',r.id,'source_hash',r.source_hash);
end$$;
create function public.review_subscription_credit_retry_v1(p_request_id uuid,p_expected_source_hash text,p_approve boolean)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare r private.subscription_credit_retry_requests_v1%rowtype;j private.subscription_credit_jobs_v1%rowtype;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.subscription_credit_retry_write_access_v1(auth.uid())then raise exception'SC_RETRY_DENIED'using errcode='42501';end if;
 select*into r from private.subscription_credit_retry_requests_v1 where id=p_request_id;select*into j from private.subscription_credit_jobs_v1 where id=r.job_id;
 if r.id is null or r.requested_by=auth.uid()then raise exception'SC_RETRY_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||j.organization_id::text,0));
 select*into j from private.subscription_credit_jobs_v1 where id=r.job_id for update;select*into r from private.subscription_credit_retry_requests_v1 where id=p_request_id for update;
 if not private.subscription_credit_retry_write_access_v1(auth.uid())or not private.subscription_credit_retry_write_access_v1(r.requested_by)then raise exception'SC_RETRY_DENIED'using errcode='42501';end if;
 if p_approve is null or r.source_hash is distinct from p_expected_source_hash or not exists(select 1 from private.subscription_credit_schedules_v1 where payment_event_id=j.payment_event_id and source_hash=r.source_hash)then raise exception'SC_RETRY_SOURCE_MISMATCH'using errcode='40001';end if;
 if r.status<>'PENDING'then return jsonb_build_object('outcome','SC_RETRY_REVIEWED','status',r.status);end if;
 if p_approve and(j.state<>'DEAD_LETTER'or j.row_version is distinct from r.expected_job_row_version)then raise exception'SC_DEAD_LETTER_REQUIRED'using errcode='55000';end if;
 update private.subscription_credit_retry_requests_v1 set status=case when p_approve then'AUTHORIZED'else'REJECTED'end,approved_by=auth.uid(),decided_at=clock_timestamp()where id=r.id;
 if p_approve then update private.subscription_credit_jobs_v1 set state='RETRY_PENDING',attempt_count=0,next_attempt_at=clock_timestamp(),last_error_code=null,row_version=row_version+1,updated_at=clock_timestamp()where id=j.id;end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(j.organization_id,auth.uid(),'USER','credits.subscription_retry_reviewed','subscription_credit_job',j.id::text,extensions.gen_random_uuid(),jsonb_build_object('request_id',r.id,'approved',p_approve,'source_hash',r.source_hash),repeat('0',64));
 return jsonb_build_object('outcome','SC_RETRY_REVIEWED','status',case when p_approve then'AUTHORIZED'else'REJECTED'end);
end$$;
revoke all on function public.request_subscription_credit_retry_v1(uuid,text,text,text),public.review_subscription_credit_retry_v1(uuid,text,boolean)from public,anon,authenticated,service_role;
grant execute on function public.request_subscription_credit_retry_v1(uuid,text,text,text),public.review_subscription_credit_retry_v1(uuid,text,boolean)to authenticated;
create function private.subscription_credit_queue_metrics_v1()returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select state status,count(*)::text count,coalesce(greatest(0,floor(extract(epoch from clock_timestamp()-min(due_at)))),0)::bigint::text oldest_seconds from private.subscription_credit_jobs_v1 where due_at<=clock_timestamp()and state not in('COMPLETED','EXPIRED')group by state)x$$;
revoke all on function private.subscription_credit_queue_metrics_v1()from public,anon,authenticated,service_role;
alter function public.operational_metrics_v1()set schema private;
alter function private.operational_metrics_v1()rename to operational_metrics_before_subscription_credits_v1;
revoke all on function private.operational_metrics_before_subscription_credits_v1()from public,anon,authenticated,service_role;
create function public.operational_metrics_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 perform private.require_subscription_credit_service_v1();return private.operational_metrics_before_subscription_credits_v1()||jsonb_build_object('subscription_credit_grants',private.subscription_credit_queue_metrics_v1());end$$;
revoke all on function public.operational_metrics_v1()from public,anon,authenticated,service_role;
grant execute on function public.operational_metrics_v1()to service_role;
notify pgrst,'reload schema';
commit;
