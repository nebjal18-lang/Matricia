begin;set local search_path=public,extensions;select plan(16);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a1990000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f1-199@example.invalid','',now(),'{}','{}',now(),now()),
('a1990000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f1-199@example.invalid','',now(),'{}','{}',now(),now()),
('a1990000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f2-199@example.invalid','',now(),'{}','{}',now(),now()),
('a1990000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f2-199@example.invalid','',now(),'{}','{}',now(),now()),
('a1990000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unscoped-199@example.invalid','',now(),'{}','{}',now(),now()),
('a1990000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-199@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b1990000-0000-4000-8000-000000000001','Multi Franchise P89 SARL','Multi Franchise P89','ACTIVE','a1990000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f1980000-0000-4000-8000-000000000010','PAGE_SCOPE_199','page-scope-199','b1990000-0000-4000-8000-000000000001','DRAFT','a1990000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c1990000-0000-4000-8000-000000000001','b1990000-0000-4000-8000-000000000001','a1990000-0000-4000-8000-000000000001','ACTIVE',now()),
('c1990000-0000-4000-8000-000000000002','b1990000-0000-4000-8000-000000000001','a1990000-0000-4000-8000-000000000002','ACTIVE',now()),
('c1990000-0000-4000-8000-000000000003','b1990000-0000-4000-8000-000000000001','a1990000-0000-4000-8000-000000000003','ACTIVE',now()),
('c1990000-0000-4000-8000-000000000004','b1990000-0000-4000-8000-000000000001','a1990000-0000-4000-8000-000000000004','ACTIVE',now()),
('c1990000-0000-4000-8000-000000000005','b1990000-0000-4000-8000-000000000001','a1990000-0000-4000-8000-000000000005','ACTIVE',now());
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values
('d1990000-0000-4000-8000-000000000001','f1980000-0000-4000-8000-000000000010','b1990000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F1','ACTIVE','a1990000-0000-4000-8000-000000000001'),
('d1990000-0000-4000-8000-000000000002','f1980000-0000-4000-8000-000000000010','b1990000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F2','ACTIVE','a1990000-0000-4000-8000-000000000003');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('c1990000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','d1990000-0000-4000-8000-000000000001'),
('c1990000-0000-4000-8000-000000000002','FRANCHISE_VIEWER','d1990000-0000-4000-8000-000000000001'),
('c1990000-0000-4000-8000-000000000003','FRANCHISE_MANAGER','d1990000-0000-4000-8000-000000000002'),
('c1990000-0000-4000-8000-000000000004','FRANCHISE_VIEWER','d1990000-0000-4000-8000-000000000002'),
('c1990000-0000-4000-8000-000000000005','FRANCHISE_VIEWER',null);
insert into public.platform_user_roles(user_id,role_code)values('a1990000-0000-4000-8000-000000000006','MATRICIA_ADMIN');

insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by)values('f1980000-0000-4000-8000-000000000010','b1990000-0000-4000-8000-000000000001','ACTIVE',now()-interval'1 day',1,'a1990000-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select 'd1920000-0000-4000-8000-000000000001',id,'d1930000-0000-4000-8000-000000000001','d1940000-0000-4000-8000-000000000001',1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('a',64),created_by from public.franchises where id='d1990000-0000-4000-8000-000000000001';
update public.franchises set current_mandate_version_id='d1920000-0000-4000-8000-000000000001'where id='d1990000-0000-4000-8000-000000000001';
insert into public.question_bank_questions(id,library_id,question_key,scope,created_by,current_published_version_id)
select ('f1990000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f1980000-0000-4000-8000-000000000010','PAGE_'||lpad(i::text,5,'0'),'LIBRARY','a1990000-0000-4000-8000-000000000001',('f1991000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,1251)i;
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,content_hash,change_reason,created_by)
select ('f1991000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('f1990000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f1980000-0000-4000-8000-000000000010',1,'APPROVED','Question '||i,case when i=1251 then'بحث فريد'else'سؤال '||i end,'YES_NO','page.'||i,repeat('a',64),'Fixture recherche paginée','a1990000-0000-4000-8000-000000000001'from generate_series(1,1251)i;
set local session_replication_role=origin;
grant usage on schema extensions to authenticated;
create temporary table pages(kind text,value jsonb);grant select,insert on pages to authenticated;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a1990000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into pages values('FIRST',public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION','',1)),('LAST',public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION','',51)),('SEARCH',public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION','بحث فريد',1)),('BANK',public.franchise_catalog_bank('d1990000-0000-4000-8000-000000000001','QUESTION','',51));
select is((select(value->'groups'->'QUESTION'->>'total')::int from pages where kind='FIRST'),1251,'total includes rows outside display page');
select is((select jsonb_array_length(value->'groups'->'QUESTION'->'ids')from pages where kind='FIRST'),25,'workspace page returns bounded identities');
select is((select jsonb_array_length(value->'groups'->'QUESTION'->'ids')from pages where kind='LAST'),1,'last page reaches every identity');
select is((select(value->'groups'->'QUESTION'->>'total')::int from pages where kind='SEARCH'),1,'Arabic search applies on server before pagination');
select is((select jsonb_array_length(value->'items')from pages where kind='BANK'),1,'approved constructor bank also paginates on server');
select is((select(value->>'total')::int from pages where kind='BANK'),1251,'approved bank retains exhaustive total');
select ok(public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION','',1,'f1990000-0000-4000-8000-000000001251')->'groups'->'QUESTION'->'ids' @> '["f1990000-0000-4000-8000-000000001251"]'::jsonb,'direct detail keeps its selected identity outside the first page');
select set_config('request.jwt.claims','{"sub":"a1990000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','sibling mandate is denied before catalogue paging');
select throws_ok($$select public.franchise_catalog_bank('d1990000-0000-4000-8000-000000000001','QUESTION')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','sibling mandate cannot search approved references');
select set_config('request.jwt.claims','{"sub":"a1990000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select ok(not(public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION','',1,'f1990000-0000-4000-8000-999999999999')->'groups'->'QUESTION'->'ids' @> '["f1990000-0000-4000-8000-999999999999"]'::jsonb),'guessed foreign object cannot extend selected page');
reset role;insert into public.platform_user_roles(user_id,role_code)values('a1990000-0000-4000-8000-000000000001','MATRICIA_ADMIN');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a1990000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','platform AAL1 cannot use its franchise role to bypass question MFA');
select throws_ok($$select public.franchise_catalog_bank('d1990000-0000-4000-8000-000000000001','QUESTION')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','approved bank applies the same platform AAL1 gate');
select set_config('request.jwt.claims','{"sub":"a1990000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION')$$,'same scoped platform/franchise actor can read at AAL2');
reset role;set local session_replication_role=replica;update public.catalog_library_mandates set status='SUSPENDED'where library_id='f1980000-0000-4000-8000-000000000010';
-- Remove platform role inside this isolated fixture so catalogue mandate is independently exercised.
delete from public.platform_user_roles where user_id='a1990000-0000-4000-8000-000000000001';set local session_replication_role=origin;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a1990000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','active franchise without active catalogue mandate is denied');
reset role;set local session_replication_role=replica;update public.catalog_library_mandates set status='ACTIVE'where library_id='f1980000-0000-4000-8000-000000000010';set local session_replication_role=replica;update public.franchise_mandate_versions set effective_until=now()-interval'1 hour'where id='d1920000-0000-4000-8000-000000000001';set local session_replication_role=origin;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a1990000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.franchise_catalog_bank('d1990000-0000-4000-8000-000000000001','QUESTION')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','expired franchise mandate is denied');
reset role;set local session_replication_role=replica;update public.franchise_mandate_versions set effective_until=null where id='d1920000-0000-4000-8000-000000000001';set local session_replication_role=origin;update public.organizations set status='SUSPENDED'where id='b1990000-0000-4000-8000-000000000001';
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a1990000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.franchise_catalog_page('d1990000-0000-4000-8000-000000000001','QUESTION')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','suspended organization cannot use catalogue projection');
reset role;select *from finish();rollback;
