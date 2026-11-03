begin;set local search_path=public,extensions;select plan(10);
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
update public.service_requests set service_id='d8950000-0000-4000-8000-000000000001'where id='f1543000-0000-4000-8000-000000000001';
insert into public.service_requests(client_organization_id,library_id,service_id,status,created_by)select'f1541000-0000-4000-8000-000000000001','f8900000-0000-4000-8000-000000000010','d8950000-0000-4000-8000-000000000001','DRAFT','f1540000-0000-4000-8000-000000000001'from generate_series(1,250);
insert into public.contracts(id,client_organization_id,provider_organization_id,created_by)values
('d8941000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','f1540000-0000-4000-8000-000000000001'),
('d8941000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000003','f1540000-0000-4000-8000-000000000001');
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)values
('d8942000-0000-4000-8000-000000000001','d8941000-0000-4000-8000-000000000001',1,'f1547000-0000-4000-8000-000000000001','{}','{}','{}',12000,'MAD','{}',repeat('a',64),'Contrat de recette A','f1540000-0000-4000-8000-000000000001'),
('d8942000-0000-4000-8000-000000000002','d8941000-0000-4000-8000-000000000002',1,'f1547000-0000-4000-8000-000000000002','{}','{}','{}',24000,'MAD','{}',repeat('b',64),'Contrat de recette B','f1540000-0000-4000-8000-000000000001');
insert into public.missions(contract_id,contract_version_id,client_organization_id,provider_organization_id,status,created_by)values
('d8941000-0000-4000-8000-000000000001','d8942000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000002','COMPLETED','f1540000-0000-4000-8000-000000000001'),
('d8941000-0000-4000-8000-000000000002','d8942000-0000-4000-8000-000000000002','f1541000-0000-4000-8000-000000000001','f1541000-0000-4000-8000-000000000003','CANCELLED','f1540000-0000-4000-8000-000000000001');
update public.provider_capacity_versions set capacity_status='FULL',available_units=0;
insert into public.franchise_performance_score_snapshots(franchise_id,period_start,period_end,model_version,global_score_basis_points,library_quality_score_basis_points,axis_scores,measurements_snapshot,source_evidence_hash,health_suggestion,created_by)values('d8900000-0000-4000-8000-000000000001','2026-01-01','2026-01-31','PERF_FIXTURE_V1',7000,6700,'{}','[]',repeat('c',64),'ATTENTION','a8900000-0000-4000-8000-000000000001');
set local session_replication_role=origin;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a8900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into functional_results values('METRICS',public.franchise_supervision_metrics('d8900000-0000-4000-8000-000000000001'));
reset role;
select is((select value->>'methodologyVersion'from functional_results where kind='METRICS'),'FRANCHISE_SUPERVISION_V1','metric formula version is explicit');
select is((select value->>'requestCount'from functional_results where kind='METRICS'),'251','request KPI is exhaustive past the 100-row display limit');
select is((select value->>'completedMissions'from functional_results where kind='METRICS'),'1','only completed mission counts as completed');
select is((select value->>'missionCount'from functional_results where kind='METRICS'),'2','cancelled mission remains in the declared all-missions denominator');
select is((select value->>'availableProviders'from functional_results where kind='METRICS'),'0','qualified FULL provider is not counted as available');
select is((select value->>'capacityProviders'from functional_results where kind='METRICS'),'2','availability denominator comes from actual capacity declarations');
select is((select value->'byService'->0->>'requests'from functional_results where kind='METRICS'),'251','service chart groups actual service identity over full history');
select is((select value->'byProvider'->0->>'organizationId'from functional_results where kind='METRICS'),'f1541000-0000-4000-8000-000000000002','assignment chart follows the actual provider organization');
select is((select value->'qualitySnapshot'->>'scoreBasisPoints'from functional_results where kind='METRICS'),'6700','quality is the versioned measured score, not an anomaly count');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a8900000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.franchise_supervision_metrics('d8900000-0000-4000-8000-000000000001')$$,'42501','FRANCHISE_METRICS_SCOPE_DENIED','sibling mandate cannot read these metric projections');
reset role;select *from finish();rollback;
