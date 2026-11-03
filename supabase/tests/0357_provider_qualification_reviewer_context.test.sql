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
insert into public.platform_user_roles(user_id,role_code)values('d0600000-0000-0000-0000-000000000003','COMPLIANCE_MANAGER');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('d0630000-0000-0000-0000-000000000001','P06_SESSIONS','p06-sessions','d0610000-0000-0000-0000-000000000001','PUBLISHED','d0600000-0000-0000-0000-000000000003');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,created_by,audience,effective_from,published_at)values('d0640000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','P06.SESSIONS.V1','PUBLISHED',repeat('a',64),repeat('b',64),'d0600000-0000-0000-0000-000000000003','{"kind":"PUBLIC"}',now()-interval'1 day',now()-interval'1 day');
update public.catalog_libraries set current_release_id='d0640000-0000-0000-0000-000000000001'where id='d0630000-0000-0000-0000-000000000001';
insert into public.catalog_categories(id,library_id,code,slug,created_by)values('d3450000-0000-4000-8000-000000000001','d0630000-0000-0000-0000-000000000001','ENTRY_CATEGORY','entry-category','d0600000-0000-0000-0000-000000000003');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by)values('d3450000-0000-4000-8000-000000000002','d0630000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000001','ENTRY_SUBCATEGORY','entry-subcategory','d0600000-0000-0000-0000-000000000003');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by)values
('d3450000-0000-4000-8000-000000000003','d0630000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000002','ENTRY_SERVICE_A','entry-service-a','d0600000-0000-0000-0000-000000000003'),
('d3450000-0000-4000-8000-000000000004','d0630000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000002','ENTRY_SERVICE_B','entry-service-b','d0600000-0000-0000-0000-000000000003');
insert into public.questionnaires(id,library_id,code,status,created_by)values('d0650000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','SESSION_ENGINE','DRAFT','d0600000-0000-0000-0000-000000000003');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by)values('d0660000-0000-0000-0000-000000000001','d0650000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','d0640000-0000-0000-0000-000000000001',1,'DRAFT','Session reproductible','جلسة قابلة للتكرار','Validation finale versionnée','تحقق نهائي بإصدار','PROVIDER','2.0.0','P06-SESSIONS-1',repeat('0',64),'APPROVED','d0600000-0000-0000-0000-000000000003',now(),repeat('c',64),1,'Sessions versionnées','d0600000-0000-0000-0000-000000000003');
insert into public.questionnaire_sections(id,questionnaire_version_id,section_key,label_fr,label_ar,sort_order,content_hash)values('d0670000-0000-0000-0000-000000000001','d0660000-0000-0000-0000-000000000001','GENERAL','Général','عام',1,repeat('d',64));
insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by)values
('d0680000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001','HAS_POLICY','LIBRARY','DRAFT','d0600000-0000-0000-0000-000000000003'),
('d0680000-0000-0000-0000-000000000002','d0630000-0000-0000-0000-000000000001','POLICY_DETAIL','LIBRARY','DRAFT','d0600000-0000-0000-0000-000000000003');
insert into public.question_versions(id,question_id,library_id,source_service_id,version,status,label_fr,label_ar,answer_type,data_key,required_by_default,sensitivity,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,weight,maximum_score,content_hash,change_reason,created_by,published_at)values
('d0690000-0000-0000-0000-000000000001','d0680000-0000-0000-0000-000000000001','d0630000-0000-0000-0000-000000000001',null,1,'PUBLISHED','Avez-vous une politique ?','هل لديكم سياسة؟','YES_NO','session.has_policy',true,'BUSINESS','APPROVED','d0600000-0000-0000-0000-000000000003',now(),repeat('e',64),1,1,1,repeat('1',64),'Question session','d0600000-0000-0000-0000-000000000003',now()),
('d0690000-0000-0000-0000-000000000002','d0680000-0000-0000-0000-000000000002','d0630000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003',1,'PUBLISHED','Décrivez la politique','صف السياسة','SHORT_TEXT','session.policy_detail',true,'CONFIDENTIAL','APPROVED','d0600000-0000-0000-0000-000000000003',now(),repeat('f',64),1,1,1,repeat('2',64),'Question session','d0600000-0000-0000-0000-000000000003',now());
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
insert into entry_observed values('save',public.autosave_questionnaire_answers((select(v->>'session_id')::uuid from entry_observed where k='start'),1,'[{"question_version_id":"d0690000-0000-0000-0000-000000000001","value":true,"expected_answer_row_version":0},{"question_version_id":"d0690000-0000-0000-0000-000000000002","value":"Expérience déposée en français العربية sans traduction.","expected_answer_row_version":0}]','entry-save-0345','d3450000-0000-4000-8000-000000000040'));
insert into entry_observed values('submit',public.submit_questionnaire_session((select(v->>'session_id')::uuid from entry_observed where k='start'),2,'entry-submit-0345','d3450000-0000-4000-8000-000000000040'));
select is((select v->>'outcome'from entry_observed where k='submit'),'QUESTIONNAIRE_SESSION_SUBMITTED','Provider owner completes real versioned questionnaire commands');
select is((select audience from public.questionnaire_sessions where id=(select(v->>'session_id')::uuid from entry_observed where k='start')),'PROVIDER','submitted evidence keeps Provider audience');
select ok(not(public.explain_provider_service_eligibility('d0610000-0000-0000-0000-000000000001','d3450000-0000-4000-8000-000000000003')->>'eligible')::boolean,'questionnaire submission never auto-approves qualification');

-- More than one applicable submitted session requires an explicit reviewer choice.
insert into entry_observed values('start-second',public.start_questionnaire_session('d0610000-0000-0000-0000-000000000001','d0660000-0000-0000-0000-000000000001','ar-MA',null,'review357-second-start','a3570000-0000-4000-8000-000000000001'));
insert into entry_observed values('save-second',public.autosave_questionnaire_answers((select(v->>'session_id')::uuid from entry_observed where k='start-second'),1,'[{"question_version_id":"d0690000-0000-0000-0000-000000000001","value":true,"expected_answer_row_version":0},{"question_version_id":"d0690000-0000-0000-0000-000000000002","value":"Deuxième dépôt arabe نص حر محفوظ.","expected_answer_row_version":0}]','review357-second-save','a3570000-0000-4000-8000-000000000001'));
insert into entry_observed values('submit-second',public.submit_questionnaire_session((select(v->>'session_id')::uuid from entry_observed where k='start-second'),2,'review357-second-submit','a3570000-0000-4000-8000-000000000001'));
insert into entry_observed values('draft',public.start_questionnaire_session('d0610000-0000-0000-0000-000000000001','d0660000-0000-0000-0000-000000000001','fr-MA',null,'review357-draft','a3570000-0000-4000-8000-000000000001'));
reset role;
select set_config('test.review357_qualification',(select v->>'qualification_id'from entry_observed where k='service-a'),true);
select set_config('test.review357_session',(select v->>'session_id'from entry_observed where k='start'),true);
select set_config('test.review357_draft',(select v->>'session_id'from entry_observed where k='draft'),true);
select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select count(*)::integer from public.questionnaire_sessions),0,'Compliant reviewer still has no direct SELECT access to actor-private sessions');
select is((select count(*)::integer from public.questionnaire_answer_revisions),0,'Reviewer gets no broad answer-revision SELECT privilege');
insert into entry_observed values('review-list',public.get_provider_qualification_questionnaire_review_v1(current_setting('test.review357_qualification')::uuid));
select is((select(v->>'total')::integer from entry_observed where k='review-list'),2,'only the two submitted applicable Provider sessions are listed');
select is((select v->'selected'from entry_observed where k='review-list'),'null'::jsonb,'no latest session is silently selected for the reviewer');
insert into entry_observed values('review',public.get_provider_qualification_questionnaire_review_v1(current_setting('test.review357_qualification')::uuid,current_setting('test.review357_session')::uuid));
select is((public.get_provider_qualification_questionnaire_review_v1((select(v->>'qualification_id')::uuid from entry_observed where k='service-b'))->>'total')::integer,0,'library-wide questionnaire with an explicit foreign service question is not applicable');
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1((select(v->>'qualification_id')::uuid from entry_observed where k='service-b'),current_setting('test.review357_session')::uuid)$$,'42501','QUALIFICATION_QUESTIONNAIRE_SCOPE_DENIED','reviewer cannot bind explicit service-A evidence to service-B qualification');
select is((select v#>>'{selected,questions,1,value}'from entry_observed where k='review'),'Expérience déposée en français العربية sans traduction.','true submitted free answer is returned intact with its frozen question');
select is((select v#>>'{selected,questions,0,labelFr}'from entry_observed where k='review'),'Avez-vous une politique ?','review question comes from the immutable questionnaire version');
select is((select(v#>>'{selected,engineScoreBasisPoints}')::integer from entry_observed where k='review'),8000,'actual native rule evaluation score is presented to the reviewer');
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1(current_setting('test.review357_qualification')::uuid,current_setting('test.review357_draft')::uuid)$$,'42501','QUALIFICATION_QUESTIONNAIRE_SCOPE_DENIED','a draft is not final review evidence');
select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1(current_setting('test.review357_qualification')::uuid,current_setting('test.review357_session')::uuid)$$,'42501','QUALIFICATION_REVIEW_MFA_REQUIRED','AAL1 cannot read the reviewer projection');
select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1(current_setting('test.review357_qualification')::uuid,current_setting('test.review357_session')::uuid)$$,'42501','QUALIFICATION_REVIEW_DENIED','Provider Owner cannot obtain the independent reviewer projection');
select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1(current_setting('test.review357_qualification')::uuid,current_setting('test.review357_session')::uuid)$$,'42501','QUALIFICATION_REVIEW_DENIED','Provider Viewer cannot read reviewer data');
select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1(current_setting('test.review357_qualification')::uuid,current_setting('test.review357_session')::uuid)$$,'42501','QUALIFICATION_REVIEW_DENIED','foreign Provider cannot read target questionnaire answers');
-- Produce a real submitted session in the second organisation via its owner.
insert into entry_observed values('foreign-profile',public.submit_provider_profile('d0610000-0000-0000-0000-000000000002','{"activity_summary":"Synthetic independent foreign Provider","team_size":2,"years_experience":1}',0,'review357-foreign-profile'));
insert into entry_observed values('foreign-service',public.request_provider_service('d0610000-0000-0000-0000-000000000002','d3450000-0000-4000-8000-000000000003','review357-foreign-service'));
insert into entry_observed values('foreign-session',public.start_questionnaire_session('d0610000-0000-0000-0000-000000000002','d0660000-0000-0000-0000-000000000001','fr-MA',null,'review357-foreign-start','a3570000-0000-4000-8000-000000000002'));
insert into entry_observed values('foreign-save',public.autosave_questionnaire_answers((select(v->>'session_id')::uuid from entry_observed where k='foreign-session'),1,'[{"question_version_id":"d0690000-0000-0000-0000-000000000001","value":true,"expected_answer_row_version":0},{"question_version_id":"d0690000-0000-0000-0000-000000000002","value":"Foreign private response","expected_answer_row_version":0}]','review357-foreign-save','a3570000-0000-4000-8000-000000000002'));
insert into entry_observed values('foreign-submit',public.submit_questionnaire_session((select(v->>'session_id')::uuid from entry_observed where k='foreign-session'),2,'review357-foreign-submit','a3570000-0000-4000-8000-000000000002'));
reset role;
select set_config('test.review357_foreign',(select v->>'session_id'from entry_observed where k='foreign-session'),true);
select set_config('request.jwt.claims','{"sub":"d0600000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1(current_setting('test.review357_qualification')::uuid,current_setting('test.review357_foreign')::uuid)$$,'42501','QUALIFICATION_QUESTIONNAIRE_SCOPE_DENIED','an authorized reviewer cannot attach another organisation session to this qualification');
create function pg_temp.decide_review357(p_hash text default null,p_session uuid default null,p_key text default'review357-approve')returns jsonb language sql as $$select public.decide_provider_qualification(current_setting('test.review357_qualification')::uuid,'APPROVED',coalesce(p_session,current_setting('test.review357_session')::uuid),8000,jsonb_build_array(jsonb_build_object('check','SUBMITTED_PROVIDER_QUESTIONNAIRE','passed',true),jsonb_build_object('check','HUMAN_EVIDENCE_REVIEW','passed',true,'review_context_hash',p_hash)),'[]','Human review of frozen submitted evidence','PROVIDER-QUALIFICATION-V1',null,1,p_key)$$;
select throws_ok($$select pg_temp.decide_review357('forged')$$,'23514','QUALIFICATION_QUESTIONNAIRE_REVIEW_REQUIRED','blind checkbox or forged review context cannot approve a Provider');
insert into entry_observed values('decision',pg_temp.decide_review357((select v#>>'{selected,contextHash}'from entry_observed where k='review'))),('decision-replay',pg_temp.decide_review357((select v#>>'{selected,contextHash}'from entry_observed where k='review')));
select is((select v from entry_observed where k='decision'),(select v from entry_observed where k='decision-replay'),'lost response returns the same governed decision after its state change');
select is((select v->>'outcome'from entry_observed where k='decision'),'PROVIDER_QUALIFICATION_DECIDED','independent Compliance reviewer completes the actual decision command');
select throws_ok($$select public.decide_provider_qualification(current_setting('test.review357_qualification')::uuid,'SUSPENDED',null,null,'[]','[]','Concurrent stale qualification review','PROVIDER-QUALIFICATION-V1',null,1,'review357-stale')$$,'40001','STALE_PROVIDER_QUALIFICATION','stale expected row version cannot mutate an approved qualification');
select is(public.decide_provider_qualification(current_setting('test.review357_qualification')::uuid,'SUSPENDED',null,null,'[]','[]','Suspend pending fresh independent review','PROVIDER-QUALIFICATION-V1',null,2,'review357-suspend')->>'outcome','PROVIDER_QUALIFICATION_DECIDED','approved qualification can be suspended through governed command');
select is(public.decide_provider_qualification(current_setting('test.review357_qualification')::uuid,'PENDING',null,null,'[]','[]','Reopen fresh independent review','PROVIDER-QUALIFICATION-V1',null,3,'review357-reopen')->>'outcome','PROVIDER_QUALIFICATION_DECIDED','suspended qualification can reopen PENDING without direct write');
select throws_ok($$select pg_temp.decide_review357((select v#>>'{selected,contextHash}'from entry_observed where k='review'),null,'review357-old-hash')$$,'23514','QUALIFICATION_QUESTIONNAIRE_REVIEW_REQUIRED','old reviewed context cannot authorize approval after qualification changed');
insert into entry_observed values('information-required',public.decide_provider_qualification((select(v->>'qualification_id')::uuid from entry_observed where k='service-b'),'INFORMATION_REQUIRED',null,null,'[]','[]','Service B needs further evidence','PROVIDER-QUALIFICATION-V1',null,1,'review357-information'));
select is(public.decide_provider_qualification((select(v->>'qualification_id')::uuid from entry_observed where k='service-b'),'PENDING',null,null,'[]','[]','Reopen Service B after further evidence','PROVIDER-QUALIFICATION-V1',null,2,'review357-information-reopen')->>'outcome','PROVIDER_QUALIFICATION_DECIDED','information-required qualification can reopen PENDING');
reset role;
select is((select d.score_basis_points from public.provider_qualification_decisions d where d.id=(select(v->>'decision_id')::uuid from entry_observed where k='decision')),8000,'real decision stores the attested native score');
select is((select count(*)::integer from public.provider_qualification_decisions where qualification_id=current_setting('test.review357_qualification')::uuid and status='APPROVED'),1,'replay produces no duplicate qualification decision');
select is((select count(*)::integer from public.audit_events where action='provider.qualification.decided'and resource_id=(select v->>'decision_id'from entry_observed where k='decision')),1,'one native decision audit remains');
select ok(not has_function_privilege('authenticated','public.decide_provider_qualification_pre_review_0384(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)','EXECUTE'),'the unbound legacy decision path is closed');
select ok(not has_function_privilege('authenticated','private.provider_qualification_review_session_v1(uuid,uuid)','EXECUTE'),'no direct API execution grant on the private response reader');
select ok(not has_function_privilege('service_role','public.get_provider_qualification_questionnaire_review_v1(uuid,uuid,integer)','EXECUTE'),'worker role cannot bypass independent reviewer identity');
select *from finish();rollback;
