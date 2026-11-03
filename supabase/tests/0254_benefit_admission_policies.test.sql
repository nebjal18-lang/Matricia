begin;
set local search_path=public,extensions;
-- Synthetic checkout prerequisite, executed through the actual public commands.
-- Two dedicated Finance actors keep content authorship and approval independent;
-- both their fixture identities and the resulting audit/outbox roll back below.
create function pg_temp.seed_approved_box_checkout(
  p_organization_id uuid, p_plan_version_id uuid, p_rollover_months integer default 3
) returns void language plpgsql as $$
declare
  author_id uuid := 'ff850000-0000-4000-8000-000000000001';
  reviewer_id uuid := 'ff850000-0000-4000-8000-000000000002';
  prior_sub text := current_setting('request.jwt.claim.sub', true);
  prior_claims text := current_setting('request.jwt.claims', true);
  plan public.subscription_plan_versions%rowtype;
  benefit jsonb; box jsonb; rule jsonb; approval_context jsonb;
  fixture_key text := 'checkout-fixture-' || p_plan_version_id::text;
begin
  select * into strict plan from public.subscription_plan_versions where id = p_plan_version_id;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(author_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','box-checkout-author@example.invalid','',now(),'{}','{}',now(),now()),
        (reviewer_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','box-checkout-reviewer@example.invalid','',now(),'{}','{}',now(),now())
  on conflict (id) do nothing;
  insert into public.platform_user_roles(user_id,role_code) values(author_id,'FINANCE_MANAGER'),(reviewer_id,'FINANCE_MANAGER') on conflict do nothing;
  perform set_config('request.jwt.claim.sub',author_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',author_id,'role','authenticated','aal','aal2')::text,true);
  benefit := public.create_benefit_version(p_organization_id,'CHECKOUT_FIXTURE_BENEFIT','CREDIT_SERVICE','MATRICIA_INTERNAL',
    'Avantage synthétique de recette','ميزة اختبار اصطناعية','Prérequis de recette uniquement','شرط للاختبار فقط',
    1,0,0,plan.currency,null,null,null,'{}','{}','TEST_ONLY_CHECKOUT',clock_timestamp()-interval '1 minute',fixture_key||'-benefit');
  perform public.activate_benefit_version(p_organization_id,(benefit->>'benefit_version_id')::uuid,fixture_key||'-benefit-active');
  box := public.create_box_version(p_organization_id,'CHECKOUT_FIXTURE_BOX','FIXED','Box synthétique de recette','صندوق اختبار اصطناعي',
    plan.monthly_credit_grant,p_rollover_months,'{}',0,0,0,plan.currency,clock_timestamp()-interval '1 minute',
    jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,
      'allowed_benefit_version_ids',jsonb_build_array(benefit->>'benefit_version_id'))),fixture_key||'-box');
  perform public.activate_box_version(p_organization_id,(box->>'box_version_id')::uuid,null,fixture_key||'-box-active');
  rule := public.link_plan_box_rule(p_organization_id,p_plan_version_id,(box->>'box_version_id')::uuid,
    '{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"AT_MOST"}',clock_timestamp()-interval '1 minute',fixture_key||'-rule');
  approval_context := public.get_box_configuration_approval_context_v1((rule->>'plan_box_rule_id')::uuid);
  perform set_config('request.jwt.claim.sub',reviewer_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer_id,'role','authenticated','aal','aal2')::text,true);
  perform public.approve_box_configuration_v1((rule->>'plan_box_rule_id')::uuid,approval_context->>'source_hash',
    'TEST ONLY independent approval of synthetic checkout terms',fixture_key||'-approve');
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(prior_claims,'{}'),true);
end;
$$;
grant usage on schema extensions to authenticated,service_role;
select no_plan();
-- Synthetic financial approvals only. Nothing is seeded into a real deployment.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST-254-TRUSTED-LOCAL',configured_at=clock_timestamp()where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('a2540000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-credits254-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select('a2540000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'FINANCE_MANAGER'from generate_series(1,2)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2540000-0000-4000-8000-000000000001','TEST manual254','TEST manual254','ACTIVE','a2540000-0000-4000-8000-000000000001'),('b2540000-0000-4000-8000-000000000002','TEST foreign254','TEST foreign254','ACTIVE','a2540000-0000-4000-8000-000000000001');
insert into public.credit_wallets(id,organization_id,wallet_type)values('c2540000-0000-4000-8000-000000000001','b2540000-0000-4000-8000-000000000001','CLIENT'),('c2540000-0000-4000-8000-000000000002','b2540000-0000-4000-8000-000000000002','CLIENT');
insert into public.organization_memberships(id,organization_id,user_id,status)select('c2540000-0000-4000-8000-'||lpad((i+2)::text,12,'0'))::uuid,('b2540000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a2540000-0000-4000-8000-'||lpad((i+2)::text,12,'0'))::uuid,'ACTIVE'from generate_series(1,2)i;
insert into public.organization_member_roles(membership_id,role_code)select('c2540000-0000-4000-8000-'||lpad((i+2)::text,12,'0'))::uuid,'CLIENT_OWNER'from generate_series(1,2)i;
-- Historical catalogue only. Every new credit gift and policy approval below
-- uses actual public governance commands with independent synthetic actors.
insert into public.benefit_definitions(id,code,status,created_by)select('e2540000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'TEST_ADMISSION254_'||i,'ACTIVE','a2540000-0000-4000-8000-000000000001'from generate_series(1,6)i;
insert into public.benefit_versions(id,benefit_id,version,status,benefit_type,fulfillment_mode,name_fr,name_ar,description_fr,description_ar,credit_cost,reference_value_minor,internal_cost_minor,currency,quota,capacity_rule,eligibility_rule,cancellation_rule_version,effective_from,content_hash,created_by)
select('f2540000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('e2540000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,'ACTIVE','SERVICE_UNIT',case when i=3 then'AUTOMATED_PLATFORM'else'MATRICIA_INTERNAL'end,'TEST service254 '||i,'خدمة اختبار254 '||i,'TEST historical published service','خدمة اختبار منشورة',10,0,0,'MAD',case when i=1 then 3 else null end,case when i=2 then'{"expression":"UNKNOWN_TEST_RULE"}'::jsonb else'{}'end,'{}','TEST cancellation254',now()-interval'1 day',repeat('a',64),'a2540000-0000-4000-8000-000000000001'from generate_series(1,6)i;
create temporary table manual254(k text primary key,v jsonb);grant all on manual254 to authenticated;
create function pg_temp.actor254(p_i integer,p_aal text default'aal2')returns void language plpgsql as $$declare uid text:='a2540000-0000-4000-8000-'||lpad(p_i::text,12,'0');begin perform set_config('request.jwt.claim.sub',uid,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','aal',p_aal)::text,true);end$$;
create function pg_temp.request254(p_key text,p_quantity bigint default 13)returns jsonb language sql as $$select public.request_manual_credit_grant_v1('b2540000-0000-4000-8000-000000000001','c2540000-0000-4000-8000-000000000001','ADMIN_GRANT',p_quantity,'2099-01-01T12:00:00Z',null,'TEST-254-GIFT','TEST synthetic gift, reviewed by an independent Finance actor',p_key)$$;

create function pg_temp.reserve254(p_org integer,p_benefit integer,p_units bigint,p_key text)returns jsonb language sql as $$select public.reserve_benefit_credits(('b2540000-0000-4000-8000-'||lpad(p_org::text,12,'0'))::uuid,('c2540000-0000-4000-8000-'||lpad(p_org::text,12,'0'))::uuid,('f2540000-0000-4000-8000-'||lpad(p_benefit::text,12,'0'))::uuid,p_units,now()+interval'1 day',p_key)$$;
create function pg_temp.propose254(p_benefit integer,p_scope text,p_quota bigint,p_capacity bigint,p_countries text[]default'{}')returns jsonb language plpgsql as $$declare ctx jsonb;begin
 ctx:=public.get_admin_benefit_admission_context_v1(('f2540000-0000-4000-8000-'||lpad(p_benefit::text,12,'0'))::uuid);
 return public.propose_benefit_admission_policy_v1((ctx->>'benefit_version_id')::uuid,ctx->>'source_hash',(ctx->>'head_id')::uuid,p_scope,p_quota,p_capacity,p_countries,'{}',now()-interval'1 hour',null,'TEST explicit scope/capacity/conditions, never a production approval','TEST_ONLY_POLICY254','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid());
end$$;
do $$declare req jsonb;review jsonb;begin for i in 1..2 loop
 perform pg_temp.actor254(1);req:=public.request_manual_credit_grant_v1(('b2540000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('c2540000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ADMIN_GRANT',1000,now()+interval'1 year',null,'TEST actual gift254','TEST synthetic gift through independent approval','TEST-254-gift-'||i);
 perform pg_temp.actor254(2);review:=public.review_manual_credit_grant_v1((req->>'request_id')::uuid,req->>'content_hash',true,true,'TEST_ONLY_254_APPROVAL','TEST independent review of synthetic gift');
 perform pg_temp.actor254(1);perform public.execute_manual_credit_grant_v1((req->>'request_id')::uuid,req->>'content_hash',review->>'review_proof_hash','TEST-254-gift-exec-'||i);
 end loop;end$$;
select pg_temp.actor254(3);set local role authenticated;
select throws_ok($$select pg_temp.reserve254(1,1,1,'TEST-254-no-policy')$$,'55000','BENEFIT_ADMISSION_POLICY_REQUIRED','price alone does not authorize unreviewed quota/capacity');
select throws_ok($$select public.get_admin_benefit_admission_context_v1('f2540000-0000-4000-8000-000000000001')$$,'42501','BENEFIT_POLICY_FINANCE_AAL2_REQUIRED','Client cannot administer policy sources');
select pg_temp.actor254(1,'aal1');
select throws_ok($$select pg_temp.propose254(1,'GLOBAL_VERSION',3,2)$$,'42501','BENEFIT_POLICY_FINANCE_AAL2_REQUIRED','Finance AAL1 cannot publish policy');
select pg_temp.actor254(1);
select throws_ok($$select pg_temp.propose254(1,'NONE',null,null)$$,'55000','BENEFIT_LEGACY_RULE_UNSUPPORTED','a non-null source quota cannot be silently discarded');
select throws_ok($$select pg_temp.propose254(2,'NONE',null,null)$$,'55000','BENEFIT_LEGACY_RULE_UNSUPPORTED','unknown nonempty JSON is refused');
select throws_ok($$select pg_temp.propose254(3,'NONE',null,null)$$,'55000','BENEFIT_AUTOMATION_NOT_CONFIGURED','human evidence never enables an automatic executor');
insert into manual254 values('global-policy',pg_temp.propose254(1,'GLOBAL_VERSION',3,2));
select throws_ok($$select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from manual254 where k='global-policy'),(select v->>'content_hash'from manual254 where k='global-policy'),true,'TEST_254_APPROVAL','TEST own approval denied')$$,'42501','BENEFIT_POLICY_INDEPENDENT_REVIEW_REQUIRED','author cannot approve quota/capacity policy');
select pg_temp.actor254(2);
select throws_ok($$select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from manual254 where k='global-policy'),null,true,'TEST_254_APPROVAL','TEST null hash denied')$$,'40001','STALE_BENEFIT_ADMISSION_POLICY','NULL hash cannot approve policy');
select is((public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from manual254 where k='global-policy'),(select v->>'content_hash'from manual254 where k='global-policy'),true,'TEST_254_APPROVAL','TEST independent quota policy')->>'decision'),'APPROVE','independent Finance approves exact policy');
reset role;
select is((select count(*)from public.audit_events a join public.event_outbox e on e.aggregate_id=a.resource_id and e.event_type='BenefitAdmissionPolicyReviewedV1'and e.correlation_id=a.correlation_id and e.payload->>'content_hash'=a.metadata->>'content_hash'where a.action='benefit.admission_policy.reviewed'and a.resource_id=(select v->>'policy_id'from manual254 where k='global-policy')),1::bigint,'policy review has exactly one correlated audit/outbox pair for its exact content');
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from manual254 where k='global-policy'),(select v->>'content_hash'from manual254 where k='global-policy'),true,'TEST_254_APPROVAL','TEST independent quota policy');
select is((select count(*)from public.audit_events where action='benefit.admission_policy.reviewed'and resource_id=(select v->>'policy_id'from manual254 where k='global-policy')),1::bigint,'policy decision replay creates no second audit fact');
select is((select count(*)from public.event_outbox where event_type='BenefitAdmissionPolicyReviewedV1'and aggregate_id=(select v->>'policy_id'from manual254 where k='global-policy')),1::bigint,'policy decision replay creates no second outbox event');
set local role authenticated;
select pg_temp.actor254(3);
insert into manual254 values('first',pg_temp.reserve254(1,1,1,'TEST-254-first'));
select is((select v->>'outcome'from manual254 where k='first'),'BENEFIT_RESERVED','actual credit reservation uses approved policy');
select is((public.get_benefit_admission_availability_v1('b2540000-0000-4000-8000-000000000001','f2540000-0000-4000-8000-000000000001')->>'quota_remaining_units'),'2','global quota counts exact reserved units');
select pg_temp.actor254(4);
insert into manual254 values('second',pg_temp.reserve254(2,1,1,'TEST-254-second'));
select throws_ok($$select pg_temp.reserve254(2,1,1,'TEST-254-capacity-denied')$$,'55000','BENEFIT_CAPACITY_UNAVAILABLE','organisations compete for the same global concurrent capacity');
reset role;
select is((select count(*)from public.benefit_redemptions where benefit_version_id='f2540000-0000-4000-8000-000000000001'),2::bigint,'capacity failure leaves no redemption or partial allocation');
select is((select count(*)from public.benefit_redemption_admissions_v1 where policy_id=(select(v->>'policy_id')::uuid from manual254 where k='global-policy')),2::bigint,'each reservation pins one immutable policy admission');
select is(private.benefit_admitted_fulfillment_evidence_v1((select(v->>'redemption_id')::uuid from manual254 where k='first')),'HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','manual authority comes from exact admitted policy');
select pg_temp.actor254(3);set local role authenticated;
select throws_ok($$select public.get_benefit_admission_availability_v1('b2540000-0000-4000-8000-000000000002','f2540000-0000-4000-8000-000000000001')$$,'42501','BENEFIT_ADMISSION_READ_DENIED','availability rejects foreign scope');
select is((pg_temp.reserve254(1,1,1,'TEST-254-first')->>'redemption_id'),(select v->>'redemption_id'from manual254 where k='first'),'replay preserves original admission even at full capacity');
select public.release_benefit_credits((select(v->>'redemption_id')::uuid from manual254 where k='first'),'TEST_REAL_RELEASE','TEST-254-release');
select is((public.get_benefit_admission_availability_v1('b2540000-0000-4000-8000-000000000001','f2540000-0000-4000-8000-000000000001')->>'capacity_remaining_units'),'1','real RELEASE frees concurrent capacity');
select is((public.get_benefit_admission_availability_v1('b2540000-0000-4000-8000-000000000001','f2540000-0000-4000-8000-000000000001')->>'quota_remaining_units'),'2','cancelled units stop consuming explicit net quota');
select pg_temp.actor254(1);
insert into manual254 values('org-policy',pg_temp.propose254(4,'ORGANIZATION_VERSION',1,null)),('country-policy',pg_temp.propose254(5,'ORGANIZATION_VERSION',100,null,array['MA'])),('period-policy',pg_temp.propose254(6,'ORGANIZATION_SUBSCRIPTION_PERIOD',100,null));
select pg_temp.actor254(2);
do $$declare policy jsonb;begin for policy in select v from manual254 where k in('org-policy','country-policy','period-policy')loop perform public.decide_benefit_admission_policy_v1((policy->>'policy_id')::uuid,policy->>'content_hash',true,'TEST_254_APPROVAL','TEST independent typed policy');end loop;end$$;
select pg_temp.actor254(3);
select is((pg_temp.reserve254(1,4,1,'TEST-254-org-first')->>'outcome'),'BENEFIT_RESERVED','first organisation uses own quota');
select throws_ok($$select pg_temp.reserve254(1,4,1,'TEST-254-org-over')$$,'55000','BENEFIT_QUOTA_EXCEEDED','organisation quota denies another unit');
select pg_temp.actor254(4);
select is((pg_temp.reserve254(2,4,1,'TEST-254-org-foreign')->>'outcome'),'BENEFIT_RESERVED','other organisation retains independent quota');
-- Canonical country is normally MA; change only the synthetic second organisation.
reset role;
update public.organizations set country_code='FR'where id='b2540000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select pg_temp.reserve254(2,5,1,'TEST-254-country-denied')$$,'55000','BENEFIT_ELIGIBILITY_NOT_MET','eligibility uses canonical country, not caller evidence');
select throws_ok($$select pg_temp.reserve254(2,6,1,'TEST-254-period-denied')$$,'55000','BENEFIT_SUBSCRIPTION_PERIOD_REQUIRED','period quota requires real funded cycle');
select is((public.get_benefit_admission_availability_v1('b2540000-0000-4000-8000-000000000002','f2540000-0000-4000-8000-000000000003')->>'blocked_reason'),'BENEFIT_AUTOMATION_NOT_CONFIGURED','Client sees unsupported automation explicitly');

-- Explicit historical published plan; the cycle below is activated only through
-- actual posting governance + native PSP v2 commands (synthetic trusted DEMO).
reset role;
insert into public.subscription_plans(id,code,status,created_by)values('d2549000-0000-4000-8000-000000000001','GOLD','ACTIVE','a2540000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d2549000-0000-4000-8000-000000000002','d2549000-0000-4000-8000-000000000001',1,'ACTIVE','MAD',100,1000,10,5000,5000,'{}',current_date-1,repeat('b',64),'a2540000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('d2549000-0000-4000-8000-000000000003','b2540000-0000-4000-8000-000000000001','TRIAL_EXPIRED');
select pg_temp.seed_approved_box_checkout('b2540000-0000-4000-8000-000000000001','d2549000-0000-4000-8000-000000000002',3);
select pg_temp.actor254(1);set local role authenticated;
insert into manual254 values('posting-proposal',public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2549000-0000-4000-8000-000000000002',null,'MAD','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('cash_account_code','TEST254_CASH_MAD','cash_name_fr','TEST cash','cash_name_ar','خزينة اختبار','suspense_account_code','TEST254_PENDING_MAD','suspense_name_fr','TEST pending','suspense_name_ar','قيد اختبار'),'TEST ONLY posting for synthetic native admission recipe','TEST-254-posting'));
select pg_temp.actor254(2);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from manual254 where k='posting-proposal'),true,(select v->>'request_hash'from manual254 where k='posting-proposal'),'TEST independent posting approval254');
select pg_temp.actor254(3);
insert into manual254 values('payment-prepared',public.prepare_subscription_payment_intent_v2('b2540000-0000-4000-8000-000000000001','d2549000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','TEST-254-demo-prepare'));
reset role;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into manual254 values('payment-registered',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from manual254 where k='payment-prepared'),'DEMO','SYNTHETIC-254-DEMO-ORDER',100,'MAD'));
insert into manual254 values('payment-paid',public.process_verified_subscription_payment_v2('DEMO','DEMO','SYNTHETIC-254-DEMO-EVENT','SYNTHETIC-254-DEMO-ORDER','PAYMENT_SUCCEEDED',100,'MAD',clock_timestamp(),'SYNTHETIC-254-CAPTURE',repeat('d',64),repeat('e',64)));
select ok(private.current_subscription_funding_v1('b2540000-0000-4000-8000-000000000001')is not null,'funded quota period is backed by exact native payment/cycle/journal, never an ACTIVE label alone');
select pg_temp.actor254(3);set local role authenticated;
select is((pg_temp.reserve254(1,6,2,'TEST-254-funded-period')->>'outcome'),'BENEFIT_RESERVED','real funded period permits actual reservation under period-scoped policy');
select is((public.get_benefit_admission_availability_v1('b2540000-0000-4000-8000-000000000001','f2540000-0000-4000-8000-000000000006')->>'quota_remaining_units'),'98','current funded cycle counts exact admitted units');
reset role;
select ok(exists(select 1 from public.benefit_redemption_admissions_v1 a where a.organization_id='b2540000-0000-4000-8000-000000000001'and a.quota_scope='ORGANIZATION_SUBSCRIPTION_PERIOD'and a.subscription_cycle_id=(private.current_subscription_funding_v1(a.organization_id)->>'cycle_id')::uuid and a.period_start=(private.current_subscription_funding_v1(a.organization_id)->>'period_start')::timestamptz),'admission permanently binds actual funded cycle and server period');
select pg_temp.actor254(1);set local role authenticated;
select pg_temp.actor254(1);
insert into manual254 values('replacement',pg_temp.propose254(4,'ORGANIZATION_VERSION',2,null)),('sibling',pg_temp.propose254(4,'ORGANIZATION_VERSION',3,null));
select pg_temp.actor254(2);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from manual254 where k='replacement'),(select v->>'content_hash'from manual254 where k='replacement'),true,'TEST_254_NEW_APPROVAL','TEST replacement explicit scope');
select throws_ok($$select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from manual254 where k='sibling'),(select v->>'content_hash'from manual254 where k='sibling'),true,'TEST_254_STALE_APPROVAL','TEST stale prior head')$$,'40001','STALE_BENEFIT_ADMISSION_POLICY','new approved head invalidates pending sibling');
select pg_temp.actor254(3);
select is((public.get_benefit_admission_availability_v1('b2540000-0000-4000-8000-000000000001','f2540000-0000-4000-8000-000000000004')->>'quota_remaining_units'),'1','replacement includes earlier usage instead of resetting quota');
reset role;
select ok(not has_table_privilege('authenticated','public.benefit_admission_policy_decisions_v1','INSERT'),'browser cannot fabricate decisions');
select ok(not has_function_privilege('authenticated','private.record_benefit_admission_v1(public.benefit_redemptions,uuid,jsonb,text)','execute'),'browser cannot fabricate linked admissions');
select is((select count(*)from public.benefit_redemptions where benefit_version_id::text like'f2540000-%'),(select count(*)from public.benefit_redemption_admissions_v1 where organization_id::text like'b2540000-%'),'every created redemption has exactly one admission');
select*from finish();rollback;
