-- Optional canonical intervention mode is a versioned Client decision, never inferred.
begin;
alter table private.rfq_command_keys drop constraint rfq_command_keys_operation_scope_check;
alter table private.rfq_command_keys add constraint rfq_command_keys_operation_scope_check check(operation_scope in ('rfq.request.create','rfq.request.ready','rfq.matching.run','rfq.open','rfq.invitation.respond','rfq.request.complete'));
create or replace function public.get_service_request_quote_questions(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, private as $$
declare
  request public.service_requests%rowtype;
  version public.service_request_versions%rowtype;
begin
  select * into request from public.service_requests where id = p_request_id;
  if not found or not private.can_manage_client_request(request.client_organization_id, auth.uid()) then
    raise exception 'REQUEST_SCOPE_DENIED' using errcode='42501';
  end if;
  select * into version from public.service_request_versions where id = request.current_version_id;
  return jsonb_build_object(
    'request_id', request.id,
    'status', request.status,
    'row_version', request.row_version,
    'version_number', version.version_number,
    'required_fields_complete', version.required_fields_complete,
    'region_code', coalesce(version.required_quote_data->>'region_code', ''),
    'intervention_mode', version.required_quote_data->>'intervention_mode',
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data_key', question.data_key,
        'required', question.required,
        'answer_type', question.answer_type,
        'label_fr', question.label_fr,
        'label_ar', question.label_ar,
        'help_fr', question.help_fr,
        'help_ar', question.help_ar,
        'options', question.options,
        'answer', coalesce(version.required_quote_data->>question.data_key, '')
      ) order by question.required desc, question.data_key)
      from private.service_quote_questions(request.service_id) question
    ), '[]'::jsonb)
  );
end$$;

revoke all on function public.get_service_request_quote_questions(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_service_request_quote_questions(uuid) to authenticated;

create or replace function public.complete_service_request_information(
  p_request_id uuid,
  p_expected_row_version integer,
  p_answers jsonb,
  p_region_code text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  request public.service_requests%rowtype;
  version public.service_request_versions%rowtype;
  request_hash text;
  command uuid;
  replay jsonb;
  clean jsonb;
  region text;
  quote_data jsonb;
  missing text[];
  complete boolean;
  next_status text;
  next_version uuid := extensions.gen_random_uuid();
  content text;
  response jsonb;
begin
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_REQUEST_INFORMATION' using errcode='22023';
  end if;
  if p_answers ? 'intervention_mode' and (jsonb_typeof(p_answers->'intervention_mode') is distinct from 'string' or p_answers->>'intervention_mode' not in ('','ONSITE','REMOTE','HYBRID')) then
    raise exception 'INVALID_INTERVENTION_MODE' using errcode='22023';
  end if;
  select * into request from public.service_requests where id = p_request_id;
  if not found or not private.can_manage_client_request(request.client_organization_id, actor) then
    raise exception 'REQUEST_SCOPE_DENIED' using errcode='42501';
  end if;
  request_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'operation', 'rfq.request.complete.v1', 'request_id', p_request_id, 'expected', p_expected_row_version,
    'answers', coalesce(p_answers, '{}'::jsonb), 'region', coalesce(p_region_code, '')
  )::text, 'UTF8'), 'sha256'), 'hex');
  select b.command_id, b.response_body into command, replay
  from private.begin_rfq_command(actor, 'rfq.request.complete', p_idempotency_key, request_hash) b;
  perform pg_advisory_xact_lock(hashtextextended('service-request:' || p_request_id::text, 0));
  select * into request from public.service_requests where id = p_request_id for update;
  if replay is not null then return replay; end if;
  if request.row_version is distinct from p_expected_row_version then
    raise exception 'STALE_REQUEST_VERSION' using errcode='40001';
  end if;
  if request.status not in ('DRAFT', 'INFORMATION_REQUIRED') then
    raise exception 'INVALID_REQUEST_TRANSITION' using errcode='55000';
  end if;
  select * into version from public.service_request_versions where id = request.current_version_id;

  clean := (
    select coalesce(jsonb_object_agg(question.data_key, left(btrim(p_answers->>question.data_key), 1200)), '{}'::jsonb)
    from private.service_quote_questions(request.service_id) question
    where btrim(coalesce(p_answers->>question.data_key, '')) <> ''
  );
  region := upper(btrim(coalesce(nullif(btrim(coalesce(p_region_code, '')), ''), version.required_quote_data->>'region_code', '')));
  if region <> '' and region !~ '^[A-Z][A-Z0-9_]{1,59}$' then
    raise exception 'INVALID_REQUEST_INFORMATION' using errcode='22023';
  end if;
  quote_data := version.required_quote_data || clean || jsonb_build_object('region_code', region);
  if p_answers ? 'intervention_mode' then
    quote_data := quote_data - 'intervention_mode';
    if p_answers->>'intervention_mode' <> '' then quote_data := quote_data || jsonb_build_object('intervention_mode',p_answers->>'intervention_mode');end if;
  end if;
  missing := private.service_request_missing_quote_keys(request.service_id, quote_data);
  complete := region <> '' and cardinality(missing) = 0 and request.questionnaire_version_id is not null;
  next_status := case when complete then 'DRAFT' else 'INFORMATION_REQUIRED' end;
  content := encode(extensions.digest(convert_to(jsonb_build_object(
    'request_id', request.id, 'version', version.version_number + 1, 'base', version.content_hash, 'required_quote_data', quote_data
  )::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.service_request_versions(
    id, request_id, client_organization_id, library_id, version_number, description, urgency, desired_date, budget_minor,
    currency_code, required_quote_data, required_fields_complete, catalog_snapshot_hash, questionnaire_snapshot_hash,
    change_reason, content_hash, created_by
  ) values (
    next_version, request.id, request.client_organization_id, request.library_id, version.version_number + 1, version.description,
    version.urgency, version.desired_date, version.budget_minor, version.currency_code, quote_data, complete,
    version.catalog_snapshot_hash, version.questionnaire_snapshot_hash, 'Compléments client pour les devis', content, actor
  );
  update public.service_requests
    set current_version_id = next_version, status = next_status, row_version = row_version + 1, updated_at = clock_timestamp()
    where id = request.id;

  response := jsonb_build_object(
    'outcome', 'SERVICE_REQUEST_INFORMATION_UPDATED', 'request_id', request.id, 'request_version_id', next_version,
    'status', next_status, 'row_version', p_expected_row_version + 1, 'missing_quote_keys', to_jsonb(missing), 'command_id', command
  );
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (request.client_organization_id, actor, 'USER', 'rfq.request.information_completed', 'service_request', request.id::text, p_correlation_id,
    jsonb_build_object('request_version_id', next_version, 'command_id', command, 'missing_quote_keys', to_jsonb(missing)), repeat('0', 64));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key, causation_id)
  values (request.client_organization_id, 'service_request', request.id::text, 'ServiceRequestInformationCompletedV1', p_correlation_id,
    jsonb_build_object('request_id', request.id, 'request_version_id', next_version, 'status', next_status), p_idempotency_key, command);
  perform private.finish_rfq_command(actor, 'rfq.request.complete', p_idempotency_key, response);
  return response;
end$$;

revoke all on function public.complete_service_request_information(uuid, integer, jsonb, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.complete_service_request_information(uuid, integer, jsonb, text, text, uuid) to authenticated;

commit;
