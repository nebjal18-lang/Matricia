begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select no_plan();
-- Synthetic source records and references, never a production legal approval.
-- This fixture proves restriction effects; it does not publish a campaign or send email.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('a2570000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','restriction257-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select('a2570000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'COMPLIANCE_MANAGER'from generate_series(1,2)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2570000-0000-4000-8000-000000000001','TEST restrictions257','TEST restrictions257','ACTIVE','a2570000-0000-4000-8000-000000000003'),('b2570000-0000-4000-8000-000000000002','TEST foreign257','TEST foreign257','ACTIVE','a2570000-0000-4000-8000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2570000-0000-4000-8000-000000000001','b2570000-0000-4000-8000-000000000001','a2570000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c2570000-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)select('d2570000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'b2570000-0000-4000-8000-000000000001',case when i=4 then'ERASURE'else'RESTRICTION'end,encode(extensions.digest(convert_to('b2570000-0000-4000-8000-000000000001:a2570000-0000-4000-8000-000000000003','UTF8'),'sha256'),'hex'),'ENHANCED','fr-MA','IN_REVIEW',now()+interval'1 day',now(),extensions.gen_random_uuid(),'a2570000-0000-4000-8000-000000000001'from generate_series(1,4)i;
create temporary table r257(k text primary key,v jsonb);grant all on r257 to authenticated,service_role;
create function pg_temp.actor257(p_i integer,p_aal text default'aal2')returns void language plpgsql as $$declare uid text:='a2570000-0000-4000-8000-'||lpad(p_i::text,12,'0');begin perform set_config('request.jwt.claim.sub',uid,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','aal',p_aal)::text,true);end$$;
create function pg_temp.service257()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;

-- Explicit synthetic templates exercise real enqueue and pre-transport commands.
-- No transport is called; no SENT/DELIVERED receipt is fabricated.
insert into public.notification_template_versions(id,template_code,version,event_type,category_code,locale,subject_template,body_template,priority,mandatory,channels,status,effective_from,content_hash)values
('e2570000-0000-4000-8000-000000000001','TEST257_MARKETING',1,'Test257MarketingV1','MARKETING','fr-MA','Information de recette','Communication marketing de recette','NORMAL',false,array['IN_APP'],'ACTIVE',now()-interval'1 minute',repeat('a',64)),
('e2570000-0000-4000-8000-000000000002','TEST257_SECURITY',1,'Test257SecurityV1','SECURITY_CRITICAL','fr-MA','Alerte de recette','Message de sécurité obligatoire de recette','CRITICAL',true,array['EMAIL'],'ACTIVE',now()-interval'1 minute',repeat('b',64));
select throws_ok($$insert into public.notification_template_versions(template_code,version,event_type,category_code,locale,subject_template,body_template,priority,mandatory,channels,status,effective_from,content_hash)values('TEST257_BAD_MARKETING',1,'Test257BadMarketingV1','MARKETING','fr-MA','Sujet de recette','Corps de recette','NORMAL',true,array['IN_APP'],'ACTIVE',now(),repeat('c',64))$$,'23514','NOTIFICATION_TEMPLATE_CATEGORY_MISMATCH','new marketing templates cannot invent a mandatory flag to bypass restriction');
set local role service_role;select pg_temp.service257();
insert into r257 values('queued',public.enqueue_notification('a2570000-0000-4000-8000-000000000003','b2570000-0000-4000-8000-000000000001','TEST257_MARKETING','Test257MarketingV1','fr-MA','{}','TEST257-before-restriction','test_fixture','restriction257'));
reset role;
select is((select v->>'outcome'from r257 where k='queued'),'NOTIFICATION_ENQUEUED','marketing is queued before the real subject restriction');
-- Only this fixture's delivery is leased, never the shared live queue.
update public.notification_deliveries set lease_token='e2570000-0000-4000-8000-000000000010',lease_owner='restriction257-worker',leased_until=clock_timestamp()+interval'5 minutes',attempt_count=1 where notification_id=(select(v->>'notification_id')::uuid from r257 where k='queued')and channel='IN_APP';
select pg_temp.service257();
select is(public.authorize_notification_delivery_send_v1((select id from public.notification_deliveries where notification_id=(select(v->>'notification_id')::uuid from r257 where k='queued')and channel='IN_APP'),'e2570000-0000-4000-8000-000000000010','restriction257-worker')->>'authorized','true','an unrestrained scoped IN_APP delivery is genuinely authorized before its transport');
set local role authenticated;select pg_temp.actor257(3);
insert into r257 values('scope',public.confirm_my_processing_restriction_scope_v1('d2570000-0000-4000-8000-000000000001','APPLY',array['MARKETING'],'TEST-257-scope'));
select pg_temp.actor257(1);
insert into r257 values('proposal',public.propose_dsr_processing_restriction_v1('d2570000-0000-4000-8000-000000000001',1,(select(v->>'scope_version_id')::uuid from r257 where k='scope'),'TEST-257-LAW-REFERENCE','TEST notification restriction exact subject and organization','TEST-257-proposal'));
select pg_temp.actor257(2);
insert into r257 values('review',public.review_dsr_processing_restriction_v1((select(v->>'proposal_id')::uuid from r257 where k='proposal'),(select v->>'content_hash'from r257 where k='proposal'),true,true,'TEST-257-REVIEW-REFERENCE','TEST independent review with security messages preserved'));
insert into r257 values('application',public.apply_dsr_processing_restriction_v1((select(v->>'proposal_id')::uuid from r257 where k='proposal'),(select v->>'content_hash'from r257 where k='proposal'),(select v->>'review_proof_hash'from r257 where k='review'),'TEST-257-apply'));
reset role;
select ok(private.dsr_processing_is_restricted_v1('b2570000-0000-4000-8000-000000000001','a2570000-0000-4000-8000-000000000003','MARKETING'),'restriction is applied by actual subject confirmation and independent approval');
select pg_temp.service257();
select throws_ok($$select public.enqueue_notification('a2570000-0000-4000-8000-000000000003','b2570000-0000-4000-8000-000000000001','TEST257_MARKETING','Test257MarketingV1','fr-MA','{}','TEST257-after-restriction','test_fixture','restriction257')$$,'55000','MARKETING_PROCESSING_RESTRICTED','restriction blocks personal marketing at creation before even writing a new notification');
select is((select count(*)from public.notification_instances where deduplication_key='TEST257-after-restriction'),0::bigint,'no restricted personal marketing record or outbox is created');
insert into r257 values('blocked',public.authorize_notification_delivery_send_v1((select id from public.notification_deliveries where notification_id=(select(v->>'notification_id')::uuid from r257 where k='queued')and channel='IN_APP'),'e2570000-0000-4000-8000-000000000010','restriction257-worker'));
select is((select v->>'reason'from r257 where k='blocked'),'MARKETING_PROCESSING_RESTRICTED','queued old marketing is checked again immediately before transport');
select ok((select status='SKIPPED'and lease_token is null and lease_owner is null and leased_until is null from public.notification_deliveries where notification_id=(select(v->>'notification_id')::uuid from r257 where k='queued')and channel='IN_APP'),'pre-transport refusal is terminal SKIPPED and releases the exact lease');
select is((select count(*)from public.audit_events where action='notification.delivery.send_blocked'and resource_id=(select id::text from public.notification_deliveries where notification_id=(select(v->>'notification_id')::uuid from r257 where k='queued')and channel='IN_APP')),1::bigint,'refusal has its real audited disposition');
select is((select count(*)from public.notification_deliveries where notification_id=(select(v->>'notification_id')::uuid from r257 where k='queued')and status in('SENT','DELIVERED')),0::bigint,'restriction never pretends a notification was sent');
set local role service_role;select pg_temp.service257();
insert into r257 values('security',public.enqueue_notification('a2570000-0000-4000-8000-000000000003','b2570000-0000-4000-8000-000000000001','TEST257_SECURITY','Test257SecurityV1','fr-MA','{}','TEST257-security-required','test_fixture','restriction257-security'));
reset role;
select is((select v->>'outcome'from r257 where k='security'),'NOTIFICATION_ENQUEUED','mandatory security processing remains on its own legal basis');
update public.notification_deliveries set lease_token='e2570000-0000-4000-8000-000000000011',lease_owner='restriction257-worker',leased_until=clock_timestamp()+interval'5 minutes',attempt_count=1 where notification_id=(select(v->>'notification_id')::uuid from r257 where k='security')and channel='EMAIL';
select pg_temp.service257();
select is(public.authorize_notification_delivery_send_v1((select id from public.notification_deliveries where notification_id=(select(v->>'notification_id')::uuid from r257 where k='security')and channel='EMAIL'),'e2570000-0000-4000-8000-000000000011','restriction257-worker')->>'authorized','true','marketing restriction does not revoke an active mandatory security legal basis');
reset role;
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2570000-0000-4000-8000-000000000002','b2570000-0000-4000-8000-000000000002','a2570000-0000-4000-8000-000000000003','ACTIVE'),('c2570000-0000-4000-8000-000000000003','b2570000-0000-4000-8000-000000000001','a2570000-0000-4000-8000-000000000004','ACTIVE');
set local role service_role;select pg_temp.service257();
select is(public.enqueue_notification('a2570000-0000-4000-8000-000000000003','b2570000-0000-4000-8000-000000000002','TEST257_MARKETING','Test257MarketingV1','fr-MA','{}','TEST257-other-organization','test_fixture','restriction257')->>'outcome','NOTIFICATION_ENQUEUED','one organization restriction does not silently spread to another');
select is(public.enqueue_notification('a2570000-0000-4000-8000-000000000004','b2570000-0000-4000-8000-000000000001','TEST257_MARKETING','Test257MarketingV1','fr-MA','{}','TEST257-other-subject','test_fixture','restriction257')->>'outcome','NOTIFICATION_ENQUEUED','one subject restriction does not silently spread to another');
reset role;
select*from finish();rollback;
