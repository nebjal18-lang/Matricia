begin;
-- Keep the queue under the caller's profile/service/document RLS. Resolve only
-- those profiles' display names through the existing bounded Admin projection;
-- an independent reviewer must not need membership in the reviewed company.
create function public.get_admin_provider_queue_snapshot_v1(p_locale text)returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare profile_ids uuid[]; names jsonb; rows jsonb;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or p_locale is null or p_locale not in('fr','ar')
 or not public.admin_special_space_snapshot_access_v1('providers')then raise exception'ADMIN_EXPORT_SCOPE_DENIED'using errcode='42501';end if;
 profile_ids:=array(select provider_organization_id from public.provider_profiles order by updated_at desc,provider_organization_id limit 20001);
 if cardinality(profile_ids)>20000 then raise exception'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
 names:=public.list_admin_provider_organization_names_v1(profile_ids);
 if jsonb_typeof(names->'organizations')is distinct from'array'then raise exception'INVALID_ADMIN_PROVIDER_NAMES'using errcode='55000';end if;
 if jsonb_array_length(names->'organizations')<>cardinality(profile_ids)
 or exists(select 1 from unnest(profile_ids)id where not exists(select 1 from jsonb_array_elements(names->'organizations')n where n->>'id'=id::text))then
  raise exception'INVALID_ADMIN_PROVIDER_NAMES'using errcode='55000';
 end if;
 select coalesce(jsonb_agg(item order by updated_at desc,organization_id),'[]'::jsonb)into rows from(
  select p.updated_at,p.provider_organization_id organization_id,jsonb_build_object(
   'id',p.provider_organization_id,'title',o.display_name,'status',p.overall_status,'organizationId',p.provider_organization_id,
   'cells',jsonb_build_array(o.display_name,coalesce((select s.code from public.provider_services ps join public.catalog_services s on s.id=ps.service_id where ps.provider_organization_id=p.provider_organization_id order by ps.updated_at desc,ps.id limit 1),'—'),p.overall_status,p.company_status,(select count(*)::text from public.provider_document_versions d where d.provider_organization_id=p.provider_organization_id),p.partner_contract_status,p.overall_status),
   'extras',jsonb_build_object('rowVersion',p.row_version::text,'partner',p.partner_contract_status))item
  from public.provider_profiles p join jsonb_to_recordset(names->'organizations')as o(id uuid,display_name text)on o.id=p.provider_organization_id
  where p.provider_organization_id=any(profile_ids)
 )page;
 if jsonb_array_length(rows)<>cardinality(profile_ids)then raise exception'INVALID_ADMIN_PROVIDER_NAMES'using errcode='55000';end if;
 if octet_length(rows::text)>16777216 then raise exception'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
 return jsonb_build_object('rows',rows,'snapshotAt',statement_timestamp(),'complete',true);
end$$;
revoke all on function public.get_admin_provider_queue_snapshot_v1(text)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_provider_queue_snapshot_v1(text)to authenticated;
-- Replace the affected branch only. Every other special-space query and its
-- existing authorization checks remain byte-for-byte unchanged.
do $$declare definition text;first integer;last integer;begin
 definition:=pg_get_functiondef('public.get_admin_special_space_snapshot_v1(text,text)'::regprocedure);
 first:=strpos(definition,'if p_space=''providers''then');last:=strpos(definition,'elsif p_space=''qualification''then');
 if first=0 or last<=first then raise exception'ADMIN_PROVIDER_QUEUE_DEFINITION_CHANGED';end if;
 execute substring(definition from 1 for first-1)||'if p_space=''providers''then return public.get_admin_provider_queue_snapshot_v1(p_locale); '||substring(definition from last);
end$$;
notify pgrst,'reload schema';
commit;
