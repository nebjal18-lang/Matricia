begin;
create function private.lock_credit_revenue_finance_actor_v1()returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();begin
 perform pg_advisory_xact_lock(hashtextextended('platform.account.access',0));
 perform id from auth.users where id=actor for share;
 perform user_id from public.platform_user_roles where user_id=actor and role_code in('SUPER_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR')order by role_code for share;
 if not private.credit_revenue_finance_access_v1(actor,true)then raise exception'CREDIT_ECONOMIC_RECONCILIATION_DENIED'using errcode='42501';end if;
 return actor;
end$$;
revoke all on function private.lock_credit_revenue_finance_actor_v1()from public,anon,authenticated,service_role;
create or replace function public.reconcile_credit_economic_funding_v1(p_funding_source_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin
 if not private.credit_revenue_finance_access_v1(auth.uid(),true)then raise exception'CREDIT_ECONOMIC_RECONCILIATION_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-funding:'||p_funding_source_id::text,0));
 perform private.lock_credit_revenue_finance_actor_v1();
 return private.classify_credit_economic_funding_v1(p_funding_source_id,p_correlation_id);
end$$;

-- An old classification never authorizes refunded or disputed funds.
do $$declare definition text;replay text:='if c.id is not null then return jsonb_build_object(''status'',''READY'',''classification_id'',c.id,''content_hash'',c.content_hash,''replayed'',true);end if;';marker text:='fiscal:=private.approved_credit_revenue_policy_v1';begin
 select pg_get_functiondef('private.classify_credit_economic_funding_v1(uuid,uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,replay,'')))/length(replay)<>1 or(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception'CLASSIFICATION_ELIGIBILITY_REPLAY_SOURCE_MISMATCH';end if;
 definition:=replace(definition,replay,'');definition:=replace(definition,marker,replay||chr(10)||' '||marker);execute definition;
end$$;
create table private.credit_pack_capture_attempts_v1(
 payment_intent_id uuid primary key references public.credit_pack_payment_intents_v1(id),
 organization_id uuid not null references public.organizations(id),requested_by uuid not null references auth.users(id),
 requested_at timestamptz not null default clock_timestamp(),operation_key text not null unique
);
alter table private.credit_pack_capture_attempts_v1 enable row level security;
revoke all on private.credit_pack_capture_attempts_v1 from public,anon,authenticated,service_role;
create trigger credit_pack_capture_attempt_immutable before update or delete on private.credit_pack_capture_attempts_v1 for each row execute function private.prevent_update_delete();
create or replace function public.prepare_credit_pack_payment_capture_v1(p_payment_intent_id uuid,p_provider_environment text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i public.credit_pack_payment_intents_v1%rowtype;e public.credit_pack_payment_events_v1%rowtype;env text;authorized boolean:=false;attempt private.credit_pack_capture_attempts_v1%rowtype;begin
 select*into i from public.credit_pack_payment_intents_v1 where id=p_payment_intent_id;
 if auth.uid()is null or i.id is null or not private.has_org_role(i.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'CREDIT_PACK_CAPTURE_DENIED'using errcode='42501';end if;
 perform private.assert_payment_runtime_v1(i.gateway,p_provider_environment,false);
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if i.gateway<>'PAYPAL'or i.provider_environment is distinct from p_provider_environment then raise exception'PAYPAL_CREDIT_PACK_INTENT_REQUIRED'using errcode='22023';end if;
 if i.provider_environment<>'LIVE'and(i.deployment_environment is distinct from env or env not in('DEVELOPMENT','STAGING'))then raise exception'PAYMENT_POSTING_ENVIRONMENT_INCOMPATIBLE'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||i.organization_id::text,0));
 select*into e from public.credit_pack_payment_events_v1 where payment_intent_id=i.id;
 if e.id is null then
  if not private.client_identity_allows_new_operations(i.organization_id)or not private.subscription_financially_clear(i.organization_id)then raise exception'CREDIT_PACK_CAPTURE_ADMISSION_REQUIRED'using errcode='55000';end if;
  if exists(select 1 from public.credit_pack_native_resolutions_v1 where payment_intent_id=i.id and native_status in('VOIDED','COMPLETED'))then raise exception'CREDIT_PACK_NATIVE_REVIEW_REQUIRED'using errcode='55000';end if;
  insert into private.credit_pack_capture_attempts_v1(payment_intent_id,organization_id,requested_by,operation_key)
  values(i.id,i.organization_id,auth.uid(),'credit-pack-capture:'||i.id::text)on conflict do nothing returning*into attempt;
  authorized:=attempt.payment_intent_id is not null;
 end if;
 select*into attempt from private.credit_pack_capture_attempts_v1 where payment_intent_id=i.id;
 return jsonb_build_object('payment_intent_id',i.id,'provider_intent_id',i.provider_intent_id,'amount_minor',i.amount_minor::text,'currency',i.currency,'gateway',i.gateway,'provider_environment',i.provider_environment,'replayed',e.id is not null,'capture_result',e.result,'capture_authorized',authorized,'capture_operation_key',attempt.operation_key,'capture_state',case when e.id is not null then'CAPTURED'when authorized then'CAPTURE_REQUESTED'else'PENDING_NATIVE_REVIEW'end);
end$$;

create function public.process_verified_credit_pack_adjustment_v1(p_gateway text,p_provider_environment text,p_provider_event_id text,p_provider_payment_id text,p_provider_adjustment_id text,p_event_type text,p_amount_minor bigint,p_currency char(3),p_occurred_at timestamptz,p_payload_hash text,p_signature_fingerprint text,p_merchant_reference text default null,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare e public.credit_pack_payment_events_v1%rowtype;i public.credit_pack_payment_intents_v1%rowtype;p public.credit_pack_payment_preparations_v1%rowtype;
 prior public.credit_pack_payment_adjustments_v1%rowtype;a uuid:=extensions.gen_random_uuid();j uuid;ctx private.payment_posting_contexts_v1%rowtype;h text;snapshot jsonb;funding uuid;refunded bigint;result jsonb;
begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_PAYMENT_VERIFICATION_REQUIRED'using errcode='42501';end if;
 if p_gateway is null or p_gateway not in('PAYPAL','CMI','DEMO')or p_event_type is null or p_event_type not in('REFUND_SUCCEEDED','PAYMENT_REVERSED','DISPUTE_OPENED','DISPUTE_WON','DISPUTE_LOST')or length(coalesce(p_provider_event_id,''))not between 8 and 200 or length(coalesce(p_provider_adjustment_id,''))not between 8 and 200 or p_amount_minor is null or p_amount_minor<0 or p_currency is null or p_currency!~'^[A-Z]{3}$'or p_occurred_at is null or p_occurred_at>clock_timestamp()+interval'5 minutes'or coalesce(p_payload_hash,'')!~'^[a-f0-9]{64}$'or coalesce(p_signature_fingerprint,'')!~'^[a-f0-9]{64}$'then raise exception'INVALID_VERIFIED_CREDIT_PACK_ADJUSTMENT'using errcode='22023';end if;
 perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,false);
 select*into e from public.credit_pack_payment_events_v1 where gateway=p_gateway and provider_environment=p_provider_environment and payment_reference=p_provider_payment_id;
 if e.id is null then raise exception'CAPTURE_NOT_YET_RECORDED'using errcode='P0002';end if;
 select*into i from public.credit_pack_payment_intents_v1 where id=e.payment_intent_id;
 select*into p from public.credit_pack_payment_preparations_v1 where id=i.preparation_id;
 select*into ctx from private.payment_posting_contexts_v1 where id=p.posting_context_id;
 if private.credit_pack_payment_source_v1(e.id)is null or not private.credit_pack_payment_funding_environment_compatible_v1(e.id)or ctx.id is null or p_currency<>e.currency or(p_merchant_reference is not null and p_merchant_reference<>i.id::text)then raise exception'CREDIT_PACK_ADJUSTMENT_CONTEXT_MISMATCH'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||e.organization_id::text,0));
 snapshot:=jsonb_build_object('payment_event_id',e.id,'payment_source_hash',e.source_hash,'gateway',p_gateway,'provider_environment',p_provider_environment,'provider_payment_id',p_provider_payment_id,'provider_adjustment_id',p_provider_adjustment_id,'event_type',p_event_type,'amount_minor',p_amount_minor::text,'currency',p_currency,'occurred_at',p_occurred_at,'payload_hash',p_payload_hash,'merchant_reference',p_merchant_reference);
 h:=private.canonical_request_hash(snapshot);
 select*into prior from public.credit_pack_payment_adjustments_v1 where gateway=p_gateway and provider_environment=p_provider_environment and(provider_event_id=p_provider_event_id or(provider_adjustment_id=p_provider_adjustment_id and event_type=p_event_type))order by created_at,id limit 1;
 if prior.id is not null then
  if prior.source_hash<>h then raise exception'CREDIT_PACK_ADJUSTMENT_REPLAY_MISMATCH'using errcode='22000';end if;
  return jsonb_build_object('received',true,'replayed',true,'adjustment_id',prior.id,'economic_status','SOURCE_REVIEW_REQUIRED');
 end if;
 if p_event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED')then
  select coalesce(sum(amount_minor),0)into refunded from public.credit_pack_payment_adjustments_v1 where payment_event_id=e.id and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED');
  if p_amount_minor<=0 or refunded::numeric+p_amount_minor>e.amount_minor then raise exception'CREDIT_PACK_REFUND_EXCEEDS_CAPTURE'using errcode='23514';end if;
  j:=extensions.gen_random_uuid();
  insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)
  values(j,e.organization_id,'CREDIT_PACK_REFUND',e.currency,'credit.pack.native.adjustment',a::text,p_correlation_id,p_occurred_at,'Verified native refund retained pending fiscal reversal',p.actor_id);
  insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values
  (e.organization_id,j,ctx.suspense_account_id,'DEBIT',p_amount_minor,e.currency),(e.organization_id,j,ctx.cash_account_id,'CREDIT',p_amount_minor,e.currency);
 end if;
 insert into public.credit_pack_payment_adjustments_v1(id,payment_event_id,organization_id,event_type,gateway,provider_environment,provider_event_id,provider_adjustment_id,amount_minor,currency,occurred_at,payload_hash,signature_fingerprint,source_hash,financial_journal_id,correlation_id)
 values(a,e.id,e.organization_id,p_event_type,p_gateway,p_provider_environment,p_provider_event_id,p_provider_adjustment_id,p_amount_minor,p_currency,p_occurred_at,p_payload_hash,p_signature_fingerprint,h,j,p_correlation_id);
 select id into funding from public.credit_economic_funding_sources_v1 where source_kind='CREDIT_PACK'and source_id=e.gateway||':'||e.provider_environment||':'||e.payment_reference;
 perform private.credit_economic_pending_v1(funding,null,'SOURCE_REVIEW_REQUIRED',case when j is null then'NATIVE_DISPUTE_REQUIRES_REVIEW'else'NATIVE_REFUND_REQUIRES_FISCAL_REVERSAL'end,snapshot||jsonb_build_object('adjustment_id',a,'journal_id',j,'previous_profit_not_rewritten',true),p_correlation_id);
 result:=jsonb_build_object('received',true,'replayed',false,'adjustment_id',a,'financial_journal_id',j,'economic_status','SOURCE_REVIEW_REQUIRED');
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.organization_id,'SERVICE','credit.pack_adjustment_recorded','credit_pack_payment_adjustment',a::text,p_correlation_id,result||jsonb_build_object('source_hash',h),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(e.organization_id,'credit_pack_payment_adjustment',a::text,'CreditPackAdjustmentRecordedV1',p_correlation_id,result,'pack-adjustment:'||a::text);
 return result;
end$$;
revoke all on function public.process_verified_credit_pack_adjustment_v1(text,text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.process_verified_credit_pack_adjustment_v1(text,text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid)to service_role;
-- The verified inbox can know a refund/dispute before its domain adjustment is
-- imported. Do not briefly make those paid funds spendable in that interval.
do $$declare definition text;marker text:='return''ELIGIBLE'';';replacement text;old_hold text:='exists(select 1 from public.credit_pack_payment_adjustments_v1 where payment_event_id=e.id and event_type in(''REFUND_SUCCEEDED'',''PAYMENT_REVERSED'',''DISPUTE_OPENED''))';begin
 select pg_get_functiondef('private.credit_lot_extra_funding_status_v1(uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception'CREDIT_PACK_ADVERSE_FUNDING_SOURCE_MISMATCH';end if;
 replacement:='if to_regprocedure(''private.payment_capture_has_adverse_fact_v1(text,text,text)'')is null then return''PAYMENT_HELD'';end if;'||chr(10)||
 ' if private.payment_capture_has_adverse_fact_v1(e.gateway,e.provider_environment,e.payment_reference)then return''PAYMENT_HELD'';end if;'||chr(10)||' '||marker;
 if(length(definition)-length(replace(definition,old_hold,'')))/length(old_hold)<>1 then raise exception'CREDIT_PACK_ADJUSTMENT_HOLD_SOURCE_MISMATCH';end if;
 definition:=replace(definition,old_hold,'exists(select 1 from public.credit_pack_payment_adjustments_v1 where payment_event_id=e.id and event_type in(''REFUND_SUCCEEDED'',''PAYMENT_REVERSED''))or exists(select 1 from(select distinct on(provider_adjustment_id)event_type from public.credit_pack_payment_adjustments_v1 where payment_event_id=e.id and event_type like''DISPUTE_%'' order by provider_adjustment_id,occurred_at desc,case event_type when''DISPUTE_LOST''then 4 when''DISPUTE_WON''then 3 else 2 end desc,provider_event_id desc)latest where event_type in(''DISPUTE_OPENED'',''DISPUTE_LOST''))');
 execute replace(definition,marker,replacement);
end$$;
notify pgrst,'reload schema';
commit;
