begin;
set local search_path=public,private,extensions;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='ROLLBACK-ONLY-QUOTE-IDENTITY-TEST'where singleton;
select plan(15);
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('fa120000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-provider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)
values
 ('QUOTE_ANCHOR_A','Devis test A','اختبار أ','Catégorie fiscale test A','فئة اختبار أ','SERVICE','ACTIVE'),
 ('QUOTE_ANCHOR_B','Devis test B','اختبار ب','Catégorie fiscale test B','فئة اختبار ب','SERVICE','ACTIVE'),
 ('QUOTE_ANCHOR_DEMO','Devis test démo','اختبار تجريبي','Catégorie fiscale démo','فئة تجريبية','SERVICE','ACTIVE'),
 ('QUOTE_ANCHOR_RETIRED','Devis expiré','اختبار منتهي','Catégorie de règle expirée','فئة قاعدة منتهية','SERVICE','ACTIVE');

insert into public.tax_rule_versions(
 id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,
 professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,
 approved_by,approved_at,validation_reference,content_hash,change_reason
) values
 ('fa121000-0000-4000-8000-000000000001','MA','QUOTE_ANCHOR_A',1,2000,'2026-01-01',null,'DRAFT','PENDING','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('1',64),'Règle inactive pour test'),
 ('fa121000-0000-4000-8000-000000000002','MA','QUOTE_ANCHOR_DEMO',1,2000,'2026-01-01',null,'RETIRED','DEMO','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('2',64),'Règle démonstration non validée'),
 ('fa121000-0000-4000-8000-000000000003','MA','QUOTE_ANCHOR_B',1,2000,'2030-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa120000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('3',64),'Règle future validée test'),
 ('fa121000-0000-4000-8000-000000000004','MA','QUOTE_ANCHOR_RETIRED',1,2000,'2020-01-01','2020-12-31','ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa120000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('4',64),'Règle expirée validée test'),
 ('fa121000-0000-4000-8000-000000000005','MA','QUOTE_ANCHOR_A',2,2000,'2026-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa120000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('5',64),'Règle valide test');

insert into public.organizations(id,legal_name,display_name,status,created_by) values
('fa122000-0000-4000-8000-000000000001','Client fiscal test','Client fiscal test','ACTIVE','fa120000-0000-4000-8000-000000000001'),
('fa122000-0000-4000-8000-000000000002','Provider fiscal test','Provider fiscal test','ACTIVE','fa120000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status) values('fa123000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002','fa120000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values('fa123000-0000-4000-8000-000000000001','PROVIDER_SALES');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values('fa124000-0000-4000-8000-000000000001','QUOTE_TAX','quote-tax','fa122000-0000-4000-8000-000000000001','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by) values('fa124000-0000-4000-8000-000000000002','fa124000-0000-4000-8000-000000000001','QUOTE_TAX_CAT','quote-tax-cat','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by) values('fa124000-0000-4000-8000-000000000003','fa124000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000002','QUOTE_TAX_SUB','quote-tax-sub','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by) values('fa124000-0000-4000-8000-000000000004','fa124000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000003','QUOTE_TAX_SERVICE','quote-tax-service','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values('fa125000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000004','MATCHING','fa120000-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by) values('fa125000-0000-4000-8000-000000000002','fa125000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000001',1,'Demande fiscale test','NORMAL','MAD','{"region_code":"CASABLANCA","tax_category_code":"QUOTE_ANCHOR_A"}',true,repeat('6',64),repeat('7',64),'Fixture fiscale',repeat('8',64),'fa120000-0000-4000-8000-000000000001');
update public.service_requests set current_version_id='fa125000-0000-4000-8000-000000000002' where id='fa125000-0000-4000-8000-000000000001';
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at) values('fa126000-0000-4000-8000-000000000001','fa125000-0000-4000-8000-000000000001','fa125000-0000-4000-8000-000000000002','MATCH-V1','COMPLETED',1,'fa120000-0000-4000-8000-000000000001',now());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component) values('fa126000-0000-4000-8000-000000000002','fa126000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002',true,9000,'{}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by) values('fa127000-0000-4000-8000-000000000001','fa125000-0000-4000-8000-000000000001','fa125000-0000-4000-8000-000000000002','fa126000-0000-4000-8000-000000000001','OPEN',now()+interval'7 days','{"mask_direct_contacts":true,"competitor_offers_visible":false}',1,'fa120000-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values('fa128000-0000-4000-8000-000000000001','fa127000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002','fa126000-0000-4000-8000-000000000002','ACCEPTED',now());
set local session_replication_role=origin;

-- Historical published catalogue precondition; fiscal mapping uses real independent commands.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('f2669000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','mapping266-'||i||'@example.invalid',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values('f2669000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('f2669000-0000-4000-8000-000000000002','SUPER_ADMIN');
do $$declare r public.service_requests%rowtype;v public.service_request_versions%rowtype;vid uuid:=extensions.gen_random_uuid();context jsonb;proposal jsonb;claims text:=current_setting('request.jwt.claims',true);begin
 select*into r from public.service_requests where id='fa125000-0000-4000-8000-000000000001';select*into v from public.service_request_versions where request_id=r.id order by version_number limit 1;
 insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at)values(vid,r.service_id,r.library_id,1,'PUBLISHED','Service fiscal TEST','خدمة اختبار','Service test','خدمة اختبار','Catalogue historique TEST','كتالوج اختبار تاريخي','CONSULTING','Forfait','حزمة',1,'Historical source for quote tax test',v.catalog_snapshot_hash,r.created_by,now()-interval'2 days');
 perform set_config('request.jwt.claims','{"sub":"f2669000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 context:=public.get_service_tax_category_mapping_context_v1(vid,'MA',v.currency_code);
 proposal:=public.propose_service_tax_category_mapping_v1(vid,v.catalog_snapshot_hash,context->>'scope_hash','MA',v.currency_code,'QUOTE_ANCHOR_A',current_date,null,true,'{}','TEST exact source classification',extensions.gen_random_uuid());
 perform set_config('request.jwt.claims','{"sub":"f2669000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_service_tax_category_mapping_v1((proposal->>'proposal_id')::uuid,proposal->>'content_hash',true,'TEST/266/QUOTE','Independent TEST classification review');
 perform set_config('request.jwt.claims',coalesce(claims,''),true);
end$$;

create temporary table anchor_quote_payload(value jsonb);
insert into anchor_quote_payload values(jsonb_build_object('currency','MAD','solution_fr','Solution fiscale','solution_ar','','deliverables',jsonb_build_array('Livrable'),'inclusions','[]'::jsonb,'exclusions','[]'::jsonb,'prerequisites','[]'::jsonb,'warranty_fr','Garantie test','warranty_ar','','correction_terms_fr','Corrections incluses','correction_terms_ar','','sla','{}'::jsonb,'proposed_start_date','2026-09-12','duration_days','10','valid_until',(now()+interval'30 days')::text,'items',jsonb_build_array(jsonb_build_object('line_number','1','item_kind','ONE_TIME','label_fr','Forfait test','label_ar','','quantity','1','unit_code','FORFAIT','unit_price_minor','10000','tax_rule_version_id','fa121000-0000-4000-8000-000000000005','recurrence_interval','')),'options','[]'::jsonb));
update anchor_quote_payload set value=value||'{"expected_current_version_id":null}'::jsonb;
grant select on anchor_quote_payload to authenticated;
create temporary table anchor_quote_result(value jsonb);grant select,insert on anchor_quote_result to authenticated;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('f2120000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('f2120000-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('fa122000-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','fa120000-0000-4000-8000-000000000001');
insert into public.provider_match_profiles(provider_organization_id)values('fa122000-0000-4000-8000-000000000002');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values('fa122000-0000-4000-8000-000000000002',1,'VERIFIED','SIGNED','Synthetic company review','TEST-ANCHOR','f2120000-0000-4000-8000-000000000002',extensions.gen_random_uuid());
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('fa122000-0000-4000-8000-000000000002','ICE','997212000000001'),('fa122000-0000-4000-8000-000000000002','IF','99721201'),('fa122000-0000-4000-8000-000000000002','RC','TEST-212');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='f2120000-0000-4000-8000-000000000002';org uuid:='fa122000-0000-4000-8000-000000000002';begin
 foreach kind in array array['LEGAL','FISCAL','INSURANCE']loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  u:=public.begin_provider_document_upload(org,'application/pdf',20);
  insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',u->>'storage_object_path',actor::text,'{"mimetype":"application/pdf","size":20}');
  d:=public.record_provider_document_version(org,kind,'ANCHOR_'||kind,jsonb_build_object('issued_on',current_date::text,'expires_on',(current_date+365)::text,'storage_object_path',u->>'storage_object_path','content_hash',repeat('d',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Synthetic identity evidence for quote test','anchor-doc-'||kind);
  select id into job from public.provider_document_scan_jobs where document_version_id=(d->>'document_version_id')::uuid;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);perform public.record_provider_document_scan_result(job,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('d',64),'anchor-scan-'||kind);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);perform public.review_provider_document((d->>'document_version_id')::uuid,'VERIFIED','Synthetic reviewer decision','TEST-ANCHOR','anchor-review-'||kind);
 end loop;
 context:=public.get_provider_identity_review_context_v1(org);
 perform public.revalidate_provider_identity_v1(org,(context->>'organization_row_version')::integer,(context->>'profile_row_version')::integer,context->>'identity_hash',(context->>'company_decision_id')::uuid,'Synthetic current identity review before publication',extensions.gen_random_uuid());
end$$;
select set_config('request.jwt.claims','{"sub":"fa120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into anchor_quote_result select public.create_quote_revision('fa128000-0000-4000-8000-000000000001',(select value from anchor_quote_payload),'Initial reviewed quote','anchor-quote-create');
select is(private.provider_quote_identity_snapshot_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result)),null::jsonb,'a draft is not an identity publication anchor');
select set_config('test.anchor_identity',public.get_my_provider_identity_status_v1('fa122000-0000-4000-8000-000000000002')::text,true);
select throws_ok($$select public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),repeat('a',64),'TEST registered address','anchor-quote-submit')$$,'40001','QUOTE_PROVIDER_IDENTITY_CHANGED','a stale legal identity cannot publish a quote');
create temporary table published_anchor(value jsonb);
insert into published_anchor select public.submit_provider_quote_with_identity_v1((value->>'quote_id')::uuid,(value->>'quote_version_id')::uuid,current_setting('test.anchor_identity')::jsonb->>'identity_hash','TEST registered address','anchor-quote-submit')from anchor_quote_result;
select is((select value->>'outcome'from published_anchor),'QUOTE_SUBMITTED','publication and its immutable identity snapshot commit together');
select ok((select a.identity_snapshot->>'schema_version'='1'and a.identity_snapshot->>'registered_address'='TEST registered address'and a.identity_snapshot->>'identity_review_id'is not null from public.provider_quote_identity_snapshots a where a.quote_version_id=(select(value->>'quote_version_id')::uuid from anchor_quote_result)),'anchor freezes the exact verified identity and explicitly declared address');
select throws_ok($$select public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.anchor_identity')::jsonb->>'identity_hash','Different registered address','anchor-quote-submit')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','retry cannot silently change the contractual address');
update public.organizations set legal_name='Changed after offer publication',row_version=row_version+1 where id='fa122000-0000-4000-8000-000000000002';
select is(private.provider_quote_identity_snapshot_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result))->>'legal_name','Provider fiscal test','contract consumer reads the published identity instead of the later organization');
select is(public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.anchor_identity')::jsonb->>'identity_hash','TEST registered address','anchor-quote-submit'),(select value from published_anchor),'publication replay remains exact after a later identity change');
select throws_ok($$update public.provider_quote_identity_snapshots set identity_snapshot='{}'where quote_version_id=(select(value->>'quote_version_id')::uuid from anchor_quote_result)$$,'55000',null,'published identity snapshots cannot be rewritten');
-- Separate synthetic legacy published version: existing unanchored offers never receive an invented old anchor.
update public.quotes set status='REVISION_REQUESTED'where id=(select(value->>'quote_id')::uuid from anchor_quote_result);
insert into anchor_quote_payload select value||jsonb_build_object('expected_current_version_id',(select value->>'quote_version_id'from anchor_quote_result))from anchor_quote_payload limit 1;
delete from anchor_quote_payload where not(value->>'expected_current_version_id'is not null);
insert into anchor_quote_result select public.create_quote_revision('fa128000-0000-4000-8000-000000000001',(select value from anchor_quote_payload limit 1),'Synthetic legacy revision','anchor-quote-legacy-create');
select set_config('test.legacy_version',(select value->>'quote_version_id'from anchor_quote_result order by value->>'version_number'desc limit 1),true);
update public.quote_versions set lifecycle_status='SUBMITTED',submitted_at=clock_timestamp()where id=current_setting('test.legacy_version')::uuid;
update public.quotes set status='SUBMITTED'where id=(select(value->>'quote_id')::uuid from anchor_quote_result limit 1);
select throws_ok($$select public.submit_quote((select(value->>'quote_id')::uuid from anchor_quote_result limit 1),current_setting('test.legacy_version')::uuid,'legacy-no-backfill')$$,'55000','QUOTE_IDENTITY_REPUBLICATION_REQUIRED','the old endpoint cannot invent an anchor for an already published offer');
select is(public.reopen_provider_quote_for_identity_review_v1((select(value->>'quote_id')::uuid from anchor_quote_result limit 1),current_setting('test.legacy_version')::uuid,'Explicit new-version review for legacy identity','anchor-legacy-reopen')->>'outcome','QUOTE_IDENTITY_REPUBLICATION_REQUESTED','legacy offer has an explicit path to a reviewed new revision');
select is((select lifecycle_status from public.quote_versions where id=current_setting('test.legacy_version')::uuid),'SUBMITTED','reopening leaves the old published version unchanged');
select is((select count(*)from public.provider_quote_identity_snapshots where quote_version_id=current_setting('test.legacy_version')::uuid),0::bigint,'legacy review does not fabricate a prior publication anchor');
select ok(not private.provider_current_identity_is_verified_v1('fa122000-0000-4000-8000-000000000002'),'later changed company still requires its own current identity review');
select set_config('request.jwt.claims','{"sub":"f2120000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)from public.provider_quote_identity_snapshots),0::bigint,'RLS does not expose publication identity to an unrelated actor without current administrative MFA');
select throws_ok($$select private.provider_quote_identity_snapshot_v1(current_setting('test.legacy_version')::uuid)$$,'42501',null,'the authoritative contract helper is not a caller-controlled public API');
reset role;
select*from finish();rollback;
