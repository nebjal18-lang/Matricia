begin;
-- A purpose-scoped selector exposes names for the exact currently effective
-- mandate. It never chooses the latest unrelated territory or infers a role.
create function public.franchise_mandate_choices_v1(p_organization_id uuid default null)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;begin
 if auth.uid()is null then raise exception'FRANCHISE_MANDATE_CHOICES_AUTH_REQUIRED'using errcode='42501';end if;
 with choices as(
  select f.id,f.operator_organization_id organization_id,f.library_id,t.territory_code,t.name_fr territory_fr,t.name_ar territory_ar,
   lib.code library_code,coalesce(nullif(lv.name_fr,''),lib.code)library_fr,coalesce(nullif(lv.name_ar,''),lib.code)library_ar,
   (select jsonb_agg(jsonb_build_object('code',r.code,'label_fr',r.label_fr,'label_ar',r.label_ar)order by r.code)
    from public.role_definitions r where r.scope_type='FRANCHISE'and private.has_franchise_role(f.id,array[r.code],auth.uid()))roles
  from public.franchises f join public.franchise_mandate_versions m on m.id=f.current_mandate_version_id and m.franchise_id=f.id
  join public.franchise_territory_versions t on t.id=m.territory_version_id and t.franchise_id=f.id
  join public.catalog_libraries lib on lib.id=f.library_id
  left join public.catalog_library_versions lv on lv.id=lib.current_published_version_id and lv.library_id=lib.id
  where(p_organization_id is null or f.operator_organization_id=p_organization_id)
   and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT','FRANCHISE_PROVIDER_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER'],auth.uid())
  order by t.territory_code,f.id limit 1001
 )select jsonb_build_object('complete',true,'items',coalesce(jsonb_agg(to_jsonb(choices)order by territory_code,id),'[]'::jsonb))into result from choices;
 if jsonb_array_length(result->'items')>1000 then raise exception'FRANCHISE_MANDATE_CHOICES_SCOPE_REQUIRED'using errcode='54000';end if;
 return result;
end$$;
revoke all on function public.franchise_mandate_choices_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.franchise_mandate_choices_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
