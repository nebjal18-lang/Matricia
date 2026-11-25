begin;
-- Logic bugfixes: published library labels, tighter persona repair.

create or replace function public.get_admin_territoires_queue_snapshot_v1(p_locale text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  rows jsonb;
begin
  if auth.uid() is null
    or auth.jwt()->>'aal' is distinct from 'aal2'
    or p_locale is null
    or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('territoires')
  then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into rows
  from (
    select jsonb_build_object(
      'id', v.id,
      'title', operator_label || ' · ' || territory_label,
      'status', v.mandate_status,
      'organizationId', f.operator_organization_id,
      'cells', jsonb_build_array(
        operator_label || ' · ' || territory_label,
        territory_label,
        library_label,
        'v' || v.version,
        v.effective_from::date::text,
        coalesce(v.effective_until::date::text, '—'),
        v.mandate_status
      ),
      'extras', jsonb_build_object(
        'franchiseId', f.id::text,
        'type', f.franchise_type,
        'libraryCode', l.code,
        'territoryCode', f.territory_code
      )
    ) item
    from public.franchises f
    join public.catalog_libraries l on l.id = f.library_id
    left join public.catalog_library_versions lv on lv.id = l.current_published_version_id
    join public.franchise_mandate_versions v on v.franchise_id = f.id
    left join public.franchise_territory_versions tv on tv.id = v.territory_version_id
    cross join lateral (
      select
        case f.operator_code
          when 'HATIM_AHMITECH' then 'Hatim Ahmitech'
          when 'FRANCHISEE' then case when p_locale = 'ar' then 'صاحب امتياز' else 'Franchisé' end
          when 'NEOXA_JALIL' then 'Jalil · NEOXA'
          when 'ASMA_MATRICIA' then 'Asma · Matricia'
          else initcap(replace(regexp_replace(f.operator_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' '))
        end as operator_label,
        coalesce(
          nullif(case when p_locale = 'ar' then tv.name_ar else tv.name_fr end, ''),
          nullif(initcap(replace(regexp_replace(f.territory_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' ')), ''),
          f.territory_code
        ) as territory_label,
        coalesce(
          nullif(case when p_locale = 'ar' then lv.name_ar else lv.name_fr end, ''),
          l.code
        ) as library_label
    ) labels
    order by v.created_at desc, v.id
    limit 20001
  ) page;

  if jsonb_array_length(rows) > 20000 or octet_length(rows::text) > 16777216 then
    raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000';
  end if;

  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end;
$$;

create or replace function public.get_admin_franchises_queue_snapshot_v1(p_locale text) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public, private as $$
declare rows jsonb;
begin
  if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or p_locale is null or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('franchises') then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(item), '[]'::jsonb) into rows from (
    select jsonb_build_object(
      'id', f.id,
      'title', operator_label || ' · ' || territory_label,
      'status', f.status,
      'organizationId', f.operator_organization_id,
      'cells', jsonb_build_array(
        operator_label || ' · ' || territory_label,
        library_label,
        territory_label,
        coalesce('v' || v.version, '—'),
        coalesce(v.mandate_status, '—'),
        case when f.franchise_type = 'IT' then 'IT' when p_locale = 'ar' then 'قياسي' else 'Standard' end,
        case when f.status = 'ACTIVE' then '—' when p_locale = 'ar' then 'متابعة مطلوبة' else 'Suivi requis' end,
        f.status
      ),
      'extras', jsonb_build_object('mandateId', coalesce(v.id::text, ''), 'type', f.franchise_type)
    ) item
    from public.franchises f
    join public.catalog_libraries l on l.id = f.library_id
    left join public.catalog_library_versions lv on lv.id = l.current_published_version_id
    left join public.franchise_mandate_versions v on v.id = f.current_mandate_version_id
    left join public.franchise_territory_versions tv on tv.id = v.territory_version_id
    cross join lateral (
      select
        case f.operator_code
          when 'HATIM_AHMITECH' then 'Hatim Ahmitech'
          when 'FRANCHISEE' then case when p_locale = 'ar' then 'صاحب امتياز' else 'Franchisé' end
          else initcap(replace(regexp_replace(f.operator_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' '))
        end as operator_label,
        coalesce(
          nullif(case when p_locale = 'ar' then tv.name_ar else tv.name_fr end, ''),
          nullif(initcap(replace(regexp_replace(f.territory_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' ')), ''),
          f.territory_code
        ) as territory_label,
        coalesce(nullif(case when p_locale = 'ar' then lv.name_ar else lv.name_fr end, ''), l.code) as library_label
    ) labels
    order by f.created_at desc, f.id
    limit 20001
  ) page;
  if jsonb_array_length(rows) > 20000 or octet_length(rows::text) > 16777216 then
    raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000';
  end if;
  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end$$;

-- Prefer published library names in franchise governance dashboard projection.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.franchise_governance_dashboard_snapshot(uuid)'::regprocedure);
  if position('''catalog_libraries'',''x.id,x.code''' in definition) = 0
    and position('''catalog_libraries'',''x.id,x.code,x.current_published_version_id''' in definition) = 0 then
    raise exception 'FRANCHISE_DASHBOARD_LIBRARIES_SPEC_CHANGED';
  end if;
  definition := replace(definition,
    '''catalog_libraries'',''x.id,x.code''',
    '''catalog_libraries'',''x.id,x.code,x.current_published_version_id''');
  definition := replace(definition,
    '''catalog_library_versions'',''x.id,x.library_id,x.name_fr,x.name_ar'',''lvs'',''($1 is null or x.library_id=(select library_id from public.franchises where id=$1))'',''x.version desc,x.id''',
    '''catalog_library_versions'',''x.id,x.library_id,x.name_fr,x.name_ar,x.version,x.status'',''lvs'',''($1 is null or x.library_id=(select library_id from public.franchises where id=$1))'',''case when x.status=''''PUBLISHED'''' then 0 else 1 end, x.version desc, x.id''');
  execute definition;
end $$;

create or replace function private.repair_org002_demo_personas_v1()
returns integer language plpgsql security definer
set search_path=pg_catalog,public,private,auth as $$
declare env text; repaired integer := 0; touched integer := 0; rec record;
begin
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null or env not in ('DEVELOPMENT','STAGING') then
  raise exception 'ORG002_PERSONA_REPAIR_ENVIRONMENT_DENIED' using errcode='42501';
 end if;

 update auth.users u
 set email = 'hatim.ahmitech@matricia.test',
     updated_at = clock_timestamp()
 where lower(u.email) like 'parcours.franchise@%'
   and not exists (
     select 1 from auth.users other
     where lower(other.email) = 'hatim.ahmitech@matricia.test'
       and other.id <> u.id
   );
 get diagnostics touched = row_count;
 repaired := repaired + touched;

 for rec in
  select * from (values
   ('%+matricia-franchise@matricia.test', 'Karim', 'Benjelloun', '+212612000001', 'fr-MA'),
   ('%+matricia-client@matricia.test', 'Sara', 'Kadiri', '+212612000002', 'fr-MA'),
   ('%+matricia-prestataire@matricia.test', 'Youssef', 'Amrani', '+212612000003', 'fr-MA'),
   ('parcours.franchise@matricia.test', 'Hatim', 'Ahmitech', '+212612000004', 'fr-MA'),
   ('hatim.ahmitech@matricia.test', 'Hatim', 'Ahmitech', '+212612000004', 'fr-MA'),
   ('parcours.client@matricia.test', 'Leila', 'Tazi', '+212612000005', 'fr-MA'),
   ('parcours.prestataire@matricia.test', 'Omar', 'Chraibi', '+212612000006', 'fr-MA'),
   ('demo.admin@matricia.test', 'Nadia', 'El Fassi', '+212612000008', 'fr-MA'),
   ('demo.client@matricia.test', 'Imane', 'Bennani', '+212612000009', 'fr-MA'),
   ('demo.prestataire@matricia.test', 'Rachid', 'Alaoui', '+212612000010', 'fr-MA'),
   ('demo.franchise@matricia.test', 'Jalil', 'NEOXA', '+212612000011', 'fr-MA'),
   ('client.validation@matricia.test', 'Sara', 'Kadiri', '+212612000012', 'fr-MA')
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
  where p.id = u.id and (
    (position('%' in rec.email_pattern) > 0 and lower(u.email) like lower(rec.email_pattern))
    or (position('%' in rec.email_pattern) = 0 and lower(u.email) = lower(rec.email_pattern))
  );
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
  where (
    (position('%' in rec.email_pattern) > 0 and lower(u.email) like lower(rec.email_pattern))
    or (position('%' in rec.email_pattern) = 0 and lower(u.email) = lower(rec.email_pattern))
  );
 end loop;

 update public.organizations o
 set
  legal_name = case lower(o.display_name)
   when 'validation franchise' then 'Atlas Franchise Conseil SARL'
   when 'atlas franchise conseil' then 'Atlas Franchise Conseil SARL'
   when 'validation client' then 'Atlas Client Services SARL'
   when 'atlas client services' then 'Atlas Client Services SARL'
   when 'validation prestataire' then 'Atlas Prestataire Pro SARL'
   when 'atlas prestataire pro' then 'Atlas Prestataire Pro SARL'
   when 'client parcours it' then 'Parcours IT Client SARL'
   when 'parcours it client' then 'Parcours IT Client SARL'
   when 'prestataire parcours it' then 'Parcours IT Prestataire SARL'
   when 'parcours it prestataire' then 'Parcours IT Prestataire SARL'
   when 'franchise parcours it' then 'Ahmitech Franchise IT SARL'
   when 'parcours it franchise' then 'Ahmitech Franchise IT SARL'
   when 'ahmitech franchise it' then 'Ahmitech Franchise IT SARL'
   else o.legal_name
  end,
  display_name = case lower(o.display_name)
   when 'validation franchise' then 'Atlas Franchise Conseil'
   when 'validation client' then 'Atlas Client Services'
   when 'validation prestataire' then 'Atlas Prestataire Pro'
   when 'client parcours it' then 'Parcours IT Client'
   when 'prestataire parcours it' then 'Parcours IT Prestataire'
   when 'franchise parcours it' then 'Ahmitech Franchise IT'
   when 'parcours it franchise' then 'Ahmitech Franchise IT'
   else o.display_name
  end,
  updated_at = clock_timestamp(),
  row_version = o.row_version + 1
 where lower(o.display_name) in (
  'validation franchise','validation client','validation prestataire',
  'client parcours it','prestataire parcours it','franchise parcours it',
  'parcours it franchise','parcours it client','parcours it prestataire'
 );

 update public.organization_member_roles r
 set library_id = coalesce(r.library_id, f.library_id),
     franchise_id = coalesce(r.franchise_id, f.id)
 from public.organization_memberships m
 join lateral (
  select fr.id, fr.library_id
  from public.franchises fr
  where fr.operator_organization_id = m.organization_id
    and fr.status not in ('SUSPENDED','TERMINATED')
  order by case when fr.franchise_type = 'IT' then 0 else 1 end, fr.created_at
  limit 1
 ) f on true
 where r.membership_id = m.id
   and r.revoked_at is null
   and r.role_code like 'FRANCHISE_%'
   and (r.library_id is null or r.franchise_id is null)
   and (
    select count(*) from public.franchises fr
    where fr.operator_organization_id = m.organization_id
      and fr.status not in ('SUSPENDED','TERMINATED')
   ) = 1;

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
