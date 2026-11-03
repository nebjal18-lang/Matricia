-- Drafts for values the publisher will supply later. Nothing here is published
-- to the catalogue, the legal pages, prices, or a live integration.
begin;

create table public.delivery_preparation_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  section text not null check (section in ('CATALOG_SERVICE_AR','CATALOG_CATEGORY_AR','LEGAL','BOX','INTEGRATION','RELEASE')),
  item_key text not null check (char_length(btrim(item_key)) between 1 and 160),
  value_text text not null check (char_length(btrim(value_text)) between 1 and 4000),
  row_version integer not null default 1 check (row_version > 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  unique (section, item_key)
);

create table public.delivery_preparation_events (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.delivery_preparation_entries(id),
  idempotency_key text not null unique check (idempotency_key ~ '^[A-Za-z0-9_-]{8,80}$'),
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);

create table private.delivery_preparation_secrets (
  entry_id uuid primary key references public.delivery_preparation_entries(id),
  secret_text text not null check (char_length(secret_text) between 8 and 4000),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.delivery_preparation_entries enable row level security;
alter table public.delivery_preparation_events enable row level security;
revoke all on public.delivery_preparation_entries, public.delivery_preparation_events from public, anon, authenticated, service_role;
revoke all on private.delivery_preparation_secrets from public, anon, authenticated, service_role;

create function private.delivery_preparation_admin() returns boolean
language sql stable security definer set search_path = pg_catalog, private as $$
  select auth.uid() is not null
    and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'], auth.uid())
    and coalesce(auth.jwt()->>'aal','') = 'aal2';
$$;

revoke all on function private.delivery_preparation_admin() from public, anon, authenticated, service_role;

create function public.delivery_preparation_overview() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, private as $$
begin
  if not private.delivery_preparation_admin() then
    raise exception 'DELIVERY_PREPARATION_DENIED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'services_pending', (select count(*) from public.catalog_services s join public.catalog_service_versions v on v.id = coalesce(s.current_published_version_id, s.current_draft_version_id) where btrim(v.name_ar) = btrim(v.name_fr) and s.status not in ('ARCHIVED','RETIRED')),
    'services_drafted', (select count(*) from public.delivery_preparation_entries where section = 'CATALOG_SERVICE_AR'),
    'categories_pending', (select count(*) from public.catalog_categories c join public.catalog_category_versions v on v.id = coalesce(c.current_published_version_id, c.current_draft_version_id) where btrim(v.name_ar) = btrim(v.name_fr) and c.status not in ('ARCHIVED','RETIRED')),
    'categories_drafted', (select count(*) from public.delivery_preparation_entries where section = 'CATALOG_CATEGORY_AR'),
    'legal_drafted', (select count(*) from public.delivery_preparation_entries where section = 'LEGAL'),
    'legal_total', 11,
    'box_drafted', (select count(distinct split_part(item_key, ':', 2)) from public.delivery_preparation_entries where section = 'BOX'),
    'integrations_drafted', (select count(*) from public.delivery_preparation_entries where section = 'INTEGRATION'),
    'integrations_secret', (select count(*) from private.delivery_preparation_secrets secret join public.delivery_preparation_entries entry on entry.id = secret.entry_id where entry.section = 'INTEGRATION'),
    'integrations_total', 5,
    'release_drafted', (select count(*) from public.delivery_preparation_entries where section = 'RELEASE'),
    'release_total', 4
  );
end;
$$;

create function public.list_delivery_preparation(p_section text, p_query text default '', p_limit integer default 20, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, private as $$
declare
  query text := left(replace(replace(coalesce(p_query, ''), '%', ''), '_', ''), 80);
  payload jsonb;
begin
  if not private.delivery_preparation_admin() then
    raise exception 'DELIVERY_PREPARATION_DENIED' using errcode = '42501';
  end if;
  if p_section not in ('CATALOG_SERVICE_AR','CATALOG_CATEGORY_AR','LEGAL','BOX','INTEGRATION','RELEASE')
    or p_limit is null or p_limit not between 1 and 50
    or p_offset is null or p_offset < 0 or p_offset > 10000 then
    raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
  end if;
  if p_section = 'CATALOG_SERVICE_AR' then
    with source as (
      select s.code as item_key, v.name_fr as reference
      from public.catalog_services s
      join public.catalog_service_versions v on v.id = coalesce(s.current_published_version_id, s.current_draft_version_id)
      where s.status not in ('ARCHIVED','RETIRED') and btrim(v.name_ar) = btrim(v.name_fr)
        and (query = '' or s.code ilike '%' || query || '%' or v.name_fr ilike '%' || query || '%')
    )
    select jsonb_build_object('total', (select count(*) from source), 'items', coalesce((
      select jsonb_agg(jsonb_build_object('key', source.item_key, 'reference', source.reference, 'value', entry.value_text, 'row_version', coalesce(entry.row_version, 0), 'secret_present', false) order by source.item_key)
      from (select * from source order by item_key limit p_limit offset p_offset) source
      left join public.delivery_preparation_entries entry on entry.section = 'CATALOG_SERVICE_AR' and entry.item_key = source.item_key
    ), '[]'::jsonb)) into payload;
  elsif p_section = 'CATALOG_CATEGORY_AR' then
    with source as (
      select l.code || ':' || c.code as item_key, v.name_fr as reference
      from public.catalog_categories c
      join public.catalog_libraries l on l.id = c.library_id
      join public.catalog_category_versions v on v.id = coalesce(c.current_published_version_id, c.current_draft_version_id)
      where c.status not in ('ARCHIVED','RETIRED') and btrim(v.name_ar) = btrim(v.name_fr)
        and (query = '' or l.code ilike '%' || query || '%' or c.code ilike '%' || query || '%' or v.name_fr ilike '%' || query || '%')
    )
    select jsonb_build_object('total', (select count(*) from source), 'items', coalesce((
      select jsonb_agg(jsonb_build_object('key', source.item_key, 'reference', source.reference, 'value', entry.value_text, 'row_version', coalesce(entry.row_version, 0), 'secret_present', false) order by source.item_key)
      from (select * from source order by item_key limit p_limit offset p_offset) source
      left join public.delivery_preparation_entries entry on entry.section = 'CATALOG_CATEGORY_AR' and entry.item_key = source.item_key
    ), '[]'::jsonb)) into payload;
  elsif p_section = 'BOX' then
    select jsonb_build_object('total', count(*), 'items', coalesce(jsonb_agg(jsonb_build_object('key', entry.item_key, 'reference', split_part(entry.item_key, ':', 2), 'value', entry.value_text, 'row_version', entry.row_version, 'secret_present', false) order by entry.item_key), '[]'::jsonb))
    into payload from public.delivery_preparation_entries entry where entry.section = 'BOX';
  else
    with required(item_key) as (
      select unnest(case p_section
        when 'LEGAL' then array['LEGAL_ENTITY_NAME','LEGAL_ENTITY_FORM','LEGAL_ENTITY_ADDRESS','LEGAL_REGISTRATION_ID','LEGAL_PUBLICATION_DIRECTOR','LEGAL_HOST_NAME','LEGAL_HOST_ADDRESS','LEGAL_PRIVACY_EMAIL','LEGAL_RETENTION_FR','LEGAL_RETENTION_AR','LEGAL_TERMS_APPROVAL_REFERENCE']
        when 'INTEGRATION' then array['SIGNATURE','PAYMENT','EMAIL','ANTIVIRUS','SOCIAL']
        else array['CNDP','TAX','STAGING','ACCEPTANCE'] end)
    )
    select jsonb_build_object('total', count(*), 'items', coalesce(jsonb_agg(jsonb_build_object(
      'key', required.item_key, 'reference', null, 'value', entry.value_text, 'row_version', coalesce(entry.row_version, 0),
      'secret_present', exists(select 1 from private.delivery_preparation_secrets secret where secret.entry_id = entry.id)
    ) order by required.item_key), '[]'::jsonb))
    into payload
    from required
    left join public.delivery_preparation_entries entry on entry.section = p_section and entry.item_key = required.item_key;
  end if;
  return payload;
end;
$$;

create function public.save_delivery_preparation(p_section text, p_item_key text, p_value_text text, p_secret text, p_expected_row_version integer, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  existing public.delivery_preparation_entries%rowtype;
  replayed_entry uuid;
  french text;
  entry_id uuid;
  next_version integer;
  secret text := nullif(btrim(coalesce(p_secret, '')), '');
  correlation uuid := extensions.gen_random_uuid();
  response jsonb;
begin
  if not private.delivery_preparation_admin() then
    raise exception 'DELIVERY_PREPARATION_DENIED' using errcode = '42501';
  end if;
  if p_section is null or p_expected_row_version is null or p_expected_row_version < 0
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,80}$'
    or char_length(btrim(coalesce(p_value_text, ''))) not between 1 and 4000
    or (secret is not null and (p_section <> 'INTEGRATION' or char_length(secret) not between 8 and 4000 or secret = btrim(p_value_text))) then
    raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
  end if;
  if p_section = 'CATALOG_SERVICE_AR' then
    if p_item_key !~ '^[A-Z][A-Z0-9_-]{1,79}$' or btrim(p_value_text) !~ U&'[\0600-\06FF]' then
      raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
    end if;
    select v.name_fr into french from public.catalog_services s
      join public.catalog_service_versions v on v.id = coalesce(s.current_published_version_id, s.current_draft_version_id)
      where s.code = p_item_key and s.status not in ('ARCHIVED','RETIRED');
    if french is null or btrim(p_value_text) = btrim(french) then
      raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
    end if;
  elsif p_section = 'CATALOG_CATEGORY_AR' then
    if p_item_key !~ '^[A-Z][A-Z0-9_-]{1,79}:[A-Z][A-Z0-9_-]{1,79}$' or btrim(p_value_text) !~ U&'[\0600-\06FF]' then
      raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
    end if;
    select v.name_fr into french from public.catalog_categories c
      join public.catalog_libraries l on l.id = c.library_id
      join public.catalog_category_versions v on v.id = coalesce(c.current_published_version_id, c.current_draft_version_id)
      where l.code = split_part(p_item_key, ':', 1) and c.code = split_part(p_item_key, ':', 2) and c.status not in ('ARCHIVED','RETIRED');
    if french is null or btrim(p_value_text) = btrim(french) then
      raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
    end if;
  elsif p_section = 'LEGAL' then
    if p_item_key not in ('LEGAL_ENTITY_NAME','LEGAL_ENTITY_FORM','LEGAL_ENTITY_ADDRESS','LEGAL_REGISTRATION_ID','LEGAL_PUBLICATION_DIRECTOR','LEGAL_HOST_NAME','LEGAL_HOST_ADDRESS','LEGAL_PRIVACY_EMAIL','LEGAL_RETENTION_FR','LEGAL_RETENTION_AR','LEGAL_TERMS_APPROVAL_REFERENCE')
      or (p_item_key = 'LEGAL_PRIVACY_EMAIL' and btrim(p_value_text) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
      or (p_item_key = 'LEGAL_RETENTION_AR' and btrim(p_value_text) !~ U&'[\0600-\06FF]') then
      raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
    end if;
  elsif p_section = 'BOX' then
    if p_item_key !~ '^PLAN:[A-Z][A-Z0-9_-]{1,40}:(QUOTA|PRIVILEGES|CONDITIONS)$' then
      raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
    end if;
  elsif p_section = 'INTEGRATION' then
    if p_item_key not in ('SIGNATURE','PAYMENT','EMAIL','ANTIVIRUS','SOCIAL') then
      raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
    end if;
  elsif p_section = 'RELEASE' then
    if p_item_key not in ('CNDP','TAX','STAGING','ACCEPTANCE') then
      raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
    end if;
  else
    raise exception 'INVALID_DELIVERY_PREPARATION' using errcode = '22023';
  end if;

  select event.entry_id into replayed_entry from public.delivery_preparation_events event where event.idempotency_key = p_idempotency_key;
  if replayed_entry is not null then
    return jsonb_build_object('outcome','DELIVERY_PREPARATION_SAVED','entry_id', replayed_entry, 'row_version', (select row_version from public.delivery_preparation_entries where id = replayed_entry), 'replayed', true, 'secret_present', exists(select 1 from private.delivery_preparation_secrets where entry_id = replayed_entry));
  end if;
  select * into existing from public.delivery_preparation_entries where section = p_section and item_key = p_item_key for update;
  if existing.id is null then
    if p_expected_row_version <> 0 then raise exception 'STALE_DELIVERY_PREPARATION' using errcode = '40001'; end if;
    insert into public.delivery_preparation_entries(section, item_key, value_text, updated_by)
    values (p_section, p_item_key, btrim(p_value_text), actor) returning id, row_version into entry_id, next_version;
  else
    if existing.row_version <> p_expected_row_version then raise exception 'STALE_DELIVERY_PREPARATION' using errcode = '40001'; end if;
    update public.delivery_preparation_entries
      set value_text = btrim(p_value_text), row_version = row_version + 1, updated_by = actor, updated_at = clock_timestamp()
      where id = existing.id
      returning id, row_version into entry_id, next_version;
  end if;
  if secret is not null then
    insert into private.delivery_preparation_secrets(entry_id, secret_text) values (entry_id, secret)
    on conflict (entry_id) do update set secret_text = excluded.secret_text, updated_at = clock_timestamp();
  end if;
  insert into public.delivery_preparation_events(entry_id, idempotency_key, actor_user_id) values (entry_id, p_idempotency_key, actor);
  response := jsonb_build_object('outcome','DELIVERY_PREPARATION_SAVED','section', p_section, 'item_key', p_item_key, 'entry_id', entry_id, 'row_version', next_version, 'replayed', false, 'secret_present', exists(select 1 from private.delivery_preparation_secrets where entry_id = entry_id));
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (null, actor, 'USER', 'delivery_preparation.save', 'delivery_preparation_entry', entry_id::text, correlation,
    jsonb_build_object('section', p_section, 'item_key', p_item_key, 'row_version', next_version, 'secret_replaced', secret is not null),
    encode(extensions.digest(convert_to(entry_id::text || p_idempotency_key, 'UTF8'), 'sha256'), 'hex'));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (null, 'delivery_preparation_entry', entry_id::text, 'DeliveryPreparationSavedV1', correlation, response, 'delivery-preparation:' || p_idempotency_key);
  return response;
end;
$$;

revoke all on function public.delivery_preparation_overview() from public, anon, authenticated, service_role;
revoke all on function public.list_delivery_preparation(text, text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.save_delivery_preparation(text, text, text, text, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.delivery_preparation_overview() to authenticated;
grant execute on function public.list_delivery_preparation(text, text, integer, integer) to authenticated;
grant execute on function public.save_delivery_preparation(text, text, text, text, integer, text) to authenticated;

comment on table public.delivery_preparation_entries is
  'Unpublished administrator drafts. Catalogue versions, legal pages, prices and live integrations stay unchanged.';
comment on table private.delivery_preparation_secrets is
  'Write-only integration credentials. No API role can select this table.';

notify pgrst, 'reload schema';
commit;
