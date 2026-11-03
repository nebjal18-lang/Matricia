begin;
-- The inbox proves receipt of a verified provider notification, never activation or delivery.
-- It precedes purpose resolution so registration races cannot discard already-paid facts.
create table private.verified_payment_dispatch_inbox_v1(
 id uuid primary key default extensions.gen_random_uuid(),gateway text not null check(gateway in('PAYPAL','DEMO','CMI')),
 provider_environment text not null check(provider_environment in('LIVE','SANDBOX','DEMO')),provider_event_id text not null,
 event_type text not null check(event_type in('PAYMENT_SUCCEEDED','REFUND_SUCCEEDED','PAYMENT_REVERSED','DISPUTE_OPENED','DISPUTE_WON','DISPUTE_LOST')),
 provider_reference text not null,verified_fact jsonb not null,payload_hash text not null check(payload_hash~'^[a-f0-9]{64}$'),first_correlation_id uuid not null,
 status text not null default'RECORDED'check(status in('RECORDED','DISPATCHED','RECONCILIATION_REQUIRED')),purchase_kind text check(purchase_kind in('SUBSCRIPTION','CREDIT_PACK')),
 reason_code text,received_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(gateway,provider_environment,provider_event_id)
);
create table private.verified_payment_dispatch_proofs_v1(
 id bigint generated always as identity primary key,inbox_id uuid not null references private.verified_payment_dispatch_inbox_v1(id),
 signature_fingerprint text not null check(signature_fingerprint~'^[a-f0-9]{64}$'),verification_method text not null check(verification_method in('WEBHOOK_SIGNATURE','DEMO_SIMULATION')),
 received_at timestamptz not null default clock_timestamp(),unique(inbox_id,signature_fingerprint)
);
create table private.verified_payment_dispatch_attempts_v1(
 id bigint generated always as identity primary key,inbox_id uuid not null references private.verified_payment_dispatch_inbox_v1(id),
 purchase_kind text check(purchase_kind in('SUBSCRIPTION','CREDIT_PACK')),outcome text not null check(outcome in('DISPATCHED','RECONCILIATION_REQUIRED')),
 reason_code text,correlation_id uuid not null,recorded_at timestamptz not null default clock_timestamp()
);
revoke all on private.verified_payment_dispatch_inbox_v1,private.verified_payment_dispatch_proofs_v1,private.verified_payment_dispatch_attempts_v1 from public,anon,authenticated,service_role;
create trigger payment_dispatch_proofs_immutable before update or delete on private.verified_payment_dispatch_proofs_v1 for each row execute function private.prevent_update_delete();
create trigger payment_dispatch_attempts_immutable before update or delete on private.verified_payment_dispatch_attempts_v1 for each row execute function private.prevent_update_delete();
create function private.protect_payment_dispatch_source_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if tg_op='DELETE'then raise exception'PAYMENT_INBOX_SOURCE_IMMUTABLE'using errcode='55000';end if;
 if row(new.id,new.gateway,new.provider_environment,new.provider_event_id,new.event_type,new.provider_reference,new.verified_fact,new.payload_hash,new.first_correlation_id,new.received_at)is distinct from row(old.id,old.gateway,old.provider_environment,old.provider_event_id,old.event_type,old.provider_reference,old.verified_fact,old.payload_hash,old.first_correlation_id,old.received_at)then raise exception'PAYMENT_INBOX_SOURCE_IMMUTABLE'using errcode='55000';end if;return new;
end$$;
create trigger payment_dispatch_source_immutable before update or delete on private.verified_payment_dispatch_inbox_v1 for each row execute function private.protect_payment_dispatch_source_v1();
revoke all on function private.protect_payment_dispatch_source_v1()from public,anon,authenticated,service_role;
create index verified_payment_adverse_lookup_v1 on private.verified_payment_dispatch_inbox_v1(gateway,provider_environment,provider_reference,event_type);
create function private.payment_capture_has_adverse_fact_v1(p_gateway text,p_provider_environment text,p_payment_reference text)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select exists(select 1 from(select distinct on(case when event_type like'DISPUTE_%'then'DISPUTE'else event_type end,verified_fact->>'provider_adjustment_id')event_type
 from private.verified_payment_dispatch_inbox_v1 where gateway=p_gateway and provider_environment=p_provider_environment and provider_reference=p_payment_reference and event_type<>'PAYMENT_SUCCEEDED'
 order by case when event_type like'DISPUTE_%'then'DISPUTE'else event_type end,verified_fact->>'provider_adjustment_id',(verified_fact->>'occurred_at')::timestamptz desc,case event_type when'DISPUTE_LOST'then 4 when'DISPUTE_WON'then 3 when'DISPUTE_OPENED'then 2 else 1 end desc,provider_event_id desc)latest where event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED','DISPUTE_OPENED','DISPUTE_LOST'))
$$;
revoke all on function private.payment_capture_has_adverse_fact_v1(text,text,text)from public,anon,authenticated,service_role;
-- Preserve trials/onboarding/manual grants. This adds only known verified adverse facts to the
-- existing financial hold check; it never requires an organization to possess a paid subscription.
alter function private.subscription_financially_clear(uuid)rename to subscription_financially_clear_before_verified_inbox_v1;
create function private.subscription_financially_clear(p_organization_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select private.subscription_financially_clear_before_verified_inbox_v1(p_organization_id)and not exists(select 1 from public.subscription_payment_events p where p.organization_id=p_organization_id and private.payment_capture_has_adverse_fact_v1(p.gateway,p.provider_environment,p.payment_reference))$$;
revoke all on function private.subscription_financially_clear_before_verified_inbox_v1(uuid),private.subscription_financially_clear(uuid)from public,anon,authenticated,service_role;
create function public.record_verified_payment_inbox_v1(p_gateway text,p_provider_environment text,p_provider_event_id text,p_event_type text,p_provider_reference text,p_fact jsonb,p_payload_hash text,p_signature_fingerprint text,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare r private.verified_payment_dispatch_inbox_v1%rowtype;expected_keys text[];k text;replayed boolean:=false;event_at timestamptz;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_INBOX_SERVICE_REQUIRED'using errcode='42501';end if;
 if p_gateway is null or p_gateway not in('PAYPAL','DEMO','CMI')or p_provider_environment is null or p_provider_environment not in('LIVE','SANDBOX','DEMO')or(p_gateway='DEMO')is distinct from(p_provider_environment='DEMO')or p_event_type is null or p_event_type not in('PAYMENT_SUCCEEDED','REFUND_SUCCEEDED','PAYMENT_REVERSED','DISPUTE_OPENED','DISPUTE_WON','DISPUTE_LOST')or length(coalesce(p_provider_event_id,''))not between 8 and 200 or length(coalesce(p_provider_reference,''))not between 3 and 200 or coalesce(p_payload_hash,'')!~'^[a-f0-9]{64}$'or coalesce(p_signature_fingerprint,'')!~'^[a-f0-9]{64}$'or p_correlation_id is null or jsonb_typeof(p_fact)is distinct from'object'or octet_length(p_fact::text)>4096 then raise exception'INVALID_VERIFIED_PAYMENT_INBOX_FACT'using errcode='22023';end if;
 if p_provider_environment<>'LIVE'then perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,false);end if;
 expected_keys:=case when p_event_type='PAYMENT_SUCCEEDED'then array['provider_intent_id','payment_reference','amount_minor','currency','occurred_at']else array['provider_payment_id','provider_adjustment_id','merchant_reference','amount_minor','currency','occurred_at']end;
 for k in select jsonb_object_keys(p_fact)loop if not k=any(expected_keys)or(k<>'merchant_reference'and jsonb_typeof(p_fact->k)is distinct from'string')or(k='merchant_reference'and jsonb_typeof(p_fact->k)not in('string','null'))then raise exception'INVALID_VERIFIED_PAYMENT_INBOX_FACT'using errcode='22023';end if;end loop;
 if coalesce(p_fact->>'amount_minor','')!~'^[1-9][0-9]{0,18}$'or(p_fact->>'amount_minor')::numeric>9223372036854775807 or coalesce(p_fact->>'currency','')!~'^[A-Z]{3}$'or p_fact->>'occurred_at'is null then raise exception'INVALID_VERIFIED_PAYMENT_INBOX_FACT'using errcode='22023';end if;
 begin event_at:=(p_fact->>'occurred_at')::timestamptz;exception when others then raise exception'INVALID_VERIFIED_PAYMENT_INBOX_FACT'using errcode='22023';end;
 if not isfinite(event_at)or event_at>clock_timestamp()+interval'5 minutes'then raise exception'INVALID_VERIFIED_PAYMENT_INBOX_FACT'using errcode='22023';end if;
 if p_event_type='PAYMENT_SUCCEEDED'then
  if p_fact->>'provider_intent_id'is distinct from p_provider_reference or length(coalesce(p_fact->>'payment_reference',''))not between 3 and 200 then raise exception'INVALID_VERIFIED_PAYMENT_INBOX_FACT'using errcode='22023';end if;
 else
  if p_fact->>'provider_payment_id'is distinct from p_provider_reference or length(coalesce(p_fact->>'provider_adjustment_id',''))not between 3 and 200 or length(coalesce(p_fact->>'merchant_reference',''))>200 then raise exception'INVALID_VERIFIED_PAYMENT_INBOX_FACT'using errcode='22023';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('verified-payment-inbox:'||p_gateway||':'||p_provider_environment||':'||p_provider_event_id,0));
 select*into r from private.verified_payment_dispatch_inbox_v1 where gateway=p_gateway and provider_environment=p_provider_environment and provider_event_id=p_provider_event_id for update;
 if r.id is not null then
  if r.event_type<>p_event_type or r.provider_reference<>p_provider_reference or r.verified_fact<>p_fact or r.payload_hash<>p_payload_hash then raise exception'PAYMENT_INBOX_REPLAY_MISMATCH'using errcode='22000';end if;replayed:=true;
 else
  insert into private.verified_payment_dispatch_inbox_v1(gateway,provider_environment,provider_event_id,event_type,provider_reference,verified_fact,payload_hash,first_correlation_id)values(p_gateway,p_provider_environment,p_provider_event_id,p_event_type,p_provider_reference,p_fact,p_payload_hash,p_correlation_id)returning*into r;
  insert into public.audit_events(actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values('SERVICE','payment.verified_receipt.recorded','verified_payment_inbox',r.id::text,p_correlation_id,jsonb_build_object('receipt_id',r.id,'event_type',p_event_type,'gateway',p_gateway,'provider_environment',p_provider_environment),repeat('0',64));
  insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('verified_payment_inbox',r.id::text,'VerifiedPaymentDispatchRequestedV1',p_correlation_id,jsonb_build_object('receipt_id',r.id),'verified-payment-dispatch:'||r.id::text);
 end if;
 insert into private.verified_payment_dispatch_proofs_v1(inbox_id,signature_fingerprint,verification_method)values(r.id,p_signature_fingerprint,case when p_gateway='DEMO'then'DEMO_SIMULATION'else'WEBHOOK_SIGNATURE'end)on conflict do nothing;
 return jsonb_build_object('outcome','VERIFIED_PAYMENT_RECEIPT_RECORDED','receipt_id',r.id,'status',r.status,'replayed',replayed,'correlation_id',r.first_correlation_id);
end$$;
create function private.payment_dispatch_domain_fact_exists_v1(p_receipt_id uuid,p_kind text)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare r private.verified_payment_dispatch_inbox_v1%rowtype;begin
 select*into r from private.verified_payment_dispatch_inbox_v1 where id=p_receipt_id;if r.id is null then return false;end if;
 if p_kind='SUBSCRIPTION'then
  if r.event_type='PAYMENT_SUCCEEDED'then
   return exists(select 1 from private.subscription_capture_receipts_v1 c where c.gateway=r.gateway and c.provider_environment=r.provider_environment and c.provider_intent_id=r.provider_reference and c.payment_reference=r.verified_fact->>'payment_reference'and c.amount_minor=(r.verified_fact->>'amount_minor')::bigint and c.currency=r.verified_fact->>'currency'and c.paid_at=(r.verified_fact->>'occurred_at')::timestamptz);
  end if;
  return exists(select 1 from public.subscription_payment_adjustments a join public.subscription_payment_events e on e.id=a.payment_event_id where a.gateway=r.gateway and e.provider_environment=r.provider_environment and a.provider_event_id=r.provider_event_id and a.payload_hash=r.payload_hash and a.event_type=r.event_type and a.amount_minor=(r.verified_fact->>'amount_minor')::bigint and a.currency=r.verified_fact->>'currency');
 elsif p_kind='CREDIT_PACK'then
  if to_regclass('public.credit_pack_payment_events_v1')is null then return false;end if;
  if r.event_type='PAYMENT_SUCCEEDED'then
   return exists(select 1 from public.credit_pack_payment_events_v1 e where e.gateway=r.gateway and e.provider_environment=r.provider_environment and e.provider_intent_id=r.provider_reference and e.payment_reference=r.verified_fact->>'payment_reference'and e.amount_minor=(r.verified_fact->>'amount_minor')::bigint and e.currency=r.verified_fact->>'currency'and e.paid_at=(r.verified_fact->>'occurred_at')::timestamptz);
  end if;
  if to_regclass('public.credit_pack_payment_adjustments_v1')is null then return false;end if;
  return exists(select 1 from public.credit_pack_payment_adjustments_v1 a where a.gateway=r.gateway and a.provider_environment=r.provider_environment and a.provider_event_id=r.provider_event_id and a.payload_hash=r.payload_hash and a.event_type=r.event_type and a.amount_minor=(r.verified_fact->>'amount_minor')::bigint and a.currency=r.verified_fact->>'currency');
 end if;return false;
end$$;
revoke all on function private.payment_dispatch_domain_fact_exists_v1(uuid,text)from public,anon,authenticated,service_role;
create function public.complete_verified_payment_dispatch_v1(p_receipt_id uuid,p_purchase_kind text,p_outcome text,p_reason_code text,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare r private.verified_payment_dispatch_inbox_v1%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_INBOX_SERVICE_REQUIRED'using errcode='42501';end if;
 if p_outcome is null or p_outcome not in('DISPATCHED','RECONCILIATION_REQUIRED')or(p_purchase_kind is not null and p_purchase_kind not in('SUBSCRIPTION','CREDIT_PACK'))or(p_outcome='DISPATCHED'and p_purchase_kind is null)or(p_reason_code is not null and p_reason_code!~'^[A-Z][A-Z0-9_]{2,100}$')or p_correlation_id is null then raise exception'PAYMENT_INBOX_DISPOSITION_INVALID'using errcode='22023';end if;
 select*into r from private.verified_payment_dispatch_inbox_v1 where id=p_receipt_id for update;if r.id is null then raise exception'PAYMENT_INBOX_NOT_FOUND'using errcode='P0002';end if;
 -- A dispatched notification is a fact of routing, not an entitlement/payment status.
 -- It cannot be downgraded when a retry observes an infrastructure failure.
 if p_outcome='DISPATCHED'and not private.payment_dispatch_domain_fact_exists_v1(r.id,p_purchase_kind)then raise exception'PAYMENT_DOMAIN_RECEIPT_REQUIRED'using errcode='55000';end if;
 if r.status='DISPATCHED'then return jsonb_build_object('outcome','PAYMENT_DISPATCH_RECORDED','status',r.status,'receipt_id',r.id);end if;
 if r.purchase_kind is not null and r.purchase_kind is distinct from p_purchase_kind then raise exception'PAYMENT_INBOX_PURPOSE_IMMUTABLE'using errcode='23514';end if;
 update private.verified_payment_dispatch_inbox_v1 set status=p_outcome,purchase_kind=coalesce(p_purchase_kind,purchase_kind),reason_code=p_reason_code,updated_at=clock_timestamp()where id=r.id;
 insert into private.verified_payment_dispatch_attempts_v1(inbox_id,purchase_kind,outcome,reason_code,correlation_id)values(r.id,p_purchase_kind,p_outcome,p_reason_code,p_correlation_id);
 return jsonb_build_object('outcome','PAYMENT_DISPATCH_RECORDED','status',p_outcome,'receipt_id',r.id);
end$$;
create function public.get_verified_payment_inbox_operations_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'PAYMENT_INBOX_OPERATIONS_DENIED'using errcode='42501';end if;
 return jsonb_build_object('can_act',private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid())and not private.has_platform_role(array['READ_ONLY_AUDITOR'],auth.uid()),'native_pending',coalesce((select jsonb_agg(q)from(select id,purchase_kind,preparation_id,provider_environment,provider_intent_id,native_status,recorded_at from private.verified_native_order_observations_v1 n where private.native_payment_observation_needs_import_v1(n.id)order by recorded_at,id limit 100)q),'[]'::jsonb),'counts',coalesce((select jsonb_agg(row)from(select status,count(*)::text as count,greatest(0,extract(epoch from clock_timestamp()-min(received_at)))::bigint::text as oldest_seconds from private.verified_payment_dispatch_inbox_v1 group by status order by status)row),'[]'::jsonb),'pending',coalesce((select jsonb_agg(row)from(select id,gateway,provider_environment,event_type,purchase_kind,status,reason_code,received_at from private.verified_payment_dispatch_inbox_v1 where status<>'DISPATCHED'order by received_at,id limit 100)row),'[]'::jsonb));
end$$;
revoke all on function public.record_verified_payment_inbox_v1(text,text,text,text,text,jsonb,text,text,uuid),public.complete_verified_payment_dispatch_v1(uuid,text,text,text,uuid),public.get_verified_payment_inbox_operations_v1()from public,anon,authenticated,service_role;
grant execute on function public.record_verified_payment_inbox_v1(text,text,text,text,text,jsonb,text,text,uuid),public.complete_verified_payment_dispatch_v1(uuid,text,text,text,uuid)to service_role;
grant execute on function public.get_verified_payment_inbox_operations_v1()to authenticated;
create function public.load_verified_payment_inbox_dispatch_v1(p_receipt_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare r private.verified_payment_dispatch_inbox_v1%rowtype;proof private.verified_payment_dispatch_proofs_v1%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_INBOX_SERVICE_REQUIRED'using errcode='42501';end if;
 select*into r from private.verified_payment_dispatch_inbox_v1 where id=p_receipt_id;select*into proof from private.verified_payment_dispatch_proofs_v1 where inbox_id=r.id order by id limit 1;
 if r.id is null or proof.id is null then raise exception'VERIFIED_PAYMENT_PROOF_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('receipt_id',r.id,'gateway',r.gateway,'provider_environment',r.provider_environment,'provider_event_id',r.provider_event_id,'event_type',r.event_type,'provider_reference',r.provider_reference,'fact',r.verified_fact,'payload_hash',r.payload_hash,'signature_fingerprint',proof.signature_fingerprint,'correlation_id',r.first_correlation_id);
end$$;
revoke all on function public.load_verified_payment_inbox_dispatch_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.load_verified_payment_inbox_dispatch_v1(uuid)to service_role;
alter function private.operational_event_replay_is_safe(text,text)rename to operational_event_replay_before_payment_inbox_v1;
create function private.operational_event_replay_is_safe(p_type text,p_error text)returns boolean language sql immutable set search_path=pg_catalog as $$select p_type='VerifiedPaymentDispatchRequestedV1'or private.operational_event_replay_before_payment_inbox_v1(p_type,p_error)$$;
revoke all on function private.operational_event_replay_before_payment_inbox_v1(text,text),private.operational_event_replay_is_safe(text,text)from public,anon,authenticated,service_role;
-- Native GET observations have their own evidence model. A response hash is not a webhook signature.
create table private.verified_native_order_observations_v1(
 id uuid primary key default extensions.gen_random_uuid(),purchase_kind text not null check(purchase_kind in('SUBSCRIPTION','CREDIT_PACK')),preparation_id uuid not null,
 provider_environment text not null check(provider_environment in('LIVE','SANDBOX')),provider_intent_id text not null,native_status text not null,
 amount_minor bigint not null check(amount_minor>0),currency char(3)not null,capture_reference text,paid_at timestamptz,
 verification_method text not null default'API_OAUTH2_TLS'check(verification_method='API_OAUTH2_TLS'),response_hash text not null check(response_hash~'^[a-f0-9]{64}$'),observed_at timestamptz not null,correlation_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(purchase_kind,preparation_id,provider_environment,provider_intent_id,response_hash)
);
revoke all on private.verified_native_order_observations_v1 from public,anon,authenticated,service_role;
create trigger verified_native_order_observations_immutable before update or delete on private.verified_native_order_observations_v1 for each row execute function private.prevent_update_delete();
create function private.native_payment_observation_needs_import_v1(p_observation_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$declare r private.verified_native_order_observations_v1%rowtype;begin
 select*into r from private.verified_native_order_observations_v1 where id=p_observation_id;if r.id is null or r.native_status<>'COMPLETED'then return false;end if;
 if r.purchase_kind='SUBSCRIPTION'then return not exists(select 1 from private.subscription_capture_receipts_v1 c where c.gateway='PAYPAL'and c.provider_environment=r.provider_environment and c.provider_intent_id=r.provider_intent_id and c.payment_reference=r.capture_reference);end if;
 if to_regclass('public.credit_pack_payment_events_v1')is null then return true;end if;
 return not exists(select 1 from public.credit_pack_payment_events_v1 e where e.gateway='PAYPAL'and e.provider_environment=r.provider_environment and e.provider_intent_id=r.provider_intent_id and e.payment_reference=r.capture_reference);
end$$;
revoke all on function private.native_payment_observation_needs_import_v1(uuid)from public,anon,authenticated,service_role;
create function public.record_verified_native_order_observation_v1(p_purchase_kind text,p_preparation_id uuid,p_provider_environment text,p_provider_intent_id text,p_native_status text,p_amount_minor bigint,p_currency char(3),p_capture_reference text,p_paid_at timestamptz,p_response_hash text,p_observed_at timestamptz,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare source jsonb;r private.verified_native_order_observations_v1%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_INBOX_SERVICE_REQUIRED'using errcode='42501';end if;
 if p_purchase_kind is null or p_purchase_kind not in('SUBSCRIPTION','CREDIT_PACK')or p_provider_environment is null or p_provider_environment not in('LIVE','SANDBOX')or coalesce(p_native_status,'')not in('CREATED','SAVED','APPROVED','PAYER_ACTION_REQUIRED','VOIDED','COMPLETED')or length(coalesce(p_provider_intent_id,''))not between 8 and 200 or coalesce(p_response_hash,'')!~'^[a-f0-9]{64}$'or p_observed_at is null or not isfinite(p_observed_at)or abs(extract(epoch from clock_timestamp()-p_observed_at))>60 or p_correlation_id is null then raise exception'INVALID_NATIVE_PAYMENT_OBSERVATION'using errcode='22023';end if;
 if p_purchase_kind='SUBSCRIPTION'then select to_jsonb(q)into source from public.subscription_payment_preparations q where id=p_preparation_id;
 elsif to_regclass('public.credit_pack_payment_preparations_v1')is not null then select to_jsonb(q)into source from public.credit_pack_payment_preparations_v1 q where id=p_preparation_id;end if;
 if source is null or source->>'gateway'is distinct from'PAYPAL'or source->>'provider_environment'is distinct from p_provider_environment or(source->>'amount_minor')::bigint is distinct from p_amount_minor or source->>'currency'is distinct from p_currency::text then raise exception'NATIVE_PAYMENT_SOURCE_MISMATCH'using errcode='23514';end if;
 if p_provider_environment<>'LIVE'then perform private.assert_payment_runtime_v1('PAYPAL',p_provider_environment,false);end if;
 if p_native_status='COMPLETED'then
  if length(coalesce(p_capture_reference,''))not between 8 and 200 or p_paid_at is null or not isfinite(p_paid_at)or p_paid_at>clock_timestamp()+interval'5 minutes'then raise exception'INVALID_NATIVE_PAYMENT_OBSERVATION'using errcode='22023';end if;
 elsif p_capture_reference is not null or p_paid_at is not null then raise exception'INVALID_NATIVE_PAYMENT_OBSERVATION'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('native-payment-observation:'||p_purchase_kind||':'||p_preparation_id::text||':'||p_response_hash,0));
 select*into r from private.verified_native_order_observations_v1 where purchase_kind=p_purchase_kind and preparation_id=p_preparation_id and provider_environment=p_provider_environment and provider_intent_id=p_provider_intent_id and response_hash=p_response_hash;
 if r.id is null then
  insert into private.verified_native_order_observations_v1(purchase_kind,preparation_id,provider_environment,provider_intent_id,native_status,amount_minor,currency,capture_reference,paid_at,response_hash,observed_at,correlation_id)values(p_purchase_kind,p_preparation_id,p_provider_environment,p_provider_intent_id,p_native_status,p_amount_minor,p_currency,p_capture_reference,p_paid_at,p_response_hash,p_observed_at,p_correlation_id)returning*into r;
  insert into public.audit_events(actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values('SERVICE','payment.native_order.observed','native_order_observation',r.id::text,p_correlation_id,jsonb_build_object('observation_id',r.id,'purchase_kind',p_purchase_kind,'native_status',p_native_status,'verification_method','API_OAUTH2_TLS'),repeat('0',64));
 elsif row(r.native_status,r.amount_minor,r.currency,r.capture_reference,r.paid_at)is distinct from row(p_native_status,p_amount_minor,p_currency,p_capture_reference,p_paid_at)then raise exception'NATIVE_ORDER_OBSERVATION_REPLAY_MISMATCH'using errcode='22000';end if;
 return jsonb_build_object('outcome','NATIVE_ORDER_OBSERVATION_RECORDED','observation_id',r.id,'native_status',r.native_status);
end$$;
revoke all on function public.record_verified_native_order_observation_v1(text,uuid,text,text,text,bigint,character,text,timestamptz,text,timestamptz,uuid)from public,anon,authenticated,service_role;
grant execute on function public.record_verified_native_order_observation_v1(text,uuid,text,text,text,bigint,character,text,timestamptz,text,timestamptz,uuid)to service_role;
notify pgrst,'reload schema';
commit;
