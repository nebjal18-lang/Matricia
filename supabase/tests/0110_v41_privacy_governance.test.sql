begin;
set local search_path=public,extensions;
select plan(31);

select ok((select count(*)=15 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname=any(array['processing_activities','processing_purposes','data_categories','data_recipients','processors','subprocessor_register','international_transfers','retention_policies','privacy_notices','consent_records','data_subject_requests','privacy_incidents','privacy_legal_holds','privacy_retention_actions','privacy_cookie_policies'])),'all V4.1 privacy governance records exist');
select ok((select count(*)=15 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['processing_activities','processing_purposes','data_categories','data_recipients','processors','subprocessor_register','international_transfers','retention_policies','privacy_notices','consent_records','data_subject_requests','privacy_incidents','privacy_legal_holds','privacy_retention_actions','privacy_cookie_policies'])),'RLS is enabled on every privacy table');
select ok((select count(*)=15 from pg_policies where schemaname='public' and tablename=any(array['processing_activities','processing_purposes','data_categories','data_recipients','processors','subprocessor_register','international_transfers','retention_policies','privacy_notices','consent_records','data_subject_requests','privacy_incidents','privacy_legal_holds','privacy_retention_actions','privacy_cookie_policies']) and qual like '%privacy_read_access%'),'every privacy table has scoped read policy');
select ok(not has_table_privilege('authenticated','public.data_subject_requests','INSERT') and not has_table_privilege('authenticated','public.consent_records','UPDATE'),'authenticated users cannot bypass privacy commands');
select ok(not has_table_privilege('service_role','public.privacy_retention_actions','INSERT') and not has_table_privilege('service_role','public.privacy_incidents','DELETE'),'service role has no broad privacy mutation rights');
select ok(not has_table_privilege('anon','public.processing_activities','SELECT'),'anonymous users cannot read the privacy register');
select ok(has_function_privilege('authenticated','private.privacy_read_access(uuid,uuid)','EXECUTE') and not has_function_privilege('anon','private.privacy_read_access(uuid,uuid)','EXECUTE'),'authenticated can evaluate the scoped RLS helper while anonymous cannot');

select ok(exists(select 1 from pg_constraint where conrelid='public.processing_activities'::regclass and contype='c' and pg_get_constraintdef(oid) like '%REQUIRED_NOT_COMPLETED%'),'processing activities carry the explicit CNDP formality blocker');
select ok(exists(select 1 from pg_constraint where conrelid='public.international_transfers'::regclass and contype='c' and pg_get_constraintdef(oid) like '%REQUIRED_NOT_COMPLETED%'),'international transfers carry the explicit compliance blocker');
select ok(exists(select 1 from pg_constraint where conrelid='public.data_subject_requests'::regclass and contype='c' and pg_get_constraintdef(oid) like '%RECTIFICATION%' and pg_get_constraintdef(oid) like '%OPPOSITION%'),'DSR supports access rectification and opposition');
select ok(exists(select 1 from pg_constraint where conrelid='public.data_subject_requests'::regclass and contype='c' and pg_get_constraintdef(oid) like '%IDENTITY_VERIFIED%' and pg_get_constraintdef(oid) like '%COMPLETED%'),'DSR lifecycle contains verification through completion');
select ok(exists(select 1 from pg_constraint where conrelid='public.retention_policies'::regclass and contype='c' and pg_get_constraintdef(oid) like '%ANONYMIZE%' and pg_get_constraintdef(oid) like '%PURGE%'),'retention policies define controlled disposition');
select ok(exists(select 1 from pg_constraint where conrelid='public.consent_records'::regclass and contype='c' and pg_get_constraintdef(oid) like '%WITHDRAWN%'),'consent records support explicit withdrawal');
select ok(exists(select 1 from pg_constraint where conrelid='public.privacy_cookie_policies'::regclass and contype='c' and pg_get_constraintdef(oid) like '%NECESSARY%' and pg_get_constraintdef(oid) like '%MARKETING%'),'cookie policies distinguish necessary and marketing trackers');
select ok((select count(*)=5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['assert_privacy_production_ready','register_data_subject_request','transition_data_subject_request','request_privacy_retention_action','record_privacy_consent'])),'privacy command and production gate functions exist');
select ok((select count(*)=5 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['assert_privacy_production_ready','register_data_subject_request','transition_data_subject_request','request_privacy_retention_action','record_privacy_consent'])),'privacy functions enforce server-side authorization');
select ok(has_function_privilege('authenticated','public.record_privacy_consent(uuid,uuid,uuid,text,text,text,text,text,timestamptz,uuid)','EXECUTE') and not has_function_privilege('anon','public.record_privacy_consent(uuid,uuid,uuid,text,text,text,text,text,timestamptz,uuid)','EXECUTE'),'consent mutation is authenticated-only');
select ok((select prosecdef and proconfig::text like '%search_path=pg_catalog%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_privacy_consent'),'consent command has fixed search path');
select ok((select count(*)>=10 from pg_indexes where schemaname='public' and indexname like 'v41_privacy_%'),'privacy operational paths are indexed');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c1100000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','privacy-a@example.invalid','',now(),'{}','{}',now(),now()),
('c1100000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','privacy-b@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('ca110000-0000-0000-0000-000000000001','Privacy A SARL','Privacy A','ACTIVE','c1100000-0000-0000-0000-000000000001'),
('cb110000-0000-0000-0000-000000000002','Privacy B SARL','Privacy B','ACTIVE','c1100000-0000-0000-0000-000000000002');
insert into public.organization_memberships(organization_id,user_id,status,activated_at) values
('ca110000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000001','ACTIVE',now()),
('cb110000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) select id,'CLIENT_OWNER' from public.organization_memberships where user_id in('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002');

insert into public.processing_activities(id,organization_id,activity_key,name_fr,name_ar,controller_role,systems,countries_regions,cnDP_formality_status,created_by) values
('c1100000-0000-0000-0000-000000000010','ca110000-0000-0000-0000-000000000001','client-onboarding','Onboarding client','تهيئة العميل','CONTROLLER',array['SUPABASE'],array['MA'],'NOT_REQUIRED','c1100000-0000-0000-0000-000000000001'),
('c1100000-0000-0000-0000-000000000011','cb110000-0000-0000-0000-000000000002','client-onboarding','Onboarding client','تهيئة العميل','CONTROLLER',array['SUPABASE'],array['MA'],'NOT_REQUIRED','c1100000-0000-0000-0000-000000000002');
insert into public.data_categories(id,organization_id,processing_activity_id,category_key,label_fr,label_ar,data_subject_types,sensitivity,created_by) values
('c1100000-0000-0000-0000-000000000012','ca110000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000010','identity','Identité','الهوية',array['CLIENT_CONTACT'],'PERSONAL','c1100000-0000-0000-0000-000000000001'),
('c1100000-0000-0000-0000-000000000013','cb110000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000011','identity','Identité','الهوية',array['CLIENT_CONTACT'],'PERSONAL','c1100000-0000-0000-0000-000000000002');
insert into public.retention_policies(id,organization_id,data_category_id,version,status,retention_days,trigger_event,disposition,legal_basis_reference,effective_from,created_by) values
('c1100000-0000-0000-0000-000000000014','ca110000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000012',1,'ACTIVE',365,'ACCOUNT_CLOSED','ANONYMIZE','policy-demo','2026-09-13','c1100000-0000-0000-0000-000000000001');

-- A compliant fixture includes the actual bilingual notices, legal purpose,
-- active effective processing activity and MFA required by the production gate.
update public.processing_activities set status='ACTIVE',effective_from=current_date-1 where organization_id='ca110000-0000-0000-0000-000000000001';
insert into public.processing_purposes(organization_id,processing_activity_id,purpose_key,label_fr,label_ar,legal_basis,legal_basis_reference,created_by)values('ca110000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000010','account-management','Gestion de compte','إدارة الحساب','CONTRACT','fixture-approved-contract-0110','c1100000-0000-0000-0000-000000000001');
insert into public.privacy_notices(organization_id,notice_key,version,locale,content_hash,storage_reference,status,published_at,effective_from,created_by)select 'ca110000-0000-0000-0000-000000000001','privacy',1,locale,repeat('b',64),'privacy/fixture-0110-'||locale||'.pdf','PUBLISHED',now(),now()-interval'1 day','c1100000-0000-0000-0000-000000000001'from unnest(array['fr-MA','ar-MA'])locale;
select set_config('request.jwt.claims','{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('request.jwt.claim.sub','c1100000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.assert_privacy_production_ready('ca110000-0000-0000-0000-000000000001')$$,'production gate passes a compliant tenant');
insert into public.international_transfers(organization_id,processing_activity_id,provider_name,destination_country,transfer_mechanism,compliance_status,created_by) values('ca110000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000010','Example provider','US','CONTRACTUAL_SAFEGUARDS','REQUIRED_NOT_COMPLETED','c1100000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','c1100000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.assert_privacy_production_ready('ca110000-0000-0000-0000-000000000001')$$,'55000','PRIVACY_PRODUCTION_GATE_BLOCKED','noncompliant international transfer blocks production');
update public.international_transfers set compliance_status='APPROVED',assessment_reference='ASSESSMENT-0110' where organization_id='ca110000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub','c1100000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.register_data_subject_request('ca110000-0000-0000-0000-000000000001','ACCESS',repeat('a',64),'STANDARD','fr-MA',30,'11111111-1111-4111-8111-111111111110')$$,'tenant owner registers a scoped DSR');
select is((select count(*) from public.data_subject_requests where organization_id='ca110000-0000-0000-0000-000000000001'),1::bigint,'DSR command persists one request');
select is((select count(*) from public.audit_events where organization_id='ca110000-0000-0000-0000-000000000001' and action='privacy.dsr.registered'),1::bigint,'DSR command emits redacted audit evidence');
select is((select count(*) from public.event_outbox where organization_id='ca110000-0000-0000-0000-000000000001' and event_type='PrivacyDataSubjectRequestRegisteredV1'),1::bigint,'DSR command emits one outbox event');

insert into public.privacy_legal_holds(organization_id,subject_reference_hash,reason_code,status,starts_at,created_by) values('ca110000-0000-0000-0000-000000000001',repeat('a',64),'DISPUTE','ACTIVE',now(),'c1100000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','c1100000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.request_privacy_retention_action('c1100000-0000-0000-0000-000000000014',repeat('a',64),'ANONYMIZE','22222222-2222-4222-8222-222222222220','22222222-2222-4222-8222-222222222221')$$,'55000','PRIVACY_LEGAL_HOLD_ACTIVE','legal hold blocks anonymization');
select throws_ok($$insert into public.data_categories(organization_id,processing_activity_id,category_key,label_fr,label_ar,data_subject_types,sensitivity,created_by) values('ca110000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000011','cross','Cross','عبر',array['CLIENT_CONTACT'],'PERSONAL','c1100000-0000-0000-0000-000000000001')$$,'42501','PRIVACY_CROSS_TENANT_REFERENCE','cross-tenant privacy parent is rejected');

create temporary table privacy_rls_observed(key text primary key,value bigint);
grant insert,select on table privacy_rls_observed to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','c1100000-0000-0000-0000-000000000001',true);
insert into privacy_rls_observed values
('own',(select count(*) from public.processing_activities where organization_id='ca110000-0000-0000-0000-000000000001')),
('foreign',(select count(*) from public.processing_activities where organization_id='cb110000-0000-0000-0000-000000000002'));
reset role;
select is((select value from privacy_rls_observed where key='own'),1::bigint,'tenant owner reads its own processing register');
select is((select value from privacy_rls_observed where key='foreign'),0::bigint,'tenant owner cannot read another tenant privacy register');
select ok((select metadata ? 'subject_reference_hash'=false from public.audit_events where action='privacy.dsr.registered'),'audit metadata never stores the data-subject hash');
select ok((select payload ? 'subject_reference_hash'=false from public.event_outbox where event_type='PrivacyDataSubjectRequestRegisteredV1'),'outbox payload never stores the data-subject hash');

select * from finish();
rollback;
