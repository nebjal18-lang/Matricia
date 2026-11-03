begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select plan(7);
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','delivery-admin-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=4 then'SUPPORT_AGENT'else'MATRICIA_ADMIN'end from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b1810000-0000-4000-8000-000000000001','Delivery Test','Delivery Test','ACTIVE','a1810000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c1810000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c1810000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1810000-0000-4000-8000-000000000001','PROVIDER_OWNER');


insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values('f1840000-0000-4000-8000-000000000001','ADMIN_MULTI_MANDATE','admin-multi-mandate','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000001');
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)select ('d1840000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f1840000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','ADMIN_SCOPE_'||i,'ACTIVE','a1810000-0000-4000-8000-000000000001'from generate_series(1,2)i;
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)select ('c1840000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('d1840000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,'ADMIN_SCOPE_'||i,'Territoire '||i,'الإقليم '||i,'{}',now()-interval'1 day',repeat('a',64),'a1810000-0000-4000-8000-000000000001'from generate_series(1,2)i;
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)select ('b1840000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('d1840000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('c1840000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,(select id from public.franchise_economic_rule_versions where franchise_type='STANDARD'order by version desc limit 1),1,'ACTIVE','{}','{}','{}',0,'UPFRONT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('b',64),'a1810000-0000-4000-8000-000000000001'from generate_series(1,2)i;
update public.franchises f set current_mandate_version_id=m.id from public.franchise_mandate_versions m where m.franchise_id=f.id and f.id in('d1840000-0000-4000-8000-000000000001','d1840000-0000-4000-8000-000000000002');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values('c1810000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','d1840000-0000-4000-8000-000000000001');

insert into public.organization_invitations(id,organization_id,invited_user_id,invited_email,invited_by,expires_at)values
('e1860000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','delivery-admin-4@example.invalid','a1810000-0000-4000-8000-000000000001',now()+interval'1 day'),
('e1860000-0000-4000-8000-000000000002','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000003','delivery-admin-3@example.invalid','a1810000-0000-4000-8000-000000000001',now()+interval'1 day');
insert into public.organization_invitation_roles(invitation_id,role_code,franchise_id)values('e1860000-0000-4000-8000-000000000001','FRANCHISE_VIEWER','d1840000-0000-4000-8000-000000000002'),('e1860000-0000-4000-8000-000000000002','FRANCHISE_OWNER',null);
set local role authenticated;
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000004","role":"authenticated","email":"delivery-admin-4@example.invalid","aal":"aal1"}',true);
select throws_ok($$select public.accept_organization_invitation('e1860000-0000-4000-8000-000000000001')$$,'42501','FRANCHISE_INVITATION_MFA_REQUIRED','franchise invitation acceptance requires MFA');
select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000004","role":"authenticated","email":"delivery-admin-4@example.invalid","aal":"aal2"}',true);
select lives_ok($$select public.accept_organization_invitation('e1860000-0000-4000-8000-000000000001')$$,'verified invitee can accept an exact scoped mandate');
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000003","role":"authenticated","email":"delivery-admin-3@example.invalid","aal":"aal2"}',true);
select throws_ok($$select public.accept_organization_invitation('e1860000-0000-4000-8000-000000000002')$$,'42501','INVITATION_FRANCHISE_SCOPE_REQUIRED','ambiguous legacy invitation cannot grant two mandates');
reset role;
select ok(private.has_franchise_role('d1840000-0000-4000-8000-000000000002',array['FRANCHISE_VIEWER'],'a1810000-0000-4000-8000-000000000004'),'invitation grants the exact second franchise');
select ok(not private.has_franchise_role('d1840000-0000-4000-8000-000000000001',array['FRANCHISE_VIEWER'],'a1810000-0000-4000-8000-000000000004'),'invitation grants no viewer access to the first franchise');
select ok(private.has_franchise_role('d1840000-0000-4000-8000-000000000001',array['FRANCHISE_MANAGER'],'a1810000-0000-4000-8000-000000000004'),'acceptance preserves the prior exact manager mandate');
select ok(not exists(select 1 from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.organization_id='b1810000-0000-4000-8000-000000000001'and m.user_id='a1810000-0000-4000-8000-000000000003'and r.role_code='FRANCHISE_OWNER'and r.revoked_at is null),'failed ambiguous acceptance rolls back the tentative role grant');
select*from finish();rollback;
