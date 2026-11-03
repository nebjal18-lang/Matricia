-- Exact multi-mandate access and an explicit CRM-to-provider organization bridge.
create or replace function private.franchise_access(p_franchise_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','LIBRARY_MANAGER','READ_ONLY_AUDITOR'],p_actor)or exists(
 select 1 from public.franchises f join public.organization_memberships m on m.organization_id=f.operator_organization_id and m.user_id=p_actor and m.status='ACTIVE'
 join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null and r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER')
 where f.id=p_franchise_id and(r.franchise_id=f.id or(r.franchise_id is null and(select count(*)from public.franchises other where other.operator_organization_id=f.operator_organization_id and other.status='ACTIVE')=1)))
$$;
create or replace function private.franchise_crm_write_access(p_franchise uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.franchises f join public.organization_memberships m on m.organization_id=f.operator_organization_id and m.user_id=p_actor and m.status='ACTIVE'
 join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null and r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER')
 where f.id=p_franchise and(r.franchise_id=f.id or(r.franchise_id is null and(select count(*)from public.franchises other where other.operator_organization_id=f.operator_organization_id and other.status='ACTIVE')=1)))
 or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],p_actor)
$$;
create or replace function private.franchise_crm_row_access(p_franchise_id uuid,p_territory_version_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.franchises f join public.franchise_territory_versions t on t.franchise_id=f.id and t.id=p_territory_version_id
 where f.id=p_franchise_id and(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],p_actor)or exists(
 select 1 from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null
 where m.organization_id=f.operator_organization_id and m.user_id=p_actor and m.status='ACTIVE'and r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_VIEWER')
 and(r.franchise_id=f.id or(r.franchise_id is null and(select count(*)from public.franchises other where other.operator_organization_id=f.operator_organization_id and other.status='ACTIVE')=1)))))
$$;
create or replace function private.franchise_book_access(p_book uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],p_actor)or exists(
 select 1 from public.franchise_pnl_books b join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id
 join public.organization_memberships m on m.organization_id=f.operator_organization_id and m.user_id=p_actor and m.status='ACTIVE'
 join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null and r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER')
 where b.id=p_book and(r.franchise_id=f.id or(r.franchise_id is null and(select count(*)from public.franchises other where other.operator_organization_id=f.operator_organization_id and other.status='ACTIVE')=1)))
$$;
alter table public.franchise_crm_prospects add column linked_organization_id uuid references public.organizations(id)on delete restrict;
create index franchise_crm_linked_provider_idx on public.franchise_crm_prospects(franchise_id,linked_organization_id)where linked_organization_id is not null;
create function public.link_franchise_provider_organization(p_prospect_id uuid,p_provider_organization_id uuid,p_expected_row_version integer,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p public.franchise_crm_prospects%rowtype;f public.franchises%rowtype;h text;response jsonb;
begin
 select * into p from public.franchise_crm_prospects where id=p_prospect_id for update;
 if not found or a is null or not private.franchise_crm_write_access(p.franchise_id,a)then raise exception 'FRANCHISE_PROVIDER_LINK_DENIED'using errcode='42501';end if;
 select * into f from public.franchises where id=p.franchise_id for share;
 if p.prospect_type<>'PROVIDER'or length(btrim(coalesce(p_reason,'')))not between 3 and 500 or not exists(
 select 1 from public.provider_services ps join public.catalog_services s on s.id=ps.service_id join public.organizations o on o.id=ps.provider_organization_id
 where ps.provider_organization_id=p_provider_organization_id and s.library_id=f.library_id and o.status='ACTIVE')then raise exception 'FRANCHISE_PROVIDER_LINK_CONTEXT_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('prospect',p.id,'provider_organization_id',p_provider_organization_id,'expected',p_expected_row_version,'reason',btrim(p_reason)));
 response:=private.begin_contract_command(f.operator_organization_id,'franchise.crm.provider.link.'||p.id::text,p_idempotency_key,h,a);if response is not null then return response;end if;
 if p.row_version is distinct from p_expected_row_version then raise exception 'STALE_FRANCHISE_PROSPECT'using errcode='40001';end if;
 update public.franchise_crm_prospects set linked_organization_id=p_provider_organization_id,row_version=row_version+1,updated_at=clock_timestamp()where id=p.id;
 response:=jsonb_build_object('outcome','FRANCHISE_PROVIDER_ORGANIZATION_LINKED','prospect_id',p.id,'provider_organization_id',p_provider_organization_id,'row_version',p.row_version+1);
 insert into public.franchise_crm_activities(franchise_id,prospect_id,activity_type,occurred_at,summary,evidence_refs,actor_user_id,correlation_id)values(f.id,p.id,'NOTE',clock_timestamp(),btrim(p_reason),jsonb_build_array(jsonb_build_object('organization_id',p_provider_organization_id)),a,p_correlation_id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,a,'USER','franchise.provider.organization_linked','franchise_prospect',p.id::text,p_correlation_id,response,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.operator_organization_id,'franchise_prospect',p.id::text,'FranchiseProviderOrganizationLinkedV1',p_correlation_id,response,p_idempotency_key);
 perform private.finish_contract_command(f.operator_organization_id,'franchise.crm.provider.link.'||p.id::text,p_idempotency_key,response);return response;
end$$;

create function public.franchise_provider_dossiers(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;result jsonb;
begin
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 select * into f from public.franchises where id=p_franchise_id;
 select coalesce(jsonb_agg(jsonb_build_object('organizationId',p.provider_organization_id,'name',o.display_name,'companyStatus',p.company_status,'status',p.overall_status,'createdAt',p.created_at,'teamSize',p.team_size,'regions',coalesce((select to_jsonb(r.region_codes)from public.provider_region_versions r where r.provider_organization_id=p.provider_organization_id order by r.version_number desc limit 1),'[]'::jsonb),
 'qualifications',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'serviceId',q.service_id,'serviceCode',s.code,'status',coalesce(d.status,'PENDING'),'rowVersion',q.row_version)order by s.code)from public.provider_qualifications q join public.catalog_services s on s.id=q.service_id left join public.provider_qualification_decisions d on d.id=q.current_decision_id where q.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id),'[]'::jsonb),
 'capacities',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'serviceId',c.service_id,'serviceCode',c.code,'status',c.capacity_status,'availableUnits',c.available_units,'leadTimeDays',c.lead_time_days)order by c.code)from(select distinct on(v.service_id)v.*,s.code from public.provider_capacity_versions v join public.catalog_services s on s.id=v.service_id where v.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id and v.effective_from<=now()and(v.effective_until is null or v.effective_until>now())order by v.service_id,v.version_number desc)c),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'kind',v.document_kind,'code',v.code,'status',v.status,'expiresOn',v.expires_on)order by v.code)from(select distinct on(d.family_id)d.id,d.status,d.expires_on,d.family_id,d.version_number,family.document_kind,family.code from public.provider_document_versions d join public.provider_document_families family on family.id=d.family_id where d.provider_organization_id=p.provider_organization_id and exists(select 1 from public.provider_document_service_links link join public.provider_services ps on ps.id=link.provider_service_id join public.catalog_services s on s.id=ps.service_id where link.document_version_id=d.id and s.library_id=f.library_id)order by d.family_id,d.version_number desc)v),'[]'::jsonb))order by o.display_name,p.provider_organization_id),'[]'::jsonb)into result
 from public.provider_profiles p join public.organizations o on o.id=p.provider_organization_id where exists(select 1 from public.provider_services ps join public.catalog_services s on s.id=ps.service_id where ps.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id);
 return result;
end$$;
revoke all on function public.link_franchise_provider_organization(uuid,uuid,integer,text,text,uuid),public.franchise_provider_dossiers(uuid)from public,anon,service_role;
grant execute on function public.link_franchise_provider_organization(uuid,uuid,integer,text,text,uuid),public.franchise_provider_dossiers(uuid)to authenticated;
create function public.franchise_actor_capabilities(p_franchise_id uuid)returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('read',private.franchise_access(p_franchise_id),'write',private.franchise_crm_write_access(p_franchise_id))
$$;
revoke all on function public.franchise_actor_capabilities(uuid)from public,anon,service_role;
grant execute on function public.franchise_actor_capabilities(uuid)to authenticated;
