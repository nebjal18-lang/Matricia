begin;
set local search_path=public,extensions;
set local timezone='UTC';
grant usage on schema extensions to authenticated,service_role;
select no_plan();
select ok(has_function_privilege('authenticated','public.list_notification_center_page_v1(uuid,integer,text,boolean,timestamptz,uuid)','execute')and not has_function_privilege('anon','public.list_notification_center_page_v1(uuid,integer,text,boolean,timestamptz,uuid)','execute'),'history API requires an authenticated recipient');
select ok(not has_function_privilege('authenticated','public.run_client_reminder_scheduler_v1(date,integer)','execute')and has_function_privilege('service_role','public.run_client_reminder_scheduler_v1(date,integer)','execute'),'reminder producer is service-only');
select ok(not has_function_privilege('service_role','private.run_domain_automation_base_v1(date,integer)','execute'),'base automation cannot bypass its public guard');
-- Transaction-local SQL fixtures, never provisioned to any deployed environment.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select('a3160000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','notifications316-'||i||'@example.invalid','',now(),'{}',case when i=1 then'{"locale":"ar"}'::jsonb else'{}'end,now(),now()from generate_series(1,3)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3160000-0000-4000-8000-000000000001','TEST Client 316','TEST Client 316','ACTIVE','a3160000-0000-4000-8000-000000000001'),
('b3160000-0000-4000-8000-000000000002','TEST Foreign 316','TEST Foreign 316','ACTIVE','a3160000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status)values
('c3160000-0000-4000-8000-000000000001','b3160000-0000-4000-8000-000000000001','a3160000-0000-4000-8000-000000000001','ACTIVE'),
('c3160000-0000-4000-8000-000000000002','b3160000-0000-4000-8000-000000000002','a3160000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c3160000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c3160000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a3160000-0000-4000-8000-000000000002','FINANCE_MANAGER'),('a3160000-0000-4000-8000-000000000003','FINANCE_MANAGER');
insert into public.client_compliance_cases(id,organization_id,status,created_by)values('d3160000-0000-4000-8000-000000000001','b3160000-0000-4000-8000-000000000001','PROFILE_IN_PROGRESS','a3160000-0000-4000-8000-000000000001');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('d3160000-0000-4000-8000-000000000001','b3160000-0000-4000-8000-000000000001',1,'{}','{}',1,'a3160000-0000-4000-8000-000000000001');
insert into public.client_trials(id,organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('d3160000-0000-4000-8000-000000000002','b3160000-0000-4000-8000-000000000001','d3160000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',now()-interval'25 days',now()+interval'5 days','a3160000-0000-4000-8000-000000000002');
create temp table notification316(k text primary key,v jsonb);grant all on notification316 to authenticated,service_role;
insert into auth.sessions(id,user_id,aal,created_at,updated_at)select('f3160000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3160000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'aal2',now(),now()from generate_series(1,3)i;
create function pg_temp.actor316(p_i integer)returns void language plpgsql as $$declare uid text:='a3160000-0000-4000-8000-'||lpad(p_i::text,12,'0');begin perform set_config('request.jwt.claim.sub',uid,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','aal','aal2','session_id','f3160000-0000-4000-8000-'||lpad(p_i::text,12,'0'))::text,true);end$$;
-- Fund real credits through the independent review and execution commands.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST-316-LOCAL-ONLY',configured_at=clock_timestamp()where singleton;
insert into public.credit_wallets(id,organization_id,wallet_type)values('e3160000-0000-4000-8000-000000000001','b3160000-0000-4000-8000-000000000001','CLIENT');
set local role authenticated;select pg_temp.actor316(2);
insert into notification316 values('grant',public.request_manual_credit_grant_v1('b3160000-0000-4000-8000-000000000001','e3160000-0000-4000-8000-000000000001','ADMIN_GRANT',9007199254740993,now()+interval'6 days',null,'TEST-316-SOURCE','TEST credit reminder source with independent review','test-316-grant'));
select pg_temp.actor316(3);
insert into notification316 values('review',public.review_manual_credit_grant_v1((select(v->>'request_id')::uuid from notification316 where k='grant'),(select v->>'content_hash'from notification316 where k='grant'),true,true,'TEST-316-REVIEW','TEST independent credit reminder approval'));
insert into notification316 values('executed',public.execute_manual_credit_grant_v1((select(v->>'request_id')::uuid from notification316 where k='grant'),(select v->>'content_hash'from notification316 where k='grant'),(select v->>'review_proof_hash'from notification316 where k='review'),'test-316-execute'));
reset role;
-- A disabled in-app category must stay absent from every history page.
insert into public.user_notification_preferences(user_id,organization_id,category_code,channel,delivery_mode,locale)values('a3160000-0000-4000-8000-000000000001','b3160000-0000-4000-8000-000000000001','MISSION','IN_APP','DISABLED','fr-MA');
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.enqueue_notification('a3160000-0000-4000-8000-000000000001','b3160000-0000-4000-8000-000000000001','MISSION_REMINDER','MissionReminderDueV1','fr-MA','{"title":"Hidden reminder","due_at":"2026-11-03"}','test-316-hidden','test','hidden');
reset role;delete from public.user_notification_preferences where user_id='a3160000-0000-4000-8000-000000000001'and category_code='MISSION';
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.enqueue_notification('a3160000-0000-4000-8000-000000000001','b3160000-0000-4000-8000-000000000001','MISSION_REMINDER','MissionReminderDueV1','fr-MA',jsonb_build_object('title',case when i=1 then'Legacy needle 100%'else'Dossier '||i end,'due_at','2026-11-03'),'test-316-history-'||i,'test',i::text)from generate_series(1,126)i;
insert into notification316 values('reminders',public.run_client_reminder_scheduler_v1(current_date,1));
select is((select(v->>'processed')::integer from notification316 where k='reminders'),1,'bounded reminder page processes one source');
select is((select(v->>'has_more')::boolean from notification316 where k='reminders'),true,'pending sources are advertised for another page');
select public.run_client_reminder_scheduler_v1(current_date,100);
select public.run_client_reminder_scheduler_v1(current_date,100);
reset role;
select is((select count(*)::integer from public.notification_instances where event_type='TrialEndingReminderV1'and organization_id='b3160000-0000-4000-8000-000000000001'),1,'replayed scheduler emits trial checkpoint once');
select is((select variables_snapshot->>'milestone'from public.notification_instances where event_type='TrialEndingReminderV1'and organization_id='b3160000-0000-4000-8000-000000000001'),'J-5','catch-up selects the latest due milestone rather than stale J-10');
select is((select locale from public.notification_instances where event_type='TrialEndingReminderV1'and organization_id='b3160000-0000-4000-8000-000000000001'),'ar-MA','reminder uses recipient Arabic locale');
select is((select variables_snapshot->>'available'from public.notification_instances where event_type='CreditExpiringReminderV1'and organization_id='b3160000-0000-4000-8000-000000000001'),'9007199254740993','credit reminder retains exact quantity beyond JavaScript safe integers');
select ok((select bool_and(d.status='SKIPPED')from public.notification_deliveries d join public.notification_instances n on n.id=d.notification_id where n.organization_id='b3160000-0000-4000-8000-000000000001'and n.event_type in('TrialEndingReminderV1','CreditExpiringReminderV1')and d.channel='EMAIL'),'optional email remains skipped without explicit preference/consent');
select ok((select bool_and(cta_path like '%organizationId=b3160000-0000-4000-8000-000000000001')from public.notification_instances where event_type in('TrialEndingReminderV1','CreditExpiringReminderV1')and organization_id='b3160000-0000-4000-8000-000000000001'),'reminder links preserve exact organization');
set local role authenticated;select pg_temp.actor316(1);
insert into notification316 values('page1',public.list_notification_center_page_v1('b3160000-0000-4000-8000-000000000001',25,'',false));
insert into notification316 values('page2',public.list_notification_center_page_v1('b3160000-0000-4000-8000-000000000001',25,'',false,(select(v->'next'->>'createdAt')::timestamptz from notification316 where k='page1'),(select(v->'next'->>'id')::uuid from notification316 where k='page1')));
select is((select jsonb_array_length(v->'notifications')from notification316 where k='page1'),25,'history has a bounded first page');
select ok((select v->'next'<>'null'::jsonb from notification316 where k='page1'),'history exposes a cursor beyond the first page');
select is((select count(*)::integer from notification316 a,notification316 b,jsonb_array_elements(a.v->'notifications')x,jsonb_array_elements(b.v->'notifications')y where a.k='page1'and b.k='page2'and x->>'id'=y->>'id'),0,'keyset pages do not overlap');
insert into notification316 values('search',public.list_notification_center_page_v1('b3160000-0000-4000-8000-000000000001',25,'needle 100%',false));
select is((select jsonb_array_length(v->'notifications')from notification316 where k='search'),1,'literal search finds an item older than the old 100-item limit');
select is(jsonb_array_length(public.list_notification_center_page_v1('b3160000-0000-4000-8000-000000000001',25,'Hidden reminder',false)->'notifications'),0,'disabled in-app reminder stays excluded');
select throws_ok($$select public.list_notification_center_page_v1('b3160000-0000-4000-8000-000000000002',25)$$,'42501','NOTIFICATION_CENTER_DENIED','foreign organization cannot be selected');
select throws_ok($$select public.list_notification_center_page_v1('b3160000-0000-4000-8000-000000000001',25,'',false,now(),null)$$,'22023','INVALID_NOTIFICATION_HISTORY_FILTER','an incomplete cursor is rejected');
select public.mark_notification_read((select(v->'notifications'->0->>'id')::uuid from notification316 where k='search'),1,'test-316-mark-read');
select is(jsonb_array_length(public.list_notification_center_page_v1('b3160000-0000-4000-8000-000000000001',25,'needle 100%',true)->'notifications'),0,'unread filter follows the real mark-read command');
reset role;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.run_client_reminder_scheduler_v1(current_date+5,100);
select public.run_client_reminder_scheduler_v1(current_date+7,100);
reset role;
select is((select count(*)::integer from public.notification_instances where event_type='TrialExpiredReminderV1'and organization_id='b3160000-0000-4000-8000-000000000001'),1,'expired trial catch-up emits J0 once across subsequent days');
select is((select count(*)::integer from public.notification_instances where event_type='CreditExpiringReminderV1'and organization_id='b3160000-0000-4000-8000-000000000001'),2,'second credit milestone occurs before expiry and never after');
select throws_ok($$update private.client_reminder_policy_versions_v1 set credit_days=array[2]where version=1$$,'55000','IMMUTABLE_REMINDER_POLICY','published reminder policy cannot be edited in place');
select * from finish();
rollback;
