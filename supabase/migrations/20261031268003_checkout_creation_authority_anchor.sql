begin;
-- A preparation that predates durable coordination may already have caused an unknown PSP
-- operation. Its age or lack of a registered order cannot authorize another POST or retrofit
-- current commercial terms. The authority marker is written only for a genuinely new source.
alter table private.subscription_checkout_attempts_v1 add column provider_create_authorized_at timestamptz;
-- Financial MFA is checked inside the database, including direct RPC and cached replies.
-- Verified provider callbacks remain service operations and never impersonate a human session.
alter function private.assert_payment_runtime_v1(text,text,boolean)rename to assert_payment_runtime_before_customer_mfa_v1;
create function private.assert_payment_runtime_v1(p_gateway text,p_provider_environment text,p_allow_legacy boolean default false)returns text language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.role()='authenticated'and auth.jwt()->>'aal'is distinct from'aal2'then raise exception'PAYMENT_CUSTOMER_MFA_REQUIRED'using errcode='42501';end if;
 return private.assert_payment_runtime_before_customer_mfa_v1(p_gateway,p_provider_environment,p_allow_legacy);
end$$;
revoke all on function private.assert_payment_runtime_before_customer_mfa_v1(text,text,boolean),private.assert_payment_runtime_v1(text,text,boolean)from public,anon,authenticated,service_role;

create or replace function private.prepare_subscription_payment_context_core_v1(p_organization_id uuid,p_plan_version_id uuid,p_billing_interval text,p_gateway text,p_idempotency_key text,p_provider_environment text,p_legacy boolean default false)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare attempt private.subscription_checkout_attempts_v1%rowtype;other private.subscription_checkout_attempts_v1%rowtype;preparation jsonb;ctx jsonb;s public.subscriptions%rowtype;intent public.subscription_payment_intents%rowtype;pay public.subscription_payment_events%rowtype;preparation_existed boolean;begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_INTENT_CREATE_DENIED'using errcode='42501';end if;
 perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,p_legacy);perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 if not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_INTENT_CREATE_DENIED'using errcode='42501';end if;
 select*into attempt from private.subscription_checkout_attempts_v1 where organization_id=p_organization_id and idempotency_key=p_idempotency_key for update;
 if attempt.id is not null and attempt.state in('RECONCILIATION_REQUIRED','CANCELLED_VERIFIED')then raise exception'SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 if attempt.id is null then
  select*into other from private.subscription_checkout_attempts_v1 where organization_id=p_organization_id and state not in('SETTLED','CANCELLED_VERIFIED');
  if other.id is not null then raise exception'SUBSCRIPTION_CHECKOUT_ALREADY_PENDING'using errcode='55000';end if;
  if exists(select 1 from public.subscription_payment_preparations legacy where legacy.organization_id=p_organization_id and legacy.idempotency_key<>p_idempotency_key and not exists(select 1 from private.subscription_checkout_attempts_v1 tracked where tracked.preparation_id=legacy.id)and not exists(select 1 from public.subscription_payment_intents known join public.subscription_payment_events paid on paid.payment_intent_id=known.id where known.organization_id=legacy.organization_id and known.idempotency_key=legacy.idempotency_key))then raise exception'SUBSCRIPTION_LEGACY_CHECKOUT_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 end if;
 select exists(select 1 from public.subscription_payment_preparations where organization_id=p_organization_id and idempotency_key=p_idempotency_key)into preparation_existed;
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
 if pay.id is null and not preparation_existed then
  if to_regprocedure('private.prepare_payment_posting_context_v1(uuid,uuid,text,uuid,character,text,text)')is null then raise exception'PAYMENT_POSTING_CONFIGURATION_REQUIRED'using errcode='55000';end if;
  ctx:=private.prepare_payment_posting_context_v1((preparation->>'preparation_id')::uuid,p_organization_id,'SUBSCRIPTION',p_plan_version_id,(preparation->>'currency')::char(3),p_gateway,p_provider_environment);
  if coalesce(ctx->>'posting_context_id','')!~'^[a-f0-9-]{36}$'then raise exception'PAYMENT_POSTING_CONFIGURATION_REQUIRED'using errcode='55000';end if;
 elsif pay.id is null and to_regprocedure('private.get_payment_posting_context_v1(text,uuid)')is not null then
  begin ctx:=private.get_payment_posting_context_v1('SUBSCRIPTION',(preparation->>'preparation_id')::uuid);exception when others then ctx:=null;end;
 end if;
 insert into private.subscription_checkout_attempts_v1(organization_id,subscription_id,preparation_id,payment_intent_id,idempotency_key,target_row_version,state,posting_context_id,capture_operation_key,provider_create_authorized_at)values(p_organization_id,s.id,(preparation->>'preparation_id')::uuid,intent.id,p_idempotency_key,s.row_version,case when pay.id is not null then'SETTLED'when intent.id is not null then'REGISTERED'else'CREATE_REQUESTED'end,(ctx->>'posting_context_id')::uuid,intent.id,case when not preparation_existed and intent.id is null then clock_timestamp()else null end)returning*into attempt;
 return preparation||jsonb_build_object('checkout_attempt_id',attempt.id,'checkout_state',attempt.state,'payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'payment_result',pay.activation_result,'create_authorized',intent.id is null and not preparation_existed);
end$$;
create or replace function public.prepare_subscription_native_order_review_v1(p_preparation_id uuid,p_provider_environment text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare p public.subscription_payment_preparations%rowtype;a private.subscription_checkout_attempts_v1%rowtype;i public.subscription_payment_intents%rowtype;begin
 select*into p from public.subscription_payment_preparations where id=p_preparation_id;
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or p.id is null or private.has_platform_role(array['READ_ONLY_AUDITOR'],auth.uid())or not(private.has_org_role(p.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())or private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid()))then raise exception'CHECKOUT_NATIVE_REVIEW_DENIED'using errcode='42501';end if;
 if p.gateway<>'PAYPAL'or p.provider_environment is distinct from p_provider_environment then raise exception'PAYMENT_PROVIDER_CONTEXT_MISMATCH'using errcode='42501';end if;
 select*into a from private.subscription_checkout_attempts_v1 where preparation_id=p.id;select*into i from public.subscription_payment_intents where organization_id=p.organization_id and idempotency_key=p.idempotency_key;
 return jsonb_build_object('preparation_id',p.id,'attempt_id',a.id,'organization_id',p.organization_id,'plan_version_id',p.plan_version_id,'billing_interval',p.billing_interval,'amount_minor',p.amount_minor::text,'currency',p.currency,'idempotency_key',p.idempotency_key,'gateway',p.gateway,'provider_environment',p.provider_environment,'payment_intent_id',i.id,'provider_intent_id',i.provider_intent_id,'state',coalesce(a.state,'LEGACY_RECONCILIATION_REQUIRED'));
end$$;
create or replace function public.record_native_subscription_payment_v1(p_preparation_id uuid,p_provider_environment text,p_provider_intent_id text,p_payment_reference text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_response_hash text,p_observed_at timestamptz,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare p public.subscription_payment_preparations%rowtype;a private.subscription_checkout_attempts_v1%rowtype;i public.subscription_payment_intents%rowtype;created_intent_id uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_NATIVE_RESOLUTION_SERVICE_REQUIRED'using errcode='42501';end if;
 select*into p from public.subscription_payment_preparations where id=p_preparation_id;
 if p.id is null or p.gateway<>'PAYPAL'or p.provider_environment is distinct from p_provider_environment or p.provider_environment not in('LIVE','SANDBOX')or coalesce(p_response_hash,'')!~'^[a-f0-9]{64}$'or p_observed_at is null or abs(extract(epoch from clock_timestamp()-p_observed_at))>60 or length(coalesce(p_provider_intent_id,''))not between 8 and 200 then raise exception'INVALID_NATIVE_PAYMENT_OBSERVATION'using errcode='23514';end if;
 if p.provider_environment<>'LIVE'then perform private.assert_payment_runtime_v1('PAYPAL',p.provider_environment,false);end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p.organization_id::text,0));select*into a from private.subscription_checkout_attempts_v1 where preparation_id=p.id for update;
 select*into i from public.subscription_payment_intents where organization_id=p.organization_id and idempotency_key=p.idempotency_key;
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
notify pgrst,'reload schema';
commit;
