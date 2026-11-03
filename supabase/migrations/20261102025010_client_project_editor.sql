begin;
-- Keep the immutable objectives and contracted scope on a normal Client edit.
create function public.edit_client_project_v1(p_project_id uuid,p_expected_row_version integer,p_site_id uuid,p_status text,p_name_fr text,p_name_ar text,p_description_fr text,p_description_ar text,p_started_on date,p_target_end_on date,p_change_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare p public.client_projects%rowtype;v public.client_project_versions%rowtype;
begin
 select * into p from public.client_projects where id=p_project_id;
 if p.id is null or auth.uid()is null or not coalesce(private.client_portfolio_manage(p.organization_id,auth.uid()),false)then raise exception 'CLIENT_PROJECT_SAVE_DENIED'using errcode='42501';end if;
 -- Lock before resolving the current immutable scope. The original command
 -- checks CAS and idempotency under the same transaction and writes the audit.
 perform 1 from public.client_projects where id=p.id for update;
 select v0.* into v from public.client_project_versions v0 join public.client_projects p0 on p0.id=v0.project_id and p0.current_version=v0.version where p0.id=p.id;
 return public.save_client_project_version(p_project_id,p_expected_row_version,p_site_id,p_status,p_name_fr,p_name_ar,p_description_fr,p_description_ar,v.objectives,v.scope_snapshot,p_started_on,p_target_end_on,p_change_reason,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.edit_client_project_v1(uuid,integer,uuid,text,text,text,text,text,date,date,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.edit_client_project_v1(uuid,integer,uuid,text,text,text,text,text,date,date,text,text,uuid)to authenticated;
create function public.list_client_project_assignees_v1(p_organization_id uuid)returns table(user_id uuid,organization_id uuid,label text)
language plpgsql stable security definer set search_path=pg_catalog as $$begin
 if auth.uid()is null or not coalesce(private.client_portfolio_read(p_organization_id,auth.uid()),false)then raise exception 'CLIENT_PROJECT_ASSIGNEES_DENIED'using errcode='42501';end if;
 return query select m.user_id,m.organization_id,p.display_name from public.organization_memberships m join public.user_profiles p on p.id=m.user_id where m.organization_id=p_organization_id and m.status='ACTIVE'order by p.display_name,m.user_id;
end$$;
revoke all on function public.list_client_project_assignees_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.list_client_project_assignees_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
