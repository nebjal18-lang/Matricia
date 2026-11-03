begin;
-- Gold §19.1 requires working days. Historical due dates remain unchanged.
-- A contract may freeze a reviewed calendar. The documented technical default
-- counts Monday–Friday in UTC and asserts no national/public holiday coverage.
create function private.dispute_business_calendar_v1(p_policy jsonb) returns jsonb
language plpgsql stable set search_path=pg_catalog as $$
declare c jsonb; day_item jsonb; holiday jsonb;
begin
 c:=coalesce(p_policy->'business_calendar',jsonb_build_object('version','STANDARD_WEEKDAYS_UTC_V1','time_zone','UTC','working_iso_days',jsonb_build_array(1,2,3,4,5),'holidays','[]'::jsonb));
 if jsonb_typeof(c) is distinct from 'object' or length(btrim(coalesce(c->>'version',''))) not between 1 and 80
 or not exists(select 1 from pg_timezone_names where name=c->>'time_zone')
 or jsonb_typeof(c->'working_iso_days') is distinct from 'array'
 or jsonb_array_length(c->'working_iso_days') not between 1 and 7
 or jsonb_typeof(c->'holidays') is distinct from 'array'
 or jsonb_array_length(c->'holidays')>3660 then raise exception 'INVALID_DISPUTE_BUSINESS_CALENDAR' using errcode='22023';end if;
 for day_item in select * from jsonb_array_elements(c->'working_iso_days') loop
  if day_item::text!~'^[1-7]$' then raise exception 'INVALID_DISPUTE_BUSINESS_CALENDAR' using errcode='22023';end if;
 end loop;
 if (select count(*)<>count(distinct x) from jsonb_array_elements(c->'working_iso_days')x) then raise exception 'INVALID_DISPUTE_BUSINESS_CALENDAR' using errcode='22023';end if;
 for holiday in select * from jsonb_array_elements(c->'holidays') loop
  if jsonb_typeof(holiday)<>'string' or (holiday#>>'{}')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'then raise exception 'INVALID_DISPUTE_BUSINESS_CALENDAR' using errcode='22023';end if;
  perform (holiday#>>'{}')::date;
 end loop;
 return c;
end $$;
create function private.dispute_business_deadline_v1(p_start timestamptz,p_days integer,p_policy jsonb) returns timestamptz
language plpgsql stable set search_path=pg_catalog,private as $$
declare c jsonb:=private.dispute_business_calendar_v1(p_policy); local_due timestamp; remaining integer:=p_days;
begin
 if p_start is null or p_days is null or p_days not between 0 and 3650 then raise exception 'INVALID_DISPUTE_BUSINESS_DAYS' using errcode='22023';end if;
 local_due:=p_start at time zone(c->>'time_zone');
 while remaining>0 loop
  local_due:=local_due+interval '1 day';
  if c->'working_iso_days' @> jsonb_build_array(extract(isodow from local_due)::integer)
  and not(c->'holidays' @> jsonb_build_array(local_due::date::text))then remaining:=remaining-1;end if;
 end loop;
 return local_due at time zone(c->>'time_zone');
end $$;
revoke all on function private.dispute_business_calendar_v1(jsonb),private.dispute_business_deadline_v1(timestamptz,integer,jsonb) from public,anon,authenticated,service_role;
-- Reject an unusable calendar before a case can open. Freeze the resolved
-- technical default into the case policy just like an explicit approved calendar.
do $$declare definition text; needle text:=' return(p-''content_hash'')';begin
 definition:=pg_get_functiondef('private.client_contract_dispute_policy_v1(uuid)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception 'DISPUTE_POLICY_CALENDAR_DEFINITION_CHANGED';end if;
 definition:=replace(definition,needle,' begin perform private.dispute_business_calendar_v1(p);exception when sqlstate''22023''or sqlstate''22007''or sqlstate''22008''then raise exception''CONTRACT_DISPUTE_POLICY_REQUIRED''using errcode=''55000'';end; if(p->>''review_business_days'')::integer>3650 or(p->>''correction_business_days'')::integer>3650 then raise exception''CONTRACT_DISPUTE_POLICY_REQUIRED''using errcode=''55000'';end if; p:=p||jsonb_build_object(''business_calendar'',private.dispute_business_calendar_v1(p));'||needle);
 execute definition;
end$$;
-- Reject an unusable prospective template before independent approval.
do $migration$
declare definition text; needle text:='  data_value:=jsonb_build_object(''clauses'',clauses_value);';
patch text:=$patch$
 if clauses_value?'dispute_policy' then
  if jsonb_typeof(clauses_value->'dispute_policy') is distinct from 'object'
  or coalesce(clauses_value#>>'{dispute_policy,review_business_days}','')!~'^[1-9][0-9]{0,3}$'
  or coalesce(clauses_value#>>'{dispute_policy,correction_business_days}','')!~'^[1-9][0-9]{0,3}$'
  then raise exception 'INVALID_CONTRACT_DISPUTE_POLICY' using errcode='22023';end if;
  if (clauses_value#>>'{dispute_policy,review_business_days}')::integer>3650
  or (clauses_value#>>'{dispute_policy,correction_business_days}')::integer>3650
  then raise exception 'INVALID_CONTRACT_DISPUTE_POLICY' using errcode='22023';end if;
  perform private.dispute_business_calendar_v1(clauses_value->'dispute_policy');
 end if;
$patch$;
begin
 definition:=pg_get_functiondef('public.create_contract_policy_version_v1(jsonb,text,uuid)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception 'CONTRACT_CALENDAR_PROPOSAL_DEFINITION_CHANGED';end if;
 execute replace(definition,needle,patch||needle);
end $migration$;
alter table public.dispute_cases add column correction_due_at timestamptz, add column deadline_calendar_snapshot jsonb;
-- Preserve the native role, audit, Outbox, CAS and command idempotency logic.
do $$declare definition text; original text:='review_due_at=clock_timestamp()+make_interval(days=>(policy_snapshot->>''review_business_days'')::integer)'; replacement text:='review_due_at=private.dispute_business_deadline_v1(clock_timestamp(),(policy_snapshot->>''review_business_days'')::integer,policy_snapshot),correction_due_at=case when p_response_type=''ACKNOWLEDGE_AND_CORRECT''then private.dispute_business_deadline_v1(clock_timestamp(),(policy_snapshot->>''correction_business_days'')::integer,policy_snapshot)else null end,deadline_calendar_snapshot=private.dispute_business_calendar_v1(policy_snapshot)';
begin
 definition:=pg_get_functiondef('public.respond_to_mission_dispute(uuid,text,text,jsonb,text,uuid)'::regprocedure);
 if strpos(definition,original)=0 then raise exception 'DISPUTE_RESPONSE_DEADLINE_DEFINITION_CHANGED';end if;
 execute replace(definition,original,replacement);
end$$;
notify pgrst,'reload schema';
commit;
