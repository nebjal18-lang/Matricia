begin;
-- The two original policies expanded each other during RLS planning, even for
-- a query with no rows. Resolve their relationships inside owner-definer boolean
-- predicates, always bound to the real active session and the exact row id.
create function private.volume_reservation_read_v1(p_reservation_id uuid)
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,private as $$
begin
 if auth.uid()is null or not private.current_auth_session_active_v1()then return false;end if;
 return exists(
  select 1 from public.service_reservations reservation
  where reservation.id=p_reservation_id and(
   private.is_active_org_member(reservation.client_organization_id)
   or private.volume_admin_access()
   or private.has_platform_role(array['READ_ONLY_AUDITOR'])
   or exists(
    select 1 from public.service_provider_allocations allocation
    where allocation.reservation_id=reservation.id
     and private.is_active_org_member(allocation.provider_organization_id)
   )
  )
 );
end$$;
create function private.volume_allocation_read_v1(p_allocation_id uuid)
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,private as $$
begin
 if auth.uid()is null or not private.current_auth_session_active_v1()then return false;end if;
 return exists(
  select 1 from public.service_provider_allocations allocation
  join public.service_reservations reservation on reservation.id=allocation.reservation_id
  where allocation.id=p_allocation_id and(
   private.is_active_org_member(allocation.provider_organization_id)
   or private.is_active_org_member(reservation.client_organization_id)
   or private.volume_admin_access()
   or private.has_platform_role(array['READ_ONLY_AUDITOR'])
  )
 );
end$$;
revoke all on function private.volume_reservation_read_v1(uuid),private.volume_allocation_read_v1(uuid)
from public,anon,authenticated,service_role;
-- RLS invokes these private helpers as the authenticated role. Their only
-- observable result is whether that actor can read the identified row.
grant execute on function private.volume_reservation_read_v1(uuid),private.volume_allocation_read_v1(uuid)
to authenticated;
alter policy reservations_scoped_read on public.service_reservations
using(private.volume_reservation_read_v1(id));
alter policy provider_allocations_scoped_read on public.service_provider_allocations
using(private.volume_allocation_read_v1(id));
notify pgrst,'reload schema';
commit;
