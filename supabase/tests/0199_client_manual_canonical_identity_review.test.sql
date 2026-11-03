begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select plan(10);
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','delivery-admin-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=4 then'SUPPORT_AGENT'else'MATRICIA_ADMIN'end from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b1810000-0000-4000-8000-000000000001','Delivery Test','Delivery Test','ACTIVE','a1810000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c1810000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c1810000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1810000-0000-4000-8000-000000000001','PROVIDER_OWNER');


insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)values('b1810000-0000-4000-8000-000000000001','ICE','124000000000001','VERIFIED',true),('b1810000-0000-4000-8000-000000000001','IF','12345678','VERIFIED',true),('b1810000-0000-4000-8000-000000000001','RC','TEST124','VERIFIED',true);
-- Seed a previously verified account, with genuine immutable profile/trial
-- rows. Only historical setup bypasses decision triggers; all commands below
-- execute with triggers and authorization restored.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','VERIFIED',1,'a1810000-0000-4000-8000-000000000004',now()-interval'10 days',now()-interval'10 days');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001',1,'{"if_number":"12345678","rc_number":"TEST124"}','{"legal_name":"Delivery Test","display_name":"Delivery Test","country_code":"MA","identifiers":{"ICE":"124000000000001","IF":"12345678","RC":"TEST124"}}',1,'a1810000-0000-4000-8000-000000000004');
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


insert into public.client_compliance_documents(id,compliance_case_id,organization_id,document_type,version,policy_version_id,document_number,issuer,issued_on,expires_on,original_file_name,file_extension,declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by,current_scan_result_id,scan_status,scanned_at)
select'f1990000-0000-4000-8000-000000000001',compliance_case_id,organization_id,'TAX_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='TAX_DOCUMENT'and status='ACTIVE'),'TAX-199',issuer,issued_on,expires_on,'tax199.pdf',file_extension,declared_mime_type,declared_size_bytes,repeat('c',64),'b1810000-0000-4000-8000-000000000001/fixture199/tax199.pdf',detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by,'f1990000-0000-4000-8000-000000000002','CLEAN',clock_timestamp()from public.client_compliance_documents where id='b1770000-0000-0000-0000-000000000001';
insert into private.client_document_scan_results(id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id)values('f1990000-0000-4000-8000-000000000002','f1990000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('c',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE',extensions.gen_random_uuid());
set local session_replication_role=origin;

create temporary table identity_results(k text,v jsonb);grant all on identity_results to authenticated;
set local role authenticated;select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into identity_results values('context',public.get_client_identity_review_context_v1('f1940000-0000-4000-8000-000000000001'));
select throws_ok($$select public.review_client_canonical_identifiers_v1('f1940000-0000-4000-8000-000000000001',null,(select(v->>'profile_version')::integer from identity_results where k='context'),(select v->>'identity_hash'from identity_results where k='context'),array(select(d->>'id')::uuid from identity_results,jsonb_array_elements(v->'identity_snapshot'->'documents')d where k='context'),'Refuser un CAS manquant dans la fixture','fixture-client-identity199-null-cas')$$,'22023','INVALID_CLIENT_IDENTITY_REVIEW','nullable expected case version cannot bypass optimistic concurrency');
insert into identity_results select'review',public.review_client_canonical_identifiers_v1('f1940000-0000-4000-8000-000000000001',(v->>'case_row_version')::integer,(v->>'profile_version')::integer,v->>'identity_hash',array(select(d->>'id')::uuid from jsonb_array_elements(v->'identity_snapshot'->'documents')d),'Contrôle humain synthétique sur trois pièces de fixture','fixture-client-identity199-review')from identity_results where k='context';
insert into identity_results select'replay',public.review_client_canonical_identifiers_v1('f1940000-0000-4000-8000-000000000001',(v->>'case_row_version')::integer,(v->>'profile_version')::integer,v->>'identity_hash',array(select(d->>'id')::uuid from jsonb_array_elements(v->'identity_snapshot'->'documents')d),'Contrôle humain synthétique sur trois pièces de fixture','fixture-client-identity199-review')from identity_results where k='context';
reset role;
select is((select v->>'outcome'from identity_results where k='review'),'CLIENT_CANONICAL_IDENTIFIERS_VERIFIED','real manual review verifies canonical identifiers from the current three clean pieces');
select is((select count(*)from public.organization_identifiers where organization_id='b1810000-0000-4000-8000-000000000001'and is_active and verification_status='VERIFIED'),3::bigint,'canonical verification is an actual effect rather than a badge');
select is((select count(*)from public.client_canonical_identity_reviews_v1 where compliance_case_id='f1940000-0000-4000-8000-000000000001'),1::bigint,'replay does not duplicate the immutable human review proof');
select is((select v from identity_results where k='review'),(select v from identity_results where k='replay'),'replay returns the original proof');
set local role authenticated;
select public.evaluate_client_compliance('f1940000-0000-4000-8000-000000000001','fixture-client-identity199-evaluate');
reset role;
select ok(not exists(select 1 from public.client_administrative_anomalies where compliance_case_id='f1940000-0000-4000-8000-000000000001'and anomaly_code in('ICE_NOT_VERIFIED','IF_NOT_VERIFIED','RC_NOT_VERIFIED')and blocking and status in('OPEN','QUESTIONED')),'actual evaluation resolves verified identifier anomalies');
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000004',true);
update public.client_compliance_cases set status='UNDER_REVIEW'where id='f1940000-0000-4000-8000-000000000001';
set local role authenticated;select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.decide_client_compliance('f1940000-0000-4000-8000-000000000001','VERIFIED','Décision propre refusée','fixture-client-identity199-self')$$,'42501','CLIENT_COMPLIANCE_DUAL_CONTROL_REQUIRED','identity reviewer cannot approve final activation');
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.decide_client_compliance('f1940000-0000-4000-8000-000000000001','VERIFIED','Revue finale indépendante de fixture','fixture-client-identity199-final')$$,'independent final decision succeeds after manual identity review and evaluation');
reset role;
select is((select status from public.client_compliance_cases where id='f1940000-0000-4000-8000-000000000001'),'VERIFIED','complete chain reaches real verification');
select ok((select to_jsonb(t)=to_jsonb(o)from public.client_trials t cross join old_trial o where t.organization_id=o.organization_id),'identity revalidation never restarts the historical trial');
select*from finish();rollback;
