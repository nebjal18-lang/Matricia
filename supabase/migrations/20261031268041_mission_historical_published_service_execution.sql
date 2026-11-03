-- Gold Master 3070/6104: pausing or replacing a service blocks new demand,
-- while a signed contract keeps its exact historical service version.
begin;
do $$declare definition text;needle text;
begin
 definition:=pg_get_functiondef('private.contract_service_version_for_mission_v1(uuid)'::regprocedure);
 needle:='sv.status not in(''PUBLISHED'',''RETIRED'')';
 if position(needle in definition)=0 then raise exception'MISSION_HISTORICAL_SOURCE_PATCH_MISMATCH';end if;
 execute replace(definition,needle,'sv.status not in(''PUBLISHED'',''RETIRED'',''ARCHIVED'')');
 definition:=pg_get_functiondef('public.create_mission(uuid,uuid,jsonb,jsonb,jsonb,text,uuid)'::regprocedure);
 needle:='sv.status<>''PUBLISHED'' or cs.current_published_version_id is distinct from sv.id';
 if position(needle in definition)=0 then raise exception'MISSION_HISTORICAL_EXECUTION_PATCH_MISMATCH';end if;
 -- The inner 268040 resolver still proves service/library/hash/RFQ/origin.
 -- Only the catalogue lifecycle check changes. Signature, people, identity,
 -- money, checklist publication, CAS and replay guards remain in their cores.
 execute replace(definition,needle,'sv.status not in(''PUBLISHED'',''RETIRED'',''ARCHIVED'')or sv.published_at is null');
end$$;
notify pgrst,'reload schema';
commit;
