-- Align film finance surfaces with MATRICIA_ADMIN (AAL2), matching SUPER_ADMIN|FINANCE_MANAGER.
-- Four-eyes independence (author ≠ reviewer) remains enforced by each command.
begin;

create or replace function private.morocco_tax_admin(p_actor uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select p_actor is not null
    and p_actor = auth.uid()
    and private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER'], p_actor)
    and coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;

create or replace function private.service_tax_mapping_reviewer_v1()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select auth.uid() is not null
    and auth.jwt()->>'aal' = 'aal2'
    and private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER'], auth.uid())
$$;

create or replace function private.provider_finance_reviewer_v1()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(
    auth.uid() is not null
      and auth.jwt()->>'aal' = 'aal2'
      and private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER'], auth.uid()),
    false
  )
$$;

create or replace function private.client_billing_admin(p_actor uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select p_actor is not null
    and coalesce(auth.jwt()->>'aal', '') = 'aal2'
    and private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER'], p_actor)
$$;

create or replace function private.benefit_admission_staff_v1()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select auth.uid() is not null
    and auth.jwt()->>'aal' = 'aal2'
    and private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER'])
$$;

create or replace function private.manual_credit_finance_v1(p_actor uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select auth.uid() is not null
    and auth.jwt()->>'aal' = 'aal2'
    and private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER'], p_actor)
$$;

create or replace function private.subscription_credit_retry_write_access_v1(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER'], p_actor)
    and not private.has_platform_role(array['READ_ONLY_AUDITOR'], p_actor)
$$;

create or replace function public.get_subscription_credit_worker_operations_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
begin
  if auth.uid() is null
    or auth.jwt()->>'aal' is distinct from 'aal2'
    or not private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER', 'READ_ONLY_AUDITOR'], auth.uid())
  then
    raise exception 'SC_OPERATIONS_DENIED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'can_act', private.subscription_credit_retry_write_access_v1(auth.uid()),
    'requests', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]')
      from (
        select id, job_id, source_hash, status, reason, requested_by <> auth.uid() as can_review
        from private.subscription_credit_retry_requests_v1
        where status = 'PENDING'
        order by requested_at, id
        limit 100
      ) x
    ),
    'counts', (
      select coalesce(jsonb_object_agg(state, n), '{}')
      from (
        select state, count(*)::text as n
        from private.subscription_credit_jobs_v1
        group by state
      ) x
    ),
    'jobs', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]')
      from (
        select j.id, j.payment_event_id::text, j.organization_id, j.month_index, j.state, j.attempt_count, j.due_at, j.last_error_code, s.source_hash
        from private.subscription_credit_jobs_v1 j
        join private.subscription_credit_schedules_v1 s using (payment_event_id)
        where j.state not in ('COMPLETED', 'EXPIRED')
        order by j.due_at, j.id
        limit 100
      ) x
    )
  );
end;
$$;

revoke all on function private.morocco_tax_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function private.morocco_tax_admin(uuid) to authenticated;
revoke all on function private.service_tax_mapping_reviewer_v1() from public, anon, authenticated, service_role;
revoke all on function private.provider_finance_reviewer_v1() from public, anon, authenticated, service_role;
revoke all on function private.client_billing_admin(uuid) from public, anon, authenticated, service_role;
revoke all on function private.benefit_admission_staff_v1() from public, anon, authenticated, service_role;
revoke all on function private.manual_credit_finance_v1(uuid) from public, anon, authenticated, service_role;
revoke all on function private.subscription_credit_retry_write_access_v1(uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_subscription_credit_worker_operations_v1() from public, anon, authenticated, service_role;
grant execute on function public.get_subscription_credit_worker_operations_v1() to authenticated;

notify pgrst, 'reload schema';
commit;
