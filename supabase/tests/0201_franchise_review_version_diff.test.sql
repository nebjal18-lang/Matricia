begin;set local search_path=public,extensions;select plan(6);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2010000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f1-201@example.invalid','',now(),'{}','{}',now(),now()),
('a2010000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f1-201@example.invalid','',now(),'{}','{}',now(),now()),
('a2010000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f2-201@example.invalid','',now(),'{}','{}',now(),now()),
('a2010000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f2-201@example.invalid','',now(),'{}','{}',now(),now()),
('a2010000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unscoped-201@example.invalid','',now(),'{}','{}',now(),now()),
('a2010000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-201@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2010000-0000-4000-8000-000000000001','Multi Franchise P89 SARL','Multi Franchise P89','ACTIVE','a2010000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f2080000-0000-4000-8000-000000000010','DIFF_SCOPE_201','diff-scope-201','b2010000-0000-4000-8000-000000000001','DRAFT','a2010000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2010000-0000-4000-8000-000000000002','b2010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000002','ACTIVE',now()),
('c2010000-0000-4000-8000-000000000003','b2010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000003','ACTIVE',now()),
('c2010000-0000-4000-8000-000000000004','b2010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000004','ACTIVE',now()),
('c2010000-0000-4000-8000-000000000005','b2010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000005','ACTIVE',now());
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values
('d2010000-0000-4000-8000-000000000001','f2080000-0000-4000-8000-000000000010','b2010000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F1','ACTIVE','a2010000-0000-4000-8000-000000000001'),
('d2010000-0000-4000-8000-000000000002','f2080000-0000-4000-8000-000000000010','b2010000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F2','ACTIVE','a2010000-0000-4000-8000-000000000003');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('c2010000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','d2010000-0000-4000-8000-000000000001'),
('c2010000-0000-4000-8000-000000000002','FRANCHISE_VIEWER','d2010000-0000-4000-8000-000000000001'),
('c2010000-0000-4000-8000-000000000003','FRANCHISE_MANAGER','d2010000-0000-4000-8000-000000000002'),
('c2010000-0000-4000-8000-000000000004','FRANCHISE_VIEWER','d2010000-0000-4000-8000-000000000002'),
('c2010000-0000-4000-8000-000000000005','FRANCHISE_VIEWER',null);
insert into public.platform_user_roles(user_id,role_code)values('a2010000-0000-4000-8000-000000000006','MATRICIA_ADMIN');

insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by)values('f2080000-0000-4000-8000-000000000010','b2010000-0000-4000-8000-000000000001','ACTIVE',now()-interval'1 day',1,'a2010000-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select 'd2120000-0000-4000-8000-000000000001',id,'d2130000-0000-4000-8000-000000000001','d2140000-0000-4000-8000-000000000001',1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('a',64),created_by from public.franchises where id='d2010000-0000-4000-8000-000000000001';
update public.franchises set current_mandate_version_id='d2120000-0000-4000-8000-000000000001'where id='d2010000-0000-4000-8000-000000000001';
insert into public.question_bank_questions(id,library_id,question_key,scope,created_by,current_published_version_id)
select ('f2010000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f2080000-0000-4000-8000-000000000010','PAGE_'||lpad(i::text,5,'0'),'LIBRARY','a2010000-0000-4000-8000-000000000001',('f2011000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,3)i;
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,content_hash,change_reason,created_by)
select ('f2011000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('f2010000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f2080000-0000-4000-8000-000000000010',1,'APPROVED','Question '||i,case when i=601 then'بحث فريد'else'سؤال '||i end,'YES_NO','page.'||i,repeat('a',64),'Fixture recherche paginée','a2010000-0000-4000-8000-000000000001'from generate_series(1,3)i;
set local session_replication_role=origin;
grant usage on schema extensions to authenticated;
create temporary table pages(kind text,value jsonb);grant select,insert on pages to authenticated;
set local session_replication_role=replica;
insert into public.question_rules(id,library_id,rule_key,current_published_version_id,current_draft_version_id,created_by)values('f2012000-0000-4000-8000-000000000001','f2080000-0000-4000-8000-000000000010','DIFF_RULE','f2012100-0000-4000-8000-000000000001','f2012100-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000001');
insert into public.question_rule_versions(id,rule_id,library_id,version,status,condition_ast,actions,dependency_graph,priority,sensitive,compiled_hash,change_reason,created_by)values
('f2012100-0000-4000-8000-000000000001','f2012000-0000-4000-8000-000000000001','f2080000-0000-4000-8000-000000000010',1,'APPROVED','{"group":"AND","conditions":[]}','[{"type":"HUMAN_REVIEW"}]','{}',10,false,repeat('a',64),'Version revue','a2010000-0000-4000-8000-000000000001'),
('f2012100-0000-4000-8000-000000000002','f2012000-0000-4000-8000-000000000001','f2080000-0000-4000-8000-000000000010',2,'DRAFT','{"group":"AND","conditions":[]}','[{"type":"HUMAN_REVIEW"}]','{}',20,false,repeat('b',64),'Priorité corrigée','a2010000-0000-4000-8000-000000000001');
insert into public.catalog_change_requests(id,library_id,target_type,target_id,target_version_id,status,sensitive,requested_by,reviewed_by,reviewed_at,review_comment)values('f2012200-0000-4000-8000-000000000001','f2080000-0000-4000-8000-000000000010','RULE','f2012000-0000-4000-8000-000000000001','f2012100-0000-4000-8000-000000000001','REJECTED',false,'a2010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000006',now(),'Corriger la priorité avant resoumission');
set local session_replication_role=origin;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into pages values('DIFF',public.franchise_catalog_review_diff('d2010000-0000-4000-8000-000000000001','f2012200-0000-4000-8000-000000000001'));
select is((select(value->>'beforeVersion')::int from pages where kind='DIFF'),1,'review comparison starts at reviewed immutable version');
select is((select(value->>'afterVersion')::int from pages where kind='DIFF'),2,'review comparison ends at current correction draft');
select is((select value->>'reviewedBy'from pages where kind='DIFF'),'a2010000-0000-4000-8000-000000000006','review author comes from actual decision');
select is((select value->>'afterHash'from pages where kind='DIFF'),repeat('b',64),'current version hash is included');
select is((select value->'changes'from pages where kind='DIFF'),'[{"field":"priority","before":10,"after":20}]'::jsonb,'only actual business field delta is shown');
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.franchise_catalog_review_diff('d2010000-0000-4000-8000-000000000001','f2012200-0000-4000-8000-000000000001')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','sibling mandate cannot inspect version differences');
reset role;select *from finish();rollback;
