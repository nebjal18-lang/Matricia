-- Queue the announced review e-mail, and remind certifications, licences and
-- accreditations at J-60, J-30 and J-7. Legal, fiscal and insurance reminders
-- already run in the domain scheduler. Delivery stays on the service-role worker.

insert into public.notification_template_versions(
  template_code, version, event_type, category_code, locale, subject_template, body_template, cta_path_template,
  priority, mandatory, channels, variable_keys, status, effective_from, content_hash
) values
(
  'PROVIDER_COMPANY_REVIEW', 1, 'ProviderCompanyReviewNotifiedV1', 'DOCUMENTS_REQUIRED', 'fr-MA',
  'Revue de votre dossier : {{decision}}',
  'Matricia a terminé la revue de votre dossier. Décision : {{decision}}. Référence : {{reference}}.',
  '/fr/sous-traitant/qualification', 'CRITICAL', true, array['IN_APP','EMAIL'], array['decision','reference'],
  'ACTIVE', '2026-11-03', private.canonical_request_hash('{"template":"PROVIDER_COMPANY_REVIEW","version":1,"locale":"fr-MA"}'::jsonb)
),
(
  'PROVIDER_COMPANY_REVIEW', 1, 'ProviderCompanyReviewNotifiedV1', 'DOCUMENTS_REQUIRED', 'ar-MA',
  'مراجعة ملفكم: {{decision}}',
  'أنهت ماتريسيا مراجعة ملفكم. القرار: {{decision}}. المرجع: {{reference}}.',
  '/ar/sous-traitant/qualification', 'CRITICAL', true, array['IN_APP','EMAIL'], array['decision','reference'],
  'ACTIVE', '2026-11-03', private.canonical_request_hash('{"template":"PROVIDER_COMPANY_REVIEW","version":1,"locale":"ar-MA"}'::jsonb)
);

create table public.provider_review_notification_queue (
  id uuid primary key default extensions.gen_random_uuid(),
  decision_id uuid not null unique references public.provider_company_decisions(id) on delete restrict,
  provider_organization_id uuid not null references public.organizations(id) on delete restrict,
  company_status text not null check (company_status in ('VERIFIED','REJECTED','SUSPENDED')),
  status text not null default 'PENDING' check (status in ('PENDING','SENT')),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.provider_review_notification_queue enable row level security;
revoke all on public.provider_review_notification_queue from public, anon, authenticated, service_role;
create index provider_review_notification_pending_idx on public.provider_review_notification_queue(created_at, id) where status = 'PENDING';

create function private.queue_provider_review_notification_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.company_status in ('VERIFIED','REJECTED','SUSPENDED') then
    insert into public.provider_review_notification_queue(decision_id, provider_organization_id, company_status)
    values (new.id, new.provider_organization_id, new.company_status)
    on conflict (decision_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_provider_review_notification_v1() from public, anon, authenticated, service_role;
create trigger provider_company_review_notification after insert on public.provider_company_decisions
  for each row execute function private.queue_provider_review_notification_v1();

create function public.enqueue_provider_review_notifications_v1(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  item record;
  recipient record;
  processed integer := 0;
  more boolean;
  corr uuid := extensions.gen_random_uuid();
begin
  if auth.role() is distinct from 'service_role' then raise exception 'PROVIDER_REVIEW_NOTIFICATION_DENIED' using errcode = '42501'; end if;
  if p_limit is null or p_limit not between 1 and 500 then raise exception 'INVALID_PROVIDER_REVIEW_NOTIFICATION_PAGE' using errcode = '22023'; end if;
  for item in
    select queue.* from public.provider_review_notification_queue queue
    where queue.status = 'PENDING'
    order by queue.created_at, queue.id
    limit p_limit
    for update skip locked
  loop
    for recipient in
      select membership.user_id, case when users.raw_user_meta_data->>'locale' in ('ar','ar-MA') then 'ar-MA' else 'fr-MA' end as locale
      from public.organization_memberships membership
      join public.organization_member_roles role on role.membership_id = membership.id and role.revoked_at is null and role.role_code in ('PROVIDER_OWNER','PROVIDER_MANAGER')
      join auth.users users on users.id = membership.user_id
      where membership.organization_id = item.provider_organization_id and membership.status = 'ACTIVE'
    loop
      perform public.enqueue_notification(
        recipient.user_id, item.provider_organization_id, 'PROVIDER_COMPANY_REVIEW', 'ProviderCompanyReviewNotifiedV1', recipient.locale,
        jsonb_build_object(
          'decision', case when recipient.locale = 'ar-MA' then case item.company_status when 'VERIFIED' then 'تم التحقق' when 'REJECTED' then 'مرفوض' else 'موقوف' end else case item.company_status when 'VERIFIED' then 'Vérifié' when 'REJECTED' then 'Refusé' else 'Suspendu' end end,
          'reference', left(item.decision_id::text, 8)
        ),
        'provider-company-review:' || item.decision_id::text || ':' || recipient.user_id::text,
        'provider_company_decision', item.decision_id::text, corr
      );
    end loop;
    update public.provider_review_notification_queue set status = 'SENT' where id = item.id and status = 'PENDING';
    processed := processed + 1;
  end loop;
  select exists(select 1 from public.provider_review_notification_queue where status = 'PENDING') into more;
  return jsonb_build_object('outcome', case when more then 'PROVIDER_REVIEW_NOTIFICATIONS_PARTIAL' else 'PROVIDER_REVIEW_NOTIFICATIONS_COMPLETED' end, 'processed', processed, 'has_more', more);
end;
$$;

create function public.enqueue_provider_credential_expiry_reminders_v1(p_as_of date default current_date, p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  item record;
  processed integer := 0;
  more boolean;
  corr uuid := extensions.gen_random_uuid();
begin
  if auth.role() is distinct from 'service_role' then raise exception 'PROVIDER_CREDENTIAL_REMINDER_DENIED' using errcode = '42501'; end if;
  if p_as_of is null or not isfinite(p_as_of) or p_limit is null or p_limit not between 1 and 500 then
    raise exception 'INVALID_PROVIDER_CREDENTIAL_REMINDER_PAGE' using errcode = '22023';
  end if;
  for item in
    select document.id, document.provider_organization_id, family.document_kind, document.expires_on,
      membership.user_id as recipient_user_id,
      case when users.raw_user_meta_data->>'locale' in ('ar','ar-MA') then 'ar-MA' else 'fr-MA' end as locale,
      (document.expires_on - p_as_of) as days_left
    from public.provider_document_families family
    join public.provider_document_versions document on document.family_id = family.id
      and document.version_number = (select max(latest.version_number) from public.provider_document_versions latest where latest.family_id = family.id)
    join public.organization_memberships membership on membership.organization_id = document.provider_organization_id and membership.status = 'ACTIVE'
    join public.organization_member_roles role on role.membership_id = membership.id and role.revoked_at is null and role.role_code in ('PROVIDER_OWNER','PROVIDER_MANAGER')
    join auth.users users on users.id = membership.user_id
    where family.document_kind in ('CERTIFICATION','LICENSE','ACCREDITATION')
      and document.status = 'VERIFIED'
      and document.expires_on - p_as_of in (60, 30, 7)
      and not exists (
        select 1 from public.notification_instances notice
        where notice.recipient_user_id = membership.user_id
          and notice.deduplication_key = 'credential-expiry:' || document.id::text || ':' || (document.expires_on - p_as_of)::text || ':' || membership.user_id::text
      )
    order by document.expires_on, document.id, membership.user_id
    limit p_limit
  loop
    perform public.enqueue_notification(
      item.recipient_user_id, item.provider_organization_id, 'REQUIRED_DOCUMENT_EXPIRY', 'RequiredDocumentExpiryReminderV1', item.locale,
      jsonb_build_object('document_kind', item.document_kind, 'expires_on', item.expires_on::text, 'milestone', 'J-' || item.days_left::text),
      'credential-expiry:' || item.id::text || ':' || item.days_left::text || ':' || item.recipient_user_id::text,
      'provider_document', item.id::text, corr
    );
    processed := processed + 1;
  end loop;
  select exists (
    select 1
    from public.provider_document_families family
    join public.provider_document_versions document on document.family_id = family.id
      and document.version_number = (select max(latest.version_number) from public.provider_document_versions latest where latest.family_id = family.id)
    join public.organization_memberships membership on membership.organization_id = document.provider_organization_id and membership.status = 'ACTIVE'
    join public.organization_member_roles role on role.membership_id = membership.id and role.revoked_at is null and role.role_code in ('PROVIDER_OWNER','PROVIDER_MANAGER')
    where family.document_kind in ('CERTIFICATION','LICENSE','ACCREDITATION')
      and document.status = 'VERIFIED'
      and document.expires_on - p_as_of in (60, 30, 7)
      and not exists (
        select 1 from public.notification_instances notice
        where notice.recipient_user_id = membership.user_id
          and notice.deduplication_key = 'credential-expiry:' || document.id::text || ':' || (document.expires_on - p_as_of)::text || ':' || membership.user_id::text
      )
  ) into more;
  return jsonb_build_object('outcome', case when more then 'PROVIDER_CREDENTIAL_REMINDERS_PARTIAL' else 'PROVIDER_CREDENTIAL_REMINDERS_COMPLETED' end, 'processed', processed, 'has_more', more, 'as_of', p_as_of);
end;
$$;

create or replace function public.run_domain_automation_schedulers_v1(p_as_of date default current_date, p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private set timezone = 'UTC' as $$
declare
  base_result jsonb;
  reminder_result jsonb;
  credential_result jsonb;
  review_result jsonb;
  more boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'DOMAIN_AUTOMATION_DENIED' using errcode = '42501'; end if;
  if p_as_of is null or not isfinite(p_as_of) or p_limit is null or p_limit not between 1 and 500 then raise exception 'INVALID_DOMAIN_AUTOMATION_INPUT' using errcode = '22023'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('client-domain-automations:' || p_as_of::text, 0)) then return jsonb_build_object('outcome','DOMAIN_AUTOMATIONS_BUSY','has_more',true); end if;
  base_result := private.run_domain_automation_base_v1(p_as_of, p_limit);
  reminder_result := public.run_client_reminder_scheduler_v1(p_as_of, p_limit);
  credential_result := public.enqueue_provider_credential_expiry_reminders_v1(p_as_of, p_limit);
  review_result := public.enqueue_provider_review_notifications_v1(p_limit);
  more := coalesce((base_result->>'has_more')::boolean, false)
    or coalesce((reminder_result->>'has_more')::boolean, false)
    or coalesce((credential_result->>'has_more')::boolean, false)
    or coalesce((review_result->>'has_more')::boolean, false);
  return base_result || jsonb_build_object(
    'client_reminders', reminder_result,
    'provider_credential_reminders', credential_result,
    'provider_review_notifications', review_result,
    'has_more', more,
    'outcome', case when more then 'DOMAIN_AUTOMATIONS_PARTIAL' else base_result->>'outcome' end
  );
end;
$$;

revoke all on function public.enqueue_provider_review_notifications_v1(integer), public.enqueue_provider_credential_expiry_reminders_v1(date, integer), public.run_domain_automation_schedulers_v1(date, integer) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_provider_review_notifications_v1(integer), public.enqueue_provider_credential_expiry_reminders_v1(date, integer), public.run_domain_automation_schedulers_v1(date, integer) to service_role;
notify pgrst, 'reload schema';
