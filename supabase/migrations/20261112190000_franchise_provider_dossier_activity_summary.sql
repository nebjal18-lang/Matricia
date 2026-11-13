-- UX-01 / Lot 4: expose provider_profiles.activity_summary on franchise dossiers (additive, same ACL).
create or replace function public.franchise_provider_dossiers(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;result jsonb;
begin
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 select * into f from public.franchises where id=p_franchise_id;
 select coalesce(jsonb_agg(jsonb_build_object(
  'organizationId',p.provider_organization_id,
  'name',o.display_name,
  'companyStatus',p.company_status,
  'status',p.overall_status,
  'createdAt',p.created_at,
  'teamSize',p.team_size,
  'activitySummary',p.activity_summary,
  'regions',coalesce((select to_jsonb(r.region_codes)from public.provider_region_versions r where r.provider_organization_id=p.provider_organization_id order by r.version_number desc limit 1),'[]'::jsonb),
  'qualifications',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'serviceId',q.service_id,'serviceCode',s.code,'status',coalesce(d.status,'PENDING'),'rowVersion',q.row_version)order by s.code)from public.provider_qualifications q join public.catalog_services s on s.id=q.service_id left join public.provider_qualification_decisions d on d.id=q.current_decision_id where q.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id),'[]'::jsonb),
  'capacities',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'serviceId',c.service_id,'serviceCode',c.code,'status',c.capacity_status,'availableUnits',c.available_units,'leadTimeDays',c.lead_time_days)order by c.code)from(select distinct on(v.service_id)v.*,s.code from public.provider_capacity_versions v join public.catalog_services s on s.id=v.service_id where v.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id and v.effective_from<=now()and(v.effective_until is null or v.effective_until>now())order by v.service_id,v.version_number desc)c),'[]'::jsonb),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'kind',v.document_kind,'code',v.code,'status',v.status,'expiresOn',v.expires_on)order by v.code)from(select distinct on(d.family_id)d.id,d.status,d.expires_on,d.family_id,d.version_number,family.document_kind,family.code from public.provider_document_versions d join public.provider_document_families family on family.id=d.family_id where d.provider_organization_id=p.provider_organization_id and exists(select 1 from public.provider_document_service_links link join public.provider_services ps on ps.id=link.provider_service_id join public.catalog_services s on s.id=ps.service_id where link.document_version_id=d.id and s.library_id=f.library_id)order by d.family_id,d.version_number desc)v),'[]'::jsonb)
 )order by o.display_name,p.provider_organization_id),'[]'::jsonb)into result
 from public.provider_profiles p join public.organizations o on o.id=p.provider_organization_id where exists(select 1 from public.provider_services ps join public.catalog_services s on s.id=ps.service_id where ps.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id);
 return result;
end$$;
revoke all on function public.franchise_provider_dossiers(uuid)from public,anon,service_role;
grant execute on function public.franchise_provider_dossiers(uuid)to authenticated;
