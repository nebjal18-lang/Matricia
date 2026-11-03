begin;
set local search_path=public,extensions;
-- Explicit transaction-only environment for synthetic test scanner verdicts.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configured_at=clock_timestamp(),configuration_reference='ROLLBACK-ONLY-SCANNER-TEST'where singleton;
select plan(146);

-- Transaction-local fiscal approval fixture; never activate the DEMO seed rules.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('f0310000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tax-fixture-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.tax_rule_versions(jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,approved_by,approved_at,validation_reference,content_hash,change_reason)
select jurisdiction_code,category_code,999,rate_basis_points,effective_from,null,'ACTIVE','VALIDATED',rule_type,priority,'{"test_fixture":true}','Transactional automated test approval, not a production tax validation',rounding_strategy,'f0310000-0000-4000-8000-000000000001',now(),'TEST-ONLY-APPROVAL',content_hash,'Hermetic test-only validated fiscal rule fixture'
from public.tax_rule_versions where jurisdiction_code='MA' and professional_validation_status='DEMO' and status='RETIRED';


select has_table('public','provider_reputation_evidence_events','authoritative reputation evidence exists');
select has_table('public','mission_provider_feedback','mission feedback snapshot exists');
select has_column('public','mission_checklist_items','completion_proof_id','checklist completion binds a proof');
select has_column('public','mission_checklist_items','checklist_snapshot_id','checklist item binds the frozen template');
select has_function('public','publish_service_checklist_template',array['uuid','uuid','jsonb','text','text','uuid'],'checklist publication command exists');
select has_function('public','complete_mission_checklist_item',array['uuid','text','uuid','text','uuid'],'checklist execution command exists');
select has_function('public','submit_mission_provider_feedback',array['uuid','integer','integer','integer','jsonb','text','uuid'],'mission feedback command exists');
select has_function('public','refresh_provider_reputation_from_events',array['uuid','uuid','text','text','uuid'],'authoritative reputation refresh exists');
select ok(not has_function_privilege('authenticated','public.calculate_provider_reputation(uuid,uuid,jsonb,jsonb,text,text,uuid)','EXECUTE'),'manual score injection is disabled');
select ok(has_function_privilege('authenticated','public.refresh_provider_reputation_from_events(uuid,uuid,text,text,uuid)','EXECUTE')and not has_function_privilege('anon','public.refresh_provider_reputation_from_events(uuid,uuid,text,text,uuid)','EXECUTE'),'refresh is authenticated only');
select ok((select bool_and(p.prosecdef and p.proconfig::text like'%search_path=pg_catalog%')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('publish_service_checklist_template','complete_mission_checklist_item','submit_mission_provider_feedback','refresh_provider_reputation_from_events')),'commands are security definer with fixed search paths');
select ok(private.valid_published_checklist_items_v1('[{"key":"VERIFY","label_fr":"Vérifier le livrable","label_ar":"التحقق من التسليم","instructions_fr":"Comparer le résultat au périmètre signé.","instructions_ar":"قارن النتيجة بالنطاق الموقع.","proof_required":true,"proof_types":["DOCUMENT"]}]'),'a complete bilingual executable checklist is accepted');
select ok(not private.valid_published_checklist_items_v1('[{"key":"VERIFY","label_fr":"Vérifier","label_ar":"تحقق","proof_required":true,"proof_types":[]}]'),'missing instructions and proof types are rejected');
select ok((select p.prosrc like'%mission_provider_feedback%'and p.prosrc like'%rfq_providers%'and p.prosrc like'%provider_payable_events%'and p.prosrc like'%deliverables%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='refresh_provider_reputation_from_events'),'refresh derives evidence from delivery, feedback, responsiveness and finance sources');
select ok((select p.prosrc like'%ProviderBadgeEvaluationAwaitingHumanReviewV1%'and p.prosrc like'%human_decision_required%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='refresh_provider_reputation_from_events'),'badge recalculation cannot publish without human review');
select ok((select p.prosrc like'%CLEAN_CHECKLIST_PROOF_REQUIRED%'and p.prosrc like'%scan_status=''CLEAN''%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='complete_mission_checklist_item'),'required checklist evidence must be CLEAN and mission-bound');
select col_default_is('public','service_checklist_templates','publication_status','DRAFT','legacy checklist rows are not auto-published');
select ok((select p.prosrc like'%publication_status<>''PUBLISHED''%'and p.prosrc like'%valid_published_checklist_items_v1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='create_mission'),'mission creation requires an executable published checklist');
select ok((select p.prosrc like'%FEEDBACK_SCORE_NOT_AUTHORITATIVE%'and p.prosrc like'%acceptance_checklists%'and p.prosrc like'%mission_checklist_items%'and p.prosrc like'%COMMUNICATION%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='submit_mission_provider_feedback'),'feedback scores are recomputed from authoritative acceptance, checklist and fixed rubric criteria');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('13700000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p137-provider@example.invalid','',now(),'{}','{}',now(),now()),
('13700000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p137-outsider@example.invalid','',now(),'{}','{}',now(),now()),
('13700000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p137-admin@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('13700000-0000-4000-8000-000000000003','COMPLIANCE_MANAGER'),('13700000-0000-4000-8000-000000000003','LIBRARY_MANAGER');
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('13710000-0000-4000-8000-000000000001','P137 Provider','P137 Provider','ACTIVE','13700000-0000-4000-8000-000000000001'),
('13710000-0000-4000-8000-000000000002','P137 Outsider','P137 Outsider','ACTIVE','13700000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status)values
('13720000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000001','13700000-0000-4000-8000-000000000001','ACTIVE'),
('13720000-0000-4000-8000-000000000002','13710000-0000-4000-8000-000000000002','13700000-0000-4000-8000-000000000002','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('13720000-0000-4000-8000-000000000001','PROVIDER_OWNER'),('13720000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.provider_profiles(provider_organization_id,activity_summary,team_size,years_experience,created_by)values('13710000-0000-4000-8000-000000000001','Prestataire fixture P137',2,3,'13700000-0000-4000-8000-000000000001');
insert into public.provider_reputation_evidence_events(id,provider_organization_id,source_type,source_id,dimension,score_basis_points,source_snapshot,content_hash,occurred_at)values('13730000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000001','DELIVERY','13740000-0000-4000-8000-000000000001','QUALITY',9000,'{"source":"fixture"}',repeat('a',64),clock_timestamp());
insert into public.provider_reputation_snapshots(id,provider_organization_id,version_number,policy_version,quality_basis_points,delivery_basis_points,compliance_basis_points,responsiveness_basis_points,satisfaction_basis_points,finance_basis_points,overall_basis_points,evidence_count,explanation,evidence_refs,input_hash,calculated_by,correlation_id)values('13760000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000001',1,'PROVIDER-REPUTATION-V1',9000,9000,9000,9000,9000,9000,9000,6,'{"source":"fixture"}','["13730000-0000-4000-8000-000000000001"]',repeat('b',64),'13700000-0000-4000-8000-000000000003','13750000-0000-4000-8000-000000000001');
insert into public.provider_badge_evaluations(id,provider_organization_id,badge_policy_id,reputation_snapshot_id,evaluation_version,eligible,evaluated_basis_points,explanation,evaluated_by,correlation_id)select'13770000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000001',id,'13760000-0000-4000-8000-000000000001',1,true,9000,'{"human_decision_required":true}','13700000-0000-4000-8000-000000000003','13750000-0000-4000-8000-000000000001'from public.provider_badge_policy_versions order by created_at,id limit 1;

create temporary table p137_observed(key text primary key,value integer);grant select,insert on p137_observed to authenticated;grant usage on schema extensions to authenticated,service_role;grant execute on all functions in schema extensions to authenticated,service_role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p137_observed values('provider_read',(select count(*)from public.provider_reputation_evidence_events));
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p137_observed values('outsider_read',(select count(*)from public.provider_reputation_evidence_events));
select throws_ok($$select public.refresh_provider_reputation_from_events('13710000-0000-4000-8000-000000000001',null,'PROVIDER-REPUTATION-V1','p137-outsider-refresh','13750000-0000-4000-8000-000000000001')$$,'42501'::char(5),'AUTHORITATIVE_REPUTATION_REFRESH_DENIED','tenant user cannot run platform reputation refresh');
reset role;
select is((select value from p137_observed where key='provider_read'),1,'provider reads its own authoritative evidence');
select is((select value from p137_observed where key='outsider_read'),0,'unrelated tenant cannot read provider evidence');
select throws_ok($$update public.provider_reputation_evidence_events set score_basis_points=1 where id='13730000-0000-4000-8000-000000000001'$$,'55000'::char(5),'IMMUTABLE_PROVIDER_REPUTATION_RECORD','authoritative evidence is immutable');
select ok(not has_table_privilege('authenticated','public.provider_reputation_evidence_events','INSERT')and not has_table_privilege('authenticated','public.mission_provider_feedback','UPDATE'),'direct evidence and feedback mutation is denied');
select ok((select count(*)=2 from pg_trigger where tgname in('mission_provider_feedback_immutable_v1','provider_reputation_evidence_immutable_v1')and not tgisinternal),'feedback and evidence histories are immutable');
select ok((select count(*)=2 from pg_policies where schemaname='public'and tablename in('mission_provider_feedback','provider_reputation_evidence_events')),'new sensitive tables have explicit RLS policies');

create temporary table p137_badge(key text primary key,value jsonb);grant select,insert on p137_badge to authenticated;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.decide_provider_badge('13770000-0000-4000-8000-000000000001','PUBLISHED','Revue humaine documentée','p137-badge-publish','13750000-0000-4000-8000-000000000002')$$,'42501'::char(5),'HUMAN_BADGE_DECISION_REQUIRED','AAL1 cannot publish a provider badge');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p137_badge values('first',public.decide_provider_badge('13770000-0000-4000-8000-000000000001','PUBLISHED','Revue humaine documentée','p137-badge-publish','13750000-0000-4000-8000-000000000002'));
insert into p137_badge values('replay',public.decide_provider_badge('13770000-0000-4000-8000-000000000001','PUBLISHED','Revue humaine documentée','p137-badge-publish','13750000-0000-4000-8000-000000000002'));
reset role;
select is((select value->>'outcome'from p137_badge where key='first'),'PROVIDER_BADGE_DECIDED','AAL2 human publishes an eligible badge');
select is((select value from p137_badge where key='replay'),(select value from p137_badge where key='first'),'badge decision replay is returned before mutable transition guards');
select is((select count(*)::integer from public.provider_badge_decisions where evaluation_id='13770000-0000-4000-8000-000000000001'),1,'badge replay creates no duplicate decision');
select is((select count(*)::integer from public.audit_events where resource_type='provider_badge_decision'and resource_id=(select value->>'decision_id'from p137_badge where key='first')),1,'badge decision is audited once');
select is((select count(*)::integer from public.event_outbox where aggregate_type='provider_badge'and aggregate_id='13770000-0000-4000-8000-000000000001'and event_type='ProviderBadgePublishedV1'),1,'badge decision is outboxed once');

-- Self-contained published catalogue: a fresh local database deliberately has
-- no production catalogue seed, so this fixture creates a complete valid tree.
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('137a0000-0000-4000-8000-000000000001','P137_LIBRARY','p137-library','13710000-0000-4000-8000-000000000002','PUBLISHED','13700000-0000-4000-8000-000000000003');
insert into public.catalog_library_versions(id,library_id,version,status,code,slug,name_fr,name_ar,description_fr,description_ar,icon_key,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by,published_at)values('137a0000-0000-4000-8000-000000000002','137a0000-0000-4000-8000-000000000001',1,'PUBLISHED','P137_LIBRARY','p137-library','Bibliothèque P137','مكتبة P137','Fixture réputation','بيانات السمعة','badge-check',1,'Publication fixture P137',repeat('1',64),'APPROVED','13700000-0000-4000-8000-000000000003',clock_timestamp(),repeat('2',64),1,'13700000-0000-4000-8000-000000000003',clock_timestamp());
update public.catalog_libraries set current_published_version_id='137a0000-0000-4000-8000-000000000002'where id='137a0000-0000-4000-8000-000000000001';
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values('137a0000-0000-4000-8000-000000000003','137a0000-0000-4000-8000-000000000001','P137_CATEGORY','p137-category','PUBLISHED','13700000-0000-4000-8000-000000000003');
insert into public.catalog_category_versions(id,category_id,library_id,version,status,code,slug,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by,published_at)values('137a0000-0000-4000-8000-000000000004','137a0000-0000-4000-8000-000000000003','137a0000-0000-4000-8000-000000000001',1,'PUBLISHED','P137_CATEGORY','p137-category','Catégorie P137','فئة P137','Fixture catégorie réputation','فئة اختبار السمعة',1,'Publication fixture P137',repeat('3',64),'APPROVED','13700000-0000-4000-8000-000000000003',clock_timestamp(),repeat('4',64),1,'13700000-0000-4000-8000-000000000003',clock_timestamp());
update public.catalog_categories set current_published_version_id='137a0000-0000-4000-8000-000000000004'where id='137a0000-0000-4000-8000-000000000003';
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values('137a0000-0000-4000-8000-000000000005','137a0000-0000-4000-8000-000000000001','137a0000-0000-4000-8000-000000000003','P137_SUBCATEGORY','p137-subcategory','PUBLISHED','13700000-0000-4000-8000-000000000003');
insert into public.catalog_subcategory_versions(id,subcategory_id,library_id,version,status,category_id,code,slug,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by,published_at)values('137a0000-0000-4000-8000-000000000006','137a0000-0000-4000-8000-000000000005','137a0000-0000-4000-8000-000000000001',1,'PUBLISHED','137a0000-0000-4000-8000-000000000003','P137_SUBCATEGORY','p137-subcategory','Sous-catégorie P137','فئة فرعية P137','Fixture sous-catégorie réputation','فئة فرعية لاختبار السمعة',1,'Publication fixture P137',repeat('5',64),'APPROVED','13700000-0000-4000-8000-000000000003',clock_timestamp(),repeat('6',64),1,'13700000-0000-4000-8000-000000000003',clock_timestamp());
update public.catalog_subcategories set current_published_version_id='137a0000-0000-4000-8000-000000000006'where id='137a0000-0000-4000-8000-000000000005';
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values('137a0000-0000-4000-8000-000000000007','137a0000-0000-4000-8000-000000000001','137a0000-0000-4000-8000-000000000005','P137_SERVICE','p137-service','PUBLISHED','13700000-0000-4000-8000-000000000003');
insert into public.catalog_service_versions(id,service_id,library_id,version,status,primary_subcategory_id,code,slug,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by,published_at)values('137a0000-0000-4000-8000-000000000008','137a0000-0000-4000-8000-000000000007','137a0000-0000-4000-8000-000000000001',1,'PUBLISHED','137a0000-0000-4000-8000-000000000005','P137_SERVICE','p137-service','Service réputation P137','خدمة السمعة P137','Service comportemental','خدمة سلوكية','Service complet de validation réputation','خدمة كاملة للتحقق من السمعة','CONSULTING','mission','مهمة',1,'Publication fixture P137',repeat('7',64),'APPROVED','13700000-0000-4000-8000-000000000003',clock_timestamp(),repeat('8',64),1,'13700000-0000-4000-8000-000000000003',clock_timestamp());
update public.catalog_services set current_published_version_id='137a0000-0000-4000-8000-000000000008'where id='137a0000-0000-4000-8000-000000000007';

create temporary table p137_catalog as select sv.id service_version_id,s.id service_id,s.library_id,l.steward_organization_id from public.catalog_service_versions sv join public.catalog_services s on s.id=sv.service_id and s.current_published_version_id=sv.id join public.catalog_libraries l on l.id=s.library_id where sv.status='PUBLISHED' order by sv.created_at,sv.id limit 1;
create temporary table p137_publish(key text primary key,value jsonb);grant select,insert on p137_catalog,p137_publish to authenticated;
select is((select count(*)::integer from p137_catalog),1,'fixture resolves one current published service version and its authoritative steward');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.publish_service_checklist_template((select steward_organization_id from p137_catalog),(select service_version_id from p137_catalog),'[{"key":"VERIFY_SCOPE","label_fr":"Vérifier le périmètre","label_ar":"التحقق من النطاق","instructions_fr":"Comparer au périmètre contractuel signé.","instructions_ar":"قارن بالنطاق التعاقدي الموقع.","proof_required":true,"proof_types":["DOCUMENT"]}]','Publication comportementale P137','p137-checklist-publish')$$,'42501'::char(5),'CHECKLIST_PUBLISH_DENIED','AAL1 cannot publish a service checklist');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p137_publish values('first',public.publish_service_checklist_template((select steward_organization_id from p137_catalog),(select service_version_id from p137_catalog),'[{"key":"VERIFY_SCOPE","label_fr":"Vérifier le périmètre","label_ar":"التحقق من النطاق","instructions_fr":"Comparer au périmètre contractuel signé.","instructions_ar":"قارن بالنطاق التعاقدي الموقع.","proof_required":true,"proof_types":["DOCUMENT"]}]','Publication comportementale P137','p137-checklist-publish'));
insert into p137_publish values('replay',public.publish_service_checklist_template((select steward_organization_id from p137_catalog),(select service_version_id from p137_catalog),'[{"key":"VERIFY_SCOPE","label_fr":"Vérifier le périmètre","label_ar":"التحقق من النطاق","instructions_fr":"Comparer au périmètre contractuel signé.","instructions_ar":"قارن بالنطاق التعاقدي الموقع.","proof_required":true,"proof_types":["DOCUMENT"]}]','Publication comportementale P137','p137-checklist-publish'));
reset role;
select is((select value->>'outcome'from p137_publish where key='first'),'SERVICE_CHECKLIST_PUBLISHED','AAL2 admin publishes an executable checklist');
select is((select value from p137_publish where key='replay'),(select value from p137_publish where key='first'),'checklist publication replay returns the cached response');
select is((select count(*)::integer from public.service_checklist_templates where id=(select(value->>'template_id')::uuid from p137_publish where key='first')and publication_status='PUBLISHED'and published_by='13700000-0000-4000-8000-000000000003'),1,'published checklist persists once with human publication evidence');
select is((select count(*)::integer from public.audit_events where resource_type='service_checklist_template'and resource_id=(select value->>'template_id'from p137_publish where key='first')),1,'checklist publication audit is emitted once');

-- Complete transactional behavior: a valid RFQ/quote/contract FK graph feeds
-- an existing historical mission, the trusted proof scan gates acceptance, and only derived
-- mission/finance events can refresh reputation and reach human badge review.
insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)
select '13780000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000001',service_id,'DECIDED','13700000-0000-4000-8000-000000000001',clock_timestamp() from p137_catalog;

set local session_replication_role=replica;
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by)
select '13780000-0000-4000-8000-000000000010','13710000-0000-4000-8000-000000000002',library_id,service_id,'CONTRACTED','13700000-0000-4000-8000-000000000002' from p137_catalog;
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
select '13780000-0000-4000-8000-000000000011','13780000-0000-4000-8000-000000000010','13710000-0000-4000-8000-000000000002',library_id,1,'Demande comportementale réputation P137','NORMAL','MAD','{}',true,repeat('1',64),repeat('2',64),'Fixture complète P137',repeat('3',64),'13700000-0000-4000-8000-000000000002' from p137_catalog;
update public.service_requests set current_version_id='13780000-0000-4000-8000-000000000011' where id='13780000-0000-4000-8000-000000000010';
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at)
values('13780000-0000-4000-8000-000000000012','13780000-0000-4000-8000-000000000010','13780000-0000-4000-8000-000000000011','MATCH-V1','COMPLETED',1,'13700000-0000-4000-8000-000000000002',clock_timestamp());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)
values('13780000-0000-4000-8000-000000000013','13780000-0000-4000-8000-000000000012','13710000-0000-4000-8000-000000000001',true,10000,'{"fixture":"P137"}',100);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,version_number,deadline,status,invited_count,opened_by)
values('13780000-0000-4000-8000-000000000014','13780000-0000-4000-8000-000000000010','13780000-0000-4000-8000-000000000011','13780000-0000-4000-8000-000000000012',1,clock_timestamp()+interval'7 days','OPEN',1,'13700000-0000-4000-8000-000000000002');
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,invited_at,responded_at)
values('13780000-0000-4000-8000-000000000015','13780000-0000-4000-8000-000000000014','13710000-0000-4000-8000-000000000001','13780000-0000-4000-8000-000000000013','ACCEPTED',clock_timestamp()-interval'1 hour',clock_timestamp());
insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,current_version_id,selected_version_id,created_by)
values('13780000-0000-4000-8000-000000000016','13780000-0000-4000-8000-000000000014','13780000-0000-4000-8000-000000000015','13710000-0000-4000-8000-000000000001','SELECTED','13780000-0000-4000-8000-000000000017','13780000-0000-4000-8000-000000000017','13700000-0000-4000-8000-000000000001');
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)
values('13780000-0000-4000-8000-000000000017','13780000-0000-4000-8000-000000000016','13780000-0000-4000-8000-000000000014','13710000-0000-4000-8000-000000000001',1,'SUBMITTED','Offre comportementale P137','MAD','Exécution complète P137','[{"key":"D1"}]','Garantie P137','Correction P137',current_date,7,clock_timestamp()+interval'30 days',100000,20000,120000,0,'{}',repeat('4',64),clock_timestamp(),'13700000-0000-4000-8000-000000000001');
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by)
values('13780000-0000-4000-8000-000000000018','13710000-0000-4000-8000-000000000002','13710000-0000-4000-8000-000000000001','ACTIVE',1,'13700000-0000-4000-8000-000000000002');
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
select '13780000-0000-4000-8000-000000000019','13780000-0000-4000-8000-000000000018',1,'13780000-0000-4000-8000-000000000017',jsonb_build_object('service_version_id',service_version_id),'{"quote_version_id":"13780000-0000-4000-8000-000000000017"}','{}',120000,'MAD','{"commission_basis_points":1000}',repeat('5',64),'Contrat comportemental P137','13700000-0000-4000-8000-000000000002' from p137_catalog;
set local session_replication_role=origin;
select is((select count(*)::integer from public.contract_versions cv join public.quote_versions qv on qv.id=cv.selected_quote_version_id join public.quotes q on q.id=qv.quote_id join public.rfq_providers rp on rp.id=q.rfq_provider_id and rp.rfq_id=q.rfq_id and rp.provider_organization_id=q.provider_organization_id join public.rfqs r on r.id=q.rfq_id join public.matching_runs mr on mr.id=r.matching_run_id and mr.request_id=r.request_id join public.service_request_versions srv on srv.id=r.request_version_id and srv.request_id=r.request_id join public.service_requests sr on sr.id=r.request_id join p137_catalog c on c.service_id=sr.service_id and c.library_id=sr.library_id where cv.id='13780000-0000-4000-8000-000000000019'),1,'fixture contract resolves through a complete valid request, matching, RFQ and quote FK graph');

create temporary table p137_flow(key text primary key,value jsonb);grant select,insert on p137_flow to authenticated,service_role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.create_mission(
 '13780000-0000-4000-8000-000000000018','13780000-0000-4000-8000-000000000019',
 '[{"key":"M1","title_fr":"Réception finale","title_ar":"الاستلام النهائي","sort_order":1,"due_at":"2027-01-01T12:00:00Z","owner_organization_id":"13710000-0000-4000-8000-000000000001","validation_required":true}]',
 '[{"key":"D1","label_fr":"Rapport final","label_ar":"التقرير النهائي","proof_required":true}]',
 '[{"deliverable_key":"D1","criterion_key":"QUALITY"}]','p137-flow-mission-create','13790000-0000-4000-8000-000000000001')$$,'55000','CONTRACT_SIGNATURE_NOT_EFFECTIVE_IN_DEPLOYMENT','new admission refuses a legacy ACTIVE contract without native electronic signature evidence');
reset role;
-- Privileged historical fixture: this mission already existed before the native signature gate.
-- It does not claim a new electronic admission or legal signature. No production gate is bypassed.
-- Delivery, proof scan, acceptance, feedback, receipt and financial commands below stay real RPCs.
insert into public.missions(id,contract_id,contract_version_id,client_organization_id,provider_organization_id,status,started_at,created_by,created_at)values('137b0000-0000-4000-8000-000000000001','13780000-0000-4000-8000-000000000018','13780000-0000-4000-8000-000000000019','13710000-0000-4000-8000-000000000002','13710000-0000-4000-8000-000000000001','ACTIVE',clock_timestamp()-interval'30 days','13700000-0000-4000-8000-000000000002',clock_timestamp()-interval'30 days');
insert into public.mission_milestones(id,mission_id,milestone_key,title_fr,title_ar,sort_order,due_at,owner_organization_id,validation_required)values('137b0000-0000-4000-8000-000000000002','137b0000-0000-4000-8000-000000000001','M1','Réception finale','الاستلام النهائي',1,'2027-01-01T12:00:00Z','13710000-0000-4000-8000-000000000001',true);
insert into public.deliverables(id,mission_id,milestone_id,deliverable_key,label_fr,label_ar,proof_required)values('137b0000-0000-4000-8000-000000000003','137b0000-0000-4000-8000-000000000001','137b0000-0000-4000-8000-000000000002','D1','Rapport final','التقرير النهائي',true);
insert into public.acceptance_checklists(mission_id,deliverable_id,criterion_key)values('137b0000-0000-4000-8000-000000000001','137b0000-0000-4000-8000-000000000003','QUALITY');
insert into public.mission_checklist_snapshots(id,mission_id,service_checklist_template_id,service_version_id,template_version,template_content_hash,items,created_by)select'137b0000-0000-4000-8000-000000000004','137b0000-0000-4000-8000-000000000001',t.id,t.service_version_id,t.version,t.content_hash,t.items,'13700000-0000-4000-8000-000000000002'from public.service_checklist_templates t where id=(select(value->>'template_id')::uuid from p137_publish where key='first');
insert into public.mission_checklist_items(mission_id,item_key,label_fr,label_ar)values('137b0000-0000-4000-8000-000000000001','VERIFY_SCOPE','Historical snapshot binding','ربط النسخة التاريخية');
insert into p137_flow values('mission',jsonb_build_object('outcome','HISTORICAL_MISSION_FIXTURE','mission_id','137b0000-0000-4000-8000-000000000001'));
create temporary table p137_ids as select
 (select(value->>'mission_id')::uuid from p137_flow where key='mission') mission_id,
 (select d.id from public.deliverables d where d.mission_id=(select(value->>'mission_id')::uuid from p137_flow where key='mission')and d.deliverable_key='D1') deliverable_id,
 (select mm.id from public.mission_milestones mm where mm.mission_id=(select(value->>'mission_id')::uuid from p137_flow where key='mission')and mm.milestone_key='M1') milestone_id,
 (select ci.id from public.mission_checklist_items ci where ci.mission_id=(select(value->>'mission_id')::uuid from p137_flow where key='mission')and ci.item_key='VERIFY_SCOPE') checklist_item_id;
update public.deliverables d set milestone_id=i.milestone_id from p137_ids i where d.id=i.deliverable_id;
grant select on p137_ids to authenticated,service_role;
select is((select value->>'outcome'from p137_flow where key='mission'),'HISTORICAL_MISSION_FIXTURE','existing historical mission is an explicit precondition, without native electronic admission claim');
select ok((select count(*)=1 from public.mission_checklist_snapshots s join public.mission_checklist_items i on i.checklist_snapshot_id=s.id join p137_ids x on x.mission_id=s.mission_id where i.id=x.checklist_item_id and i.proof_required and i.allowed_proof_types=array['DOCUMENT']::text[]),'mission freezes one executable published checklist item');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into storage.objects(bucket_id,name,owner_id,metadata)select'delivery-proofs','13700000-0000-4000-8000-000000000001/'||deliverable_id::text||'/p137-flow.pdf','13700000-0000-4000-8000-000000000001','{"mimetype":"application/pdf"}' from p137_ids;
insert into p137_flow select'delivery',public.submit_delivery(deliverable_id,'Rapport final vérifiable','[]',jsonb_build_array(jsonb_build_object('type','DOCUMENT','storage_path','13700000-0000-4000-8000-000000000001/'||deliverable_id::text||'/p137-flow.pdf','evidence_hash',repeat('c',64),'metadata',jsonb_build_object('mime_type','application/pdf'))),'p137-flow-delivery-submit','13790000-0000-4000-8000-000000000002')from p137_ids;
insert into p137_flow select'milestone-submit',public.submit_mission_milestone(milestone_id,1,'p137-flow-milestone-submit','13790000-0000-4000-8000-000000000003')from p137_ids;
reset role;
alter table p137_ids add column proof_id uuid;
update p137_ids x set proof_id=p.id from public.delivery_proofs p join public.delivery_versions v on v.id=p.delivery_version_id where v.deliverable_id=x.deliverable_id and v.version=1;
select is((select value->>'outcome'from p137_flow where key='delivery'),'DELIVERY_SUBMITTED','provider submits a storage-bound delivery proof');
select is((select value->>'outcome'from p137_flow where key='milestone-submit'),'MILESTONE_SUBMITTED','provider submits the governed milestone');

set local role service_role;select set_config('request.jwt.claims','{"role":"service_role","aal":"aal2"}',true);
create temporary table p137_scan_claim on commit drop as select c.* from public.claim_delivery_proof_scan_jobs('13790000-0000-4000-8000-000000000010',2,300)c join p137_ids i on i.proof_id=c.proof_id;
select is((select count(*)::integer from p137_scan_claim),1,'trusted scanner claims the pending proof once');
insert into p137_flow select'scan',public.complete_delivery_proof_scan_job(i.proof_id,c.lease_token,c.worker_id,c.row_version,'CLEAN','TEST_AV','1.0',repeat('c',64),'p137-flow-scan-clean','13790000-0000-4000-8000-000000000004')from p137_scan_claim c join p137_ids i on i.proof_id=c.proof_id;
reset role;
select is((select value->>'result'from p137_flow where key='scan'),'CLEAN','trusted scanner records the clean verdict');
select is((select p.scan_status from public.delivery_proofs p join p137_ids i on i.proof_id=p.id),'CLEAN','clean verdict is projected on the immutable proof');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'checklist',public.complete_mission_checklist_item(checklist_item_id,'PENDING',proof_id,'p137-flow-checklist-complete','13790000-0000-4000-8000-000000000005')from p137_ids;
insert into p137_flow select'checklist-replay',public.complete_mission_checklist_item(checklist_item_id,'PENDING',proof_id,'p137-flow-checklist-complete','13790000-0000-4000-8000-000000000005')from p137_ids;
reset role;
select is((select value->>'outcome'from p137_flow where key='checklist'),'MISSION_CHECKLIST_ITEM_COMPLETED','provider completes the snapshotted checklist with the clean proof');
select is((select value from p137_flow where key='checklist-replay'),(select value from p137_flow where key='checklist'),'checklist completion replay is cached before the mutable guard');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'accept',public.accept_delivery(deliverable_id,'[{"criterion_key":"QUALITY","status":"COMPLIANT","comment":"Conforme au contrat","evidence":[]}]','p137-flow-delivery-accept','13790000-0000-4000-8000-000000000006')from p137_ids;
insert into p137_flow select'accept-replay',public.accept_delivery(deliverable_id,'[{"criterion_key":"QUALITY","status":"COMPLIANT","comment":"Conforme au contrat","evidence":[]}]','p137-flow-delivery-accept','13790000-0000-4000-8000-000000000006')from p137_ids;
insert into p137_flow select'milestone-accept',public.decide_mission_milestone(milestone_id,2,'ACCEPTED','Réception client documentée','p137-flow-milestone-accept','13790000-0000-4000-8000-000000000007')from p137_ids;
reset role;
select is((select value->>'outcome'from p137_flow where key='accept'),'DELIVERY_ACCEPTED','client accepts only after proof and checklist completion');
select is((select value from p137_flow where key='accept-replay'),(select value from p137_flow where key='accept'),'delivery acceptance replay is cached after the state transition');
select is((select value->>'outcome'from p137_flow where key='milestone-accept'),'MILESTONE_ACCEPTED','client accepts the milestone after its delivery');
select is((select m.status from public.missions m join p137_ids i on i.mission_id=m.id),'COMPLETED','accepted delivery completes the mission');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'receipt-upload',public.begin_provider_receipt_proof_upload('13710000-0000-4000-8000-000000000001','p137-receipt.pdf','application/pdf',20,repeat('d',64),'p137-receipt-reserve');
insert into storage.objects(bucket_id,name,owner_id,metadata)select'provider-qualification',value->>'storage_object_path','13700000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":20}'from p137_flow where key='receipt-upload';
select throws_ok($$select public.record_provider_payable_event(mission_id,'CLIENT_RECEIPT_CONFIRMED',current_date,'MAD',120000,'P137-RECEIPT',repeat('d',64),'p137-flow-payable','13790000-0000-4000-8000-000000000008')from p137_ids$$,'55000','RECEIPT_PROOF_SCAN_NOT_CLEAN','a receipt hash does not record money before trusted CLEAN');
reset role;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.record_provider_payment_proof_scan_result((value->>'upload_id')::uuid,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('d',64),'p137-receipt-clean')from p137_flow where key='receipt-upload';
reset role;set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'payable',public.record_provider_payable_event(mission_id,'CLIENT_RECEIPT_CONFIRMED',current_date,'MAD',120000,'P137-RECEIPT',repeat('d',64),'p137-flow-payable','13790000-0000-4000-8000-000000000008')from p137_ids;
reset role;
select is((select value->>'outcome'from p137_flow where key='payable'),'PROVIDER_PAYABLE_RECORDED','provider finance event is recorded through the governed exact-money command');
select ok((select p.scan_result_id is not null and p.sha256=repeat('d',64)and p.payable_event_id=(f.value->>'payable_event_id')::uuid from public.provider_payable_event_proofs p join p137_flow f on f.key='payable'where p.id=(f.value->>'receipt_proof_id')::uuid),'actual receipt object and immutable CLEAN scan bind to the financial event');
set local role authenticated;
select is((select public.record_provider_payable_event(mission_id,'CLIENT_RECEIPT_CONFIRMED',current_date,'MAD',120000,'P137-RECEIPT',repeat('d',64),'p137-flow-payable','13790000-0000-4000-8000-000000000008')from p137_ids),(select value from p137_flow where key='payable'),'receipt command replay returns the same financial event and same archived proof');
reset role;


-- Finance governance and actual Provider issuance share the approved issuer and numbering registry.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('13700000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000000','authenticated','authenticated','p137-finance-policy@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('13700000-0000-4000-8000-000000000003','FINANCE_MANAGER'),('13700000-0000-4000-8000-000000000004','FINANCE_MANAGER');
select throws_ok($$select public.issue_provider_statement('13710000-0000-4000-8000-000000000001','P137-STATEMENT',current_date,current_date,'MAD','p137-policy-statement')$$,'55000','BILLING_POLICY_REQUIRED','missing approved issuer blocks financial document issuance before irreversible source creation');
select is((select count(*)from public.provider_statements where provider_organization_id='13710000-0000-4000-8000-000000000001'),0::bigint,'failed legal-policy gate leaves no issued statement');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'policy',public.create_client_billing_policy_v1(jsonb_build_object('series_key','TEST_PROVIDER_BILLING_137','version',1,'currency','MAD','tax_rate_bps',700,'tax_label_fr','Taxe abonnement test','tax_label_ar','ضريبة اشتراك اختبار','jurisdiction','MA-TEST','issuer',jsonb_build_object('legal_name','Émetteur test uniquement 137','legal_form','SARL','address','Adresse recette 137','ice','999000000000137','if_number','99900137','rc_number','TEST-RC-137','contact_email','fiscal137@example.invalid'),'invoice_prefix','PI137','credit_prefix','PC137','invoice_start_number','41','credit_start_number','501','valid_from',(current_date-1)::text,'service_label_fr','Abonnement test','service_label_ar','اشتراك اختبار','approval_reference','TEST-NO-REAL-APPROVAL-137'),'p137-policy-create');
select throws_ok($$select public.approve_client_billing_policy_v1((select(value->>'policy_id')::uuid from p137_flow where key='policy'),true,'Test independent review','p137-policy-self')$$,'42501','FOUR_EYES_REQUIRED','issuer creator cannot approve their own fiscal configuration');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select public.approve_client_billing_policy_v1((value->>'policy_id')::uuid,true,'Independent test fiscal review','p137-policy-approve')from p137_flow where key='policy';
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
-- Historical contract recipient attestation: upload, trusted synthetic scanner, compliance review,
-- then a separate Finance requester/approver. No legal production approval is inferred.
do $$declare upload jsonb;doc jsonb;job uuid;review jsonb;begin
 upload:=public.begin_provider_document_upload('13710000-0000-4000-8000-000000000001','application/pdf',20);
 insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',upload->>'storage_object_path','13700000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":20}');
 doc:=public.record_provider_document_version('13710000-0000-4000-8000-000000000001','LEGAL','P137_CONTRACT_RECIPIENT',jsonb_build_object('issued_on',current_date::text,'expires_on',(current_date+365)::text,'storage_object_path',upload->>'storage_object_path','content_hash',repeat('d',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Synthetic historical recipient evidence','p137-recipient-doc');
 select id into job from public.provider_document_scan_jobs where document_version_id=(doc->>'document_version_id')::uuid;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.record_provider_document_scan_result(job,'CLEAN','SQL_FIXTURE_SCANNER','test-only',repeat('d',64),'p137-recipient-scan');
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
 doc:=public.review_provider_document((doc->>'document_version_id')::uuid,'VERIFIED','Synthetic independent evidence review','TEST-ONLY','p137-recipient-doc-review');
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
 review:=public.request_provider_billing_recipient_review_v1('13780000-0000-4000-8000-000000000019',repeat('5',64),'{"legal_name":"Prestataire contractuel test 137","country_code":"MA","identifiers":{"ICE":"999000000000138","IF":"99900138","RC":"TEST-RC-138"},"registered_address":"Adresse contractuelle test 137"}',(doc->>'document_version_id')::uuid,'Historical recipient synthetic evidence','137f0000-0000-4000-8000-000000000001');
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_provider_billing_recipient_review_v1((review->>'review_id')::uuid,(select content_hash from public.provider_billing_contract_recipient_reviews where id=(review->>'review_id')::uuid),true,'Independent synthetic recipient approval');
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
end$$;
insert into p137_flow select'statement',public.issue_provider_statement('13710000-0000-4000-8000-000000000001','P137-STATEMENT',current_date,current_date,'MAD','p137-policy-statement');
select is((select value->>'document_status'from p137_flow where key='statement'),'EDITION_PENDING','recorded commission statement waits for actual archived translations');
insert into public.financial_accounts(id,organization_id,code,name,account_type,currency)values
('137a0000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000001','P137_AR','Test receivable','ASSET','MAD'),
('137a0000-0000-4000-8000-000000000002','13710000-0000-4000-8000-000000000001','P137_REV','Test revenue','REVENUE','MAD'),
('137a0000-0000-4000-8000-000000000003','13710000-0000-4000-8000-000000000001','P137_TAX','Test tax','LIABILITY','MAD');
select throws_ok($$select public.issue_provider_invoice((select(value->>'statement_id')::uuid from p137_flow where key='statement'),'MANUAL-42',current_date,current_date+30,'137a0000-0000-4000-8000-000000000001','137a0000-0000-4000-8000-000000000002','137a0000-0000-4000-8000-000000000003','p137-policy-invoice')$$,'22023','GOVERNED_INVOICE_NUMBER_REQUIRED','manual numbering cannot escape the approved issuer series');
insert into p137_flow select'invoice',public.issue_provider_invoice((value->>'statement_id')::uuid,'AUTO',current_date,current_date+30,'137a0000-0000-4000-8000-000000000001','137a0000-0000-4000-8000-000000000002','137a0000-0000-4000-8000-000000000003','p137-policy-invoice')from p137_flow where key='statement';
select is((select value->>'invoice_number'from p137_flow where key='invoice'),'PI137-'||extract(year from current_date)::text||'-00000041','actual commission invoice uses the approved shared counter');
select is(public.issue_provider_invoice((select(value->>'statement_id')::uuid from p137_flow where key='statement'),'AUTO',current_date,current_date+30,'137a0000-0000-4000-8000-000000000001','137a0000-0000-4000-8000-000000000002','137a0000-0000-4000-8000-000000000003','p137-policy-invoice'),(select value from p137_flow where key='invoice'),'invoice replay returns the same source without allocating another number');
select is(private.allocate_billing_document_number_v1((select(value->>'policy_id')::uuid from p137_flow where key='policy'),'INVOICE',current_date),'PI137-'||extract(year from current_date)::text||'-00000042','the common issuer allocator advances across domains instead of restarting a Provider-only series');
select ok((select tax_minor=2400 and total_minor=14400 from public.provider_invoices where id=(select(value->>'invoice_id')::uuid from p137_flow where key='invoice')),'commission retains its own authoritative 20 percent tax rather than the subscription policy 7 percent');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p137_flow select'frozen-policy',public.get_provider_billing_source_policy('invoice',(value->>'invoice_id')::uuid)from p137_flow where key='invoice';
select is((select value#>>'{issuer_snapshot,legal_name}'from p137_flow where key='frozen-policy'),'Émetteur test uniquement 137','source binds the approved legal issuer snapshot');
select throws_ok($$select public.complete_provider_billing_document_issue('invoice',(select(value->>'invoice_id')::uuid from p137_flow where key='invoice'))$$,'55000','BILLING_TRANSLATIONS_NOT_ARCHIVED','source alone cannot emit the delivery-ready notification');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.get_provider_billing_document_states('13710000-0000-4000-8000-000000000001','invoice',array[(select(value->>'invoice_id')::uuid from p137_flow where key='invoice')])->0->>'status','EDITION_PENDING','UI receives an honest pending edition until approved PDF files exist');

select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p137_flow select'pdf-snapshot',jsonb_build_object('policyBindingId',p.value->>'policy_binding_id','policyContentHash',p.value->>'content_hash','number',p.value->>'document_number','issuedOn',p.value->>'document_issued_on','sourceHash',p.value->>'source_hash','kind','invoice','currency','MAD','totalMinor','14400','lines',jsonb_build_array(jsonb_build_object('label','Commission test','amountMinor','12000'),jsonb_build_object('label','Tax test','amountMinor','2400')),'recipient',p.value#>>'{recipient_snapshot,legal_name}','recipientDetails',jsonb_build_array(p.value#>>'{recipient_snapshot,registered_address}','ICE: '||(p.value#>>'{recipient_snapshot,identifiers,ICE}'),'IF: '||(p.value#>>'{recipient_snapshot,identifiers,IF}'),'RC: '||(p.value#>>'{recipient_snapshot,identifiers,RC}'),p.value#>>'{recipient_snapshot,country_code}'),'issuer',jsonb_build_object('name',p.value#>>'{issuer_snapshot,legal_name}','address',p.value#>>'{issuer_snapshot,address}','ice',p.value#>>'{issuer_snapshot,ice}','version',p.value->>'version','legalForm',p.value#>>'{issuer_snapshot,legal_form}','ifNumber',p.value#>>'{issuer_snapshot,if_number}','rcNumber',p.value#>>'{issuer_snapshot,rc_number}','contactEmail',p.value#>>'{issuer_snapshot,contact_email}'))from p137_flow p where p.key='frozen-policy';
select throws_ok($$select public.register_provider_billing_document_artifact('13710000-0000-4000-8000-000000000001','invoice',(select(value->>'invoice_id')::uuid from p137_flow where key='invoice'),'fr',(select value->>'source_hash'from p137_flow where key='frozen-policy'),repeat('e',64),'irrelevant-path.pdf',jsonb_set((select value from p137_flow where key='pdf-snapshot'),'{issuer,name}','"Forged issuer"'),'13700000-0000-4000-8000-000000000001')$$,'55000','BILLING_ARTIFACT_APPROVED_POLICY_REQUIRED','renderer cannot archive a different issuer even with the correct source hash');
select throws_ok($$select public.register_provider_billing_document_artifact('13710000-0000-4000-8000-000000000001','invoice',(select(value->>'invoice_id')::uuid from p137_flow where key='invoice'),'fr',(select value->>'source_hash'from p137_flow where key='frozen-policy'),repeat('e',64),'irrelevant-path.pdf',jsonb_set((select value from p137_flow where key='pdf-snapshot'),'{recipientDetails,0}','"Wrong substituted address"'),'13700000-0000-4000-8000-000000000001')$$,'22000','BILLING_ARTIFACT_RECIPIENT_IDENTITY_MISMATCH','archive refuses substituted contractual address or identifiers even with matching recipient name');
insert into storage.objects(bucket_id,name,metadata)select'provider-billing','13710000-0000-4000-8000-000000000001/invoice/'||(value->>'invoice_id')||'/fr/'||repeat('e',64)||'.pdf','{"mimetype":"application/pdf","size":100}'from p137_flow where key='invoice';
insert into p137_flow select'pdf-fr',public.register_provider_billing_document_artifact('13710000-0000-4000-8000-000000000001','invoice',(i.value->>'invoice_id')::uuid,'fr',p.value->>'source_hash',repeat('e',64),'13710000-0000-4000-8000-000000000001/invoice/'||(i.value->>'invoice_id')||'/fr/'||repeat('e',64)||'.pdf',s.value,'13700000-0000-4000-8000-000000000001')from p137_flow i cross join p137_flow p cross join p137_flow s where i.key='invoice'and p.key='frozen-policy'and s.key='pdf-snapshot';
select throws_ok($$select public.complete_provider_billing_document_issue('invoice',(select(value->>'invoice_id')::uuid from p137_flow where key='invoice'))$$,'55000','BILLING_TRANSLATIONS_NOT_ARCHIVED','one archived language does not claim both translations are ready');
insert into storage.objects(bucket_id,name,metadata)select'provider-billing','13710000-0000-4000-8000-000000000001/invoice/'||(value->>'invoice_id')||'/ar/'||repeat('f',64)||'.pdf','{"mimetype":"application/pdf","size":100}'from p137_flow where key='invoice';
insert into p137_flow select'pdf-ar',public.register_provider_billing_document_artifact('13710000-0000-4000-8000-000000000001','invoice',(i.value->>'invoice_id')::uuid,'ar',p.value->>'source_hash',repeat('f',64),'13710000-0000-4000-8000-000000000001/invoice/'||(i.value->>'invoice_id')||'/ar/'||repeat('f',64)||'.pdf',s.value,'13700000-0000-4000-8000-000000000001')from p137_flow i cross join p137_flow p cross join p137_flow s where i.key='invoice'and p.key='frozen-policy'and s.key='pdf-snapshot';
select is(public.complete_provider_billing_document_issue('invoice',(select(value->>'invoice_id')::uuid from p137_flow where key='invoice'))->>'outcome','PROVIDER_BILLING_DOCUMENTS_READY','actual bound translations permit durable notification readiness');
select public.complete_provider_billing_document_issue('invoice',(value->>'invoice_id')::uuid)from p137_flow where key='invoice';
select is((select count(*)from public.event_outbox where event_type='ProviderBillingDocumentsReadyV1'and aggregate_id=(select value->>'invoice_id'from p137_flow where key='invoice')),1::bigint,'readiness replay creates one durable event per approved edition');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.get_provider_billing_document_states('13710000-0000-4000-8000-000000000001','invoice',array[(select(value->>'invoice_id')::uuid from p137_flow where key='invoice')])->0->>'status','READY','UI readiness is derived from the approved edition files');

-- Four partial credits reproduce the original tax through cumulative rounding, including the last cent.
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.issue_provider_credit_note((select(value->>'invoice_id')::uuid from p137_flow where key='invoice'),'MANUAL-CREDIT',current_date,1,99999,'Partial credit governed test','p137-credit-manual')$$,'22023','GOVERNED_CREDIT_NUMBER_REQUIRED','credit notes also require the approved common numbering series');
insert into p137_flow select'credit-1',public.issue_provider_credit_note((value->>'invoice_id')::uuid,'AUTO',current_date,1,99999,'Partial credit governed test','p137-credit-round-1')from p137_flow where key='invoice';
insert into p137_flow select'credit-2',public.issue_provider_credit_note((value->>'invoice_id')::uuid,'AUTO',current_date,1,99999,'Partial credit governed test','p137-credit-round-2')from p137_flow where key='invoice';
insert into p137_flow select'credit-3',public.issue_provider_credit_note((value->>'invoice_id')::uuid,'AUTO',current_date,1,99999,'Partial credit governed test','p137-credit-round-3')from p137_flow where key='invoice';
insert into p137_flow select'credit-final',public.issue_provider_credit_note((value->>'invoice_id')::uuid,'AUTO',current_date,11997,99999,'Final credit governed test','p137-credit-round-final')from p137_flow where key='invoice';
select is((select value->>'credit_number'from p137_flow where key='credit-1'),'PC137-'||extract(year from current_date)::text||'-00000501','credit starts at the independent approved credit sequence');
select is((select value->>'tax_minor'from p137_flow where key='credit-3'),'1','third small partial credit carries the cumulative tax cent');
select ok((select sum(subtotal_minor)=12000 and sum(tax_minor)=2400 and sum(total_minor)=14400 from public.provider_credit_notes where invoice_id=(select(value->>'invoice_id')::uuid from p137_flow where key='invoice')),'full credits reproduce original net, tax and gross exactly');
select is(public.issue_provider_credit_note((select(value->>'invoice_id')::uuid from p137_flow where key='invoice'),'AUTO',current_date,11997,0,'Final credit governed test','p137-credit-round-final'),(select value from p137_flow where key='credit-final'),'completed full credit replays before mutable remaining-balance guards');
select throws_ok($$select public.issue_provider_credit_note((select(value->>'invoice_id')::uuid from p137_flow where key='invoice'),'AUTO',current_date,1,0,'Excess credit must be refused','p137-credit-exceeds')$$,'23514','CREDIT_NOTE_EXCEEDS_INVOICE','a new key cannot credit beyond the original invoice');
select is((select sum(case e.direction when'DEBIT'then e.amount_minor else-e.amount_minor end)from public.financial_entries e join public.provider_credit_notes n on n.journal_id=e.journal_id where n.invoice_id=(select(value->>'invoice_id')::uuid from p137_flow where key='invoice')),0::numeric,'all credit journals remain balanced');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.get_provider_billing_source_policy('credit_note',(select(value->>'credit_note_id')::uuid from p137_flow where key='credit-1'))->>'original_invoice_number',(select value->>'invoice_number'from p137_flow where key='invoice'),'credit PDF refers to the original invoice and frozen issuer policy');
select throws_ok($$select public.complete_provider_billing_document_issue('credit_note',(select(value->>'credit_note_id')::uuid from p137_flow where key='credit-1'))$$,'55000','BILLING_TRANSLATIONS_NOT_ARCHIVED','credit financial issuance is distinct from actual PDF readiness');

insert into p137_flow select'credit-policy',public.get_provider_billing_source_policy('credit_note',(value->>'credit_note_id')::uuid)from p137_flow where key='credit-1';
insert into p137_flow select'credit-pdf-snapshot',s.value||jsonb_build_object('kind','credit_note','policyBindingId',p.value->>'policy_binding_id','policyContentHash',p.value->>'content_hash','sourceHash',p.value->>'source_hash','number',p.value->>'document_number','issuedOn',p.value->>'document_issued_on','originalInvoiceNumber',p.value->>'original_invoice_number','totalMinor','1','lines',jsonb_build_array(jsonb_build_object('label','Net credit test','amountMinor','1'),jsonb_build_object('label','Tax credit test','amountMinor','0')))from p137_flow s cross join p137_flow p where s.key='pdf-snapshot'and p.key='credit-policy';
select throws_ok($$select public.register_provider_billing_document_artifact('13710000-0000-4000-8000-000000000001','credit_note',(select(value->>'credit_note_id')::uuid from p137_flow where key='credit-1'),'fr',(select value->>'source_hash'from p137_flow where key='credit-policy'),repeat('c',64),'irrelevant.pdf',jsonb_set((select value from p137_flow where key='credit-pdf-snapshot'),'{originalInvoiceNumber}','"WRONG-ORIGIN"'),'13700000-0000-4000-8000-000000000003')$$,'22000','BILLING_CREDIT_ORIGINAL_REFERENCE_MISMATCH','credit edition cannot refer to a different original invoice');
do $$declare language text;note uuid;policy jsonb;snapshot jsonb;path text;r jsonb;begin
 select(value->>'credit_note_id')::uuid into note from p137_flow where key='credit-1';select value into policy from p137_flow where key='credit-policy';select value into snapshot from p137_flow where key='credit-pdf-snapshot';
 foreach language in array array['fr','ar']loop
  path:='13710000-0000-4000-8000-000000000001/credit_note/'||note::text||'/'||language||'/'||repeat('c',64)||'.pdf';
  insert into storage.objects(bucket_id,name,metadata)values('provider-billing',path,'{"mimetype":"application/pdf","size":100}');
  r:=public.register_provider_billing_document_artifact('13710000-0000-4000-8000-000000000001','credit_note',note,language,policy->>'source_hash',repeat('c',64),path,snapshot,'13700000-0000-4000-8000-000000000003');
 end loop;
end$$;
insert into p137_flow select'credit-ready',public.complete_provider_billing_document_issue('credit_note',(value->>'credit_note_id')::uuid)from p137_flow where key='credit-1';
select is((select value->>'outcome'from p137_flow where key='credit-ready'),'PROVIDER_BILLING_DOCUMENTS_READY','both approved credit translations complete the same durable PDF pipeline');
select is(public.enqueue_provider_billing_pdf_notification((select(value->>'artifact_id')::uuid from p137_flow where key='credit-ready'))->>'outcome','NOTIFICATION_ENQUEUED','credit PDF enters the same consent-aware delivery queue');

-- Reproduce a historical issued invoice with an incorrect immutable recipient.
-- Only this historical bootstrap uses the revoked mature core; application callers cannot.
-- All subsequent requests, four-eyes approval, credits and reissuance use public governed RPCs.
do $$declare upload jsonb;event jsonb;statement jsonb;inv jsonb;policy jsonb;source public.provider_invoices%rowtype;payment jsonb;begin
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 upload:=public.begin_provider_receipt_proof_upload('13710000-0000-4000-8000-000000000001','historical-receipt.pdf','application/pdf',20,repeat('9',64),'p137-correction-receipt');
 insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',upload->>'storage_object_path','13700000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":20}');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.record_provider_payment_proof_scan_result((upload->>'upload_id')::uuid,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('9',64),'p137-correction-receipt-scan');
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 event:=public.record_provider_payable_event((select mission_id from p137_ids),'ADJUSTMENT',current_date,'MAD',30000,'P137-HISTORICAL-RECEIPT',repeat('9',64),'p137-correction-payable');
 statement:=public.issue_provider_statement_pre_policy_v1('13710000-0000-4000-8000-000000000001','P137-HISTORICAL',current_date,current_date,'MAD','p137-historical-statement');
 inv:=public.issue_provider_invoice_pre_policy_v1((statement->>'statement_id')::uuid,'TEST-HISTORICAL-P137',current_date,current_date+45,'137a0000-0000-4000-8000-000000000001','137a0000-0000-4000-8000-000000000002','137a0000-0000-4000-8000-000000000003','p137-historical-invoice');
 select*into source from public.provider_invoices where id=(inv->>'invoice_id')::uuid;
 policy:=private.approved_billing_policy_snapshot('MAD',current_date)||jsonb_build_object('recipient_snapshot','{"legal_name":"Wrong historical recipient TEST ONLY","country_code":"MA","identifiers":{"ICE":"999000000000139","IF":"99900139","RC":"TEST-RC-139"},"registered_address":"Wrong historical TEST address"}'::jsonb);
 insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(source.provider_organization_id,'invoice',source.id,source.document_hash,(policy->>'policy_id')::uuid,policy,source.invoice_number,current_date,auth.uid());
 insert into p137_flow values('correction-original',to_jsonb(source));
 insert into public.provider_billing_document_artifacts(provider_organization_id,kind,source_id,locale,source_hash,pdf_sha256,storage_path,snapshot,created_by,policy_binding_id)select source.provider_organization_id,'invoice',source.id,'fr',source.document_hash,repeat('8',64),source.provider_organization_id||'/invoice/'||source.id||'/fr/'||repeat('8',64)||'.pdf','{"historical_test_precondition":true}',auth.uid(),id from public.provider_billing_source_policy_bindings where kind='invoice'and source_id=source.id;
 insert into public.financial_accounts(id,organization_id,code,name,account_type,currency)values('137a0000-0000-4000-8000-000000000004',source.provider_organization_id,'P137_CASH','TEST cash','ASSET','MAD');
 upload:=public.begin_provider_payment_proof_upload(source.provider_organization_id,'payment.pdf','application/pdf',20,repeat('7',64),'p137-correction-payment-proof');
 insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',upload->>'storage_object_path',auth.uid()::text,'{"mimetype":"application/pdf","size":20}');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.record_provider_payment_proof_scan_result((upload->>'upload_id')::uuid,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('7',64),'p137-correction-payment-scan');
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 payment:=public.record_provider_payment(source.provider_organization_id,'P137-CORRECTION-PAID',current_date,'BANK_TRANSFER','MAD',source.total_minor,repeat('7',64),'137a0000-0000-4000-8000-000000000004','137a0000-0000-4000-8000-000000000001','p137-correction-payment');
 perform public.reconcile_provider_payment((payment->>'payment_id')::uuid,jsonb_build_array(jsonb_build_object('invoice_id',source.id,'amount_minor',source.total_minor::text)),'p137-correction-allocation');
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
 insert into p137_flow values('correction-source',private.provider_recipient_correction_source_v1(source.id));
 insert into p137_flow select'correction-request',public.request_provider_invoice_recipient_correction_v1(source.id,private.canonical_request_hash(value),current_date,current_date+45,true,'TEST correct historical recipient by cancellation and new issue','137f0000-0000-4000-8000-000000000002')from p137_flow where key='correction-source';
end$$;
select throws_ok($$select public.decide_provider_invoice_recipient_correction_v1((select(value->>'request_id')::uuid from p137_flow where key='correction-request'),private.canonical_request_hash((select value from p137_flow where key='correction-source')),true,'TEST cannot approve own request')$$,'42501','FOUR_EYES_REQUIRED','historical invoice correction requires an independent approver');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.decide_provider_invoice_recipient_correction_v1((select(value->>'request_id')::uuid from p137_flow where key='correction-request'),repeat('0',64),true,'TEST stale checkpoint denied')$$,'40001','BILLING_RECIPIENT_CORRECTION_SOURCE_CHANGED','recipient correction compares immutable reviewed source checkpoint');
insert into p137_flow select'correction-complete',public.decide_provider_invoice_recipient_correction_v1((select(value->>'request_id')::uuid from p137_flow where key='correction-request'),private.canonical_request_hash(value),true,'TEST independent cancellation and new issue approved')from p137_flow where key='correction-source';
select is((select value->>'outcome'from p137_flow where key='correction-complete'),'PROVIDER_INVOICE_RECIPIENT_CORRECTED','independent decision performs actual credit and new numbered invoice');
select is((select to_jsonb(i)from public.provider_invoices i where i.id=(select(value->>'id')::uuid from p137_flow where key='correction-original')),(select value from p137_flow where key='correction-original'),'original invoice including identity-independent hash and number remains byte-for-byte immutable');
select ok((select replacement_invoice_number<> 'TEST-HISTORICAL-P137'from jsonb_to_record((select value from p137_flow where key='correction-complete'))as x(replacement_invoice_number text)),'corrective invoice has a new approved series number');
select is((select count(*)from public.provider_billing_document_artifacts where source_id=(select(value->>'id')::uuid from p137_flow where key='correction-original')),1::bigint,'original archived PDF is retained, never superseded in place');
select is((select i.paid_minor from public.provider_invoice_balances i where i.id=(select(value->>'replacement_invoice_id')::uuid from p137_flow where key='correction-complete')),(select(value->>'total_minor')::bigint from p137_flow where key='correction-original'),'explicitly approved payment credit moves once to the replacement balance');
select is((select i.paid_minor from public.provider_invoice_balances i where i.id=(select(value->>'id')::uuid from p137_flow where key='correction-original')),0::bigint,'original balance no longer counts the transferred paid credit');
select is((select count(*)from public.provider_payments where payment_reference='P137-CORRECTION-PAID'),1::bigint,'credit transfer does not fabricate a second cash receipt');
select is((select sum(case e.direction when'DEBIT'then e.amount_minor else-e.amount_minor end)from public.financial_entries e join public.provider_invoices i on i.journal_id=e.journal_id where i.id=(select(value->>'replacement_invoice_id')::uuid from p137_flow where key='correction-complete')),0::numeric,'replacement invoice journal balances');
select is(public.decide_provider_invoice_recipient_correction_v1((select(value->>'request_id')::uuid from p137_flow where key='correction-request'),private.canonical_request_hash((select value from p137_flow where key='correction-source')),true,'TEST independent cancellation and new issue approved'),(select value from p137_flow where key='correction-complete'),'correction decision replay returns same credit, invoice and payment transfer');
select is(private.provider_billing_recipient_concordance_v1('invoice',(select(value->>'id')::uuid from p137_flow where key='correction-original')),'CORRECTED','original is truthfully labeled corrected without rendering a new original');
select is(private.provider_billing_recipient_concordance_v1('invoice',(select(value->>'replacement_invoice_id')::uuid from p137_flow where key='correction-complete')),'OK','replacement reads frozen approved contractual recipient');
select is(private.provider_billing_recipient_concordance_v1('credit_note',(select(value->>'credit_note_id')::uuid from p137_flow where key='correction-complete')),'OK','cancellation credit cancels the original recipient, not a substituted identity');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select is(public.request_provider_invoice_recipient_correction_v1((select(value->>'id')::uuid from p137_flow where key='correction-original'),private.canonical_request_hash((select value from p137_flow where key='correction-source')),current_date,current_date+45,true,'TEST correct historical recipient by cancellation and new issue','137f0000-0000-4000-8000-000000000002'),(select value from p137_flow where key='correction-request'),'request replay is durable after its financial correction changes the live balance');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_provider_billing_recipient_review_context_v1('13710000-0000-4000-8000-000000000001')$$,'42501','BILLING_RECIPIENT_REVIEW_DENIED','billing historical identity evidence requires genuine AAL2');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.complete_provider_billing_document_issue('invoice',(select(value->>'id')::uuid from p137_flow where key='correction-original'))->>'outcome','BILLING_ORIGINAL_RETAINED_BY_CORRECTION','late issued replay does not pretend corrected original translations are ready');
select is(public.enqueue_provider_billing_pdf_notification((select id from public.provider_billing_document_artifacts where source_id=(select(value->>'id')::uuid from p137_flow where key='correction-original')))->>'outcome','BILLING_ORIGINAL_RETAINED_BY_CORRECTION','late Ready replay does not email the corrected original');
select is((select count(*)from public.event_outbox where event_type='ProviderBillingDocumentsReadyV1'and aggregate_id=(select value->>'id'from p137_flow where key='correction-original')),0::bigint,'superseded original emits no fictitious readiness event');
select ok(private.provider_billing_notification_send_authorized_v1((select id from public.notification_instances where event_type='ProviderBillingPdfReadyV1'and variables_snapshot->>'source_id'=(select value->>'credit_note_id'from p137_flow where key='credit-1'))),'valid archived credit and active verified billing recipient pass the immediate transport gate');
insert into p137_flow select'late-original-notification',public.enqueue_notification('13700000-0000-4000-8000-000000000001','13710000-0000-4000-8000-000000000001','PROVIDER_BILLING_PDF','ProviderBillingPdfReadyV1','fr-MA',jsonb_build_object('number','TEST-HISTORICAL-P137','kind','invoice','source_id',(select value->>'id'from p137_flow where key='correction-original'),'locale','fr'),'p137-historical-preexisting-queue','provider_billing_document_artifact',(select id::text from public.provider_billing_document_artifacts where source_id=(select(value->>'id')::uuid from p137_flow where key='correction-original')),extensions.gen_random_uuid());
select ok(not private.provider_billing_notification_send_authorized_v1((select id from public.notification_instances where deduplication_key='p137-historical-preexisting-queue')),'a preexisting notification for a corrected original is refused before external transport');
select ok(not private.provider_billing_notification_send_authorized_v1('137f0000-0000-4000-8000-000000009999'),'missing notification cannot authorize a document send');
-- Scoped synthetic worker lease precondition, never the global queue claim on a shared DB.
-- The production pre-transport authorization and its state/audit effects are exercised unchanged.
update public.notification_deliveries d set lease_token='137f0000-0000-4000-8000-000000000041',lease_owner='TEST_PROVIDER_137_TRANSPORT',leased_until=clock_timestamp()+interval'5 minutes'from public.notification_instances n where n.id=d.notification_id and d.channel='IN_APP'and n.variables_snapshot->>'source_id'=(select value->>'credit_note_id'from p137_flow where key='credit-1');
insert into p137_flow select'transport-valid',public.authorize_notification_delivery_send_v1(d.id,d.lease_token,'TEST_PROVIDER_137_TRANSPORT')from public.notification_deliveries d join public.notification_instances n on n.id=d.notification_id where d.channel='IN_APP'and n.variables_snapshot->>'source_id'=(select value->>'credit_note_id'from p137_flow where key='credit-1');
select is((select value->>'outcome'from p137_flow where key='transport-valid'),'NOTIFICATION_SEND_AUTHORIZED','real transport authorizer permits a valid archived credit under its own active lease');
select is((select value->>'authorized'from p137_flow where key='transport-valid'),'true','valid transport authorization is explicit, without claiming an external send');
update public.notification_deliveries d set lease_token='137f0000-0000-4000-8000-000000000042',lease_owner='TEST_PROVIDER_137_TRANSPORT',leased_until=clock_timestamp()+interval'5 minutes'from public.notification_instances n where n.id=d.notification_id and d.channel='IN_APP'and n.deduplication_key='p137-historical-preexisting-queue';
insert into p137_flow select'transport-blocked',public.authorize_notification_delivery_send_v1(d.id,d.lease_token,'TEST_PROVIDER_137_TRANSPORT')from public.notification_deliveries d join public.notification_instances n on n.id=d.notification_id where d.channel='IN_APP'and n.deduplication_key='p137-historical-preexisting-queue';
select is((select value->>'outcome'from p137_flow where key='transport-blocked'),'NOTIFICATION_SEND_BLOCKED','real transport authorizer blocks the corrected queued original');
select is((select value->>'reason'from p137_flow where key='transport-blocked'),'BILLING_DOCUMENT_SUPERSEDED_OR_RECIPIENT_INVALID','transport supplies the real document supersession reason');
select ok((select d.status='SKIPPED'and d.lease_token is null from public.notification_deliveries d join public.notification_instances n on n.id=d.notification_id where d.channel='IN_APP'and n.deduplication_key='p137-historical-preexisting-queue'),'blocked transport records SKIPPED and releases its lease');
select is((select count(*)from public.audit_events where action='notification.delivery.send_blocked'and resource_id=(select value->>'delivery_id'from p137_flow where key='transport-blocked')),1::bigint,'blocked document transport appends one actual audit event');
select is((select count(*)from public.notification_deliveries d join public.notification_instances n on n.id=d.notification_id where n.deduplication_key='p137-historical-preexisting-queue'and d.status in('SENT','DELIVERED')),0::bigint,'blocked original never claims sent or delivered');


select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);

-- More than the old 30-document and 50-invoice list limits, all in the same future calendar day.
do $$declare i integer;upload jsonb;statement jsonb;recorded jsonb;doc jsonb;number text;actor uuid:='13700000-0000-4000-8000-000000000001';org uuid:='13710000-0000-4000-8000-000000000001';mission uuid;begin
 select mission_id into mission from p137_ids;
 for i in 1..51 loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  upload:=public.begin_provider_receipt_proof_upload(org,'calendar-receipt.pdf','application/pdf',20,repeat('b',64),'p137-calendar-receipt-'||i);
  insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',upload->>'storage_object_path',actor::text,'{"mimetype":"application/pdf","size":20}');
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.record_provider_payment_proof_scan_result((upload->>'upload_id')::uuid,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('b',64),'p137-calendar-receipt-scan-'||i);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  recorded:=public.record_provider_payable_event(mission,'ADJUSTMENT',current_date,'MAD',30000,'P137-CALENDAR-'||i,repeat('b',64),'p137-calendar-payable-'||i);
  statement:=public.issue_provider_statement(org,'P137-CALENDAR-STATEMENT-'||i,current_date,current_date,'MAD','p137-calendar-statement-'||i);
  recorded:=public.issue_provider_invoice((statement->>'statement_id')::uuid,'AUTO',current_date,current_date+30,'137a0000-0000-4000-8000-000000000001','137a0000-0000-4000-8000-000000000002','137a0000-0000-4000-8000-000000000003','p137-calendar-invoice-'||i);
 end loop;
 for i in 1..201 loop
  upload:=public.begin_provider_document_upload(org,'application/pdf',20);
  insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',upload->>'storage_object_path',actor::text,'{"mimetype":"application/pdf","size":20}');
  doc:=public.record_provider_document_version(org,'CERTIFICATION','P137_CALENDAR_'||lpad(i::text,3,'0'),jsonb_build_object('issued_on',current_date::text,'expires_on',(current_date+30)::text,'storage_object_path',upload->>'storage_object_path','content_hash',repeat('a',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Synthetic calendar evidence metadata','p137-calendar-document-'||i);
 end loop;
end$$;
insert into p137_flow select'calendar-1',public.get_my_provider_planning_v1('13710000-0000-4000-8000-000000000001',(current_date+30)::timestamptz,(current_date+31)::timestamptz,current_date+30,current_date+31,1,200);
insert into p137_flow select'calendar-2',public.get_my_provider_planning_v1('13710000-0000-4000-8000-000000000001',(current_date+30)::timestamptz,(current_date+31)::timestamptz,current_date+30,current_date+31,2,200);
select ok((select jsonb_array_length(value->'events')=200 and(value->>'has_more')::boolean from p137_flow where key='calendar-1'),'calendar explicitly paginates a busy week');
select ok((select jsonb_array_length(value->'events')=52 and not(value->>'has_more')::boolean from p137_flow where key='calendar-2'),'second calendar page retains every event beyond the old list limits');
select is((select count(*)from p137_flow f cross join lateral jsonb_array_elements(f.value->'events')e where f.key in('calendar-1','calendar-2')and e->>'kind'='invoice'),51::bigint,'calendar contains the 51st actual governed invoice');
select is((select count(distinct e->>'source_id')from p137_flow f cross join lateral jsonb_array_elements(f.value->'events')e where f.key in('calendar-1','calendar-2')and e->>'kind'='document'),201::bigint,'all latest document expirations remain present without duplicates');
select throws_ok($$select public.get_my_provider_planning_v1('13710000-0000-4000-8000-000000000002',(current_date+30)::timestamptz,(current_date+31)::timestamptz,current_date+30,current_date+31)$$,'42501','PROVIDER_PLANNING_SCOPE_DENIED','another organization cannot be selected by forged calendar scope');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'feedback',public.submit_mission_provider_feedback(mission_id,10000,10000,10000,'{"summary_code":"MISSION_SUCCESS","criteria":[{"key":"COMMUNICATION","rating":5},{"key":"PROFESSIONALISM","rating":5},{"key":"VALUE","rating":5}]}','p137-flow-feedback','13790000-0000-4000-8000-000000000009')from p137_ids;
reset role;
select is((select value->>'outcome'from p137_flow where key='feedback'),'MISSION_PROVIDER_FEEDBACK_SUBMITTED','client feedback passes only with server-derived scores');
select ok((select f.quality_basis_points=10000 and f.compliance_basis_points=10000 and f.satisfaction_basis_points=10000 from public.mission_provider_feedback f join p137_ids i on i.mission_id=f.mission_id),'persisted feedback equals acceptance, checklist and fixed-rubric derivation');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'refresh',public.refresh_provider_reputation_from_events('13710000-0000-4000-8000-000000000001',service_id,'PROVIDER-REPUTATION-V1','p137-flow-reputation-refresh','13790000-0000-4000-8000-000000000011')from p137_catalog;
reset role;
select is((select value->>'outcome'from p137_flow where key='refresh'),'PROVIDER_REPUTATION_REFRESHED_FROM_EVENTS','AAL2 refresh builds reputation from authoritative events');
select is((select count(distinct dimension)::integer from public.provider_reputation_evidence_events e,p137_catalog c where e.provider_organization_id='13710000-0000-4000-8000-000000000001'and e.service_id=c.service_id),6,'refresh materializes all six authoritative dimensions');
select ok((select s.version_number=1 and s.overall_basis_points=10000 and s.evidence_count>=8 from public.provider_reputation_snapshots s,p137_catalog c where s.id=(select(value->>'snapshot_id')::uuid from p137_flow where key='refresh')and s.service_id=c.service_id),'refresh creates a versioned service reputation snapshot from complete evidence');
select ok((select count(*)>=1 from public.provider_badge_evaluations e where e.reputation_snapshot_id=(select(value->>'snapshot_id')::uuid from p137_flow where key='refresh')and e.eligible),'refresh creates eligible evaluations pending human review');

create temporary table p137_flow_badge as select e.id evaluation_id from public.provider_badge_evaluations e where e.reputation_snapshot_id=(select(value->>'snapshot_id')::uuid from p137_flow where key='refresh')and e.eligible order by e.id limit 1;grant select on p137_flow_badge to authenticated;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.decide_provider_badge((select evaluation_id from p137_flow_badge),'PUBLISHED','Validation humaine complète P137','p137-flow-badge-publish','13790000-0000-4000-8000-000000000012')$$,'42501'::char(5),'HUMAN_BADGE_DECISION_REQUIRED','fresh badge evaluation rejects an AAL1 decision');
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'flow-badge',public.decide_provider_badge(evaluation_id,'PUBLISHED','Validation humaine complète P137','p137-flow-badge-publish','13790000-0000-4000-8000-000000000012')from p137_flow_badge;
insert into p137_flow select'flow-badge-replay',public.decide_provider_badge(evaluation_id,'PUBLISHED','Validation humaine complète P137','p137-flow-badge-publish','13790000-0000-4000-8000-000000000012')from p137_flow_badge;
reset role;
select is((select value->>'outcome'from p137_flow where key='flow-badge'),'PROVIDER_BADGE_DECIDED','AAL2 human review publishes the event-derived badge');
select is((select value from p137_flow where key='flow-badge-replay'),(select value from p137_flow where key='flow-badge'),'fresh badge replay returns the exact cached decision');
select ok((select count(*)>=8 from public.audit_events where correlation_id::text like'13790000-0000-4000-8000-%'),'full sensitive chain appends audit events');
select ok((select count(*)>=9 from public.event_outbox where correlation_id::text like'13790000-0000-4000-8000-%'),'full sensitive chain appends versioned Outbox events');

-- Historical version2 precondition under the same contract. No current identity is
-- substituted for either version. Real receipt/archive/review commands follow.
reset role;
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
select '13780000-0000-4000-8000-000000000029',contract_id,2,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,repeat('6',64),'Historical contract version two TEST precondition',created_by from public.contract_versions where id='13780000-0000-4000-8000-000000000019';
do $$declare review jsonb;upload jsonb;doc uuid;entry jsonb;idx integer;begin
 select v.id into doc from public.provider_document_versions v join public.provider_document_families f on f.id=v.family_id where f.code='P137_CONTRACT_RECIPIENT'and v.status='VERIFIED';
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
 review:=public.request_provider_billing_recipient_review_v1('13780000-0000-4000-8000-000000000029',repeat('6',64),'{"legal_name":"Second contractual identity TEST 137","country_code":"MA","identifiers":{"ICE":"999000000000147","IF":"99900147","RC":"TEST-RC-147"},"registered_address":"Second historical contractual address TEST"}',doc,'TEST evidence historical contractual identity two','137f0000-0000-4000-8000-000000000010');
 perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_provider_billing_recipient_review_v1((review->>'review_id')::uuid,(select content_hash from public.provider_billing_contract_recipient_reviews where id=(review->>'review_id')::uuid),true,'TEST independent review identity two');
 for idx in 1..2 loop
  if idx=2 then update public.missions set contract_version_id='13780000-0000-4000-8000-000000000029'where id=(select mission_id from p137_ids);end if;
  perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
  upload:=public.begin_provider_receipt_proof_upload('13710000-0000-4000-8000-000000000001','grouped-receipt.pdf','application/pdf',20,repeat('1',64),'p137-grouped-receipt-'||idx);
  insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',upload->>'storage_object_path','13700000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":20}');
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.record_provider_payment_proof_scan_result((upload->>'upload_id')::uuid,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('1',64),'p137-grouped-receipt-scan-'||idx);
  perform set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
  entry:=public.record_provider_payable_event((select mission_id from p137_ids),'ADJUSTMENT',current_date+3,'MAD',30000,'P137-GROUPED-'||idx,repeat('1',64),'p137-grouped-payable-'||idx);
 end loop;
end$$;
select set_config('request.jwt.claims','{"sub":"13700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p137_flow select'grouped-preview',public.preview_provider_grouped_statements_v1('13710000-0000-4000-8000-000000000001',current_date+3,current_date+3,'MAD');
select is((select jsonb_array_length(value->'groups')from p137_flow where key='grouped-preview'),2,'same-day commissions retain two different immutable contractual recipient groups');
select throws_ok($$select public.issue_provider_statement('13710000-0000-4000-8000-000000000001','P137-MUST-NOT-MIX',current_date+3,current_date+3,'MAD','p137-reject-mixed')$$,'55000','BILLING_MIXED_CONTRACT_RECIPIENTS','single-statement legacy command refuses to mix contractual identities');
select is((select count(*)from public.provider_statements where statement_number='P137-MUST-NOT-MIX'),0::bigint,'refused mixed issue leaves no statement behind');
select throws_ok($$select public.issue_provider_grouped_statements_v1('13710000-0000-4000-8000-000000000001','P137-GROUPED',current_date+3,current_date+3,'MAD',repeat('0',64),'137f0000-0000-4000-8000-000000000011')$$,'40001','BILLING_GROUPED_STATEMENT_SOURCE_CHANGED','grouped publication requires the exact reviewed source checkpoint');
insert into p137_flow select'grouped-issued',public.issue_provider_grouped_statements_v1('13710000-0000-4000-8000-000000000001','P137-GROUPED',current_date+3,current_date+3,'MAD',value->>'source_hash','137f0000-0000-4000-8000-000000000011')from p137_flow where key='grouped-preview';
select is((select value->>'outcome'from p137_flow where key='grouped-issued'),'PROVIDER_GROUPED_STATEMENTS_ISSUED','reviewed recipient groups issue atomically');
select is((select count(distinct b.policy_snapshot#>>'{recipient_snapshot,identifiers,ICE}')from public.provider_billing_source_policy_bindings b join public.provider_statements s on s.id=b.source_id where b.kind='statement'and s.statement_number like'P137-GROUPED-G%'),2::bigint,'each substatement binds its own historical ICE, not the current organization');
select is((select count(*)from public.provider_statement_lines l join public.provider_statements s on s.id=l.statement_id where s.statement_number like'P137-GROUPED-G%'),2::bigint,'each source event is billed exactly once across groups');
select is((select sum(total_minor)from public.provider_statements where statement_number like'P137-GROUPED-G%'),7200::numeric,'grouped totals preserve exact net and tax without invented allocation');
select is((select count(*)from public.event_outbox where event_type='ProviderStatementIssuedV1'and aggregate_id in(select id::text from public.provider_statements where statement_number like'P137-GROUPED-G%')),2::bigint,'every substatement enters its own actual PDF issue pipeline');
select is(public.issue_provider_grouped_statements_v1('13710000-0000-4000-8000-000000000001','P137-GROUPED',current_date+3,current_date+3,'MAD',(select value->>'source_hash'from p137_flow where key='grouped-preview'),'137f0000-0000-4000-8000-000000000011'),(select value from p137_flow where key='grouped-issued'),'grouped replay returns exact same substatements before mutable unbilled-source guard');
select is(jsonb_array_length(public.preview_provider_grouped_statements_v1('13710000-0000-4000-8000-000000000001',current_date+3,current_date+3,'MAD')->'groups'),0,'published grouped events do not remain available for duplicate issue');
select throws_ok($$select public.preview_provider_grouped_statements_v1('13710000-0000-4000-8000-000000000002',current_date+3,current_date+3,'MAD')$$,'42501','PROVIDER_STATEMENT_DENIED','group preview does not cross organization scope');

do $$declare item record;begin for item in select id from public.provider_statements where statement_number like'P137-GROUPED-G%'order by id loop
 perform public.issue_provider_invoice(item.id,'AUTO',current_date+3,current_date+60,'137a0000-0000-4000-8000-000000000001','137a0000-0000-4000-8000-000000000002','137a0000-0000-4000-8000-000000000003','p137-grouped-invoice:'||item.id::text);
 end loop;end$$;
select is((select count(distinct i.invoice_number)from public.provider_invoices i join public.provider_statements s on s.id=i.statement_id where s.statement_number like'P137-GROUPED-G%'),2::bigint,'each grouped substatement produces its own approved distinct invoice number');
select is((select count(distinct b.policy_snapshot#>>'{recipient_snapshot,identifiers,ICE}')from public.provider_billing_source_policy_bindings b join public.provider_invoices i on i.id=b.source_id join public.provider_statements s on s.id=i.statement_id where b.kind='invoice'and s.statement_number like'P137-GROUPED-G%'),2::bigint,'grouped invoice snapshots preserve separate contractual recipients through final financial issuance');

select*from finish();rollback;
