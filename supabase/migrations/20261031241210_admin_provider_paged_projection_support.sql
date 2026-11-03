begin;
create function public.list_admin_provider_organization_names_v1(p_organization_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid()is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'ADMIN_PROVIDER_NAMES_DENIED'using errcode='42501';end if;
 if cardinality(p_organization_ids)>20000 then raise exception'ADMIN_BOUNDED_EXPORT_JOB_REQUIRED'using errcode='54000';end if;
 return jsonb_build_object('organizations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'display_name',display_name)order by id)from public.organizations where id=any(p_organization_ids)),'[]'::jsonb));
end$$;
revoke all on function public.list_admin_provider_organization_names_v1(uuid[])from public,anon,authenticated,service_role;
grant execute on function public.list_admin_provider_organization_names_v1(uuid[])to authenticated;
notify pgrst,'reload schema';
commit;
