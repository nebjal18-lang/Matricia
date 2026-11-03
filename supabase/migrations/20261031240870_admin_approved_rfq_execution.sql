begin;
-- The existing public command already authorizes central administrators. Its
-- private service variant names the approved actor explicitly and preserves
-- entitlement, eligibility, frozen request/version and fair-rotation checks.
do $$declare body text;begin
 select prosrc into body from pg_proc where oid='public.open_service_request_rfq(uuid,uuid,timestamptz,text,uuid)'::regprocedure;
 if strpos(body,'v_actor uuid:=auth.uid();')=0 or strpos(body,'where c.matching_run_id=p_matching_run_id and c.eligible')=0 then raise exception'APPROVED_RFQ_CORE_PATCH_TARGET_NOT_FOUND';end if;
 body:=replace(body,'v_actor uuid:=auth.uid();','v_actor uuid:=p_execution_actor;');
 body:=replace(body,E'begin\n',E'begin\n if auth.role() is distinct from ''service_role'' or p_execution_actor is null or cardinality(p_selected_providers) is null or cardinality(p_selected_providers)=0 then raise exception ''APPROVED_RFQ_EXECUTION_DENIED'' using errcode=''42501'';end if;\n');
 body:=replace(body,'where c.matching_run_id=p_matching_run_id and c.eligible','where c.matching_run_id=p_matching_run_id and c.eligible and c.provider_organization_id=any(p_selected_providers)');
 body:=replace(body,'insert into public.rfqs(id,request_id,request_version_id,matching_run_id,deadline,invited_count,opened_by)', 'if cardinality(p_selected_providers)>v_run.target_panel_size then raise exception''APPROVED_RFQ_PANEL_TOO_LARGE''using errcode=''22023'';end if; insert into public.rfqs(id,request_id,request_version_id,matching_run_id,deadline,invited_count,opened_by)');
 body:=replace(body,'get diagnostics v_invited=row_count;', 'get diagnostics v_invited=row_count; if v_invited<>cardinality(p_selected_providers)then raise exception''APPROVED_RFQ_PANEL_NO_LONGER_ELIGIBLE''using errcode=''55000'';end if;');
 execute format('create function private.open_approved_admin_rfq_v1(p_request_id uuid,p_matching_run_id uuid,p_deadline timestamptz,p_idempotency_key text,p_correlation_id uuid,p_execution_actor uuid,p_selected_providers uuid[])returns jsonb language plpgsql security definer set search_path=pg_catalog as %L',body);
end$$;
revoke all on function private.open_approved_admin_rfq_v1(uuid,uuid,timestamptz,text,uuid,uuid,uuid[])from public,anon,authenticated,service_role;
create table public.admin_consultation_executions_v1(action_request_id uuid primary key references public.admin_operational_action_requests(id),organization_id uuid not null references public.organizations(id),rfq_id uuid not null unique references public.rfqs(id),approved_parameters jsonb not null,executed_by uuid not null references auth.users(id),executed_at timestamptz not null default clock_timestamp());
alter table public.admin_consultation_executions_v1 enable row level security;
revoke all on public.admin_consultation_executions_v1 from public,anon,authenticated,service_role;
grant select on public.admin_consultation_executions_v1 to authenticated;
create policy admin_consultation_execution_read on public.admin_consultation_executions_v1 for select to authenticated using(private.has_org_role(organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'],auth.uid())or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
create trigger admin_consultation_execution_immutable before update or delete on public.admin_consultation_executions_v1 for each row execute function private.prevent_update_delete();
create function private.execute_admin_consultation_v1(p_request_id uuid,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype;run public.matching_runs%rowtype;selected uuid[];result jsonb;deadline timestamptz;
begin
 select*into x from public.admin_operational_action_requests where id=p_request_id;
 if auth.role()is distinct from'service_role'or x.status<>'AUTHORIZED'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],x.requested_by)then raise exception'ADMIN_CONSULTATION_EXECUTION_DENIED'using errcode='42501';end if;
 select*into run from public.matching_runs where id=x.resource_id::uuid;
 if run.id is null or not exists(select 1 from public.service_requests where id=run.request_id and client_organization_id=x.organization_id)then raise exception'ADMIN_CONSULTATION_SCOPE_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(x.redacted_summary->>'note','')))not between 3 and 2000 or length(coalesce(x.redacted_summary->>'context',''))>10000 or x.redacted_summary->>'channel'<>'platform'then raise exception'INVALID_APPROVED_CONSULTATION'using errcode='22023';end if;
 select array_agg(distinct v::uuid order by v::uuid)into selected from jsonb_array_elements_text(x.redacted_summary->'providerIds')v;
 deadline:=((x.redacted_summary->>'dueAt')::date+time'23:59:59')at time zone'Africa/Casablanca';
 if deadline is null then raise exception'APPROVED_CONSULTATION_DEADLINE_REQUIRED'using errcode='22023';end if;
 result:=private.open_approved_admin_rfq_v1(run.request_id,run.id,deadline,'admin-consultation:'||x.id::text,p_correlation_id,x.requested_by,selected);
 update public.rfqs set confidentiality_settings=confidentiality_settings||jsonb_build_object('admin_consultation',jsonb_build_object('subject',x.redacted_summary->>'note','context',x.redacted_summary->>'context','response_deadline',x.redacted_summary->>'dueAt','channel','platform'))where id=(result->>'rfq_id')::uuid;
 insert into public.admin_consultation_executions_v1(action_request_id,organization_id,rfq_id,approved_parameters,executed_by)values(x.id,x.organization_id,(result->>'rfq_id')::uuid,x.redacted_summary,x.requested_by);
 return result||jsonb_build_object('status','RFQ_OPENED','deadline',deadline,'approved_provider_ids',selected);
end$$;
revoke all on function private.execute_admin_consultation_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'elsif x.resource_type=''MATCHING''and payload->>''view''=''consultation''then')=0 then raise exception'ADMIN_CONSULTATION_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'elsif x.resource_type=''MATCHING''and payload->>''view''=''consultation''then','elsif x.resource_type=''MATCHING''and payload->>''view''=''consultation''and payload->>''decision''in(''SEND'',''SUBMIT'')then result:=private.execute_admin_consultation_v1(x.id,p_correlation_id); elsif x.resource_type=''MATCHING''and payload->>''view''=''consultation''then');
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
