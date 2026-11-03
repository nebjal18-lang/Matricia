begin;
set local search_path=pg_catalog;
-- Read authority is not operational write authority. A Technician+Viewer/Sales
-- composite membership must still be assigned before submitting work.
create function private.provider_mission_execution_access_v1(p_mission_id uuid,p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p_actor is not null and exists(select 1 from public.missions m where m.id=p_mission_id and(
 private.has_org_role(m.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],p_actor)
 or(private.has_org_role(m.provider_organization_id,array['PROVIDER_TECHNICIAN'],p_actor)and exists(select 1 from public.provider_mission_assignments_v1 a where a.mission_id=m.id and a.user_id=p_actor and a.revoked_at is null))))
$$;
revoke all on function private.provider_mission_execution_access_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function private.provider_mission_execution_access_v1(uuid,uuid)to authenticated;
do $patch$declare sig text;src text;needle text:='private.provider_mission_access_v1(';policy_expr text;
begin
 foreach sig in array array['public.submit_delivery(uuid,text,jsonb,jsonb,text,uuid)','public.complete_mission_checklist_item(uuid,text,uuid,text,uuid)','public.submit_mission_milestone(uuid,integer,text,uuid)','public.resubmit_mission_milestone_v1(uuid,integer,text,text,uuid)']loop
  src:=pg_get_functiondef(sig::regprocedure);if position(needle in src)=0 then raise exception'PROVIDER_EXECUTION_AUTHORITY_SOURCE_DRIFT:%',sig;end if;
  execute replace(src,needle,'private.provider_mission_execution_access_v1(');
 end loop;
 select pg_get_expr(p.polwithcheck,p.polrelid)into policy_expr from pg_policy p where p.polrelid='storage.objects'::regclass and p.polname='delivery_proof_storage_insert';
 if position(needle in policy_expr)=0 then raise exception'PROVIDER_EXECUTION_STORAGE_SOURCE_DRIFT';end if;
 execute 'alter policy delivery_proof_storage_insert on storage.objects with check('||replace(policy_expr,needle,'private.provider_mission_execution_access_v1(')||')';
end$patch$;
commit;
