-- Synthetic SQL authorization/transaction tests only; no real credentials or
-- provider availability, legal readiness or production delivery is attested.
begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated,service_role;

select ok(not has_table_privilege('authenticated','private.admin_configuration_revisions_v1','SELECT'),'browser role cannot read encrypted configuration rows');
select ok(not has_table_privilege('service_role','private.admin_configuration_revisions_v1','SELECT'),'worker has no direct table credential access');
select ok(not has_table_privilege('anon','private.admin_configuration_revisions_v1','SELECT'),'anonymous role has no configuration table access');
select ok(not has_function_privilege('authenticated','public.get_active_platform_configuration_v1()','EXECUTE'),'browser cannot call the runtime credential projection');
select ok(not has_function_privilege('authenticated','public.load_admin_configuration_probe_v1(uuid)','EXECUTE'),'browser cannot read encrypted probe credentials');
select ok(not has_function_privilege('authenticated','public.record_admin_configuration_probe_v1(uuid,text,text)','EXECUTE'),'browser cannot invent a connectivity receipt');
select ok(not has_function_privilege('service_role','public.save_admin_configuration_v1(uuid,text,jsonb,text,text[],uuid,text)','EXECUTE'),'service runtime cannot impersonate a human configuration author');
select ok(not has_function_privilege('anon','public.get_admin_configuration_v1()','EXECUTE'),'anonymous cannot read the administrator dashboard');
select ok((select bool_and(relrowsecurity)from pg_class where oid=any(array['private.admin_configuration_revisions_v1'::regclass,'private.admin_configuration_probe_leases_v1'::regclass,'private.admin_configuration_probe_results_v1'::regclass])),'private configuration tables use default-deny RLS');
select is((select count(*)::integer from information_schema.columns where table_schema='private'and table_name like 'admin_configuration_%'and column_name in('storage_path','storage_object_id','storage_reference','evidence_storage_path')),0,'configuration introduces no uncollected physical-file family');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a3910000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','configuration-author@example.invalid','',now(),'{}','{}',now(),now()),
('a3910000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','configuration-reviewer@example.invalid','',now(),'{}','{}',now(),now()),
('a3910000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','configuration-support@example.invalid','',now(),'{}','{}',now(),now()),
('a3910000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','configuration-outsider@example.invalid','',now(),'{}','{}',now(),now());
insert into auth.sessions(id,user_id,aal,not_after)values
('a3911000-0000-4000-8000-000000000001','a3910000-0000-4000-8000-000000000001','aal2',now()+interval '1 hour'),
('a3911000-0000-4000-8000-000000000002','a3910000-0000-4000-8000-000000000002','aal2',now()+interval '1 hour');
insert into public.platform_user_roles(user_id,role_code)values
('a3910000-0000-4000-8000-000000000001','SUPER_ADMIN'),
('a3910000-0000-4000-8000-000000000002','MATRICIA_ADMIN'),
('a3910000-0000-4000-8000-000000000003','SUPPORT_AGENT');
update private.admin_execution_environment_v1 set environment='STAGING'where singleton;
create temporary table configuration391(k text primary key,v jsonb);
grant select,insert,update on configuration391 to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_admin_configuration_v1()$$,'42501','CONFIGURATION_ADMIN_AAL2_REQUIRED','ordinary user cannot open global settings');
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_admin_configuration_v1()$$,'42501','CONFIGURATION_ADMIN_AAL2_REQUIRED','support role cannot configure provider credentials');
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"a3911000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select public.get_admin_configuration_v1()$$,'42501','CONFIGURATION_ADMIN_AAL2_REQUIRED','administrative role never bypasses AAL2');
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000001"}',true);
select is(public.get_admin_configuration_v1()->>'environment','STAGING','dashboard uses the trusted database environment');
select is(jsonb_array_length(public.get_admin_configuration_v1()->'sections'),5,'all five configurable sections are represented');
select throws_ok($$select public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000001','COMPANY','{"legalName":"TEST Company","displayName":"TEST","currency":"MAD","supportEmail":"support@example.invalid","password":"forbidden"}','','{}',null,'test-configuration-company-unknown')$$,'22023','CONFIGURATION_SETTINGS_INVALID','secret-shaped unknown settings cannot enter public company data');
select throws_ok($$select public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000001','COMPANY','{}','','{}',null,'test-configuration-company-incomplete')$$,'22023','CONFIGURATION_COMPANY_INCOMPLETE','an empty company profile is not saved as complete');
insert into configuration391 values('company',public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000001','COMPANY','{"legalName":"TEST Company","displayName":"TEST","currency":"MAD","supportEmail":"support@example.invalid","defaultLocale":"fr","timezone":"Africa/Casablanca"}','','{}',null,'test-configuration-company-first'));
select is((select v->>'outcome'from configuration391 where k='company'),'CONFIGURATION_SAVED','company data is genuinely persisted as a revision');
select is(public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000001','COMPANY','{"legalName":"TEST Company","displayName":"TEST","currency":"MAD","supportEmail":"support@example.invalid","defaultLocale":"fr","timezone":"Africa/Casablanca"}','','{}',null,'test-configuration-company-first'),(select v from configuration391 where k='company'),'exact save retry returns the original receipt');
select throws_ok($$select public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000002','COMPANY','{"legalName":"Changed TEST","displayName":"TEST","currency":"MAD","supportEmail":"support@example.invalid"}','','{}',null,'test-configuration-company-first')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','an idempotency key cannot hide a changed profile');
select throws_ok($$select public.approve_admin_configuration_v1('a3912000-0000-4000-8000-000000000001',(select v->>'content_hash'from configuration391 where k='company'),true,'Reviewed company profile','test-company-self-review')$$,'42501','CONFIGURATION_INDEPENDENT_REVIEW_REQUIRED','author cannot activate their own company profile');
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000002"}',true);
select is(public.approve_admin_configuration_v1('a3912000-0000-4000-8000-000000000001',(select v->>'content_hash'from configuration391 where k='company'),true,'Reviewed company profile','test-company-other-review')->>'outcome','CONFIGURATION_ACTIVATED','independent approval applies the exact company profile');
select is(public.approve_admin_configuration_v1('a3912000-0000-4000-8000-000000000001',(select v->>'content_hash'from configuration391 where k='company'),true,'Reviewed company profile','test-company-other-review')->>'outcome','CONFIGURATION_ACTIVATED','activation retry is idempotent');
select throws_ok($$select public.approve_admin_configuration_v1('a3912000-0000-4000-8000-000000000001',repeat('f',64),true,'Reviewed company profile','test-company-wrong-hash')$$,'40001','CONFIGURATION_REVISION_STALE','approval is bound to the reviewed content hash');
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000003','PAYPAL','{"PAYPAL_ENV":"live"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64'],null,'test-paypal-live-mismatch')$$,'42501','CONFIGURATION_PROVIDER_ENVIRONMENT_MISMATCH','staging cannot save live payment credentials');
select throws_ok($$select public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000003','YOUSIGN','{"YOUSIGN_ENVIRONMENT":"live"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'],null,'test-yousign-live-mismatch')$$,'42501','CONFIGURATION_PROVIDER_ENVIRONMENT_MISMATCH','staging cannot save live signature credentials');
select throws_ok($$select public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000003','RESEND','{"RESEND_FROM_EMAIL":"sender@example.invalid"}','plaintext-would-be-invalid',array['RESEND_API_KEY','RESEND_WEBHOOK_SECRET'],null,'test-resend-plaintext')$$,'23514',null,'credentials must use the bounded sealed envelope format');
select throws_ok($$select public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000003','RESEND','{"RESEND_FROM_EMAIL":"sender@example.invalid"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['RESEND_API_KEY','RESEND_API_KEY'],null,'test-resend-duplicate-keys')$$,'22023','CONFIGURATION_PAYLOAD_INVALID','secret key duplicates cannot replace the required webhook secret');
insert into configuration391 values('resend',public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000003','RESEND','{"RESEND_FROM_EMAIL":"sender@example.invalid","RESEND_FROM_NAME":"TEST Sender","EMAIL_RECIPIENT_ALLOWLIST":"recipient@example.invalid"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['RESEND_API_KEY','RESEND_WEBHOOK_SECRET'],null,'test-resend-first-revision'));
select ok(position('encrypted_secrets'in public.get_admin_configuration_v1()::text)=0,'dashboard never returns the sealed credential envelope');
select ok(position('Q0lQSEVSVEVYVA'in public.get_admin_configuration_v1()::text)=0,'dashboard cannot disclose credential ciphertext');
select ok(position('RESEND_API_KEY'in public.get_admin_configuration_v1()::text)>0,'dashboard reports only which secret fields are configured');
select throws_ok($$select public.record_admin_configuration_probe_v1('a3913000-0000-4000-8000-000000000001','PASS','RESEND_DOMAIN_VERIFIED')$$,'42501',null,'human administrator cannot forge a server connectivity receipt');
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.approve_admin_configuration_v1('a3912000-0000-4000-8000-000000000003',(select v->>'content_hash'from configuration391 where k='resend'),true,'Reviewed provider configuration','test-resend-without-probe')$$,'55000','CONFIGURATION_FRESH_PROBE_REQUIRED','approval cannot declare an untested provider active');
insert into configuration391 values('lease',public.start_admin_configuration_probe_v1('a3912000-0000-4000-8000-000000000003',(select v->>'content_hash'from configuration391 where k='resend')));
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.load_admin_configuration_probe_v1('a3913000-0000-4000-8000-000000000001')$$,'42501','CONFIGURATION_PROBE_LEASE_INVALID','forged probe token cannot read draft credentials');
select is(public.load_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'))->>'id','a3912000-0000-4000-8000-000000000003','service resolves only the authenticated lease revision');
select is(public.load_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'))->>'environment','STAGING','service probe retains the trusted environment binding');
select ok(not(public.get_active_platform_configuration_v1()->'managed_sections'?'RESEND'),'an initial unapproved draft preserves previously deployed infrastructure settings');
select is(jsonb_array_length(public.get_active_platform_configuration_v1()->'sections'),1,'runtime projection excludes unapproved provider drafts');
select throws_ok($$select public.record_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'),'PASS','PAYPAL_CREDENTIALS_VALID')$$,'22023','CONFIGURATION_PROBE_RESULT_INVALID','a different provider success code cannot satisfy this revision');
select is(public.record_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'),'FAIL','RESEND_DOMAIN_UNVERIFIED')->>'status','FAIL','a native probe failure remains a failure');
select throws_ok($$select public.record_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'),'PASS','RESEND_DOMAIN_VERIFIED')$$,'42501','CONFIGURATION_PROBE_LEASE_INVALID','a consumed lease cannot be upgraded to success');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.approve_admin_configuration_v1('a3912000-0000-4000-8000-000000000003',(select v->>'content_hash'from configuration391 where k='resend'),true,'Reviewed provider configuration','test-resend-failed-probe')$$,'55000','CONFIGURATION_FRESH_PROBE_REQUIRED','a failed probe cannot activate the provider');
update configuration391 set v=public.start_admin_configuration_probe_v1('a3912000-0000-4000-8000-000000000003',(select v->>'content_hash'from configuration391 where k='resend'))where k='lease';
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.record_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'),'PASS','RESEND_DOMAIN_VERIFIED')->>'status','PASS','server-owned successful probe records its bounded result');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000002"}',true);
update configuration391 set v=public.start_admin_configuration_probe_v1('a3912000-0000-4000-8000-000000000003',(select v->>'content_hash'from configuration391 where k='resend'))where k='lease';
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.record_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'),'FAIL','PROVIDER_RESPONSE_INVALID')->>'status','FAIL','a later malformed provider response is recorded rather than preserving an earlier PASS');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.approve_admin_configuration_v1('a3912000-0000-4000-8000-000000000003',(select v->>'content_hash'from configuration391 where k='resend'),true,'Reviewed provider configuration','test-resend-later-failure')$$,'55000','CONFIGURATION_FRESH_PROBE_REQUIRED','a FAIL after PASS blocks activation of the same exact revision');
update configuration391 set v=public.start_admin_configuration_probe_v1('a3912000-0000-4000-8000-000000000003',(select v->>'content_hash'from configuration391 where k='resend'))where k='lease';
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.record_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'),'PASS','RESEND_DOMAIN_VERIFIED')->>'status','PASS','a fresh successful retry can recover the same unchanged provider revision');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000002"}',true);
select is(public.approve_admin_configuration_v1('a3912000-0000-4000-8000-000000000003',(select v->>'content_hash'from configuration391 where k='resend'),true,'Reviewed provider configuration','test-resend-valid-probe')->>'outcome','CONFIGURATION_ACTIVATED','independent approval activates a tested revision');
reset role;
select is((select status from private.admin_configuration_revisions_v1 where id='a3912000-0000-4000-8000-000000000003'),'ACTIVE','activation changes the real runtime source, not just a tracked request');
select throws_ok($$update private.admin_configuration_revisions_v1 set encrypted_secrets='v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.CHANGED'where id='a3912000-0000-4000-8000-000000000003'$$,'55000','IMMUTABLE_CONFIGURATION_REVISION','even privileged maintenance cannot rewrite reviewed credential content');
select throws_ok($$delete from private.admin_configuration_revisions_v1 where id='a3912000-0000-4000-8000-000000000003'$$,'55000','IMMUTABLE_CONFIGURATION_REVISION','reviewed configuration history cannot be deleted');
select ok(not exists(select 1 from public.audit_events where resource_type='platform_configuration'and(metadata::text like '%Q0lQSEVSVEVYVA%'or metadata::text like '%probe_token%'or metadata::text like '%encrypted_secrets%')),'audit contains no cipher or probe token');
select ok(not exists(select 1 from public.event_outbox where aggregate_type='platform_configuration'and(payload::text like '%Q0lQSEVSVEVYVA%'or payload::text like '%probe_token%'or payload::text like '%encrypted_secrets%')),'outbox contains no cipher or probe token');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select public.save_admin_configuration_v1('a3912000-0000-4000-8000-000000000004','RESEND','{"RESEND_FROM_EMAIL":"sender@example.invalid"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['RESEND_API_KEY','RESEND_WEBHOOK_SECRET'],null,'test-resend-old-base')$$,'40001','CONFIGURATION_ACTIVE_CHANGED','a stale edit cannot replace a newly activated revision');
select is(public.deactivate_admin_configuration_v1('RESEND','a3912000-0000-4000-8000-000000000003','Emergency retirement for test','test-resend-retire')->>'outcome','CONFIGURATION_DEACTIVATED','authorized emergency retirement applies to the current exact provider');
select is(public.deactivate_admin_configuration_v1('RESEND','a3912000-0000-4000-8000-000000000003','Emergency retirement for test','test-resend-retire')->>'outcome','CONFIGURATION_DEACTIVATED','retirement retry does not cause another effect');
select throws_ok($$select public.deactivate_admin_configuration_v1('RESEND','a3912000-0000-4000-8000-000000000003','Emergency retirement for test','test-resend-retire-stale')$$,'40001','CONFIGURATION_ACTIVE_CHANGED','a new stale retirement request is rejected');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(jsonb_array_length(public.get_active_platform_configuration_v1()->'sections'),1,'retired provider credentials disappear from runtime projection');
select ok(public.get_active_platform_configuration_v1()->'managed_sections'?'RESEND','retirement never reactivates old infrastructure credentials');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000001"}',true);
insert into configuration391 select 'company-draft-'||n,public.save_admin_configuration_v1(('a3914000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'COMPANY',jsonb_build_object('legalName','TEST Company '||n,'displayName','TEST','currency','MAD','supportEmail','support@example.invalid'),'','{}','a3912000-0000-4000-8000-000000000001','test-company-draft-'||n)from generate_series(1,11)n;
select ok(exists(select 1 from jsonb_array_elements(public.get_admin_configuration_v1()->'sections')section cross join lateral jsonb_array_elements(section->'revisions')revision where section->>'section'='COMPANY'and revision->>'id'='a3912000-0000-4000-8000-000000000001'and revision->>'status'='ACTIVE'),'an active revision remains visible after more than ten drafts');
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.approve_admin_configuration_v1('a3914000-0000-4000-8000-000000000001',(select v->>'content_hash'from configuration391 where k='company-draft-1'),true,'Reviewed older company draft','test-company-stale-draft')$$,'40001','CONFIGURATION_ACTIVE_CHANGED','an older superseded draft cannot overwrite the latest configuration proposal');
select is(public.approve_admin_configuration_v1('a3914000-0000-4000-8000-000000000001',(select v->>'content_hash'from configuration391 where k='company-draft-1'),false,'Reject outdated company draft','test-company-reject-old-draft')->>'outcome','CONFIGURATION_REJECTED','an obsolete draft can still be independently rejected without changing the active version');
reset role;

-- Native session and role are rechecked when a server consumes a lease.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000002"}',true);
update configuration391 set v=public.start_admin_configuration_probe_v1('a3912000-0000-4000-8000-000000000001',(select v->>'content_hash'from configuration391 where k='company'))where k='lease';
reset role;
update auth.sessions set aal='aal1'where id='a3911000-0000-4000-8000-000000000002';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.load_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'))$$,'42501','CONFIGURATION_PROBE_LEASE_INVALID','AAL downgrade after lease issuance invalidates credential access');
reset role;
update auth.sessions set aal='aal2'where id='a3911000-0000-4000-8000-000000000002';
update public.platform_user_roles set revoked_at=now()where user_id='a3910000-0000-4000-8000-000000000002'and role_code='MATRICIA_ADMIN';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.load_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from configuration391 where k='lease'))$$,'42501','CONFIGURATION_PROBE_LEASE_INVALID','revoked administrator cannot retain a previously minted credential lease');
reset role;
delete from auth.sessions where id='a3911000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3910000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"a3911000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select public.get_admin_configuration_v1()$$,'42501','CONFIGURATION_ADMIN_AAL2_REQUIRED','revoked native session cannot use configuration RPCs');
reset role;
select *from finish();
rollback;
