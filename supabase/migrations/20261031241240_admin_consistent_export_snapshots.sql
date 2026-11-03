begin;
-- STABLE makes all pages share the invoking statement's MVCC snapshot.
-- Each export is complete within an explicit budget; exceeding it is an error,
-- never a successful partial CSV. Existing authorized projection stays intact.
create or replace function public.get_admin_supervision_snapshot_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb:='{}';page jsonb;entry record;offset_value integer:=0;more boolean;
begin
 loop
  page:=public.list_admin_supervision_page_v1(500,offset_value);more:=false;
  for entry in select*from jsonb_each(page)loop
   if jsonb_typeof(entry.value)='array'then
    result:=jsonb_set(result,array[entry.key],coalesce(result->entry.key,'[]'::jsonb)||entry.value);
    if jsonb_array_length(entry.value)>=500 then more:=true;end if;
    if jsonb_array_length(result->entry.key)>20000 then raise exception'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
   elsif entry.key='work_enrichment'then result:=jsonb_set(result,array[entry.key],coalesce(result->entry.key,'{}'::jsonb)||entry.value);
   elsif offset_value=0 then result:=jsonb_set(result,array[entry.key],entry.value);end if;
  end loop;
  exit when not more;
  offset_value:=offset_value+500;
  if offset_value>20000 then raise exception'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
 end loop;
 if octet_length(result::text)>16777216 then raise exception'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
 return result;
end$$;
revoke all on function public.get_admin_supervision_snapshot_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_admin_supervision_snapshot_v1()to authenticated;
-- This reader deliberately executes as the caller: table/column grants and
-- every RLS policy remain authoritative for the specialized domain rows.
create or replace function public.admin_special_space_snapshot_access_v1(p_space text)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and case
 when p_space in('providers','qualification','capacite')then private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','READ_ONLY_AUDITOR'])
 when p_space in('franchises','territoires','gouvernance')then private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','LIBRARY_MANAGER','READ_ONLY_AUDITOR'])
 when p_space in('litiges','QUALIFICATION_ELIGIBILITY')then private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','DISPUTE_MANAGER','READ_ONLY_AUDITOR'])else false end
$$;
revoke all on function public.admin_special_space_snapshot_access_v1(text)from public,anon,authenticated,service_role;
grant execute on function public.admin_special_space_snapshot_access_v1(text)to authenticated;
create or replace function public.get_admin_special_space_snapshot_v1(p_space text,p_locale text)returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public,private as $$
declare rows jsonb;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or p_locale not in('fr','ar')then raise exception'ADMIN_EXPORT_SCOPE_DENIED'using errcode='42501';end if;
 if not public.admin_special_space_snapshot_access_v1(p_space)then raise exception'ADMIN_EXPORT_SCOPE_DENIED'using errcode='42501';end if;
 if p_space='providers'then
  select coalesce(jsonb_agg(item),'[]'::jsonb)into rows from(select jsonb_build_object('id',p.provider_organization_id,'title',o.display_name,'status',p.overall_status,'organizationId',o.id,'cells',jsonb_build_array(o.display_name,coalesce((select s.code from public.provider_services ps join public.catalog_services s on s.id=ps.service_id where ps.provider_organization_id=o.id order by ps.updated_at desc,ps.id limit 1),'—'),p.overall_status,p.company_status,(select count(*)::text from public.provider_document_versions d where d.provider_organization_id=o.id),p.partner_contract_status,p.overall_status),'extras',jsonb_build_object('rowVersion',p.row_version::text,'partner',p.partner_contract_status))item from public.provider_profiles p join public.organizations o on o.id=p.provider_organization_id order by p.updated_at desc,o.id limit 20001)page;
 elsif p_space='qualification'then
  select coalesce(jsonb_agg(item),'[]'::jsonb)into rows from(select jsonb_build_object('id',coalesce(q.id,s.id),'title',o.display_name,'status',coalesce(d.status,'NOT_REQUESTED'),'organizationId',o.id,'cells',jsonb_build_array(o.display_name,c.code,s.request_status,case when coalesce((e.value->>'eligible')::boolean,false)then case when p_locale='ar'then'مؤهل'else'éligible'end else case when p_locale='ar'then'غير مؤهل'else'non éligible'end end,coalesce(d.status,'NOT_REQUESTED'),coalesce(e.value->'reasons'->>0,'—'),coalesce(d.status,'NOT_REQUESTED')),'extras',jsonb_build_object('serviceId',s.id::text,'rowVersion',coalesce(q.row_version,1)::text))item from public.provider_services s join public.organizations o on o.id=s.provider_organization_id join public.catalog_services c on c.id=s.service_id left join public.provider_qualifications q on q.provider_service_id=s.id left join public.provider_qualification_decisions d on d.id=q.current_decision_id cross join lateral(select case when public.admin_special_space_snapshot_access_v1('QUALIFICATION_ELIGIBILITY')then public.explain_provider_service_eligibility(o.id,s.service_id)else jsonb_build_object('eligible',false,'reasons',jsonb_build_array('ELIGIBILITY_UNAVAILABLE'))end value)e order by s.updated_at desc,s.id limit 20001)page;
 elsif p_space='capacite'then
  select coalesce(jsonb_agg(item),'[]'::jsonb)into rows from(select jsonb_build_object('id',d.id,'title',f.document_kind||' · '||f.code,'status',d.status,'organizationId',o.id,'cells',jsonb_build_array(o.display_name,f.code,d.status,'—','—',f.document_kind||' v'||d.version_number,coalesce(d.expires_on::text,'—'),d.status),'extras',jsonb_build_object('kind',f.document_kind,'version',d.version_number::text,'statusCodes',case when d.expires_on<current_date then'EXPIRED'when d.expires_on<=current_date+30 then'EXPIRING'else''end))item from public.provider_document_versions d join public.provider_document_families f on f.id=d.family_id join public.organizations o on o.id=d.provider_organization_id order by d.created_at desc,d.id limit 20001)page;
 elsif p_space='franchises'then
  select coalesce(jsonb_agg(item),'[]'::jsonb)into rows from(select jsonb_build_object('id',f.id,'title',case when p_locale='ar'then coalesce(lv.name_ar,l.code) else coalesce(lv.name_fr,l.code) end,'status',f.status,'organizationId',f.operator_organization_id,'cells',jsonb_build_array(case when p_locale='ar'then coalesce(lv.name_ar,l.code) else coalesce(lv.name_fr,l.code) end,f.operator_code,f.territory_code,coalesce('v'||v.version,'—'),f.franchise_type,f.status,coalesce(v.mandate_status,'—'),f.status),'extras',jsonb_build_object('mandateId',coalesce(v.id::text,''),'type',f.franchise_type))item from public.franchises f join public.catalog_libraries l on l.id=f.library_id left join lateral(select name_fr,name_ar from public.catalog_library_versions where library_id=l.id order by version desc limit 1)lv on true left join public.franchise_mandate_versions v on v.id=f.current_mandate_version_id order by f.created_at desc,f.id limit 20001)page;
 elsif p_space='territoires'then
  select coalesce(jsonb_agg(item),'[]'::jsonb)into rows from(select jsonb_build_object('id',v.id,'title',f.operator_code||' · '||f.territory_code,'status',v.mandate_status,'organizationId',f.operator_organization_id,'cells',jsonb_build_array(case when p_locale='ar'then coalesce(lv.name_ar,l.code) else coalesce(lv.name_fr,l.code) end,f.territory_code,l.code,'v'||v.version,v.version::text,v.effective_from::date::text,coalesce(v.effective_until::date::text,'—'),v.mandate_status),'extras',jsonb_build_object('franchiseId',f.id::text,'type',f.franchise_type))item from public.franchises f join public.catalog_libraries l on l.id=f.library_id left join lateral(select name_fr,name_ar from public.catalog_library_versions where library_id=l.id order by version desc limit 1)lv on true join public.franchise_mandate_versions v on v.franchise_id=f.id order by v.created_at desc,v.id limit 20001)page;
 elsif p_space='gouvernance'then
  select coalesce(jsonb_agg(item),'[]'::jsonb)into rows from(select jsonb_build_object('id',r.id,'title',r.request_type,'status',r.status,'organizationId',f.operator_organization_id,'cells',jsonb_build_array(left(r.id::text,8),case when p_locale='ar'then coalesce(lv.name_ar,l.code) else coalesce(lv.name_fr,l.code) end,r.request_type,f.territory_code,r.row_version::text,r.status,r.status,coalesce(d.decision,'—')),'extras',jsonb_build_object('rowVersion',r.row_version::text,'reason',r.change_reason))item from public.franchise_approval_requests r join public.franchises f on f.id=r.franchise_id join public.catalog_libraries l on l.id=f.library_id left join lateral(select name_fr,name_ar from public.catalog_library_versions where library_id=l.id order by version desc limit 1)lv on true left join public.franchise_approval_decisions d on d.approval_request_id=r.id order by r.requested_at desc,r.id limit 20001)page;
 elsif p_space='litiges'then
  select coalesce(jsonb_agg(item),'[]'::jsonb)into rows from(select jsonb_build_object('id',c.id,'title',c.obligation_key,'status',c.status,'organizationId',c.client_organization_id,'cells',jsonb_build_array(left(c.id::text,8),left(c.mission_id::text,8),c.obligation_key,c.obligation_key,coalesce(cardinality(d.evidence_ids)::text,'—'),c.status,coalesce(r.status,'—'),coalesce(d.outcome,'—'),c.status),'extras',jsonb_build_object('missionId',c.mission_id::text,'policy',coalesce(c.policy_snapshot->>'version','—'),'statusCodes',coalesce(r.status,'')))item from public.dispute_cases c left join lateral(select*from public.dispute_decisions where dispute_case_id=c.id order by decision_number desc limit 1)d on true left join public.mission_reassignments r on r.dispute_case_id=c.id order by c.opened_at desc,c.id limit 20001)page;
 end if;
 if jsonb_array_length(rows)>20000 or octet_length(rows::text)>16777216 then raise exception'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
 return jsonb_build_object('rows',rows,'snapshotAt',statement_timestamp(),'complete',true);
end$$;
revoke all on function public.get_admin_special_space_snapshot_v1(text,text)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_special_space_snapshot_v1(text,text)to authenticated;
create or replace function public.get_admin_actor_directory_snapshot_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare rows jsonb:='[]';page jsonb;offset_value integer:=0;begin
 loop
  page:=public.list_admin_actor_directory_v1(500,offset_value,null);rows:=rows||(page->'rows');offset_value:=jsonb_array_length(rows);
  if offset_value>20000 or octet_length(rows::text)>16777216 then raise exception'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
  exit when offset_value>=(page->>'total')::integer;
  if jsonb_array_length(page->'rows')=0 then raise exception'INVALID_ADMIN_DIRECTORY_PAGE'using errcode='55000';end if;
 end loop;
 return jsonb_build_object('rows',rows,'total',offset_value);
end$$;
revoke all on function public.get_admin_actor_directory_snapshot_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_admin_actor_directory_snapshot_v1()to authenticated;
notify pgrst,'reload schema';
commit;
