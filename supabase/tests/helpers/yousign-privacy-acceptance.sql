-- Runs after the unchanged canonical-source 0241 and YouSign transport fixtures.
-- Identities, legal approvals and Storage metadata are synthetic and rolled back.
-- This proves subject/privacy SQL isolation, not native YouSign or legal consent.
create temporary table y392_subjects(label text primary key,request_id uuid,actor_id uuid,organization_id uuid);
insert into y392_subjects values
 ('client','d3920000-0000-4000-8000-000000000001','a2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001'),
 ('provider','d3920000-0000-4000-8000-000000000002','fa120000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002'),
 ('wrong-org','d3920000-0000-4000-8000-000000000003','a2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002'),
 ('outsider','d3920000-0000-4000-8000-000000000004','a3920000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values('a3920000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','yousign-privacy-outsider@example.invalid','',now(),'{}','{}',now(),now());
-- Historical membership honestly establishes both verified account subjects.
-- It grants neither subject a signer relationship in that organization.
insert into public.organization_memberships(id,organization_id,user_id,status) values
 ('c3920000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002','a2200000-0000-4000-8000-000000000001','REVOKED'),
 ('c3920000-0000-4000-8000-000000000002','fa122000-0000-4000-8000-000000000001','a3920000-0000-4000-8000-000000000001','REVOKED');
insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)
 select request_id,organization_id,'ACCESS',encode(extensions.digest(convert_to(organization_id::text||':'||actor_id::text,'UTF8'),'sha256'),'hex'),'ENHANCED','fr-MA','IN_REVIEW',now()+interval '1 day',now()-interval '1 hour',extensions.gen_random_uuid(),'a2200000-0000-4000-8000-000000000002'
 from y392_subjects;
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000002');
select is(private.dsr_account_subject_v1(request_id),actor_id,'verified account subject resolves honestly: '||label) from y392_subjects order by label;
select is((select status from public.signature_envelopes where id=(select(v->>'envelope_id')::uuid from y391 where k='envelope')),'SIGNED','privacy cases use the completed guarded transport fixture');

create temporary table y392_rows(label text,source text,record_id text,record jsonb);
insert into y392_rows select s.label,r.source,r.record_id,r.record from y392_subjects s cross join lateral private.dsr_subject_financial_rows_v2(s.request_id) r where r.source like 'YOUSIGN\_%' escape '\';
select is((select count(distinct source)::integer from y392_rows where label='client'),7,'client receives all seven subject-scoped native state families');
select is((select count(distinct source)::integer from y392_rows where label='provider'),7,'provider receives all seven subject-scoped native state families');
select is((select count(*)::integer from y392_rows where label='wrong-org'),0,'a verified signer account in the wrong DSR organization receives no native state');
select is((select count(*)::integer from y392_rows where label='outsider'),0,'same-organization membership and a verified DSR do not turn an outsider into a signatory');
select is((select record->>'first_name' from y392_rows where label='client' and source='YOUSIGN_SIGNER_INPUT'),'Client','client preparation retains only the actual client first name');
select is((select record->>'first_name' from y392_rows where label='provider' and source='YOUSIGN_SIGNER_INPUT'),'Provider','provider preparation retains only the actual provider first name');
select is((select record->>'last_name' from y392_rows where label='client' and source='YOUSIGN_SIGNER_INPUT'),'Fixture','subject last name survives the curated projection');
select is((select record->>'provider_signer_id' from y392_rows where label='client' and source='YOUSIGN_SIGNER_REFERENCE'),'ab910000-0000-4000-8000-000000000005','client gets only their native signer reference');
select is((select record->>'provider_signer_id' from y392_rows where label='provider' and source='YOUSIGN_SIGNER_REFERENCE'),'ab910000-0000-4000-8000-000000000006','provider gets only their native signer reference');
select ok(not exists(select 1 from y392_rows where label='client' and record::text like '%ab910000-0000-4000-8000-000000000006%'),'client metadata never contains the other party native signer or audit reference');
select ok(not exists(select 1 from y392_rows where label='provider' and record::text like '%ab910000-0000-4000-8000-000000000005%'),'provider metadata never contains the other party native signer or audit reference');
select ok(not exists(select 1 from y392_rows where record ?| array['operation_key','identity_sha256','storage_path','storage_object_id','artifact_manifest','raw_body','email']),'curated metadata contains no operation keys, identity fingerprints, private paths, raw manifests or provider payload');
select is((select count(*)::integer from y392_rows where label='client' and source='YOUSIGN_NATIVE_ARTIFACT'),2,'client native metadata contains the shared signed PDF and exactly their audit');
select is((select count(*)::integer from y392_rows where label='provider' and source='YOUSIGN_NATIVE_ARTIFACT'),2,'provider native metadata contains the shared signed PDF and exactly their audit');
select ok(not exists(select 1 from y392_rows r cross join lateral jsonb_object_keys(r.record) field where not exists(select 1 from jsonb_array_elements(private.dsr_all_financial_source_v1()->'columns') c where c->>'name'=field)),'every native curated field is explicitly declared in the reviewed virtual-source registry');
select is((select count(*)::integer from jsonb_array_elements(private.dsr_all_catalog_v1()) s where s->>'key' like 'private.yousign\_%' escape '\'),7,'all seven private physical sources remain visible to the independent technical/legal inventory');
select ok(not has_function_privilege('anon','private.dsr_subject_financial_rows_v2(uuid)','execute'),'anonymous callers cannot execute the curated extractor');
select ok(not has_function_privilege('authenticated','private.dsr_subject_financial_rows_v2(uuid)','execute'),'browser roles cannot bypass the DSR capture workflow through the private extractor');
select ok(not has_function_privilege('service_role','private.dsr_subject_financial_rows_v2(uuid)','execute'),'the service role has no direct subject extractor grant');

create temporary table y392_files(label text,entry jsonb);
insert into y392_files select s.label,e from y392_subjects s cross join lateral jsonb_array_elements(private.dsr_all_collect_file_sources_v1(s.request_id)->'entries') e where e->>'bucket'='signature-provider-evidence';
select is((select count(*)::integer from y392_files where label='client'),2,'client file candidates contain the shared signed PDF and exactly their audit JSON');
select is((select count(*)::integer from y392_files where label='provider'),2,'provider file candidates contain the shared signed PDF and exactly their audit JSON');
select is((select count(*)::integer from y392_files where label='wrong-org'),0,'wrong-organization verified account receives no native file candidate');
select is((select count(*)::integer from y392_files where label='outsider'),0,'same-organization outsider receives no native file candidate');
select ok(not exists(select 1 from y392_files where label='client' and entry::text like '%ab910000-0000-4000-8000-000000000006%'),'client file candidates never disclose the provider audit path or source alias');
select ok(not exists(select 1 from y392_files where label='provider' and entry::text like '%ab910000-0000-4000-8000-000000000005%'),'provider file candidates never disclose the client audit path or source alias');
select ok(not exists(select 1 from y392_files where entry->>'trust_kind' is distinct from 'UNTRUSTED'),'provider downloads remain explicitly untrusted review candidates');
select ok(not exists(select 1 from y392_files where coalesce((entry->>'personal_data_review_required')::boolean,false) is not true or coalesce((entry->>'third_party_review_required')::boolean,false) is not true),'personal scope and third-party file reviews remain mandatory');
select ok(not exists(select 1 from y392_files where entry->>'sha256' is distinct from repeat('e',64)),'file candidates retain the native attested content hash rather than inventing a scan receipt');
select ok(not exists(select 1 from y392_files where entry->>'storage_object_id' is null or (entry->>'size_bytes')::bigint<>100 or entry->>'mime_type' not in('application/pdf','application/json')),'native bucket, object metadata, MIME and size remain bound to real fixture Storage rows');
select ok(not exists(select 1 from y392_files f where not exists(select 1 from storage.objects o where o.id=(f.entry->>'storage_object_id')::uuid and o.bucket_id=f.entry->>'bucket' and o.name=f.entry->>'path')),'every native candidate resolves the exact private Storage object');
select ok(not exists(select 1 from y392_files where entry ?| array['scan_result_id','current_scan_result_id'] or entry->>'scan_status'='CLEAN'),'an archived provider artifact is never relabelled antivirus CLEAN');
select ok(not exists(select 1 from y392_subjects s cross join lateral jsonb_array_elements_text(private.dsr_all_collect_file_sources_v1(s.request_id)->'uncovered_families') family where family='private.yousign_native_artifacts_v1'),'the explicit family collector covers the new private artifact family');

-- The broad extractor and file collector still require the actual verified DSR
-- subject. A known envelope does not grant access through a forged request.
select pg_temp.y391_user('a3920000-0000-4000-8000-000000000001');
select throws_ok($$select * from private.dsr_subject_financial_rows_v2('d3920000-0000-4000-8000-000000000001')$$,'42501','DSR_RESPONSE_STAFF_REQUIRED','verified subject is not the legal-staff extraction authority');
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000002');
