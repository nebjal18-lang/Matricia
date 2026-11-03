begin;
-- A durable event describes each real immutable transition; delivery never grants
-- a plan or impersonates the financial reviewers.
create function private.emit_subscription_upgrade_transition_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare aggregate text;source uuid;org uuid;kind text;payload jsonb;begin
 case tg_table_name
 when'subscription_upgrade_policies_v1'then aggregate:='subscription_upgrade_policy';source:=new.id;kind:='SubscriptionUpgradePolicyProposedV1';payload:=jsonb_build_object('policy_id',source,'content_hash',new.content_hash,'mode',new.mode,'version',new.version);
 when'subscription_upgrade_policy_decisions_v1'then aggregate:='subscription_upgrade_policy';source:=new.policy_id;kind:='SubscriptionUpgradePolicyDecidedV1';payload:=jsonb_build_object('policy_id',source,'content_hash',new.content_hash,'approved',new.approved,'decided_by',new.decided_by);
 when'subscription_upgrade_policy_withdrawals_v1'then aggregate:='subscription_upgrade_policy';source:=new.policy_id;kind:='SubscriptionUpgradePolicyWithdrawnV1';payload:=jsonb_build_object('policy_id',source,'withdrawn_by',new.withdrawn_by);
 when'subscription_upgrade_quotes_v1'then aggregate:='subscription_upgrade_quote';source:=new.id;org:=new.organization_id;kind:='SubscriptionUpgradeQuotedV1';payload:=jsonb_build_object('quote_id',source,'policy_id',new.policy_id,'content_hash',new.content_hash,'expires_at',new.expires_at);
 when'subscription_upgrade_checkouts_v1'then aggregate:='subscription_upgrade_checkout';source:=new.preparation_id;org:=new.organization_id;kind:='SubscriptionUpgradeCheckoutAcceptedV1';payload:=jsonb_build_object('preparation_id',source,'quote_id',new.quote_id,'accepted_hash',new.accepted_hash,'accepted_by',new.accepted_by);
 else raise exception'INVALID_UPGRADE_TRANSITION_SOURCE'using errcode='22023';end case;
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,aggregate,source::text,kind,source,payload,kind||':'||source::text);
 return new;
end$$;
do $$declare t text;begin foreach t in array array['subscription_upgrade_policies_v1','subscription_upgrade_policy_decisions_v1','subscription_upgrade_policy_withdrawals_v1','subscription_upgrade_quotes_v1','subscription_upgrade_checkouts_v1']loop execute format('create trigger subscription_upgrade_transition_outbox after insert on private.%I for each row execute function private.emit_subscription_upgrade_transition_v1()',t);end loop;end$$;
revoke all on function private.emit_subscription_upgrade_transition_v1()from public,anon,authenticated,service_role;
-- A mathematically non-payable rounded estimate is absence of an offer, not a
-- technical loading error. The actual quote still rejects zero/overflow amounts.
create function private.subscription_proration_option_amount_v1(p_source bigint,p_target bigint,p_start timestamptz,p_end timestamptz,p_at timestamptz,p_rounding text)returns bigint language plpgsql immutable set search_path=pg_catalog as $$begin
 return private.subscription_proration_amount_v1(p_source,p_target,p_start,p_end,p_at,p_rounding);
exception when numeric_value_out_of_range then return null;
end$$;
revoke all on function private.subscription_proration_option_amount_v1(bigint,bigint,timestamptz,timestamptz,timestamptz,text)from public,anon,authenticated,service_role;
do $$declare d text;calc text;needle text:='and private.subscription_upgrade_policy_ready_v1(p.id)';begin
 d:=pg_get_functiondef('public.list_client_subscription_upgrade_options_v1(uuid)'::regprocedure);
 if position(needle in d)=0 then raise exception'UPGRADE_PAYABLE_OPTIONS_SOURCE_MISMATCH';end if;
 d:=replace(d,'private.subscription_proration_amount_v1(','private.subscription_proration_option_amount_v1(');
 calc:='private.subscription_proration_option_amount_v1((private.subscription_upgrade_policy_source_v1(p.source_plan_version_id,p.target_plan_version_id,p.billing_interval)->>''source_price_minor'')::bigint,case p.billing_interval when''MONTHLY''then t.monthly_price_minor else t.annual_price_minor end,(private.subscription_proration_basis_v1((funding->>''cycle_id'')::uuid)->>''basis_period_start'')::timestamptz,(funding->>''period_end'')::timestamptz,statement_timestamp(),p.rounding_mode)';
 d:=replace(d,needle,'and(p.mode<>''PROPORTIONAL_REMAINING''or '||calc||'>0)'||needle);
 d:=replace(d,'''status'',''AVAILABLE'',''can_manage''','''status'',''AVAILABLE'',''availability_reason'',case when jsonb_array_length(options)>0 then''AVAILABLE''when exists(select 1 from private.subscription_upgrade_policies_v1 policy where policy.source_plan_version_id=(funding->>''funded_plan_version_id'')::uuid and private.subscription_upgrade_policy_ready_v1(policy.id))then''NO_PAYABLE_UPGRADE''else''NO_APPROVED_POLICY''end,''can_manage''');execute d;
end$$;
notify pgrst,'reload schema';
commit;
