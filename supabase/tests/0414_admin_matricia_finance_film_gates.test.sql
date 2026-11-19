-- MATRICIA_ADMIN + AAL2 can open film finance helpers; SUPPORT_AGENT cannot.
begin;
select plan(8);

create temporary table film_gate_actors(kind text primary key, user_id uuid not null, session_id uuid not null);
insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a4140000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'matricia-admin-414@example.invalid', now(), '{}', '{}', now(), now()),
  ('a4140000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'support-414@example.invalid', now(), '{}', '{}', now(), now());
insert into auth.sessions(id, user_id, aal, created_at, updated_at)
values
  ('f4140000-0000-4000-8000-000000000001', 'a4140000-0000-4000-8000-000000000001', 'aal2', now(), now()),
  ('f4140000-0000-4000-8000-000000000002', 'a4140000-0000-4000-8000-000000000002', 'aal2', now(), now());
insert into public.platform_user_roles(user_id, role_code)
values
  ('a4140000-0000-4000-8000-000000000001', 'MATRICIA_ADMIN'),
  ('a4140000-0000-4000-8000-000000000002', 'SUPPORT_AGENT');
insert into film_gate_actors values
  ('admin', 'a4140000-0000-4000-8000-000000000001', 'f4140000-0000-4000-8000-000000000001'),
  ('support', 'a4140000-0000-4000-8000-000000000002', 'f4140000-0000-4000-8000-000000000002');

create function pg_temp.film_actor(p_kind text) returns void language plpgsql as $$
declare actor film_gate_actors%rowtype;
begin
  select * into actor from film_gate_actors where kind = p_kind;
  perform set_config('request.jwt.claim.sub', actor.user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', actor.user_id,
      'role', 'authenticated',
      'aal', 'aal2',
      'session_id', actor.session_id
    )::text,
    true
  );
end;
$$;

select pg_temp.film_actor('admin');
select ok(private.morocco_tax_admin((select user_id from film_gate_actors where kind = 'admin')), 'MATRICIA_ADMIN AAL2 is morocco tax admin');
select ok(private.service_tax_mapping_reviewer_v1(), 'MATRICIA_ADMIN AAL2 is service tax reviewer');
select ok(private.provider_finance_reviewer_v1(), 'MATRICIA_ADMIN AAL2 is provider finance reviewer');
select ok(private.client_billing_admin((select user_id from film_gate_actors where kind = 'admin')), 'MATRICIA_ADMIN AAL2 is client billing admin');
select ok(private.benefit_admission_staff_v1(), 'MATRICIA_ADMIN AAL2 is benefit admission staff');
select ok(private.manual_credit_finance_v1((select user_id from film_gate_actors where kind = 'admin')), 'MATRICIA_ADMIN AAL2 can run manual credit finance');

select pg_temp.film_actor('support');
select ok(not private.morocco_tax_admin((select user_id from film_gate_actors where kind = 'support')), 'SUPPORT_AGENT is not morocco tax admin');
select ok(not private.client_billing_admin((select user_id from film_gate_actors where kind = 'support')), 'SUPPORT_AGENT is not client billing admin');

select * from finish();
rollback;
