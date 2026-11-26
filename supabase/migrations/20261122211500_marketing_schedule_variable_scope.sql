-- Fix PL/pgSQL record/alias and conflict-target ambiguity without changing authorization.
create or replace function public.schedule_marketing_campaign(
  p_campaign_id uuid,p_items jsonb,p_expected_row_version integer,
  p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,extensions
as $$
declare
  a uuid:=auth.uid();
  c public.marketing_campaigns%rowtype;
  h text;cached jsonb;r jsonb;x jsonb;
  v public.marketing_content_versions%rowtype;
  conn public.social_connections%rowtype;
  rule_id uuid;calendar_id uuid;i uuid;n integer:=0;week_count integer;
  schedule_at timestamptz;v_month_start date;week_start timestamptz;
begin
  select * into c from public.marketing_campaigns where id=p_campaign_id for update;
  if a is null or not found or not private.marketing_manage_access(c.organization_id,a) then
    raise exception'MARKETING_SCHEDULE_DENIED' using errcode='42501';
  end if;
  if c.status<>'APPROVED' or c.row_version<>p_expected_row_version
    or not private.marketing_consent_active(c.organization_id,'SOCIAL_PUBLISHING')
    or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception'MARKETING_CAMPAIGN_NOT_SCHEDULABLE' using errcode='55000';
  end if;
  h:=private.canonical_request_hash(jsonb_build_object('campaign',c.id,'items',p_items,'expected',p_expected_row_version));
  cached:=private.begin_contract_command(c.organization_id,'marketing.campaign.schedule.'||c.id,p_idempotency_key,h,a);
  if cached is not null then return cached;end if;

  for x in select value from jsonb_array_elements(p_items) loop
    schedule_at:=(x->>'scheduled_at')::timestamptz;
    if schedule_at<=clock_timestamp() then
      raise exception'INVALID_MARKETING_SCHEDULE' using errcode='22023';
    end if;
    select cv.* into v from public.marketing_content_versions cv
      join public.marketing_content mc on mc.id=cv.content_id
      where cv.id=(x->>'content_version_id')::uuid and mc.campaign_id=c.id;
    select * into conn from public.social_connections
      where id=(x->>'social_connection_id')::uuid and organization_id=c.organization_id and status='ACTIVE';
    if v.id is null or conn.id is null or v.status<>'APPROVED'
      or v.risk_score>c.risk_threshold
      or(v.expires_at is not null and v.expires_at<=schedule_at)
      or exists(select 1 from jsonb_each_text(v.compliance_checks)q where q.value<>'PASS')
      or exists(select 1 from public.marketing_exceptions e where e.campaign_id=c.id and e.severity='BLOCKING'and e.status='OPEN')
      or not private.marketing_publication_ready_v41(c.organization_id,conn.provider,conn.id,v.id) then
      raise exception'MARKETING_CONTENT_BLOCKED' using errcode='23514';
    end if;

    select head.current_rule_id into rule_id
      from public.social_accounts account
      join public.marketing_schedule_rule_heads head
        on head.organization_id=account.organization_id and head.social_account_id=account.id
      join public.marketing_schedule_rules rule on rule.id=head.current_rule_id and rule.status='ACTIVE'
      where account.organization_id=c.organization_id and account.connection_id=conn.id and account.status='ACTIVE'
      order by account.id limit 1;
    if rule_id is null then
      raise exception'MARKETING_ACTIVE_SCHEDULE_RULE_REQUIRED' using errcode='55000';
    end if;

    v_month_start:=date_trunc('month',schedule_at)::date;
    insert into public.marketing_calendars(
      organization_id,schedule_rule_id,month_start,status,generated_at,approved_by,approved_at
    ) values(c.organization_id,rule_id,v_month_start,'SCHEDULED',clock_timestamp(),c.approved_by,c.approved_at)
    on conflict(organization_id,schedule_rule_id,month_start)
    do update set status=case when marketing_calendars.status in('DRAFT','GENERATED','VALIDATED_BY_RULES','APPROVED')
      then'SCHEDULED'else marketing_calendars.status end,row_version=marketing_calendars.row_version+1
    returning id into calendar_id;

    week_start:=date_trunc('week',schedule_at);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.organization_id::text||':'||week_start::text,0));
    select count(*) into week_count from public.marketing_calendar_items ci
      join public.marketing_campaigns mc on mc.id=ci.campaign_id
      where mc.organization_id=c.organization_id
        and ci.scheduled_at>=week_start and ci.scheduled_at<week_start+interval'7 days'
        and ci.status in('SCHEDULED','PUBLISHED');
    if week_count>=c.frequency_max_weekly then
      raise exception'MARKETING_FREQUENCY_LIMIT' using errcode='23514';
    end if;

    insert into public.marketing_calendar_items(
      campaign_id,content_version_id,social_connection_id,scheduled_at,status,calendar_id
    ) values(c.id,v.id,conn.id,schedule_at,'SCHEDULED',calendar_id) returning id into i;
    insert into public.social_publication_jobs(
      organization_id,calendar_item_id,provider,status,idempotency_key,available_at
    ) values(c.organization_id,i,conn.provider,'QUEUED',p_idempotency_key||':'||n,schedule_at);
    insert into public.event_outbox(
      organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key
    ) values(c.organization_id,'marketing_calendar_item',i::text,'SocialPublicationScheduledV1',
      p_correlation_id,jsonb_build_object('calendar_id',calendar_id,'calendar_item_id',i,
      'content_version_id',v.id,'provider',conn.provider),p_idempotency_key||':'||n);
    n:=n+1;
  end loop;
  update public.marketing_campaigns set status='SCHEDULED',row_version=row_version+1 where id=c.id;
  r:=jsonb_build_object('outcome','MARKETING_CAMPAIGN_SCHEDULED','campaign_id',c.id,'scheduled_count',n);
  insert into public.audit_events(
    organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash
  ) values(c.organization_id,a,'USER','marketing.campaign.scheduled','marketing_campaign',c.id::text,
    p_correlation_id,r,repeat('0',64));
  perform private.finish_contract_command(c.organization_id,'marketing.campaign.schedule.'||c.id,p_idempotency_key,r);
  return r;
exception when invalid_text_representation then
  raise exception'INVALID_MARKETING_SCHEDULE' using errcode='22023';
end$$;
