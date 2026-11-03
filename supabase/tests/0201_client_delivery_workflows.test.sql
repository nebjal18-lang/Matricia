begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0201',configured_at=clock_timestamp()where singleton;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated,service_role;
select ok(not has_function_privilege('anon','public.save_client_assistance(uuid,uuid,text,text,uuid[],boolean,boolean,integer,text,uuid)','EXECUTE'),'anonymous cannot submit human assistance');
select ok(not has_function_privilege('authenticated','public.reserve_registration_consent(text,text,text,text)','EXECUTE'),'browser cannot manufacture a registration receipt');
select ok(not has_table_privilege('authenticated','public.client_assistance_requests','INSERT')and not has_table_privilege('authenticated','public.client_assistance_messages','UPDATE'),'assistance writes go through guarded commands');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2010000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner201@example.invalid','',now(),'{}','{}',now(),now()),
('a2010000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider201@example.invalid','',now(),'{}','{}',now(),now()),
('a2010000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff201@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2010000-0000-4000-8000-000000000001','Owner 201','Owner 201','ACTIVE','a2010000-0000-4000-8000-000000000001'),
('b2010000-0000-4000-8000-000000000002','Other 201','Other 201','ACTIVE','a2010000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status)values
('c2010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000001','ACTIVE'),
('c2010000-0000-4000-8000-000000000002','b2010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code,granted_by)values
('c2010000-0000-4000-8000-000000000001','CLIENT_OWNER','a2010000-0000-4000-8000-000000000001'),
('c2010000-0000-4000-8000-000000000002','CLIENT_OWNER','a2010000-0000-4000-8000-000000000002');
insert into public.platform_user_roles(user_id,role_code,granted_by)values('a2010000-0000-4000-8000-000000000003','SUPPORT_AGENT','a2010000-0000-4000-8000-000000000003');
-- Wire pagination fixtures use synthetic foreign keys, isolated by this rollback.
set local session_replication_role=replica;
insert into public.service_requests(id,client_organization_id,library_id,service_id,current_version_id,status,created_by,created_at)
select format('d2010000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2010000-0000-4000-8000-000000000001','d2010000-0000-4000-9000-000000000001','d2010000-0000-4000-9000-000000000002',format('e2010000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,case when i=22 then'READY'else'DRAFT'end,'a2010000-0000-4000-8000-000000000001','2026-01-01'::timestamptz+i*interval'1 second' from generate_series(1,22)i;
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,required_quote_data,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
select format('e2010000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,format('d2010000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2010000-0000-4000-8000-000000000001','d2010000-0000-4000-9000-000000000001',1,case when i=22 then'Traitement comptable 100% réel'else'Traitement comptable référence-'||i end,'NORMAL','{}',repeat('a',64),repeat('a',64),'Test pagination',repeat('a',64),'a2010000-0000-4000-8000-000000000001' from generate_series(1,22)i;
insert into public.subscription_payment_intents(id,organization_id,plan_version_id,billing_interval,gateway,provider_intent_id,amount_minor,currency,idempotency_key,request_hash,correlation_id,created_by)values
('f2010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001','f2010000-0000-4000-9000-000000000001','MONTHLY','CMI','cmi-test-201',9007199254740993,'MAD','finance-test-201',repeat('a',64),'f2010000-0000-4000-9000-000000000002','a2010000-0000-4000-8000-000000000001'),
('f2010000-0000-4000-8000-000000000002','b2010000-0000-4000-8000-000000000001','f2010000-0000-4000-9000-000000000001','MONTHLY','DEMO','demo-test-201',2000,'MAD','finance-demo-201',repeat('a',64),'f2010000-0000-4000-9000-000000000002','a2010000-0000-4000-8000-000000000001');
insert into public.subscription_payment_events(payment_intent_id,organization_id,gateway,provider_event_id,provider_intent_id,event_type,amount_minor,currency,paid_at,payment_reference,payload_hash,signature_fingerprint,activation_result,correlation_id)values('f2010000-0000-4000-8000-000000000002','b2010000-0000-4000-8000-000000000001','DEMO','demo-event-test-201','demo-test-201','PAYMENT_SUCCEEDED',2000,'MAD',now(),'SIMULATION-201',repeat('a',64),repeat('a',64),'{}','f2010000-0000-4000-9000-000000000002');
insert into public.diagnostic_solution_sets(id,organization_id,anomaly_id,diagnostic_run_id,version,source_policy_snapshot,input_hash,rationale_fr,rationale_ar,created_by,correlation_id,created_at)
select format('a2011000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2010000-0000-4000-8000-000000000001',format('a2012000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'a2013000-0000-4000-8000-000000000001',1,'{}',repeat('a',64),case when i=24 then'Audit 100% complet'else'Amélioration recommandée référence-'||i end,'حل لتطوير المؤسسة','a2010000-0000-4000-8000-000000000001','f2010000-0000-4000-9000-000000000002','2026-01-01'::timestamptz+i*interval'1 second'from generate_series(1,24)i;
insert into public.diagnostic_solution_options(solution_set_id,organization_id,level,service_id,service_version_id,expected_score_bps,benefits,tradeoffs,explanation,content_hash)
select format('a2011000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2010000-0000-4000-8000-000000000001',case when i%2=0 then'ADVANCED'else'ESSENTIAL'end,'d2010000-0000-4000-9000-000000000002','d2010000-0000-4000-9000-000000000003',7500,'[]','[]','{}',repeat('a',64)from generate_series(1,24)i;
set local session_replication_role=origin;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.register_legal_consent_documents_v1('2091-01-01','2091-01-01','fr','{"terms":{"title":"Recette201"},"privacy":{"title":"Recette201"}}');
select set_config('test.consent_receipt',public.reserve_registration_consent('owner201@example.invalid','fr','2091-01-01','2091-01-01')::text,true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000002","email":"outsider201@example.invalid","role":"authenticated","aal":"aal1"}',true);
select throws_ok(format('select public.confirm_registration_consent(%L::uuid)',current_setting('test.consent_receipt')),'42501','CONSENT_RECEIPT_DENIED','a receipt cannot be accepted by another email');
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000001","email":"owner201@example.invalid","role":"authenticated","aal":"aal1"}',true);
select lives_ok(format('select public.confirm_registration_consent(%L::uuid)',current_setting('test.consent_receipt')),'verified owner confirms consent');
select lives_ok(format('select public.confirm_registration_consent(%L::uuid)',current_setting('test.consent_receipt')),'consent confirmation replays safely');
select is((select count(*)::integer from public.registration_consent_acceptances where user_id='a2010000-0000-4000-8000-000000000001'),1,'one immutable acceptance exists');
select throws_ok($$select public.save_client_assistance(null,'b2010000-0000-4000-8000-000000000002','Conseil','Description assez longue','{}',true,true,0,'denied-other-201')$$,'42501','ASSISTANCE_WRITE_DENIED','cross tenant assistance denied');
select throws_ok($$select public.save_client_assistance(null,'b2010000-0000-4000-8000-000000000001','Conseil','Description assez longue','{}',true,false,0,'denied-consent-201')$$,'22023','INVALID_ASSISTANCE','submission requires explicit consent');
select set_config('test.draft',(public.save_client_assistance(null,'b2010000-0000-4000-8000-000000000001','Conseil brouillon','Description assez longue','{}',false,false,0,'draft-assistance-201')->>'id'),true);
select lives_ok(format('select public.save_client_assistance(%L::uuid,%L::uuid,%L,%L,%L::uuid[],false,false,1,%L)',current_setting('test.draft'),'b2010000-0000-4000-8000-000000000001','Brouillon actualisé','Description concurrente','{}','draft-edit-201'),'current draft version may update');
select throws_ok(format('select public.save_client_assistance(%L::uuid,%L::uuid,%L,%L,%L::uuid[],false,false,1,%L)',current_setting('test.draft'),'b2010000-0000-4000-8000-000000000001','Brouillon périmé','Description concurrente','{}','draft-stale-201'),'40001','STALE_ASSISTANCE','concurrent stale draft update is rejected');
select throws_ok(format('select public.save_client_assistance(%L::uuid,%L::uuid,%L,%L,%L::uuid[],false,false,null,%L)',current_setting('test.draft'),'b2010000-0000-4000-8000-000000000001','Sujet modifié','Description concurrente','{}','null-version-201'),'22023','INVALID_ASSISTANCE','null row version cannot bypass optimistic locking');
select set_config('test.request',(public.save_client_assistance(null,'b2010000-0000-4000-8000-000000000001','Conseil transmis','Description assez longue','{}',true,true,0,'submit-assistance-201')->>'id'),true);
select is((public.save_client_assistance(null,'b2010000-0000-4000-8000-000000000001','Conseil transmis','Description assez longue','{}',true,true,0,'submit-assistance-201')->>'id'),current_setting('test.request'),'submission replay returns same request');
select throws_ok($$select public.save_client_assistance(null,'b2010000-0000-4000-8000-000000000001','Sujet différent','Description assez longue','{}',true,true,0,'submit-assistance-201')$$,'22000',null,'changed payload under same key is rejected');
select throws_ok(format('select public.authorize_client_assistance_document(%L::uuid,%L::uuid)',current_setting('test.request'),'d2010000-0000-4000-8000-000000000001'),'42501','CLIENT_DOCUMENT_DENIED','unselected attachment denied');
select is(jsonb_array_length(public.list_client_financial_page('b2010000-0000-4000-8000-000000000001')),2,'financial history uses structured payment sources');
select is((select item->>'amount_minor'from jsonb_array_elements(public.list_client_financial_page('b2010000-0000-4000-8000-000000000001'))item where item->>'id'='f2010000-0000-4000-8000-000000000001'),'9007199254740993','financial money remains exact text above JS safe integer');
select is(jsonb_array_length(public.list_client_financial_page('b2010000-0000-4000-8000-000000000001','','PENDING')),1,'an unconfirmed intent remains pending');
select ok((select(item->>'is_demo')::boolean from jsonb_array_elements(public.list_client_financial_page('b2010000-0000-4000-8000-000000000001','','CONFIRMED'))item),'confirmed demo payment remains labelled a simulation');
select is(jsonb_array_length(public.list_client_solution_sets_page('b2010000-0000-4000-8000-000000000001')),21,'solutions first page has next-page sentinel');
select is(jsonb_array_length(public.list_client_solution_sets_page('b2010000-0000-4000-8000-000000000001','','',false,null,2)),4,'older recommendations remain accessible');
select is(jsonb_array_length(public.list_client_solution_sets_page('b2010000-0000-4000-8000-000000000001','','ADVANCED')),12,'solution level filters the full history');
select lives_ok($$select public.set_client_solution_bookmark('a2011000-0000-4000-8000-000000000001',true)$$,'bookmark persists');
select lives_ok($$select public.set_client_solution_bookmark('a2011000-0000-4000-8000-000000000001',true)$$,'bookmark replay is safe');
select is(jsonb_array_length(public.list_client_solution_sets_page('b2010000-0000-4000-8000-000000000001','','',true)),1,'saved filter reaches older pages');
select is(jsonb_array_length(public.list_client_solution_sets_page('b2010000-0000-4000-8000-000000000001','%')),1,'solution search treats wildcard literally');
select throws_ok($$select public.list_client_financial_page('b2010000-0000-4000-8000-000000000002')$$,'42501','CLIENT_FINANCE_DENIED','cross tenant financial projection denied');
select is(jsonb_array_length(public.list_client_request_page('b2010000-0000-4000-8000-000000000001')),21,'first request page includes next-page sentinel');
select is(jsonb_array_length(public.list_client_request_page('b2010000-0000-4000-8000-000000000001','','',2)),2,'older request page remains accessible');
select is(jsonb_array_length(public.list_client_request_page('b2010000-0000-4000-8000-000000000001','%')),1,'search treats wildcard characters literally');
select is(jsonb_array_length(public.list_client_request_page('b2010000-0000-4000-8000-000000000001','','READY')),1,'status filter applies before pagination');
select throws_ok($$select public.list_client_request_page('b2010000-0000-4000-8000-000000000002')$$,'42501',null,'cross tenant request projection denied');
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000002","email":"outsider201@example.invalid","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::integer from public.client_assistance_requests),0,'other tenant cannot read request or draft');
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000003","email":"staff201@example.invalid","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::integer from public.client_assistance_requests),0,'staff without MFA cannot read requests');
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000003","email":"staff201@example.invalid","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.client_assistance_requests where id::text in(current_setting('test.draft'),current_setting('test.request'))),1,'staff sees consented submitted request but no draft');
select lives_ok(format('select public.reply_client_assistance(%L::uuid,%L,true,%L)',current_setting('test.request'),'Réponse précise du conseiller','reply-assistance-201'),'staff replies and closes');
select lives_ok(format('select public.reply_client_assistance(%L::uuid,%L,true,%L)',current_setting('test.request'),'Réponse précise du conseiller','reply-assistance-201'),'same close reply replays after closure');
reset role;
select is((select count(*)::integer from public.admin_work_items where resource_type='client_assistance_request'and resource_id=current_setting('test.request')and status='RESOLVED'),1,'close resolves the operational queue item atomically');
select is((select count(*)::integer from public.client_assistance_messages where request_id=current_setting('test.request')::uuid),1,'idempotent close creates one message');
select is((select count(*)::integer from public.audit_events where resource_type='client_assistance_request'and resource_id=current_setting('test.request')and action='client.assistance.submitted'),1,'one submit audit exists');
select is((select count(*)::integer from public.event_outbox where aggregate_type='client_assistance_request'and aggregate_id=current_setting('test.request')and event_type='ClientAssistanceSubmittedV1'),1,'one submission event exists');
select throws_ok(format('update public.client_assistance_messages set body=%L where request_id=%L::uuid','altéré',current_setting('test.request')),'55000',null,'counsellor messages are immutable');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000002","email":"outsider201@example.invalid","role":"authenticated","aal":"aal1"}',true);
select throws_ok(format('select public.withdraw_client_assistance_consent(%L::uuid,2,%L)',current_setting('test.request'),'withdraw-foreign-201'),'42501','ASSISTANCE_CONSENT_WITHDRAWAL_DENIED','other tenant cannot withdraw the owners consent');
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000001","email":"owner201@example.invalid","role":"authenticated","aal":"aal1"}',true);
select lives_ok(format('select public.withdraw_client_assistance_consent(%L::uuid,2,%L)',current_setting('test.request'),'withdraw-consent-201'),'owner can withdraw consent even after counsellor closure');
select lives_ok(format('select public.withdraw_client_assistance_consent(%L::uuid,2,%L)',current_setting('test.request'),'withdraw-consent-201'),'withdrawal replays safely');
select ok((select consented_at is not null and consent_revoked_at is not null and status='CLOSED'from public.client_assistance_requests where id=current_setting('test.request')::uuid),'withdrawal retains the initial consent evidence and owner history');
select set_config('request.jwt.claims','{"sub":"a2010000-0000-4000-8000-000000000003","email":"staff201@example.invalid","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.client_assistance_requests where id=current_setting('test.request')::uuid),0,'consent withdrawal immediately removes staff request access');
select is((select count(*)::integer from public.client_assistance_messages where request_id=current_setting('test.request')::uuid),0,'consent withdrawal immediately removes staff conversation access');
select throws_ok(format('select public.reply_client_assistance(%L::uuid,%L,false,%L)',current_setting('test.request'),'Réponse après retrait','reply-after-withdrawal-201'),'42501','ASSISTANCE_REPLY_DENIED','new staff response after withdrawal is denied');
reset role;
select is((select count(*)::integer from public.audit_events where resource_id=current_setting('test.request')and action='client.assistance.consent_withdrawn'),1,'withdrawal emits one audit event');
select is((select count(*)::integer from public.event_outbox where aggregate_id=current_setting('test.request')and event_type='ClientAssistanceConsentWithdrawnV1'),1,'withdrawal emits one outbox event');
select * from finish();
rollback;
