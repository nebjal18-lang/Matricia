-- Return and cache the final optimistic version after native pipeline catch-up.
create or replace function public.link_franchise_provider_organization(p_prospect_id uuid,p_provider_organization_id uuid,p_expected_row_version integer,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
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
 -- AFTER triggers may advance pipeline stages and their optimistic version.
 -- Re-read after the statement; UPDATE RETURNING observes the pre-AFTER row.
 select * into p from public.franchise_crm_prospects where id=p_prospect_id;
 response:=jsonb_build_object('outcome','FRANCHISE_PROVIDER_ORGANIZATION_LINKED','prospect_id',p.id,'provider_organization_id',p_provider_organization_id,'row_version',p.row_version);
 insert into public.franchise_crm_activities(franchise_id,prospect_id,activity_type,occurred_at,summary,evidence_refs,actor_user_id,correlation_id)values(f.id,p.id,'NOTE',clock_timestamp(),btrim(p_reason),jsonb_build_array(jsonb_build_object('organization_id',p_provider_organization_id)),a,p_correlation_id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,a,'USER','franchise.provider.organization_linked','franchise_prospect',p.id::text,p_correlation_id,response,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.operator_organization_id,'franchise_prospect',p.id::text,'FranchiseProviderOrganizationLinkedV1',p_correlation_id,response,p_idempotency_key);
 perform private.finish_contract_command(f.operator_organization_id,'franchise.crm.provider.link.'||p.id::text,p_idempotency_key,response);return response;
end$$;

