begin;
set local search_path = public, private, extensions;
grant usage on schema extensions to authenticated;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  ('a4020000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'identity-display-' || i || '@example.invalid',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
from generate_series(1, 3) i;

insert into public.platform_user_roles (user_id, role_code)
values
  ('a4020000-0000-4000-8000-000000000001', 'COMPLIANCE_MANAGER'),
  ('a4020000-0000-4000-8000-000000000002', 'READ_ONLY_AUDITOR'),
  ('a4020000-0000-4000-8000-000000000003', 'SUPPORT_AGENT');

insert into public.organizations (id, legal_name, display_name, country_code, status, created_by)
values (
  'b4020000-0000-4000-8000-000000000001',
  'Atlas Conseil SARL',
  'Atlas Conseil',
  'MA',
  'PENDING',
  'a4020000-0000-4000-8000-000000000001'
);

insert into public.organization_identifiers (
  organization_id, identifier_type, normalized_value, verification_status, is_active
)
values
  ('b4020000-0000-4000-8000-000000000001', 'ICE', '124020000000001', 'PENDING', true),
  ('b4020000-0000-4000-8000-000000000001', 'IF', '40212345', 'PENDING', true),
  ('b4020000-0000-4000-8000-000000000001', 'RC', 'RC402', 'PENDING', true);

insert into public.client_compliance_cases (
  id, organization_id, status, current_profile_version, created_by
)
values (
  'f4020000-0000-4000-8000-000000000001',
  'b4020000-0000-4000-8000-000000000001',
  'UNDER_REVIEW',
  1,
  'a4020000-0000-4000-8000-000000000001'
);

insert into public.client_profile_versions (
  compliance_case_id,
  organization_id,
  version,
  profile_data,
  organization_snapshot,
  source_organization_row_version,
  created_by
)
values (
  'f4020000-0000-4000-8000-000000000001',
  'b4020000-0000-4000-8000-000000000001',
  1,
  jsonb_build_object(
    'if_number', '40212345',
    'rc_number', 'RC402',
    'legal_form', 'SARL',
    'incorporation_date', '2020-02-20',
    'activity', 'Conseil',
    'sector', 'Services',
    'registered_city', 'Casablanca',
    'registered_address', jsonb_build_object(
      'line1', '10 rue Exemple',
      'city', 'Casablanca',
      'postal_code', '20000',
      'country_code', 'MA'
    ),
    'representative', jsonb_build_object(
      'first_name', 'Amal',
      'last_name', 'Alami',
      'title', 'Gérante',
      'email', 'amal@example.invalid',
      'phone', '+212600000001',
      'power', 'Gérante statutaire'
    )
  ),
  jsonb_build_object(
    'legal_name', 'Atlas Conseil SARL',
    'display_name', 'Atlas Conseil',
    'country_code', 'MA',
    'identifiers', jsonb_build_object(
      'ICE', '124020000000001',
      'IF', '40212345',
      'RC', 'RC402'
    )
  ),
  1,
  'a4020000-0000-4000-8000-000000000001'
);

create temporary table results (k text primary key, v jsonb);
grant all on results to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4020000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a4020000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
insert into results
values (
  'manager',
  public.get_client_identity_review_context_v1('f4020000-0000-4000-8000-000000000001')
);

select set_config('request.jwt.claim.sub', 'a4020000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a4020000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
insert into results
values (
  'auditor',
  public.get_client_identity_review_context_v1('f4020000-0000-4000-8000-000000000001')
);

select set_config('request.jwt.claim.sub', 'a4020000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a4020000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$select public.get_client_identity_review_context_v1('f4020000-0000-4000-8000-000000000001')$$,
  '42501',
  'CLIENT_IDENTITY_REVIEW_DENIED',
  'support agent cannot open identity review context'
);
reset role;

select is(
  (select v #>> '{profile_display,legal_form}' from results where k = 'manager'),
  'SARL',
  'context exposes legal form outside the hashed snapshot'
);
select is(
  (select v #>> '{profile_display,representative,title}' from results where k = 'manager'),
  'Gérante',
  'context exposes the authorized representative'
);
select is(
  (select v #>> '{profile_display,registered_address,line1}' from results where k = 'manager'),
  '10 rue Exemple',
  'context exposes registered address for ADM identity review'
);
select is(
  (select v #>> '{profile_display,display_name}' from results where k = 'manager'),
  'Atlas Conseil',
  'context exposes commercial display name'
);
select is(
  (select v->>'identity_hash' from results where k = 'manager'),
  (select private.canonical_request_hash(v->'identity_snapshot') from results where k = 'manager'),
  'identity_hash remains bound only to identity_snapshot'
);
select is(
  (select (v #>> '{profile_display,can_mutate}')::boolean from results where k = 'manager'),
  true,
  'compliance manager may mutate the review'
);
select is(
  (select (v #>> '{profile_display,can_mutate}')::boolean from results where k = 'auditor'),
  false,
  'read-only auditor receives display context without mutate rights'
);

select * from finish();
rollback;
