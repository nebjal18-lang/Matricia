begin;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('c2160000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v41-admin@example.invalid','',now(),'{}','{}',now(),now()),
('c2160000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v41-a@example.invalid','',now(),'{}','{}',now(),now()),
('c2160000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v41-b@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('ca216000-0000-4000-8000-000000000001','V41 Tenant A','V41 A','ACTIVE','c2160000-0000-4000-8000-000000000002'),
('cb216000-0000-4000-8000-000000000002','V41 Tenant B','V41 B','ACTIVE','c2160000-0000-4000-8000-000000000003');
insert into public.organization_memberships(organization_id,user_id,status,activated_at)values
('ca216000-0000-4000-8000-000000000001','c2160000-0000-4000-8000-000000000002','ACTIVE',now()),
('cb216000-0000-4000-8000-000000000002','c2160000-0000-4000-8000-000000000003','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)select id,'CLIENT_OWNER'from public.organization_memberships where user_id in('c2160000-0000-4000-8000-000000000002','c2160000-0000-4000-8000-000000000003');
insert into public.platform_user_roles(user_id,role_code)values('c2160000-0000-4000-8000-000000000001','SUPER_ADMIN');

insert into public.marketing_consents(organization_id,purpose,decision,policy_version,evidence_hash,decided_by)values('ca216000-0000-4000-8000-000000000001','SOCIAL_PUBLISHING','GRANTED','V4.1',repeat('a',64),'c2160000-0000-4000-8000-000000000002');
insert into public.marketing_brand_authorizations(id,organization_id,decision,authorization_scope,policy_version,evidence_hash,effective_from,decided_by)values
('c2160000-0000-4000-8000-000000000010','ca216000-0000-4000-8000-000000000001','GRANTED',array['SOCIAL_PUBLISHING'],'V4.1',repeat('b',64),now()-interval'1 day','c2160000-0000-4000-8000-000000000002'),
('c2160000-0000-4000-8000-000000000011','cb216000-0000-4000-8000-000000000002','GRANTED',array['SOCIAL_PUBLISHING'],'V4.1',repeat('c',64),now()-interval'1 day','c2160000-0000-4000-8000-000000000003');
insert into public.social_connections(id,organization_id,provider,status,scopes,credential_reference,connected_by)values('c2160000-0000-4000-8000-000000000020','ca216000-0000-4000-8000-000000000001','META','ACTIVE',array['pages_manage_posts','instagram_basic','instagram_content_publish'],'env://TEST_META','c2160000-0000-4000-8000-000000000002');
insert into public.social_connection_security_versions(organization_id,social_connection_id,version,provider,status,vault_credential_reference,ciphertext_fingerprint,approved_scopes,created_by)values('ca216000-0000-4000-8000-000000000001','c2160000-0000-4000-8000-000000000020',1,'META','ACTIVE','env://TEST_META',repeat('d',64),array['pages_manage_posts','instagram_basic','instagram_content_publish'],'c2160000-0000-4000-8000-000000000002');
insert into public.social_accounts(id,organization_id,connection_id,provider_account_reference,display_name,status)values('c2160000-0000-4000-8000-000000000021','ca216000-0000-4000-8000-000000000001','c2160000-0000-4000-8000-000000000020','123456','V41 account','ACTIVE');
insert into public.marketing_schedule_rules(id,organization_id,social_account_id,version,status,timezone,allowed_slots,content_hash,created_by)values('c2160000-0000-4000-8000-000000000022','ca216000-0000-4000-8000-000000000001','c2160000-0000-4000-8000-000000000021',1,'ACTIVE','UTC','[]',repeat('9',64),'c2160000-0000-4000-8000-000000000002');
insert into public.marketing_calendars(id,organization_id,schedule_rule_id,month_start,status,generated_at,approved_by,approved_at)values('c2160000-0000-4000-8000-000000000023','ca216000-0000-4000-8000-000000000001','c2160000-0000-4000-8000-000000000022',date_trunc('month',current_date)::date,'SCHEDULED',now(),'c2160000-0000-4000-8000-000000000002',now());
insert into public.brand_kits(id,organization_id,status,created_by)values('c2160000-0000-4000-8000-000000000030','ca216000-0000-4000-8000-000000000001','DRAFT','c2160000-0000-4000-8000-000000000002');
insert into public.brand_kit_versions(id,brand_kit_id,version,payload,content_hash,change_reason,created_by)values('c2160000-0000-4000-8000-000000000031','c2160000-0000-4000-8000-000000000030',1,'{"legal_name":"A","trade_name":"A","primary_colors":[],"tone":"PRO","languages":["FR"],"primary_cta":"GO","tracked_url":"https://example.invalid","required_mentions":[],"forbidden_terms":[],"approved_hashtags":[]}',repeat('e',64),'V4.1 test','c2160000-0000-4000-8000-000000000002');
update public.brand_kits set status='READY',current_version_id='c2160000-0000-4000-8000-000000000031'where id='c2160000-0000-4000-8000-000000000030';
insert into public.marketing_templates(id,template_key,status,created_by)values('c2160000-0000-4000-8000-000000000040','PROBLEM_SOLUTION','DRAFT','c2160000-0000-4000-8000-000000000001')on conflict(template_key)do nothing;
insert into public.marketing_template_versions(id,template_id,version,structure,frequency_max_weekly,content_hash,created_by)values('c2160000-0000-4000-8000-000000000041',(select id from public.marketing_templates where template_key='PROBLEM_SOLUTION'),(select coalesce(max(version),0)+1 from public.marketing_template_versions where template_id=(select id from public.marketing_templates where template_key='PROBLEM_SOLUTION')),'{"hook":"h","body":"b","target_characters":100,"required_media":[],"allowed_ctas":[],"forbidden_claims":[],"translation_rules":{},"repetition_rules":{}}',8,repeat('f',64),'c2160000-0000-4000-8000-000000000001');
update public.marketing_templates set status='ACTIVE',current_version_id='c2160000-0000-4000-8000-000000000041'where id='c2160000-0000-4000-8000-000000000040';
insert into public.marketing_campaigns(id,organization_id,brand_kit_version_id,mode,title_fr,title_ar,status,frequency_max_weekly,risk_threshold,audience_snapshot,source_snapshot,approved_by,approved_at,created_by)values('c2160000-0000-4000-8000-000000000050','ca216000-0000-4000-8000-000000000001','c2160000-0000-4000-8000-000000000031','ASSISTED','Campagne V4.1','حملة','APPROVED',8,20,'{}','{}','c2160000-0000-4000-8000-000000000002',now(),'c2160000-0000-4000-8000-000000000002');
insert into public.marketing_content(id,campaign_id,channel,template_version_id)values
('c2160000-0000-4000-8000-000000000060','c2160000-0000-4000-8000-000000000050','INSTAGRAM','c2160000-0000-4000-8000-000000000041'),
('c2160000-0000-4000-8000-000000000061','c2160000-0000-4000-8000-000000000050','FACEBOOK','c2160000-0000-4000-8000-000000000041'),
('c2160000-0000-4000-8000-000000000062','c2160000-0000-4000-8000-000000000050','REEL','c2160000-0000-4000-8000-000000000041');
insert into public.marketing_content_versions(id,content_id,version,language,title_internal,hook,body,cta,hashtags,landing_url,compliance_checks,risk_score,status,expires_at,content_hash,created_by)values
('c2160000-0000-4000-8000-000000000070','c2160000-0000-4000-8000-000000000060',1,'FR','Valid','Hook','Body','CTA',array['v41'],'https://example.invalid/v41','{"source":"PASS","brand":"PASS","claims":"PASS","privacy":"PASS","certification":"PASS","promotion":"PASS","duplicate":"PASS","offer":"PASS","price":"PASS","pii":"PASS"}',0,'APPROVED',now()+interval'1 day',repeat('1',64),'c2160000-0000-4000-8000-000000000002'),
('c2160000-0000-4000-8000-000000000071','c2160000-0000-4000-8000-000000000061',1,'FR','Expired','Hook','Body','CTA',array['v41'],'https://example.invalid/v41-expired','{"source":"PASS","brand":"PASS","claims":"PASS","privacy":"PASS","certification":"PASS","promotion":"PASS","duplicate":"PASS","offer":"PASS","price":"PASS","pii":"PASS"}',0,'APPROVED',now()-interval'1 second',repeat('2',64),'c2160000-0000-4000-8000-000000000002'),
('c2160000-0000-4000-8000-000000000072','c2160000-0000-4000-8000-000000000062',1,'FR','Blocked','Hook','Body','CTA',array['v41'],'https://example.invalid/v41-blocked','{"source":"PASS","brand":"PASS","claims":"PASS","privacy":"PASS","certification":"PASS","promotion":"PASS","duplicate":"PASS","offer":"PASS","price":"PASS","pii":"PASS"}',0,'APPROVED',now()+interval'1 day',repeat('3',64),'c2160000-0000-4000-8000-000000000002');
insert into public.marketing_calendar_items(id,campaign_id,content_version_id,social_connection_id,scheduled_at,status,calendar_id)values
('c2160000-0000-4000-8000-000000000080','c2160000-0000-4000-8000-000000000050','c2160000-0000-4000-8000-000000000070','c2160000-0000-4000-8000-000000000020',now(),'SCHEDULED','c2160000-0000-4000-8000-000000000023'),
('c2160000-0000-4000-8000-000000000081','c2160000-0000-4000-8000-000000000050','c2160000-0000-4000-8000-000000000072','c2160000-0000-4000-8000-000000000020',now()+interval'1 second','SCHEDULED','c2160000-0000-4000-8000-000000000023');
insert into public.social_publication_jobs(id,organization_id,calendar_item_id,provider,status,idempotency_key,available_at)values
('c2160000-0000-4000-8000-000000000090','ca216000-0000-4000-8000-000000000001','c2160000-0000-4000-8000-000000000080','META','QUEUED','v41-valid-job',now()-interval'1 second'),
('c2160000-0000-4000-8000-000000000091','ca216000-0000-4000-8000-000000000001','c2160000-0000-4000-8000-000000000081','META','QUEUED','v41-blocked-job',now()-interval'1 second');


create temporary table media_test(k text primary key,v jsonb);
select set_config('request.jwt.claim.sub','c2160000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"c2160000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.reserve_social_media_asset_v1('c2160000-0000-4000-8000-000000000090',repeat('a',64),'image/jpeg',100,true)$$,'42501','FORBIDDEN','tenant cannot grant platform public-media approval');
select set_config('request.jwt.claim.sub','c2160000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"c2160000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.reserve_social_media_asset_v1('c2160000-0000-4000-8000-000000000090',repeat('a',64),'image/jpeg',100,false)$$,'22023','MEDIA_EXPLICIT_APPROVAL_REQUIRED','no implicit public asset approval');
insert into media_test values('asset',public.reserve_social_media_asset_v1('c2160000-0000-4000-8000-000000000090',repeat('a',64),'image/jpeg',100,true));
select is((select v->>'storage_path'from media_test where k='asset'),'ca216000-0000-4000-8000-000000000001/c2160000-0000-4000-8000-000000000090/'||repeat('a',64),'source path binds tenant, exact job and SHA256');
select throws_ok($$select public.reserve_social_media_asset_v1('c2160000-0000-4000-8000-000000000090',repeat('b',64),'image/jpeg',100,true)$$,'22000','MEDIA_ASSET_IMMUTABLE','approved bytes cannot change for a frozen job');
select ok(not has_function_privilege('authenticated','public.complete_social_media_asset_v1(uuid,text)','EXECUTE'),'operator cannot assert file verification');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.complete_social_media_asset_v1((select(v->>'asset_id')::uuid from media_test where k='asset'),repeat('a',64));
-- SQL tests use fixture metadata only; actual Storage bytes/hash validation is covered by HTTP/runner tests.
update public.social_publication_jobs set status='CLAIMED',attempt_count=1,lease_token='f2160000-0000-4000-8000-000000000001',claimed_by='meta-sql-test',claimed_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval'5 minutes'where id in('c2160000-0000-4000-8000-000000000090','c2160000-0000-4000-8000-000000000091');
insert into public.social_publication_attempt_events(organization_id,job_id,attempt,lease_token,worker_id,state,request_hash,provider,provider_request_key,correlation_id,evidence_snapshot)
select organization_id,id,1,lease_token,claimed_by,'CLAIMED',repeat('8',64),'META','meta-original:'||id::text,'f2160000-0000-4000-8000-000000000002',jsonb_build_object('authorization_evidence_hash',repeat('b',64),'consent_evidence_hash',repeat('a',64),'content_hash',case when id='c2160000-0000-4000-8000-000000000090'then repeat('1',64)else repeat('3',64)end,'security_version_id',(select id from public.social_connection_security_versions where social_connection_id='c2160000-0000-4000-8000-000000000020'))from public.social_publication_jobs where id in('c2160000-0000-4000-8000-000000000090','c2160000-0000-4000-8000-000000000091');
insert into media_test values('execution',jsonb_build_object('id',public.begin_social_media_execution_v1('c2160000-0000-4000-8000-000000000090','f2160000-0000-4000-8000-000000000001')));
insert into media_test values('work',public.claim_social_media_step_v1((select(v->>'id')::uuid from media_test where k='execution')));
select is((select v->'execution'->>'account_reference'from media_test where k='work'),'123456','execution binds native account from original calendar');
select is((select v->'asset'->>'sha256'from media_test where k='work'),repeat('a',64),'worker receives exact approved source hash');
create function pg_temp.media_advance(s text,e jsonb default'{}')returns jsonb language sql as $$select public.advance_social_media_step_v1((select(v->>'id')::uuid from media_test where k='execution'),(select(v->>'worker_token')::uuid from media_test where k='work'),s,e)$$;
create function pg_temp.media_next()returns void language plpgsql as $$begin update public.social_media_executions set next_check_at=clock_timestamp(),worker_until=null where id=(select(v->>'id')::uuid from media_test where k='execution');update media_test set v=public.claim_social_media_step_v1((select(v->>'id')::uuid from media_test where k='execution'))where k='work';end$$;
select throws_ok($$select public.advance_social_media_step_v1((select(v->>'id')::uuid from media_test where k='execution'),'f2160000-0000-4000-8000-000000000099','READY','{}')$$,'55000','MEDIA_STEP_LEASE_INVALID','concurrent stale worker cannot write a phase');
select throws_ok($$select pg_temp.media_advance('PUBLISH_STARTED')$$,'55000','MEDIA_TRANSITION_DENIED','cannot skip media preparation or original container');
select pg_temp.media_advance('FREEZING',jsonb_build_object('asset_sha256',repeat('a',64)));
select pg_temp.media_advance('READY',jsonb_build_object('asset_sha256',repeat('a',64),'public_asset_url','https://test.supabase.co/storage/v1/object/public/marketing-media-public/'||(select v->>'storage_path'from media_test where k='asset'),'caption','Approved https://example.invalid/?mref='||(select v->>'id'from media_test where k='execution'),'delivery_sha256',repeat('c',64)));
select pg_temp.media_next();select pg_temp.media_advance('CREATE_STARTED');
select is((select state from public.social_media_executions where id=(select(v->>'id')::uuid from media_test where k='execution')),'CREATE_STARTED','POST start is committed before a provider request');
select pg_temp.media_next();
select is((select v->>'outcome'from media_test where k='work'),'MEDIA_OPERATOR_REQUIRED','crash after create start becomes durable ambiguity');
select throws_ok($$select pg_temp.media_advance('CREATE_STARTED')$$,'55000','MEDIA_STEP_LEASE_INVALID','ambiguous container creation can never POST again');
select set_config('request.jwt.claims','{"sub":"c2160000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.request_social_media_investigation_v1((select(v->>'id')::uuid from media_test where k='execution'),'Investigate native dashboard without resending media')$$,'operator can create an actionable durable investigation');
select is((select count(*)from public.social_media_investigations where execution_id=(select(v->>'id')::uuid from media_test where k='execution')),1::bigint,'investigation is durable and deduplicated');
select is((select state from public.social_media_executions where id=(select(v->>'id')::uuid from media_test where k='execution')),'UNKNOWN','investigation neither confirms publication nor permits resending');
-- A distinct second execution exercises the successful native-proof path and crash at publish.
insert into media_test values('asset2',public.reserve_social_media_asset_v1('c2160000-0000-4000-8000-000000000091',repeat('d',64),'video/mp4',100,true));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.complete_social_media_asset_v1((select(v->>'asset_id')::uuid from media_test where k='asset2'),repeat('d',64));
update media_test set v=jsonb_build_object('id',public.begin_social_media_execution_v1('c2160000-0000-4000-8000-000000000091','f2160000-0000-4000-8000-000000000001'))where k='execution';
select pg_temp.media_next();select pg_temp.media_advance('FREEZING',jsonb_build_object('asset_sha256',repeat('d',64)));select pg_temp.media_advance('READY',jsonb_build_object('asset_sha256',repeat('d',64),'public_asset_url','https://test.supabase.co/storage/v1/object/public/marketing-media-public/'||(select v->>'storage_path'from media_test where k='asset2'),'caption','Approved https://example.invalid/?mref='||(select v->>'id'from media_test where k='execution'),'delivery_sha256',repeat('e',64)));
select pg_temp.media_next();
select throws_ok($$select public.advance_social_media_step_v1((select(v->>'id')::uuid from media_test where k='execution'),null,'CREATE_STARTED','{}')$$,'55000','MEDIA_STEP_LEASE_INVALID','NULL never bypasses worker lease');
-- Current-account revocation is checked immediately before the POST permit.
update public.social_accounts set status='DISCONNECTED'where id='c2160000-0000-4000-8000-000000000021';
select throws_ok($$select pg_temp.media_advance('CREATE_STARTED')$$,'42501','MEDIA_SEND_POLICY_REVOKED','inactive account blocks POST even after media preparation');
update public.social_accounts set status='ACTIVE'where id='c2160000-0000-4000-8000-000000000021';
select pg_temp.media_advance('CREATE_STARTED');select pg_temp.media_advance('CONTAINER_CREATED','{"container_id":"444444","response_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');
select pg_temp.media_next();select pg_temp.media_advance('PROCESSING','{}');select pg_temp.media_next();select pg_temp.media_advance('READY_TO_PUBLISH','{}');select pg_temp.media_next();select pg_temp.media_advance('PUBLISH_STARTED');select pg_temp.media_next();
select is((select v->'execution'->>'state'from media_test where k='work'),'VERIFYING','lost publish reply resumes native verification of persisted original container');
select throws_ok($$select pg_temp.media_advance('PUBLISH_STARTED')$$,'55000','MEDIA_TRANSITION_DENIED','lost publish reply cannot publish again');
select throws_ok($$select pg_temp.media_advance('PUBLISHED','{}')$$,'23514','MEDIA_NATIVE_PROOF_REQUIRED','no publication success without exact native evidence');
select throws_ok($$select pg_temp.media_advance('PUBLISHED',jsonb_build_object('publication_id','555555','response_sha256',repeat('f',64),'container_state','PUBLISHED'))$$,'23514','MEDIA_NATIVE_PROOF_REQUIRED','native creation time is mandatory, never inferred');
select is(pg_temp.media_advance('PUBLISHED',jsonb_build_object('publication_id','555555','response_sha256',repeat('f',64),'container_state','PUBLISHED','native_created_at',clock_timestamp()))->>'state','PUBLISHED','positive native evidence completes the original attempt');
select is((select count(*)from public.marketing_publication_journal where job_id='c2160000-0000-4000-8000-000000000091'),1::bigint,'native proof writes one immutable publication journal');
select is((select attempt_count from public.social_publication_jobs where id='c2160000-0000-4000-8000-000000000091'),1,'asynchronous steps never consume a new publication attempt');
select ok(not has_table_privilege('service_role','public.social_media_executions','UPDATE')and not has_table_privilege('authenticated','public.social_media_assets','INSERT'),'narrow RPCs preserve RLS and no broad service writes');
select throws_ok($$update public.social_media_step_events set state='PUBLISHED'where execution_id=(select(v->>'id')::uuid from media_test where k='execution')$$,'55000','MARKETING_HISTORY_IMMUTABLE','checkpoint evidence is append-only');
select ok(exists(select 1 from jsonb_array_elements(public.operational_metrics_v1()->'social_media')q where q->>'status'='UNKNOWN'and(q->>'count')::bigint>=1),'media ambiguity is immediately visible before global job timeout');
select ok(public.operational_metrics_v1()::text not like'%c2160000-0000-4000-8000-000000000090%'and public.operational_metrics_v1()::text not like'%mref=%','media metrics expose neither exact job identity nor delivered caption');
select*from finish();rollback;
