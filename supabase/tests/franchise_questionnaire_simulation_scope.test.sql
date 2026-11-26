begin;set local search_path=public,extensions;select plan(8);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c2400000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-franchise@example.invalid','',now(),'{}','{}',now(),now()),
('c2400000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-central@example.invalid','',now(),'{}','{}',now(),now()),
('c2400000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-outsider@example.invalid','',now(),'{}','{}',now(),now()),
('c2400000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-inactive-org@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('c2410000-0000-0000-0000-000000000001','P06 Franchise A','P06 A','ACTIVE','c2400000-0000-0000-0000-000000000001'),
('c2410000-0000-0000-0000-000000000002','P06 Franchise B','P06 B','ACTIVE','c2400000-0000-0000-0000-000000000003'),
('c2410000-0000-0000-0000-000000000003','P06 Franchise inactive','P06 inactive','ARCHIVED','c2400000-0000-0000-0000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
('c2420000-0000-0000-0000-000000000001','c2410000-0000-0000-0000-000000000001','c2400000-0000-0000-0000-000000000001','ACTIVE',now()),
('c2420000-0000-0000-0000-000000000002','c2410000-0000-0000-0000-000000000002','c2400000-0000-0000-0000-000000000003','ACTIVE',now()),
('c2420000-0000-0000-0000-000000000003','c2410000-0000-0000-0000-000000000003','c2400000-0000-0000-0000-000000000004','ACTIVE',now());
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by) values
('c2430000-0000-0000-0000-000000000001','P06_LIB_A','p06-lib-a','c2410000-0000-0000-0000-000000000001','c2400000-0000-0000-0000-000000000001'),
('c2430000-0000-0000-0000-000000000002','P06_LIB_B','p06-lib-b','c2410000-0000-0000-0000-000000000002','c2400000-0000-0000-0000-000000000003'),
('c2430000-0000-0000-0000-000000000003','P06_LIB_C','p06-lib-c','c2410000-0000-0000-0000-000000000003','c2400000-0000-0000-0000-000000000004');
insert into public.organization_member_roles(membership_id,role_code,library_id) values
('c2420000-0000-0000-0000-000000000001','FRANCHISE_OWNER','c2430000-0000-0000-0000-000000000001'),
('c2420000-0000-0000-0000-000000000002','FRANCHISE_OWNER','c2430000-0000-0000-0000-000000000002'),
('c2420000-0000-0000-0000-000000000003','FRANCHISE_OWNER','c2430000-0000-0000-0000-000000000003');
insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by) values
('c2430000-0000-0000-0000-000000000001','c2410000-0000-0000-0000-000000000001','ACTIVE',now()-interval '1 day',1,'c2400000-0000-0000-0000-000000000001'),
('c2430000-0000-0000-0000-000000000002','c2410000-0000-0000-0000-000000000002','ACTIVE',now()-interval '1 day',1,'c2400000-0000-0000-0000-000000000003'),
('c2430000-0000-0000-0000-000000000003','c2410000-0000-0000-0000-000000000003','ACTIVE',now()-interval '1 day',1,'c2400000-0000-0000-0000-000000000004');
insert into public.platform_user_roles(user_id,role_code) values ('c2400000-0000-0000-0000-000000000002','MATRICIA_ADMIN');

-- Published historical reference only. All authorization assertions use real policies.
do $$declare n integer;l uuid;r uuid;q uuid;v uuid;section uuid;question uuid;qv uuid;begin
for n in 1..2 loop
l:=('c2430000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;r:=('e2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;q:=('e2010000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;v:=('e2020000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,published_at,created_by)values(r,l,'EDITOR.V1.'||n,'PUBLISHED',repeat('a',64),repeat('b',64),clock_timestamp(),'c2400000-0000-0000-0000-000000000001');
insert into public.questionnaires(id,library_id,code,status,created_by)values(q,l,'EDITOR_TEST','DRAFT','c2400000-0000-0000-0000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by,published_at,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version)values(v,q,l,r,1,'DRAFT','Editor reference','Editor reference','Historical published reference','Historical published reference','CLIENT','2.0.0','V1',repeat('c',64),'Historical reference','c2400000-0000-0000-0000-000000000001',null,'APPROVED','c2400000-0000-0000-0000-000000000002',clock_timestamp(),repeat('d',64),1);

section:=extensions.gen_random_uuid();question:=extensions.gen_random_uuid();qv:=extensions.gen_random_uuid();
insert into public.questionnaire_sections(id,questionnaire_version_id,section_key,label_fr,label_ar,sort_order,content_hash)values(section,v,'GENERAL','General','General',1,repeat('e',64));
insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by)values(question,l,'EDITOR_QUESTION','LIBRARY','DRAFT','c2400000-0000-0000-0000-000000000001');
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,content_hash,change_reason,created_by,published_at)values(qv,question,l,1,'PUBLISHED','Published question','Published question','YES_NO','editor.question','APPROVED','c2400000-0000-0000-0000-000000000002',clock_timestamp(),repeat('f',64),1,repeat('a',64),'Historical question','c2400000-0000-0000-0000-000000000001',clock_timestamp());
update public.question_bank_questions set status='PUBLISHED',current_published_version_id=qv where id=question;
insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order)values(v,l,section,qv,1);
update public.questionnaire_versions set status='PUBLISHED',published_at=clock_timestamp(),snapshot_hash=private.compute_questionnaire_snapshot_hash(id,jsonb_build_object('questionnaire_id',questionnaire_id,'library_id',library_id,'release_id',catalog_release_id,'version',version,'title_fr',title_fr,'title_ar',title_ar,'description_fr',description_fr,'description_ar',description_ar,'audience',audience,'engine_version',engine_version,'policy_version',policy_version))where id=v;
update public.questionnaires set current_published_version_id=v,status='PUBLISHED' where id=q;
end loop;end$$;

grant usage on schema extensions to authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($sql$set local role authenticated;select public.validate_questionnaire_rule_engine('e2020000-0000-4000-8000-000000000001');reset role$sql$,'mandated franchise editor can validate its questionnaire');
select lives_ok($sql$set local role authenticated;select public.simulate_questionnaire_rule_engine('e2020000-0000-4000-8000-000000000001','{}','{}');reset role$sql$,'mandated franchise editor can simulate without a central role');
select throws_ok($sql$set local role authenticated;select public.simulate_questionnaire_rule_engine('e2020000-0000-4000-8000-000000000002','{}','{}')$sql$,'42501','QUESTIONNAIRE_SCOPE_DENIED','foreign library simulation remains denied');reset role;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($sql$set local role authenticated;select public.simulate_questionnaire_rule_engine('e2020000-0000-4000-8000-000000000001','{}','{}')$sql$,'42501','QUESTIONNAIRE_SCOPE_DENIED','mandated editor still needs MFA for simulation');reset role;
-- A real Client role can read this public client questionnaire, without gaining editorial rights.
insert into public.organization_member_roles(membership_id,role_code)values('c2420000-0000-0000-0000-000000000002','CLIENT_OWNER');
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($sql$set local role authenticated;select public.simulate_questionnaire_rule_engine('e2020000-0000-4000-8000-000000000001','{}','{}')$sql$,'42501','QUESTIONNAIRE_SCOPE_DENIED','respondent role cannot execute rule internals in another library');reset role;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
update public.organization_member_roles set revoked_at=clock_timestamp()where membership_id='c2420000-0000-0000-0000-000000000001';
select throws_ok($sql$set local role authenticated;select public.simulate_questionnaire_rule_engine('e2020000-0000-4000-8000-000000000001','{}','{}')$sql$,'42501','QUESTIONNAIRE_SCOPE_DENIED','revocation immediately blocks simulation');reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($sql$select public.simulate_questionnaire_rule_engine('e2020000-0000-4000-8000-000000000001','{}','{}')$sql$,'42501','AUTHENTICATION_REQUIRED','anonymous identity cannot simulate');
select is((select count(*)from public.questionnaire_sessions where questionnaire_version_id in('e2020000-0000-4000-8000-000000000001','e2020000-0000-4000-8000-000000000002')),0::bigint,'simulation creates no real questionnaire session');
select * from finish();rollback;
