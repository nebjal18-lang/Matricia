-- Preserve the previously audited exact-mandate projections behind private implementation names.
alter function public.franchise_provider_dossiers(uuid) rename to franchise_provider_dossiers_v1;
alter function public.franchise_provider_dossiers_v1(uuid) set schema private;
revoke all on function private.franchise_provider_dossiers_v1(uuid)from public,anon,authenticated,service_role;
create function public.franchise_provider_dossiers(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 select coalesce(jsonb_agg(provider || jsonb_build_object('partnerContract',(
 select jsonb_build_object('id',d.id,'version',d.decision_version,'status',case when d.partner_contract_status='SIGNED'and d.partner_contract_expires_at<=statement_timestamp()then'EXPIRED'else d.partner_contract_status end,'expiresAt',d.partner_contract_expires_at,'decidedAt',d.decided_at,'ruleVersion',d.rule_version,'reason',d.reason)
 from public.provider_company_decisions d where d.provider_organization_id=(provider->>'organizationId')::uuid order by d.decision_version desc limit 1))order by provider->>'name',provider->>'organizationId'),'[]'::jsonb)into result
 from jsonb_array_elements(private.franchise_provider_dossiers_v1(p_franchise_id))provider;
 return result;
end$$;
revoke all on function public.franchise_provider_dossiers(uuid)from public,anon,service_role;
grant execute on function public.franchise_provider_dossiers(uuid)to authenticated;

create function public.franchise_partner_contract_history(p_franchise_id uuid,p_decision_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;provider uuid;
begin
 -- Scope is checked on the live mandate, then on the provider association. A guessed decision UUID grants no access.
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 select d.provider_organization_id into provider from public.provider_company_decisions d where d.id=p_decision_id and exists(select 1 from public.provider_services ps join public.catalog_services s on s.id=ps.service_id join public.franchises f on f.library_id=s.library_id where ps.provider_organization_id=d.provider_organization_id and f.id=p_franchise_id);
 if provider is null then raise exception 'FRANCHISE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 select jsonb_build_object('organizationId',provider,'name',o.display_name,'selectedId',p_decision_id,'history',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'version',d.decision_version,'companyStatus',d.company_status,'status',d.partner_contract_status,'expiresAt',d.partner_contract_expires_at,'decidedAt',d.decided_at,'ruleVersion',d.rule_version,'reason',d.reason)order by d.decision_version desc)from public.provider_company_decisions d where d.provider_organization_id=provider),'[]'::jsonb))into result from public.organizations o where o.id=provider;
 return result;
end$$;
revoke all on function public.franchise_partner_contract_history(uuid,uuid)from public,anon,service_role;
grant execute on function public.franchise_partner_contract_history(uuid,uuid)to authenticated;

alter function public.franchise_supervision_metrics(uuid)rename to franchise_supervision_metrics_v1;
alter function public.franchise_supervision_metrics_v1(uuid)set schema private;
revoke all on function private.franchise_supervision_metrics_v1(uuid)from public,anon,authenticated,service_role;
create function public.franchise_supervision_metrics(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;dossiers jsonb;network jsonb;
begin
 result:=private.franchise_supervision_metrics_v1(p_franchise_id);
 dossiers:=public.franchise_provider_dossiers(p_franchise_id);
 select jsonb_build_object('providers',count(*),'activeProviders',count(*)filter(where p->>'companyStatus'='VERIFIED'and p->'partnerContract'->>'status'='SIGNED'and exists(select 1 from jsonb_array_elements(p->'qualifications')q where q->>'status'='APPROVED')and p->>'status'not in('SUSPENDED','TERMINATED','FINANCIAL_RESTRICTED','QUALITY_RESTRICTED','COMPLIANCE_RESTRICTED')),
 'qualifiedProviders',count(*)filter(where exists(select 1 from jsonb_array_elements(p->'qualifications')q where q->>'status'='APPROVED')),
 'inProgressProviders',count(*)filter(where p->>'companyStatus'='UNDER_REVIEW'or exists(select 1 from jsonb_array_elements(p->'qualifications')q where q->>'status'='PENDING')),
 'incompleteProviders',count(*)filter(where p->'partnerContract'is null or p->'partnerContract'='null'::jsonb or p->'partnerContract'->>'status'<>'SIGNED'or not exists(select 1 from jsonb_array_elements(p->'documents')d where d->>'status'='VERIFIED')),
 'documentsExpiring',(select count(*)from jsonb_array_elements(dossiers)p2 cross join lateral jsonb_array_elements(p2->'documents')d where d->>'expiresOn'is not null and(d->>'expiresOn')::date<=current_date+30),
 'methodology','Providers associated with library services; current immutable qualification and company decisions; document deadlines within 30 days including overdue. Categories can overlap.')into network from jsonb_array_elements(dossiers)p;
 return result||jsonb_build_object('network',network);
end$$;
revoke all on function public.franchise_supervision_metrics(uuid)from public,anon,service_role;
grant execute on function public.franchise_supervision_metrics(uuid)to authenticated;
