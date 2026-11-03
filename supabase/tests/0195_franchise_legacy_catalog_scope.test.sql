begin;set local search_path=public,extensions;select plan(7);
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

select ok(private.has_library_permission('c2430000-0000-0000-0000-000000000001','CATALOG_EDIT','c2400000-0000-0000-0000-000000000001'),'existing explicit library A mandate retains allowed catalogue editing');
select ok(not private.has_library_permission('c2430000-0000-0000-0000-000000000002','CATALOG_EDIT','c2400000-0000-0000-0000-000000000001'),'library A role does not grant library B access');
select ok(not private.has_library_permission('c2430000-0000-0000-0000-000000000003','CATALOG_EDIT','c2400000-0000-0000-0000-000000000004'),'archived organization cannot use a legacy catalogue grant');
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values('c2490000-0000-0000-0000-000000000001','c2430000-0000-0000-0000-000000000001','c2410000-0000-0000-0000-000000000001','STANDARD','FRANCHISEE','LEGACY_TEST','ACTIVE','c2400000-0000-0000-0000-000000000001');
insert into public.organization_member_franchise_assignments(membership_id,role_code,franchise_id,revoked_at)values('c2420000-0000-0000-0000-000000000001','FRANCHISE_OWNER','c2490000-0000-0000-0000-000000000001',now());
select ok(not private.has_library_permission('c2430000-0000-0000-0000-000000000001','CATALOG_EDIT','c2400000-0000-0000-0000-000000000001'),'a revoked explicit assignment tombstone disables the legacy library fallback');
select ok(not private.has_library_permission('c2430000-0000-0000-0000-000000000002','CATALOG_EDIT','c2400000-0000-0000-0000-000000000001'),'revoking a mandate never exposes another library');
grant usage on schema extensions to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.create_catalog_category('c2430000-0000-0000-0000-000000000001','MFA_CATEGORY','mfa-category','Catégorie MFA','فئة التحقق','Description catégorie','وصف الفئة','mfa',1,'{}',false,'Création de recette MFA','mfa-category-denied')$$,'42501','CATALOG_SCOPE_DENIED','platform administrator cannot bypass its active MFA policy at AAL1');
select set_config('request.jwt.claims','{"sub":"c2400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.create_catalog_category('c2430000-0000-0000-0000-000000000001','MFA_CATEGORY','mfa-category','Catégorie MFA','فئة التحقق','Description catégorie','وصف الفئة','mfa',1,'{}',false,'Création de recette MFA','mfa-category-allowed')$$,'the same platform administrator can execute the real category command at AAL2');
reset role;
select *from finish();rollback;
