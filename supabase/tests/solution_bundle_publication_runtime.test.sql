begin;
set local search_path=public,extensions;
select plan(12);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a1900000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bundle-runtime@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)
values('b1900000-0000-4000-8000-000000000001','Bundle runtime','Bundle runtime','ACTIVE','a1900000-0000-4000-8000-000000000001'),
('b1900000-0000-4000-8000-000000000002','Foreign bundle','Foreign bundle','ACTIVE','a1900000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c1900000-0000-4000-8000-000000000001','b1900000-0000-4000-8000-000000000001','a1900000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c1900000-0000-4000-8000-000000000001','CLIENT_OWNER');
create temporary table bundle_runtime_reference(service_id uuid,version_id uuid,ordinal integer);
-- Historical published catalogue reference only; publication commands below run with normal triggers and permissions.
do $$declare n integer;l uuid;c uuid;s uuid;service uuid;v uuid;a uuid:='a1900000-0000-4000-8000-000000000001';begin
for n in 1..2 loop
l:=extensions.gen_random_uuid();c:=extensions.gen_random_uuid();s:=extensions.gen_random_uuid();service:=extensions.gen_random_uuid();v:=extensions.gen_random_uuid();
insert into public.catalog_libraries(id,code,slug,status,steward_organization_id,created_by)values(l,'BUNDLE_RUNTIME_'||n,'bundle-runtime-'||n,'PUBLISHED','b1900000-0000-4000-8000-000000000001',a);
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values(c,l,'CATEGORY','category','PUBLISHED',a);
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values(s,l,c,'SUBCATEGORY','subcategory','PUBLISHED',a);
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values(service,l,s,'BUNDLE_RUNTIME_SERVICE_'||n,'service','PUBLISHED',a);
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,recurring_eligible,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)
values(v,service,l,1,'PUBLISHED','Runtime service','Runtime service','Runtime reference','Runtime reference','Historical runtime reference','Historical runtime reference','CONSULTING','mission','mission',false,1,'Runtime reference',repeat('a',64),a,clock_timestamp(),s,'BUNDLE_RUNTIME_SERVICE_'||n,'service');
update public.catalog_services set current_published_version_id=v where id=service;
insert into bundle_runtime_reference values(service,v,n);
end loop;end$$;
create temporary table bundle_runtime_input(items jsonb,policy jsonb);
insert into bundle_runtime_input select jsonb_agg(jsonb_build_object('dedupe_key',case when ordinal=1 then 'FIRST' else 'SECOND' end,'service_id',service_id,'service_version_id',version_id,'fusion_strategy','KEEP_PRIMARY','amount_minor',case when ordinal=1 then '125050' else '24999' end,'provenance',jsonb_build_object('reference','RUNTIME'))),jsonb_build_object('version','V1','content_hash',repeat('b',64),'default_strategy','KEEP_PRIMARY')from(select * from bundle_runtime_reference union all select * from bundle_runtime_reference where ordinal=1)items;
create temporary table bundle_runtime_results(kind text primary key,value jsonb);
grant select on bundle_runtime_input to authenticated;
grant select,insert on bundle_runtime_results to authenticated;
select set_config('request.jwt.claim.sub','a1900000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($sql$set local role authenticated;insert into bundle_runtime_results select 'first',public.publish_solution_bundle('b1900000-0000-4000-8000-000000000001','BUNDLE_RUNTIME',1,'Runtime bundle','Runtime bundle','Two domain proposal','Two domain proposal','MAD',policy,items,'bundle-runtime-first')from bundle_runtime_input;reset role$sql$,'uppercase bundle code publishes through the real command');
select is((select value->>'outcome' from bundle_runtime_results where kind='first'),'SOLUTION_BUNDLE_PUBLISHED','publication returns its durable result');
select is((select value->>'total_amount_minor' from bundle_runtime_results where kind='first'),'150049','duplicate scope is charged only once');
select is((select value->>'deduplicated_count' from bundle_runtime_results where kind='first'),'2','three sources become two services');
select lives_ok($sql$set local role authenticated;insert into bundle_runtime_results select 'replay',public.publish_solution_bundle('b1900000-0000-4000-8000-000000000001','BUNDLE_RUNTIME',1,'Runtime bundle','Runtime bundle','Two domain proposal','Two domain proposal','MAD',policy,items,'bundle-runtime-first')from bundle_runtime_input;reset role$sql$,'identical publication replays');
select is((select value from bundle_runtime_results where kind='replay'),(select value from bundle_runtime_results where kind='first'),'replay preserves original response');
select throws_ok($sql$set local role authenticated;select public.publish_solution_bundle('b1900000-0000-4000-8000-000000000001','BUNDLE_RUNTIME',1,'Changed bundle','Runtime bundle','Two domain proposal','Two domain proposal','MAD',policy,items,'bundle-runtime-first')from bundle_runtime_input$sql$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed payload cannot reuse the key');
reset role;
select lives_ok($sql$set local role authenticated;insert into bundle_runtime_results select 'long',public.publish_solution_bundle('b1900000-0000-4000-8000-000000000001',repeat('B',120),1,'Long bundle','Long bundle','Two domain proposal','Two domain proposal','MAD',policy,items,'bundle-runtime-long')from bundle_runtime_input;reset role$sql$,'maximum length bundle code remains supported');
select throws_ok($sql$set local role authenticated;select public.publish_solution_bundle('b1900000-0000-4000-8000-000000000002','BUNDLE_FOREIGN',1,'Foreign bundle','Foreign bundle','Two domain proposal','Two domain proposal','MAD',policy,items,'bundle-runtime-foreign')from bundle_runtime_input$sql$,'42501','BUNDLE_PUBLISH_DENIED','foreign organization publication is denied');
reset role;
select is((select count(*)from public.solution_bundle_versions where organization_id='b1900000-0000-4000-8000-000000000001'),2::bigint,'replays and denied commands add no version');
select is((select count(*)from public.idempotency_keys where organization_id='b1900000-0000-4000-8000-000000000001'and operation_scope like 'solution.bundle.publish.%'and length(operation_scope)<=100 and operation_scope~'^[a-z][a-z0-9_.-]{2,99}$'),2::bigint,'per-bundle command scopes remain bounded and valid');
select is((select count(*)from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.organization_id='b1900000-0000-4000-8000-000000000001'and a.action='solution.bundle.published'and e.event_type='SolutionBundlePublishedV1'),2::bigint,'each publication has one correlated audit and Outbox event');
select * from finish();
rollback;
