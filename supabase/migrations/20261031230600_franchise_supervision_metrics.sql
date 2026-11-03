-- Exhaustive, named metric contract; display lists and CRM prospects are not denominators.
create function public.franchise_supervision_metrics(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;result jsonb;
begin
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_METRICS_SCOPE_DENIED'using errcode='42501';end if;
 select * into f from public.franchises where id=p_franchise_id;
 with requests as(select r.*from public.service_requests r where r.library_id=f.library_id),
 consultations as(select distinct r.id,r.status from requests r join public.rfqs rfq on rfq.request_id=r.id),
 missions as(select distinct m.*from public.missions m join public.contract_versions cv on cv.id=m.contract_version_id join public.quote_versions qv on qv.id=cv.selected_quote_version_id join public.rfqs rfq on rfq.id=qv.rfq_id join requests r on r.id=rfq.request_id),
 capacities as(select distinct on(v.provider_organization_id,v.service_id)v.*from public.provider_capacity_versions v join public.catalog_services s on s.id=v.service_id where s.library_id=f.library_id and v.effective_from<=statement_timestamp()and(v.effective_until is null or v.effective_until>statement_timestamp())order by v.provider_organization_id,v.service_id,v.version_number desc),
 response_delays as(select greatest(0,extract(epoch from(min(qv.submitted_at)-rfq.opened_at)))seconds from public.rfqs rfq join requests r on r.id=rfq.request_id join public.quote_versions qv on qv.rfq_id=rfq.id where qv.submitted_at is not null group by rfq.id,rfq.opened_at)
 select jsonb_build_object('methodologyVersion','FRANCHISE_SUPERVISION_V1','grain','LIBRARY_ALL_HISTORY','libraryId',f.library_id,'franchiseId',f.id,'asOf',statement_timestamp(),
 'requestCount',(select count(*)from requests),'conversionDenominator',(select count(*)from consultations),'convertedRequests',(select count(*)from consultations where status in('PROVIDER_SELECTED','CONTRACT_PENDING','CONTRACTED')),
 'missionCount',(select count(*)from missions),'completedMissions',(select count(*)from missions where status='COMPLETED'),
 'capacityProviders',(select count(distinct provider_organization_id)from capacities),'availableProviders',(select count(distinct provider_organization_id)from capacities where capacity_status in('AVAILABLE','LIMITED')and(available_units is null or available_units>0)),
 'responseAverageSeconds',(select round(avg(seconds))from response_delays),
 'qualitySnapshot',(select jsonb_build_object('scoreBasisPoints',s.library_quality_score_basis_points,'modelVersion',s.model_version,'periodStart',s.period_start,'periodEnd',s.period_end)from public.franchise_performance_score_snapshots s where s.franchise_id=f.id order by s.period_end desc,s.created_at desc limit 1),
 'byService',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'titleFr',x.title_fr,'titleAr',x.title_ar,'requests',x.request_count)order by x.request_count desc,x.id)from(select s.id,coalesce(v.name_fr,s.code)title_fr,coalesce(v.name_ar,s.code)title_ar,count(r.id)request_count from requests r join public.catalog_services s on s.id=r.service_id left join public.catalog_service_versions v on v.id=coalesce(s.current_published_version_id,s.current_draft_version_id)group by s.id,s.code,v.name_fr,v.name_ar)x),'[]'::jsonb),
 'byProvider',coalesce((select jsonb_agg(jsonb_build_object('organizationId',x.id,'name',x.display_name,'missions',x.mission_count)order by x.mission_count desc,x.id)from(select o.id,o.display_name,count(m.id)mission_count from missions m join public.organizations o on o.id=m.provider_organization_id where m.status<>'CANCELLED'group by o.id,o.display_name)x),'[]'::jsonb))into result;
 return result;
end$$;
revoke all on function public.franchise_supervision_metrics(uuid)from public,anon,service_role;
grant execute on function public.franchise_supervision_metrics(uuid)to authenticated;
