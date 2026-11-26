begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select plan(13);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('e0630000-0000-4000-8000-000000000001','authenticated','authenticated','notification-runtime-owner@example.invalid','{}','{}',now(),now()),
('e0630000-0000-4000-8000-000000000002','authenticated','authenticated','notification-runtime-foreign@example.invalid','{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)
values ('e0630000-0000-4000-8000-000000000003','TEST notification runtime','TEST notification runtime','ACTIVE','e0630000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)
values ('e0630000-0000-4000-8000-000000000004','e0630000-0000-4000-8000-000000000003','e0630000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)
values ('e0630000-0000-4000-8000-000000000004','CLIENT_OWNER');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0630000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.set_notification_preference('e0630000-0000-4000-8000-000000000003','ADMIN_DIGEST','IN_APP','DIGEST','WEEKLY','fr-MA',0,'notification-runtime-digest')$$,'uppercase category saves through the real command');
select is((select digest_frequency from user_notification_preferences where organization_id='e0630000-0000-4000-8000-000000000003'),'WEEKLY','weekly choice persists');
select is((public.set_notification_preference('e0630000-0000-4000-8000-000000000003','ADMIN_DIGEST','IN_APP','DIGEST','WEEKLY','fr-MA',0,'notification-runtime-digest')->>'row_version')::integer,1,'replay returns the original version');
select lives_ok($$select public.set_notification_preference('e0630000-0000-4000-8000-000000000003','ADMIN_DIGEST','IN_APP','DISABLED',null,'fr-MA',1,'notification-runtime-disabled')$$,'optional category can be disabled');
select is((select row_version from user_notification_preferences where organization_id='e0630000-0000-4000-8000-000000000003'),2,'disable advances exactly once');
select lives_ok($$select public.set_notification_preference('e0630000-0000-4000-8000-000000000003','ADMIN_DIGEST','IN_APP','IMMEDIATE',null,'fr-MA',2,'notification-runtime-immediate')$$,'immediate delivery can be restored');
select is((select row_version from user_notification_preferences where organization_id='e0630000-0000-4000-8000-000000000003'),3,'three accepted commands produce three versions');
select throws_ok($$select public.set_notification_preference('e0630000-0000-4000-8000-000000000003','ADMIN_DIGEST','IN_APP','DISABLED',null,'fr-MA',1,'notification-runtime-stale')$$,'PT409','STALE_NOTIFICATION_PREFERENCE','stale form cannot overwrite a more recent preference');
reset role;
select is((select count(*)::integer from audit_events where organization_id='e0630000-0000-4000-8000-000000000003' and action='notification.preference.saved'),3,'replay creates no duplicate audit');
select is((select count(*)::integer from event_outbox where organization_id='e0630000-0000-4000-8000-000000000003' and event_type='NotificationPreferenceSavedV1'),3,'replay creates no duplicate event');
set local role authenticated;
select throws_ok($$select public.set_notification_preference('e0630000-0000-4000-8000-000000000003',(select code from notification_preference_categories where mandatory and status='ACTIVE' order by code limit 1),'IN_APP','DISABLED',null,'fr-MA',0,'notification-runtime-mandatory')$$,'22023','INVALID_NOTIFICATION_PREFERENCE','mandatory category cannot be disabled');
select set_config('request.jwt.claims','{"sub":"e0630000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.set_notification_preference('e0630000-0000-4000-8000-000000000003','ADMIN_DIGEST','IN_APP','DISABLED',null,'fr-MA',3,'notification-runtime-foreign')$$,'42501','NOTIFICATION_PREFERENCE_DENIED','foreign actor cannot change a preference');
select is_empty($$select id from user_notification_preferences where organization_id='e0630000-0000-4000-8000-000000000003'$$,'foreign actor cannot read preferences');
select * from finish();
rollback;
