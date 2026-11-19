-- Add audit_events + event_outbox to open_franchise_application_invite_v1.
-- Still REGISTERED only; never creates ACTIVE franchise.
-- Rollback: restore prior function body from 20261114210000.

create or replace function public.open_franchise_application_invite_v1(
  p_applicant_name text,
  p_reply_email text,
  p_territory_code text,
  p_domain_label text,
  p_reason text,
  p_locale text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  actor uuid := auth.uid();
  normalized_email text := lower(btrim(coalesce(p_reply_email, '')));
  application_id uuid;
  prior uuid;
  motivation text;
  ip_hash text;
  reason_text text := btrim(coalesce(p_reason, ''));
  correlation uuid := extensions.gen_random_uuid();
  response jsonb;
  replayed boolean := false;
begin
  if actor is null or not private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'LIBRARY_MANAGER'], actor) then
    raise exception 'FRANCHISE_APPLICATION_INVITE_DENIED' using errcode = '42501';
  end if;
  if coalesce(auth.jwt()->>'aal', '') is distinct from 'aal2' then
    raise exception 'FRANCHISE_APPLICATION_INVITE_MFA_REQUIRED' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_applicant_name, ''))) not between 2 and 120
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or length(normalized_email) > 254
     or p_territory_code not in (
       'TANGER_TETOUAN_AL_HOCEIMA','ORIENTAL','FES_MEKNES','RABAT_SALE_KENITRA','BENI_MELLAL_KHENIFRA',
       'CASABLANCA_SETTAT','MARRAKECH_SAFI','DRAA_TAFILALET','SOUSS_MASSA','GUELMIM_OUED_NOUN',
       'LAAYOUNE_SAKIA_EL_HAMRA','DAKHLA_OUED_ED_DAHAB'
     )
     or length(btrim(coalesce(p_domain_label, ''))) not between 2 and 200
     or length(reason_text) not between 3 and 1000
     or p_locale not in ('fr', 'ar')
     or length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'FRANCHISE_APPLICATION_INVITE_INVALID' using errcode = '22023';
  end if;

  select event.application_id into prior
  from public.franchise_application_events event
  where event.idempotency_key = 'admin-invite:' || p_idempotency_key;
  if found then
    return jsonb_build_object(
      'outcome', 'FRANCHISE_APPLICATION_INVITED',
      'application_id', prior,
      'status', (select status from public.franchise_applications where id = prior),
      'replayed', true
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('franchise-application:email:' || normalized_email, 0));

  select application.id into application_id
  from public.franchise_applications application
  where application.reply_email = normalized_email
    and application.status = 'REGISTERED'
    and application.created_at > clock_timestamp() - interval '1 day'
    and exists (
      select 1 from public.franchise_application_events event
      where event.application_id = application.id
        and event.to_status = 'REGISTERED'
        and event.reason like 'ADMIN_INVITE%'
    )
  order by application.created_at desc, application.id
  limit 1;

  if application_id is not null then
    insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
    values (application_id, 'REGISTERED', 'REGISTERED', 'ADMIN_INVITE_REPLAY', actor, 'admin-invite:' || p_idempotency_key)
    on conflict (application_id, idempotency_key) do nothing;
    replayed := true;
  else
    motivation := left(
      'Invitation ouverte par l''administration Matricia. Motif: ' || reason_text,
      800
    );
    if length(motivation) < 40 then
      motivation := rpad(motivation, 40, '.');
    end if;

    ip_hash := encode(extensions.digest(actor::text || ':admin-invite:' || p_idempotency_key, 'sha256'), 'hex');

    insert into public.franchise_applications(
      applicant_name, reply_email, territory_code, professional_profile, domain_label,
      availability_label, motivation, locale, ip_hash
    ) values (
      btrim(p_applicant_name),
      normalized_email,
      p_territory_code,
      'Candidat invité',
      btrim(p_domain_label),
      'À confirmer',
      motivation,
      p_locale,
      ip_hash
    ) returning id into application_id;

    insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
    values (
      application_id,
      null,
      'REGISTERED',
      left('ADMIN_INVITE: ' || reason_text, 1000),
      actor,
      'admin-invite:' || p_idempotency_key
    );
  end if;

  response := jsonb_build_object(
    'outcome', 'FRANCHISE_APPLICATION_INVITED',
    'application_id', application_id,
    'status', 'REGISTERED',
    'replayed', replayed
  );

  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (
    null,
    actor,
    'USER',
    'franchise.application.admin_invited',
    'franchise_application',
    application_id::text,
    correlation,
    jsonb_build_object(
      'status', 'REGISTERED',
      'replayed', replayed,
      'idempotency_key', p_idempotency_key,
      'territory_code', p_territory_code
    ),
    repeat('0', 64)
  );

  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (
    null,
    'franchise_application',
    application_id::text,
    'FranchiseApplicationInvitedV1',
    correlation,
    response,
    'franchise-application-invite:' || p_idempotency_key
  )
  on conflict do nothing;

  return response;
end;
$$;

revoke all on function public.open_franchise_application_invite_v1(text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.open_franchise_application_invite_v1(text, text, text, text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
