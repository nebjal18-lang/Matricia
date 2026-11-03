-- Preserve every existing franchise role while keeping each permission bound to an exact mandate.
create or replace function private.franchise_access(p_franchise_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','LIBRARY_MANAGER','READ_ONLY_AUDITOR'],p_actor)
 or private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT','FRANCHISE_PROVIDER_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER'],p_actor)
$$;
create or replace function private.active_franchise_messaging_scope(p_franchise_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT','FRANCHISE_PROVIDER_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER'],p_actor)
$$;
create or replace function private.can_maintain_franchise_definitions(p_library_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.franchises f where f.library_id=p_library_id and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT'],p_actor))
$$;
create or replace function private.can_decide_franchise_service_qualification(p_service_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.catalog_services service join public.franchises f on f.library_id=service.library_id where service.id=p_service_id and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT','FRANCHISE_PROVIDER_MANAGER'],p_actor))
$$;
create or replace function private.has_library_permission(p_library_id uuid,p_permission_code text,p_actor_id uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.platform_user_roles r join public.catalog_permission_policies p on p.role_code=r.role_code
 where r.user_id=p_actor_id and r.revoked_at is null and private.has_platform_role(array[r.role_code],p_actor_id)and p.permission_code=p_permission_code and p.active and statement_timestamp()>=p.valid_from and(p.valid_until is null or statement_timestamp()<p.valid_until))
 or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id and o.status='ACTIVE'
 join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null
 join public.catalog_permission_policies p on p.role_code=r.role_code
 join public.catalog_library_mandates x on x.library_id=p_library_id and x.organization_id=m.organization_id
 where m.user_id=p_actor_id and m.status='ACTIVE'and p.permission_code=p_permission_code and p.policy_version=x.policy_version and p.active
 and statement_timestamp()>=p.valid_from and(p.valid_until is null or statement_timestamp()<p.valid_until)
 and x.status='ACTIVE'and statement_timestamp()>=x.valid_from and(x.valid_until is null or statement_timestamp()<x.valid_until)
 and(
  (r.role_code not like 'FRANCHISE\_%'escape'\'and r.library_id=p_library_id)
  or(r.role_code like 'FRANCHISE\_%'escape'\'and(
   exists(select 1 from public.franchises f where f.library_id=p_library_id and f.operator_organization_id=m.organization_id and private.has_franchise_role(f.id,array[r.role_code],p_actor_id))
   or(r.library_id=p_library_id and r.franchise_id is null and not exists(select 1 from public.organization_member_franchise_assignments assignment where assignment.membership_id=r.membership_id and assignment.role_code=r.role_code))
  ))
 ))
$$;

create or replace function public.instruct_franchise_dispute(
  p_dispute_case_id uuid,
  p_statement text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  a uuid := auth.uid();
  d public.dispute_cases%rowtype;
  m public.missions%rowtype;
  v_org uuid;
  h text;
  r jsonb;
  v_hash text;
  v_evidence jsonb;
begin
  select * into d from public.dispute_cases where id = p_dispute_case_id;
  if not found then raise exception 'DISPUTE_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into m from public.missions where id = d.mission_id;
  if a is null or not found or not private.franchise_supervises_contract(m.contract_id, a) then
    raise exception 'FRANCHISE_DISPUTE_INSTRUCTION_DENIED' using errcode = '42501';
  end if;
  select f.operator_organization_id into v_org
    from public.contract_versions cv
    join public.quote_versions qv on qv.id = cv.selected_quote_version_id
    join public.quotes qt on qt.id = qv.quote_id
    join public.rfqs q on q.id = qt.rfq_id
    join public.service_requests sr on sr.id = q.request_id
    join public.franchises f on f.library_id = sr.library_id and f.status = 'ACTIVE'
   where cv.contract_id = m.contract_id
     and private.has_franchise_role(f.id, array['FRANCHISE_OWNER', 'FRANCHISE_MANAGER', 'FRANCHISE_EXPERT'], a)
   limit 1;
  if v_org is null then
    raise exception 'FRANCHISE_DISPUTE_INSTRUCTION_DENIED' using errcode = '42501';
  end if;
  if d.status in ('DECIDED', 'CLOSED') or length(btrim(coalesce(p_statement, ''))) not between 10 and 4000 then
    raise exception 'INVALID_FRANCHISE_DISPUTE_INSTRUCTION' using errcode = '22023';
  end if;
  v_hash := encode(extensions.digest(convert_to(btrim(p_statement), 'UTF8'), 'sha256'), 'hex');
  v_evidence := jsonb_build_array(jsonb_build_object(
    'type', 'MESSAGE', 'statement', btrim(p_statement), 'hash', v_hash, 'visibility', 'BOTH_PARTIES'
  ));
  h := private.canonical_request_hash(jsonb_build_object('case', d.id, 'statement', btrim(p_statement)));
  r := private.begin_contract_command(v_org, 'dispute.franchise.instruct.' || d.id::text, p_idempotency_key, h, a);
  if r is not null then return r; end if;
  select * into d from public.dispute_cases where id = d.id for update;
  if d.status in ('DECIDED', 'CLOSED') then raise exception 'STALE_DISPUTE_STATE' using errcode = '40001'; end if;
  perform private.append_dispute_evidence(d.id, v_evidence, a, v_org);
  insert into public.dispute_case_events (dispute_case_id, event_type, from_status, to_status, actor_user_id, correlation_id, metadata)
  values (d.id, 'FRANCHISE_INSTRUCTION', d.status, d.status, a, p_correlation_id, jsonb_build_object('visibility', 'BOTH_PARTIES'));
  r := jsonb_build_object('outcome', 'FRANCHISE_DISPUTE_INSTRUCTED', 'dispute_case_id', d.id, 'status', d.status);
  insert into public.audit_events (organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (v_org, a, 'USER', 'franchise.dispute.instructed', 'dispute_case', d.id::text, p_correlation_id, r, repeat('0', 64));
  insert into public.event_outbox (organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (v_org, 'dispute_case', d.id::text, 'FranchiseDisputeInstructedV1', p_correlation_id, r, p_idempotency_key);
  perform private.finish_contract_command(v_org, 'dispute.franchise.instruct.' || d.id::text, p_idempotency_key, r);
  return r;
end
$$;

create or replace function private.has_questionnaire_audience_access(p_organization_id uuid,p_library_id uuid,p_audience text,p_mode text,p_actor_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.organizations o join public.organization_memberships m on m.organization_id=o.id join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null where o.id=p_organization_id and o.status='ACTIVE' and m.user_id=p_actor_id and m.status='ACTIVE' and (
    (p_audience='CLIENT' and ((p_mode='READ' and r.role_code in ('CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING','CLIENT_MEMBER','CLIENT_VIEWER')) or (p_mode in ('START','EDIT','SUBMIT') and r.role_code in ('CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_MEMBER'))))
    or (p_audience='PROVIDER' and ((p_mode='READ' and r.role_code in ('PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_TECHNICIAN','PROVIDER_ACCOUNTING','PROVIDER_VIEWER')) or (p_mode in ('START','EDIT','SUBMIT') and r.role_code in ('PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_TECHNICIAN'))))
    or (p_audience='FRANCHISE' and (exists(select 1 from public.franchises f where f.library_id=p_library_id and f.operator_organization_id=m.organization_id and private.has_franchise_role(f.id,array[r.role_code],p_actor_id))or(r.library_id=p_library_id and r.franchise_id is null and not exists(select 1 from public.organization_member_franchise_assignments assignment where assignment.membership_id=r.membership_id and assignment.role_code=r.role_code))) and ((p_mode='READ' and r.role_code in ('FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT','FRANCHISE_PROVIDER_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER')) or (p_mode in ('START','EDIT','SUBMIT') and r.role_code in ('FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT','FRANCHISE_PROVIDER_MANAGER'))))
    or (p_audience='INTERNAL' and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER'],p_actor_id))
  ))
$$;

-- A draft cannot drop a source rule sensitivity flag to avoid step-up authentication.
create or replace function public.save_catalog_rule_draft(p_rule_id uuid,p_source_version_id uuid,p_payload jsonb,p_change_reason text,p_expected_identity_row_version integer,p_expected_source_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path=pg_catalog,extensions,private as $$
declare v_actor uuid:=auth.uid();v_identity public.question_rules%rowtype;v_source public.question_rule_versions%rowtype;v_hash text;v_command uuid;v_replay jsonb;v_number integer;v_version uuid;v_org uuid;v_compiled text;v_response jsonb;
begin
  if v_actor is null or p_expected_identity_row_version<1 or p_expected_source_row_version<1 then raise exception 'INVALID_CATALOG_RULE' using errcode='22023';end if;
  select * into v_identity from public.question_rules where id=p_rule_id;if not found or not private.has_library_permission(v_identity.library_id,'CATALOG_EDIT',v_actor) then raise exception 'CATALOG_SCOPE_DENIED' using errcode='42501';end if;
  perform private.assert_rule_builder_payload(p_payload);select * into v_source from public.question_rule_versions where id=p_source_version_id and rule_id=p_rule_id;if not found then raise exception 'CATALOG_RULE_VERSION_NOT_FOUND' using errcode='P0002';end if;
  if ((p_payload->>'sensitive')::boolean or v_source.sensitive) and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'CATALOG_SENSITIVE_MFA_REQUIRED' using errcode='42501';end if;
  v_hash:=private.canonical_request_hash(jsonb_build_object('operation','catalog.rule.save.v1','rule_id',p_rule_id,'source_version_id',p_source_version_id,'payload',p_payload,'change_reason',btrim(p_change_reason),'expected_identity',p_expected_identity_row_version,'expected_source',p_expected_source_row_version));
  select b.command_id,b.response_body into v_command,v_replay from private.begin_catalog_command(v_actor,'catalog.rule.save',p_idempotency_key,v_hash)b;
  perform pg_advisory_xact_lock(hashtextextended('catalog-rule:'||p_rule_id::text,0));select * into v_identity from public.question_rules where id=p_rule_id for update;select * into v_source from public.question_rule_versions where id=p_source_version_id and rule_id=p_rule_id for share;perform private.assert_catalog_permission_locked(v_identity.library_id,'CATALOG_EDIT',v_actor);if (v_source.sensitive or (p_payload->>'sensitive')::boolean)and auth.jwt()->>'aal'is distinct from'aal2'then raise exception 'CATALOG_SENSITIVE_MFA_REQUIRED'using errcode='42501';end if;if v_replay is not null then return v_replay;end if;
  if v_identity.status='ARCHIVED' or p_source_version_id is distinct from coalesce(v_identity.current_draft_version_id,v_identity.current_published_version_id) then raise exception 'CATALOG_RULE_NOT_EDITABLE' using errcode='55000';end if;
  if v_identity.row_version is distinct from p_expected_identity_row_version or v_source.row_version is distinct from p_expected_source_row_version then raise exception 'STALE_CATALOG_VERSION' using errcode='40001';end if;
  select coalesce(max(version),0)+1 into v_number from public.question_rule_versions where rule_id=p_rule_id;v_version:=private.insert_rule_builder_version(p_rule_id,v_identity.library_id,p_payload,p_change_reason,v_actor,v_number);select steward_organization_id into v_org from public.catalog_libraries where id=v_identity.library_id;
  update public.question_rules set status=case when current_published_version_id is null then'DRAFT'else'PUBLISHED'end,current_draft_version_id=v_version,row_version=row_version+1 where id=p_rule_id;select compiled_hash into v_compiled from public.question_rule_versions where id=v_version;
  v_response:=jsonb_build_object('outcome','CATALOG_RULE_DRAFT_SAVED','rule_id',p_rule_id,'library_id',v_identity.library_id,'version_id',v_version,'version_number',v_number,'identity_row_version',p_expected_identity_row_version+1,'version_row_version',1,'compiled_hash',v_compiled,'command_id',v_command);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,previous_hash,event_hash) values(v_org,v_actor,'USER','catalog.rule.draft_saved','catalog_rule',p_rule_id::text,p_correlation_id,jsonb_build_object('source_version_id',p_source_version_id,'version_id',v_version,'sensitive',(p_payload->>'sensitive')::boolean,'command_id',v_command),v_source.compiled_hash,repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id) values(v_org,'catalog_rule',p_rule_id::text,'CatalogRuleDraftSavedV1',p_correlation_id,jsonb_build_object('rule_id',p_rule_id,'version_id',v_version),p_idempotency_key,v_command);
  perform private.finish_catalog_command(v_actor,'catalog.rule.save',p_idempotency_key,v_response);return v_response;
end $$;


create or replace function public.franchise_provider_dossiers(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;result jsonb;
begin
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 select * into f from public.franchises where id=p_franchise_id;
 select coalesce(jsonb_agg(jsonb_build_object('organizationId',p.provider_organization_id,'name',o.display_name,'companyStatus',p.company_status,'status',p.overall_status,'createdAt',p.created_at,'teamSize',p.team_size,'regions',coalesce((select to_jsonb(r.region_codes)from public.provider_region_versions r where r.provider_organization_id=p.provider_organization_id order by r.version_number desc limit 1),'[]'::jsonb),
 'qualifications',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'serviceId',q.service_id,'serviceCode',s.code,'status',case when d.expires_at<=statement_timestamp()then'EXPIRED'else coalesce(d.status,'PENDING')end,'rowVersion',q.row_version)order by s.code)from public.provider_qualifications q join public.catalog_services s on s.id=q.service_id left join public.provider_qualification_decisions d on d.id=q.current_decision_id where q.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id),'[]'::jsonb),
 'capacities',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'serviceId',c.service_id,'serviceCode',c.code,'status',c.capacity_status,'availableUnits',c.available_units,'leadTimeDays',c.lead_time_days)order by c.code)from(select distinct on(v.service_id)v.*,s.code from public.provider_capacity_versions v join public.catalog_services s on s.id=v.service_id where v.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id and v.effective_from<=now()and(v.effective_until is null or v.effective_until>now())order by v.service_id,v.version_number desc)c),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'kind',v.document_kind,'code',v.code,'status',case when v.expires_on<current_date then'EXPIRED'else v.status end,'expiresOn',v.expires_on)order by v.code)from(select distinct on(d.family_id)d.id,d.status,d.expires_on,d.family_id,d.version_number,family.document_kind,family.code from public.provider_document_versions d join public.provider_document_families family on family.id=d.family_id where d.provider_organization_id=p.provider_organization_id and exists(select 1 from public.provider_document_service_links link join public.provider_services ps on ps.id=link.provider_service_id join public.catalog_services s on s.id=ps.service_id where link.document_version_id=d.id and s.library_id=f.library_id)order by d.family_id,d.version_number desc)v),'[]'::jsonb))order by o.display_name,p.provider_organization_id),'[]'::jsonb)into result
 from public.provider_profiles p join public.organizations o on o.id=p.provider_organization_id where exists(select 1 from public.provider_services ps join public.catalog_services s on s.id=ps.service_id where ps.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id);
 return result;
end$$;
