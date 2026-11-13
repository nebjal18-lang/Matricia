begin;
-- ORG-002 person fields on the durable profile (not only Auth metadata).
alter table public.user_profiles
  add column if not exists given_name text,
  add column if not exists family_name text,
  add column if not exists phone text;

alter table public.user_profiles drop constraint if exists user_profiles_given_name_len;
alter table public.user_profiles drop constraint if exists user_profiles_family_name_len;
alter table public.user_profiles drop constraint if exists user_profiles_phone_len;
alter table public.user_profiles
  add constraint user_profiles_given_name_len check (given_name is null or length(trim(given_name)) between 1 and 80),
  add constraint user_profiles_family_name_len check (family_name is null or length(trim(family_name)) between 1 and 80),
  add constraint user_profiles_phone_len check (phone is null or length(trim(phone)) between 6 and 32);

-- Directory projection: prefer profile ORG-002 fields; expose membership role scopes.
create or replace function public.list_admin_actor_directory_v1(
 p_limit integer default 100,p_offset integer default 0,p_user_id uuid default null
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare result jsonb;total bigint;
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2'
 or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR']) then
  raise exception 'ADMIN_ACTOR_DIRECTORY_DENIED' using errcode='42501';
 end if;
 if p_limit is null or p_limit not between 1 and 500 or p_offset is null or p_offset<0 then
  raise exception 'INVALID_ADMIN_DIRECTORY_PAGE' using errcode='22023';
 end if;
 select count(*) into total from auth.users u
 left join public.organization_memberships m on m.user_id=u.id
 where p_user_id is null or u.id=p_user_id;
 select coalesce(jsonb_agg(to_jsonb(item) order by item.user_id,item.membership_id nulls first),'[]') into result from (
  select u.id user_id,m.id membership_id,m.organization_id,o.display_name organization_name,
   coalesce(nullif(btrim(concat_ws(' ',p.given_name,p.family_name)),''),p.display_name) display_name,
   u.email,
   coalesce(nullif(btrim(p.phone),''),nullif(btrim(u.phone),'')) phone,
   p.preferred_locale,
   coalesce(nullif(btrim(p.given_name),''),nullif(btrim(coalesce(u.raw_user_meta_data->>'given_name',u.raw_user_meta_data->>'first_name','')),'')) given_name,
   coalesce(nullif(btrim(p.family_name),''),nullif(btrim(coalesce(u.raw_user_meta_data->>'family_name',u.raw_user_meta_data->>'last_name','')),'')) family_name,
   case when u.deleted_at is not null then 'DELETED'
    when u.banned_until>statement_timestamp() then 'SUSPENDED'
    when u.email_confirmed_at is null and u.phone_confirmed_at is null then 'PENDING_CONFIRMATION'
    else 'ACTIVE' end account_status,
   coalesce(m.status,case when u.deleted_at is not null then 'DELETED'
    when u.banned_until>statement_timestamp() then 'SUSPENDED'
    when u.email_confirmed_at is null and u.phone_confirmed_at is null then 'PENDING_CONFIRMATION'
    else 'ACTIVE' end) status,
   coalesce(m.updated_at,u.updated_at) updated_at,u.last_sign_in_at,
   coalesce((select array_agg(r.role_code order by r.role_code) from public.organization_member_roles r
    where r.membership_id=m.id and r.revoked_at is null),'{}') roles,
   coalesce((select array_agg(distinct r.library_id::text order by r.library_id::text)
    from public.organization_member_roles r where r.membership_id=m.id and r.revoked_at is null and r.library_id is not null),'{}') library_scopes,
   coalesce((select array_agg(distinct r.franchise_id::text order by r.franchise_id::text)
    from public.organization_member_roles r where r.membership_id=m.id and r.revoked_at is null and r.franchise_id is not null),'{}') franchise_scopes,
   coalesce((select array_agg(r.role_code order by r.role_code) from public.platform_user_roles r
    where r.user_id=u.id and r.revoked_at is null),'{}') platform_roles,
   case when exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified')
    then 'ENABLED' else 'DISABLED' end mfa_status,
   (select count(*)::integer from auth.sessions s where s.user_id=u.id) session_count
  from auth.users u left join public.user_profiles p on p.id=u.id
  left join public.organization_memberships m on m.user_id=u.id
  left join public.organizations o on o.id=m.organization_id
  where p_user_id is null or u.id=p_user_id
  order by u.id,m.id nulls first limit p_limit offset p_offset
 ) item;
 return jsonb_build_object('rows',result,'total',total);
end $$;
revoke all on function public.list_admin_actor_directory_v1(integer,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_admin_actor_directory_v1(integer,integer,uuid) to authenticated;

-- DEVELOPMENT/STAGING only: reshape known lab personas into ORG-002 person identities.
create or replace function private.repair_org002_demo_personas_v1()
returns integer language plpgsql security definer
set search_path=pg_catalog,public,private,auth as $$
declare env text; repaired integer := 0; touched integer := 0; rec record;
begin
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null or env not in ('DEVELOPMENT','STAGING') then
  raise exception 'ORG002_PERSONA_REPAIR_ENVIRONMENT_DENIED' using errcode='42501';
 end if;
 for rec in
  select * from (values
   ('%+matricia-franchise@%', 'Karim', 'Benjelloun', '+212612000001', 'fr-MA'),
   ('%+matricia-client@%', 'Sara', 'Kadiri', '+212612000002', 'fr-MA'),
   ('%+matricia-prestataire@%', 'Youssef', 'Amrani', '+212612000003', 'fr-MA'),
   ('parcours.franchise@%', 'Hatim', 'Ahmitech', '+212612000004', 'fr-MA'),
   ('parcours.client@%', 'Leila', 'Tazi', '+212612000005', 'fr-MA'),
   ('parcours.prestataire@%', 'Omar', 'Chraibi', '+212612000006', 'fr-MA'),
   ('epitaphemarket@gmail.com', 'Asma', 'Matricia', '+212612000007', 'fr-MA'),
   ('demo.admin@%', 'Nadia', 'El Fassi', '+212612000008', 'fr-MA'),
   ('demo.client@%', 'Imane', 'Bennani', '+212612000009', 'fr-MA'),
   ('demo.prestataire@%', 'Rachid', 'Alaoui', '+212612000010', 'fr-MA'),
   ('demo.franchise@%', 'Jalil', 'NEOXA', '+212612000011', 'fr-MA'),
   ('client.validation@%', 'Sara', 'Kadiri', '+212612000012', 'fr-MA')
  ) as map(email_pattern, given_name, family_name, phone, preferred_locale)
 loop
  update public.user_profiles p
  set given_name = rec.given_name,
      family_name = rec.family_name,
      phone = rec.phone,
      preferred_locale = rec.preferred_locale,
      display_name = rec.given_name || ' ' || rec.family_name,
      updated_at = clock_timestamp(),
      row_version = p.row_version + 1
  from auth.users u
  where p.id = u.id and lower(u.email) like lower(rec.email_pattern);
  get diagnostics touched = row_count;
  repaired := repaired + touched;

  update auth.users u
  set phone = coalesce(nullif(btrim(u.phone), ''), rec.phone),
      raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'given_name', rec.given_name,
          'family_name', rec.family_name,
          'preferred_locale', rec.preferred_locale
        ),
      updated_at = clock_timestamp()
  where lower(u.email) like lower(rec.email_pattern);
 end loop;

 update public.organizations o
 set
  legal_name = case lower(o.display_name)
   when 'validation franchise' then 'Atlas Franchise Conseil SARL'
   when 'validation client' then 'Atlas Client Services SARL'
   when 'validation prestataire' then 'Atlas Prestataire Pro SARL'
   when 'client parcours it' then 'Parcours IT Client SARL'
   when 'prestataire parcours it' then 'Parcours IT Prestataire SARL'
   when 'franchise parcours it' then 'Parcours IT Franchise SARL'
   else o.legal_name
  end,
  display_name = case lower(o.display_name)
   when 'validation franchise' then 'Atlas Franchise Conseil'
   when 'validation client' then 'Atlas Client Services'
   when 'validation prestataire' then 'Atlas Prestataire Pro'
   when 'client parcours it' then 'Parcours IT Client'
   when 'prestataire parcours it' then 'Parcours IT Prestataire'
   when 'franchise parcours it' then 'Parcours IT Franchise'
   else o.display_name
  end,
  updated_at = clock_timestamp(),
  row_version = o.row_version + 1
 where lower(o.display_name) in (
  'validation franchise','validation client','validation prestataire',
  'client parcours it','prestataire parcours it','franchise parcours it'
 );

 return repaired;
end $$;
revoke all on function private.repair_org002_demo_personas_v1() from public,anon,authenticated,service_role;

do $$
declare env text;
begin
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env in ('DEVELOPMENT','STAGING') then
  perform private.repair_org002_demo_personas_v1();
 end if;
end $$;

notify pgrst,'reload schema';
commit;
