begin;
-- Scope changes append operational generations. Original deliveries, receipts,
-- milestones, disputes and financial records are never rewritten or deleted.
alter table public.deliverables add column contractual_key text,
 add column source_contract_version_id uuid references public.contract_versions(id)on delete restrict,
 add column scope_generation integer not null default 1 check(scope_generation>0);
create table public.mission_scope_initial_versions_v1(
 mission_id uuid primary key references public.missions(id)on delete restrict,
 contract_version_id uuid not null references public.contract_versions(id)on delete restrict,
 source text not null check(source in('MISSION_CREATION','CREATION_AUDIT')),recorded_at timestamptz not null default clock_timestamp()
);
create table public.mission_obligation_retirements_v1(
 deliverable_id uuid primary key references public.deliverables(id)on delete restrict,
 mission_id uuid not null references public.missions(id)on delete restrict,
 amendment_id uuid not null references public.contract_amendments(id)on delete restrict,
 contract_version_id uuid not null references public.contract_versions(id)on delete restrict,
 operation text not null check(operation in('REMOVE','REPLACE')),
 replacement_deliverable_id uuid references public.deliverables(id)on delete restrict,
 previous_snapshot jsonb not null check(jsonb_typeof(previous_snapshot)='object'),
 retired_by uuid not null references auth.users(id),retired_at timestamptz not null default clock_timestamp(),
 check((operation='REPLACE')=(replacement_deliverable_id is not null))
);
create table public.mission_milestone_retirements_v1(
 milestone_id uuid primary key references public.mission_milestones(id)on delete restrict,
 mission_id uuid not null references public.missions(id)on delete restrict,
 amendment_id uuid not null references public.contract_amendments(id)on delete restrict,
 contract_version_id uuid not null references public.contract_versions(id)on delete restrict,
 previous_snapshot jsonb not null check(jsonb_typeof(previous_snapshot)='object'),
 retired_by uuid not null references auth.users(id),retired_at timestamptz not null default clock_timestamp()
);
create table private.mission_scope_execution_permits_v1(
 transaction_id bigint not null,mission_id uuid not null,amendment_id uuid not null,actor_user_id uuid not null,
 primary key(transaction_id,mission_id)
);
alter table private.mission_scope_execution_permits_v1 enable row level security;
revoke all on private.mission_scope_execution_permits_v1 from public,anon,authenticated,service_role;
do $$declare t text;begin
 foreach t in array array['mission_scope_initial_versions_v1','mission_obligation_retirements_v1','mission_milestone_retirements_v1']loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for select to authenticated using(private.mission_party_access(mission_id))',t||'_read',t);
  execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_contract_immutable_change()',t||'_immutable',t);
 end loop;
end$$;
create function private.record_mission_initial_scope_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin insert into public.mission_scope_initial_versions_v1(mission_id,contract_version_id,source)values(new.id,new.contract_version_id,'MISSION_CREATION');return new;end$$;
create trigger mission_initial_scope_v1 after insert on public.missions for each row execute function private.record_mission_initial_scope_v1();
-- Backfill only a proven creation audit, not the mutable current mission pointer.
insert into public.mission_scope_initial_versions_v1(mission_id,contract_version_id,source)
select m.id,cv.id,'CREATION_AUDIT'from public.missions m join lateral(
 select e.metadata->>'contract_version_id'cv from public.audit_events e where e.action='mission.created'and e.resource_type='mission'and e.resource_id=m.id::text order by e.id limit 1
)a on a.cv~*'^[0-9a-f-]{36}$'join public.contract_versions cv on cv.id=a.cv::uuid and cv.contract_id=m.contract_id;
create function private.bind_scope_generation_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.missions%rowtype;
begin
 select*into m from public.missions where id=new.mission_id;
 if new.contractual_key is null then new.contractual_key:=new.deliverable_key;end if;
 if new.source_contract_version_id is null then new.source_contract_version_id:=m.contract_version_id;end if;
 if not exists(select 1 from public.contract_versions v where v.id=new.source_contract_version_id and v.contract_id=m.contract_id)then raise exception'SCOPE_GENERATION_CONTRACT_MISMATCH'using errcode='23514';end if;
 return new;
end$$;
create trigger deliverable_scope_generation_v1 before insert on public.deliverables for each row execute function private.bind_scope_generation_v1();
-- Historical provenance is bound only to a proven initial creation or an
-- immutable prior ADD execution. Unattributable legacy sources remain null.
update public.deliverables d set contractual_key=d.deliverable_key,source_contract_version_id=coalesce(
 (select s.contract_version_id from public.mission_scope_initial_versions_v1 s join public.contract_items i on i.contract_version_id=s.contract_version_id and i.item_key=d.deliverable_key and i.item_type='DELIVERABLE'where s.mission_id=d.mission_id),
 (select e.contract_version_id from public.mission_amendment_executions_v1 e join public.contract_items i on i.contract_version_id=e.contract_version_id and i.item_key=d.deliverable_key and i.item_type='DELIVERABLE'join public.contract_versions v on v.id=e.contract_version_id where e.mission_id=d.mission_id and exists(select 1 from jsonb_array_elements(e.assignments_snapshot)a where a->>'deliverable_key'=d.deliverable_key)order by v.version limit 1));
create function private.preserve_scope_generation_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.contractual_key is distinct from old.contractual_key or new.source_contract_version_id is distinct from old.source_contract_version_id or new.scope_generation is distinct from old.scope_generation then raise exception'SCOPE_GENERATION_IMMUTABLE'using errcode='55000';end if;return new;
end$$;
create trigger deliverable_scope_provenance_v1 before update of contractual_key,source_contract_version_id,scope_generation on public.deliverables for each row execute function private.preserve_scope_generation_v1();
revoke all on function private.preserve_scope_generation_v1()from public,anon,authenticated,service_role;
create function private.mission_scope_initial_covers_v1(p_mission uuid,p_version uuid)returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.mission_scope_initial_versions_v1 s join public.contract_versions initial on initial.id=s.contract_version_id join public.contract_versions target on target.id=p_version where s.mission_id=p_mission and initial.contract_id=target.contract_id and initial.version>=target.version)
$$;
create function private.mission_scope_deliverable_active_v1(p_deliverable uuid)returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.deliverables d where d.id=p_deliverable)and not exists(select 1 from public.mission_obligation_retirements_v1 r where r.deliverable_id=p_deliverable)
$$;
-- Legacy REMOVE may omit item_type: the signed base item, not the client
-- payload label, determines which operational obligation changed.
create function private.mission_scope_delta_deliverable_v1(p_amendment uuid,p_delta jsonb)returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.contract_amendments a join public.contract_items i on i.contract_version_id=case when p_delta->>'operation'in('REMOVE','REPLACE')then a.base_contract_version_id else a.activated_contract_version_id end
 where a.id=p_amendment and i.item_key=p_delta->>'item_key'and i.item_type='DELIVERABLE')
$$;
do $patch$declare src text;needle text:='x->>''item_type''=''DELIVERABLE''and x->>''operation''in(''REMOVE'',''REPLACE'')';begin
 src:=pg_get_functiondef('private.record_signed_scope_exception_v1(uuid)'::regprocedure);
 if position(needle in src)=0 then raise exception'SCOPE_LEGACY_DETECTION_SOURCE_DRIFT';end if;
 execute replace(src,needle,'private.mission_scope_delta_deliverable_v1(am.id,x)and x->>''operation''in(''REMOVE'',''REPLACE'')');
end$patch$;
create function private.mission_scope_pending_v1(p_mission uuid,p_exclude uuid default null)returns boolean
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.missions m join public.contract_amendments a on a.contract_id=m.contract_id
 where m.id=p_mission and a.status='ACTIVE'and a.activated_contract_version_id is not null and a.id is distinct from p_exclude
 and exists(select 1 from jsonb_array_elements(a.deliverables_delta)x where private.mission_scope_delta_deliverable_v1(a.id,x))
 and not private.mission_scope_initial_covers_v1(m.id,a.activated_contract_version_id)
 and not exists(select 1 from public.mission_amendment_executions_v1 e where e.amendment_id=a.id))
$$;
-- Verify the entire effective signature chain, also for a completed operational
-- mission whose newly signed scope now needs a deliberate new generation.
do $migration$declare src text;begin
 src:=pg_get_functiondef('private.contract_version_signature_effective_v1(uuid,uuid)'::regprocedure);
 src:=replace(src,'private.contract_version_signature_effective_v1(','private.mission_scope_signature_effective_v1(');
 if position('c.status not in(''ACTIVE'',''AMENDED'')'in src)=0 then raise exception'SCOPE_SIGNATURE_DEFINITION_DRIFT';end if;
 src:=replace(src,'c.status not in(''ACTIVE'',''AMENDED'')','c.status not in(''ACTIVE'',''AMENDED'',''COMPLETED'')');execute src;
end$migration$;
create function private.mission_scope_target_in_chain_v1(p_contract uuid,p_target uuid)returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 with recursive chain(id)as(
 select v.id from public.contracts c join public.contract_versions v on v.contract_id=c.id and v.version=c.current_version where c.id=p_contract
 union select a.base_contract_version_id from chain x join public.contract_amendments a on a.activated_contract_version_id=x.id and a.status='ACTIVE'and a.contract_id=p_contract
 )select exists(select 1 from chain where id=p_target)
$$;
create or replace function private.mission_amendment_preparation_v1(p_amendment_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare am public.contract_amendments%rowtype;c public.contracts%rowtype;m public.missions%rowtype;v public.contract_versions%rowtype;cv public.contract_versions%rowtype;
 delta jsonb;i public.contract_items%rowtype;old_item public.contract_items%rowtype;old_d public.deliverables%rowtype;items jsonb:='[]';removals jsonb:='[]';state text:='READY';reason text;prior uuid;result jsonb;
begin
 select*into am from public.contract_amendments where id=p_amendment_id;select*into c from public.contracts where id=am.contract_id;
 select*into m from public.missions where contract_id=c.id;select*into v from public.contract_versions where id=coalesce(am.activated_contract_version_id,am.base_contract_version_id);
 select*into cv from public.contract_versions where contract_id=c.id and version=c.current_version;
 if am.id is null or c.id is null then return jsonb_build_object('status','NO_MISSION','items','[]'::jsonb,'removals','[]'::jsonb);end if;
 if m.id is null then
  return jsonb_build_object('amendment_id',am.id,'status',case when am.status='ACTIVE'and private.mission_scope_signature_effective_v1(c.id,cv.id)and not exists(select 1 from public.contract_items where contract_version_id=cv.id and item_type='DELIVERABLE')then'NO_ADDITIONAL_WORK'else'NO_MISSION'end,'no_mission_required',am.status='ACTIVE'and private.mission_scope_signature_effective_v1(c.id,cv.id)and not exists(select 1 from public.contract_items where contract_version_id=cv.id and item_type='DELIVERABLE'),'items','[]'::jsonb,'removals','[]'::jsonb);
 end if;
 if am.status<>'ACTIVE'or v.id is null then state:='AWAITING_SIGNATURE';
 elsif m.status='CANCELLED'then state:='MISSION_CANCELLED';
 elsif not private.mission_scope_signature_effective_v1(c.id,cv.id)or not private.mission_scope_target_in_chain_v1(c.id,v.id)then state:='SIGNATURE_NOT_EFFECTIVE';
 elsif exists(select 1 from public.mission_amendment_executions_v1 e where e.amendment_id=am.id)then state:=case when m.scope_reconciliation_required then'SCOPE_RECONCILIATION_REQUIRED'else'APPLIED'end;
 elsif private.mission_scope_initial_covers_v1(m.id,v.id)then state:='NO_ADDITIONAL_WORK';
 else
  select a.id into prior from public.contract_amendments a join public.contract_versions av on av.id=a.activated_contract_version_id
  where a.contract_id=c.id and a.status='ACTIVE'and av.version<v.version
  and exists(select 1 from jsonb_array_elements(a.deliverables_delta)x where private.mission_scope_delta_deliverable_v1(a.id,x))
  and not private.mission_scope_initial_covers_v1(m.id,av.id)and not exists(select 1 from public.mission_amendment_executions_v1 e where e.amendment_id=a.id)
  order by av.version,a.id limit 1;
  if prior is not null then state:='PREVIOUS_AMENDMENT_REQUIRED';end if;
  for delta in select*from jsonb_array_elements(am.deliverables_delta)loop
   if not private.mission_scope_delta_deliverable_v1(am.id,delta)then continue;end if;
   if delta->>'operation'not in('ADD','REMOVE','REPLACE')then state:='SCOPE_RECONCILIATION_REQUIRED';reason:='UNKNOWN_SIGNED_OPERATION';continue;end if;
   select*into old_item from public.contract_items where contract_version_id=am.base_contract_version_id and item_key=delta->>'item_key'and item_type='DELIVERABLE';
   select*into i from public.contract_items where contract_version_id=v.id and item_key=delta->>'item_key'and item_type='DELIVERABLE';
   select*into old_d from public.deliverables d where d.mission_id=m.id and coalesce(d.contractual_key,d.deliverable_key)=delta->>'item_key'and private.mission_scope_deliverable_active_v1(d.id);
   if delta->>'operation'in('REMOVE','REPLACE')then
    if old_item.id is null or old_d.id is null or(delta->>'operation'='REMOVE'and i.id is not null)then state:='SCOPE_RECONCILIATION_REQUIRED';reason:='OPERATIONAL_BASE_REQUIRED';
    else removals:=removals||jsonb_build_array(jsonb_build_object('key',old_item.item_key,'label_fr',old_item.label_fr,'label_ar',old_item.label_ar,'operation',delta->>'operation','previous_deliverable_id',old_d.id));end if;
   elsif old_d.id is not null then state:='SCOPE_RECONCILIATION_REQUIRED';reason:='ACTIVE_GENERATION_CONFLICT';end if;
   if delta->>'operation'in('ADD','REPLACE')then
    if i.id is null then state:='SCOPE_RECONCILIATION_REQUIRED';reason:='SIGNED_TARGET_REQUIRED';
    elsif not private.valid_signed_addition_criteria_v1(i.details)then state:='MISSING_SIGNED_CRITERIA';
    else items:=items||jsonb_build_array(jsonb_build_object('key',i.item_key,'label_fr',i.label_fr,'label_ar',i.label_ar,'criteria',i.details->'acceptance_criteria','operation',delta->>'operation'));end if;
   end if;
  end loop;
  if prior is not null then state:='PREVIOUS_AMENDMENT_REQUIRED';end if;
  if state='READY'and jsonb_array_length(items)=0 and jsonb_array_length(removals)=0 then state:='NO_ADDITIONAL_WORK';end if;
 end if;
 result:=jsonb_build_object('amendment_id',am.id,'mission_id',m.id,'contract_version_id',v.id,'contract_hash',v.content_hash,'mission_row_version',m.row_version,'amendment_hash',am.content_hash,'status',state,'blocking_reason',reason,'previous_amendment_id',prior,'deadline_delta_days',am.deadline_delta_days,'items',items,'removals',removals);
 return result||jsonb_build_object('preparation_hash',private.canonical_request_hash(result));
end$$;

create or replace function public.execute_signed_mission_amendment_v1(p_amendment_id uuid,p_expected_preparation_hash text,p_assignments jsonb,p_schedule_confirmed boolean,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare actor uuid:=auth.uid();am public.contract_amendments%rowtype;c public.contracts%rowtype;m public.missions%rowtype;prep jsonb;hash text;result jsonb;item jsonb;removal jsonb;assignment jsonb;criterion jsonb;date_value timestamptz;stage uuid;d_id uuid;replacement uuid;old_d public.deliverables%rowtype;s public.mission_milestones%rowtype;sort_position integer;generation integer;physical_key text;created integer:=0;retired integer:=0;pending boolean;w public.admin_work_items%rowtype;
begin
 select*into am from public.contract_amendments where id=p_amendment_id;select*into c from public.contracts where id=am.contract_id;
 if actor is null or c.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)then raise exception'AMENDMENT_EXECUTION_DENIED'using errcode='42501';end if;
 if coalesce(p_expected_preparation_hash,'')!~'^[0-9a-f]{64}$'or jsonb_typeof(p_assignments)is distinct from'array'or jsonb_array_length(p_assignments)>50 or p_schedule_confirmed is distinct from true or p_correlation_id is null then raise exception'INVALID_AMENDMENT_EXECUTION'using errcode='22023';end if;
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);
 select*into c from public.contracts where id=c.id for update;select*into m from public.missions where contract_id=c.id for update;
 hash:=private.canonical_request_hash(jsonb_build_object('amendment',am.id,'preparation_hash',p_expected_preparation_hash,'assignments',p_assignments,'schedule_confirmed',p_schedule_confirmed));
 result:=private.begin_contract_command(c.client_organization_id,'mission.amendment.execute.'||am.id::text,p_idempotency_key,hash,actor);if result is not null then return result;end if;
 prep:=private.mission_amendment_preparation_v1(am.id);
 if prep->>'preparation_hash'is distinct from p_expected_preparation_hash then raise exception'STALE_AMENDMENT_PREPARATION'using errcode='40001';end if;
 if prep->>'status'is distinct from'READY'then raise exception'AMENDMENT_EXECUTION_NOT_READY'using errcode='55000';end if;
 if jsonb_array_length(p_assignments)<>jsonb_array_length(prep->'items')or jsonb_array_length(p_assignments)<>(select count(distinct x->>'deliverable_key')from jsonb_array_elements(p_assignments)x)then raise exception'INVALID_AMENDMENT_ASSIGNMENT_SCOPE'using errcode='22023';end if;
 for assignment in select*from jsonb_array_elements(p_assignments)loop
  if jsonb_typeof(assignment)is distinct from'object'or assignment-array['deliverable_key','due_at']<>'{}'::jsonb or not exists(select 1 from jsonb_array_elements(prep->'items')x where x->>'key'=assignment->>'deliverable_key')then raise exception'INVALID_AMENDMENT_ASSIGNMENT_SCOPE'using errcode='22023';end if;
  begin date_value:=(assignment->>'due_at')::timestamptz;exception when others then raise exception'INVALID_AMENDMENT_ASSIGNMENT_DATE'using errcode='22023';end;
  if date_value is null or not isfinite(date_value)then raise exception'INVALID_AMENDMENT_ASSIGNMENT_DATE'using errcode='22023';end if;
 end loop;
 insert into private.mission_scope_execution_permits_v1 values(txid_current(),m.id,am.id,actor);
 update public.missions set contract_version_id=(prep->>'contract_version_id')::uuid where id=m.id;
 select coalesce(max(sort_order),0)into sort_position from public.mission_milestones where mission_id=m.id;
 for item in select*from jsonb_array_elements(prep->'items')loop
  select x into assignment from jsonb_array_elements(p_assignments)x where x->>'deliverable_key'=item->>'key';sort_position:=sort_position+1;
  select coalesce(max(scope_generation),0)+1 into generation from public.deliverables d where d.mission_id=m.id and coalesce(d.contractual_key,d.deliverable_key)=item->>'key';
  physical_key:=case when exists(select 1 from public.deliverables where mission_id=m.id and deliverable_key=item->>'key')then upper('SCOPE_'||replace(am.id::text,'-','')||'_'||substr(md5(item->>'key'),1,16))else item->>'key'end;
  insert into public.mission_milestones(mission_id,milestone_key,title_fr,title_ar,sort_order,due_at,owner_organization_id,validation_required)values(m.id,'AMD_'||am.amendment_number::text||'_'||upper(substr(md5(item->>'key'),1,16)),item->>'label_fr',item->>'label_ar',sort_position,(assignment->>'due_at')::timestamptz,c.provider_organization_id,true)returning id into stage;
  insert into public.deliverables(mission_id,milestone_id,deliverable_key,contractual_key,source_contract_version_id,scope_generation,label_fr,label_ar,proof_required)values(m.id,stage,physical_key,item->>'key',(prep->>'contract_version_id')::uuid,generation,item->>'label_fr',item->>'label_ar',true)returning id into d_id;
  for criterion in select*from jsonb_array_elements(item->'criteria')loop insert into public.acceptance_checklists(mission_id,deliverable_id,criterion_key,label_fr,label_ar)values(m.id,d_id,criterion->>'key',criterion->>'label_fr',criterion->>'label_ar');end loop;
  created:=created+1;
 end loop;
 for removal in select*from jsonb_array_elements(prep->'removals')loop
  select*into old_d from public.deliverables where id=(removal->>'previous_deliverable_id')::uuid and mission_id=m.id for update;
  select d.id into replacement from public.deliverables d where d.mission_id=m.id and d.source_contract_version_id=(prep->>'contract_version_id')::uuid and coalesce(d.contractual_key,d.deliverable_key)=removal->>'key'and d.id<>old_d.id and private.mission_scope_deliverable_active_v1(d.id);
  if removal->>'operation'='REMOVE'then replacement:=null;end if;
  insert into public.mission_obligation_retirements_v1(deliverable_id,mission_id,amendment_id,contract_version_id,operation,replacement_deliverable_id,previous_snapshot,retired_by)values(old_d.id,m.id,am.id,(prep->>'contract_version_id')::uuid,removal->>'operation',replacement,to_jsonb(old_d)||jsonb_build_object('milestone_snapshot',(select to_jsonb(ms)from public.mission_milestones ms where ms.id=old_d.milestone_id)),actor);
  retired:=retired+1;
 end loop;
 for s in select ms.*from public.mission_milestones ms where ms.mission_id=m.id and not exists(select 1 from public.mission_milestone_retirements_v1 r where r.milestone_id=ms.id)
 and exists(select 1 from public.deliverables d where d.milestone_id=ms.id and exists(select 1 from public.mission_obligation_retirements_v1 r where r.deliverable_id=d.id))
 and not exists(select 1 from public.deliverables d where d.milestone_id=ms.id and private.mission_scope_deliverable_active_v1(d.id))loop
  insert into public.mission_milestone_retirements_v1(milestone_id,mission_id,amendment_id,contract_version_id,previous_snapshot,retired_by)values(s.id,m.id,am.id,(prep->>'contract_version_id')::uuid,to_jsonb(s),actor);
 end loop;
 insert into public.mission_amendment_executions_v1(amendment_id,mission_id,contract_version_id,preparation_hash,assignments_snapshot,previous_mission_snapshot,executed_by)values(am.id,m.id,(prep->>'contract_version_id')::uuid,p_expected_preparation_hash,p_assignments,to_jsonb(m),actor);
 pending:=private.mission_scope_pending_v1(m.id);
 update public.missions set scope_reconciliation_required=pending,status=case when status='COMPLETED'and created>0 then'ACTIVE'else status end,completed_at=case when status='COMPLETED'and created>0 then null else completed_at end,row_version=row_version+1,updated_at=clock_timestamp()where id=m.id;
 if not pending and not exists(select 1 from public.deliverables d where d.mission_id=m.id and private.mission_scope_deliverable_active_v1(d.id)and d.status<>'ACCEPTED')then
  update public.missions set status='COMPLETED',completed_at=coalesce(completed_at,clock_timestamp()),row_version=row_version+1,updated_at=clock_timestamp()where id=m.id and status<>'COMPLETED';
 end if;
 for w in select w0.*from public.admin_work_items w0 join public.mission_scope_reconciliation_exceptions_v1 e on e.admin_work_item_id=w0.id where e.amendment_id=am.id and w0.status not in('RESOLVED','DISMISSED')loop
  update public.admin_work_items set status='RESOLVED',resolution_code='SIGNED_SCOPE_APPLIED',resolution_reason='Signed scope executed through versioned Client preparation.',resolution_evidence=jsonb_build_object('amendment_id',am.id,'mission_id',m.id,'contract_version_id',prep->>'contract_version_id','created_deliverables',created,'retired_deliverables',retired),updated_at=clock_timestamp(),row_version=row_version+1 where id=w.id;
  insert into public.admin_work_item_events(work_item_id,event_type,from_status,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(w.id,'SIGNED_SCOPE_EXECUTED',w.status,'RESOLVED',actor,'Signed scope executed through versioned Client preparation.',jsonb_build_object('amendment_id',am.id,'mission_id',m.id),p_correlation_id);
 end loop;
 result:=jsonb_build_object('outcome','MISSION_AMENDMENT_EXECUTED','amendment_id',am.id,'mission_id',m.id,'contract_version_id',prep->>'contract_version_id','created_deliverables',created,'retired_deliverables',retired,'scope_reconciliation_required',pending);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.client_organization_id,actor,'USER','mission.amendment.executed','mission',m.id::text,p_correlation_id,result||jsonb_build_object('preparation_hash',p_expected_preparation_hash,'assignments',p_assignments),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(c.client_organization_id,'mission',m.id::text,'MissionAmendmentExecutedV1',p_correlation_id,result,p_idempotency_key);
 perform private.finish_contract_command(c.client_organization_id,'mission.amendment.execute.'||am.id::text,p_idempotency_key,result);
 delete from private.mission_scope_execution_permits_v1 where transaction_id=txid_current()and mission_id=m.id;return result;
end$$;

create or replace function private.prevent_unreconciled_scope_closure_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare m uuid;allowed boolean;
begin
 if tg_table_name='missions'then m:=new.id;else select e.mission_id into m from public.mission_scope_reconciliation_exceptions_v1 e where e.admin_work_item_id=new.id;end if;
 allowed:=exists(select 1 from private.mission_scope_execution_permits_v1 p join public.mission_amendment_executions_v1 e on e.amendment_id=p.amendment_id and e.mission_id=p.mission_id where p.transaction_id=txid_current()and p.mission_id=m and p.actor_user_id=auth.uid()and e.executed_by=p.actor_user_id);
 if tg_table_name='missions'then
  if old.scope_reconciliation_required and not new.scope_reconciliation_required and(not allowed or private.mission_scope_pending_v1(m))then raise exception'MISSION_SIGNED_SCOPE_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 elsif new.status in('RESOLVED','DISMISSED')and exists(select 1 from public.mission_scope_reconciliation_exceptions_v1 e where e.admin_work_item_id=new.id)
 and not(allowed and exists(select 1 from public.mission_amendment_executions_v1 e join public.mission_scope_reconciliation_exceptions_v1 x on x.amendment_id=e.amendment_id where x.admin_work_item_id=new.id))then
  raise exception'MISSION_SIGNED_SCOPE_RECONCILIATION_REQUIRED'using errcode='55000';
 end if;return new;
end$$;
-- Retired obligations stay available as evidence, but may no longer be delivered
-- or decided as if they were the effective current contractual generation.
create or replace function private.require_scope_reconciliation_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare mid uuid;did uuid;sid uuid;
begin
 if tg_table_name='delivery_versions'then did:=new.deliverable_id;select d.mission_id into mid from public.deliverables d where d.id=did;
 elsif tg_table_name='deliverables'then mid:=new.mission_id;did:=new.id;
 elsif tg_table_name='acceptance_checklists'then mid:=new.mission_id;did:=new.deliverable_id;
 elsif tg_table_name='mission_milestones'then mid:=new.mission_id;sid:=new.id;
 else mid:=new.mission_id;sid:=new.milestone_id;end if;
 if exists(select 1 from public.missions where id=mid and scope_reconciliation_required)then raise exception'MISSION_SIGNED_SCOPE_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 if(did is not null and exists(select 1 from public.mission_obligation_retirements_v1 where deliverable_id=did))or(sid is not null and exists(select 1 from public.mission_milestone_retirements_v1 where milestone_id=sid))then raise exception'MISSION_OBLIGATION_RETIRED_BY_SIGNED_AMENDMENT'using errcode='55000';end if;
 return new;
end$$;
create function private.validate_scope_retirement_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if not exists(select 1 from private.mission_scope_execution_permits_v1 p join public.contract_amendments a on a.id=p.amendment_id
 where p.transaction_id=txid_current()and p.mission_id=new.mission_id and p.amendment_id=new.amendment_id and p.actor_user_id=auth.uid()and a.status='ACTIVE'and a.activated_contract_version_id=new.contract_version_id)then raise exception'SCOPE_EXECUTION_PERMIT_REQUIRED'using errcode='42501';end if;
 if tg_table_name='mission_obligation_retirements_v1'then
  if not exists(select 1 from public.deliverables d where d.id=new.deliverable_id and d.mission_id=new.mission_id)then raise exception'SCOPE_RETIREMENT_MISSION_MISMATCH'using errcode='23514';end if;
  if new.replacement_deliverable_id is not null and not exists(select 1 from public.deliverables old_d join public.deliverables replacement on replacement.id=new.replacement_deliverable_id where old_d.id=new.deliverable_id and replacement.mission_id=new.mission_id and replacement.source_contract_version_id=new.contract_version_id and replacement.contractual_key=coalesce(old_d.contractual_key,old_d.deliverable_key)and replacement.scope_generation>old_d.scope_generation)then raise exception'SCOPE_REPLACEMENT_GENERATION_MISMATCH'using errcode='23514';end if;
 else
  if not exists(select 1 from public.mission_milestones m where m.id=new.milestone_id and m.mission_id=new.mission_id)then raise exception'SCOPE_RETIREMENT_MISSION_MISMATCH'using errcode='23514';end if;
 end if;
 return new;
end$$;
create trigger scope_retirement_authority_v1 before insert on public.mission_obligation_retirements_v1 for each row execute function private.validate_scope_retirement_v1();
create trigger scope_milestone_retirement_authority_v1 before insert on public.mission_milestone_retirements_v1 for each row execute function private.validate_scope_retirement_v1();
create or replace function private.bind_signed_acceptance_criterion_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare details jsonb;criterion jsonb;
begin
 select i.details into details from public.deliverables d join public.missions m on m.id=d.mission_id
 join public.contract_items i on i.contract_version_id=coalesce(d.source_contract_version_id,m.contract_version_id)and i.item_type='DELIVERABLE'and i.item_key=coalesce(d.contractual_key,d.deliverable_key)where d.id=new.deliverable_id and m.id=new.mission_id;
 if details?'acceptance_criteria'then
  if not private.valid_signed_addition_criteria_v1(details)then raise exception'INVALID_SIGNED_ACCEPTANCE_CRITERIA'using errcode='55000';end if;
  select x into criterion from jsonb_array_elements(details->'acceptance_criteria')x where x->>'key'=new.criterion_key;
  if criterion is null then raise exception'MISSION_SIGNED_CRITERIA_REQUIRED'using errcode='22023';end if;
  new.label_fr:=criterion->>'label_fr';new.label_ar:=criterion->>'label_ar';
 end if;return new;
end$$;
-- Receipt replay is still checked first by the original command. Only the new
-- completion decision ignores explicitly retired generations.
do $patch$declare src text;needle text:='not exists(select 1 from public.deliverables where mission_id=m.id and status<>''ACCEPTED'')';begin
 src:=pg_get_functiondef('public.accept_delivery(uuid,jsonb,text,uuid)'::regprocedure);
 if position(needle in src)=0 then raise exception'SCOPE_RECEIPT_COMPLETION_SOURCE_DRIFT';end if;
 execute replace(src,needle,'not exists(select 1 from public.deliverables where mission_id=m.id and status<>''ACCEPTED''and private.mission_scope_deliverable_active_v1(id))');
end$patch$;
create or replace function private.require_prepared_amendment_work_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if new.status='COMPLETED'and old.status<>'COMPLETED'then
  if new.scope_reconciliation_required then raise exception'MISSION_SIGNED_SCOPE_RECONCILIATION_REQUIRED'using errcode='55000';end if;
  if private.mission_scope_pending_v1(new.id)then raise exception'MISSION_AMENDMENT_EXECUTION_REQUIRED'using errcode='55000';end if;
  if exists(select 1 from public.contract_items i where i.contract_version_id=new.contract_version_id and i.item_type='DELIVERABLE'
   and not exists(select 1 from public.deliverables d where d.mission_id=new.id and coalesce(d.contractual_key,d.deliverable_key)=i.item_key and private.mission_scope_deliverable_active_v1(d.id)))then raise exception'MISSION_AMENDMENT_EXECUTION_REQUIRED'using errcode='55000';end if;
  if exists(select 1 from public.deliverables d where d.mission_id=new.id and private.mission_scope_deliverable_active_v1(d.id)and d.status<>'ACCEPTED')then raise exception'MISSION_ACCEPTANCE_REQUIRED'using errcode='55000';end if;
 end if;return new;
end$$;

do $patch$declare src text;needle text:='if m.status<>''COMPLETED''';begin
 src:=pg_get_functiondef('public.submit_mission_provider_feedback(uuid,integer,integer,integer,jsonb,text,uuid)'::regprocedure);
 if position(needle in src)=0 then raise exception'SCOPE_FEEDBACK_SOURCE_DRIFT';end if;
 src:=replace(src,needle,'if not exists(select 1 from public.deliverables d where d.mission_id=m.id and private.mission_scope_deliverable_active_v1(d.id))then raise exception''MISSION_WITHDRAWN_SCOPE_NOT_RATEABLE''using errcode=''55000'';end if;'||needle);
 if position('where d.mission_id=m.id and d.status=''ACCEPTED'' and ac.status in'in src)=0 or position('where ci.mission_id=m.id;'in src)=0 then raise exception'SCOPE_FEEDBACK_FACTS_SOURCE_DRIFT';end if;
 src:=replace(src,'where d.mission_id=m.id and d.status=''ACCEPTED'' and ac.status in','where d.mission_id=m.id and private.mission_scope_deliverable_active_v1(d.id)and ac.delivery_version=d.current_version and d.status=''ACCEPTED'' and ac.status in');
 src:=replace(src,'where ci.mission_id=m.id;','where ci.mission_id=m.id and not exists(select 1 from public.mission_milestone_retirements_v1 r where r.milestone_id=ci.milestone_id);');execute src;
end$patch$;

-- A signed total withdrawal before the initial mission is an actual absence of
-- operational work, not a missing-data incident or an invented empty mission.
alter function public.get_client_mission_preparation_v1(uuid,uuid)rename to get_client_mission_preparation_legacy_41950;
alter function public.get_client_mission_preparation_legacy_41950(uuid,uuid)set schema private;
revoke all on function private.get_client_mission_preparation_legacy_41950(uuid,uuid)from public,anon,authenticated,service_role;
create function public.get_client_mission_preparation_v1(p_contract_id uuid,p_contract_version_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare c public.contracts%rowtype;v public.contract_versions%rowtype;
begin
 select*into c from public.contracts where id=p_contract_id;
 if auth.uid()is null or c.id is null or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'MISSION_CREATE_DENIED'using errcode='42501';end if;
 select*into v from public.contract_versions where id=p_contract_version_id and contract_id=c.id and version=c.current_version;
 if v.id is not null and private.mission_scope_signature_effective_v1(c.id,v.id)and not exists(select 1 from public.contract_items where contract_version_id=v.id and item_type='DELIVERABLE')then
  return jsonb_build_object('contract_id',c.id,'contract_version_id',v.id,'no_mission_required',true);
 end if;
 return private.get_client_mission_preparation_legacy_41950(p_contract_id,p_contract_version_id);
end$$;
revoke all on function public.get_client_mission_preparation_v1(uuid,uuid)from public,anon,service_role;
grant execute on function public.get_client_mission_preparation_v1(uuid,uuid)to authenticated;
do $patch$declare src text;needle text:='plan:=public.get_client_mission_preparation_v1(p_contract_id,p_contract_version_id);';begin
 src:=pg_get_functiondef('public.create_client_prepared_mission_v1(uuid,uuid,text,jsonb,text,uuid)'::regprocedure);
 if position(needle in src)=0 then raise exception'EMPTY_SIGNED_SCOPE_PREPARATION_SOURCE_DRIFT';end if;
 execute replace(src,needle,needle||'if plan->>''no_mission_required''=''true''then raise exception''NO_OPERATIONAL_MISSION_REQUIRED''using errcode=''55000'';end if;');
end$patch$;

-- Read-side metrics retain histories but no longer count withdrawn obligations.
do $patch$declare src text;begin
 src:=pg_get_functiondef('public.get_provider_mission_counts_v1(uuid)'::regprocedure);
 if position('and d.status in(''PENDING'',''REJECTED'')'in src)=0 or position('and s.status in('in src)=0 then raise exception'SCOPE_COUNTS_SOURCE_DRIFT';end if;
 src:=replace(src,'and d.status in(''PENDING'',''REJECTED'')','and not exists(select 1 from public.mission_obligation_retirements_v1 r where r.deliverable_id=d.id)and d.status in(''PENDING'',''REJECTED'')');
 src:=replace(src,'and s.status in(','and not exists(select 1 from public.mission_milestone_retirements_v1 r where r.milestone_id=s.id)and s.status in(');execute src;
end$patch$;
-- The native calendar is SECURITY DEFINER: apply mission read scope inside
-- the query as well as RLS, including assigned Technician versus unassigned.
do $patch$declare src text;needle text:='where mission_access and m.provider_organization_id=p_provider_organization_id';read_roles text:='mission_access:=private.has_org_role(p_provider_organization_id,array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN''],auth.uid());';begin
 src:=pg_get_functiondef('public.get_my_provider_planning_v1(uuid,timestamptz,timestamptz,date,date,integer,integer)'::regprocedure);
 if position(needle in src)=0 or position(read_roles in src)=0 or position('return r;'in src)=0 then raise exception'SCOPE_NATIVE_PLANNING_SOURCE_DRIFT';end if;
 src:=replace(src,read_roles,'mission_access:=private.has_org_role(p_provider_organization_id,array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN'',''PROVIDER_VIEWER'',''PROVIDER_SALES'',''PROVIDER_ACCOUNTING''],auth.uid());');
 src:=replace(src,needle,needle||' and private.provider_mission_access_v1(m.id,auth.uid())and not m.scope_reconciliation_required and not exists(select 1 from public.mission_milestone_retirements_v1 retired where retired.milestone_id=ms.id)');
 src:=replace(src,'return r;','return r||jsonb_build_object(''operational_scope_incomplete'',mission_access and exists(select 1 from public.missions m where m.provider_organization_id=p_provider_organization_id and m.status<>''CANCELLED''and(m.scope_reconciliation_required or private.mission_scope_pending_v1(m.id))and private.provider_mission_access_v1(m.id,auth.uid())));');execute src;
end$patch$;
-- Previously signed legacy untyped withdrawals get the same real queue and hold.
do $$declare a uuid;begin for a in select id from public.contract_amendments where status='ACTIVE'order by activated_at,id loop perform private.record_signed_scope_exception_v1(a);end loop;end$$;
revoke all on function private.mission_scope_delta_deliverable_v1(uuid,jsonb)from public,anon,authenticated,service_role;
revoke all on function private.record_mission_initial_scope_v1(),private.bind_scope_generation_v1(),private.mission_scope_initial_covers_v1(uuid,uuid),private.mission_scope_deliverable_active_v1(uuid),private.mission_scope_pending_v1(uuid,uuid),private.mission_scope_signature_effective_v1(uuid,uuid),private.mission_scope_target_in_chain_v1(uuid,uuid),private.validate_scope_retirement_v1()from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
