-- Demo Client COM film: DRAFT + QUOTES_RECEIVED (2 devis) + CONTRACTED/ACTIVE mission.
-- Same request lineage per stage family; never invents disputes.
-- service_role only; requires registered demo client + two demo providers.

create or replace function private.demo_film_uuid(p_seed text)
returns uuid
language sql
immutable
as $$
  select (
    substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3)
    || '-8' || substr(h, 18, 3) || '-' || substr(h, 21, 12)
  )::uuid
  from encode(extensions.digest(convert_to('DEMO_CLIENT_COM_FILM_V1:' || p_seed, 'UTF8'), 'sha256'), 'hex') h;
$$;

revoke all on function private.demo_film_uuid(text) from public, anon, authenticated;
grant execute on function private.demo_film_uuid(text) to service_role;

create or replace function public.ensure_demo_client_com_film_v1(
  p_client_organization_id uuid,
  p_client_user_id uuid,
  p_provider_a_organization_id uuid,
  p_provider_a_user_id uuid,
  p_provider_b_organization_id uuid,
  p_provider_b_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  v_seed text := p_client_organization_id::text;
  v_library_id uuid := private.demo_film_uuid(v_seed || ':library');
  v_library_version_id uuid := private.demo_film_uuid(v_seed || ':library-version');
  v_category_id uuid := private.demo_film_uuid(v_seed || ':category');
  v_category_version_id uuid := private.demo_film_uuid(v_seed || ':category-version');
  v_subcategory_id uuid := private.demo_film_uuid(v_seed || ':subcategory');
  v_subcategory_version_id uuid := private.demo_film_uuid(v_seed || ':subcategory-version');
  v_service_id uuid := private.demo_film_uuid(v_seed || ':service');
  v_service_version_id uuid := private.demo_film_uuid(v_seed || ':service-version');
  v_draft_request_id uuid := private.demo_film_uuid(v_seed || ':request:draft');
  v_draft_version_id uuid := private.demo_film_uuid(v_seed || ':request-version:draft');
  v_quotes_request_id uuid := private.demo_film_uuid(v_seed || ':request:quotes');
  v_quotes_version_id uuid := private.demo_film_uuid(v_seed || ':request-version:quotes');
  v_match_run_id uuid := private.demo_film_uuid(v_seed || ':matching:quotes');
  v_cand_a_id uuid := private.demo_film_uuid(v_seed || ':candidate:a');
  v_cand_b_id uuid := private.demo_film_uuid(v_seed || ':candidate:b');
  v_rfq_id uuid := private.demo_film_uuid(v_seed || ':rfq:quotes');
  v_rfq_a_id uuid := private.demo_film_uuid(v_seed || ':rfq-provider:a');
  v_rfq_b_id uuid := private.demo_film_uuid(v_seed || ':rfq-provider:b');
  v_quote_a_id uuid := private.demo_film_uuid(v_seed || ':quote:a');
  v_quote_b_id uuid := private.demo_film_uuid(v_seed || ':quote:b');
  v_quote_a_version_id uuid := private.demo_film_uuid(v_seed || ':quote-version:a');
  v_quote_b_version_id uuid := private.demo_film_uuid(v_seed || ':quote-version:b');
  v_mission_request_id uuid := private.demo_film_uuid(v_seed || ':request:mission');
  v_mission_version_id uuid := private.demo_film_uuid(v_seed || ':request-version:mission');
  v_mission_match_id uuid := private.demo_film_uuid(v_seed || ':matching:mission');
  v_mission_cand_id uuid := private.demo_film_uuid(v_seed || ':candidate:mission');
  v_mission_rfq_id uuid := private.demo_film_uuid(v_seed || ':rfq:mission');
  v_mission_rfq_provider_id uuid := private.demo_film_uuid(v_seed || ':rfq-provider:mission');
  v_mission_quote_id uuid := private.demo_film_uuid(v_seed || ':quote:mission');
  v_mission_quote_version_id uuid := private.demo_film_uuid(v_seed || ':quote-version:mission');
  v_contract_id uuid := private.demo_film_uuid(v_seed || ':contract');
  v_contract_version_id uuid := private.demo_film_uuid(v_seed || ':contract-version');
  v_mission_id uuid := private.demo_film_uuid(v_seed || ':mission');
  v_code text := 'COMFILM_' || upper(substr(replace(p_client_organization_id::text, '-', ''), 1, 8));
  v_slug text := 'comfilm-' || lower(substr(replace(p_client_organization_id::text, '-', ''), 1, 8));
  v_hash text := encode(extensions.digest(convert_to(v_seed, 'UTF8'), 'sha256'), 'hex');
  v_client_demo boolean;
  v_provider_a_demo boolean;
  v_provider_b_demo boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'DEMO_CLIENT_COM_FILM_DENIED' using errcode = '42501';
  end if;
  if p_client_organization_id is null
     or p_client_user_id is null
     or p_provider_a_organization_id is null
     or p_provider_a_user_id is null
     or p_provider_b_organization_id is null
     or p_provider_b_user_id is null
     or p_client_organization_id = p_provider_a_organization_id
     or p_client_organization_id = p_provider_b_organization_id
     or p_provider_a_organization_id = p_provider_b_organization_id then
    raise exception 'INVALID_DEMO_CLIENT_COM_FILM' using errcode = '22023';
  end if;

  select exists(
    select 1 from private.demo_workspace_organizations_v1
    where organization_id = p_client_organization_id and persona = 'client'
  ) into v_client_demo;
  select exists(
    select 1 from private.demo_workspace_organizations_v1
    where organization_id = p_provider_a_organization_id and persona = 'provider'
  ) into v_provider_a_demo;
  select exists(
    select 1 from private.demo_workspace_organizations_v1
    where organization_id = p_provider_b_organization_id and persona = 'provider'
  ) into v_provider_b_demo;

  if not (v_client_demo and v_provider_a_demo and v_provider_b_demo) then
    raise exception 'DEMO_CLIENT_COM_FILM_ORGS_REQUIRED' using errcode = '42501';
  end if;

  perform 1 from auth.users where id = p_client_user_id and deleted_at is null for key share;
  if not found then raise exception 'DEMO_CLIENT_COM_FILM_USER_MISSING' using errcode = '22023'; end if;
  perform 1 from auth.users where id = p_provider_a_user_id and deleted_at is null for key share;
  if not found then raise exception 'DEMO_CLIENT_COM_FILM_USER_MISSING' using errcode = '22023'; end if;
  perform 1 from auth.users where id = p_provider_b_user_id and deleted_at is null for key share;
  if not found then raise exception 'DEMO_CLIENT_COM_FILM_USER_MISSING' using errcode = '22023'; end if;

  -- postgres owns these tables locally; disable fences for deterministic demo seed only.
  alter table public.service_requests disable trigger service_request_subscription_financial_hold;
  alter table public.service_requests disable trigger service_request_marketing_fact;
  alter table public.service_requests disable trigger organization_merge_write_fence;
  alter table public.matching_candidates disable trigger organization_merge_write_fence;
  alter table public.matching_candidates disable trigger matching_candidates_immutable;
  alter table public.matching_candidates disable trigger matching_candidate_intervention_mode;
  alter table public.matching_candidates disable trigger franchise_pipeline_provider_match;
  alter table public.rfq_providers disable trigger organization_merge_write_fence;
  alter table public.rfq_providers disable trigger rfq_provider_current_eligibility_guard;
  alter table public.rfq_providers disable trigger rfq_provider_intervention_mode;
  alter table public.rfq_providers disable trigger franchise_pipeline_provider_rfq;
  alter table public.rfqs disable trigger franchise_pipeline_rfq;
  alter table public.quotes disable trigger organization_merge_write_fence;
  alter table public.quote_versions disable trigger quote_versions_guard;
  alter table public.quote_versions disable trigger quote_attachment_publication_guard;
  alter table public.contracts disable trigger organization_merge_write_fence;
  alter table public.contracts disable trigger franchise_pipeline_contract;
  alter table public.contract_versions disable trigger contract_versions_bind_selected_quote;
  alter table public.missions disable trigger organization_merge_write_fence;
  alter table public.missions disable trigger mission_initial_scope_v1;
  alter table public.provider_profiles disable trigger franchise_pipeline_provider_profile;
  alter table public.provider_profiles disable trigger organization_merge_write_fence;

  insert into public.catalog_libraries(id, code, slug, steward_organization_id, status, created_by)
  values (v_library_id, v_code, v_slug, p_client_organization_id, 'PUBLISHED', p_client_user_id)
  on conflict (id) do update set status = 'PUBLISHED';

  insert into public.catalog_library_versions(
    id, library_id, version, status, code, slug, name_fr, name_ar, description_fr, description_ar,
    icon_key, sort_order, change_reason, content_hash, translation_review_status,
    translation_reviewer_user_id, translation_reviewed_at, translation_review_proof_hash,
    translation_review_version, created_by, published_at
  ) values (
    v_library_version_id, v_library_id, 1, 'PUBLISHED', v_code, v_slug,
    'Film COM démo', 'فيلم COM تجريبي', 'Catalogue minimal film Client', 'كتالوج أدنى لفيلم العميل',
    'check-square', 1, 'Demo client COM film', v_hash, 'APPROVED',
    p_client_user_id, clock_timestamp(), v_hash, 1, p_client_user_id, clock_timestamp()
  ) on conflict (id) do nothing;
  update public.catalog_libraries set current_published_version_id = v_library_version_id where id = v_library_id;

  insert into public.catalog_categories(id, library_id, code, slug, status, created_by)
  values (v_category_id, v_library_id, v_code || '_CAT', v_slug || '-cat', 'PUBLISHED', p_client_user_id)
  on conflict (id) do nothing;
  insert into public.catalog_category_versions(
    id, category_id, library_id, version, status, code, slug, name_fr, name_ar, description_fr, description_ar,
    sort_order, change_reason, content_hash, translation_review_status, translation_reviewer_user_id,
    translation_reviewed_at, translation_review_proof_hash, translation_review_version, created_by, published_at
  ) values (
    v_category_version_id, v_category_id, v_library_id, 1, 'PUBLISHED', v_code || '_CAT', v_slug || '-cat',
    'Conseil', 'استشارة', 'Catégorie film', 'فئة الفيلم', 1, 'Demo client COM film', v_hash, 'APPROVED',
    p_client_user_id, clock_timestamp(), v_hash, 1, p_client_user_id, clock_timestamp()
  ) on conflict (id) do nothing;
  update public.catalog_categories set current_published_version_id = v_category_version_id where id = v_category_id;

  insert into public.catalog_subcategories(id, library_id, category_id, code, slug, status, created_by)
  values (v_subcategory_id, v_library_id, v_category_id, v_code || '_SUB', v_slug || '-sub', 'PUBLISHED', p_client_user_id)
  on conflict (id) do nothing;
  insert into public.catalog_subcategory_versions(
    id, subcategory_id, library_id, version, status, category_id, code, slug, name_fr, name_ar,
    description_fr, description_ar, sort_order, change_reason, content_hash, translation_review_status,
    translation_reviewer_user_id, translation_reviewed_at, translation_review_proof_hash,
    translation_review_version, created_by, published_at
  ) values (
    v_subcategory_version_id, v_subcategory_id, v_library_id, 1, 'PUBLISHED', v_category_id,
    v_code || '_SUB', v_slug || '-sub', 'Stratégie', 'استراتيجية', 'Sous-catégorie film', 'فئة فرعية للفيلم',
    1, 'Demo client COM film', v_hash, 'APPROVED', p_client_user_id, clock_timestamp(), v_hash, 1,
    p_client_user_id, clock_timestamp()
  ) on conflict (id) do nothing;
  update public.catalog_subcategories set current_published_version_id = v_subcategory_version_id where id = v_subcategory_id;

  insert into public.catalog_services(id, library_id, primary_subcategory_id, code, slug, status, created_by)
  values (v_service_id, v_library_id, v_subcategory_id, v_code || '_SVC', v_slug || '-svc', 'PUBLISHED', p_client_user_id)
  on conflict (id) do nothing;
  insert into public.catalog_service_versions(
    id, service_id, library_id, version, status, primary_subcategory_id, code, slug, name_fr, name_ar,
    short_description_fr, short_description_ar, long_description_fr, long_description_ar, service_type,
    unit_label_fr, unit_label_ar, sort_order, change_reason, content_hash, translation_review_status,
    translation_reviewer_user_id, translation_reviewed_at, translation_review_proof_hash,
    translation_review_version, created_by, published_at
  ) values (
    v_service_version_id, v_service_id, v_library_id, 1, 'PUBLISHED', v_subcategory_id,
    v_code || '_SVC', v_slug || '-svc', 'Accompagnement commercial', 'مرافقة تجارية',
    'Service film COM', 'خدمة فيلم COM', 'Service minimal pour le film Client COM', 'خدمة أدنى لفيلم عميل COM',
    'CONSULTING', 'jour', 'يوم', 1, 'Demo client COM film', v_hash, 'APPROVED',
    p_client_user_id, clock_timestamp(), v_hash, 1, p_client_user_id, clock_timestamp()
  ) on conflict (id) do nothing;
  update public.catalog_services set current_published_version_id = v_service_version_id where id = v_service_id;

  insert into public.provider_profiles(provider_organization_id, company_status, overall_status, activity_summary, team_size, years_experience, partner_contract_status, created_by)
  values
    (p_provider_a_organization_id, 'VERIFIED', 'ACTIVE', 'Demo provider A film COM', 3, 5, 'SIGNED', p_provider_a_user_id),
    (p_provider_b_organization_id, 'VERIFIED', 'ACTIVE', 'Demo provider B film COM', 3, 5, 'SIGNED', p_provider_b_user_id)
  on conflict (provider_organization_id) do update
    set company_status = 'VERIFIED', overall_status = 'ACTIVE';

  insert into public.provider_services(id, provider_organization_id, service_id, request_status, requested_by, requested_at)
  values
    (private.demo_film_uuid(v_seed || ':provider-service:a'), p_provider_a_organization_id, v_service_id, 'DECIDED', p_provider_a_user_id, clock_timestamp()),
    (private.demo_film_uuid(v_seed || ':provider-service:b'), p_provider_b_organization_id, v_service_id, 'DECIDED', p_provider_b_user_id, clock_timestamp())
  on conflict (id) do nothing;

  -- 1) Draft request to resume
  insert into public.service_requests(id, client_organization_id, library_id, service_id, status, created_by)
  values (v_draft_request_id, p_client_organization_id, v_library_id, v_service_id, 'DRAFT', p_client_user_id)
  on conflict (id) do update set status = 'DRAFT';
  insert into public.service_request_versions(
    id, request_id, client_organization_id, library_id, version_number, description, urgency, currency_code,
    required_quote_data, required_fields_complete, catalog_snapshot_hash, questionnaire_snapshot_hash,
    change_reason, content_hash, created_by
  ) values (
    v_draft_version_id, v_draft_request_id, p_client_organization_id, v_library_id, 1,
    'Brouillon film COM — compléter le besoin pour recevoir des devis', 'NORMAL', 'MAD',
    '{}'::jsonb, false, v_hash, v_hash, 'Demo client COM film draft', v_hash, p_client_user_id
  ) on conflict (id) do nothing;
  update public.service_requests set current_version_id = v_draft_version_id where id = v_draft_request_id;

  -- 2) Quotes stage with two submitted offers
  insert into public.service_requests(id, client_organization_id, library_id, service_id, status, created_by)
  values (v_quotes_request_id, p_client_organization_id, v_library_id, v_service_id, 'QUOTES_RECEIVED', p_client_user_id)
  on conflict (id) do update set status = 'QUOTES_RECEIVED';
  insert into public.service_request_versions(
    id, request_id, client_organization_id, library_id, version_number, description, urgency, currency_code,
    required_quote_data, required_fields_complete, catalog_snapshot_hash, questionnaire_snapshot_hash,
    change_reason, content_hash, created_by
  ) values (
    v_quotes_version_id, v_quotes_request_id, p_client_organization_id, v_library_id, 1,
    'Demande film COM — deux devis comparables', 'NORMAL', 'MAD',
    jsonb_build_object('region_code', 'CASABLANCA'), true, v_hash, v_hash, 'Demo client COM film quotes', v_hash, p_client_user_id
  ) on conflict (id) do nothing;
  update public.service_requests set current_version_id = v_quotes_version_id where id = v_quotes_request_id;

  insert into public.matching_runs(id, request_id, request_version_id, policy_version, status, target_panel_size, started_by, completed_at)
  values (v_match_run_id, v_quotes_request_id, v_quotes_version_id, 'MATCH-V1', 'COMPLETED', 2, p_client_user_id, clock_timestamp())
  on conflict (id) do nothing;
  insert into public.matching_candidates(id, matching_run_id, provider_organization_id, eligible, score_basis_points, score_explanation, rotation_component)
  values
    (v_cand_a_id, v_match_run_id, p_provider_a_organization_id, true, 8200, '{}'::jsonb, 0),
    (v_cand_b_id, v_match_run_id, p_provider_b_organization_id, true, 7800, '{}'::jsonb, 1)
  on conflict (id) do nothing;
  insert into public.rfqs(id, request_id, request_version_id, matching_run_id, status, deadline, confidentiality_settings, invited_count, opened_by)
  values (v_rfq_id, v_quotes_request_id, v_quotes_version_id, v_match_run_id, 'OPEN', clock_timestamp() + interval '30 days', '{"mask_direct_contacts":true}'::jsonb, 2, p_client_user_id)
  on conflict (id) do nothing;
  insert into public.rfq_providers(id, rfq_id, provider_organization_id, matching_candidate_id, status, responded_at)
  values
    (v_rfq_a_id, v_rfq_id, p_provider_a_organization_id, v_cand_a_id, 'ACCEPTED', clock_timestamp()),
    (v_rfq_b_id, v_rfq_id, p_provider_b_organization_id, v_cand_b_id, 'ACCEPTED', clock_timestamp())
  on conflict (id) do nothing;

  insert into public.quotes(id, rfq_id, rfq_provider_id, provider_organization_id, status, created_by)
  values
    (v_quote_a_id, v_rfq_id, v_rfq_a_id, p_provider_a_organization_id, 'SUBMITTED', p_provider_a_user_id),
    (v_quote_b_id, v_rfq_id, v_rfq_b_id, p_provider_b_organization_id, 'SUBMITTED', p_provider_b_user_id)
  on conflict (id) do nothing;
  insert into public.quote_versions(
    id, quote_id, rfq_id, provider_organization_id, version_number, lifecycle_status, change_reason, currency,
    solution_fr, deliverables, inclusions, exclusions, prerequisites, warranty_fr, correction_terms_fr, sla,
    proposed_start_date, duration_days, valid_until, subtotal_minor, tax_minor, total_minor, recurring_subtotal_minor,
    calculation_basis, content_hash, submitted_at, created_by
  ) values
    (v_quote_a_version_id, v_quote_a_id, v_rfq_id, p_provider_a_organization_id, 1, 'SUBMITTED', 'Demo film quote A', 'MAD',
     'Offre A — accompagnement commercial versionné', '[{"key":"D1","label_fr":"Plan d’action"}]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
     'Garantie standard démo', 'Corrections sous 5 jours ouvrés', '{}'::jsonb, current_date + 7, 15,
     clock_timestamp() + interval '30 days', 18000, 0, 18000, 0, '{}'::jsonb,
     encode(extensions.digest(convert_to(v_seed || ':qa', 'UTF8'), 'sha256'), 'hex'), clock_timestamp(), p_provider_a_user_id),
    (v_quote_b_version_id, v_quote_b_id, v_rfq_id, p_provider_b_organization_id, 1, 'SUBMITTED', 'Demo film quote B', 'MAD',
     'Offre B — accompagnement commercial versionné', '[{"key":"D1","label_fr":"Atelier + livrable"}]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
     'Garantie standard démo', 'Corrections sous 5 jours ouvrés', '{}'::jsonb, current_date + 10, 20,
     clock_timestamp() + interval '30 days', 22000, 0, 22000, 0, '{}'::jsonb,
     encode(extensions.digest(convert_to(v_seed || ':qb', 'UTF8'), 'sha256'), 'hex'), clock_timestamp(), p_provider_b_user_id)
  on conflict (id) do nothing;
  update public.quotes set current_version_id = v_quote_a_version_id, last_published_version_id = v_quote_a_version_id, status = 'SUBMITTED' where id = v_quote_a_id;
  update public.quotes set current_version_id = v_quote_b_version_id, last_published_version_id = v_quote_b_version_id, status = 'SUBMITTED' where id = v_quote_b_id;

  -- 3) Mission stage (contracted + active mission) — separate request, same film seed family
  insert into public.service_requests(id, client_organization_id, library_id, service_id, status, created_by)
  values (v_mission_request_id, p_client_organization_id, v_library_id, v_service_id, 'CONTRACTED', p_client_user_id)
  on conflict (id) do update set status = 'CONTRACTED';
  insert into public.service_request_versions(
    id, request_id, client_organization_id, library_id, version_number, description, urgency, currency_code,
    required_quote_data, required_fields_complete, catalog_snapshot_hash, questionnaire_snapshot_hash,
    change_reason, content_hash, created_by
  ) values (
    v_mission_version_id, v_mission_request_id, p_client_organization_id, v_library_id, 1,
    'Mission film COM — suivi des jalons', 'NORMAL', 'MAD',
    jsonb_build_object('region_code', 'CASABLANCA'), true, v_hash, v_hash, 'Demo client COM film mission', v_hash, p_client_user_id
  ) on conflict (id) do nothing;
  update public.service_requests set current_version_id = v_mission_version_id where id = v_mission_request_id;

  insert into public.matching_runs(id, request_id, request_version_id, policy_version, status, target_panel_size, started_by, completed_at)
  values (v_mission_match_id, v_mission_request_id, v_mission_version_id, 'MATCH-V1', 'COMPLETED', 1, p_client_user_id, clock_timestamp())
  on conflict (id) do nothing;
  insert into public.matching_candidates(id, matching_run_id, provider_organization_id, eligible, score_basis_points, score_explanation, rotation_component)
  values (v_mission_cand_id, v_mission_match_id, p_provider_a_organization_id, true, 9000, '{}'::jsonb, 0)
  on conflict (id) do nothing;
  insert into public.rfqs(id, request_id, request_version_id, matching_run_id, status, deadline, confidentiality_settings, invited_count, opened_by, closed_at)
  values (v_mission_rfq_id, v_mission_request_id, v_mission_version_id, v_mission_match_id, 'CLOSED', clock_timestamp() + interval '1 day', '{"mask_direct_contacts":true}'::jsonb, 1, p_client_user_id, clock_timestamp())
  on conflict (id) do nothing;
  insert into public.rfq_providers(id, rfq_id, provider_organization_id, matching_candidate_id, status, responded_at)
  values (v_mission_rfq_provider_id, v_mission_rfq_id, p_provider_a_organization_id, v_mission_cand_id, 'ACCEPTED', clock_timestamp())
  on conflict (id) do nothing;
  insert into public.quotes(id, rfq_id, rfq_provider_id, provider_organization_id, status, created_by)
  values (v_mission_quote_id, v_mission_rfq_id, v_mission_rfq_provider_id, p_provider_a_organization_id, 'DRAFT', p_provider_a_user_id)
  on conflict (id) do nothing;
  insert into public.quote_versions(
    id, quote_id, rfq_id, provider_organization_id, version_number, lifecycle_status, change_reason, currency,
    solution_fr, deliverables, inclusions, exclusions, prerequisites, warranty_fr, correction_terms_fr, sla,
    proposed_start_date, duration_days, valid_until, subtotal_minor, tax_minor, total_minor, recurring_subtotal_minor,
    calculation_basis, content_hash, submitted_at, created_by
  ) values (
    v_mission_quote_version_id, v_mission_quote_id, v_mission_rfq_id, p_provider_a_organization_id, 1, 'SUBMITTED',
    'Demo film mission quote', 'MAD', 'Mission film COM sélectionnée',
    '[{"key":"M1","label_fr":"Livrable mission"}]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'Garantie mission démo', 'Corrections sous 5 jours ouvrés', '{}'::jsonb, current_date, 30,
    clock_timestamp() + interval '45 days', 25000, 0, 25000, 0, '{}'::jsonb,
    encode(extensions.digest(convert_to(v_seed || ':qm', 'UTF8'), 'sha256'), 'hex'), clock_timestamp(), p_provider_a_user_id
  ) on conflict (id) do nothing;
  update public.quotes
     set status = 'SELECTED',
         current_version_id = v_mission_quote_version_id,
         selected_version_id = v_mission_quote_version_id,
         last_published_version_id = v_mission_quote_version_id
   where id = v_mission_quote_id;

  insert into public.contracts(id, client_organization_id, provider_organization_id, status, current_version, created_by)
  values (v_contract_id, p_client_organization_id, p_provider_a_organization_id, 'ACTIVE', 1, p_client_user_id)
  on conflict (id) do update set status = 'ACTIVE';
  insert into public.contract_versions(
    id, contract_id, version, selected_quote_version_id, request_snapshot, quote_snapshot, clauses,
    price_minor, currency, commission_rule_snapshot, content_hash, change_reason, created_by
  ) values (
    v_contract_version_id, v_contract_id, 1, v_mission_quote_version_id,
    jsonb_build_object('request_id', v_mission_request_id),
    jsonb_build_object('quote_version_id', v_mission_quote_version_id),
    jsonb_build_object('fr', 'Clauses synthétiques film COM démo.'),
    25000, 'MAD', '{"commission_basis_points":1000}'::jsonb,
    encode(extensions.digest(convert_to(v_seed || ':contract', 'UTF8'), 'sha256'), 'hex'),
    'Demo client COM film contract', p_client_user_id
  ) on conflict (id) do nothing;

  insert into public.missions(
    id, contract_id, contract_version_id, client_organization_id, provider_organization_id,
    status, started_at, created_by
  ) values (
    v_mission_id, v_contract_id, v_contract_version_id, p_client_organization_id, p_provider_a_organization_id,
    'ACTIVE', clock_timestamp() - interval '3 days', p_client_user_id
  ) on conflict (id) do update set status = 'ACTIVE';

  alter table public.service_requests enable trigger service_request_subscription_financial_hold;
  alter table public.service_requests enable trigger service_request_marketing_fact;
  alter table public.service_requests enable trigger organization_merge_write_fence;
  alter table public.matching_candidates enable trigger organization_merge_write_fence;
  alter table public.matching_candidates enable trigger matching_candidates_immutable;
  alter table public.matching_candidates enable trigger matching_candidate_intervention_mode;
  alter table public.matching_candidates enable trigger franchise_pipeline_provider_match;
  alter table public.rfq_providers enable trigger organization_merge_write_fence;
  alter table public.rfq_providers enable trigger rfq_provider_current_eligibility_guard;
  alter table public.rfq_providers enable trigger rfq_provider_intervention_mode;
  alter table public.rfq_providers enable trigger franchise_pipeline_provider_rfq;
  alter table public.rfqs enable trigger franchise_pipeline_rfq;
  alter table public.quotes enable trigger organization_merge_write_fence;
  alter table public.quote_versions enable trigger quote_versions_guard;
  alter table public.quote_versions enable trigger quote_attachment_publication_guard;
  alter table public.contracts enable trigger organization_merge_write_fence;
  alter table public.contracts enable trigger franchise_pipeline_contract;
  alter table public.contract_versions enable trigger contract_versions_bind_selected_quote;
  alter table public.missions enable trigger organization_merge_write_fence;
  alter table public.missions enable trigger mission_initial_scope_v1;
  alter table public.provider_profiles enable trigger franchise_pipeline_provider_profile;
  alter table public.provider_profiles enable trigger organization_merge_write_fence;

  return jsonb_build_object(
    'draft_request_id', v_draft_request_id,
    'quotes_request_id', v_quotes_request_id,
    'mission_request_id', v_mission_request_id,
    'mission_id', v_mission_id,
    'quote_a_id', v_quote_a_id,
    'quote_b_id', v_quote_b_id,
    'dispute_count', 0
  );
exception
  when others then
    alter table public.service_requests enable trigger service_request_subscription_financial_hold;
    alter table public.service_requests enable trigger service_request_marketing_fact;
    alter table public.service_requests enable trigger organization_merge_write_fence;
    alter table public.matching_candidates enable trigger organization_merge_write_fence;
    alter table public.matching_candidates enable trigger matching_candidates_immutable;
    alter table public.matching_candidates enable trigger matching_candidate_intervention_mode;
    alter table public.matching_candidates enable trigger franchise_pipeline_provider_match;
    alter table public.rfq_providers enable trigger organization_merge_write_fence;
    alter table public.rfq_providers enable trigger rfq_provider_current_eligibility_guard;
    alter table public.rfq_providers enable trigger rfq_provider_intervention_mode;
    alter table public.rfq_providers enable trigger franchise_pipeline_provider_rfq;
    alter table public.rfqs enable trigger franchise_pipeline_rfq;
    alter table public.quotes enable trigger organization_merge_write_fence;
    alter table public.quote_versions enable trigger quote_versions_guard;
    alter table public.quote_versions enable trigger quote_attachment_publication_guard;
    alter table public.contracts enable trigger organization_merge_write_fence;
    alter table public.contracts enable trigger franchise_pipeline_contract;
    alter table public.contract_versions enable trigger contract_versions_bind_selected_quote;
    alter table public.missions enable trigger organization_merge_write_fence;
    alter table public.missions enable trigger mission_initial_scope_v1;
    alter table public.provider_profiles enable trigger franchise_pipeline_provider_profile;
    alter table public.provider_profiles enable trigger organization_merge_write_fence;
    raise;
end;
$$;

revoke all on function public.ensure_demo_client_com_film_v1(uuid, uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_demo_client_com_film_v1(uuid, uuid, uuid, uuid, uuid, uuid)
  to service_role;
