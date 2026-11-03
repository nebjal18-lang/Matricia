-- Native PayPal after-payment lifecycle. Provider acceptance never attests a refund.
create table public.subscription_refund_requests(
 id uuid primary key default extensions.gen_random_uuid(),payment_event_id bigint not null references public.subscription_payment_events(id),
 amount_minor bigint not null check(amount_minor>0),currency char(3)not null,reason text not null check(length(btrim(reason))between 10 and 1000),
 requested_by uuid not null references auth.users(id),approved_by uuid references auth.users(id),idempotency_key uuid not null unique,
 status text not null default'PENDING_APPROVAL'check(status in('PENDING_APPROVAL','AUTHORIZED','SENDING','AWAITING_WEBHOOK','CONFIRMED','RECONCILIATION_REQUIRED','CANCELLED')),
 provider_refund_id text,first_attempt_at timestamptz,requested_at timestamptz not null default clock_timestamp(),approved_at timestamptz,
 check(approved_by is null or approved_by<>requested_by)
);
alter table public.subscription_refund_requests enable row level security;
revoke all on public.subscription_refund_requests from public,anon,authenticated,service_role;
create table public.subscription_payment_adjustments(
 id uuid primary key default extensions.gen_random_uuid(),payment_event_id bigint not null references public.subscription_payment_events(id),
 gateway text not null check(gateway='PAYPAL'),provider_event_id text not null,provider_adjustment_id text not null,
 event_type text not null check(event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED','DISPUTE_OPENED','DISPUTE_WON','DISPUTE_LOST')),
 amount_minor bigint not null check(amount_minor>0),currency char(3)not null,payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),signature_fingerprint text not null check(signature_fingerprint~'^[0-9a-f]{64}$'),
 occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),financial_journal_id uuid references public.financial_journals(id),correlation_id uuid not null,
 unique(gateway,provider_event_id),unique(gateway,event_type,provider_adjustment_id)
);
alter table public.subscription_payment_adjustments enable row level security;
revoke all on public.subscription_payment_adjustments from public,anon,authenticated,service_role;
create trigger immutable_subscription_adjustments before update or delete on public.subscription_payment_adjustments for each row execute function private.prevent_update_delete();
create table public.subscription_financial_holds(
 payment_event_id bigint primary key references public.subscription_payment_events(id),organization_id uuid not null references public.organizations(id),
 active boolean not null,reason_code text not null,updated_at timestamptz not null default clock_timestamp()
);
alter table public.subscription_financial_holds enable row level security;
revoke all on public.subscription_financial_holds from public,anon,authenticated,service_role;
create policy financial_hold_tenant_read on public.subscription_financial_holds for select to authenticated using(private.has_org_role(organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'])or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR']));
grant select on public.subscription_financial_holds to authenticated;

create table public.subscription_adjustment_suspensions(subscription_id uuid primary key references public.subscriptions(id),suspended_row_version bigint not null);
alter table public.subscription_adjustment_suspensions enable row level security;
revoke all on public.subscription_adjustment_suspensions from public,anon,authenticated,service_role;

create function public.request_subscription_refund_v1(p_payment_event_id bigint,p_amount_minor bigint,p_reason text,p_idempotency_key uuid)returns uuid
language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid();pay public.subscription_payment_events%rowtype;r public.subscription_refund_requests%rowtype;reserved bigint;refunded bigint;
begin
 if a is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)then raise exception'REFUND_REQUEST_DENIED'using errcode='42501';end if;
 select * into pay from public.subscription_payment_events where id=p_payment_event_id for update;
 if not found or pay.gateway<>'PAYPAL'then raise exception'PAYPAL_CAPTURE_REQUIRED'using errcode='23514';end if;
 if p_amount_minor is null or p_amount_minor<=0 or p_idempotency_key is null or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 then raise exception'INVALID_REFUND_REQUEST'using errcode='22023';end if;
 select * into r from public.subscription_refund_requests where idempotency_key=p_idempotency_key;
 if found then if r.payment_event_id<>pay.id or r.amount_minor<>p_amount_minor or r.reason<>p_reason or r.requested_by<>a then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return r.id;end if;
 select coalesce(sum(amount_minor),0)into reserved from public.subscription_refund_requests where payment_event_id=pay.id and status not in('CONFIRMED','CANCELLED');
 select coalesce(sum(amount_minor),0)into refunded from public.subscription_payment_adjustments where payment_event_id=pay.id and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED');
 if reserved+refunded+p_amount_minor>pay.amount_minor then raise exception'REFUND_EXCEEDS_AVAILABLE_PAYMENT'using errcode='23514';end if;
 insert into public.subscription_refund_requests(payment_event_id,amount_minor,currency,reason,requested_by,idempotency_key)values(pay.id,p_amount_minor,pay.currency,p_reason,a,p_idempotency_key)returning*into r;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(pay.organization_id,a,'USER','subscription.refund.requested','subscription_refund_request',r.id::text,r.id,jsonb_build_object('amount_minor',r.amount_minor,'currency',r.currency),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(pay.organization_id,'subscription_refund_request',r.id::text,'SubscriptionRefundRequestedV1',r.id,jsonb_build_object('refund_request_id',r.id),'refund-request:'||r.id::text);
 return r.id;
end$$;
create function public.decide_subscription_refund_v1(p_request_id uuid,p_approve boolean)returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid();r public.subscription_refund_requests%rowtype;pay public.subscription_payment_events%rowtype;
begin
 if a is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)then raise exception'REFUND_APPROVAL_DENIED'using errcode='42501';end if;
 select * into r from public.subscription_refund_requests where id=p_request_id for update;
 if not found or p_approve is null then raise exception'REFUND_REQUEST_NOT_FOUND'using errcode='P0002';end if;
 if r.requested_by=a then raise exception'FOUR_EYES_REQUIRED'using errcode='42501';end if;
 if not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],r.requested_by)then raise exception'REQUESTER_AUTHORIZATION_REVOKED'using errcode='42501';end if;
 if r.status<>'PENDING_APPROVAL'then return jsonb_build_object('outcome','REFUND_ALREADY_DECIDED','status',r.status);end if;
 select*into pay from public.subscription_payment_events where id=r.payment_event_id;
 update public.subscription_refund_requests set status=case when p_approve then'AUTHORIZED'else'CANCELLED'end,approved_by=a,approved_at=clock_timestamp()where id=r.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(pay.organization_id,a,'USER','subscription.refund.decided','subscription_refund_request',r.id::text,r.id,jsonb_build_object('approved',p_approve),repeat('0',64));
 if not p_approve then insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(pay.organization_id,'subscription_refund_request',r.id::text,'SubscriptionRefundCancelledV1',r.id,jsonb_build_object('refund_request_id',r.id),'refund-cancel:'||r.id::text);end if;
 if p_approve then insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(pay.organization_id,'subscription_refund_request',r.id::text,'SubscriptionRefundAuthorizedV1',r.id,jsonb_build_object('refund_request_id',r.id),'subscription-refund:'||r.id::text);end if;
 return jsonb_build_object('outcome',case when p_approve then'REFUND_AUTHORIZED'else'REFUND_CANCELLED'end);
end$$;
create function public.prepare_subscription_refund_send_v1(p_request_id uuid)returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare r public.subscription_refund_requests%rowtype;pay public.subscription_payment_events%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 select*into r from public.subscription_refund_requests where id=p_request_id for update;
 if not found then raise exception'REFUND_REQUEST_NOT_FOUND'using errcode='P0002';end if;
 if r.status in('AWAITING_WEBHOOK','CONFIRMED')then return jsonb_build_object('outcome','REFUND_ALREADY_SUBMITTED');end if;
 if r.status<>'AUTHORIZED'or r.approved_by is null or r.requested_by=r.approved_by or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],r.approved_by)or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],r.requested_by)then raise exception'REFUND_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 select*into pay from public.subscription_payment_events where id=r.payment_event_id for update;
 if coalesce((select sum(amount_minor)from public.subscription_payment_adjustments where payment_event_id=pay.id and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED')),0)+r.amount_minor>pay.amount_minor then raise exception'REFUND_EXCEEDS_AVAILABLE_PAYMENT'using errcode='23514';end if;
 if exists(select 1 from public.subscription_financial_holds where payment_event_id=pay.id and active)then raise exception'PAYMENT_DISPUTE_REQUIRES_RECONCILIATION'using errcode='55000';end if;
 update public.subscription_refund_requests set status='SENDING',first_attempt_at=clock_timestamp()where id=r.id;
 return jsonb_build_object('outcome','REFUND_SEND_AUTHORIZED','capture_id',pay.payment_reference,'amount_minor',r.amount_minor::text,'currency',r.currency,'idempotency_key',r.id);
end$$;
create function public.record_subscription_refund_send_v1(p_request_id uuid,p_provider_refund_id text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare r public.subscription_refund_requests%rowtype;confirmed boolean;pay public.subscription_payment_events%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 select*into r from public.subscription_refund_requests where id=p_request_id for update;
 if not found or r.status not in('SENDING','AWAITING_WEBHOOK','CONFIRMED','RECONCILIATION_REQUIRED')then raise exception'REFUND_SEND_STATE_INVALID'using errcode='55000';end if;
 if p_provider_refund_id is not null and p_provider_refund_id!~'^[A-Z0-9-]{8,200}$'then raise exception'INVALID_REFUND_PROVIDER_ID'using errcode='22023';end if;
 if r.provider_refund_id is not null and r.provider_refund_id is distinct from p_provider_refund_id then raise exception'REFUND_PROVIDER_ID_MISMATCH'using errcode='22000';end if;
 confirmed:=exists(select 1 from public.subscription_payment_adjustments where payment_event_id=r.payment_event_id and event_type='REFUND_SUCCEEDED'and provider_adjustment_id=p_provider_refund_id and amount_minor=r.amount_minor and currency=r.currency);
 update public.subscription_refund_requests set provider_refund_id=p_provider_refund_id,status=case when confirmed then'CONFIRMED'when p_provider_refund_id is not null then'AWAITING_WEBHOOK'else'RECONCILIATION_REQUIRED'end where id=r.id;
 select*into pay from public.subscription_payment_events where id=r.payment_event_id;
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(pay.organization_id,'subscription_refund_request',r.id::text,'SubscriptionRefundSubmissionRecordedV1',r.id,jsonb_build_object('refund_request_id',r.id,'accepted',p_provider_refund_id is not null,'confirmed',confirmed),'refund-submission:'||r.id::text||':'||coalesce(p_provider_refund_id,'unknown'))on conflict do nothing;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(pay.organization_id,'SERVICE','subscription.refund.submission_recorded','subscription_refund_request',r.id::text,r.id,jsonb_build_object('accepted',p_provider_refund_id is not null,'confirmed',confirmed),repeat('0',64));
 return jsonb_build_object('outcome',case when confirmed then'REFUND_CONFIRMED'when p_provider_refund_id is not null then'REFUND_AWAITING_WEBHOOK'else'REFUND_RECONCILIATION_REQUIRED'end);
end$$;

create function public.process_verified_subscription_adjustment_v1(p_provider_event_id text,p_provider_payment_id text,p_provider_adjustment_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_occurred_at timestamptz,p_payload_hash text,p_signature_fingerprint text,p_merchant_reference uuid default null,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare pay public.subscription_payment_events%rowtype;prior public.subscription_payment_adjustments%rowtype;total bigint;cash uuid;counter uuid;j uuid;adjustment uuid;sub public.subscriptions%rowtype;held boolean;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 if p_event_type is null or p_event_type not in('REFUND_SUCCEEDED','PAYMENT_REVERSED','DISPUTE_OPENED','DISPUTE_WON','DISPUTE_LOST')or p_amount_minor is null or p_amount_minor<=0 or p_currency is null or p_currency!~'^[A-Z]{3}$'or p_payload_hash is null or p_payload_hash!~'^[0-9a-f]{64}$'or p_signature_fingerprint is null or p_signature_fingerprint!~'^[0-9a-f]{64}$'or p_occurred_at is null or p_occurred_at>clock_timestamp()+interval'5 minutes'or length(coalesce(p_provider_event_id,''))not between 8 and 200 or length(coalesce(p_provider_adjustment_id,''))not between 8 and 200 then raise exception'INVALID_PAYMENT_ADJUSTMENT'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('paypal-adjustment:'||p_provider_event_id,0));
 select*into pay from public.subscription_payment_events where gateway='PAYPAL'and payment_reference=p_provider_payment_id for update;
 if not found then raise exception'CAPTURE_NOT_YET_RECORDED'using errcode='P0002';end if;
 if p_currency<>pay.currency or p_amount_minor>pay.amount_minor or p_occurred_at<pay.paid_at-interval'5 minutes'then raise exception'PAYMENT_ADJUSTMENT_MISMATCH'using errcode='23514';end if;
 select*into prior from public.subscription_payment_adjustments where gateway='PAYPAL'and provider_event_id=p_provider_event_id;
 if found then if prior.payment_event_id<>pay.id or prior.payload_hash<>p_payload_hash or prior.event_type<>p_event_type or prior.amount_minor<>p_amount_minor or prior.provider_adjustment_id<>p_provider_adjustment_id then raise exception'PAYMENT_EVENT_REPLAY_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','PAYMENT_ADJUSTMENT_REPLAYED','replayed',true);end if;
 select*into prior from public.subscription_payment_adjustments where gateway='PAYPAL'and event_type=p_event_type and provider_adjustment_id=p_provider_adjustment_id;
 if found then if prior.payment_event_id<>pay.id or prior.amount_minor<>p_amount_minor or prior.currency<>p_currency then raise exception'PAYMENT_RESOURCE_REPLAY_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','PAYMENT_RESOURCE_ALREADY_RECORDED','replayed',true);end if;
 if p_event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED')then
  select coalesce(sum(amount_minor),0)into total from public.subscription_payment_adjustments where payment_event_id=pay.id and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED');
  if total+p_amount_minor>pay.amount_minor then raise exception'REFUND_EXCEEDS_PAYMENT'using errcode='23514';end if;
  select id into cash from public.financial_accounts where organization_id=pay.organization_id and code='PAYMENT_CASH_'||btrim(pay.currency::text);
  insert into public.financial_accounts(organization_id,code,name,account_type,currency)values(pay.organization_id,'SUBSCRIPTION_ADJUSTMENT_'||btrim(pay.currency::text),'Subscription refunds and reversals','EXPENSE',pay.currency)on conflict(organization_id,code)do nothing;
  select id into counter from public.financial_accounts where organization_id=pay.organization_id and code='SUBSCRIPTION_ADJUSTMENT_'||btrim(pay.currency::text);
  if cash is null or counter is null then raise exception'PAYMENT_LEDGER_ACCOUNTS_INVALID'using errcode='23514';end if;
  j:=extensions.gen_random_uuid();
  insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)select j,pay.organization_id,'SUBSCRIPTION_ADJUSTMENT',pay.currency,'subscription.adjustment','PAYPAL:'||p_provider_event_id,p_correlation_id,p_occurred_at,'Verified subscription refund or reversal',i.created_by from public.subscription_payment_intents i where i.id=pay.payment_intent_id;
  insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(pay.organization_id,j,counter,'DEBIT',p_amount_minor,p_currency),(pay.organization_id,j,cash,'CREDIT',p_amount_minor,p_currency);
 end if;
 insert into public.subscription_payment_adjustments(payment_event_id,gateway,provider_event_id,provider_adjustment_id,event_type,amount_minor,currency,payload_hash,signature_fingerprint,occurred_at,financial_journal_id,correlation_id)values(pay.id,'PAYPAL',p_provider_event_id,p_provider_adjustment_id,p_event_type,p_amount_minor,p_currency,p_payload_hash,p_signature_fingerprint,p_occurred_at,j,p_correlation_id)returning id into adjustment;
 if p_event_type='REFUND_SUCCEEDED'then
  if p_merchant_reference is not null and not exists(select 1 from public.subscription_refund_requests where id=p_merchant_reference and payment_event_id=pay.id and amount_minor=p_amount_minor and currency=p_currency and status in('SENDING','AWAITING_WEBHOOK','RECONCILIATION_REQUIRED','CONFIRMED')and(provider_refund_id is null or provider_refund_id=p_provider_adjustment_id))then raise exception'REFUND_MERCHANT_REFERENCE_MISMATCH'using errcode='23514';end if;
  update public.subscription_refund_requests set status='CONFIRMED',provider_refund_id=p_provider_adjustment_id where payment_event_id=pay.id and(provider_refund_id=p_provider_adjustment_id or id=p_merchant_reference)and amount_minor=p_amount_minor and currency=p_currency;
 end if;
 select coalesce(sum(amount_minor),0)>=pay.amount_minor into held from public.subscription_payment_adjustments where payment_event_id=pay.id and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED');
 held:=held or exists(select 1 from(select distinct on(provider_adjustment_id)event_type from public.subscription_payment_adjustments where payment_event_id=pay.id and event_type in('DISPUTE_OPENED','DISPUTE_WON','DISPUTE_LOST')order by provider_adjustment_id,occurred_at desc,case event_type when'DISPUTE_OPENED'then 0 else 1 end desc)latest where event_type in('DISPUTE_OPENED','DISPUTE_LOST'));
 insert into public.subscription_financial_holds(payment_event_id,organization_id,active,reason_code)values(pay.id,pay.organization_id,held,case when held then'PAYMENT_ADJUSTMENT_HOLD'else'PAYMENT_ADJUSTMENT_REVIEW'end)on conflict(payment_event_id)do update set active=excluded.active,reason_code=excluded.reason_code,updated_at=clock_timestamp();
 select*into sub from public.subscriptions where organization_id=pay.organization_id for update;
 if held and sub.status='ACTIVE'then
  update public.subscriptions set status='SUSPENDED',row_version=row_version+1,updated_at=clock_timestamp()where id=sub.id;
  insert into public.subscription_adjustment_suspensions(subscription_id,suspended_row_version)values(sub.id,sub.row_version+1)on conflict(subscription_id)do update set suspended_row_version=excluded.suspended_row_version;
  insert into public.subscription_state_events(subscription_id,organization_id,from_status,to_status,reason_code,idempotency_key,correlation_id,actor_user_id)select sub.id,pay.organization_id,sub.status,'SUSPENDED','PAYMENT_ADJUSTMENT_HOLD','adjustment:'||p_provider_event_id,p_correlation_id,i.created_by from public.subscription_payment_intents i where i.id=pay.payment_intent_id;
 end if;
 -- Restore only a suspension introduced by this lifecycle, never an administrator's later decision.
 if not held and sub.status='SUSPENDED'and not exists(select 1 from public.subscription_financial_holds where organization_id=pay.organization_id and active)and exists(select 1 from public.subscription_adjustment_suspensions where subscription_id=sub.id and suspended_row_version=sub.row_version)then
  update public.subscriptions set status=case when current_period_end>clock_timestamp()then'ACTIVE'else'PAST_DUE'end,row_version=row_version+1,updated_at=clock_timestamp()where id=sub.id;
  insert into public.subscription_state_events(subscription_id,organization_id,from_status,to_status,reason_code,idempotency_key,correlation_id,actor_user_id)select sub.id,pay.organization_id,'SUSPENDED',case when sub.current_period_end>clock_timestamp()then'ACTIVE'else'PAST_DUE'end,'PAYMENT_DISPUTE_CLEARED','adjustment-clear:'||p_provider_event_id,p_correlation_id,i.created_by from public.subscription_payment_intents i where i.id=pay.payment_intent_id;
 end if;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(pay.organization_id,'SERVICE','subscription.payment.adjusted','subscription_payment_adjustment',adjustment::text,p_correlation_id,jsonb_build_object('event_type',p_event_type,'amount_minor',p_amount_minor,'currency',p_currency,'financial_journal_id',j,'hold',held),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(pay.organization_id,'subscription_payment_adjustment',adjustment::text,'SubscriptionPaymentAdjustedV1',p_correlation_id,jsonb_build_object('adjustment_id',adjustment,'payment_event_id',pay.id::text,'type',p_event_type,'hold',held),'adjustment:'||p_provider_event_id);
 return jsonb_build_object('outcome','PAYMENT_ADJUSTMENT_RECORDED','adjustment_id',adjustment,'hold',held,'replayed',false);
end$$;

create function public.list_subscription_refund_operations_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
begin
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER','MATRICIA_ADMIN','READ_ONLY_AUDITOR'],auth.uid())then raise exception'FORBIDDEN'using errcode='42501';end if;
 return jsonb_build_object('can_act',private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid()),
 'payments',coalesce((select jsonb_agg(row_to_json(q))from(select p.id::text,p.organization_id,p.amount_minor::text,p.currency,p.paid_at,coalesce((select sum(a.amount_minor)from public.subscription_payment_adjustments a where a.payment_event_id=p.id and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED')),0)::text as refunded_minor from public.subscription_payment_events p where gateway='PAYPAL'order by p.id desc limit 100)q),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(row_to_json(q))from(select r.id,r.payment_event_id::text,r.amount_minor::text,r.currency,r.reason,r.status,r.requested_at,r.requested_by<>auth.uid()as other_requester from public.subscription_refund_requests r order by requested_at desc limit 100)q),'[]'::jsonb));
end$$;
revoke all on function public.request_subscription_refund_v1(bigint,bigint,text,uuid),public.decide_subscription_refund_v1(uuid,boolean),public.list_subscription_refund_operations_v1()from public,anon,service_role;
grant execute on function public.request_subscription_refund_v1(bigint,bigint,text,uuid),public.decide_subscription_refund_v1(uuid,boolean),public.list_subscription_refund_operations_v1()to authenticated;
revoke all on function public.prepare_subscription_refund_send_v1(uuid),public.record_subscription_refund_send_v1(uuid,text),public.process_verified_subscription_adjustment_v1(text,text,text,text,bigint,character,timestamptz,text,text,uuid,uuid)from public,anon,authenticated;
grant execute on function public.prepare_subscription_refund_send_v1(uuid),public.record_subscription_refund_send_v1(uuid,text),public.process_verified_subscription_adjustment_v1(text,text,text,text,bigint,character,timestamptz,text,text,uuid,uuid)to service_role;
notify pgrst,'reload schema';
