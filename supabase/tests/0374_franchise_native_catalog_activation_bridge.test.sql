-- Rollback-only native proposal, independent approval and explicit development
-- activation. No catalogue mandate, approval receipt or activation proof is seeded.
begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated,service_role;
-- Introspection-only assertions below call existing private permission helpers.
-- The application behaviour is exercised through public.franchise_catalog_page.
-- This rollback-only schema usage grant does not grant any table or new RPC.
grant usage on schema private to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3740000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','catalog374-'||n||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,5)n;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b3740000-0000-4000-8000-000000000001','TEST374 operator','TEST374 operator','ACTIVE','a3740000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values('c3740000-0000-4000-8000-000000000001','TEST374','test374','b3740000-0000-4000-8000-000000000001','a3740000-0000-4000-8000-000000000001');
insert into public.platform_user_roles(user_id,role_code)values('a3740000-0000-4000-8000-000000000001','MATRICIA_ADMIN'),('a3740000-0000-4000-8000-000000000002','MATRICIA_ADMIN');
insert into public.organization_memberships(id,organization_id,user_id,status)
select ('d3740000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b3740000-0000-4000-8000-000000000001',('a3740000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'from generate_series(3,5)n;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST0374_ROLLBACK_ONLY'where singleton;
create temporary table catalog374(k text primary key,v jsonb);
grant select,insert on catalog374 to authenticated,service_role;
select is((select count(*)from public.catalog_library_mandates where library_id='c3740000-0000-4000-8000-000000000001'),0::bigint,'no catalogue mandate is seeded for the native onboarding');
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into catalog374 values('proposal1',public.propose_franchise_governance('c3740000-0000-4000-8000-000000000001','b3740000-0000-4000-8000-000000000001','FRANCHISEE','TEST374_A','Territoire TEST A','النطاق أ','{}',now()-interval'1 day',now()+interval'1 year',100000,'UPFRONT',0,'{}','{}','{"TEST_ONLY":true}','catalog374-3@example.invalid',repeat('a',64),'fr-MA','{}','TEST374 native catalogue mandate A','TEST374-propose-A'));
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from catalog374 where k='proposal1'),'APPROVE','TEST374 independent approval A',1,'TEST374-approve-A');
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
insert into catalog374 values('activation1',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from catalog374 where k='proposal1'),repeat('a',64),1,(select(v->>'mandate_version_id')::uuid from catalog374 where k='proposal1'),(public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from catalog374 where k='proposal1'))->>'mandateHash'),true,'TEST374-activate-A'));
select is((select v->>'activationMode'from catalog374 where k='activation1'),'NON_CONTRACTUAL_DEMO','native activation remains explicitly noncontractual');
select lives_ok($$select public.franchise_catalog_page((select(v->>'franchise_id')::uuid from catalog374 where k='proposal1'))$$,'the native owner can load the catalogue without an injected mandate');
select ok(private.has_library_permission('c3740000-0000-4000-8000-000000000001','CATALOG_VIEW_DRAFT'),'role and existing catalogue policy both remain required and now agree');
select ok(not private.has_library_permission('c3740000-0000-4000-8000-000000000001','CATALOG_APPROVE'),'the bridge does not grant central independent approval');
reset role;
select is((select count(*)from public.catalog_library_mandates where library_id='c3740000-0000-4000-8000-000000000001'),1::bigint,'one catalogue ACL mandate was created by native activation');
select ok((select x.valid_from=m.effective_from and x.valid_until=m.effective_until from public.catalog_library_mandates x join private.franchise_catalog_acl_sources_v1 s on s.catalog_mandate_id=x.id join public.franchise_mandate_versions m on m.id=s.active_mandate_version_id where s.franchise_id=(select(v->>'franchise_id')::uuid from catalog374 where k='proposal1')),'catalogue window comes from the exact approved activated mandate, never a new TTL');
-- A distinct service HTTP request resets scalar compatibility claims as well
-- as the JSON JWT. The native revoke wrapper deliberately sets scalar role
-- authenticated in 20260911004600; sharing its GUC would model one mixed request.
select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
insert into catalog374 values('catchup',public.reconcile_franchise_catalog_mandate_v1((select(v->>'franchise_id')::uuid from catalog374 where k='proposal1')));
select is((select v->>'outcome'from catalog374 where k='catchup'),'FRANCHISE_CATALOG_MANDATE_PRESENT','scoped catchup is idempotent for an existing native grant');
reset role;
select is((select count(*)from public.audit_events where action='franchise.catalog_mandate.granted'and organization_id='b3740000-0000-4000-8000-000000000001'),1::bigint,'catchup does not duplicate the grant audit');
select is((select count(*)from public.event_outbox where event_type='FranchiseCatalogMandateGrantedV1'and organization_id='b3740000-0000-4000-8000-000000000001'),1::bigint,'catchup does not duplicate the grant outbox');
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000005',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select ok(not private.has_library_permission('c3740000-0000-4000-8000-000000000001','CATALOG_VIEW_DRAFT'),'a sibling member without a role cannot inherit catalogue access');
select throws_ok($$select public.franchise_catalog_page((select(v->>'franchise_id')::uuid from catalog374 where k='proposal1'))$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','member cannot select an unauthorized franchise UUID');
reset role;
-- A second native territory shares the existing pair-wide ACL row, but its role
-- and immutable source remain separate. Its longer window is approved explicitly.
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into catalog374 values('proposal2',public.propose_franchise_governance('c3740000-0000-4000-8000-000000000001','b3740000-0000-4000-8000-000000000001','FRANCHISEE','TEST374_B','Territoire TEST B','النطاق ب','{}',now()-interval'1 day',now()+interval'2 years',100000,'UPFRONT',0,'{}','{}','{"TEST_ONLY":true}','catalog374-4@example.invalid',repeat('b',64),'ar-MA','{}','TEST374 native catalogue mandate B','TEST374-propose-B'));
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from catalog374 where k='proposal2'),'APPROVE','TEST374 independent approval B',1,'TEST374-approve-B');
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
insert into catalog374 values('activation2',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from catalog374 where k='proposal2'),repeat('b',64),1,(select(v->>'mandate_version_id')::uuid from catalog374 where k='proposal2'),(public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from catalog374 where k='proposal2'))->>'mandateHash'),true,'TEST374-activate-B'));
select lives_ok($$select public.franchise_catalog_page((select(v->>'franchise_id')::uuid from catalog374 where k='proposal2'))$$,'second owner loads the catalogue under their own exact assignment');
select throws_ok($$select public.franchise_catalog_page((select(v->>'franchise_id')::uuid from catalog374 where k='proposal1'))$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','the second owner cannot select the first territory');
reset role;
select is((select count(*)from public.catalog_library_mandates where library_id='c3740000-0000-4000-8000-000000000001'and status='ACTIVE'),1::bigint,'existing pair uniqueness is preserved across two territories');
select is((select count(*)from private.franchise_catalog_acl_sources_v1 where catalog_mandate_id=(select id from public.catalog_library_mandates where library_id='c3740000-0000-4000-8000-000000000001'and status='ACTIVE')),2::bigint,'both native source identities are preserved');
select ok((select x.valid_until=max(s.valid_until)from public.catalog_library_mandates x join private.franchise_catalog_acl_sources_v1 s on s.catalog_mandate_id=x.id where x.library_id='c3740000-0000-4000-8000-000000000001'group by x.id),'multi-territory bound equals an approved source date');
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
select lives_ok($$select public.franchise_catalog_page((select(v->>'franchise_id')::uuid from catalog374 where k='proposal1'))$$,'first owner retains their own authorized catalogue after second activation');
reset role;
select private.revoke_franchise_role_assignment_v1('d3740000-0000-4000-8000-000000000003','FRANCHISE_OWNER',(select(v->>'franchise_id')::uuid from catalog374 where k='proposal1'),'a3740000-0000-4000-8000-000000000001');
select ok(not private.has_library_permission('c3740000-0000-4000-8000-000000000001','CATALOG_VIEW_DRAFT','a3740000-0000-4000-8000-000000000003'),'revoked role cannot use a still-active sibling catalogue ACL');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select ok(not private.has_library_permission('c3740000-0000-4000-8000-000000000001','CATALOG_VIEW_DRAFT','a3740000-0000-4000-8000-000000000004'),'development evidence never becomes production catalogue authorization');
-- A distinct service HTTP request resets scalar compatibility claims as well
-- as the JSON JWT. The native revoke wrapper deliberately sets scalar role
-- authenticated in 20260911004600; sharing its GUC would model one mixed request.
select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select throws_ok($$select public.reconcile_franchise_catalog_mandate_v1((select(v->>'franchise_id')::uuid from catalog374 where k='proposal2'))$$,'55000','FRANCHISE_NATIVE_CATALOG_ACTIVATION_REQUIRED','catchup cannot bless a development activation in production');
reset role;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3740000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"a3740000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.revoke_catalog_library_mandate((select id from public.catalog_library_mandates where library_id='c3740000-0000-4000-8000-000000000001'and status='ACTIVE'),(select row_version from public.catalog_library_mandates where library_id='c3740000-0000-4000-8000-000000000001'and status='ACTIVE'),'TEST374 explicit central revocation','TEST374-revoke-catalog');
reset role;
-- A distinct service HTTP request resets scalar compatibility claims as well
-- as the JSON JWT. The native revoke wrapper deliberately sets scalar role
-- authenticated in 20260911004600; sharing its GUC would model one mixed request.
select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select ok(auth.role()='service_role'and auth.uid()is null,'the revocation catchup starts a separate service request without a user claim');
select throws_ok($$select public.reconcile_franchise_catalog_mandate_v1((select(v->>'franchise_id')::uuid from catalog374 where k='proposal2'))$$,'55000','FRANCHISE_CATALOG_GRANT_REVOKED_REVIEW_REQUIRED','catchup never resurrects an explicitly revoked catalogue mandate');
reset role;
select is((select count(*)from public.catalog_library_mandates where library_id='c3740000-0000-4000-8000-000000000001'),1::bigint,'revocation did not produce a replacement ACL row');
select ok(not has_function_privilege('authenticated','public.reconcile_franchise_catalog_mandate_v1(uuid,uuid)','EXECUTE')and not has_function_privilege('anon','public.reconcile_franchise_catalog_mandate_v1(uuid,uuid)','EXECUTE'),'only the service can invoke scoped catchup');
select ok(not has_table_privilege('service_role','private.franchise_catalog_acl_sources_v1','INSERT')and not has_table_privilege('authenticated','public.catalog_library_mandates','INSERT'),'applications cannot fabricate catalogue provenance');
select *from finish();
rollback;
