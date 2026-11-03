begin;
-- Existing rows remain UNVERIFIED; no historical payment is relabeled LIVE by migration.
alter table public.subscription_payment_preparations add column provider_environment text not null default'UNVERIFIED'check(provider_environment in('DEMO','SANDBOX','LIVE','UNVERIFIED')),add column deployment_environment text check(deployment_environment in('DEVELOPMENT','STAGING','PRODUCTION'));
alter table public.subscription_payment_intents add column provider_environment text not null default'UNVERIFIED'check(provider_environment in('DEMO','SANDBOX','LIVE','UNVERIFIED')),add column deployment_environment text check(deployment_environment in('DEVELOPMENT','STAGING','PRODUCTION'));
alter table public.subscription_payment_events add column provider_environment text not null default'UNVERIFIED'check(provider_environment in('DEMO','SANDBOX','LIVE','UNVERIFIED')),add column deployment_environment text check(deployment_environment in('DEVELOPMENT','STAGING','PRODUCTION'));
alter table public.subscription_payment_adjustments add column provider_environment text not null default'UNVERIFIED'check(provider_environment in('DEMO','SANDBOX','LIVE','UNVERIFIED')),add column deployment_environment text check(deployment_environment in('DEVELOPMENT','STAGING','PRODUCTION'));
create function private.assert_payment_runtime_v1(p_gateway text,p_provider_environment text,p_allow_legacy boolean default false)returns text language plpgsql stable security definer set search_path=pg_catalog,private as $$declare env text;begin
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null then raise exception'PAYMENT_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED'using errcode='55000';end if;
 if p_gateway is null or p_gateway not in('DEMO','PAYPAL','CMI')or p_provider_environment is null or p_provider_environment not in('DEMO','SANDBOX','LIVE','UNVERIFIED')then raise exception'PAYMENT_PROVIDER_ENVIRONMENT_REQUIRED'using errcode='22023';end if;
 if env='PRODUCTION'and(p_gateway='DEMO'or p_provider_environment<>'LIVE')then raise exception'PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN'using errcode='42501';end if;
 if p_provider_environment='UNVERIFIED'and not(p_allow_legacy and env in('DEVELOPMENT','STAGING'))then raise exception'PAYMENT_PROVIDER_ENVIRONMENT_UNVERIFIED'using errcode='55000';end if;
 if(p_gateway='DEMO')<>(p_provider_environment='DEMO')and p_provider_environment<>'UNVERIFIED'then raise exception'PAYMENT_PROVIDER_ENVIRONMENT_MISMATCH'using errcode='23514';end if;
 return env;
end$$;
create function private.require_legacy_payment_nonproduction_v1()returns void language plpgsql stable security definer set search_path=pg_catalog,private as $$declare env text;begin
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null then raise exception'PAYMENT_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED'using errcode='55000';end if;
 if env not in('DEVELOPMENT','STAGING')then raise exception'PAYMENT_PROVIDER_ENVIRONMENT_REQUIRED'using errcode='42501';end if;
end$$;
create function private.require_payment_intent_runtime_v1(p_payment_intent_id uuid,p_provider_environment text)returns void language plpgsql stable security definer set search_path=pg_catalog,private as $$declare i public.subscription_payment_intents%rowtype;env text;begin
 select*into i from public.subscription_payment_intents where id=p_payment_intent_id;
 if i.id is null then raise exception'PAYMENT_INTENT_NOT_FOUND'using errcode='P0002';end if;
 env:=private.assert_payment_runtime_v1(i.gateway,p_provider_environment,false);
 if i.provider_environment is distinct from p_provider_environment or i.deployment_environment is distinct from env then raise exception'PAYMENT_PROVIDER_ENVIRONMENT_MISMATCH'using errcode='23514';end if;
end$$;
create function private.enforce_payment_runtime_context_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$declare env text;intent public.subscription_payment_intents%rowtype;pay public.subscription_payment_events%rowtype;begin
 if tg_table_name='subscription_payment_adjustments'then select*into pay from public.subscription_payment_events where id=new.payment_event_id;new.provider_environment:=pay.provider_environment;
 elsif new.gateway='DEMO'and new.provider_environment='UNVERIFIED'then new.provider_environment:='DEMO';end if;
 env:=private.assert_payment_runtime_v1(new.gateway,new.provider_environment,new.provider_environment='UNVERIFIED');
 if new.deployment_environment is not null and new.deployment_environment<>env then raise exception'PAYMENT_DEPLOYMENT_ENVIRONMENT_MISMATCH'using errcode='23514';end if;new.deployment_environment:=env;
 if tg_table_name='subscription_payment_events'then
  select*into intent from public.subscription_payment_intents where id=new.payment_intent_id;
  if (case when intent.gateway='DEMO'then'DEMO'else intent.provider_environment end)is distinct from new.provider_environment or(intent.deployment_environment is not null and intent.deployment_environment<>env)or(env='PRODUCTION'and intent.deployment_environment is distinct from env)then raise exception'PAYMENT_PROVIDER_ENVIRONMENT_MISMATCH'using errcode='23514';end if;
 end if;
 return new;
end$$;
create trigger subscription_payment_preparation_runtime before insert on public.subscription_payment_preparations for each row execute function private.enforce_payment_runtime_context_v1();
create trigger subscription_payment_intent_runtime before insert on public.subscription_payment_intents for each row execute function private.enforce_payment_runtime_context_v1();
create trigger subscription_payment_event_runtime before insert on public.subscription_payment_events for each row execute function private.enforce_payment_runtime_context_v1();
create trigger subscription_adjustment_runtime before insert on public.subscription_payment_adjustments for each row execute function private.enforce_payment_runtime_context_v1();

create function private.prepare_subscription_payment_context_core_v1(p_organization_id uuid,p_plan_version_id uuid,p_billing_interval text,p_gateway text,p_idempotency_key text,p_provider_environment text,p_legacy boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid(); p public.subscription_plan_versions%rowtype; existing public.subscription_payment_preparations%rowtype; amount bigint; h text; inserted integer;
begin
 if a is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a) then raise exception 'PAYMENT_INTENT_CREATE_DENIED' using errcode='42501';end if;
 if p_billing_interval is null or p_billing_interval not in('MONTHLY','ANNUAL') or p_gateway is null or p_gateway not in('DEMO','CMI','PAYPAL') or length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'INVALID_PAYMENT_PREPARATION' using errcode='22023';end if;
 perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,p_legacy);
 select * into p from public.subscription_plan_versions where id=p_plan_version_id and status='ACTIVE' and valid_from<=current_date and(valid_to is null or valid_to>=current_date);
 if not found then raise exception 'ACTIVE_PLAN_VERSION_REQUIRED' using errcode='23514';end if;
 amount:=case p_billing_interval when'MONTHLY'then p.monthly_price_minor else p.annual_price_minor end;
 h:=private.canonical_request_hash(jsonb_build_object('organization',p_organization_id,'plan',p.id,'interval',p_billing_interval,'gateway',p_gateway,'provider_environment',p_provider_environment,'deployment_environment',(select environment from private.admin_execution_environment_v1 where singleton),'amount',amount,'currency',p.currency));
 insert into public.subscription_payment_preparations(organization_id,actor_id,idempotency_key,request_hash,plan_version_id,billing_interval,gateway,provider_environment,amount_minor,currency)
 values(p_organization_id,a,p_idempotency_key,h,p.id,p_billing_interval,p_gateway,p_provider_environment,amount,p.currency) on conflict do nothing;
 get diagnostics inserted=row_count;
 select * into existing from public.subscription_payment_preparations where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if existing.request_hash<>h then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH' using errcode='22000';end if;
 if inserted=1 then
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,a,'USER','subscription.payment_intent_prepared','subscription_payment_preparation',existing.id::text,existing.id,jsonb_build_object('gateway',p_gateway,'amount_minor',amount,'currency',p.currency),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'subscription_payment_preparation',existing.id::text,'SubscriptionPaymentIntentPreparedV1',existing.id,jsonb_build_object('preparation_id',existing.id,'gateway',p_gateway),'prepare:'||p_idempotency_key);
 end if;
 return jsonb_build_object('preparation_id',existing.id,'amount_minor',existing.amount_minor::text,'currency',existing.currency);
end $$;

create or replace function private.register_subscription_payment_context_core_v1(
  p_verified_actor uuid,
  p_provider_environment text,
  p_organization_id uuid,
  p_plan_version_id uuid,
  p_billing_interval text,
  p_gateway text,
  p_provider_intent_id text,
  p_amount_minor bigint,
  p_currency char(3),
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  actor uuid := p_verified_actor;
  plan public.subscription_plan_versions%rowtype;
  existing public.subscription_payment_intents%rowtype;
  expected_amount bigint;
  request_hash text;
  intent_id uuid;
  result jsonb;
begin
  if actor is null or not private.has_org_role(p_organization_id, array['CLIENT_OWNER','CLIENT_ADMIN'], actor) then
    raise exception 'PAYMENT_INTENT_CREATE_DENIED' using errcode = '42501';
  end if;
  if p_billing_interval is null or p_billing_interval not in ('MONTHLY','ANNUAL')
    or p_gateway is null or p_gateway not in ('DEMO','CMI','PAYPAL')
    or length(coalesce(p_provider_intent_id, '')) not between 8 and 200
    or length(coalesce(p_idempotency_key, '')) not between 8 and 200
    or p_amount_minor is null or p_amount_minor <= 0
    or p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'INVALID_PAYMENT_INTENT' using errcode = '22023';
  end if;
  perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,p_provider_environment='UNVERIFIED');
  select * into plan
  from public.subscription_plan_versions
  where id = p_plan_version_id and status = 'ACTIVE'
    and valid_from <= current_date and (valid_to is null or valid_to >= current_date);
  if not found then raise exception 'ACTIVE_PLAN_VERSION_REQUIRED' using errcode = '23514'; end if;
  expected_amount := case when p_billing_interval = 'MONTHLY' then plan.monthly_price_minor else plan.annual_price_minor end;
  if p_amount_minor is distinct from expected_amount or p_currency is distinct from plan.currency then
    raise exception 'PAYMENT_INTENT_AMOUNT_MISMATCH' using errcode = '23514';
  end if;
  request_hash := private.canonical_request_hash(jsonb_build_object(
    'organization', p_organization_id, 'plan_version', p_plan_version_id,
    'billing_interval', p_billing_interval, 'gateway', p_gateway, 'provider_environment',p_provider_environment,'deployment_environment',(select environment from private.admin_execution_environment_v1 where singleton),
    'provider_intent_id', p_provider_intent_id, 'amount_minor', p_amount_minor,
    'currency', p_currency
  ));
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0));
  select * into existing from public.subscription_payment_intents
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    if existing.request_hash <> request_hash then
      raise exception 'PAYMENT_INTENT_IDEMPOTENCY_MISMATCH' using errcode = '22000';
    end if;
    return jsonb_build_object('outcome','PAYMENT_INTENT_REGISTERED','payment_intent_id',existing.id,'provider_intent_id',existing.provider_intent_id,'replayed',true);
  end if;
  insert into public.subscription_payment_intents(
    organization_id, plan_version_id, billing_interval, gateway,provider_environment,
    provider_intent_id, amount_minor, currency, idempotency_key,
    request_hash, correlation_id, created_by
  ) values (
    p_organization_id, p_plan_version_id, p_billing_interval, p_gateway,p_provider_environment,
    p_provider_intent_id, p_amount_minor, p_currency, p_idempotency_key,
    request_hash, p_correlation_id, actor
  ) returning id into intent_id;
  result := jsonb_build_object('outcome','PAYMENT_INTENT_REGISTERED','payment_intent_id',intent_id,'provider_intent_id',p_provider_intent_id,'replayed',false);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(p_organization_id,actor,'USER','subscription.payment_intent_registered','subscription_payment_intent',intent_id::text,p_correlation_id,jsonb_build_object('plan_version_id',p_plan_version_id,'billing_interval',p_billing_interval,'gateway',p_gateway,'amount_minor',p_amount_minor,'currency',p_currency),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
  values(p_organization_id,'subscription_payment_intent',intent_id::text,'SubscriptionPaymentIntentRegisteredV1',p_correlation_id,result,p_idempotency_key);
  return result;
end
$$;


create or replace function private.process_subscription_payment_context_core_v1(
  p_provider_environment text,
  p_gateway text,
  p_provider_event_id text,
  p_provider_intent_id text,
  p_event_type text,
  p_amount_minor bigint,
  p_currency char(3),
  p_paid_at timestamptz,
  p_payment_reference text,
  p_payload_hash text,
  p_signature_fingerprint text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  intent public.subscription_payment_intents%rowtype;
  payment_event public.subscription_payment_events%rowtype;
  subscription public.subscriptions%rowtype;
  plan public.subscription_plan_versions%rowtype;
  expected_amount bigint;
  cycle_number integer;
  period_end timestamptz;
  cash_account_id uuid;
  revenue_account_id uuid;
  journal_id uuid := extensions.gen_random_uuid();
  result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'PAYMENT_EVENT_PROCESS_DENIED' using errcode = '42501';
  end if;
  if p_gateway is null or p_gateway not in ('DEMO','CMI','PAYPAL') or p_event_type is distinct from 'PAYMENT_SUCCEEDED'
    or length(coalesce(p_provider_event_id,'')) not between 8 and 200
    or length(coalesce(p_provider_intent_id,'')) not between 8 and 200
    or p_amount_minor is null or p_amount_minor <= 0
    or p_currency is null or p_currency !~ '^[A-Z]{3}$'
    or length(btrim(coalesce(p_payment_reference,''))) not between 3 and 200
    or p_payload_hash !~ '^[0-9a-f]{64}$'
    or p_signature_fingerprint !~ '^[0-9a-f]{64}$'
    or p_paid_at is null
    or p_paid_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'INVALID_VERIFIED_PAYMENT_EVENT' using errcode = '22023';
  end if;
  perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,p_provider_environment='UNVERIFIED');
  perform pg_advisory_xact_lock(hashtextextended(p_gateway || ':' || p_provider_event_id, 0));
  select payment_intent.* into intent
  from public.subscription_payment_intents payment_intent
  where payment_intent.gateway=p_gateway and payment_intent.provider_environment=p_provider_environment and payment_intent.provider_intent_id=p_provider_intent_id
  for update;
  if not found then raise exception 'PAYMENT_INTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if intent.gateway is distinct from p_gateway or intent.amount_minor is distinct from p_amount_minor or intent.currency is distinct from p_currency then
    raise exception 'VERIFIED_PAYMENT_AMOUNT_MISMATCH' using errcode = '23514';
  end if;
  if p_paid_at < intent.created_at - interval '5 minutes' then
    raise exception 'PAYMENT_EVENT_PREDATES_INTENT' using errcode = '23514';
  end if;

  select stored_event.* into payment_event
  from public.subscription_payment_events stored_event
  where stored_event.gateway=p_gateway and stored_event.provider_event_id=p_provider_event_id;
  if found then
    if payment_event.provider_environment is distinct from(case when p_gateway='DEMO'then'DEMO'else p_provider_environment end)or payment_event.payment_intent_id <> intent.id
      or payment_event.provider_intent_id is distinct from p_provider_intent_id
      or payment_event.payload_hash is distinct from p_payload_hash
      or payment_event.amount_minor is distinct from p_amount_minor
      or payment_event.currency is distinct from p_currency then
      raise exception 'PAYMENT_EVENT_REPLAY_MISMATCH' using errcode = '22000';
    end if;
    return payment_event.activation_result || jsonb_build_object('replayed',true);
  end if;

  select stored_subscription.* into subscription
  from public.subscriptions stored_subscription
  where stored_subscription.organization_id=intent.organization_id
  for update;
  if not found or subscription.status not in ('TRIAL_ACTIVE','TRIAL_EXPIRED','PAST_DUE','SUSPENDED') then
    raise exception 'SUBSCRIPTION_NOT_ACTIVATABLE' using errcode = '55000';
  end if;
  select plan_version.* into plan
  from public.subscription_plan_versions plan_version
  where plan_version.id=intent.plan_version_id and plan_version.status='ACTIVE'
    and plan_version.valid_from<=p_paid_at::date and (plan_version.valid_to is null or plan_version.valid_to>=p_paid_at::date);
  if not found then raise exception 'ACTIVE_PLAN_VERSION_REQUIRED' using errcode = '23514'; end if;
  expected_amount := case when intent.billing_interval='MONTHLY' then plan.monthly_price_minor else plan.annual_price_minor end;
  if expected_amount <> intent.amount_minor or plan.currency <> intent.currency then
    raise exception 'PAYMENT_PLAN_SNAPSHOT_MISMATCH' using errcode = '23514';
  end if;

  insert into public.financial_accounts(organization_id,code,name,account_type,currency)
  values
    (intent.organization_id,'PAYMENT_CASH_'||btrim(intent.currency::text),'Subscription payment cash '||btrim(intent.currency::text),'ASSET',intent.currency),
    (intent.organization_id,'SUBSCRIPTION_REVENUE_'||btrim(intent.currency::text),'Subscription revenue '||btrim(intent.currency::text),'REVENUE',intent.currency)
  on conflict(organization_id,code) do nothing;
  select financial_account.id into cash_account_id
  from public.financial_accounts financial_account
  where financial_account.organization_id=intent.organization_id
    and financial_account.code='PAYMENT_CASH_'||btrim(intent.currency::text)
    and financial_account.account_type='ASSET' and financial_account.currency=intent.currency;
  select financial_account.id into revenue_account_id
  from public.financial_accounts financial_account
  where financial_account.organization_id=intent.organization_id
    and financial_account.code='SUBSCRIPTION_REVENUE_'||btrim(intent.currency::text)
    and financial_account.account_type='REVENUE' and financial_account.currency=intent.currency;
  if cash_account_id is null or revenue_account_id is null then
    raise exception 'SUBSCRIPTION_LEDGER_ACCOUNTS_INVALID' using errcode='23514';
  end if;
  insert into public.financial_journals(
    id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,
    correlation_id,effective_at,description,created_by
  ) values (
    journal_id,intent.organization_id,'SUBSCRIPTION_PAYMENT',intent.currency,
    'subscription.payment',p_gateway||':'||p_provider_event_id,p_correlation_id,p_paid_at,
    'Verified subscription payment',intent.created_by
  );
  insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)
  values
    (intent.organization_id,journal_id,cash_account_id,'DEBIT',intent.amount_minor,intent.currency),
    (intent.organization_id,journal_id,revenue_account_id,'CREDIT',intent.amount_minor,intent.currency);
  insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(intent.organization_id,'SERVICE','financial.journal.posted','financial_journal',journal_id::text,p_correlation_id,
    jsonb_build_object('journal_type','SUBSCRIPTION_PAYMENT','currency',intent.currency,'debit_minor',intent.amount_minor),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
  values(intent.organization_id,'financial_journal',journal_id::text,'FinancialJournalPostedV1',p_correlation_id,
    jsonb_build_object('journal_id',journal_id,'organization_id',intent.organization_id,'currency',intent.currency,'debit_minor',intent.amount_minor),
    'finance:'||p_gateway||':'||p_provider_event_id);

  period_end := case when intent.billing_interval='MONTHLY' then p_paid_at + interval '1 month' else p_paid_at + interval '1 year' end;
  select coalesce(max(subscription_cycle.cycle_number),0)+1 into cycle_number
  from public.subscription_cycles subscription_cycle
  where subscription_cycle.subscription_id=subscription.id;
  insert into public.subscription_cycles(subscription_id,organization_id,plan_version_id,cycle_number,period_start,period_end,currency,amount_minor,payment_reference,payment_proof_hash,correlation_id)
  values(subscription.id,intent.organization_id,plan.id,cycle_number,p_paid_at,period_end,intent.currency,intent.amount_minor,p_payment_reference,p_payload_hash,p_correlation_id);
  update public.subscriptions set plan_version_id=plan.id,pending_plan_version_id=null,status='ACTIVE',billing_interval=intent.billing_interval,current_period_start=p_paid_at,current_period_end=period_end,pending_change_effective_at=null,row_version=row_version+1,updated_at=clock_timestamp() where id=subscription.id;
  insert into public.subscription_state_events(subscription_id,organization_id,from_status,to_status,reason_code,idempotency_key,correlation_id,actor_user_id)
  values(subscription.id,intent.organization_id,subscription.status,'ACTIVE','VERIFIED_PAYMENT',p_provider_event_id,p_correlation_id,intent.created_by);
  result := jsonb_build_object('outcome','SUBSCRIPTION_ACTIVATED','subscription_id',subscription.id,'payment_intent_id',intent.id,'provider_event_id',p_provider_event_id,'financial_journal_id',journal_id,'cycle_number',cycle_number,'period_end',period_end,'amount_minor',intent.amount_minor,'currency',intent.currency,'replayed',false);
  insert into public.subscription_payment_events(
    payment_intent_id,organization_id,gateway,provider_environment,provider_event_id,provider_intent_id,event_type,
    amount_minor,currency,paid_at,payment_reference,payload_hash,signature_fingerprint,
    activation_result,correlation_id
  ) values (
    intent.id,intent.organization_id,p_gateway,p_provider_environment,p_provider_event_id,p_provider_intent_id,p_event_type,
    p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_payload_hash,p_signature_fingerprint,
    result,p_correlation_id
  );
  insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(intent.organization_id,'SERVICE','subscription.activated_from_verified_payment','subscription',subscription.id::text,p_correlation_id,jsonb_build_object('payment_intent_id',intent.id,'provider_event_id',p_provider_event_id,'gateway',p_gateway,'cycle_number',cycle_number),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
  values(intent.organization_id,'subscription',subscription.id::text,'SubscriptionPaidV1',p_correlation_id,result,p_gateway || ':' || p_provider_event_id);
  return result;
end
$$;

revoke all on function public.process_verified_subscription_payment(text,text,text,text,bigint,character,timestamptz,text,text,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.process_verified_subscription_payment(text,text,text,text,bigint,character,timestamptz,text,text,text,uuid)
  to service_role;

create or replace function public.prepare_subscription_payment_intent_v1(p_organization_id uuid,p_plan_version_id uuid,p_billing_interval text,p_gateway text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 perform private.require_legacy_payment_nonproduction_v1();return private.prepare_subscription_payment_context_core_v1(p_organization_id,p_plan_version_id,p_billing_interval,p_gateway,p_idempotency_key,case when p_gateway='DEMO'then'DEMO'else'UNVERIFIED'end,true);
end$$;
create function public.prepare_subscription_payment_intent_v2(p_organization_id uuid,p_plan_version_id uuid,p_billing_interval text,p_gateway text,p_provider_environment text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 return private.prepare_subscription_payment_context_core_v1(p_organization_id,p_plan_version_id,p_billing_interval,p_gateway,p_idempotency_key,p_provider_environment,false);
end$$;
create or replace function public.register_subscription_payment_intent(p_organization_id uuid,p_plan_version_id uuid,p_billing_interval text,p_gateway text,p_provider_intent_id text,p_amount_minor bigint,p_currency char(3),p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 perform private.require_legacy_payment_nonproduction_v1();return private.register_subscription_payment_context_core_v1(auth.uid(),case when p_gateway='DEMO'then'DEMO'else'UNVERIFIED'end,p_organization_id,p_plan_version_id,p_billing_interval,p_gateway,p_provider_intent_id,p_amount_minor,p_currency,p_idempotency_key,p_correlation_id);
end$$;
create function public.register_subscription_payment_intent_v2(p_preparation_id uuid,p_provider_environment text,p_provider_intent_id text,p_amount_minor bigint,p_currency char(3),p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare p public.subscription_payment_preparations%rowtype;env text;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_SERVER_REGISTRATION_REQUIRED'using errcode='42501';end if;
 select*into p from public.subscription_payment_preparations where id=p_preparation_id;
 if p.id is null then raise exception'PAYMENT_PREPARATION_NOT_FOUND'using errcode='P0002';end if;
 env:=private.assert_payment_runtime_v1(p.gateway,p_provider_environment,false);
 if p.provider_environment is distinct from p_provider_environment or p.deployment_environment is distinct from env or p.amount_minor is distinct from p_amount_minor or p.currency is distinct from p_currency then raise exception'PAYMENT_PREPARATION_BINDING_MISMATCH'using errcode='23514';end if;
 return private.register_subscription_payment_context_core_v1(p.actor_id,p_provider_environment,p.organization_id,p.plan_version_id,p.billing_interval,p.gateway,p_provider_intent_id,p_amount_minor,p_currency,p.idempotency_key,p_correlation_id);
end$$;
create or replace function public.process_verified_subscription_payment(p_gateway text,p_provider_event_id text,p_provider_intent_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_payment_reference text,p_payload_hash text,p_signature_fingerprint text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare env text;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_EVENT_PROCESS_DENIED'using errcode='42501';end if;perform private.require_legacy_payment_nonproduction_v1();
 select provider_environment into env from public.subscription_payment_intents where gateway=p_gateway and provider_intent_id=p_provider_intent_id;
 if env is null then raise exception'PAYMENT_INTENT_NOT_FOUND'using errcode='P0002';end if;
 return private.process_subscription_payment_context_core_v1(env,p_gateway,p_provider_event_id,p_provider_intent_id,p_event_type,p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_payload_hash,p_signature_fingerprint,p_correlation_id);
end$$;
create function public.process_verified_subscription_payment_v2(p_gateway text,p_provider_environment text,p_provider_event_id text,p_provider_intent_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_paid_at timestamptz,p_payment_reference text,p_payload_hash text,p_signature_fingerprint text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare id uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'PAYMENT_EVENT_PROCESS_DENIED'using errcode='42501';end if;
 select intent.id into id from public.subscription_payment_intents intent where gateway=p_gateway and provider_intent_id=p_provider_intent_id;
 perform private.require_payment_intent_runtime_v1(id,p_provider_environment);
 return private.process_subscription_payment_context_core_v1(p_provider_environment,p_gateway,p_provider_event_id,p_provider_intent_id,p_event_type,p_amount_minor,p_currency,p_paid_at,p_payment_reference,p_payload_hash,p_signature_fingerprint,p_correlation_id);
end$$;
create or replace function public.prepare_subscription_payment_capture(p_payment_intent_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare intent public.subscription_payment_intents%rowtype;begin
 select*into intent from public.subscription_payment_intents where id=p_payment_intent_id;
 if auth.uid()is null or intent.id is null or not private.has_org_role(intent.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_CAPTURE_DENIED'using errcode='42501';end if;
 perform private.require_legacy_payment_nonproduction_v1();if intent.gateway<>'PAYPAL'then raise exception'PAYPAL_INTENT_REQUIRED'using errcode='22023';end if;
 return jsonb_build_object('payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'replayed',false);
end$$;
create function public.prepare_subscription_payment_capture_v2(p_payment_intent_id uuid,p_provider_environment text)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare intent public.subscription_payment_intents%rowtype;begin
 select*into intent from public.subscription_payment_intents where id=p_payment_intent_id;
 if auth.uid()is null or intent.id is null or not private.has_org_role(intent.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_CAPTURE_DENIED'using errcode='42501';end if;
 perform private.require_payment_intent_runtime_v1(intent.id,p_provider_environment);if intent.gateway<>'PAYPAL'then raise exception'PAYPAL_INTENT_REQUIRED'using errcode='22023';end if;
 return jsonb_build_object('payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'replayed',false);
end$$;
-- Existing refund business cores are private; v2 checks the actual API/certificate environment first.
alter function public.prepare_subscription_refund_send_v1(uuid)set schema private;
alter function private.prepare_subscription_refund_send_v1(uuid)rename to prepare_refund_send_context_core_v1;
alter function public.load_refund_reconciliation_work_v1(uuid)set schema private;
alter function private.load_refund_reconciliation_work_v1(uuid)rename to load_refund_context_core_v1;
alter function public.complete_refund_native_reconciliation_v1(uuid,text,text,uuid,bigint,character,text,text,timestamptz)set schema private;
alter function private.complete_refund_native_reconciliation_v1(uuid,text,text,uuid,bigint,character,text,text,timestamptz)rename to complete_refund_context_core_v1;
create or replace function public.process_verified_subscription_adjustment_v1(p_provider_event_id text,p_provider_payment_id text,p_provider_adjustment_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_occurred_at timestamptz,p_payload_hash text,p_signature_fingerprint text,p_merchant_reference uuid default null,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;perform private.require_legacy_payment_nonproduction_v1();
 return private.apply_subscription_adjustment_v1(p_provider_event_id,p_provider_payment_id,p_provider_adjustment_id,p_event_type,p_amount_minor,p_currency,p_occurred_at,p_payload_hash,p_signature_fingerprint,p_merchant_reference,p_correlation_id,'WEBHOOK_RSA');
end$$;
create function public.process_verified_subscription_adjustment_v2(p_provider_environment text,p_provider_event_id text,p_provider_payment_id text,p_provider_adjustment_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_occurred_at timestamptz,p_payload_hash text,p_signature_fingerprint text,p_merchant_reference uuid default null,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare pay public.subscription_payment_events%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 select*into pay from public.subscription_payment_events where gateway='PAYPAL'and payment_reference=p_provider_payment_id;
 if pay.id is null then raise exception'CAPTURE_NOT_YET_RECORDED'using errcode='P0002';end if;perform private.require_payment_intent_runtime_v1(pay.payment_intent_id,p_provider_environment);
 return private.apply_subscription_adjustment_v1(p_provider_event_id,p_provider_payment_id,p_provider_adjustment_id,p_event_type,p_amount_minor,p_currency,p_occurred_at,p_payload_hash,p_signature_fingerprint,p_merchant_reference,p_correlation_id,'WEBHOOK_RSA');
end$$;
create function private.require_refund_runtime_v1(p_request_id uuid,p_provider_environment text,p_reconciliation boolean)returns void language plpgsql stable security definer set search_path=pg_catalog,private as $$declare refund_id uuid;intent_id uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 refund_id:=case when p_reconciliation then(select refund_request_id from public.subscription_refund_reconciliation_requests where id=p_request_id)else p_request_id end;
 select pay.payment_intent_id into intent_id from public.subscription_refund_requests r join public.subscription_payment_events pay on pay.id=r.payment_event_id where r.id=refund_id;
 perform private.require_payment_intent_runtime_v1(intent_id,p_provider_environment);
end$$;
create function public.prepare_subscription_refund_send_v1(p_request_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;perform private.require_legacy_payment_nonproduction_v1();return private.prepare_refund_send_context_core_v1(p_request_id);
end$$;
create function public.prepare_subscription_refund_send_v2(p_request_id uuid,p_provider_environment text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 perform private.require_refund_runtime_v1(p_request_id,p_provider_environment,false);return private.prepare_refund_send_context_core_v1(p_request_id);
end$$;
create function public.load_refund_reconciliation_work_v1(p_request_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;perform private.require_legacy_payment_nonproduction_v1();return private.load_refund_context_core_v1(p_request_id);
end$$;
create function public.load_refund_reconciliation_work_v2(p_request_id uuid,p_provider_environment text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 perform private.require_refund_runtime_v1(p_request_id,p_provider_environment,true);return private.load_refund_context_core_v1(p_request_id);
end$$;
create or replace function private.complete_refund_context_core_v1(p_request_id uuid,p_provider_refund_id text,p_capture_id text,p_invoice_id uuid,p_amount_minor bigint,p_currency char(3),p_status text,p_response_hash text,p_occurred_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare work jsonb;q public.subscription_refund_reconciliation_requests%rowtype;r public.subscription_refund_requests%rowtype;pay public.subscription_payment_events%rowtype;result jsonb;eventid text;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 select*into q from public.subscription_refund_reconciliation_requests where id=p_request_id for update;
 if not found then raise exception'REFUND_RECONCILIATION_NOT_FOUND'using errcode='P0002';end if;
 if q.status='CONFIRMED'or(q.status='REJECTED'and q.completed_at is not null)then if q.response_hash is distinct from p_response_hash then raise exception'REFUND_NATIVE_REPLAY_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','REFUND_RECONCILIATION_CONFIRMED','replayed',true);end if;
 work:=private.load_refund_context_core_v1(p_request_id);
 if p_provider_refund_id is distinct from work->>'provider_refund_id'or p_capture_id is distinct from work->>'capture_id'or p_invoice_id is distinct from(work->>'refund_request_id')::uuid or p_amount_minor is distinct from(work->>'amount_minor')::bigint or p_currency is distinct from(work->>'currency')::char(3)or p_status is null or p_status not in('COMPLETED','PENDING','FAILED','CANCELLED')or p_response_hash is null or p_response_hash!~'^[0-9a-f]{64}$'or p_occurred_at is null or p_occurred_at>clock_timestamp()+interval'5 minutes'then raise exception'REFUND_NATIVE_PROOF_MISMATCH'using errcode='23514';end if;
 if p_status='PENDING'then return jsonb_build_object('outcome','REFUND_STILL_PENDING');end if;
 select*into r from public.subscription_refund_requests where id=q.refund_request_id for update;
 select*into pay from public.subscription_payment_events where id=r.payment_event_id for update;
 if p_status='COMPLETED'then
  eventid:='PAYPAL-API-REFUND-'||encode(extensions.digest(p_provider_refund_id,'sha256'),'hex');
  result:=private.apply_subscription_adjustment_v1(eventid,p_capture_id,p_provider_refund_id,'REFUND_SUCCEEDED',p_amount_minor,p_currency,p_occurred_at,p_response_hash,null,r.id,q.id,'API_OAUTH2_TLS');
  update public.subscription_refund_requests set status='CONFIRMED',provider_refund_id=p_provider_refund_id where id=r.id;
 else
  if exists(select 1 from public.subscription_payment_adjustments where payment_event_id=pay.id and event_type='REFUND_SUCCEEDED'and provider_adjustment_id=p_provider_refund_id)then raise exception'REFUND_TERMINAL_PROOF_CONFLICT'using errcode='23514';end if;
  update public.subscription_refund_requests set status='CANCELLED',provider_refund_id=p_provider_refund_id where id=r.id;
 end if;
 update public.subscription_refund_reconciliation_requests set status=case when p_status='COMPLETED'then'CONFIRMED'else'REJECTED'end,response_hash=p_response_hash,completed_at=clock_timestamp()where id=q.id;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(pay.organization_id,'SERVICE','subscription.refund.native_reconciled','subscription_refund_reconciliation_request',q.id::text,q.id,jsonb_build_object('verification_method','API_OAUTH2_TLS','provider_status',p_status,'response_hash',p_response_hash),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(pay.organization_id,'subscription_refund_reconciliation_request',q.id::text,'SubscriptionRefundReconciledV1',q.id,jsonb_build_object('refund_request_id',r.id,'provider_status',p_status),'refund-reconciled:'||q.id::text)on conflict do nothing;
 return jsonb_build_object('outcome',case when p_status='COMPLETED'then'REFUND_RECONCILIATION_CONFIRMED'else'REFUND_FAILURE_CONFIRMED'end);
end$$;
create function public.complete_refund_native_reconciliation_v1(p_request_id uuid,p_provider_refund_id text,p_capture_id text,p_invoice_id uuid,p_amount_minor bigint,p_currency char(3),p_status text,p_response_hash text,p_occurred_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;perform private.require_legacy_payment_nonproduction_v1();return private.complete_refund_context_core_v1(p_request_id,p_provider_refund_id,p_capture_id,p_invoice_id,p_amount_minor,p_currency,p_status,p_response_hash,p_occurred_at);
end$$;
create function public.complete_refund_native_reconciliation_v2(p_request_id uuid,p_provider_environment text,p_provider_refund_id text,p_capture_id text,p_invoice_id uuid,p_amount_minor bigint,p_currency char(3),p_status text,p_response_hash text,p_occurred_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 perform private.require_refund_runtime_v1(p_request_id,p_provider_environment,true);return private.complete_refund_context_core_v1(p_request_id,p_provider_refund_id,p_capture_id,p_invoice_id,p_amount_minor,p_currency,p_status,p_response_hash,p_occurred_at);
end$$;
revoke all on function private.assert_payment_runtime_v1(text,text,boolean),private.require_legacy_payment_nonproduction_v1(),private.require_payment_intent_runtime_v1(uuid,text),private.enforce_payment_runtime_context_v1(),private.prepare_subscription_payment_context_core_v1(uuid,uuid,text,text,text,text,boolean),private.register_subscription_payment_context_core_v1(uuid,text,uuid,uuid,text,text,text,bigint,character,text,uuid),private.process_subscription_payment_context_core_v1(text,text,text,text,text,bigint,character,timestamptz,text,text,text,uuid),private.require_refund_runtime_v1(uuid,text,boolean),private.prepare_refund_send_context_core_v1(uuid),private.load_refund_context_core_v1(uuid),private.complete_refund_context_core_v1(uuid,text,text,uuid,bigint,character,text,text,timestamptz)from public,anon,authenticated,service_role;
revoke all on function public.prepare_subscription_payment_intent_v2(uuid,uuid,text,text,text,text),public.prepare_subscription_payment_capture_v2(uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.prepare_subscription_payment_intent_v2(uuid,uuid,text,text,text,text),public.prepare_subscription_payment_capture_v2(uuid,text)to authenticated;
revoke all on function public.register_subscription_payment_intent_v2(uuid,text,text,bigint,character,uuid),public.process_verified_subscription_payment_v2(text,text,text,text,text,bigint,character,timestamptz,text,text,text,uuid),public.process_verified_subscription_adjustment_v2(text,text,text,text,text,bigint,character,timestamptz,text,text,uuid,uuid),public.prepare_subscription_refund_send_v1(uuid),public.prepare_subscription_refund_send_v2(uuid,text),public.load_refund_reconciliation_work_v1(uuid),public.load_refund_reconciliation_work_v2(uuid,text),public.complete_refund_native_reconciliation_v1(uuid,text,text,uuid,bigint,character,text,text,timestamptz),public.complete_refund_native_reconciliation_v2(uuid,text,text,text,uuid,bigint,character,text,text,timestamptz)from public,anon,authenticated,service_role;
grant execute on function public.register_subscription_payment_intent_v2(uuid,text,text,bigint,character,uuid),public.process_verified_subscription_payment_v2(text,text,text,text,text,bigint,character,timestamptz,text,text,text,uuid),public.process_verified_subscription_adjustment_v2(text,text,text,text,text,bigint,character,timestamptz,text,text,uuid,uuid),public.prepare_subscription_refund_send_v1(uuid),public.prepare_subscription_refund_send_v2(uuid,text),public.load_refund_reconciliation_work_v1(uuid),public.load_refund_reconciliation_work_v2(uuid,text),public.complete_refund_native_reconciliation_v1(uuid,text,text,uuid,bigint,character,text,text,timestamptz),public.complete_refund_native_reconciliation_v2(uuid,text,text,text,uuid,bigint,character,text,text,timestamptz)to service_role;
notify pgrst,'reload schema';
commit;
