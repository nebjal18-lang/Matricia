begin;
set local search_path=public,extensions;
select plan(8);

-- MAT-FUNC-019 behavioral proof: three equivalent providers compete for three
-- independent requests for the same service. Public matching/RFQ commands make
-- every decision; fixture setup and all effects are rolled back.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f1550000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func155-client@example.invalid','',now(),'{}','{}',now(),now()),
 ('f1550000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func155-outsider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.organizations(id,legal_name,display_name,status,created_by) values
 ('f1551000-0000-4000-8000-000000000001','Client rotation 155','Client rotation 155','ACTIVE','f1550000-0000-4000-8000-000000000001'),
 ('f1551000-0000-4000-8000-000000000002','Provider rotation A','Provider rotation A','ACTIVE','f1550000-0000-4000-8000-000000000001'),
 ('f1551000-0000-4000-8000-000000000003','Provider rotation B','Provider rotation B','ACTIVE','f1550000-0000-4000-8000-000000000001'),
 ('f1551000-0000-4000-8000-000000000004','Provider rotation C','Provider rotation C','ACTIVE','f1550000-0000-4000-8000-000000000001'),
 ('f1551000-0000-4000-8000-000000000005','Foreign tenant rotation 155','Foreign tenant rotation 155','ACTIVE','f1550000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
 ('f1552000-0000-4000-8000-000000000001','f1551000-0000-4000-8000-000000000001','f1550000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('f1552000-0000-4000-8000-000000000002','f1551000-0000-4000-8000-000000000005','f1550000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) values
 ('f1552000-0000-4000-8000-000000000001','CLIENT_BUYER'),
 ('f1552000-0000-4000-8000-000000000002','CLIENT_BUYER');

create temporary table provider_fixture(
 provider_organization_id uuid primary key,
 provider_service_id uuid not null,
 questionnaire_session_id uuid not null,
 qualification_id uuid not null,
 qualification_decision_id uuid not null
);
insert into provider_fixture
select provider_organization_id,extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid()
from unnest(array[
 'f1551000-0000-4000-8000-000000000002'::uuid,
 'f1551000-0000-4000-8000-000000000003'::uuid,
 'f1551000-0000-4000-8000-000000000004'::uuid
]) provider_organization_id;

create temporary table request_fixture(sequence_number integer primary key,request_id uuid not null,request_version_id uuid not null);
insert into request_fixture values
 (1,'f1553000-0000-4000-8000-000000000001','f1553100-0000-4000-8000-000000000001'),
 (2,'f1553000-0000-4000-8000-000000000002','f1553100-0000-4000-8000-000000000002'),
 (3,'f1553000-0000-4000-8000-000000000003','f1553100-0000-4000-8000-000000000003');
grant select on provider_fixture,request_fixture to authenticated;

-- Load coherent qualification evidence while suppressing unrelated lifecycle
-- triggers. Checks remain active; the public commands below run with all guards.
set local session_replication_role=replica;
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values
 ('f1554100-0000-4000-8000-000000000001','ROTATION_155','rotation-155','f1551000-0000-4000-8000-000000000001','DRAFT','f1550000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by) values
 ('f1554110-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','ROTATION_CAT','rotation-cat','DRAFT','f1550000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by) values
 ('f1554120-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','f1554110-0000-4000-8000-000000000001','ROTATION_SUB','rotation-sub','DRAFT','f1550000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by) values
 ('f1554000-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','f1554120-0000-4000-8000-000000000001','ROTATION_SERVICE','rotation-service','DRAFT','f1550000-0000-4000-8000-000000000001');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by) values
 ('f1554200-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','ROTATION.155.V1','DRAFT',repeat('e',64),'f1550000-0000-4000-8000-000000000001');
insert into public.questionnaires(id,library_id,code,status,created_by) values
 ('f1554210-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','ROTATION_QUESTIONNAIRE','DRAFT','f1550000-0000-4000-8000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by) values
 ('f1554300-0000-4000-8000-000000000001','f1554210-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','f1554200-0000-4000-8000-000000000001',1,'DRAFT','Questionnaire rotation','استبيان التناوب','Questionnaire pour preuve de rotation','استبيان لإثبات التناوب','PROVIDER','1.0.0','ROTATION-V1',repeat('f',64),'Fixture rotation','f1550000-0000-4000-8000-000000000001');
-- Historical published CLIENT intake is separate from Provider qualification.
-- All live RFQ/approval guards below remain enabled.
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)values('f1934000-0000-4000-8000-000000000001','f1554000-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001',1,'PUBLISHED','Service publié de fixture','خدمة اختبار منشورة','Source historique','مصدر سابق','Source publiée exacte pour la consultation approuvée','مصدر منشور دقيق للاستشارة المعتمدة','CONSULTING','mission','مهمة',1,'TEST historical published service',repeat('a',64),'f1550000-0000-4000-8000-000000000001',now()-interval'1 day','f1554120-0000-4000-8000-000000000001','ROTATION_SERVICE','rotation-service');
update public.catalog_services set status='PUBLISHED',current_published_version_id='f1934000-0000-4000-8000-000000000001'where id='f1554000-0000-4000-8000-000000000001';
update public.catalog_libraries set status='PUBLISHED'where id='f1554100-0000-4000-8000-000000000001';
update public.catalog_releases set status='PUBLISHED',audience='{"kind":"PUBLIC"}',effective_from=now()-interval'1 day',published_at=now()-interval'1 day'where id='f1554200-0000-4000-8000-000000000001';
insert into public.questionnaires(id,library_id,code,status,created_by)values('f1934210-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','ADMIN193_CLIENT','PUBLISHED','f1550000-0000-4000-8000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by,published_at)values('f1934300-0000-4000-8000-000000000001','f1934210-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','f1554200-0000-4000-8000-000000000001',1,'PUBLISHED','Intake Client de fixture','استبيان عميل للاختبار','Source Client publiée exacte','مصدر عميل منشور دقيق','CLIENT','1.0.0','TEST-ADMIN193',repeat('b',64),'APPROVED','f1550000-0000-4000-8000-000000000002',now()-interval'2 days',repeat('c',64),1,'TEST historical published Client intake','f1550000-0000-4000-8000-000000000001',now()-interval'1 day');
update public.questionnaires set current_published_version_id='f1934300-0000-4000-8000-000000000001'where id='f1934210-0000-4000-8000-000000000001';
insert into public.catalog_release_items(release_id,library_id,object_type,object_id,version_id,content_hash,sort_order)values('f1554200-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','SERVICE','f1554000-0000-4000-8000-000000000001','f1934000-0000-4000-8000-000000000001',repeat('a',64),1);
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,partner_contract_expires_at,created_by)
select provider_organization_id,'VERIFIED','ACTIVE','Prestataire équivalent pour preuve de rotation',5,5,'SIGNED',now()+interval '1 year','f1550000-0000-4000-8000-000000000001' from provider_fixture;
insert into public.provider_match_profiles(provider_organization_id,company_verified,documents_valid,financial_status,quality_status,capacity_status,region_codes,partner_contract_signed)
select provider_organization_id,true,true,'OK','OK','AVAILABLE',array['CASABLANCA'],true from provider_fixture;
insert into public.provider_service_match_profiles(provider_organization_id,service_id,qualification_status,required_certifications_valid,service_fit_score,quality_score,historical_delay_score,experience_score,satisfaction_score)
select provider_organization_id,'f1554000-0000-4000-8000-000000000001','APPROVED',true,80,80,80,80,80 from provider_fixture;
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,partner_contract_expires_at,reason,rule_version,decided_by,correlation_id)
select provider_organization_id,1,'VERIFIED','SIGNED',now()+interval '1 year','Validation équivalente','ROTATION-V1','f1550000-0000-4000-8000-000000000001',extensions.gen_random_uuid() from provider_fixture;
insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)
select provider_service_id,provider_organization_id,'f1554000-0000-4000-8000-000000000001','DECIDED','f1550000-0000-4000-8000-000000000001',now() from provider_fixture;
insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)
select questionnaire_session_id,provider_organization_id,'f1550000-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','f1554200-0000-4000-8000-000000000001','f1554300-0000-4000-8000-000000000001','PROVIDER','fr-MA','SUBMITTED',now(),'{}',repeat('1',64) from provider_fixture;
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)
select qualification_id,provider_service_id,provider_organization_id,'f1554000-0000-4000-8000-000000000001' from provider_fixture;
insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,effective_from,expires_at,decided_by,correlation_id)
select qualification_decision_id,qualification_id,provider_organization_id,'f1554000-0000-4000-8000-000000000001',1,'APPROVED','f1554300-0000-4000-8000-000000000001',questionnaire_session_id,8000,jsonb_build_array('IDENTITY'),'[]','Qualification équivalente','ROTATION-V1',now()-interval '1 day',now()+interval '1 year','f1550000-0000-4000-8000-000000000001',extensions.gen_random_uuid() from provider_fixture;
update public.provider_qualifications q set current_decision_id=f.qualification_decision_id from provider_fixture f where q.id=f.qualification_id;
insert into public.provider_capacity_versions(provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,reason,declared_by)
select provider_organization_id,'f1554000-0000-4000-8000-000000000001',1,'AVAILABLE',5,2,now()-interval '1 day','Capacité équivalente','f1550000-0000-4000-8000-000000000001' from provider_fixture;

set local session_replication_role=origin;
insert into public.provider_document_families(id,provider_organization_id,document_kind,code,created_by)
select extensions.gen_random_uuid(),f.provider_organization_id,k.kind,'ROTATION_'||k.kind,'f1550000-0000-4000-8000-000000000001'
from provider_fixture f cross join (values('LEGAL'),('FISCAL'),('INSURANCE')) k(kind);
-- This test fixture uses the public upload/review commands and trusted scanner RPC;
-- it never marks a document VERIFIED by bypassing the clean-scan guard.
create function pg_temp.seed_clean_provider_document(p_family uuid,p_actor uuid,p_expires date)returns uuid language plpgsql as $$
declare family public.provider_document_families%rowtype;reservation jsonb;recorded jsonb;reviewed jsonb;job uuid;prior_claims text:=current_setting('request.jwt.claims',true);key uuid:=extensions.gen_random_uuid();
begin
 select*into family from public.provider_document_families where id=p_family;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aal','aal2')::text,true);
 reservation:=public.begin_provider_document_upload(family.provider_organization_id,'application/pdf',20);
 insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',reservation->>'storage_object_path',p_actor::text,'{"mimetype":"application/pdf","size":20}');
 recorded:=public.record_provider_document_version(family.provider_organization_id,family.document_kind,family.code,jsonb_build_object('issued_on',(current_date-30)::text,'expires_on',p_expires::text,'storage_object_path',reservation->>'storage_object_path','content_hash',repeat('d',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Governed SQL fixture',key::text);
 select id into job from public.provider_document_scan_jobs where document_version_id=(recorded->>'document_version_id')::uuid;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.record_provider_document_scan_result(job,'CLEAN','SQL_FIXTURE_SCANNER','test-only',repeat('d',64),'fixture-scan:'||key::text);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aal','aal2')::text,true);
 reviewed:=public.review_provider_document((recorded->>'document_version_id')::uuid,'VERIFIED','Controlled test review','FIXTURE-V1','fixture-review:'||key::text);
 perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
 return(reviewed->>'document_version_id')::uuid;
exception when others then perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);raise;
end$$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('f1559000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f1559000-0000-4000-8000-000000000001@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('f1559000-0000-4000-8000-000000000001','SUPER_ADMIN');
select pg_temp.seed_clean_provider_document(d.id,'f1559000-0000-4000-8000-000000000001',current_date+365)from public.provider_document_families d where d.provider_organization_id in(select provider_organization_id from provider_fixture);
create temporary sequence fixture_identity_seq;
create function pg_temp.revalidate_fixture_provider(p_org uuid,p_actor uuid)returns void language plpgsql as $$
declare snapshot jsonb;prior text:=current_setting('request.jwt.claims',true);seq text:=lpad(nextval('fixture_identity_seq')::text,9,'0');begin
 insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values(p_org,'ICE','997155'||seq,'PENDING'),(p_org,'IF','99915501','PENDING'),(p_org,'RC','TEST-155-'||seq,'PENDING');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aal','aal2')::text,true);
 snapshot:=public.get_provider_identity_review_context_v1(p_org);
 perform public.revalidate_provider_identity_v1(p_org,(snapshot->>'organization_row_version')::integer,(snapshot->>'profile_row_version')::integer,snapshot->>'identity_hash',(snapshot->>'company_decision_id')::uuid,'Explicit synthetic identity review in transactional fixture',extensions.gen_random_uuid());
 perform set_config('request.jwt.claims',coalesce(prior,''),true);
exception when others then perform set_config('request.jwt.claims',coalesce(prior,''),true);raise;end$$;
select pg_temp.revalidate_fixture_provider(provider_organization_id,'f1559000-0000-4000-8000-000000000001')from provider_fixture;


set local session_replication_role=replica;
insert into public.service_requests(id,client_organization_id,library_id,service_id,questionnaire_version_id,current_version_id,status,created_by)
select request_id,'f1551000-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','f1554000-0000-4000-8000-000000000001','f1934300-0000-4000-8000-000000000001',request_version_id,'READY','f1550000-0000-4000-8000-000000000001' from request_fixture;
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
select request_version_id,request_id,'f1551000-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001',1,'Demande équivalente de rotation numéro '||sequence_number,'NORMAL','MAD','{"region_code":"CASABLANCA"}',true,repeat('a',64),repeat('b',64),'Fixture rotation',repeat(sequence_number::text,64),'f1550000-0000-4000-8000-000000000001' from request_fixture;
set local session_replication_role=origin;

create temporary table rotation_results(kind text primary key,value jsonb);
create temporary table rotation_visibility(kind text primary key,value bigint);
grant select,insert on rotation_results,rotation_visibility to authenticated,service_role;
grant usage on schema extensions to authenticated,service_role;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST-ADMIN193-EXPLICIT-DEVELOPMENT',configured_at=clock_timestamp()where singleton;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1550000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into rotation_results values('MATCH_1',public.run_service_request_matching('f1553000-0000-4000-8000-000000000001','MATCH-V1',1,'admin193-match-1','f1939000-0000-4000-8000-000000000001'));
reset role;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('a1930000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin193-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)select('a1930000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'MATRICIA_ADMIN'from generate_series(1,2)i;
insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)select'e1930000-0000-4000-8000-000000000001','f1551000-0000-4000-8000-000000000001','CHANGE_CONFIGURATION','DEVELOPMENT','MATCHING',value->>'matching_run_id',repeat('a',64),jsonb_build_object('view','consultation','decision','SEND','note','Clarification approuvée','context','Contexte transmis aux prestataires autorisés','channel','platform','dueAt',(current_date+7)::text,'providerIds',jsonb_build_array((select provider_organization_id from public.matching_candidates where matching_run_id=(value->>'matching_run_id')::uuid and eligible order by score_basis_points desc,provider_organization_id limit 1))),'Ouvrir le panel approuvé avec un contexte précis',2,'AUTHORIZED','f1559000-0000-4000-8000-000000000001'from rotation_results where kind='MATCH_1';
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)select'e1930000-0000-4000-8000-000000000001','APPROVE','Approbation indépendante du panel de test',repeat('a',64),('a1930000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.sub','',true);
insert into rotation_results values('OPEN_1',public.execute_admin_operational_action_v1('e1930000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));
insert into rotation_results values('OPEN_REPLAY',public.execute_admin_operational_action_v1('e1930000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));
reset role;
select is((select value->>'outcome'from rotation_results where kind='OPEN_1'),'ADMIN_ACTION_EXECUTED','approved consultation opens a real RFQ');
select is((select status from public.service_requests where id='f1553000-0000-4000-8000-000000000001'),'RFQ_OPEN','source Client request follows the real RFQ lifecycle');
select is((select count(*)from public.rfqs where request_id='f1553000-0000-4000-8000-000000000001'),1::bigint,'worker replay creates exactly one RFQ');
select is((select count(*)from public.admin_consultation_executions_v1 where action_request_id='e1930000-0000-4000-8000-000000000001'),1::bigint,'immutable execution manifest records the approved panel');
select is((select confidentiality_settings->'admin_consultation'->>'subject'from public.rfqs where request_id='f1553000-0000-4000-8000-000000000001'),'Clarification approuvée','approved subject reaches the actual provider consultation');
select ok((select confidentiality_settings->'admin_consultation'->>'response_deadline'=(current_date+7)::text from public.rfqs where request_id='f1553000-0000-4000-8000-000000000001'),'approved response deadline is preserved');
select is((select count(*)from public.rfq_providers p join public.rfqs r on r.id=p.rfq_id where r.request_id='f1553000-0000-4000-8000-000000000001'),1::bigint,'only the explicitly approved provider is invited');
select ok(not exists(select 1 from public.admin_consultation_proposals_v1 where action_request_id='e1930000-0000-4000-8000-000000000001'),'real opening is not replaced with a pending proposal');
select*from finish();rollback;
