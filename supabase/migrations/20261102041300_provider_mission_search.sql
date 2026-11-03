begin;
-- Search the frozen title before pagination; RLS still decides every row.
create function public.search_provider_missions_v1(p_organization_id uuid,p_search text,p_page integer default 1)returns setof public.missions language plpgsql stable security invoker set search_path=pg_catalog,public,private as $$
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_TECHNICIAN','PROVIDER_VIEWER'],auth.uid())then raise exception'MISSION_READ_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or p_search is null or length(p_search)>200 then raise exception'INVALID_MISSION_SEARCH'using errcode='22023';end if;
 return query select m.* from public.missions m join public.contract_versions v on v.id=m.contract_version_id
 where m.provider_organization_id=p_organization_id and(position(lower(btrim(p_search))in lower(concat_ws(' ',v.request_snapshot->>'description',v.request_snapshot->>'title',m.id::text)))>0)
 order by m.updated_at desc,m.id desc offset(p_page-1)*100 limit 101;
end$$;
revoke all on function public.search_provider_missions_v1(uuid,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.search_provider_missions_v1(uuid,text,integer)to authenticated;

create function public.get_provider_mission_counts_v1(p_organization_id uuid)returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public,private as $$
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_TECHNICIAN','PROVIDER_VIEWER'],auth.uid())then raise exception'MISSION_READ_DENIED'using errcode='42501';end if;
 return jsonb_build_object('active_missions',(select count(*)from public.missions m where m.provider_organization_id=p_organization_id and m.status not in('COMPLETED','CANCELLED')),
 'deliverables_due',(select count(*)from public.deliverables d join public.missions m on m.id=d.mission_id where m.provider_organization_id=p_organization_id and m.status not in('COMPLETED','CANCELLED')and d.status in('PENDING','REJECTED'))+
 (select count(*)from public.mission_milestones s join public.missions m on m.id=s.mission_id where m.provider_organization_id=p_organization_id and m.status not in('COMPLETED','CANCELLED')and s.status in('PENDING','IN_PROGRESS','SUBMITTED','REJECTED')and s.due_at<=current_timestamp+interval'7 days'));
end$$;
revoke all on function public.get_provider_mission_counts_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_provider_mission_counts_v1(uuid)to authenticated;

commit;
