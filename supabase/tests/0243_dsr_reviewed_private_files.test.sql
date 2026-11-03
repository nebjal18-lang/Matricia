begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='ROLLBACK-ONLY-DSR-FILES-243'where singleton;
-- All identities and legal references below are synthetic test fixtures only.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('a2430000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','dsr-all243-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select('a2430000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'COMPLIANCE_MANAGER'from generate_series(1,2)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2430000-0000-4000-8000-000000000001','TEST DSR243','TEST DSR243','ACTIVE','a2430000-0000-4000-8000-000000000001'),('b2430000-0000-4000-8000-000000000002','TEST foreign243','TEST foreign243','ACTIVE','a2430000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2430000-0000-4000-8000-000000000001','b2430000-0000-4000-8000-000000000001','a2430000-0000-4000-8000-000000000003','REVOKED');
insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)values('d2430000-0000-4000-8000-000000000001','b2430000-0000-4000-8000-000000000001','ACCESS',encode(extensions.digest(convert_to('b2430000-0000-4000-8000-000000000001:a2430000-0000-4000-8000-000000000003','UTF8'),'sha256'),'hex'),'ENHANCED','fr-MA','IN_REVIEW',now()+interval'1 day',now()-interval'1 day',extensions.gen_random_uuid(),'a2430000-0000-4000-8000-000000000001');
create table public.dsr_all_subject_fixture243(id uuid primary key,organization_id uuid references public.organizations(id),subject_user_id uuid references auth.users(id),created_by uuid references auth.users(id),personal_text text,quantity numeric,api_secret text);
alter table public.dsr_all_subject_fixture243 enable row level security;
insert into public.dsr_all_subject_fixture243 values('f2430000-0000-4000-8000-000000000001','b2430000-0000-4000-8000-000000000001','a2430000-0000-4000-8000-000000000003','a2430000-0000-4000-8000-000000000004','TEST own exact record',9007199254740993,'TEST_SECRET_SENTINEL'),('f2430000-0000-4000-8000-000000000002','b2430000-0000-4000-8000-000000000002','a2430000-0000-4000-8000-000000000003','a2430000-0000-4000-8000-000000000003','TEST foreign organization',1,'TEST_SECRET_SENTINEL'),('f2430000-0000-4000-8000-000000000003','b2430000-0000-4000-8000-000000000001','a2430000-0000-4000-8000-000000000004','a2430000-0000-4000-8000-000000000003','TEST another subject authored by this user',1,'TEST_SECRET_SENTINEL');
insert into public.credit_wallets(id,organization_id,wallet_type)values('c2431000-0000-4000-8000-000000000001','b2430000-0000-4000-8000-000000000001','CLIENT'),('c2431000-0000-4000-8000-000000000002','b2430000-0000-4000-8000-000000000002','CLIENT');
insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)values
 ('b2430000-0000-4000-8000-000000000001','c2431000-0000-4000-8000-000000000001','GRANT',9007199254740993,'fixture.dsr243','subject-own-243',extensions.gen_random_uuid(),'TEST','OWN_243','a2430000-0000-4000-8000-000000000003'),
 ('b2430000-0000-4000-8000-000000000001','c2431000-0000-4000-8000-000000000001','GRANT',2,'fixture.dsr243','same-org-other-243',extensions.gen_random_uuid(),'TEST','OTHER_PERSON_243','a2430000-0000-4000-8000-000000000001'),
 ('b2430000-0000-4000-8000-000000000002','c2431000-0000-4000-8000-000000000002','GRANT',3,'fixture.dsr243','other-org-subject-243',extensions.gen_random_uuid(),'TEST','OTHER_TENANT_243','a2430000-0000-4000-8000-000000000003');
-- Historical synthetic controller register is an explicit test precondition.
-- Its own notices are outside the subject organisation; the actual configured
-- SYSTEM remains a captured export slot. No real legal approval is asserted.
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2430000-0000-4000-8000-000000000003','TEST controller243','TEST controller243','ACTIVE','a2430000-0000-4000-8000-000000000001');
update private.platform_privacy_deployment_scope_v1 set controller_organization_id='b2430000-0000-4000-8000-000000000003',legal_approval_reference='TEST_ONLY_LOCAL_DSR243_CONTROLLER',configured_at=clock_timestamp()where singleton;
insert into public.processing_activities(id,organization_id,activity_key,name_fr,name_ar,controller_role,systems,countries_regions,cndp_formality_status,status,effective_from,created_by)values('e2430000-0000-4000-8000-000000000001','b2430000-0000-4000-8000-000000000003','test-local-dsr243','TEST local processing243','معالجة اختبار محلية243','CONTROLLER',array['LOCAL_TEST_DSR243'],array['MA'],'NOT_REQUIRED','ACTIVE',current_date-1,'a2430000-0000-4000-8000-000000000001');
insert into public.processing_purposes(organization_id,processing_activity_id,purpose_key,label_fr,label_ar,legal_basis,legal_basis_reference,created_by)values('b2430000-0000-4000-8000-000000000003','e2430000-0000-4000-8000-000000000001','test-dsr243','TEST purpose','غرض تجريبي','CONTRACT','TEST_ONLY_243_SYNTHETIC_BASIS','a2430000-0000-4000-8000-000000000001');
insert into public.data_categories(id,organization_id,processing_activity_id,category_key,label_fr,label_ar,data_subject_types,sensitivity,created_by)values('e2430000-0000-4000-8000-000000000002','b2430000-0000-4000-8000-000000000003','e2430000-0000-4000-8000-000000000001','test-dsr243','TEST category','فئة تجريبية',array['TEST_SUBJECT'],'PERSONAL','a2430000-0000-4000-8000-000000000001');
insert into public.retention_policies(organization_id,data_category_id,version,status,retention_days,trigger_event,disposition,legal_basis_reference,effective_from,created_by)values('b2430000-0000-4000-8000-000000000003','e2430000-0000-4000-8000-000000000002',1,'ACTIVE',1,'TEST_ONLY','PURGE','TEST_ONLY_243_SYNTHETIC_RETENTION',current_date-1,'a2430000-0000-4000-8000-000000000001');
insert into public.privacy_notices(organization_id,notice_key,version,locale,content_hash,storage_reference,status,published_at,effective_from,created_by)select 'b2430000-0000-4000-8000-000000000003','test-dsr243',1,l,repeat('a',64),'TEST_ONLY_CONTROLLER_NOTICE_243_'||l,'PUBLISHED',now()-interval'1 day',now()-interval'1 day','a2430000-0000-4000-8000-000000000001'from unnest(array['fr-MA','ar-MA'])l;
select ok(private.assert_privacy_registry_ready_v1('b2430000-0000-4000-8000-000000000003'),'explicit synthetic controller satisfies the actual registry readiness gate');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2430000-0000-4000-8000-000000000002','b2430000-0000-4000-8000-000000000002','a2430000-0000-4000-8000-000000000004','ACTIVE');
insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)values('d2430000-0000-4000-8000-000000000002','b2430000-0000-4000-8000-000000000002','ACCESS',encode(extensions.digest(convert_to('b2430000-0000-4000-8000-000000000002:a2430000-0000-4000-8000-000000000004','UTF8'),'sha256'),'hex'),'ENHANCED','fr-MA','IN_REVIEW',now()+interval'1 day',now()-interval'1 day',extensions.gen_random_uuid(),'a2430000-0000-4000-8000-000000000001');
create temporary table dsr243(k text primary key,v jsonb);grant all on dsr243 to authenticated,service_role;
select ok(private.dsr_all_column_exportable_v1('public','question_bank_questions','question_key','text'),'known question business identifier is exportable');
select ok(not private.dsr_all_column_security_secret_v1('public','question_bank_questions','question_key','text'),'question identifier is never mislabelled as an authentication credential');
select ok(not private.dsr_all_column_exportable_v1('auth','users','encrypted_password','text'),'password hashes cannot be included by an inventory');
select ok(not private.dsr_all_column_exportable_v1('auth','mfa_factors','secret','text'),'TOTP seeds cannot be included by an inventory');
select ok(not private.dsr_all_column_exportable_v1('private','refresh_hmac_keys','key','text'),'private refresh keys cannot be included by an inventory');
select is(private.dsr_all_redact_security_json_v1('public','questionnaire_answers','{"question_key":"Q_TEST","access_token":"TEST_SECRET_SENTINEL","nested":{"password":"TEST_SECRET_SENTINEL","value":"safe"}}'),' {"question_key":"Q_TEST","nested":{"value":"safe"}}'::jsonb,'structured answers retain their known identifiers while secret keys are removed recursively');
select is(private.dsr_all_disclosure_remove_path_v1('{"profile":{"own":"Subject","other":"Third party"}}','/profile/other'),'{"profile":{"own":"Subject"}}'::jsonb,'selective object redaction preserves the subject portion');
select is(private.dsr_all_disclosure_remove_path_v1('{"a/b":{"~value":"remove","keep":"safe"}}','/a~1b/~0value'),'{"a/b":{"keep":"safe"}}'::jsonb,'object redaction decodes escaped property names without changing siblings');
select throws_ok($$select private.dsr_all_disclosure_remove_path_v1('{"profile":["Subject","Third party"]}','/profile/0')$$,'22023','DSR_JSON_ARRAY_REQUIRES_WHOLE_FIELD_REVIEW','array-index redactions are refused instead of shifting later targets');
select throws_ok($$select private.dsr_all_disclosure_path_v1('/profile/~2invalid')$$,'22023','INVALID_DSR_DISCLOSURE_PATH','invalid pointer escapes cannot target a different property');
set local role authenticated;select set_config('request.jwt.claim.sub','a2430000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"a2430000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into dsr243 values('scope',public.confirm_my_dsr_scope_v1('d2430000-0000-4000-8000-000000000001',array['ALL'],'TEST-243-scope'));
select throws_ok($$select public.create_dsr_all_inventory_draft_v1('TEST unauthorized inventory attempt','TEST-243-denied')$$,'42501','DSR_LEGAL_STAFF_REQUIRED','a verified subject cannot become the inventory authority');
select set_config('request.jwt.claim.sub','a2430000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2430000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into dsr243 values('draft',public.create_dsr_all_inventory_draft_v1('TEST synthetic disclosure classifications only, never a production legal approval','TEST-243-draft'));
reset role;
select ok((select(v->>'source_count')::integer>500 from dsr243 where k='draft'),'technical inventory covers the deployed Auth/public/private/Storage catalogue');
create function pg_temp.classify_all243()returns void language plpgsql as $$
declare source jsonb;fields jsonb;excluded jsonb;config_value jsonb;begin
 for source in select value from public.dsr_all_inventory_drafts_v1,jsonb_array_elements(catalog_json)where id=(select(v->>'draft_id')::uuid from dsr243 where k='draft')loop
  fields:='[]';
  if source->>'key'in('public.dsr_all_subject_fixture243','@subject_financial_records_v1')then select jsonb_agg(c->>'name')into fields from jsonb_array_elements(source->'columns')c where(c->>'exportable')::boolean;end if;
  select coalesce(jsonb_object_agg(c->>'name',jsonb_build_object('basis_code',case when(c->>'security_secret')::boolean then'SECURITY_SECRET'else'NOT_PERSONAL_DATA'end,'legal_reference','TEST-ONLY-243-SYNTHETIC-DISCLOSURE','reason','TEST fixture policy for isolated synthetic records, not a real legal approval')),'{}')into excluded from jsonb_array_elements(source->'columns')c where not fields?(c->>'name');
  config_value:=jsonb_build_object('mode',case when source->>'key'in('public.dsr_all_subject_fixture243','@subject_financial_records_v1')then'EXTRACT'else'EXCLUDE'end,'subject_path_id',case when source->>'key'in('public.dsr_all_subject_fixture243','@subject_financial_records_v1')then source#>>'{subject_paths,0,id}'end,'organization_path_ids',case when source->>'key'in('public.dsr_all_subject_fixture243','@subject_financial_records_v1')then jsonb_build_array(source#>>'{organization_paths,0,id}')else'[]'::jsonb end,'account_global',false,'include_null_organization',false,'fields',fields,'excluded_fields',excluded,'legal_reference','TEST-ONLY-243-SYNTHETIC-DISCLOSURE','reason','TEST fixture policy for isolated synthetic records, not a real legal approval');
  perform public.configure_dsr_all_inventory_source_v1((select(v->>'draft_id')::uuid from dsr243 where k='draft'),source->>'key',0,config_value,'TEST-243-classify:'||(source->>'key'));
 end loop;
end$$;
set local role authenticated;
select throws_ok($$select public.submit_dsr_all_inventory_v1((select(v->>'draft_id')::uuid from dsr243 where k='draft'),(select v->>'catalog_hash'from dsr243 where k='draft'),'TEST-243-LEGAL-REFERENCE','TEST-243-empty-submit')$$,'55000','DSR_INVENTORY_UNCLASSIFIED_SOURCE','ALL cannot skip an unclassified technical source');
reset role;
select pg_temp.classify_all243();
set local role authenticated;
insert into dsr243 values('version',public.submit_dsr_all_inventory_v1((select(v->>'draft_id')::uuid from dsr243 where k='draft'),(select v->>'catalog_hash'from dsr243 where k='draft'),'TEST-243-LEGAL-REFERENCE','TEST-243-submit'));
select throws_ok($$select public.decide_dsr_all_inventory_v1((select(v->>'inventory_version_id')::uuid from dsr243 where k='version'),(select v->>'content_hash'from dsr243 where k='version'),true,true,'TEST-243-LEGAL-REFERENCE','TEST self approval denied')$$,'42501','DSR_INVENTORY_INDEPENDENT_REVIEW_REQUIRED','the inventory author cannot approve their classifications');
select set_config('request.jwt.claim.sub','a2430000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2430000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.decide_dsr_all_inventory_v1((select(v->>'inventory_version_id')::uuid from dsr243 where k='version'),(select v->>'content_hash'from dsr243 where k='version'),true,false,'TEST-243-LEGAL-REFERENCE','TEST explicit review must be confirmed')$$,'22023','DSR_DOCUMENTED_LEGAL_REVIEW_REQUIRED','independent approval requires explicit review confirmation');
select public.decide_dsr_all_inventory_v1((select(v->>'inventory_version_id')::uuid from dsr243 where k='version'),(select v->>'content_hash'from dsr243 where k='version'),true,true,'TEST-243-LEGAL-REFERENCE','TEST independent synthetic policy review, no real legal approval');

-- SQL file fixtures below use real Storage metadata but no S3 bytes. Trusted service
-- hash/scan callbacks are explicit deterministic local preconditions, not AV or HTTP certification.
reset role;
create function pg_temp.actor243(p_actor uuid,p_aal text default'aal2')returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub',p_actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aal',p_aal)::text,true);end$$;
create function pg_temp.service243()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;
create function pg_temp.sane_file243(p_request uuid,p_key uuid,p_name text,p_content text,p_scan boolean default true)returns jsonb language plpgsql as $$declare u jsonb;ticket jsonb;c record;sha text:=encode(extensions.digest(convert_to(p_content,'UTF8'),'sha256'),'hex');size bigint:=octet_length(p_content);claims text:=current_setting('request.jwt.claims',true);sub text:=current_setting('request.jwt.claim.sub',true);begin
 perform pg_temp.actor243('a2430000-0000-4000-8000-000000000001');
 u:=public.reserve_dsr_redacted_file_v1(p_request,p_name,'application/pdf',size,sha,p_key);
 insert into storage.objects(bucket_id,name,owner_id,metadata)values('privacy-response-files',u->>'path','a2430000-0000-4000-8000-000000000001',jsonb_build_object('size',size,'mimetype','application/pdf'));
 ticket:=public.authorize_dsr_file_upload_commit_v1((u->>'upload_id')::uuid);
 perform pg_temp.service243();perform public.commit_dsr_redacted_file_bytes_v1((ticket->>'ticket_id')::uuid,sha,'application/pdf',size);
 if not p_scan then perform set_config('request.jwt.claims',coalesce(claims,''),true);perform set_config('request.jwt.claim.sub',coalesce(sub,''),true);return u||jsonb_build_object('sha256',sha,'size_bytes',size::text);end if;
 select*into c from public.claim_dsr_redacted_file_scan_jobs('e2439000-0000-4000-8000-000000000001',10,300)where proof_id=(u->>'upload_id')::uuid;
 if c.proof_id is null then raise exception'TEST_DSR_SCAN_CLAIM_REQUIRED';end if;
 perform public.complete_dsr_redacted_file_scan_job(c.proof_id,c.lease_token,'e2439000-0000-4000-8000-000000000001',c.row_version,'CLEAN','SQL_TEST_SCANNER','test-only',sha,'TEST-243-scan:'||c.proof_id::text);
 perform set_config('request.jwt.claims',coalesce(claims,''),true);perform set_config('request.jwt.claim.sub',coalesce(sub,''),true);
 return u||jsonb_build_object('sha256',sha,'size_bytes',size::text);
end$$;
create function pg_temp.review_file_bytes243(p_package uuid,p_entry text,p_upload uuid,p_actor uuid)returns void language plpgsql as $$declare ticket jsonb;source jsonb;claims text:=current_setting('request.jwt.claims',true);sub text:=current_setting('request.jwt.claim.sub',true);begin
 perform pg_temp.actor243(p_actor);ticket:=public.authorize_dsr_file_review_v1(p_package,p_entry,p_upload);
 perform pg_temp.service243();source:=public.get_dsr_file_transfer_source_v1((ticket->>'ticket_id')::uuid,p_actor);
 perform public.record_dsr_file_transfer_access_v1((ticket->>'ticket_id')::uuid,source->>'sha256',(source->>'size_bytes')::bigint);
 perform set_config('request.jwt.claims',coalesce(claims,''),true);perform set_config('request.jwt.claim.sub',coalesce(sub,''),true);
end$$;
-- Both original and foreign original have a genuine reservation/commit/lease/
-- verdict path. Only the deterministic service verdict is a test precondition.
insert into dsr243 values('original',pg_temp.sane_file243('d2430000-0000-4000-8000-000000000001','e2431000-0000-4000-8000-000000000001','original243.pdf','%PDF-1.7 TEST original personal file243'));
insert into dsr243 values('foreign-original',pg_temp.sane_file243('d2430000-0000-4000-8000-000000000002','e2431000-0000-4000-8000-000000000002','foreign243.pdf','%PDF-1.7 TEST foreign personal file243'));
select pg_temp.actor243('a2430000-0000-4000-8000-000000000002');set local role authenticated;
insert into dsr243 values('capture',public.capture_admin_dsr_all_v1('d2430000-0000-4000-8000-000000000001',(select(v->>'scope_version_id')::uuid from dsr243 where k='scope'),(select(v->>'inventory_version_id')::uuid from dsr243 where k='version'),'TEST-243-capture'));
reset role;
insert into dsr243 select'snapshot',snapshot_json::jsonb from public.dsr_all_packages_v1 where id=(select(v->>'package_id')::uuid from dsr243 where k='capture');
insert into dsr243 select'original-entry',entry from dsr243,jsonb_array_elements(v#>'{file_sources,entries}')entry where k='snapshot'and entry->>'source_type'='public.dsr_redacted_file_uploads_v1';
insert into dsr243 select'external-entry',entry from dsr243,jsonb_array_elements(v#>'{file_sources,entries}')entry where k='snapshot'and entry->>'source_type'='EXTERNAL_DSR_EXPORT';
select is((select jsonb_array_length(v#>'{file_sources,entries}')from dsr243 where k='snapshot'),2,'cut captures own physical original and actual configured processing export slot');
select ok((select(v#>>'{file_sources,coverage_complete}')::boolean from dsr243 where k='snapshot'),'all deployed file families and explicit synthetic controller are covered');
select ok((select not exists(select 1 from jsonb_array_elements(v#>'{file_sources,entries}')e where e->>'source_id'=(select v->>'upload_id'from dsr243 where k='foreign-original'))from dsr243 where k='snapshot'),'foreign organization file is not captured');
select ok(not(private.dsr_all_file_manifest_v1((select(v->>'package_id')::uuid from dsr243 where k='capture'))->>'complete')::boolean,'native CLEAN original does not replace the personal/third-party disposition review');
-- Data imported after the cut is not silently appended to captured sources.
insert into dsr243 values('external-output',pg_temp.sane_file243('d2430000-0000-4000-8000-000000000001','e2431000-0000-4000-8000-000000000003','external-as-of243.pdf','%PDF-1.7 TEST exact external export as of original cut243'));
select is((select jsonb_array_length(snapshot_json::jsonb#>'{file_sources,entries}')from public.dsr_all_packages_v1 where id=(select(v->>'package_id')::uuid from dsr243 where k='capture')),2,'new output upload does not rewrite the original capture cut');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000001');set local role authenticated;
select throws_ok($$select public.propose_dsr_file_disposition_v1((select(v->>'package_id')::uuid from dsr243 where k='capture'),(select v->>'id'from dsr243 where k='original-entry'),(select v->>'source_hash'from dsr243 where k='original-entry'),(select v->>'source_sha256'from dsr243 where k='capture'),'INCLUDE_ORIGINAL','{}',null,null,'TEST original personal scope review',true,true,true,'e2432000-0000-4000-8000-000000000001')$$,'55000','DSR_EXACT_FILE_REVIEW_ACCESS_REQUIRED','proposal requires actual verified byte-access receipt, not a CLEAN label');
reset role;
select pg_temp.review_file_bytes243((select(v->>'package_id')::uuid from dsr243 where k='capture'),(select v->>'id'from dsr243 where k='original-entry'),null,'a2430000-0000-4000-8000-000000000001');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000001');set local role authenticated;
insert into dsr243 values('original-proposal',public.propose_dsr_file_disposition_v1((select(v->>'package_id')::uuid from dsr243 where k='capture'),(select v->>'id'from dsr243 where k='original-entry'),(select v->>'source_hash'from dsr243 where k='original-entry'),(select v->>'source_sha256'from dsr243 where k='capture'),'INCLUDE_ORIGINAL','{}',null,null,'TEST original personal scope review',true,true,true,'e2432000-0000-4000-8000-000000000001'));
select throws_ok($$select public.decide_dsr_file_disposition_v1((select(v->>'proposal_id')::uuid from dsr243 where k='original-proposal'),(select v->>'content_hash'from dsr243 where k='original-proposal'),true,true,null,'TEST own approval forbidden')$$,'42501','DSR_INDEPENDENT_FILE_REVIEW_REQUIRED','file preparation author cannot approve their own plan');
reset role;select pg_temp.actor243('a2430000-0000-4000-8000-000000000002');set local role authenticated;
select throws_ok($$select public.decide_dsr_file_disposition_v1((select(v->>'proposal_id')::uuid from dsr243 where k='original-proposal'),(select v->>'content_hash'from dsr243 where k='original-proposal'),true,true,null,'TEST independent review before access')$$,'55000','DSR_EXACT_FILE_REVIEW_ACCESS_REQUIRED','independent reviewer must also access the exact included original bytes');
reset role;
select pg_temp.review_file_bytes243((select(v->>'package_id')::uuid from dsr243 where k='capture'),(select v->>'id'from dsr243 where k='original-entry'),null,'a2430000-0000-4000-8000-000000000002');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000002');set local role authenticated;
select is((public.decide_dsr_file_disposition_v1((select(v->>'proposal_id')::uuid from dsr243 where k='original-proposal'),(select v->>'content_hash'from dsr243 where k='original-proposal'),true,true,null,'TEST independent reviewed original approval')->>'decision'),'APPROVE','distinct reviewer publishes the exact original file disposition');
reset role;
select pg_temp.review_file_bytes243((select(v->>'package_id')::uuid from dsr243 where k='capture'),'',(select(v->>'upload_id')::uuid from dsr243 where k='external-output'),'a2430000-0000-4000-8000-000000000001');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000001');set local role authenticated;
select throws_ok($$select public.propose_dsr_file_disposition_v1((select(v->>'package_id')::uuid from dsr243 where k='capture'),(select v->>'id'from dsr243 where k='external-entry'),(select v->>'source_hash'from dsr243 where k='external-entry'),(select v->>'source_sha256'from dsr243 where k='capture'),'INCLUDE_EXTERNAL_EXPORT',array[(select(v->>'upload_id')::uuid from dsr243 where k='foreign-original')],null,'TEST export linked to immutable local source cut','TEST wrong-organization output denied',true,true,true,'e2432000-0000-4000-8000-000000000002')$$,'42501','DSR_REDACTED_FILE_SCOPE_DENIED','a CLEAN foreign organization output cannot be substituted into this response');
insert into dsr243 values('external-proposal',public.propose_dsr_file_disposition_v1((select(v->>'package_id')::uuid from dsr243 where k='capture'),(select v->>'id'from dsr243 where k='external-entry'),(select v->>'source_hash'from dsr243 where k='external-entry'),(select v->>'source_sha256'from dsr243 where k='capture'),'INCLUDE_EXTERNAL_EXPORT',array[(select(v->>'upload_id')::uuid from dsr243 where k='external-output')],null,'TEST export linked to immutable local source cut','TEST actual imported output scope review',true,true,true,'e2432000-0000-4000-8000-000000000002'));
reset role;
select pg_temp.review_file_bytes243((select(v->>'package_id')::uuid from dsr243 where k='capture'),'',(select(v->>'upload_id')::uuid from dsr243 where k='external-output'),'a2430000-0000-4000-8000-000000000002');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000002');set local role authenticated;
select public.decide_dsr_file_disposition_v1((select(v->>'proposal_id')::uuid from dsr243 where k='external-proposal'),(select v->>'content_hash'from dsr243 where k='external-proposal'),true,true,null,'TEST independent imported export review');
reset role;
insert into dsr243 values('manifest',private.dsr_all_file_manifest_v1((select(v->>'package_id')::uuid from dsr243 where k='capture')));
select ok((select(v->>'complete')::boolean from dsr243 where k='manifest'),'manifest becomes complete only after both actual file dispositions are independently reviewed');
select is((select jsonb_array_length(v->'entries')from dsr243 where k='manifest'),2,'two different real file versions remain separately downloadable and acknowledged');
select ok((select not(v::text~'"(bucket|path|storage_object_id|source_aliases)"')from dsr243 where k='manifest'),'published manifest never reveals private source locators or excluded raw inventory');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000001');set local role authenticated;
insert into dsr243 values('response',public.prepare_admin_dsr_all_response_v1((select(v->>'package_id')::uuid from dsr243 where k='capture'),(select v->>'source_sha256'from dsr243 where k='capture'),(select v->>'manifest_hash'from dsr243 where k='manifest'),'TEST-243-response'));
select is((select v->>'complete'from dsr243 where k='response'),'true','actual ALL response uses the reviewed native file manifest');
reset role;select pg_temp.actor243('a2430000-0000-4000-8000-000000000003');set local role authenticated;
select throws_ok($$select public.get_my_dsr_response_files_v1((select(v->>'response_id')::uuid from dsr243 where k='response'))$$,'42501','DSR_APPROVED_RESPONSE_REQUIRED','verified subject cannot receive bytes before independent response publication');
reset role;select pg_temp.actor243('a2430000-0000-4000-8000-000000000002');set local role authenticated;
select public.review_admin_dsr_private_response_v1((select(v->>'response_id')::uuid from dsr243 where k='response'),(select v->>'sha256'from dsr243 where k='response'),true,true,'TEST complete response personal and third-party review');
reset role;select pg_temp.actor243('a2430000-0000-4000-8000-000000000003');set local role authenticated;
insert into dsr243 values('subject-files',public.get_my_dsr_response_files_v1((select(v->>'response_id')::uuid from dsr243 where k='response')));
select is((select jsonb_array_length(v->'entries')from dsr243 where k='subject-files'),2,'subject with REVOKED membership still sees approved private files');
select throws_ok($$select public.acknowledge_my_dsr_response_file_v1((select(v->>'response_id')::uuid from dsr243 where k='response'),(select v#>>'{entries,0,id}'from dsr243 where k='subject-files'),(select v->>'response_sha256'from dsr243 where k='subject-files'),(select v->>'file_manifest_hash'from dsr243 where k='subject-files'),(select v#>>'{entries,0,download_sha256}'from dsr243 where k='subject-files'),true)$$,'55000','DSR_EXACT_FILE_ACCESS_REQUIRED','subject cannot acknowledge a version whose actual bytes were not accessed');
do $$begin perform public.get_private_dsr_response_v1((select(v->>'response_id')::uuid from dsr243 where k='response'));end$$;
select throws_ok($$select public.acknowledge_my_dsr_response_v1((select(v->>'response_id')::uuid from dsr243 where k='response'),(select(v->>'scope_version_id')::uuid from dsr243 where k='scope'),(select v->>'sha256'from dsr243 where k='response'))$$,'55000',null,'global complete acknowledgement cannot bypass missing per-file receipts');
reset role;
do $$declare entry jsonb;ticket jsonb;source jsonb;begin
 for entry in select value from dsr243,jsonb_array_elements(v->'entries')where k='subject-files'loop
  perform pg_temp.actor243('a2430000-0000-4000-8000-000000000003');ticket:=public.authorize_my_dsr_response_file_v1((select(v->>'response_id')::uuid from dsr243 where k='response'),entry->>'id');
  perform pg_temp.service243();source:=public.get_dsr_file_transfer_source_v1((ticket->>'ticket_id')::uuid,'a2430000-0000-4000-8000-000000000003');
  perform public.record_dsr_file_transfer_access_v1((ticket->>'ticket_id')::uuid,source->>'sha256',(source->>'size_bytes')::bigint);
  perform pg_temp.actor243('a2430000-0000-4000-8000-000000000003');perform public.acknowledge_my_dsr_response_file_v1((select(v->>'response_id')::uuid from dsr243 where k='response'),entry->>'id',(select v->>'response_sha256'from dsr243 where k='subject-files'),(select v->>'file_manifest_hash'from dsr243 where k='subject-files'),entry->>'download_sha256',true);
 end loop;
end$$;
select ok(private.dsr_all_files_acknowledged_v1((select(v->>'response_id')::uuid from dsr243 where k='response'),'a2430000-0000-4000-8000-000000000003'),'internal completion predicate requires and recognizes both exact authenticated file acknowledgements');
set local role authenticated;
select is((public.acknowledge_my_dsr_response_v1((select(v->>'response_id')::uuid from dsr243 where k='response'),(select(v->>'scope_version_id')::uuid from dsr243 where k='scope'),(select v->>'sha256'from dsr243 where k='response'))->>'outcome'),'DSR_RESPONSE_ACKNOWLEDGED','full response can be acknowledged after all exact versions were accessed and acknowledged');
reset role;
select is((select status from public.data_subject_requests where id='d2430000-0000-4000-8000-000000000001'),'IN_REVIEW','file and response acknowledgements never automatically fulfil the case');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000002');set local role authenticated;
select lives_ok($$select public.transition_data_subject_request('d2430000-0000-4000-8000-000000000001',1,'FULFILLED','TEST_COMPLETE_DELIVERY_243',(select v->>'reference'from dsr243 where k='response'),extensions.gen_random_uuid())$$,'staff can fulfil only the independently approved, fully acknowledged ALL response');
reset role;
select is((select status from public.data_subject_requests where id='d2430000-0000-4000-8000-000000000001'),'FULFILLED','real final case transition records complete delivery');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000003');set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a2430000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_id":"a2439999-0000-4000-8000-000000000001"}',true);
select throws_ok($$select public.get_my_dsr_response_files_v1((select(v->>'response_id')::uuid from dsr243 where k='response'))$$,'42501','DSR_VERIFIED_SUBJECT_REQUIRED','AAL2 label with a missing or revoked native session cannot authorize subject file access');
reset role;
select pg_temp.actor243('a2430000-0000-4000-8000-000000000004');set local role authenticated;
select throws_ok($$select public.get_my_dsr_response_files_v1((select(v->>'response_id')::uuid from dsr243 where k='response'))$$,'42501','DSR_VERIFIED_SUBJECT_REQUIRED','another subject never receives the reviewed private response files');
reset role;
-- Queue outage/recovery is exercised on the separate still-open case. No
-- production scanner capacity is asserted by these deterministic service calls.
insert into dsr243 values('queue-upload',pg_temp.sane_file243('d2430000-0000-4000-8000-000000000002','e2431000-0000-4000-8000-000000000004','retry243.pdf','%PDF-1.7 TEST retry source243',false));
select ok(exists(select 1 from jsonb_array_elements(private.dsr_file_scan_queue_metrics_v1())m where m->>'status'='PENDING'and(m->>'count')::integer>0),'real committed unscanned bytes project as PENDING');
select pg_temp.service243();
insert into dsr243 select 'queue-claim',to_jsonb(c)from public.claim_dsr_redacted_file_scan_jobs('e2439000-0000-4000-8000-000000000001',1,300)c;
select throws_ok($$select public.complete_dsr_redacted_file_scan_job((select(v->>'upload_id')::uuid from dsr243 where k='queue-upload'),null,null,null,'CLEAN','SQL_TEST_SCANNER','1',(select v->>'sha256'from dsr243 where k='queue-upload'),'TEST-243-null-fence')$$,'55000','DSR_FILE_SCAN_LEASE_INVALID','NULL lease, worker and version cannot complete a scan');
select throws_ok($$select public.fail_dsr_redacted_file_scan_job((select(v->>'upload_id')::uuid from dsr243 where k='queue-upload'),null,null,null,'SCANNER_UNAVAILABLE',null)$$,'55000','DSR_FILE_SCAN_LEASE_INVALID','NULL fence cannot schedule a retry');
select is((public.fail_dsr_redacted_file_scan_job((select(v->>'proof_id')::uuid from dsr243 where k='queue-claim'),(select(v->>'lease_token')::uuid from dsr243 where k='queue-claim'),'e2439000-0000-4000-8000-000000000001',(select(v->>'row_version')::integer from dsr243 where k='queue-claim'),'SCANNER_UNAVAILABLE',null)->>'outcome'),'DSR_REDACTED_FILE_SCAN_RETRY_SCHEDULED','storage or scanner outage schedules a durable retry without invented computed SHA');
select ok(exists(select 1 from jsonb_array_elements(private.dsr_file_scan_queue_metrics_v1())m where m->>'status'='RETRY_PENDING'and(m->>'count')::integer>0),'failed active attempt projects as RETRY_PENDING');
select is((select count(*)::integer from public.claim_dsr_redacted_file_scan_jobs('e2439000-0000-4000-8000-000000000001',1,300)),0,'worker cannot claim a retry before its backoff deadline');
-- Advancing only the test lease deadline is a deterministic clock precondition.
do $$declare c record;begin for attempt in 2..5 loop
 update private.dsr_redacted_file_scan_claims_v1 set leased_until=clock_timestamp()-interval'1 second'where upload_id=(select(v->>'upload_id')::uuid from dsr243 where k='queue-upload');
 select*into c from public.claim_dsr_redacted_file_scan_jobs('e2439000-0000-4000-8000-000000000001',1,300);
 perform public.fail_dsr_redacted_file_scan_job(c.proof_id,c.lease_token,'e2439000-0000-4000-8000-000000000001',c.row_version,'SCANNER_UNAVAILABLE',null);
 end loop;end$$;
select is((select scan_status from public.dsr_redacted_file_uploads_v1 where id=(select(v->>'upload_id')::uuid from dsr243 where k='queue-upload')),'ERROR','fifth failed attempt is visibly quarantined as ERROR');
select ok(exists(select 1 from jsonb_array_elements(private.dsr_file_scan_queue_metrics_v1())m where m->>'status'='DEAD_LETTER'and(m->>'count')::integer>0),'active ERROR projects as DEAD_LETTER instead of healthy heartbeat');
select is((select count(*)::integer from private.dsr_redacted_file_scan_retries_v1 where upload_id=(select(v->>'upload_id')::uuid from dsr243 where k='queue-upload')),5,'every outage attempt remains immutable history');
insert into dsr243 select 'queue-error',jsonb_build_object('result_id',scan_result_id)from public.dsr_redacted_file_uploads_v1 where id=(select(v->>'upload_id')::uuid from dsr243 where k='queue-upload');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000001');set local role authenticated;
select lives_ok($$select public.retry_dsr_redacted_file_scan_v1((select(v->>'upload_id')::uuid from dsr243 where k='queue-upload'),(select(v->>'result_id')::uuid from dsr243 where k='queue-error'),'TEST explicit scanner recovery243')$$,'staff can explicitly resume ERROR with exact result CAS');
reset role;select pg_temp.service243();
delete from dsr243 where k='queue-claim';
insert into dsr243 select 'queue-claim',to_jsonb(c)from public.claim_dsr_redacted_file_scan_jobs('e2439000-0000-4000-8000-000000000001',1,300)c;
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select throws_ok($$select public.complete_dsr_redacted_file_scan_job((select(v->>'proof_id')::uuid from dsr243 where k='queue-claim'),(select(v->>'lease_token')::uuid from dsr243 where k='queue-claim'),'e2439000-0000-4000-8000-000000000001',(select(v->>'row_version')::integer from dsr243 where k='queue-claim'),'CLEAN','SQL_TEST_SCANNER','1',(select v->>'sha256'from dsr243 where k='queue-upload'),'TEST-243-recovery-clean')$$,'42501','SANDBOX_SCAN_VERDICT_FORBIDDEN','test scanner cannot create a positive production verdict');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select is((public.complete_dsr_redacted_file_scan_job((select(v->>'proof_id')::uuid from dsr243 where k='queue-claim'),(select(v->>'lease_token')::uuid from dsr243 where k='queue-claim'),'e2439000-0000-4000-8000-000000000001',(select(v->>'row_version')::integer from dsr243 where k='queue-claim'),'CLEAN','SQL_TEST_SCANNER','1',(select v->>'sha256'from dsr243 where k='queue-upload'),'TEST-243-recovery-clean')->>'result'),'CLEAN','new fenced attempt records its actual deterministic DEVELOPMENT verdict');
select is((public.operational_metrics_v1()->'privacy_file_scans'),private.dsr_file_scan_queue_metrics_v1(),'service operational projection exactly matches real queue states');
select pg_temp.actor243('a2430000-0000-4000-8000-000000000003');set local role authenticated;
select throws_ok($$select public.get_privacy_file_operations_v1()$$,'42501',null,'subject cannot inspect global private-file operations');
reset role;
-- Replaying an earlier verified service receipt still rechecks actor liveness.
insert into dsr243 select 'completed-ticket',jsonb_build_object('id',t.id,'sha256',c.sha256,'size_bytes',c.size_bytes::text)from private.dsr_file_transfer_tickets_v1 t join private.dsr_file_transfer_completions_v1 c on c.ticket_id=t.id where t.kind='RESPONSE_FILE'and t.actor_user_id='a2430000-0000-4000-8000-000000000003'order by t.created_at desc limit 1;
update auth.users set banned_until=clock_timestamp()+interval'1 day'where id='a2430000-0000-4000-8000-000000000003';
select pg_temp.service243();
select throws_ok($$select public.get_dsr_file_transfer_source_v1((select(v->>'id')::uuid from dsr243 where k='completed-ticket'),'a2430000-0000-4000-8000-000000000003')$$,'42501','DSR_FILE_TRANSFER_EXPIRED','banned actor cannot reuse a previous byte-transfer ticket');
select throws_ok($$select public.record_dsr_file_transfer_access_v1((select(v->>'id')::uuid from dsr243 where k='completed-ticket'),(select v->>'sha256'from dsr243 where k='completed-ticket'),(select(v->>'size_bytes')::bigint from dsr243 where k='completed-ticket'))$$,'42501','DSR_FILE_TRANSFER_EXPIRED','idempotent receipt replay cannot bypass actor revocation');
update auth.users set banned_until=null where id='a2430000-0000-4000-8000-000000000003';
insert into dsr243 select 'staff-completed-ticket',jsonb_build_object('id',t.id,'sha256',c.sha256,'size_bytes',c.size_bytes::text)from private.dsr_file_transfer_tickets_v1 t join private.dsr_file_transfer_completions_v1 c on c.ticket_id=t.id where t.kind='SOURCE_REVIEW'and t.actor_user_id='a2430000-0000-4000-8000-000000000001'order by t.created_at desc limit 1;
update public.platform_user_roles set revoked_at=clock_timestamp()where user_id='a2430000-0000-4000-8000-000000000001';
select throws_ok($$select public.record_dsr_file_transfer_access_v1((select(v->>'id')::uuid from dsr243 where k='staff-completed-ticket'),(select v->>'sha256'from dsr243 where k='staff-completed-ticket'),(select(v->>'size_bytes')::bigint from dsr243 where k='staff-completed-ticket'))$$,'42501','DSR_RESPONSE_STAFF_REQUIRED','a completed byte-access receipt cannot replay after staff role revocation');
update public.platform_user_roles set revoked_at=null where user_id='a2430000-0000-4000-8000-000000000001';
select ok(not has_table_privilege('authenticated','public.dsr_file_disposition_decisions_v1','INSERT'),'browser cannot fabricate reviewed file decisions');
select ok(not has_function_privilege('authenticated','public.record_dsr_file_transfer_access_v1(uuid,text,bigint)','EXECUTE'),'browser cannot manufacture verified byte-access receipts');
select ok(not has_function_privilege('authenticated','public.commit_dsr_redacted_file_bytes_v1(uuid,text,text,bigint)','EXECUTE'),'browser cannot claim a server-verified upload from declared metadata');
select*from finish();rollback;
