begin;set local search_path=public,extensions;select plan(14);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f1-200@example.invalid','',now(),'{}','{}',now(),now()),
('a2000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f1-200@example.invalid','',now(),'{}','{}',now(),now()),
('a2000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f2-200@example.invalid','',now(),'{}','{}',now(),now()),
('a2000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f2-200@example.invalid','',now(),'{}','{}',now(),now()),
('a2000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unscoped-200@example.invalid','',now(),'{}','{}',now(),now()),
('a2000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-200@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2000000-0000-4000-8000-000000000001','Multi Franchise P89 SARL','Multi Franchise P89','ACTIVE','a2000000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f2080000-0000-4000-8000-000000000010','EDITOR_SCOPE_200','editor-scope-200','b2000000-0000-4000-8000-000000000001','DRAFT','a2000000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','ACTIVE',now()),
('c2000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000003','ACTIVE',now()),
('c2000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000004','ACTIVE',now()),
('c2000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000005','ACTIVE',now());
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values
('d2000000-0000-4000-8000-000000000001','f2080000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F1','ACTIVE','a2000000-0000-4000-8000-000000000001'),
('d2000000-0000-4000-8000-000000000002','f2080000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F2','ACTIVE','a2000000-0000-4000-8000-000000000003');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('c2000000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','d2000000-0000-4000-8000-000000000001'),
('c2000000-0000-4000-8000-000000000002','FRANCHISE_VIEWER','d2000000-0000-4000-8000-000000000001'),
('c2000000-0000-4000-8000-000000000003','FRANCHISE_MANAGER','d2000000-0000-4000-8000-000000000002'),
('c2000000-0000-4000-8000-000000000004','FRANCHISE_VIEWER','d2000000-0000-4000-8000-000000000002'),
('c2000000-0000-4000-8000-000000000005','FRANCHISE_VIEWER',null);
insert into public.platform_user_roles(user_id,role_code)values('a2000000-0000-4000-8000-000000000006','MATRICIA_ADMIN');

insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by)values('f2080000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000001','ACTIVE',now()-interval'1 day',1,'a2000000-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select 'd2020000-0000-4000-8000-000000000001',id,'d2030000-0000-4000-8000-000000000001','d2040000-0000-4000-8000-000000000001',1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('a',64),created_by from public.franchises where id='d2000000-0000-4000-8000-000000000001';
update public.franchises set current_mandate_version_id='d2020000-0000-4000-8000-000000000001'where id='d2000000-0000-4000-8000-000000000001';
insert into public.question_bank_questions(id,library_id,question_key,scope,created_by,current_published_version_id)
select ('f2000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f2080000-0000-4000-8000-000000000010','PAGE_'||lpad(i::text,5,'0'),'LIBRARY','a2000000-0000-4000-8000-000000000001',('f2001000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,3)i;
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,content_hash,change_reason,created_by,published_at)
select ('f2001000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('f2000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f2080000-0000-4000-8000-000000000010',1,case when i=1 then'DRAFT'else'PUBLISHED'end,'Question '||i,case when i=61 then'بحث فريد'else'سؤال '||i end,'YES_NO','page.'||i,repeat('a',64),'Fixture recherche paginée','a2000000-0000-4000-8000-000000000001',case when i=1 then null else now()end from generate_series(1,3)i;
set local session_replication_role=origin;
grant usage on schema extensions to authenticated;
create temporary table pages(kind text,value jsonb);grant select,insert on pages to authenticated;
set local session_replication_role=replica;update public.question_bank_questions set current_draft_version_id=current_published_version_id,current_published_version_id=null where id='f2000000-0000-4000-8000-000000000001';update public.question_versions set sensitivity='CONFIDENTIAL'where id='f2001000-0000-4000-8000-000000000002';update public.question_bank_questions set scope='GLOBAL'where id='f2000000-0000-4000-8000-000000000003';set local session_replication_role=origin;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into pages values('DETAIL',public.franchise_question_detail('d2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001'));
select is((select value->>'key'from pages where kind='DETAIL'),'PAGE_00001','explicit question detail returns selected identity and full editable payload');
insert into pages values('SAVE',public.save_catalog_question_draft('f2000000-0000-4000-8000-000000000001','f2001000-0000-4000-8000-000000000001','LIBRARY',(select value->'payload'||'{"label_fr":"Question corrigée","label_ar":"سؤال معدل"}'::jsonb from pages where kind='DETAIL'),'Traductions corrigées',1,1,'franchise-question-save'));
select is((select(value->>'version_number')::int from pages where kind='SAVE'),2,'editing creates distinct immutable version');
select is((select label_fr from public.question_versions where id='f2001000-0000-4000-8000-000000000001'),'Question 1','previous source version remains reproducible');
select is(public.save_catalog_question_draft('f2000000-0000-4000-8000-000000000001','f2001000-0000-4000-8000-000000000001','LIBRARY',(select value->'payload'||'{"label_fr":"Question corrigée","label_ar":"سؤال معدل"}'::jsonb from pages where kind='DETAIL'),'Traductions corrigées',1,1,'franchise-question-save'),(select value from pages where kind='SAVE'),'same save command replays without duplicate version');
select throws_ok(format($sql$select public.save_catalog_question_draft('f2000000-0000-4000-8000-000000000001',%L,'LIBRARY',%L::jsonb,'Mauvaise révision',1,1,'franchise-question-stale')$sql$,(select value->>'version_id'from pages where kind='SAVE'),(select value->'payload'from pages where kind='DETAIL')),'40001','STALE_CATALOG_VERSION','stale concurrent editor cannot overwrite current revision');
select lives_ok($$select public.set_catalog_question_archived('f2000000-0000-4000-8000-000000000001',2,true,'Archive de recette','franchise-question-archive')$$,'unused question can be archived through real command');
select lives_ok($$select public.set_catalog_question_archived('f2000000-0000-4000-8000-000000000001',3,false,'Restauration de recette','franchise-question-restore')$$,'archived question can be restored with current optimistic version');
insert into pages values('SECRET',public.franchise_question_detail('d2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002'));
select throws_ok(format($sql$select public.save_catalog_question_draft('f2000000-0000-4000-8000-000000000002','f2001000-0000-4000-8000-000000000002','LIBRARY',%L::jsonb,'Réduction sensibilité',1,1,'franchise-question-downgrade')$sql$,(select value->'payload'||'{"sensitivity":"BUSINESS"}'::jsonb from pages where kind='SECRET')),'42501','CATALOG_SENSITIVE_MFA_REQUIRED','sensitive source cannot be downgraded at AAL1');
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok(format($sql$select public.save_catalog_question_draft('f2000000-0000-4000-8000-000000000002','f2001000-0000-4000-8000-000000000002','LIBRARY',%L::jsonb,'Réduction autorisée',1,1,'franchise-question-aal2')$sql$,(select value->'payload'||'{"sensitivity":"BUSINESS"}'::jsonb from pages where kind='SECRET')),'same explicit source revision can be saved at AAL2');
select throws_ok($$select public.set_catalog_question_archived('f2000000-0000-4000-8000-000000000002',2,true,'Archive publiée interdite','franchise-question-published-archive')$$,'55000','CATALOG_QUESTION_ARCHIVE_REQUIRES_RELEASE','published question keeps release protection');
insert into pages values('GLOBAL',public.franchise_question_detail('d2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000003'));
select throws_ok(format($sql$select public.save_catalog_question_draft('f2000000-0000-4000-8000-000000000003','f2001000-0000-4000-8000-000000000003','LIBRARY',%L::jsonb,'Tentative portée locale',1,1,'franchise-question-global-deny')$sql$,(select value->'payload'from pages where kind='GLOBAL')),'42501','CENTRAL_MFA_REQUIRED','franchise AAL2 cannot downgrade GLOBAL source into LIBRARY');
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok(format($sql$select public.save_catalog_question_draft('f2000000-0000-4000-8000-000000000003','f2001000-0000-4000-8000-000000000003','LIBRARY',%L::jsonb,'Tentative portée locale',1,1,'franchise-question-global-aal1')$sql$,(select value->'payload'from pages where kind='GLOBAL')),'42501','CENTRAL_MFA_REQUIRED','GLOBAL source also rejects franchise AAL1');
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
select lives_ok(format($sql$select public.save_catalog_question_draft('f2000000-0000-4000-8000-000000000003','f2001000-0000-4000-8000-000000000003','LIBRARY',%L::jsonb,'Changement central autorisé',1,1,'franchise-question-global-central')$sql$,(select value->'payload'from pages where kind='GLOBAL')),'central administrator AAL2 can explicitly change source scope');
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.franchise_question_detail('d2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','sibling mandate cannot open selected question detail');
reset role;select *from finish();rollback;
