begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-scan-fixture-0043',configured_at=clock_timestamp()where singleton;
set local search_path=public,extensions;select plan(42);
grant usage on schema extensions to authenticated;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST/RFQ-AUTHORITY-0043',configured_at=clock_timestamp()where singleton;
grant execute on all functions in schema extensions to authenticated;

select ok((select count(*)=5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('create_service_request','mark_service_request_ready','run_service_request_matching','open_service_request_rfq','respond_to_rfq_invitation')and p.prosecdef and p.proconfig::text like '%search_path=pg_catalog%'),'five RFQ commands fix their security path');
select ok(not has_function_privilege('anon','public.run_service_request_matching(uuid,text,integer,text,uuid)','EXECUTE')and not has_function_privilege('service_role','public.open_service_request_rfq(uuid,uuid,timestamptz,text,uuid)','EXECUTE'),'anonymous and service roles cannot execute user RFQ commands');
select ok(not has_table_privilege('authenticated','public.service_requests','INSERT')and not has_table_privilege('authenticated','public.matching_candidates','INSERT')and not has_table_privilege('authenticated','public.rfq_providers','INSERT'),'authenticated users cannot bypass command authorization');
select ok((select relrowsecurity from pg_class where oid='public.service_requests'::regclass)and(select relrowsecurity from pg_class where oid='public.matching_candidates'::regclass)and(select relrowsecurity from pg_class where oid='public.rfq_providers'::regclass),'tenant and offer-bound tables have RLS');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fb000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p07-client@example.invalid','',now(),'{}','{}',now(),now()),
('fb000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p07-outsider@example.invalid','',now(),'{}','{}',now(),now()),
('fb000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p07-provider-a@example.invalid','',now(),'{}','{}',now(),now()),
('fb000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p07-provider-b@example.invalid','',now(),'{}','{}',now(),now()),
('fb000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p07-provider-c@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('fb100000-0000-0000-0000-000000000001','P07 Client Org','P07 Client Org','ACTIVE','fb000000-0000-0000-0000-000000000001'),
('fb100000-0000-0000-0000-000000000002','P07 Provider A','P07 Provider A','ACTIVE','fb000000-0000-0000-0000-000000000003'),
('fb100000-0000-0000-0000-000000000003','P07 Provider B','P07 Provider B','ACTIVE','fb000000-0000-0000-0000-000000000004'),
('fb100000-0000-0000-0000-000000000004','P07 Provider C','P07 Provider C','ACTIVE','fb000000-0000-0000-0000-000000000005');
insert into public.organization_memberships(id,organization_id,user_id,status)values
('fb200000-0000-0000-0000-000000000001','fb100000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','ACTIVE'),
('fb200000-0000-0000-0000-000000000002','fb100000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000003','ACTIVE'),
('fb200000-0000-0000-0000-000000000003','fb100000-0000-0000-0000-000000000003','fb000000-0000-0000-0000-000000000004','ACTIVE'),
('fb200000-0000-0000-0000-000000000004','fb100000-0000-0000-0000-000000000004','fb000000-0000-0000-0000-000000000005','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values
('fb200000-0000-0000-0000-000000000001','CLIENT_BUYER'),('fb200000-0000-0000-0000-000000000002','PROVIDER_SALES'),('fb200000-0000-0000-0000-000000000003','PROVIDER_SALES'),('fb200000-0000-0000-0000-000000000004','PROVIDER_SALES');

insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('fb300000-0000-0000-0000-000000000001','P07_RFQ','p07-rfq','fb100000-0000-0000-0000-000000000001','DRAFT','fb000000-0000-0000-0000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values('fb310000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','P07_CAT','p07-cat','DRAFT','fb000000-0000-0000-0000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values('fb320000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','fb310000-0000-0000-0000-000000000001','P07_SUB','p07-sub','DRAFT','fb000000-0000-0000-0000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values('fb330000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','fb320000-0000-0000-0000-000000000001','P07_SERVICE','p07-service','DRAFT','fb000000-0000-0000-0000-000000000001');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by)values('fb340000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','P07.RFQ.V1','DRAFT',repeat('1',64),'fb000000-0000-0000-0000-000000000001');
insert into public.questionnaires(id,library_id,code,status,created_by)values('fb350000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','P07_RFQ_FORM','DRAFT','fb000000-0000-0000-0000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by)values('fb360000-0000-0000-0000-000000000001','fb350000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','fb340000-0000-0000-0000-000000000001',1,'DRAFT','Demande test','طلب تجريبي','Formulaire de demande','نموذج الطلب','CLIENT','1.0.0','P07-1',repeat('2',64),'Fixture RFQ','fb000000-0000-0000-0000-000000000001');
update public.questionnaires set current_draft_version_id='fb360000-0000-0000-0000-000000000001'where id='fb350000-0000-0000-0000-000000000001';

insert into public.provider_match_profiles(provider_organization_id,company_verified,documents_valid,financial_status,quality_status,capacity_status,region_codes,partner_contract_signed)values
('fb100000-0000-0000-0000-000000000002',true,true,'OK','OK','AVAILABLE',array['CASABLANCA'],true),
('fb100000-0000-0000-0000-000000000003',true,true,'OK','OK','FULL',array['CASABLANCA'],true),
('fb100000-0000-0000-0000-000000000004',true,true,'RESTRICTED','OK','AVAILABLE',array['CASABLANCA'],true);
insert into public.provider_service_match_profiles(provider_organization_id,service_id,qualification_status,required_certifications_valid,service_fit_score,quality_score,historical_delay_score,experience_score,satisfaction_score)values
('fb100000-0000-0000-0000-000000000002','fb330000-0000-0000-0000-000000000001','APPROVED',true,90,80,70,85,88),
('fb100000-0000-0000-0000-000000000003','fb330000-0000-0000-0000-000000000001','APPROVED',true,95,90,90,90,90),
('fb100000-0000-0000-0000-000000000004','fb330000-0000-0000-0000-000000000001','APPROVED',true,80,80,80,80,80);
-- Authoritative, versioned proof for the single eligible Provider A.
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,partner_contract_expires_at,created_by)values('fb100000-0000-0000-0000-000000000002','VERIFIED','ACTIVE','Prestataire RFQ P07 qualifié',5,4,'SIGNED',now()+interval'1 year','fb000000-0000-0000-0000-000000000003');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,partner_contract_expires_at,reason,rule_version,decided_by,correlation_id)values('fb100000-0000-0000-0000-000000000002',1,'VERIFIED','SIGNED',now()+interval'1 year','Validation P07','P07-V1','fb000000-0000-0000-0000-000000000003','fb800000-0000-4000-8000-000000000001');
insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)values('fb810000-0000-4000-8000-000000000001','fb100000-0000-0000-0000-000000000002','fb330000-0000-0000-0000-000000000001','DECIDED','fb000000-0000-0000-0000-000000000003',now());
insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)values('fb820000-0000-4000-8000-000000000001','fb100000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000003','fb300000-0000-0000-0000-000000000001','fb340000-0000-0000-0000-000000000001','fb360000-0000-0000-0000-000000000001','PROVIDER','fr-MA','SUBMITTED',now(),'{}',repeat('8',64));
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)values('fb830000-0000-4000-8000-000000000001','fb810000-0000-4000-8000-000000000001','fb100000-0000-0000-0000-000000000002','fb330000-0000-0000-0000-000000000001');
insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,effective_from,expires_at,decided_by,correlation_id)values('fb840000-0000-4000-8000-000000000001','fb830000-0000-4000-8000-000000000001','fb100000-0000-0000-0000-000000000002','fb330000-0000-0000-0000-000000000001',1,'APPROVED','fb360000-0000-0000-0000-000000000001','fb820000-0000-4000-8000-000000000001',9000,'["IDENTITY"]','[]','Qualification P07','P07-V1',now()-interval'1 day',now()+interval'1 year','fb000000-0000-0000-0000-000000000003','fb800000-0000-4000-8000-000000000002');
update public.provider_qualifications set current_decision_id='fb840000-0000-4000-8000-000000000001'where id='fb830000-0000-4000-8000-000000000001';
insert into public.provider_capacity_versions(provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,reason,declared_by)values('fb100000-0000-0000-0000-000000000002','fb330000-0000-0000-0000-000000000001',1,'AVAILABLE',5,2,now()-interval'1 day','Capacité P07','fb000000-0000-0000-0000-000000000003');
insert into public.provider_document_families(id,provider_organization_id,document_kind,code,created_by)values
('fb850000-0000-4000-8000-000000000001','fb100000-0000-0000-0000-000000000002','LEGAL','P07_LEGAL','fb000000-0000-0000-0000-000000000003'),
('fb850000-0000-4000-8000-000000000002','fb100000-0000-0000-0000-000000000002','FISCAL','P07_FISCAL','fb000000-0000-0000-0000-000000000003'),
('fb850000-0000-4000-8000-000000000003','fb100000-0000-0000-0000-000000000002','INSURANCE','P07_INSURANCE','fb000000-0000-0000-0000-000000000003');
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
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('f0439000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f0439000-0000-4000-8000-000000000001@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('f0439000-0000-4000-8000-000000000001','SUPER_ADMIN');
select pg_temp.seed_clean_provider_document(id,'f0439000-0000-4000-8000-000000000001',current_date+365)from public.provider_document_families where provider_organization_id='fb100000-0000-0000-0000-000000000002';
create temporary sequence fixture_identity_seq;
create function pg_temp.revalidate_fixture_provider(p_org uuid,p_actor uuid)returns void language plpgsql as $$
declare snapshot jsonb;prior text:=current_setting('request.jwt.claims',true);seq text:=lpad(nextval('fixture_identity_seq')::text,9,'0');begin
 insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values(p_org,'ICE','997043'||seq,'PENDING'),(p_org,'IF','99904301','PENDING'),(p_org,'RC','TEST-043-'||seq,'PENDING');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aal','aal2')::text,true);
 snapshot:=public.get_provider_identity_review_context_v1(p_org);
 perform public.revalidate_provider_identity_v1(p_org,(snapshot->>'organization_row_version')::integer,(snapshot->>'profile_row_version')::integer,snapshot->>'identity_hash',(snapshot->>'company_decision_id')::uuid,'Explicit synthetic identity review in transactional fixture',extensions.gen_random_uuid());
 perform set_config('request.jwt.claims',coalesce(prior,''),true);
exception when others then perform set_config('request.jwt.claims',coalesce(prior,''),true);raise;end$$;
select pg_temp.revalidate_fixture_provider('fb100000-0000-0000-0000-000000000002','f0439000-0000-4000-8000-000000000001');
-- A later administrative ACTIVE status cannot re-use verification of a different identity.
select set_config('request.jwt.claims','{"sub":"f0439000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.old_provider_identity',public.get_provider_identity_review_context_v1('fb100000-0000-0000-0000-000000000002')::text,true);
update public.organizations set legal_name='P07 legally revised identity',status='ACTIVE',row_version=row_version+1,updated_at=clock_timestamp()where id='fb100000-0000-0000-0000-000000000002';
select ok(not private.provider_current_identity_is_verified_v1('fb100000-0000-0000-0000-000000000002'),'forcing ACTIVE after a legal identity change does not restore the old verification');
select ok((private.provider_service_eligibility_snapshot('fb100000-0000-0000-0000-000000000002','fb330000-0000-0000-0000-000000000001')->'reasons')?'PROVIDER_CURRENT_IDENTITY_REVIEW_REQUIRED','new opportunity reports the exact current identity blocker');
select throws_ok($$select public.revalidate_provider_identity_v1('fb100000-0000-0000-0000-000000000002',(current_setting('test.old_provider_identity')::jsonb->>'organization_row_version')::integer,(current_setting('test.old_provider_identity')::jsonb->>'profile_row_version')::integer,current_setting('test.old_provider_identity')::jsonb->>'identity_hash',(current_setting('test.old_provider_identity')::jsonb->>'company_decision_id')::uuid,'Stale identity approval must not proceed',extensions.gen_random_uuid())$$,'40001','PROVIDER_CURRENT_IDENTITY_CONFLICT','stale review cannot approve a changed identity');
select set_config('test.current_provider_identity',public.get_provider_identity_review_context_v1('fb100000-0000-0000-0000-000000000002')::text,true);
select public.revalidate_provider_identity_v1('fb100000-0000-0000-0000-000000000002',(current_setting('test.current_provider_identity')::jsonb->>'organization_row_version')::integer,(current_setting('test.current_provider_identity')::jsonb->>'profile_row_version')::integer,current_setting('test.current_provider_identity')::jsonb->>'identity_hash',(current_setting('test.current_provider_identity')::jsonb->>'company_decision_id')::uuid,'Current synthetic identity explicitly reviewed against clean documents',extensions.gen_random_uuid());
select ok(private.provider_current_identity_is_verified_v1('fb100000-0000-0000-0000-000000000002'),'new explicit current-hash review restores verification');
select is(private.provider_service_eligibility_snapshot('fb100000-0000-0000-0000-000000000002','fb330000-0000-0000-0000-000000000001')->>'eligible','true','current identity plus actual CLEAN pieces restores new-opportunity eligibility');




-- Declared historical Client publication source; fiscal approvals below use
-- real commands and never update a rate or reviewed mapping directly.
set local session_replication_role=replica;
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)values('fb331000-0000-4000-8000-000000000001','fb330000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001',1,'PUBLISHED','Service publié P07_FISCAL','خدمة منشورة P07_FISCAL','Précondition de recette locale','شرط اختبار محلي','Référence publiée historique de recette locale','مرجع منشور تاريخي للاختبار المحلي','CONSULTING','mission','مهمة',1,'Précondition historique publiée',repeat('a',64),'fb000000-0000-0000-0000-000000000001',now()-interval'1 day','fb320000-0000-0000-0000-000000000001','P07_FISCAL_PUBLISHED','p07-fiscal-published');
update public.catalog_services set status='PUBLISHED',current_published_version_id='fb331000-0000-4000-8000-000000000001'where id='fb330000-0000-0000-0000-000000000001';
update public.catalog_releases set status='PUBLISHED',snapshot_hash=repeat('a',64),published_at=now()-interval'1 day'where id='fb340000-0000-0000-0000-000000000001';
update public.questionnaire_versions set status='PUBLISHED',snapshot_hash=repeat('b',64),translation_review_status='APPROVED',translation_reviewer_user_id='f0439000-0000-4000-8000-000000000001',translation_reviewed_at=now()-interval'1 day',translation_review_proof_hash=repeat('b',64),translation_review_version=1,published_at=now()-interval'1 day'where id='fb360000-0000-0000-0000-000000000001';
update public.questionnaires set status='PUBLISHED',current_published_version_id='fb360000-0000-0000-0000-000000000001'where id='fb350000-0000-0000-0000-000000000001';
insert into public.catalog_release_items(release_id,library_id,object_type,object_id,version_id,content_hash,sort_order)values('fb340000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','SERVICE','fb330000-0000-0000-0000-000000000001','fb331000-0000-4000-8000-000000000001',repeat('a',64),1);
set local session_replication_role=origin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST/0043/FISCAL',configured_at=clock_timestamp()where singleton;
insert into public.platform_user_roles(user_id,role_code)values('fb000000-0000-0000-0000-000000000001','FINANCE_MANAGER');
insert into public.organization_memberships(id,organization_id,user_id,status)values('f0439001-0000-4000-8000-000000000001','fb100000-0000-0000-0000-000000000001','f0439000-0000-4000-8000-000000000001','ACTIVE');
insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)values('TEST_FISCAL043','Service de recette fiscale043','خدمة اختبار ضريبي043','Catégorie synthétique de recette locale seulement','فئة اصطناعية للاختبار المحلي فقط','SERVICE','ACTIVE');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.tax043_rule',public.propose_morocco_tax_rule('fb100000-0000-0000-0000-000000000001','TEST_FISCAL043','VAT',2000,100,'{}','TEST/0043 synthetic fiscal rule only',current_date,null,'TEST governed local fiscal rule043','test-tax043-rule')::text,true);
select set_config('request.jwt.claims','{"sub":"f0439000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.decide_morocco_tax_rule('fb100000-0000-0000-0000-000000000001',(current_setting('test.tax043_rule')::jsonb->>'tax_rule_version_id')::uuid,'APPROVE','VALIDATED','TEST/0043/RULE','TEST independently reviewed local fiscal rule',1,'test-tax043-rule-review');
select set_config('test.tax043_scope',private.service_tax_mapping_scope_hash_v1('DEVELOPMENT','fb331000-0000-4000-8000-000000000001','MA','MAD'),true);
select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.tax043_mapping',public.propose_service_tax_category_mapping_v1('fb331000-0000-4000-8000-000000000001',repeat('a',64),current_setting('test.tax043_scope'),'MA','MAD','TEST_FISCAL043',current_date,null,true,array[]::uuid[],'TEST local service classification043','f0439010-0000-4000-8000-000000000001')::text,true);
select set_config('request.jwt.claims','{"sub":"f0439000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.decide_service_tax_category_mapping_v1((current_setting('test.tax043_mapping')::jsonb->>'proposal_id')::uuid,current_setting('test.tax043_mapping')::jsonb->>'content_hash',true,'TEST/0043/MAPPING','TEST independently reviewed service classification');

create temporary table p07_obs(key text primary key,value jsonb);grant select,insert on p07_obs to authenticated;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);reset role;
select throws_ok(format('%s',$$select public.create_service_request('fb100000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','fb330000-0000-0000-0000-000000000001','fb360000-0000-0000-0000-000000000001','{"description":"Tentative isolée interdite","urgency":"NORMAL","required_fields_complete":true,"catalog_snapshot_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","questionnaire_snapshot_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","required_quote_data":{"region_code":"CASABLANCA"}}','Refus attendu','p07-outsider-001')$$),'42501'::char(5),'REQUEST_SCOPE_DENIED','outsider cannot create a client request');set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p07_obs values('incomplete',public.create_service_request('fb100000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','fb330000-0000-0000-0000-000000000001',null,'{"description":"Besoin incomplet à compléter","urgency":"NORMAL","required_fields_complete":false,"catalog_snapshot_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","questionnaire_snapshot_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","required_quote_data":{}}','Création brouillon','p07-incomplete-001'));
select is((select value->>'status'from p07_obs where key='incomplete'),'INFORMATION_REQUIRED','missing quote data remains blocked');
reset role;select throws_ok(format('select public.mark_service_request_ready(%L,1,%L,%L)',(select value->>'request_id'from p07_obs where key='incomplete'),'Tentative incomplète','p07-ready-bad-001'),'23514'::char(5),'REQUEST_INFORMATION_INCOMPLETE','incomplete request cannot become ready');set local role authenticated;
insert into p07_obs values('created',public.create_service_request('fb100000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','fb330000-0000-0000-0000-000000000001','fb360000-0000-0000-0000-000000000001','{"description":"Audit de sécurité complet demandé","urgency":"HIGH","desired_date":"2026-12-15","budget_minor":1250000,"currency_code":"MAD","required_fields_complete":true,"catalog_snapshot_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","questionnaire_snapshot_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","required_quote_data":{"region_code":"CASABLANCA","deliverables":["rapport"]}}','Création demande complète','p07-create-001','fb700000-0000-0000-0000-000000000001'));
insert into p07_obs values('replay',public.create_service_request('fb100000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','fb330000-0000-0000-0000-000000000001','fb360000-0000-0000-0000-000000000001','{"description":"Audit de sécurité complet demandé","urgency":"HIGH","desired_date":"2026-12-15","budget_minor":1250000,"currency_code":"MAD","required_fields_complete":true,"catalog_snapshot_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","questionnaire_snapshot_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","required_quote_data":{"region_code":"CASABLANCA","deliverables":["rapport"]}}','Création demande complète','p07-create-001','fb700000-0000-0000-0000-000000000099'));
select is((select value from p07_obs where key='created'),(select value from p07_obs where key='replay'),'request creation replay is durable');
insert into p07_obs values('ready',public.mark_service_request_ready((select(value->>'request_id')::uuid from p07_obs where key='created'),1,'Confirmation client','p07-ready-001'));
select is((select value->>'outcome'from p07_obs where key='ready'),'SERVICE_REQUEST_READY','complete versioned request becomes ready');
insert into p07_obs values('matched',public.run_service_request_matching((select(value->>'request_id')::uuid from p07_obs where key='created'),'MATCH-V1',10,'p07-match-001'));
insert into p07_obs values('match_replay',public.run_service_request_matching((select(value->>'request_id')::uuid from p07_obs where key='created'),'MATCH-V1',10,'p07-match-001'));
reset role;
select is((select value from p07_obs where key='matched'),(select value from p07_obs where key='match_replay'),'matching replay does not duplicate the run');
select is((select(value->>'eligible_count')::integer from p07_obs where key='matched'),1,'only one provider passes every hard filter');
select ok((select eligible and cardinality(exclusion_reasons)=0 and score_explanation->>'policy_version'='MATCH-V1'from public.matching_candidates where matching_run_id=(select(value->>'matching_run_id')::uuid from p07_obs where key='matched')and provider_organization_id='fb100000-0000-0000-0000-000000000002'),'eligible candidate has a versioned explanation');
select ok((select not eligible and exclusion_reasons@>array['CAPACITY_UNAVAILABLE']from public.matching_candidates where matching_run_id=(select(value->>'matching_run_id')::uuid from p07_obs where key='matched')and provider_organization_id='fb100000-0000-0000-0000-000000000003'),'FULL capacity is an explicit hard exclusion');
select ok((select not eligible and exclusion_reasons@>array['FINANCIAL_RESTRICTED']from public.matching_candidates where matching_run_id=(select(value->>'matching_run_id')::uuid from p07_obs where key='matched')and provider_organization_id='fb100000-0000-0000-0000-000000000004'),'financial restriction is an explicit hard exclusion');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p07_obs values('opened',public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval '7 days','p07-open-001'));
insert into p07_obs values('open_replay',public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval '7 days','p07-open-001'));
reset role;
select is((select value from p07_obs where key='opened'),(select value from p07_obs where key='open_replay'),'opening replay does not duplicate invitations');
select is((select(value->>'invited_count')::integer from p07_obs where key='opened'),1,'only the current eligible panel is invited');
select ok((select competitor_offers_visible is null from(select confidentiality_settings->'competitor_offers_visible' competitor_offers_visible from public.rfqs where id=(select(value->>'rfq_id')::uuid from p07_obs where key='opened'))x)or(select confidentiality_settings->>'competitor_offers_visible'='false'from public.rfqs where id=(select(value->>'rfq_id')::uuid from p07_obs where key='opened')),'RFQ confidentiality forbids competitor-offer visibility');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.service_requests),0,'excluded provider cannot see client request');select is((select count(*)::integer from public.rfq_providers),0,'excluded provider cannot see another provider invitation');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.service_requests where id=(select(value->>'request_id')::uuid from p07_obs where key='created')),1,'invited provider can read its request context');
reset role;select throws_ok(format('select public.respond_to_rfq_invitation(%L,%L,null,1,%L)',(select id::text from public.rfq_providers where rfq_id=(select(value->>'rfq_id')::uuid from p07_obs where key='opened')),'DECLINE','p07-decline-bad-001'),'22023'::char(5),'INVALID_INVITATION_DECISION','decline reason is mandatory');set local role authenticated;
insert into p07_obs values('declined',public.respond_to_rfq_invitation((select id from public.rfq_providers where rfq_id=(select(value->>'rfq_id')::uuid from p07_obs where key='opened')),'DECLINE','Capacité réservée ailleurs',1,'p07-decline-001'));
insert into p07_obs values('decline_replay',public.respond_to_rfq_invitation((select id from public.rfq_providers where rfq_id=(select(value->>'rfq_id')::uuid from p07_obs where key='opened')),'DECLINE','Capacité réservée ailleurs',1,'p07-decline-001'));
reset role;
select is((select value from p07_obs where key='declined'),(select value from p07_obs where key='decline_replay'),'provider refusal replay is idempotent');
select ok((select status='DECLINED'and decline_reason='Capacité réservée ailleurs'from public.rfq_providers where rfq_id=(select(value->>'rfq_id')::uuid from p07_obs where key='opened')),'provider refusal and reason are retained');
select is((select count(*)::integer from public.audit_events where action in('rfq.request.created','rfq.request.ready','rfq.matching.completed','rfq.opened')and organization_id='fb100000-0000-0000-0000-000000000001'),5,'two requests, readiness, matching and opening are audited once each');
select is((select count(*)::integer from public.audit_events where action='rfq.invitation.declined'and organization_id='fb100000-0000-0000-0000-000000000002'),1,'provider refusal is audited once');
select ok((select count(*)=1 from public.event_outbox where event_type='MATCHING_COMPLETED'and aggregate_id=(select value->>'matching_run_id'from p07_obs where key='matched'))and(select count(*)=1 from public.event_outbox where event_type='RFQ_OPENED'and aggregate_id=(select value->>'rfq_id'from p07_obs where key='opened'))and(select count(*)=1 from public.event_outbox where event_type='RFQ_INVITATION_DECLINED'),'matching, opening and refusal each emit one Outbox event');

-- New commitment guards and historical replay use the actual RFQ above.
-- Suspension/anomaly rows below are explicit predicate fixtures, not approvals
-- or payments. They never rewrite the issued invitation or any ledger.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-open-001')$$,'42501','RFQ_OPEN_MFA_REQUIRED','AAL1 cannot obtain a historical command reply');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-open-001')$$,'42501','REQUEST_SCOPE_DENIED','foreign actor cannot obtain a cached RFQ reply');
reset role;
insert into public.subscriptions(organization_id,status)values('fb100000-0000-0000-0000-000000000001','SUSPENDED');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is(public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-open-001'),(select value from p07_obs where key='opened'),'authorized AAL2 replay returns the historical fact during later suspension');
select throws_ok($$select public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-open-suspended-new')$$,'42501','CLIENT_REQUEST_NOT_ENTITLED','new RFQ command is refused under current financial suspension');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select private.open_approved_admin_rfq_v1((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-admin-open-suspended',extensions.gen_random_uuid(),'f0439000-0000-4000-8000-000000000001',array['fb100000-0000-0000-0000-000000000002'::uuid])$$,'42501','CLIENT_REQUEST_NOT_ENTITLED','approved Admin core also refuses a new financially restricted commitment');
select is((select count(*)::integer from public.rfqs where request_id=(select(value->>'request_id')::uuid from p07_obs where key='created')),1,'denials and replay never emit another RFQ');
update public.subscriptions set status='TRIAL_ACTIVE'where organization_id='fb100000-0000-0000-0000-000000000001';
insert into public.client_compliance_cases(id,organization_id,status,created_by)values('f0439020-0000-4000-8000-000000000001','fb100000-0000-0000-0000-000000000001','PROFILE_IN_PROGRESS','fb000000-0000-0000-0000-000000000001');
insert into public.client_administrative_anomalies(id,compliance_case_id,organization_id,anomaly_code,field_path,severity,blocking,status,client_message_fr,client_message_ar,detected_by)values('f0439021-0000-4000-8000-000000000001','f0439020-0000-4000-8000-000000000001','fb100000-0000-0000-0000-000000000001','ICE_NOT_VERIFIED','organization.ICE','CRITICAL',true,'OPEN','Revue de recette en attente','مراجعة اختبار معلقة','RULE_ENGINE');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-open-identity-new')$$,'42501','CLIENT_REQUEST_NOT_ENTITLED','invalidated identity blocks another new RFQ command');
select is(public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-open-001'),(select value from p07_obs where key='opened'),'identity review does not destroy the previously opened RFQ reply');
reset role;
update public.client_administrative_anomalies set status='RESOLVED',resolved_by='f0439000-0000-4000-8000-000000000001',resolved_at=clock_timestamp()where id='f0439021-0000-4000-8000-000000000001';
update public.organizations set status='PENDING'where id='fb100000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-open-before-activation')$$,'42501','CLIENT_REQUEST_NOT_ENTITLED','an onboarding company can retain its draft but cannot open before activation');
reset role;
update public.organizations set status='ACTIVE'where id='fb100000-0000-0000-0000-000000000001';
update public.organization_member_roles set revoked_at=clock_timestamp()where membership_id='fb200000-0000-0000-0000-000000000001'and role_code='CLIENT_BUYER';
set local role authenticated;
select throws_ok($$select public.open_service_request_rfq((select(value->>'request_id')::uuid from p07_obs where key='created'),(select(value->>'matching_run_id')::uuid from p07_obs where key='matched'),transaction_timestamp()+interval'7 days','p07-open-001')$$,'42501','REQUEST_SCOPE_DENIED','revoked role cannot replay the once-authorized command');
reset role;
select ok((select count(*)=1 from public.rfqs where request_id=(select(value->>'request_id')::uuid from p07_obs where key='created'))and(select count(*)=0 from public.credit_ledger_entries where organization_id='fb100000-0000-0000-0000-000000000001'),'all guard cases preserve the historical RFQ and do not introduce money entries');

select * from finish();rollback;
