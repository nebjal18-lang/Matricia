-- Advance a linked franchise prospect by exactly one stage when the real event occurs.
-- A later event does not skip the missing stages. Manual advance remains available.
-- The organization link is added here when an older database has not yet applied it.
-- Network referrals are used only when that table is present.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'franchise_crm_prospects' and column_name = 'linked_organization_id'
  ) then
    alter table public.franchise_crm_prospects
      add column linked_organization_id uuid references public.organizations(id) on delete restrict;
    create index franchise_crm_linked_provider_idx
      on public.franchise_crm_prospects(franchise_id, linked_organization_id)
      where linked_organization_id is not null;
  end if;
end $$;

create function private.auto_advance_franchise_pipeline_v1(
  p_organization_id uuid,
  p_prospect_type text,
  p_target_stage text,
  p_reason_code text,
  p_evidence_id text
) returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  stages text[] := array['SENT','OPENED','REGISTERED','PROFILE_STARTED','VERIFIED','DIAGNOSTIC_STARTED','OPPORTUNITY_CREATED','RFQ_STARTED','CONTRACT_SIGNED'];
  target_position integer := array_position(stages, p_target_stage);
  prospect public.franchise_crm_prospects%rowtype;
  actor uuid;
  advanced integer := 0;
  match_query text := 'select candidate.* from public.franchise_crm_prospects candidate where candidate.prospect_type = $1 and array_position($2, candidate.pipeline_stage) = $3 and (candidate.linked_organization_id = $4';
begin
  if p_organization_id is null or p_prospect_type not in ('CLIENT','PROVIDER') or target_position is null or length(p_reason_code) not between 3 and 80 or length(coalesce(p_evidence_id, '')) not between 1 and 80 then
    return 0;
  end if;
  if to_regclass('public.franchise_network_referrals') is not null then
    match_query := match_query || ' or exists (select 1 from public.franchise_network_referrals referral where referral.prospect_id = candidate.id and referral.target_organization_id = $4)';
  end if;
  match_query := match_query || ') for update';
  for prospect in execute match_query using p_prospect_type, stages, target_position - 1, p_organization_id
  loop
    actor := coalesce(auth.uid(), prospect.owner_user_id);
    update public.franchise_crm_prospects
    set pipeline_stage = p_target_stage, updated_at = clock_timestamp(), row_version = row_version + 1
    where id = prospect.id and pipeline_stage = prospect.pipeline_stage;
    if found then
      insert into public.franchise_pipeline_events(franchise_id, prospect_id, from_stage, to_stage, reason_code, evidence_refs, idempotency_key, actor_user_id, correlation_id)
      values (
        prospect.franchise_id, prospect.id, prospect.pipeline_stage, p_target_stage, p_reason_code,
        jsonb_build_array(jsonb_build_object('reference', p_evidence_id)),
        'auto:' || p_target_stage || ':' || p_evidence_id,
        actor, extensions.gen_random_uuid()
      )
      on conflict (prospect_id, idempotency_key) do nothing;
      advanced := advanced + 1;
    end if;
  end loop;
  return advanced;
end;
$$;
revoke all on function private.auto_advance_franchise_pipeline_v1(uuid,text,text,text,text) from public, anon, authenticated, service_role;

create function private.capture_franchise_profile_started_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform private.auto_advance_franchise_pipeline_v1(new.organization_id, tg_argv[0], 'PROFILE_STARTED', 'PROFILE_OPENED', new.id::text);
  return new;
end;
$$;
create function private.capture_franchise_verified_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.status = 'VERIFIED' and old.status is distinct from 'VERIFIED' then
    perform private.auto_advance_franchise_pipeline_v1(new.organization_id, 'CLIENT', 'VERIFIED', 'COMPANY_VERIFIED', new.id::text);
  end if;
  return new;
end;
$$;
create function private.capture_franchise_diagnostic_started_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform private.auto_advance_franchise_pipeline_v1(new.organization_id, 'CLIENT', 'DIAGNOSTIC_STARTED', 'DIAGNOSTIC_STARTED', new.id::text);
  return new;
end;
$$;
create function private.capture_franchise_opportunity_created_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform private.auto_advance_franchise_pipeline_v1(new.organization_id, 'CLIENT', 'OPPORTUNITY_CREATED', 'OPPORTUNITY_CREATED', new.id::text);
  return new;
end;
$$;
create function private.capture_franchise_rfq_started_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare organization_id uuid;
begin
  select request.client_organization_id into organization_id
  from public.service_requests request
  where request.id = new.request_id;
  perform private.auto_advance_franchise_pipeline_v1(organization_id, 'CLIENT', 'RFQ_STARTED', 'RFQ_OPENED', new.id::text);
  return new;
end;
$$;
create function private.capture_franchise_contract_signed_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.status = 'ACTIVE' and old.status is distinct from 'ACTIVE' then
    perform private.auto_advance_franchise_pipeline_v1(new.client_organization_id, 'CLIENT', 'CONTRACT_SIGNED', 'CONTRACT_ACTIVE', new.id::text);
    perform private.auto_advance_franchise_pipeline_v1(new.provider_organization_id, 'PROVIDER', 'CONTRACT_SIGNED', 'CONTRACT_ACTIVE', new.id::text);
  end if;
  return new;
end;
$$;
create function private.capture_provider_profile_started_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform private.auto_advance_franchise_pipeline_v1(new.provider_organization_id, 'PROVIDER', 'PROFILE_STARTED', 'PROFILE_OPENED', new.provider_organization_id::text);
  return new;
end;
$$;
create function private.capture_provider_company_verified_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.company_status = 'VERIFIED' then
    perform private.auto_advance_franchise_pipeline_v1(new.provider_organization_id, 'PROVIDER', 'VERIFIED', 'COMPANY_VERIFIED', new.id::text);
  end if;
  return new;
end;
$$;
revoke all on function private.capture_franchise_profile_started_v1(), private.capture_franchise_verified_v1(), private.capture_franchise_diagnostic_started_v1(), private.capture_franchise_opportunity_created_v1(), private.capture_franchise_rfq_started_v1(), private.capture_franchise_contract_signed_v1(), private.capture_provider_profile_started_v1(), private.capture_provider_company_verified_v1() from public, anon, authenticated, service_role;

create trigger franchise_pipeline_client_profile after insert on public.client_profile_versions
  for each row execute function private.capture_franchise_profile_started_v1('CLIENT');
create trigger franchise_pipeline_client_verified after update of status on public.client_compliance_cases
  for each row execute function private.capture_franchise_verified_v1();
create trigger franchise_pipeline_diagnostic_run after insert on public.diagnostic_runs
  for each row execute function private.capture_franchise_diagnostic_started_v1();
create trigger franchise_pipeline_public_intake after insert on public.public_diagnostic_intakes
  for each row execute function private.capture_franchise_diagnostic_started_v1();
create trigger franchise_pipeline_opportunity after insert on public.diagnostic_opportunities
  for each row execute function private.capture_franchise_opportunity_created_v1();
create trigger franchise_pipeline_public_opportunity after insert on public.public_diagnostic_opportunities
  for each row execute function private.capture_franchise_opportunity_created_v1();
create trigger franchise_pipeline_rfq after insert on public.rfqs
  for each row execute function private.capture_franchise_rfq_started_v1();
create trigger franchise_pipeline_contract after update of status on public.contracts
  for each row execute function private.capture_franchise_contract_signed_v1();
create trigger franchise_pipeline_provider_profile after insert on public.provider_profiles
  for each row execute function private.capture_provider_profile_started_v1();
create trigger franchise_pipeline_provider_verified after insert on public.provider_company_decisions
  for each row execute function private.capture_provider_company_verified_v1();
notify pgrst, 'reload schema';
