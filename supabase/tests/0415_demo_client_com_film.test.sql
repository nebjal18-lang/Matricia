-- Deterministic Client COM film seed: draft + 2 quotes + active mission, no disputes.

begin;
select plan(6);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('a4150000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','film415.client@matricia.test','x',now(),'{"matricia_demo":true}'::jsonb,'{}'::jsonb,now(),now()),
 ('a4150000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','film415.pa@matricia.test','x',now(),'{"matricia_demo":true}'::jsonb,'{}'::jsonb,now(),now()),
 ('a4150000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','film415.pb@matricia.test','x',now(),'{"matricia_demo":true}'::jsonb,'{}'::jsonb,now(),now());

insert into public.organizations(id,legal_name,display_name,status,created_by) values
 ('b4150000-0000-4000-8000-000000000001','Film415 Client SARL','Film415 Client','ACTIVE','a4150000-0000-4000-8000-000000000001'),
 ('b4150000-0000-4000-8000-000000000002','Film415 PA SARL','Film415 PA','ACTIVE','a4150000-0000-4000-8000-000000000002'),
 ('b4150000-0000-4000-8000-000000000003','Film415 PB SARL','Film415 PB','ACTIVE','a4150000-0000-4000-8000-000000000003');

insert into private.demo_workspace_organizations_v1(organization_id,persona,territory_code,slot,email) values
 ('b4150000-0000-4000-8000-000000000001','client','TANGER_TETOUAN_AL_HOCEIMA','1','film415.client@matricia.test'),
 ('b4150000-0000-4000-8000-000000000002','provider','TANGER_TETOUAN_AL_HOCEIMA','A','film415.pa@matricia.test'),
 ('b4150000-0000-4000-8000-000000000003','provider','TANGER_TETOUAN_AL_HOCEIMA','B','film415.pb@matricia.test');

select set_config('request.jwt.claim.role', 'service_role', true);

select ok(
  (select (public.ensure_demo_client_com_film_v1(
    'b4150000-0000-4000-8000-000000000001',
    'a4150000-0000-4000-8000-000000000001',
    'b4150000-0000-4000-8000-000000000002',
    'a4150000-0000-4000-8000-000000000002',
    'b4150000-0000-4000-8000-000000000003',
    'a4150000-0000-4000-8000-000000000003'
  )->>'dispute_count')::int = 0),
  'film seed returns zero disputes'
);

select is(
  (select count(*)::int from public.service_requests where client_organization_id='b4150000-0000-4000-8000-000000000001' and status='DRAFT'),
  1,
  'one draft request'
);

select is(
  (select count(*)::int from public.service_requests where client_organization_id='b4150000-0000-4000-8000-000000000001' and status='QUOTES_RECEIVED'),
  1,
  'one quotes-received request'
);

select is(
  (select count(*)::int
     from public.quotes q
     join public.rfqs r on r.id=q.rfq_id
     join public.service_requests sr on sr.id=r.request_id
    where sr.client_organization_id='b4150000-0000-4000-8000-000000000001'
      and sr.status='QUOTES_RECEIVED'
      and q.status='SUBMITTED'),
  2,
  'two submitted quotes on the quotes stage'
);

select is(
  (select count(*)::int from public.missions where client_organization_id='b4150000-0000-4000-8000-000000000001' and status='ACTIVE'),
  1,
  'one active mission'
);

select ok(
  (select (public.ensure_demo_client_com_film_v1(
    'b4150000-0000-4000-8000-000000000001',
    'a4150000-0000-4000-8000-000000000001',
    'b4150000-0000-4000-8000-000000000002',
    'a4150000-0000-4000-8000-000000000002',
    'b4150000-0000-4000-8000-000000000003',
    'a4150000-0000-4000-8000-000000000003'
  )->>'mission_id') is not null),
  'film seed is idempotent'
);

select * from finish();
rollback;
