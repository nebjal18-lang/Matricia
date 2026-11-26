begin;

create or replace function public.schedule_franchise_followups(p_now timestamptz default clock_timestamp(), p_limit integer default 100)
returns setof jsonb language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare candidate record; delay_row record; job_id uuid; created_count integer := 0; recent_count integer; allowed_count integer; corr uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'FRANCHISE_FOLLOWUP_SCHEDULER_ONLY' using errcode = '42501'; end if;
  if p_limit not between 1 and 500 then raise exception 'INVALID_FRANCHISE_FOLLOWUP_SCHEDULE_LIMIT' using errcode = '22023'; end if;
  for candidate in
    select prospect.*, policy.id policy_id, policy.reminder_delays_minutes, policy.retry_delays_minutes,
      policy.maximum_attempts, policy.maximum_reminders_per_7_days policy_weekly_limit, policy.lease_seconds,
      preference.id preference_id, preference.locale, preference.maximum_reminders_per_7_days preference_weekly_limit
    from public.franchise_crm_prospects prospect
    join public.franchises franchise on franchise.id = prospect.franchise_id and franchise.status = 'ACTIVE'
    join lateral (select p.* from public.franchise_followup_policy_versions p where p.franchise_id = prospect.franchise_id and p.status = 'ACTIVE' and p.effective_from <= p_now and (p.effective_until is null or p.effective_until > p_now) order by p.version desc limit 1) policy on prospect.pipeline_stage = any(policy.eligible_stages)
    join lateral (select preference.* from public.franchise_followup_preference_versions preference where preference.prospect_id = prospect.id and preference.effective_from <= p_now order by preference.version desc limit 1) preference on preference.contact_allowed and preference.email_allowed and preference.maximum_reminders_per_7_days > 0
    where prospect.next_followup_at is not null and prospect.next_followup_at <= p_now
    order by prospect.next_followup_at, prospect.id
    limit p_limit
  loop
    select count(*) into recent_count from public.franchise_followup_jobs j where j.prospect_id = candidate.id and j.created_at >= p_now - interval '7 days' and j.status not in ('CANCELLED','DEAD_LETTER');
    allowed_count := least(candidate.policy_weekly_limit,candidate.preference_weekly_limit) - recent_count;
    if allowed_count <= 0 then continue; end if;
    for delay_row in
      select delay.delay_minutes::integer delay_minutes, delay.ordinality::integer ordinal
      from unnest(candidate.reminder_delays_minutes) with ordinality as delay(delay_minutes,ordinality)
      where candidate.next_followup_at + make_interval(mins => delay.delay_minutes::integer) <= p_now
      order by delay.ordinality
      limit allowed_count
    loop
      exit when created_count >= p_limit;
      corr := extensions.gen_random_uuid(); job_id := null;
      insert into public.franchise_followup_jobs(franchise_id,prospect_id,policy_version_id,preference_version_id,followup_anchor_at,reminder_ordinal,channel,locale,next_attempt_at,maximum_attempts_snapshot,retry_delays_minutes_snapshot,lease_seconds_snapshot,correlation_id)
      values(candidate.franchise_id,candidate.id,candidate.policy_id,candidate.preference_id,candidate.next_followup_at,delay_row.ordinal,'EMAIL',candidate.locale,greatest(p_now,candidate.next_followup_at + make_interval(mins => delay_row.delay_minutes)),candidate.maximum_attempts,candidate.retry_delays_minutes,candidate.lease_seconds,corr)
      on conflict(prospect_id,policy_version_id,followup_anchor_at,reminder_ordinal) do nothing returning id into job_id;
      if job_id is not null then
        created_count := created_count + 1;
        insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
        select f.operator_organization_id,null,'SYSTEM','franchise.followup.scheduled','franchise_followup_job',job_id::text,corr,jsonb_build_object('franchise_id',candidate.franchise_id,'prospect_id',candidate.id,'policy_version_id',candidate.policy_id,'preference_version_id',candidate.preference_id,'reminder_ordinal',delay_row.ordinal),repeat('0',64) from public.franchises f where f.id = candidate.franchise_id;
        return next jsonb_build_object('job_id',job_id,'franchise_id',candidate.franchise_id,'prospect_id',candidate.id,'reminder_ordinal',delay_row.ordinal);
      end if;
    end loop;
    exit when created_count >= p_limit;
  end loop;
  return;
end $$;

notify pgrst,'reload schema';
commit;
