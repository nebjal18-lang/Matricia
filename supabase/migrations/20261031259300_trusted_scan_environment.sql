begin;
-- Scanner mode from process.env is not authority for a sandbox verdict on a production database.
create function private.assert_scan_engine_environment_v1(p_result text,p_engine_code text)returns void language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare env text;begin
 if p_result not in('CLEAN','INFECTED')or coalesce(p_engine_code,'')!~'(^|_)(SANDBOX|MOCK|DEMO|TEST|FIXTURE)($|_)'then return;end if;
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null or env not in('DEVELOPMENT','STAGING')then raise exception'SANDBOX_SCAN_VERDICT_FORBIDDEN'using errcode='42501';end if;
end$$;
create function private.assert_scan_engine_environment_trigger_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$begin
 perform private.assert_scan_engine_environment_v1(new.result,new.engine_code);return new;
end$$;
create trigger trusted_scan_environment before insert on private.client_document_scan_results for each row execute function private.assert_scan_engine_environment_trigger_v1();
create trigger trusted_scan_environment before insert on private.delivery_proof_scan_results for each row execute function private.assert_scan_engine_environment_trigger_v1();
create trigger trusted_scan_environment before insert on private.provider_payment_proof_scan_results for each row execute function private.assert_scan_engine_environment_trigger_v1();
create trigger trusted_scan_environment before insert on private.provider_document_scan_results for each row execute function private.assert_scan_engine_environment_trigger_v1();
revoke all on function private.assert_scan_engine_environment_v1(text,text),private.assert_scan_engine_environment_trigger_v1()from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
