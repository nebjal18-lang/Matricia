-- Isolated TEST-only, rollback-only fixtures; no disabled trigger or policy.
-- Mutations run as the authenticated manager through audited catalogue commands.
begin;
set local search_path=public,extensions;
select no_plan();
select throws_ok($q$select private.require_franchise_control_admin_queue_v1('TEST_MISSING_CENTRAL_REVIEW_QUEUE_373')$q$,'55000','FRANCHISE_CONTROL_ADMIN_QUEUE_NOT_CONFIGURED','an absent queue fails explicitly without disabling a production immutability guard');
-- Isolated role fixtures below establish missing/revoked-owner preconditions only;
-- every assignment/proposal/review/progress action under test uses its public RPC.
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','performance-lifecycle-'||i||'@example.invalid','',now(),'{}','{}',now(),now() from generate_series(1,3)i;
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('b3650000-0000-4000-8000-000000000001','Performance TEST A','Performance TEST A','ACTIVE','a3650000-0000-4000-8000-000000000001'),
('b3650000-0000-4000-8000-000000000002','Performance TEST B','Performance TEST B','ACTIVE','a3650000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status)
select ('c3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE' from generate_series(1,2)i;
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)
select ('f3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'EDITORIAL_365_'||i,'performance-365-'||i,('b3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'DRAFT',('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by)
select ('f3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE',now()-interval'1 day',1,('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,activation_mode,created_by)
select ('d3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('f3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'STANDARD','FRANCHISEE','EDITORIAL_365_'||i,'ACTIVE','NON_CONTRACTUAL_DEMO',('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)
select ('e3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('d3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,'EDITORIAL_365_'||i,'Territoire test '||i,'نطاق اختبار '||i,'{}',now()-interval'1 day',repeat('a',64),('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select ('e3651000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('d3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('e3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,(select id from public.franchise_economic_rule_versions where franchise_type='STANDARD' order by version desc limit 1),1,'ACTIVE','{}','{}','{"testOnly":true}',0,'UPFRONT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('b',64),('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
update public.franchises f set current_mandate_version_id=m.id from public.franchise_mandate_versions m where m.franchise_id=f.id and f.id in('d3650000-0000-4000-8000-000000000001','d3650000-0000-4000-8000-000000000002');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)
select ('c3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'FRANCHISE_MANAGER',('d3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;


-- A genuinely empty library A remains unmeasured. B contains a real draft
-- identity with no published version: this observed incomplete inventory scores 0.
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values('f3651000-0000-4000-8000-000000000001','f3650000-0000-4000-8000-000000000002','CONTROL_CATEGORY','control-category','DRAFT','a3650000-0000-4000-8000-000000000002');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values('f3652000-0000-4000-8000-000000000001','f3650000-0000-4000-8000-000000000002','f3651000-0000-4000-8000-000000000001','CONTROL_SUBCATEGORY','control-subcategory','DRAFT','a3650000-0000-4000-8000-000000000002');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values('f3653000-0000-4000-8000-000000000001','f3650000-0000-4000-8000-000000000002','f3652000-0000-4000-8000-000000000001','CONTROL_SERVICE','control-service','DRAFT','a3650000-0000-4000-8000-000000000002');

-- Two distinct real TEST mandates above; no disabled guard or bypassed RLS.
insert into public.platform_user_roles(user_id,role_code)values
('a3650000-0000-4000-8000-000000000001','MATRICIA_ADMIN'),
('a3650000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a3650000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','composite-review-365@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('c3650000-0000-4000-8000-000000000004','b3650000-0000-4000-8000-000000000002','a3650000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values('c3650000-0000-4000-8000-000000000004','FRANCHISE_OWNER','d3650000-0000-4000-8000-000000000002');
insert into public.platform_user_roles(user_id,role_code)values('a3650000-0000-4000-8000-000000000004','MATRICIA_ADMIN');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a3650000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','plan-owner-replacement-test@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('c3650000-0000-4000-8000-000000000005','b3650000-0000-4000-8000-000000000002','a3650000-0000-4000-8000-000000000005','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values('c3650000-0000-4000-8000-000000000005','FRANCHISE_VIEWER','d3650000-0000-4000-8000-000000000002');
-- No responsible member exists when the native plan is generated.
select private.revoke_franchise_role_assignment_v1('c3650000-0000-4000-8000-000000000002','FRANCHISE_MANAGER','d3650000-0000-4000-8000-000000000002','a3650000-0000-4000-8000-000000000003');
select private.revoke_franchise_role_assignment_v1('c3650000-0000-4000-8000-000000000004','FRANCHISE_OWNER','d3650000-0000-4000-8000-000000000002','a3650000-0000-4000-8000-000000000003');
create temporary table owner_observed373(k text primary key,v jsonb);grant all on owner_observed373 to authenticated,service_role;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into owner_observed373 values('run',public.run_franchise_performance_control_v1(25));reset role;
insert into owner_observed373 values('plan',jsonb_build_object('id',(select id from public.franchise_control_plan_proposals_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'order by created_at limit 1)));
select is((select(v->>'failed')::integer from owner_observed373 where k='run'),0,'native plans are generated without inventing an owner');
select ok((select suggested_owner_user_id is null from public.franchise_control_plan_proposals_v1 where id=(select(v->>'id')::uuid from owner_observed373 where k='plan')),'source proposal genuinely has no suggested owner');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is(public.get_franchise_control_owner_context_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'))->>'ownerActive','false','missing owner remains explicit rather than a successful empty state');
select is((select count(*)::integer from public.admin_work_items where resource_type='franchise_control_plan_owner'and resource_id=(select v->>'id'from owner_observed373 where k='plan')),1,'a real central task makes the plan discoverable to an independent administrator');
insert into owner_observed373 values('claim',public.claim_admin_work_item((select id from public.admin_work_items where resource_type='franchise_control_plan_owner'and resource_id=(select v->>'id'from owner_observed373 where k='plan')),1,'Prise en charge de la revue native','owner373-claim'));
select throws_ok(format($q$select public.resolve_admin_work_item(%L,'BYPASS_CLOSURE','A generic queue resolution cannot close a live plan','{}',2,'owner373-close-bypass')$q$,(select v->>'work_item_id'from owner_observed373 where k='claim')),'42501','FRANCHISE_CONTROL_PLAN_GOVERNED_CLOSURE_REQUIRED','generic queue resolution cannot bypass the corrective plan governance');

select throws_ok(format($q$select public.record_franchise_control_plan_event_v1(%L,'APPROVED','Approval needs a governed owner',null,'owner373-no-owner')$q$,(select v->>'id'from owner_observed373 where k='plan')),'23514','FRANCHISE_CONTROL_OWNER_ASSIGNMENT_APPROVAL_REQUIRED','plan cannot be approved without an independently approved assignment');
reset role;
-- A role is restored as a TEST precondition; this does not alter the old plan.
select private.grant_franchise_role_assignment_v1('c3650000-0000-4000-8000-000000000002','FRANCHISE_MANAGER','d3650000-0000-4000-8000-000000000002','a3650000-0000-4000-8000-000000000003');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is((public.get_franchise_control_owner_context_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'))#>>'{candidates,0,id}'),'a3650000-0000-4000-8000-000000000002','selector contains only a currently authorized member of the exact mandate');
insert into owner_observed373 values('assignment',public.propose_franchise_control_owner_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'),'a3650000-0000-4000-8000-000000000002',0,'Affectation native du responsable après régularisation','owner373-propose'));
insert into owner_observed373 values('assignment-replay',public.propose_franchise_control_owner_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'),'a3650000-0000-4000-8000-000000000002',0,'Affectation native du responsable après régularisation','owner373-propose'));
select is((select v from owner_observed373 where k='assignment'),(select v from owner_observed373 where k='assignment-replay'),'proposal replay preserves one assignment request');
select throws_ok(format($q$select public.review_franchise_control_owner_v1(%L,'APPROVE','The proposer must not self approve','owner373-self')$q$,(select v->>'requestId'from owner_observed373 where k='assignment')),'42501','FRANCHISE_CONTROL_OWNER_SECOND_INDEPENDENT_ADMIN_REQUIRED','first administrator cannot approve their own assignment');
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into owner_observed373 values('approval',public.review_franchise_control_owner_v1((select(v->>'requestId')::uuid from owner_observed373 where k='assignment'),'APPROVE','Revue indépendante du membre proposé pour le mandat','owner373-approve'));
insert into owner_observed373 values('approval-replay',public.review_franchise_control_owner_v1((select(v->>'requestId')::uuid from owner_observed373 where k='assignment'),'APPROVE','Revue indépendante du membre proposé pour le mandat','owner373-approve'));
select is((select v from owner_observed373 where k='approval'),(select v from owner_observed373 where k='approval-replay'),'independent approval replay keeps the first assignment version');
select is(public.get_franchise_control_owner_context_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'))->>'ownerUserId','a3650000-0000-4000-8000-000000000002','effective owner follows the approved event rather than rewriting the original suggestion');
insert into owner_observed373 values('plan-approved',public.record_franchise_control_plan_event_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'),'APPROVED','Plan approuvé avec responsable figé indépendamment',null,'owner373-plan-approve'));
reset role;
select is((select owner_user_id::text from private.franchise_control_approval_owners_v1 where plan_id=(select(v->>'id')::uuid from owner_observed373 where k='plan')),'a3650000-0000-4000-8000-000000000002','approval freezes the real responsible member in append-only evidence');
select ok((select suggested_owner_user_id is null from public.franchise_control_plan_proposals_v1 where id=(select(v->>'id')::uuid from owner_observed373 where k='plan')),'governed assignment preserves the missing original suggestion');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into owner_observed373 values('progress',public.record_franchise_control_plan_event_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'),'PROGRESS','Le responsable a commencé la correction du catalogue',25,'owner373-progress'));
reset role;
-- Revocation is a TEST precondition; restoration must require a new human decision.
select private.revoke_franchise_role_assignment_v1('c3650000-0000-4000-8000-000000000002','FRANCHISE_MANAGER','d3650000-0000-4000-8000-000000000002','a3650000-0000-4000-8000-000000000003');
select private.grant_franchise_role_assignment_v1('c3650000-0000-4000-8000-000000000005','FRANCHISE_MANAGER','d3650000-0000-4000-8000-000000000002','a3650000-0000-4000-8000-000000000003');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select is(public.get_franchise_control_owner_context_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'))->>'ownerActive','false','a different available manager does not silently replace a revoked owner');
select throws_ok(format($q$select public.record_franchise_control_plan_event_v1(%L,'PROGRESS','An active manager cannot bypass revoked ownership',50,'owner373-blocked')$q$,(select v->>'id'from owner_observed373 where k='plan')),'23514','FRANCHISE_CONTROL_OWNER_REASSIGNMENT_REQUIRED','progress is blocked until the revoked owner is replaced through governance');
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into owner_observed373 values('replacement',public.propose_franchise_control_owner_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'),'a3650000-0000-4000-8000-000000000005',1,'Remplacement gouverné après révocation du premier responsable','owner373-replacement'));
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into owner_observed373 values('replacement-approval',public.review_franchise_control_owner_v1((select(v->>'requestId')::uuid from owner_observed373 where k='replacement'),'APPROVE','Revue indépendante du remplacement avec droits actuels','owner373-replacement-approve'));
select is(public.get_franchise_control_owner_context_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'))->>'version','2','reassignment appends a second approved ownership version');
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
insert into owner_observed373 values('replacement-progress',public.record_franchise_control_plan_event_v1((select(v->>'id')::uuid from owner_observed373 where k='plan'),'PROGRESS','Avancement déclaré du responsable remplaçant',100,'owner373-replacement-progress'));
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok(format($q$select public.record_franchise_control_plan_event_v1(%L,'COMPLETED','A declared hundred percent does not prove the source objective',null,'owner373-premature-completion')$q$,(select v->>'id'from owner_observed373 where k='plan')),'23514','FRANCHISE_CONTROL_REMEASUREMENT_REQUIRED','declarative progress does not bypass native remeasurement');
reset role;
select is((select owner_user_id::text from private.franchise_control_approval_owners_v1 where plan_id=(select(v->>'id')::uuid from owner_observed373 where k='plan')),'a3650000-0000-4000-8000-000000000002','replacement keeps the original approval owner evidence intact');
select is((select count(*)::integer from private.franchise_control_owner_decisions_v1 where plan_id=(select(v->>'id')::uuid from owner_observed373 where k='plan')and decision='APPROVE'),2,'only two real independent assignment approvals exist despite retries');
select is((select count(*)::integer from public.franchise_control_plan_events_v1 where plan_id=(select(v->>'id')::uuid from owner_observed373 where k='plan')and kind='COMPLETED'),0,'unfinished objectives remain unfinished');
-- Structural policy counterexamples below are TEST-only score fixtures. They
-- verify report selection, not native scoring accuracy or a certified completion.
create function pg_temp.test_control_report373(p_days integer,p_a integer,p_b integer)returns uuid language plpgsql as $$declare x uuid;begin
 insert into public.franchise_control_reports_v1(franchise_id,model_id,kind,period_start,period_end,completeness,global_score_bps,axis_scores,metrics,methodology,comparison,source_evidence_hash)
 select 'd3650000-0000-4000-8000-000000000002',model_id,'DAILY',current_date-p_days,current_date-p_days,'PARTIAL',null,jsonb_build_object('CLIENT_NETWORK',p_a,'LIBRARY_QUALITY',p_b),'{}','{"testOnlyStructuralScores":true}','{"status":"INSUFFICIENT_COHORT"}',repeat('3',64)from public.franchise_control_reports_v1 where id=(select report_id from public.franchise_control_plan_proposals_v1 where id=(select(v->>'id')::uuid from owner_observed373 where k='plan'))returning id into x;return x;
end$$;
insert into owner_observed373 values('policy-basis',jsonb_build_object('id',pg_temp.test_control_report373(10,1000,1000)));
insert into public.franchise_control_plan_proposals_v1(id,report_id,franchise_id,objectives,suggested_owner_user_id,due_on)
values('a3739000-0000-4000-8000-000000000001',(select(v->>'id')::uuid from owner_observed373 where k='policy-basis'),'d3650000-0000-4000-8000-000000000002','[{"axis":"CLIENT_NETWORK","targetScoreBps":6000},{"axis":"LIBRARY_QUALITY","targetScoreBps":6000}]','a3650000-0000-4000-8000-000000000005',current_date+30);
insert into public.franchise_control_plan_events_v1(plan_id,kind,comment,actor_user_id,idempotency_key)values('a3739000-0000-4000-8000-000000000001','APPROVED','TEST structural approval precondition only','a3650000-0000-4000-8000-000000000003','owner373-structural-approval');
select pg_temp.test_control_report373(9,7000,1000);select pg_temp.test_control_report373(8,1000,7000);
-- Existing real daily report is newer than these deliberately historical fixtures;
-- it does not meet both goals, so selecting improvements across reports must fail.
select is(private.franchise_control_completion_measurement_v1('a3739000-0000-4000-8000-000000000001'),null::uuid,'different older reports meeting one goal each cannot be combined into a completed plan');
select pg_temp.test_control_report373(7,7000,7000);select pg_temp.test_control_report373(6,1000,7000);
select is(private.franchise_control_completion_measurement_v1('a3739000-0000-4000-8000-000000000001'),null::uuid,'an older all-goals improvement does not override a newer degraded measurement');
select *from finish();rollback;
