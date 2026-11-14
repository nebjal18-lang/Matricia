begin;
set local search_path = public, extensions;
grant usage on schema extensions to authenticated, service_role;
select plan(6);

update private.admin_execution_environment_v1 set environment = 'DEVELOPMENT' where singleton;

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  'a3600000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'territoires-admin@example.invalid',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);
insert into public.platform_user_roles(user_id, role_code)
values ('a3600000-0000-4000-8000-000000000001', 'MATRICIA_ADMIN');

insert into public.organizations(id, legal_name, display_name, status, created_by)
values (
  'b3600000-0000-4000-8000-000000000001',
  'Territoires Org',
  'Territoires Org',
  'ACTIVE',
  'a3600000-0000-4000-8000-000000000001'
);

insert into public.catalog_libraries(id, code, slug, steward_organization_id, created_by)
values (
  'c3600000-0000-4000-8000-000000000001',
  'TERR_360',
  'terr-360',
  'b3600000-0000-4000-8000-000000000001',
  'a3600000-0000-4000-8000-000000000001'
);
insert into public.catalog_library_versions(
  id, library_id, version, status, name_fr, name_ar, description_fr, description_ar, icon_key, sort_order, change_reason, content_hash, created_by
) values (
  'c3600000-0000-4000-8001-000000000001',
  'c3600000-0000-4000-8000-000000000001',
  1,
  'DRAFT',
  'Informatique',
  'المعلوميات',
  'Bibliothèque de test territoires',
  'مكتبة اختبار الأقاليم',
  'library',
  1,
  'Fixture territoires queue',
  repeat('c', 64),
  'a3600000-0000-4000-8000-000000000001'
);

insert into public.franchises(id, library_id, operator_organization_id, franchise_type, operator_code, territory_code, status, created_by)
values (
  'd3600000-0000-4000-8000-000000000001',
  'c3600000-0000-4000-8000-000000000001',
  'b3600000-0000-4000-8000-000000000001',
  'STANDARD',
  'FRANCHISEE',
  'E2E_SOUSS_ZONE',
  'ACTIVE',
  'a3600000-0000-4000-8000-000000000001'
);
insert into public.franchise_territory_versions(
  id, franchise_id, version, territory_code, name_fr, name_ar, scope_snapshot, effective_from, content_hash, created_by
) values (
  'e3600000-0000-4000-8000-000000000001',
  'd3600000-0000-4000-8000-000000000001',
  1,
  'E2E_SOUSS_ZONE',
  'Souss-Massa',
  'سوس ماسة',
  '{}'::jsonb,
  timestamptz '2026-01-01',
  repeat('a', 64),
  'a3600000-0000-4000-8000-000000000001'
);
insert into public.franchise_mandate_versions(
  id, franchise_id, territory_version_id, economic_rule_version_id, version, mandate_status,
  rights_snapshot, obligations_snapshot, contract_snapshot,
  entry_fee_minor, entry_fee_mode, entry_fee_term_months,
  franchisee_share_bps, neoxa_share_bps, matricia_share_bps, distribution_basis,
  effective_from, effective_until, content_hash, created_by
) values (
  'f3600000-0000-4000-8000-000000000001',
  'd3600000-0000-4000-8000-000000000001',
  'e3600000-0000-4000-8000-000000000001',
  (select id from public.franchise_economic_rule_versions where franchise_type = 'STANDARD' order by version desc limit 1),
  1,
  'ACTIVE',
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  0,
  'UPFRONT',
  0,
  5000,
  2500,
  2500,
  'DISTRIBUTABLE_PROFIT',
  timestamptz '2026-11-08',
  timestamptz '2029-11-08',
  repeat('b', 64),
  'a3600000-0000-4000-8000-000000000001'
);
update public.franchises
set current_mandate_version_id = 'f3600000-0000-4000-8000-000000000001'
where id = 'd3600000-0000-4000-8000-000000000001';

create temporary table snap(v jsonb);
grant all on snap to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3600000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
insert into snap values (public.get_admin_special_space_snapshot_v1('territoires', 'fr'));
reset role;

select is(
  (select jsonb_array_length(v->'rows'->0->'cells') from snap),
  7,
  'territoires cells match the seven data columns'
);
select is(
  (select v->'rows'->0->'cells'->>6 from snap),
  'ACTIVE',
  'État carries mandate_status rather than effective_until'
);
select is(
  (select v->'rows'->0->'cells'->>5 from snap),
  '2029-11-08',
  'Fin keeps effective_until'
);
select is(
  (select v->'rows'->0->>'title' from snap),
  'Franchisé · Souss-Massa',
  'title uses human operator and territory labels'
);
select is(
  (select v->'rows'->0->'cells'->>2 from snap),
  'Informatique',
  'Bibliothèque uses the library version name'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a3600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select throws_ok(
  $$select public.get_admin_special_space_snapshot_v1('territoires','fr')$$,
  '42501',
  'ADMIN_EXPORT_SCOPE_DENIED',
  'AAL1 cannot read the territoires queue'
);

reset role;
select * from finish();
rollback;
