begin;
-- Match the existing monthly closing's civil calendar, independently of the
-- connection TimeZone. Never change the session clock used by signed hashes.
create function private.provider_finance_civil_date_v1(p_instant timestamptz)returns date
language sql immutable strict set search_path=pg_catalog as $$
 select (p_instant at time zone 'Africa/Casablanca')::date
$$;
revoke all on function private.provider_finance_civil_date_v1(timestamptz)from public,anon,authenticated,service_role;

-- Preserve every other validation, authorization, proof, idempotency and audit
-- path. Abort instead of silently patching an unexpected command definition.
do $migration$
declare signature text;field text;definition text;needle text;replacement text;
begin
 for signature,field in values
  ('public.record_provider_payable_event(uuid,text,date,character,bigint,text,text,text,uuid)','p_occurred_on'),
  ('public.record_provider_payment(uuid,text,date,text,character,bigint,text,uuid,uuid,text,uuid)','p_paid_on')
 loop
  definition:=pg_get_functiondef(signature::regprocedure);
  needle:=field||'>current_date';
  replacement:=field||'>private.provider_finance_civil_date_v1(clock_timestamp())';
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then
   raise exception 'PROVIDER_FINANCE_CIVIL_DATE_PATCH_MISSING: %',signature;
  end if;
  execute replace(definition,needle,replacement);
 end loop;
end $migration$;
notify pgrst,'reload schema';
commit;
