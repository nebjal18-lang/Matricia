begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select plan(8);
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','delivery-admin-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=4 then'SUPPORT_AGENT'else'MATRICIA_ADMIN'end from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b1810000-0000-4000-8000-000000000001','Delivery Test','Delivery Test','ACTIVE','a1810000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c1810000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c1810000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1810000-0000-4000-8000-000000000001','PROVIDER_OWNER');

update public.platform_user_roles set revoked_at=clock_timestamp()where user_id='a1810000-0000-4000-8000-000000000004';
update public.organization_memberships set status='REVOKED'where user_id='a1810000-0000-4000-8000-000000000004';
insert into public.user_profiles(id,display_name,updated_at)values('a1810000-0000-4000-8000-000000000004','Nom Personnel',now()-interval'40 days')on conflict(id)do update set display_name='Nom Personnel',updated_at=now()-interval'40 days';


insert into public.client_assistance_requests(id,organization_id,created_by,subject,body,status,consented_at,idempotency_key,request_hash,created_at,updated_at)values('f1850000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','Assistance privée','Texte personnel à effacer dans la fixture','CLOSED',now()-interval'60 days','fixture-assistance-185',repeat('a',64),now()-interval'60 days',now()-interval'60 days');
insert into public.client_assistance_messages(id,request_id,actor_user_id,body,idempotency_key,created_at)values('f1850000-0000-4000-8000-000000000002','f1850000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000001','Réponse personnelle de fixture','fixture-assistance-message185',now()-interval'50 days');
insert into public.processing_activities(id,organization_id,activity_key,name_fr,name_ar,controller_role,systems,countries_regions,cndp_formality_status,created_by)values('f1830000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','profile-retention','Rétention profils','الاحتفاظ بالملفات','CONTROLLER',array['SUPABASE'],array['MA'],'NOT_REQUIRED','a1810000-0000-4000-8000-000000000001');
insert into public.data_categories(id,organization_id,processing_activity_id,category_key,label_fr,label_ar,data_subject_types,sensitivity,created_by)values('f1830000-0000-4000-8000-000000000002','b1810000-0000-4000-8000-000000000001','f1830000-0000-4000-8000-000000000001','user-profile','Profil utilisateur','ملف المستخدم',array['USER'],'PERSONAL','a1810000-0000-4000-8000-000000000001');
insert into public.retention_policies(id,organization_id,data_category_id,version,status,retention_days,trigger_event,disposition,legal_basis_reference,effective_from,created_by)values('f1830000-0000-4000-8000-000000000003','b1810000-0000-4000-8000-000000000001','f1830000-0000-4000-8000-000000000002',1,'ACTIVE',0,'ACCOUNT_REVOKED','ANONYMIZE','fixture-legal-policy-183',current_date-60,'a1810000-0000-4000-8000-000000000001');
insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)values('f1830000-0000-4000-8000-000000000004','b1810000-0000-4000-8000-000000000001','ERASURE',encode(extensions.digest(convert_to('b1810000-0000-4000-8000-000000000001:a1810000-0000-4000-8000-000000000004','UTF8'),'sha256'),'hex'),'ENHANCED','fr-MA','IN_REVIEW',now()+interval'1 day',now()-interval'1 day',extensions.gen_random_uuid(),'a1810000-0000-4000-8000-000000000001');

create temporary table tracked_request(id uuid);grant all on tracked_request to authenticated,service_role;
set local role authenticated;select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into tracked_request select public.request_privacy_retention_action('f1830000-0000-4000-8000-000000000003',repeat('c',64),'ANONYMIZE','fixture187-request','f1870000-0000-4000-8000-000000000001');
select throws_ok($$select public.attest_privacy_retention_work_item_v1((select id from tracked_request),'f1870000-0000-4000-8000-000000000001')$$,'42501',null,'a human caller cannot forge an outbox receipt');
reset role;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.sub','',true);
select lives_ok($$select public.attest_privacy_retention_work_item_v1((select id from tracked_request),'f1870000-0000-4000-8000-000000000001')$$,'durable scoped work item and original audit authorize a tracking receipt');
select lives_ok($$select public.attest_privacy_retention_work_item_v1((select id from tracked_request),'f1870000-0000-4000-8000-000000000001')$$,'tracking receipt is idempotent on retry');
reset role;
select is((select count(*)from public.audit_events where action='privacy.retention.work_item_tracked'and resource_id=(select id::text from tracked_request)),1::bigint,'one receipt audit exists');
select is((select status from public.privacy_retention_actions where id=(select id from tracked_request)),'PENDING','work tracking never marks the disposition complete');
select ok(not exists(select 1 from public.privacy_retention_execution_jobs_v1 where retention_action_id=(select id from tracked_request)),'work tracking creates no fabricated execution proof');
update public.admin_work_items set redacted_context=redacted_context||jsonb_build_object('request_hash',repeat('d',64))where resource_type='privacy_retention_action'and resource_id=(select id::text from tracked_request);
set local role service_role;
select throws_ok($$select public.attest_privacy_retention_work_item_v1((select id from tracked_request),'f1870000-0000-4000-8000-000000000001')$$,'22000','PRIVACY_RETENTION_WORK_HASH_MISMATCH','receipt refuses a mismatched request hash');
reset role;
select ok(exists(select 1 from public.admin_work_items where resource_type='privacy_retention_action'and resource_id=(select id::text from tracked_request)and organization_id='b1810000-0000-4000-8000-000000000001'and source_kind='MANUAL_REVIEW'),'tracking remains attached to the exact tenant request');
select*from finish();rollback;
