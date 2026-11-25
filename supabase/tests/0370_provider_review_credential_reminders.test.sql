begin;
select plan(15);
select has_function('public','enqueue_provider_review_notifications_v1',array['integer'],'provider review decisions are delivered by the worker');
select has_function('public','enqueue_provider_credential_expiry_reminders_v1',array['date','integer'],'certification reminders exist at the scheduler boundary');
select ok(pg_get_functiondef('public.enqueue_provider_credential_expiry_reminders_v1(date,integer)'::regprocedure) like '%CERTIFICATION%' and pg_get_functiondef('public.enqueue_provider_credential_expiry_reminders_v1(date,integer)'::regprocedure) like '%60, 30, 7%','credentials are reminded sixty, thirty and seven days before expiry');
select ok(pg_get_functiondef('public.run_domain_automation_schedulers_v1(date,integer)'::regprocedure) like '%enqueue_provider_review_notifications_v1%' and pg_get_functiondef('public.run_domain_automation_schedulers_v1(date,integer)'::regprocedure) like '%enqueue_provider_credential_expiry_reminders_v1%' and pg_get_functiondef('public.run_domain_automation_schedulers_v1(date,integer)'::regprocedure) like '%pg_try_advisory_xact_lock%','the existing scheduler now sends both provider messages');
-- Behavioral fixture: native upload/review commands; synthetic Storage metadata
-- and scanner result. No external email, binary antivirus or browser proof.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('f3700000-0000-4000-8000-00000000000'||n)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','expiry370-'||n||'@example.invalid','',now(),'{}',jsonb_build_object('locale',case when n=2 then 'ar' else 'fr' end),now(),now() from generate_series(1,4)n;
insert into public.organizations(id,legal_name,display_name,status,created_by) values('f3701000-0000-4000-8000-000000000001','Expiry fixture','Expiry fixture','ACTIVE','f3700000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)
select ('f3702000-0000-4000-8000-00000000000'||n)::uuid,'f3701000-0000-4000-8000-000000000001',('f3700000-0000-4000-8000-00000000000'||n)::uuid,'ACTIVE',now() from generate_series(1,2)n;
insert into public.organization_member_roles(membership_id,role_code) values('f3702000-0000-4000-8000-000000000001','PROVIDER_OWNER'),('f3702000-0000-4000-8000-000000000002','PROVIDER_MANAGER');
insert into public.platform_user_roles(user_id,role_code) values('f3700000-0000-4000-8000-000000000003','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,activity_summary,team_size,years_experience,created_by) values('f3701000-0000-4000-8000-000000000001','Credential expiry fixture',1,1,'f3700000-0000-4000-8000-000000000001');
do $$declare days integer;u jsonb;d jsonb;job uuid;org uuid:='f3701000-0000-4000-8000-000000000001';actor uuid:='f3700000-0000-4000-8000-000000000001';begin
 foreach days in array array[60,30,7,8] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  u:=public.begin_provider_document_upload(org,'application/pdf',20);
  insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',u->>'storage_object_path',actor::text,'{"mimetype":"application/pdf","size":20}');
  d:=public.record_provider_document_version(org,'CERTIFICATION','EXPIRY_'||days,jsonb_build_object('issued_on',current_date::text,'expires_on',(current_date+days)::text,'storage_object_path',u->>'storage_object_path','content_hash',repeat('d',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Credential reminder fixture','expiry370-doc-'||days);
  select id into job from public.provider_document_scan_jobs where document_version_id=(d->>'document_version_id')::uuid;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.record_provider_document_scan_result(job,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('d',64),'expiry370-scan-'||days);
  perform set_config('request.jwt.claims','{"sub":"f3700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
  perform public.review_provider_document((d->>'document_version_id')::uuid,'VERIFIED','Independent fixture review','TEST-EXPIRY','expiry370-review-'||days);
 end loop;
end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f3700000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select public.enqueue_provider_credential_expiry_reminders_v1(current_date,10)$$,'42501','PROVIDER_CREDENTIAL_REMINDER_DENIED','ordinary user cannot invoke worker');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.enqueue_provider_credential_expiry_reminders_v1(current_date,0)$$,'22023','INVALID_PROVIDER_CREDENTIAL_REMINDER_PAGE','invalid page rejected');
select is((public.enqueue_provider_credential_expiry_reminders_v1(current_date,1)->>'has_more')::boolean,true,'bounded first page leaves pending reminders');
do $$begin perform public.enqueue_provider_credential_expiry_reminders_v1(current_date,100);end$$;
select is((select count(*) from public.notification_instances where organization_id='f3701000-0000-4000-8000-000000000001' and deduplication_key like 'credential-expiry:%'),6::bigint,'three milestones notify both responsible members');
select is((select count(*) from public.notification_instances where organization_id='f3701000-0000-4000-8000-000000000001' and deduplication_key like 'credential-expiry:%' and locale='ar-MA'),3::bigint,'Arabic manager receives localized reminders');
select is((select count(*) from public.notification_instances where organization_id='f3701000-0000-4000-8000-000000000001' and deduplication_key like 'credential-expiry:%' and locale='fr-MA'),3::bigint,'French owner receives localized reminders');
select is((select count(*) from public.notification_instances where organization_id='f3701000-0000-4000-8000-000000000001' and variables_snapshot->>'milestone'='J-8'),0::bigint,'no reminder outside configured milestones');
select is((public.enqueue_provider_credential_expiry_reminders_v1(current_date,100)->>'processed')::integer,0,'replay enqueues no duplicate');
select is((select count(*) from public.notification_instances where organization_id='f3701000-0000-4000-8000-000000000001' and deduplication_key like 'credential-expiry:%'),6::bigint,'replay retains exactly six reminders');
create temporary table expiry_visibility(actor text, visible bigint);
grant insert on expiry_visibility to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f3700000-0000-4000-8000-000000000001"}',true);
insert into expiry_visibility select 'owner',count(*) from public.notification_instances where organization_id='f3701000-0000-4000-8000-000000000001' and deduplication_key like 'credential-expiry:%';
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f3700000-0000-4000-8000-000000000004"}',true);
insert into expiry_visibility select 'outsider',count(*) from public.notification_instances where organization_id='f3701000-0000-4000-8000-000000000001' and deduplication_key like 'credential-expiry:%';
reset role;
select is((select visible from expiry_visibility where actor='owner'),3::bigint,'owner reads only their three reminders');
select is((select visible from expiry_visibility where actor='outsider'),0::bigint,'unrelated user cannot read reminders');
select * from finish();
rollback;
