begin;
create function private.assert_admin_execution_payload_v1(p_resource_type text,p_payload jsonb)returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_resource_type in('MEMBERSHIP','USER')and p_payload?'capabilities'then
  if jsonb_typeof(p_payload->'capabilities')<>'array'or jsonb_array_length(p_payload->'capabilities')>27 then raise exception'INVALID_ADMIN_CAPABILITY_REQUEST'using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(p_payload->'capabilities')v where v<>all(array['seeUsers','createUsers','editUsers','manageRoles','sendInvites','seeOrgs','editOrgs','manageMandates','manageTerritories','accessDocs','readData','exportData','sensitiveData','financeData','complianceData','settings','security','auditLogs','integrations','catalog','rules','validateJourneys','providers','api','webhooks','readOnly','support']))then raise exception'ADMIN_CAPABILITY_OUTSIDE_MODEL'using errcode='22023';end if;
 end if;
end$$;
revoke all on function private.assert_admin_execution_payload_v1(text,jsonb)from public,anon,authenticated,service_role;
do $$declare definition text;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'payload:=x.redacted_summary;')=0 then raise exception'ADMIN_EXECUTOR_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'payload:=x.redacted_summary;', 'payload:=x.redacted_summary; perform private.assert_admin_execution_payload_v1(x.resource_type,payload);');
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
