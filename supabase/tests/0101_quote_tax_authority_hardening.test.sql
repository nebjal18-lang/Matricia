begin;
set local search_path=public,extensions;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select plan(33);
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('fa010000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-tax-reviewer@example.invalid','',now(),'{}','{}',now(),now());

insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)
values
 ('QUOTE_TEST_A','Devis test A','اختبار أ','Catégorie fiscale test A','فئة اختبار أ','SERVICE','ACTIVE'),
 ('QUOTE_TEST_B','Devis test B','اختبار ب','Catégorie fiscale test B','فئة اختبار ب','SERVICE','ACTIVE'),
 ('QUOTE_TEST_DEMO','Devis test démo','اختبار تجريبي','Catégorie fiscale démo','فئة تجريبية','SERVICE','ACTIVE'),
 ('QUOTE_TEST_RETIRED','Devis expiré','اختبار منتهي','Catégorie de règle expirée','فئة قاعدة منتهية','SERVICE','ACTIVE');

insert into public.tax_rule_versions(
 id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,
 professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,
 approved_by,approved_at,validation_reference,content_hash,change_reason
) values
 ('fa011000-0000-4000-8000-000000000001','MA','QUOTE_TEST_A',1,2000,'2026-01-01',null,'DRAFT','PENDING','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('1',64),'Règle inactive pour test'),
 ('fa011000-0000-4000-8000-000000000002','MA','QUOTE_TEST_DEMO',1,2000,'2026-01-01',null,'RETIRED','DEMO','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('2',64),'Règle démonstration non validée'),
 ('fa011000-0000-4000-8000-000000000003','MA','QUOTE_TEST_B',1,2000,'2030-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa010000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('3',64),'Règle future validée test'),
 ('fa011000-0000-4000-8000-000000000004','MA','QUOTE_TEST_RETIRED',1,2000,'2020-01-01','2020-12-31','ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa010000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('4',64),'Règle expirée validée test'),
 ('fa011000-0000-4000-8000-000000000005','MA','QUOTE_TEST_A',2,2000,'2026-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa010000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('5',64),'Règle valide test');

select throws_ok($$insert into public.tax_rule_versions(
  jurisdiction_code,category_code,version,rate_basis_points,effective_from,status,professional_validation_status,
  rule_type,priority,conditions,legal_reference,rounding_strategy,content_hash,change_reason
) values ('MA','QUOTE_TEST_DEMO',2,2000,'2026-01-01','ACTIVE','DEMO','VAT',100,'{}',
  'Automated test of blocked demo activation','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',repeat('6',64),'Demo rules cannot become financially active')$$,
  '23514','new row for relation "tax_rule_versions" violates check constraint "tax_rules_active_validation_check"',
  'database constraints reject activation of a non professionally validated DEMO rule');

select has_function('private','assert_quote_tax_rule',array['uuid','text','date'],'authoritative quote tax guard exists');
select ok((select p.prosecdef and p.proconfig::text like '%search_path=pg_catalog%' and p.prosrc like '%assert_quote_tax_rule%' and p.prosrc like '%create_quote_revision_legacy_0156%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_quote_revision_pre_cas_v1'),'quote tax authority validates before the mature calculation core');
select throws_ok($$select private.assert_quote_tax_rule('fa011000-0000-4000-8000-000000000001','QUOTE_TEST_A','2026-09-12')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','inactive rule is rejected');
select throws_ok($$select private.assert_quote_tax_rule('fa011000-0000-4000-8000-000000000002','QUOTE_TEST_DEMO','2026-09-12')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','retired unvalidated DEMO rule is rejected by the quote guard');
select throws_ok($$select private.assert_quote_tax_rule('fa011000-0000-4000-8000-000000000003','QUOTE_TEST_B','2029-12-31')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','future rule is rejected');
select throws_ok($$select private.assert_quote_tax_rule('fa011000-0000-4000-8000-000000000004','QUOTE_TEST_RETIRED','2021-01-01')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','expired rule is rejected');
select throws_ok($$select private.assert_quote_tax_rule('fa011000-0000-4000-8000-000000000003','QUOTE_TEST_A','2030-01-01')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','wrong snapshot category is rejected');
select throws_ok($$select private.assert_quote_tax_rule('fa011000-0000-4000-8000-000000000003',null,'2030-01-01')$$,'22023'::char(5),'QUOTE_TAX_CATEGORY_INVALID','missing category fails closed');

select ok(has_function_privilege('authenticated','public.create_quote_revision(uuid,jsonb,text,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.create_quote_revision(uuid,jsonb,text,text,uuid)','EXECUTE') and not has_function_privilege('service_role','public.create_quote_revision(uuid,jsonb,text,text,uuid)','EXECUTE'),'only authenticated can execute the wrapper');
select ok(not has_function_privilege('authenticated','private.assert_quote_tax_rule(uuid,text,date)','EXECUTE') and not has_function_privilege('public','private.assert_quote_tax_rule(uuid,text,date)','EXECUTE'),'private guard ACL is fail closed');
select ok(not has_function_privilege('authenticated','public.create_quote_revision_legacy_0156(uuid,jsonb,text,text,uuid)','EXECUTE') and not has_function_privilege('service_role','public.create_quote_revision_legacy_0156(uuid,jsonb,text,text,uuid)','EXECUTE') and not has_function_privilege('public','public.create_quote_revision_legacy_0156(uuid,jsonb,text,text,uuid)','EXECUTE'),'legacy implementation cannot bypass the wrapper');

insert into public.organizations(id,legal_name,display_name,status,created_by) values
('fa012000-0000-4000-8000-000000000001','Client fiscal test','Client fiscal test','ACTIVE','fa010000-0000-4000-8000-000000000001'),
('fa012000-0000-4000-8000-000000000002','Provider fiscal test','Provider fiscal test','ACTIVE','fa010000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status) values('fa013000-0000-4000-8000-000000000001','fa012000-0000-4000-8000-000000000002','fa010000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values('fa013000-0000-4000-8000-000000000001','PROVIDER_SALES');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values('fa014000-0000-4000-8000-000000000001','QUOTE_TAX','quote-tax','fa012000-0000-4000-8000-000000000001','DRAFT','fa010000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by) values('fa014000-0000-4000-8000-000000000002','fa014000-0000-4000-8000-000000000001','QUOTE_TAX_CAT','quote-tax-cat','DRAFT','fa010000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by) values('fa014000-0000-4000-8000-000000000003','fa014000-0000-4000-8000-000000000001','fa014000-0000-4000-8000-000000000002','QUOTE_TAX_SUB','quote-tax-sub','DRAFT','fa010000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by) values('fa014000-0000-4000-8000-000000000004','fa014000-0000-4000-8000-000000000001','fa014000-0000-4000-8000-000000000003','QUOTE_TAX_SERVICE','quote-tax-service','DRAFT','fa010000-0000-4000-8000-000000000001');
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values('fa015000-0000-4000-8000-000000000001','fa012000-0000-4000-8000-000000000001','fa014000-0000-4000-8000-000000000001','fa014000-0000-4000-8000-000000000004','MATCHING','fa010000-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by) values('fa015000-0000-4000-8000-000000000002','fa015000-0000-4000-8000-000000000001','fa012000-0000-4000-8000-000000000001','fa014000-0000-4000-8000-000000000001',1,'Demande fiscale test','NORMAL','MAD','{"region_code":"CASABLANCA"}',true,repeat('6',64),repeat('7',64),'Fixture fiscale',repeat('8',64),'fa010000-0000-4000-8000-000000000001');
update public.service_requests set current_version_id='fa015000-0000-4000-8000-000000000002' where id='fa015000-0000-4000-8000-000000000001';
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at) values('fa016000-0000-4000-8000-000000000001','fa015000-0000-4000-8000-000000000001','fa015000-0000-4000-8000-000000000002','MATCH-V1','COMPLETED',1,'fa010000-0000-4000-8000-000000000001',now());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component) values('fa016000-0000-4000-8000-000000000002','fa016000-0000-4000-8000-000000000001','fa012000-0000-4000-8000-000000000002',true,9000,'{}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by) values('fa017000-0000-4000-8000-000000000001','fa015000-0000-4000-8000-000000000001','fa015000-0000-4000-8000-000000000002','fa016000-0000-4000-8000-000000000001','OPEN',now()+interval'7 days','{"mask_direct_contacts":true,"competitor_offers_visible":false}',1,'fa010000-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values('fa018000-0000-4000-8000-000000000001','fa017000-0000-4000-8000-000000000001','fa012000-0000-4000-8000-000000000002','fa016000-0000-4000-8000-000000000002','ACCEPTED',now());
set local session_replication_role=origin;

-- Historical published catalogue precondition; fiscal mapping uses real independent commands.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('f2669000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','mapping266-'||i||'@example.invalid',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values('f2669000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('f2669000-0000-4000-8000-000000000002','SUPER_ADMIN');
do $$declare r public.service_requests%rowtype;v public.service_request_versions%rowtype;vid uuid:=extensions.gen_random_uuid();context jsonb;proposal jsonb;claims text:=current_setting('request.jwt.claims',true);begin
 select*into r from public.service_requests where id='fa015000-0000-4000-8000-000000000001';select*into v from public.service_request_versions where request_id=r.id order by version_number limit 1;
 insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at)values(vid,r.service_id,r.library_id,1,'PUBLISHED','Service fiscal TEST','خدمة اختبار','Service test','خدمة اختبار','Catalogue historique TEST','كتالوج اختبار تاريخي','CONSULTING','Forfait','حزمة',1,'Historical source for quote tax test',v.catalog_snapshot_hash,r.created_by,now()-interval'2 days');
 perform set_config('request.jwt.claims','{"sub":"f2669000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 context:=public.get_service_tax_category_mapping_context_v1(vid,'MA',v.currency_code);
 proposal:=public.propose_service_tax_category_mapping_v1(vid,v.catalog_snapshot_hash,context->>'scope_hash','MA',v.currency_code,'QUOTE_TEST_A',current_date,null,true,'{}','TEST exact source classification',extensions.gen_random_uuid());
 perform set_config('request.jwt.claims','{"sub":"f2669000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_service_tax_category_mapping_v1((proposal->>'proposal_id')::uuid,proposal->>'content_hash',true,'TEST/266/QUOTE','Independent TEST classification review');
 perform set_config('request.jwt.claims',coalesce(claims,''),true);
end$$;

create temporary table quote_tax_payload(value jsonb);
insert into quote_tax_payload values(jsonb_build_object('currency','MAD','solution_fr','Solution fiscale','solution_ar','','deliverables',jsonb_build_array('Livrable'),'inclusions','[]'::jsonb,'exclusions','[]'::jsonb,'prerequisites','[]'::jsonb,'warranty_fr','Garantie test','warranty_ar','','correction_terms_fr','Corrections incluses','correction_terms_ar','','sla','{}'::jsonb,'proposed_start_date','2026-09-12','duration_days','10','valid_until',(now()+interval'30 days')::text,'items',jsonb_build_array(jsonb_build_object('line_number','1','item_kind','ONE_TIME','label_fr','Forfait test','label_ar','','quantity','1','unit_code','FORFAIT','unit_price_minor','10000','tax_rule_version_id','fa011000-0000-4000-8000-000000000005','recurrence_interval','')),'options','[]'::jsonb));
update quote_tax_payload set value=value||'{"expected_current_version_id":null}'::jsonb;
grant select on quote_tax_payload to authenticated;
create temporary table quote_tax_result(value jsonb);grant select,insert on quote_tax_result to authenticated;

set local role authenticated;select set_config('request.jwt.claims','{"sub":"fa010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',jsonb_set((select value from quote_tax_payload),'{items,0,tax_rule_version_id}','"fa011000-0000-4000-8000-000000000001"'),'Test inactive','quote-tax-inactive','fa019000-0000-4000-8000-000000000001')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','direct RPC rejects inactive rule');
select throws_ok($$select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',jsonb_set((select value from quote_tax_payload),'{items,0,tax_rule_version_id}','"fa011000-0000-4000-8000-000000000002"'),'Test validation','quote-tax-demo','fa019000-0000-4000-8000-000000000002')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','direct RPC rejects non-validated rule');
select throws_ok($$select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',jsonb_set(jsonb_set((select value from quote_tax_payload),'{proposed_start_date}','"2029-12-31"'),'{items,0,tax_rule_version_id}','"fa011000-0000-4000-8000-000000000003"'),'Test future','quote-tax-future','fa019000-0000-4000-8000-000000000003')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','direct RPC rejects future rule');
select throws_ok($$select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',jsonb_set(jsonb_set((select value from quote_tax_payload),'{proposed_start_date}','"2021-01-01"'),'{items,0,tax_rule_version_id}','"fa011000-0000-4000-8000-000000000004"'),'Test expiry','quote-tax-expired','fa019000-0000-4000-8000-000000000004')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','direct RPC rejects expired rule');
select throws_ok($$select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',jsonb_set(jsonb_set((select value from quote_tax_payload),'{proposed_start_date}','"2030-01-01"'),'{items,0,tax_rule_version_id}','"fa011000-0000-4000-8000-000000000003"'),'Test catégorie','quote-tax-wrong','fa019000-0000-4000-8000-000000000005')$$,'22023'::char(5),'QUOTE_TAX_RULE_INVALID','direct RPC rejects wrong category');
select is((public.list_provider_quote_service_tax_policies_v1('fa012000-0000-4000-8000-000000000002',array['fa018000-0000-4000-8000-000000000001'::uuid])->0->>'category_code'),'QUOTE_TEST_A','provider reads classification from independently reviewed exact service source');
select throws_ok($$select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',(select value from quote_tax_payload)||jsonb_build_object('service_tax_policy_snapshot',jsonb_build_object('category_code','QUOTE_TEST_B')),'Caller snapshot forbidden','quote-tax-forged-policy')$$,'22023','QUOTE_PAYLOAD_INVALID','caller cannot supply the server-only classification snapshot');
insert into quote_tax_result select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',(select value from quote_tax_payload),'Test valide','quote-tax-valid','fa019000-0000-4000-8000-000000000007');
reset role;
select is((select value->>'outcome' from quote_tax_result),'QUOTE_REVISION_CREATED','direct RPC accepts valid rule');
select ok((select qi.tax_rule_version_id='fa011000-0000-4000-8000-000000000005' and qi.tax_rate_basis_points=2000 and qv.calculation_basis->>'money'='MINOR_UNITS' from public.quote_items qi join public.quote_versions qv on qv.id=qi.quote_version_id where qi.quote_version_id=(select (value->>'quote_version_id')::uuid from quote_tax_result)),'revision freezes authoritative tax snapshot');

set local role authenticated;
select is(public.create_quote_revision('fa018000-0000-4000-8000-000000000001',(select value from quote_tax_payload),'Test valide','quote-tax-valid','fa019000-0000-4000-8000-000000000007'),(select value from quote_tax_result),'successful command replays despite the browser base now being old');
select throws_ok($$select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',(select value from quote_tax_payload),'Concurrent edit','quote-cas-stale')$$,'40001','QUOTE_VERSION_CONFLICT','stale browser cannot replace a saved quote');
reset role;
select is((select count(*)from public.quote_versions where quote_id=(select(value->>'quote_id')::uuid from quote_tax_result)),1::bigint,'stale command creates no immutable version');
set local role authenticated;
select is(public.create_quote_revision('fa018000-0000-4000-8000-000000000001',(select value from quote_tax_payload)||jsonb_build_object('expected_current_version_id',(select value->>'quote_version_id'from quote_tax_result)),'Reviewed current version','quote-cas-current')->>'outcome','QUOTE_REVISION_CREATED','reviewed current base can create the next revision');
reset role;
select is((select qv.calculation_basis->'service_tax_policy_snapshot'->>'category_code'from public.quote_versions qv where qv.id=(select(value->>'quote_version_id')::uuid from quote_tax_result)),'QUOTE_TEST_A','caller fiscal JSON is replaced by the reviewed registry classification');
select ok((select qv.calculation_basis->'service_tax_policy_snapshot'->>'content_hash'<>repeat('f',64)from public.quote_versions qv where qv.id=(select(value->>'quote_version_id')::uuid from quote_tax_result)),'caller cannot forge the mapping approval hash');
select is((select qv.calculation_basis->'service_tax_policy_snapshot'->>'request_version_id'from public.quote_versions qv where qv.id=(select(value->>'quote_version_id')::uuid from quote_tax_result)),'fa015000-0000-4000-8000-000000000002','quote freezes the exact RFQ request version');
select ok((select not(required_quote_data?'tax_category_code')and not(required_quote_data?'tax_category_policy_snapshot')from public.service_request_versions where id='fa015000-0000-4000-8000-000000000002'),'legacy request version remains unchanged and has no caller category');
select throws_ok($$select public.create_quote_revision('fa018000-0000-4000-8000-000000000001',jsonb_set((select value from quote_tax_payload)||jsonb_build_object('expected_current_version_id',(select current_version_id from public.quotes where id=(select(value->>'quote_id')::uuid from quote_tax_result))),'{currency}','"EUR"'),'Invalid currency','quote-currency-mismatch')$$,'22023','QUOTE_CURRENCY_MUST_MATCH_REQUEST','quote currency cannot escape the canonical request scope');
reset role;
create temporary table original_fiscal_hash as select content_hash,calculation_basis from public.quote_versions where id=(select(value->>'quote_version_id')::uuid from quote_tax_result);
do $$declare vid uuid;context jsonb;proposal jsonb;oldid uuid;begin
 select id into vid from public.catalog_service_versions where service_id='fa014000-0000-4000-8000-000000000004';
 select id into oldid from public.service_tax_category_mappings where service_version_id=vid;
 perform set_config('request.jwt.claims','{"sub":"f2669000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 context:=public.get_service_tax_category_mapping_context_v1(vid,'MA','MAD');
 proposal:=public.propose_service_tax_category_mapping_v1(vid,repeat('6',64),context->>'scope_hash','MA','MAD','QUOTE_TEST_A',current_date,null,true,array[oldid],'TEST reviewed mapping replacement',extensions.gen_random_uuid());
 perform set_config('request.jwt.claims','{"sub":"f2669000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_service_tax_category_mapping_v1((proposal->>'proposal_id')::uuid,proposal->>'content_hash',true,'TEST/266/REPLACEMENT','Independent TEST replacement review');
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fa010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.create_quote_revision('fa018000-0000-4000-8000-000000000001',(select value from quote_tax_payload),'Test valide','quote-tax-valid','fa019000-0000-4000-8000-000000000007'),(select value from quote_tax_result),'completed raw command replays after mapping replacement without reclassification');
reset role;
select ok((select v.content_hash=h.content_hash and v.calculation_basis=h.calculation_basis from public.quote_versions v cross join original_fiscal_hash h where v.id=(select(value->>'quote_version_id')::uuid from quote_tax_result)),'replacement never rewrites an existing quote fiscal snapshot or hash');
select is((select count(*)from public.quote_versions where quote_id=(select(value->>'quote_id')::uuid from quote_tax_result)),2::bigint,'fiscal replay adds no quote version');
select * from finish();
rollback;
