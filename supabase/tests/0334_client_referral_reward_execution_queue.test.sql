begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
-- Synthetic bound actors and historical verified-document metadata. This SQL
-- contract does not certify physical Storage bytes or a remote antivirus scan.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select('a3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','review334-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,7)i;
insert into auth.sessions(id,user_id,aal,created_at,updated_at)select('f3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'aal2',now(),now()from generate_series(1,7)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3340000-0000-4000-8000-000000000001','TEST Measurement334 A','TEST Measurement334 A','ACTIVE','a3340000-0000-4000-8000-000000000001'),
('b3340000-0000-4000-8000-000000000002','TEST Measurement334 B','TEST Measurement334 B','ACTIVE','a3340000-0000-4000-8000-000000000002'),
('b3340000-0000-4000-8000-000000000007','TEST Measurement334 C','TEST Measurement334 C','ACTIVE','a3340000-0000-4000-8000-000000000007');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)select('c3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE',now()from unnest(array[1,2,7])i;
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values('c3340000-0000-4000-8000-000000000003','b3340000-0000-4000-8000-000000000001','a3340000-0000-4000-8000-000000000003','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)select('c3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'CLIENT_OWNER'from unnest(array[1,2,7])i;
insert into public.platform_user_roles(user_id,role_code)values
('a3340000-0000-4000-8000-000000000003','FINANCE_MANAGER'),
('a3340000-0000-4000-8000-000000000004','COMPLIANCE_MANAGER'),
('a3340000-0000-4000-8000-000000000005','COMPLIANCE_MANAGER'),
('a3340000-0000-4000-8000-000000000006','COMPLIANCE_MANAGER');
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values
('d3340000-0000-4000-8000-000000000002','b3340000-0000-4000-8000-000000000002','VERIFIED',1,'a3340000-0000-4000-8000-000000000002',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values
('d3340000-0000-4000-8000-000000000002','b3340000-0000-4000-8000-000000000002',1,'{}','{}',1,'a3340000-0000-4000-8000-000000000002');
insert into public.client_compliance_documents(id,compliance_case_id,organization_id,document_type,version,policy_version_id,document_number,issuer,issued_on,expires_on,original_file_name,file_extension,declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by)values
('d3341000-0000-4000-8000-000000000002','d3340000-0000-4000-8000-000000000002','b3340000-0000-4000-8000-000000000002','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT'and status='ACTIVE'),'TEST-RC334','TEST tribunal',current_date-30,current_date+365,'proof334.pdf','pdf','application/pdf',128,repeat('a',64),'b3340000-0000-4000-8000-000000000002/test334/proof.pdf','application/pdf',128,'VERIFIED',now(),'a3340000-0000-4000-8000-000000000003',now(),'a3340000-0000-4000-8000-000000000002');
insert into private.client_document_scan_results(id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id)values
('d3342000-0000-4000-8000-000000000002','d3341000-0000-4000-8000-000000000002','b3340000-0000-4000-8000-000000000002',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','d3343000-0000-4000-8000-000000000002');
update public.client_compliance_documents set current_scan_result_id='d3342000-0000-4000-8000-000000000002',scan_status='CLEAN',scanned_at=now()where id='d3341000-0000-4000-8000-000000000002';
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values
('d3340000-0000-4000-8000-000000000007','b3340000-0000-4000-8000-000000000007','VERIFIED',1,'a3340000-0000-4000-8000-000000000007',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values
('d3340000-0000-4000-8000-000000000007','b3340000-0000-4000-8000-000000000007',1,'{}','{}',1,'a3340000-0000-4000-8000-000000000007');
insert into public.client_compliance_documents(id,compliance_case_id,organization_id,document_type,version,policy_version_id,document_number,issuer,issued_on,expires_on,original_file_name,file_extension,declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by)values
('d3341000-0000-4000-8000-000000000007','d3340000-0000-4000-8000-000000000007','b3340000-0000-4000-8000-000000000007','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT'and status='ACTIVE'),'TEST-RC334','TEST tribunal',current_date-30,current_date+365,'proof334.pdf','pdf','application/pdf',128,repeat('a',64),'b3340000-0000-4000-8000-000000000007/test334/proof.pdf','application/pdf',128,'VERIFIED',now(),'a3340000-0000-4000-8000-000000000003',now(),'a3340000-0000-4000-8000-000000000007');
insert into private.client_document_scan_results(id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id)values
('d3342000-0000-4000-8000-000000000007','d3341000-0000-4000-8000-000000000007','b3340000-0000-4000-8000-000000000007',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','d3343000-0000-4000-8000-000000000007');
update public.client_compliance_documents set current_scan_result_id='d3342000-0000-4000-8000-000000000007',scan_status='CLEAN',scanned_at=now()where id='d3341000-0000-4000-8000-000000000007';
create temporary table review334(k text primary key,v jsonb);grant all on review334 to authenticated;
create function pg_temp.actor334(i integer,p_aal text default'aal2')returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','a3340000-0000-4000-8000-'||lpad(i::text,12,'0'),true);perform set_config('request.jwt.claims',jsonb_build_object('sub','a3340000-0000-4000-8000-'||lpad(i::text,12,'0'),'role','authenticated','aal',p_aal,'session_id','f3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::text,true);end$$;
select ok(not has_function_privilege('service_role','public.execute_client_referral_reward_v1(uuid,text,uuid)','execute'),'no service financial-executor grant');
select ok(not has_table_privilege('authenticated','public.client_referral_reward_execution_requests_v1','insert'),'browser cannot forge an execution request');
select ok(not has_table_privilege('authenticated','public.client_referral_reward_execution_facts_v1','insert'),'browser cannot forge credit execution');
set local role authenticated;
select pg_temp.actor334(1);
insert into review334 values('link',public.create_referral_link('b3340000-0000-4000-8000-000000000001','TEST0334_LINK','CLIENT','TEST_334_REWARD',now()+interval'30 days',10,'test334-create-link'));
select pg_temp.actor334(2);
insert into review334 values('claim-2',public.claim_client_referral_v1('TEST0334_LINK','b3340000-0000-4000-8000-000000000002',true,'test334-claim-2'));
insert into review334 values('profile-2',public.advance_client_referral_with_document_v1((select(v->>'referral_conversion_id')::uuid from review334 where k='claim-2'),'PROFILE_STARTED','d3341000-0000-4000-8000-000000000002',1,'test334-profile-2'));
select pg_temp.actor334(4);
insert into review334 values('verified-2',public.advance_client_referral_with_document_v1((select(v->>'referral_conversion_id')::uuid from review334 where k='claim-2'),'VERIFIED','d3341000-0000-4000-8000-000000000002',2,'test334-verified-2'));
select pg_temp.actor334(5);
insert into review334 values('active-2',public.advance_client_referral_with_document_v1((select(v->>'referral_conversion_id')::uuid from review334 where k='claim-2'),'ACTIVE','d3341000-0000-4000-8000-000000000002',3,'test334-active-2'));
select pg_temp.actor334(7);
insert into review334 values('claim-7',public.claim_client_referral_v1('TEST0334_LINK','b3340000-0000-4000-8000-000000000007',true,'test334-claim-7'));
insert into review334 values('profile-7',public.advance_client_referral_with_document_v1((select(v->>'referral_conversion_id')::uuid from review334 where k='claim-7'),'PROFILE_STARTED','d3341000-0000-4000-8000-000000000007',1,'test334-profile-7'));
select pg_temp.actor334(4);
insert into review334 values('verified-7',public.advance_client_referral_with_document_v1((select(v->>'referral_conversion_id')::uuid from review334 where k='claim-7'),'VERIFIED','d3341000-0000-4000-8000-000000000007',2,'test334-verified-7'));
select pg_temp.actor334(5);
insert into review334 values('active-7',public.advance_client_referral_with_document_v1((select(v->>'referral_conversion_id')::uuid from review334 where k='claim-7'),'ACTIVE','d3341000-0000-4000-8000-000000000007',3,'test334-active-7'));
select pg_temp.actor334(3);
insert into review334 values('rule',public.create_reward_rule_version('TEST0334_REFERRAL','ACTIVE','REFERRAL_VERIFIED','REFERRED_CLIENT',5,5,5,30,0,30,'{"conversion_stage":"ACTIVE"}',true,clock_timestamp()-interval'1 minute',clock_timestamp()+interval'15 seconds','Test independent referral reward execution','test334-rule'));
reset role;
insert into review334 select 'source-'||i,to_jsonb(e.id)from unnest(array[2,7])i join public.reward_source_events e on e.source_reference_id=(select v->>'referral_conversion_id'from review334 where k='claim-'||i)and e.organization_id=('b3340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid and e.audience_type='REFERRED_CLIENT';
insert into review334 select 'wrong-audience-source',to_jsonb(e.id)from public.reward_source_events e where e.source_reference_id=(select v->>'referral_conversion_id'from review334 where k='claim-2')and e.organization_id='b3340000-0000-4000-8000-000000000001'and e.audience_type='CLIENT_ORGANIZATION';
select is((select count(*)::integer from review334 where k like'source-%'),2,'two genuine active conversions emitted two recipient sources');
set local role authenticated;
select pg_temp.actor334(5);
select throws_ok($$select public.decide_reward_award((select(v#>>'{}')::uuid from review334 where k='source-2'),(select(v->>'rule_version_id')::uuid from review334 where k='rule'),'APPROVED','Test source author must not approve','test334-self-approve')$$,'42501','REWARD_DUAL_CONTROL_REQUIRED','source author cannot approve own evidence');
select pg_temp.actor334(6);
select throws_ok($$select public.decide_reward_award((select(v#>>'{}')::uuid from review334 where k='wrong-audience-source'),(select(v->>'rule_version_id')::uuid from review334 where k='rule'),'APPROVED','Test wrong audience source binding','test334-wrong-audience')$$,'23514','REWARD_RULE_SOURCE_MISMATCH','independent reviewer cannot substitute a referrer source for recipient rule');
insert into review334 values('approval',public.decide_reward_award((select(v#>>'{}')::uuid from review334 where k='source-2'),(select(v->>'rule_version_id')::uuid from review334 where k='rule'),'APPROVED','Test independently checked active referral','test334-approve'));
select is((select v->>'outcome'from review334 where k='approval'),'REWARD_AWARD_APPROVED','Compliance approval commits without financial authority');
select is((select state from public.list_client_referral_reward_statuses_v1('b3340000-0000-4000-8000-000000000002')where approval_id=(select(v->>'approval_id')::uuid from review334 where k='approval')),'APPROVED_PENDING_EXECUTION','decision is explicitly pending execution');
select is((select v->>'rule_version_id'from review334 where k='approval'),(select v->>'rule_version_id'from review334 where k='rule'),'decision binds exact selected rule');
select ok(not exists(select 1 from jsonb_array_elements(public.list_admin_client_referral_reward_queue_v1()->'rows')q where(q->>'can_execute')::boolean),'Compliance queue never exposes financial execution');
select throws_ok($$select public.execute_client_referral_reward_v1((select(v->>'approval_id')::uuid from review334 where k='approval'),'test334-compliance-execute')$$,'42501','REFERRAL_REWARD_EXECUTION_DENIED','Compliance cannot execute credits');
reset role;
select is((select count(*)::integer from public.client_referral_reward_execution_requests_v1 where approval_id=(select(v->>'approval_id')::uuid from review334 where k='approval')),1,'approved decision has one durable execution request');
select is((select count(*)::integer from public.credit_wallets where organization_id='b3340000-0000-4000-8000-000000000002'),0,'approval creates no wallet and no fabricated balance');
select is((select count(*)::integer from public.reward_grants where organization_id='b3340000-0000-4000-8000-000000000002'),0,'approval creates no reward grant');
set local role authenticated;
select pg_temp.actor334(3,'aal1');
select throws_ok($$select public.execute_client_referral_reward_v1((select(v->>'approval_id')::uuid from review334 where k='approval'),'test334-finance-aal1')$$,'42501','REFERRAL_REWARD_AAL2_REQUIRED','Finance AAL1 cannot execute');
select pg_temp.actor334(7);
select throws_ok($$select public.list_admin_client_referral_reward_queue_v1()$$,'42501','REFERRAL_REWARD_REVIEW_DENIED','ordinary Client cannot inspect global source queue');
select throws_ok($$select public.list_client_referral_reward_statuses_v1('b3340000-0000-4000-8000-000000000002')$$,'42501','REFERRAL_REWARD_STATUS_DENIED','foreign Client cannot inspect another organization decisions');
select throws_ok($$select public.execute_client_referral_reward_v1((select(v->>'approval_id')::uuid from review334 where k='approval'),'test334-foreign-execute')$$,'42501','REFERRAL_REWARD_REVIEW_DENIED','foreign Client cannot execute Finance command');
select pg_temp.actor334(3);
insert into review334 values('execution',public.execute_client_referral_reward_v1((select(v->>'approval_id')::uuid from review334 where k='approval'),'test334-finance-execute'));
select is((select v->>'quantity'from review334 where k='execution'),'5','Finance executes exact approved credits');
insert into review334 values('replay',public.execute_client_referral_reward_v1((select(v->>'approval_id')::uuid from review334 where k='approval'),'test334-finance-replay'));
select is((select v->>'reward_grant_id'from review334 where k='execution'),(select v->>'reward_grant_id'from review334 where k='replay'),'different delivery key still replays the same approval grant');
select is((select v->>'replayed'from review334 where k='replay'),'true','completed command reports replay');
select pg_temp.actor334(2);
select is((select state from public.list_client_referral_reward_statuses_v1('b3340000-0000-4000-8000-000000000002')where approval_id=(select(v->>'approval_id')::uuid from review334 where k='approval')),'GRANTED','Client sees granted only after actual issuance');
select pg_temp.actor334(6);
insert into review334 values('approval-7',public.decide_reward_award((select(v#>>'{}')::uuid from review334 where k='source-7'),(select(v->>'rule_version_id')::uuid from review334 where k='rule'),'APPROVED','Test independent second referral decision','test334-approve-7'));
select pg_temp.actor334(3);
select throws_ok($$select public.execute_client_referral_reward_v1((select(v->>'approval_id')::uuid from review334 where k='approval-7'),'test334-cap-execute')$$,'23514','REWARD_GLOBAL_CAP_EXCEEDED','separate approved source cannot exceed native global rule cap');
reset role;
select is((select count(*)::integer from public.reward_grants where rule_version_id=(select(v->>'rule_version_id')::uuid from review334 where k='rule')),1,'replay and cap refusal leave one real immutable grant');
select is((select granted_by::text from public.reward_grants where id=(select(v->>'reward_grant_id')::uuid from review334 where k='execution')),'a3340000-0000-4000-8000-000000000003','actual Finance actor owns financial issuance without impersonation');
select is((select eligibility_evidence->>'source_event_id'from public.reward_grants where id=(select(v->>'reward_grant_id')::uuid from review334 where k='execution')),(select v#>>'{}'from review334 where k='source-2'),'real grant binds the exact approved source event');
select is((select rule_version_id::text from public.reward_grants where id=(select(v->>'reward_grant_id')::uuid from review334 where k='execution')),(select v->>'rule_version_id'from review334 where k='rule'),'real grant binds the exact approved rule version');
select is((select count(*)::integer from public.client_referral_reward_execution_facts_v1 where organization_id='b3340000-0000-4000-8000-000000000002'),1,'exactly one immutable completion');
select is((select count(*)::integer from public.event_outbox where event_type='ClientReferralRewardExecutionRequestedV1'and organization_id in('b3340000-0000-4000-8000-000000000002','b3340000-0000-4000-8000-000000000007')),2,'both real approved decisions retain durable queue events');
select is((select count(*)::integer from public.event_outbox where event_type='ClientReferralRewardExecutedV1'and organization_id='b3340000-0000-4000-8000-000000000002'),1,'only actual financial effect emits completion');
-- Let the immutable rule naturally expire; do not bypass its immutability trigger.
select pg_sleep(greatest(0,extract(epoch from((select effective_until from public.reward_rule_versions where id=(select(v->>'rule_version_id')::uuid from review334 where k='rule'))-clock_timestamp())))+0.05);
set local role authenticated;
select pg_temp.actor334(3);
select is(public.execute_client_referral_reward_v1((select(v->>'approval_id')::uuid from review334 where k='approval'),'test334-expired-replay')->>'reward_grant_id',(select v->>'reward_grant_id'from review334 where k='execution'),'completed history replays after rule expiry');
select throws_ok($$select public.execute_client_referral_reward_v1((select(v->>'approval_id')::uuid from review334 where k='approval-7'),'test334-expired-new')$$,'55000','ACTIVE_APPROVED_REFERRAL_REWARD_RULE_REQUIRED','expired rule blocks new issuance without corrupting prior history');
reset role;
select *from finish();
rollback;
