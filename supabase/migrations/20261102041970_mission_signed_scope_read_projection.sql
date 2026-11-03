begin;
-- Read an operational presentation state without granting private-schema access
-- or exposing missions beyond the exact existing mission-party read authority.
create function public.get_mission_signed_scope_states_v1(p_mission_ids uuid[])
returns table(mission_id uuid,signed_scope_pending boolean)
language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
begin
 if auth.uid()is null then
  raise exception'MISSION_SCOPE_STATE_READ_DENIED'using errcode='42501';
 end if;
 if p_mission_ids is null or coalesce(array_ndims(p_mission_ids),0)<>1
 or cardinality(p_mission_ids)not between 1 and 100 then
  raise exception'INVALID_MISSION_SCOPE_STATE_IDS'using errcode='22023';
 end if;
 if array_position(p_mission_ids,null)is not null
 or cardinality(p_mission_ids)<>(select count(distinct requested.id)from unnest(p_mission_ids)requested(id))then
  raise exception'INVALID_MISSION_SCOPE_STATE_IDS'using errcode='22023';
 end if;
 -- As with the mission RLS, unknown or unauthorized IDs produce no row. The
 -- application must require one result per previously authorized mission ID.
 return query
 select m.id,private.mission_scope_pending_v1(m.id)
 from unnest(p_mission_ids)with ordinality requested(id,position)
 join public.missions m on m.id=requested.id
 where private.mission_party_access(m.id,auth.uid())
 order by requested.position;
end$$;
revoke all on function public.get_mission_signed_scope_states_v1(uuid[])from public,anon,authenticated,service_role;
grant execute on function public.get_mission_signed_scope_states_v1(uuid[])to authenticated;
notify pgrst,'reload schema';
commit;
