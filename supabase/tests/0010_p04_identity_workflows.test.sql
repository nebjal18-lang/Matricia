begin;
set local search_path=public,extensions;
select plan(30);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('91000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p04-owner@example.invalid','',now(),'{}','{"full_name":"Propriétaire P04","preferred_locale":"ar-MA"}',now(),now()),
('91000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p04-requester@example.invalid','',now(),'{}','{}',now(),now()),
('91000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p04-invitee@example.invalid','',now(),'{}','{}',now(),now()),
('91000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p04-outsider@example.invalid','',now(),'{}','{}',now(),now());

select is((select display_name from public.user_profiles where id='91000000-0000-0000-0000-000000000001'),'Propriétaire P04','auth user creation creates the minimal profile');
select is((select preferred_locale from public.user_profiles where id='91000000-0000-0000-0000-000000000001'),'ar-MA','the supported Arabic locale is preserved');
select is((select display_name from public.user_profiles where id='91000000-0000-0000-0000-000000000002'),'Utilisateur','missing profile metadata receives a non-secret neutral name');

create temporary table p04_observed(key text primary key,value text);
grant select,insert,update on p04_observed to authenticated,service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
insert into p04_observed values('create_first',public.create_or_request_organization('P04 Société SARL','P04 Société','00 123-456 789-0000','CLIENT_OWNER','p04-create-owner-key')::text);
insert into p04_observed values('create_retry',public.create_or_request_organization('P04 Société SARL','P04 Société','001234567890000','CLIENT_OWNER','p04-create-owner-key')::text);
reset role;

select is((select (value::jsonb)->>'outcome' from p04_observed where key='create_first'),'ORGANIZATION_CREATED','a new active ICE creates one organization passport');
select is((select value from p04_observed where key='create_retry'),(select value from p04_observed where key='create_first'),'organization creation is idempotent');
select is((select count(*) from public.organizations where legal_name='P04 Société SARL'),1::bigint,'idempotent retry creates no duplicate organization');
select is((select normalized_value::text from public.organization_identifiers where organization_id=((select value::jsonb->>'organization_id' from p04_observed where key='create_first')::uuid)),'001234567890000','ICE is normalized before persistence');

select throws_ok(
  $$insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)
    values(((select value::jsonb->>'organization_id' from p04_observed where key='create_first')::uuid),'ICE','00-123-456-789-0000','UNVERIFIED',true)$$,
  '23505',null,'an active ICE cannot identify two active records even before verification'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p04_observed values('join_request',public.create_or_request_organization('Ignored Legal','Ignored Display','001234567890000','CLIENT_OWNER','p04-request-access-key')::text);
reset role;
select is((select value::jsonb->>'outcome' from p04_observed where key='join_request'),'ACCESS_REQUESTED','an existing ICE creates an explicit access request');
select is((select count(*) from public.organization_memberships where user_id='91000000-0000-0000-0000-000000000002'),0::bigint,'access request never silently creates or merges a membership');

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.decide_organization_join_v1((select (value::jsonb->>'request_id')::uuid from p04_observed where key='join_request'),true,1,(public.get_organization_join_workspace_v1(null,1)->'review_requests'->0->>'request_hash'),'Vérification propriétaire de la fixture','p04-explicit-owner-decision');
reset role;
select is((select status from public.organization_memberships where user_id='91000000-0000-0000-0000-000000000002'),'ACTIVE','authorized owner approval activates the requested membership');
select is((select count(*) from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.user_id='91000000-0000-0000-0000-000000000002' and r.revoked_at is null),1::bigint,'approved access grants only the explicitly requested role');
select is((select r.role_code from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.user_id='91000000-0000-0000-0000-000000000002' and r.revoked_at is null),'CLIENT_VIEWER','legacy ICE collision grants Viewer only after explicit owner decision, never implicit Owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
insert into p04_observed values('invitation_id',(public.invite_organization_member_by_email(
  ((select value::jsonb->>'organization_id' from p04_observed where key='create_first')::uuid),
  'p04-invitee@example.invalid',array['CLIENT_ADMIN','CLIENT_BUYER'],clock_timestamp()+interval '1 day',
  'p04-identity-invite-key'
)->>'invitation_id'));
reset role;
select is((select count(*) from public.organization_invitation_roles where invitation_id=(select value::uuid from p04_observed where key='invitation_id')),2::bigint,'one invitation carries multiple explicit organization roles');

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","email":"p04-invitee@example.invalid","role":"authenticated"}',true);
select public.accept_organization_invitation((select value::uuid from p04_observed where key='invitation_id'));
reset role;
select is((select status from public.organization_invitations where id=(select value::uuid from p04_observed where key='invitation_id')),'ACCEPTED','only the invited identity can accept an active invitation');
select is((select count(*) from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.user_id='91000000-0000-0000-0000-000000000003' and r.revoked_at is null),2::bigint,'acceptance accumulates every invited role on one membership');

insert into public.organizations(id,legal_name,display_name,status,created_by) values
('92000000-0000-0000-0000-000000000004','Outsider P04 SARL','Outsider P04','ACTIVE','91000000-0000-0000-0000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
('93000000-0000-0000-0000-000000000004','92000000-0000-0000-0000-000000000004','91000000-0000-0000-0000-000000000004','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) values('93000000-0000-0000-0000-000000000004','CLIENT_OWNER');

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000004","email":"p04-outsider@example.invalid","role":"authenticated"}',true);
insert into p04_observed values
('outsider_requests',(select count(*)::text from public.organization_access_requests)),
('outsider_invitations',(select count(*)::text from public.organization_invitations)),
('outsider_invitation_roles',(select count(*)::text from public.organization_invitation_roles));
reset role;
select is((select value::bigint from p04_observed where key='outsider_requests'),0::bigint,'RLS denies cross-tenant access requests');
select is((select value::bigint from p04_observed where key='outsider_invitations'),0::bigint,'RLS denies cross-tenant invitations');
select is((select value::bigint from p04_observed where key='outsider_invitation_roles'),0::bigint,'RLS denies cross-tenant invitation roles');

select throws_ok(
  $$set local role authenticated; insert into public.organization_access_requests(organization_id,requester_user_id,requested_role_code)
    values('92000000-0000-0000-0000-000000000004','91000000-0000-0000-0000-000000000001','CLIENT_OWNER')$$,
  '42501',null,'authenticated clients cannot bypass the access workflow with direct inserts'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into p04_observed select 'otp_1',allowed::text from public.reserve_otp_request('same-person@example.invalid','192.0.2.10'::inet);
insert into p04_observed select 'otp_2',allowed::text from public.reserve_otp_request('same-person@example.invalid','192.0.2.10'::inet);
insert into p04_observed select 'otp_3',allowed::text from public.reserve_otp_request('same-person@example.invalid','192.0.2.10'::inet);
insert into p04_observed select 'otp_4',allowed::text from public.reserve_otp_request('same-person@example.invalid','192.0.2.10'::inet);
insert into p04_observed select 'otp_5',allowed::text from public.reserve_otp_request('same-person@example.invalid','192.0.2.10'::inet);
insert into p04_observed select 'otp_6',allowed::text from public.reserve_otp_request('same-person@example.invalid','192.0.2.10'::inet);
reset role;
select is((select count(*) from p04_observed where key like 'otp_%' and value='true'),5::bigint,'OTP rate limiter permits only the neutral identifier quota');
select is((select value::boolean from p04_observed where key='otp_6'),false,'OTP rate limiter blocks excess without account lookup');
select is((select count(*) from public.audit_events where action='identity.otp.reserved' and request_ip='192.0.2.10'::inet),6::bigint,'every OTP reservation is audited without raw identifier storage');
select ok(not exists(select 1 from private.otp_rate_limit_buckets where bucket_hash like '%same-person%'),'OTP buckets contain hashes rather than identifiers');

select ok(not has_function_privilege('anon','public.reserve_otp_request(text,inet)','EXECUTE'),'anon cannot invoke the trusted OTP limiter directly');
select ok(not has_function_privilege('authenticated','public.reserve_otp_request(text,inet)','EXECUTE'),'authenticated cannot forge trusted OTP rate-limit context');
select ok(has_function_privilege('authenticated','public.list_my_sessions()','EXECUTE'),'authenticated identities may list only their own sessions through the RPC');
select ok(not has_table_privilege('authenticated','auth.sessions','SELECT'),'authenticated identities cannot query raw auth sessions');
select results_eq(
 $$select action,count(*)from public.audit_events where organization_id=(select(value::jsonb->>'organization_id')::uuid from p04_observed where key='create_first')and action in('organization.created','organization.join.requested','organization.join.decided','organization.invitation.created','organization.invitation.accepted')group by action order by action$$,
 $$select * from (values('organization.created'::text,1::bigint),('organization.invitation.accepted',1::bigint),('organization.invitation.created',1::bigint),('organization.join.decided',1::bigint),('organization.join.requested',1::bigint))expected(action,total)$$,
 'each actual passport, governed join and invitation transition has exactly one scoped audit');
select results_eq(
 $$select event_type,count(*)from public.event_outbox where organization_id=(select(value::jsonb->>'organization_id')::uuid from p04_observed where key='create_first')and event_type in('OrganizationCreatedV1','OrganizationJoinRequestedV1','OrganizationJoinDecidedV1','OrganizationEmailInvitationRequestedV1','OrganizationInvitationAcceptedV1')group by event_type order by event_type$$,
 $$select * from (values('OrganizationCreatedV1'::text,1::bigint),('OrganizationEmailInvitationRequestedV1',1::bigint),('OrganizationInvitationAcceptedV1',1::bigint),('OrganizationJoinDecidedV1',1::bigint),('OrganizationJoinRequestedV1',1::bigint))expected(event_type,total)$$,
 'each actual passport, governed join and invitation transition has exactly one durable scoped outbox fact');

select * from finish();
rollback;
