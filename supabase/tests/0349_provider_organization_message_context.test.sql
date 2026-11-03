begin;
set local search_path=public,extensions;
select no_plan();
-- pgTAP usage is transaction-local and rolled back; API framework execution stays revoked.
grant usage on schema extensions to authenticated,service_role;
-- Transaction-local synthetic fixtures. No scan, trigger, FK or RLS is disabled.
select ok(has_function_privilege('authenticated','public.get_internal_message_thread_page_for_organization_v1(uuid,uuid,timestamptz,uuid,integer)','EXECUTE'),'authenticated may reach scoped history guard');
select ok(not has_function_privilege('anon','public.get_internal_message_thread_page_for_organization_v1(uuid,uuid,timestamptz,uuid,integer)','EXECUTE'),'anonymous scoped history denied');
select ok(not has_function_privilege('service_role','public.get_internal_message_thread_page_for_organization_v1(uuid,uuid,timestamptz,uuid,integer)','EXECUTE'),'service role cannot impersonate a participant');
select ok((select prosecdef and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='public.get_internal_message_thread_page_for_organization_v1(uuid,uuid,timestamptz,uuid,integer)'::regprocedure),'scoped history fixes the definer search path');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fa349000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','provider349-dual@example.invalid','',now(),'{}','{}',now(),now()),
('fa349000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','provider349-foreign@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('fb349000-0000-4000-8000-000000000001','Context 349 Client test','Context 349 Client test','ACTIVE','fa349000-0000-4000-8000-000000000001'),
('fb349000-0000-4000-8000-000000000002','Context 349 Provider test','Context 349 Provider test','ACTIVE','fa349000-0000-4000-8000-000000000001'),
('fb349000-0000-4000-8000-000000000003','Context 349 Foreign test','Context 349 Foreign test','ACTIVE','fa349000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status) values
('fc349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000001','fa349000-0000-4000-8000-000000000001','ACTIVE'),
('fc349000-0000-4000-8000-000000000002','fb349000-0000-4000-8000-000000000002','fa349000-0000-4000-8000-000000000001','ACTIVE'),
('fc349000-0000-4000-8000-000000000003','fb349000-0000-4000-8000-000000000003','fa349000-0000-4000-8000-000000000002','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('fc349000-0000-4000-8000-000000000001','CLIENT_OWNER'),('fc349000-0000-4000-8000-000000000002','PROVIDER_SALES'),('fc349000-0000-4000-8000-000000000003','PROVIDER_OWNER');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values('fd349000-0000-4000-8000-000000000001','CONTEXT349','context349','fb349000-0000-4000-8000-000000000001','fa349000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,created_by)values('fd349000-0000-4000-8000-000000000002','fd349000-0000-4000-8000-000000000001','CONTEXT349_CAT','context349-cat','fa349000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by)values('fd349000-0000-4000-8000-000000000003','fd349000-0000-4000-8000-000000000001','fd349000-0000-4000-8000-000000000002','CONTEXT349_SUB','context349-sub','fa349000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by)values('fd349000-0000-4000-8000-000000000004','fd349000-0000-4000-8000-000000000001','fd349000-0000-4000-8000-000000000003','CONTEXT349_SERVICE','context349-service','fa349000-0000-4000-8000-000000000001');
insert into public.service_requests(id,client_organization_id,library_id,service_id,created_by)values('fe349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000001','fd349000-0000-4000-8000-000000000001','fd349000-0000-4000-8000-000000000004','fa349000-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,required_quote_data,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)values('fe349000-0000-4000-8000-000000000002','fe349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000001','fd349000-0000-4000-8000-000000000001',1,'Synthetic context history request','NORMAL','{}',repeat('a',64),repeat('a',64),'Test-only messaging scope',repeat('b',64),'fa349000-0000-4000-8000-000000000001');
insert into public.matching_runs(id,request_id,request_version_id,policy_version,target_panel_size,started_by)values('fe349000-0000-4000-8000-000000000003','fe349000-0000-4000-8000-000000000001','fe349000-0000-4000-8000-000000000002','MATCH-V1',10,'fa349000-0000-4000-8000-000000000001');
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,deadline,invited_count,opened_by)values('fe349000-0000-4000-8000-000000000004','fe349000-0000-4000-8000-000000000001','fe349000-0000-4000-8000-000000000002','fe349000-0000-4000-8000-000000000003',now()+interval'1 day',1,'fa349000-0000-4000-8000-000000000001');
insert into public.internal_message_threads(id,object_type,object_id,service_request_id,client_organization_id,provider_organization_id,subject,created_by)values('ff349000-0000-4000-8000-000000000001','RFQ','fe349000-0000-4000-8000-000000000004','fe349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000002','Context 349 private conversation','fa349000-0000-4000-8000-000000000001');
insert into public.internal_message_participants(id,thread_id,organization_id,participant_kind,display_alias,joined_at)values
('ff349000-0000-4000-8000-000000000002','ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000001','CLIENT','CLIENT',now()-interval'1 minute'),
('ff349000-0000-4000-8000-000000000003','ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000002','PROVIDER','PROVIDER',now());
insert into public.internal_messages(id,thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key,created_at)
select('ff349001-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ff349000-0000-4000-8000-000000000001','ff349000-0000-4000-8000-000000000003','fb349000-0000-4000-8000-000000000002','fa349000-0000-4000-8000-000000000001','Texte libre محفوظ '||i,'context349-'||i,'2026-11-01T09:30:00.123456Z' from generate_series(1,301)i;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fa349000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is(public.get_internal_message_thread_page('ff349000-0000-4000-8000-000000000001')->'thread'->>'participant_organization_id','fb349000-0000-4000-8000-000000000001','reproduces historical first-membership projection under dual membership');
select is(public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000002')->'thread'->>'participant_organization_id','fb349000-0000-4000-8000-000000000002','selected Provider organization is retained');
select is(public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000002')->'thread'->>'counterparty_alias','CLIENT','selected Provider sees the correct counterparty alias');
select is(public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000002')->'messages'->0->>'mine','true','mine is derived from selected Provider organization');
select is(public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000001')->'messages'->0->>'mine','false','same actor acting as Client does not claim Provider messages');
select is((public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000002')->>'total')::int,301,'complete durable history includes messages beyond former300 cap');
select is(jsonb_array_length(public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000002')->'messages'),50,'transport page stays bounded');
select throws_ok($$select public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000003')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','forged organization cannot widen read scope');
select throws_ok($$select public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001',null)$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','null organization cannot silently select another party');
select set_config('request.jwt.claims','{"sub":"fa349000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_internal_message_thread_page_for_organization_v1('ff349000-0000-4000-8000-000000000001','fb349000-0000-4000-8000-000000000002')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','foreign active Provider owner cannot read the conversation');
reset role;
select * from finish();
rollback;
