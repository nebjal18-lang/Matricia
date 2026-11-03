begin;
set local search_path=public,extensions;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-p233-only',configured_at=clock_timestamp()where singleton;
select lives_ok($$select private.assert_scan_engine_environment_v1('CLEAN','MATRICIA_SANDBOX')$$,'sandbox acceptance is an explicitly configured development simulation');
update private.admin_execution_environment_v1 set environment='STAGING'where singleton;
select lives_ok($$select private.assert_scan_engine_environment_v1('INFECTED','MATRICIA_SANDBOX')$$,'sandbox infection result is also limited to explicit nonproduction context');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select set_config('app.environment','DEVELOPMENT',true);
select throws_ok($$select private.assert_scan_engine_environment_v1('CLEAN','MATRICIA_SANDBOX')$$,'42501','SANDBOX_SCAN_VERDICT_FORBIDDEN','a development hint cannot authorize a simulated clean result in production');
select throws_ok($$select private.assert_scan_engine_environment_v1('INFECTED','MATRICIA_SANDBOX')$$,'42501','SANDBOX_SCAN_VERDICT_FORBIDDEN','simulated infection cannot quarantine a production file as native evidence');
select lives_ok($$select private.assert_scan_engine_environment_v1('ERROR','MATRICIA_SANDBOX')$$,'technical failure remains recordable without claiming an antivirus verdict');
select lives_ok($$select private.assert_scan_engine_environment_v1('CLEAN','CLAMAV_TCP')$$,'the sandbox guard preserves the actual scanner path whose native evidence is verified by the worker');
-- Deliberately nonexistent document: the real scan-result trigger must reject sandbox verdict
-- before any FK or state effect; this is not a claim of an uploaded/scanned production file.
select throws_ok($$insert into private.client_document_scan_results(document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,detected_mime_type,detected_size_bytes,scanner_principal,correlation_id)values('a2330000-0000-4000-8000-000000000001','b2330000-0000-4000-8000-000000000001',1,'CLEAN','MATRICIA_SANDBOX','1.0.0',repeat('a',64),'application/pdf',10,'SUPABASE_SERVICE_ROLE','c2330000-0000-4000-8000-000000000001')$$,'42501','SANDBOX_SCAN_VERDICT_FORBIDDEN','the actual Client scan evidence table refuses a sandbox clean result before persistence');
select throws_ok($$insert into private.delivery_proof_scan_results(proof_id,sequence,result,engine_code,engine_version,computed_sha256,scanner_principal,correlation_id)values('a2330000-0000-4000-8000-000000000001',1,'CLEAN','MATRICIA_SANDBOX','1.0.0',repeat('a',64),'SUPABASE_SERVICE_ROLE','c2330000-0000-4000-8000-000000000002')$$,'42501','SANDBOX_SCAN_VERDICT_FORBIDDEN','the actual delivery evidence table refuses the same simulated result');
select is((select count(*)from private.client_document_scan_results where correlation_id='c2330000-0000-4000-8000-000000000001'),0::bigint,'forbidden simulated Client evidence is absent');
select is((select count(*)from private.delivery_proof_scan_results where correlation_id='c2330000-0000-4000-8000-000000000002'),0::bigint,'forbidden simulated delivery evidence is absent');
update private.admin_execution_environment_v1 set environment=null where singleton;
select throws_ok($$select private.assert_scan_engine_environment_v1('CLEAN','MATRICIA_SANDBOX')$$,'42501','SANDBOX_SCAN_VERDICT_FORBIDDEN','an unconfigured database is never assumed to be development');
select is((select count(*)from pg_trigger t where t.tgfoid='private.assert_scan_engine_environment_trigger_v1()'::regprocedure and t.tgrelid=any(array['private.client_document_scan_results'::regclass,'private.delivery_proof_scan_results'::regclass,'private.provider_payment_proof_scan_results'::regclass,'private.provider_document_scan_results'::regclass])and not t.tgisinternal),4::bigint,'all four existing typed scan stores use the trusted environment guard');
select ok(not has_function_privilege('authenticated','private.assert_scan_engine_environment_v1(text,text)','EXECUTE')and not has_function_privilege('service_role','private.assert_scan_engine_environment_trigger_v1()','EXECUTE'),'no client can change the scan trust context through a helper API');
select*from finish();rollback;
