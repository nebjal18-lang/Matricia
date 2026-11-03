begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-scan-fixture-0134',configured_at=clock_timestamp()where singleton;

select plan(62);

select has_function('private','protect_delivery_proof_content',array[]::text[],'proof content guard exists');
select isnt_empty($$select 1 from pg_trigger where tgrelid='public.delivery_proofs'::regclass and tgname='delivery_proofs_immutable' and not tgisinternal$$,'proof immutability trigger remains installed');
select isnt_empty($$select 1 from pg_get_functiondef('private.protect_delivery_proof_content()'::regprocedure) d where d like '%auth.role() is distinct from ''service_role''%' and d like '%new.evidence_hash is distinct from old.evidence_hash%'$$,'only the scanner may change verdict fields and evidence content stays immutable');
select isnt_empty($$select 1 from pg_get_functiondef('public.record_delivery_proof_scan_result(uuid,text,text,text,text,text,uuid)'::regprocedure) d where d like '%update public.delivery_proofs set scan_status=%'$$,'trusted scan command records its verdict');
select isnt_empty($$select 1 from pg_get_functiondef('private.require_clean_delivery_proofs()'::regprocedure) d where d like '%new.proof_required and not exists%' and d like '%proof.scan_status <> ''CLEAN''%'$$,'acceptance requires present and clean current-version proof');

select has_function('public','submit_mission_milestone',array['uuid','integer','text','uuid'],'provider milestone submission RPC exists');
select has_function('public','decide_mission_milestone',array['uuid','integer','text','text','text','uuid'],'client milestone decision RPC exists');
select is_definer('public','submit_mission_milestone',array['uuid','integer','text','uuid'],'milestone submission is server authorized');
select is_definer('public','decide_mission_milestone',array['uuid','integer','text','text','text','uuid'],'milestone decision is server authorized');
select function_privs_are('public','submit_mission_milestone',array['uuid','integer','text','uuid'],'anon',array[]::text[],'anonymous milestone submission is denied');
select function_privs_are('public','decide_mission_milestone',array['uuid','integer','text','text','text','uuid'],'anon',array[]::text[],'anonymous milestone decision is denied');
select function_privs_are('public','submit_mission_milestone',array['uuid','integer','text','uuid'],'authenticated',array['EXECUTE'],'authenticated actor reaches guarded submit RPC');
select function_privs_are('public','decide_mission_milestone',array['uuid','integer','text','text','text','uuid'],'authenticated',array['EXECUTE'],'authenticated actor reaches guarded decision RPC');
select isnt_empty($$select 1 from pg_get_functiondef('public.submit_mission_milestone(uuid,integer,text,uuid)'::regprocedure) d where d like '%PROVIDER_OWNER%' and d like '%row_version <> p_expected_row_version%' and d like '%begin_contract_command%'$$,'provider ALLOW scope, optimistic lock and replay guard are explicit');
select isnt_empty($$select 1 from pg_get_functiondef('public.decide_mission_milestone(uuid,integer,text,text,text,uuid)'::regprocedure) d where d like '%CLIENT_OWNER%' and d like '%v_milestone.status <> ''SUBMITTED''%' and d like '%begin_contract_command%'$$,'client ALLOW scope, state guard and replay guard are explicit');
select isnt_empty($$select 1 from pg_get_functiondef('public.submit_mission_milestone(uuid,integer,text,uuid)'::regprocedure) d where d like '%audit_events%' and d like '%event_outbox%' and d like '%MissionMilestoneSubmittedV1%'$$,'submission is audited and emits Outbox event');
select isnt_empty($$select 1 from pg_get_functiondef('public.decide_mission_milestone(uuid,integer,text,text,text,uuid)'::regprocedure) d where d like '%audit_events%' and d like '%event_outbox%' and d like '%MissionMilestoneAcceptedV1%'$$,'decision is audited and emits versioned Outbox event');

select isnt_empty($$select 1 from storage.buckets where id='delivery-proofs' and not public and file_size_limit=10485760$$,'proof bucket is private and bounded');
select isnt_empty($$select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='delivery_proof_storage_insert' and with_check ~ 'uid[(][)]' and with_check like '%provider_organization_id%' and with_check like '%DELIVERY_SUBMITTED%'$$,'storage upload binds actor, provider organization and active mission');
select isnt_empty($$select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='delivery_proof_storage_party_read' and qual like '%scan_status = ''CLEAN''%mission_party_access%'$$,'only mission parties can read clean storage proofs');
select has_function('private','bind_delivery_proof_storage',array[]::text[],'storage binding guard exists');
select isnt_empty($$select 1 from pg_trigger where tgrelid='public.delivery_proofs'::regclass and tgname='delivery_proof_storage_binding' and not tgisinternal$$,'proof insertion verifies the real storage object');
select has_function('public','claim_delivery_proof_scan_jobs',array['uuid','integer','integer'],'scanner claim RPC exists');
select has_function('public','complete_delivery_proof_scan_job',array['uuid','uuid','uuid','integer','text','text','text','text','text','uuid'],'scanner completion RPC exists');
select function_privs_are('public','claim_delivery_proof_scan_jobs',array['uuid','integer','integer'],'authenticated',array[]::text[],'authenticated users cannot claim scan jobs');
select function_privs_are('public','claim_delivery_proof_scan_jobs',array['uuid','integer','integer'],'service_role',array['EXECUTE'],'only the trusted service can claim scan jobs');
select isnt_empty($$select 1 from pg_get_functiondef('public.claim_delivery_proof_scan_jobs(uuid,integer,integer)'::regprocedure) d where d like '%for update skip locked%' and d like '%leased_until%' and d like '%row_version%'$$,'scan claims are concurrency-safe leases');
select isnt_empty($$select 1 from pg_get_functiondef('public.complete_delivery_proof_scan_job(uuid,uuid,uuid,integer,text,text,text,text,text,uuid)'::regprocedure) d where d like '%v_claim.lease_token<>p_lease_token%' and d like '%v_claim.row_version<>p_expected_row_version%'$$,'completion verifies worker, lease token and optimistic version');
select has_function('public','fail_delivery_proof_scan_job',array['uuid','uuid','uuid','integer','text','text','uuid'],'scanner retry and DLQ RPC exists');
select isnt_empty($$select 1 from pg_get_functiondef('public.fail_delivery_proof_scan_job(uuid,uuid,uuid,integer,text,text,uuid)'::regprocedure) d where d like '%DELIVERY_PROOF_SCAN_RETRY_SCHEDULED%' and d like '%DELIVERY_PROOF_SCAN_DEAD_LETTERED%' and d like '%2^v_attempt%'$$,'scanner failures use exponential retry before audited dead-letter verdict');
select has_function('public','cleanup_delivery_proof_storage_orphans',array['integer','uuid'],'bounded orphan cleanup RPC exists');
select isnt_empty($$select 1 from pg_get_functiondef('public.cleanup_delivery_proof_storage_orphans(integer,uuid)'::regprocedure) d where d like '%interval ''1 hour''%' and d like '%for update of o skip locked%' and d like '%DeliveryProofOrphanRemovedV1%'$$,'aged orphan cleanup is locked, audited and emits Outbox evidence');
select has_table('private','delivery_proof_scan_retry_history','immutable scanner retry history exists');
select isnt_empty($$select 1 from pg_trigger where tgrelid='private.delivery_proof_scan_retry_history'::regclass and tgname='delivery_proof_scan_retry_history_immutable'$$,'retry history cannot be rewritten');
select isnt_empty($$select 1 from pg_get_functiondef('public.submit_mission_milestone(uuid,integer,text,uuid)'::regprocedure) d where d like '%v_milestone.owner_organization_id <> v_mission.provider_organization_id%'$$,'milestone submit rejects an owner organization mismatch');
select ok(position('begin_contract_command' in pg_get_functiondef('public.submit_mission_milestone(uuid,integer,text,uuid)'::regprocedure)) < position('v_milestone.status not in' in pg_get_functiondef('public.submit_mission_milestone(uuid,integer,text,uuid)'::regprocedure)),'submit replay cache precedes mutable state guards');
select ok(position('begin_contract_command' in pg_get_functiondef('public.decide_mission_milestone(uuid,integer,text,text,text,uuid)'::regprocedure)) < position('v_milestone.status <> ''SUBMITTED''' in pg_get_functiondef('public.decide_mission_milestone(uuid,integer,text,text,text,uuid)'::regprocedure)),'decision replay cache precedes mutable state guards');
select ok(position('begin_contract_command' in pg_get_functiondef('public.accept_delivery(uuid,jsonb,text,uuid)'::regprocedure)) < position('d.status<>''SUBMITTED''' in pg_get_functiondef('public.accept_delivery(uuid,jsonb,text,uuid)'::regprocedure)),'delivery acceptance replay cache precedes mutable status guard');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('fd100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p25-client@example.invalid','',now(),'{}','{}',now(),now()),
('fd100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p25-provider@example.invalid','',now(),'{}','{}',now(),now()),
('fd100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p25-foreign@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('fd110000-0000-4000-8000-000000000001','P25 Client','P25 Client','ACTIVE','fd100000-0000-4000-8000-000000000001'),
('fd110000-0000-4000-8000-000000000002','P25 Provider','P25 Provider','ACTIVE','fd100000-0000-4000-8000-000000000002'),
('fd110000-0000-4000-8000-000000000003','P25 Foreign','P25 Foreign','ACTIVE','fd100000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status) values
('fd120000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','ACTIVE'),
('fd120000-0000-4000-8000-000000000002','fd110000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000002','ACTIVE'),
('fd120000-0000-4000-8000-000000000003','fd110000-0000-4000-8000-000000000003','fd100000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values
('fd120000-0000-4000-8000-000000000001','CLIENT_OWNER'),('fd120000-0000-4000-8000-000000000002','PROVIDER_OWNER'),('fd120000-0000-4000-8000-000000000003','CLIENT_OWNER');
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by) values('fd130000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','ACTIVE',1,'fd100000-0000-4000-8000-000000000001');
-- This test exercises mission/proof behavior, not quote selection. Seed only the
-- immutable FK target while replication role bypasses its unrelated upstream graph.
set local session_replication_role=replica;
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)values('fd150000-0000-4000-8000-000000000001','fd151000-0000-4000-8000-000000000001','fd152000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002',1,'SUBMITTED','Fixture mission P25','MAD','Solution fixture','["Livrable"]','Garantie fixture','Corrections fixture',current_date,1,clock_timestamp()+interval'1 day',10000,0,10000,0,'{}',repeat('f',64),clock_timestamp(),'fd100000-0000-4000-8000-000000000002');
set local session_replication_role=origin;
alter table public.contract_versions disable trigger contract_versions_bind_selected_quote;
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by) values('fd140000-0000-4000-8000-000000000001','fd130000-0000-4000-8000-000000000001',1,'fd150000-0000-4000-8000-000000000001','{}','{"quote_version_id":"fd150000-0000-4000-8000-000000000001"}','{}',10000,'MAD','{}',repeat('a',64),'Fixture comportementale','fd100000-0000-4000-8000-000000000001');
alter table public.contract_versions enable trigger contract_versions_bind_selected_quote;
insert into public.missions(id,contract_id,contract_version_id,client_organization_id,provider_organization_id,status,started_at,created_by) values('fd160000-0000-4000-8000-000000000001','fd130000-0000-4000-8000-000000000001','fd140000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','ACTIVE',now(),'fd100000-0000-4000-8000-000000000001');
insert into public.mission_milestones(id,mission_id,milestone_key,title_fr,title_ar,sort_order,owner_organization_id) values('fd170000-0000-4000-8000-000000000001','fd160000-0000-4000-8000-000000000001','M1','Jalon','مرحلة',1,'fd110000-0000-4000-8000-000000000002');
select throws_ok($$insert into public.mission_milestones(mission_id,milestone_key,title_fr,title_ar,sort_order,owner_organization_id) values('fd160000-0000-4000-8000-000000000001','BAD','Bad','سيئ',2,'fd110000-0000-4000-8000-000000000003')$$,'23514'::char(5),'MILESTONE_OWNER_MUST_BE_MISSION_PARTY','a milestone owner must be one of the mission parties');
insert into public.deliverables(id,mission_id,milestone_id,deliverable_key,label_fr,label_ar,proof_required,current_version,status) values('fd180000-0000-4000-8000-000000000001','fd160000-0000-4000-8000-000000000001','fd170000-0000-4000-8000-000000000001','D1','Livrable','تسليم',true,1,'SUBMITTED');
grant usage on schema extensions to authenticated,service_role;grant execute on all functions in schema extensions to authenticated,service_role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) values('delivery-proofs','fd100000-0000-4000-8000-000000000002/fd180000-0000-4000-8000-000000000001/upload.pdf','fd100000-0000-4000-8000-000000000002','{}')$$,'provider owner uploads against its active mission');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata)values('delivery-proofs','fd100000-0000-4000-8000-000000000003/fd180000-0000-4000-8000-000000000001/forged-actor.pdf','fd100000-0000-4000-8000-000000000002','{}')$$,'42501'::char(5),'new row violates row-level security policy for table "objects"','provider cannot forge another actor storage prefix');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) values('delivery-proofs','fd100000-0000-4000-8000-000000000003/fd180000-0000-4000-8000-000000000001/foreign.pdf','fd100000-0000-4000-8000-000000000003','{}')$$,'42501'::char(5),'new row violates row-level security policy for table "objects"','foreign tenant cannot upload proof for provider mission');
reset role;
insert into public.delivery_versions(id,deliverable_id,version,description,content_hash,submitted_by) values('fd190000-0000-4000-8000-000000000001','fd180000-0000-4000-8000-000000000001',1,'Preuve P25',repeat('b',64),'fd100000-0000-4000-8000-000000000002');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into storage.objects(bucket_id,name,owner_id,metadata)values('delivery-proofs','fd100000-0000-4000-8000-000000000002/fd180000-0000-4000-8000-000000000001/proof.pdf','fd100000-0000-4000-8000-000000000002','{"mimetype":"application/pdf","size":20}');
insert into public.delivery_proofs(id,delivery_version_id,proof_type,storage_path,evidence_hash,metadata,created_by) values('fd200000-0000-4000-8000-000000000001','fd190000-0000-4000-8000-000000000001','DOCUMENT','fd100000-0000-4000-8000-000000000002/fd180000-0000-4000-8000-000000000001/proof.pdf',repeat('b',64),'{"mime_type":"application/pdf"}','fd100000-0000-4000-8000-000000000002');

insert into public.acceptance_checklists(mission_id,deliverable_id,criterion_key) values('fd160000-0000-4000-8000-000000000001','fd180000-0000-4000-8000-000000000001','QUALITY');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((public.submit_mission_milestone('fd170000-0000-4000-8000-000000000001',1,'p25-submit-replay')->>'outcome'),'MILESTONE_SUBMITTED','provider owner submits its own milestone');
select is((public.submit_mission_milestone('fd170000-0000-4000-8000-000000000001',1,'p25-submit-replay')->>'outcome'),'MILESTONE_SUBMITTED','submission replay returns cached success after state changed');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.submit_mission_milestone('fd170000-0000-4000-8000-000000000001',2,'p25-foreign-deny')$$,'42501'::char(5),'MILESTONE_SUBMIT_DENIED','foreign tenant cannot submit milestone');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.decide_mission_milestone('fd170000-0000-4000-8000-000000000001',2,'ACCEPTED','Validation client','p25-decide-before-delivery')$$,'55000'::char(5),'MILESTONE_DELIVERABLES_NOT_ACCEPTED','client cannot accept milestone before its delivery is accepted');
select throws_ok($$select public.accept_delivery('fd180000-0000-4000-8000-000000000001','[{"criterion_key":"QUALITY","status":"COMPLIANT","comment":"OK","evidence":[]}]','p25-accept-before-scan')$$,'55000'::char(5),'CLEAN_DELIVERY_PROOF_SCAN_REQUIRED','acceptance is blocked before a trusted clean verdict');
reset role;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role","aal":"aal2"}',true);
create temporary table p25_scan_claim on commit drop as select * from public.claim_delivery_proof_scan_jobs('fd210000-0000-4000-8000-000000000001',10,300) where proof_id='fd200000-0000-4000-8000-000000000001';
select is((select count(*)::integer from p25_scan_claim),1,'trusted worker claims one pending proof');
select throws_ok($$select public.complete_delivery_proof_scan_job('fd200000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000099','fd210000-0000-4000-8000-000000000001',(select row_version from p25_scan_claim),'CLEAN','TEST_AV','1.0',repeat('b',64),'p25-scan-clean')$$,'55000'::char(5),'DELIVERY_PROOF_SCAN_LEASE_INVALID','wrong lease token cannot complete scan');
select is((public.fail_delivery_proof_scan_job('fd200000-0000-4000-8000-000000000001',(select lease_token from p25_scan_claim),'fd210000-0000-4000-8000-000000000001',(select row_version from p25_scan_claim),'SCANNER_UNAVAILABLE',repeat('b',64))->>'outcome'),'DELIVERY_PROOF_SCAN_RETRY_SCHEDULED','scanner failure schedules non-terminal retry');
reset role;
select is((select count(*)::integer from private.delivery_proof_scan_retry_history where proof_id='fd200000-0000-4000-8000-000000000001'),1,'retry appends immutable history');
update private.delivery_proof_scan_claims set leased_until=clock_timestamp()-interval '1 second' where proof_id='fd200000-0000-4000-8000-000000000001';set local role service_role;select set_config('request.jwt.claims','{"role":"service_role","aal":"aal2"}',true);
create temporary table p25_scan_claim_retry on commit drop as select * from public.claim_delivery_proof_scan_jobs('fd210000-0000-4000-8000-000000000002',10,300) where proof_id='fd200000-0000-4000-8000-000000000001';
select ok((select row_version>(select row_version from p25_scan_claim) from p25_scan_claim_retry),'retry obtains a new optimistic lease version after backoff');
select is((public.complete_delivery_proof_scan_job('fd200000-0000-4000-8000-000000000001',(select lease_token from p25_scan_claim_retry),'fd210000-0000-4000-8000-000000000002',(select row_version from p25_scan_claim_retry),'CLEAN','TEST_AV','1.0',repeat('b',64),'p25-scan-clean')->>'result'),'CLEAN','retried valid lease records clean verdict');
select is((public.record_delivery_proof_scan_result('fd200000-0000-4000-8000-000000000001','CLEAN','TEST_AV','1.0',repeat('b',64),'p25-scan-clean')->>'result'),'CLEAN','scan result replay is idempotent');
reset role;
select is((select scan_status from public.delivery_proofs where id='fd200000-0000-4000-8000-000000000001'),'CLEAN','trusted verdict projects onto proof');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((public.accept_delivery('fd180000-0000-4000-8000-000000000001','[{"criterion_key":"QUALITY","status":"COMPLIANT","comment":"OK","evidence":[]}]','p25-accept-after-scan')->>'outcome'),'DELIVERY_ACCEPTED','client accepts after clean trusted scan');
select is((public.accept_delivery('fd180000-0000-4000-8000-000000000001','[{"criterion_key":"QUALITY","status":"COMPLIANT","comment":"OK","evidence":[]}]','p25-accept-after-scan')->>'outcome'),'DELIVERY_ACCEPTED','delivery acceptance replay returns cached success after status changed');
select is((public.decide_mission_milestone('fd170000-0000-4000-8000-000000000001',2,'ACCEPTED','Validation client','p25-decide-replay')->>'outcome'),'MILESTONE_ACCEPTED','client decides milestone after associated delivery acceptance');
select is((public.decide_mission_milestone('fd170000-0000-4000-8000-000000000001',2,'ACCEPTED','Validation client','p25-decide-replay')->>'outcome'),'MILESTONE_ACCEPTED','decision replay returns cached success');
reset role;
select ok((select count(*)>=4 from public.audit_events where organization_id='fd110000-0000-4000-8000-000000000001' and resource_id in('fd170000-0000-4000-8000-000000000001','fd200000-0000-4000-8000-000000000001','fd180000-0000-4000-8000-000000000001')),'sensitive transitions append audit evidence');
select ok((select count(*)>=4 from public.event_outbox where organization_id='fd110000-0000-4000-8000-000000000001' and event_type in('MissionMilestoneSubmittedV1','MissionMilestoneAcceptedV1','DeliveryProofScanCleanV1','DeliveryAcceptedV1')),'sensitive transitions append versioned Outbox events');
select is((select count(*)::integer from private.delivery_proof_scan_idempotency where proof_id='fd200000-0000-4000-8000-000000000001'),1,'scan replay creates one immutable idempotency record');

select * from finish();
rollback;
