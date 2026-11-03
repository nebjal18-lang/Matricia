begin;
alter function public.list_admin_supervision_page_v1(integer,integer)rename to list_admin_supervision_before_facts_v1;
revoke all on function public.list_admin_supervision_before_facts_v1(integer,integer)from public,anon,authenticated,service_role;
create function public.list_admin_supervision_page_v1(p_limit integer default 100,p_offset integer default 0)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;rows jsonb;
begin
 result:=public.list_admin_supervision_before_facts_v1(p_limit,p_offset);
 select coalesce(jsonb_agg(item||jsonb_build_object('version_number',v.version_number,'currency',v.currency,'subtotal_minor',v.subtotal_minor::text,'tax_minor',v.tax_minor::text,'total_minor',v.total_minor::text,'duration_days',v.duration_days,'valid_until',v.valid_until)),'[]')into rows from jsonb_array_elements(result->'quotes')item join public.quotes q on q.id=(item->>'id')::uuid left join public.quote_versions v on v.id=q.current_version_id;
 result:=jsonb_set(result,'{quotes}',rows);
 select coalesce(jsonb_agg(item),'[]')into rows from(select jsonb_build_object('id',m.id,'mission_id',m.mission_id,'milestone_key',m.milestone_key,'title_fr',m.title_fr,'title_ar',m.title_ar,'status',m.status,'organization_id',mission.client_organization_id,'owner_name',o.display_name,'due_at',m.due_at,'deliverable_count',(select count(*)from public.deliverables d where d.milestone_id=m.id),'proof_count',(select count(*)from public.delivery_proofs p join public.delivery_versions v on v.id=p.delivery_version_id join public.deliverables d on d.id=v.deliverable_id where d.milestone_id=m.id))item from public.mission_milestones m join public.missions mission on mission.id=m.mission_id join public.organizations o on o.id=m.owner_organization_id order by m.due_at nulls last,m.id limit greatest(1,least(coalesce(p_limit,100),500))offset greatest(coalesce(p_offset,0),0))page;
 return result||jsonb_build_object('milestones',rows);
end$$;
revoke all on function public.list_admin_supervision_page_v1(integer,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_admin_supervision_page_v1(integer,integer)to authenticated;
notify pgrst,'reload schema';
commit;
