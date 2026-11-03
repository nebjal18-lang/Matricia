begin;set local search_path=public,extensions;select plan(12);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a8900000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f1-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f1-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f2-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f2-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unscoped-89@example.invalid','',now(),'{}','{}',now(),now()),
('a8900000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-89@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b8900000-0000-4000-8000-000000000001','Multi Franchise P89 SARL','Multi Franchise P89','ACTIVE','a8900000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f8900000-0000-4000-8000-000000000010','FRANCHISE_SCOPE','franchise-scope','b8900000-0000-4000-8000-000000000001','DRAFT','a8900000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c8900000-0000-4000-8000-000000000001','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000001','ACTIVE',now()),
('c8900000-0000-4000-8000-000000000002','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000002','ACTIVE',now()),
('c8900000-0000-4000-8000-000000000003','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000003','ACTIVE',now()),
('c8900000-0000-4000-8000-000000000004','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000004','ACTIVE',now()),
('c8900000-0000-4000-8000-000000000005','b8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000005','ACTIVE',now());
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values
('d8900000-0000-4000-8000-000000000001','f8900000-0000-4000-8000-000000000010','b8900000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F1','ACTIVE','a8900000-0000-4000-8000-000000000001'),
('d8900000-0000-4000-8000-000000000002','f8900000-0000-4000-8000-000000000010','b8900000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F2','ACTIVE','a8900000-0000-4000-8000-000000000003');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('c8900000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','d8900000-0000-4000-8000-000000000001'),
('c8900000-0000-4000-8000-000000000002','FRANCHISE_VIEWER','d8900000-0000-4000-8000-000000000001'),
('c8900000-0000-4000-8000-000000000003','FRANCHISE_MANAGER','d8900000-0000-4000-8000-000000000002'),
('c8900000-0000-4000-8000-000000000004','FRANCHISE_VIEWER','d8900000-0000-4000-8000-000000000002'),
('c8900000-0000-4000-8000-000000000005','FRANCHISE_VIEWER',null);
insert into public.platform_user_roles(user_id,role_code)values('a8900000-0000-4000-8000-000000000006','MATRICIA_ADMIN');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f1540000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func154-client@example.invalid','',now(),'{}','{}',now(),now()),
 ('f1540000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func154-provider@example.invalid','',now(),'{}','{}',now(),now()),
 ('f1540000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func154-outsider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.organizations(id,legal_name,display_name,status,created_by) values
 ('f1541000-0000-4000-8000-000000000001','Client functional 154','Client functional 154','ACTIVE','f1540000-0000-4000-8000-000000000001'),
 ('f1541000-0000-4000-8000-000000000002','Provider A functional 154','Provider A functional 154','ACTIVE','f1540000-0000-4000-8000-000000000002'),
 ('f1541000-0000-4000-8000-000000000003','Provider B functional 154','Provider B functional 154','ACTIVE','f1540000-0000-4000-8000-000000000002'),
 ('f1541000-0000-4000-8000-000000000004','Outsider functional 154','Outsider functional 154','ACTIVE','f1540000-0000-4000-8000-000000000003');

insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
 ('f1542000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000001','f1540000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('f1542000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000002','f1540000-0000-4000-8000-000000000002','ACTIVE',now()),
 ('f1542000-0000-4000-8000-000000000003','f1541000-0000-4000-8000-000000000004','f1540000-0000-4000-8000-000000000003','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) values
 ('f1542000-0000-4000-8000-000000000001','CLIENT_OWNER'),
 ('f1542000-0000-4000-8000-000000000002','PROVIDER_SALES'),
 ('f1542000-0000-4000-8000-000000000003','CLIENT_OWNER');

-- Build a coherent RFQ and two frozen submitted quotes without invoking unrelated
-- catalogue/matching workflows. The behavior under test starts at the public RPCs.
grant usage on schema extensions to authenticated;
set local session_replication_role=replica;
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values
 ('f1543000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000001','f1543100-0000-4000-8000-000000000001','f1543200-0000-4000-8000-000000000001','RFQ_OPEN','f1540000-0000-4000-8000-000000000001');
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,deadline,status,invited_count,opened_by) values
 ('f1544000-0000-4000-8000-000000000001','f1543000-0000-4000-8000-000000000001','f1543300-0000-4000-8000-000000000001','f1543400-0000-4000-8000-000000000001',now()+interval '7 days','OPEN',2,'f1540000-0000-4000-8000-000000000001');
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values
 ('f1545000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','f1545100-0000-4000-8000-000000000001','ACCEPTED',now()),
 ('f1545000-0000-4000-8000-000000000002','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000003','f1545100-0000-4000-8000-000000000002','ACCEPTED',now());
insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by) values
 ('f1546000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1545000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','SUBMITTED','f1540000-0000-4000-8000-000000000002'),
 ('f1546000-0000-4000-8000-000000000002','f1544000-0000-4000-8000-000000000001','f1545000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003','SUBMITTED','f1540000-0000-4000-8000-000000000002');
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by) values
 ('f1547000-0000-4000-8000-000000000001','f1546000-0000-4000-8000-000000000001','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002',1,'SUBMITTED','Offre A soumise','MAD','Solution A',jsonb_build_array('Livrable A'),'Garantie A','Corrections A',current_date+10,10,now()+interval '30 days',10000,2000,12000,0,'{"money":"MINOR_UNITS"}',repeat('a',64),now(),'f1540000-0000-4000-8000-000000000002'),
 ('f1547000-0000-4000-8000-000000000002','f1546000-0000-4000-8000-000000000002','f1544000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000003',1,'SUBMITTED','Offre B soumise','MAD','Solution B',jsonb_build_array('Livrable B','Livrable B2'),'Garantie B','Corrections B',current_date+12,12,now()+interval '30 days',20000,4000,24000,0,'{"money":"MINOR_UNITS"}',repeat('b',64),now(),'f1540000-0000-4000-8000-000000000002');
update public.quotes set current_version_id=case id when 'f1546000-0000-4000-8000-000000000001'::uuid then 'f1547000-0000-4000-8000-000000000001'::uuid else 'f1547000-0000-4000-8000-000000000002'::uuid end;
set local session_replication_role=origin;

create temporary table functional_results(kind text,value jsonb);
create temporary table rls_visibility(kind text,value bigint);
grant select,insert on functional_results,rls_visibility to authenticated;


set local session_replication_role=replica;
update public.service_requests set library_id='f8900000-0000-4000-8000-000000000010'where id='f1543000-0000-4000-8000-000000000001';
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select case when territory_code='P89_F1'then 'd8920000-0000-4000-8000-000000000001'::uuid else 'd8920000-0000-4000-8000-000000000002'::uuid end,id,'d8930000-0000-4000-8000-000000000001','d8940000-0000-4000-8000-000000000001',1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('a',64),created_by from public.franchises where id in('d8900000-0000-4000-8000-000000000001','d8900000-0000-4000-8000-000000000002');
update public.franchises f set current_mandate_version_id=m.id from public.franchise_mandate_versions m where m.franchise_id=f.id and f.id in('d8900000-0000-4000-8000-000000000001','d8900000-0000-4000-8000-000000000002');
set local session_replication_role=origin;

set local session_replication_role=replica;
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by)values('d8950000-0000-4000-8000-000000000001','f8900000-0000-4000-8000-000000000010','d8950000-0000-4000-8000-000000000002','DOSSIER_SERVICE','dossier-service','a8900000-0000-4000-8000-000000000001');
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)values('d8930000-0000-4000-8000-000000000001','d8900000-0000-4000-8000-000000000001',1,'P89_F1','Territoire A','النطاق أ','{}',now()-interval'1 day',repeat('a',64),'a8900000-0000-4000-8000-000000000001');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,created_by)values
('f1541000-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Fournisseur disponible',5,10,'f1540000-0000-4000-8000-000000000002'),
('f1541000-0000-4000-8000-000000000003','REJECTED','SUSPENDED','Fournisseur indisponible',1,1,'f1540000-0000-4000-8000-000000000002');
insert into public.provider_services(id,provider_organization_id,service_id,requested_by)values
('d8960000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','d8950000-0000-4000-8000-000000000001','f1540000-0000-4000-8000-000000000002'),
('d8960000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003','d8950000-0000-4000-8000-000000000001','f1540000-0000-4000-8000-000000000002');
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id,current_decision_id)values
('d8970000-0000-4000-8000-000000000001','d8960000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','d8950000-0000-4000-8000-000000000001','d8980000-0000-4000-8000-000000000001'),
('d8970000-0000-4000-8000-000000000002','d8960000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003','d8950000-0000-4000-8000-000000000001','d8980000-0000-4000-8000-000000000002');
insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,rationale,rule_version,decided_by,correlation_id)values
('d8980000-0000-4000-8000-000000000001','d8970000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','d8950000-0000-4000-8000-000000000001',1,'APPROVED','d8981000-0000-4000-8000-000000000001','d8981000-0000-4000-8000-000000000002',9000,'[{}]','Justification qualifiée','DOSSIER_V1','a8900000-0000-4000-8000-000000000001','d8981000-0000-4000-8000-000000000003'),
('d8980000-0000-4000-8000-000000000002','d8970000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003','d8950000-0000-4000-8000-000000000001',1,'REJECTED',null,null,null,'[]','Justification rejetée','DOSSIER_V1','a8900000-0000-4000-8000-000000000001','d8981000-0000-4000-8000-000000000004');
insert into public.provider_capacity_versions(id,provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,reason,declared_by,effective_from)values
('d8990000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','d8950000-0000-4000-8000-000000000001',1,'AVAILABLE',5,2,'Capacité disponible','f1540000-0000-4000-8000-000000000002',now()-interval'1 day'),
('d8990000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003','d8950000-0000-4000-8000-000000000001',1,'FULL',0,90,'Capacité saturée','f1540000-0000-4000-8000-000000000002',now()-interval'1 day');
insert into public.provider_document_families(id,provider_organization_id,document_kind,code,created_by)values
('d8991000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','INSURANCE','ASSURANCE_A','f1540000-0000-4000-8000-000000000002'),
('d8991000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003','INSURANCE','ASSURANCE_B','f1540000-0000-4000-8000-000000000002');
insert into public.provider_document_versions(id,family_id,provider_organization_id,version_number,status,expires_on,storage_object_path,content_hash,change_reason,submitted_by)values
('d8992000-0000-4000-8000-000000000001','d8991000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002',1,'SUBMITTED','2028-01-01','fixture/provider-a.pdf',repeat('a',64),'Preuve A','f1540000-0000-4000-8000-000000000002'),
('d8992000-0000-4000-8000-000000000002','d8991000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003',1,'EXPIRED','2020-01-01','fixture/provider-b.pdf',repeat('b',64),'Preuve B','f1540000-0000-4000-8000-000000000002');
insert into public.provider_document_service_links(document_version_id,provider_service_id,provider_organization_id)values
('d8992000-0000-4000-8000-000000000001','d8960000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002'),
('d8992000-0000-4000-8000-000000000002','d8960000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000003');
insert into public.franchise_crm_prospects(id,franchise_id,territory_version_id,prospect_type,display_name,contact_email,source_code,pipeline_stage,owner_user_id,created_by)values
('d8993000-0000-4000-8000-000000000001','d8900000-0000-4000-8000-000000000001','d8930000-0000-4000-8000-000000000001','PROVIDER','Prospect A','prospect-a@example.invalid','TEST','SENT','a8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000001');
set local session_replication_role=origin;


set local session_replication_role=replica;
update public.provider_document_versions set storage_object_path='provider-qualification/'||provider_organization_id::text||'/'||id::text||'.pdf';
insert into public.provider_document_upload_reservations(provider_organization_id,actor_user_id,storage_object_path,declared_mime_type,declared_size_bytes,status,document_version_id,bound_at)
select provider_organization_id,submitted_by,storage_object_path,'application/pdf',100,'BOUND',id,now()from public.provider_document_versions where id in('d8992000-0000-4000-8000-000000000001','d8992000-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name,owner)select'provider-qualification',storage_object_path,submitted_by from public.provider_document_versions where id in('d8992000-0000-4000-8000-000000000001','d8992000-0000-4000-8000-000000000002');
insert into public.provider_document_scan_jobs(id,document_version_id,provider_organization_id,storage_object_path,declared_sha256,declared_mime_type,scan_status,scanned_at,current_scan_result_id)
select'd8943000-0000-4000-8000-000000000001',id,provider_organization_id,storage_object_path,content_hash,'application/pdf','CLEAN',now(),'d8944000-0000-4000-8000-000000000001'from public.provider_document_versions where id='d8992000-0000-4000-8000-000000000001';
insert into private.provider_document_scan_results(id,upload_id,sequence,result,engine_code,engine_version,computed_sha256,correlation_id)values('d8944000-0000-4000-8000-000000000001','d8943000-0000-4000-8000-000000000001',1,'CLEAN','DELIVERY_FIXTURE','1.0',repeat('a',64),'d8944000-0000-4000-8000-000000000002');
insert into public.franchise_pnl_books(id,library_id,franchise_organization_id,franchise_type,operator_code,currency,opened_under_rule_version_id,created_by)
select'd8945000-0000-4000-8000-000000000001','f8900000-0000-4000-8000-000000000010','b8900000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','MAD',id,'a8900000-0000-4000-8000-000000000001'from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1;
insert into public.franchise_profit_closure_versions(id,book_id,period_start,period_end,version,rule_version_id,rule_snapshot,formula_snapshot,entry_cutoff_at,gross_revenue_ex_tax_minor,costs_and_refunds_minor,distributable_profit_minor,content_hash,closed_by)
select'd8946000-0000-4000-8000-000000000001','d8945000-0000-4000-8000-000000000001','2026-01-01','2026-01-31',3,id,'{}','{}',now(),9007199254740993,1,9007199254740992,repeat('e',64),'a8900000-0000-4000-8000-000000000001'from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1;
insert into public.franchise_profit_allocations(closure_version_id,beneficiary_code,share_bps,amount_minor,currency,rights_snapshot)values
('d8946000-0000-4000-8000-000000000001','FRANCHISEE',5000,4503599627370496,'MAD','{}'),
('d8946000-0000-4000-8000-000000000001','NEOXA_JALIL',2500,2251799813685248,'MAD','{}'),
('d8946000-0000-4000-8000-000000000001','ASMA_MATRICIA',2500,2251799813685248,'MAD','{}');
set local session_replication_role=origin;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a8900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into functional_results values('DOCUMENT',public.franchise_document_reference('d8900000-0000-4000-8000-000000000001','d8992000-0000-4000-8000-000000000001','VIEW'));
insert into functional_results values('QUARANTINE',public.franchise_document_reference('d8900000-0000-4000-8000-000000000001','d8992000-0000-4000-8000-000000000002','DOWNLOAD'));
insert into functional_results values('STATEMENT',public.franchise_statement_export('d8900000-0000-4000-8000-000000000001','d8946000-0000-4000-8000-000000000001','CSV'));
reset role;
select is((select value->>'outcome'from functional_results where kind='DOCUMENT'),'ALLOWED','exact mandate can preview clean, bound private evidence');
select is((select value->>'contentHash'from functional_results where kind='DOCUMENT'),repeat('a',64),'private preview returns the immutable version hash');
select is((select value->>'outcome'from functional_results where kind='QUARANTINE'),'DENIED','unscanned evidence stays quarantined');
select is((select value->>'revenueMinor'from functional_results where kind='STATEMENT'),'9007199254740993','export preserves exact revenue past JavaScript precision');
select is((select value->>'shareMinor'from functional_results where kind='STATEMENT'),'4503599627370496','export contains the franchisee own allocation');
select is((select value->>'version'from functional_results where kind='STATEMENT'),'3','export targets the selected immutable closure version');
select is((select value->>'contentHash'from functional_results where kind='STATEMENT'),repeat('e',64),'statement hash identifies the frozen version');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a8900000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select is(public.franchise_document_reference('d8900000-0000-4000-8000-000000000001','d8992000-0000-4000-8000-000000000001','DOWNLOAD')->>'outcome','DENIED','sibling mandate cannot download this document');
select is(public.franchise_statement_export('d8900000-0000-4000-8000-000000000001','d8946000-0000-4000-8000-000000000001','CSV')->>'outcome','DENIED','sibling mandate cannot export this selected statement');
reset role;
select is((select count(*)from public.audit_events where action='franchise.document.access'and metadata->>'outcome'='DENIED'and resource_id in('d8992000-0000-4000-8000-000000000001','d8992000-0000-4000-8000-000000000002')),2::bigint,'quarantined and foreign access denials are journaled');
select is((select count(*)from public.audit_events where action='franchise.statement.access'and resource_id='d8946000-0000-4000-8000-000000000001'),2::bigint,'successful and denied statement exports are journaled');
select ok(not has_function_privilege('anon','public.franchise_statement_export(uuid,uuid,text)','EXECUTE')and not has_function_privilege('anon','public.franchise_document_reference(uuid,uuid,text)','EXECUTE'),'anonymous private exports are forbidden');
select *from finish();rollback;
