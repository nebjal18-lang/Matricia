begin;
-- Stable request identity precedes mutable-state checks; current authorization and dual control remain mandatory.
-- Additive anti-oracle hardening for referral conversion transitions.

create or replace function public.advance_referral_conversion(
  p_referral_conversion_id uuid,
  p_to_stage text,
  p_evidence_refs jsonb,
  p_evidence_hash text,
  p_expected_row_version integer,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private,extensions
as $$
declare
  a uuid:=auth.uid();
  c public.referral_conversions%rowtype;
  expected text;
  verified_actor uuid;
  h text;
  cached jsonb;
  r jsonb;
begin
  if a is null then
    raise exception 'REFERRAL_REQUEST_DENIED' using errcode='42501';
  end if;

  select conversion.* into c
  from public.referral_conversions conversion
  where conversion.id=p_referral_conversion_id
    and (
      private.has_org_role(
        conversion.target_organization_id,
        array['CLIENT_OWNER','CLIENT_ADMIN','PROVIDER_OWNER','PROVIDER_MANAGER'],
        a
      )
      or private.has_platform_role(
        array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','COMPLIANCE_MANAGER'],
        a
      )
    );
  if not found then
    raise exception 'REFERRAL_REQUEST_DENIED' using errcode='42501';
  end if;

  expected:=case c.conversion_stage
    when 'REGISTERED' then 'PROFILE_STARTED'
    when 'PROFILE_STARTED' then 'VERIFIED'
    when 'VERIFIED' then 'ACTIVE'
  end;
  if p_to_stage is null or p_to_stage not in('PROFILE_STARTED','VERIFIED','ACTIVE')
    or p_expected_row_version is null or p_expected_row_version<1
    or jsonb_typeof(p_evidence_refs) is distinct from 'array'
    or jsonb_array_length(p_evidence_refs)=0
    or coalesce(p_evidence_hash,'')!~'^[0-9a-f]{64}$' then
    raise exception 'INVALID_REFERRAL_TRANSITION' using errcode='55000';
  end if;

  if p_to_stage='PROFILE_STARTED' then
    if not private.has_org_role(
      c.target_organization_id,
      array['CLIENT_OWNER','CLIENT_ADMIN','PROVIDER_OWNER','PROVIDER_MANAGER'],
      a
    ) then
      raise exception 'REFERRAL_PROFILE_TARGET_REQUIRED' using errcode='42501';
    end if;
  else
    if not private.rewards_sensitive_aal2(a) then
      raise exception 'REFERRAL_VERIFICATION_AAL2_REQUIRED' using errcode='42501';
    end if;
    if a=c.registered_by then
      raise exception 'REFERRAL_DUAL_CONTROL_REQUIRED' using errcode='42501';
    end if;
    if not exists(
      select 1 from public.organizations o
      where o.id=c.target_organization_id and o.status='ACTIVE'
    ) or not (
      exists(select 1 from public.client_compliance_cases q where q.organization_id=c.target_organization_id and q.status='VERIFIED')
      or exists(select 1 from public.provider_profiles q where q.provider_organization_id=c.target_organization_id and q.company_status='VERIFIED')
    ) then
      raise exception 'AUTHORITATIVE_ORGANIZATION_VERIFICATION_REQUIRED' using errcode='23514';
    end if;
    if p_to_stage='ACTIVE' then
      select actor_user_id into verified_actor
      from public.referral_conversion_events
      where referral_conversion_id=c.id and to_stage='VERIFIED';
      if verified_actor is null or verified_actor=a then
        raise exception 'REFERRAL_ACTIVATION_DUAL_CONTROL_REQUIRED' using errcode='42501';
      end if;
    end if;
  end if;

  h:=private.canonical_request_hash(jsonb_build_object(
    'conversion',c.id,'from',case p_to_stage when 'PROFILE_STARTED' then 'REGISTERED' when 'VERIFIED' then 'PROFILE_STARTED' when 'ACTIVE' then 'VERIFIED' end,'to',p_to_stage,
    'evidence',p_evidence_refs,'evidence_hash',p_evidence_hash,
    'expected',p_expected_row_version
  ));
  cached:=private.begin_rewards_command(c.target_organization_id,a,'referral.conversion.advance',p_idempotency_key,h);
  if cached is not null then return cached; end if;

  if p_to_stage is distinct from expected or p_expected_row_version<>c.row_version then
    raise exception 'INVALID_REFERRAL_TRANSITION' using errcode='55000';
  end if;

  update public.referral_conversions
  set conversion_stage=p_to_stage,updated_at=clock_timestamp(),row_version=row_version+1
  where id=c.id and row_version=p_expected_row_version;
  if not found then
    raise exception 'STALE_REFERRAL_CONVERSION' using errcode='PT409';
  end if;
  insert into public.referral_conversion_events(
    referral_conversion_id,source_organization_id,from_stage,to_stage,evidence_refs,
    evidence_hash,correlation_id,actor_user_id
  ) values(
    c.id,c.source_organization_id,c.conversion_stage,p_to_stage,p_evidence_refs,
    p_evidence_hash,p_correlation_id,a
  );
  r:=jsonb_build_object(
    'outcome','REFERRAL_STAGE_ADVANCED','referral_conversion_id',c.id,
    'conversion_stage',p_to_stage,'row_version',c.row_version+1
  );
  insert into public.audit_events(
    organization_id,actor_user_id,actor_type,action,resource_type,resource_id,
    correlation_id,metadata,event_hash
  ) values(
    c.target_organization_id,a,'USER','referral.conversion.advanced',
    'referral_conversion',c.id::text,p_correlation_id,
    jsonb_build_object('from_stage',c.conversion_stage,'to_stage',p_to_stage,
      'source_organization_id',c.source_organization_id,'evidence_hash',p_evidence_hash),
    repeat('0',64)
  );
  insert into public.event_outbox(
    organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key
  ) values(
    c.target_organization_id,'referral_conversion',c.id::text,
    case when p_to_stage='VERIFIED' then 'ReferralVerifiedV1'
      when p_to_stage='ACTIVE' then 'ReferralActivatedV1'
      else 'ReferralProfileStartedV1' end,
    p_correlation_id,r,p_idempotency_key
  );
  perform private.finish_rewards_command(c.target_organization_id,'referral.conversion.advance',p_idempotency_key,r);
  return r;
end;
$$;

revoke all on function public.advance_referral_conversion(uuid,text,jsonb,text,integer,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.advance_referral_conversion(uuid,text,jsonb,text,integer,text,uuid)
  to authenticated;

notify pgrst,'reload schema';
commit;
