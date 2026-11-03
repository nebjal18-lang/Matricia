begin;
set local search_path=public,extensions;
select plan(22);

select ok(exists(select 1 from pg_indexes where schemaname='public'and indexname='franchise_digest_config_scheduler_cover_idx'and indexdef like'%franchise_id, recipient_user_id, version DESC%'and indexdef like'%INCLUDE%'),'scheduler has a covering latest-config index');
select ok((select p.prosrc like'%not exists(select 1 from public.franchise_daily_digest_config_versions newer%'and p.prosrc like'%newer.version>v.version%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'only the latest config version is eligible');
select ok((select strpos(p.prosrc,'franchise_digest_role_access(v.franchise_id,false,v.recipient_user_id)')<strpos(p.prosrc,'order by v.franchise_id,v.recipient_user_id')and strpos(p.prosrc,'order by v.franchise_id,v.recipient_user_id')<strpos(p.prosrc,'limit p_limit')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'invalid scopes are filtered before deterministic ordering and limit');
select ok((select p.prosrc like'%not exists(%prior_digest%prior_job%'and p.prosrc like'%prior_digest.digest_date=timezone(v.time_zone,p_now)::date%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'already scheduled recipient-days are excluded before limiting');
select ok((select p.prosrc not like'%exit when p_limit<=0%'and p.prosrc not like'%p_limit:=p_limit-1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'loop cardinality is bounded by candidate selection rather than created rows');
select ok((select p.prosrc like'%v.enabled%'and p.prosrc like'%timezone(v.time_zone,p_now)::time>=v.local_send_time%'and p.prosrc like'%WEEKDAYS%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'disabled and not-yet-due configs are filtered before work');
select ok((select p.prosrc like'%p_limit not between 1 and 500%'and p.prosrc like'%limit p_limit%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'validated p_limit bounds total selected candidates');
select ok((select p.prosrc like'%franchise.daily_digest.scheduled%'and p.prosrc like'%FranchiseDailyDigestScheduledV1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'bounded scheduler preserves audit and Outbox evidence');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a9200000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-92@example.invalid','',now(),'{}','{}',now(),now()),
('a9200000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','valid-1-92@example.invalid','',now(),'{}','{}',now(),now()),
('a9200000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','valid-2-92@example.invalid','',now(),'{}','{}',now(),now()),
('a9200000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','valid-3-92@example.invalid','',now(),'{}','{}',now(),now()),
('a9200000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','invalid-f2-92@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b9200000-0000-4000-8000-000000000001','Scheduler Volume P92 SARL','Scheduler Volume P92','ACTIVE','a9200000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f9200000-0000-4000-8000-000000000010','FRANCHISE_SCHEDULER','franchise-scheduler','b9200000-0000-4000-8000-000000000001','DRAFT','a9200000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)select ('c9200000-0000-4000-8000-00000000000'||n)::uuid,'b9200000-0000-4000-8000-000000000001',('a9200000-0000-4000-8000-00000000000'||n)::uuid,'ACTIVE',now()from generate_series(1,5)n;
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values
('00000000-0000-4000-8000-000000000092','f9200000-0000-4000-8000-000000000010','b9200000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P92_F1','ACTIVE','a9200000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000093','f9200000-0000-4000-8000-000000000010','b9200000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P92_F2','ACTIVE','a9200000-0000-4000-8000-000000000001');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('c9200000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','00000000-0000-4000-8000-000000000092'),
('c9200000-0000-4000-8000-000000000002','FRANCHISE_VIEWER','00000000-0000-4000-8000-000000000092'),
('c9200000-0000-4000-8000-000000000003','FRANCHISE_VIEWER','00000000-0000-4000-8000-000000000092'),
('c9200000-0000-4000-8000-000000000004','FRANCHISE_VIEWER','00000000-0000-4000-8000-000000000092'),
('c9200000-0000-4000-8000-000000000005','FRANCHISE_VIEWER','00000000-0000-4000-8000-000000000093');


-- The dedicated role now authorizes a real active, dated mandate, not a status-only franchise fixture.
set local session_replication_role=replica;
do $fixture$declare f record;t uuid;m uuid;rule uuid;begin
 select id into rule from public.franchise_economic_rule_versions where franchise_type='STANDARD'order by version desc limit 1;
 for f in select *from public.franchises where id in('00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000093')loop
  t:=extensions.gen_random_uuid();m:=extensions.gen_random_uuid();
  insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)values(t,f.id,1,f.territory_code,'Territoire de recette','نطاق الاختبار','{}',now()-interval'1 day',repeat('a',64),f.created_by);
  insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
  values(m,f.id,t,rule,1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('b',64),f.created_by);
  update public.franchises set current_mandate_version_id=m where id=f.id;
 end loop;
end$fixture$;
set local session_replication_role=origin;
insert into public.franchise_daily_digest_config_versions(franchise_id,recipient_user_id,version,policy_version_id,enabled,frequency,local_send_time,time_zone,locale,change_reason,content_hash,created_by)
select'00000000-0000-4000-8000-000000000092','a9200000-0000-4000-8000-000000000002',n,(select id from public.franchise_daily_digest_policy_versions where status='ACTIVE'),n=50,'DAILY','00:00','UTC','fr-MA','Historique volume version '||n,md5(n::text)||md5(n::text),'a9200000-0000-4000-8000-000000000001'from generate_series(1,50)n;
insert into public.franchise_daily_digest_config_versions(franchise_id,recipient_user_id,version,policy_version_id,enabled,frequency,local_send_time,time_zone,locale,change_reason,content_hash,created_by)values
('00000000-0000-4000-8000-000000000092','a9200000-0000-4000-8000-000000000003',1,(select id from public.franchise_daily_digest_policy_versions where status='ACTIVE'),true,'DAILY','00:00','UTC','fr-MA','Valid recipient two',repeat('2',64),'a9200000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000092','a9200000-0000-4000-8000-000000000004',1,(select id from public.franchise_daily_digest_policy_versions where status='ACTIVE'),true,'DAILY','00:00','UTC','fr-MA','Valid recipient three',repeat('3',64),'a9200000-0000-4000-8000-000000000001');
alter table public.franchise_daily_digest_config_versions disable trigger franchise_digest_config_scope_guard;
insert into public.franchise_daily_digest_config_versions(franchise_id,recipient_user_id,version,policy_version_id,enabled,frequency,local_send_time,time_zone,locale,change_reason,content_hash,created_by)values('00000000-0000-4000-8000-000000000092','a9200000-0000-4000-8000-000000000005',1,(select id from public.franchise_daily_digest_policy_versions where status='ACTIVE'),true,'DAILY','00:00','UTC','ar-MA','Invalid F2 scope historical row',repeat('9',64),'a9200000-0000-4000-8000-000000000001');
alter table public.franchise_daily_digest_config_versions enable trigger franchise_digest_config_scope_guard;

select is((select count(*)from public.franchise_daily_digest_config_versions where franchise_id='00000000-0000-4000-8000-000000000092'),53::bigint,'volume fixture contains fifty historical and three other configs');
select is((select max(version)from public.franchise_daily_digest_config_versions where recipient_user_id='a9200000-0000-4000-8000-000000000002'),50,'latest version is deterministic after deep history');
create temporary table p92_observed(batch integer,job_id uuid,digest_id uuid);
grant select,insert on p92_observed to service_role;
set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
insert into p92_observed select 1,(v->>'job_id')::uuid,(v->>'digest_id')::uuid from public.schedule_franchise_daily_digests('2026-09-14 12:00+00',2)v;
reset role;
select is((select count(*)from p92_observed where batch=1),2::bigint,'first batch performs at most p_limit two iterations');
select is((select count(*)from public.franchise_daily_digest_jobs where franchise_id='00000000-0000-4000-8000-000000000092'),2::bigint,'first batch creates exactly two valid jobs');
select ok((select bool_and(recipient_user_id in('a9200000-0000-4000-8000-000000000002','a9200000-0000-4000-8000-000000000003'))from public.franchise_daily_digest_jobs where franchise_id='00000000-0000-4000-8000-000000000092'),'deterministic order selects the first two valid recipients');
select is((select count(*)from public.franchise_daily_digest_jobs where recipient_user_id='a9200000-0000-4000-8000-000000000005'),0::bigint,'invalid earlier scope cannot consume a batch slot');

set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
insert into p92_observed select 2,(v->>'job_id')::uuid,(v->>'digest_id')::uuid from public.schedule_franchise_daily_digests('2026-09-14 12:00+00',2)v;
reset role;
select is((select count(*)from p92_observed where batch=2),1::bigint,'second batch advances past already scheduled recipients');
select is((select count(*)from public.franchise_daily_digest_jobs where franchise_id='00000000-0000-4000-8000-000000000092'),3::bigint,'all valid recipients complete across bounded batches without starvation');
select is((select count(*)from public.franchise_daily_digest_jobs where config_version_id in(select id from public.franchise_daily_digest_config_versions where recipient_user_id='a9200000-0000-4000-8000-000000000002')),1::bigint,'deep history produces one job from the latest config only');
select is((select version from public.franchise_daily_digest_config_versions where id=(select config_version_id from public.franchise_daily_digest_jobs where recipient_user_id='a9200000-0000-4000-8000-000000000002')),50,'scheduled job freezes latest config version fifty');
select is((select count(*)from public.audit_events where action='franchise.daily_digest.scheduled'and metadata->>'franchise_id'='00000000-0000-4000-8000-000000000092'),3::bigint,'three valid jobs write three audit proofs');
select is((select count(*)from public.event_outbox where event_type='FranchiseDailyDigestScheduledV1'and payload->>'franchise_id'='00000000-0000-4000-8000-000000000092'),3::bigint,'three valid jobs write three Outbox events');
select is((select count(*)from public.audit_events where action='franchise.daily_digest.scheduled'and metadata->>'recipient_user_id'='a9200000-0000-4000-8000-000000000005'),0::bigint,'invalid scope writes no scheduling evidence');
select ok((select count(*)<=2 from p92_observed where batch=1)and(select count(*)<=2 from p92_observed where batch=2),'every runtime invocation stays within its iteration budget');

select * from finish();
rollback;
