begin;
alter function public.list_admin_supervision_page_v1(integer,integer)rename to list_admin_supervision_before_identity_status_v1;
revoke all on function public.list_admin_supervision_before_identity_status_v1(integer,integer)from public,anon,authenticated,service_role;
create function public.list_admin_supervision_page_v1(p_limit integer default 100,p_offset integer default 0)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;rows jsonb:='[]';item jsonb;org_id uuid;provider_verified boolean;
begin
 result:=public.list_admin_supervision_before_identity_status_v1(p_limit,p_offset);
 for item in select*from jsonb_array_elements(result->'organizations')loop
  org_id:=(item->>'id')::uuid;provider_verified:=null;
  if exists(select 1 from public.provider_profiles where provider_organization_id=org_id)and to_regprocedure('private.provider_current_identity_is_verified_v1(uuid)')is not null then execute'select private.provider_current_identity_is_verified_v1($1)'into provider_verified using org_id;end if;
  rows:=rows||jsonb_build_array(item||jsonb_build_object('client_compliance_status',(select status from public.client_compliance_cases where organization_id=org_id),'provider_identity_verified',provider_verified,'canonical_identity_verified',(select count(distinct identifier_type)=3 from public.organization_identifiers where organization_id=org_id and is_active and verification_status='VERIFIED'and identifier_type in('ICE','IF','RC'))));
 end loop;
 return jsonb_set(result,'{organizations}',rows);
end$$;
revoke all on function public.list_admin_supervision_page_v1(integer,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_admin_supervision_page_v1(integer,integer)to authenticated;
notify pgrst,'reload schema';
commit;
