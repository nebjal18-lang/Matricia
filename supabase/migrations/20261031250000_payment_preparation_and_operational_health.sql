-- Authorize and durably prepare payment work before any external provider call.
create table public.subscription_payment_preparations (
 id uuid primary key default extensions.gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 actor_id uuid not null references auth.users(id),
 idempotency_key text not null,
 request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 plan_version_id uuid not null references public.subscription_plan_versions(id),
 billing_interval text not null check(billing_interval in('MONTHLY','ANNUAL')),
 gateway text not null check(gateway in('DEMO','CMI','PAYPAL')),
 amount_minor bigint not null check(amount_minor>0), currency char(3) not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,idempotency_key)
);
alter table public.subscription_payment_preparations enable row level security;
create trigger immutable_subscription_payment_preparations before update or delete on public.subscription_payment_preparations for each row execute function private.prevent_update_delete();
revoke all on public.subscription_payment_preparations from public,anon,authenticated,service_role;
create function public.prepare_subscription_payment_intent_v1(p_organization_id uuid,p_plan_version_id uuid,p_billing_interval text,p_gateway text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid(); p public.subscription_plan_versions%rowtype; existing public.subscription_payment_preparations%rowtype; amount bigint; h text; inserted integer;
begin
 if a is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a) then raise exception 'PAYMENT_INTENT_CREATE_DENIED' using errcode='42501';end if;
 if p_billing_interval is null or p_billing_interval not in('MONTHLY','ANNUAL') or p_gateway is null or p_gateway not in('DEMO','CMI','PAYPAL') or length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'INVALID_PAYMENT_PREPARATION' using errcode='22023';end if;
 select * into p from public.subscription_plan_versions where id=p_plan_version_id and status='ACTIVE' and valid_from<=current_date and(valid_to is null or valid_to>=current_date);
 if not found then raise exception 'ACTIVE_PLAN_VERSION_REQUIRED' using errcode='23514';end if;
 amount:=case p_billing_interval when'MONTHLY'then p.monthly_price_minor else p.annual_price_minor end;
 h:=private.canonical_request_hash(jsonb_build_object('organization',p_organization_id,'plan',p.id,'interval',p_billing_interval,'gateway',p_gateway,'amount',amount,'currency',p.currency));
 insert into public.subscription_payment_preparations(organization_id,actor_id,idempotency_key,request_hash,plan_version_id,billing_interval,gateway,amount_minor,currency)
 values(p_organization_id,a,p_idempotency_key,h,p.id,p_billing_interval,p_gateway,amount,p.currency) on conflict do nothing;
 get diagnostics inserted=row_count;
 select * into existing from public.subscription_payment_preparations where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if existing.request_hash<>h then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH' using errcode='22000';end if;
 if inserted=1 then
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,a,'USER','subscription.payment_intent_prepared','subscription_payment_preparation',existing.id::text,existing.id,jsonb_build_object('gateway',p_gateway,'amount_minor',amount,'currency',p.currency),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'subscription_payment_preparation',existing.id::text,'SubscriptionPaymentIntentPreparedV1',existing.id,jsonb_build_object('preparation_id',existing.id,'gateway',p_gateway),'prepare:'||p_idempotency_key);
 end if;
 return jsonb_build_object('preparation_id',existing.id,'amount_minor',existing.amount_minor::text,'currency',existing.currency);
end $$;
revoke all on function public.prepare_subscription_payment_intent_v1(uuid,uuid,text,text,text) from public,anon,service_role;
grant execute on function public.prepare_subscription_payment_intent_v1(uuid,uuid,text,text,text) to authenticated;

create table public.operational_heartbeats (
 service_code text primary key check(service_code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
 observed_at timestamptz not null, healthy boolean not null, expires_after_seconds integer not null check(expires_after_seconds between 15 and 86400)
);
alter table public.operational_heartbeats enable row level security;
revoke all on public.operational_heartbeats from public,anon,authenticated,service_role;
create function public.record_operational_heartbeat_v1(p_service_code text,p_healthy boolean,p_expires_after_seconds integer default 60)
returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_healthy is null then raise exception 'INVALID_HEARTBEAT' using errcode='22023';end if;
 insert into public.operational_heartbeats(service_code,observed_at,healthy,expires_after_seconds)values(p_service_code,clock_timestamp(),p_healthy,p_expires_after_seconds)
 on conflict(service_code) do update set observed_at=excluded.observed_at,healthy=excluded.healthy,expires_after_seconds=excluded.expires_after_seconds;
end $$;
revoke all on function public.record_operational_heartbeat_v1(text,boolean,integer) from public,anon,authenticated;
grant execute on function public.record_operational_heartbeat_v1(text,boolean,integer) to service_role;
create or replace function public.readiness_status()
returns table(database_ok boolean,outbox_ok boolean,pending_events bigint,oldest_pending_seconds bigint)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select true,
  not exists(select 1 from public.event_outbox where dead_lettered_at is not null)
  and not exists(select 1 from public.operational_heartbeats where not healthy or observed_at+make_interval(secs=>expires_after_seconds)<statement_timestamp())
  and coalesce(min(o.occurred_at)filter(where o.published_at is null and o.dead_lettered_at is null)>statement_timestamp()-interval'15 minutes',true),
  count(*)filter(where o.published_at is null and o.dead_lettered_at is null),
  coalesce(extract(epoch from statement_timestamp()-min(o.occurred_at)filter(where o.published_at is null and o.dead_lettered_at is null))::bigint,0)
 from public.event_outbox o;
end $$;
notify pgrst,'reload schema';

create function private.operational_event_replay_is_safe(p_type text,p_error text)returns boolean language sql immutable set search_path=pg_catalog as $$
 select p_type in('AdminActionAuthorizedV1','DocumentUploadedV1')or coalesce(p_error in('INVITATION_LOAD_FAILED','INVITATION_LOAD_INVALID','EMAIL_MODE_UNCONFIGURED','EMAIL_LIVE_DISABLED','EMAIL_RECIPIENT_NOT_ALLOWLISTED','EMAIL_PROVIDER_NOT_CONFIGURED','DOMAIN_CONSUMER_REQUIRED'),false)
$$;
revoke all on function private.operational_event_replay_is_safe(text,text)from public,anon,authenticated,service_role;

create function public.operational_health_v1(p_required_services text[] default '{}') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
begin
 if coalesce(auth.role(),'')<>'service_role' and not (auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2' and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return jsonb_build_object(
  'dependencies_ok',not exists(select 1 from unnest(p_required_services) required(code) left join public.operational_heartbeats h on h.service_code=required.code where h.service_code is null or not h.healthy or h.observed_at+make_interval(secs=>h.expires_after_seconds)<statement_timestamp()),
  'heartbeats',coalesce((select jsonb_agg(jsonb_build_object('service',service_code,'observed_at',observed_at,'healthy',healthy and observed_at+make_interval(secs=>expires_after_seconds)>=statement_timestamp()))from public.operational_heartbeats),'[]'::jsonb),
  'dead_letters',coalesce((select jsonb_agg(row_to_json(q))from(select id::text,event_type,attempt_count,dead_lettered_at,last_error_code,private.operational_event_replay_is_safe(event_type,last_error_code)as replayable from public.event_outbox where dead_lettered_at is not null order by id desc limit 100)q),'[]'::jsonb));
end $$;
revoke all on function public.operational_health_v1(text[]) from public,anon;
grant execute on function public.operational_health_v1(text[]) to service_role,authenticated;

create table public.operational_replay_requests (
 id uuid primary key default extensions.gen_random_uuid(),event_id bigint not null references public.event_outbox(id),
 requested_by uuid not null references auth.users(id),approved_by uuid references auth.users(id),
 reason text not null check(length(btrim(reason))between 10 and 1000),
 status text not null default 'PENDING' check(status in('PENDING','EXECUTED')),
 idempotency_key uuid not null unique,requested_at timestamptz not null default clock_timestamp(),executed_at timestamptz,
 check(approved_by is null or approved_by<>requested_by)
);
alter table public.operational_replay_requests enable row level security;
revoke all on public.operational_replay_requests from public,anon,authenticated,service_role;
create policy operational_replay_admin_read on public.operational_replay_requests for select to authenticated using(coalesce(auth.jwt()->>'aal','')='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
grant select on public.operational_replay_requests to authenticated;
create function public.request_operational_replay_v1(p_event_id bigint,p_reason text,p_idempotency_key uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid();r public.operational_replay_requests%rowtype;
begin
 if a is null or coalesce(auth.jwt()->>'aal','')<>'aal2' or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)then raise exception 'FORBIDDEN'using errcode='42501';end if;
 if not exists(select 1 from public.event_outbox where id=p_event_id and dead_lettered_at is not null and published_at is null and private.operational_event_replay_is_safe(event_type,last_error_code))then raise exception 'REPLAY_DEAD_LETTER_REQUIRED'using errcode='23514';end if;
 insert into public.operational_replay_requests(event_id,requested_by,reason,idempotency_key)values(p_event_id,a,p_reason,p_idempotency_key)on conflict(idempotency_key)do nothing;
 select * into r from public.operational_replay_requests where idempotency_key=p_idempotency_key;
 if r.event_id<>p_event_id or r.requested_by<>a or r.reason<>p_reason then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)select a,'USER','outbox.replay.requested','operational_replay_request',r.id::text,r.id,jsonb_build_object('event_id',r.event_id::text),repeat('0',64)where not exists(select 1 from public.audit_events where action='outbox.replay.requested'and resource_id=r.id::text);
 return r.id;
end $$;
create function public.approve_operational_replay_v1(p_request_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid();r public.operational_replay_requests%rowtype;
begin
 if a is null or coalesce(auth.jwt()->>'aal','')<>'aal2' or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)then raise exception 'FORBIDDEN'using errcode='42501';end if;
 select * into r from public.operational_replay_requests where id=p_request_id for update;
 if not found then raise exception 'REPLAY_REQUEST_NOT_FOUND'using errcode='P0002';end if;
 if a=r.requested_by then raise exception 'FOUR_EYES_REQUIRED'using errcode='42501';end if;
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],r.requested_by)then raise exception'REQUESTER_AUTHORIZATION_REVOKED'using errcode='42501';end if;
 if r.status='EXECUTED'then return jsonb_build_object('outcome','REPLAY_SCHEDULED','event_id',r.event_id::text);end if;
 update public.event_outbox set dead_lettered_at=null,available_at=clock_timestamp(),locked_at=null,locked_by=null,attempt_count=0,last_error_code=null where id=r.event_id and dead_lettered_at is not null and published_at is null and private.operational_event_replay_is_safe(event_type,last_error_code);
 if not found then raise exception 'REPLAY_STATE_CHANGED'using errcode='40001';end if;
 update public.operational_replay_requests set status='EXECUTED',approved_by=a,executed_at=clock_timestamp()where id=r.id;
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(a,'USER','outbox.replay.approved','operational_replay_request',r.id::text,r.id,jsonb_build_object('event_id',r.event_id::text,'requester',r.requested_by,'reason',r.reason),repeat('0',64));
 return jsonb_build_object('outcome','REPLAY_SCHEDULED','event_id',r.event_id::text);
end $$;
revoke all on function public.request_operational_replay_v1(bigint,text,uuid),public.approve_operational_replay_v1(uuid)from public,anon,service_role;
grant execute on function public.request_operational_replay_v1(bigint,text,uuid),public.approve_operational_replay_v1(uuid)to authenticated;
notify pgrst,'reload schema';
