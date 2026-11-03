begin;
-- Store the original authorized intent. The Client never has to recreate its
-- exact reason, comparison, file fingerprint or idempotency key after review.
create table private.client_approval_commands_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),requested_by uuid not null references auth.users(id),
 resource_type text not null check(resource_type in('QUOTE_SELECTION','CONTRACT_GENERATION','COST_ALLOCATION')),
 action_kind text not null check(action_kind in('QUOTE_SELECTION','CONTRACT_GENERATION','COST_ALLOCATION','COST_ALLOCATION_TYPED')),
 payload_hash text not null,source_hash text not null,arguments jsonb not null check(jsonb_typeof(arguments)='object'),
 idempotency_key text not null,correlation_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,requested_by,resource_type,payload_hash)
);
create table private.client_approval_command_links_v1(approval_request_id uuid primary key references public.business_approval_requests(id),command_id uuid not null references private.client_approval_commands_v1(id));
create table private.client_approval_command_executions_v1(command_id uuid primary key references private.client_approval_commands_v1(id),result jsonb not null,executed_by uuid not null references auth.users(id),executed_at timestamptz not null default clock_timestamp());
do $$declare t text;begin foreach t in array array['client_approval_commands_v1','client_approval_command_links_v1','client_approval_command_executions_v1']loop
 execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on private.%I for each row execute function private.prevent_update_delete()',t||'_immutable',t);
end loop;end$$;

create function private.client_approval_command_source_v1(p_org uuid,p_kind text,p_args jsonb)returns text
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare source jsonb;
begin
 if p_kind='QUOTE_SELECTION'then
  select jsonb_build_object('request',sr.id,'request_version',sr.current_version_id,'request_row_version',sr.row_version,'request_status',sr.status,'rfq_version',r.request_version_id,'quote_current',q.current_version_id,'quote_status',q.status,'version',v.id,'hash',v.content_hash,'comparison_hash',s.input_hash)
  into source from public.quote_versions v join public.quotes q on q.id=v.quote_id join public.rfqs r on r.id=q.rfq_id join public.service_requests sr on sr.id=r.request_id
  join public.quote_comparison_snapshots s on s.id=(p_args->>'comparison_snapshot_id')::uuid and s.rfq_id=r.id and s.client_organization_id=sr.client_organization_id
  where sr.client_organization_id=p_org and q.id=(p_args->>'quote_id')::uuid and v.id=(p_args->>'expected_version_id')::uuid;
 elsif p_kind='CONTRACT_GENERATION'then
  select jsonb_build_object('request',sr.id,'request_version',sr.current_version_id,'request_row_version',sr.row_version,'request_status',sr.status,'quote_current',q.current_version_id,'quote_selected',q.selected_version_id,'version',v.id,'hash',v.content_hash,'template',t.id,'template_hash',t.content_hash,'template_status',t.status,'commission',c.id,'commission_hash',c.content_hash,'commission_status',c.status)
  into source from public.service_requests sr join public.rfqs r on r.request_id=sr.id join public.quotes q on q.rfq_id=r.id join public.quote_versions v on v.id=(p_args->>'quote_version_id')::uuid and v.quote_id=q.id
  join public.contract_policy_versions_v1 t on t.id=(p_args->>'template_version_id')::uuid join public.contract_policy_versions_v1 c on c.id=(p_args->>'commission_policy_version_id')::uuid
  where sr.id=(p_args->>'request_id')::uuid and sr.client_organization_id=p_org;
 else
  select jsonb_build_object('budget',b.id,'version',b.current_version,'row_version',b.row_version,'status',b.status,'currency',b.currency)into source
  from public.client_annual_budgets b where b.id=(p_args->>'budget_id')::uuid and b.organization_id=p_org;
 end if;
 if source is null then raise exception'CLIENT_APPROVAL_SOURCE_UNAVAILABLE'using errcode='40001';end if;
 return private.canonical_request_hash(source);
end$$;
create function private.save_client_approval_command_v1(p_approval_id uuid,p_kind text,p_args jsonb,p_key text,p_correlation uuid)returns void
language plpgsql security definer set search_path=pg_catalog,private as $$
declare q public.business_approval_requests%rowtype;c private.client_approval_commands_v1%rowtype;source text;
begin
 select*into q from public.business_approval_requests where id=p_approval_id;
 if q.id is null or q.requested_by is distinct from auth.uid()or p_kind not in('QUOTE_SELECTION','CONTRACT_GENERATION','COST_ALLOCATION','COST_ALLOCATION_TYPED')or q.resource_type<>(case when p_kind='COST_ALLOCATION_TYPED'then'COST_ALLOCATION'else p_kind end) then raise exception'CLIENT_APPROVAL_COMMAND_DENIED'using errcode='42501';end if;
 source:=private.client_approval_command_source_v1(q.organization_id,p_kind,p_args);
 insert into private.client_approval_commands_v1(organization_id,requested_by,resource_type,action_kind,payload_hash,source_hash,arguments,idempotency_key,correlation_id)
 values(q.organization_id,auth.uid(),q.resource_type,p_kind,q.payload_hash,source,p_args,p_key,p_correlation)
 on conflict(organization_id,requested_by,resource_type,payload_hash)do nothing;
 select*into c from private.client_approval_commands_v1 where organization_id=q.organization_id and requested_by=auth.uid()and resource_type=q.resource_type and payload_hash=q.payload_hash;
 if c.action_kind<>p_kind or c.source_hash<>source then raise exception'CLIENT_APPROVAL_COMMAND_CHANGED'using errcode='40001';end if;
 insert into private.client_approval_command_links_v1(approval_request_id,command_id)values(q.id,c.id)on conflict do nothing;
end$$;
-- Lock financial parties before the approval queue, for both initial and resumed
-- commands. Public canonical wrappers still perform every original guard.
do $save_commands$
declare signature regprocedure;body text;kind text;args text;lock_statement text;needle text:='if approval->>''outcome''=''CLIENT_APPROVAL_REQUIRED''then return approval;end if;';
begin
 for signature,kind,args,lock_statement in values
 ('public.select_quote_and_notify(uuid,uuid,text,uuid,text,uuid)'::regprocedure,'QUOTE_SELECTION',
 'jsonb_build_object(''quote_id'',p_quote_id,''expected_version_id'',p_expected_version_id,''selection_reason'',btrim(p_selection_reason),''comparison_snapshot_id'',p_comparison_snapshot_id)',
 'perform private.lock_contract_financial_parties_v1(org,version.provider_organization_id);'),
 ('public.generate_selected_quote_contract_v1(uuid,uuid,integer,uuid,uuid,text,text,uuid)'::regprocedure,'CONTRACT_GENERATION',
 'jsonb_build_object(''request_id'',p_request_id,''quote_version_id'',p_quote_version_id,''expected_request_row_version'',p_expected_request_row_version,''template_version_id'',p_template_version_id,''commission_policy_version_id'',p_commission_policy_version_id,''reason'',btrim(p_reason))',
 'perform private.lock_contract_financial_parties_v1(request.client_organization_id,version.provider_organization_id);'),
 ('public.record_client_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)'::regprocedure,'COST_ALLOCATION',
 'jsonb_build_object(''organization_id'',p_organization_id,''cost_center_id'',p_cost_center_id,''budget_id'',p_budget_id,''project_id'',p_project_id,''allocation_type'',p_allocation_type,''amount_minor'',p_amount_minor::text,''reference_type'',p_reference_type,''reference_id'',p_reference_id,''evidence_hash'',p_evidence_hash)',
 'perform pg_advisory_xact_lock(hashtextextended(''subscription-financial:''||p_organization_id::text,0));'),
 ('public.record_client_typed_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)'::regprocedure,'COST_ALLOCATION_TYPED',
 'jsonb_build_object(''organization_id'',p_organization_id,''cost_center_id'',p_cost_center_id,''budget_id'',p_budget_id,''project_id'',p_project_id,''allocation_type'',p_allocation_type,''amount_minor'',p_amount_minor::text,''reference_type'',p_reference_type,''reference_id'',p_reference_id,''evidence_hash'',p_evidence_hash)',
 'perform pg_advisory_xact_lock(hashtextextended(''subscription-financial:''||p_organization_id::text,0));')loop
 body:=pg_get_functiondef(signature);
 if strpos(body,needle)=0 then raise exception'CLIENT_APPROVAL_COMMAND_PATCH_SOURCE_MISMATCH';end if;
 if kind like'COST_ALLOCATION%'then body:=replace(body,' select * into budget from', ' '||lock_statement||chr(10)||' select * into budget from');
 else body:=replace(body,'  approval:=private.admit_client_commitment_v1(', '  '||lock_statement||chr(10)||'  approval:=private.admit_client_commitment_v1(');end if;
 body:=replace(body,needle,'if approval->>''outcome''=''CLIENT_APPROVAL_REQUIRED''then perform private.save_client_approval_command_v1((approval->>''approval_request_id'')::uuid,'||quote_literal(kind)||','||args||',p_idempotency_key,p_correlation_id);return approval;end if;');
 execute body;
 end loop;
end $save_commands$;

create function public.execute_client_approved_commitment_v1(p_approval_request_id uuid,p_expected_row_version integer)returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare q public.business_approval_requests%rowtype;c private.client_approval_commands_v1%rowtype;v jsonb;result jsonb;provider uuid;allowed boolean;expected text;
begin
 select*into q from public.business_approval_requests where id=p_approval_request_id;
 select cmd.*into c from private.client_approval_commands_v1 cmd join private.client_approval_command_links_v1 link on link.command_id=cmd.id where link.approval_request_id=q.id;
 if c.id is null or auth.uid()is null or auth.uid()<>c.requested_by or auth.jwt()->>'aal'is distinct from'aal2'then raise exception'CLIENT_APPROVAL_RESUME_DENIED'using errcode='42501';end if;
 allowed:=case c.resource_type when'QUOTE_SELECTION'then private.has_org_role(c.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'])when'CONTRACT_GENERATION'then private.has_org_role(c.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])else private.client_budget_manage(c.organization_id)end;
 if not coalesce(allowed,false)then raise exception'CLIENT_APPROVAL_RESUME_DENIED'using errcode='42501';end if;
 v:=c.arguments;
 if c.resource_type in('QUOTE_SELECTION','CONTRACT_GENERATION')then select provider_organization_id into provider from public.quote_versions where id=coalesce(v->>'expected_version_id',v->>'quote_version_id')::uuid;end if;
 perform private.lock_contract_financial_parties_v1(c.organization_id,provider);
 perform pg_advisory_xact_lock(hashtextextended('client-commitment-approval:'||c.organization_id::text,0));
 perform 1 from private.client_approval_commands_v1 where id=c.id for update;
 allowed:=case c.resource_type when'QUOTE_SELECTION'then private.has_org_role(c.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'])when'CONTRACT_GENERATION'then private.has_org_role(c.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])else private.client_budget_manage(c.organization_id)end;
 if auth.uid()is distinct from c.requested_by or auth.jwt()->>'aal'is distinct from'aal2'or not coalesce(allowed,false)then raise exception'CLIENT_APPROVAL_RESUME_DENIED'using errcode='42501';end if;
 select e.result into result from private.client_approval_command_executions_v1 e where e.command_id=c.id;
 if result is not null then return result;end if;
 select*into q from public.business_approval_requests where id=p_approval_request_id for update;
 if q.row_version is distinct from p_expected_row_version or q.status<>'APPROVED'then raise exception'CLIENT_APPROVAL_NOT_APPROVED_OR_CHANGED'using errcode='40001';end if;
 if exists(select 1 from private.client_approval_command_links_v1 link join public.business_approval_requests a on a.id=link.approval_request_id join public.business_approval_policy_versions p on p.id=a.policy_version_id where link.command_id=c.id and(a.status<>'APPROVED'or a.requested_by<>c.requested_by or a.payload_hash<>c.payload_hash or p.status<>'ACTIVE'))then raise exception'CLIENT_APPROVAL_REVIEW_REQUIRED'using errcode='40001';end if;
 if private.client_approval_command_source_v1(c.organization_id,c.action_kind,v)<>c.source_hash then raise exception'CLIENT_APPROVAL_SOURCE_CHANGED'using errcode='40001';end if;
 case c.action_kind
 when'QUOTE_SELECTION'then result:=public.select_quote_and_notify((v->>'quote_id')::uuid,(v->>'expected_version_id')::uuid,v->>'selection_reason',(v->>'comparison_snapshot_id')::uuid,c.idempotency_key,c.correlation_id);expected:='QUOTE_SELECTED';
 when'CONTRACT_GENERATION'then result:=public.generate_selected_quote_contract_v1((v->>'request_id')::uuid,(v->>'quote_version_id')::uuid,(v->>'expected_request_row_version')::integer,(v->>'template_version_id')::uuid,(v->>'commission_policy_version_id')::uuid,v->>'reason',c.idempotency_key,c.correlation_id);expected:='SELECTED_QUOTE_CONTRACT_DRAFTED';
 when'COST_ALLOCATION'then result:=public.record_client_cost_allocation(c.organization_id,(v->>'cost_center_id')::uuid,(v->>'budget_id')::uuid,(v->>'project_id')::uuid,v->>'allocation_type',(v->>'amount_minor')::bigint,v->>'reference_type',(v->>'reference_id')::uuid,v->>'evidence_hash',c.idempotency_key,c.correlation_id);expected:='CLIENT_COST_ALLOCATED';
 when'COST_ALLOCATION_TYPED'then result:=public.record_client_typed_cost_allocation(c.organization_id,(v->>'cost_center_id')::uuid,(v->>'budget_id')::uuid,(v->>'project_id')::uuid,v->>'allocation_type',(v->>'amount_minor')::bigint,v->>'reference_type',(v->>'reference_id')::uuid,v->>'evidence_hash',c.idempotency_key,c.correlation_id);expected:='CLIENT_TYPED_COST_ALLOCATED';
 end case;
 if result->>'outcome'='CLIENT_APPROVAL_REQUIRED'then return result;end if;
 if result->>'outcome'is distinct from expected then raise exception'CLIENT_APPROVAL_EXECUTION_UNCONFIRMED'using errcode='55000';end if;
 insert into private.client_approval_command_executions_v1(command_id,result,executed_by)values(c.id,result,auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.organization_id,auth.uid(),'USER','client.approval.command_executed','client_approval_command',c.id::text,c.correlation_id,jsonb_build_object('approval_request_id',q.id,'action',c.action_kind,'outcome',expected),repeat('0',64));
 return result;
end$$;
create function public.list_my_client_approval_command_states_v1(p_organization_id uuid,p_approval_ids uuid[])returns table(approval_request_id uuid,can_resume boolean,completed boolean)
language plpgsql stable security definer set search_path=pg_catalog,private as $$
begin
 if auth.uid()is null or not private.is_active_org_member(p_organization_id)then raise exception'CLIENT_APPROVAL_COMMANDS_DENIED'using errcode='42501';end if;
 if p_approval_ids is null or cardinality(p_approval_ids)not between 1 and 25 then raise exception'INVALID_CLIENT_APPROVAL_COMMANDS'using errcode='22023';end if;
 return query select q.id,q.status='APPROVED'and q.requested_by=auth.uid()and e.command_id is null,e.command_id is not null
 from public.business_approval_requests q join private.client_approval_command_links_v1 link on link.approval_request_id=q.id join private.client_approval_commands_v1 c on c.id=link.command_id
 left join private.client_approval_command_executions_v1 e on e.command_id=c.id
 where q.organization_id=p_organization_id and q.id=any(p_approval_ids);
end$$;
revoke all on function private.client_approval_command_source_v1(uuid,text,jsonb),private.save_client_approval_command_v1(uuid,text,jsonb,text,uuid),public.execute_client_approved_commitment_v1(uuid,integer),public.list_my_client_approval_command_states_v1(uuid,uuid[])from public,anon,authenticated,service_role;
grant execute on function public.execute_client_approved_commitment_v1(uuid,integer),public.list_my_client_approval_command_states_v1(uuid,uuid[])to authenticated;
notify pgrst,'reload schema';
commit;
