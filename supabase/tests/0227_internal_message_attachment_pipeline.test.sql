begin;set local search_path=public,extensions;
-- Explicit transaction-only environment for synthetic test scanner verdicts.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configured_at=clock_timestamp(),configuration_reference='ROLLBACK-ONLY-SCANNER-TEST'where singleton;select plan(70);
-- Historical RFQ/quote bootstrap only. New draft/upload/scan/send/read behavior uses real governed RPCs.
-- MAT-FUNC-007 / MAT-FUNC-013 behavioral proof. All fixtures and effects roll back.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f2270000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','msg227-client@example.invalid','',now(),'{}','{}',now(),now()),
 ('f2270000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','msg227-provider@example.invalid','',now(),'{}','{}',now(),now()),
 ('f2270000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','msg227-outsider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.organizations(id,legal_name,display_name,status,created_by) values
 ('f2271000-0000-4000-8000-000000000001','Client attachment 227','Client attachment 227','ACTIVE','f2270000-0000-4000-8000-000000000001'),
 ('f2271000-0000-4000-8000-000000000002','Provider A attachment 227','Provider A attachment 227','ACTIVE','f2270000-0000-4000-8000-000000000002'),
 ('f2271000-0000-4000-8000-000000000003','Provider B attachment 227','Provider B attachment 227','ACTIVE','f2270000-0000-4000-8000-000000000002'),
 ('f2271000-0000-4000-8000-000000000004','Outsider attachment 227','Outsider attachment 227','ACTIVE','f2270000-0000-4000-8000-000000000003');

insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
 ('f2272000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000001','f2270000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('f2272000-0000-4000-8000-000000000002','f2271000-0000-4000-8000-000000000002','f2270000-0000-4000-8000-000000000002','ACTIVE',now()),
 ('f2272000-0000-4000-8000-000000000003','f2271000-0000-4000-8000-000000000004','f2270000-0000-4000-8000-000000000003','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) values
 ('f2272000-0000-4000-8000-000000000001','CLIENT_OWNER'),
 ('f2272000-0000-4000-8000-000000000002','PROVIDER_SALES'),
 ('f2272000-0000-4000-8000-000000000003','CLIENT_OWNER');

-- Build a coherent RFQ and two frozen submitted quotes without invoking unrelated
-- catalogue/matching workflows. The behavior under test starts at the public RPCs.

-- Complete relational catalogue/RFQ precondition. All referenced identities exist.
-- Historical invitations predate the current eligibility gate; only their insert below
-- preserves that historical context. No eligibility, legal or scan approval is asserted.
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f2273100-0000-4000-8000-000000000001','MSG227_LIBRARY','msg227-library','f2271000-0000-4000-8000-000000000001','DRAFT','f2270000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values('f2273110-0000-4000-8000-000000000001','f2273100-0000-4000-8000-000000000001','MSG227_CATEGORY','msg227-category','DRAFT','f2270000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values('f2273120-0000-4000-8000-000000000001','f2273100-0000-4000-8000-000000000001','f2273110-0000-4000-8000-000000000001','MSG227_SUBCATEGORY','msg227-subcategory','DRAFT','f2270000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values('f2273200-0000-4000-8000-000000000001','f2273100-0000-4000-8000-000000000001','f2273120-0000-4000-8000-000000000001','MSG227_SERVICE','msg227-service','DRAFT','f2270000-0000-4000-8000-000000000001');
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values
 ('f2273000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000001','f2273100-0000-4000-8000-000000000001','f2273200-0000-4000-8000-000000000001','RFQ_OPEN','f2270000-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)values('f2273300-0000-4000-8000-000000000001','f2273000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000001','f2273100-0000-4000-8000-000000000001',1,'Historical RFQ attachment TEST precondition','NORMAL','{}',true,repeat('1',64),repeat('2',64),'Historical complete source test',repeat('3',64),'f2270000-0000-4000-8000-000000000001');
update public.service_requests set current_version_id='f2273300-0000-4000-8000-000000000001'where id='f2273000-0000-4000-8000-000000000001';
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at)values('f2273400-0000-4000-8000-000000000001','f2273000-0000-4000-8000-000000000001','f2273300-0000-4000-8000-000000000001','MATCH-V1','COMPLETED',2,'f2270000-0000-4000-8000-000000000001',clock_timestamp());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)values('f2275100-0000-4000-8000-000000000001','f2273400-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000002',true,5000,'{"historical_test_precondition":true}',50),('f2275100-0000-4000-8000-000000000002','f2273400-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000003',true,5000,'{"historical_test_precondition":true}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,deadline,status,invited_count,opened_by) values
 ('f2274000-0000-4000-8000-000000000001','f2273000-0000-4000-8000-000000000001','f2273300-0000-4000-8000-000000000001','f2273400-0000-4000-8000-000000000001',now()+interval '7 days','OPEN',2,'f2270000-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values
 ('f2275000-0000-4000-8000-000000000001','f2274000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000002','f2275100-0000-4000-8000-000000000001','ACCEPTED',now()),
 ('f2275000-0000-4000-8000-000000000002','f2274000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000003','f2275100-0000-4000-8000-000000000002','ACCEPTED',now());
set local session_replication_role=origin;
insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by) values
 ('f2276000-0000-4000-8000-000000000001','f2274000-0000-4000-8000-000000000001','f2275000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000002','SUBMITTED','f2270000-0000-4000-8000-000000000002'),
 ('f2276000-0000-4000-8000-000000000002','f2274000-0000-4000-8000-000000000001','f2275000-0000-4000-8000-000000000002','f2271000-0000-4000-8000-000000000003','SUBMITTED','f2270000-0000-4000-8000-000000000002');
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by) values
 ('f2277000-0000-4000-8000-000000000001','f2276000-0000-4000-8000-000000000001','f2274000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000002',1,'SUBMITTED','Offre A soumise','MAD','Solution A',jsonb_build_array('Livrable A'),'Garantie A','Corrections A',current_date+10,10,now()+interval '30 days',10000,2000,12000,0,'{"money":"MINOR_UNITS"}',repeat('a',64),now(),'f2270000-0000-4000-8000-000000000002'),
 ('f2277000-0000-4000-8000-000000000002','f2276000-0000-4000-8000-000000000002','f2274000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000003',1,'SUBMITTED','Offre B soumise','MAD','Solution B',jsonb_build_array('Livrable B','Livrable B2'),'Garantie B','Corrections B',current_date+12,12,now()+interval '30 days',20000,4000,24000,0,'{"money":"MINOR_UNITS"}',repeat('b',64),now(),'f2270000-0000-4000-8000-000000000002');
update public.quotes set current_version_id=case id when 'f2276000-0000-4000-8000-000000000001'::uuid then 'f2277000-0000-4000-8000-000000000001'::uuid else 'f2277000-0000-4000-8000-000000000002'::uuid end;



create temporary table m227(key text primary key,value jsonb);grant select,insert on m227 to authenticated,service_role;grant usage on schema extensions to authenticated,service_role;
create function pg_temp.scan_metric_count(j jsonb,s text)returns bigint language sql immutable as $$select coalesce(sum((item->>'count')::bigint),0)from jsonb_array_elements(j)item where item->>'status'=s$$;
insert into m227 values('metrics-baseline',private.internal_message_attachment_queue_metrics_v1());
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into m227 values('thread',public.open_rfq_message_thread('f2274000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000002','Pièces techniques test','message227-thread'));
insert into m227 values('loser-thread',public.open_rfq_message_thread('f2274000-0000-4000-8000-000000000001','f2271000-0000-4000-8000-000000000003','Autre candidat test','message227-loser-thread'));
insert into m227 select'draft',public.save_internal_message_draft_v1((value->>'thread_id')::uuid,'f2271000-0000-4000-8000-000000000001','Texte privé initial','f2279000-0000-4000-8000-000000000001')from m227 where key='thread';
select is((select value->>'outcome'from m227 where key='draft'),'INTERNAL_MESSAGE_DRAFT_SAVED','message text is durably saved before any file upload');
select is((select value->>'row_version'from m227 where key='draft'),'1','first draft has an explicit concurrency version');
select is(public.save_internal_message_draft_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001','Texte privé initial','f2279000-0000-4000-8000-000000000001'),(select value from m227 where key='draft'),'draft creation retry does not duplicate or rewrite text');
select throws_ok($$select public.save_internal_message_draft_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001','Texte concurrent','f2279000-0000-4000-8000-000000000002',(select(value->>'draft_id')::uuid from m227 where key='draft'),99)$$,'40001','MESSAGE_DRAFT_CHANGED','stale draft body cannot overwrite another session');
insert into m227 select'edited',public.save_internal_message_draft_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001','Texte privé vérifié','f2279000-0000-4000-8000-000000000002',(value->>'draft_id')::uuid,1)from m227 where key='draft';
select is((select value->>'row_version'from m227 where key='edited'),'2','explicit body revision appends a new version');
insert into m227 select'upload',public.reserve_internal_message_attachment_v1((value->>'draft_id')::uuid,2,'preuve.pdf','application/pdf',20,repeat('a',64),'f2279000-0000-4000-8000-000000000003')from m227 where key='draft';
select is((select value->>'row_version'from m227 where key='upload'),'3','file reservation fences later body or file edits');
select throws_ok($$select public.commit_internal_message_attachment_upload_v1((select(value->>'upload_id')::uuid from m227 where key='upload'))$$,'22000','MESSAGE_UPLOAD_STORAGE_MISMATCH','a reservation is not a completed storage upload');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata)values('private-message-attachments','internal-messages/forged/foreign/path','f2270000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":20}')$$,'42501','new row violates row-level security policy for table "objects"','private message storage rejects an unreserved arbitrary path');
insert into storage.objects(bucket_id,name,owner_id,metadata)select'private-message-attachments',value->>'storage_path','f2270000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":20}'from m227 where key='upload';
select is(public.commit_internal_message_attachment_upload_v1((select(value->>'upload_id')::uuid from m227 where key='upload'))->>'scan_status','PENDING','real storage metadata registers pending scan, never client-provided CLEAN');
reset role;
select is(pg_temp.scan_metric_count(private.internal_message_attachment_queue_metrics_v1(),'PENDING')-pg_temp.scan_metric_count((select value from m227 where key='metrics-baseline'),'PENDING'),1::bigint,'operational metrics show the actual newly uploaded pending file');
set local role authenticated;
select throws_ok($$select public.complete_internal_message_attachment_scan_job((select(value->>'upload_id')::uuid from m227 where key='upload'),'f2279000-0000-4000-8000-000000000004','f2279000-0000-4000-8000-000000000005',1,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('a',64),'message227-forged-scan')$$,'42501',null,'ordinary participant cannot certify a trusted scan');
select throws_ok($$select public.finalize_internal_message_draft_v1((select(value->>'draft_id')::uuid from m227 where key='draft'),3)$$,'55000','MESSAGE_ATTACHMENTS_SELECTION_REQUIRED','preselection does not publish a file, regardless of any requested verdict');
reset role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into m227 select'claim',value from public.claim_internal_message_attachment_scan_jobs('f2279000-0000-4000-8000-000000000005',1,300)value;
select is((select value->>'proof_id'from m227 where key='claim'),(select value->>'upload_id'from m227 where key='upload'),'scanner claims the exact current uploaded file version');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select throws_ok($$select public.complete_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim'),(select(value->>'lease_token')::uuid from m227 where key='claim'),'f2279000-0000-4000-8000-000000000005',1,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('a',64),'message227-prod-test-verdict')$$,'42501','SANDBOX_SCAN_VERDICT_FORBIDDEN','database PRODUCTION rejects a test engine even under a trusted worker lease');
update private.admin_execution_environment_v1 set environment=null where singleton;
select throws_ok($$select public.complete_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim'),(select(value->>'lease_token')::uuid from m227 where key='claim'),'f2279000-0000-4000-8000-000000000005',1,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('a',64),'message227-unset-test-verdict')$$,'42501','SANDBOX_SCAN_VERDICT_FORBIDDEN','missing database environment does not silently authorize test malware verdicts');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;

select throws_ok($$select public.complete_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim'),null,'f2279000-0000-4000-8000-000000000005',1,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('a',64),'message227-null-token')$$,'55000','MESSAGE_ATTACHMENT_SCAN_LEASE_INVALID','NULL lease token cannot bypass fencing');
select throws_ok($$select public.complete_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim'),(select(value->>'lease_token')::uuid from m227 where key='claim'),null,1,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('a',64),'message227-null-worker')$$,'55000','MESSAGE_ATTACHMENT_SCAN_LEASE_INVALID','NULL worker cannot bypass fencing');
select throws_ok($$select public.complete_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim'),(select(value->>'lease_token')::uuid from m227 where key='claim'),'f2279000-0000-4000-8000-000000000005',null,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('a',64),'message227-null-version')$$,'55000','MESSAGE_ATTACHMENT_SCAN_LEASE_INVALID','NULL row version cannot bypass fencing');
select throws_ok($$select public.complete_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim'),(select(value->>'lease_token')::uuid from m227 where key='claim'),'f2279000-0000-4000-8000-000000000005',1,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('b',64),'message227-wrong-hash')$$,'22000','MESSAGE_ATTACHMENT_SCAN_SOURCE_INVALID','CLEAN requires a computed hash matching the reserved bytes');
insert into m227 select'scan',public.complete_internal_message_attachment_scan_job((value->>'proof_id')::uuid,(value->>'lease_token')::uuid,'f2279000-0000-4000-8000-000000000005',(value->>'row_version')::int,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('a',64),'message227-clean-verdict')from m227 where key='claim';
select is((select value->>'outcome'from m227 where key='scan'),'INTERNAL_MESSAGE_ATTACHMENT_SCAN_RECORDED','known-sane synthetic scanner verdict uses a real fenced claim');
select is(public.complete_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim'),(select(value->>'lease_token')::uuid from m227 where key='claim'),'f2279000-0000-4000-8000-000000000005',1,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('a',64),'message227-clean-verdict'),(select value from m227 where key='scan'),'scan completion retry returns the same immutable result after its lease is released');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.finalize_internal_message_draft_v1((select(value->>'draft_id')::uuid from m227 where key='draft'),3)$$,'55000','MESSAGE_ATTACHMENTS_SELECTION_REQUIRED','malware CLEAN is not a claim of anonymisation before selection');
select is((public.get_internal_message_attachment_drafts_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001')->'drafts'->0->'files'->0->>'scan_status'),'CLEAN','refresh recovers the server draft and actual scan status without reupload');
insert into m227 values('comparison',public.compare_quotes('f2274000-0000-4000-8000-000000000001','message227-comparison'));
insert into m227 select'selection',public.select_quote_and_notify('f2276000-0000-4000-8000-000000000001','f2277000-0000-4000-8000-000000000001','Choix explicite test de la bonne offre',(value->>'comparison_snapshot_id')::uuid,'message227-selection')from m227 where key='comparison';
select ok((public.get_internal_message_attachment_drafts_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001')->>'attachments_allowed')::boolean,'a real Client selection permits files for its selected Provider');
select ok(not(public.get_internal_message_attachment_drafts_v1((select(value->>'thread_id')::uuid from m227 where key='loser-thread'),'f2271000-0000-4000-8000-000000000001')->>'attachments_allowed')::boolean,'global request selection never opens files to a losing Provider thread');
insert into m227 select'sent',public.finalize_internal_message_draft_v1((value->>'draft_id')::uuid,3)from m227 where key='draft';
select is((select value->>'outcome'from m227 where key='sent'),'INTERNAL_MESSAGE_SENT','only confirmed clean current files finalize the actual message');
select is(public.finalize_internal_message_draft_v1((select(value->>'draft_id')::uuid from m227 where key='draft'),3),(select value from m227 where key='sent'),'hard-refresh finalization replay returns the same published message');
reset role;
select is((select count(*)from public.internal_messages where thread_id=(select(value->>'thread_id')::uuid from m227 where key='thread')),1::bigint,'finalization replay never duplicates a message');
select is((select count(*)from public.internal_message_attachments where message_id=(select(value->>'message_id')::uuid from m227 where key='sent')),1::bigint,'published message contains exactly the bound clean file');
insert into m227 select'attachment',jsonb_build_object('id',id)from public.internal_message_attachments where message_id=(select(value->>'message_id')::uuid from m227 where key='sent');
select ok(private.internal_message_attachment_is_downloadable_v1((select(value->>'id')::uuid from m227 where key='attachment')),'native readiness derives from BOUND, trusted scan, hash, private object and audience');
select throws_ok($$update public.internal_message_attachment_uploads set expected_sha256=repeat('f',64)where id=(select(value->>'upload_id')::uuid from m227 where key='upload')$$,'55000','IMMUTABLE_MESSAGE_ATTACHMENT_SOURCE','published source metadata cannot be rewritten');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is(public.get_internal_message_attachment_v1((select(value->>'id')::uuid from m227 where key='attachment'))->>'sha256',repeat('a',64),'selected recipient receives the exact authorized private file reference');
select is((select count(*)from storage.objects where bucket_id='private-message-attachments'and name=(select value->>'storage_path'from m227 where key='upload')),1::bigint,'native storage RLS permits the selected thread recipient');
select is(public.get_internal_message_thread((select(value->>'thread_id')::uuid from m227 where key='thread'),50)#>>'{messages,0,attachments,0,download_ready}','true','existing conversation reader uses the native trusted download readiness');
select is(public.get_internal_message_thread_page((select(value->>'thread_id')::uuid from m227 where key='thread'),null,null,50)#>>'{messages,0,attachments,0,download_ready}','true','paginated conversation reader uses the same trusted attachment gate');

select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_internal_message_attachment_v1((select(value->>'id')::uuid from m227 where key='attachment'))$$,'42501','MESSAGE_ATTACHMENT_NOT_AVAILABLE','foreign tenant cannot download a known attachment id');
select is((select count(*)from storage.objects where bucket_id='private-message-attachments'and name=(select value->>'storage_path'from m227 where key='upload')),0::bigint,'storage RLS independently hides the private object from foreign tenants');
select is((select count(*)from public.internal_message_attachment_uploads where id=(select(value->>'upload_id')::uuid from m227 where key='upload')),0::bigint,'reservation metadata does not expose another actor draft');
select throws_ok($$select public.get_internal_message_attachment_drafts_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000004')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','foreign tenant cannot enumerate durable draft bodies');
reset role;
-- Failure/replacement paths retain every source version and never silently send an older file.
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into m227 select'draft-retry',public.save_internal_message_draft_v1((value->>'thread_id')::uuid,'f2271000-0000-4000-8000-000000000001','Nouvelle pièce à analyser','f2279000-0000-4000-8000-000000000040')from m227 where key='thread';
insert into m227 select'upload-retry',public.reserve_internal_message_attachment_v1((value->>'draft_id')::uuid,1,'version-one.pdf','application/pdf',20,repeat('c',64),'f2279000-0000-4000-8000-000000000041')from m227 where key='draft-retry';
insert into storage.objects(bucket_id,name,owner_id,metadata)select'private-message-attachments',value->>'storage_path','f2270000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":20}'from m227 where key='upload-retry';
select public.commit_internal_message_attachment_upload_v1((value->>'upload_id')::uuid)from m227 where key='upload-retry';
reset role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into m227 select'claim-retry',value from public.claim_internal_message_attachment_scan_jobs('f2279000-0000-4000-8000-000000000042',1,300)value;
select is(public.fail_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim-retry'),(select(value->>'lease_token')::uuid from m227 where key='claim-retry'),'f2279000-0000-4000-8000-000000000042',1,'STORAGE_DOWNLOAD_FAILED',null)->>'outcome','INTERNAL_MESSAGE_ATTACHMENT_SCAN_RETRY_SCHEDULED','storage outage schedules a durable retry without pretending a computed SHA');
select is(pg_temp.scan_metric_count(private.internal_message_attachment_queue_metrics_v1(),'RETRY_PENDING')-pg_temp.scan_metric_count((select value from m227 where key='metrics-baseline'),'RETRY_PENDING'),1::bigint,'operational metrics distinguish a real retry from an initial pending upload');

select is((select count(*)from public.claim_internal_message_attachment_scan_jobs('f2279000-0000-4000-8000-000000000043',1,300)),0::bigint,'worker cannot reclaim a file during its retry backoff');
select throws_ok($$select public.complete_internal_message_attachment_scan_job((select(value->>'proof_id')::uuid from m227 where key='claim-retry'),(select(value->>'lease_token')::uuid from m227 where key='claim-retry'),'f2279000-0000-4000-8000-000000000042',1,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('c',64),'message227-late-worker')$$,'55000','MESSAGE_ATTACHMENT_SCAN_LEASE_INVALID','late prior worker cannot override a rescheduled file');
-- Clock advancement is a scoped fault fixture, not a production scanner override.
update private.internal_message_attachment_scan_claims set leased_until=clock_timestamp()-interval'1 second'where upload_id=(select(value->>'upload_id')::uuid from m227 where key='upload-retry');
insert into m227 select'claim-after-retry',value from public.claim_internal_message_attachment_scan_jobs('f2279000-0000-4000-8000-000000000043',1,300)value;
select is((select value->>'attempt_count'from m227 where key='claim-after-retry'),'1','reclaimed job retains its failure count');
select public.complete_internal_message_attachment_scan_job((value->>'proof_id')::uuid,(value->>'lease_token')::uuid,'f2279000-0000-4000-8000-000000000043',(value->>'row_version')::integer,'INFECTED','SQL_TEST_SCANNER','test-only',repeat('c',64),'message227-infected-verdict')from m227 where key='claim-after-retry';
select is((select scan_status from public.internal_message_attachment_uploads where id=(select(value->>'upload_id')::uuid from m227 where key='upload-retry')),'REJECTED','infected current file remains quarantined');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.finalize_internal_message_draft_v1((select(value->>'draft_id')::uuid from m227 where key='draft-retry'),2)$$,'55000','MESSAGE_ATTACHMENT_CLEAN_UPLOAD_REQUIRED','quarantined file never publishes a message');
insert into m227 select'upload-v2',public.reserve_internal_message_attachment_v1((select(value->>'draft_id')::uuid from m227 where key='draft-retry'),2,'version-two.pdf','application/pdf',20,repeat('d',64),'f2279000-0000-4000-8000-000000000044',(value->>'file_id')::uuid)from m227 where key='upload-retry';
select is((select value->>'file_id'from m227 where key='upload-v2'),(select value->>'file_id'from m227 where key='upload-retry'),'replacement preserves the logical file family');
insert into storage.objects(bucket_id,name,owner_id,metadata)select'private-message-attachments',value->>'storage_path','f2270000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":20}'from m227 where key='upload-v2';
select public.commit_internal_message_attachment_upload_v1((value->>'upload_id')::uuid)from m227 where key='upload-v2';
select throws_ok($$select public.finalize_internal_message_draft_v1((select(value->>'draft_id')::uuid from m227 where key='draft-retry'),3)$$,'55000','MESSAGE_ATTACHMENT_CLEAN_UPLOAD_REQUIRED','replacement awaiting scan never falls back to another file version');
reset role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
-- Five unavailable scanner attempts exercise durable DLQ with no invented hash/clean result.
do $$declare claim jsonb;attempt integer;begin
 for attempt in 1..5 loop
  select value into claim from public.claim_internal_message_attachment_scan_jobs('f2279000-0000-4000-8000-000000000045',1,300)value;
  if claim is null or(claim->>'proof_id')::uuid<>(select(value->>'upload_id')::uuid from m227 where key='upload-v2')then raise exception'TEST_MESSAGE_SCAN_CLAIM_MISSING';end if;
  perform public.fail_internal_message_attachment_scan_job((claim->>'proof_id')::uuid,(claim->>'lease_token')::uuid,'f2279000-0000-4000-8000-000000000045',(claim->>'row_version')::int,'SCANNER_UNAVAILABLE',null);
  if attempt<5 then update private.internal_message_attachment_scan_claims set leased_until=clock_timestamp()-interval'1 second'where upload_id=(claim->>'proof_id')::uuid;end if;
 end loop;
end$$;
select is((select scan_status from public.internal_message_attachment_uploads where id=(select(value->>'upload_id')::uuid from m227 where key='upload-v2')),'ERROR','repeated scanner outage is terminal ERROR, never CLEAN');
select is(pg_temp.scan_metric_count(private.internal_message_attachment_queue_metrics_v1(),'DEAD_LETTER')-pg_temp.scan_metric_count((select value from m227 where key='metrics-baseline'),'DEAD_LETTER'),1::bigint,'operational dead letter count follows the actual exhausted current upload');

select is((select count(*)from private.internal_message_attachment_scan_retries where upload_id=(select(value->>'upload_id')::uuid from m227 where key='upload-v2')),5::bigint,'all failed attempts remain in immutable scanner retry history');
select ok((select computed_sha256 is null from private.internal_message_attachment_scan_results where upload_id=(select(value->>'upload_id')::uuid from m227 where key='upload-v2')),'DLQ stores unknown computed hash as NULL, not the declared hash');
select is((select count(*)from public.internal_message_attachment_uploads where file_id=(select(value->>'file_id')::uuid from m227 where key='upload-retry')),2::bigint,'rejected and failed file versions are retained separately');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(public.get_internal_message_attachment_drafts_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001',(select(value->>'draft_id')::uuid from m227 where key='draft-retry'))->'drafts'->0->'file_versions'),2,'refresh exposes genuine file version history to the original author');
select throws_ok($$select public.get_internal_message_attachment_operations_v1()$$,'42501','ATTACHMENT_OPERATIONS_AAL2_REQUIRED','ordinary message author cannot access platform queue operations');
select throws_ok($$select public.remove_internal_message_draft_file_v1((select(value->>'draft_id')::uuid from m227 where key='draft-retry'),(select(value->>'file_id')::uuid from m227 where key='upload-retry'),1)$$,'40001','MESSAGE_DRAFT_CHANGED','stale file removal does not alter another session choices');
select is(public.remove_internal_message_draft_file_v1((select(value->>'draft_id')::uuid from m227 where key='draft-retry'),(select(value->>'file_id')::uuid from m227 where key='upload-retry'),3)->>'row_version','4','explicit removal advances the draft concurrency version');
select is(public.cancel_internal_message_draft_v1((select(value->>'draft_id')::uuid from m227 where key='draft-retry'),4)->>'outcome','INTERNAL_MESSAGE_DRAFT_CANCELLED','private failed draft can be explicitly cancelled without sending');
reset role;
select is(pg_temp.scan_metric_count(private.internal_message_attachment_queue_metrics_v1(),'HISTORICAL_ERROR')-pg_temp.scan_metric_count((select value from m227 where key='metrics-baseline'),'HISTORICAL_ERROR'),1::bigint,'cancelled failed version is retained as historical error');
select is(pg_temp.scan_metric_count(private.internal_message_attachment_queue_metrics_v1(),'DEAD_LETTER')-pg_temp.scan_metric_count((select value from m227 where key='metrics-baseline'),'DEAD_LETTER'),0::bigint,'cancelled failed version no longer raises active dead letter alert');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.operational_metrics_v1()->'message_attachment_scans',private.internal_message_attachment_queue_metrics_v1(),'service metrics expose the same native queue facts without private paths');

select is((select count(*)from public.internal_messages where thread_id=(select(value->>'thread_id')::uuid from m227 where key='thread')),1::bigint,'failed and cancelled preparations never add a second published message');
-- A lost create/reservation response cannot silently replace the current concurrency base.
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into m227 select'draft-cas',public.save_internal_message_draft_v1((value->>'thread_id')::uuid,'f2271000-0000-4000-8000-000000000001','Version initiale conservée','f2279000-0000-4000-8000-000000000080')from m227 where key='thread';
insert into m227 select'upload-cas',public.reserve_internal_message_attachment_v1((value->>'draft_id')::uuid,1,'cas.pdf','application/pdf',20,repeat('e',64),'f2279000-0000-4000-8000-000000000081')from m227 where key='draft-cas';
select public.save_internal_message_draft_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001','Texte changé dans autre session','f2279000-0000-4000-8000-000000000082',(value->>'draft_id')::uuid,2)from m227 where key='draft-cas';
select is(public.save_internal_message_draft_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001','Version initiale conservée','f2279000-0000-4000-8000-000000000080')->>'row_version','1','lost creation response replays its original base rather than adopting a later body silently');
select is(public.reserve_internal_message_attachment_v1((select(value->>'draft_id')::uuid from m227 where key='draft-cas'),1,'cas.pdf','application/pdf',20,repeat('e',64),'f2279000-0000-4000-8000-000000000081')->>'row_version','2','lost reservation response retains the original reservation concurrency base');
select throws_ok($$select public.reserve_internal_message_attachment_v1((select(value->>'draft_id')::uuid from m227 where key='draft-cas'),2,'another.pdf','application/pdf',20,repeat('e',64),'f2279000-0000-4000-8000-000000000083')$$,'40001','MESSAGE_DRAFT_CHANGED','replayed old upload response cannot append new files to an unseen body revision');
select is(public.get_internal_message_attachment_drafts_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001',(select(value->>'draft_id')::uuid from m227 where key='draft-cas'))#>>'{drafts,0,body}','Texte changé dans autre session','replays preserve the actual server body from the other session');
select is(jsonb_array_length(public.get_internal_message_attachment_drafts_v1((select(value->>'thread_id')::uuid from m227 where key='thread'),'f2271000-0000-4000-8000-000000000001',(select(value->>'draft_id')::uuid from m227 where key='draft-cas'))->'drafts'->0->'files'),1,'lost-response retries create only one logical file');
select is(public.cancel_internal_message_draft_v1((select(value->>'draft_id')::uuid from m227 where key='draft-cas'),3)->>'outcome','INTERNAL_MESSAGE_DRAFT_CANCELLED','current session may explicitly cancel the pending CAS fixture');
reset role;
-- Simulated later request lifecycle change must not rewrite a valid original audience attestation.
update public.service_requests set status='CANCELLED'where id='f2273000-0000-4000-8000-000000000001';
select ok(private.internal_message_attachment_is_downloadable_v1((select(value->>'id')::uuid from m227 where key='attachment')),'validly published historical file retains its frozen audience proof after request closure');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2270000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is(public.get_internal_message_attachment_v1((select(value->>'id')::uuid from m227 where key='attachment'))->>'sha256',repeat('a',64),'historical selected recipient still has scoped access after request closure');
reset role;

select*from finish();rollback;
