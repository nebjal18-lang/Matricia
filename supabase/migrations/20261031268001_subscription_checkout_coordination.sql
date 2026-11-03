begin;
-- A preparation is already potentially payable. No timeout releases another charge.
create table private.subscription_checkout_attempts_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),subscription_id uuid not null references public.subscriptions(id),preparation_id uuid not null unique references public.subscription_payment_preparations(id),payment_intent_id uuid unique references public.subscription_payment_intents(id),idempotency_key text not null,target_row_version bigint not null,
 state text not null check(state in('PREPARED','CREATE_REQUESTED','REGISTERED','CAPTURE_REQUESTED','SETTLED','RECONCILIATION_REQUIRED','CANCELLED_VERIFIED')),posting_context_id uuid,capture_operation_key uuid,reason_code text,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),row_version bigint not null default 1,unique(organization_id,idempotency_key)
);
create unique index subscription_checkout_one_unresolved_v1 on private.subscription_checkout_attempts_v1(organization_id)where state not in('SETTLED','CANCELLED_VERIFIED');
create table private.subscription_capture_receipts_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid references public.organizations(id),payment_intent_id uuid references public.subscription_payment_intents(id),attempt_id uuid references private.subscription_checkout_attempts_v1(id),gateway text not null check(gateway in('DEMO','PAYPAL','CMI')),provider_environment text not null check(provider_environment in('DEMO','SANDBOX','LIVE')),provider_intent_id text not null,payment_reference text not null,provider_event_id text not null,amount_minor bigint not null check(amount_minor>0),currency char(3)not null,paid_at timestamptz not null,payload_hash text not null check(payload_hash~'^[a-f0-9]{64}$'),signature_fingerprint text check(signature_fingerprint~'^[a-f0-9]{64}$'),verification_method text not null check(verification_method in('WEBHOOK_SIGNATURE','API_OAUTH2_TLS','DEMO_SIMULATION')),check((verification_method='API_OAUTH2_TLS')=(signature_fingerprint is null)),first_correlation_id uuid not null,
 state text not null check(state in('RECEIVED','APPLIED','RECONCILIATION_REQUIRED','PENDING_LEDGER_CONFIGURATION')),posting_context_id uuid,financial_journal_id uuid references public.financial_journals(id),activation_result jsonb,reason_code text,work_item_id uuid references public.admin_work_items(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(gateway,provider_environment,payment_reference)
);
create table private.subscription_capture_deliveries_v1(
 id bigint generated always as identity primary key,receipt_id uuid not null references private.subscription_capture_receipts_v1(id),gateway text not null,provider_environment text not null,provider_event_id text not null,payload_hash text not null,signature_fingerprint text,verification_method text not null,received_at timestamptz not null default clock_timestamp(),unique nulls not distinct(gateway,provider_environment,provider_event_id,signature_fingerprint)
);
create table private.subscription_checkout_native_resolutions_v1(
 id uuid primary key default extensions.gen_random_uuid(),attempt_id uuid not null references private.subscription_checkout_attempts_v1(id),provider_intent_id text not null,provider_environment text not null,native_status text not null check(native_status='VOIDED'),response_hash text not null check(response_hash~'^[a-f0-9]{64}$'),verification_method text not null default'API_OAUTH2_TLS'check(verification_method='API_OAUTH2_TLS'),observed_at timestamptz not null,correlation_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),unique(attempt_id,response_hash)
);
revoke all on private.subscription_checkout_attempts_v1,private.subscription_capture_receipts_v1,private.subscription_capture_deliveries_v1,private.subscription_checkout_native_resolutions_v1 from public,anon,authenticated,service_role;
create trigger subscription_capture_deliveries_immutable before update or delete on private.subscription_capture_deliveries_v1 for each row execute function private.prevent_update_delete();
create trigger subscription_native_resolutions_immutable before update or delete on private.subscription_checkout_native_resolutions_v1 for each row execute function private.prevent_update_delete();
create function private.guard_subscription_receipt_source_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if tg_op='DELETE'then raise exception'PAYMENT_RECEIPT_IMMUTABLE'using errcode='55000';end if;
 if row(new.id,new.organization_id,new.payment_intent_id,new.gateway,new.provider_environment,new.provider_intent_id,new.payment_reference,new.provider_event_id,new.amount_minor,new.currency,new.paid_at,new.payload_hash,new.signature_fingerprint,new.verification_method,new.first_correlation_id,new.created_at)is distinct from row(old.id,old.organization_id,old.payment_intent_id,old.gateway,old.provider_environment,old.provider_intent_id,old.payment_reference,old.provider_event_id,old.amount_minor,old.currency,old.paid_at,old.payload_hash,old.signature_fingerprint,old.verification_method,old.first_correlation_id,old.created_at)then raise exception'PAYMENT_RECEIPT_IMMUTABLE'using errcode='55000';end if;return new;
end$$;
create trigger subscription_capture_receipt_source_immutable before update or delete on private.subscription_capture_receipts_v1 for each row execute function private.guard_subscription_receipt_source_v1();
revoke all on function private.guard_subscription_receipt_source_v1()from public,anon,authenticated,service_role;
-- The admission guard268000 remains private and is called before a new attempt is created.
alter function private.prepare_subscription_payment_context_core_v1(uuid,uuid,text,text,text,text,boolean)rename to prepare_subscription_payment_admission_v1;
create function private.prepare_subscription_payment_context_core_v1(p_organization_id uuid,p_plan_version_id uuid,p_billing_interval text,p_gateway text,p_idempotency_key text,p_provider_environment text,p_legacy boolean default false)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare attempt private.subscription_checkout_attempts_v1%rowtype;other private.subscription_checkout_attempts_v1%rowtype;preparation jsonb;ctx jsonb;s public.subscriptions%rowtype;intent public.subscription_payment_intents%rowtype;pay public.subscription_payment_events%rowtype;begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_INTENT_CREATE_DENIED'using errcode='42501';end if;
 perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,p_legacy);perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 if not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_INTENT_CREATE_DENIED'using errcode='42501';end if;
 select*into attempt from private.subscription_checkout_attempts_v1 where organization_id=p_organization_id and idempotency_key=p_idempotency_key for update;
 if attempt.id is not null and attempt.state in('RECONCILIATION_REQUIRED','CANCELLED_VERIFIED')then raise exception'SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 if attempt.id is null then
  select*into other from private.subscription_checkout_attempts_v1 where organization_id=p_organization_id and state not in('SETTLED','CANCELLED_VERIFIED');
  if other.id is not null then raise exception'SUBSCRIPTION_CHECKOUT_ALREADY_PENDING'using errcode='55000';end if;
 end if;
 preparation:=private.prepare_subscription_payment_admission_v1(p_organization_id,p_plan_version_id,p_billing_interval,p_gateway,p_idempotency_key,p_provider_environment,p_legacy);
 if attempt.id is not null then
  if attempt.preparation_id is distinct from(preparation->>'preparation_id')::uuid then raise exception'CHECKOUT_PREPARATION_MISMATCH'using errcode='23514';end if;
  select*into intent from public.subscription_payment_intents where id=attempt.payment_intent_id;select*into pay from public.subscription_payment_events where payment_intent_id=intent.id and event_type='PAYMENT_SUCCEEDED';
  return preparation||jsonb_build_object('checkout_attempt_id',attempt.id,'checkout_state',attempt.state,'payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'payment_result',pay.activation_result,'create_authorized',false);
 end if;
 select*into s from public.subscriptions where organization_id=p_organization_id;
 select*into intent from public.subscription_payment_intents where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 select*into pay from public.subscription_payment_events where payment_intent_id=intent.id and event_type='PAYMENT_SUCCEEDED';
 -- An authorized historical replay does not retrofit a new accounting policy or call the PSP again.
 if pay.id is null then
  if to_regprocedure('private.prepare_payment_posting_context_v1(uuid,uuid,text,uuid,character,text,text)')is null then raise exception'PAYMENT_POSTING_CONFIGURATION_REQUIRED'using errcode='55000';end if;
  ctx:=private.prepare_payment_posting_context_v1((preparation->>'preparation_id')::uuid,p_organization_id,'SUBSCRIPTION',p_plan_version_id,(preparation->>'currency')::char(3),p_gateway,p_provider_environment);
  if coalesce(ctx->>'posting_context_id','')!~'^[a-f0-9-]{36}$'then raise exception'PAYMENT_POSTING_CONFIGURATION_REQUIRED'using errcode='55000';end if;
 end if;
 insert into private.subscription_checkout_attempts_v1(organization_id,subscription_id,preparation_id,payment_intent_id,idempotency_key,target_row_version,state,posting_context_id,capture_operation_key)values(p_organization_id,s.id,(preparation->>'preparation_id')::uuid,intent.id,p_idempotency_key,s.row_version,case when pay.id is not null then'SETTLED'when intent.id is not null then'REGISTERED'else'CREATE_REQUESTED'end,(ctx->>'posting_context_id')::uuid,intent.id)returning*into attempt;
 return preparation||jsonb_build_object('checkout_attempt_id',attempt.id,'checkout_state',attempt.state,'payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'payment_result',pay.activation_result,'create_authorized',intent.id is null);
end$$;
alter function public.register_subscription_payment_intent_v2(uuid,text,text,bigint,character,uuid)set schema private;
alter function private.register_subscription_payment_intent_v2(uuid,text,text,bigint,character,uuid)rename to register_subscription_intent_before_coordination_v2;
create function public.register_subscription_payment_intent_v2(p_preparation_id uuid,p_provider_environment text,p_provider_intent_id text,p_amount_minor bigint,p_currency char(3),p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare p public.subscription_payment_preparations%rowtype;a private.subscription_checkout_attempts_v1%rowtype;r jsonb;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_SERVER_REGISTRATION_REQUIRED'using errcode='42501';end if;
 select*into p from public.subscription_payment_preparations where id=p_preparation_id;if p.id is null then raise exception'PAYMENT_PREPARATION_NOT_FOUND'using errcode='P0002';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p.organization_id::text,0));select*into a from private.subscription_checkout_attempts_v1 where preparation_id=p.id for update;
 if a.id is null or a.state not in('PREPARED','CREATE_REQUESTED','REGISTERED','CAPTURE_REQUESTED','SETTLED')then raise exception'SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 r:=private.register_subscription_intent_before_coordination_v2(p_preparation_id,p_provider_environment,p_provider_intent_id,p_amount_minor,p_currency,p_correlation_id);
 if a.payment_intent_id is not null and a.payment_intent_id is distinct from(r->>'payment_intent_id')::uuid then raise exception'CHECKOUT_INTENT_IMMUTABLE'using errcode='23514';end if;
 if a.payment_intent_id is null then update private.subscription_checkout_attempts_v1 set payment_intent_id=(r->>'payment_intent_id')::uuid,capture_operation_key=(r->>'payment_intent_id')::uuid,state='REGISTERED',updated_at=clock_timestamp(),row_version=row_version+1 where id=a.id;end if;return r;
end$$;
-- A repeated capture can only refer to the SAME stored native order and stable operation key.
create or replace function public.prepare_subscription_payment_capture_v2(p_payment_intent_id uuid,p_provider_environment text)returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,private as $$
declare intent public.subscription_payment_intents%rowtype;p public.subscription_payment_preparations%rowtype;a private.subscription_checkout_attempts_v1%rowtype;other private.subscription_checkout_attempts_v1%rowtype;pay public.subscription_payment_events%rowtype;receipt private.subscription_capture_receipts_v1%rowtype;ctx jsonb;s public.subscriptions%rowtype;begin
 select*into intent from public.subscription_payment_intents where id=p_payment_intent_id;
 if auth.uid()is null or intent.id is null or not private.has_org_role(intent.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_CAPTURE_DENIED'using errcode='42501';end if;
 perform private.require_payment_intent_runtime_v1(intent.id,p_provider_environment);if intent.gateway<>'PAYPAL'then raise exception'PAYPAL_INTENT_REQUIRED'using errcode='22023';end if;
 select*into pay from public.subscription_payment_events where payment_intent_id=intent.id and event_type='PAYMENT_SUCCEEDED';
 if pay.id is not null then return jsonb_build_object('payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'replayed',true,'activation_result',pay.activation_result);end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||intent.organization_id::text,0));
 if not private.has_org_role(intent.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_CAPTURE_DENIED'using errcode='42501';end if;
 select*into pay from public.subscription_payment_events where payment_intent_id=intent.id and event_type='PAYMENT_SUCCEEDED';
 if pay.id is not null then return jsonb_build_object('payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'replayed',true,'activation_result',pay.activation_result);end if;
 select*into receipt from private.subscription_capture_receipts_v1 where payment_intent_id=intent.id;
 if receipt.id is not null then raise exception'SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 select*into a from private.subscription_checkout_attempts_v1 where payment_intent_id=intent.id for update;
 if a.id is null then
  select*into other from private.subscription_checkout_attempts_v1 where organization_id=intent.organization_id and state not in('SETTLED','CANCELLED_VERIFIED');
  if other.id is not null then raise exception'SUBSCRIPTION_CHECKOUT_ALREADY_PENDING'using errcode='55000';end if;
  perform private.assert_subscription_checkout_activatable_v1(intent.organization_id);
  select*into p from public.subscription_payment_preparations where organization_id=intent.organization_id and idempotency_key=intent.idempotency_key;
  if p.id is null or to_regprocedure('private.prepare_payment_posting_context_v1(uuid,uuid,text,uuid,character,text,text)')is null then raise exception'PAYMENT_POSTING_CONFIGURATION_REQUIRED'using errcode='55000';end if;
  ctx:=private.prepare_payment_posting_context_v1(p.id,p.organization_id,'SUBSCRIPTION',p.plan_version_id,p.currency,p.gateway,p.provider_environment);select*into s from public.subscriptions where organization_id=p.organization_id;
  insert into private.subscription_checkout_attempts_v1(organization_id,subscription_id,preparation_id,payment_intent_id,idempotency_key,target_row_version,state,posting_context_id,capture_operation_key)values(p.organization_id,s.id,p.id,intent.id,p.idempotency_key,s.row_version,'REGISTERED',(ctx->>'posting_context_id')::uuid,intent.id)returning*into a;
 end if;
 if a.state not in('REGISTERED','CAPTURE_REQUESTED')then raise exception'SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 perform private.assert_subscription_checkout_activatable_v1(intent.organization_id);
 if a.posting_context_id is null then raise exception'PAYMENT_POSTING_CONFIGURATION_REQUIRED'using errcode='55000';end if;
 update private.subscription_checkout_attempts_v1 set state='CAPTURE_REQUESTED',updated_at=clock_timestamp(),row_version=row_version+1 where id=a.id and state='REGISTERED';
 return jsonb_build_object('payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'capture_operation_key',a.capture_operation_key,'capture_authorized',a.state='REGISTERED','replayed',false,'checkout_attempt_id',a.id);
end$$;
revoke all on function private.prepare_subscription_payment_admission_v1(uuid,uuid,text,text,text,text,boolean),private.prepare_subscription_payment_context_core_v1(uuid,uuid,text,text,text,text,boolean),private.register_subscription_intent_before_coordination_v2(uuid,text,text,bigint,character,uuid)from public,anon,authenticated,service_role;
revoke all on function public.register_subscription_payment_intent_v2(uuid,text,text,bigint,character,uuid)from public,anon,authenticated,service_role;
grant execute on function public.register_subscription_payment_intent_v2(uuid,text,text,bigint,character,uuid)to service_role;
-- Callback receipt import and native disposition are defined below in the same migration.
create function private.subscription_capture_review_work_v1(p_receipt_id uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,private as $$
declare r private.subscription_capture_receipts_v1%rowtype;i public.subscription_payment_intents%rowtype;q public.admin_queue_versions%rowtype;w uuid;begin
 select*into r from private.subscription_capture_receipts_v1 where id=p_receipt_id;select*into i from public.subscription_payment_intents where id=r.payment_intent_id;
 if r.id is null or r.state='APPLIED'or r.work_item_id is not null then return r.work_item_id;end if;
 select*into q from public.admin_queue_versions where queue_key='CENTRAL_APPROVALS'and status='ACTIVE';if q.id is null or i.created_by is null then return null;end if;
 insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)values(q.id,r.organization_id,'FINANCE','subscription_capture_receipt',r.id::text,'Encaissement reçu à rapprocher','دفعة مستلمة تتطلب المطابقة','HIGH',clock_timestamp()+interval'8 hours',jsonb_build_object('receipt_id',r.id,'reason_code',r.reason_code,'cash_journal_recorded',r.financial_journal_id is not null,'subscription_activated',false),i.created_by)on conflict(queue_version_id,source_kind,resource_type,resource_id)do nothing returning id into w;
 if w is null then select id into w from public.admin_work_items where queue_version_id=q.id and source_kind='FINANCE'and resource_type='subscription_capture_receipt'and resource_id=r.id::text;else
  insert into public.admin_work_item_events(work_item_id,event_type,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(w,'OPENED','OPEN',i.created_by,'Encaissement vérifié : rapprochement métier ou comptable requis',jsonb_build_object('receipt_id',r.id,'reason_code',r.reason_code),r.first_correlation_id);
 end if;
 update private.subscription_capture_receipts_v1 set work_item_id=w where id=r.id;return w;
end$$;
create function private.subscription_capture_adverse_or_unconfigured_v1(p_gateway text,p_provider_environment text,p_payment_reference text)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if to_regprocedure('private.payment_capture_has_adverse_fact_v1(text,text,text)')is null then return true;end if;
 return private.payment_capture_has_adverse_fact_v1(p_gateway,p_provider_environment,p_payment_reference);
end$$;
revoke all on function private.subscription_capture_adverse_or_unconfigured_v1(text,text,text)from public,anon,authenticated,service_role;
create function private.retain_subscription_capture_v1(p_provider_environment text,p_gateway text,p_provider_event_id text,p_provider_intent_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_payment_reference text,p_payload_hash text,p_signature_fingerprint text,p_correlation_id uuid,p_verification_method text default'WEBHOOK_SIGNATURE')returns jsonb language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare i public.subscription_payment_intents%rowtype;p public.subscription_payment_preparations%rowtype;existing public.subscription_payment_events%rowtype;a private.subscription_checkout_attempts_v1%rowtype;r private.subscription_capture_receipts_v1%rowtype;delivery private.subscription_capture_deliveries_v1%rowtype;ctx jsonb;result jsonb;journal uuid;failure text;first_corr uuid;begin
 if p_gateway not in('DEMO','PAYPAL','CMI')or p_gateway is null or p_provider_environment not in('DEMO','SANDBOX','LIVE')or p_provider_environment is null or p_event_type is distinct from'PAYMENT_SUCCEEDED'or p_amount_minor is null or p_amount_minor<=0 or p_currency is null or p_currency!~'^[A-Z]{3}$'or length(coalesce(p_provider_event_id,''))not between 8 and 200 or length(coalesce(p_provider_intent_id,''))not between 8 and 200 or length(coalesce(p_payment_reference,''))not between 3 and 200 or coalesce(p_payload_hash,'')!~'^[a-f0-9]{64}$'or (p_verification_method='API_OAUTH2_TLS'and p_signature_fingerprint is not null)or(p_verification_method<>'API_OAUTH2_TLS'and coalesce(p_signature_fingerprint,'')!~'^[a-f0-9]{64}$')or p_paid_at is null or not isfinite(p_paid_at)or p_paid_at>clock_timestamp()+interval'5 minutes'or p_correlation_id is null or p_verification_method is null or p_verification_method not in('WEBHOOK_SIGNATURE','API_OAUTH2_TLS','DEMO_SIMULATION')or (p_gateway='DEMO')is distinct from(p_provider_environment='DEMO')or(p_gateway='DEMO')is distinct from(p_verification_method='DEMO_SIMULATION')then raise exception'INVALID_VERIFIED_PAYMENT_EVENT'using errcode='22023';end if;
 -- Non-live notifications cannot create simulated cash in a production/unknown database.
 if p_provider_environment<>'LIVE'then perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,false);end if;
 select*into i from public.subscription_payment_intents where gateway=p_gateway and provider_intent_id=p_provider_intent_id and provider_environment=p_provider_environment;
 if i.id is not null then perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||i.organization_id::text,0));end if;
 perform pg_advisory_xact_lock(hashtextextended('verified-subscription-capture:'||p_gateway||':'||p_provider_environment||':'||p_payment_reference,0));
 select*into r from private.subscription_capture_receipts_v1 where gateway=p_gateway and provider_environment=p_provider_environment and payment_reference=p_payment_reference for update;
 select*into delivery from private.subscription_capture_deliveries_v1 where gateway=p_gateway and provider_environment=p_provider_environment and provider_event_id=p_provider_event_id limit 1;
 if delivery.id is not null and(r.id is null or delivery.receipt_id<>r.id or delivery.payload_hash<>p_payload_hash)then raise exception'PAYMENT_EVENT_REPLAY_MISMATCH'using errcode='22000';end if;
 if r.id is not null then
  if r.provider_intent_id<>p_provider_intent_id or r.amount_minor<>p_amount_minor or r.currency<>p_currency or r.paid_at<>p_paid_at then raise exception'PAYMENT_CAPTURE_REPLAY_MISMATCH'using errcode='22000';end if;
  insert into private.subscription_capture_deliveries_v1(receipt_id,gateway,provider_environment,provider_event_id,payload_hash,signature_fingerprint,verification_method)values(r.id,p_gateway,p_provider_environment,p_provider_event_id,p_payload_hash,p_signature_fingerprint,p_verification_method)on conflict do nothing;
  if p_verification_method='WEBHOOK_SIGNATURE'and r.verification_method='API_OAUTH2_TLS'and r.reason_code='NATIVE_CAPTURE_WEBHOOK_CONFIRMATION_REQUIRED'and r.financial_journal_id is not null then
   begin
    if private.subscription_capture_adverse_or_unconfigured_v1(p_gateway,p_provider_environment,p_payment_reference)then raise exception'VERIFIED_ADVERSE_PAYMENT_REVIEW_REQUIRED'using errcode='55000';end if;
    result:=private.process_subscription_payment_context_core_v1(p_provider_environment,p_gateway,p_provider_event_id,p_provider_intent_id,p_event_type,p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_payload_hash,p_signature_fingerprint,r.first_correlation_id);
    if result->>'outcome'is distinct from'SUBSCRIPTION_ACTIVATED'or result->>'financial_journal_id'is distinct from r.financial_journal_id::text then raise exception'PAYMENT_POSTING_SOURCE_MISMATCH'using errcode='23514';end if;
    update private.subscription_capture_receipts_v1 set state='APPLIED',activation_result=result,reason_code=null,updated_at=clock_timestamp()where id=r.id returning*into r;
    update private.subscription_checkout_attempts_v1 set state='SETTLED',reason_code=null,updated_at=clock_timestamp(),row_version=row_version+1 where payment_intent_id=i.id and state<>'SETTLED';
   exception when others then
    update private.subscription_capture_receipts_v1 set reason_code='SUBSCRIPTION_ACTIVATION_RECONCILIATION_REQUIRED',updated_at=clock_timestamp()where id=r.id returning*into r;
   end;
  end if;
  return coalesce(r.activation_result,jsonb_build_object('outcome','SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED','receipt_id',r.id,'receipt_state',r.state,'reason_code',r.reason_code))||jsonb_build_object('replayed',true);
 end if;
 select*into a from private.subscription_checkout_attempts_v1 where payment_intent_id=i.id;
 select*into p from public.subscription_payment_preparations where organization_id=i.organization_id and idempotency_key=i.idempotency_key;
 select*into existing from public.subscription_payment_events where payment_intent_id=i.id and gateway=p_gateway and provider_environment=p_provider_environment and payment_reference=p_payment_reference and amount_minor=p_amount_minor and currency=p_currency and paid_at=p_paid_at and event_type='PAYMENT_SUCCEEDED';
 first_corr:=coalesce(existing.correlation_id,p_correlation_id);
 insert into private.subscription_capture_receipts_v1(organization_id,payment_intent_id,attempt_id,gateway,provider_environment,provider_intent_id,payment_reference,provider_event_id,amount_minor,currency,paid_at,payload_hash,signature_fingerprint,verification_method,first_correlation_id,state,posting_context_id)values(i.organization_id,i.id,a.id,p_gateway,p_provider_environment,p_provider_intent_id,p_payment_reference,p_provider_event_id,p_amount_minor,p_currency,p_paid_at,p_payload_hash,p_signature_fingerprint,p_verification_method,first_corr,'RECEIVED',a.posting_context_id)returning*into r;
 insert into private.subscription_capture_deliveries_v1(receipt_id,gateway,provider_environment,provider_event_id,payload_hash,signature_fingerprint,verification_method)values(r.id,p_gateway,p_provider_environment,p_provider_event_id,p_payload_hash,p_signature_fingerprint,p_verification_method);
 if existing.id is not null then
  update private.subscription_capture_receipts_v1 set state='APPLIED',financial_journal_id=(existing.activation_result->>'financial_journal_id')::uuid,activation_result=existing.activation_result,updated_at=clock_timestamp()where id=r.id returning*into r;
 elsif exists(select 1 from public.subscription_payment_events where gateway=p_gateway and provider_environment=p_provider_environment and payment_reference=p_payment_reference)then
  update private.subscription_capture_receipts_v1 set state='RECONCILIATION_REQUIRED',reason_code='EXISTING_PAYMENT_SOURCE_MISMATCH',updated_at=clock_timestamp()where id=r.id returning*into r;
 elsif i.id is null then
  update private.subscription_capture_receipts_v1 set state='RECONCILIATION_REQUIRED',reason_code='PAYMENT_SOURCE_UNRESOLVED',updated_at=clock_timestamp()where id=r.id returning*into r;
 else
  -- Different old orders can still really settle. Pause the other payable attempt; never pretend it was voided.
  update private.subscription_checkout_attempts_v1 set state='RECONCILIATION_REQUIRED',reason_code='OTHER_NATIVE_CAPTURE_RECEIVED',updated_at=clock_timestamp(),row_version=row_version+1 where organization_id=i.organization_id and payment_intent_id is distinct from i.id and state not in('SETTLED','CANCELLED_VERIFIED');
  if r.posting_context_id is null and p.id is not null and to_regprocedure('private.get_payment_posting_context_v1(text,uuid)')is not null then
   begin ctx:=private.get_payment_posting_context_v1('SUBSCRIPTION',p.id);update private.subscription_capture_receipts_v1 set posting_context_id=(ctx->>'posting_context_id')::uuid where id=r.id returning*into r;exception when others then null;end;
  end if;
  if r.posting_context_id is null or to_regprocedure('private.post_verified_payment_suspense_v1(uuid,uuid,text,text,bigint,character,timestamptz,uuid,uuid)')is null then
   update private.subscription_capture_receipts_v1 set state='PENDING_LEDGER_CONFIGURATION',reason_code='PAYMENT_POSTING_CONFIGURATION_REQUIRED',updated_at=clock_timestamp()where id=r.id returning*into r;
  else
   begin
    journal:=private.post_verified_payment_suspense_v1(r.posting_context_id,i.organization_id,'SUBSCRIPTION',p_gateway||':'||p_provider_environment||':'||p_payment_reference,p_amount_minor,p_currency,p_paid_at,i.created_by,first_corr);
    update private.subscription_capture_receipts_v1 set financial_journal_id=journal,updated_at=clock_timestamp()where id=r.id returning*into r;
   exception when others then update private.subscription_capture_receipts_v1 set state='PENDING_LEDGER_CONFIGURATION',reason_code='PAYMENT_LEDGER_POSTING_REQUIRED',updated_at=clock_timestamp()where id=r.id returning*into r;end;
   if r.financial_journal_id is not null then
    if i.amount_minor<>p_amount_minor or i.currency<>p_currency then
     update private.subscription_capture_receipts_v1 set state='RECONCILIATION_REQUIRED',reason_code='PAYMENT_AMOUNT_RECONCILIATION_REQUIRED',updated_at=clock_timestamp()where id=r.id returning*into r;
    elsif private.subscription_capture_adverse_or_unconfigured_v1(p_gateway,p_provider_environment,p_payment_reference)then
     update private.subscription_capture_receipts_v1 set state='RECONCILIATION_REQUIRED',reason_code='VERIFIED_ADVERSE_PAYMENT_REVIEW_REQUIRED',updated_at=clock_timestamp()where id=r.id returning*into r;
    elsif p_verification_method='API_OAUTH2_TLS'then
     update private.subscription_capture_receipts_v1 set state='RECONCILIATION_REQUIRED',reason_code='NATIVE_CAPTURE_WEBHOOK_CONFIRMATION_REQUIRED',updated_at=clock_timestamp()where id=r.id returning*into r;
    else
     begin
      -- The private core is patched by268020 to reuse this exact suspense journal/source key.
      result:=private.process_subscription_payment_context_core_v1(p_provider_environment,p_gateway,p_provider_event_id,p_provider_intent_id,p_event_type,p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_payload_hash,p_signature_fingerprint,first_corr);
      if result->>'outcome'is distinct from'SUBSCRIPTION_ACTIVATED'or result->>'financial_journal_id'is distinct from journal::text then raise exception'PAYMENT_POSTING_SOURCE_MISMATCH'using errcode='23514';end if;
      update private.subscription_capture_receipts_v1 set state='APPLIED',activation_result=result,reason_code=null,updated_at=clock_timestamp()where id=r.id returning*into r;
     exception when others then
      failure:=case sqlstate when'55000'then'SUBSCRIPTION_ACTIVATION_RECONCILIATION_REQUIRED'when'23514'then'SUBSCRIPTION_SOURCE_RECONCILIATION_REQUIRED'when'42501'then'SUBSCRIPTION_RUNTIME_RECONCILIATION_REQUIRED'else'SUBSCRIPTION_PROCESSING_RECONCILIATION_REQUIRED'end;
      update private.subscription_capture_receipts_v1 set state='RECONCILIATION_REQUIRED',reason_code=failure,updated_at=clock_timestamp()where id=r.id returning*into r;
     end;
    end if;
   end if;
  end if;
 end if;
 if r.state='APPLIED'then
  update private.subscription_checkout_attempts_v1 set state='SETTLED',reason_code=null,updated_at=clock_timestamp(),row_version=row_version+1 where payment_intent_id=i.id and state<>'SETTLED';
 else
  update private.subscription_checkout_attempts_v1 set state='RECONCILIATION_REQUIRED',reason_code=r.reason_code,updated_at=clock_timestamp(),row_version=row_version+1 where organization_id=i.organization_id and state not in('SETTLED','CANCELLED_VERIFIED');
  begin perform private.subscription_capture_review_work_v1(r.id);exception when others then null;end;
 end if;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,'SERVICE','subscription.capture_receipt.recorded','subscription_capture_receipt',r.id::text,first_corr,jsonb_build_object('receipt_id',r.id,'state',r.state,'reason_code',r.reason_code,'financial_journal_id',r.financial_journal_id,'verification_method',r.verification_method),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(r.organization_id,'subscription_capture_receipt',r.id::text,'SubscriptionCaptureReceiptRecordedV1',first_corr,jsonb_build_object('receipt_id',r.id,'state',r.state,'reason_code',r.reason_code),'subscription-capture-receipt:'||r.id::text);
 return coalesce(r.activation_result,jsonb_build_object('outcome','SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED','receipt_id',r.id,'receipt_state',r.state,'reason_code',r.reason_code))||jsonb_build_object('replayed',false);
end$$;
create or replace function public.process_verified_subscription_payment_v2(p_gateway text,p_provider_environment text,p_provider_event_id text,p_provider_intent_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_payment_reference text,p_payload_hash text,p_signature_fingerprint text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_EVENT_PROCESS_DENIED'using errcode='42501';end if;
 return private.retain_subscription_capture_v1(p_provider_environment,p_gateway,p_provider_event_id,p_provider_intent_id,p_event_type,p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_payload_hash,p_signature_fingerprint,p_correlation_id,case when p_gateway='DEMO'then'DEMO_SIMULATION'else'WEBHOOK_SIGNATURE'end);
end$$;
revoke all on function private.subscription_capture_review_work_v1(uuid),private.retain_subscription_capture_v1(text,text,text,text,text,bigint,character,timestamptz,text,text,text,uuid,text)from public,anon,authenticated,service_role;
-- A timeout is not evidence. Only a native OAuth/TLS VOIDED order can release a payable attempt.
create function public.record_subscription_checkout_native_resolution_v1(p_request_id uuid,p_provider_environment text,p_provider_intent_id text,p_native_status text,p_response_hash text,p_observed_at timestamptz,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare a private.subscription_checkout_attempts_v1%rowtype;i public.subscription_payment_intents%rowtype;p public.subscription_payment_preparations%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_NATIVE_RESOLUTION_SERVICE_REQUIRED'using errcode='42501';end if;
 select*into a from private.subscription_checkout_attempts_v1 where preparation_id=p_request_id;select*into i from public.subscription_payment_intents where id=a.payment_intent_id;select*into p from public.subscription_payment_preparations where id=a.preparation_id;
 if a.id is null or p.id is null or p.gateway<>'PAYPAL'or p.provider_environment is distinct from p_provider_environment or(i.id is not null and i.provider_intent_id is distinct from p_provider_intent_id)or length(coalesce(p_provider_intent_id,''))not between 8 and 200 or p_native_status is distinct from'VOIDED'or coalesce(p_response_hash,'')!~'^[a-f0-9]{64}$'or p_observed_at is null or abs(extract(epoch from clock_timestamp()-p_observed_at))>60 then raise exception'CHECKOUT_NATIVE_RESOLUTION_REQUIRED'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||a.organization_id::text,0));select*into a from private.subscription_checkout_attempts_v1 where id=a.id for update;
 if exists(select 1 from private.subscription_capture_receipts_v1 where payment_intent_id=i.id)or exists(select 1 from public.subscription_payment_events where payment_intent_id=i.id)then raise exception'CAPTURED_CHECKOUT_CANNOT_BE_RELEASED'using errcode='55000';end if;
 insert into private.subscription_checkout_native_resolutions_v1(attempt_id,provider_intent_id,provider_environment,native_status,response_hash,observed_at,correlation_id)values(a.id,p_provider_intent_id,p_provider_environment,'VOIDED',p_response_hash,p_observed_at,p_correlation_id)on conflict do nothing;
 update private.subscription_checkout_attempts_v1 set state='CANCELLED_VERIFIED',reason_code='NATIVE_ORDER_VOIDED',updated_at=clock_timestamp(),row_version=row_version+1 where id=a.id and state<>'CANCELLED_VERIFIED';
 return jsonb_build_object('outcome','SUBSCRIPTION_CHECKOUT_VOID_VERIFIED','preparation_id',a.preparation_id,'attempt_id',a.id);
end$$;
revoke all on function public.record_subscription_checkout_native_resolution_v1(uuid,text,text,text,text,timestamptz,uuid)from public,anon,authenticated,service_role;
grant execute on function public.record_subscription_checkout_native_resolution_v1(uuid,text,text,text,text,timestamptz,uuid)to service_role;
create function public.prepare_subscription_native_order_review_v1(p_preparation_id uuid,p_provider_environment text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare p public.subscription_payment_preparations%rowtype;a private.subscription_checkout_attempts_v1%rowtype;i public.subscription_payment_intents%rowtype;begin
 select*into p from public.subscription_payment_preparations where id=p_preparation_id;
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or p.id is null or private.has_platform_role(array['READ_ONLY_AUDITOR'],auth.uid())or not(private.has_org_role(p.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())or private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid()))then raise exception'CHECKOUT_NATIVE_REVIEW_DENIED'using errcode='42501';end if;
 if p.gateway<>'PAYPAL'or p.provider_environment is distinct from p_provider_environment then raise exception'PAYMENT_PROVIDER_CONTEXT_MISMATCH'using errcode='42501';end if;
 select*into a from private.subscription_checkout_attempts_v1 where preparation_id=p.id;select*into i from public.subscription_payment_intents where id=a.payment_intent_id;
 if a.id is null then raise exception'CHECKOUT_COORDINATION_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('preparation_id',p.id,'attempt_id',a.id,'organization_id',p.organization_id,'plan_version_id',p.plan_version_id,'billing_interval',p.billing_interval,'amount_minor',p.amount_minor::text,'currency',p.currency,'idempotency_key',p.idempotency_key,'gateway',p.gateway,'provider_environment',p.provider_environment,'payment_intent_id',i.id,'provider_intent_id',i.provider_intent_id,'state',a.state);
end$$;
create function public.record_native_subscription_payment_v1(p_preparation_id uuid,p_provider_environment text,p_provider_intent_id text,p_payment_reference text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_response_hash text,p_observed_at timestamptz,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare p public.subscription_payment_preparations%rowtype;a private.subscription_checkout_attempts_v1%rowtype;i public.subscription_payment_intents%rowtype;created_intent_id uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_NATIVE_RESOLUTION_SERVICE_REQUIRED'using errcode='42501';end if;
 select*into p from public.subscription_payment_preparations where id=p_preparation_id;
 if p.id is null or p.gateway<>'PAYPAL'or p.provider_environment is distinct from p_provider_environment or p.provider_environment not in('LIVE','SANDBOX')or coalesce(p_response_hash,'')!~'^[a-f0-9]{64}$'or p_observed_at is null or abs(extract(epoch from clock_timestamp()-p_observed_at))>60 or length(coalesce(p_provider_intent_id,''))not between 8 and 200 then raise exception'INVALID_NATIVE_PAYMENT_OBSERVATION'using errcode='23514';end if;
 if p.provider_environment<>'LIVE'then perform private.assert_payment_runtime_v1('PAYPAL',p.provider_environment,false);end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p.organization_id::text,0));select*into a from private.subscription_checkout_attempts_v1 where preparation_id=p.id for update;
 if a.id is null then raise exception'CHECKOUT_COORDINATION_REQUIRED'using errcode='55000';end if;
 select*into i from public.subscription_payment_intents where id=a.payment_intent_id;
 if i.id is not null and i.provider_intent_id is distinct from p_provider_intent_id then raise exception'PAYMENT_PROVIDER_CONTEXT_MISMATCH'using errcode='23514';end if;
 if i.id is null then
  -- Already-paid native evidence is retained even after preparation expiry. This path cannot create an order.
  -- The trusted port has verified the exact invoice digest; the frozen preparation supplies all business fields.
  created_intent_id:=extensions.gen_random_uuid();
  insert into public.subscription_payment_intents(id,organization_id,plan_version_id,billing_interval,gateway,provider_intent_id,amount_minor,currency,idempotency_key,request_hash,correlation_id,created_by,provider_environment,deployment_environment)
  values(created_intent_id,p.organization_id,p.plan_version_id,p.billing_interval,p.gateway,p_provider_intent_id,p.amount_minor,p.currency,p.idempotency_key,private.canonical_request_hash(jsonb_build_object('organization',p.organization_id,'plan_version',p.plan_version_id,'billing_interval',p.billing_interval,'gateway',p.gateway,'provider_environment',p.provider_environment,'deployment_environment',p.deployment_environment,'provider_intent_id',p_provider_intent_id,'amount_minor',p.amount_minor,'currency',p.currency)),p_correlation_id,p.actor_id,p.provider_environment,p.deployment_environment)returning*into i;
  update private.subscription_checkout_attempts_v1 set payment_intent_id=i.id,capture_operation_key=i.id,state='RECONCILIATION_REQUIRED',updated_at=clock_timestamp(),row_version=row_version+1 where id=a.id;
 end if;
 return private.retain_subscription_capture_v1(p_provider_environment,'PAYPAL','native-api:'||encode(extensions.digest(convert_to(p_provider_intent_id||':'||p_payment_reference||':'||p_response_hash,'UTF8'),'sha256'),'hex'),p_provider_intent_id,'PAYMENT_SUCCEEDED',p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_response_hash,null,p_correlation_id,'API_OAUTH2_TLS');
end$$;
revoke all on function public.prepare_subscription_native_order_review_v1(uuid,text),public.record_native_subscription_payment_v1(uuid,text,text,text,bigint,character,timestamptz,text,timestamptz,uuid)from public,anon,authenticated,service_role;
grant execute on function public.prepare_subscription_native_order_review_v1(uuid,text)to authenticated;
grant execute on function public.record_native_subscription_payment_v1(uuid,text,text,text,bigint,character,timestamptz,text,timestamptz,uuid)to service_role;
create function public.get_subscription_checkout_operations_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'CHECKOUT_OPERATIONS_DENIED'using errcode='42501';end if;
 return jsonb_build_object('can_act',private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid())and not private.has_platform_role(array['READ_ONLY_AUDITOR'],auth.uid()),'attempts',coalesce((select jsonb_agg(q)from(select a.id,a.preparation_id,a.state,a.reason_code,a.created_at,p.gateway,p.provider_environment,p.amount_minor::text,p.currency,i.provider_intent_id from private.subscription_checkout_attempts_v1 a join public.subscription_payment_preparations p on p.id=a.preparation_id left join public.subscription_payment_intents i on i.id=a.payment_intent_id where a.state not in('SETTLED','CANCELLED_VERIFIED')order by a.created_at,a.id limit 100)q),'[]'::jsonb),'captures',coalesce((select jsonb_agg(q)from(select r.id,r.state,r.reason_code,r.amount_minor::text,r.currency,r.gateway,r.provider_environment,r.created_at,(r.financial_journal_id is not null)as cash_journal_recorded from private.subscription_capture_receipts_v1 r where state<>'APPLIED'order by r.created_at,r.id limit 100)q),'[]'::jsonb));
end$$;
revoke all on function public.get_subscription_checkout_operations_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_subscription_checkout_operations_v1()to authenticated;
notify pgrst,'reload schema';
commit;
