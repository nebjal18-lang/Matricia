begin;
set local search_path=public,extensions;
select no_plan();
select has_function('public','complete_published_client_diagnostic_v1',array['uuid','uuid','text','uuid'],'published diagnostic endpoint exists');
select ok(not has_function_privilege('authenticated','private.published_client_diagnostic_policy(uuid,uuid)','EXECUTE'),'scope trigger has no direct caller grant');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a2080000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','scope208@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2080000-0000-4000-8000-000000000001','Scope208','Scope208','ACTIVE','a2080000-0000-4000-8000-000000000001');
-- Publication fixtures isolate this one guard; catalogue publication itself has its own recipes.
set local session_replication_role=replica;
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)select format('c2080000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'SCOPE208_'||i,'scope208-'||i,'b2080000-0000-4000-8000-000000000001','a2080000-0000-4000-8000-000000000001'from generate_series(1,2)i;
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,current_published_version_id,created_by)select format('d2080000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,case when i=3 then'c2080000-0000-4000-8000-000000000002'::uuid else'c2080000-0000-4000-8000-000000000001'::uuid end,'c2080000-0000-4000-9000-000000000001','SCOPE208_SERVICE_'||i,'scope208-service-'||i,case when i=2 then'DRAFT'else'PUBLISHED'end,format('e2080000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'a2080000-0000-4000-8000-000000000001'from generate_series(1,3)i;
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)
select current_published_version_id,id,library_id,1,case when status='DRAFT'then'DRAFT'else'PUBLISHED'end,'Service de recette208','خدمة الاختبار208','Description de recette','وصف الاختبار','Description complète de recette','وصف كامل للاختبار','CONSULTING','mission','مهمة',1,'Publication de recette',repeat('a',64),'a2080000-0000-4000-8000-000000000001',case when status='PUBLISHED'then now()else null end,primary_subcategory_id,code,slug from public.catalog_services where code like'SCOPE208_SERVICE_%';
set local session_replication_role=origin;
select is(private.published_diagnostic_service('d2080000-0000-4000-8000-000000000001','c2080000-0000-4000-8000-000000000001'),'d2080000-0000-4000-8000-000000000001'::uuid,'same-library real published service is accepted');
select throws_ok($$select private.published_diagnostic_service('d2080000-0000-4000-8000-000000000003','c2080000-0000-4000-8000-000000000001')$$,'55000','PUBLISHED_DIAGNOSTIC_SERVICE_REQUIRED','another library service is refused');
select throws_ok($$select private.published_diagnostic_service('d2080000-0000-4000-8000-000000000002','c2080000-0000-4000-8000-000000000001')$$,'55000','PUBLISHED_DIAGNOSTIC_SERVICE_REQUIRED','draft service is refused');
select is(private.published_diagnostic_priority('{"priority_basis_points":5555}'),55.55::numeric,'published basis-point priority keeps its exact scale');
select is(private.published_diagnostic_priority('{}'),null::numeric,'missing priority is unknown rather than an invented high value');
select*from finish();
rollback;
