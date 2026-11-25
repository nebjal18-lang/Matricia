begin;
set local search_path=public,private,extensions;
select no_plan();
-- Synthetic local transaction only: no provider registration, credential,
-- policy attestation or production binding is installed by the migration.
select ok(not has_function_privilege('anon','public.get_yousign_runtime_environment_v1()','EXECUTE'),'anonymous role cannot inspect privileged execution environment');
select ok(not has_function_privilege('authenticated','public.get_yousign_runtime_environment_v1()','EXECUTE'),'tenant role cannot impersonate a service environment check');
select ok(has_function_privilege('service_role','public.get_yousign_runtime_environment_v1()','EXECUTE'),'runtime can resolve the database owner deployment tag');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.get_yousign_runtime_environment_v1()$$,'42501','YOUSIGN_SERVICE_REQUIRED','environment lookup independently checks the JWT role');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update private.admin_execution_environment_v1 set environment=null where singleton;
select throws_ok($$select public.get_yousign_runtime_environment_v1()$$,'55000','YOUSIGN_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED','absence of owner deployment tag stays blocked');
update private.admin_execution_environment_v1 set environment='STAGING' where singleton;
select is(public.get_yousign_runtime_environment_v1(),'STAGING','staging cannot be promoted by an application hint');
select throws_ok($$select private.require_yousign_envelope_v1('ab920000-0000-4000-8000-000000000001')$$,'55000','YOUSIGN_GOVERNED_PROVIDER_POLICY_REQUIRED','staging missing governed policy remains blocked');
update private.admin_execution_environment_v1 set environment='PRODUCTION' where singleton;
select is(public.get_yousign_runtime_environment_v1(),'PRODUCTION','an explicit synthetic owner tag can be read by the runtime');
select throws_ok($$select private.require_yousign_envelope_v1('ab920000-0000-4000-8000-000000000001')$$,'55000','YOUSIGN_GOVERNED_PROVIDER_POLICY_REQUIRED','production tag alone cannot authorize a provider operation');
select throws_ok($$select public.begin_yousign_dispatch_v1('ab920000-0000-4000-8000-000000000001','SEND','synthetic-live-operation')$$,'55000','YOUSIGN_GOVERNED_PROVIDER_POLICY_REQUIRED','production worker cannot bypass source/provider/legal binding');
select is((select count(*)::integer from private.yousign_dispatch_operations_v1),0,'denied live request creates no operation claim');
select is((select count(*)::integer from public.signature_provider_configs where provider_code='YOUSIGN'),0,'installing capability does not activate a provider or issue a legal approval');
select ok(not has_function_privilege('service_role','private.require_yousign_envelope_v1(uuid)','EXECUTE'),'private policy assertion cannot be bypassed through a direct service RPC');

-- Native activation lifecycle with synthetic sealed bytes/probe receipt. No
-- provider connection or legal attestation is asserted by this SQL fixture.
grant usage on schema extensions to authenticated,service_role;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a3920000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','live-config-author@example.invalid','',now(),'{}','{}',now(),now()),
('a3920000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','live-config-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into auth.sessions(id,user_id,aal,not_after) values
('a3921000-0000-4000-8000-000000000001','a3920000-0000-4000-8000-000000000001','aal2',now()+interval '1 hour'),
('a3921000-0000-4000-8000-000000000002','a3920000-0000-4000-8000-000000000002','aal2',now()+interval '1 hour');
insert into public.platform_user_roles(user_id,role_code) values('a3920000-0000-4000-8000-000000000001','SUPER_ADMIN'),('a3920000-0000-4000-8000-000000000002','MATRICIA_ADMIN');
create temporary table live392(k text primary key,v jsonb);
grant all on live392 to authenticated,service_role;
select ok(not has_function_privilege('authenticated','private.activate_configured_yousign_provider_v1(uuid)','EXECUTE') and not has_function_privilege('service_role','private.activate_configured_yousign_provider_v1(uuid)','EXECUTE'),'private technical registration has no direct tenant or worker grant');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3920000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"a3921000-0000-4000-8000-000000000001"}',true);
insert into live392 values('draft',public.save_admin_configuration_v1('a3922000-0000-4000-8000-000000000001','YOUSIGN','{"YOUSIGN_ENVIRONMENT":"live"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'],null,'live392-synthetic-configuration'));
select throws_ok($$select public.approve_admin_configuration_v1('a3922000-0000-4000-8000-000000000001',(select v->>'content_hash' from live392 where k='draft'),true,'Synthetic live configuration review','live392-self-review')$$,'42501','CONFIGURATION_INDEPENDENT_REVIEW_REQUIRED','provider registration cannot bypass independent configuration approval');
select set_config('request.jwt.claims','{"sub":"a3920000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3921000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.approve_admin_configuration_v1('a3922000-0000-4000-8000-000000000001',(select v->>'content_hash' from live392 where k='draft'),true,'Synthetic live configuration review','live392-unprobed-review')$$,'55000','CONFIGURATION_FRESH_PROBE_REQUIRED','technical provider is not registered from untested keys');
insert into live392 values('lease',public.start_admin_configuration_probe_v1('a3922000-0000-4000-8000-000000000001',(select v->>'content_hash' from live392 where k='draft')));
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.record_admin_configuration_probe_v1((select(v->>'probe_token')::uuid from live392 where k='lease'),'PASS','YOUSIGN_CREDENTIALS_VALID');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3920000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"a3921000-0000-4000-8000-000000000002"}',true);
select is(public.approve_admin_configuration_v1('a3922000-0000-4000-8000-000000000001',(select v->>'content_hash' from live392 where k='draft'),true,'Synthetic live configuration review','live392-approve-provider')->>'outcome','CONFIGURATION_ACTIVATED','independent successful review activates actual credentials source');
select is(public.approve_admin_configuration_v1('a3922000-0000-4000-8000-000000000001',(select v->>'content_hash' from live392 where k='draft'),true,'Synthetic live configuration review','live392-approve-provider')->>'outcome','CONFIGURATION_ACTIVATED','review replay retains its original activation receipt');
reset role;
select is((select count(*)::integer from public.signature_provider_configs where provider_code='YOUSIGN'),1,'approved credentials expose one selectable immutable technical provider');
select is((select endpoint_base_url from public.signature_provider_configs where provider_code='YOUSIGN'),'https://api.yousign.app/v3','production technical registration has the fixed live endpoint');
select ok((select supported_levels=array['SIMPLE'] and secret_reference_names=array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'] from public.signature_provider_configs where provider_code='YOUSIGN'),'technical registration promises only SIMPLE and stores reference names');
select is((select config_metadata->>'verification_scope' from public.signature_provider_configs where provider_code='YOUSIGN'),'TECHNICAL_CONNECTION_ONLY','connection success is not presented as legal authority');
select is((select count(*)::integer from private.signature_adapter_attestations_v1 a join public.signature_provider_configs c on c.id=a.provider_config_id where c.provider_code='YOUSIGN'),0,'approval never creates a legal/provider attestation');
select is((select count(*)::integer from private.contract_signature_policy_versions_v1 p join public.signature_provider_configs c on c.id=p.provider_config_id where c.provider_code='YOUSIGN'),0,'approval never creates a signed contract policy');

select * from finish();
rollback;
