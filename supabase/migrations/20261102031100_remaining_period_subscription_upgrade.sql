begin;
-- Capability-gated differential funding. No commercial policy is published here.
alter table private.subscription_upgrade_policies_v1 drop constraint subscription_upgrade_policies_v1_mode_check;
alter table private.subscription_upgrade_policies_v1 add column rounding_mode text,add column credit_policy text,
 add constraint subscription_upgrade_mode_v2 check((mode='FULL_NEW_CYCLE'and rounding_mode is null and credit_policy is null)or(mode='PROPORTIONAL_REMAINING'and rounding_mode in('FLOOR','CEIL','HALF_UP')and credit_policy='NEXT_FULL_CYCLE_ONLY'));
create function private.subscription_proration_amount_v1(p_source bigint,p_target bigint,p_start timestamptz,p_end timestamptz,p_at timestamptz,p_rounding text)returns bigint language plpgsql immutable set search_path=pg_catalog as $$
declare n numeric;d numeric;a numeric;begin
 if p_source is null or p_target is null or p_target<=p_source or p_source<0 or p_start is null or p_end is null or p_at is null or p_start>=p_end or p_at<p_start or p_at>=p_end or p_rounding is null or p_rounding not in('FLOOR','CEIL','HALF_UP')then raise exception'INVALID_PRORATION_BASIS'using errcode='22023';end if;
 n:=(p_target::numeric-p_source::numeric)*extract(epoch from(p_end-p_at));d:=extract(epoch from(p_end-p_start));
 a:=case p_rounding when'FLOOR'then floor(n/d)when'CEIL'then ceil(n/d)else floor(n/d+0.5)end;
 if a<=0 or a>9223372036854775807 then raise exception'PRORATION_AMOUNT_NOT_PAYABLE'using errcode='22003';end if;return a::bigint;
end$$;
-- Walk immutable upgrade lineage; only an original fully funded cycle is a Box basis.
create function private.subscription_box_funding_cycle_v1(p_cycle uuid)returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
declare c uuid:=p_cycle;q private.subscription_upgrade_quotes_v1%rowtype;n integer:=0;begin
 loop
  n:=n+1;if n>64 then return null;end if;
  select quote.*into q from private.subscription_upgrade_applications_v1 a join private.subscription_upgrade_quotes_v1 quote on quote.id=a.quote_id where a.target_cycle_id=c and quote.source_snapshot->>'mode'='PROPORTIONAL_REMAINING';
  if q.id is null then return c;end if;c:=q.source_cycle_id;
 end loop;
end$$;
create function private.subscription_proration_basis_v1(p_cycle uuid)returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('basis_cycle_id',c.id,'basis_period_start',c.period_start,'basis_period_end',c.period_end)
 from public.subscription_cycles c where c.id=private.subscription_box_funding_cycle_v1(p_cycle)and private.subscription_cycle_funding_compatible_v1(c.id)
$$;
-- Reuse the independent versioned publication contract, adding explicit rounding and credit terms.
do $$declare d text;begin
 d:=pg_get_functiondef('public.propose_subscription_upgrade_policy_v1(uuid,uuid,text,text,text,timestamptz,timestamptz,integer,text)'::regprocedure);
 d:=replace(d,'propose_subscription_upgrade_policy_v1(','propose_subscription_proration_policy_v1(');
 d:=replace(d,'p_reference text)','p_reference text, p_rounding_mode text)');
 d:=replace(d,'if p_billing_interval is null','if p_rounding_mode is null or p_rounding_mode not in(''FLOOR'',''CEIL'',''HALF_UP'')then raise exception''INVALID_PRORATION_ROUNDING''using errcode=''22023'';end if; if p_billing_interval is null');
 d:=replace(d,'''FULL_NEW_CYCLE''','''PROPORTIONAL_REMAINING''');
 d:=replace(d,'''mode'',''PROPORTIONAL_REMAINING''','''mode'',''PROPORTIONAL_REMAINING'',''rounding_mode'',p_rounding_mode,''credit_policy'',''NEXT_FULL_CYCLE_ONLY''');
 d:=replace(d,'reference,created_by)','reference,created_by,rounding_mode,credit_policy)');
 d:=replace(d,'h,btrim(p_reference),auth.uid())','h,btrim(p_reference),auth.uid(),p_rounding_mode,''NEXT_FULL_CYCLE_ONLY'')');
 execute d;
end$$;
-- Freeze the exact original calendar basis and valuation time in the signed quote.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.create_client_subscription_upgrade_quote_v1(uuid,uuid,text)'::regprocedure);
 d:=replace(d,'snapshot jsonb;h text;x uuid;','snapshot jsonb;h text;x uuid;basis jsonb;valuation timestamptz;amount bigint;');
 needle:='snapshot:=jsonb_build_object(''policy_id'',p.id';
 if position(needle in d)=0 then raise exception'PRORATION_QUOTE_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'valuation:=clock_timestamp();amount:=case p.billing_interval when''MONTHLY''then t.monthly_price_minor else t.annual_price_minor end; if p.mode=''PROPORTIONAL_REMAINING''then if s.billing_interval is distinct from p.billing_interval then raise exception''PRORATION_INTERVAL_MISMATCH''using errcode=''23514'';end if;basis:=private.subscription_proration_basis_v1((funding->>''cycle_id'')::uuid);if basis is null then raise exception''PRORATION_BASIS_REQUIRED''using errcode=''55000'';end if;amount:=private.subscription_proration_amount_v1((private.subscription_upgrade_policy_source_v1(p.source_plan_version_id,p.target_plan_version_id,p.billing_interval)->>''source_price_minor'')::bigint,amount,(basis->>''basis_period_start'')::timestamptz,(basis->>''basis_period_end'')::timestamptz,valuation,p.rounding_mode);end if; snapshot:=jsonb_build_object(''policy_id'',p.id');
 d:=replace(d,'''amount_minor'',(case p.billing_interval when''MONTHLY''then t.monthly_price_minor else t.annual_price_minor end)::text','''amount_minor'',amount::text');
 d:=replace(d,'h:=private.canonical_request_hash(snapshot);','if p.mode=''PROPORTIONAL_REMAINING''then snapshot:=snapshot||basis||jsonb_build_object(''valuation_at'',valuation,''rounding_mode'',p.rounding_mode,''credit_policy'',p.credit_policy,''source_price_minor'',private.subscription_upgrade_policy_source_v1(p.source_plan_version_id,p.target_plan_version_id,p.billing_interval)->>''source_price_minor'',''target_price_minor'',case p.billing_interval when''MONTHLY''then t.monthly_price_minor::text else t.annual_price_minor::text end,''box_treatment'',''PRESERVE_ORIGINAL_FUNDED_BOX'');end if; h:=private.canonical_request_hash(snapshot);');
 execute d;
end$$;
create function private.subscription_upgrade_quote_amount_valid_v1(p_quote uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare q private.subscription_upgrade_quotes_v1%rowtype;p private.subscription_upgrade_policies_v1%rowtype;t public.subscription_plan_versions%rowtype;s public.subscription_plan_versions%rowtype;begin
 select*into q from private.subscription_upgrade_quotes_v1 where id=p_quote;select*into p from private.subscription_upgrade_policies_v1 where id=q.policy_id;select*into t from public.subscription_plan_versions where id=q.target_plan_version_id;select*into s from public.subscription_plan_versions where id=q.source_plan_version_id;
 if q.id is null or q.content_hash is distinct from private.canonical_request_hash(q.source_snapshot)or q.source_snapshot->>'policy_hash'is distinct from p.content_hash or q.source_snapshot->>'mode'is distinct from p.mode then return false;end if;
 if p.mode='FULL_NEW_CYCLE'then return q.amount_minor=case q.billing_interval when'MONTHLY'then t.monthly_price_minor else t.annual_price_minor end;end if;
 return coalesce(p.mode='PROPORTIONAL_REMAINING'and p.credit_policy='NEXT_FULL_CYCLE_ONLY'and p.rounding_mode=q.source_snapshot->>'rounding_mode'and p.credit_policy=q.source_snapshot->>'credit_policy'
 and q.source_snapshot->>'source_price_minor'=(case q.billing_interval when'MONTHLY'then s.monthly_price_minor else s.annual_price_minor end)::text
 and q.source_snapshot->>'target_price_minor'=(case q.billing_interval when'MONTHLY'then t.monthly_price_minor else t.annual_price_minor end)::text
 and(q.source_snapshot->>'basis_period_end')::timestamptz=q.source_period_end
 and q.amount_minor=private.subscription_proration_amount_v1((q.source_snapshot->>'source_price_minor')::bigint,(q.source_snapshot->>'target_price_minor')::bigint,(q.source_snapshot->>'basis_period_start')::timestamptz,q.source_period_end,(q.source_snapshot->>'valuation_at')::timestamptz,p.rounding_mode),false);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then return false;
end$$;
do $$declare d text;needle text:='q.amount_minor=case q.billing_interval when''MONTHLY''then t.monthly_price_minor else t.annual_price_minor end';begin
 d:=pg_get_functiondef('private.subscription_upgrade_quote_current_v1(uuid,timestamptz,boolean)'::regprocedure);if position(needle in d)=0 then raise exception'PRORATION_QUOTE_GUARD_SOURCE_MISMATCH';end if;
 execute replace(d,needle,'private.subscription_upgrade_quote_amount_valid_v1(q.id)');
end$$;
-- Immutable acceptance is the only differential amount authority; ordinary plan pricing stays closed.
create function private.subscription_proration_quote_for_preparation_v1(p_preparation uuid)returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select q.id from public.subscription_payment_preparations prep join private.subscription_upgrade_checkouts_v1 c on c.preparation_id=prep.id and c.organization_id=prep.organization_id join private.subscription_upgrade_quotes_v1 q on q.id=c.quote_id
 join private.subscription_upgrade_policies_v1 policy on policy.id=q.policy_id join private.subscription_upgrade_policy_decisions_v1 d on d.policy_id=policy.id and d.approved and d.content_hash=policy.content_hash and d.decided_by<>policy.created_by
 where prep.id=p_preparation and q.source_snapshot->>'mode'='PROPORTIONAL_REMAINING'and q.created_by=c.accepted_by and prep.actor_id=c.accepted_by and c.accepted_hash=q.content_hash
 and q.organization_id=prep.organization_id and q.target_plan_version_id=prep.plan_version_id and q.billing_interval=prep.billing_interval and q.currency=prep.currency and q.amount_minor=prep.amount_minor and private.subscription_upgrade_quote_amount_valid_v1(q.id)
$$;
create function private.subscription_proration_quote_for_intent_v1(p_intent uuid)returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select private.subscription_proration_quote_for_preparation_v1(p.id)from public.subscription_payment_intents i join public.subscription_payment_preparations p on p.organization_id=i.organization_id and p.idempotency_key=i.idempotency_key and p.actor_id=i.created_by and p.plan_version_id=i.plan_version_id and p.billing_interval=i.billing_interval and p.amount_minor=i.amount_minor and p.currency=i.currency and p.gateway=i.gateway and p.provider_environment=i.provider_environment and p.deployment_environment=i.deployment_environment where i.id=p_intent
$$;
create function private.subscription_upgrade_prepared_amount_v1(p_org uuid,p_plan uuid,p_interval text,p_key text,p_full bigint)returns bigint language plpgsql stable security definer set search_path=pg_catalog as $$
declare q private.subscription_upgrade_quotes_v1%rowtype;x uuid;begin
 select c.quote_id into x from private.subscription_upgrade_admission_context_v1 c where backend_pid=pg_backend_pid()and transaction_id=txid_current()and organization_id=p_org and private.subscription_upgrade_admission_context_valid_v1(p_org,p_plan);
 if x is null then select private.subscription_proration_quote_for_preparation_v1(id)into x from public.subscription_payment_preparations where organization_id=p_org and idempotency_key=p_key and plan_version_id=p_plan and billing_interval=p_interval;end if;
 select*into q from private.subscription_upgrade_quotes_v1 where id=x and organization_id=p_org and target_plan_version_id=p_plan and billing_interval=p_interval and source_snapshot->>'mode'='PROPORTIONAL_REMAINING';
 return coalesce(q.amount_minor,p_full);
end$$;
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.prepare_subscription_payment_before_funding_v1(uuid,uuid,text,text,text,text,boolean)'::regprocedure);needle:='amount:=case p_billing_interval when''MONTHLY''then p.monthly_price_minor else p.annual_price_minor end;';
 if position(needle in d)=0 then raise exception'PRORATION_PREPARE_SOURCE_MISMATCH';end if;execute replace(d,needle,'amount:=private.subscription_upgrade_prepared_amount_v1(p_organization_id,p_plan_version_id,p_billing_interval,p_idempotency_key,case p_billing_interval when''MONTHLY''then p.monthly_price_minor else p.annual_price_minor end);');
 d:=pg_get_functiondef('private.register_subscription_payment_context_core_v1(uuid,text,uuid,uuid,text,text,text,bigint,character,text,uuid)'::regprocedure);needle:='expected_amount := case when p_billing_interval = ''MONTHLY'' then plan.monthly_price_minor else plan.annual_price_minor end;';
 if position(needle in d)=0 then raise exception'PRORATION_REGISTRATION_SOURCE_MISMATCH';end if;execute replace(d,needle,'expected_amount := private.subscription_upgrade_prepared_amount_v1(p_organization_id,p_plan_version_id,p_billing_interval,p_idempotency_key,case when p_billing_interval=''MONTHLY''then plan.monthly_price_minor else plan.annual_price_minor end);');
end$$;
-- Extend the existing validator for a composite source+adjustment proof, keeping every
-- exact intent, journal, event, cycle, currency and environment binding from the base.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.subscription_payment_cycle_v1(bigint)'::regprocedure);
 d:=replace(d,'subscription_payment_cycle_v1(','subscription_proration_payment_cycle_v1(');
 needle:='cycle.period_end=pay.paid_at+case intent.billing_interval when''MONTHLY''then interval''1 month''when''ANNUAL''then interval''1 year''else null end and cycle.amount_minor=case intent.billing_interval when''MONTHLY''then plan.monthly_price_minor when''ANNUAL''then plan.annual_price_minor else null end';
 if position(needle in d)=0 then raise exception'PRORATION_FUNDING_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'cycle.period_end=(select q.source_period_end from private.subscription_upgrade_quotes_v1 q where q.id=private.subscription_proration_quote_for_intent_v1(intent.id)) and exists(select 1 from private.subscription_upgrade_quotes_v1 q join public.subscription_cycles source on source.id=q.source_cycle_id and source.organization_id=q.organization_id and source.subscription_id=cycle.subscription_id where q.id=private.subscription_proration_quote_for_intent_v1(intent.id)and q.organization_id=pay.organization_id and q.target_plan_version_id=cycle.plan_version_id and q.amount_minor=pay.amount_minor and date_trunc(''second'',q.created_at)<=pay.paid_at and pay.paid_at<q.expires_at and pay.paid_at>source.period_start and private.subscription_cycle_funding_compatible_v1(source.id)and q.source_snapshot->>''basis_cycle_id''=private.subscription_box_funding_cycle_v1(source.id)::text)');
 execute d;
end$$;
alter function private.subscription_payment_cycle_v1(bigint)rename to subscription_full_payment_cycle_v1;
create function private.subscription_payment_cycle_v1(p_payment_event_id bigint)returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
declare x uuid;begin x:=private.subscription_full_payment_cycle_v1(p_payment_event_id);if x is not null then return x;end if;return private.subscription_proration_payment_cycle_v1(p_payment_event_id);end$$;
-- Mature runtime, replay, suspense posting, cycle append and outbox remain unchanged.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.process_subscription_payment_context_core_v1(text,text,text,text,text,bigint,character,timestamptz,text,text,text,uuid)'::regprocedure);
 needle:='expected_amount := case when intent.billing_interval=''MONTHLY'' then plan.monthly_price_minor else plan.annual_price_minor end;';
 if position(needle in d)=0 then raise exception'PRORATION_PROCESS_AMOUNT_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'expected_amount := case when private.subscription_proration_quote_for_intent_v1(intent.id)is not null then(select q.amount_minor from private.subscription_upgrade_quotes_v1 q where q.id=private.subscription_proration_quote_for_intent_v1(intent.id))else case when intent.billing_interval=''MONTHLY''then plan.monthly_price_minor else plan.annual_price_minor end end;');
 needle:='period_end := case when intent.billing_interval=''MONTHLY'' then p_paid_at + interval ''1 month'' else p_paid_at + interval ''1 year'' end;';
 if position(needle in d)=0 then raise exception'PRORATION_PROCESS_PERIOD_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'period_end := case when private.subscription_proration_quote_for_intent_v1(intent.id)is not null then(select q.source_period_end from private.subscription_upgrade_quotes_v1 q where q.id=private.subscription_proration_quote_for_intent_v1(intent.id))else case when intent.billing_interval=''MONTHLY''then p_paid_at+interval''1 month''else p_paid_at+interval''1 year''end end; if private.subscription_proration_quote_for_intent_v1(intent.id)is not null and(not private.subscription_upgrade_capture_admissible_v1(intent.id,p_paid_at)or p_paid_at<=subscription.current_period_start)then raise exception''STALE_UPGRADE_QUOTE''using errcode=''40001'';end if;');execute d;
 -- Preserve the actual mode in immutable application and outbox evidence.
 d:=pg_get_functiondef('private.record_subscription_upgrade_application_v1()'::regprocedure);d:=replace(d,'''change_mode'',''UPGRADE_FULL_NEW_CYCLE''','''change_mode'',''UPGRADE_''||(q.source_snapshot->>''mode'')');execute d;
end$$;
-- Independent/manual issuance must obey the same no-extra-grant policy.
alter function private.subscription_credit_grant_terms_v1(uuid,bigint,integer)rename to subscription_credit_grant_terms_before_proration_v1;
create function private.subscription_credit_grant_terms_v1(p_organization_id uuid,p_payment_event_id bigint,p_month_index integer)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from public.subscription_payment_events e where e.id=p_payment_event_id and e.organization_id=p_organization_id and private.subscription_proration_quote_for_intent_v1(e.payment_intent_id)is not null)then raise exception'PRORATION_NEXT_FULL_CYCLE_GRANT_ONLY'using errcode='55000';end if;
 return private.subscription_credit_grant_terms_before_proration_v1(p_organization_id,p_payment_event_id,p_month_index);
end$$;
revoke all on function private.subscription_credit_grant_terms_before_proration_v1(uuid,bigint,integer),private.subscription_credit_grant_terms_v1(uuid,bigint,integer)from public,anon,authenticated,service_role;
-- Once the exact quote has been accepted, withdrawal stops new quotations but
-- does not rewrite the conditions of that already-created provider command.
do $$declare d text;needle text:='private.subscription_upgrade_quote_current_v1(q.id,statement_timestamp())';begin
 d:=pg_get_functiondef('private.subscription_upgrade_admission_context_valid_v1(uuid,uuid)'::regprocedure);if position(needle in d)=0 then raise exception'PRORATION_ACCEPTED_ADMISSION_SOURCE_MISMATCH';end if;
 execute replace(d,needle,'private.subscription_upgrade_quote_current_v1(q.id,statement_timestamp(),not exists(select 1 from private.subscription_upgrade_checkouts_v1 accepted where accepted.quote_id=q.id))');
end$$;
-- A remaining-period fee never purchases a second full monthly/annual grant.
-- The approved credit policy preserves all old paid jobs and starts target grants
-- only on the next whole paid renewal.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.schedule_subscription_payment_credits_v1(bigint)'::regprocedure);needle:='slots:=case when plan.monthly_credit_grant=0 then 0 when intent.billing_interval=''ANNUAL''then 12 else 1 end;';
 if position(needle in d)=0 then raise exception'PRORATION_CREDIT_SCHEDULE_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'slots:=case when private.subscription_proration_quote_for_intent_v1(intent.id)is not null then 0 when plan.monthly_credit_grant=0 then 0 when intent.billing_interval=''ANNUAL''then 12 else 1 end;');
 d:=replace(d,'insert into private.subscription_credit_schedules_v1(', 'if private.subscription_proration_quote_for_intent_v1(intent.id)is not null then snapshot:=snapshot||jsonb_build_object(''credit_policy'',''NEXT_FULL_CYCLE_ONLY'',''quote_id'',private.subscription_proration_quote_for_intent_v1(intent.id));end if; insert into private.subscription_credit_schedules_v1(');execute d;
end$$;
-- List amount is indicative only; the accepted quote fixes the timestamp and delta.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.list_client_subscription_upgrade_options_v1(uuid)'::regprocedure);
 needle:='''amount_minor'',(case p.billing_interval when''MONTHLY''then t.monthly_price_minor else t.annual_price_minor end)::text';
 if position(needle in d)=0 then raise exception'PRORATION_OPTIONS_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'''amount_minor'',(case when p.mode=''PROPORTIONAL_REMAINING''then private.subscription_proration_amount_v1((private.subscription_upgrade_policy_source_v1(p.source_plan_version_id,p.target_plan_version_id,p.billing_interval)->>''source_price_minor'')::bigint,case p.billing_interval when''MONTHLY''then t.monthly_price_minor else t.annual_price_minor end,(private.subscription_proration_basis_v1((funding->>''cycle_id'')::uuid)->>''basis_period_start'')::timestamptz,(funding->>''period_end'')::timestamptz,statement_timestamp(),p.rounding_mode)else case p.billing_interval when''MONTHLY''then t.monthly_price_minor else t.annual_price_minor end end)::text');
 d:=replace(d,'and private.subscription_upgrade_policy_ready_v1(p.id)','and(p.mode<>''PROPORTIONAL_REMAINING''or p.billing_interval=(select billing_interval from public.subscriptions where organization_id=p_organization_id))and private.subscription_upgrade_policy_ready_v1(p.id)');execute d;
end$$;
do $$declare f regprocedure;begin
 foreach f in array array['private.subscription_proration_amount_v1(bigint,bigint,timestamptz,timestamptz,timestamptz,text)'::regprocedure,'private.subscription_box_funding_cycle_v1(uuid)'::regprocedure,'private.subscription_proration_basis_v1(uuid)'::regprocedure,'private.subscription_upgrade_quote_amount_valid_v1(uuid)'::regprocedure,'private.subscription_proration_quote_for_preparation_v1(uuid)'::regprocedure,'private.subscription_proration_quote_for_intent_v1(uuid)'::regprocedure,'private.subscription_upgrade_prepared_amount_v1(uuid,uuid,text,text,bigint)'::regprocedure,'private.subscription_full_payment_cycle_v1(bigint)'::regprocedure,'private.subscription_proration_payment_cycle_v1(bigint)'::regprocedure,'private.subscription_payment_cycle_v1(bigint)'::regprocedure]loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
end$$;
revoke all on function public.propose_subscription_proration_policy_v1(uuid,uuid,text,text,text,timestamptz,timestamptz,integer,text,text)from public,anon,authenticated,service_role;
grant execute on function public.propose_subscription_proration_policy_v1(uuid,uuid,text,text,text,timestamptz,timestamptz,integer,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
