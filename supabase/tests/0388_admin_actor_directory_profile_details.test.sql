begin;
set local search_path=public,extensions;
select plan(6);

select has_function(
 'public','list_admin_actor_directory_v1',
 array['integer','integer','uuid'],
 'admin actor directory helper exists'
);

select ok((
 select pg_get_functiondef(p.oid) like '%preferred_locale%'
  and pg_get_functiondef(p.oid) like '% given_name%'
  and pg_get_functiondef(p.oid) like '% family_name%'
  and pg_get_functiondef(p.oid) like '% phone%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='list_admin_actor_directory_v1'
  and pg_get_function_identity_arguments(p.oid)='p_limit integer, p_offset integer, p_user_id uuid'
),'directory projection exposes phone, locale and person name fields');

update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton;

insert into auth.users(
 id,instance_id,aud,role,email,phone,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
 'a3880000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'profile-admin-388@example.invalid','+212612345678','',now(),'{}',
 jsonb_build_object('given_name','Leila','family_name','Amrani','preferred_locale','fr-MA'),
 now(),now()
), (
 'a3880000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'profile-subject-388@example.invalid','+212698765432','',now(),'{}',
 jsonb_build_object('given_name','Youssef','family_name','Benali','first_name','Ignore','last_name','Ignore'),
 now(),now()
);

insert into public.user_profiles(id,display_name,preferred_locale) values
 ('a3880000-0000-4000-8000-000000000001','Admin profil 388','fr-MA'),
 ('a3880000-0000-4000-8000-000000000002','Sujet profil 388','ar-MA')
on conflict (id) do update set display_name=excluded.display_name, preferred_locale=excluded.preferred_locale;

insert into public.platform_user_roles(user_id,role_code) values
 ('a3880000-0000-4000-8000-000000000001','MATRICIA_ADMIN');

create function pg_temp.profile_actor(i integer) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claim.sub','a3880000-0000-4000-8000-'||lpad(i::text,12,'0'),true);
 perform set_config(
  'request.jwt.claims',
  jsonb_build_object('sub','a3880000-0000-4000-8000-'||lpad(i::text,12,'0'),'role','authenticated','aal','aal2')::text,
  true
 );
end$$;

set local role authenticated;
select pg_temp.profile_actor(1);
create temporary table profile_dir(v jsonb);
insert into profile_dir values (public.list_admin_actor_directory_v1(500,0,'a3880000-0000-4000-8000-000000000002'));

select is((select v#>>'{rows,0,given_name}' from profile_dir),'Youssef','directory returns Auth given_name');
select is((select v#>>'{rows,0,family_name}' from profile_dir),'Benali','directory returns Auth family_name');
select is((select v#>>'{rows,0,phone}' from profile_dir),'+212698765432','directory returns Auth phone');
select is((select v#>>'{rows,0,preferred_locale}' from profile_dir),'ar-MA','directory returns profile preferred_locale');

select * from finish();
rollback;
