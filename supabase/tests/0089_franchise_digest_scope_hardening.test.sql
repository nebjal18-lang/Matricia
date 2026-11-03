begin;
set local search_path=public,extensions;
select plan(26);

select ok(not private.franchise_digest_role_access(null,false,null),'anonymous caller cannot inherit a franchise role');
select ok(not private.franchise_digest_role_access(extensions.gen_random_uuid(),false,extensions.gen_random_uuid()),'unknown actor cannot inherit an unscoped franchise role');
select ok((select p.prosecdef and p.proconfig::text like'%search_path=%'and p.prosrc like'%new.created_by%'and p.prosrc like'%new.recipient_user_id%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='guard_franchise_digest_config_scope'),'configuration guard validates actor and recipient scopes');
select ok(exists(select 1 from pg_trigger where tgname='franchise_digest_config_scope_guard'and not tgisinternal),'configuration scope guard is installed');
select ok((select p.prosrc like'%franchise_digest_role_access(v.franchise_id,false,v.recipient_user_id)%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'scheduler filters invalid recipients before processing');
select ok((select p.prosrc like'%for c in%'and p.prosrc like'%return next%'and p.prosrc like'%order by v.franchise_id,v.recipient_user_id%limit p_limit%'and strpos(p.prosrc,'franchise_digest_role_access(v.franchise_id,false,v.recipient_user_id)')<strpos(p.prosrc,'limit p_limit')and p.prosrc not like'%p_limit:=p_limit-1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'scheduler filters invalid configs then bounds deterministic iterations before continuing the batch');
select ok((select p.prosrc like'%franchise.daily_digest.scheduled%'and p.prosrc like'%FranchiseDailyDigestScheduledV1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='schedule_franchise_daily_digests'),'valid scheduling remains audited and outboxed');
select ok(not has_function_privilege('anon','private.franchise_digest_role_access(uuid,boolean,uuid)','EXECUTE')and has_function_privilege('authenticated','private.franchise_digest_role_access(uuid,boolean,uuid)','EXECUTE'),'RLS helper ACL remains authenticated-only');
select ok((select p.prosrc like'%command_scope constant text:=''franchise.daily_digest.configure''%'and p.prosrc like'%begin_contract_command(org,command_scope%'and p.prosrc like'%finish_contract_command(org,command_scope%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='configure_franchise_daily_digest'),'configuration uses one bounded lowercase idempotency operation scope');

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


-- The dedicated role now authorizes a real active, dated mandate, not a status-only franchise fixture.
set local session_replication_role=replica;
do $fixture$declare f record;t uuid;m uuid;rule uuid;begin
 select id into rule from public.franchise_economic_rule_versions where franchise_type='STANDARD'order by version desc limit 1;
 for f in select *from public.franchises where id in('d8900000-0000-4000-8000-000000000001','d8900000-0000-4000-8000-000000000002')loop
  t:=extensions.gen_random_uuid();m:=extensions.gen_random_uuid();
  insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)values(t,f.id,1,f.territory_code,'Territoire de recette','نطاق الاختبار','{}',now()-interval'1 day',repeat('a',64),f.created_by);
  insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
  values(m,f.id,t,rule,1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('b',64),f.created_by);
  update public.franchises set current_mandate_version_id=m where id=f.id;
 end loop;
end$fixture$;
set local session_replication_role=origin;
select ok(private.franchise_digest_role_access('d8900000-0000-4000-8000-000000000001',false,'a8900000-0000-4000-8000-000000000001'),'ALLOW: F1 manager has exact F1 scope');
select ok(not private.franchise_digest_role_access('d8900000-0000-4000-8000-000000000001',false,'a8900000-0000-4000-8000-000000000003'),'DENY: F2 manager cannot access F1 in the same organization');
select ok(not private.franchise_digest_role_access('d8900000-0000-4000-8000-000000000001',false,'a8900000-0000-4000-8000-000000000005'),'DENY: NULL-scoped role is not global in a multi-franchise organization');
select ok(private.franchise_digest_role_access('d8900000-0000-4000-8000-000000000001',true,'a8900000-0000-4000-8000-000000000006'),'ALLOW: authorized platform admin retains supervised read scope');

select throws_ok($sql$set local role authenticated;select set_config('request.jwt.claim.sub','a8900000-0000-4000-8000-000000000003',true);select public.configure_franchise_daily_digest('d8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000002',true,'DAILY','08:00','UTC','fr-MA','Tentative manager F2 vers F1','p89-deny-actor')$sql$,'42501'::char(5),'FRANCHISE_DIGEST_CONFIG_DENIED','DENY: F2 manager cannot configure F1');
select throws_ok($sql$set local role authenticated;select set_config('request.jwt.claim.sub','a8900000-0000-4000-8000-000000000001',true);select public.configure_franchise_daily_digest('d8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000004',true,'DAILY','08:00','UTC','fr-MA','Tentative destinataire F2','p89-deny-recipient')$sql$,'42501'::char(5),'FRANCHISE_DIGEST_CONFIG_RECIPIENT_SCOPE_DENIED','DENY: F1 manager cannot target F2 recipient');

create temporary table p89_observed(key text primary key,value jsonb);
grant select,insert on p89_observed to authenticated,service_role;
set local role authenticated;select set_config('request.jwt.claim.sub','a8900000-0000-4000-8000-000000000001',true);
insert into p89_observed values('configured',public.configure_franchise_daily_digest('d8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000002',true,'DAILY','00:00','UTC','fr-MA','Configuration F1 autorisée','p89-allow-config'));
insert into p89_observed values('configured_replay',public.configure_franchise_daily_digest('d8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000002',true,'DAILY','00:00','UTC','fr-MA','Configuration F1 autorisée','p89-allow-config'));
reset role;
select is((select value->>'outcome'from p89_observed where key='configured'),'FRANCHISE_DAILY_DIGEST_CONFIGURED','ALLOW: F1 manager configures an F1 recipient');
select is((select value->>'config_version_id'from p89_observed where key='configured_replay'),(select value->>'config_version_id'from p89_observed where key='configured'),'same key and request replay the immutable configuration result');
select throws_ok($sql$set local role authenticated;select set_config('request.jwt.claim.sub','a8900000-0000-4000-8000-000000000001',true);select public.configure_franchise_daily_digest('d8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000002',true,'DAILY','09:00','UTC','fr-MA','Configuration F1 autorisée','p89-allow-config')$sql$,'22000'::char(5),'IDEMPOTENCY_PAYLOAD_MISMATCH','same key with different request remains rejected');
select is((select count(*)from public.franchise_daily_digest_config_versions where franchise_id='d8900000-0000-4000-8000-000000000001'),1::bigint,'denied configurations leave no partial history');

alter table public.franchise_daily_digest_config_versions disable trigger franchise_digest_config_scope_guard;
insert into public.franchise_daily_digest_config_versions(id,franchise_id,recipient_user_id,version,policy_version_id,enabled,frequency,local_send_time,time_zone,locale,change_reason,content_hash,created_by)
values('e8900000-0000-4000-8000-000000000099','d8900000-0000-4000-8000-000000000001','a8900000-0000-4000-8000-000000000004',1,(select id from public.franchise_daily_digest_policy_versions where status='ACTIVE'),true,'DAILY','00:00','UTC','ar-MA','Fixture historique invalide P89',repeat('9',64),'a8900000-0000-4000-8000-000000000001');
alter table public.franchise_daily_digest_config_versions enable trigger franchise_digest_config_scope_guard;

set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
insert into p89_observed select'scheduled:'||(v->>'job_id'),v from public.schedule_franchise_daily_digests(clock_timestamp(),100)v;
reset role;
select is((select count(*)from p89_observed o join public.franchise_daily_digest_jobs j on j.id=(o.value->>'job_id')::uuid where o.key like'scheduled:%'and j.franchise_id='d8900000-0000-4000-8000-000000000001'and j.recipient_user_id='a8900000-0000-4000-8000-000000000002'),1::bigint,'scheduler continues and returns the valid F1 configuration');
select is((select count(*)from public.franchise_daily_digest_jobs where franchise_id='d8900000-0000-4000-8000-000000000001'and recipient_user_id='a8900000-0000-4000-8000-000000000002'),1::bigint,'scheduler creates the correctly scoped recipient job');
select is((select count(*)from public.franchise_daily_digest_jobs where franchise_id='d8900000-0000-4000-8000-000000000001'and recipient_user_id='a8900000-0000-4000-8000-000000000004'),0::bigint,'scheduler isolates invalid F2 recipient without aborting the valid batch');

set local role authenticated;select set_config('request.jwt.claim.sub','a8900000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claim.role','authenticated',true);
insert into p89_observed values('f2_visible',to_jsonb((select count(*)from public.franchise_daily_digests where franchise_id='d8900000-0000-4000-8000-000000000001')));
reset role;
select is(((select value#>>'{}'from p89_observed where key='f2_visible')::bigint),0::bigint,'RLS denies same-organization F2 manager reading F1 digest');
select is((select count(*)from public.audit_events where action='franchise.daily_digest.scheduled'and metadata->>'franchise_id'='d8900000-0000-4000-8000-000000000001'),1::bigint,'valid F1 scheduling writes one audit proof');
select is((select count(*)from public.event_outbox where event_type='FranchiseDailyDigestScheduledV1'and payload->>'franchise_id'='d8900000-0000-4000-8000-000000000001'),1::bigint,'valid F1 scheduling writes one Outbox event');
select ok(not exists(select 1 from public.audit_events where action='franchise.daily_digest.scheduled'and metadata->>'recipient_user_id'='a8900000-0000-4000-8000-000000000004'),'invalid scoped configuration produces no scheduling evidence');

select * from finish();
rollback;
