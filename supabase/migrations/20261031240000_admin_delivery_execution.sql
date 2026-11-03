-- Additive administrative execution and authoritative actor projections.
begin;
create table public.organization_administration_profiles (
 organization_id uuid primary key references public.organizations(id),
 role_codes text[] not null default '{}' check(role_codes <@ array['CLIENT','PROVIDER','FRANCHISE','INTERNAL']::text[]),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object'),
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default clock_timestamp()
);
alter table public.organization_administration_profiles enable row level security;
revoke all on public.organization_administration_profiles from public,anon,authenticated,service_role;
grant select on public.organization_administration_profiles to authenticated;
create policy administration_profiles_read on public.organization_administration_profiles for select to authenticated
 using(private.is_active_org_member(organization_id) or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR']));

create function private.administration_organization_roles_v1(p_id uuid) returns text[]
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select coalesce(array_agg(distinct role_code order by role_code),'{}') from (
 select unnest(role_codes) role_code from public.organization_administration_profiles where organization_id=p_id
 union select split_part(r.role_code,'_',1) from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id
 where m.organization_id=p_id and m.status='ACTIVE' and r.revoked_at is null
 and split_part(r.role_code,'_',1) in ('CLIENT','PROVIDER','FRANCHISE')
 ) roles
$$;
revoke all on function private.administration_organization_roles_v1(uuid) from public,anon,authenticated,service_role;

create or replace function public.list_admin_supervision_page_v1(p_limit integer default 100, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  actor uuid := auth.uid();
  ofs integer := greatest(coalesce(p_offset,0),0);
  lim integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if actor is null or not private.has_platform_role(
    array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','DISPUTE_MANAGER','LIBRARY_MANAGER','READ_ONLY_AUDITOR'],
    actor
  ) then
    raise exception 'ADMIN_SUPERVISION_DENIED' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'as_of', statement_timestamp(),
    'read_only', private.has_platform_role(array['READ_ONLY_AUDITOR'], actor)
      and not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','DISPUTE_MANAGER','LIBRARY_MANAGER'], actor),
    'organizations', coalesce((
      select jsonb_agg(item order by item->>'display_name')
      from (
        select jsonb_build_object(
          'id', o.id,
          'display_name', o.display_name,
          'legal_name', o.legal_name,
          'status', o.status,
          'created_at', o.created_at,
          'member_count', (select count(*)::int from public.organization_memberships m where m.organization_id = o.id and m.status = 'ACTIVE'),
          'open_requests', (select count(*)::int from public.service_requests r where r.client_organization_id = o.id and r.status not in ('CANCELLED','CLOSED')),
          'open_disputes', (select count(*)::int from public.dispute_cases d where d.client_organization_id = o.id and d.status <> 'CLOSED')
        ) item
        from public.organizations o
        where o.status in ('ACTIVE','PENDING','SUSPENDED')
        order by o.updated_at desc nulls last, o.created_at desc, o.id
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(item order by (item->>'created_at') desc)
      from (
        select jsonb_build_object(
          'id', r.id,
          'organization_id', r.client_organization_id,
          'organization_name', o.display_name,
          'status', r.status,
          'library_id', r.library_id,
          'service_id', r.service_id,
          'created_at', r.created_at,
          'matching_runs', (select count(*)::int from public.matching_runs mr where mr.request_id = r.id),
          'rfq_count', (select count(*)::int from public.rfqs q where q.request_id = r.id),
          'quote_count', (select count(*)::int from public.quotes qt join public.rfqs q on q.id = qt.rfq_id where q.request_id = r.id)
        ) item
        from public.service_requests r
        join public.organizations o on o.id = r.client_organization_id
        order by r.created_at desc
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'quotes', coalesce((
      select jsonb_agg(item order by (item->>'updated_at') desc)
      from (
        select jsonb_build_object(
          'id', qt.id,
          'rfq_id', qt.rfq_id,
          'request_id', q.request_id,
          'provider_organization_id', qt.provider_organization_id,
          'provider_name', po.display_name,
          'client_name', co.display_name,
          'status', qt.status,
          'updated_at', qt.updated_at
        ) item
        from public.quotes qt
        join public.rfqs q on q.id = qt.rfq_id
        join public.service_requests r on r.id = q.request_id
        join public.organizations co on co.id = r.client_organization_id
        join public.organizations po on po.id = qt.provider_organization_id
        order by qt.updated_at desc nulls last
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(item order by (item->>'updated_at') desc)
      from (
        select jsonb_build_object(
          'id', m.id,
          'contract_id', m.contract_id,
          'status', m.status,
          'client_organization_id', m.client_organization_id,
          'provider_organization_id', m.provider_organization_id,
          'client_name', co.display_name,
          'provider_name', po.display_name,
          'updated_at', m.updated_at,
          'milestone_count', (select count(*)::int from public.mission_milestones mm where mm.mission_id = m.id),
          'deliverable_count', (select count(*)::int from public.deliverables md where md.mission_id = m.id)
        ) item
        from public.missions m
        join public.organizations co on co.id = m.client_organization_id
        join public.organizations po on po.id = m.provider_organization_id
        order by m.updated_at desc nulls last
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'diagnostics', coalesce((
      select jsonb_agg(item order by (item->>'completed_at') desc)
      from (
        select jsonb_build_object(
          'id', d.id,
          'organization_id', d.organization_id,
          'organization_name', o.display_name,
          'status', d.status,
          'rating', d.rating,
          'overall_score', d.overall_score,
          'completed_at', d.completed_at
        ) item
        from public.diagnostic_runs d
        join public.organizations o on o.id = d.organization_id
        order by d.completed_at desc nulls last
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'matching', coalesce((
      select jsonb_agg(item order by (item->>'started_at') desc)
      from (
        select jsonb_build_object(
          'id', mr.id,
          'request_id', mr.request_id,
          'organization_id', r.client_organization_id,
          'organization_name', o.display_name,
          'status', mr.status,
          'policy_version', mr.policy_version,
          'started_at', mr.started_at,
          'eligible_count', (select count(*)::int from public.matching_candidates c where c.matching_run_id = mr.id and c.eligible),
          'excluded_count', (select count(*)::int from public.matching_candidates c where c.matching_run_id = mr.id and not c.eligible),
          'rfq_count', (select count(*)::int from public.rfqs q where q.matching_run_id = mr.id),
          'candidates', coalesce((
            select jsonb_agg(jsonb_build_object(
              'provider_organization_id', c.provider_organization_id,
              'provider_name', po.display_name,
              'eligible', c.eligible,
              'score_basis_points', c.score_basis_points,
              'exclusion_reasons', to_jsonb(c.exclusion_reasons)
            ) order by c.eligible desc, c.score_basis_points desc)
            from public.matching_candidates c
            join public.organizations po on po.id = c.provider_organization_id
            where c.matching_run_id = mr.id
            limit 20
          ), '[]'::jsonb)
        ) item
        from public.matching_runs mr
        join public.service_requests r on r.id = mr.request_id
        join public.organizations o on o.id = r.client_organization_id
        order by mr.started_at desc
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'contracts', coalesce((
      select jsonb_agg(item order by (item->>'id'))
      from (
        select jsonb_build_object(
          'id', c.id,
          'status', c.status,
          'current_version', c.current_version,
          'client_organization_id', c.client_organization_id,
          'provider_organization_id', c.provider_organization_id,
          'client_name', co.display_name,
          'provider_name', po.display_name,
          'signature_count', (select count(*)::int from public.contract_signatures s where s.contract_id = c.id),
          'mission_id', (select m.id from public.missions m where m.contract_id = c.id order by m.created_at desc limit 1)
        ) item
        from public.contracts c
        join public.organizations co on co.id = c.client_organization_id
        join public.organizations po on po.id = c.provider_organization_id
        order by c.created_at desc
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'amendments', coalesce((
      select jsonb_agg(item order by (item->>'amendment_number') desc)
      from (
        select jsonb_build_object(
          'id', a.id,
          'contract_id', a.contract_id,
          'status', a.status,
          'amendment_number', a.amendment_number,
          'price_delta_minor', a.price_delta_minor::text,
          'client_name', co.display_name,
          'provider_name', po.display_name,
          'client_organization_id', c.client_organization_id
        ) item
        from public.contract_amendments a
        join public.contracts c on c.id = a.contract_id
        join public.organizations co on co.id = c.client_organization_id
        join public.organizations po on po.id = c.provider_organization_id
        order by a.created_at desc
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(item)
      from (
        (
          select jsonb_build_object(
            'id', d.id,
            'kind', 'CLIENT_COMPLIANCE',
            'code', d.document_type,
            'status', d.status,
            'organization_id', d.organization_id,
            'organization_name', o.display_name,
            'expires_on', d.expires_on,
            'version', d.version
          ) item
          from public.client_compliance_documents d
          join public.organizations o on o.id = d.organization_id
          order by d.created_at desc
          limit 40
        )
        union all
        (
          select jsonb_build_object(
            'id', v.id,
            'kind', f.document_kind,
            'code', f.code,
            'status', v.status,
            'organization_id', f.provider_organization_id,
            'organization_name', o.display_name,
            'expires_on', v.expires_on,
            'version', v.version_number
          ) item
          from public.provider_document_versions v
          join public.provider_document_families f on f.id = v.family_id
          join public.organizations o on o.id = f.provider_organization_id
          order by v.created_at desc
          limit 40
        )
      ) q
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(item order by (item->>'created_at') desc)
      from (
        select jsonb_build_object(
          'id', t.id,
          'subject', t.subject,
          'status', t.status,
          'object_id', t.object_id,
          'service_request_id', t.service_request_id,
          'client_organization_id', t.client_organization_id,
          'provider_organization_id', t.provider_organization_id,
          'client_name', co.display_name,
          'provider_name', po.display_name,
          'created_at', t.created_at
        ) item
        from public.internal_message_threads t
        join public.organizations co on co.id = t.client_organization_id
        join public.organizations po on po.id = t.provider_organization_id
        order by t.created_at desc
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(item order by (item->>'due_at'))
      from (
        select jsonb_build_object(
          'id', w.id,
          'source_kind', w.source_kind,
          'priority', w.priority,
          'status', w.status,
          'due_at', w.due_at,
          'title_fr', w.title_fr,
          'title_ar', w.title_ar,
          'resource_type', w.resource_type,
          'resource_id', w.resource_id,
          'organization_id', w.organization_id
        ) item
        from public.admin_work_items w
        where w.status in ('OPEN','CLAIMED','WAITING_INFORMATION')
          and w.source_kind in ('EXCEPTION','SLA_BREACH','FINANCE','DISPUTE','DOCUMENT','POOL')
        order by w.severity_rank desc, w.due_at
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'templates', coalesce((
      select jsonb_agg(item order by item->>'template_code')
      from (
        select jsonb_build_object(
          'id', t.id,
          'template_code', t.template_code,
          'event_type', t.event_type,
          'category_code', t.category_code,
          'locale', t.locale,
          'version', t.version,
          'status', t.status,
          'mandatory', t.mandatory,
          'channels', to_jsonb(t.channels)
        ) item
        from public.notification_template_versions t
        where t.status = 'ACTIVE'
        order by t.template_code, t.locale
        limit lim offset ofs
      ) q
    ), '[]'::jsonb),
    'work_enrichment', coalesce((
      select jsonb_object_agg(x.id::text, x.payload)
      from (
        select w.id, jsonb_build_object(
          'organization_name', o.display_name,
          'assignee_label', coalesce(p.display_name, case when w.assigned_to is null then null else left(w.assigned_to::text, 8) end)
        ) payload
        from public.admin_work_items w
        left join public.organizations o on o.id = w.organization_id
        left join public.user_profiles p on p.id = w.assigned_to
        where w.status in ('OPEN','CLAIMED','WAITING_INFORMATION')
        order by w.severity_rank desc, w.due_at
        limit lim offset ofs
      ) x
    ), '{}'::jsonb)
  );
end;
$$;

alter function public.list_admin_supervision_page_v1(integer,integer) rename to list_admin_supervision_page_raw_v1;
revoke all on function public.list_admin_supervision_page_raw_v1(integer,integer)from public,anon,authenticated,service_role;
create function public.list_admin_supervision_page_v1(p_limit integer default 100,p_offset integer default 0)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$declare result jsonb;begin
 result:=public.list_admin_supervision_page_raw_v1(p_limit,p_offset);
 return jsonb_set(result,'{organizations}',coalesce((select jsonb_agg(org||jsonb_build_object('role_codes',private.administration_organization_roles_v1((org->>'id')::uuid)))from jsonb_array_elements(result->'organizations')org),'[]'));
end$$;
revoke all on function public.list_admin_supervision_page_v1(integer,integer) from public,anon,service_role;
grant execute on function public.list_admin_supervision_page_v1(integer,integer) to authenticated;

alter function public.list_admin_supervision_projection(integer) rename to list_admin_supervision_legacy_delivery_v1;
revoke all on function public.list_admin_supervision_legacy_delivery_v1(integer) from public,anon,authenticated,service_role;
create function public.list_admin_supervision_projection(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;
begin
 result:=public.list_admin_supervision_legacy_delivery_v1(p_limit);
 return jsonb_set(result,'{organizations}',coalesce((select jsonb_agg(org||jsonb_build_object('role_codes',private.administration_organization_roles_v1((org->>'id')::uuid)))from jsonb_array_elements(result->'organizations')org),'[]'));
end$$;
revoke all on function public.list_admin_supervision_projection(integer) from public,anon,service_role;
grant execute on function public.list_admin_supervision_projection(integer) to authenticated;

alter function public.get_admin_organization_fiche(uuid)rename to get_admin_organization_fiche_delivery_internal;
revoke all on function public.get_admin_organization_fiche_delivery_internal(uuid)from public,anon,authenticated,service_role;
create function public.get_admin_organization_fiche(p_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare r jsonb;d jsonb;
begin
 r:=public.get_admin_organization_fiche_delivery_internal(p_organization_id);
 select details into d from public.organization_administration_profiles where organization_id=p_organization_id;
 return jsonb_set(r,'{organization}',r->'organization'||jsonb_build_object('role_codes',private.administration_organization_roles_v1(p_organization_id),'administration_details',coalesce(d,'{}'::jsonb),'row_version',(select row_version from public.organizations where id=p_organization_id)));
end$$;
revoke all on function public.get_admin_organization_fiche(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_organization_fiche(uuid)to authenticated;

create function public.list_admin_actor_directory_v1(p_limit integer default 100,p_offset integer default 0,p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR']) then raise exception 'ADMIN_ACTOR_DIRECTORY_DENIED' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(row)),'[]') into result from (
 select m.user_id,m.id membership_id,m.organization_id,o.display_name organization_name,m.status,m.updated_at,
 coalesce((select array_agg(r.role_code order by r.role_code)from public.organization_member_roles r where r.membership_id=m.id and r.revoked_at is null),'{}')roles,
 case when exists(select 1 from auth.mfa_factors f where f.user_id=m.user_id and f.status='verified')then'ENABLED'else'DISABLED'end mfa_status,
 (select count(*)::integer from auth.sessions s where s.user_id=m.user_id) session_count
 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
 where p_user_id is null or m.user_id=p_user_id order by m.id limit greatest(1,least(p_limit,500)) offset greatest(p_offset,0)
 )row;
 return jsonb_build_object('rows',result,'total',(select count(*) from public.organization_memberships m where p_user_id is null or m.user_id=p_user_id));
end$$;
revoke all on function public.list_admin_actor_directory_v1(integer,integer,uuid)from public,anon,service_role;
grant execute on function public.list_admin_actor_directory_v1(integer,integer,uuid)to authenticated;

create function public.get_admin_resource_history_v1(p_resource_id text,p_organization_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid() is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','DISPUTE_MANAGER','LIBRARY_MANAGER','READ_ONLY_AUDITOR']) then raise exception 'ADMIN_HISTORY_DENIED' using errcode='42501';end if;
 return coalesce((select jsonb_agg(row order by row->>'occurredAt') from (select jsonb_build_object('id',id::text,'action',action,'occurredAt',occurred_at,'actorType',actor_type,'correlationId',correlation_id)row from public.audit_events where resource_id=p_resource_id and (p_organization_id is null or organization_id=p_organization_id)order by id desc limit 200)q),'[]');
end$$;
revoke all on function public.get_admin_resource_history_v1(text,uuid)from public,anon,service_role;
grant execute on function public.get_admin_resource_history_v1(text,uuid)to authenticated;

-- Approval authorizes requesting owner consent; it never impersonates the owner.
create table public.admin_document_reuse_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),action_request_id uuid not null unique references public.admin_operational_action_requests(id),
 organization_id uuid not null references public.organizations(id),document_id uuid not null,target_type text not null check(target_type in('SERVICE_REQUEST','CONTRACT_VERSION','MISSION')),
 target_id uuid not null,purpose text not null check(length(btrim(purpose))between 3 and 500),
 status text not null default'PENDING_OWNER_CONSENT'check(status in('PENDING_OWNER_CONSENT','LINKED','DECLINED')),
 binding_id uuid references public.client_document_bindings(id),responded_by uuid references auth.users(id),created_at timestamptz not null default clock_timestamp(),responded_at timestamptz,
 foreign key(document_id,organization_id)references public.client_compliance_documents(id,organization_id));
alter table public.admin_document_reuse_requests_v1 enable row level security;
revoke all on public.admin_document_reuse_requests_v1 from public,anon,authenticated,service_role;
grant select on public.admin_document_reuse_requests_v1 to authenticated;
create policy admin_document_reuse_requests_read on public.admin_document_reuse_requests_v1 for select to authenticated using(private.has_org_role(organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
create function public.list_my_admin_document_reuse_requests_v1(p_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'CLIENT_DOCUMENT_REUSE_DENIED'using errcode='42501';end if;
 return jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('id',id,'document_id',document_id,'target_type',target_type,'target_id',target_id,'purpose',purpose,'status',status,'created_at',created_at)order by created_at desc)from public.admin_document_reuse_requests_v1 where organization_id=p_organization_id),'[]'::jsonb));
end$$;
create function public.respond_admin_document_reuse_v1(p_request_id uuid,p_accept boolean,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare r public.admin_document_reuse_requests_v1%rowtype;linked jsonb;c uuid:=extensions.gen_random_uuid();outcome text;
begin
 select*into r from public.admin_document_reuse_requests_v1 where id=p_request_id for update;
 if r.id is null or auth.uid()is null or auth.role()is distinct from'authenticated'or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'CLIENT_DOCUMENT_REUSE_DENIED'using errcode='42501';end if;
 if p_accept is null or length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200 then raise exception'INVALID_REUSE_RESPONSE'using errcode='22023';end if;
 if r.status='LINKED'and p_accept then return jsonb_build_object('outcome','ADMIN_DOCUMENT_REUSE_LINKED','binding_id',r.binding_id);end if;
 if r.status='DECLINED'and not p_accept then return jsonb_build_object('outcome','ADMIN_DOCUMENT_REUSE_DECLINED');end if;
 if r.status<>'PENDING_OWNER_CONSENT'then raise exception'ADMIN_DOCUMENT_REUSE_ALREADY_RESPONDED'using errcode='55000';end if;
 if p_accept then
  linked:=public.link_verified_client_document(r.document_id,r.target_type,r.target_id,r.purpose,'admin-reuse:'||r.id::text,c);
  update public.admin_document_reuse_requests_v1 set status='LINKED',binding_id=(linked->>'binding_id')::uuid,responded_by=auth.uid(),responded_at=clock_timestamp()where id=r.id;
  outcome:='ADMIN_DOCUMENT_REUSE_LINKED';
 else
  update public.admin_document_reuse_requests_v1 set status='DECLINED',responded_by=auth.uid(),responded_at=clock_timestamp()where id=r.id;
  outcome:='ADMIN_DOCUMENT_REUSE_DECLINED';
 end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,auth.uid(),'USER','admin.document.reuse.owner_responded','admin_document_reuse_request',r.id::text,c,jsonb_build_object('accepted',p_accept),repeat('0',64));
 return jsonb_build_object('outcome',outcome,'binding_id',linked->>'binding_id');
end$$;
revoke all on function public.list_my_admin_document_reuse_requests_v1(uuid),public.respond_admin_document_reuse_v1(uuid,boolean,text)from public,anon,authenticated,service_role;
grant execute on function public.list_my_admin_document_reuse_requests_v1(uuid),public.respond_admin_document_reuse_v1(uuid,boolean,text)to authenticated;

create or replace function public.complete_admin_operational_action(p_action_request_id uuid,p_execution_result_hash text,p_success boolean,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$declare x public.admin_operational_action_requests%rowtype;r jsonb;g uuid;begin if current_setting('matricia.admin_execution_id',true)is distinct from p_action_request_id::text then raise exception'ADMIN_EXECUTOR_RECEIPT_REQUIRED'using errcode='42501';end if;if auth.role()<>'service_role'then raise exception'ADMIN_ACTION_EXECUTION_DENIED'using errcode='42501';end if;if p_execution_result_hash!~'^[0-9a-f]{64}$'then raise exception'INVALID_ADMIN_EXECUTION_RESULT'using errcode='22023';end if;select*into x from public.admin_operational_action_requests where id=p_action_request_id for update;if not found or x.status<>'AUTHORIZED'then raise exception'ADMIN_ACTION_NOT_AUTHORIZED'using errcode='55000';end if;update public.admin_operational_action_requests set status=case when p_success then'EXECUTED'else'FAILED'end,executed_at=clock_timestamp(),execution_result_hash=p_execution_result_hash,row_version=row_version+1 where id=x.id;if p_success and x.action_type='GRANT_SUPPORT_ACCESS'then insert into public.admin_support_access_grants(action_request_id,target_organization_id,support_user_id,access_mode,resource_type,resource_id,expires_at)values(x.id,x.organization_id,x.support_user_id,x.support_access_mode,x.resource_type,x.resource_id,x.support_expires_at)returning id into g;end if;r:=jsonb_build_object('outcome',case when p_success then'ADMIN_ACTION_EXECUTED'else'ADMIN_ACTION_FAILED'end,'action_request_id',x.id,'support_access_grant_id',g,'result_hash',p_execution_result_hash);insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(x.organization_id,'SERVICE','admin.action.completed','admin_action_request',x.id::text,p_correlation_id,jsonb_build_object('success',p_success,'result_hash',p_execution_result_hash,'support_access_grant_id',g),repeat('0',64));insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(x.organization_id,'admin_action_request',x.id::text,case when p_success then'AdminActionExecutedV1'else'AdminActionFailedV1'end,p_correlation_id,r);return r;end$$;

create table public.admin_configuration_drafts_v1(
 action_request_id uuid primary key references public.admin_operational_action_requests(id),organization_id uuid references public.organizations(id),resource_type text not null,resource_id text not null,payload jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
alter table public.admin_configuration_drafts_v1 enable row level security;
revoke all on public.admin_configuration_drafts_v1 from public,anon,authenticated,service_role;
grant select on public.admin_configuration_drafts_v1 to authenticated;
create policy admin_configuration_drafts_read on public.admin_configuration_drafts_v1 for select to authenticated using(private.admin_command_access(auth.uid())or private.has_platform_role(array['READ_ONLY_AUDITOR'],auth.uid()));

create function public.execute_admin_operational_action_v1(p_action_request_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype; payload jsonb; org public.organizations%rowtype;
 member public.organization_memberships%rowtype; result jsonb; result_hash text; target uuid; new_role text; approvals integer; invitation uuid; invited_user uuid; invited_email text; failure_code text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'ADMIN_ACTION_EXECUTION_DENIED' using errcode='42501';end if;
 select * into x from public.admin_operational_action_requests where id=p_action_request_id for update;
 if not found then raise exception 'ADMIN_ACTION_NOT_FOUND' using errcode='P0002';end if;
 if x.status='EXECUTED'then return jsonb_build_object('outcome','ADMIN_ACTION_EXECUTED','action_request_id',x.id,'result_hash',x.execution_result_hash);end if;
 if x.status<>'AUTHORIZED'then raise exception 'ADMIN_ACTION_NOT_AUTHORIZED' using errcode='55000';end if;
 if x.target_environment='PRODUCTION' and length(coalesce(x.production_authorization_reference,''))<8 then raise exception 'PRODUCTION_AUTHORIZATION_REQUIRED' using errcode='42501';end if;
 if not private.admin_command_access(x.requested_by)then raise exception 'ADMIN_REQUESTER_ACCESS_REVOKED' using errcode='42501';end if;
 select count(distinct d.decided_by) into approvals from public.admin_operational_action_decisions d
 where d.action_request_id=x.id and d.decision='APPROVE'and d.decided_by<>x.requested_by and d.request_payload_hash=x.request_payload_hash
 and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','DISPUTE_MANAGER','LIBRARY_MANAGER'],d.decided_by);
 if approvals<x.approvals_required then raise exception 'ADMIN_APPROVALS_NO_LONGER_VALID' using errcode='42501';end if;
 payload:=x.redacted_summary;
 begin
 if coalesce((payload->>'draft')::boolean,false)or payload->>'intent'='INVITE_DRAFT'then
  insert into public.admin_configuration_drafts_v1(action_request_id,organization_id,resource_type,resource_id,payload,created_by)values(x.id,x.organization_id,x.resource_type,x.resource_id,payload,x.requested_by);
  result:=jsonb_build_object('draft_id',x.id,'status','DRAFT');
 elsif x.resource_type='INVITATION'and payload->>'intent'='INVITE_USER'then
  if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],x.requested_by)or x.organization_id is null then raise exception'ADMIN_INVITATION_DENIED'using errcode='42501';end if;
  invited_email:=lower(btrim(payload->>'invitedEmail'));new_role:=payload->>'roleCode';
  if invited_email!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'or not exists(select 1 from public.role_definitions where code=new_role and scope_type in('ORGANIZATION','FRANCHISE'))then raise exception'INVALID_ADMIN_INVITATION'using errcode='22023';end if;
  select id into invited_user from auth.users where lower(email)=invited_email;
  if invited_user=x.requested_by then raise exception'SELF_INVITATION_FORBIDDEN'using errcode='42501';end if;
  insert into public.organization_invitations(organization_id,invited_user_id,invited_email,invited_by,expires_at)values(x.organization_id,invited_user,invited_email,x.requested_by,clock_timestamp()+interval'7 days')returning id into invitation;
  insert into public.organization_invitation_roles(invitation_id,role_code)values(invitation,new_role);
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(x.organization_id,'organization_invitation',invitation::text,'OrganizationEmailInvitationRequestedV1',p_correlation_id,jsonb_build_object('invitation_id',invitation,'organization_id',x.organization_id,'invited_email',invited_email,'expires_at',clock_timestamp()+interval'7 days','role_codes',array[new_role],'locale',payload->>'inviteLocale'),'admin-invitation:'||x.id::text);
  result:=jsonb_build_object('invitation_id',invitation,'status','PENDING','delivery','OUTBOX_PENDING');
 elsif x.action_type='GRANT_SUPPORT_ACCESS'then
  if x.support_expires_at<=clock_timestamp()then raise exception 'SUPPORT_GRANT_EXPIRED' using errcode='55000';end if;
  result:=jsonb_build_object('support','AUTHORIZED_SCOPED_READ');
 elsif x.resource_type='ORGANIZATION'then
  target:=x.resource_id::uuid;
  if x.organization_id is not null and x.organization_id<>target then raise exception 'ADMIN_RESOURCE_SCOPE_MISMATCH'using errcode='42501';end if;
  if payload->>'intent'='CREATE_ORGANIZATION'then
   if length(btrim(coalesce(payload->>'legalName','')))<2 or length(btrim(coalesce(payload->>'displayName','')))<2 then raise exception'INVALID_ORGANIZATION_NAMES'using errcode='22023';end if;
   insert into public.organizations(id,legal_name,display_name,country_code,status,created_by)
   values(target,payload->>'legalName',payload->>'displayName',case when nullif(payload->>'country','')is null then'MA'when payload->>'country'~'^[A-Za-z]{2}$'then upper(payload->>'country')else null end,'PENDING',x.requested_by);
  else
   select * into org from public.organizations where id=target for update;
   if not found then raise exception 'ORGANIZATION_NOT_FOUND'using errcode='P0002';end if;
   if (payload->>'expectedRowVersion')is null or (payload->>'expectedRowVersion')::integer<>org.row_version then raise exception 'STALE_ORGANIZATION'using errcode='40001';end if;
   if x.action_type in('SUSPEND_ENTITY','RESTRICT_ENTITY')then
    update public.organizations set status=case when x.action_type='RESTRICT_ENTITY'then'ARCHIVED'else'SUSPENDED'end,updated_at=clock_timestamp(),row_version=row_version+1 where id=target;
   else
    update public.organizations set legal_name=coalesce(nullif(payload->>'legalName',''),legal_name),display_name=coalesce(nullif(payload->>'displayName',''),display_name),country_code=coalesce(nullif(upper(payload->>'country'),''),country_code),status=coalesce(nullif(payload->>'status',''),status),updated_at=clock_timestamp(),row_version=row_version+1 where id=target;
   end if;
  end if;
  insert into public.organization_administration_profiles(organization_id,role_codes,details,updated_by)
  values(target,case when payload->>'kind' in('CLIENT','PROVIDER','FRANCHISE','INTERNAL')then array[payload->>'kind']else'{}'end,payload,x.requested_by)
  on conflict(organization_id)do update set details=organization_administration_profiles.details||excluded.details,
  role_codes=case when cardinality(excluded.role_codes)>0 then excluded.role_codes else organization_administration_profiles.role_codes end,updated_by=excluded.updated_by,updated_at=clock_timestamp();
  result:=jsonb_build_object('organization_id',target);
 elsif x.resource_type in('MEMBERSHIP','USER')then
  target:=coalesce(nullif(payload->>'userId','')::uuid,x.resource_id::uuid);
  select * into member from public.organization_memberships where organization_id=x.organization_id and user_id=target for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'using errcode='P0002';end if;
  if payload->>'currentRole'is not null and not exists(select 1 from public.organization_member_roles where membership_id=member.id and role_code=payload->>'currentRole'and revoked_at is null)then raise exception 'STALE_MEMBERSHIP_ROLE'using errcode='40001';end if;
  if x.action_type in('SUSPEND_ENTITY','RESTRICT_ENTITY')then
   update public.organization_memberships set status=case when x.action_type='RESTRICT_ENTITY'then'REVOKED'else'SUSPENDED'end,updated_at=clock_timestamp(),row_version=row_version+1 where id=member.id;
  else
   new_role:=payload->>'newRole';
   if not exists(select 1 from public.role_definitions where code=new_role and scope_type in('ORGANIZATION','FRANCHISE'))then raise exception 'ADMIN_ROLE_NOT_ALLOWED'using errcode='22023';end if;
   update public.organization_member_roles set revoked_at=clock_timestamp()where membership_id=member.id and role_code=payload->>'currentRole' and revoked_at is null;
   insert into public.organization_member_roles(membership_id,role_code,granted_by)values(member.id,new_role,x.requested_by)
   on conflict(membership_id,role_code)do update set revoked_at=null,granted_by=excluded.granted_by,granted_at=clock_timestamp();
   update public.organization_memberships set row_version=row_version+1,updated_at=clock_timestamp()where id=member.id;
  end if;
  result:=jsonb_build_object('membership_id',member.id);
 elsif x.resource_type='DOCUMENT'and payload->>'view'='reutilisation'then
  target:=nullif(payload->>'documentId','')::uuid;
  if not exists(select 1 from public.client_compliance_documents where id=target and organization_id=x.organization_id)or private.client_document_target_organization(payload->>'destination',nullif(payload->>'targetId','')::uuid)is distinct from x.organization_id then raise exception 'CLIENT_DOCUMENT_TARGET_OUTSIDE_TENANT'using errcode='23514';end if;
  insert into public.admin_document_reuse_requests_v1(action_request_id,organization_id,document_id,target_type,target_id,purpose)
  values(x.id,x.organization_id,target,payload->>'destination',(payload->>'targetId')::uuid,payload->>'purpose');
  result:=jsonb_build_object('document_id',target,'status','PENDING_OWNER_CONSENT');
 elsif x.resource_type='SESSION'and x.action_type='RESTRICT_ENTITY'then
  target:=x.resource_id::uuid;
  if x.organization_id is null or not exists(select 1 from public.organization_memberships where organization_id=x.organization_id and user_id=target)then raise exception 'ADMIN_SESSION_SCOPE_DENIED'using errcode='42501';end if;
  delete from auth.sessions where user_id=target;
  result:=jsonb_build_object('user_id',target,'sessions_revoked',true);
 else
  raise exception 'ADMIN_INTENT_NOT_SUPPORTED'using errcode='22023';
 end if;
 result_hash:=private.canonical_request_hash(jsonb_build_object('request_id',x.id,'payload',payload,'result',result));
 perform set_config('matricia.admin_execution_id',x.id::text,true);
 return public.complete_admin_operational_action(x.id,result_hash,true,p_correlation_id)||jsonb_build_object('effect',result);
 exception when others then
  get stacked diagnostics failure_code=returned_sqlstate;
  result_hash:=private.canonical_request_hash(jsonb_build_object('request_id',x.id,'failure_code',failure_code));
  perform set_config('matricia.admin_execution_id',x.id::text,true);
  return public.complete_admin_operational_action(x.id,result_hash,false,p_correlation_id)||jsonb_build_object('failure_code',failure_code);
 end;
end$$;
revoke all on function public.execute_admin_operational_action_v1(uuid,uuid)from public,anon,authenticated;
grant execute on function public.execute_admin_operational_action_v1(uuid,uuid)to service_role;
notify pgrst,'reload schema';
commit;
