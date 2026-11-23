begin;
set local search_path=public,extensions;
select plan(49);

-- Contract under test:
-- create_catalog_library(steward,code,slug,FR,AR,descriptions,icon,sort,sensitive,reason,idempotency,correlation)
-- create/save category and subcategory use the same complete version payload; saves add expected identity/version row versions.
-- submit_catalog_change(type,identity,version,expected identity/version,idempotency,correlation)
-- decide_catalog_change(request,'APPROVE'|'REJECT',reason,expected request version,idempotency,correlation)

select ok((select bool_and(p.prosecdef and p.proconfig::text like '%search_path=pg_catalog%')
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('create_catalog_library','save_catalog_library_draft','create_catalog_category','save_catalog_category_draft','create_catalog_subcategory','save_catalog_subcategory_draft','submit_catalog_change','decide_catalog_change')),
 'all hierarchy commands are SECURITY DEFINER with a fixed search path');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_catalog_library','save_catalog_library_draft','create_catalog_category','save_catalog_category_draft','create_catalog_subcategory','save_catalog_subcategory_draft','submit_catalog_change','decide_catalog_change') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))),
 'anon and service role cannot execute any human hierarchy command overload');
select ok((select count(*)=9 and bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_catalog_library','save_catalog_library_draft','create_catalog_category','save_catalog_category_draft','create_catalog_subcategory','save_catalog_subcategory_draft','submit_catalog_change','decide_catalog_change')),
 'authenticated receives every explicit hierarchy command overload');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('begin_catalog_command','finish_catalog_command','assert_catalog_central_aal2_locked','assert_catalog_permission_locked') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))),
 'idempotency internals are not exposed');
select ok(exists(select 1 from pg_constraint where conrelid='public.catalog_command_keys'::regclass and contype='u' and pg_get_constraintdef(oid) like '%command_id%'),
 'catalog commands carry a unique causation identifier');
select ok(not has_table_privilege('authenticated','public.catalog_libraries','INSERT')
 and not has_table_privilege('authenticated','public.catalog_library_versions','UPDATE')
 and not has_table_privilege('authenticated','public.catalog_categories','INSERT')
 and not has_table_privilege('authenticated','public.catalog_subcategory_versions','UPDATE'),
 'authenticated cannot bypass commands with direct hierarchy writes');
select ok((select bool_and(pg_get_functiondef(p.oid) like '%pg_advisory_xact_lock%') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname='begin_catalog_command') or (n.nspname='public' and p.proname in ('save_catalog_library_draft','save_catalog_category_draft','save_catalog_subcategory_draft','submit_catalog_change','decide_catalog_change') and pg_get_function_identity_arguments(p.oid) not like '%boolean%')),
 'idempotency and existing-object mutations acquire transaction-scoped advisory locks');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f3100000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-hierarchy-central@example.invalid','',now(),'{}','{}',now(),now()),
('f3100000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-hierarchy-editor@example.invalid','',now(),'{}','{}',now(),now()),
('f3100000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-hierarchy-reviewer@example.invalid','',now(),'{}','{}',now(),now()),
('f3100000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-hierarchy-outsider@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code) values
('f3100000-0000-0000-0000-000000000001','MATRICIA_ADMIN'),('f3100000-0000-0000-0000-000000000003','MATRICIA_ADMIN');
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('f3110000-0000-0000-0000-000000000001','P06 Hierarchy Steward','P06 Hierarchy Steward','ACTIVE','f3100000-0000-0000-0000-000000000001'),
('f3110000-0000-0000-0000-000000000002','P06 Other Tenant','P06 Other Tenant','ACTIVE','f3100000-0000-0000-0000-000000000004'),
('f3110000-0000-0000-0000-000000000003','P06 Disabled Steward','P06 Disabled Steward','SUSPENDED','f3100000-0000-0000-0000-000000000001');
create temporary table p06_hierarchy_observed(key text primary key,value jsonb);
grant select,insert,update on p06_hierarchy_observed to authenticated;
grant usage on schema extensions to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok($$select public.create_catalog_library('f3110000-0000-0000-0000-000000000001','P06_HIERARCHY','p06-hierarchy','Bibliothèque hiérarchie','مكتبة التسلسل','Description française','وصف عربي','hierarchy',1,false,'Création initiale','p06-hierarchy-create-aal1')$$,'42501'::char(5),'CENTRAL_MFA_REQUIRED','library creation fails closed without AAL2');
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok($$select public.create_catalog_library('f3110000-0000-0000-0000-000000000003','P06_DISABLED','p06-disabled','Bibliothèque inactive','مكتبة غير نشطة','Description française','وصف عربي','disabled',1,false,'Création refusée','p06-hierarchy-disabled')$$,'23514'::char(5),'ACTIVE_STEWARD_ORGANIZATION_REQUIRED','inactive steward organization is rejected');
insert into p06_hierarchy_observed values('library',public.create_catalog_library('f3110000-0000-0000-0000-000000000001','P06_HIERARCHY','p06-hierarchy','Bibliothèque hiérarchie','مكتبة التسلسل','Description française','وصف عربي','hierarchy',1,false,'Création initiale','p06-hierarchy-create','f31f0000-0000-0000-0000-000000000001'));
insert into p06_hierarchy_observed values('library-replay',public.create_catalog_library('f3110000-0000-0000-0000-000000000001','  P06_HIERARCHY  ','  p06-hierarchy  ','  Bibliothèque hiérarchie  ','  مكتبة التسلسل  ','  Description française  ','  وصف عربي  ','  hierarchy  ',1,false,'  Création initiale  ','p06-hierarchy-create','f31f0000-0000-0000-0000-000000000099'));
select is((select value from p06_hierarchy_observed where key='library-replay'),(select value from p06_hierarchy_observed where key='library'),'exact create replay returns the original DTO despite a new correlation');
select extensions.throws_ok($$select public.create_catalog_library('f3110000-0000-0000-0000-000000000001','P06_HIERARCHY','p06-hierarchy-changed','Bibliothèque hiérarchie','مكتبة التسلسل','Description française','وصف عربي','hierarchy',1,false,'Création initiale','p06-hierarchy-create')$$,'22000'::char(5),'IDEMPOTENCY_PAYLOAD_MISMATCH','create key cannot be reused with a changed payload');
reset role;

select ok((select l.status='DRAFT' and l.current_draft_version_id=(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='library') and v.status='DRAFT' and v.content_hash~'^[0-9a-f]{64}$'
 from public.catalog_libraries l join public.catalog_library_versions v on v.library_id=l.id
 where l.id=(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library')),'library and canonical draft version are created atomically');
select ok((select l.code='P06_HIERARCHY' and l.slug='p06-hierarchy' and v.name_fr='Bibliothèque hiérarchie' and v.icon_key='hierarchy' and v.change_reason='Création initiale' from public.catalog_libraries l join public.catalog_library_versions v on v.id=l.current_draft_version_id where l.id=(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library')),'normalized values drive both idempotency and persisted content');
select ok((select count(*)=1 from public.catalog_library_mandates where library_id=(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library') and organization_id='f3110000-0000-0000-0000-000000000001' and status='ACTIVE'),'active steward receives an explicit library mandate');
select ok((select count(*)=1 from public.audit_events where action='catalog.library.created' and resource_id=(select value->>'library_id' from p06_hierarchy_observed where key='library'))
 and (select count(*)=1 and bool_and(causation_id is not null and idempotency_key='p06-hierarchy-create') from public.event_outbox where event_type='CatalogLibraryCreatedV1' and aggregate_id=(select value->>'library_id' from p06_hierarchy_observed where key='library')),'create emits one correlated audit and one command-caused Outbox event');

insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values('f3120000-0000-0000-0000-000000000001','f3110000-0000-0000-0000-000000000001','f3100000-0000-0000-0000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code,library_id) values('f3120000-0000-0000-0000-000000000001','FRANCHISE_OWNER',(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library'));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p06_hierarchy_observed values('category',public.create_catalog_category((select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library'),'P06_CATEGORY','p06-category','Catégorie initiale','فئة أولية','Description catégorie','وصف الفئة','category',1,'{}',false,'Création catégorie','p06-category-create'));
insert into p06_hierarchy_observed values('subcategory',public.create_catalog_subcategory((select (value->>'category_id')::uuid from p06_hierarchy_observed where key='category'),'P06_SUBCATEGORY','p06-subcategory','Sous-catégorie initiale','فئة فرعية أولية','Description sous-catégorie','وصف الفئة الفرعية','subcategory',1,'{}',true,'Création sous-catégorie','p06-subcategory-create'));
reset role;
select ok((select c.library_id=(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library') and v.status='DRAFT' from public.catalog_categories c join public.catalog_category_versions v on v.id=c.current_draft_version_id where c.id=(select (value->>'category_id')::uuid from p06_hierarchy_observed where key='category')),'mandated editor creates a category and draft');
select ok((select s.library_id=(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library') and s.category_id=(select (value->>'category_id')::uuid from p06_hierarchy_observed where key='category') and v.sensitive from public.catalog_subcategories s join public.catalog_subcategory_versions v on v.id=s.current_draft_version_id where s.id=(select (value->>'subcategory_id')::uuid from p06_hierarchy_observed where key='subcategory')),'subcategory derives and preserves its parent library and sensitivity');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok(format($sql$select public.create_catalog_category(%L::uuid,'CROSS_TENANT','cross-tenant','Catégorie refusée','فئة مرفوضة','Description refusée','وصف مرفوض','denied',2,'{}',false,'Tentative interdite','p06-cross-tenant')$sql$,(select value->>'library_id' from p06_hierarchy_observed where key='library')),'42501'::char(5),'CATALOG_SCOPE_DENIED','cross-tenant actor cannot create under another library');
select extensions.throws_ok(format($sql$select public.save_catalog_category_draft(%L::uuid,%L::uuid,'Refus cross tenant','رفض','Description refusée','وصف مرفوض','category',2,'{}',false,'Tentative interdite',1,1,'p06-cross-save')$sql$,(select value->>'category_id' from p06_hierarchy_observed where key='category'),(select value->>'version_id' from p06_hierarchy_observed where key='category')),'42501'::char(5),'CATALOG_SCOPE_DENIED','cross-tenant actor cannot save another library draft');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p06_hierarchy_observed values('category-save',public.save_catalog_category_draft((select (value->>'category_id')::uuid from p06_hierarchy_observed where key='category'),(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='category'),'Catégorie modifiée','فئة معدلة','Description catégorie modifiée','وصف الفئة المعدل','category',2,'{"segment":"SME"}',false,'Modification catégorie',1,1,'p06-category-save'));
insert into p06_hierarchy_observed values('subcategory-save',public.save_catalog_subcategory_draft((select (value->>'subcategory_id')::uuid from p06_hierarchy_observed where key='subcategory'),(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='subcategory'),'Sous-catégorie modifiée','فئة فرعية معدلة','Description sous-catégorie modifiée','وصف الفئة الفرعية المعدل','subcategory',2,'{"priority":true}',true,'Modification sous-catégorie',1,1,'p06-subcategory-save'));
select extensions.throws_ok(format($sql$select public.save_catalog_category_draft(%L::uuid,%L::uuid,'Refus','رفض','Description refusée','وصف مرفوض','category',3,'{}',false,'Tentative refusée',null,2,'p06-category-null-lock')$sql$,(select value->>'category_id' from p06_hierarchy_observed where key='category'),(select value->>'version_id' from p06_hierarchy_observed where key='category')),'22023'::char(5),'INVALID_CATALOG_VERSION','save rejects a NULL expected identity version');
reset role;
select is((select value->>'version_id' from p06_hierarchy_observed where key='category-save'),(select value->>'version_id' from p06_hierarchy_observed where key='category'),'saving a DRAFT updates the same version identity');
select ok((select name_fr='Catégorie modifiée' and sort_order=2 and row_version=2 from public.catalog_category_versions where id=(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='category')),'draft save persists the complete payload and advances the version lock');
select is((select value->>'version_id' from p06_hierarchy_observed where key='subcategory-save'),(select value->>'version_id' from p06_hierarchy_observed where key='subcategory'),'subcategory DRAFT save updates the same version identity');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok(format($sql$select public.submit_catalog_change('SUBCATEGORY',%L::uuid,%L::uuid,2,2,'p06-sensitive-aal1')$sql$,(select value->>'subcategory_id' from p06_hierarchy_observed where key='subcategory'),(select value->>'version_id' from p06_hierarchy_observed where key='subcategory')),'42501'::char(5),'CATALOG_SENSITIVE_MFA_REQUIRED','sensitive submission fails closed without AAL2');
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p06_hierarchy_observed values('subcategory-submit',public.submit_catalog_change('SUBCATEGORY',(select (value->>'subcategory_id')::uuid from p06_hierarchy_observed where key='subcategory'),(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='subcategory'),2,2,'p06-subcategory-submit'));
insert into p06_hierarchy_observed values('subcategory-submit-replay',public.submit_catalog_change('SUBCATEGORY',(select (value->>'subcategory_id')::uuid from p06_hierarchy_observed where key='subcategory'),(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='subcategory'),2,2,'p06-subcategory-submit'));
insert into p06_hierarchy_observed values('category-submit',public.submit_catalog_change('CATEGORY',(select (value->>'category_id')::uuid from p06_hierarchy_observed where key='category'),(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='category'),2,2,'p06-category-submit'));
select extensions.throws_ok(format($sql$select public.submit_catalog_change('CATEGORY',%L::uuid,%L::uuid,null,2,'p06-submit-null-lock')$sql$,(select value->>'category_id' from p06_hierarchy_observed where key='category'),(select value->>'version_id' from p06_hierarchy_observed where key='category')),'22023'::char(5),'INVALID_CATALOG_CHANGE','submit rejects a NULL expected identity version');
select extensions.throws_ok(format($sql$select public.decide_catalog_change(%L::uuid,'APPROVE','Auto approbation interdite',1,'p06-self-decide')$sql$,(select value->>'change_request_id' from p06_hierarchy_observed where key='subcategory-submit')),'42501'::char(5),'CATALOG_APPROVAL_DENIED','non-approver cannot decide even within the mandate');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p06_hierarchy_observed values('library-submit',public.submit_catalog_change('LIBRARY',(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library'),(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='library'),1,1,'p06-library-submit'));
select extensions.throws_ok(format($sql$select public.decide_catalog_change(%L::uuid,'APPROVE','Auto approbation centrale',1,'p06-central-self-decide')$sql$,(select value->>'change_request_id' from p06_hierarchy_observed where key='library-submit')),'42501'::char(5),'CATALOG_SELF_APPROVAL_DENIED','central requester cannot approve their own change');
reset role;
select is((select value from p06_hierarchy_observed where key='subcategory-submit-replay'),(select value from p06_hierarchy_observed where key='subcategory-submit'),'exact submit replay returns the original DTO after state and row versions advanced');
select ok((select count(*)=3 and bool_and(status='IN_REVIEW') from public.catalog_change_requests where id in ((select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='subcategory-submit'),(select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='category-submit'),(select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='library-submit'))),'submit supports all three hierarchy targets');
select ok((select count(*)=3 from public.event_outbox where event_type='CatalogChangeSubmittedV1' and aggregate_id in (select value->>'change_request_id' from p06_hierarchy_observed where key like '%-submit')),'each hierarchy submission emits one Outbox event');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok(format($sql$select public.decide_catalog_change(%L::uuid,'APPROVE','Validation centrale',1,'p06-review-aal1')$sql$,(select value->>'change_request_id' from p06_hierarchy_observed where key='subcategory-submit')),'42501'::char(5),'CATALOG_APPROVAL_DENIED','central review fails closed without AAL2');
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok(format($sql$select public.decide_catalog_change(%L::uuid,null,'Décision absente',1,'p06-null-text-decision')$sql$,(select value->>'change_request_id' from p06_hierarchy_observed where key='subcategory-submit')),'22023'::char(5),'INVALID_CATALOG_DECISION','text decision rejects NULL explicitly');
select extensions.throws_ok(format($sql$select public.decide_catalog_change(%L::uuid,null::boolean,'Décision absente',1,'p06-null-bool-decision')$sql$,(select value->>'change_request_id' from p06_hierarchy_observed where key='subcategory-submit')),'22023'::char(5),'INVALID_CATALOG_DECISION','legacy boolean wrapper rejects NULL explicitly');
select extensions.throws_ok(format($sql$select public.decide_catalog_change(%L::uuid,'APPROVE','Version invalide',0,'p06-zero-decision-version')$sql$,(select value->>'change_request_id' from p06_hierarchy_observed where key='subcategory-submit')),'22023'::char(5),'INVALID_CATALOG_DECISION','decision rejects a non-positive expected version');
insert into p06_hierarchy_observed values('subcategory-decision',public.decide_catalog_change((select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='subcategory-submit'),'APPROVE','Validation centrale',1,'p06-subcategory-decide'));
insert into p06_hierarchy_observed values('subcategory-decision-replay',public.decide_catalog_change((select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='subcategory-submit'),'APPROVE','Validation centrale',1,'p06-subcategory-decide'));
insert into p06_hierarchy_observed values('category-decision',public.decide_catalog_change((select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='category-submit'),'REJECT','Correction traduction',1,'p06-category-decide'));
insert into p06_hierarchy_observed values('library-decision',public.decide_catalog_change((select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='library-submit'),'APPROVE','Validation bibliothèque',1,'p06-library-decide'));
select extensions.throws_ok(format($sql$select public.decide_catalog_change(%L::uuid,'REJECT','Payload différent',1,'p06-subcategory-decide')$sql$,(select value->>'change_request_id' from p06_hierarchy_observed where key='subcategory-submit')),'22000'::char(5),'IDEMPOTENCY_PAYLOAD_MISMATCH','decision key rejects a different payload');
reset role;
select is((select value from p06_hierarchy_observed where key='subcategory-decision-replay'),(select value from p06_hierarchy_observed where key='subcategory-decision'),'exact decision replay returns the original DTO');
select ok((select status='APPROVED' from public.catalog_subcategory_versions where id=(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='subcategory'))
 and (select status='DRAFT' from public.catalog_category_versions where id=(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='category'))
 and (select status='APPROVED' from public.catalog_library_versions where id=(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='library')),'multi-target decisions transition each target correctly');
select ok((select count(*)=3 and bool_and(before_hash is null and after_hash is not null) from public.catalog_approvals where change_request_id in ((select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='subcategory-submit'),(select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='category-submit'),(select (value->>'change_request_id')::uuid from p06_hierarchy_observed where key='library-submit'))),'new hierarchy identities preserve NULL before and real target after hashes');
select ok((select count(*)=3 from public.event_outbox where event_type in ('CatalogChangeApprovedV1','CatalogChangeRejectedV1') and aggregate_id in (select value->>'change_request_id' from p06_hierarchy_observed where key like '%-submit')),'decisions emit one command-caused Outbox event each');

insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,created_by,published_at) values
('f31a0000-0000-0000-0000-000000000000',(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library'),'P06.HIERARCHY.PREVIOUS','PUBLISHED',repeat('7',64),repeat('8',64),'f3100000-0000-0000-0000-000000000001',clock_timestamp());
update public.catalog_libraries set current_release_id='f31a0000-0000-0000-0000-000000000000' where id=(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,created_by) values
('f31a0000-0000-0000-0000-000000000001',(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library'),'P06.HIERARCHY.RELEASE','IN_REVIEW',repeat('8',64),repeat('9',64),'f3100000-0000-0000-0000-000000000001');
insert into public.catalog_change_requests(id,library_id,target_type,target_id,target_version_id,status,sensitive,requested_by) values
('f31b0000-0000-0000-0000-000000000001',(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library'),'RELEASE','f31a0000-0000-0000-0000-000000000001','f31a0000-0000-0000-0000-000000000001','IN_REVIEW',true,'f3100000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p06_hierarchy_observed values('release-decision',public.decide_catalog_change('f31b0000-0000-0000-0000-000000000001',true,'Validation release sensible',1,'p06-release-wrapper'));
reset role;
select is((select value->>'outcome' from p06_hierarchy_observed where key='release-decision'),'CATALOG_CHANGE_APPROVED','legacy boolean wrapper delegates an explicit approval');
select ok((select status='APPROVED' and approved_by='f3100000-0000-0000-0000-000000000003' from public.catalog_releases where id='f31a0000-0000-0000-0000-000000000001'),'RELEASE target is approved by the central reviewer');
select ok((select before_hash=repeat('8',64) and after_hash=repeat('9',64) from public.catalog_approvals where change_request_id='f31b0000-0000-0000-0000-000000000001'),'RELEASE approval captures current and candidate snapshot hashes');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p06_hierarchy_observed values('library-v2',public.save_catalog_library_draft((select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library'),(select (value->>'version_id')::uuid from p06_hierarchy_observed where key='library'),'Bibliothèque version deux','مكتبة الإصدار الثاني','Description française v2','وصف عربي للإصدار الثاني','hierarchy',2,false,'Nouvelle version brouillon',3,3,'p06-library-v2'));
reset role;
select isnt((select value->>'version_id' from p06_hierarchy_observed where key='library-v2'),(select value->>'version_id' from p06_hierarchy_observed where key='library'),'saving an approved version creates a new DRAFT identity');
select ok((select count(*)=2 and bool_or(status='APPROVED' and name_fr='Bibliothèque hiérarchie') and bool_or(status='DRAFT' and name_fr='Bibliothèque version deux') from public.catalog_library_versions where library_id=(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library')),'approved history remains unchanged beside the new draft');
select extensions.throws_ok(format($sql$select public.save_catalog_library_draft(%L::uuid,%L::uuid,'Écriture obsolète','كتابة قديمة','Description obsolète','وصف قديم','hierarchy',3,false,'Écriture obsolète',3,3,'p06-library-stale')$sql$,(select value->>'library_id' from p06_hierarchy_observed where key='library'),(select value->>'version_id' from p06_hierarchy_observed where key='library')),'PT409'::char(5),'STALE_CATALOG_VERSION','stale identity lock rejects a lost update');
select ok((select count(*)=1 from public.event_outbox where event_type='CatalogLibraryDraftSavedV1' and aggregate_id=(select value->>'library_id' from p06_hierarchy_observed where key='library')),'new-version save emits exactly one event without duplicating history');

update public.organization_memberships set status='SUSPENDED',row_version=row_version+1,updated_at=clock_timestamp() where id='f3120000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok(format($sql$select public.save_catalog_library_draft(%L::uuid,%L::uuid,'Refus membership','رفض العضوية','Description refusée','وصف مرفوض','hierarchy',3,false,'Membership inactive',4,1,'p06-inactive-membership')$sql$,(select value->>'library_id' from p06_hierarchy_observed where key='library'),(select value->>'version_id' from p06_hierarchy_observed where key='library-v2')),'42501'::char(5),'CATALOG_SCOPE_DENIED','inactive membership is rechecked before save');
reset role;
update public.organization_memberships set status='ACTIVE',row_version=row_version+1,updated_at=clock_timestamp() where id='f3120000-0000-0000-0000-000000000001';
update public.organizations set status='SUSPENDED',row_version=row_version+1,updated_at=clock_timestamp() where id='f3110000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok(format($sql$select public.save_catalog_library_draft(%L::uuid,%L::uuid,'Refus organisation','رفض المؤسسة','Description refusée','وصف مرفوض','hierarchy',3,false,'Organisation inactive',4,1,'p06-inactive-organization')$sql$,(select value->>'library_id' from p06_hierarchy_observed where key='library'),(select value->>'version_id' from p06_hierarchy_observed where key='library-v2')),'42501'::char(5),'CATALOG_SCOPE_DENIED','inactive steward organization is rechecked before save');
reset role;
update public.organizations set status='ACTIVE',row_version=row_version+1,updated_at=clock_timestamp() where id='f3110000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
select public.revoke_catalog_library_mandate((select id from public.catalog_library_mandates where library_id=(select (value->>'library_id')::uuid from p06_hierarchy_observed where key='library')),1,'Fin du mandat de test','p06-revoke-mandate');
select set_config('request.jwt.claims','{"sub":"f3100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok(format($sql$select public.save_catalog_library_draft(%L::uuid,%L::uuid,'Refus révocation','رفض الإلغاء','Description refusée','وصف مرفوض','hierarchy',3,false,'Mandat révoqué',4,1,'p06-revoked-mandate')$sql$,(select value->>'library_id' from p06_hierarchy_observed where key='library'),(select value->>'version_id' from p06_hierarchy_observed where key='library-v2')),'42501'::char(5),'CATALOG_SCOPE_DENIED','revoked mandate is rechecked before save');
reset role;

select * from finish();
rollback;
