begin;
-- A paid period and a free-standing customer_boxes row are insufficient.
-- Only the exact governed funding/approval/configuration binding qualifies.
create function private.benefit_customer_box_evidence_v1(p_org uuid,p_cycle uuid,p_box_versions uuid[],p_at timestamptz)returns jsonb
language sql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
 select jsonb_build_object('customer_box_id',cb.id,'customer_box_content_hash',cb.content_hash,'box_version_id',cb.box_version_id,'approval_id',approval.id,'approval_source_hash',approval.source_hash,'payment_event_id',binding.payment_event_id::text,'context_hash',binding.context_hash,'bound_at',binding.created_at)
 from public.customer_boxes cb
 join public.customer_box_funding_sources_v1 binding on binding.customer_box_id=cb.id and binding.organization_id=cb.organization_id
 join public.subscription_cycles cycle on cycle.id=binding.cycle_id and cycle.organization_id=cb.organization_id and cycle.subscription_id=cb.subscription_id and cycle.period_start=cb.period_start and cycle.period_end=cb.period_end
 join public.subscription_payment_events pay on pay.id=binding.payment_event_id and pay.organization_id=cb.organization_id
 join public.box_configuration_approvals_v1 approval on approval.id=binding.approval_id
 where cb.organization_id=p_org and binding.cycle_id=p_cycle and cb.box_version_id=any(p_box_versions)and cb.period_start<=p_at and cb.period_end>p_at and binding.created_at<=p_at
 and private.subscription_payment_cycle_v1(pay.id)=cycle.id and private.subscription_payment_funding_environment_compatible_v1(pay.id)
 and binding.context_hash=private.canonical_request_hash(binding.context_snapshot)
 and cb.content_hash=private.canonical_request_hash(jsonb_build_object('context',binding.context_snapshot,'selections',cb.selections_snapshot))
 and binding.context_snapshot->>'organization_id'=cb.organization_id::text
 and binding.context_snapshot->>'box_version_id'=cb.box_version_id::text
 and binding.context_snapshot->>'approval_id'=approval.id::text
 and binding.context_snapshot->>'payment_event_id'=pay.id::text
 and binding.context_snapshot->>'rule_id'=approval.plan_box_rule_id::text
 and binding.context_snapshot->>'source_hash'=approval.source_hash
 and binding.context_snapshot#>>'{funding,cycle_id}'=cycle.id::text
 and binding.context_snapshot#>>'{funding,subscription_id}'=cycle.subscription_id::text
 and binding.context_snapshot#>>'{funding,funded_plan_version_id}'=cycle.plan_version_id::text
 and binding.context_snapshot#>'{funding,period_start}'=to_jsonb(cb.period_start)
 and binding.context_snapshot#>'{funding,period_end}'=to_jsonb(cb.period_end)
 and approval.source_hash=private.canonical_request_hash(approval.source_snapshot)
 and approval.source_snapshot->>'box_version_id'=cb.box_version_id::text
 and approval.source_snapshot->>'plan_version_id'=cycle.plan_version_id::text
 and approval.approved_at<=pay.paid_at
 order by cb.created_at,cb.id limit 1
$$;
revoke all on function private.benefit_customer_box_evidence_v1(uuid,uuid,uuid[],timestamptz)from public,anon,authenticated,service_role;
do $$declare definition text;needle text;begin
 select pg_get_functiondef('private.benefit_admission_status_v1(uuid,uuid,bigint,timestamptz,uuid)'::regprocedure)into definition;
 needle:=' if cardinality(p.required_box_version_ids)>0 and not exists(select 1 from public.customer_boxes cb join public.subscriptions s on s.id=cb.subscription_id and s.organization_id=cb.organization_id where cb.organization_id=p_org and cb.box_version_id=any(p.required_box_version_ids)and cb.period_start=(period->>''period_start'')::timestamptz and cb.period_end=(period->>''period_end'')::timestamptz and cb.period_start<=p_at and cb.period_end>p_at and s.status=''ACTIVE'')then reason:=''BENEFIT_ELIGIBILITY_NOT_MET'';end if;';
 if strpos(definition,needle)=0 or strpos(definition,'reason text;country text;begin')=0 or strpos(definition,'''counting_rule'',p.quota_counting_rule)')=0 then raise exception'BENEFIT_BOX_ADMISSION_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,'reason text;country text;begin','reason text;country text;qualified_box jsonb;begin');
 definition:=replace(definition,needle,' if cardinality(p.required_box_version_ids)>0 then qualified_box:=private.benefit_customer_box_evidence_v1(p_org,(period->>''cycle_id'')::uuid,p.required_box_version_ids,p_at);if qualified_box is null then reason:=''BENEFIT_ELIGIBILITY_NOT_MET'';end if;end if;');
 definition:=replace(definition,'''counting_rule'',p.quota_counting_rule)','''counting_rule'',p.quota_counting_rule,''customer_box'',qualified_box)');
 needle:=' if p_units is null or p_units<1 or p_at is null then reason:=''INVALID_BENEFIT_ADMISSION_UNITS'';';
 if strpos(definition,needle)=0 then raise exception'BENEFIT_BOX_AVAILABILITY_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,needle,' if not exists(select 1 from public.organizations org where org.id=p_org and org.status=''ACTIVE'')then reason:=''BENEFIT_ORGANIZATION_NOT_ACTIVE'';elsif not private.subscription_financially_clear(p_org)then reason:=''SUBSCRIPTION_FINANCIAL_HOLD'';elsif not private.client_identity_allows_new_operations(p_org)then reason:=''CLIENT_IDENTITY_REVIEW_REQUIRED'';elsif p_units is null or p_units<1 or p_at is null then reason:=''INVALID_BENEFIT_ADMISSION_UNITS'';');
 execute definition;
 -- Public availability keeps the business projection; internal source bindings
 -- stay in the immutable admission evidence rather than the Client DTO.
 select pg_get_functiondef('public.get_benefit_admission_availability_v1(uuid,uuid)'::regprocedure)into definition;
 needle:='return private.benefit_admission_status_v1(p_organization_id,p_benefit_version_id,1,statement_timestamp());';
 if strpos(definition,needle)=0 then raise exception'BENEFIT_BOX_PUBLIC_PROJECTION_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,needle,'return private.benefit_admission_status_v1(p_organization_id,p_benefit_version_id,1,statement_timestamp())-''customer_box'';');
 execute definition;
 -- New manual effects need the exact frozen condition evidence. Never invent a
 -- historical Box proof for an old admission that did not capture one.
 select pg_get_functiondef('private.benefit_admitted_fulfillment_evidence_v1(uuid)'::regprocedure)into definition;
 needle:='where a.redemption_id=p_redemption_id and';
 if strpos(definition,needle)=0 then raise exception'BENEFIT_BOX_FULFILLMENT_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,needle,'where a.redemption_id=p_redemption_id and(cardinality(p.required_box_version_ids)=0 or a.admission_snapshot->''customer_box''=private.benefit_customer_box_evidence_v1(a.organization_id,a.subscription_cycle_id,p.required_box_version_ids,a.admitted_at))and');
 execute definition;
 select pg_get_functiondef('private.finalize_benefit_credit_reservation_v1()'::regprocedure)into definition;
 needle:='if current_state->>''policy_id''is distinct from a.policy_id::text';
 if strpos(definition,needle)=0 then raise exception'BENEFIT_BOX_FINAL_ALLOCATION_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,needle,'if current_state->''customer_box''is distinct from a.admission_snapshot->''customer_box''or current_state->>''policy_id''is distinct from a.policy_id::text');
 execute definition;
end$$;
commit;
