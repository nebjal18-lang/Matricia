begin;
set local search_path=public,extensions;
select plan(2);
select ok(to_regclass('private.client_subscription_quota_serializers_v1') is not null, 'quota serializers exist for onboarding capacity locks');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a3810000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quota381@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3810000-0000-4000-8000-000000000001','Quota 381','Quota 381','PENDING','a3810000-0000-4000-8000-000000000001');
select lives_ok($$select private.assert_subscription_resource_capacity_v1('b3810000-0000-4000-8000-000000000001','USERS',0,1)$$,'creating the first owner does not require an activated trial');
select * from finish();
rollback;
