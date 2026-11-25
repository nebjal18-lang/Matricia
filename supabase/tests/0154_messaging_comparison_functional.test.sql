begin;
set local search_path=public,extensions;
select plan(33);

-- MAT-FUNC-007 / MAT-FUNC-013 behavioral proof. All fixtures and effects roll back.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f1540000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func154-client@example.invalid','',now(),'{}','{}',now(),now()),
 ('f1540000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func154-provider@example.invalid','',now(),'{}','{}',now(),now()),
 ('f1540000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func154-outsider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.organizations(id,legal_name,display_name,status,created_by) values
 ('f1541000-0000-4000-8000-000000000001','Client functional 154','Client functional 154','ACTIVE','f1540000-0000-4000-8000-000000000001'),
 ('f1541000-0000-4000-8000-000000000002','Provider A functional 154','Provider A functional 154','ACTIVE','f1540000-0000-4000-8000-000000000002'),
 ('f1541000-0000-4000-8000-000000000003','Provider B functional 154','Provider B functional 154','ACTIVE','f1540000-0000-4000-8000-000000000002'),
 ('f1541000-0000-4000-8000-000000000004','Outsider functional 154','Outsider functional 154','ACTIVE','f1540000-0000-4000-8000-000000000003');

insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
 ('f1542000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000001','f1540000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('f1542000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000002','f1540000-0000-4000-8000-000000000002','ACTIVE',now()),
 ('f1542000-0000-4000-8000-000000000003','f1541000-0000-4000-8000-000000000004','f1540000-0000-4000-8000-000000000003','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) values
 ('f1542000-0000-4000-8000-000000000001','CLIENT_OWNER'),
 ('f1542000-0000-4000-8000-000000000002','PROVIDER_SALES'),
 ('f1542000-0000-4000-8000-000000000003','CLIENT_OWNER');

-- Build a coherent RFQ and two frozen submitted quotes without invoking unrelated
-- catalogue/matching workflows. The behavior under test starts at the public RPCs.
set local session_replication_role=replica;
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values
 ('f1543000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000001','f1543100-0000-4000-8000-000000000001','f1543200-0000-4000-8000-000000000001','RFQ_OPEN','f1540000-0000-4000-8000-000000000001');
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,deadline,status,invited_count,opened_by) values
 ('f1544000-0000-4000-8000-000000000001','f1543000-0000-4000-8000-000000000001','f1543300-0000-4000-8000-000000000001','f1543400-0000-4000-8000-000000000001',now()+interval '7 days','OPEN',2,'f1540000-0000-4000-8000-000000000001');
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values
 ('f1545000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','f1545100-0000-4000-8000-000000000001','ACCEPTED',now()),
 ('f1545000-0000-4000-8000-000000000002','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000003','f1545100-0000-4000-8000-000000000002','ACCEPTED',now());
insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by) values
 ('f1546000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1545000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','SUBMITTED','f1540000-0000-4000-8000-000000000002'),
 ('f1546000-0000-4000-8000-000000000002','f1544000-0000-4000-8000-000000000001','f1545000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003','SUBMITTED','f1540000-0000-4000-8000-000000000002');
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by) values
 ('f1547000-0000-4000-8000-000000000001','f1546000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002',1,'SUBMITTED','Offre A soumise','MAD','Solution A',jsonb_build_array('Livrable A'),'Garantie A','Corrections A',current_date+10,10,now()+interval '30 days',10000,2000,12000,0,'{"money":"MINOR_UNITS"}',repeat('a',64),now(),'f1540000-0000-4000-8000-000000000002'),
 ('f1547000-0000-4000-8000-000000000002','f1546000-0000-4000-8000-000000000002','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000003',1,'SUBMITTED','Offre B soumise','MAD','Solution B',jsonb_build_array('Livrable B','Livrable B2'),'Garantie B','Corrections B',current_date+12,12,now()+interval '30 days',20000,4000,24000,0,'{"money":"MINOR_UNITS"}',repeat('b',64),now(),'f1540000-0000-4000-8000-000000000002');
update public.quotes set current_version_id=case id when 'f1546000-0000-4000-8000-000000000001'::uuid then 'f1547000-0000-4000-8000-000000000001'::uuid else 'f1547000-0000-4000-8000-000000000002'::uuid end;
set local session_replication_role=origin;

create temporary table functional_results(kind text,value jsonb);
create temporary table rls_visibility(kind text,value bigint);
grant select,insert on functional_results,rls_visibility to authenticated;

-- Client ALLOW: open once, replay exactly, then send once and replay exactly.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into functional_results values('OPEN_1',public.open_rfq_message_thread('f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','Clarification technique','func154-thread-open','f1548000-0000-4000-8000-000000000001'));
insert into functional_results values('OPEN_2',public.open_rfq_message_thread('f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','Clarification technique','func154-thread-open','f1548000-0000-4000-8000-000000000002'));
insert into functional_results select 'SEND_1',public.send_internal_message((select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1'),'f1541000-0000-4000-8000-000000000001','Pouvez-vous préciser le planning ?',jsonb_build_array(),'func154-message-client','f1548000-0000-4000-8000-000000000003');
insert into functional_results select 'SEND_2',public.send_internal_message((select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1'),'f1541000-0000-4000-8000-000000000001','Pouvez-vous préciser le planning ?',jsonb_build_array(),'func154-message-client','f1548000-0000-4000-8000-000000000004');
insert into functional_results values('CLIENT_INBOX',public.list_internal_message_inbox(20));
reset role;

select is((select value->>'outcome' from functional_results where kind='OPEN_1'),'MESSAGE_THREAD_OPENED','client can open an invited-provider thread');
select is((select value from functional_results where kind='OPEN_2'),(select value from functional_results where kind='OPEN_1'),'thread-open replay returns the exact cached response');
select is((select count(*) from public.internal_message_threads where object_id='f1544000-0000-4000-8000-000000000001'),1::bigint,'thread-open replay creates one thread');
select is((select count(*) from public.internal_message_participants where thread_id=(select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1')),2::bigint,'thread has exactly the client and invited provider participants');
select is((select count(*) from public.audit_events where action='messaging.thread.opened' and resource_id=(select value->>'thread_id' from functional_results where kind='OPEN_1')),1::bigint,'thread opening writes one audit event');
select is((select count(*) from public.event_outbox where event_type='InternalMessageThreadOpenedV1' and aggregate_id=(select value->>'thread_id' from functional_results where kind='OPEN_1')),1::bigint,'thread opening writes one outbox event');
select is((select value->>'outcome' from functional_results where kind='SEND_1'),'INTERNAL_MESSAGE_SENT','client participant can send a message');
select is((select value from functional_results where kind='SEND_2'),(select value from functional_results where kind='SEND_1'),'message-send replay returns the exact cached response');
select is((select count(*) from public.internal_messages where thread_id=(select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1')),1::bigint,'message replay does not duplicate content');
select is((select count(*) from public.audit_events where action='messaging.message.sent' and resource_id=(select value->>'message_id' from functional_results where kind='SEND_1')),1::bigint,'message send writes one audit event');
select is((select count(*) from public.event_outbox where event_type='InternalMessageSentV1' and aggregate_id=(select value->>'message_id' from functional_results where kind='SEND_1')),1::bigint,'message send writes one outbox event');

-- Provider ALLOW: reply and read the same object-bound conversation.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into functional_results select 'PROVIDER_SEND',public.send_internal_message((select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1'),'f1541000-0000-4000-8000-000000000002','Planning détaillé disponible demain.',jsonb_build_array(),'func154-message-provider','f1548000-0000-4000-8000-000000000005');
insert into functional_results select 'PROVIDER_READ',public.get_internal_message_thread((select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1'),20);
reset role;
select is((select value->>'outcome' from functional_results where kind='PROVIDER_SEND'),'INTERNAL_MESSAGE_SENT','invited provider participant can reply');
select is((select count(*) from public.internal_messages where thread_id=(select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1')),2::bigint,'client and provider messages coexist in one thread');
select is(jsonb_array_length((select value->'messages' from functional_results where kind='PROVIDER_READ')),2,'provider can read both thread messages');
select ok(jsonb_array_length((select value from functional_results where kind='CLIENT_INBOX'))=1,'client inbox lists the object-bound thread');

-- Outsider DENY at RPC and RLS layers.
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);select public.open_rfq_message_thread('f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','Tentative étrangère','func154-thread-deny','f1548000-0000-4000-8000-000000000006')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','foreign tenant cannot open another client RFQ thread');
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);select public.send_internal_message((select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1'),'f1541000-0000-4000-8000-000000000004','Tentative étrangère',jsonb_build_array(),'func154-message-deny','f1548000-0000-4000-8000-000000000007')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','foreign tenant cannot send into another tenant thread');
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);select public.get_internal_message_thread((select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1'),20)$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','foreign tenant cannot read another tenant thread RPC');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
insert into rls_visibility values('THREADS',(select count(*) from public.internal_message_threads where object_id='f1544000-0000-4000-8000-000000000001'));
insert into rls_visibility values('MESSAGES',(select count(*) from public.internal_messages where thread_id=(select (value->>'thread_id')::uuid from functional_results where kind='OPEN_1')));
reset role;
select is((select value from rls_visibility where kind='THREADS'),0::bigint,'thread RLS hides foreign tenant rows');
select is((select value from rls_visibility where kind='MESSAGES'),0::bigint,'message RLS hides foreign tenant rows');
select throws_ok($$update public.internal_messages set body='Mutation interdite' where id=(select (value->>'message_id')::uuid from functional_results where kind='SEND_1')$$,'55000','IMMUTABLE_INTERNAL_MESSAGE','sent messages are immutable');

-- Client ALLOW: invoke the real comparison command and replay it.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into functional_results values('COMPARE_1',public.compare_quotes('f1544000-0000-4000-8000-000000000001','func154-compare','f1548000-0000-4000-8000-000000000008'));
insert into functional_results values('COMPARE_2',public.compare_quotes('f1544000-0000-4000-8000-000000000001','func154-compare','f1548000-0000-4000-8000-000000000009'));
reset role;
select is((select value->>'outcome' from functional_results where kind='COMPARE_1'),'QUOTE_COMPARISON_CREATED','client buyer can create a real normalized quote comparison');
select is((select value from functional_results where kind='COMPARE_2'),(select value from functional_results where kind='COMPARE_1'),'comparison replay returns the exact cached snapshot response');
select is((select (value->>'quote_count')::integer from functional_results where kind='COMPARE_1'),2,'comparison includes both submitted quotes');
select ok((select (value->'rows'->0->>'total_minor')::bigint=12000 and (value->'rows'->0->>'price_rank')::integer=1 and (value->'rows'->1->>'total_minor')::bigint=24000 and (value->'rows'->1->>'price_rank')::integer=2 from functional_results where kind='COMPARE_1'),'comparison normalizes exact minor-unit totals and deterministic price ranks');
select is((select count(*) from public.quote_comparison_snapshots where rfq_id='f1544000-0000-4000-8000-000000000001'),1::bigint,'comparison replay creates one immutable snapshot');
select ok((select cardinality(quote_version_ids)=2 and normalization_version='QUOTE_COMPARE_V1' and comparison->>'tax_basis'='VERSIONED_MA_RULE_PER_LINE' from public.quote_comparison_snapshots where id=(select (value->>'comparison_snapshot_id')::uuid from functional_results where kind='COMPARE_1')),'snapshot freezes both quote versions and normalization basis');
select is((select count(*) from public.audit_events where action='quote.comparison.created' and resource_id=(select value->>'comparison_snapshot_id' from functional_results where kind='COMPARE_1')),1::bigint,'comparison writes one audit event');
select is((select count(*) from public.event_outbox where event_type='QuoteComparisonCreatedV1' and payload->>'comparison_snapshot_id'=(select value->>'comparison_snapshot_id' from functional_results where kind='COMPARE_1')),1::bigint,'comparison writes one outbox event');
select ok((select status='COMPLETED' and jsonb_typeof(response_body#>'{rows,0,total_minor}')='number' and jsonb_set(response_body,'{rows}',private.quote_comparison_money_transport_v1(response_body->'rows'),false)=(select value from functional_results where kind='COMPARE_1') from public.idempotency_keys where organization_id='f1541000-0000-4000-8000-000000000001' and operation_scope='quote.compare' and key='func154-compare'),'comparison cache stays numeric and completed while its transport copy matches the replay');
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);select public.compare_quotes('f1544000-0000-4000-8000-000000000001','func154-compare-deny','f1548000-0000-4000-8000-000000000010')$$,'42501','QUOTE_CLIENT_SCOPE_DENIED','foreign tenant cannot compare another client RFQ quotes');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
insert into rls_visibility values('SNAPSHOTS',(select count(*) from public.quote_comparison_snapshots where rfq_id='f1544000-0000-4000-8000-000000000001'));
reset role;
select is((select value from rls_visibility where kind='SNAPSHOTS'),0::bigint,'comparison snapshot RLS hides foreign tenant rows');
select throws_ok($$update public.quote_comparison_snapshots set normalization_version='TAMPERED' where id=(select (value->>'comparison_snapshot_id')::uuid from functional_results where kind='COMPARE_1')$$,'55000','IMMUTABLE_RECORD','comparison snapshot is immutable after creation');

select * from finish();
rollback;
