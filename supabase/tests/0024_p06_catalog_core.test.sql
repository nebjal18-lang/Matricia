begin;
set local search_path=public,extensions;
select plan(107);

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
insert into public.catalog_library_versions(id,library_id,version,status,name_fr,name_ar,description_fr,description_ar,icon_key,sort_order,change_reason,content_hash,sensitive,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by) values
('c2440000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001',1,'APPROVED','Bibliothèque A','مكتبة أ','Description A','وصف المكتبة أ','library-a',1,'Version initiale','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',true,'APPROVED','c2400000-0000-0000-0000-000000000002',now(),repeat('1',64),1,'c2400000-0000-0000-0000-000000000001'),
('c2440000-0000-0000-0000-000000000002','c2430000-0000-0000-0000-000000000002',1,'APPROVED','Bibliothèque B','مكتبة ب','Description B','وصف المكتبة ب','library-b',1,'Version initiale','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',true,'APPROVED','c2400000-0000-0000-0000-000000000002',now(),repeat('2',64),1,'c2400000-0000-0000-0000-000000000003'),
('c2440000-0000-0000-0000-000000000006','c2430000-0000-0000-0000-000000000001',2,'APPROVED','Bibliothèque A révisée','مكتبة أ منقحة','Description révisée','وصف منقح','library-a',2,'Révision arabe contrôlée',repeat('6',64),true,'PENDING',null,null,null,0,'c2400000-0000-0000-0000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,created_by) values ('c2450000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001','CAT_A','cat-a','c2400000-0000-0000-0000-000000000001');
insert into public.catalog_category_versions(id,category_id,library_id,version,status,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by) values ('c2460000-0000-0000-0000-000000000001','c2450000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001',1,'APPROVED','Catégorie A','الفئة أ','Description catégorie','وصف الفئة',1,'Version initiale',repeat('c',64),'APPROVED','c2400000-0000-0000-0000-000000000002',now(),repeat('3',64),1,'c2400000-0000-0000-0000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by) values ('c2470000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001','c2450000-0000-0000-0000-000000000001','SUB_A','sub-a','c2400000-0000-0000-0000-000000000001');
insert into public.catalog_subcategory_versions(id,subcategory_id,library_id,version,status,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by) values ('c2480000-0000-0000-0000-000000000001','c2470000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001',1,'APPROVED','Sous-catégorie A','الفئة الفرعية أ','Description sous-catégorie','وصف الفئة الفرعية',1,'Version initiale',repeat('d',64),'APPROVED','c2400000-0000-0000-0000-000000000002',now(),repeat('4',64),1,'c2400000-0000-0000-0000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by) values ('c2490000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001','c2470000-0000-0000-0000-000000000001','SVC_A','svc-a','c2400000-0000-0000-0000-000000000001');
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by) values ('c24a0000-0000-0000-0000-000000000001','c2490000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001',1,'APPROVED','Service A','الخدمة أ','Description courte','وصف قصير','Description longue du service','وصف طويل للخدمة','PROFESSIONAL','unité','وحدة',1,'Version initiale',repeat('e',64),'APPROVED','c2400000-0000-0000-0000-000000000002',now(),repeat('5',64),1,'c2400000-0000-0000-0000-000000000001');
insert into public.catalog_service_subcategory_links(id,service_id,subcategory_id,library_id,link_type,created_by) values ('c24b0000-0000-0000-0000-000000000001','c2490000-0000-0000-0000-000000000001','c2470000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001','PRIMARY','c2400000-0000-0000-0000-000000000001');
insert into public.catalog_service_subcategory_link_versions(id,link_id,library_id,version,status,change_reason,content_hash,created_by) values ('c24c0000-0000-0000-0000-000000000001','c24b0000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001',1,'APPROVED','Version initiale',repeat('f',64),'c2400000-0000-0000-0000-000000000001');
insert into public.catalog_import_batches(id,library_id,baseline_key,bundle_hash,manifest,source_kind,created_by) values
('c24e0000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001','P06-STAGING-A',repeat('6',64),'{"rows":1}','FRANCHISE_IMPORT','c2400000-0000-0000-0000-000000000001'),
('c24e0000-0000-0000-0000-000000000002','c2430000-0000-0000-0000-000000000002','P06-STAGING-B',repeat('7',64),'{"rows":1}','FRANCHISE_IMPORT','c2400000-0000-0000-0000-000000000003');

insert into public.catalog_releases(id,library_id,release_key,source_bundle_hash,created_by) values ('c24d0000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001','P06.INCOMPLETE',repeat('9',64),'c2400000-0000-0000-0000-000000000001');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,audience,effective_from,effective_until,created_by,published_at) values
('c24d0000-0000-0000-0000-000000000002','c2430000-0000-0000-0000-000000000002','P06.AUDIENCE','PUBLISHED',repeat('8',64),repeat('8',64),'{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001"]}',now()-interval '1 hour',now()+interval '1 hour','c2400000-0000-0000-0000-000000000001',now()),
('c24d0000-0000-0000-0000-000000000003','c2430000-0000-0000-0000-000000000002','P06.EXPIRED','PUBLISHED',repeat('7',64),repeat('7',64),'{"kind":"PUBLIC"}',now()-interval '2 hours',now()-interval '1 hour','c2400000-0000-0000-0000-000000000001',now()-interval '2 hours'),
('c24d0000-0000-0000-0000-000000000004','c2430000-0000-0000-0000-000000000002','P06.RECLAIM','SCHEDULED',repeat('6',64),repeat('6',64),'{"kind":"PUBLIC"}',now()-interval '1 minute',null,'c2400000-0000-0000-0000-000000000003',null),
('c24d0000-0000-0000-0000-000000000005','c2430000-0000-0000-0000-000000000002','P06.AUDIENCE.CONFLICT','APPROVED',repeat('5',64),repeat('5',64),'{"kind":"PUBLIC"}',now(),null,'c2400000-0000-0000-0000-000000000003',null);
insert into public.catalog_release_items values ('c24d0000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001','LIBRARY','c2430000-0000-0000-0000-000000000001','c2440000-0000-0000-0000-000000000001',repeat('a',64),1);
select throws_ok($$select private.validate_catalog_release_tree('c24d0000-0000-0000-0000-000000000001')$$,'23514','INCOMPLETE_CATALOG_RELEASE','library-only release is rejected');
create temporary table p06_runtime_errors(key text primary key,sqlstate text not null,message text not null);
grant insert,select on p06_runtime_errors to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select public.cancel_catalog_release('c24d0000-0000-0000-0000-000000000001','Catalogue incomplet',1,'p06-cancel-0001');
reset role;
select pass('draft release can be cancelled safely');
select is((select status from public.catalog_releases where id='c24d0000-0000-0000-0000-000000000001'),'CANCELLED','cancel transition is persisted');

create temporary table p06_observed(key text primary key,value jsonb not null);
grant select,insert on p06_observed to authenticated,service_role;

select has_table('public','catalog_releases','catalog releases exist');
select has_table('public','catalog_import_errors','staged import errors exist');
select has_function('public','complete_catalog_release_publish',array['uuid','uuid','integer','uuid'],'worker publication RPC exists');
select has_index('public','catalog_releases','catalog_releases_schedule_idx','scheduled publication has a worker index');
select ok(pg_get_functiondef('public.complete_catalog_release_publish(uuid,uuid,integer,uuid)'::regprocedure) like '%pg_advisory_xact_lock%','worker publication serializes concurrent writers');
select ok(private.can_read_catalog_release('c24d0000-0000-0000-0000-000000000002','c2400000-0000-0000-0000-000000000001'),'organization audience intersects active membership');
select ok(not private.can_read_catalog_release('c24d0000-0000-0000-0000-000000000002','c2400000-0000-0000-0000-000000000003'),'organization audience excludes another organization');
select ok(not private.can_read_catalog_release('c24d0000-0000-0000-0000-000000000003','c2400000-0000-0000-0000-000000000001'),'expired public window is invisible');
select ok(private.catalog_audiences_overlap('{"kind":"PUBLIC"}','{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001"]}'),'PUBLIC overlaps every organization audience');
select ok(private.catalog_audiences_overlap('{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001"]}','{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001","c2410000-0000-0000-0000-000000000002"]}'),'organization audiences overlap on set intersection');
select ok(not private.catalog_audiences_overlap('{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001"]}','{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000002"]}'),'disjoint organization audiences do not overlap');
select is(private.canonical_catalog_audience('{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000002","c2410000-0000-0000-0000-000000000001","c2410000-0000-0000-0000-000000000001"]}'),'{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001","c2410000-0000-0000-0000-000000000002"]}'::jsonb,'organization audience is sorted and deduplicated canonically');
select throws_ok($$select private.canonical_catalog_audience('{"kind":"PUBLIC","organization_ids":[]}'::jsonb)$$,'22023','INVALID_CATALOG_AUDIENCE','PUBLIC audience rejects parasite fields');
select throws_ok($$select private.canonical_catalog_audience('{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000003"]}'::jsonb)$$,'22023','INVALID_CATALOG_AUDIENCE_ORGANIZATION','organization audience rejects inactive organizations');
select ok(not private.has_library_permission('c2430000-0000-0000-0000-000000000003','CATALOG_EDIT','c2400000-0000-0000-0000-000000000004'),'archived organization cannot exercise an otherwise active mandate');
select ok(not has_table_privilege('authenticated','public.catalog_releases','INSERT'),'authenticated cannot insert releases directly');
select ok(not has_table_privilege('service_role','public.catalog_library_versions','UPDATE'),'service role cannot bypass catalog writes');
select ok(not has_table_privilege('authenticated','public.catalog_permission_policies','UPDATE') and not has_table_privilege('authenticated','public.catalog_library_mandates','UPDATE'),'authorization history cannot be mutated directly');
select ok(has_function_privilege('authenticated','public.create_catalog_release(uuid,text,text,boolean,integer,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.add_catalog_release_item(uuid,text,uuid,uuid,text,integer,integer,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.submit_catalog_release(uuid,integer,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.decide_catalog_change(uuid,boolean,text,integer,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.schedule_catalog_release(uuid,timestamp with time zone,timestamp with time zone,jsonb,integer,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.cancel_catalog_release(uuid,text,integer,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.rollback_catalog_release(uuid,uuid,text,integer,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.attest_catalog_ar_translation(text,uuid,text,integer,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.revoke_catalog_library_mandate(uuid,integer,text,text,uuid)','EXECUTE') and has_function_privilege('authenticated','public.revoke_catalog_permission_policy(text,text,integer,text,text,uuid)','EXECUTE') and not has_function_privilege('authenticated','public.complete_catalog_release_publish(uuid,uuid,integer,uuid)','EXECUTE') and not has_function_privilege('authenticated','public.fail_catalog_release_publish(uuid,uuid,text,integer,uuid)','EXECUTE'),'authenticated has only human catalog command RPCs');
select ok(has_function_privilege('service_role','public.claim_catalog_release(uuid,uuid,integer)','EXECUTE') and has_function_privilege('service_role','public.complete_catalog_release_publish(uuid,uuid,integer,uuid)','EXECUTE') and has_function_privilege('service_role','public.fail_catalog_release_publish(uuid,uuid,text,integer,uuid)','EXECUTE'),'service role alone has catalog worker RPCs');
select ok(not has_function_privilege('anon','public.create_catalog_release(uuid,text,text,boolean,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.add_catalog_release_item(uuid,text,uuid,uuid,text,integer,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.submit_catalog_release(uuid,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.decide_catalog_change(uuid,boolean,text,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.schedule_catalog_release(uuid,timestamp with time zone,timestamp with time zone,jsonb,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.cancel_catalog_release(uuid,text,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.rollback_catalog_release(uuid,uuid,text,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.attest_catalog_ar_translation(text,uuid,text,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.revoke_catalog_library_mandate(uuid,integer,text,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.revoke_catalog_permission_policy(text,text,integer,text,text,uuid)','EXECUTE'),'anon has execute on no catalog command RPC');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p06_observed values('lease-expiring',public.claim_catalog_release('c2400000-0000-0000-0000-000000000002','c24d0000-0000-0000-0000-000000000004',1));
insert into p06_observed values('double-claim',public.claim_catalog_release('c2400000-0000-0000-0000-000000000001','c24d0000-0000-0000-0000-000000000004',30));
reset role;
select is((select value->>'outcome' from p06_observed where key='double-claim'),'NO_CATALOG_RELEASE_DUE','live lease prevents a second claim');
select pg_sleep(1.1);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p06_observed values('lease-reclaimed',public.claim_catalog_release('c2400000-0000-0000-0000-000000000001','c24d0000-0000-0000-0000-000000000004',30));
do $runtime$ begin perform public.fail_catalog_release_publish('c24d0000-0000-0000-0000-000000000004',(select (value->>'lease_token')::uuid from p06_observed where key='lease-expiring'),'STALE_WORKER',(select (value->>'release_row_version')::integer from p06_observed where key='lease-expiring')); exception when others then insert into p06_runtime_errors values('stale-worker',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin insert into p06_observed values('reclaimed-failure',public.fail_catalog_release_publish('c24d0000-0000-0000-0000-000000000004',(select (value->>'lease_token')::uuid from p06_observed where key='lease-reclaimed'),'RECLAIM_TEST',(select (value->>'release_row_version')::integer from p06_observed where key='lease-reclaimed'))); exception when others then insert into p06_runtime_errors values('reclaimed-failure',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select value->>'outcome' from p06_observed where key='lease-reclaimed'),'CATALOG_RELEASE_CLAIMED','expired lease is atomically reclaimed');
select ok((select value->>'lease_token' from p06_observed where key='lease-reclaimed')<>(select value->>'lease_token' from p06_observed where key='lease-expiring'),'reclaim rotates lease token');
select is((select sqlstate||':'||message from p06_runtime_errors where key='stale-worker'),'55000:INVALID_CATALOG_LEASE','expired worker cannot fail reclaimed release');
select is((select value->>'outcome' from p06_observed where key='reclaimed-failure'),'CATALOG_RELEASE_FAILED','current reclaimed worker may record failure');
update public.catalog_releases set next_attempt_at=statement_timestamp()-interval '1 second' where id='c24d0000-0000-0000-0000-000000000004' and status='FAILED';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p06_observed values('lease-final-attempt',public.claim_catalog_release('c2400000-0000-0000-0000-000000000002','c24d0000-0000-0000-0000-000000000004',30));
do $runtime$ begin insert into p06_observed values('terminal-failure',public.fail_catalog_release_publish('c24d0000-0000-0000-0000-000000000004',(select (value->>'lease_token')::uuid from p06_observed where key='lease-final-attempt'),'MAX_RETRIES',(select (value->>'release_row_version')::integer from p06_observed where key='lease-final-attempt'))); exception when others then insert into p06_runtime_errors values('terminal-failure',sqlstate,sqlerrm); end $runtime$;
reset role;
select is(coalesce((select value->>'outcome' from p06_observed where key='terminal-failure'),(select sqlstate||':'||message from p06_runtime_errors where key='terminal-failure')),'CATALOG_RELEASE_DEAD_LETTERED','final automatic retry can fail safely');
select is((select status from public.catalog_releases where id='c24d0000-0000-0000-0000-000000000004'),'DEAD_LETTER','max attempts produce an explicit terminal dead-letter state');
select ok((select terminal_at is not null and next_attempt_at is null from public.catalog_releases where id='c24d0000-0000-0000-0000-000000000004'),'dead-letter stores terminal evidence and disables further retry');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
do $runtime$ begin perform public.schedule_catalog_release('c24d0000-0000-0000-0000-000000000005',statement_timestamp(),null,'{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001","c2410000-0000-0000-0000-000000000002"]}',1,'p06-audience-conflict-0001'); exception when others then insert into p06_runtime_errors values('audience-conflict',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select sqlstate||':'||message from p06_runtime_errors where key='audience-conflict'),'23P01:CATALOG_SCHEDULE_CONFLICT','scheduling rejects an organization-set intersection with an active audience');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_observed values('create',public.create_catalog_release('c2430000-0000-0000-0000-000000000001','P06.A.1',repeat('1',64),true,1,'p06-create-0001'));
insert into p06_observed values('create-retry',public.create_catalog_release('c2430000-0000-0000-0000-000000000001','P06.A.1',repeat('1',64),true,1,'p06-create-0001'));
do $runtime$ begin perform public.create_catalog_release('c2430000-0000-0000-0000-000000000001','P06.A.1',repeat('2',64),true,1,'p06-create-0001'); exception when others then insert into p06_runtime_errors values('create-payload-mismatch',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select value from p06_observed where key='create-retry'),(select value from p06_observed where key='create'),'create is idempotent');
select is((select sqlstate||':'||message from p06_runtime_errors where key='create-payload-mismatch'),'22000:IDEMPOTENCY_PAYLOAD_MISMATCH','same key rejects another payload');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select public.add_catalog_release_item((select (value->>'release_id')::uuid from p06_observed where key='create'),'LIBRARY','c2430000-0000-0000-0000-000000000001','c2440000-0000-0000-0000-000000000001',repeat('a',64),1,1,'p06-item-0001');
select public.add_catalog_release_item((select (value->>'release_id')::uuid from p06_observed where key='create'),'CATEGORY','c2450000-0000-0000-0000-000000000001','c2460000-0000-0000-0000-000000000001',repeat('c',64),2,2,'p06-item-0002');
select public.add_catalog_release_item((select (value->>'release_id')::uuid from p06_observed where key='create'),'SUBCATEGORY','c2470000-0000-0000-0000-000000000001','c2480000-0000-0000-0000-000000000001',repeat('d',64),3,3,'p06-item-0003');
select public.add_catalog_release_item((select (value->>'release_id')::uuid from p06_observed where key='create'),'SERVICE','c2490000-0000-0000-0000-000000000001','c24a0000-0000-0000-0000-000000000001',repeat('e',64),4,4,'p06-item-0004');
select public.add_catalog_release_item((select (value->>'release_id')::uuid from p06_observed where key='create'),'SERVICE_SUBCATEGORY_LINK','c24b0000-0000-0000-0000-000000000001','c24c0000-0000-0000-0000-000000000001',repeat('f',64),5,5,'p06-item-0005');
reset role;
select pass('scoped editor adds an approved immutable version');
select pass('category version added');
select pass('subcategory version added');
select pass('service version added');
select pass('primary link version added');
savepoint p06_ar_review;
update public.catalog_release_items set version_id='c2440000-0000-0000-0000-000000000006',content_hash=repeat('6',64) where release_id=(select (value->>'release_id')::uuid from p06_observed where key='create') and object_type='LIBRARY';
select throws_ok(format($q$select private.validate_catalog_release_tree(%L::uuid)$q$,(select value->>'release_id' from p06_observed where key='create')),'23514','CATALOG_AR_REVIEW_REQUIRED','publication validation rejects content without explicit Arabic review');
rollback to savepoint p06_ar_review;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
do $runtime$ begin perform public.attest_catalog_ar_translation('LIBRARY','c2440000-0000-0000-0000-000000000006',repeat('8',64),1,'p06-ar-self-0001'); exception when others then insert into p06_runtime_errors values('ar-self',sqlstate,sqlerrm); end $runtime$;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.attest_catalog_ar_translation('LIBRARY','c2440000-0000-0000-0000-000000000006',repeat('8',64),1,'p06-ar-attest-0001');
select public.attest_catalog_ar_translation('LIBRARY','c2440000-0000-0000-0000-000000000006',repeat('8',64),1,'p06-ar-attest-0001');
reset role;
select is((select sqlstate||':'||message from p06_runtime_errors where key='ar-self'),'42501:TRANSLATION_REVIEW_DENIED','content author cannot self-attest Arabic translation');
select pass('independent central reviewer attests Arabic translation');
select pass('Arabic attestation retry is idempotent');
select ok((select translation_review_status='APPROVED' and translation_reviewer_user_id='c2400000-0000-0000-0000-000000000002' and translation_reviewed_at is not null and translation_review_proof_hash=repeat('8',64) and translation_review_version=1 from public.catalog_library_versions where id='c2440000-0000-0000-0000-000000000006'),'Arabic attestation stores reviewer, time, proof and immutable version');
select throws_ok($$update public.catalog_library_versions set translation_review_proof_hash=repeat('9',64) where id='c2440000-0000-0000-0000-000000000006'$$,'55000','IMMUTABLE_CATALOG_SNAPSHOT','approved translation attestation is immutable');
select ok((select count(*) from public.audit_events where action='catalog.translation.attested' and resource_id='c2440000-0000-0000-0000-000000000006')=1 and (select count(*) from public.event_outbox where event_type='CatalogArabicTranslationAttestedV1' and aggregate_id='c2440000-0000-0000-0000-000000000006')=1,'translation attestation emits audit and Outbox once');
savepoint p06_primary_mismatch;
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by) values('c2470000-0000-0000-0000-000000000002','c2430000-0000-0000-0000-000000000001','c2450000-0000-0000-0000-000000000001','SUB_ALT','sub-alt','c2400000-0000-0000-0000-000000000001');
insert into public.catalog_subcategory_versions(id,subcategory_id,library_id,version,status,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by) values('c2480000-0000-0000-0000-000000000002','c2470000-0000-0000-0000-000000000002','c2430000-0000-0000-0000-000000000001',1,'APPROVED','Alternative','بديل','Alternative primaire','بديل أساسي',2,'Test invariant primaire',repeat('7',64),'APPROVED','c2400000-0000-0000-0000-000000000002',now(),repeat('6',64),1,'c2400000-0000-0000-0000-000000000001');
update public.catalog_services set primary_subcategory_id='c2470000-0000-0000-0000-000000000002' where id='c2490000-0000-0000-0000-000000000001';
insert into public.catalog_release_items(release_id,library_id,object_type,object_id,version_id,content_hash,sort_order) values((select (value->>'release_id')::uuid from p06_observed where key='create'),'c2430000-0000-0000-0000-000000000001','SUBCATEGORY','c2470000-0000-0000-0000-000000000002','c2480000-0000-0000-0000-000000000002',repeat('7',64),6);
select throws_ok(format($q$select private.validate_catalog_release_tree(%L::uuid)$q$,(select value->>'release_id' from p06_observed where key='create')),'23514','PRIMARY_CATALOG_LINK_REQUIRED','published primary link must exactly match service primary_subcategory_id');
rollback to savepoint p06_primary_mismatch;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select public.submit_catalog_release((select (value->>'release_id')::uuid from p06_observed where key='create'),6,'p06-submit-0001');
reset role;
select pass('sensitive complete release enters review');
select is((select status from public.catalog_releases where id=(select (value->>'release_id')::uuid from p06_observed where key='create')),'IN_REVIEW','submitted release is in review');
select is((select count(*) from public.catalog_change_requests where target_id=(select (value->>'release_id')::uuid from p06_observed where key='create')),1::bigint,'one central change request exists');

insert into public.platform_user_roles(user_id,role_code) values ('c2400000-0000-0000-0000-000000000001','MATRICIA_ADMIN');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
do $runtime$ begin perform public.decide_catalog_change((select id from public.catalog_change_requests where target_id=(select (value->>'release_id')::uuid from p06_observed where key='create')),true,'Auto approbation',1,'p06-self-0001'); exception when others then insert into p06_runtime_errors values('self-approval',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select sqlstate||':'||message from p06_runtime_errors where key='self-approval'),'42501:CATALOG_SELF_APPROVAL_DENIED','requester cannot approve own release');
update public.platform_user_roles set revoked_at=now() where user_id='c2400000-0000-0000-0000-000000000001' and role_code='MATRICIA_ADMIN';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.decide_catalog_change((select id from public.catalog_change_requests where target_id=(select (value->>'release_id')::uuid from p06_observed where key='create')),true,'Validation centrale',1,'p06-central-0001'); exception when others then insert into p06_runtime_errors values('central-aal1',sqlstate,sqlerrm); end $runtime$;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_catalog_change((select id from public.catalog_change_requests where target_id=(select (value->>'release_id')::uuid from p06_observed where key='create')),false,'Correction requise',1,'p06-central-reject-0001');
reset role;
select is((select sqlstate||':'||message from p06_runtime_errors where key='central-aal1'),'42501:CENTRAL_MFA_REQUIRED','central approval requires MFA');
select pass('independent central reviewer rejects');
select is((select status from public.catalog_releases where id=(select (value->>'release_id')::uuid from p06_observed where key='create')),'DRAFT','rejection returns release to correctable draft');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.submit_catalog_release((select (value->>'release_id')::uuid from p06_observed where key='create'),8,'p06-resubmit-0001');
reset role;
select pass('corrected release is resubmitted');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_catalog_change((select id from public.catalog_change_requests where target_id=(select (value->>'release_id')::uuid from p06_observed where key='create') and status='IN_REVIEW'),true,'Validation centrale',1,'p06-central-approve-0001');
reset role;
select pass('independent central approver approves corrected release');
select is((select status from public.catalog_releases where id=(select (value->>'release_id')::uuid from p06_observed where key='create')),'APPROVED','release becomes approved');
select is((select count(*) from public.catalog_approvals a join public.catalog_change_requests c on c.id=a.change_request_id where c.target_id=(select (value->>'release_id')::uuid from p06_observed where key='create')),2::bigint,'rejection and approval evidence are immutable');
select ok((select before_hash is not null and after_hash=(select snapshot_hash from public.catalog_releases where id=target_id) from public.catalog_approvals a join public.catalog_change_requests c on c.id=a.change_request_id where c.target_id=(select (value->>'release_id')::uuid from p06_observed where key='create') and a.decision='APPROVED'),'approval seals before and after hashes');

set local role authenticated;
select public.schedule_catalog_release((select (value->>'release_id')::uuid from p06_observed where key='create'),'2020-01-01T00:00:00Z',null,'{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000002","c2410000-0000-0000-0000-000000000001","c2410000-0000-0000-0000-000000000001"]}',10,'p06-schedule-0001');
select public.schedule_catalog_release((select (value->>'release_id')::uuid from p06_observed where key='create'),'2020-01-01T00:00:00Z',null,'{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001","c2410000-0000-0000-0000-000000000002"]}',10,'p06-schedule-0001');
reset role;
select pass('approved release is scheduled with canonical organization audience and window');
select pass('semantically equivalent audience replays the same idempotent schedule command');
select is((select audience from public.catalog_releases where id=(select (value->>'release_id')::uuid from p06_observed where key='create')),'{"kind":"ORGANIZATIONS","organization_ids":["c2410000-0000-0000-0000-000000000001","c2410000-0000-0000-0000-000000000002"]}'::jsonb,'stored audience is canonical');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p06_observed values('claim-1',public.claim_catalog_release('c2400000-0000-0000-0000-000000000002',(select (value->>'release_id')::uuid from p06_observed where key='create'),300));
do $runtime$ begin perform public.complete_catalog_release_publish((select (value->>'release_id')::uuid from p06_observed where key='claim-1'),(select (value->>'lease_token')::uuid from p06_observed where key='claim-1'),(select (value->>'release_row_version')::integer-1 from p06_observed where key='claim-1')); exception when others then insert into p06_runtime_errors values('stale-completion',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin insert into p06_observed values('worker-failure',public.fail_catalog_release_publish((select (value->>'release_id')::uuid from p06_observed where key='claim-1'),(select (value->>'lease_token')::uuid from p06_observed where key='claim-1'),'WORKER_TIMEOUT',(select (value->>'release_row_version')::integer from p06_observed where key='claim-1'))); exception when others then insert into p06_runtime_errors values('worker-failure',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin insert into p06_observed values('worker-failure-retry',public.fail_catalog_release_publish((select (value->>'release_id')::uuid from p06_observed where key='claim-1'),(select (value->>'lease_token')::uuid from p06_observed where key='claim-1'),'WORKER_TIMEOUT',(select (value->>'release_row_version')::integer from p06_observed where key='claim-1'))); exception when others then insert into p06_runtime_errors values('worker-failure-retry',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select sqlstate||':'||message from p06_runtime_errors where key='stale-completion'),'PT409:STALE_CATALOG_VERSION','worker rejects stale claimed row version');
select is((select value->>'outcome' from p06_observed where key='worker-failure'),'CATALOG_RELEASE_FAILED','service worker records failure with lease');
select is((select value from p06_observed where key='worker-failure-retry'),(select value from p06_observed where key='worker-failure'),'worker failure retry is idempotent and emits no duplicate evidence');
update public.catalog_releases set next_attempt_at=statement_timestamp()-interval '1 second' where id=(select (value->>'release_id')::uuid from p06_observed where key='create') and status='FAILED';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p06_observed values('claim-2',public.claim_catalog_release('c2400000-0000-0000-0000-000000000002',(select (value->>'release_id')::uuid from p06_observed where key='create'),300));
do $runtime$ begin insert into p06_observed values('worker-completion',public.complete_catalog_release_publish((select (value->>'release_id')::uuid from p06_observed where key='claim-2'),(select (value->>'lease_token')::uuid from p06_observed where key='claim-2'),(select (value->>'release_row_version')::integer from p06_observed where key='claim-2'))); exception when others then insert into p06_runtime_errors values('worker-completion',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin insert into p06_observed values('worker-completion-retry',public.complete_catalog_release_publish((select (value->>'release_id')::uuid from p06_observed where key='claim-2'),(select (value->>'lease_token')::uuid from p06_observed where key='claim-2'),(select (value->>'release_row_version')::integer from p06_observed where key='claim-2'))); exception when others then insert into p06_runtime_errors values('worker-completion-retry',sqlstate,sqlerrm); end $runtime$;
reset role;
select is(coalesce((select value->>'outcome' from p06_observed where key='worker-completion'),(select sqlstate||':'||message from p06_runtime_errors where key='worker-completion')),'CATALOG_RELEASE_PUBLISHED','service worker publishes automatically retried release');
select is((select value from p06_observed where key='worker-completion-retry'),(select value from p06_observed where key='worker-completion'),'worker completion retry is idempotent');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.add_catalog_release_item((select (value->>'release_id')::uuid from p06_observed where key='create'),'LIBRARY','c2430000-0000-0000-0000-000000000001','c2440000-0000-0000-0000-000000000001',repeat('a',64),1,1,'p06-item-0001');
reset role;
select pass('add-item retry returns before version-state validation');
select is((select status from public.catalog_library_versions where id='c2440000-0000-0000-0000-000000000001'),'PUBLISHED','selected content version is published');
select is((select current_published_version_id from public.catalog_libraries where id='c2430000-0000-0000-0000-000000000001'),'c2440000-0000-0000-0000-000000000001'::uuid,'identity points to published version');
select is((select current_version_id from public.catalog_service_subcategory_links where id='c24b0000-0000-0000-0000-000000000001'),'c24c0000-0000-0000-0000-000000000001'::uuid,'primary link points to published version');
select is((select count(*) from public.audit_events where action='catalog.release.published' and resource_id=(select value->>'release_id' from p06_observed where key='create')),1::bigint,'publication is audited');
select is((select count(*) from public.event_outbox where event_type='CatalogReleasePublishedV1' and aggregate_id=(select value->>'release_id' from p06_observed where key='create')),1::bigint,'publication emits outbox event');
select ok((select count(*) from public.audit_events where action='catalog.release.item.added' and resource_id=(select value->>'release_id' from p06_observed where key='create'))=5 and (select count(*) from public.event_outbox where event_type='CatalogReleaseItemAddedV1' and aggregate_id=(select value->>'release_id' from p06_observed where key='create'))=5,'each add-item writes audit and Outbox once');
select ok((select count(*) from public.audit_events where action='catalog.release.submitted' and resource_id=(select value->>'release_id' from p06_observed where key='create'))=2 and (select count(*) from public.event_outbox where event_type='CatalogChangeSubmittedV1' and aggregate_id=(select value->>'release_id' from p06_observed where key='create'))=2,'submit and corrected resubmit each write audit and Outbox');
select ok((select count(*) from public.audit_events where action='catalog.change.decided')>=1 and (select count(*) from public.event_outbox where event_type='CatalogChangeApprovedV1')>=1,'approval writes audit and Outbox');
select ok((select count(*) from public.audit_events where action='catalog.release.scheduled' and resource_id=(select value->>'release_id' from p06_observed where key='create'))=1 and (select count(*) from public.event_outbox where event_type='CatalogReleaseScheduledV1' and aggregate_id=(select value->>'release_id' from p06_observed where key='create'))=1,'schedule writes audit and Outbox once');
select ok((select count(*) from public.audit_events where action in ('catalog.release.claimed','catalog.release.reclaimed'))>=4 and (select count(*) from public.event_outbox where event_type in ('CatalogReleaseClaimedV1','CatalogReleaseReclaimedV1'))>=4,'worker claims and reclaims write audit and Outbox evidence');
select ok((select count(*) from public.audit_events where action='catalog.release.cancelled' and resource_id='c24d0000-0000-0000-0000-000000000001')=1 and (select count(*) from public.event_outbox where event_type='CatalogReleaseCancelledV1' and aggregate_id='c24d0000-0000-0000-0000-000000000001')=1,'cancel writes audit and Outbox once');
select ok((select count(*) from public.audit_events where action='catalog.release.failed' and resource_id=(select value->>'release_id' from p06_observed where key='create'))=1 and (select count(*) from public.event_outbox where event_type='CatalogReleaseFailedV1' and aggregate_id=(select value->>'release_id' from p06_observed where key='create'))=1,'worker failure writes audit and Outbox once');
select ok(not exists(select 1 from public.audit_events where action like 'catalog.%' and action<>'catalog.permission_policy.revoked' and organization_id is null) and not exists(select 1 from public.event_outbox where event_type like 'Catalog%' and event_type<>'CatalogPermissionPolicyRevokedV1' and aggregate_id in ((select value->>'release_id' from p06_observed where key='create'),'c24d0000-0000-0000-0000-000000000001') and organization_id is null),'tenant catalog evidence carries its server-resolved steward organization');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
do $runtime$ begin insert into p06_observed values('rollback',public.rollback_catalog_release('c2430000-0000-0000-0000-000000000001',(select (value->>'release_id')::uuid from p06_observed where key='create'),'P06.A.ROLLBACK',4,'p06-rollback-0001')); exception when others then insert into p06_runtime_errors values('rollback',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin insert into p06_observed values('rollback-retry',public.rollback_catalog_release('c2430000-0000-0000-0000-000000000001',(select (value->>'release_id')::uuid from p06_observed where key='create'),'P06.A.ROLLBACK',4,'p06-rollback-0001')); exception when others then insert into p06_runtime_errors values('rollback-retry',sqlstate,sqlerrm); end $runtime$;
reset role;
select is((select value from p06_observed where key='rollback-retry'),(select value from p06_observed where key='rollback'),'rollback is idempotent');
update public.catalog_releases set effective_from=statement_timestamp()-interval '1 second' where id=(select (value->>'release_id')::uuid from p06_observed where key='rollback') and status='SCHEDULED';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $runtime$ begin if exists(select 1 from p06_observed where key='rollback') then insert into p06_observed values('rollback-claim',public.claim_catalog_release('c2400000-0000-0000-0000-000000000002',(select (value->>'release_id')::uuid from p06_observed where key='rollback'),300)); else raise exception 'ROLLBACK_RESULT_MISSING' using errcode='P0002'; end if; exception when others then insert into p06_runtime_errors values('rollback-claim',sqlstate,sqlerrm); end $runtime$;
do $runtime$ begin insert into p06_observed values('rollback-completion',public.complete_catalog_release_publish((select (value->>'release_id')::uuid from p06_observed where key='rollback-claim'),(select (value->>'lease_token')::uuid from p06_observed where key='rollback-claim'),(select (value->>'release_row_version')::integer from p06_observed where key='rollback-claim'))); exception when others then insert into p06_runtime_errors values('rollback-completion',sqlstate,sqlerrm); end $runtime$;
reset role;
select is(coalesce((select value->>'outcome' from p06_observed where key='rollback-completion'),(select sqlstate||':'||message from p06_runtime_errors where key='rollback-completion')),'CATALOG_RELEASE_PUBLISHED','rollback release is published only by service worker');
select is((select status from public.catalog_releases where id=(select (value->>'release_id')::uuid from p06_observed where key='create')),'RETIRED','rollback retires the superseded release');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $runtime$ begin insert into p06_observed values('retired-completion-replay',public.complete_catalog_release_publish((select (value->>'release_id')::uuid from p06_observed where key='claim-2'),(select (value->>'lease_token')::uuid from p06_observed where key='claim-2'),(select (value->>'release_row_version')::integer from p06_observed where key='claim-2'))); exception when others then insert into p06_runtime_errors values('retired-completion-replay',sqlstate,sqlerrm); end $runtime$;
reset role;
select is(coalesce((select value->>'outcome' from p06_observed where key='retired-completion-replay'),(select sqlstate||':'||message from p06_runtime_errors where key='retired-completion-replay')),'CATALOG_RELEASE_PUBLISHED','same worker completion token replays after the release is retired by rollback');
select ok((select count(*) from public.audit_events where action='catalog.release.published' and resource_id=(select value->>'release_id' from p06_observed where key='create'))=1 and (select count(*) from public.event_outbox where event_type='CatalogReleasePublishedV1' and aggregate_id=(select value->>'release_id' from p06_observed where key='create'))=1,'retired completion replay emits no duplicate audit or Outbox');
select is((select current_release_id from public.catalog_libraries where id='c2430000-0000-0000-0000-000000000001'),(select (value->>'release_id')::uuid from p06_observed where key='rollback'),'rollback installs a new current release');
select is((select rollback_target_release_id from public.catalog_releases where id=(select (value->>'release_id')::uuid from p06_observed where key='rollback')),(select (value->>'release_id')::uuid from p06_observed where key='create'),'rollback preserves target provenance');
select is((select count(*) from public.event_outbox where event_type='CatalogRollbackScheduledV1' and aggregate_id=(select value->>'release_id' from p06_observed where key='rollback')),1::bigint,'rollback scheduling emits one outbox event');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $runtime$ begin perform public.create_catalog_release('c2430000-0000-0000-0000-000000000001','P06.DENIED',repeat('3',64),false,4,'p06-denied-0001'); exception when others then insert into p06_runtime_errors values('cross-library',sqlstate,sqlerrm); end $runtime$;
insert into p06_observed values('outsider-published-count',to_jsonb((select count(*) from public.catalog_libraries where id='c2430000-0000-0000-0000-000000000001')));
insert into p06_observed values('outsider-own-draft-count',to_jsonb((select count(*) from public.catalog_libraries where id='c2430000-0000-0000-0000-000000000002')));
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into p06_observed values('franchise-other-draft-count',to_jsonb((select count(*) from public.catalog_libraries where id='c2430000-0000-0000-0000-000000000002')));
insert into p06_observed values('franchise-import-count',to_jsonb((select count(*) from public.catalog_import_batches where baseline_key like 'P06-STAGING-%')));
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p06_observed values('central-import-count',to_jsonb((select count(*) from public.catalog_import_batches where baseline_key like 'P06-STAGING-%')));
select public.revoke_catalog_library_mandate((select id from public.catalog_library_mandates where library_id='c2430000-0000-0000-0000-000000000002' and status='ACTIVE'),1,'Mandat terminé','p06-mandate-revoke-0001');
select public.revoke_catalog_permission_policy('FRANCHISE_MANAGER','CATALOG_IMPORT',1,'Politique retirée','p06-policy-revoke-0001');
select public.revoke_catalog_library_mandate((select id from public.catalog_library_mandates where library_id='c2430000-0000-0000-0000-000000000002' and status='REVOKED'),1,'Mandat terminé','p06-mandate-revoke-0001');
select public.revoke_catalog_permission_policy('FRANCHISE_MANAGER','CATALOG_IMPORT',1,'Politique retirée','p06-policy-revoke-0001');
reset role;
select is((select sqlstate||':'||message from p06_runtime_errors where key='cross-library'),'42501:CATALOG_SCOPE_DENIED','cross-library mutation is denied');
select is((select value::text::bigint from p06_observed where key='outsider-published-count'),1::bigint,'published catalog is readable across tenants');
select is((select value::text::bigint from p06_observed where key='outsider-own-draft-count'),1::bigint,'own draft library is readable');
select is((select value::text::bigint from p06_observed where key='franchise-other-draft-count'),0::bigint,'other library draft is hidden by RLS');
select is((select value::text::bigint from p06_observed where key='franchise-import-count'),1::bigint,'staging RLS exposes only mandated library');
select is((select value::text::bigint from p06_observed where key='central-import-count'),2::bigint,'central import permission sees scoped staging batches');
select pass('central MFA actor revokes a library mandate through controlled RPC');
select pass('central MFA actor revokes a global permission policy without caller-selected tenant');
select pass('mandate revocation retry is idempotent');
select pass('permission policy revocation retry is idempotent');
select ok(not private.has_library_permission('c2430000-0000-0000-0000-000000000002','CATALOG_EDIT','c2400000-0000-0000-0000-000000000003'),'revoked mandate immediately removes library permission');
select ok(not (select active from public.catalog_permission_policies where role_code='FRANCHISE_MANAGER' and permission_code='CATALOG_IMPORT' and policy_version=1),'revoked policy version is inactive');
select ok((select count(*) from public.audit_events where actor_user_id='c2400000-0000-0000-0000-000000000002' and ((action='catalog.mandate.revoked' and resource_id=(select id::text from public.catalog_library_mandates where library_id='c2430000-0000-0000-0000-000000000002')) or (action='catalog.permission_policy.revoked' and resource_id='FRANCHISE_MANAGER:CATALOG_IMPORT:1')))=2 and (select count(*) from public.event_outbox where (event_type='CatalogLibraryMandateRevokedV1' and aggregate_id=(select id::text from public.catalog_library_mandates where library_id='c2430000-0000-0000-0000-000000000002')) or (event_type='CatalogPermissionPolicyRevokedV1' and aggregate_id='FRANCHISE_MANAGER:CATALOG_IMPORT:1'))=2,'authorization revocations are audited and emitted once');
select ok((select organization_id is null and metadata->>'scope'='PLATFORM' from public.audit_events where action='catalog.permission_policy.revoked' and resource_id='FRANCHISE_MANAGER:CATALOG_IMPORT:1' and actor_user_id='c2400000-0000-0000-0000-000000000002') and (select organization_id is null and payload->>'scope'='PLATFORM' from public.event_outbox where event_type='CatalogPermissionPolicyRevokedV1' and aggregate_id='FRANCHISE_MANAGER:CATALOG_IMPORT:1'),'global policy evidence is platform-scoped and cannot be attributed to a caller-selected tenant');

select throws_ok($$delete from public.catalog_library_versions where id='c2440000-0000-0000-0000-000000000001'$$,'55000','IMMUTABLE_CATALOG_SNAPSHOT','published history cannot be deleted');
select is((select count(*) from public.catalog_command_keys where operation_scope like 'catalog.%' and response_body is null),0::bigint,'completed commands have durable responses');
select is((select snapshot_hash from public.catalog_releases where id=(select (value->>'release_id')::uuid from p06_observed where key='create')),(select encode(extensions.digest(convert_to(string_agg(object_type||':'||object_id::text||':'||version_id::text||':'||content_hash||':'||sort_order::text,',' order by sort_order,object_type,object_id),'UTF8'),'sha256'),'hex') from public.catalog_release_items where release_id=(select (value->>'release_id')::uuid from p06_observed where key='create')),'snapshot hash is canonical and reproducible');

select * from finish();
rollback;
