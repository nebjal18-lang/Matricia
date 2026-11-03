-- Delivery preparation drafts stay unpublished and credentials stay unreadable.
begin;
set local search_path = public, extensions;
select plan(16);
grant usage on schema extensions to authenticated;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('a3810000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','prep381-admin@example.invalid','',now(),'{}','{}',now(),now()),
 ('a3810000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','prep381-member@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id, role_code) values ('a3810000-0000-4000-8000-000000000001','MATRICIA_ADMIN');
insert into public.organizations(id,legal_name,display_name,status,created_by)
values ('b3810000-0000-4000-8000-000000000001','PREP381 steward','PREP381 steward','ACTIVE','a3810000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)
values ('c3810000-0000-4000-8000-000000000001','PREP381','prep381','b3810000-0000-4000-8000-000000000001','DRAFT','a3810000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)
values ('c3810000-0000-4000-8000-000000000002','c3810000-0000-4000-8000-000000000001','PREP381_CAT','prep381-cat','DRAFT','a3810000-0000-4000-8000-000000000001');
insert into public.catalog_category_versions(id,category_id,library_id,version,status,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,created_by,code,slug)
values ('c3810000-0000-4000-8000-000000000003','c3810000-0000-4000-8000-000000000002','c3810000-0000-4000-8000-000000000001',1,'DRAFT','Catégorie copie PREP381','Catégorie copie PREP381','Description de catégorie test.','Description de catégorie test.',1,'Préparation de traduction',repeat('3',64),'a3810000-0000-4000-8000-000000000001','PREP381_CAT','prep381-cat');
update public.catalog_categories set current_draft_version_id = 'c3810000-0000-4000-8000-000000000003' where id = 'c3810000-0000-4000-8000-000000000002';
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)
values ('c3810000-0000-4000-8000-000000000004','c3810000-0000-4000-8000-000000000001','c3810000-0000-4000-8000-000000000002','PREP381_SUB','prep381-sub','DRAFT','a3810000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)
values ('c3810000-0000-4000-8000-000000000005','c3810000-0000-4000-8000-000000000001','c3810000-0000-4000-8000-000000000004','PREP381_SERVICE','prep381-service','DRAFT','a3810000-0000-4000-8000-000000000001');
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,primary_subcategory_id,code,slug)
values ('c3810000-0000-4000-8000-000000000006','c3810000-0000-4000-8000-000000000005','c3810000-0000-4000-8000-000000000001',1,'DRAFT','Service copie PREP381','Service copie PREP381','Description courte de test.','Description courte de test.','Description longue de test pour le service.','Description longue de test pour le service.','CONSULTING','mission','مهمة',1,'Préparation de traduction',repeat('6',64),'a3810000-0000-4000-8000-000000000001','c3810000-0000-4000-8000-000000000004','PREP381_SERVICE','prep381-service');
update public.catalog_services set current_draft_version_id = 'c3810000-0000-4000-8000-000000000006' where id = 'c3810000-0000-4000-8000-000000000005';

select ok(not has_function_privilege('anon','public.save_delivery_preparation(text,text,text,text,integer,text)','EXECUTE')
  and not has_table_privilege('authenticated','public.delivery_preparation_entries','SELECT')
  and not has_table_privilege('authenticated','private.delivery_preparation_secrets','SELECT'),
  'anonymous callers and signed-in users cannot read drafts or credentials directly');

select set_config('request.jwt.claims','{"sub":"a3810000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.delivery_preparation_overview()$$,'42501','DELIVERY_PREPARATION_DENIED','a member without a platform role cannot open the preparation');
reset role;

select set_config('request.jwt.claims','{"sub":"a3810000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select throws_ok($$select public.save_delivery_preparation('LEGAL','LEGAL_ENTITY_NAME','Matricia Test SARL',null,0,'PREP381-no-mfa')$$,'42501','DELIVERY_PREPARATION_DENIED','the second factor is required before a draft is stored');
reset role;

select set_config('request.jwt.claims','{"sub":"a3810000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is(public.save_delivery_preparation('LEGAL','LEGAL_ENTITY_NAME','Matricia Test SARL',null,0,'PREP381-legal')->>'replayed','false','an administrator stores a legal draft');
select is(public.save_delivery_preparation('LEGAL','LEGAL_ENTITY_NAME','Autre nom',null,1,'PREP381-legal')->>'replayed','true','the same request does not overwrite the draft');
select throws_ok($$select public.save_delivery_preparation('LEGAL','LEGAL_ENTITY_NAME','Autre nom',null,0,'PREP381-stale')$$,'40001','STALE_DELIVERY_PREPARATION','a stale draft version is refused');
select throws_ok($$select public.save_delivery_preparation('LEGAL','LEGAL_PRIVACY_EMAIL','pas-un-email',null,0,'PREP381-email')$$,'22023','INVALID_DELIVERY_PREPARATION','the privacy contact must be an e-mail address');
select throws_ok($$select public.save_delivery_preparation('CATALOG_SERVICE_AR','PREP381_SERVICE','Service copie PREP381',null,0,'PREP381-copy')$$,'22023','INVALID_DELIVERY_PREPARATION','a French copy is not accepted as an Arabic service name');
select is(public.save_delivery_preparation('CATALOG_SERVICE_AR','PREP381_SERVICE','خدمة اختبار التحضير',null,0,'PREP381-service')->>'outcome','DELIVERY_PREPARATION_SAVED','an Arabic service name is stored as a draft');
select is(public.save_delivery_preparation('CATALOG_CATEGORY_AR','PREP381:PREP381_CAT','فئة اختبار التحضير',null,0,'PREP381-category')->>'outcome','DELIVERY_PREPARATION_SAVED','an Arabic category name is stored as a draft');
select throws_ok($$select public.save_delivery_preparation('BOX','GOLD:QUOTA','Quota à confirmer',null,0,'PREP381-box')$$,'22023','INVALID_DELIVERY_PREPARATION','a formula needs an explicit plan code and field');
select is(public.save_delivery_preparation('INTEGRATION','EMAIL','SMTP de préproduction', 'credential-381-secret',0,'PREP381-mail')->>'secret_present','true','an integration can record that a credential exists');
select ok((public.list_delivery_preparation('INTEGRATION'))::text not like '%credential-381-secret%','the preparation list never returns a credential');
reset role;

select is((select name_ar from public.catalog_service_versions where id = 'c3810000-0000-4000-8000-000000000006'),'Service copie PREP381','the published catalogue version is not changed by the draft');
select is((select secret_text from private.delivery_preparation_secrets secret join public.delivery_preparation_entries entry on entry.id = secret.entry_id where entry.item_key = 'EMAIL'),'credential-381-secret','the credential is kept outside the readable draft');
select ok((select value_text from public.delivery_preparation_entries where section = 'INTEGRATION' and item_key = 'EMAIL') = 'SMTP de préproduction','the readable integration draft contains only the non-secret description');

select * from finish();
rollback;
