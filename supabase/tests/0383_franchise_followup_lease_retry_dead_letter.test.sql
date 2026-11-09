begin;
set local search_path=public,extensions;
select plan(28);

select ok((select count(*)=3 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relkind='r'and c.relname=any(array['franchise_followup_policy_versions','franchise_followup_preference_versions','franchise_followup_jobs'])),'MAT-FUNC-038 follow-up scheduler tables exist');
select ok((select count(*)=3 and bool_and(c.relrowsecurity)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname=any(array['franchise_followup_policy_versions','franchise_followup_preference_versions','franchise_followup_jobs'])),'RLS is enabled on every follow-up table');
select ok((select count(*)=3 from pg_policies where schemaname='public'and tablename=any(array['franchise_followup_policy_versions','franchise_followup_preference_versions','franchise_followup_jobs'])),'each follow-up table has scoped read policy');
select ok((select count(*)=2 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname=any(array['franchise_followup_policy_versions','franchise_followup_preference_versions'])and t.tgname like'%history%'and not t.tgisinternal),'policy and preference histories are immutably guarded');
select ok((select count(*)=4 and bool_and(p.prosecdef and p.proconfig::text like'%search_path=%')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array['schedule_franchise_followups','claim_franchise_followup_jobs','complete_franchise_followup_job','fail_franchise_followup_job'])),'worker commands are hardened security definer functions');
select ok((select count(*)=4 and bool_and(has_function_privilege('service_role',p.oid,'EXECUTE')and not has_function_privilege('authenticated',p.oid,'EXECUTE')and not has_function_privilege('anon',p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array['schedule_franchise_followups','claim_franchise_followup_jobs','complete_franchise_followup_job','fail_franchise_followup_job'])),'schedule, claim, complete and fail are service-role only');
select ok(has_function_privilege('authenticated','public.propose_franchise_followup_policy(uuid,text[],integer[],integer[],integer,integer,integer,timestamptz,timestamptz,text,text,uuid)','EXECUTE')and has_function_privilege('authenticated','public.configure_franchise_followup_preference(uuid,boolean,boolean,text,text,time,time,integer,text,text,uuid)','EXECUTE'),'franchise operators keep policy and preference commands');
select ok((select prosrc like'%FRANCHISE_FOLLOWUP_SCHEDULER_ONLY%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_followups'),'scheduler rejects non-service callers');
select ok((select prosrc like'%status = ''LEASED''%'and prosrc like'%lease_until <= p_now%'and prosrc like'%status = ''RETRY''%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='claim_franchise_followup_jobs'),'claim requeues expired leases to RETRY');
select ok((select prosrc like'%for update of j skip locked%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='claim_franchise_followup_jobs'),'concurrent workers use skip-locked claims');
select ok((select prosrc like'%terminal then ''DEAD_LETTER'' else ''RETRY''%'and prosrc like'%FranchiseFollowupDeadLetteredV1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='fail_franchise_followup_job'),'fail transitions to RETRY or DEAD_LETTER with terminal Outbox evidence');
select ok((select prosrc like'%franchise.followup.dead_lettered%'and prosrc like'%franchise.followup.retry_scheduled%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='fail_franchise_followup_job'),'fail writes differentiated audit evidence');
select ok(exists(select 1 from pg_constraint where conrelid='public.franchise_followup_jobs'::regclass and contype='c'and pg_get_constraintdef(oid)like'%DEAD_LETTER%'),'job status contract includes DEAD_LETTER terminal state');
select ok(not has_table_privilege('authenticated','public.franchise_followup_jobs','INSERT')and not has_table_privilege('service_role','public.franchise_followup_jobs','UPDATE'),'direct job mutation remains command-only');
select ok(exists(select 1 from pg_indexes where schemaname='public'and indexname='franchise_followup_jobs_claim_idx'),'claim path index bounds pending, retry and leased jobs');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('e3830000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-e383@example.invalid','',now(),'{}','{}',now(),now()),
('e3830000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider-e383@example.invalid','',now(),'{}','{}',now(),now()),
('e3830000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-e383@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('e3830000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into public.organizations(id,legal_name,display_name,status,created_by)values('e3831000-0000-4000-8000-000000000001','Follow-up E383 SARL','Follow-up E383','ACTIVE','e3830000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('e3832000-0000-4000-8000-000000000001','FOLLOWUP_E383','followup-e383','e3831000-0000-4000-8000-000000000001','DRAFT','e3830000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('e3831100-0000-4000-8000-000000000001','e3831000-0000-4000-8000-000000000001','e3830000-0000-4000-8000-000000000001','ACTIVE',now()),
('e3831100-0000-4000-8000-000000000002','e3831000-0000-4000-8000-000000000001','e3830000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values
('e3833000-0000-4000-8000-000000000001','e3832000-0000-4000-8000-000000000001','e3831000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','E383_TERRITORY','ACTIVE','e3830000-0000-4000-8000-000000000001');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('e3831100-0000-4000-8000-000000000001','FRANCHISE_OWNER','e3833000-0000-4000-8000-000000000001'),
('e3831100-0000-4000-8000-000000000002','CLIENT_OWNER',null);
set local session_replication_role=replica;
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)values
('e3833100-0000-4000-8000-000000000001','e3833000-0000-4000-8000-000000000001',1,'E383_TERRITORY','Territoire E383','نطاق E383','{}',now()-interval'1 day',repeat('a',64),'e3830000-0000-4000-8000-000000000001');
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select 'e3833200-0000-4000-8000-000000000001',f.id,'e3833100-0000-4000-8000-000000000001',(select id from public.franchise_economic_rule_versions where franchise_type='STANDARD'order by version desc limit 1),1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('b',64),f.created_by from public.franchises f where f.id='e3833000-0000-4000-8000-000000000001';
update public.franchises set current_mandate_version_id='e3833200-0000-4000-8000-000000000001'where id='e3833000-0000-4000-8000-000000000001';
insert into public.franchise_approval_requests(id,franchise_id,mandate_version_id,request_type,status,change_reason,requested_by,requested_at,decided_at)values
('e3833300-0000-4000-8000-000000000001','e3833000-0000-4000-8000-000000000001','e3833200-0000-4000-8000-000000000001','INITIAL_ACTIVATION','APPROVED','E383 follow-up contract test fixture','e3830000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.franchise_crm_prospects(id,franchise_id,territory_version_id,prospect_type,display_name,contact_email,source_code,pipeline_stage,next_followup_at,owner_user_id,created_by)values
('e3834000-0000-4000-8000-000000000001','e3833000-0000-4000-8000-000000000001','e3833100-0000-4000-8000-000000000001','CLIENT','Prospect E383','prospect-e383@example.invalid','TEST383','SENT',now()-interval'2 hours','e3830000-0000-4000-8000-000000000001','e3830000-0000-4000-8000-000000000001');
insert into public.franchise_followup_policy_versions(id,franchise_id,version,status,eligible_stages,reminder_delays_minutes,retry_delays_minutes,maximum_attempts,maximum_reminders_per_7_days,lease_seconds,effective_from,change_reason,content_hash,proposed_by,approved_by,approved_at)values
('e3835000-0000-4000-8000-000000000001','e3833000-0000-4000-8000-000000000001',1,'ACTIVE',array['SENT','OPENED'],array[0],array[5,15],3,3,120,now()-interval'1 day','Policy E383 contract test fixture',repeat('c',64),'e3830000-0000-4000-8000-000000000001','e3830000-0000-4000-8000-000000000003',now()-interval'1 day');
insert into public.franchise_followup_preference_versions(id,franchise_id,prospect_id,version,contact_allowed,email_allowed,locale,time_zone,quiet_hours_start,quiet_hours_end,maximum_reminders_per_7_days,change_reason,content_hash,created_by)values
('e3835100-0000-4000-8000-000000000001','e3833000-0000-4000-8000-000000000001','e3834000-0000-4000-8000-000000000001',1,true,true,'fr','UTC','03:00','03:01',3,'Preference E383 contract test fixture',repeat('d',64),'e3830000-0000-4000-8000-000000000001');
insert into public.franchise_followup_jobs(id,franchise_id,prospect_id,policy_version_id,preference_version_id,followup_anchor_at,reminder_ordinal,channel,locale,status,next_attempt_at,attempt_count,maximum_attempts_snapshot,retry_delays_minutes_snapshot,lease_seconds_snapshot,locked_by,locked_at,lease_until,correlation_id)values
('e3836000-0000-4000-8000-000000000001','e3833000-0000-4000-8000-000000000001','e3834000-0000-4000-8000-000000000001','e3835000-0000-4000-8000-000000000001','e3835100-0000-4000-8000-000000000001',now()-interval'2 hours',1,'EMAIL','fr','LEASED',now()+interval'1 day',0,3,array[5,15],120,'e3837000-0000-4000-8000-000000000001',now()-interval'2 hours',now()-interval'1 hour','e3838000-0000-4000-8000-000000000001');
insert into public.franchise_followup_jobs(id,franchise_id,prospect_id,policy_version_id,preference_version_id,followup_anchor_at,reminder_ordinal,channel,locale,status,next_attempt_at,attempt_count,maximum_attempts_snapshot,retry_delays_minutes_snapshot,lease_seconds_snapshot,correlation_id)values
('e3836000-0000-4000-8000-000000000002','e3833000-0000-4000-8000-000000000001','e3834000-0000-4000-8000-000000000001','e3835000-0000-4000-8000-000000000001','e3835100-0000-4000-8000-000000000001',now()-interval'3 hours',2,'EMAIL','fr','RETRY',now()+interval'1 day',0,1,array[5],120,'e3838000-0000-4000-8000-000000000002');
set local session_replication_role=origin;

create temporary table e383_observed(k text primary key,v jsonb);
grant select,insert on e383_observed to service_role,authenticated;

select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"e3830000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);select public.schedule_franchise_followups()$$,'42501'::char(5),'permission denied for function schedule_franchise_followups','authenticated cannot schedule follow-up jobs');
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"e3830000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);select public.claim_franchise_followup_jobs('e3837000-0000-4000-8000-000000000099',1)$$,'42501'::char(5),'permission denied for function claim_franchise_followup_jobs','authenticated cannot claim follow-up jobs');
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"e3830000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);select public.complete_franchise_followup_job('e3836000-0000-4000-8000-000000000001','e3837000-0000-4000-8000-000000000001')$$,'42501'::char(5),'permission denied for function complete_franchise_followup_job','authenticated cannot complete follow-up jobs');
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"e3830000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);select public.fail_franchise_followup_job('e3836000-0000-4000-8000-000000000001','e3837000-0000-4000-8000-000000000001','WORKER_TIMEOUT')$$,'42501'::char(5),'permission denied for function fail_franchise_followup_job','authenticated cannot fail follow-up jobs');

insert into e383_observed values('stale_status',to_jsonb((select status from public.franchise_followup_jobs where id='e3836000-0000-4000-8000-000000000001')));
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into e383_observed select'reclaim',to_jsonb((select count(*)from public.claim_franchise_followup_jobs('e3837000-0000-4000-8000-000000000010',10,now())j where j.id='e3836000-0000-4000-8000-000000000001'));
reset role;
insert into e383_observed values('after_stale_reclaim',to_jsonb((select status from public.franchise_followup_jobs where id='e3836000-0000-4000-8000-000000000001')));
update public.franchise_followup_jobs set next_attempt_at=now()-interval'1 minute'where id='e3836000-0000-4000-8000-000000000001';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into e383_observed select'claim_retry',to_jsonb((select row_to_json(j)from public.claim_franchise_followup_jobs('e3837000-0000-4000-8000-000000000010',10,now())j where j.id='e3836000-0000-4000-8000-000000000001'limit 1));
insert into e383_observed select'fail_retry',public.fail_franchise_followup_job('e3836000-0000-4000-8000-000000000001','e3837000-0000-4000-8000-000000000010','PROVIDER_TIMEOUT',now());
reset role;
update public.franchise_followup_jobs set next_attempt_at=now()-interval'1 minute'where id='e3836000-0000-4000-8000-000000000002';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into e383_observed select'claim_terminal',to_jsonb((select row_to_json(j)from public.claim_franchise_followup_jobs('e3837000-0000-4000-8000-000000000010',10,now())j where j.id='e3836000-0000-4000-8000-000000000002'limit 1));
insert into e383_observed select'fail_terminal',public.fail_franchise_followup_job('e3836000-0000-4000-8000-000000000002','e3837000-0000-4000-8000-000000000010','WORKER_TIMEOUT',now());
reset role;
insert into e383_observed values('after_fail_status',to_jsonb((select status from public.franchise_followup_jobs where id='e3836000-0000-4000-8000-000000000001')));
insert into e383_observed values('terminal_status',to_jsonb((select status from public.franchise_followup_jobs where id='e3836000-0000-4000-8000-000000000002')));
insert into e383_observed values('terminal_dead_at',to_jsonb((select dead_lettered_at is not null from public.franchise_followup_jobs where id='e3836000-0000-4000-8000-000000000002')));
insert into e383_observed values('dead_outbox',to_jsonb((select count(*)from public.event_outbox where event_type='FranchiseFollowupDeadLetteredV1'and aggregate_id in('e3836000-0000-4000-8000-000000000001','e3836000-0000-4000-8000-000000000002'))));

select is((select v#>>'{}'from e383_observed where k='stale_status'),'LEASED','stale fixture begins in LEASED state');
select is((select v#>>'{}'from e383_observed where k='after_stale_reclaim'),'RETRY','expired lease is reclaimed to RETRY before a new claim');
select is((select v->>'status'from e383_observed where k='claim_retry'),'LEASED','reclaimed job can be leased again by the worker');
select is((select v->>'outcome'from e383_observed where k='fail_retry'),'FRANCHISE_FOLLOWUP_RETRY_SCHEDULED','recoverable failure schedules a RETRY path');
select is((select v#>>'{}'from e383_observed where k='after_fail_status'),'RETRY','non-terminal failure returns job to RETRY');
select is((select v->>'outcome'from e383_observed where k='fail_terminal'),'FRANCHISE_FOLLOWUP_DEAD_LETTERED','terminal failure dead-letters the job');
select is((select v#>>'{}'from e383_observed where k='terminal_status'),'DEAD_LETTER','single-attempt policy dead-letters on first failure');
select ok((select v::text::boolean from e383_observed where k='terminal_dead_at'),'dead-letter timestamp is persisted');
select ok((select v::text::bigint>=1 from e383_observed where k='dead_outbox'),'terminal failures emit dead-letter Outbox evidence');

select * from finish();
rollback;
