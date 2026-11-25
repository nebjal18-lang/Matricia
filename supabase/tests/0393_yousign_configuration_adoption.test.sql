begin;
set local search_path=public,private,extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a3930000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','adoption-author@example.invalid','',now(),'{}','{}',now(),now()),
('a3930000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','adoption-reviewer@example.invalid','',now(),'{}','{}',now(),now());
select ok(not private.yousign_configuration_adopted_v1('STAGING'),'no activation leaves existing governed configuration available');
insert into private.admin_configuration_revisions_v1(id,environment,section,settings,encrypted_secrets,secret_keys,content_hash,status,created_by)
values('a3931000-0000-4000-8000-000000000001','STAGING','YOUSIGN','{"YOUSIGN_ENVIRONMENT":"sandbox"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'],repeat('a',64),'DRAFT','a3930000-0000-4000-8000-000000000001');
select ok(not private.yousign_configuration_adopted_v1('STAGING'),'a first saved draft does not cut off governed legacy operations');
update private.admin_configuration_revisions_v1 set status='REJECTED',approved_by='a3930000-0000-4000-8000-000000000002',approved_at=clock_timestamp() where id='a3931000-0000-4000-8000-000000000001';
select ok(not private.yousign_configuration_adopted_v1('STAGING'),'a rejected proposal does not activate Admin credential management');
insert into private.admin_configuration_revisions_v1(id,environment,section,settings,encrypted_secrets,secret_keys,content_hash,status,created_by,approved_by,approved_at)
values('a3931000-0000-4000-8000-000000000002','STAGING','YOUSIGN','{"YOUSIGN_ENVIRONMENT":"sandbox"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'],repeat('b',64),'ACTIVE','a3930000-0000-4000-8000-000000000001','a3930000-0000-4000-8000-000000000002',clock_timestamp());
select ok(private.yousign_configuration_adopted_v1('STAGING'),'actual independent activation adopts Admin credential management');
select ok(not private.yousign_configuration_adopted_v1('PRODUCTION'),'adoption stays scoped to the database environment');
update private.admin_configuration_revisions_v1 set status='RETIRED',retired_at=clock_timestamp() where id='a3931000-0000-4000-8000-000000000002';
select ok(private.yousign_configuration_adopted_v1('STAGING'),'deactivation retains historical adoption and cannot enable legacy fallback');
select ok(not has_function_privilege('authenticated','private.yousign_configuration_adopted_v1(text)','EXECUTE') and not has_function_privilege('service_role','private.yousign_configuration_adopted_v1(text)','EXECUTE'),'internal adoption projection has no public credential bypass surface');
select * from finish();
rollback;
