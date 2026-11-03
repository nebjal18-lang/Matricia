begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-scan-fixture-0155',configured_at=clock_timestamp()where singleton;

set local search_path=public,extensions;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST/RFQ-AUTHORITY-0155',configured_at=clock_timestamp()where singleton;
select plan(26);

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
select request_id,'f1551000-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001','f1554000-0000-4000-8000-000000000001','f1554300-0000-4000-8000-000000000001',request_version_id,'READY','f1550000-0000-4000-8000-000000000001' from request_fixture;
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
select request_version_id,request_id,'f1551000-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001',1,'Demande équivalente de rotation numéro '||sequence_number,'NORMAL','MAD','{"region_code":"CASABLANCA"}',true,repeat('a',64),repeat('b',64),'Fixture rotation',repeat(sequence_number::text,64),'f1550000-0000-4000-8000-000000000001' from request_fixture;
set local session_replication_role=origin;


-- Declared historical Client publication source; fiscal approvals below use
-- real commands and never update a rate or reviewed mapping directly.
set local session_replication_role=replica;
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)values('f1554010-0000-4000-8000-000000000001','f1554000-0000-4000-8000-000000000001','f1554100-0000-4000-8000-000000000001',1,'PUBLISHED','Service publié ROTATION155','خدمة منشورة ROTATION155','Précondition de recette locale','شرط اختبار محلي','Référence publiée historique de recette locale','مرجع منشور تاريخي للاختبار المحلي','CONSULTING','mission','مهمة',1,'Précondition historique publiée',repeat('a',64),'f1550000-0000-4000-8000-000000000001',now()-interval'1 day','f1554120-0000-4000-8000-000000000001','ROTATION155_PUBLISHED','rotation155-published');
update public.catalog_services set status='PUBLISHED',current_published_version_id='f1554010-0000-4000-8000-000000000001'where id='f1554000-0000-4000-8000-000000000001';
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,published_at,created_by)values('f1554200-0000-4000-8000-000000000002','f1554100-0000-4000-8000-000000000001','ROTATION155.CLIENT.V1','PUBLISHED',repeat('a',64),repeat('a',64),now()-interval'1 day','f1550000-0000-4000-8000-000000000001');
insert into public.questionnaires(id,library_id,code,status,current_published_version_id,created_by)values('f1554210-0000-4000-8000-000000000002','f1554100-0000-4000-8000-000000000001','ROTATION155_CLIENT','PUBLISHED','f1554300-0000-4000-8000-000000000002','f1550000-0000-4000-8000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by,published_at)values('f1554300-0000-4000-8000-000000000002','f1554210-0000-4000-8000-000000000002','f1554100-0000-4000-8000-000000000001','f1554200-0000-4000-8000-000000000002',1,'PUBLISHED','Questionnaire Client publié ROTATION155','استبيان العميل المنشور ROTATION155','Référence historique publiée de recette','مرجع تاريخي منشور للاختبار','CLIENT','2.0.0','ROTATION155_CLIENT',repeat('b',64),'APPROVED','f1559000-0000-4000-8000-000000000001',now()-interval'1 day',repeat('b',64),1,'Précondition historique Client publiée','f1550000-0000-4000-8000-000000000001',now()-interval'1 day');
insert into public.catalog_release_items(release_id,library_id,object_type,object_id,version_id,content_hash,sort_order)values('f1554200-0000-4000-8000-000000000002','f1554100-0000-4000-8000-000000000001','SERVICE','f1554000-0000-4000-8000-000000000001','f1554010-0000-4000-8000-000000000001',repeat('a',64),1);
set local session_replication_role=origin;
update public.service_requests set questionnaire_version_id='f1554300-0000-4000-8000-000000000002'where id in(select request_id from request_fixture);

create temporary table rotation_results(kind text primary key,value jsonb);
create temporary table rotation_visibility(kind text primary key,value bigint);
grant select,insert on rotation_results,rotation_visibility to authenticated;

-- Run and open each independent operation sequentially. Every open updates the
-- 90-day invitation history consumed by the following real matching run.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1550000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into rotation_results values('MATCH_1',public.run_service_request_matching('f1553000-0000-4000-8000-000000000001','MATCH-V1',1,'func155-match-1','f1559000-0000-4000-8000-000000000001'));
insert into rotation_results select 'OPEN_1',public.open_service_request_rfq('f1553000-0000-4000-8000-000000000001',(select (value->>'matching_run_id')::uuid from rotation_results where kind='MATCH_1'),statement_timestamp()+interval '7 days','func155-open-1','f1559000-0000-4000-8000-000000000002');
insert into rotation_results values('MATCH_2',public.run_service_request_matching('f1553000-0000-4000-8000-000000000002','MATCH-V1',1,'func155-match-2','f1559000-0000-4000-8000-000000000003'));
insert into rotation_results select 'OPEN_2',public.open_service_request_rfq('f1553000-0000-4000-8000-000000000002',(select (value->>'matching_run_id')::uuid from rotation_results where kind='MATCH_2'),statement_timestamp()+interval '7 days','func155-open-2','f1559000-0000-4000-8000-000000000004');
insert into rotation_results values('MATCH_3',public.run_service_request_matching('f1553000-0000-4000-8000-000000000003','MATCH-V1',1,'func155-match-3','f1559000-0000-4000-8000-000000000005'));
insert into rotation_results select 'OPEN_3',public.open_service_request_rfq('f1553000-0000-4000-8000-000000000003',(select (value->>'matching_run_id')::uuid from rotation_results where kind='MATCH_3'),statement_timestamp()+interval '7 days','func155-open-3','f1559000-0000-4000-8000-000000000006');
insert into rotation_results values('MATCH_1_REPLAY',public.run_service_request_matching('f1553000-0000-4000-8000-000000000001','MATCH-V1',1,'func155-match-1','f1559000-0000-4000-8000-000000000099'));
reset role;

select is((select count(*) from rotation_results where kind like 'MATCH_%' and value->>'outcome'='MATCHING_COMPLETED'),4::bigint,'three matching operations and one replay call the real engine successfully');
select is((select count(*) from public.matching_runs where request_id in(select request_id from request_fixture)),3::bigint,'matching replay does not duplicate a run');
select is((select value from rotation_results where kind='MATCH_1_REPLAY'),(select value from rotation_results where kind='MATCH_1'),'matching replay returns the exact cached response');
select is((select count(*) from public.matching_candidates c join public.matching_runs r on r.id=c.matching_run_id where r.request_id in(select request_id from request_fixture)),9::bigint,'each real run evaluates all three providers');
select ok((select bool_and(distinct_adjusted_scores=1) from(select matching_run_id,count(distinct(score_basis_points-rotation_component::integer*10)) distinct_adjusted_scores from public.matching_candidates where matching_run_id in(select (value->>'matching_run_id')::uuid from rotation_results where kind like 'MATCH__') group by matching_run_id)x),'candidates are equivalent after removing only the explicit rotation component');
select ok((select count(*)=3 and min(rotation_component)=100 and max(rotation_component)=100 from public.matching_candidates where matching_run_id=(select (value->>'matching_run_id')::uuid from rotation_results where kind='MATCH_1')),'first operation starts all equivalent providers at rotation 100');
select ok((select array_agg(rotation_component order by provider_organization_id)=array[90,100,100]::smallint[] from public.matching_candidates where matching_run_id=(select (value->>'matching_run_id')::uuid from rotation_results where kind='MATCH_2')),'second operation penalizes only the first invited provider');
select ok((select array_agg(rotation_component order by provider_organization_id)=array[90,90,100]::smallint[] from public.matching_candidates where matching_run_id=(select (value->>'matching_run_id')::uuid from rotation_results where kind='MATCH_3')),'third operation preserves the uninvited provider rotation advantage');
select is((select count(*) from rotation_results where kind like 'OPEN_%' and value->>'outcome'='RFQ_OPENED'),3::bigint,'all three RFQs are opened by the real command');
select ok((select bool_and((value->>'invited_count')::integer=1 and value->>'fair_rotation_policy'='FAIR-ROTATION-90D-V2') from rotation_results where kind like 'OPEN_%'),'each operation awards one slot under the declared fair-rotation policy');
select is((select array_agg(rp.provider_organization_id order by f.sequence_number) from request_fixture f join public.rfqs r on r.request_id=f.request_id join public.rfq_providers rp on rp.rfq_id=r.id),array['f1551000-0000-4000-8000-000000000002'::uuid,'f1551000-0000-4000-8000-000000000003'::uuid,'f1551000-0000-4000-8000-000000000004'::uuid],'equivalent candidates rotate deterministically A then B then C');
select is((select count(distinct rp.provider_organization_id) from public.rfq_providers rp join public.rfqs r on r.id=rp.rfq_id where r.request_id in(select request_id from request_fixture)),3::bigint,'anti-monopoly gives all three equivalent providers one award');
select ok((select bool_and(invitation_count=1) from(select provider_organization_id,count(*) invitation_count from public.rfq_providers where provider_organization_id in(select provider_organization_id from provider_fixture) group by provider_organization_id)x),'no provider receives a second invitation while an equivalent provider remains uninvited');
select ok((select bool_and(status='RFQ_OPEN') from public.service_requests where id in(select request_id from request_fixture)),'all source requests complete the matching-to-RFQ transition');
select is((select count(*) from public.audit_events where action='rfq.matching.completed' and organization_id='f1551000-0000-4000-8000-000000000001' and resource_id in(select value->>'matching_run_id' from rotation_results where kind like 'MATCH__')),3::bigint,'three matching decisions are audited once each');
select is((select count(*) from public.event_outbox where event_type='MATCHING_COMPLETED' and organization_id='f1551000-0000-4000-8000-000000000001' and aggregate_id in(select value->>'matching_run_id' from rotation_results where kind like 'MATCH__')),3::bigint,'three matching decisions emit one outbox event each');
select is((select count(*) from public.audit_events where action='rfq.opened' and organization_id='f1551000-0000-4000-8000-000000000001' and resource_id in(select value->>'rfq_id' from rotation_results where kind like 'OPEN_%')),3::bigint,'three rotation awards are audited once each');
select is((select count(*) from public.event_outbox where event_type='RFQ_OPENED' and organization_id='f1551000-0000-4000-8000-000000000001' and aggregate_id in(select value->>'rfq_id' from rotation_results where kind like 'OPEN_%')),3::bigint,'three rotation awards emit one outbox event each');
select is((select count(*) from public.audit_events where action in('rfq.matching.completed','rfq.opened') and organization_id='f1551000-0000-4000-8000-000000000005'),0::bigint,'matching and rotation never attribute effects to the foreign tenant');

select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"f1550000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);select public.run_service_request_matching('f1553000-0000-4000-8000-000000000001','MATCH-V1',1,'func155-foreign-match','f1559000-0000-4000-8000-000000000007')$$,'42501','REQUEST_SCOPE_DENIED','foreign tenant cannot invoke matching on another client request');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1550000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into rotation_visibility values('RUNS',(select count(*) from public.matching_runs where request_id in(select request_id from request_fixture)));
insert into rotation_visibility values('CANDIDATES',(select count(*) from public.matching_candidates where matching_run_id in(select (value->>'matching_run_id')::uuid from rotation_results where kind like 'MATCH__')));
insert into rotation_visibility values('RFQS',(select count(*) from public.rfqs where request_id in(select request_id from request_fixture)));
insert into rotation_visibility values('INVITATIONS',(select count(*) from public.rfq_providers where rfq_id in(select (value->>'rfq_id')::uuid from rotation_results where kind like 'OPEN_%')));
reset role;
select is((select value from rotation_visibility where kind='RUNS'),0::bigint,'matching-run RLS hides foreign tenant operations');
select is((select value from rotation_visibility where kind='CANDIDATES'),0::bigint,'candidate RLS hides foreign tenant scoring');
select is((select value from rotation_visibility where kind='RFQS'),0::bigint,'RFQ RLS hides foreign tenant awards');
select is((select value from rotation_visibility where kind='INVITATIONS'),0::bigint,'invitation RLS hides all provider awards from foreign tenant');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1550000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into rotation_visibility values('CLIENT_RUNS',(select count(*) from public.matching_runs where request_id in(select request_id from request_fixture)));
insert into rotation_visibility values('CLIENT_RFQS',(select count(*) from public.rfqs where request_id in(select request_id from request_fixture)));
reset role;
select is((select value from rotation_visibility where kind='CLIENT_RUNS'),3::bigint,'owning client can read its three matching runs');
select is((select value from rotation_visibility where kind='CLIENT_RFQS'),3::bigint,'owning client can read its three RFQs');

select * from finish();
rollback;
