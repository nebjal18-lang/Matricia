begin;
-- Repair absurd historical due_at on open admin work items (corrupt/demo seeds).
-- Official open_admin_work_item already rejects past due dates; direct inserts could not.

create or replace function private.repair_admin_work_item_due_hygiene_v1()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare repaired_count integer := 0;
begin
  with repaired as (
    update public.admin_work_items
    set due_at = clock_timestamp() + interval '2 days',
        row_version = row_version + 1,
        updated_at = clock_timestamp()
    where status in ('OPEN', 'CLAIMED', 'WAITING_INFORMATION')
      and due_at < timestamptz '2024-01-01 00:00:00+00'
    returning id, status, created_by, due_at
  ),
  logged as (
    insert into public.admin_work_item_events(
      work_item_id, event_type, from_status, to_status, actor_user_id, reason, evidence_snapshot, correlation_id
    )
    select
      repaired.id,
      'DUE_DATE_REPAIRED',
      repaired.status,
      repaired.status,
      repaired.created_by,
      'Hygiene: échéance absurde (antérieure à 2024) recalée à J+2.',
      jsonb_build_object('repaired_due_at', repaired.due_at, 'rule', 'due_at_before_2024'),
      extensions.gen_random_uuid()
    from repaired
    returning work_item_id
  )
  select count(*)::integer into repaired_count from logged;
  return repaired_count;
end;
$$;

revoke all on function private.repair_admin_work_item_due_hygiene_v1() from public, anon, authenticated;
grant execute on function private.repair_admin_work_item_due_hygiene_v1() to service_role;

select private.repair_admin_work_item_due_hygiene_v1();

commit;
