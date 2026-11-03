-- Purpose-bound mission projection: a multi-mandate actor's other readable missions
-- never enter the selected library. This grants no broad mission or organization RLS.
create function public.franchise_operational_missions_v1(p_franchise_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype; result jsonb;
begin
 if auth.uid() is null or not private.active_franchise_messaging_scope(p_franchise_id) then
  raise exception 'FRANCHISE_OPERATIONS_SCOPE_DENIED' using errcode='42501';
 end if;
 select * into f from public.franchises where id=p_franchise_id;
 select jsonb_build_object('complete',true,'franchiseId',f.id,'libraryId',f.library_id,
  'missions',coalesce(jsonb_agg(jsonb_build_object('id',m.id,'status',m.status,'started_at',m.started_at)order by m.created_at desc,m.id),'[]'::jsonb)) into result
 from public.missions m
 join public.contract_versions cv on cv.id=m.contract_version_id
 join public.quote_versions qv on qv.id=cv.selected_quote_version_id
 join public.rfqs rfq on rfq.id=qv.rfq_id
 join public.service_requests request on request.id=rfq.request_id and request.library_id=f.library_id;
 return result;
end$$;
revoke all on function public.franchise_operational_missions_v1(uuid) from public,anon,service_role;
grant execute on function public.franchise_operational_missions_v1(uuid) to authenticated;
