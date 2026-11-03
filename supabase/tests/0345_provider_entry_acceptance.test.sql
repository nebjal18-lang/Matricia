-- Synthetic, rollback-only fixtures. All application commands execute with SET ROLE.
-- No disabled triggers, fabricated eligibility function or external scan service claim.
begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated,service_role;
grant execute on all functions in schema extensions to authenticated,service_role;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('d0600000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-owner@example.invalid','',now(),'{}','{}',now(),now()),
('d0600000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-outsider@example.invalid','',now(),'{}','{}',now(),now()),
('d0600000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-admin@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('d0610000-0000-0000-0000-000000000001','P06 Session Tenant A','P06 Session A','ACTIVE','d0600000-0000-0000-0000-000000000001'),
('d0610000-0000-0000-0000-000000000002','P06 Session Tenant B','P06 Session B','ACTIVE','d0600000-0000-0000-0000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('d0620000-0000-0000-0000-000000000001','d0610000-0000-0000-0000-000000000001','d0600000-0000-0000-0000-000000000001','ACTIVE',now()),
('d0620000-0000-0000-0000-000000000002','d0610000-0000-0000-0000-000000000002','d0600000-0000-0000-0000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('d0620000-0000-0000-0000-000000000001','PROVIDER_OWNER'),
('d0620000-0000-0000-0000-000000000002','PROVIDER_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('d0600000-0000-0000-0000-000000000003','MATRICIA_ADMIN');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('d0630000-0000-0000-0000-000000000001','P06_SESSIONS','p06-sessions','d0610000-0000-0000-0000-000000000001','PUBLISHED','d0600000-0000-0000-0000-000000000003');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,created_by,audience,effective_from,published_at)values('d0640000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','P06.SESSIONS.V1','PUBLISHED',repeat('a',64),repeat('b',64),'d0600000-0000-0000-0000-000000000003','{"kind":"PUBLIC"}',now()-interval'1 day',now()-interval'1 day');
update public.catalog_libraries set current_release_id='d0640000-0000-0000-0000-000000000001'where id='d0630000-0000-0000-0000-000000000001';
insert into public.questionnaires(id,library_id,code,status,created_by)values('d0650000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','SESSION_ENGINE','DRAFT','d0600000-0000-0000-0000-000000000003');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by)values('d0660000-0000-0000-0000-000000000001','d0650000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','d0640000-0000-0000-0000-000000000001',1,'DRAFT','Session reproductible','جلسة قابلة للتكرار','Validation finale versionnée','تحقق نهائي بإصدار','PROVIDER','2.0.0','P06-SESSIONS-1',repeat('0',64),'APPROVED','d0600000-0000-0000-0000-000000000003',now(),repeat('c',64),1,'Sessions versionnées','d0600000-0000-0000-0000-000000000003');
insert into public.questionnaire_sections(id,questionnaire_version_id,section_key,label_fr,label_ar,sort_order,content_hash)values('d0670000-0000-0000-0000-000000000001','d0660000-0000-0000-0000-000000000001','GENERAL','Général','عام',1,repeat('d',64));
insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by)values
('d0680000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','HAS_POLICY','LIBRARY','DRAFT','d0600000-0000-0000-0000-000000000003'),
('d0680000-0000-0000-0000-000000000002','d0630000-0000-0000-0000-000000000001','POLICY_DETAIL','LIBRARY','DRAFT','d0600000-0000-0000-0000-000000000003');
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,required_by_default,sensitivity,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,weight,maximum_score,content_hash,change_reason,created_by,published_at)values
('d0690000-0000-0000-0000-000000000001','d0680000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001',1,'PUBLISHED','Avez-vous une politique ?','هل لديكم سياسة؟','YES_NO','session.has_policy',true,'BUSINESS','APPROVED','d0600000-0000-0000-0000-000000000003',now(),repeat('e',64),1,1,1,repeat('1',64),'Question session','d0600000-0000-0000-0000-000000000003',now()),
('d0690000-0000-0000-0000-000000000002','d0680000-0000-0000-0000-000000000002','d0630000-0000-0000-0000-000000000001',1,'PUBLISHED','Décrivez la politique','صف السياسة','SHORT_TEXT','session.policy_detail',true,'CONFIDENTIAL','APPROVED','d0600000-0000-0000-0000-000000000003',now(),repeat('f',64),1,1,1,repeat('2',64),'Question session','d0600000-0000-0000-0000-000000000003',now());
update public.question_bank_questions set status='PUBLISHED',current_published_version_id=case when question_key='HAS_POLICY'then'd0690000-0000-0000-0000-000000000001'::uuid else'd0690000-0000-0000-0000-000000000002'::uuid end where library_id='d0630000-0000-0000-0000-000000000001';
insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order)values
('d0660000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','d0670000-0000-0000-0000-000000000001','d0690000-0000-0000-0000-000000000001',1),
('d0660000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','d0670000-0000-0000-0000-000000000001','d0690000-0000-0000-0000-000000000002',2);
insert into public.question_rules(id,library_id,rule_key,status,created_by)values
('d06a0000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','HIDE_DETAIL','DRAFT','d0600000-0000-0000-0000-000000000003'),
('d06a0000-0000-0000-0000-000000000002','d0630000-0000-0000-0000-000000000001','POLICY_SCORE','DRAFT','d0600000-0000-0000-0000-000000000003');
insert into public.question_rule_versions(id,rule_id,library_id,version,status,condition_ast,actions,dependency_graph,priority,compiled_hash,change_reason,created_by,published_at)values
('d06b0000-0000-0000-0000-000000000001','d06a0000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001',1,'PUBLISHED','{"operator":"EQ","question_version_id":"d0690000-0000-0000-0000-000000000001","value":false}','[{"type":"HIDE","target":"d0690000-0000-0000-0000-000000000002"}]','{"d0690000-0000-0000-0000-000000000001":[]}',10,repeat('3',64),'Masquage conditionnel','d0600000-0000-0000-0000-000000000003',now()),
('d06b0000-0000-0000-0000-000000000002','d06a0000-0000-0000-0000-000000000002','d0630000-0000-0000-0000-000000000001',1,'PUBLISHED','{"operator":"EQ","question_version_id":"d0690000-0000-0000-0000-000000000001","value":true}','[{"type":"SCORE","dimension":"GLOBAL","delta_basis_points":8000}]','{"d0690000-0000-0000-0000-000000000001":[]}',20,repeat('4',64),'Scoring versionné','d0600000-0000-0000-0000-000000000003',now());
update public.question_rules set status='PUBLISHED',current_published_version_id=case when rule_key='HIDE_DETAIL'then'd06b0000-0000-0000-0000-000000000001'::uuid else'd06b0000-0000-0000-0000-000000000002'::uuid end where library_id='d0630000-0000-0000-0000-000000000001';
insert into public.questionnaire_version_rules(questionnaire_version_id,library_id,rule_version_id,evaluation_order)values
('d0660000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','d06b0000-0000-0000-0000-000000000001',10),
('d0660000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','d06b0000-0000-0000-0000-000000000002',20);
update public.questionnaire_versions set snapshot_hash=private.compute_questionnaire_snapshot_hash(id,jsonb_build_object('questionnaire_id',questionnaire_id,'library_id',library_id,'release_id',catalog_release_id,'version',version,'title_fr',title_fr,'title_ar',title_ar,'description_fr',description_fr,'description_ar',description_ar,'audience',audience,'engine_version',engine_version,'policy_version',policy_version)),status='PUBLISHED',published_at=now(),row_version=row_version+1 where id='d0660000-0000-0000-0000-000000000001';
update public.questionnaires set status='PUBLISHED',current_published_version_id='d0660000-0000-0000-0000-000000000001',row_version=row_version+1 where id='d0650000-0000-0000-0000-000000000001';
set constraints all immediate;set constraints all deferred;


insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('d0600000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','provider-entry-viewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('d0620000-0000-0000-0000-000000000004','d0610000-0000-0000-0000-000000000001','d0600000-0000-0000-0000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('d0620000-0000-0000-0000-000000000004','PROVIDER_VIEWER');
insert into public.catalog_categories(id,library_id,code,slug,created_by)values('d3450000-0000-4000-8000-000000000001','d0630000-0000-0000-0000-000000000001','ENTRY_CATEGORY','entry-category','d0600000-0000-0000-0000-000000000003');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by)values('d3450000-0000-4000-8000-000000000002','d0630000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000001','ENTRY_SUBCATEGORY','entry-subcategory','d0600000-0000-0000-0000-000000000003');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by)values
('d3450000-0000-4000-8000-000000000003','d0630000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000002','ENTRY_SERVICE_A','entry-service-a','d0600000-0000-0000-0000-000000000003'),
('d3450000-0000-4000-8000-000000000004','d0630000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000002','ENTRY_SERVICE_B','entry-service-b','d0600000-0000-0000-0000-000000000003');
create temporary table entry_observed(k text primary key,v jsonb);grant all on entry_observed to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into entry_observed values('profile',public.submit_provider_profile('d0610000-0000-0000-0000-000000000001','{"activity_summary":"Synthetic provider entry test","team_size":2,"years_experience":3}',0,'entry-profile-0345'));
insert into entry_observed values('service-a',public.request_provider_service('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003','entry-service-a-0345')),('service-b',public.request_provider_service('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000004','entry-service-b-0345'));
insert into entry_observed values('work-scope',public.declare_provider_work_scope_v1('d0610000-0000-0000-0000-000000000001',80,'Synthetic small and medium missions',0,'Initial declared work scope','d3450000-0000-4000-8000-000000000030')),
('work-scope-replay',public.declare_provider_work_scope_v1('d0610000-0000-0000-0000-000000000001',80,'Synthetic small and medium missions',0,'Initial declared work scope','d3450000-0000-4000-8000-000000000030'));
select is((select v from entry_observed where k='work-scope'),(select v from entry_observed where k='work-scope-replay'),'work scope exact replay does not create a duplicate version');
select throws_ok($$select public.declare_provider_work_scope_v1('d0610000-0000-0000-0000-000000000001',90,'Synthetic small and medium missions',0,'Initial declared work scope','d3450000-0000-4000-8000-000000000030')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed work facts cannot reuse operation key');
select throws_ok($$select public.declare_provider_work_scope_v1('d0610000-0000-0000-0000-000000000001',90,'Synthetic new mission scope',0,'Stale concurrent scope edit','d3450000-0000-4000-8000-000000000031')$$,'40001','STALE_PROVIDER_WORK_SCOPE','concurrent work scope preserves current version');
insert into entry_observed values('capacity',public.declare_provider_capacity('d0610000-0000-0000-0000-000000000001',null,'AVAILABLE',7,9,'Synthetic global capacity','entry-capacity-0345'));
select is(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'capacity_available_units','7','global capacity units match authoritative fallback');
select is(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'capacity_lead_time_days','9','global lead time matches authoritative fallback');
reset role;
insert into public.provider_capacity_versions(provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,effective_until,reason,declared_by)values
('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003',1,'FULL',0,2,now()+interval'2 days',null,'Synthetic future capacity','d0600000-0000-0000-0000-000000000001'),
('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003',2,'PAUSED',null,1,now()-interval'2 days',now()-interval'1 day','Synthetic expired capacity','d0600000-0000-0000-0000-000000000001');
set local role authenticated;
select is(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'capacity_available_units','7','future and expired service declarations cannot override effective global capacity');
insert into entry_observed values('service-capacity',public.declare_provider_capacity('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003','LIMITED',2,4,'Synthetic effective service capacity','entry-service-capacity-0345'));
select is(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'capacity_available_units','2','effective service-specific declaration overrides global units');
select is(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'capacity_lead_time_days','4','effective service-specific lead time matches status');

insert into entry_observed values('start',public.start_questionnaire_session('d0610000-0000-0000-0000-000000000001','d0660000-0000-0000-0000-000000000001','fr-MA',null,'entry-start-0345','d3450000-0000-4000-8000-000000000040'));
insert into entry_observed values('save',public.autosave_questionnaire_answers((select(v->>'session_id')::uuid from entry_observed where k='start'),1,'[{"question_version_id":"d0690000-0000-0000-0000-000000000001","value":false,"expected_answer_row_version":0}]','entry-save-0345','d3450000-0000-4000-8000-000000000040'));
insert into entry_observed values('submit',public.submit_questionnaire_session((select(v->>'session_id')::uuid from entry_observed where k='start'),2,'entry-submit-0345','d3450000-0000-4000-8000-000000000040'));
select is((select v->>'outcome'from entry_observed where k='submit'),'QUESTIONNAIRE_SESSION_SUBMITTED','Provider owner completes real versioned questionnaire commands');
select is((select audience from public.questionnaire_sessions where id=(select(v->>'session_id')::uuid from entry_observed where k='start')),'PROVIDER','submitted evidence keeps Provider audience');
select ok(not(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'eligible')::boolean,'questionnaire submission never auto-approves qualification');
insert into entry_observed values('upload',public.begin_provider_document_upload_v2('d0610000-0000-0000-0000-000000000001','application/pdf',20,repeat('a',64),'d3450000-0000-4000-8000-000000000010')),
('upload-replay',public.begin_provider_document_upload_v2('d0610000-0000-0000-0000-000000000001','application/pdf',20,repeat('a',64),'d3450000-0000-4000-8000-000000000010'));
select is((select v->>'storage_object_path'from entry_observed where k='upload'),(select v->>'storage_object_path'from entry_observed where k='upload-replay'),'upload retry preserves server-reserved path');
select throws_ok($$select public.begin_provider_document_upload_v2('d0610000-0000-0000-0000-000000000001','application/pdf',20,repeat('b',64),'d3450000-0000-4000-8000-000000000010')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed bytes cannot reuse upload operation');
insert into storage.objects(bucket_id,name,metadata)select 'provider-qualification',v->>'storage_object_path','{"mimetype":"application/pdf","size":20}'::jsonb from entry_observed where k='upload';
insert into entry_observed values('document',public.record_provider_document_version('d0610000-0000-0000-0000-000000000001','CERTIFICATION','ENTRY_CERT',jsonb_build_object('storage_object_path',(select v->>'storage_object_path'from entry_observed where k='upload'),'content_hash',repeat('a',64),'metadata','{"declared_mime_type":"application/pdf","declared_size_bytes":20}'::jsonb),array[(select(v->>'provider_service_id')::uuid from entry_observed where k='service-a')],'Synthetic certificate','entry-document-0345'));
select ok(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->'reasons'?'MANDATORY_DOCUMENT_INVALID','submitted mandatory certificate blocks only dependent service');
select ok(not(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000004')->'reasons'?'MANDATORY_DOCUMENT_INVALID'),'unrelated service has no certificate block');
select is(jsonb_array_length(public.list_provider_questionnaire_documents_v1('d0610000-0000-0000-0000-000000000001')),0,'pending scan never appears as reusable questionnaire evidence');
reset role;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table entry_scan_claim as select*from public.claim_provider_document_scan_jobs('d3450000-0000-4000-8000-000000000020',1,300);
select is((select public.complete_provider_document_scan_job(proof_id,lease_token,worker_id,row_version,'CLEAN','SYNTHETIC_TEST','1',repeat('a',64),'entry-scan-0345')->>'outcome'from entry_scan_claim),'PROVIDER_DOCUMENT_SCAN_RECORDED','trusted synthetic worker records matching clean verdict');
reset role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into entry_observed values('review',public.review_provider_document((select(v->>'document_version_id')::uuid from entry_observed where k='document'),'VERIFIED','Synthetic evidence human review','ENTRY-TEST-V1','entry-review-0345'));
insert into entry_observed values('qualification-review',public.decide_provider_qualification((select(v->>'qualification_id')::uuid from entry_observed where k='service-a'),'INFORMATION_REQUIRED',null,null,'[]','["Nouvelle assurance requise"]','Synthetic request for additional evidence','ENTRY-TEST-V1',null,1,'entry-qualification-review-0345'));

reset role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select ok(not(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->'reasons'?'MANDATORY_DOCUMENT_INVALID'),'superseded SUBMITTED source no longer blocks reviewed current evidence');
select is(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'qualification_decision_version','1','qualification version uses actual RPC projection key');
select is(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'qualification_rationale','Synthetic request for additional evidence','human rationale remains readable');
select is(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->'qualification_blocking_conditions','["Nouvelle assurance requise"]'::jsonb,'explicit conditions are exposed without inventing approval');

select is(jsonb_array_length(public.list_provider_questionnaire_documents_v1('d0610000-0000-0000-0000-000000000001')),1,'only clean current reviewed certificate is proposed for questionnaire');
select is(jsonb_array_length(public.list_provider_entry_documents_v1('d0610000-0000-0000-0000-000000000001',1,'ENTRY_CERT',array['CERTIFICATION'])->'items'),1,'current-family search does not duplicate review history');
select is(public.list_provider_entry_documents_v1('d0610000-0000-0000-0000-000000000001')->>'required_documents_complete','false','one certificate cannot complete required legal fiscal insurance dossier');
insert into entry_observed values('renewal-upload',public.begin_provider_document_upload_v2('d0610000-0000-0000-0000-000000000001','application/pdf',20,repeat('b',64),'d3450000-0000-4000-8000-000000000011'));
insert into storage.objects(bucket_id,name,metadata)select 'provider-qualification',v->>'storage_object_path','{"mimetype":"application/pdf","size":20}'::jsonb from entry_observed where k='renewal-upload';
insert into entry_observed values('renewal',public.record_provider_document_version('d0610000-0000-0000-0000-000000000001','CERTIFICATION','ENTRY_CERT',jsonb_build_object('storage_object_path',(select v->>'storage_object_path'from entry_observed where k='renewal-upload'),'content_hash',repeat('b',64),'metadata','{"declared_mime_type":"application/pdf","declared_size_bytes":20}'::jsonb),array[(select(v->>'provider_service_id')::uuid from entry_observed where k='service-b')],'Synthetic renewal applicable only to service B','entry-document-renewal-0345'));
select ok(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->'reasons'?'MANDATORY_DOCUMENT_INVALID','omitting a link during renewal cannot bypass the existing family service obligation');
select ok(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000004')->'reasons'?'MANDATORY_DOCUMENT_INVALID','new B-only renewal remains blocked while unreviewed');

reset role;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table entry_renewal_scan as select*from public.claim_provider_document_scan_jobs('d3450000-0000-4000-8000-000000000021',1,300);
select is((select public.complete_provider_document_scan_job(proof_id,lease_token,worker_id,row_version,'CLEAN','SYNTHETIC_TEST','1',repeat('b',64),'entry-renewal-scan-0345')->>'outcome'from entry_renewal_scan),'PROVIDER_DOCUMENT_SCAN_RECORDED','renewal bytes receive their own trusted synthetic scan');
reset role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into entry_observed values('renewal-review',public.review_provider_document((select(v->>'document_version_id')::uuid from entry_observed where k='renewal'),'VERIFIED','Synthetic review of B-only evidence','ENTRY-TEST-V1','entry-renewal-review-0345'));
select is((select count(*)from public.provider_work_scope_versions where provider_organization_id='d0610000-0000-0000-0000-000000000001'),1::bigint,'non-member platform reviewer can read declared scope under AAL2');
reset role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select ok(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->'reasons'?'MANDATORY_DOCUMENT_INVALID','clean reviewed B-only renewal cannot satisfy A applicability');
select ok(not(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000004')->'reasons'?'MANDATORY_DOCUMENT_INVALID'),'B accepts its explicitly linked clean reviewed current evidence');


reset role;
select ok(private.is_valid_questionnaire_document_references('FILE',null,to_jsonb((select v->>'document_version_id'from entry_observed where k='review')),'d0610000-0000-0000-0000-000000000001'),'clean Provider evidence is reusable in own organization');
select ok(not private.is_valid_questionnaire_document_references('FILE',null,to_jsonb((select v->>'document_version_id'from entry_observed where k='review')),'d0610000-0000-0000-0000-000000000002'),'questionnaire evidence reference cannot escape tenant');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}',true);
select is(jsonb_array_length(public.list_provider_entry_documents_v1('d0610000-0000-0000-0000-000000000001')->'items'),1,'Provider viewer can read own document dossier');
select throws_ok($$select public.declare_provider_work_scope_v1('d0610000-0000-0000-0000-000000000001',null,'Viewer forged declaration',1,'Viewer scope edit denied','d3450000-0000-4000-8000-000000000032')$$,'42501','PROVIDER_SCOPE_DENIED','viewer cannot change declared work scope');
select throws_ok($$select public.begin_provider_document_upload_v2('d0610000-0000-0000-0000-000000000001','application/pdf',20,repeat('a',64),extensions.gen_random_uuid())$$,'42501','PROVIDER_SCOPE_DENIED','viewer cannot reserve uploads');
select throws_ok($$select public.declare_provider_capacity('d0610000-0000-0000-0000-000000000001',null,'FULL',0,0,'Viewer forbidden mutation','entry-viewer-capacity')$$,'42501','PROVIDER_SCOPE_DENIED','viewer cannot modify capacity');
select throws_ok($$select public.start_questionnaire_session('d0610000-0000-0000-0000-000000000001','d0660000-0000-0000-0000-000000000001','fr-MA',null,'entry-viewer-start','d3450000-0000-4000-8000-000000000040')$$,'42501',null,'viewer cannot start questionnaire evidence');
reset role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.list_provider_entry_documents_v1('d0610000-0000-0000-0000-000000000001')$$,'42501','PROVIDER_SCOPE_DENIED','another provider cannot enumerate documents');
select throws_ok($$select public.list_provider_questionnaire_documents_v1('d0610000-0000-0000-0000-000000000001')$$,'42501','PROVIDER_SCOPE_DENIED','another provider cannot enumerate questionnaire attachments');
select is((select count(*)from public.provider_document_versions where provider_organization_id='d0610000-0000-0000-0000-000000000001'),0::bigint,'RLS hides immutable document history across tenants');
select is((select count(*)from public.provider_work_scope_versions where provider_organization_id='d0610000-0000-0000-0000-000000000001'),0::bigint,'another Provider reads zero scope declarations without helper permission errors');
reset role;
select throws_ok($$update public.provider_work_scope_versions set mission_size_summary='Changed facts'$$,'55000',null,'work scope history is immutable');
select ok(not has_function_privilege('anon','public.list_provider_entry_documents_v1(uuid,integer,text,text[])','EXECUTE'),'anonymous document projection denied');
select ok(not has_function_privilege('service_role','public.begin_provider_document_upload_v2(uuid,text,bigint,text,uuid)','EXECUTE'),'service-role cannot impersonate upload owner');
select*from finish();
rollback;
