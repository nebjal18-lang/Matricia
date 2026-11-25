begin;
set local search_path=public,extensions,private;
select plan(7);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values(
  'a4000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin400@example.invalid',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);
insert into public.platform_user_roles(user_id,role_code)
values('a4000000-0000-4000-8000-000000000001','MATRICIA_ADMIN');

insert into public.admin_work_items(
  id,queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,status,due_at,resolution_code,created_by
)
select
  'd4000000-0000-4000-8000-000000000001',
  id,
  null,
  'EXCEPTION',
  'case',
  'legacy-due-400-open',
  'Échéance absurde à réparer',
  'موعد غير صالح للإصلاح',
  'HIGH',
  'OPEN',
  timestamptz '1998-09-15 10:00:00+00',
  null,
  'a4000000-0000-4000-8000-000000000001'
from public.admin_queue_versions
where queue_key='EXCEPTIONS' and status='ACTIVE';

insert into public.admin_work_items(
  id,queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,status,due_at,resolution_code,resolution_reason,created_by
)
select
  'd4000000-0000-4000-8000-000000000002',
  id,
  null,
  'EXCEPTION',
  'case',
  'legacy-due-400-closed',
  'Échéance absurde déjà close',
  'موعد غير صالح مغلق',
  'HIGH',
  'RESOLVED',
  timestamptz '1998-09-15 10:00:00+00',
  'COMPLETED',
  'Dossier déjà traité avant hygiene.',
  'a4000000-0000-4000-8000-000000000001'
from public.admin_queue_versions
where queue_key='EXCEPTIONS' and status='ACTIVE';

select is(
  private.repair_admin_work_item_due_hygiene_v1(),
  1,
  'hygiene repairs exactly one open absurd due_at'
);

select ok(
  (select due_at > timestamptz '2024-01-01 00:00:00+00' from public.admin_work_items where id='d4000000-0000-4000-8000-000000000001'),
  'open absurd due_at is repaired above 2024'
);
select ok(
  (select due_at > clock_timestamp() from public.admin_work_items where id='d4000000-0000-4000-8000-000000000001'),
  'repaired open due_at is in the future'
);
select is(
  (select due_at from public.admin_work_items where id='d4000000-0000-4000-8000-000000000002'),
  timestamptz '1998-09-15 10:00:00+00',
  'closed items with absurd due_at stay untouched'
);
select is(
  (select count(*)::integer from public.admin_work_item_events where work_item_id='d4000000-0000-4000-8000-000000000002' and event_type='DUE_DATE_REPAIRED'),
  0,
  'closed items emit no hygiene event'
);
select ok(
  (
    select to_status is not null
       and from_status = to_status
       and from_status = 'OPEN'
    from public.admin_work_item_events
    where work_item_id='d4000000-0000-4000-8000-000000000001'
      and event_type='DUE_DATE_REPAIRED'
  ),
  'hygiene event keeps non-null to_status equal to from_status'
);
select is(
  (select count(*)::integer from public.admin_work_item_events where work_item_id='d4000000-0000-4000-8000-000000000001' and event_type='DUE_DATE_REPAIRED'),
  1,
  'open repair emits one immutable work event'
);

select * from finish();
rollback;
