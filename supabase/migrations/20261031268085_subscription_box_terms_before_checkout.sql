begin;
-- Existing paid history is preserved; missing historical evidence is never
-- invented. Integrations268003 provides the explicit first-POST authorization.
create table private.subscription_prepared_box_terms_v1(
 preparation_id uuid primary key references public.subscription_payment_preparations(id),organization_id uuid not null references public.organizations(id),
 subscription_id uuid not null references public.subscriptions(id),plan_version_id uuid not null references public.subscription_plan_versions(id),
 source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp()
);
revoke all on private.subscription_prepared_box_terms_v1 from public,anon,authenticated,service_role;
create trigger prepared_box_terms_immutable before update or delete on private.subscription_prepared_box_terms_v1 for each row execute function private.prevent_update_delete();

create function private.freeze_subscription_box_checkout_terms_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog,private as $$
declare p public.subscription_payment_preparations%rowtype;plan public.subscription_plan_versions%rowtype;options jsonb;rollovers integer[];snapshot jsonb;begin
 if new.state<>'CREATE_REQUESTED'or new.provider_create_authorized_at is null then return new;end if;
 select*into p from public.subscription_payment_preparations where id=new.preparation_id;
 select*into plan from public.subscription_plan_versions where id=p.plan_version_id for share;
 if p.id is null or p.organization_id is distinct from new.organization_id
 or p.currency is distinct from plan.currency or plan.status<>'ACTIVE'or plan.valid_from>(p.created_at at time zone'Africa/Casablanca')::date or(plan.valid_to is not null and plan.valid_to<(p.created_at at time zone'Africa/Casablanca')::date)then raise exception'BOX_CHECKOUT_ORIGINAL_TERMS_REVIEW_REQUIRED'using errcode='55000';end if;
 -- Serializing with lifecycle changes makes the selected source exact at the
 -- point where the durable command authorizes the first external PSP call.
 perform b.id from public.box_versions b where b.id in(select(a.source_snapshot->>'box_version_id')::uuid from public.box_configuration_approvals_v1 a where a.source_snapshot->>'plan_version_id'=p.plan_version_id::text)order by b.id for share;
 select coalesce(jsonb_agg(jsonb_build_object('approval_id',a.id,'source_hash',a.source_hash,'source_snapshot',a.source_snapshot)order by a.id),'[]'),array_agg(distinct(a.source_snapshot->>'rollover_months')::integer)
 into options,rollovers from public.box_configuration_approvals_v1 a join public.box_versions b on b.id=(a.source_snapshot->>'box_version_id')::uuid
 where a.source_snapshot->>'plan_version_id'=p.plan_version_id::text and a.approved_at<=p.created_at and b.status='ACTIVE'
 and a.source_hash=private.canonical_request_hash(private.box_configuration_source_v1(a.plan_box_rule_id))
 and(a.source_snapshot->>'rule_effective_from')::timestamptz<=p.created_at and(a.source_snapshot->>'rule_effective_to'is null or(a.source_snapshot->>'rule_effective_to')::timestamptz>p.created_at)
 and(a.source_snapshot->>'box_effective_from')::timestamptz<=p.created_at and(a.source_snapshot->>'box_effective_to'is null or(a.source_snapshot->>'box_effective_to')::timestamptz>p.created_at)
 and not exists(select 1 from public.box_slots slot join public.benefit_versions v on v.id=any(slot.allowed_benefit_version_ids)where slot.box_version_id=b.id and(v.status<>'ACTIVE'or v.effective_from>p.created_at or(v.effective_to is not null and v.effective_to<=p.created_at)));
 if jsonb_array_length(options)=0 then raise exception'BOX_CHECKOUT_POLICY_REQUIRED'using errcode='55000';end if;
 if cardinality(rollovers)is distinct from 1 then raise exception'BOX_CHECKOUT_ROLLOVER_AMBIGUOUS'using errcode='55000';end if;
 snapshot:=jsonb_build_object('schema_version',1,'preparation_id',p.id,'organization_id',p.organization_id,'subscription_id',new.subscription_id,'provider_create_authorized_at',new.provider_create_authorized_at,'plan_version_id',plan.id,'plan_content_hash',plan.content_hash,'plan_status_at_checkout',plan.status,'plan_valid_from',plan.valid_from,'plan_valid_to',plan.valid_to,'plan_monthly_price_minor',plan.monthly_price_minor::text,'plan_annual_price_minor',plan.annual_price_minor::text,'plan_monthly_credit_grant',plan.monthly_credit_grant::text,
 'billing_interval',p.billing_interval,'gateway',p.gateway,'provider_environment',p.provider_environment,'deployment_environment',p.deployment_environment,
 'currency',p.currency,'amount_minor',p.amount_minor::text,'rollover_months',rollovers[1],'options',options);
 insert into private.subscription_prepared_box_terms_v1(preparation_id,organization_id,subscription_id,plan_version_id,source_snapshot,source_hash)
 values(p.id,p.organization_id,new.subscription_id,p.plan_version_id,snapshot,private.canonical_request_hash(snapshot));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(p.organization_id,p.actor_id,'USER','subscription.box_terms_frozen','subscription_payment_preparation',p.id::text,extensions.gen_random_uuid(),jsonb_build_object('source_hash',private.canonical_request_hash(snapshot),'option_count',jsonb_array_length(options)),repeat('0',64));
 return new;
end$$;
create trigger subscription_checkout_box_terms_before_psp after insert on private.subscription_checkout_attempts_v1 for each row execute function private.freeze_subscription_box_checkout_terms_v1();

create function private.subscription_prepared_box_terms_for_preparation_v1(p_preparation_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare p public.subscription_payment_preparations%rowtype;t private.subscription_prepared_box_terms_v1%rowtype;plan public.subscription_plan_versions%rowtype;begin
 select*into p from public.subscription_payment_preparations where id=p_preparation_id;
 select*into t from private.subscription_prepared_box_terms_v1 where preparation_id=p.id;
 select*into plan from public.subscription_plan_versions where id=p.plan_version_id;
 if p.id is null or t.preparation_id is null or plan.id is null or t.organization_id is distinct from p.organization_id or t.plan_version_id is distinct from p.plan_version_id
 or t.source_hash is distinct from private.canonical_request_hash(t.source_snapshot)
 or t.source_snapshot->>'preparation_id'is distinct from p.id::text or t.source_snapshot->>'organization_id'is distinct from p.organization_id::text
 or t.source_snapshot->>'plan_version_id'is distinct from p.plan_version_id::text or t.source_snapshot->>'plan_content_hash'is distinct from plan.content_hash
 or t.source_snapshot->>'plan_status_at_checkout'is distinct from'ACTIVE'or t.source_snapshot->>'plan_valid_from'is null
 or(t.source_snapshot->>'plan_valid_from')::date>(p.created_at at time zone'Africa/Casablanca')::date
 or(t.source_snapshot->>'plan_valid_to'is not null and(t.source_snapshot->>'plan_valid_to')::date<(p.created_at at time zone'Africa/Casablanca')::date)
 or t.source_snapshot->>'plan_monthly_price_minor'is distinct from plan.monthly_price_minor::text or t.source_snapshot->>'plan_annual_price_minor'is distinct from plan.annual_price_minor::text
 or t.source_snapshot->>'plan_monthly_credit_grant'is distinct from plan.monthly_credit_grant::text
 or t.source_snapshot->>'billing_interval'is distinct from p.billing_interval or t.source_snapshot->>'currency'is distinct from p.currency::text
 or t.source_snapshot->>'amount_minor'is distinct from p.amount_minor::text or p.amount_minor is distinct from(case p.billing_interval when'MONTHLY'then plan.monthly_price_minor when'ANNUAL'then plan.annual_price_minor else null end)
 or t.source_snapshot->>'gateway'is distinct from p.gateway or t.source_snapshot->>'provider_environment'is distinct from p.provider_environment or t.source_snapshot->>'deployment_environment'is distinct from p.deployment_environment
 or not exists(select 1 from private.subscription_checkout_attempts_v1 attempt where attempt.preparation_id=p.id and attempt.organization_id=p.organization_id and attempt.subscription_id=t.subscription_id and attempt.provider_create_authorized_at is not null and attempt.provider_create_authorized_at=(t.source_snapshot->>'provider_create_authorized_at')::timestamptz)
 then return null;end if;
 return t.source_snapshot||jsonb_build_object('source_hash',t.source_hash);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return null;
end$$;
revoke all on function private.subscription_prepared_box_terms_for_preparation_v1(uuid)from public,anon,authenticated,service_role;

create function private.subscription_prepared_box_terms_for_payment_v1(p_payment_event_id bigint)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare pay public.subscription_payment_events%rowtype;i public.subscription_payment_intents%rowtype;p public.subscription_payment_preparations%rowtype;t private.subscription_prepared_box_terms_v1%rowtype;begin
 if private.subscription_payment_cycle_v1(p_payment_event_id)is null then return null;end if;
 select*into pay from public.subscription_payment_events where id=p_payment_event_id;
 select*into i from public.subscription_payment_intents where id=pay.payment_intent_id;
 select*into p from public.subscription_payment_preparations where organization_id=i.organization_id and idempotency_key=i.idempotency_key;
 select*into t from private.subscription_prepared_box_terms_v1 where preparation_id=p.id;
 if private.subscription_prepared_box_terms_for_preparation_v1(p.id)is null or t.preparation_id is null or t.organization_id is distinct from pay.organization_id or t.plan_version_id is distinct from i.plan_version_id
 or p.plan_version_id is distinct from i.plan_version_id or p.billing_interval is distinct from i.billing_interval or p.amount_minor is distinct from i.amount_minor or p.currency is distinct from i.currency
 or p.gateway is distinct from i.gateway or p.provider_environment is distinct from i.provider_environment or p.deployment_environment is distinct from i.deployment_environment
 or t.source_hash is distinct from private.canonical_request_hash(t.source_snapshot)
 or t.source_snapshot->>'preparation_id'is distinct from p.id::text or t.source_snapshot->>'organization_id'is distinct from pay.organization_id::text
 or t.source_snapshot->>'plan_version_id'is distinct from i.plan_version_id::text or t.source_snapshot->>'subscription_id'is distinct from pay.activation_result->>'subscription_id'
 or not exists(select 1 from private.subscription_checkout_attempts_v1 attempt where attempt.preparation_id=p.id and attempt.payment_intent_id=i.id and attempt.organization_id=pay.organization_id and attempt.subscription_id=t.subscription_id and attempt.provider_create_authorized_at=(t.source_snapshot->>'provider_create_authorized_at')::timestamptz)
 then return null;end if;
 return t.source_snapshot||jsonb_build_object('source_hash',t.source_hash);
end$$;

-- Existing payment/cycle readers continue to authorize the actor. Resolve only
-- the pre-PSP promise, never today's rule or the rule present at capture time.
create or replace function private.customer_box_configuration_context_v1(p_organization_id uuid,p_plan_box_rule_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare f jsonb;pay public.subscription_payment_events%rowtype;terms jsonb;options jsonb;selected jsonb;context jsonb;existing public.customer_boxes%rowtype;begin
 f:=private.current_subscription_funding_v1(p_organization_id,statement_timestamp());
 if f is null then return jsonb_build_object('organization_id',p_organization_id,'status','PAID_BOX_FUNDING_REQUIRED','options','[]'::jsonb);end if;
 select*into pay from public.subscription_payment_events where organization_id=p_organization_id and private.subscription_payment_cycle_v1(id)=(f->>'cycle_id')::uuid and private.subscription_payment_funding_environment_compatible_v1(id);
 terms:=private.subscription_prepared_box_terms_for_payment_v1(pay.id);
 if terms is null then return jsonb_build_object('organization_id',p_organization_id,'status','BOX_ORIGINAL_TERMS_REVIEW_REQUIRED','options','[]'::jsonb);end if;
 select*into existing from public.customer_boxes where organization_id=p_organization_id and subscription_id=(f->>'subscription_id')::uuid and period_start=(f->>'period_start')::timestamptz;
 if existing.id is not null then select(a.source_snapshot->>'rule_id')::uuid into p_plan_box_rule_id from public.customer_box_funding_sources_v1 binding join public.box_configuration_approvals_v1 a on a.id=binding.approval_id where binding.customer_box_id=existing.id;
 if not found then return jsonb_build_object('organization_id',p_organization_id,'status','BOX_LEGACY_CONFIGURATION_REVIEW_REQUIRED','options','[]'::jsonb);end if;end if;
 select coalesce(jsonb_agg(jsonb_build_object('rule_id',v#>>'{source_snapshot,rule_id}','approval_id',v->>'approval_id','name_fr',v#>>'{source_snapshot,name_fr}','name_ar',v#>>'{source_snapshot,name_ar}','box_type',v#>>'{source_snapshot,box_type}','credit_budget',v#>>'{source_snapshot,credit_budget}')order by v->>'approval_id'),'[]')into options from jsonb_array_elements(terms->'options')v;
 if p_plan_box_rule_id is null and jsonb_array_length(options)=1 then p_plan_box_rule_id:=(options#>>'{0,rule_id}')::uuid;end if;
 select v into selected from jsonb_array_elements(terms->'options')v where v#>>'{source_snapshot,rule_id}'=p_plan_box_rule_id::text;
 if selected is null then return jsonb_build_object('organization_id',p_organization_id,'status','BOX_SELECTION_REQUIRED','options',options);end if;
 context:=jsonb_build_object('organization_id',p_organization_id,'funding',f,'payment_event_id',pay.id::text,'approval_id',selected->>'approval_id','source_hash',selected->>'source_hash','rule_id',p_plan_box_rule_id,'box_version_id',selected#>>'{source_snapshot,box_version_id}','preparation_id',terms->>'preparation_id','checkout_terms_hash',terms->>'source_hash');
 return jsonb_build_object('organization_id',p_organization_id,'status',case when existing.id is null then'CONFIGURABLE'else'ALREADY_CONFIGURED'end,'options',options,'context_hash',private.canonical_request_hash(context),'context',context,
 'configuration',(selected->'source_snapshot')-'box_creator'-'rule_creator',
 'existing',case when existing.id is null then null else jsonb_build_object('id',existing.id,'box_version_id',existing.box_version_id,'selections',existing.selections_snapshot,'period_start',existing.period_start,'period_end',existing.period_end,'content_hash',existing.content_hash)end);
end$$;

-- The rollover policy of newly issued subscription credits follows the same
-- immutable offer. Existing lots, balances and their historical proof survive.
do $$declare definition text;from_pos integer;to_pos integer;old_section text;begin
 definition:=pg_get_functiondef('private.subscription_credit_grant_terms_v1(uuid,bigint,integer)'::regprocedure);
 from_pos:=position(' select count(*)into rule_count from public.plan_box_rules'in definition);
 to_pos:=position(' expires:=ends+make_interval(months=>box_rule.rollover_months);'in definition);
 if from_pos=0 or to_pos<=from_pos then raise exception'SUBSCRIPTION_CHECKOUT_ROLLOVER_PATCH_MISMATCH';end if;
 old_section:=substring(definition from from_pos for to_pos-from_pos);
 definition:=replace(definition,old_section,' if private.subscription_prepared_box_terms_for_payment_v1(pay.id)is null then raise exception''CREDIT_SUBSCRIPTION_ORIGINAL_TERMS_REVIEW_REQUIRED''using errcode=''55000'';end if;'||chr(10)||' select(promise->>''rollover_months'')::integer rollover_months,promise->>''preparation_id''preparation_id,promise->>''source_hash''checkout_terms_hash,promise->''options''options into box_rule from(select private.subscription_prepared_box_terms_for_payment_v1(pay.id)promise)frozen;'||chr(10));
 execute definition;
end$$;
create function public.get_client_subscription_payment_status_v1(p_organization_id uuid,p_payment_intent_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare intent public.subscription_payment_intents%rowtype;status text;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'],auth.uid())then raise exception'SUBSCRIPTION_PAYMENT_STATUS_DENIED'using errcode='42501';end if;
 select*into intent from public.subscription_payment_intents where id=p_payment_intent_id and organization_id=p_organization_id;
 if not found then raise exception'SUBSCRIPTION_PAYMENT_STATUS_DENIED'using errcode='42501';end if;
 if exists(select 1 from public.subscription_payment_events pay where pay.payment_intent_id=intent.id and pay.organization_id=p_organization_id and private.subscription_payment_cycle_v1(pay.id)is not null)then status:='CONFIRMED';
 elsif exists(select 1 from private.subscription_capture_receipts_v1 receipt where receipt.payment_intent_id=intent.id and receipt.state<>'APPLIED')then status:='PENDING_NATIVE_REVIEW';
 elsif exists(select 1 from private.subscription_checkout_attempts_v1 attempt where attempt.payment_intent_id=intent.id and attempt.state='CAPTURE_REQUESTED')then status:='PENDING_WEBHOOK';
 else status:='REQUIRES_CONFIRMATION';end if;
 return jsonb_build_object('paymentIntentId',intent.id,'status',status);
end$$;
revoke all on function public.get_client_subscription_payment_status_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_subscription_payment_status_v1(uuid,uuid)to authenticated;

-- Provider084 retains all scope, cycle and immutable approval checks; add only
-- the exact promise frozen before the first authorized PSP operation.
create function private.box_checkout_promise_matches_v1(p_context jsonb,p_payment_event_id bigint,p_approval_id uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog,private as $$declare terms jsonb;approval public.box_configuration_approvals_v1%rowtype;begin
 terms:=private.subscription_prepared_box_terms_for_payment_v1(p_payment_event_id);
 select*into approval from public.box_configuration_approvals_v1 where id=p_approval_id;
 return terms is not null and approval.id is not null
 and p_context->>'preparation_id'is not distinct from terms->>'preparation_id'and p_context->>'checkout_terms_hash'is not distinct from terms->>'source_hash'
 and exists(select 1 from jsonb_array_elements(terms->'options')option where option->>'approval_id'=approval.id::text and option->>'source_hash'=approval.source_hash and option->'source_snapshot'=approval.source_snapshot);
end$$;
revoke all on function private.box_checkout_promise_matches_v1(jsonb,bigint,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;needle text:=' and approval.approved_at<=pay.paid_at';begin
 definition:=pg_get_functiondef('private.benefit_customer_box_evidence_v1(uuid,uuid,uuid[],timestamptz)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception'BENEFIT_PRE_PSP_PROMISE_PATCH_MISMATCH';end if;
 execute replace(definition,needle,needle||chr(10)||' and private.box_checkout_promise_matches_v1(binding.context_snapshot,pay.id,approval.id)');
end$$;
revoke all on function private.freeze_subscription_box_checkout_terms_v1(),private.subscription_prepared_box_terms_for_payment_v1(bigint),private.customer_box_configuration_context_v1(uuid,uuid)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
