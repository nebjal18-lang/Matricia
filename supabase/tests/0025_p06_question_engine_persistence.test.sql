begin;
set local search_path=public,extensions;
select plan(119);

select has_table('public','questionnaires','questionnaire identities exist');
select has_table('public','questionnaire_versions','questionnaire versions exist');
select has_table('public','questionnaire_sections','versioned sections exist');
select has_table('public','question_bank_questions','question bank identities exist');
select has_table('public','question_versions','immutable question versions exist');
select has_table('public','questionnaire_version_questions','questionnaire snapshots pin question versions');
select has_table('public','question_rules','rule identities exist');
select has_table('public','question_rule_versions','compiled rule versions exist');
select has_table('public','questionnaire_version_rules','questionnaire snapshots pin rule versions');
select has_table('public','questionnaire_sessions','diagnostic sessions exist');
select has_table('public','questionnaire_answers','current answer aggregates exist');
select has_table('public','questionnaire_answer_revisions','immutable answer revisions exist');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('questionnaires','questionnaire_versions','questionnaire_sections','question_bank_questions','question_versions','questionnaire_version_questions','question_rules','question_rule_versions','questionnaire_version_rules','questionnaire_sessions','questionnaire_answers','questionnaire_answer_revisions')),'RLS is enabled on every exposed W2 table');
select ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=pg_catalog']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('publish_questionnaire_version','start_questionnaire_session','autosave_questionnaire_answers','submit_questionnaire_session')),'public commands are SECURITY DEFINER with fixed pg_catalog search_path');
select has_function('public','publish_questionnaire_version',array['uuid','integer','text','uuid'],'controlled questionnaire publication command exists');
select ok(not has_function_privilege('anon','public.start_questionnaire_session(uuid,uuid,text,timestamptz,text,uuid,uuid)','EXECUTE'),'anon cannot execute session start');
select ok(not has_function_privilege('anon','public.autosave_questionnaire_answers(uuid,integer,jsonb,text,uuid)','EXECUTE'),'anon cannot execute autosave');
select ok(not has_function_privilege('service_role','public.submit_questionnaire_session(uuid,integer,text,uuid)','EXECUTE'),'service role cannot impersonate a questionnaire submitter');
select ok(has_function_privilege('authenticated','public.publish_questionnaire_version(uuid,integer,text,uuid)','EXECUTE'),'authenticated can invoke only the guarded publication command');
select ok(has_function_privilege('authenticated','public.autosave_questionnaire_answers(uuid,integer,jsonb,text,uuid)','EXECUTE') and not has_function_privilege('service_role','public.autosave_questionnaire_answers(uuid,integer,jsonb,text,uuid)','EXECUTE'),'autosave uses the authenticated actor identity and excludes service-role impersonation');
select ok(not has_table_privilege('authenticated','public.questionnaire_answers','INSERT'),'authenticated has no direct answer INSERT privilege by default');
select ok(has_table_privilege('service_role','public.question_rules','SELECT') and has_table_privilege('service_role','public.question_rule_versions','SELECT') and has_table_privilege('service_role','public.questionnaire_version_rules','SELECT'),'service_role SELECT allowlist contains exactly the three rule identity, AST version and snapshot-link tables');
select ok(not has_table_privilege('service_role','public.questionnaires','SELECT') and not has_table_privilege('service_role','public.questionnaire_versions','SELECT') and not has_table_privilege('service_role','public.questionnaire_sections','SELECT') and not has_table_privilege('service_role','public.question_bank_questions','SELECT') and not has_table_privilege('service_role','public.question_versions','SELECT') and not has_table_privilege('service_role','public.questionnaire_version_questions','SELECT') and not has_table_privilege('service_role','public.questionnaire_sessions','SELECT') and not has_table_privilege('service_role','public.questionnaire_answers','SELECT') and not has_table_privilege('service_role','public.questionnaire_answer_revisions','SELECT'),'service_role has no SELECT on any W2 table outside the explicit rule allowlist, including sessions and answer history');
select has_index('public','questionnaire_versions','questionnaire_one_published_version_uidx','questionnaires enforce one published version');
select has_index('public','question_versions','question_one_published_version_uidx','questions enforce one published version');
select has_index('public','question_rule_versions','question_rule_one_published_version_uidx','rules enforce one published version');
select ok(private.is_controlled_question_pattern('^[A-Z]+$'),'controlled anchored linear regex is accepted');
select ok(not private.is_controlled_question_pattern('^(a|aa)+$') and not private.is_controlled_question_pattern('^(a)(?:\\1)+$') and not private.is_controlled_question_pattern('^a{1,101}$') and not private.is_controlled_question_pattern('^a+a+$') and not private.is_controlled_question_pattern('[A-Z]+'),'regex subset rejects alternation, backrefs, oversized repetitions, multiple unbounded quantifiers and unanchored patterns');
select ok(private.is_valid_typed_question_answer('TABLE',false,'[]','{}','{}',$${"version":"1","kind":"TABLE","minRows":1,"maxRows":2,"columns":[{"key":"COUNT","type":"INTEGER","nullable":false,"numeric":{"precision":3,"scale":0,"rounding":"HALF_EVEN"},"validation":{"minimum":"1","maximum":"100"}},{"key":"WHEN","type":"DATE","nullable":false}]}$$::jsonb,$$[{"COUNT":{"kind":"INTEGER","value":"10"},"WHEN":"2026-09-11"}]$$::jsonb),'TABLE recursively validates exact integer metadata and date fields');
select ok(not private.is_valid_typed_question_answer('TABLE',false,'[]','{}','{}',$${"version":"1","kind":"TABLE","minRows":1,"maxRows":2,"columns":[{"key":"COUNT","type":"INTEGER","nullable":false,"numeric":{"precision":3,"scale":0,"rounding":"HALF_EVEN"},"validation":{"minimum":"1","maximum":"100"}},{"key":"WHEN","type":"DATE","nullable":false}]}$$::jsonb,$$[{"COUNT":{"kind":"INTEGER","value":"101"},"WHEN":"2026-09-11"}]$$::jsonb),'TABLE rejects nested numeric bounds violations');
select ok(private.is_valid_typed_question_answer('REPEATER',false,'[]','{}','{}',$${"version":"1","kind":"REPEATER","minItems":1,"maxItems":2,"children":[{"key":"LEVEL","type":"SINGLE_CHOICE","nullable":false,"options":["LOW","HIGH"]}]}$$::jsonb,$$[{"LEVEL":"HIGH"}]$$::jsonb),'REPEATER recursively validates an allowed nested option');
select ok(not private.is_valid_typed_question_answer('REPEATER',false,'[]','{}','{}',$${"version":"1","kind":"REPEATER","minItems":1,"maxItems":2,"children":[{"key":"LEVEL","type":"SINGLE_CHOICE","nullable":false,"options":["LOW","HIGH"]}]}$$::jsonb,$$[{"LEVEL":"OTHER"}]$$::jsonb),'REPEATER rejects a nested option outside the field metadata');
select ok(not private.is_valid_typed_question_answer('DATE',false,'[]','{}','{}',null,'"2026-02-30"'::jsonb),'calendar-invalid dates fail closed');
select ok(not private.is_valid_typed_question_answer('TIME',false,'[]','{}','{}',null,$${"kind":"LOCAL_TIME","localDate":"2026-11-01","localTime":"01:30","timeZone":"America/New_York","dstPolicy":"REJECT"}$$::jsonb) and private.is_valid_typed_question_answer('TIME',false,'[]','{}','{}',null,$${"kind":"LOCAL_TIME","localDate":"2026-11-01","localTime":"01:30","timeZone":"America/New_York","dstPolicy":"EARLIER"}$$::jsonb),'DST fold obeys REJECT versus explicit EARLIER policy');
select ok(private.is_valid_typed_question_answer('DECIMAL',false,'[]',$${"precision":5,"scale":2,"rounding":"HALF_EVEN"}$$::jsonb,$${"minimum":"0","maximum":"100"}$$::jsonb,null,$${"kind":"DECIMAL","value":"12.345"}$$::jsonb) and not private.is_valid_typed_question_answer('DECIMAL',false,'[]',$${"precision":5,"scale":2,"rounding":"HALF_EVEN"}$$::jsonb,$${"minimum":"0","maximum":"100"}$$::jsonb,null,$${"kind":"DECIMAL","value":"1234.56"}$$::jsonb),'exact decimal rounding occurs before precision and bounds validation');
select ok(private.round_exact_question_numeric(2.5,0,'HALF_UP')=3 and private.round_exact_question_numeric(2.5,0,'HALF_EVEN')=2 and private.round_exact_question_numeric(-2.1,0,'DOWN')=-2 and private.round_exact_question_numeric(-2.1,0,'UP')=-3,'HALF_UP, HALF_EVEN, DOWN and UP match TypeScript magnitude rounding');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c2500000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-w2-client@example.invalid','',now(),'{}','{}',now(),now()),
('c2500000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-w2-outsider@example.invalid','',now(),'{}','{}',now(),now()),
('c2500000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-w2-admin@example.invalid','',now(),'{}','{}',now(),now()),
('c2500000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-w2-provider@example.invalid','',now(),'{}','{}',now(),now()),
('c2500000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-w2-inactive@example.invalid','',now(),'{}','{}',now(),now()),
('c2500000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-w2-viewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('c2510000-0000-0000-0000-000000000001','P06 W2 Client A','P06 W2 A','ACTIVE','c2500000-0000-0000-0000-000000000001'),
('c2510000-0000-0000-0000-000000000002','P06 W2 Client B','P06 W2 B','ACTIVE','c2500000-0000-0000-0000-000000000002'),
('c2510000-0000-0000-0000-000000000003','P06 W2 Inactive','P06 W2 inactive','ARCHIVED','c2500000-0000-0000-0000-000000000005');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
('c2520000-0000-0000-0000-000000000001','c2510000-0000-0000-0000-000000000001','c2500000-0000-0000-0000-000000000001','ACTIVE',now()),
('c2520000-0000-0000-0000-000000000002','c2510000-0000-0000-0000-000000000002','c2500000-0000-0000-0000-000000000002','ACTIVE',now()),
('c2520000-0000-0000-0000-000000000004','c2510000-0000-0000-0000-000000000001','c2500000-0000-0000-0000-000000000004','ACTIVE',now()),
('c2520000-0000-0000-0000-000000000005','c2510000-0000-0000-0000-000000000003','c2500000-0000-0000-0000-000000000005','ACTIVE',now()),
('c2520000-0000-0000-0000-000000000006','c2510000-0000-0000-0000-000000000002','c2500000-0000-0000-0000-000000000004','ACTIVE',now()),
('c2520000-0000-0000-0000-000000000007','c2510000-0000-0000-0000-000000000001','c2500000-0000-0000-0000-000000000006','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) values
('c2520000-0000-0000-0000-000000000001','CLIENT_MEMBER'),
('c2520000-0000-0000-0000-000000000002','CLIENT_MEMBER'),
('c2520000-0000-0000-0000-000000000004','PROVIDER_MANAGER'),
('c2520000-0000-0000-0000-000000000005','CLIENT_MEMBER'),
('c2520000-0000-0000-0000-000000000006','CLIENT_MEMBER'),
('c2520000-0000-0000-0000-000000000007','CLIENT_VIEWER');
insert into public.platform_user_roles(user_id,role_code) values ('c2500000-0000-0000-0000-000000000003','MATRICIA_ADMIN');

insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by) values
('c2530000-0000-0000-0000-000000000001','P06_W2_A','p06-w2-a','c2510000-0000-0000-0000-000000000001','c2500000-0000-0000-0000-000000000003'),
('c2530000-0000-0000-0000-000000000002','P06_W2_B','p06-w2-b','c2510000-0000-0000-0000-000000000002','c2500000-0000-0000-0000-000000000003');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,created_by,audience,effective_from,published_at) values
('c2540000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','P06.W2.A',repeat('P',0)||'PUBLISHED',repeat('a',64),repeat('b',64),'c2500000-0000-0000-0000-000000000003','{"kind":"PUBLIC"}',now()-interval '1 day',now()-interval '1 day'),
('c2540000-0000-0000-0000-000000000002','c2530000-0000-0000-0000-000000000002','P06.W2.B','PUBLISHED',repeat('c',64),repeat('d',64),'c2500000-0000-0000-0000-000000000003','{"kind":"PUBLIC"}',now()-interval '1 day',now()-interval '1 day');
update public.catalog_libraries set current_release_id='c2540000-0000-0000-0000-000000000001' where id='c2530000-0000-0000-0000-000000000001';
update public.catalog_libraries set current_release_id='c2540000-0000-0000-0000-000000000002' where id='c2530000-0000-0000-0000-000000000002';

insert into public.questionnaires(id,library_id,code,status,created_by) values
('c2550000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','CLIENT_DIAGNOSTIC','DRAFT','c2500000-0000-0000-0000-000000000003');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by,published_at) values
('c2560000-0000-0000-0000-000000000001','c2550000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','c2540000-0000-0000-0000-000000000001',1,'DRAFT','Diagnostic client','تشخيص العميل','Diagnostic initial','التشخيص الأولي','CLIENT','1.0.0','P06-W2-1',repeat('e',64),'APPROVED','c2500000-0000-0000-0000-000000000003',now(),repeat('5',64),1,'Version initiale','c2500000-0000-0000-0000-000000000003',null);
insert into public.questionnaire_sections(id,questionnaire_version_id,section_key,label_fr,label_ar,sort_order,content_hash) values
('c2570000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','GENERAL','Général','عام',1,repeat('1',64));
insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by) values
('c2580000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','HAS_POLICY','LIBRARY','DRAFT','c2500000-0000-0000-0000-000000000003'),
('c2580000-0000-0000-0000-000000000002','c2530000-0000-0000-0000-000000000001','POLICY_NOTE','LIBRARY','DRAFT','c2500000-0000-0000-0000-000000000003'),
('c2580000-0000-0000-0000-000000000003','c2530000-0000-0000-0000-000000000002','FOREIGN','LIBRARY','DRAFT','c2500000-0000-0000-0000-000000000003');
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,required_by_default,sensitivity,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,weight,maximum_score,content_hash,change_reason,created_by,published_at) values
('c2590000-0000-0000-0000-000000000001','c2580000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001',1,'PUBLISHED','Avez-vous une politique ?','هل لديكم سياسة؟','YES_NO','compliance.has_policy',true,'BUSINESS','APPROVED','c2500000-0000-0000-0000-000000000003',now(),repeat('6',64),1,1,1,repeat('2',64),'Version initiale','c2500000-0000-0000-0000-000000000003',now()),
('c2590000-0000-0000-0000-000000000002','c2580000-0000-0000-0000-000000000002','c2530000-0000-0000-0000-000000000001',1,'PUBLISHED','Précisions','تفاصيل','SHORT_TEXT','compliance.policy_note',true,'CONFIDENTIAL','APPROVED','c2500000-0000-0000-0000-000000000003',now(),repeat('7',64),1,1,1,repeat('3',64),'Version initiale','c2500000-0000-0000-0000-000000000003',now()),
('c2590000-0000-0000-0000-000000000003','c2580000-0000-0000-0000-000000000003','c2530000-0000-0000-0000-000000000002',1,'PUBLISHED','Étrangère','أجنبية','YES_NO','foreign.value',false,'BUSINESS','APPROVED','c2500000-0000-0000-0000-000000000003',now(),repeat('8',64),1,0,0,repeat('4',64),'Version initiale','c2500000-0000-0000-0000-000000000003',now());
update public.question_bank_questions set status='PUBLISHED',current_published_version_id=case id when 'c2580000-0000-0000-0000-000000000001' then 'c2590000-0000-0000-0000-000000000001'::uuid when 'c2580000-0000-0000-0000-000000000002' then 'c2590000-0000-0000-0000-000000000002'::uuid else 'c2590000-0000-0000-0000-000000000003'::uuid end where id in ('c2580000-0000-0000-0000-000000000001','c2580000-0000-0000-0000-000000000002','c2580000-0000-0000-0000-000000000003');
insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order) values
('c2560000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','c2570000-0000-0000-0000-000000000001','c2590000-0000-0000-0000-000000000001',1),
('c2560000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','c2570000-0000-0000-0000-000000000001','c2590000-0000-0000-0000-000000000002',2);
insert into public.question_rules(id,library_id,rule_key,status,created_by) values ('c25b0000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','POLICY_NO','DRAFT','c2500000-0000-0000-0000-000000000003');
insert into public.question_rule_versions(id,rule_id,library_id,version,status,condition_ast,actions,dependency_graph,priority,compiled_hash,change_reason,created_by,published_at) values
('c25c0000-0000-0000-0000-000000000001','c25b0000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001',1,'PUBLISHED','{"kind":"PREDICATE","operator":"EQ","questionKey":"HAS_POLICY","operand":false}','[{"type":"CREATE_ANOMALY","target":"POLICY_MISSING"}]','{"HAS_POLICY":["POLICY_NO"]}',10,repeat('9',64),'Version initiale','c2500000-0000-0000-0000-000000000003',now());
update public.question_rules set status='PUBLISHED',current_published_version_id='c25c0000-0000-0000-0000-000000000001' where id='c25b0000-0000-0000-0000-000000000001';
insert into public.questionnaire_version_rules(questionnaire_version_id,library_id,rule_version_id,evaluation_order) values ('c2560000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','c25c0000-0000-0000-0000-000000000001',1);
update public.questionnaire_versions set snapshot_hash=private.compute_questionnaire_snapshot_hash(id,jsonb_build_object('questionnaire_id',questionnaire_id,'library_id',library_id,'release_id',catalog_release_id,'version',version,'title_fr',title_fr,'title_ar',title_ar,'description_fr',description_fr,'description_ar',description_ar,'audience',audience,'engine_version',engine_version,'policy_version',policy_version)),status='PUBLISHED',published_at=now(),row_version=row_version+1 where id='c2560000-0000-0000-0000-000000000001';
update public.questionnaires set status='PUBLISHED',current_published_version_id='c2560000-0000-0000-0000-000000000001',row_version=row_version+1 where id='c2550000-0000-0000-0000-000000000001';
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,change_reason,created_by) values ('c2560000-0000-0000-0000-000000000009','c2550000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','c2540000-0000-0000-0000-000000000001',99,'DRAFT','Brouillon technique','مسودة تقنية','Brouillon de test','مسودة اختبار','CLIENT','1.0.0','P06-W2-1',repeat('0',64),'PENDING','Test de reparentage','c2500000-0000-0000-0000-000000000003');
set constraints all immediate;
set constraints all deferred;

select throws_ok($$insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order) values('c2560000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','c2570000-0000-0000-0000-000000000001','c2590000-0000-0000-0000-000000000003',3)$$,'23514','QUESTION_VERSION_NOT_LINKABLE','cross-library question cannot enter a questionnaire snapshot');
select throws_ok($$delete from public.question_versions where id='c2590000-0000-0000-0000-000000000001'$$,'55000','IMMUTABLE_QUESTIONNAIRE_VERSION','published question history is immutable');
select throws_ok($$update public.questionnaire_sections set sort_order=3 where id='c2570000-0000-0000-0000-000000000001'$$,'55000','IMMUTABLE_QUESTIONNAIRE_SNAPSHOT','published snapshot sections are immutable');
select throws_ok($$update public.questionnaire_sections set questionnaire_version_id='c2560000-0000-0000-0000-000000000009' where id='c2570000-0000-0000-0000-000000000001'$$,'55000','IMMUTABLE_QUESTIONNAIRE_SNAPSHOT','published section cannot be reparented to a draft');
select throws_ok($$update public.questionnaire_version_questions set questionnaire_version_id='c2560000-0000-0000-0000-000000000009' where questionnaire_version_id='c2560000-0000-0000-0000-000000000001' and question_version_id='c2590000-0000-0000-0000-000000000001'$$,'55000','IMMUTABLE_QUESTIONNAIRE_SNAPSHOT','published question link cannot be reparented to a draft');
select throws_ok($$update public.questionnaire_version_rules set questionnaire_version_id='c2560000-0000-0000-0000-000000000009' where questionnaire_version_id='c2560000-0000-0000-0000-000000000001'$$,'55000','IMMUTABLE_QUESTIONNAIRE_SNAPSHOT','published rule link cannot be reparented to a draft');
select throws_ok($$update public.question_rule_versions set priority=11 where id='c25c0000-0000-0000-0000-000000000001'$$,'55000','IMMUTABLE_QUESTIONNAIRE_VERSION','published compiled rule history is immutable');
select col_type_is('public','question_versions','weight','numeric(20,6)','scores use exact numeric values');
select col_type_is('public','question_versions','maximum_score','numeric(20,6)','maximum scores use exact numeric values');
select matches((select snapshot_hash from public.questionnaire_versions where id='c2560000-0000-0000-0000-000000000001'),'^[0-9a-f]{64}$','published questionnaire stores its verified snapshot hash');
select is((select current_published_version_id from public.questionnaires where id='c2550000-0000-0000-0000-000000000001'),'c2560000-0000-0000-0000-000000000001'::uuid,'published identity points to the published immutable version');

create temporary table p06_w2_observed(key text primary key,value jsonb);
create temporary table p06_w2_errors(key text primary key,sqlstate text,message text);
grant select,insert,update on p06_w2_observed,p06_w2_errors to authenticated;
grant insert on p06_w2_errors to anon;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('start',public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','fr-MA',now()+interval '1 day','p06-w2-start-0001','c25a0000-0000-0000-0000-000000000001'));
insert into p06_w2_observed values('start-retry',public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','fr-MA',now()+interval '1 day','p06-w2-start-0001','c25a0000-0000-0000-0000-000000000001'));
do $runtime$ begin perform public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','ar-MA',null,'p06-w2-start-0001','c25a0000-0000-0000-0000-000000000002'); exception when others then insert into p06_w2_errors values('start-reuse',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select value->>'outcome' from p06_w2_observed where key='start'),'QUESTIONNAIRE_SESSION_STARTED','active tenant member starts published questionnaire');
select is((select value from p06_w2_observed where key='start-retry'),(select value from p06_w2_observed where key='start'),'session start is idempotent');
select is((select sqlstate||':'||message from p06_w2_errors where key='start-reuse'),'23505:IDEMPOTENCY_KEY_REUSED','same start key rejects a different request');
select is((select count(*) from public.audit_events where action='questionnaire.session.started' and resource_id=(select value->>'session_id' from p06_w2_observed where key='start')),1::bigint,'session start is audited once');
select is((select count(*) from public.event_outbox where event_type='QuestionnaireSessionStartedV1' and aggregate_id=(select value->>'session_id' from p06_w2_observed where key='start')),1::bigint,'session start emits one safe Outbox event');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('respondent-snapshot-projection',jsonb_build_object('sections',(select count(*) from public.questionnaire_sections where questionnaire_version_id='c2560000-0000-0000-0000-000000000001'),'questions',(select count(*) from public.questionnaire_version_questions where questionnaire_version_id='c2560000-0000-0000-0000-000000000001'),'rules',(select count(*) from public.question_rules)+(select count(*) from public.question_rule_versions)+(select count(*) from public.questionnaire_version_rules)));
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p06_w2_observed values('manager-rules',to_jsonb((select count(*) from public.question_rules)+(select count(*) from public.question_rule_versions)+(select count(*) from public.questionnaire_version_rules)));
reset role;
select ok((select (value->>'sections')::integer>0 and (value->>'questions')::integer>0 and (value->>'rules')::integer=0 from p06_w2_observed where key='respondent-snapshot-projection'),'respondent reads sections and questions but no rule identities, AST versions or links');
select ok((select value::text::integer>0 from p06_w2_observed where key='manager-rules'),'authorized catalog manager reads rule identities, AST versions and links');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','fr-MA',null,'p06-w2-denied-0001','c25a0000-0000-0000-0000-000000000003'); exception when others then insert into p06_w2_errors values('tenant-start',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select sqlstate||':'||message from p06_w2_errors where key='tenant-start'),'42501:ORGANIZATION_SCOPE_DENIED','cross-tenant session start is denied');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','fr-MA',null,'p06-w2-role-denied','c25a0000-0000-0000-0000-000000000012'); exception when others then insert into p06_w2_errors values('audience-role',sqlstate,sqlerrm); end $runtime$;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000006","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','fr-MA',null,'p06-w2-viewer-deny','c25a0000-0000-0000-0000-000000000020'); exception when others then insert into p06_w2_errors values('viewer-start',sqlstate,sqlerrm); end $runtime$;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.start_questionnaire_session('c2510000-0000-0000-0000-000000000003','c2560000-0000-0000-0000-000000000001','fr-MA',null,'p06-w2-inactive-0001','c25a0000-0000-0000-0000-000000000013'); exception when others then insert into p06_w2_errors values('inactive-org',sqlstate,sqlerrm); end $runtime$;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','fr-MA',null,'p06-w2-null-corr',null); exception when others then insert into p06_w2_errors values('null-correlation',sqlstate,sqlerrm); end $runtime$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $runtime$ begin perform public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','fr-MA',null,'p06-w2-anon-0001','c25a0000-0000-0000-0000-000000000014'); exception when others then insert into p06_w2_errors values('anon-start',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select sqlstate||':'||message from p06_w2_errors where key='audience-role'),'42501:ORGANIZATION_SCOPE_DENIED','provider role cannot start a CLIENT questionnaire');
select is((select sqlstate||':'||message from p06_w2_errors where key='viewer-start'),'42501:ORGANIZATION_SCOPE_DENIED','CLIENT_VIEWER remains read-only and cannot start a session');
select is((select sqlstate||':'||message from p06_w2_errors where key='inactive-org'),'42501:ORGANIZATION_SCOPE_DENIED','inactive organization cannot start a questionnaire');
select is((select sqlstate||':'||message from p06_w2_errors where key='null-correlation'),'22023:INVALID_SESSION_REQUEST','null correlation identifier is rejected');
select is((select sqlstate from p06_w2_errors where key='anon-start'),'42501','anon cannot execute or authenticate a session command');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,'[{"question_version_id":"c2590000-0000-0000-0000-000000000001","value":"true","expected_answer_row_version":0}]','p06-w2-invalid-type','c25a0000-0000-0000-0000-000000000015'); exception when others then insert into p06_w2_errors values('invalid-type',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin perform public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,'[{"question_version_id":"c2590000-0000-0000-0000-000000000001","value":true,"expected_answer_row_version":0,"source":"IMPORT"}]','p06-w2-forged-source','c25a0000-0000-0000-0000-000000000016'); exception when others then insert into p06_w2_errors values('forged-source',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin perform public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,jsonb_build_array(jsonb_build_object('question_version_id','c2590000-0000-0000-0000-000000000002','value',repeat('x',50001),'expected_answer_row_version',0)),'p06-w2-too-large-1','c25a0000-0000-0000-0000-000000000017'); exception when others then insert into p06_w2_errors values('too-large',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin perform public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),null,'[{"question_version_id":"c2590000-0000-0000-0000-000000000001","value":true,"expected_answer_row_version":0}]','p06-w2-null-version','c25a0000-0000-0000-0000-000000000018'); exception when others then insert into p06_w2_errors values('null-version',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin perform public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,null,'p06-w2-null-answer','c25a0000-0000-0000-0000-000000000023'); exception when others then insert into p06_w2_errors values('null-answers',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select sqlstate||':'||message from p06_w2_errors where key='invalid-type'),'22023:INVALID_ANSWER_VALUE','answer type validation fails closed');
select is((select sqlstate||':'||message from p06_w2_errors where key='forged-source'),'22023:INVALID_ANSWER_ITEM','client cannot forge answer provenance');
select is((select sqlstate||':'||message from p06_w2_errors where key='too-large'),'22023:INVALID_AUTOSAVE_REQUEST','total autosave payload byte budget is enforced');
select is((select sqlstate||':'||message from p06_w2_errors where key='null-version'),'22023:INVALID_AUTOSAVE_REQUEST','null optimistic version is rejected');
select is((select sqlstate||':'||message from p06_w2_errors where key='null-answers'),'22023:INVALID_AUTOSAVE_REQUEST','null answer batch is rejected');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('save-1',public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,'[{"question_version_id":"c2590000-0000-0000-0000-000000000001","value":true,"expected_answer_row_version":0}]','p06-w2-save-0001','c25a0000-0000-0000-0000-000000000004'));
insert into p06_w2_observed values('save-1-retry',public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,'[{"question_version_id":"c2590000-0000-0000-0000-000000000001","value":true,"expected_answer_row_version":0}]','p06-w2-save-0001','c25a0000-0000-0000-0000-000000000004'));
insert into p06_w2_observed values('stale',public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,'[{"question_version_id":"c2590000-0000-0000-0000-000000000002","value":"secret","expected_answer_row_version":0}]','p06-w2-stale-0001','c25a0000-0000-0000-0000-000000000005'));
insert into p06_w2_observed values('stale-retry',public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,'[{"question_version_id":"c2590000-0000-0000-0000-000000000002","value":"secret","expected_answer_row_version":0}]','p06-w2-stale-0001','c25a0000-0000-0000-0000-000000000005'));
reset role;
select is((select value->>'outcome' from p06_w2_observed where key='save-1'),'AUTOSAVE_SAVED','autosave persists a first answer');
select is((select (value->>'server_row_version')::integer from p06_w2_observed where key='save-1'),2,'autosave increments optimistic session version');
select is((select value from p06_w2_observed where key='save-1-retry'),(select value from p06_w2_observed where key='save-1'),'autosave replay returns its durable response');
select is((select count(*) from public.questionnaire_answer_revisions where session_id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start') and question_version_id='c2590000-0000-0000-0000-000000000001'),1::bigint,'autosave replay creates no duplicate revision');
select is((select source from public.questionnaire_answer_revisions where session_id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start') and question_version_id='c2590000-0000-0000-0000-000000000001'),'USER','authenticated autosave provenance is forced by the server');
select is((select value->>'outcome' from p06_w2_observed where key='stale'),'AUTOSAVE_CONFLICT','stale session version returns explicit conflict');
select is((select value from p06_w2_observed where key='stale-retry'),(select value from p06_w2_observed where key='stale'),'conflict response is idempotent');
select is((select row_version from public.questionnaire_sessions where id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start')),2,'conflict does not mutate session version');
select is((select count(*) from public.audit_events where action='questionnaire.answers.autosaved' and resource_id=(select value->>'session_id' from p06_w2_observed where key='start')),1::bigint,'successful autosave is audited once');
select is((select count(*) from public.event_outbox where event_type='QuestionnaireAnswersSavedV1' and aggregate_id=(select value->>'session_id' from p06_w2_observed where key='start')),1::bigint,'successful autosave emits one Outbox event');
select ok(not exists(select 1 from public.event_outbox where event_type='QuestionnaireAnswersSavedV1' and aggregate_id=(select value->>'session_id' from p06_w2_observed where key='start') and payload::text like '%secret%'),'Outbox never contains answer values');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.submit_questionnaire_session((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),2,'p06-w2-submit-missing','c25a0000-0000-0000-0000-000000000011'); exception when others then insert into p06_w2_errors values('submit-missing',sqlstate,sqlerrm); end $runtime$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),2,'[{"question_version_id":"c2590000-0000-0000-0000-000000000003","value":true,"expected_answer_row_version":0}]','p06-w2-foreign-0001','c25a0000-0000-0000-0000-000000000006'); exception when others then insert into p06_w2_errors values('foreign-question',sqlstate,sqlerrm); end $runtime$;
insert into p06_w2_observed values('answer-conflict',public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),2,'[{"question_version_id":"c2590000-0000-0000-0000-000000000001","value":false,"expected_answer_row_version":0}]','p06-w2-answer-conflict-0001','c25a0000-0000-0000-0000-000000000007'));
insert into p06_w2_observed values('save-2',public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),2,'[{"question_version_id":"c2590000-0000-0000-0000-000000000002","value":"confidentiel","expected_answer_row_version":0}]','p06-w2-save-0002','c25a0000-0000-0000-0000-000000000001'));
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.submit_questionnaire_session((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),2,'p06-w2-submit-stale','c25a0000-0000-0000-0000-000000000009'); exception when others then insert into p06_w2_errors values('submit-stale',sqlstate,sqlerrm); end $runtime$;
insert into p06_w2_observed values('submit',public.submit_questionnaire_session((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),3,'p06-w2-submit-0001','c25a0000-0000-0000-0000-000000000010'));
insert into p06_w2_observed values('submit-retry',public.submit_questionnaire_session((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),3,'p06-w2-submit-0001','c25a0000-0000-0000-0000-000000000010'));
reset role;
select is((select sqlstate||':'||message from p06_w2_errors where key='submit-missing'),'23514:REQUIRED_ANSWERS_MISSING','submission refuses a missing required answer');
select is((select sqlstate||':'||message from p06_w2_errors where key='foreign-question'),'23503:QUESTION_NOT_IN_SESSION_SNAPSHOT','autosave rejects a question outside the fixed snapshot');
select is((select value->>'outcome' from p06_w2_observed where key='answer-conflict'),'AUTOSAVE_PARTIAL_CONFLICT','answer row conflict is explicit');
select is((select jsonb_array_length(value->'accepted') from p06_w2_observed where key='answer-conflict'),0,'conflicting answer is never overwritten');
select is((select value->>'outcome' from p06_w2_observed where key='save-2'),'AUTOSAVE_SAVED','second required answer is saved');
select is((select count(distinct correlation_id) from public.event_outbox where event_type in ('QuestionnaireSessionStartedV1','QuestionnaireAnswersSavedV1') and correlation_id='c25a0000-0000-0000-0000-000000000001'),1::bigint,'one correlation chain may contain distinct start and autosave commands');
select ok(exists(select 1 from public.event_outbox o join private.questionnaire_command_keys k on k.command_id=o.causation_id where o.event_type='QuestionnaireAnswersSavedV1' and o.idempotency_key='p06-w2-save-0002' and k.operation_scope='questionnaire.session.autosave'),'Outbox causation points to the internal authenticated command');
select is((select sqlstate||':'||message from p06_w2_errors where key='submit-stale'),'PT409:STALE_SESSION_VERSION','submission rejects stale session version');
select is((select value->>'outcome' from p06_w2_observed where key='submit'),'QUESTIONNAIRE_SESSION_SUBMITTED','complete fixed snapshot is submitted');
select is((select value from p06_w2_observed where key='submit-retry'),(select value from p06_w2_observed where key='submit'),'submission retry is idempotent');
select is((select status from public.questionnaire_sessions where id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start')),'SUBMITTED','submitted session is terminal');
select matches((select answer_manifest_hash from public.questionnaire_sessions where id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start')),'^[0-9a-f]{64}$','submission freezes a canonical manifest hash');
select is((select count(*) from public.event_outbox where event_type='QuestionnaireSessionSubmittedV1' and aggregate_id=(select value->>'session_id' from p06_w2_observed where key='start')),1::bigint,'submission emits exactly one Outbox event');
select ok(not exists(select 1 from public.event_outbox where aggregate_id=(select value->>'session_id' from p06_w2_observed where key='start') and event_type like 'Questionnaire%' and payload::text like '%confidentiel%'),'submission Outbox excludes confidential values');
select throws_ok(format('update public.questionnaire_answer_revisions set value=%L::jsonb where session_id=%L','false',(select value->>'session_id' from p06_w2_observed where key='start')),'55000','IMMUTABLE_QUESTIONNAIRE_HISTORY','answer revisions cannot be altered');
select throws_ok(format('update public.questionnaire_sessions set locale=%L where id=%L','ar-MA',(select value->>'session_id' from p06_w2_observed where key='start')),'55000','IMMUTABLE_SUBMITTED_QUESTIONNAIRE','submitted session snapshot cannot be altered');
select throws_ok(format('update public.questionnaire_answers set row_version=row_version+1 where session_id=%L',(select value->>'session_id' from p06_w2_observed where key='start')),'55000','IMMUTABLE_SUBMITTED_QUESTIONNAIRE','submitted current answer pointers cannot be altered');

grant insert on public.questionnaire_answers to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('outsider-sessions',to_jsonb((select count(*) from public.questionnaire_sessions)));
insert into p06_w2_observed values('outsider-answers',to_jsonb((select count(*) from public.questionnaire_answer_revisions where session_id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start'))));
do $runtime$ begin insert into public.questionnaire_answers(session_id,organization_id,question_version_id) values((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),'c2510000-0000-0000-0000-000000000001','c2590000-0000-0000-0000-000000000001'); exception when others then insert into p06_w2_errors values('direct-write',sqlstate,sqlerrm); end $runtime$;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p06_w2_observed values('admin-sessions',to_jsonb((select count(*) from public.questionnaire_sessions)));
insert into p06_w2_observed values('admin-revisions',to_jsonb((select count(*) from public.questionnaire_answer_revisions where session_id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start'))));
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('aal1-admin-sessions',to_jsonb((select count(*) from public.questionnaire_sessions)));
reset role;
select is((select value::text::bigint from p06_w2_observed where key='outsider-sessions'),0::bigint,'RLS hides another tenant session');
select is((select value::text::bigint from p06_w2_observed where key='outsider-answers'),0::bigint,'RLS hides another tenant answer history');
select is((select sqlstate from p06_w2_errors where key='direct-write'),'42501','RLS denies direct answer writes even when a transaction grants INSERT');
select is((select value::text::bigint from p06_w2_observed where key='admin-sessions'),0::bigint,'central role receives no raw session manifest from the base table');
select is((select value::text::bigint from p06_w2_observed where key='admin-revisions'),0::bigint,'central auditor cannot read raw sensitive answer revisions');
select is((select value::text::bigint from p06_w2_observed where key='aal1-admin-sessions'),0::bigint,'MFA-required central role at AAL1 cannot audit sessions');
select ok((select answer_manifest @> '[{"question_version_id":"c2590000-0000-0000-0000-000000000001"}]'::jsonb from public.questionnaire_sessions where id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start')),'manifest pins exact question versions');
select ok(not exists(select 1 from public.audit_events where actor_user_id in ('c2500000-0000-0000-0000-000000000001'::uuid,'c2500000-0000-0000-0000-000000000003'::uuid) and action like 'questionnaire.%' and organization_id is null),'all questionnaire fixture audit evidence is tenant attributed');

insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,sensitive,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by) values
('c2560000-0000-0000-0000-000000000002','c2550000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001','c2540000-0000-0000-0000-000000000001',2,'APPROVED','Diagnostic client V2','تشخيص العميل 2','Diagnostic révisé','التشخيص المنقح','CLIENT','1.0.0','P06-W2-1',repeat('f',64),true,'APPROVED','c2500000-0000-0000-0000-000000000003',now(),repeat('a',64),2,'Révision contrôlée','c2500000-0000-0000-0000-000000000003');
insert into public.questionnaire_sections(id,questionnaire_version_id,section_key,label_fr,label_ar,sort_order,content_hash) values ('c2570000-0000-0000-0000-000000000002','c2560000-0000-0000-0000-000000000002','GENERAL','Général V2','عام 2',1,repeat('b',64));
insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order) values
('c2560000-0000-0000-0000-000000000002','c2530000-0000-0000-0000-000000000001','c2570000-0000-0000-0000-000000000002','c2590000-0000-0000-0000-000000000001',1),
('c2560000-0000-0000-0000-000000000002','c2530000-0000-0000-0000-000000000001','c2570000-0000-0000-0000-000000000002','c2590000-0000-0000-0000-000000000002',2);
insert into public.questionnaire_version_rules(questionnaire_version_id,library_id,rule_version_id,evaluation_order) values ('c2560000-0000-0000-0000-000000000002','c2530000-0000-0000-0000-000000000001','c25c0000-0000-0000-0000-000000000001',1);
insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by) values ('c2580000-0000-0000-0000-000000000010','c2530000-0000-0000-0000-000000000001','INVALID_PATTERN_METADATA','LIBRARY','DRAFT','c2500000-0000-0000-0000-000000000003');
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,validation_schema,content_hash,change_reason,created_by) values ('c2590000-0000-0000-0000-000000000010','c2580000-0000-0000-0000-000000000010','c2530000-0000-0000-0000-000000000001',1,'APPROVED','Métadonnée invalide','بيانات غير صالحة','SHORT_TEXT','invalid.pattern','{"pattern":"^(a|aa)+$"}',repeat('d',64),'Test publication fail-closed','c2500000-0000-0000-0000-000000000003');
insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order) values ('c2560000-0000-0000-0000-000000000002','c2530000-0000-0000-0000-000000000001','c2570000-0000-0000-0000-000000000002','c2590000-0000-0000-0000-000000000010',3);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.publish_questionnaire_version('c2560000-0000-0000-0000-000000000002',1,'p06-w2-publish-0001','c25a0000-0000-0000-0000-000000000021'); exception when others then insert into p06_w2_errors values('publish-aal1',sqlstate,sqlerrm); end $runtime$;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $runtime$ begin perform public.publish_questionnaire_version('c2560000-0000-0000-0000-000000000002',99,'p06-w2-publish-stale','c25a0000-0000-0000-0000-000000000022'); exception when others then insert into p06_w2_errors values('publish-stale',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin perform public.publish_questionnaire_version('c2560000-0000-0000-0000-000000000002',1,'p06-w2-publish-invalid','c25a0000-0000-0000-0000-000000000023'); exception when others then insert into p06_w2_errors values('publish-invalid-metadata',sqlstate,sqlerrm); end $runtime$;
reset role;
delete from public.questionnaire_version_questions where questionnaire_version_id='c2560000-0000-0000-0000-000000000002' and question_version_id='c2590000-0000-0000-0000-000000000010';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p06_w2_observed values('publish-v2',public.publish_questionnaire_version('c2560000-0000-0000-0000-000000000002',1,'p06-w2-publish-0001','c25a0000-0000-0000-0000-000000000021'));
insert into p06_w2_observed values('publish-v2-retry',public.publish_questionnaire_version('c2560000-0000-0000-0000-000000000002',1,'p06-w2-publish-0001','c25a0000-0000-0000-0000-000000000021'));
reset role;
set constraints all immediate;
set constraints all deferred;
select is((select sqlstate||':'||message from p06_w2_errors where key='publish-aal1'),'42501:QUESTIONNAIRE_PUBLISH_DENIED','effective sensitive publication requires central MFA');
select is((select sqlstate||':'||message from p06_w2_errors where key='publish-stale'),'PT409:STALE_QUESTIONNAIRE_VERSION','publication rejects stale optimistic version');
select is((select sqlstate||':'||message from p06_w2_errors where key='publish-invalid-metadata'),'23514:QUESTIONNAIRE_QUESTION_METADATA_INVALID','publication refuses linked question metadata that the runtime cannot validate');
select is((select value->>'outcome' from p06_w2_observed where key='publish-v2'),'QUESTIONNAIRE_VERSION_PUBLISHED','central AAL2 publishes the approved sensitive version');
select is((select value from p06_w2_observed where key='publish-v2-retry'),(select value from p06_w2_observed where key='publish-v2'),'publication replay is idempotent');
select is((select status from public.questionnaire_versions where id='c2560000-0000-0000-0000-000000000001'),'SUPERSEDED','publication supersedes the prior immutable version');
select is((select current_published_version_id from public.questionnaires where id='c2550000-0000-0000-0000-000000000001'),'c2560000-0000-0000-0000-000000000002'::uuid,'identity points atomically to V2');
select ok((select count(*) from public.audit_events where action='questionnaire.version.published' and resource_id='c2560000-0000-0000-0000-000000000002')=1 and (select count(*) from public.event_outbox where event_type='QuestionnaireVersionPublishedV1' and aggregate_id='c2560000-0000-0000-0000-000000000002')=1,'publication writes audit and Outbox once');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('historical-v1-read',to_jsonb((select count(*) from public.questionnaire_versions where id='c2560000-0000-0000-0000-000000000001')));
reset role;
select is((select value::text::bigint from p06_w2_observed where key='historical-v1-read'),1::bigint,'the original actor can read the superseded version pinned by the submitted session');

update public.catalog_releases set audience='{"kind":"ORGANIZATIONS","organization_ids":["c2510000-0000-0000-0000-000000000001"]}' where id='c2540000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('split-org-version-read',to_jsonb((select count(*) from public.questionnaire_versions where id='c2560000-0000-0000-0000-000000000001')));
reset role;
select is((select value::text::bigint from p06_w2_observed where key='split-org-version-read'),0::bigint,'one organization must satisfy release audience and questionnaire role simultaneously');
update public.catalog_releases set audience='{"kind":"ORGANIZATIONS","organization_ids":["c2510000-0000-0000-0000-000000000002"]}',effective_until=clock_timestamp() where id='c2540000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('historical-v1-after-release-change',to_jsonb((select count(*) from public.questionnaire_versions where id='c2560000-0000-0000-0000-000000000001')));
reset role;
select is((select value::text::bigint from p06_w2_observed where key='historical-v1-after-release-change'),1::bigint,'pinned historical version remains readable to its still-authorized actor after release expiry and audience change');
update public.question_versions set status='SUPERSEDED',superseded_at=clock_timestamp(),row_version=row_version+1 where id='c2590000-0000-0000-0000-000000000001';
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,required_by_default,sensitivity,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,weight,maximum_score,content_hash,change_reason,created_by,published_at) values ('c2590000-0000-0000-0000-000000000011','c2580000-0000-0000-0000-000000000001','c2530000-0000-0000-0000-000000000001',2,'PUBLISHED','Avez-vous une politique V2 ?','هل لديكم سياسة 2؟','YES_NO','compliance.has_policy.v2',true,'BUSINESS','APPROVED','c2500000-0000-0000-0000-000000000003',now(),repeat('6',64),2,1,1,repeat('c',64),'Version question suivante','c2500000-0000-0000-0000-000000000003',now());
update public.question_bank_questions set current_published_version_id='c2590000-0000-0000-0000-000000000011',row_version=row_version+1 where id='c2580000-0000-0000-0000-000000000001';
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('historical-question-version-read',to_jsonb((select count(*) from public.question_versions where id='c2590000-0000-0000-0000-000000000001')));
reset role;
select is((select value::text::bigint from p06_w2_observed where key='historical-question-version-read'),1::bigint,'the pinned session actor can read its superseded question version without draft access');

update public.questionnaire_versions set status='SUPERSEDED',superseded_at=clock_timestamp(),row_version=row_version+1 where id='c2560000-0000-0000-0000-000000000002';
update public.questionnaires set status='ARCHIVED',current_published_version_id=null,archived_at=clock_timestamp(),row_version=row_version+1 where id='c2550000-0000-0000-0000-000000000001';
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.start_questionnaire_session('c2510000-0000-0000-0000-000000000001','c2560000-0000-0000-0000-000000000001','fr-MA',null,'p06-w2-archived-01','c25a0000-0000-0000-0000-000000000019'); exception when others then insert into p06_w2_errors values('archived-questionnaire',sqlstate,sqlerrm); end $runtime$;
reset role;
update public.organization_member_roles set revoked_at=clock_timestamp() where membership_id='c2520000-0000-0000-0000-000000000001' and role_code='CLIENT_MEMBER';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.autosave_questionnaire_answers((select (value->>'session_id')::uuid from p06_w2_observed where key='start'),1,'[{"question_version_id":"c2590000-0000-0000-0000-000000000001","value":true,"expected_answer_row_version":0}]','p06-w2-save-0001','c25a0000-0000-0000-0000-000000000004'); exception when others then insert into p06_w2_errors values('revoked-replay',sqlstate,sqlerrm); end $runtime$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('revoked-session-read',to_jsonb((select count(*) from public.questionnaire_sessions)));
insert into p06_w2_observed values('revoked-revision-read',to_jsonb((select count(*) from public.questionnaire_answer_revisions where session_id=(select (value->>'session_id')::uuid from p06_w2_observed where key='start'))));
reset role;
update public.organization_member_roles set revoked_at=null where membership_id='c2520000-0000-0000-0000-000000000001' and role_code='CLIENT_MEMBER';
update public.organization_memberships set status='SUSPENDED' where id='c2520000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('suspended-session-read',to_jsonb((select count(*) from public.questionnaire_sessions)));
reset role;
update public.organization_memberships set status='ACTIVE' where id='c2520000-0000-0000-0000-000000000001';
update public.organizations set status='ARCHIVED' where id='c2510000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_w2_observed values('archived-org-session-read',to_jsonb((select count(*) from public.questionnaire_sessions)));
reset role;
select is((select sqlstate||':'||message from p06_w2_errors where key='archived-questionnaire'),'42501:QUESTIONNAIRE_NOT_AVAILABLE','archived questionnaire identity cannot start a session');
select is((select sqlstate||':'||message from p06_w2_errors where key='revoked-replay'),'42501:SESSION_SCOPE_DENIED','authorization revocation is checked before an idempotent replay');
select is((select value::text::bigint from p06_w2_observed where key='revoked-session-read'),0::bigint,'revoked audience role closes session SELECT immediately');
select is((select value::text::bigint from p06_w2_observed where key='revoked-revision-read'),0::bigint,'revoked audience role closes raw revision SELECT immediately');
select is((select value::text::bigint from p06_w2_observed where key='suspended-session-read'),0::bigint,'suspended membership closes session SELECT immediately');
select is((select value::text::bigint from p06_w2_observed where key='archived-org-session-read'),0::bigint,'archived organization closes session SELECT immediately');

select * from finish();
rollback;
