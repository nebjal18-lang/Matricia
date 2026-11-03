-- The first save function used a variable named entry_id, which PostgreSQL
-- treats as ambiguous next to the entry_id column. This replacement keeps the
-- same contract and stores the saved identifier under a distinct name.
begin;

create or replace function public.save_delivery_preparation(p_section text, p_item_key text, p_value_text text, p_secret text, p_expected_row_version integer, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  existing public.delivery_preparation_entries%rowtype;
  replayed_entry uuid;
  french text;
  saved_id uuid;
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
    return jsonb_build_object('outcome','DELIVERY_PREPARATION_SAVED','entry_id', replayed_entry, 'row_version', (select row_version from public.delivery_preparation_entries where id = replayed_entry), 'replayed', true, 'secret_present', exists(select 1 from private.delivery_preparation_secrets secret where secret.entry_id = replayed_entry));
  end if;
  select * into existing from public.delivery_preparation_entries where section = p_section and item_key = p_item_key for update;
  if existing.id is null then
    if p_expected_row_version <> 0 then raise exception 'STALE_DELIVERY_PREPARATION' using errcode = '40001'; end if;
    insert into public.delivery_preparation_entries(section, item_key, value_text, updated_by)
    values (p_section, p_item_key, btrim(p_value_text), actor) returning id, row_version into saved_id, next_version;
  else
    if existing.row_version <> p_expected_row_version then raise exception 'STALE_DELIVERY_PREPARATION' using errcode = '40001'; end if;
    update public.delivery_preparation_entries
      set value_text = btrim(p_value_text), row_version = row_version + 1, updated_by = actor, updated_at = clock_timestamp()
      where id = existing.id
      returning id, row_version into saved_id, next_version;
  end if;
  if secret is not null then
    insert into private.delivery_preparation_secrets as stored(entry_id, secret_text) values (saved_id, secret)
    on conflict (entry_id) do update set secret_text = excluded.secret_text, updated_at = clock_timestamp();
  end if;
  insert into public.delivery_preparation_events as recorded(entry_id, idempotency_key, actor_user_id) values (saved_id, p_idempotency_key, actor);
  response := jsonb_build_object('outcome','DELIVERY_PREPARATION_SAVED','section', p_section, 'item_key', p_item_key, 'entry_id', saved_id, 'row_version', next_version, 'replayed', false, 'secret_present', exists(select 1 from private.delivery_preparation_secrets secret where secret.entry_id = saved_id));
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (null, actor, 'USER', 'delivery_preparation.save', 'delivery_preparation_entry', saved_id::text, correlation,
    jsonb_build_object('section', p_section, 'item_key', p_item_key, 'row_version', next_version, 'secret_replaced', secret is not null),
    encode(extensions.digest(convert_to(saved_id::text || p_idempotency_key, 'UTF8'), 'sha256'), 'hex'));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (null, 'delivery_preparation_entry', saved_id::text, 'DeliveryPreparationSavedV1', correlation, response, 'delivery-preparation:' || p_idempotency_key);
  return response;
end;
$$;

revoke all on function public.save_delivery_preparation(text, text, text, text, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.save_delivery_preparation(text, text, text, text, integer, text) to authenticated;

notify pgrst, 'reload schema';
commit;
