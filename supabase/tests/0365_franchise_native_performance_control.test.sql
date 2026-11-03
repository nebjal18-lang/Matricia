-- Isolated TEST-only, rollback-only fixtures; no disabled trigger or policy.
-- Mutations run as the authenticated manager through audited catalogue commands.
begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','performance-lifecycle-'||i||'@example.invalid','',now(),'{}','{}',now(),now() from generate_series(1,3)i;
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('b3650000-0000-4000-8000-000000000001','Performance TEST A','Performance TEST A','ACTIVE','a3650000-0000-4000-8000-000000000001'),
('b3650000-0000-4000-8000-000000000002','Performance TEST B','Performance TEST B','ACTIVE','a3650000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status)
select ('c3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE' from generate_series(1,2)i;
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)
select ('f3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'EDITORIAL_365_'||i,'performance-365-'||i,('b3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'DRAFT',('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by)
select ('f3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE',now()-interval'1 day',1,('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,activation_mode,created_by)
select ('d3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('f3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'STANDARD','FRANCHISEE','EDITORIAL_365_'||i,'ACTIVE','NON_CONTRACTUAL_DEMO',('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)
select ('e3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('d3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,'EDITORIAL_365_'||i,'Territoire test '||i,'نطاق اختبار '||i,'{}',now()-interval'1 day',repeat('a',64),('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select ('e3651000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('d3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('e3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,(select id from public.franchise_economic_rule_versions where franchise_type='STANDARD' order by version desc limit 1),1,'ACTIVE','{}','{}','{"testOnly":true}',0,'UPFRONT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('b',64),('a3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
update public.franchises f set current_mandate_version_id=m.id from public.franchise_mandate_versions m where m.franchise_id=f.id and f.id in('d3650000-0000-4000-8000-000000000001','d3650000-0000-4000-8000-000000000002');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)
select ('c3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'FRANCHISE_MANAGER',('d3650000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;


-- A genuinely empty library A remains unmeasured. B contains a real draft
-- identity with no published version: this observed incomplete inventory scores 0.
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values('f3651000-0000-4000-8000-000000000001','f3650000-0000-4000-8000-000000000002','CONTROL_CATEGORY','control-category','DRAFT','a3650000-0000-4000-8000-000000000002');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values('f3652000-0000-4000-8000-000000000001','f3650000-0000-4000-8000-000000000002','f3651000-0000-4000-8000-000000000001','CONTROL_SUBCATEGORY','control-subcategory','DRAFT','a3650000-0000-4000-8000-000000000002');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values('f3653000-0000-4000-8000-000000000001','f3650000-0000-4000-8000-000000000002','f3652000-0000-4000-8000-000000000001','CONTROL_SERVICE','control-service','DRAFT','a3650000-0000-4000-8000-000000000002');

-- Two distinct real TEST mandates above; no disabled guard or bypassed RLS.
insert into public.platform_user_roles(user_id,role_code)values
('a3650000-0000-4000-8000-000000000001','MATRICIA_ADMIN'),
('a3650000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a3650000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','composite-review-365@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('c3650000-0000-4000-8000-000000000004','b3650000-0000-4000-8000-000000000002','a3650000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values('c3650000-0000-4000-8000-000000000004','FRANCHISE_OWNER','d3650000-0000-4000-8000-000000000002');
insert into public.platform_user_roles(user_id,role_code)values('a3650000-0000-4000-8000-000000000004','MATRICIA_ADMIN');
create temporary table control_observed365(k text primary key,v jsonb);
grant all on control_observed365 to authenticated,service_role;
select is(private.franchise_control_ratio_v1(0,0),null::integer,'absence of observations is not a zero score');
select is(private.franchise_control_ratio_v1(0,4),0,'an observed zero numerator retains a true zero');
select is(private.franchise_control_ratio_v1(3,4),7500,'native ratio uses exact arithmetic');
select is(private.franchise_control_ratio_v1(9,4),10000,'a valid positive ratio is bounded');
select ok(not has_function_privilege('authenticated','public.run_franchise_performance_control_v1(integer)','EXECUTE'),'members cannot run the scheduler');
select ok(not has_function_privilege('service_role','private.collect_franchise_control_metrics_v1(uuid,date,date,integer)','EXECUTE'),'service cannot invoke an unbounded private projection');
select ok(not has_table_privilege('authenticated','public.franchise_control_reports_v1','INSERT'),'members cannot forge automatic reports');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.propose_franchise_control_model_v1('{"CLIENT_NETWORK":2000,"LIBRARY_QUALITY":2000,"PROVIDER_NETWORK":1500,"DELIVERY_PERFORMANCE":2000,"CLIENT_SATISFACTION":1500,"COMPLIANCE_FINANCE":1000}',6000,4000,30,current_date,'control365-model')$$,'42501','FRANCHISE_CONTROL_ADMIN_AAL2_REQUIRED','AAL1 cannot change the model');
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into control_observed365 values('model',public.propose_franchise_control_model_v1('{"CLIENT_NETWORK":2000,"LIBRARY_QUALITY":2000,"PROVIDER_NETWORK":1500,"DELIVERY_PERFORMANCE":2000,"CLIENT_SATISFACTION":1500,"COMPLIANCE_FINANCE":1000}',6500,4500,30,(statement_timestamp()at time zone 'Africa/Casablanca')::date,'control365-model'));
insert into control_observed365 values('model-replay',public.propose_franchise_control_model_v1('{"CLIENT_NETWORK":2000,"LIBRARY_QUALITY":2000,"PROVIDER_NETWORK":1500,"DELIVERY_PERFORMANCE":2000,"CLIENT_SATISFACTION":1500,"COMPLIANCE_FINANCE":1000}',6500,4500,30,(statement_timestamp()at time zone 'Africa/Casablanca')::date,'control365-model'));
select is((select v from control_observed365 where k='model'),(select v from control_observed365 where k='model-replay'),'model proposal replays exactly');
select throws_ok($$select public.propose_franchise_control_model_v1('{"CLIENT_NETWORK":2000,"LIBRARY_QUALITY":2000,"PROVIDER_NETWORK":1500,"DELIVERY_PERFORMANCE":2000,"CLIENT_SATISFACTION":1500,"COMPLIANCE_FINANCE":1000}',6000,4000,30,(statement_timestamp()at time zone 'Africa/Casablanca')::date,'control365-model')$$,'23514','FRANCHISE_CONTROL_IDEMPOTENCY_CONFLICT','same command key cannot propose different settings');
select throws_ok(format($q$select public.review_franchise_control_model_v1(%L,'APPROVED','Independent review must refuse self approval')$q$,(select v->>'modelId'from control_observed365 where k='model')),'42501','FRANCHISE_CONTROL_INDEPENDENT_REVIEW_REQUIRED','model author cannot approve their own rule');
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into control_observed365 values('review',public.review_franchise_control_model_v1((select(v->>'modelId')::uuid from control_observed365 where k='model'),'APPROVED','Independent approval of TEST performance model'));
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into control_observed365 values('run',public.run_franchise_performance_control_v1(25));
insert into control_observed365 values('run-replay',public.run_franchise_performance_control_v1(25));
reset role;
select is((select(v->>'failed')::integer from control_observed365 where k='run'),0,'all native report collections succeed');
select is((select(v->>'processed')::integer from control_observed365 where k='run'),2,'both real TEST mandates are independently measured');
select is((select count(*)::integer from public.franchise_control_reports_v1 where franchise_id in('d3650000-0000-4000-8000-000000000001','d3650000-0000-4000-8000-000000000002')),6,'daily monthly and quarterly reports are automatic for each mandate');
select is((select(v->>'processed')::integer from control_observed365 where k='run-replay'),0,'same-day replay creates no duplicate report');
select is((select count(*)::integer from public.franchise_control_reports_v1 where global_score_bps is not null and franchise_id='d3650000-0000-4000-8000-000000000001'),0,'unobserved axes cannot certify a global score');
select is((select axis_scores->'LIBRARY_QUALITY'from public.franchise_control_reports_v1 where franchise_id='d3650000-0000-4000-8000-000000000001'and kind='DAILY'),'null'::jsonb,'an empty catalogue is unmeasured rather than zero');
select is((select axis_scores->>'LIBRARY_QUALITY'from public.franchise_control_reports_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'and kind='DAILY'),'0','an actually incomplete draft inventory retains an observed zero');
select is((select count(*)::integer from public.franchise_control_plan_proposals_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'),1,'an open thirty-day proposal covers the same objectives without duplicate daily monthly quarterly plans');
select is((select metrics->>'contractualMandate'from public.franchise_control_reports_v1 where franchise_id='d3650000-0000-4000-8000-000000000001'and kind='DAILY'),'false','TEST demo mandate cannot stand in for contractual compliance');
select is((select methodology->>'manualSnapshotsConsumed'from public.franchise_control_reports_v1 where franchise_id='d3650000-0000-4000-8000-000000000001'and kind='DAILY'),'false','automatic source projection ignores administrator measurements');
select is((select comparison->>'status'from public.franchise_control_reports_v1 where franchise_id='d3650000-0000-4000-8000-000000000001'and kind='QUARTERLY'),'INSUFFICIENT_COHORT','small cohorts reveal no comparison identifiers');
select is((select version from public.franchise_control_model_versions_v1 m join public.franchise_control_reports_v1 r on r.model_id=m.id where r.franchise_id='d3650000-0000-4000-8000-000000000001'and r.kind='DAILY'),2,'independently approved model is frozen into every report');
select throws_ok($$update public.franchise_control_reports_v1 set completeness='COMPLETE'where franchise_id='d3650000-0000-4000-8000-000000000001'$$,'55000','IMMUTABLE_FRANCHISE_HISTORY','generated report cannot be rewritten');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is(jsonb_array_length(public.list_franchise_native_control_v1('d3650000-0000-4000-8000-000000000002')->'reports'),3,'a member reads native reports for their exact mandate');
insert into control_observed365 values('progress',public.record_franchise_control_plan_event_v1((select id from public.franchise_control_plan_proposals_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'order by id limit 1),'PROGRESS','Texte français saisi librement et conservé',25,'control365-progress'));
insert into control_observed365 values('progress-replay',public.record_franchise_control_plan_event_v1((select id from public.franchise_control_plan_proposals_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'order by id limit 1),'PROGRESS','Texte français saisi librement et conservé',25,'control365-progress'));
select is((select v from control_observed365 where k='progress'),(select v from control_observed365 where k='progress-replay'),'progress retries preserve the same append-only event');
select is((select comment from public.franchise_control_plan_events_v1 limit 1),'Texte français saisi librement et conservé','free text remains unchanged');
select throws_ok(format($q$select public.record_franchise_control_plan_event_v1(%L,'APPROVED','A member cannot approve this plan',null,'control365-forbidden')$q$,(select id from public.franchise_control_plan_proposals_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'order by id limit 1)),'42501','FRANCHISE_CONTROL_ADMIN_AAL2_REQUIRED','manager cannot activate their own corrective plan');


do $$declare selected_plan uuid;i integer;begin
 select id into selected_plan from public.franchise_control_plan_proposals_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'order by id limit 1;
 for i in 1..51 loop perform public.record_franchise_control_plan_event_v1(selected_plan,'COMMENT','Commentaire de recette numéro '||i,null,'control365-history-'||i);end loop;
end$$;
insert into control_observed365 values('first-history-page',public.list_franchise_native_control_v1('d3650000-0000-4000-8000-000000000002'));
select is(jsonb_array_length((select v#>'{plans,0,events}'from control_observed365 where k='first-history-page')),50,'plan history is bounded to fifty genuine events');
select is((select(v#>>'{plans,0,eventCount}')::integer from control_observed365 where k='first-history-page'),52,'the complete history count is retained without silent truncation');
insert into control_observed365 values('next-history-page',public.list_franchise_native_control_v1('d3650000-0000-4000-8000-000000000002',p_event_plan_id:=(select(v#>>'{plans,0,id}')::uuid from control_observed365 where k='first-history-page'),p_after_event_id:=(select(v#>>'{plans,0,nextEventAfter}')::bigint from control_observed365 where k='first-history-page')));
select is(jsonb_array_length((select v#>'{plans,0,events}'from control_observed365 where k='next-history-page')),2,'continuation reaches the remaining events without replaying the first page');
select throws_ok($$select public.list_franchise_native_control_v1('d3650000-0000-4000-8000-000000000001')$$,'42501','FRANCHISE_CONTROL_READ_DENIED','another mandate is denied at the bounded read API');
select is((select count(*)::integer from public.franchise_control_reports_v1 where franchise_id='d3650000-0000-4000-8000-000000000001'),0,'underlying RLS hides the other mandate reports');
reset role;
select is((select count(*)::integer from public.event_outbox where event_type='FranchiseControlReportGeneratedV1'and aggregate_id in('d3650000-0000-4000-8000-000000000001','d3650000-0000-4000-8000-000000000002')),6,'automatic reports emit one event each and replay emits none');
select is((select count(*)::integer from public.audit_events where action='franchise.control.report_generated'and organization_id in('b3650000-0000-4000-8000-000000000001','b3650000-0000-4000-8000-000000000002')),6,'each immutable report has an audit trail');
select is((select status from public.franchises where id='d3650000-0000-4000-8000-000000000001'),'ACTIVE','control engine never sanctions or terminates a franchise automatically');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select is(public.list_franchise_native_control_v1('d3650000-0000-4000-8000-000000000002')#>>'{capabilities,canDecide}','false','the composite operator is not offered independent approval controls');
select throws_ok(format($q$select public.record_franchise_control_plan_event_v1(%L,'APPROVED','Cannot approve the operator own plan',null,'control365-composite')$q$,(select id from public.franchise_control_plan_proposals_v1 where franchise_id='d3650000-0000-4000-8000-000000000002'limit 1)),'42501','FRANCHISE_CONTROL_PLAN_INDEPENDENT_REVIEW_REQUIRED','composite Admin and franchise member cannot approve the operator plan');
reset role;


set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3650000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into control_observed365 values('queued-invitation',public.queue_franchise_network_invitations_v1('d3650000-0000-4000-8000-000000000002','e3650000-0000-4000-8000-000000000002','CLIENT','a3650000-0000-4000-8000-000000000002','[{"invitation_id":"a3654000-0000-4000-8000-000000000001","contact_email":"queue-metric-365@example.invalid","display_name":"TEST Pending invitation","locale":"fr","token_hash":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","source_code":"TEST"}]',true,'control365-queue'));
reset role;
select is((select(v->>'created')::integer from control_observed365 where k='queued-invitation'),1,'an actual native acquisition invitation is queued without delivery');
select is(private.collect_franchise_control_metrics_v1('d3650000-0000-4000-8000-000000000002',(statement_timestamp()at time zone 'Africa/Casablanca')::date,(statement_timestamp()at time zone 'Africa/Casablanca')::date)#>>'{networkInvitations,queued}','1','unsent invitation with null delivery mode remains a real pending count');
select is(private.collect_franchise_control_metrics_v1('d3650000-0000-4000-8000-000000000002',(statement_timestamp()at time zone 'Africa/Casablanca')::date,(statement_timestamp()at time zone 'Africa/Casablanca')::date)#>>'{networkInvitations,sent}','0','queued invitation is never counted as external delivery');
select *from finish();rollback;
