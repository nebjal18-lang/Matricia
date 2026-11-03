begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('d0600000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-owner@example.invalid','',now(),'{}','{}',now(),now()),
('d0600000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-outsider@example.invalid','',now(),'{}','{}',now(),now()),
('d0600000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-admin@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('d0610000-0000-4000-8000-000000000001','P06 Session Tenant A','P06 Session A','ACTIVE','d0600000-0000-4000-8000-000000000001'),
('d0610000-0000-4000-8000-000000000002','P06 Session Tenant B','P06 Session B','ACTIVE','d0600000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('d0620000-0000-4000-8000-000000000001','d0610000-0000-4000-8000-000000000001','d0600000-0000-4000-8000-000000000001','ACTIVE',now()),
('d0620000-0000-4000-8000-000000000002','d0610000-0000-4000-8000-000000000002','d0600000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('d0620000-0000-4000-8000-000000000001','CLIENT_OWNER'),
('d0620000-0000-4000-8000-000000000002','CLIENT_OWNER');
-- Published test-only quota and activated trial, required by the real start command.
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('d0610000-0000-4000-8000-000000000001','ICE','997245000000001','VERIFIED'),('d0610000-0000-4000-8000-000000000001','IF','99724501','VERIFIED'),('d0610000-0000-4000-8000-000000000001','RC','TEST245','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('d0700000-0000-4000-8000-000000000001','d0610000-0000-4000-8000-000000000001','VERIFIED',1,'d0600000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('d0700000-0000-4000-8000-000000000001','d0610000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99724501","rc_number":"TEST245","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"},"incorporation_date":"2020-01-01","activity":"TEST Questionnaire acceptance activity","sector":"TEST Services","employee_count":3,"contact":{"phone":"+212600000301","email":"test-client-0301@example.invalid"},"representative":{"first_name":"TEST","last_name":"Client","title":"TEST representative","email":"test-representative-0301@example.invalid","phone":"+212600000302","power":"TEST representation authority"},"declarations":{"accuracy_confirmed":true,"representation_authorized":true}}','{"legal_name":"Payment 245 SARL","display_name":"Payment 245 SARL","country_code":"MA","identifiers":{"ICE":"997245000000001","IF":"99724501","RC":"TEST245"}}',1,'d0600000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('d0700000-0000-4000-8000-000000000001','d0610000-0000-4000-8000-000000000001',1,now()-interval'1 day','d0600000-0000-4000-8000-000000000003','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f2491000-0000-0000-0000-000000000001','d0700000-0000-4000-8000-000000000001','d0610000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'d0610000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'d0600000-0000-4000-8000-000000000003',clock_timestamp(),'d0600000-0000-4000-8000-000000000001'),
('f2491000-0000-0000-0000-000000000002','d0700000-0000-4000-8000-000000000001','d0610000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'d0610000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'d0600000-0000-4000-8000-000000000003',clock_timestamp(),'d0600000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f2492000-0000-0000-0000-000000000001','f2491000-0000-0000-0000-000000000001','d0610000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f2493000-0000-0000-0000-000000000001'),
('f2492000-0000-0000-0000-000000000002','f2491000-0000-0000-0000-000000000002','d0610000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f2493000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f2491000-0000-0000-0000-000000000001' then 'f2492000-0000-0000-0000-000000000001'::uuid
  else 'f2492000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f2491000-0000-0000-0000-000000000001','f2491000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('d0700000-0000-4000-8000-000000000001','d0610000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','d0600000-0000-4000-8000-000000000003',clock_timestamp(),'d0600000-0000-4000-8000-000000000001','f2491000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('d0700000-0000-4000-8000-000000000001','d0610000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','d0600000-0000-4000-8000-000000000003',clock_timestamp(),'d0600000-0000-4000-8000-000000000001','f2491000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');




insert into public.client_trials(id,organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('d0700000-0000-4000-8000-000000000002','d0610000-0000-4000-8000-000000000001','d0700000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',now()-interval'1 day',now()+interval'29 days','d0600000-0000-4000-8000-000000000003');
insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,quota_value,configuration,effective_from,content_hash,created_by)values('TEST_0301_DIAGNOSTICS',1,'ACTIVE',true,10,'{"resource":"DIAGNOSTICS"}',now()-interval'1 day',repeat('9',64),'d0600000-0000-4000-8000-000000000003');
insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,quota_value,configuration,effective_from,content_hash,created_by)values('TEST_0301_SITES',1,'ACTIVE',true,1,'{"resource":"SITES"}',now()-interval'1 day',repeat('8',64),'d0600000-0000-4000-8000-000000000003');
insert into public.platform_user_roles(user_id,role_code)values('d0600000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('d0630000-0000-4000-8000-000000000001','P06_SESSIONS','p06-sessions','d0610000-0000-4000-8000-000000000001','PUBLISHED','d0600000-0000-4000-8000-000000000003');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,created_by,audience,effective_from,published_at)values('d0640000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','P06.SESSIONS.V1','PUBLISHED',repeat('a',64),repeat('b',64),'d0600000-0000-4000-8000-000000000003','{"kind":"PUBLIC"}',now()-interval'1 day',now()-interval'1 day');
update public.catalog_libraries set current_release_id='d0640000-0000-4000-8000-000000000001'where id='d0630000-0000-4000-8000-000000000001';
insert into public.questionnaires(id,library_id,code,status,created_by)values('d0650000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','SESSION_ENGINE','DRAFT','d0600000-0000-4000-8000-000000000003');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by)values('d0660000-0000-4000-8000-000000000001','d0650000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','d0640000-0000-4000-8000-000000000001',1,'DRAFT','Session reproductible','جلسة قابلة للتكرار','Validation finale versionnée','تحقق نهائي بإصدار','CLIENT','2.0.0','P06-SESSIONS-1',repeat('0',64),'APPROVED','d0600000-0000-4000-8000-000000000003',now(),repeat('c',64),1,'Sessions versionnées','d0600000-0000-4000-8000-000000000003');
insert into public.questionnaire_sections(id,questionnaire_version_id,section_key,label_fr,label_ar,sort_order,content_hash)values('d0670000-0000-4000-8000-000000000001','d0660000-0000-4000-8000-000000000001','GENERAL','Général','عام',1,repeat('d',64));
insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by)values
('d0680000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','HAS_POLICY','LIBRARY','DRAFT','d0600000-0000-4000-8000-000000000003'),
('d0680000-0000-4000-8000-000000000002','d0630000-0000-4000-8000-000000000001','POLICY_DETAIL','LIBRARY','DRAFT','d0600000-0000-4000-8000-000000000003');
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,required_by_default,sensitivity,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,weight,maximum_score,content_hash,change_reason,created_by,published_at)values
('d0690000-0000-4000-8000-000000000001','d0680000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001',1,'PUBLISHED','Avez-vous une politique ?','هل لديكم سياسة؟','YES_NO','session.has_policy',true,'BUSINESS','APPROVED','d0600000-0000-4000-8000-000000000003',now(),repeat('e',64),1,1,1,repeat('1',64),'Question session','d0600000-0000-4000-8000-000000000003',now()),
('d0690000-0000-4000-8000-000000000002','d0680000-0000-4000-8000-000000000002','d0630000-0000-4000-8000-000000000001',1,'PUBLISHED','Décrivez la politique','صف السياسة','SHORT_TEXT','session.policy_detail',false,'CONFIDENTIAL','APPROVED','d0600000-0000-4000-8000-000000000003',now(),repeat('f',64),1,1,1,repeat('2',64),'Question session','d0600000-0000-4000-8000-000000000003',now());
update public.question_bank_questions set status='PUBLISHED',current_published_version_id=case when question_key='HAS_POLICY'then'd0690000-0000-4000-8000-000000000001'::uuid else'd0690000-0000-4000-8000-000000000002'::uuid end where library_id='d0630000-0000-4000-8000-000000000001';
insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order)values
('d0660000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','d0670000-0000-4000-8000-000000000001','d0690000-0000-4000-8000-000000000001',1),
('d0660000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','d0670000-0000-4000-8000-000000000001','d0690000-0000-4000-8000-000000000002',2);
insert into public.question_rules(id,library_id,rule_key,status,created_by)values
('d06a0000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','HIDE_DETAIL','DRAFT','d0600000-0000-4000-8000-000000000003'),
('d06a0000-0000-4000-8000-000000000002','d0630000-0000-4000-8000-000000000001','POLICY_SCORE','DRAFT','d0600000-0000-4000-8000-000000000003');
insert into public.question_rule_versions(id,rule_id,library_id,version,status,condition_ast,actions,dependency_graph,priority,compiled_hash,change_reason,created_by,published_at)values
('d06b0000-0000-4000-8000-000000000001','d06a0000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001',1,'PUBLISHED','{"operator":"EQ","question_version_id":"d0690000-0000-4000-8000-000000000001","value":false}','[{"type":"HIDE","target":"d0690000-0000-4000-8000-000000000002"}]','{"d0690000-0000-4000-8000-000000000001":[]}',10,repeat('3',64),'Masquage conditionnel','d0600000-0000-4000-8000-000000000003',now()),
('d06b0000-0000-4000-8000-000000000002','d06a0000-0000-4000-8000-000000000002','d0630000-0000-4000-8000-000000000001',1,'PUBLISHED','{"operator":"EQ","question_version_id":"d0690000-0000-4000-8000-000000000001","value":true}','[{"type":"SCORE","dimension":"GLOBAL","delta_basis_points":8000},{"type":"REQUIRED","target":"d0690000-0000-4000-8000-000000000002"}]','{"d0690000-0000-4000-8000-000000000001":[]}',20,repeat('4',64),'Scoring versionné','d0600000-0000-4000-8000-000000000003',now());
update public.question_rules set status='PUBLISHED',current_published_version_id=case when rule_key='HIDE_DETAIL'then'd06b0000-0000-4000-8000-000000000001'::uuid else'd06b0000-0000-4000-8000-000000000002'::uuid end where library_id='d0630000-0000-4000-8000-000000000001';
insert into public.questionnaire_version_rules(questionnaire_version_id,library_id,rule_version_id,evaluation_order)values
('d0660000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','d06b0000-0000-4000-8000-000000000001',10),
('d0660000-0000-4000-8000-000000000001','d0630000-0000-4000-8000-000000000001','d06b0000-0000-4000-8000-000000000002',20);
update public.questionnaire_versions set snapshot_hash=private.compute_questionnaire_snapshot_hash(id,jsonb_build_object('questionnaire_id',questionnaire_id,'library_id',library_id,'release_id',catalog_release_id,'version',version,'title_fr',title_fr,'title_ar',title_ar,'description_fr',description_fr,'description_ar',description_ar,'audience',audience,'engine_version',engine_version,'policy_version',policy_version)),status='PUBLISHED',published_at=now(),row_version=row_version+1 where id='d0660000-0000-4000-8000-000000000001';
update public.questionnaires set status='PUBLISHED',current_published_version_id='d0660000-0000-4000-8000-000000000001',row_version=row_version+1 where id='d0650000-0000-4000-8000-000000000001';
set constraints all immediate;set constraints all deferred;


insert into auth.sessions(id,user_id,aal,created_at,updated_at) values
('d06f0000-0000-4000-8000-000000000001','d0600000-0000-4000-8000-000000000001','aal1',now(),now()),
('d06f0000-0000-4000-8000-000000000002','d0600000-0000-4000-8000-000000000002','aal1',now(),now());
create temporary table observed(k text primary key,v jsonb); grant select,insert on observed to authenticated;
-- The browser seed helper reuses this profile. Validate its real public-write
-- contract instead of weakening the onboarding read model for an incomplete seed.
select lives_ok($$select private.validate_client_profile_payload((select profile_data from public.client_profile_versions where compliance_case_id='d0700000-0000-4000-8000-000000000001'and version=1))$$,'questionnaire fixture contains a complete profile accepted by canonical onboarding validation');
select ok(not has_function_privilege('anon','public.questionnaire_session_presentation(uuid)','EXECUTE'),'anonymous cannot load session presentation');
select ok(not has_function_privilege('service_role','public.questionnaire_session_presentation(uuid)','EXECUTE'),'background service cannot impersonate a session owner');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d0600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d06f0000-0000-4000-8000-000000000001"}',true);
select lives_ok($$select public.create_client_site('d0610000-0000-4000-8000-000000000001','TEST301_A','Site de test A','موقع اختبار أ','{"country":"MA","city":"TEST"}','Site uniquement pour recette','client301-site-first')$$,'published quota admits the first site');
select throws_ok($$select public.create_client_site('d0610000-0000-4000-8000-000000000001','TEST301_B','Site de test B','موقع اختبار ب','{"country":"MA","city":"TEST"}','Site uniquement pour recette','client301-site-over')$$,'54000','SUBSCRIPTION_QUOTA_EXCEEDED','native creation refuses the first site above the quota');
insert into observed values('start',public.start_questionnaire_session('d0610000-0000-4000-8000-000000000001','d0660000-0000-4000-8000-000000000001','fr-MA',null,'client-presentation-start','d06c0000-0000-4000-8000-000000000001'));
insert into observed values('initial',public.questionnaire_session_presentation((select(v->>'session_id')::uuid from observed where k='start')));
select is((select v->>'row_version' from observed where k='initial'),'1','presentation pins the current session version');
select is((select v->'questions'->1->>'required' from observed where k='initial'),'false','untriggered conditional question remains optional');
insert into observed values('true-save',public.autosave_questionnaire_answers((select(v->>'session_id')::uuid from observed where k='start'),1,'[{"question_version_id":"d0690000-0000-4000-8000-000000000001","value":true,"expected_answer_row_version":0}]','client-presentation-save-true','d06c0000-0000-4000-8000-000000000002'));
insert into observed values('true',public.questionnaire_session_presentation((select(v->>'session_id')::uuid from observed where k='start')));
select is((select v->'questions'->1->>'required' from observed where k='true'),'true','saved answer triggers required rule in presentation');
select is((select v->'questions'->1->>'visible' from observed where k='true'),'true','required detail is visible');
select throws_ok($$select public.submit_questionnaire_session((select(v->>'session_id')::uuid from observed where k='start'),2,'client-presentation-submit-missing','d06c0000-0000-4000-8000-000000000003')$$,'23514','REQUIRED_ANSWERS_MISSING','server independently refuses missing conditional required answer');
insert into observed values('false-save',public.autosave_questionnaire_answers((select(v->>'session_id')::uuid from observed where k='start'),2,'[{"question_version_id":"d0690000-0000-4000-8000-000000000001","value":false,"expected_answer_row_version":1}]','client-presentation-save-false','d06c0000-0000-4000-8000-000000000004'));
insert into observed values('false',public.questionnaire_session_presentation((select(v->>'session_id')::uuid from observed where k='start')));
select is((select v->'questions'->1->>'visible' from observed where k='false'),'false','changed answer hides irrelevant detail');
insert into observed values('submitted',public.submit_questionnaire_session((select(v->>'session_id')::uuid from observed where k='start'),3,'client-presentation-submit','d06c0000-0000-4000-8000-000000000005'));
insert into observed values('final',public.questionnaire_session_presentation((select(v->>'session_id')::uuid from observed where k='start')));
select is((select v->'questions' from observed where k='final'),(select v->'questions' from observed where k='false'),'submitted view preserves evaluated visibility');
select set_config('request.jwt.claims','{"sub":"d0600000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"d06f0000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.questionnaire_session_presentation((select(v->>'session_id')::uuid from observed where k='start'))$$,'42501','SESSION_SCOPE_DENIED','other organization cannot inspect presentation');
reset role;
update public.organization_member_roles set revoked_at=now() where membership_id='d0620000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d0600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d06f0000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select public.questionnaire_session_presentation((select(v->>'session_id')::uuid from observed where k='start'))$$,'42501','SESSION_SCOPE_DENIED','revoked owner cannot recover saved presentation');
reset role;
select*from finish();
rollback;
