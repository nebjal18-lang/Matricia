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

-- Exercise the actual ALL capture and pending manifest, with two distinct
-- synthetic AAL2 legal actors. These rollback-only policy decisions certify no
-- real legal basis and never alter an approved deployment inventory.
create temporary table y392_capture(k text primary key,v jsonb);
grant all on y392_capture to authenticated;
insert into public.platform_user_roles(user_id,role_code) values('f2120000-0000-4000-8000-000000000002','SUPER_ADMIN') on conflict do nothing;
set local role authenticated;
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000001');
insert into y392_capture values('client-scope',public.confirm_my_dsr_scope_v1('d3920000-0000-4000-8000-000000000001',array['ALL'],'TEST-Y392-client-scope'));
select pg_temp.y391_user('fa120000-0000-4000-8000-000000000001');
insert into y392_capture values('provider-scope',public.confirm_my_dsr_scope_v1('d3920000-0000-4000-8000-000000000002',array['ALL'],'TEST-Y392-provider-scope'));
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000002');
insert into y392_capture values('draft',public.create_dsr_all_inventory_draft_v1('TEST ONLY synthetic native signature disclosure policy, never an actual legal approval','TEST-Y392-inventory-draft'));
reset role;
create function pg_temp.y392_classify() returns void language plpgsql as $$
declare source jsonb;fields jsonb;excluded jsonb;configuration jsonb;begin
 for source in select value from public.dsr_all_inventory_drafts_v1 d cross join lateral jsonb_array_elements(d.catalog_json) where d.id=(select(v->>'draft_id')::uuid from y392_capture where k='draft') loop
  fields:='[]';
  if source->>'key'='@subject_financial_records_v1' then select coalesce(jsonb_agg(c->>'name'),'[]') into fields from jsonb_array_elements(source->'columns')c where(c->>'exportable')::boolean;end if;
  select coalesce(jsonb_object_agg(c->>'name',jsonb_build_object('basis_code',case when(c->>'security_secret')::boolean then'SECURITY_SECRET'else'THIRD_PARTY_RIGHTS'end,'legal_reference','TEST-ONLY-Y392-SYNTHETIC-DISCLOSURE','reason','TEST ONLY synthetic duplicate or third party source exclusion; subject fields use the curated verified-signatory source')),'{}') into excluded from jsonb_array_elements(source->'columns')c where not fields?(c->>'name');
  configuration:=jsonb_build_object('mode',case when source->>'key'='@subject_financial_records_v1' then'EXTRACT'else'EXCLUDE'end,'subject_path_id',case when source->>'key'='@subject_financial_records_v1'then source#>>'{subject_paths,0,id}'end,'organization_path_ids',case when source->>'key'='@subject_financial_records_v1'then jsonb_build_array(source#>>'{organization_paths,0,id}')else'[]'::jsonb end,'account_global',false,'include_null_organization',false,'fields',fields,'excluded_fields',excluded,'legal_reference','TEST-ONLY-Y392-SYNTHETIC-DISCLOSURE','reason','TEST ONLY synthetic isolated disclosure policy; no real legal approval');
  perform public.configure_dsr_all_inventory_source_v1((select(v->>'draft_id')::uuid from y392_capture where k='draft'),source->>'key',0,configuration,'TEST-Y392-classify:'||(source->>'key'));
 end loop;
end$$;
select pg_temp.y392_classify();
set local role authenticated;
insert into y392_capture values('inventory',public.submit_dsr_all_inventory_v1((select(v->>'draft_id')::uuid from y392_capture where k='draft'),(select v->>'catalog_hash' from y392_capture where k='draft'),'TEST-ONLY-Y392-SYNTHETIC-DISCLOSURE','TEST-Y392-submit'));
select throws_ok($$select public.decide_dsr_all_inventory_v1((select(v->>'inventory_version_id')::uuid from y392_capture where k='inventory'),(select v->>'content_hash' from y392_capture where k='inventory'),true,true,'TEST-ONLY-Y392-SYNTHETIC-DISCLOSURE','TEST ONLY same author must not approve native classifications')$$,'42501','DSR_INVENTORY_INDEPENDENT_REVIEW_REQUIRED','native signature disclosure classifications still require four-eyes review');
select pg_temp.y391_user('f2120000-0000-4000-8000-000000000002');
select public.decide_dsr_all_inventory_v1((select(v->>'inventory_version_id')::uuid from y392_capture where k='inventory'),(select v->>'content_hash' from y392_capture where k='inventory'),true,true,'TEST-ONLY-Y392-SYNTHETIC-DISCLOSURE','TEST ONLY independent rollback policy review, never actual legal approval');
insert into y392_capture values('client-package',public.capture_admin_dsr_all_v1('d3920000-0000-4000-8000-000000000001',(select(v->>'scope_version_id')::uuid from y392_capture where k='client-scope'),(select(v->>'inventory_version_id')::uuid from y392_capture where k='inventory'),'TEST-Y392-client-capture'));
insert into y392_capture values('provider-package',public.capture_admin_dsr_all_v1('d3920000-0000-4000-8000-000000000002',(select(v->>'scope_version_id')::uuid from y392_capture where k='provider-scope'),(select(v->>'inventory_version_id')::uuid from y392_capture where k='inventory'),'TEST-Y392-provider-capture'));
reset role;
insert into y392_capture select replace(c.k,'-package','-snapshot'),p.snapshot_json::jsonb from y392_capture c join public.dsr_all_packages_v1 p on p.id=(c.v->>'package_id')::uuid where c.k in('client-package','provider-package');
insert into y392_capture select replace(c.k,'-package','-manifest'),private.dsr_all_file_manifest_v1((c.v->>'package_id')::uuid) from y392_capture c where c.k in('client-package','provider-package');
select is((select v->>'catalog_hash' from y392_capture where k='client-snapshot'),(select v->>'catalog_hash' from y392_capture where k='draft'),'captured ALL package binds the technical catalog including the new native projection fields');
select is((select count(*)::integer from y392_capture c cross join lateral jsonb_array_elements(c.v->'sources')s cross join lateral jsonb_array_elements(s->'records')r where c.k='client-snapshot' and s->>'source_key'='@subject_financial_records_v1' and r#>>'{fields,source}' like 'YOUSIGN\_%' escape '\'),8,'actual client ALL capture retains all eight native subject rows across seven families');
select is((select count(*)::integer from y392_capture c cross join lateral jsonb_array_elements(c.v->'sources')s cross join lateral jsonb_array_elements(s->'records')r where c.k='provider-snapshot' and s->>'source_key'='@subject_financial_records_v1' and r#>>'{fields,source}' like 'YOUSIGN\_%' escape '\'),8,'actual provider ALL capture retains all eight native subject rows across seven families');
select ok(not exists(select 1 from y392_capture c cross join lateral jsonb_array_elements(c.v->'sources')s cross join lateral jsonb_array_elements(s->'records')r where c.k='client-snapshot' and(r::text like '%ab910000-0000-4000-8000-000000000006%' or r#>>'{fields,first_name}'='Provider')),'actual client capture contains neither the counterparty name nor their native audit reference');
select ok(not exists(select 1 from y392_capture c cross join lateral jsonb_array_elements(c.v->'sources')s cross join lateral jsonb_array_elements(s->'records')r where c.k='provider-snapshot' and(r::text like '%ab910000-0000-4000-8000-000000000005%' or r#>>'{fields,first_name}'='Client')),'actual provider capture contains neither the counterparty name nor their native audit reference');
select is((select count(*)::integer from y392_capture c cross join lateral jsonb_array_elements(c.v#>'{file_sources,entries}')e where c.k='client-snapshot' and e->>'bucket'='signature-provider-evidence'),2,'actual client snapshot freezes exactly the shared PDF and their personal native audit candidate');
select is((select count(*)::integer from y392_capture c cross join lateral jsonb_array_elements(c.v#>'{file_sources,entries}')e where c.k='provider-snapshot' and e->>'bucket'='signature-provider-evidence'),2,'actual provider snapshot freezes exactly the shared PDF and their personal native audit candidate');
select ok((select(v->>'coverage_complete')::boolean from(select private.dsr_all_collect_file_sources_v1('d3920000-0000-4000-8000-000000000001')v)coverage),'the native family is covered by the real technical file collector');
select ok(not exists(select 1 from y392_capture where k in('client-manifest','provider-manifest') and coalesce((v->>'complete')::boolean,false)),'captured native files cannot produce a complete manifest before content and third-party review');
select ok(not exists(select 1 from y392_capture c cross join lateral jsonb_array_elements(c.v->'entries')e where c.k in('client-manifest','provider-manifest') and(e->>'disposition' is distinct from 'PENDING' or coalesce((e->>'ready')::boolean,false))),'every unreviewed captured file remains explicitly PENDING and unavailable');
select ok(not exists(select 1 from y392_capture where k in('client-manifest','provider-manifest') and v::text~'"(bucket|path|storage_object_id|source_aliases)"'),'actual delivered-shape manifests omit private source locators and raw source aliases');
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
