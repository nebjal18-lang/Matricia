begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select plan(22);
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','delivery-admin-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=4 then'SUPPORT_AGENT'else'MATRICIA_ADMIN'end from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b1810000-0000-4000-8000-000000000001','Delivery Test','Delivery Test','ACTIVE','a1810000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c1810000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c1810000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1810000-0000-4000-8000-000000000001','PROVIDER_OWNER');


insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)values('b1810000-0000-4000-8000-000000000001','ICE','124000000000001','VERIFIED',true),('b1810000-0000-4000-8000-000000000001','IF','IF124','VERIFIED',true),('b1810000-0000-4000-8000-000000000001','RC','RC124','VERIFIED',true);
-- Seed a previously verified account, with genuine immutable profile/trial
-- rows. Only historical setup bypasses decision triggers; all commands below
-- execute with triggers and authorization restored.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','VERIFIED',1,'a1810000-0000-4000-8000-000000000004',now()-interval'10 days',now()-interval'10 days');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001',1,'{"if_number":"IF124","rc_number":"RC124"}','{"legal_name":"Delivery Test","display_name":"Delivery Test","country_code":"MA","identifiers":{"ICE":"124000000000001","IF":"IF124","RC":"RC124"}}',1,'a1810000-0000-4000-8000-000000000004');
insert into public.client_trials(organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('b1810000-0000-4000-8000-000000000001','f1940000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',now()-interval'10 days',now()+interval'20 days','a1810000-0000-4000-8000-000000000003');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001',1,now()-interval'10 days','a1810000-0000-4000-8000-000000000003','HISTORICAL_TRIAL');
set local session_replication_role=origin;
create temporary table old_trial as select*from public.client_trials where organization_id='b1810000-0000-4000-8000-000000000001';
insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)values
('e1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','MANUAL_EXCEPTION','DEVELOPMENT','ORGANIZATION','b1810000-0000-4000-8000-000000000001',repeat('a',64),'{"intent":"CHANGE_CONFIGURATION","expectedRowVersion":1,"expectedIce":"124000000000001","ice":"124000000000002","legalName":"Delivery Test Nouvelle Identité","displayName":"Delivery Test","country":"MA","status":"ACTIVE"}','Changer identité après deux contrôles indépendants',2,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'),
('e1940000-0000-4000-8000-000000000002',null,'CHANGE_CONFIGURATION','DEVELOPMENT','ORGANIZATION','b1940000-0000-4000-8000-000000000002',repeat('a',64),'{"intent":"CREATE_ORGANIZATION","ice":"124000000000002","legalName":"Doublon interdit","displayName":"Doublon"}','Tester le refus du doublon de société canonique',1,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'),
('e1940000-0000-4000-8000-000000000003','b1810000-0000-4000-8000-000000000001','MANUAL_EXCEPTION','DEVELOPMENT','ORGANIZATION','b1810000-0000-4000-8000-000000000001',repeat('a',64),'{"intent":"CHANGE_CONFIGURATION","expectedRowVersion":1,"expectedIce":"124000000000001","ice":"124000000000003","legalName":"Ne doit pas changer"}','Refuser une commande dont identité approuvée est périmée',2,'AUTHORIZED','a1810000-0000-4000-8000-000000000001');
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)select x.id,'APPROVE','Contrôle indépendant de test',x.request_payload_hash,u.id from public.admin_operational_action_requests x cross join auth.users u where x.id in('e1940000-0000-4000-8000-000000000001','e1940000-0000-4000-8000-000000000002','e1940000-0000-4000-8000-000000000003')and u.id in('a1810000-0000-4000-8000-000000000002','a1810000-0000-4000-8000-000000000003');
create temporary table observed(k text,v jsonb);grant all on observed to service_role;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.sub','',true);
insert into observed values('change',public.execute_admin_operational_action_v1('e1940000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));
insert into observed values('retry',public.execute_admin_operational_action_v1('e1940000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));
insert into observed values('duplicate',public.execute_admin_operational_action_v1('e1940000-0000-4000-8000-000000000002',extensions.gen_random_uuid()));
insert into observed values('stale',public.execute_admin_operational_action_v1('e1940000-0000-4000-8000-000000000003',extensions.gen_random_uuid()));
reset role;
select is((select v->>'outcome'from observed where k='change'),'ADMIN_ACTION_EXECUTED','identity change performs the approved canonical mutation');
select is((select normalized_value::text from public.organization_identifiers where organization_id='b1810000-0000-4000-8000-000000000001'and identifier_type='ICE'and is_active),'124000000000002','new ICE is canonical');
select is((select count(*)from public.organization_identifiers where organization_id='b1810000-0000-4000-8000-000000000001'and is_active and verification_status='PENDING'),3::bigint,'all identity identifiers require renewed verification');
select is((select status from public.client_compliance_cases where id='f1940000-0000-4000-8000-000000000001'),'DOCUMENTS_REQUIRED','review is reopened explicitly');
select is((select current_profile_version from public.client_compliance_cases where id='f1940000-0000-4000-8000-000000000001'),2,'one new immutable profile version is appended');
select is((select status from public.organizations where id='b1810000-0000-4000-8000-000000000001'),'PENDING','new business rights await current verification');
select ok(exists(select 1 from public.client_administrative_anomalies where compliance_case_id='f1940000-0000-4000-8000-000000000001'and anomaly_code='ICE_NOT_VERIFIED'and blocking and status='OPEN'),'identity anomaly blocks entitlement guards');
select ok((select to_jsonb(t)=to_jsonb(o)from public.client_trials t cross join old_trial o where t.organization_id=o.organization_id),'historical trial is unchanged including its deadline and verified version');
select is((select count(*)from public.client_profile_versions where compliance_case_id='f1940000-0000-4000-8000-000000000001'),2::bigint,'execution replay never appends another version');
select is((select v->>'outcome'from observed where k='duplicate'),'ADMIN_ACTION_FAILED','canonical ICE duplication fails closed');
select ok(not exists(select 1 from public.organizations where id='b1940000-0000-4000-8000-000000000002'),'duplicate transaction leaves no partial organization');
select is((select v->>'outcome'from observed where k='stale'),'ADMIN_ACTION_FAILED','a stale approved identity cannot execute');
select ok(not exists(select 1 from public.organization_identifiers where normalized_value='124000000000003'),'stale identity rollback leaves no identifier');
select throws_ok($$update public.client_profile_versions set profile_data='{}'where compliance_case_id='f1940000-0000-4000-8000-000000000001'$$,'55000','IMMUTABLE_RECORD','old and new profile history remain immutable');
select throws_ok($$update public.client_identity_verification_history set profile_version=2 where compliance_case_id='f1940000-0000-4000-8000-000000000001'$$,'55000','CLIENT_HISTORY_IMMUTABLE','verification anchors remain immutable');


-- Privileged fixture seeds the already-scanned/reviewed supporting evidence;
-- the actual revalidation RPC and every domain trigger remain enabled.
set local session_replication_role=replica;
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('b1770000-0000-0000-0000-000000000001','f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b1810000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a1810000-0000-4000-8000-000000000002',clock_timestamp(),'a1810000-0000-4000-8000-000000000004'),
('b1770000-0000-0000-0000-000000000002','f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b1810000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a1810000-0000-4000-8000-000000000002',clock_timestamp(),'a1810000-0000-4000-8000-000000000004');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('b1780000-0000-0000-0000-000000000001','b1770000-0000-0000-0000-000000000001','b1810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b1790000-0000-0000-0000-000000000001'),
('b1780000-0000-0000-0000-000000000002','b1770000-0000-0000-0000-000000000002','b1810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b1790000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'b1770000-0000-0000-0000-000000000001' then 'b1780000-0000-0000-0000-000000000001'::uuid
  else 'b1780000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('b1770000-0000-0000-0000-000000000001','b1770000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a1810000-0000-4000-8000-000000000002',clock_timestamp(),'a1810000-0000-4000-8000-000000000004','b1770000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a1810000-0000-4000-8000-000000000002',clock_timestamp(),'a1810000-0000-4000-8000-000000000004','b1770000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


set local session_replication_role=origin;
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='b1810000-0000-4000-8000-000000000001'and is_active;
update public.client_administrative_anomalies set status='RESOLVED',resolved_by='a1810000-0000-4000-8000-000000000002',resolved_at=clock_timestamp()where compliance_case_id='f1940000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000004',true);
update public.client_compliance_cases set status='UNDER_REVIEW',current_profile_version=1 where id='f1940000-0000-4000-8000-000000000001';
set local role authenticated;select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.decide_client_compliance('f1940000-0000-4000-8000-000000000001','VERIFIED','Révision indépendante de test','fixture-identity194-wrong-profile')$$,'55000','CLIENT_CURRENT_IDENTITY_SNAPSHOT_MISMATCH','old identity profile cannot be reverified for the new canonical ICE');
reset role;
select is((select status from public.organizations where id='b1810000-0000-4000-8000-000000000001'),'PENDING','failed revalidation rolls back premature organization activation');
update public.client_compliance_cases set current_profile_version=2 where id='f1940000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.decide_client_compliance('f1940000-0000-4000-8000-000000000001','VERIFIED','Révision indépendante de la nouvelle identité','fixture-identity194-correct-profile')$$,'authorized current identity can be verified through the real compliance command');
reset role;
select is((select status from public.client_compliance_cases where id='f1940000-0000-4000-8000-000000000001'),'VERIFIED','only the current correct profile completes revalidation');
select ok((select to_jsonb(t)=to_jsonb(o)from public.client_trials t cross join old_trial o where t.organization_id=o.organization_id),'successful revalidation preserves the original trial without a new deadline');
select is((select profile_version from public.client_identity_verification_history where organization_id='b1810000-0000-4000-8000-000000000001'order by verified_at desc limit 1),2,'new verification creates the correct immutable as-of anchor');
select is((select count(*)from public.event_outbox where organization_id='b1810000-0000-4000-8000-000000000001'and event_type='TrialStartedV1'),0::bigint,'reverification does not emit a second trial-start event');
select*from finish();rollback;
