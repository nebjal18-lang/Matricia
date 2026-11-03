begin;
-- A Finance identity without a current assurance claim is not an MFA reviewer.
-- Existing command authorization, independence, idempotency and audit stay intact.
create or replace function private.provider_finance_reviewer_v1()returns boolean
language sql stable security definer set search_path=pg_catalog,private as $$
 select coalesce(auth.uid()is not null and auth.jwt()->>'aal'='aal2'
  and private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid()),false)
$$;
revoke all on function private.provider_finance_reviewer_v1()from public,anon,authenticated,service_role;
commit;
