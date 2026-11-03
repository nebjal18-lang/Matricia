-- Rollback-only TEST mandate/role master data; these are not activation or signature proofs.
-- All business effects below use public governance proposal commands. No trigger bypass.
begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a3680000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','scope368-manager@example.invalid','',now(),'{}','{}',now(),now()),
('a3680000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','scope368-expert@example.invalid','',now(),'{}','{}',now(),now()),
('a3680000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','scope368-viewer@example.invalid','',now(),'{}','{}',now(),now()),
('a3680000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','scope368-provider-manager@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('a3681000-0000-4000-8000-000000000001','TEST 0368 IT operator','TEST IT operator','ACTIVE','a3680000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values('a3682000-0000-4000-8000-000000000001','TEST368_IT','test368-it','a3681000-0000-4000-8000-000000000001','a3680000-0000-4000-8000-000000000001');
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,activation_mode,created_by)values
('a3683000-0000-4000-8000-000000000001','a3682000-0000-4000-8000-000000000001','a3681000-0000-4000-8000-000000000001','IT','HATIM_AHMITECH','TEST368_A','ACTIVE','NON_CONTRACTUAL_DEMO','a3680000-0000-4000-8000-000000000001'),
('a3683000-0000-4000-8000-000000000002','a3682000-0000-4000-8000-000000000001','a3681000-0000-4000-8000-000000000001','IT','HATIM_AHMITECH','TEST368_B','ACTIVE','NON_CONTRACTUAL_DEMO','a3680000-0000-4000-8000-000000000001');
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)values
('a3684000-0000-4000-8000-000000000001','a3683000-0000-4000-8000-000000000001',1,'TEST368_A','Territoire TEST A','نطاق الاختبار أ','{}',now()-interval'1 day',repeat('a',64),'a3680000-0000-4000-8000-000000000001'),
('a3684000-0000-4000-8000-000000000002','a3683000-0000-4000-8000-000000000002',1,'TEST368_B','Territoire TEST B','نطاق الاختبار ب','{}',now()-interval'1 day',repeat('b',64),'a3680000-0000-4000-8000-000000000001');
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select x.id,x.franchise_id,x.territory_id,(select id from public.franchise_economic_rule_versions where franchise_type='IT'and version=1),1,'ACTIVE','{}','{}','{"mode":"NON_CONTRACTUAL_DEMO","purpose":"TEST_ROLE_FIXTURE"}',0,'EXEMPT',0,5000,5000,0,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat(x.hash,64),'a3680000-0000-4000-8000-000000000001'from(values
('a3685000-0000-4000-8000-000000000001'::uuid,'a3683000-0000-4000-8000-000000000001'::uuid,'a3684000-0000-4000-8000-000000000001'::uuid,'a'),
('a3685000-0000-4000-8000-000000000002'::uuid,'a3683000-0000-4000-8000-000000000002'::uuid,'a3684000-0000-4000-8000-000000000002'::uuid,'b'))x(id,franchise_id,territory_id,hash);
update public.franchises set current_mandate_version_id=case id when'a3683000-0000-4000-8000-000000000001'then'a3685000-0000-4000-8000-000000000001'::uuid else'a3685000-0000-4000-8000-000000000002'::uuid end where id in('a3683000-0000-4000-8000-000000000001','a3683000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status)values
('a3686000-0000-4000-8000-000000000001','a3681000-0000-4000-8000-000000000001','a3680000-0000-4000-8000-000000000001','ACTIVE'),
('a3686000-0000-4000-8000-000000000002','a3681000-0000-4000-8000-000000000001','a3680000-0000-4000-8000-000000000002','ACTIVE'),
('a3686000-0000-4000-8000-000000000003','a3681000-0000-4000-8000-000000000001','a3680000-0000-4000-8000-000000000003','ACTIVE'),
('a3686000-0000-4000-8000-000000000004','a3681000-0000-4000-8000-000000000001','a3680000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('a3686000-0000-4000-8000-000000000001','FRANCHISE_MANAGER',null),('a3686000-0000-4000-8000-000000000002','FRANCHISE_EXPERT','a3683000-0000-4000-8000-000000000001'),('a3686000-0000-4000-8000-000000000003','FRANCHISE_VIEWER','a3683000-0000-4000-8000-000000000001'),('a3686000-0000-4000-8000-000000000004','FRANCHISE_PROVIDER_MANAGER','a3683000-0000-4000-8000-000000000002');
insert into public.organization_member_franchise_assignments(membership_id,role_code,franchise_id)values
('a3686000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','a3683000-0000-4000-8000-000000000001'),('a3686000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','a3683000-0000-4000-8000-000000000002');
insert into public.catalog_categories(id,library_id,code,slug,created_by)values('a3687000-0000-4000-8000-000000000001','a3682000-0000-4000-8000-000000000001','TEST368_CATEGORY','test368-category','a3680000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by)values('a3687000-0000-4000-8000-000000000002','a3682000-0000-4000-8000-000000000001','a3687000-0000-4000-8000-000000000001','TEST368_SUBCATEGORY','test368-subcategory','a3680000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by)values('a3687000-0000-4000-8000-000000000003','a3682000-0000-4000-8000-000000000001','a3687000-0000-4000-8000-000000000002','TEST368_SERVICE','test368-service','a3680000-0000-4000-8000-000000000001');
insert into public.service_skus(id,service_id,code,version,status,unit_code,unit_quantity,deliverables,exclusions,acceptance_criteria,correction_limit,sla_days,currency,reference_cost_minor,credit_cost,effective_from,content_hash,created_by)values('a3687000-0000-4000-8000-000000000004','a3687000-0000-4000-8000-000000000003','TEST368_SKU',1,'ACTIVE','UNIT',1,'[]','[]','[]',0,1,'MAD',0,0,current_date,repeat('c',64),'a3680000-0000-4000-8000-000000000001');
-- Test qualification identities only: no approval, questionnaire completion or private answer is invented.
insert into public.organizations(id,legal_name,display_name,status,created_by)values('a3681000-0000-4000-8000-000000000002','TEST 0368 Provider','TEST Provider','ACTIVE','a3680000-0000-4000-8000-000000000001');
insert into public.provider_profiles(provider_organization_id,activity_summary,team_size,years_experience,created_by)values('a3681000-0000-4000-8000-000000000002','TEST pending qualification provider',1,1,'a3680000-0000-4000-8000-000000000001');
insert into public.provider_services(id,provider_organization_id,service_id,requested_by)values('a3688000-0000-4000-8000-000000000001','a3681000-0000-4000-8000-000000000002','a3687000-0000-4000-8000-000000000003','a3680000-0000-4000-8000-000000000001');
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)values('a3688000-0000-4000-8000-000000000002','a3688000-0000-4000-8000-000000000001','a3681000-0000-4000-8000-000000000002','a3687000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status)values('a3686000-0000-4000-8000-000000000099','a3681000-0000-4000-8000-000000000002','a3680000-0000-4000-8000-000000000001','ACTIVE');
-- A family renewed for another library must not revive the older linked version here.
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values('a3689000-0000-4000-8000-000000000001','TEST368_OTHER','test368-other','a3681000-0000-4000-8000-000000000001','a3680000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,created_by)values('a3689000-0000-4000-8000-000000000002','a3689000-0000-4000-8000-000000000001','TEST368_OTHER_CATEGORY','test368-other-category','a3680000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by)values('a3689000-0000-4000-8000-000000000003','a3689000-0000-4000-8000-000000000001','a3689000-0000-4000-8000-000000000002','TEST368_OTHER_SUB','test368-other-sub','a3680000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by)values('a3689000-0000-4000-8000-000000000004','a3689000-0000-4000-8000-000000000001','a3689000-0000-4000-8000-000000000003','TEST368_OTHER_SERVICE','test368-other-service','a3680000-0000-4000-8000-000000000001');
insert into public.provider_services(id,provider_organization_id,service_id,requested_by)values('a3689000-0000-4000-8000-000000000005','a3681000-0000-4000-8000-000000000002','a3689000-0000-4000-8000-000000000004','a3680000-0000-4000-8000-000000000001');
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)values('a3689000-0000-4000-8000-000000000009','a3689000-0000-4000-8000-000000000005','a3681000-0000-4000-8000-000000000002','a3689000-0000-4000-8000-000000000004');
insert into public.provider_document_families(id,provider_organization_id,document_kind,code,created_by)values('a3689000-0000-4000-8000-000000000006','a3681000-0000-4000-8000-000000000002','INSURANCE','TEST368_INSURANCE','a3680000-0000-4000-8000-000000000001');
insert into public.provider_document_versions(id,family_id,provider_organization_id,version_number,status,storage_object_path,content_hash,metadata,change_reason,supersedes_version_id,submitted_by)values
('a3689000-0000-4000-8000-000000000007','a3689000-0000-4000-8000-000000000006','a3681000-0000-4000-8000-000000000002',1,'SUBMITTED','TEST368/old-a.pdf','6e2a6b824a48372347f189f3d1afc7548ce339e015453fee1a1c9a84f9472fc6','{"declared_mime_type":"application/pdf","declared_size_bytes":49,"test_scope":"METADATA_APPLICABILITY_ONLY_NO_SCAN_OR_DOWNLOAD_CLAIM"}','TEST earlier metadata applicable to A',null,'a3680000-0000-4000-8000-000000000001'),
('a3689000-0000-4000-8000-000000000008','a3689000-0000-4000-8000-000000000006','a3681000-0000-4000-8000-000000000002',2,'SUBMITTED','TEST368/new-b.pdf','c07e97f7c967643fe8b9b75bbbda31e5665c220259a61f301c81a65933eac954','{"declared_mime_type":"application/pdf","declared_size_bytes":49,"test_scope":"METADATA_APPLICABILITY_ONLY_NO_SCAN_OR_DOWNLOAD_CLAIM"}','TEST current metadata applicable only to B','a3689000-0000-4000-8000-000000000007','a3680000-0000-4000-8000-000000000001');
insert into public.provider_document_service_links(document_version_id,provider_service_id,provider_organization_id)values('a3689000-0000-4000-8000-000000000007','a3688000-0000-4000-8000-000000000001','a3681000-0000-4000-8000-000000000002'),('a3689000-0000-4000-8000-000000000008','a3689000-0000-4000-8000-000000000005','a3681000-0000-4000-8000-000000000002');
create temporary table scope368(k text primary key,v jsonb);
grant select,insert on scope368 to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3680000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into scope368 values('expert',public.franchise_operation_permissions_v1('a3683000-0000-4000-8000-000000000001'));
select is((select v->>'canDecideQualifications'from scope368 where k='expert'),'true','Expert sees qualification authority independently of CRM write');
select is((select v->>'canMaintainDefinitions'from scope368 where k='expert'),'true','Expert sees definition authority for its exact mandate');
select is((select v->>'canProposeVolume'from scope368 where k='expert'),'false','Expert does not gain procurement governance authority');
select throws_ok($$select public.franchise_operation_permissions_v1('a3683000-0000-4000-8000-000000000002')$$,'42501','FRANCHISE_OPERATIONS_SCOPE_DENIED','sibling mandate of the same operator is still denied to the Expert');
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1('a3688000-0000-4000-8000-000000000002')$$,'42501','QUALIFICATION_REVIEW_MFA_REQUIRED','franchise review still requires AAL2 despite valid service authority');
select set_config('request.jwt.claims','{"sub":"a3680000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into scope368 values('qualification-review',public.get_provider_qualification_questionnaire_review_v1('a3688000-0000-4000-8000-000000000002'));
select is((select v->>'qualificationId'from scope368 where k='qualification-review'),'a3688000-0000-4000-8000-000000000002','Expert can use the purpose-bound review for its service without a platform role');
select is((select v->>'total'from scope368 where k='qualification-review'),'0','no questionnaire is invented when this fixture has no submitted session');
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1('a3689000-0000-4000-8000-000000000009')$$,'42501','QUALIFICATION_REVIEW_DENIED','service review remains denied outside every mandate of the Expert');
insert into scope368 values('dossiers',public.franchise_provider_dossiers('a3683000-0000-4000-8000-000000000001'));
select is((select jsonb_array_length(provider->'documents')from scope368 cross join lateral jsonb_array_elements(v)provider where k='dossiers'and provider->>'organizationId'='a3681000-0000-4000-8000-000000000002'),0,'old A document is not revived as current when the latest family version targets B only');

select set_config('request.jwt.claims','{"sub":"a3680000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
insert into scope368 values('viewer',public.franchise_operation_permissions_v1('a3683000-0000-4000-8000-000000000001'));
select is((select v->>'canDecideQualifications'from scope368 where k='viewer'),'false','Viewer read access is not a qualification mutation grant');
select is((select v->>'canMaintainDefinitions'from scope368 where k='viewer'),'false','Viewer cannot edit definitions');
select is(public.franchise_operational_missions_v1('a3683000-0000-4000-8000-000000000001')->>'franchiseId','a3683000-0000-4000-8000-000000000001','mission projection retains the exact selected mandate');
select set_config('request.jwt.claims','{"sub":"a3680000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
insert into scope368 values('provider-manager',public.franchise_operation_permissions_v1('a3683000-0000-4000-8000-000000000002'));
select is((select v->>'canDecideQualifications'from scope368 where k='provider-manager'),'true','Provider Manager may review qualification');
select is((select v->>'canMaintainDefinitions'from scope368 where k='provider-manager'),'false','Provider Manager does not receive editorial definition rights');
select throws_ok($$select public.propose_franchise_volume_purchase_for_mandate_v1('a3683000-0000-4000-8000-000000000001','a3682000-0000-4000-8000-000000000001','a3687000-0000-4000-8000-000000000004',1,0,2,'PAY_PER_USE','2026-11-01','2026-12-31','TEST scope denial before proposal','TEST368-forbidden-proposal')$$,'42501','FRANCHISE_VOLUME_PROPOSAL_DENIED','non-owner/non-manager cannot submit a sibling proposal');
select set_config('request.jwt.claims','{"sub":"a3680000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1('a3688000-0000-4000-8000-000000000002')$$,'42501','QUALIFICATION_REVIEW_DENIED','Viewer cannot promote a readable dossier into an independent qualification review');
select set_config('request.jwt.claims','{"sub":"a3680000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_provider_qualification_questionnaire_review_v1('a3688000-0000-4000-8000-000000000002')$$,'42501','QUALIFICATION_REVIEW_DENIED','franchise Manager who is also a member of the Provider cannot review itself');
select throws_ok($$select public.propose_franchise_volume_purchase('a3682000-0000-4000-8000-000000000001','a3687000-0000-4000-8000-000000000004',1,0,2,'PAY_PER_USE','2026-11-01','2026-12-31','TEST no arbitrary territory selection','TEST368-legacy-ambiguous')$$,'22023','FRANCHISE_VOLUME_SELECTION_REQUIRED','legacy library-only command refuses multiple authorized mandates');
insert into scope368 values('proposal',public.propose_franchise_volume_purchase_for_mandate_v1('a3683000-0000-4000-8000-000000000001','a3682000-0000-4000-8000-000000000001','a3687000-0000-4000-8000-000000000004',1.000001,0,2,'PAY_PER_USE','2026-11-01','2026-12-31','TEST exact territorial volume proposal','TEST368-explicit-proposal'));
select is((select v->>'outcome'from scope368 where k='proposal'),'FRANCHISE_VOLUME_PROPOSED','explicit target creates only a governed proposal');
select is((select franchise_id::text from public.franchise_volume_proposals where id=(select(v->>'proposal_id')::uuid from scope368 where k='proposal')),'a3683000-0000-4000-8000-000000000001','proposal stays in selected territory even if another was created later');
select is((select forecast_units::text from public.franchise_volume_proposals where id=(select(v->>'proposal_id')::uuid from scope368 where k='proposal')),'1.000001','exact six-decimal quantities persist without a float');
select is(public.propose_franchise_volume_purchase_for_mandate_v1('a3683000-0000-4000-8000-000000000001','a3682000-0000-4000-8000-000000000001','a3687000-0000-4000-8000-000000000004',1.000001,0,2,'PAY_PER_USE','2026-11-01','2026-12-31','TEST exact territorial volume proposal','TEST368-explicit-proposal'),(select v from scope368 where k='proposal'),'native proposal retry returns the same receipt');
reset role;
select is((select count(*)::integer from public.franchise_volume_proposals where franchise_id in('a3683000-0000-4000-8000-000000000001','a3683000-0000-4000-8000-000000000002')),1,'denied calls and retry do not create another proposal');
select ok(not has_function_privilege('anon','public.franchise_operation_permissions_v1(uuid)','EXECUTE')and not has_function_privilege('service_role','public.franchise_operation_permissions_v1(uuid)','EXECUTE'),'UI capability projection grants no anonymous or worker access');
select *from finish();
rollback;
