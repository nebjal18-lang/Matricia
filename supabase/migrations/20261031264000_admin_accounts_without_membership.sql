begin;
-- Account identity and tenant membership are separate facts. A central account
-- without a tenant has real NULL membership fields, never an invented tenant.
create or replace function public.list_admin_actor_directory_v1(
 p_limit integer default 100,p_offset integer default 0,p_user_id uuid default null
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare result jsonb;total bigint;
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2'
 or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR']) then
  raise exception 'ADMIN_ACTOR_DIRECTORY_DENIED' using errcode='42501';
 end if;
 if p_limit is null or p_limit not between 1 and 500 or p_offset is null or p_offset<0 then
  raise exception 'INVALID_ADMIN_DIRECTORY_PAGE' using errcode='22023';
 end if;
 select count(*) into total from auth.users u
 left join public.organization_memberships m on m.user_id=u.id
 where p_user_id is null or u.id=p_user_id;
 select coalesce(jsonb_agg(to_jsonb(item) order by item.user_id,item.membership_id nulls first),'[]') into result from (
  select u.id user_id,m.id membership_id,m.organization_id,o.display_name organization_name,
   p.display_name,u.email,
   case when u.deleted_at is not null then 'DELETED'
    when u.banned_until>statement_timestamp() then 'SUSPENDED'
    when u.email_confirmed_at is null and u.phone_confirmed_at is null then 'PENDING_CONFIRMATION'
    else 'ACTIVE' end account_status,
   coalesce(m.status,case when u.deleted_at is not null then 'DELETED'
    when u.banned_until>statement_timestamp() then 'SUSPENDED'
    when u.email_confirmed_at is null and u.phone_confirmed_at is null then 'PENDING_CONFIRMATION'
    else 'ACTIVE' end) status,
   coalesce(m.updated_at,u.updated_at) updated_at,u.last_sign_in_at,
   coalesce((select array_agg(r.role_code order by r.role_code) from public.organization_member_roles r
    where r.membership_id=m.id and r.revoked_at is null),'{}') roles,
   coalesce((select array_agg(r.role_code order by r.role_code) from public.platform_user_roles r
    where r.user_id=u.id and r.revoked_at is null),'{}') platform_roles,
   case when exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified')
    then 'ENABLED' else 'DISABLED' end mfa_status,
   (select count(*)::integer from auth.sessions s where s.user_id=u.id) session_count
  from auth.users u left join public.user_profiles p on p.id=u.id
  left join public.organization_memberships m on m.user_id=u.id
  left join public.organizations o on o.id=m.organization_id
  where p_user_id is null or u.id=p_user_id
  order by u.id,m.id nulls first limit p_limit offset p_offset
 ) item;
 return jsonb_build_object('rows',result,'total',total);
end $$;
revoke all on function public.list_admin_actor_directory_v1(integer,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_admin_actor_directory_v1(integer,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
