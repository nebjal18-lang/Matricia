-- Isolated TEST-only, rollback-only fixtures; no disabled trigger or policy.
-- Mutations run as the authenticated manager through audited catalogue commands.
begin;
set local search_path=public,extensions;
select no_plan();
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
-- Historical source rows are explicit TEST fixtures, not a claim that the
-- disclosure entry or catalogue approval user journey has been certified.
insert into public.catalog_change_requests(id,library_id,target_type,target_id,target_version_id,status,sensitive,requested_by,requested_at,reviewed_by,reviewed_at)
values('a3711000-0000-4000-8000-000000000001','f3650000-0000-4000-8000-000000000002','SERVICE','f3653000-0000-4000-8000-000000000001','a3711000-0000-4000-8000-000000000002','APPROVED',false,'a3650000-0000-4000-8000-000000000002',date_trunc('day',now())-interval'12 hours','a3650000-0000-4000-8000-000000000003',date_trunc('day',now())-interval'12 hours'+interval'5 minutes');
insert into public.franchise_conflict_disclosures(id,franchise_id,subject_type,subject_id,decision,reason,evidence_hash,declared_by,declared_at)
values('a3712000-0000-4000-8000-000000000001','d3650000-0000-4000-8000-000000000002','PROVIDER_SELECTION','TEST-SUBJECT-PRIVATE','CONFLICT_DECLARED','PRIVATE-CONFLICT-REASON-TEST',repeat('d',64),'a3650000-0000-4000-8000-000000000002',date_trunc('day',now())-interval'12 hours');
create temporary table signal_observed371(k text primary key,v jsonb);grant all on signal_observed371 to authenticated,service_role;
set constraints all immediate;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into signal_observed371 values('run',public.run_franchise_performance_control_v1(25));reset role;
select is((select(v->>'failed')::integer from signal_observed371 where k='run'),0,'native report and facts collectors complete independently without hidden query errors');
select is((select count(*)::integer from public.franchise_governance_signal_snapshots_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'),3,'daily monthly and quarterly facts are collected from native sources');
insert into signal_observed371(k,v)select 'snapshot',to_jsonb(s)from public.franchise_governance_signal_snapshots_v1 s join public.franchise_control_reports_v1 r on r.id=s.report_id where s.franchise_id='d3650000-0000-4000-8000-000000000002'and r.kind='DAILY';
select is((select v#>>'{summary,largestProviderShareBps}'from signal_observed371 where k='snapshot'),null::text,'no missions means unknown concentration rather than a reassuring zero');
select is((select v#>>'{summary,qualificationShortestSeconds}'from signal_observed371 where k='snapshot'),null::text,'no qualification decision means an unmeasured delay');
select is((select(v#>>'{summary,catalogReviewShortestSeconds}')::numeric from signal_observed371 where k='snapshot'),300::numeric,'native review interval is measured without an invented speed threshold');
select is((select v#>>'{summary,riskVerdict}'from signal_observed371 where k='snapshot'),null::text,'no approved threshold produces no risk verdict');
select is((select v#>>'{summary,thresholdConfiguration}'from signal_observed371 where k='snapshot'),'APPROVED_THRESHOLDS_NOT_PROVIDED','missing approved configuration is explicit');
select ok(not(select v::text like'%PRIVATE-CONFLICT-REASON-TEST%'from signal_observed371 where k='snapshot'),'member summary does not expose the private declaration or reviewer details');
select is((select count(*)::integer from private.franchise_governance_signal_sources_v1 where snapshot_id=(select(v->>'id')::uuid from signal_observed371 where k='snapshot')and kind='CONFLICT_DISCLOSURE'),1,'the independent collector freezes the actual declared conflict');
select is((select count(*)::integer from private.franchise_governance_review_requests_v1 where snapshot_id=(select(v->>'id')::uuid from signal_observed371 where k='snapshot')and origin='SYSTEM_FACT'),1,'a declared fact queues one human examination without asserting fault');
insert into signal_observed371(k,v)select 'request',jsonb_build_object('id',q.id)from private.franchise_governance_review_requests_v1 q where q.snapshot_id=(select(v->>'id')::uuid from signal_observed371 where k='snapshot');
set constraints all immediate;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into signal_observed371 values('member',public.get_franchise_governance_signals_v1('d3650000-0000-4000-8000-000000000002',(select(v->>'report_id')::uuid from signal_observed371 where k='snapshot')));
select is((select v#>>'{benchmark,status}'from signal_observed371 where k='member'),'ADMIN_ONLY','ordinary members do not receive sensitive inter-franchise comparisons');
select is((select v#>>'{capabilities,requestRestriction}'from signal_observed371 where k='member'),'MFA_REQUIRED','member read access does not remove the step-up requirement for a new review request');
select throws_ok(format($q$select public.inspect_franchise_governance_review_v1(%L,'CONFLICT_DISCLOSURE',null,25,'Inspect private source purpose')$q$,(select v->>'id'from signal_observed371 where k='request')),'42501','FRANCHISE_GOVERNANCE_INSPECTION_MFA_REQUIRED','private inspection preserves the second factor');
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok(format($q$select public.inspect_franchise_governance_review_v1(%L,'CONFLICT_DISCLOSURE',null,25,'Inspect private source purpose')$q$,(select v->>'id'from signal_observed371 where k='request')),'42501','FRANCHISE_GOVERNANCE_INSPECTION_ADMIN_REQUIRED','even an AAL2 franchise manager cannot inspect private conflicts');
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok(format($q$select public.inspect_franchise_governance_review_v1(%L,'CONFLICT_DISCLOSURE',null,25,'short')$q$,(select v->>'id'from signal_observed371 where k='request')),'22023','FRANCHISE_GOVERNANCE_INSPECTION_INVALID','authorized inspection still requires an explicit purpose');
insert into signal_observed371 values('inspection',public.inspect_franchise_governance_review_v1((select(v->>'id')::uuid from signal_observed371 where k='request'),'CONFLICT_DISCLOSURE',null,25,'Independent TEST examination of declared conflict'));
select is((select v#>>'{sources,0,evidence,reason}'from signal_observed371 where k='inspection'),'PRIVATE-CONFLICT-REASON-TEST','authorized purpose-bound inspection reaches the immutable source');
select is((public.get_franchise_governance_signals_v1('d3650000-0000-4000-8000-000000000002',(select(v->>'report_id')::uuid from signal_observed371 where k='snapshot'))#>>'{benchmark,status}'),'INSUFFICIENT_COHORT','Admin comparisons are masked below five distinct peers');
insert into signal_observed371 values('proposal',public.propose_franchise_governance_review_v1((select(v->>'id')::uuid from signal_observed371 where k='request'),'FURTHER_REVIEW_REQUIRED','Examen complémentaire requis sans conclusion de culpabilité','signal371-propose'));
select throws_ok(format($q$select public.approve_franchise_governance_review_v1(%L,'APPROVE','The first reviewer cannot self approve','signal371-self')$q$,(select v->>'proposalId'from signal_observed371 where k='proposal')),'42501','FRANCHISE_GOVERNANCE_SECOND_INDEPENDENT_ADMIN_REQUIRED','one reviewer cannot complete a four-eyes examination alone');
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into signal_observed371 values('approval',public.approve_franchise_governance_review_v1((select(v->>'proposalId')::uuid from signal_observed371 where k='proposal'),'APPROVE','Second regard indépendant sur les mêmes preuves figées','signal371-approve'));
insert into signal_observed371 values('approval-replay',public.approve_franchise_governance_review_v1((select(v->>'proposalId')::uuid from signal_observed371 where k='proposal'),'APPROVE','Second regard indépendant sur les mêmes preuves figées','signal371-approve'));
select is((select v from signal_observed371 where k='approval'),(select v from signal_observed371 where k='approval-replay'),'approval retries preserve the first human decision');
reset role;
select is((select count(*)::integer from public.audit_events where action='franchise.governance.sources_inspected'and resource_id=(select v->>'id'from signal_observed371 where k='request')),1,'the private source read has its own purpose audit');
select is((select status from public.franchises where id='d3650000-0000-4000-8000-000000000002'),'ACTIVE','neither the flag nor the review sanctions or suspends the mandate');
select is((select count(*)::integer from private.franchise_governance_review_followups_v1 followup join public.admin_work_items work on work.resource_id=followup.request_id::text and work.resource_type='franchise_governance_signal_review'where followup.proposal_id=(select(v->>'proposalId')::uuid from signal_observed371 where k='proposal')and work.status='OPEN'),1,'an approved further examination creates one real successor case and task despite retries');
select is((select status from public.admin_work_items where resource_type='franchise_governance_signal_review'and resource_id=(select v->>'id'from signal_observed371 where k='request')),'RESOLVED','the real central review task is completed through Admin workflow commands');
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into signal_observed371 values('run-replay',public.run_franchise_performance_control_v1(25));reset role;
select is((select count(*)::integer from public.franchise_governance_signal_snapshots_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'),3,'scheduled retries do not duplicate native facts or human review requests');
select *from finish();rollback;
