begin;
-- The bounded dashboard remains INVOKER. Its dynamic SQL cannot resolve private
-- names as an application role; narrowly scoped boolean APIs form that boundary.
create function private.assert_franchise_finance_public_read_v1()returns void
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid()is null or private.current_auth_session_active_v1()is distinct from true then raise exception'FRANCHISE_FINANCE_UNAUTHENTICATED'using errcode='42501';end if;
 if exists(select 1 from public.platform_user_roles role where role.user_id=auth.uid()and role.revoked_at is null and role.role_code in('SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'))then
  if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'FRANCHISE_FINANCE_MFA_REQUIRED'using errcode='42501';end if;
  if private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())is distinct from true then raise exception'FRANCHISE_FINANCE_READ_DENIED'using errcode='42501';end if;
 end if;
end$$;
revoke all on function private.assert_franchise_finance_public_read_v1()from public,anon,authenticated,service_role;

create function public.franchise_finance_book_binding_review_v1(p_book uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.assert_franchise_finance_public_read_v1();
 -- This helper independently checks the exact native book access predicate.
 return private.franchise_book_binding_review_required_v1(p_book);
end$$;
create function public.franchise_finance_book_matches_scope_v1(p_book uuid,p_franchise uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.assert_franchise_finance_public_read_v1();
 if private.franchise_access(p_franchise)is distinct from true then raise exception'FRANCHISE_BOOK_SCOPE_DENIED'using errcode='42501';end if;
 return private.franchise_book_matches_scope_v1(p_book,p_franchise);
end$$;
create function public.franchise_finance_scope_has_unbound_book_v1(p_franchise uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.assert_franchise_finance_public_read_v1();
 return private.franchise_scope_has_unbound_book_v1(p_franchise);
end$$;
revoke all on function public.franchise_finance_book_binding_review_v1(uuid),public.franchise_finance_book_matches_scope_v1(uuid,uuid),public.franchise_finance_scope_has_unbound_book_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.franchise_finance_book_binding_review_v1(uuid),public.franchise_finance_book_matches_scope_v1(uuid,uuid),public.franchise_finance_scope_has_unbound_book_v1(uuid)to authenticated;
-- These three helpers are implementation details, not application entry points.
revoke execute on function private.franchise_book_binding_review_required_v1(uuid),private.franchise_book_matches_scope_v1(uuid,uuid),private.franchise_scope_has_unbound_book_v1(uuid)from authenticated;

do $$declare definition text;old_name text;new_name text;begin
 definition:=pg_get_functiondef('public.franchise_governance_dashboard_snapshot(uuid)'::regprocedure);
 if(select prosecdef from pg_proc where oid='public.franchise_governance_dashboard_snapshot(uuid)'::regprocedure)then raise exception'FRANCHISE_DASHBOARD_INVOKER_REQUIRED';end if;
 for old_name,new_name in select*from(values
  ('private.franchise_book_binding_review_required_v1(','public.franchise_finance_book_binding_review_v1('),
  ('private.franchise_book_matches_scope_v1(','public.franchise_finance_book_matches_scope_v1('),
  ('private.franchise_scope_has_unbound_book_v1(','public.franchise_finance_scope_has_unbound_book_v1('))mapping(old_name,new_name)loop
  if strpos(definition,old_name)=0 then raise exception'FRANCHISE_DASHBOARD_READ_BOUNDARY_SOURCE_CHANGED: %',old_name;end if;
  definition:=replace(definition,old_name,new_name);
 end loop;
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
