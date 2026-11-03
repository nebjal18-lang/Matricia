begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select plan(41);
-- TEST-only identities and prerequisites; all effects roll back, all guards stay enabled.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at) values
('f3630000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','network-owner@example.invalid',now(),now(),now()),
('f3630000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','network-recipient@example.invalid',now(),now(),now()),
('f3630000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','network-other@example.invalid',now(),now(),now()),
('f3630000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','network-viewer@example.invalid',now(),now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('f3631000-0000-4000-8000-000000000001','Opérateur réseau TEST','Opérateur réseau TEST','ACTIVE','f3630000-0000-4000-8000-000000000001'),
('f3631000-0000-4000-8000-000000000002','Client réseau TEST','Client réseau TEST','ACTIVE','f3630000-0000-4000-8000-000000000002'),
('f3631000-0000-4000-8000-000000000003','Autre réseau TEST','Autre réseau TEST','ACTIVE','f3630000-0000-4000-8000-000000000003');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values
('f3632000-0000-4000-8000-000000000001','NETWORK_INVITE_TEST','network-invite-test','f3631000-0000-4000-8000-000000000001','DRAFT','f3630000-0000-4000-8000-000000000001');
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by) values
('f3633000-0000-4000-8000-000000000001','f3632000-0000-4000-8000-000000000001','f3631000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','NETWORK_TEST_A','ACTIVE','f3630000-0000-4000-8000-000000000001'),
('f3633000-0000-4000-8000-000000000002','f3632000-0000-4000-8000-000000000001','f3631000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','NETWORK_TEST_B','ACTIVE','f3630000-0000-4000-8000-000000000003');
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by) values
('f3634000-0000-4000-8000-000000000001','f3633000-0000-4000-8000-000000000001',1,'NETWORK_TEST_A','Territoire test A','نطاق الاختبار أ','{}',now()-interval '1 day',repeat('1',64),'f3630000-0000-4000-8000-000000000001'),
('f3634000-0000-4000-8000-000000000002','f3633000-0000-4000-8000-000000000002',1,'NETWORK_TEST_B','Territoire test B','نطاق الاختبار ب','{}',now()-interval '1 day',repeat('2',64),'f3630000-0000-4000-8000-000000000003');
insert into public.franchise_economic_rule_versions(id,franchise_type,version,entry_fee_minor,currency,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,status) values
('f3637000-0000-4000-8000-000000000001','STANDARD',3630,100000,'MAD',5000,2500,2500,'DISTRIBUTABLE_PROFIT',current_date-1,'ACTIVE');
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by) values
('f3635000-0000-4000-8000-000000000001','f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','f3637000-0000-4000-8000-000000000001',1,'ACTIVE','{}','{}','{"mode":"TEST_ONLY"}',100000,'UPFRONT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval '1 day',repeat('a',64),'f3630000-0000-4000-8000-000000000001'),
('f3635000-0000-4000-8000-000000000002','f3633000-0000-4000-8000-000000000002','f3634000-0000-4000-8000-000000000002','f3637000-0000-4000-8000-000000000001',1,'ACTIVE','{}','{}','{"mode":"TEST_ONLY"}',100000,'UPFRONT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval '1 day',repeat('b',64),'f3630000-0000-4000-8000-000000000003');
update public.franchises set current_mandate_version_id=case when id='f3633000-0000-4000-8000-000000000001' then 'f3635000-0000-4000-8000-000000000001'::uuid else 'f3635000-0000-4000-8000-000000000002'::uuid end where id in ('f3633000-0000-4000-8000-000000000001','f3633000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
('f3636000-0000-4000-8000-000000000001','f3631000-0000-4000-8000-000000000001','f3630000-0000-4000-8000-000000000001','ACTIVE',now()),
('f3636000-0000-4000-8000-000000000002','f3631000-0000-4000-8000-000000000002','f3630000-0000-4000-8000-000000000002','ACTIVE',now()),
('f3636000-0000-4000-8000-000000000003','f3631000-0000-4000-8000-000000000001','f3630000-0000-4000-8000-000000000003','ACTIVE',now()),
('f3636000-0000-4000-8000-000000000004','f3631000-0000-4000-8000-000000000003','f3630000-0000-4000-8000-000000000003','ACTIVE',now()),
('f3636000-0000-4000-8000-000000000005','f3631000-0000-4000-8000-000000000001','f3630000-0000-4000-8000-000000000004','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code,franchise_id) values
('f3636000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','f3633000-0000-4000-8000-000000000001'),
('f3636000-0000-4000-8000-000000000002','CLIENT_OWNER',null),
('f3636000-0000-4000-8000-000000000003','FRANCHISE_MANAGER','f3633000-0000-4000-8000-000000000002'),
('f3636000-0000-4000-8000-000000000004','CLIENT_OWNER',null),
('f3636000-0000-4000-8000-000000000005','FRANCHISE_VIEWER','f3633000-0000-4000-8000-000000000001');
create temporary table network_inputs(kind text primary key,rows jsonb);
insert into network_inputs values('VALID','[{"invitation_id":"f3638000-0000-4000-8000-000000000001","token_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","display_name":"Destinataire TEST","contact_email":"network-recipient@example.invalid","organization_name":"Client réseau","source_code":"INVITE","phone":"","locale":"ar"},{"invitation_id":"f3638000-0000-4000-8000-000000000002","token_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","display_name":"Doublon normalisé TEST","contact_email":"NETWORK-RECIPIENT@example.invalid","organization_name":"Client réseau","source_code":"INVITE","phone":"","locale":"ar"}]');
insert into network_inputs select 'INVALID',jsonb_set(rows,'{1,contact_email}','"invalid"') from network_inputs where kind='VALID';
create temporary table network_results(kind text primary key,value jsonb);
create temporary table network_context(kind text primary key,value text);
grant select on network_inputs to authenticated;
grant select,insert on network_results to authenticated,service_role;
grant select on network_context to authenticated,service_role;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton;
select ok(not has_table_privilege('authenticated','public.franchise_network_invitations','INSERT'),'no direct invitation writes');
select ok(not has_table_privilege('authenticated','private.franchise_network_invitation_tokens','SELECT') and not has_table_privilege('service_role','private.franchise_network_invitation_tokens','SELECT'),'raw token storage is unavailable to API roles');
select ok(not has_function_privilege('service_role','public.queue_franchise_network_invitations_v1(uuid,uuid,text,uuid,jsonb,boolean,text,uuid)','EXECUTE'),'worker cannot create invitations');
select ok(not has_function_privilege('authenticated','public.complete_franchise_network_invitation_delivery_v1(bigint,uuid,text,text)','EXECUTE'),'users cannot claim external email success');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
select throws_ok($$select public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','CLIENT','f3630000-0000-4000-8000-000000000001',(select rows from network_inputs where kind='VALID'),true,'network363-batch')$$,'42501','FRANCHISE_NETWORK_MFA_REQUIRED','AAL1 cannot request an external invitation');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','CLIENT','f3630000-0000-4000-8000-000000000001',(select rows from network_inputs where kind='VALID'),true,'network363-batch')$$,'42501','FRANCHISE_NETWORK_INVITATION_DENIED','viewer cannot request invitations');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','CLIENT','f3630000-0000-4000-8000-000000000001',(select rows from network_inputs where kind='VALID'),true,'network363-batch')$$,'42501','FRANCHISE_NETWORK_INVITATION_DENIED','manager of sibling mandate cannot request invitations');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','CLIENT','f3630000-0000-4000-8000-000000000001',(select rows from network_inputs where kind='VALID'),false,'network363-permission')$$,'22023','FRANCHISE_NETWORK_INVITATION_INVALID','contact permission must be confirmed');
select throws_ok($$select public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000002','CLIENT','f3630000-0000-4000-8000-000000000001',(select rows from network_inputs where kind='VALID'),true,'network363-batch')$$,'22023','FRANCHISE_NETWORK_INVITATION_INVALID','territory belongs to the exact mandate');
select throws_ok($$select public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','CLIENT','f3630000-0000-4000-8000-000000000001',(select rows from network_inputs where kind='INVALID'),true,'network363-batch')$$,'22023','FRANCHISE_NETWORK_INVITATION_INVALID','invalid later CSV row rejects the entire transaction');
reset role;
select is((select count(*) from public.franchise_network_invitations where franchise_id='f3633000-0000-4000-8000-000000000001'),0::bigint,'no partial batch or false sent invitation survives');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into network_results values('QUEUED',public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','CLIENT','f3630000-0000-4000-8000-000000000001',(select rows from network_inputs where kind='VALID'),true,'network363-batch'));
insert into network_results values('REPLAY',public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','CLIENT','f3630000-0000-4000-8000-000000000001',(select rows from network_inputs where kind='VALID'),true,'network363-batch'));
select is((select value from network_results where kind='QUEUED'),(select value from network_results where kind='REPLAY'),'lost-response replay returns the same batch result');
select is((select value->>'created' from network_results where kind='QUEUED'),'1','one normalized recipient queued');
select is((select value->>'skipped' from network_results where kind='QUEUED'),'1','case-insensitive CSV duplicate is explicitly counted');
select throws_ok($$select public.queue_franchise_network_invitations_v1('f3633000-0000-4000-8000-000000000001','f3634000-0000-4000-8000-000000000001','CLIENT','f3630000-0000-4000-8000-000000000001',jsonb_set((select rows from network_inputs where kind='VALID'),'{0,display_name}','"Autre nom"'),true,'network363-batch')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','same key cannot change a batch');
reset role;
select is((select status from public.franchise_network_invitations where id='f3638000-0000-4000-8000-000000000001'),'QUEUED','saving a request does not mean SENT');
select is((select count(*) from public.event_outbox where event_type='FranchiseNetworkInvitationRequestedV1' and aggregate_id='f3638000-0000-4000-8000-000000000001'),1::bigint,'one durable email request after replay');
select ok((select not (payload ? 'token') and not(payload ? 'token_hash') and not(payload ? 'contact_email') from public.event_outbox where event_type='FranchiseNetworkInvitationRequestedV1' and aggregate_id='f3638000-0000-4000-8000-000000000001'),'outbox does not contain token, hash or recipient email');
insert into network_context select 'OUTBOX',id::text from public.event_outbox where event_type='FranchiseNetworkInvitationRequestedV1' and aggregate_id='f3638000-0000-4000-8000-000000000001';
insert into network_context values('ROLES',(select count(*)::text from public.organization_member_roles)),('MEMBERS',(select count(*)::text from public.organization_memberships)),('JOURNALS',(select count(*)::text from public.financial_journals));
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.open_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64))$$,'55000','FRANCHISE_NETWORK_INVITATION_INACTIVE','queued, unsent invitation cannot be opened');
reset role;set local role service_role;
select throws_ok($$select public.load_franchise_network_invitation_delivery_v1(-1,'f3638000-0000-4000-8000-000000000001')$$,'42501','FRANCHISE_NETWORK_EVENT_MISMATCH','forged event envelope is denied');
insert into network_results values('READY',public.load_franchise_network_invitation_delivery_v1((select value::bigint from network_context where kind='OUTBOX'),'f3638000-0000-4000-8000-000000000001'));
select is((select value->>'locale' from network_results where kind='READY'),'ar','requested invitation language is canonical');
reset role;update private.admin_execution_environment_v1 set environment='PRODUCTION' where singleton;set local role service_role;
select throws_ok($$select public.complete_franchise_network_invitation_delivery_v1((select value::bigint from network_context where kind='OUTBOX'),'f3638000-0000-4000-8000-000000000001','demo-message-test','NON_CONTRACTUAL_DEMO')$$,'42501','FRANCHISE_NETWORK_DEMO_FORBIDDEN','production refuses a simulated email');
reset role;update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton;set local role service_role;
select public.complete_franchise_network_invitation_delivery_v1((select value::bigint from network_context where kind='OUTBOX'),'f3638000-0000-4000-8000-000000000001','demo-message-test','NON_CONTRACTUAL_DEMO');
select public.complete_franchise_network_invitation_delivery_v1((select value::bigint from network_context where kind='OUTBOX'),'f3638000-0000-4000-8000-000000000001','demo-message-test','NON_CONTRACTUAL_DEMO');
select throws_ok($$select public.complete_franchise_network_invitation_delivery_v1((select value::bigint from network_context where kind='OUTBOX'),'f3638000-0000-4000-8000-000000000001','another-message','NON_CONTRACTUAL_DEMO')$$,'22000','FRANCHISE_NETWORK_DELIVERY_MISMATCH','worker replay cannot replace provider evidence');
reset role;
select is((select count(*) from public.audit_events where action='franchise.network.invitation_sent' and resource_id='f3638000-0000-4000-8000-000000000001'),1::bigint,'one audited delivery confirmation');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.open_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64))$$,'42501','FRANCHISE_NETWORK_RECIPIENT_DENIED','matching token does not authorize a different account email');
select is((select count(*) from public.franchise_network_invitations),0::bigint,'sibling mandate manager cannot read network invitations');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.open_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('b',64))$$,'42501','FRANCHISE_NETWORK_RECIPIENT_DENIED','recipient email alone cannot replace token verification');
insert into network_results values('OPEN',public.open_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64))); 
select is((select jsonb_array_length(value->'organizations') from network_results where kind='OPEN'),1,'selector includes only the recipient active Client organization');
select is((select value->'organizations'->0->>'id' from network_results where kind='OPEN'),'f3631000-0000-4000-8000-000000000002','selector never offers the operator or another organization');
select throws_ok($$select public.accept_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64),'f3631000-0000-4000-8000-000000000003','network363-accept-foreign')$$,'42501','FRANCHISE_NETWORK_TARGET_DENIED','caller cannot substitute another target organization');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
select throws_ok($$select public.accept_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64),'f3631000-0000-4000-8000-000000000002','network363-accept-aal1')$$,'42501','FRANCHISE_NETWORK_MFA_REQUIRED','referral acceptance requires AAL2');
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into network_results values('ACCEPT',public.accept_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64),'f3631000-0000-4000-8000-000000000002','network363-accept'));
insert into network_results values('ACCEPT_REPLAY',public.accept_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64),'f3631000-0000-4000-8000-000000000002','network363-accept'));
select is((select value from network_results where kind='ACCEPT'),(select value from network_results where kind='ACCEPT_REPLAY'),'acceptance replays the same origin');
select public.accept_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64),'f3631000-0000-4000-8000-000000000002','network363-accept-new-key');
reset role;
select is((select count(*) from public.franchise_network_referrals where invitation_id='f3638000-0000-4000-8000-000000000001'),1::bigint,'origin remains a single immutable referral');
select is((select count(*) from public.audit_events where action='franchise.network.referral_registered' and resource_id='f3638000-0000-4000-8000-000000000001'),1::bigint,'fresh retry key does not duplicate acceptance effects');
select is((select count(*)::text from public.organization_member_roles),(select value from network_context where kind='ROLES'),'no automatic role grant');
select is((select count(*)::text from public.organization_memberships),(select value from network_context where kind='MEMBERS'),'no duplicate organization membership');
select is((select count(*)::text from public.financial_journals),(select value from network_context where kind='JOURNALS'),'no automatic economic entry');
select throws_ok($$delete from public.franchise_network_referrals where invitation_id='f3638000-0000-4000-8000-000000000001'$$,'55000','IMMUTABLE_FRANCHISE_HISTORY','historical referral cannot be removed');
select is((select pipeline_stage from public.franchise_crm_prospects where id=(select prospect_id from public.franchise_network_referrals where invitation_id='f3638000-0000-4000-8000-000000000001')),'REGISTERED','registration does not invent organization verification');
select throws_ok($$update public.franchise_crm_prospects set linked_organization_id='f3631000-0000-4000-8000-000000000003' where id=(select prospect_id from public.franchise_network_referrals where invitation_id='f3638000-0000-4000-8000-000000000001')$$,'23505','FRANCHISE_NETWORK_ORIGIN_ALREADY_RECORDED','a legacy organization-link action cannot replace the accepted source');
update public.franchise_network_invitations set created_at=clock_timestamp()-interval '31 days',expires_at=clock_timestamp()-interval '1 day' where id='f3638000-0000-4000-8000-000000000001';
reset role;select set_config('request.jwt.claims','{"sub":"f3630000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.open_franchise_network_invitation_v1('f3638000-0000-4000-8000-000000000001',repeat('a',64))$$,'55000','FRANCHISE_NETWORK_INVITATION_INACTIVE','expired historical TEST link fails against the real server clock');
reset role;select * from finish();rollback;
