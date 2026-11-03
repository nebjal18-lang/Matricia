begin;
-- Pending organizations retain onboarding membership. Suspension and archive
-- revoke tenant capabilities immediately, including existing authenticated JWTs.
create or replace function private.is_active_org_member(target_organization_id uuid,target_user_id uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id and o.status in('PENDING','ACTIVE')where m.organization_id=target_organization_id and m.user_id=target_user_id and m.status='ACTIVE')
$$;
create or replace function private.has_org_role(target_organization_id uuid,allowed_roles text[],target_user_id uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id and o.status in('PENDING','ACTIVE')join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null where m.organization_id=target_organization_id and m.user_id=target_user_id and m.status='ACTIVE'and r.role_code=any(allowed_roles))
$$;
do $$declare definition text;begin
 select pg_get_functiondef('private.has_franchise_role(uuid,text[],uuid)'::regprocedure)into definition;
 if strpos(definition,'from public.franchises f join public.franchise_mandate_versions')=0 then raise exception'FRANCHISE_ORGANIZATION_LIFECYCLE_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'from public.franchises f join public.franchise_mandate_versions','from public.franchises f join public.organizations org on org.id=f.operator_organization_id and org.status in(''PENDING'',''ACTIVE'') join public.franchise_mandate_versions');
 execute definition;
 select pg_get_functiondef('private.grant_franchise_role_assignment_v1(uuid,text,uuid,uuid,uuid)'::regprocedure)into definition;
 definition:=replace(definition,'if m.id is null or m.status<>''ACTIVE''', 'if not exists(select 1 from public.organizations where id=m.organization_id and status in(''PENDING'',''ACTIVE'')) or m.id is null or m.status<>''ACTIVE''');
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
