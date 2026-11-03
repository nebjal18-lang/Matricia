-- Close the onboarding chains opened by 20261103457000..457300.
-- 1. A first-visit diagnostic opportunity opens a real need intake for one versioned service hint.
-- 2. A franchise pipeline catches up every stage that has its own evidence, never a stage without it.
-- 3. A franchise candidate links its own operator organization; an admin proposes the mandate from the dossier.
-- Rollback: revoke the new functions and drop the new triggers. Intakes, events and mandates stay as history.

-- 1. Diagnostic opportunity -> need intake -------------------------------------------------------

create table public.public_diagnostic_service_hints (
  policy_version text not null check (policy_version = 'PUBLIC_DIAGNOSTIC_V1'),
  finding_prefix text not null check (finding_prefix ~ '^[A-Z]{2,40}_$'),
  library_code text not null check (library_code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  library_name_fr text not null check (length(btrim(library_name_fr)) between 2 and 200),
  library_name_ar text not null check (length(btrim(library_name_ar)) between 2 and 200),
  service_code text not null check (service_code ~ '^[A-Z][A-Z0-9_]*-[A-Z0-9_-]+$'),
  service_name_fr text not null check (length(btrim(service_name_fr)) between 2 and 200),
  service_name_ar text not null check (length(btrim(service_name_ar)) between 2 and 200),
  primary key (policy_version, finding_prefix)
);
insert into public.public_diagnostic_service_hints values
  ('PUBLIC_DIAGNOSTIC_V1','ORGANIZATION_','QHSE','Qualité, HSE et certifications','الجودة والصحة والسلامة والبيئة والشهادات','QHSE-PROCESS','Cartographie et optimisation des processus','رسم العمليات وتحسينها'),
  ('PUBLIC_DIAGNOSTIC_V1','SALES_','SALES','Commercial, vente et expérience client','التجارة والمبيعات وتجربة العملاء','SALES-CRM-IMPL','Choix et déploiement CRM','اختيار ونشر نظام إدارة علاقات العملاء'),
  ('PUBLIC_DIAGNOSTIC_V1','BACKUP_','IT','Informatique, cybersécurité et data','تكنولوجيا المعلومات والأمن السيبراني والبيانات','IT-BACKUP','Sauvegarde, restauration et archivage','النسخ الاحتياطي والاستعادة والأرشفة'),
  ('PUBLIC_DIAGNOSTIC_V1','DECISION_','LEGAL','Juridique, conformité et gouvernance','الشؤون القانونية والامتثال والحوكمة','LEGAL-GOV','Mise en place de la gouvernance et délégations','إرساء الحوكمة والتفويضات');
create trigger public_diagnostic_service_hints_immutable before update or delete on public.public_diagnostic_service_hints
  for each row execute function private.prevent_diagnostic_result_change();
alter table public.public_diagnostic_service_hints enable row level security;
revoke all on public.public_diagnostic_service_hints from public, anon, authenticated, service_role;
create policy public_diagnostic_service_hints_read on public.public_diagnostic_service_hints for select to authenticated using (true);
grant select on public.public_diagnostic_service_hints to authenticated;

alter table public.public_diagnostic_opportunities
  add column need_intake_id uuid references public.public_need_intakes(id) on delete restrict,
  add column service_code text check (service_code is null or service_code ~ '^[A-Z][A-Z0-9_]*-[A-Z0-9_-]+$');
update public.public_diagnostic_opportunities set status = 'DETECTED', row_version = row_version + 1, updated_at = clock_timestamp()
where status = 'NEED_REQUESTED' and need_intake_id is null;
alter table public.public_diagnostic_opportunities
  add constraint public_diagnostic_opportunities_need_link check ((status = 'NEED_REQUESTED') = (need_intake_id is not null and service_code is not null));

create or replace function public.act_on_public_diagnostic_opportunity(
  p_opportunity_id uuid,
  p_action text,
  p_deferred_until date,
  p_expected_row_version integer,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  opportunity public.public_diagnostic_opportunities%rowtype;
  finding public.public_diagnostic_findings%rowtype;
  hint public.public_diagnostic_service_hints%rowtype;
  intake_locale text;
  payload jsonb;
  v_hash text;
  v_intake_id uuid;
  next_status text;
  correlation uuid := extensions.gen_random_uuid();
  response jsonb;
begin
  select * into opportunity from public.public_diagnostic_opportunities where id = p_opportunity_id for update;
  if actor is null or not found or not private.has_org_role(opportunity.organization_id, array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'], actor) then
    raise exception 'PUBLIC_DIAGNOSTIC_OPPORTUNITY_DENIED' using errcode = '42501';
  end if;
  if p_action not in ('CLOSE','DEFER','REQUEST_QUOTES') or length(coalesce(p_idempotency_key, '')) not between 8 and 200 or opportunity.row_version <> p_expected_row_version then
    raise exception 'PUBLIC_DIAGNOSTIC_OPPORTUNITY_INVALID' using errcode = '22023';
  end if;
  if opportunity.status <> 'DETECTED' or (p_action = 'DEFER' and (p_deferred_until is null or p_deferred_until <= current_date)) then
    raise exception 'PUBLIC_DIAGNOSTIC_OPPORTUNITY_TRANSITION_DENIED' using errcode = '55000';
  end if;
  next_status := case p_action when 'CLOSE' then 'CLOSED' when 'DEFER' then 'DEFERRED' else 'NEED_REQUESTED' end;
  if p_action = 'REQUEST_QUOTES' then
    select * into finding from public.public_diagnostic_findings where id = opportunity.finding_id;
    select * into hint from public.public_diagnostic_service_hints
    where policy_version = 'PUBLIC_DIAGNOSTIC_V1' and finding_prefix = split_part(finding.code, '_', 1) || '_';
    if hint.service_code is null then raise exception 'PUBLIC_DIAGNOSTIC_SERVICE_HINT_MISSING' using errcode = '55000'; end if;
    select case when intake.locale like 'ar%' then 'ar' else 'fr' end into intake_locale
    from public.public_diagnostic_promotions promotion
    join public.public_diagnostic_intakes intake on intake.id = promotion.intake_id
    where promotion.id = opportunity.promotion_id;
    intake_locale := coalesce(intake_locale, 'fr');
    payload := jsonb_build_object(
      'need', case when intake_locale = 'ar'
        then 'بعد تشخيص ماتريسيا: ' || finding.title_ar || '. ' || finding.client_text_ar
        else 'Suite au diagnostic Matricia : ' || finding.title_fr || '. ' || finding.client_text_fr end,
      'location', '',
      'timing', '',
      'constraints', case when intake_locale = 'ar'
        then 'الخدمة المحددة: ' || hint.service_name_ar || ' (' || hint.service_code || '). المجال: ' || hint.library_name_ar || ' (' || hint.library_code || ').'
        else 'Service présélectionné : ' || hint.service_name_fr || ' (' || hint.service_code || '). Domaine : ' || hint.library_name_fr || ' (' || hint.library_code || ').' end
    );
    v_hash := encode(extensions.digest(convert_to(jsonb_build_object('version','PUBLIC_NEED_V1','organization_id',opportunity.organization_id,'payload',payload)::text,'UTF8'),'sha256'),'hex');
    perform pg_advisory_xact_lock(hashtextextended('public-need-intake:' || opportunity.organization_id::text || ':' || v_hash, 0));
    select need.id into v_intake_id from public.public_need_intakes need where need.organization_id = opportunity.organization_id and need.content_hash = v_hash;
    if v_intake_id is null then
      insert into public.public_need_intakes(organization_id, created_by, locale, need_text, location_text, timing_text, constraints_text, content_hash)
      values (opportunity.organization_id, actor, intake_locale, payload->>'need', '', '', payload->>'constraints', v_hash)
      returning id into v_intake_id;
      insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
      values (opportunity.organization_id, actor, 'USER', 'public_need.intake.saved', 'public_need_intake', v_intake_id::text, correlation,
        jsonb_build_object('content_hash', v_hash, 'source', 'PUBLIC_DIAGNOSTIC_OPPORTUNITY', 'opportunity_id', opportunity.id), repeat('0',64));
      insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
      values (opportunity.organization_id, 'public_need_intake', v_intake_id::text, 'PublicNeedIntakeSavedV1', correlation,
        jsonb_build_object('intake_id', v_intake_id, 'status', 'DRAFT_REVIEW', 'source', 'PUBLIC_DIAGNOSTIC_OPPORTUNITY'), 'public-need-intake:' || v_hash)
      on conflict do nothing;
    end if;
  end if;
  update public.public_diagnostic_opportunities
  set status = next_status,
      deferred_until = case when p_action = 'DEFER' then p_deferred_until else null end,
      need_intake_id = v_intake_id,
      service_code = hint.service_code,
      row_version = row_version + 1,
      updated_at = clock_timestamp()
  where id = opportunity.id and row_version = p_expected_row_version;
  if not found then raise exception 'STALE_PUBLIC_DIAGNOSTIC_OPPORTUNITY' using errcode = '40001'; end if;
  response := jsonb_build_object('outcome','PUBLIC_DIAGNOSTIC_OPPORTUNITY_' || p_action,'opportunity_id',opportunity.id,'status',next_status,
    'row_version',opportunity.row_version + 1,'need_intake_id',v_intake_id,'service_code',hint.service_code);
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (opportunity.organization_id, actor, 'USER', 'public_diagnostic.opportunity.' || lower(p_action), 'public_diagnostic_opportunity', opportunity.id::text, correlation,
    jsonb_build_object('status',next_status,'idempotency_key',p_idempotency_key,'need_intake_id',v_intake_id), repeat('0',64));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (opportunity.organization_id, 'public_diagnostic_opportunity', opportunity.id::text, 'PublicDiagnosticOpportunityDecidedV1', correlation, response,
    'public-diagnostic-opportunity:' || opportunity.id::text || ':' || p_idempotency_key)
  on conflict do nothing;
  return response;
end;
$$;
revoke all on function public.act_on_public_diagnostic_opportunity(uuid,text,date,integer,text) from public, anon, authenticated, service_role;
grant execute on function public.act_on_public_diagnostic_opportunity(uuid,text,date,integer,text) to authenticated;

-- 2. Evidence-based pipeline catch-up -------------------------------------------------------------

create function private.franchise_pipeline_stage_evidence_v1(p_organization_id uuid, p_prospect_type text, p_stage text) returns text
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare evidence text;
begin
  if p_stage in ('OPENED','REGISTERED') then
    select id::text into evidence from public.organizations where id = p_organization_id and status <> 'ARCHIVED';
  elsif p_prospect_type = 'CLIENT' then
    case p_stage
      when 'PROFILE_STARTED' then
        select id::text into evidence from public.client_profile_versions where organization_id = p_organization_id order by created_at, id limit 1;
      when 'VERIFIED' then
        select id::text into evidence from public.client_compliance_cases where organization_id = p_organization_id and (status = 'VERIFIED' or verified_at is not null) order by created_at, id limit 1;
      when 'DIAGNOSTIC_STARTED' then
        select coalesce(
          (select id::text from public.diagnostic_runs where organization_id = p_organization_id order by completed_at nulls last, id limit 1),
          (select id::text from public.public_diagnostic_intakes where organization_id = p_organization_id order by created_at, id limit 1)) into evidence;
      when 'OPPORTUNITY_CREATED' then
        select coalesce(
          (select id::text from public.diagnostic_opportunities where organization_id = p_organization_id order by created_at, id limit 1),
          (select id::text from public.public_diagnostic_opportunities where organization_id = p_organization_id order by created_at, id limit 1)) into evidence;
      when 'RFQ_STARTED' then
        select rfq.id::text into evidence from public.rfqs rfq join public.service_requests request on request.id = rfq.request_id
        where request.client_organization_id = p_organization_id order by rfq.id limit 1;
      when 'CONTRACT_SIGNED' then
        select id::text into evidence from public.contracts where client_organization_id = p_organization_id and status = 'ACTIVE' order by id limit 1;
      else evidence := null;
    end case;
  elsif p_prospect_type = 'PROVIDER' then
    case p_stage
      when 'PROFILE_STARTED' then
        select provider_organization_id::text into evidence from public.provider_profiles where provider_organization_id = p_organization_id limit 1;
      when 'VERIFIED' then
        select id::text into evidence from public.provider_company_decisions where provider_organization_id = p_organization_id and company_status = 'VERIFIED' order by decided_at, id limit 1;
      when 'DIAGNOSTIC_STARTED' then
        select provider_organization_id::text into evidence from public.provider_qualifications where provider_organization_id = p_organization_id limit 1;
      when 'OPPORTUNITY_CREATED' then
        select provider_organization_id::text into evidence from public.matching_candidates where provider_organization_id = p_organization_id limit 1;
      when 'RFQ_STARTED' then
        select provider_organization_id::text into evidence from public.rfq_providers where provider_organization_id = p_organization_id limit 1;
      when 'CONTRACT_SIGNED' then
        select id::text into evidence from public.contracts where provider_organization_id = p_organization_id and status = 'ACTIVE' order by id limit 1;
      else evidence := null;
    end case;
  end if;
  return evidence;
end;
$$;
revoke all on function private.franchise_pipeline_stage_evidence_v1(uuid,text,text) from public, anon, authenticated, service_role;

create function private.catch_up_franchise_prospect_v1(
  p_prospect_id uuid,
  p_organization_id uuid,
  p_trigger_stage text,
  p_trigger_reason text,
  p_trigger_evidence text
) returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  stages text[] := array['SENT','OPENED','REGISTERED','PROFILE_STARTED','VERIFIED','DIAGNOSTIC_STARTED','OPPORTUNITY_CREATED','RFQ_STARTED','CONTRACT_SIGNED'];
  prospect public.franchise_crm_prospects%rowtype;
  idx integer;
  stage text;
  evidence text;
  reason text;
  advanced integer := 0;
begin
  if p_organization_id is null then return 0; end if;
  select * into prospect from public.franchise_crm_prospects where id = p_prospect_id for update;
  if not found then return 0; end if;
  for idx in coalesce(array_position(stages, prospect.pipeline_stage), 1) + 1 .. array_length(stages, 1) loop
    stage := stages[idx];
    if stage = p_trigger_stage and length(coalesce(p_trigger_evidence, '')) between 1 and 80 then
      evidence := p_trigger_evidence;
      reason := p_trigger_reason;
    else
      evidence := private.franchise_pipeline_stage_evidence_v1(p_organization_id, prospect.prospect_type, stage);
      reason := 'EVIDENCE_CATCH_UP';
    end if;
    exit when evidence is null;
    update public.franchise_crm_prospects
    set pipeline_stage = stage, updated_at = clock_timestamp(), row_version = row_version + 1
    where id = prospect.id;
    insert into public.franchise_pipeline_events(franchise_id, prospect_id, from_stage, to_stage, reason_code, evidence_refs, idempotency_key, actor_user_id, correlation_id)
    values (prospect.franchise_id, prospect.id, stages[idx - 1], stage, reason,
      jsonb_build_array(jsonb_build_object('reference', evidence)),
      'auto:' || stage || ':' || evidence, coalesce(auth.uid(), prospect.owner_user_id), extensions.gen_random_uuid())
    on conflict (prospect_id, idempotency_key) do nothing;
    advanced := advanced + 1;
  end loop;
  return advanced;
end;
$$;
revoke all on function private.catch_up_franchise_prospect_v1(uuid,uuid,text,text,text) from public, anon, authenticated, service_role;

create or replace function private.auto_advance_franchise_pipeline_v1(
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
  prospect_id uuid;
  advanced integer := 0;
  match_query text := 'select candidate.id from public.franchise_crm_prospects candidate where candidate.prospect_type = $1 and array_position($2, candidate.pipeline_stage) < $3 and (candidate.linked_organization_id = $4';
begin
  if p_organization_id is null or p_prospect_type not in ('CLIENT','PROVIDER') or target_position is null or length(p_reason_code) not between 3 and 80 or length(coalesce(p_evidence_id, '')) not between 1 and 80 then
    return 0;
  end if;
  if to_regclass('public.franchise_network_referrals') is not null then
    match_query := match_query || ' or exists (select 1 from public.franchise_network_referrals referral where referral.prospect_id = candidate.id and referral.target_organization_id = $4)';
  end if;
  match_query := match_query || ') order by candidate.id';
  for prospect_id in execute match_query using p_prospect_type, stages, target_position, p_organization_id
  loop
    advanced := advanced + private.catch_up_franchise_prospect_v1(prospect_id, p_organization_id, p_target_stage, p_reason_code, p_evidence_id);
  end loop;
  return advanced;
end;
$$;
revoke all on function private.auto_advance_franchise_pipeline_v1(uuid,text,text,text,text) from public, anon, authenticated, service_role;

create function private.capture_franchise_prospect_linked_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.linked_organization_id is not null and (tg_op = 'INSERT' or old.linked_organization_id is distinct from new.linked_organization_id) then
    perform private.catch_up_franchise_prospect_v1(new.id, new.linked_organization_id, null, null, null);
  end if;
  return null;
end;
$$;
create function private.capture_franchise_referral_linked_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform private.catch_up_franchise_prospect_v1(new.prospect_id, new.target_organization_id, null, null, null);
  return null;
end;
$$;
create function private.capture_provider_pipeline_stage_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform private.auto_advance_franchise_pipeline_v1(new.provider_organization_id, 'PROVIDER', tg_argv[0], tg_argv[1],
    coalesce(to_jsonb(new)->>'id', new.provider_organization_id::text));
  return null;
end;
$$;
revoke all on function private.capture_franchise_prospect_linked_v1(), private.capture_franchise_referral_linked_v1(), private.capture_provider_pipeline_stage_v1() from public, anon, authenticated, service_role;

create trigger franchise_pipeline_prospect_linked after insert or update of linked_organization_id on public.franchise_crm_prospects
  for each row execute function private.capture_franchise_prospect_linked_v1();
create trigger franchise_pipeline_provider_qualification after insert on public.provider_qualifications
  for each row execute function private.capture_provider_pipeline_stage_v1('DIAGNOSTIC_STARTED', 'QUALIFICATION_STARTED');
create trigger franchise_pipeline_provider_match after insert on public.matching_candidates
  for each row execute function private.capture_provider_pipeline_stage_v1('OPPORTUNITY_CREATED', 'PROVIDER_MATCHED');
create trigger franchise_pipeline_provider_rfq after insert on public.rfq_providers
  for each row execute function private.capture_provider_pipeline_stage_v1('RFQ_STARTED', 'RFQ_INVITED');
do $$
begin
  if to_regclass('public.franchise_network_referrals') is not null then
    execute 'create trigger franchise_pipeline_referral_linked after insert on public.franchise_network_referrals for each row execute function private.capture_franchise_referral_linked_v1()';
  end if;
end $$;

do $$
declare candidate record;
begin
  for candidate in select id, linked_organization_id from public.franchise_crm_prospects where linked_organization_id is not null order by id loop
    perform private.catch_up_franchise_prospect_v1(candidate.id, candidate.linked_organization_id, null, null, null);
  end loop;
end $$;

-- 3. Franchise candidature -> operator organization -> mandate --------------------------------------

create function public.link_my_franchise_application_organization(
  p_application_id uuid,
  p_organization_id uuid,
  p_expected_row_version integer,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  actor uuid := auth.uid();
  application public.franchise_applications%rowtype;
  session_email text;
  confirmed timestamptz;
begin
  select lower(email::text), email_confirmed_at into session_email, confirmed from auth.users where id = actor;
  select * into application from public.franchise_applications where id = p_application_id for update;
  if actor is null or confirmed is null or application.id is null or application.reply_email::text <> session_email
     or not private.has_org_role(p_organization_id, array['FRANCHISE_OWNER'], actor) then
    raise exception 'FRANCHISE_APPLICATION_LINK_DENIED' using errcode = '42501';
  end if;
  if length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_INVALID' using errcode = '22023';
  end if;
  if exists (select 1 from public.franchise_application_events event where event.application_id = application.id and event.idempotency_key = 'candidate-link:' || p_idempotency_key) then
    return jsonb_build_object('outcome','FRANCHISE_APPLICATION_ORGANIZATION_LINKED','application_id',application.id,'organization_id',application.organization_id,'replayed',true);
  end if;
  if application.row_version <> p_expected_row_version or application.organization_id is not null
     or application.status not in ('REGISTERED','COMPANY_REVIEW','DOCUMENT_REVIEW')
     or not exists (select 1 from public.organizations where id = p_organization_id and status <> 'ARCHIVED') then
    raise exception 'STALE_FRANCHISE_APPLICATION' using errcode = '40001';
  end if;
  update public.franchise_applications
  set organization_id = p_organization_id, updated_at = clock_timestamp(), row_version = row_version + 1
  where id = application.id;
  insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
  values (application.id, application.status, application.status, 'CANDIDATE_ORGANIZATION_LINKED', actor, 'candidate-link:' || p_idempotency_key);
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (p_organization_id, actor, 'USER', 'franchise.application.organization_linked', 'franchise_application', application.id::text, extensions.gen_random_uuid(),
    jsonb_build_object('status', application.status), repeat('0',64));
  return jsonb_build_object('outcome','FRANCHISE_APPLICATION_ORGANIZATION_LINKED','application_id',application.id,'organization_id',p_organization_id,'row_version',application.row_version + 1,'replayed',false);
end;
$$;

create function public.franchise_application_organization_candidates(p_application_id uuid)
returns table (organization_id uuid, display_name text, legal_name text, organization_status text)
language plpgsql stable security definer set search_path = pg_catalog, public, private as $$
begin
  if auth.uid() is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER'], auth.uid()) then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_DENIED' using errcode = '42501';
  end if;
  return query
  select distinct organization.id, organization.display_name, organization.legal_name, organization.status
  from public.franchise_applications application
  join auth.users account on lower(account.email::text) = application.reply_email::text and account.email_confirmed_at is not null
  join public.organization_memberships membership on membership.user_id = account.id and membership.status = 'ACTIVE'
  join public.organization_member_roles granted on granted.membership_id = membership.id and granted.role_code = 'FRANCHISE_OWNER' and granted.revoked_at is null
  join public.organizations organization on organization.id = membership.organization_id and organization.status <> 'ARCHIVED'
  where application.id = p_application_id
  order by organization.display_name, organization.id;
end;
$$;

create function public.propose_franchise_from_application(
  p_application_id uuid,
  p_entry_fee_minor bigint,
  p_entry_fee_mode text,
  p_entry_fee_term_months integer,
  p_mandate_term_months integer,
  p_territory_name_fr text,
  p_territory_name_ar text,
  p_special_conditions text,
  p_invitation_token_hash text,
  p_reason text,
  p_expected_row_version integer,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  application public.franchise_applications%rowtype;
  library public.catalog_libraries%rowtype;
  is_it boolean;
  fee_minor bigint;
  fee_mode text;
  fee_months integer;
  starts_at timestamptz := date_trunc('day', clock_timestamp());
  proposed jsonb;
  franchise_status text;
begin
  if actor is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER'], actor) then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_DENIED' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 1000
     or length(coalesce(p_idempotency_key, '')) not between 8 and 200
     or p_mandate_term_months not between 12 and 120
     or length(btrim(coalesce(p_territory_name_fr, ''))) not between 2 and 200
     or length(btrim(coalesce(p_territory_name_ar, ''))) not between 2 and 200
     or length(coalesce(p_special_conditions, '')) > 2000
     or coalesce(p_invitation_token_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_INVALID' using errcode = '22023';
  end if;
  select * into application from public.franchise_applications where id = p_application_id for update;
  if not found then raise exception 'FRANCHISE_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if exists (select 1 from public.franchise_application_events event where event.application_id = application.id and event.idempotency_key = 'propose:' || p_idempotency_key) then
    return jsonb_build_object('outcome','FRANCHISE_APPROVAL_REQUIRED','application_id',application.id,'franchise_id',application.franchise_id,
      'invitation_id',(select id from public.franchise_invitations where franchise_id = application.franchise_id order by created_at desc, id limit 1),'replayed',true);
  end if;
  if application.row_version <> p_expected_row_version or application.franchise_id is not null then
    raise exception 'STALE_FRANCHISE_APPLICATION' using errcode = '40001';
  end if;
  if application.status <> 'DOCUMENT_REVIEW' or application.organization_id is null then
    raise exception 'FRANCHISE_APPLICATION_TRANSITION_DENIED' using errcode = '55000';
  end if;
  select * into library from public.catalog_libraries where code = upper(btrim(split_part(application.domain_label, '—', 1)));
  if not found then raise exception 'FRANCHISE_LIBRARY_NOT_FOUND' using errcode = 'P0002'; end if;
  is_it := library.code = 'IT';
  fee_minor := case when is_it then 0 else p_entry_fee_minor end;
  fee_mode := case when is_it then 'EXEMPT' else p_entry_fee_mode end;
  fee_months := case when is_it then 0 when p_entry_fee_mode = 'UPFRONT' then 0 else p_entry_fee_term_months end;
  proposed := public.propose_franchise_governance(
    library.id,
    application.organization_id,
    case when is_it then 'HATIM_AHMITECH' else 'FRANCHISEE' end,
    application.territory_code,
    btrim(p_territory_name_fr),
    btrim(p_territory_name_ar),
    jsonb_build_object('region_code', application.territory_code, 'source', 'FRANCHISE_APPLICATION'),
    starts_at,
    starts_at + make_interval(months => p_mandate_term_months),
    fee_minor,
    fee_mode,
    fee_months,
    jsonb_build_object('library_code', library.code, 'territory_code', application.territory_code, 'application_id', application.id),
    jsonb_build_object('governance', 'MATRICIA_GOLD_MASTER_V4', 'special_conditions', btrim(coalesce(p_special_conditions, ''))),
    jsonb_build_object('template', 'FRANCHISE_MANDATE_V1', 'application_id', application.id, 'term_months', p_mandate_term_months,
      'entry_fee', jsonb_build_object('minor', fee_minor::text, 'currency', 'MAD', 'mode', fee_mode, 'term_months', fee_months)),
    application.reply_email::text,
    p_invitation_token_hash,
    case when application.locale = 'ar' then 'ar-MA' else 'fr-MA' end,
    jsonb_build_object('application_id', application.id, 'locale', application.locale),
    btrim(p_reason),
    'franchise-application:' || p_idempotency_key
  );
  select status into franchise_status from public.franchises where id = (proposed->>'franchise_id')::uuid;
  update public.franchise_applications
  set franchise_id = (proposed->>'franchise_id')::uuid, status = franchise_status, updated_at = clock_timestamp(), row_version = row_version + 1
  where id = application.id;
  insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
  values (application.id, application.status, franchise_status, btrim(p_reason), actor, 'propose:' || p_idempotency_key);
  return proposed || jsonb_build_object('application_id', application.id, 'status', franchise_status, 'row_version', application.row_version + 1, 'replayed', false);
end;
$$;

revoke all on function public.link_my_franchise_application_organization(uuid,uuid,integer,text),
  public.franchise_application_organization_candidates(uuid),
  public.propose_franchise_from_application(uuid,bigint,text,integer,integer,text,text,text,text,text,integer,text)
  from public, anon, authenticated, service_role;
grant execute on function public.link_my_franchise_application_organization(uuid,uuid,integer,text),
  public.franchise_application_organization_candidates(uuid),
  public.propose_franchise_from_application(uuid,bigint,text,integer,integer,text,text,text,text,text,integer,text)
  to authenticated;
notify pgrst, 'reload schema';
