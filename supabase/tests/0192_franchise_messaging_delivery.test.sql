begin;set local search_path=public,extensions;select plan(18);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a8900000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f1-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f1-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f2-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f2-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unscoped-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-89@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b8900000-0000-4000-8000-000000000001','Multi Franchise P89 SARL','Multi Franchise P89','ACTIVE','a8900000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f8900000-0000-4000-8000-000000000010','FRANCHISE_SCOPE','franchise-scope','b8900000-0000-4000-8000-000000000001','DRAFT','a8900000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c8900000-0000-4000-8000-000000000001','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000001','ACTIVE',now()),
('c8900000-0000-4000-8000-000000000002','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000002','ACTIVE',now()),
('c8900000-0000-4000-8000-000000000003','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000003','ACTIVE',now()),
('c8900000-0000-4000-8000-000000000004','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000004','ACTIVE',now()),
('c8900000-0000-4000-8000-000000000005','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000005','ACTIVE',now());
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values
('d8900000-0000-4000-8000-000000000001','f8900000-0000-4000-8000-000000000010','b8900000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F1','ACTIVE','a8900000-0000-4000-8000-000000000001'),
('d8900000-0000-4000-8000-000000000002','f8900000-0000-4000-8000-000000000010','b8900000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F2','ACTIVE','a8900000-0000-4000-8000-000000000003');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('c8900000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','d8900000-0000-4000-8000-000000000001'),
('c8900000-0000-4000-8000-000000000002','FRANCHISE_VIEWER','d8900000-0000-4000-8000-000000000001'),
('c8900000-0000-4000-8000-000000000003','FRANCHISE_MANAGER','d8900000-0000-4000-8000-000000000002'),
('c8900000-0000-4000-8000-000000000004','FRANCHISE_VIEWER','d8900000-0000-4000-8000-000000000002'),
('c8900000-0000-4000-8000-000000000005','FRANCHISE_VIEWER',null);
insert into public.platform_user_roles(user_id,role_code)values('a8900000-0000-4000-8000-000000000006','MATRICIA_ADMIN');

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
grant usage on schema extensions to authenticated;
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


set local session_replication_role=replica;
update public.service_requests set library_id='f8900000-0000-4000-8000-000000000010'where id='f1543000-0000-4000-8000-000000000001';
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select case when territory_code='P89_F1'then 'd8920000-0000-4000-8000-000000000001'::uuid else 'd8920000-0000-4000-8000-000000000002'::uuid end,id,'d8930000-0000-4000-8000-000000000001','d8940000-0000-4000-8000-000000000001',1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('a',64),created_by from public.franchises where id in('d8900000-0000-4000-8000-000000000001','d8900000-0000-4000-8000-000000000002');
update public.franchises f set current_mandate_version_id=m.id from public.franchise_mandate_versions m where m.franchise_id=f.id and f.id in('d8900000-0000-4000-8000-000000000001','d8900000-0000-4000-8000-000000000002');
set local session_replication_role=origin;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into functional_results values('PRIVATE',public.open_rfq_message_thread('f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','Echange privé','f192-private-thread'));
select set_config('request.jwt.claims','{"sub":"a8900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)from public.internal_message_threads where id=(select(value->>'thread_id')::uuid from functional_results where kind='PRIVATE')),0::bigint,'franchise cannot read private client/provider RFQ thread metadata');
select throws_ok($$select public.get_internal_message_thread((select(value->>'thread_id')::uuid from functional_results where kind='PRIVATE'),20)$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','franchise cannot read private RFQ messages');
insert into functional_results values('FRANCHISE',public.open_franchise_rfq_message_thread('d8900000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','Suivi du dossier','f192-franchise-open'));
insert into functional_results values('REPLAY',public.open_franchise_rfq_message_thread('d8900000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','Suivi du dossier','f192-franchise-open'));
select is((select value from functional_results where kind='FRANCHISE'),(select value from functional_results where kind='REPLAY'),'opening is idempotent');
select is((select jsonb_array_length(public.list_franchise_message_inbox('d8900000-0000-4000-8000-000000000001',20))),1,'inbox contains the separate explicit franchise conversation');
insert into functional_results values('SEND',public.send_internal_message((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),'b8900000-0000-4000-8000-000000000001','Merci de préciser les étapes.','[]','f192-franchise-send'));
insert into functional_results values('SEND_REPLAY',public.send_internal_message((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),'b8900000-0000-4000-8000-000000000001','Merci de préciser les étapes.','[]','f192-franchise-send'));
select is((select value from functional_results where kind='SEND'),(select value from functional_results where kind='SEND_REPLAY'),'sending is idempotent');
select throws_ok($$select public.open_franchise_rfq_message_thread('d8900000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000004','Destinataire non lié','f192-invalid-target')$$,'42501','FRANCHISE_MESSAGE_PARTICIPANT_DENIED','cannot add an organization absent from the RFQ');
select set_config('request.jwt.claims','{"sub":"a8900000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_internal_message_thread((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),20)$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','manager of another mandate in the same operator organization cannot read');
select throws_ok($$select public.send_internal_message((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),'b8900000-0000-4000-8000-000000000001','Interdit','[]','f192-sibling-deny')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','same-organization sibling mandate cannot send');
select set_config('request.jwt.claims','{"sub":"a8900000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((public.get_internal_message_thread((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),20)->'messages'->0->>'sender_alias'),'FRANCHISE','exact franchise viewer can read with the real sender alias');
select throws_ok($$select public.send_internal_message((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),'b8900000-0000-4000-8000-000000000001','Lecture seule','[]','f192-viewer-deny')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','franchise viewer cannot send');
select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((public.get_internal_message_thread((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),20)->'thread'->>'counterparty_alias'),'FRANCHISE','the explicit provider sees the franchise in its shared inbox');
insert into functional_results values('PROVIDER_REPLY',public.send_internal_message((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),'f1541000-0000-4000-8000-000000000002','Les étapes sont confirmées.','[]','f192-provider-reply'));
select is((select value->>'outcome'from functional_results where kind='PROVIDER_REPLY'),'INTERNAL_MESSAGE_SENT','the invited provider can reply through the existing messaging command');
select set_config('request.jwt.claims','{"sub":"f1540000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_internal_message_thread((select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE'),20)$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','client cannot read the separate franchise/provider conversation');
reset role;
select is((select count(*)from public.internal_message_participants where thread_id=(select(value->>'thread_id')::uuid from functional_results where kind='FRANCHISE')),2::bigint,'new conversation has exactly two explicit participants');
select is((select count(*)from public.internal_message_participants where thread_id=(select(value->>'thread_id')::uuid from functional_results where kind='PRIVATE')),2::bigint,'private RFQ conversation participants are unchanged');
select is((select count(*)from public.audit_events where action='franchise.messaging.thread_opened'and resource_id=(select value->>'thread_id'from functional_results where kind='FRANCHISE')),1::bigint,'one audit event is emitted for opening');
select is((select count(*)from public.event_outbox where event_type='FranchiseMessageThreadOpenedV1'and aggregate_id=(select value->>'thread_id'from functional_results where kind='FRANCHISE')),1::bigint,'one outbox event is emitted for opening');
select ok(not has_function_privilege('anon','public.open_franchise_rfq_message_thread(uuid,uuid,uuid,text,text,uuid)','EXECUTE'),'anonymous opening is denied');
select * from finish();rollback;
