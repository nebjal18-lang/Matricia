-- Lot 1 — A/B decision: refused self/missing vs authorized independent validator.
begin;
set local search_path = public, extensions;
select no_plan();
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('a1ab0000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'lot1-admin-' || i || '@example.invalid', '', now(), '{}', '{}', now(), now()
from generate_series(1, 3) i;

insert into public.organizations(id, legal_name, display_name, status, created_by)
values ('b1ab0000-0000-4000-8000-000000000001', 'Lot1 AB Org', 'Lot1 AB Org', 'ACTIVE', 'a1ab0000-0000-4000-8000-000000000001');

insert into public.platform_user_roles(user_id, role_code) values
  ('a1ab0000-0000-4000-8000-000000000001', 'MATRICIA_ADMIN'),
  ('a1ab0000-0000-4000-8000-000000000002', 'MATRICIA_ADMIN'),
  ('a1ab0000-0000-4000-8000-000000000003', 'MATRICIA_ADMIN');

-- Two identifiable PENDING requests A and B created by requester #1.
insert into public.admin_operational_action_requests(
  id, organization_id, action_type, target_environment, resource_type, resource_id,
  request_payload_hash, redacted_summary, reason, approvals_required, status, requested_by
) values
(
  'c1ab0000-0000-4000-8000-00000000000a',
  'b1ab0000-0000-4000-8000-000000000001',
  'ASSIGN_CASE', 'DEVELOPMENT', 'organization', 'lot1-resource-A',
  repeat('a', 64), '{"label":"A"}'::jsonb,
  'Lot1 request A pending independent validation', 1, 'PENDING_APPROVAL',
  'a1ab0000-0000-4000-8000-000000000001'
),
(
  'c1ab0000-0000-4000-8000-00000000000b',
  'b1ab0000-0000-4000-8000-000000000001',
  'ASSIGN_CASE', 'DEVELOPMENT', 'organization', 'lot1-resource-B',
  repeat('b', 64), '{"label":"B"}'::jsonb,
  'Lot1 request B pending independent validation', 1, 'PENDING_APPROVAL',
  'a1ab0000-0000-4000-8000-000000000001'
);

create temporary table lot1_observed(k text primary key, v jsonb);
grant select, insert on lot1_observed to authenticated;

-- Case refused: requester cannot self-approve B.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1ab0000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1ab0000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $q$select public.decide_admin_operational_action('c1ab0000-0000-4000-8000-00000000000b','APPROVE','Self approve must stay denied',1,'lot1-self-deny-b')$q$,
  '42501',
  'ADMIN_ACTION_DECISION_DENIED',
  'requester self-approve on B is denied'
);
-- Synthetic / missing id (demo hub style) is also denied.
select throws_ok(
  $q$select public.decide_admin_operational_action('72afb969-56bf-407d-89b9-11405d862e2d','APPROVE','Demo synthetic id must stay denied',1,'lot1-demo-synth-deny')$q$,
  '42501',
  'ADMIN_ACTION_DECISION_DENIED',
  'missing synthetic action id is denied'
);
reset role;

select is(
  (select status from public.admin_operational_action_requests where id = 'c1ab0000-0000-4000-8000-00000000000a'),
  'PENDING_APPROVAL',
  'A unchanged after refused attempts'
);
select is(
  (select status from public.admin_operational_action_requests where id = 'c1ab0000-0000-4000-8000-00000000000b'),
  'PENDING_APPROVAL',
  'B unchanged after refused attempts'
);
select is(
  (select count(*)::int from public.admin_operational_action_decisions where action_request_id in (
    'c1ab0000-0000-4000-8000-00000000000a', 'c1ab0000-0000-4000-8000-00000000000b'
  )),
  0,
  'no decision rows after refused attempts'
);

-- Case authorized: independent validator #2 decides B only.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1ab0000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a1ab0000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
insert into lot1_observed
select 'decide-b', public.decide_admin_operational_action(
  'c1ab0000-0000-4000-8000-00000000000b', 'APPROVE', 'Independent validator approves B only', 1, 'lot1-auth-approve-b'
);
reset role;

select is((select v->>'outcome' from lot1_observed where k = 'decide-b'), 'ADMIN_ACTION_AUTHORIZED', 'B authorized by independent validator');
select is((select status from public.admin_operational_action_requests where id = 'c1ab0000-0000-4000-8000-00000000000a'), 'PENDING_APPROVAL', 'A remains pending');
select is((select status from public.admin_operational_action_requests where id = 'c1ab0000-0000-4000-8000-00000000000b'), 'AUTHORIZED', 'only B becomes AUTHORIZED');
select is(
  (select decided_by::text from public.admin_operational_action_decisions where action_request_id = 'c1ab0000-0000-4000-8000-00000000000b'),
  'a1ab0000-0000-4000-8000-000000000002',
  'decision author is the independent validator'
);
select is(
  (select count(*)::int from public.admin_operational_action_decisions where action_request_id = 'c1ab0000-0000-4000-8000-00000000000a'),
  0,
  'A has no decision row'
);
select ok(
  exists(
    select 1 from public.audit_events
    where resource_id = 'c1ab0000-0000-4000-8000-00000000000b'
      and action = 'admin.action.decided'
      and actor_user_id = 'a1ab0000-0000-4000-8000-000000000002'
  ),
  'audit journal names B and the independent validator'
);

select * from finish();
rollback;
