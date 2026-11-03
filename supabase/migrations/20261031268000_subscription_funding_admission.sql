begin;
-- Admission only. Immutable payments, cycles, financial entries and existing grants are preserved.
create index subscription_payment_funding_reference_idx on public.subscription_payment_events(organization_id,payment_reference,payload_hash);
create function private.subscription_payment_cycle_v1(p_payment_event_id bigint)returns uuid language plpgsql stable security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare pay public.subscription_payment_events%rowtype;intent public.subscription_payment_intents%rowtype;ids uuid[];begin
 select*into pay from public.subscription_payment_events where id=p_payment_event_id;select*into intent from public.subscription_payment_intents where id=pay.payment_intent_id;
 if pay.id is null or intent.id is null or pay.event_type<>'PAYMENT_SUCCEEDED'or pay.amount_minor<=0 or pay.organization_id is distinct from intent.organization_id or pay.gateway is distinct from intent.gateway or pay.provider_intent_id is distinct from intent.provider_intent_id or pay.provider_environment is distinct from intent.provider_environment or pay.deployment_environment is distinct from intent.deployment_environment or pay.amount_minor is distinct from intent.amount_minor or pay.currency is distinct from intent.currency or pay.activation_result->>'payment_intent_id'is distinct from intent.id::text or pay.activation_result->>'provider_event_id'is distinct from pay.provider_event_id or pay.activation_result->>'outcome'is distinct from'SUBSCRIPTION_ACTIVATED'or pay.activation_result->>'currency'is distinct from btrim(pay.currency::text)or(pay.activation_result->>'amount_minor')::numeric is distinct from pay.amount_minor::numeric then return null;end if;
 select array_agg(cycle.id order by cycle.id)into ids from public.subscription_cycles cycle join public.subscriptions subscription on subscription.id=cycle.subscription_id and subscription.organization_id=cycle.organization_id join public.subscription_plan_versions plan on plan.id=cycle.plan_version_id
 where cycle.organization_id=pay.organization_id and cycle.payment_reference=pay.payment_reference and cycle.payment_proof_hash=pay.payload_hash and cycle.currency=pay.currency and cycle.amount_minor=pay.amount_minor and cycle.plan_version_id=intent.plan_version_id and cycle.subscription_id::text=pay.activation_result->>'subscription_id'and cycle.cycle_number::text=pay.activation_result->>'cycle_number'and cycle.period_start=pay.paid_at and cycle.period_end=(pay.activation_result->>'period_end')::timestamptz and cycle.period_end=pay.paid_at+case intent.billing_interval when'MONTHLY'then interval'1 month'when'ANNUAL'then interval'1 year'else null end and cycle.amount_minor=case intent.billing_interval when'MONTHLY'then plan.monthly_price_minor when'ANNUAL'then plan.annual_price_minor else null end and cycle.currency=plan.currency
 and exists(select 1 from public.financial_journals journal where journal.id=(pay.activation_result->>'financial_journal_id')::uuid and journal.organization_id=pay.organization_id and journal.journal_type='SUBSCRIPTION_PAYMENT'and journal.currency=pay.currency and journal.effective_at=pay.paid_at and journal.correlation_id=pay.correlation_id and(select coalesce(sum(entry.amount_minor)filter(where entry.direction='DEBIT'),0)=pay.amount_minor and coalesce(sum(entry.amount_minor)filter(where entry.direction='CREDIT'),0)=pay.amount_minor from public.financial_entries entry where entry.journal_id=journal.id and entry.organization_id=pay.organization_id and entry.currency=pay.currency));
 if cardinality(ids)is distinct from 1 then return null;end if;return ids[1];
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then return null;
end$$;
create function private.subscription_payment_funding_environment_compatible_v1(p_payment_event_id bigint)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$declare env text;pay public.subscription_payment_events%rowtype;begin
 select environment into env from private.admin_execution_environment_v1 where singleton;if env not in('DEVELOPMENT','STAGING','PRODUCTION')or env is null then return false;end if;
 select*into pay from public.subscription_payment_events where id=p_payment_event_id;
 if pay.id is null or private.subscription_payment_cycle_v1(pay.id)is null or pay.deployment_environment not in('DEVELOPMENT','STAGING','PRODUCTION')or pay.deployment_environment is null then return false;end if;
 -- An actual LIVE payment remains real across an infrastructure promotion. No history is reclassified.
 if pay.provider_environment='LIVE'and pay.gateway in('PAYPAL','CMI')then return true;end if;
 return env in('DEVELOPMENT','STAGING')and pay.deployment_environment=env and((pay.provider_environment='DEMO'and pay.gateway='DEMO')or(pay.provider_environment='SANDBOX'and pay.gateway in('PAYPAL','CMI')));
end$$;
create function private.subscription_cycle_funding_compatible_v1(p_cycle_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select count(*)=1 from public.subscription_payment_events pay join public.subscription_cycles cycle on cycle.id=p_cycle_id and cycle.organization_id=pay.organization_id and cycle.payment_reference=pay.payment_reference and cycle.payment_proof_hash=pay.payload_hash where private.subscription_payment_cycle_v1(pay.id)=cycle.id and private.subscription_payment_funding_environment_compatible_v1(pay.id)$$;
create function private.current_subscription_funding_v1(p_organization_id uuid,p_at timestamptz default statement_timestamp())returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare s public.subscriptions%rowtype;ids uuid[];cycle public.subscription_cycles%rowtype;begin
 select*into s from public.subscriptions where organization_id=p_organization_id;
 if s.id is null or s.status<>'ACTIVE'or p_at is null or s.current_period_start is null or s.current_period_end is null or p_at<s.current_period_start or p_at>=s.current_period_end then return null;end if;
 select array_agg(id order by id)into ids from public.subscription_cycles where subscription_id=s.id and organization_id=s.organization_id and period_start=s.current_period_start and period_end=s.current_period_end;
 if cardinality(ids)is distinct from 1 or not private.subscription_cycle_funding_compatible_v1(ids[1])then return null;end if;
 select*into cycle from public.subscription_cycles where id=ids[1];
 return jsonb_build_object('subscription_id',s.id,'cycle_id',cycle.id,'funded_plan_version_id',cycle.plan_version_id,'period_start',cycle.period_start,'period_end',cycle.period_end);
end$$;
revoke all on function private.subscription_payment_cycle_v1(bigint),private.subscription_payment_funding_environment_compatible_v1(bigint),private.subscription_cycle_funding_compatible_v1(uuid),private.current_subscription_funding_v1(uuid,timestamptz)from public,anon,authenticated,service_role;
create or replace function public.subscription_has_entitlement(p_organization_id uuid,p_entitlement_code text,p_at timestamptz default clock_timestamp())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select private.subscription_read_access(p_organization_id,auth.uid())and private.subscription_financially_clear(p_organization_id)and private.client_identity_allows_new_operations(p_organization_id)and case when exists(select 1 from public.client_trials t join public.trial_entitlement_versions te on te.entitlement_code=p_entitlement_code and te.status='ACTIVE'and te.enabled and te.effective_from<=p_at and(te.effective_to is null or te.effective_to>p_at)where t.organization_id=p_organization_id and t.status='TRIAL_ACTIVE'and p_at<t.trial_ends_at and not exists(select 1 from public.subscriptions s join public.subscription_entitlement_suspensions x on x.subscription_id=s.id where s.organization_id=p_organization_id and x.entitlement_code=p_entitlement_code and x.effective_from<=p_at and(x.effective_to is null or x.effective_to>p_at)))then true else exists(select 1 from public.subscriptions s join public.plan_entitlements e on e.plan_version_id=(private.current_subscription_funding_v1(s.organization_id,p_at)->>'funded_plan_version_id')::uuid where s.organization_id=p_organization_id and e.entitlement_code=p_entitlement_code and e.enabled and not exists(select 1 from public.subscription_entitlement_suspensions x where x.subscription_id=s.id and x.entitlement_code=e.entitlement_code and x.effective_from<=p_at and(x.effective_to is null or x.effective_to>p_at)))end
$$;
create or replace function private.client_may_open_new_service_request(p_organization_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select private.subscription_financially_clear(p_organization_id)and private.client_identity_allows_new_operations(p_organization_id)
 and not exists(select 1 from public.subscriptions s where s.organization_id=p_organization_id and s.status not in('TRIAL_ACTIVE','ACTIVE'))
 and(not exists(select 1 from public.subscriptions s where s.organization_id=p_organization_id and s.status='ACTIVE')or exists(select 1 from public.client_trials t where t.organization_id=p_organization_id and t.status='TRIAL_ACTIVE'and t.trial_ends_at>statement_timestamp())or private.current_subscription_funding_v1(p_organization_id,statement_timestamp())is not null)
 and not exists(select 1 from public.client_trials t where t.organization_id=p_organization_id and(t.status='TRIAL_EXPIRED'or t.trial_ends_at<=statement_timestamp())and private.current_subscription_funding_v1(p_organization_id,statement_timestamp())is null)
 and not exists(select 1 from public.client_administrative_anomalies a where a.organization_id=p_organization_id and a.anomaly_code='DOCUMENT_EXPIRED'and a.status in('OPEN','QUESTIONED'))
$$;
create or replace function private.guard_subscription_financial_new_request()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$begin
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.client_organization_id::text,0));
 if exists(select 1 from public.subscription_financial_holds h where h.organization_id=new.client_organization_id and h.active)then raise exception'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 if not private.client_identity_allows_new_operations(new.client_organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 if not private.client_may_open_new_service_request(new.client_organization_id)then raise exception'SUBSCRIPTION_CURRENT_FUNDING_REQUIRED'using errcode='55000';end if;return new;
end$$;
create or replace function public.change_subscription_plan(p_subscription_id uuid,p_target_plan_version_id uuid,p_change_mode text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();s public.subscriptions%rowtype;pv public.subscription_plan_versions%rowtype;h text;r jsonb;cached public.idempotency_keys%rowtype;begin
 select*into s from public.subscriptions where id=p_subscription_id;
 if a is null or s.id is null or not(private.has_org_role(s.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)or private.subscription_admin_access(a))then raise exception'SUBSCRIPTION_CHANGE_DENIED'using errcode='42501';end if;
 if p_change_mode not in('UPGRADE_IMMEDIATE','DOWNGRADE_NEXT_CYCLE')or p_change_mode is null then raise exception'INVALID_PLAN_CHANGE_MODE'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('subscription',s.id,'target',p_target_plan_version_id,'mode',p_change_mode));
 select*into cached from public.idempotency_keys where organization_id=s.organization_id and operation_scope='subscription.plan.change'and key=p_idempotency_key;
 if found then if cached.request_hash is distinct from h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;if cached.status='COMPLETED'then return cached.response_body;end if;end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||s.organization_id::text,0));select*into s from public.subscriptions where id=p_subscription_id for update;
 if not(private.has_org_role(s.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)or private.subscription_admin_access(a))then raise exception'SUBSCRIPTION_CHANGE_DENIED'using errcode='42501';end if;
 if s.status<>'ACTIVE'or private.current_subscription_funding_v1(s.organization_id,clock_timestamp())is null then raise exception'SUBSCRIPTION_CURRENT_FUNDING_REQUIRED'using errcode='55000';end if;
 if not private.subscription_financially_clear(s.organization_id)then raise exception'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 if not private.client_identity_allows_new_operations(s.organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 select*into pv from public.subscription_plan_versions where id=p_target_plan_version_id and status='ACTIVE'and valid_from<=current_date and(valid_to is null or valid_to>=current_date);
 if pv.id is null or pv.id=s.plan_version_id then raise exception'INVALID_TARGET_PLAN_VERSION'using errcode='23514';end if;
 if p_change_mode='UPGRADE_IMMEDIATE'then raise exception'SUBSCRIPTION_UPGRADE_CHECKOUT_REQUIRED'using errcode='55000';end if;
 r:=private.begin_subscription_command(s.organization_id,'subscription.plan.change',p_idempotency_key,h,a);if r is not null then return r;end if;
 update public.subscriptions set pending_plan_version_id=pv.id,pending_change_effective_at=s.current_period_end,row_version=row_version+1,updated_at=clock_timestamp()where id=s.id;
 r:=jsonb_build_object('outcome','SUBSCRIPTION_PLAN_CHANGED','subscription_id',s.id,'target_plan_version_id',pv.id,'change_mode',p_change_mode,'effective_at',s.current_period_end);
 insert into public.subscription_state_events(subscription_id,organization_id,from_status,to_status,reason_code,idempotency_key,correlation_id,actor_user_id)values(s.id,s.organization_id,'ACTIVE','ACTIVE',p_change_mode,p_idempotency_key,p_correlation_id,a);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(s.organization_id,a,'USER','subscription.plan_changed','subscription',s.id::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(s.organization_id,'subscription',s.id::text,'SubscriptionChangedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_subscription_command(s.organization_id,'subscription.plan.change',p_idempotency_key,r);return r;
end$$;
create function public.get_client_subscription_funding_v1(p_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare funding jsonb;trial boolean;begin
 if auth.uid()is null or not private.subscription_read_access(p_organization_id,auth.uid())then raise exception'SUBSCRIPTION_READ_DENIED'using errcode='42501';end if;
 funding:=private.current_subscription_funding_v1(p_organization_id,statement_timestamp());select exists(select 1 from public.client_trials where organization_id=p_organization_id and status='TRIAL_ACTIVE'and trial_ends_at>statement_timestamp())into trial;
 return jsonb_build_object('status',case when funding is not null then'PAID_CYCLE_VERIFIED'when trial then'TRIAL_ACTIVE'when not exists(select 1 from public.subscriptions where organization_id=p_organization_id and status='ACTIVE')then'NO_ACTIVE_PAID_CYCLE'else'PAYMENT_FUNDING_REVIEW_REQUIRED'end,'funded_cycle',funding,'new_request_admissible',private.client_may_open_new_service_request(p_organization_id));
end$$;
revoke all on function private.client_may_open_new_service_request(uuid),private.guard_subscription_financial_new_request()from public,anon,authenticated,service_role;
revoke all on function public.get_client_subscription_funding_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_subscription_funding_v1(uuid)to authenticated;
-- A new provider order/capture must be activatable before any external money call.
create function private.assert_subscription_checkout_activatable_v1(p_organization_id uuid)returns void language plpgsql volatile security definer set search_path=pg_catalog,private as $$declare state text;begin
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));select status into state from public.subscriptions where organization_id=p_organization_id;
 if state is null or state not in('TRIAL_ACTIVE','TRIAL_EXPIRED','PAST_DUE','SUSPENDED')then raise exception'SUBSCRIPTION_NOT_ACTIVATABLE'using errcode='55000';end if;
 if not private.subscription_financially_clear(p_organization_id)then raise exception'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 if not private.client_identity_allows_new_operations(p_organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
end$$;
alter function private.prepare_subscription_payment_context_core_v1(uuid,uuid,text,text,text,text,boolean)rename to prepare_subscription_payment_before_funding_v1;
create function private.prepare_subscription_payment_context_core_v1(p_organization_id uuid,p_plan_version_id uuid,p_billing_interval text,p_gateway text,p_idempotency_key text,p_provider_environment text,p_legacy boolean default false)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_INTENT_CREATE_DENIED'using errcode='42501';end if;
 perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,p_legacy);
 -- Existing authenticated preparations retain their idempotent response; new work needs an activatable subscription.
 if not exists(select 1 from public.subscription_payment_preparations where organization_id=p_organization_id and idempotency_key=p_idempotency_key)then perform private.assert_subscription_checkout_activatable_v1(p_organization_id);end if;
 return private.prepare_subscription_payment_before_funding_v1(p_organization_id,p_plan_version_id,p_billing_interval,p_gateway,p_idempotency_key,p_provider_environment,p_legacy);
end$$;
create or replace function public.prepare_subscription_payment_capture_v2(p_payment_intent_id uuid,p_provider_environment text)returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,private as $$declare intent public.subscription_payment_intents%rowtype;pay public.subscription_payment_events%rowtype;begin
 select*into intent from public.subscription_payment_intents where id=p_payment_intent_id;
 if auth.uid()is null or intent.id is null or not private.has_org_role(intent.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_CAPTURE_DENIED'using errcode='42501';end if;
 perform private.require_payment_intent_runtime_v1(intent.id,p_provider_environment);if intent.gateway<>'PAYPAL'then raise exception'PAYPAL_INTENT_REQUIRED'using errcode='22023';end if;
 select*into pay from public.subscription_payment_events where payment_intent_id=intent.id and event_type='PAYMENT_SUCCEEDED';
 if pay.id is not null then return jsonb_build_object('payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'replayed',true,'activation_result',pay.activation_result);end if;
 perform private.assert_subscription_checkout_activatable_v1(intent.organization_id);
 if not private.has_org_role(intent.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'PAYMENT_CAPTURE_DENIED'using errcode='42501';end if;
 return jsonb_build_object('payment_intent_id',intent.id,'provider_intent_id',intent.provider_intent_id,'replayed',false);
end$$;
revoke all on function private.assert_subscription_checkout_activatable_v1(uuid),private.prepare_subscription_payment_before_funding_v1(uuid,uuid,text,text,text,text,boolean),private.prepare_subscription_payment_context_core_v1(uuid,uuid,text,text,text,text,boolean)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
