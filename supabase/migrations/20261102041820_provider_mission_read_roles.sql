begin;
-- Keep read-only Sales/Accounting context aligned with the authoritative RLS
-- reader. Execution remains separately guarded by assignments and writer roles.
do $patch$declare sig text;body text;old text:='array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN'',''PROVIDER_VIEWER'']';begin
 foreach sig in array array['public.search_provider_missions_v1(uuid,text,integer)','public.get_provider_mission_counts_v1(uuid)']loop
  body:=pg_get_functiondef(sig::regprocedure);
  if position(old in body)=0 then raise exception'MISSION_READ_ROLES_SOURCE_DRIFT:%',sig;end if;
  execute replace(body,old,'array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN'',''PROVIDER_VIEWER'',''PROVIDER_SALES'',''PROVIDER_ACCOUNTING'']');
 end loop;
end$patch$;
notify pgrst,'reload schema';
commit;
