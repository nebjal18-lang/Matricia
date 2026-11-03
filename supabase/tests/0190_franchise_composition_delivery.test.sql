begin;set local search_path=public,extensions;select plan(13);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fb100000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-composition-admin@example.invalid','',now(),'{}','{}',now(),now()),
('fb100000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-composition-outsider@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('fb100000-0000-0000-0000-000000000001','MATRICIA_ADMIN');
insert into public.organizations(id,legal_name,display_name,status,created_by)values('fb110000-0000-0000-0000-000000000001','P06 Composition Steward','P06 Composition Steward','ACTIVE','fb100000-0000-0000-0000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('fb120000-0000-0000-0000-000000000001','P06_COMPOSE','p06-compose','fb110000-0000-0000-0000-000000000001','DRAFT','fb100000-0000-0000-0000-000000000001');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by)values('fb130000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001','P06.COMPOSE.V1','DRAFT',repeat('b',64),'fb100000-0000-0000-0000-000000000001');
insert into public.question_bank_questions(id,library_id,question_key,scope,created_by)values('fb140000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001','P06_APPROVED','LIBRARY','fb100000-0000-0000-0000-000000000001');
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,content_hash,change_reason,created_by)values('fb141000-0000-0000-0000-000000000001','fb140000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001',1,'APPROVED','Question approuvée','سؤال معتمد','YES_NO','p06.approved',repeat('c',64),'Version approuvée','fb100000-0000-0000-0000-000000000001');
insert into public.question_rules(id,library_id,rule_key,created_by)values('fb150000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001','P06_APPROVED_RULE','fb100000-0000-0000-0000-000000000001'),('fb150000-0000-0000-0000-000000000002','fb120000-0000-0000-0000-000000000001','P06_SENSITIVE_RULE','fb100000-0000-0000-0000-000000000001');
insert into public.question_rule_versions(id,rule_id,library_id,version,status,condition_ast,actions,dependency_graph,priority,sensitive,compiled_hash,change_reason,created_by)values
('fb151000-0000-0000-0000-000000000001','fb150000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001',1,'APPROVED','{"operator":"EQ","question_version_id":"fb141000-0000-0000-0000-000000000001","value":true}','[{"type":"HUMAN_REVIEW"}]','{}',10,false,repeat('d',64),'Version approuvée','fb100000-0000-0000-0000-000000000001'),
('fb151000-0000-0000-0000-000000000002','fb150000-0000-0000-0000-000000000002','fb120000-0000-0000-0000-000000000001',1,'APPROVED','{"operator":"EQ","question_version_id":"fb141000-0000-0000-0000-000000000001","value":true}','[{"type":"HUMAN_REVIEW"}]','{}',20,true,repeat('e',64),'Version sensible','fb100000-0000-0000-0000-000000000001');
create temporary table p06_compose_observed(key text primary key,value jsonb);grant select,insert on p06_compose_observed to authenticated;grant usage on schema extensions to authenticated;

set local role authenticated;select set_config('request.jwt.claims','{"sub":"fb100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p06_compose_observed values('created',public.create_catalog_questionnaire('fb120000-0000-0000-0000-000000000001','fb130000-0000-0000-0000-000000000001','COMPOSE','{"title_fr":"Diagnostic composé","title_ar":"تشخيص مركب","description_fr":"Questionnaire de composition","description_ar":"استبيان التكوين","audience":"CLIENT","engine_version":"1.0.0","policy_version":"P06-2","sensitive":false,"section_key":"GENERAL","section_label_fr":"Général","section_label_ar":"عام"}','Création composition','compose-create'));

insert into p06_compose_observed values('saved',public.save_franchise_questionnaire_composition(
(select(value->>'version_id')::uuid from p06_compose_observed where key='created'),
'[{"key":"GENERAL","labelFr":"Général","labelAr":"عام","helpFr":"Aide conservée","helpAr":"مساعدة محفوظة"}]',
'[{"versionId":"fb141000-0000-0000-0000-000000000001","sectionKey":"GENERAL","required":true}]',
'["fb151000-0000-0000-0000-000000000001"]',1,'franchise-compose-save'));
insert into p06_compose_observed values('replay',public.save_franchise_questionnaire_composition(
(select(value->>'version_id')::uuid from p06_compose_observed where key='created'),
'[{"key":"GENERAL","labelFr":"Général","labelAr":"عام","helpFr":"Aide conservée","helpAr":"مساعدة محفوظة"}]',
'[{"versionId":"fb141000-0000-0000-0000-000000000001","sectionKey":"GENERAL","required":true}]',
'["fb151000-0000-0000-0000-000000000001"]',1,'franchise-compose-save'));
reset role;
select is((select value from p06_compose_observed where key='saved'),(select value from p06_compose_observed where key='replay'),'network retry returns the original durable response');
select is((select value->>'row_version' from p06_compose_observed where key='saved'),'2','one atomic save advances the optimistic version once');
select is((select count(*) from public.questionnaire_version_questions where questionnaire_version_id=(select(value->>'version_id')::uuid from p06_compose_observed where key='created')),1::bigint,'selected real approved question is persisted');
select is((select count(*) from public.questionnaire_version_rules where questionnaire_version_id=(select(value->>'version_id')::uuid from p06_compose_observed where key='created')),1::bigint,'selected approved rule is persisted');
select is((select help_ar from public.questionnaire_sections where questionnaire_version_id=(select(value->>'version_id')::uuid from p06_compose_observed where key='created')),'مساعدة محفوظة','bilingual section help survives a full composition save');
select is((select count(*) from public.audit_events where action='catalog.questionnaire.composition_saved' and resource_id=(select value->>'questionnaire_id' from p06_compose_observed where key='created')),1::bigint,'idempotent save writes exactly one audit record');
select is((select count(*) from public.event_outbox where event_type='QuestionnaireCompositionSavedV1' and aggregate_id=(select value->>'questionnaire_id' from p06_compose_observed where key='created')),1::bigint,'idempotent save writes exactly one outbox record');
set local role authenticated;
select throws_ok($$select public.save_franchise_questionnaire_composition((select(value->>'version_id')::uuid from p06_compose_observed where key='created'),'[{"key":"GENERAL","labelFr":"Général","labelAr":"عام"}]','[]','[]',1,'franchise-compose-stale')$$,'40001','STALE_CATALOG_VERSION','concurrent editor is rejected');
select throws_ok($$select public.save_franchise_questionnaire_composition((select(value->>'version_id')::uuid from p06_compose_observed where key='created'),'[{"key":"GENERAL","labelFr":"Général","labelAr":"عام"}]','[]','["fb151000-0000-0000-0000-000000000001"]',2,'franchise-compose-bad-rule')$$,'22023','RULE_REFERENCE_OR_OPERATOR_INVALID','a rule cannot reference a question outside this composition');
select set_config('request.jwt.claims','{"sub":"fb100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.save_franchise_questionnaire_composition((select(value->>'version_id')::uuid from p06_compose_observed where key='created'),'[{"key":"GENERAL","labelFr":"Général","labelAr":"عام"}]','[]','[]',2,'franchise-compose-denied')$$,'42501','CATALOG_SCOPE_DENIED','foreign user cannot edit this library composition');
reset role;
select ok(not has_function_privilege('anon','public.save_franchise_questionnaire_composition(uuid,jsonb,jsonb,jsonb,integer,text,uuid)','EXECUTE'),'anonymous composition execution is denied');
select ok(not has_function_privilege('service_role','public.save_franchise_questionnaire_composition(uuid,jsonb,jsonb,jsonb,integer,text,uuid)','EXECUTE'),'service role cannot bypass the user composition workflow');
select ok(not has_table_privilege('authenticated','public.questionnaire_version_rules','INSERT'),'direct composition writes remain denied');
select * from finish();rollback;
