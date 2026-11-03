-- Public franchise candidature opens a REGISTERED dossier. Contract, entry fee,
-- library assignment and activation stay on the existing franchise machine.
-- Rollback: revoke the functions, then archive the tables. Do not delete history.

create table public.franchise_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  applicant_name text not null check (length(btrim(applicant_name)) between 2 and 120),
  reply_email extensions.citext not null,
  territory_code text not null check (territory_code in (
    'TANGER_TETOUAN_AL_HOCEIMA','ORIENTAL','FES_MEKNES','RABAT_SALE_KENITRA','BENI_MELLAL_KHENIFRA',
    'CASABLANCA_SETTAT','MARRAKECH_SAFI','DRAA_TAFILALET','SOUSS_MASSA','GUELMIM_OUED_NOUN',
    'LAAYOUNE_SAKIA_EL_HAMRA','DAKHLA_OUED_ED_DAHAB'
  )),
  professional_profile text not null check (length(btrim(professional_profile)) between 2 and 80),
  domain_label text not null check (length(btrim(domain_label)) between 2 and 200),
  availability_label text not null check (length(btrim(availability_label)) between 2 and 80),
  motivation text not null check (length(btrim(motivation)) between 40 and 800),
  locale text not null check (locale in ('fr','ar')),
  status text not null default 'REGISTERED' check (status in (
    'REGISTERED','COMPANY_REVIEW','DOCUMENT_REVIEW','CLOSED',
    'CONTRACT_PENDING','ENTRY_FEE_SETUP','LIBRARY_ASSIGNED','ACTIVE',
    'FINANCIAL_RESTRICTED','SUSPENDED','TERMINATED'
  )),
  organization_id uuid references public.organizations(id) on delete restrict,
  franchise_id uuid unique references public.franchises(id) on delete restrict,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  row_version integer not null default 1 check (row_version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (reply_email::text = lower(reply_email::text)),
  check ((franchise_id is null) or organization_id is not null),
  check (status <> 'CLOSED' or franchise_id is null)
);

create table public.franchise_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.franchise_applications(id) on delete restrict,
  from_status text,
  to_status text not null,
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  actor_user_id uuid references auth.users(id),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  occurred_at timestamptz not null default clock_timestamp(),
  unique (application_id, idempotency_key)
);

create index franchise_applications_review_idx on public.franchise_applications(status, created_at desc, id);
create index franchise_applications_email_idx on public.franchise_applications(reply_email, created_at desc);
create trigger franchise_application_events_immutable before update or delete on public.franchise_application_events
  for each row execute function private.prevent_franchise_history_change();

alter table public.franchise_applications enable row level security;
alter table public.franchise_application_events enable row level security;
revoke all on public.franchise_applications, public.franchise_application_events from public, anon, authenticated, service_role;

create function private.session_email_v1() returns text
language sql stable security definer set search_path = pg_catalog, auth as $$
  select lower(email::text) from auth.users where id = auth.uid()
$$;
revoke all on function private.session_email_v1() from public, anon, authenticated, service_role;
grant execute on function private.session_email_v1() to authenticated;

create policy franchise_applications_read on public.franchise_applications for select to authenticated
using (
  private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER','READ_ONLY_AUDITOR'])
  or lower(reply_email::text) = private.session_email_v1()
);
create policy franchise_application_events_read on public.franchise_application_events for select to authenticated
using (exists (
  select 1 from public.franchise_applications application
  where application.id = application_id
    and (
      private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER','READ_ONLY_AUDITOR'])
      or lower(application.reply_email::text) = private.session_email_v1()
    )
));
grant select on public.franchise_applications, public.franchise_application_events to authenticated;

create function public.submit_franchise_application(
  p_applicant_name text,
  p_reply_email text,
  p_territory_code text,
  p_professional_profile text,
  p_domain_label text,
  p_availability_label text,
  p_motivation text,
  p_locale text,
  p_ip_hash text
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare
  application_id uuid;
  normalized_email text := lower(btrim(coalesce(p_reply_email, '')));
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'FRANCHISE_APPLICATION_DENIED' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_applicant_name, ''))) not between 2 and 120
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or length(normalized_email) > 254
     or p_territory_code not in (
       'TANGER_TETOUAN_AL_HOCEIMA','ORIENTAL','FES_MEKNES','RABAT_SALE_KENITRA','BENI_MELLAL_KHENIFRA',
       'CASABLANCA_SETTAT','MARRAKECH_SAFI','DRAA_TAFILALET','SOUSS_MASSA','GUELMIM_OUED_NOUN',
       'LAAYOUNE_SAKIA_EL_HAMRA','DAKHLA_OUED_ED_DAHAB'
     )
     or length(btrim(coalesce(p_professional_profile, ''))) not between 2 and 80
     or length(btrim(coalesce(p_domain_label, ''))) not between 2 and 200
     or length(btrim(coalesce(p_availability_label, ''))) not between 2 and 80
     or length(btrim(coalesce(p_motivation, ''))) not between 40 and 800
     or p_locale not in ('fr','ar')
     or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'FRANCHISE_APPLICATION_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('franchise-application:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('franchise-application:email:' || normalized_email, 0));
  if (select count(*) from public.franchise_applications where ip_hash = p_ip_hash and created_at > clock_timestamp() - interval '1 hour') >= 5
     or (select count(*) from public.franchise_applications where reply_email = normalized_email and created_at > clock_timestamp() - interval '1 day') >= 3 then
    raise exception 'FRANCHISE_APPLICATION_RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.franchise_applications(
    applicant_name, reply_email, territory_code, professional_profile, domain_label, availability_label, motivation, locale, ip_hash
  ) values (
    btrim(p_applicant_name), normalized_email, p_territory_code, btrim(p_professional_profile), btrim(p_domain_label),
    btrim(p_availability_label), btrim(p_motivation), p_locale, p_ip_hash
  ) returning id into application_id;
  insert into public.franchise_application_events(application_id, from_status, to_status, reason, idempotency_key)
  values (application_id, null, 'REGISTERED', 'PUBLIC_CANDIDATURE', 'submit:' || application_id::text);
  return application_id;
end;
$$;
revoke all on function public.submit_franchise_application(text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_franchise_application(text,text,text,text,text,text,text,text,text) to service_role;

create function public.review_franchise_application(
  p_application_id uuid,
  p_to_status text,
  p_reason text,
  p_expected_row_version integer,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare
  actor uuid := auth.uid();
  application public.franchise_applications%rowtype;
  prior text;
begin
  if actor is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER'], actor) then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_DENIED' using errcode = '42501';
  end if;
  if p_to_status not in ('COMPANY_REVIEW','DOCUMENT_REVIEW','CLOSED')
     or length(btrim(coalesce(p_reason, ''))) not between 3 and 1000
     or length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_INVALID' using errcode = '22023';
  end if;
  select event.to_status into prior
  from public.franchise_application_events event
  where event.application_id = p_application_id and event.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('outcome','FRANCHISE_APPLICATION_REVIEWED','application_id',p_application_id,'status',prior,'replayed',true);
  end if;
  select * into application from public.franchise_applications where id = p_application_id for update;
  if not found then raise exception 'FRANCHISE_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if application.franchise_id is not null or application.row_version <> p_expected_row_version then
    raise exception 'STALE_FRANCHISE_APPLICATION' using errcode = '40001';
  end if;
  if not (
    (application.status = 'REGISTERED' and p_to_status = 'COMPANY_REVIEW')
    or (application.status = 'COMPANY_REVIEW' and p_to_status = 'DOCUMENT_REVIEW')
    or (application.status in ('REGISTERED','COMPANY_REVIEW','DOCUMENT_REVIEW') and p_to_status = 'CLOSED')
  ) then
    raise exception 'FRANCHISE_APPLICATION_TRANSITION_DENIED' using errcode = '55000';
  end if;
  update public.franchise_applications
  set status = p_to_status, updated_at = clock_timestamp(), row_version = row_version + 1
  where id = application.id;
  insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
  values (application.id, application.status, p_to_status, btrim(p_reason), actor, p_idempotency_key);
  return jsonb_build_object('outcome','FRANCHISE_APPLICATION_REVIEWED','application_id',application.id,'status',p_to_status,'row_version',application.row_version + 1,'replayed',false);
end;
$$;

create function public.link_franchise_application_organization(
  p_application_id uuid,
  p_organization_id uuid,
  p_reason text,
  p_expected_row_version integer,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor uuid := auth.uid();
  application public.franchise_applications%rowtype;
begin
  if actor is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER'], actor) then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 1000 or length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_INVALID' using errcode = '22023';
  end if;
  if exists (select 1 from public.franchise_application_events event where event.application_id = p_application_id and event.idempotency_key = p_idempotency_key) then
    return jsonb_build_object('outcome','FRANCHISE_APPLICATION_ORGANIZATION_LINKED','application_id',p_application_id,'organization_id',p_organization_id,'replayed',true);
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id and status <> 'ARCHIVED') then
    raise exception 'FRANCHISE_APPLICATION_ORGANIZATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into application from public.franchise_applications where id = p_application_id for update;
  if not found then raise exception 'FRANCHISE_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if application.row_version <> p_expected_row_version or application.franchise_id is not null or application.status not in ('COMPANY_REVIEW','DOCUMENT_REVIEW') then
    raise exception 'STALE_FRANCHISE_APPLICATION' using errcode = '40001';
  end if;
  update public.franchise_applications
  set organization_id = p_organization_id, updated_at = clock_timestamp(), row_version = row_version + 1
  where id = application.id;
  insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
  values (application.id, application.status, application.status, btrim(p_reason), actor, p_idempotency_key);
  return jsonb_build_object('outcome','FRANCHISE_APPLICATION_ORGANIZATION_LINKED','application_id',application.id,'organization_id',p_organization_id,'row_version',application.row_version + 1,'replayed',false);
end;
$$;

create function public.bind_franchise_application_mandate(
  p_application_id uuid,
  p_franchise_id uuid,
  p_reason text,
  p_expected_row_version integer,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor uuid := auth.uid();
  application public.franchise_applications%rowtype;
  franchise public.franchises%rowtype;
begin
  if actor is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER'], actor) then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_DENIED' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 1000 or length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_INVALID' using errcode = '22023';
  end if;
  if exists (select 1 from public.franchise_application_events event where event.application_id = p_application_id and event.idempotency_key = p_idempotency_key) then
    return jsonb_build_object('outcome','FRANCHISE_APPLICATION_MANDATE_BOUND','application_id',p_application_id,'franchise_id',p_franchise_id,'replayed',true);
  end if;
  select * into franchise from public.franchises where id = p_franchise_id;
  select * into application from public.franchise_applications where id = p_application_id for update;
  if franchise.id is null or application.id is null then raise exception 'FRANCHISE_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if application.row_version <> p_expected_row_version
     or application.status <> 'DOCUMENT_REVIEW'
     or application.organization_id is null
     or application.organization_id is distinct from franchise.operator_organization_id
     or franchise.status not in ('CONTRACT_PENDING','ENTRY_FEE_SETUP','LIBRARY_ASSIGNED','ACTIVE') then
    raise exception 'STALE_FRANCHISE_APPLICATION' using errcode = '40001';
  end if;
  update public.franchise_applications
  set franchise_id = franchise.id, status = franchise.status, updated_at = clock_timestamp(), row_version = row_version + 1
  where id = application.id;
  insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
  values (application.id, application.status, franchise.status, btrim(p_reason), actor, p_idempotency_key);
  return jsonb_build_object('outcome','FRANCHISE_APPLICATION_MANDATE_BOUND','application_id',application.id,'franchise_id',franchise.id,'status',franchise.status,'row_version',application.row_version + 1,'replayed',false);
end;
$$;

create function private.sync_franchise_application_status_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.status is distinct from old.status and new.status in ('CONTRACT_PENDING','ENTRY_FEE_SETUP','LIBRARY_ASSIGNED','ACTIVE','FINANCIAL_RESTRICTED','SUSPENDED','TERMINATED') then
    update public.franchise_applications
    set status = new.status, updated_at = clock_timestamp(), row_version = row_version + 1
    where franchise_id = new.id and status is distinct from new.status;
    insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
    select application.id, old.status, new.status, 'FRANCHISE_STATUS_SYNC', coalesce(auth.uid(), new.created_by), 'franchise-status:' || new.id::text || ':' || new.status || ':' || new.row_version::text
    from public.franchise_applications application
    where application.franchise_id = new.id
    on conflict (application_id, idempotency_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_franchise_application_status_v1() from public, anon, authenticated, service_role;
create trigger franchise_application_status_sync after update of status on public.franchises
  for each row execute function private.sync_franchise_application_status_v1();

revoke all on function public.review_franchise_application(uuid,text,text,integer,text),
  public.link_franchise_application_organization(uuid,uuid,text,integer,text),
  public.bind_franchise_application_mandate(uuid,uuid,text,integer,text)
  from public, anon, authenticated, service_role;
grant execute on function public.review_franchise_application(uuid,text,text,integer,text),
  public.link_franchise_application_organization(uuid,uuid,text,integer,text),
  public.bind_franchise_application_mandate(uuid,uuid,text,integer,text)
  to authenticated;
notify pgrst, 'reload schema';
