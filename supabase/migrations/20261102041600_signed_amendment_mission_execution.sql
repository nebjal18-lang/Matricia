begin;
-- An amendment's additional work is not executed by a signature status alone.
-- Criteria are proposed explicitly, frozen in its signed items, then the Client
-- prepares the operational dates against the exact effective contract version.
alter table public.acceptance_checklists add column label_fr text check(label_fr is null or length(btrim(label_fr))between 1 and 500),add column label_ar text check(label_ar is null or length(btrim(label_ar))between 1 and 500);
create or replace function private.initialize_delivery_receipt_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.version=1 then update public.acceptance_checklists set delivery_version=1 where deliverable_id=new.deliverable_id and delivery_version=0 and status='PENDING';
 else insert into public.acceptance_checklists(mission_id,deliverable_id,delivery_version,criterion_key,label_fr,label_ar)
 select a.mission_id,a.deliverable_id,new.version,a.criterion_key,a.label_fr,a.label_ar from public.acceptance_checklists a where a.deliverable_id=new.deliverable_id and a.delivery_version=(select max(b.delivery_version)from public.acceptance_checklists b where b.deliverable_id=new.deliverable_id and b.delivery_version<new.version);end if;return new;
end$$;
create function private.valid_signed_addition_criteria_v1(p_details jsonb)returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare c jsonb;
begin
 if jsonb_typeof(p_details)is distinct from'object'or p_details-'acceptance_criteria'<>'{}'::jsonb or jsonb_typeof(p_details->'acceptance_criteria')is distinct from'array'or jsonb_array_length(p_details->'acceptance_criteria')not between 1 and 30 then return false;end if;
 for c in select*from jsonb_array_elements(p_details->'acceptance_criteria')loop
  if jsonb_typeof(c)is distinct from'object'or c-array['key','label_fr','label_ar']<>'{}'::jsonb or coalesce(c->>'key','')!~'^[A-Z][A-Z0-9_-]{1,79}$'or length(btrim(coalesce(c->>'label_fr','')))not between 3 and 500 or length(btrim(coalesce(c->>'label_ar','')))not between 3 and 500 then return false;end if;
 end loop;
 return jsonb_array_length(p_details->'acceptance_criteria')=(select count(distinct value->>'key')from jsonb_array_elements(p_details->'acceptance_criteria'));
end$$;
revoke all on function private.valid_signed_addition_criteria_v1(jsonb)from public,anon,authenticated,service_role;
do $patch$declare src text;needle text;begin
 src:=pg_get_functiondef('public.propose_provider_contract_amendment_v1(uuid,uuid,text,text,jsonb,bigint,integer,jsonb,text,uuid)'::regprocedure);
 needle:='coalesce(item->''details'',''{}'')<>''{}''::jsonb';
 if position(needle in src)=0 then raise exception'SIGNED_ADDITION_CRITERIA_SOURCE_DRIFT';end if;
 execute replace(src,needle,'not private.valid_signed_addition_criteria_v1(item->''details'')');
end$patch$;

create table public.mission_amendment_executions_v1(
 amendment_id uuid primary key references public.contract_amendments(id)on delete restrict,
 mission_id uuid not null references public.missions(id)on delete restrict,
 contract_version_id uuid not null references public.contract_versions(id)on delete restrict,
 preparation_hash text not null check(preparation_hash~'^[0-9a-f]{64}$'),
 assignments_snapshot jsonb not null check(jsonb_typeof(assignments_snapshot)='array'),
 previous_mission_snapshot jsonb not null,executed_by uuid not null references auth.users(id),executed_at timestamptz not null default clock_timestamp()
);
alter table public.mission_amendment_executions_v1 enable row level security;
create policy mission_amendment_execution_read on public.mission_amendment_executions_v1 for select to authenticated using(private.mission_party_access(mission_id));
create trigger mission_amendment_execution_immutable before update or delete on public.mission_amendment_executions_v1 for each row execute function private.prevent_contract_immutable_change();
revoke all on public.mission_amendment_executions_v1 from public,anon,authenticated,service_role;grant select on public.mission_amendment_executions_v1 to authenticated;

create function private.mission_amendment_preparation_v1(p_amendment_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare am public.contract_amendments%rowtype;c public.contracts%rowtype;m public.missions%rowtype;v public.contract_versions%rowtype;items jsonb;state text;result jsonb;
begin
 select*into am from public.contract_amendments where id=p_amendment_id;
 select*into c from public.contracts where id=am.contract_id;
 select*into m from public.missions where contract_id=c.id;
 if c.id is null or m.id is null then return jsonb_build_object('status','NO_MISSION','items','[]'::jsonb);end if;
 select*into v from public.contract_versions where contract_id=c.id and version=c.current_version;
 select coalesce(jsonb_agg(jsonb_build_object('key',i.item_key,'label_fr',i.label_fr,'label_ar',i.label_ar,'criteria',i.details->'acceptance_criteria')order by i.sort_order,i.id),'[]')into items
 from public.contract_items i where i.contract_version_id=v.id and i.item_type='DELIVERABLE'
 and exists(select 1 from jsonb_array_elements(am.deliverables_delta)d where d->>'item_type'='DELIVERABLE'and d->>'operation'='ADD'and d->>'item_key'=i.item_key)
 and not exists(select 1 from public.deliverables d where d.mission_id=m.id and d.deliverable_key=i.item_key);
 state:=case
 when exists(select 1 from public.mission_amendment_executions_v1 e where e.amendment_id=am.id)then'APPLIED'
 when am.status<>'ACTIVE'or am.activated_contract_version_id is null then'AWAITING_SIGNATURE'
 when m.status='CANCELLED'then'MISSION_CANCELLED'
 when not private.contract_version_signature_effective_v1(c.id,v.id)then'SIGNATURE_NOT_EFFECTIVE'
 when jsonb_array_length(items)=0 then'NO_ADDITIONAL_WORK'
 when exists(select 1 from public.contract_items i where i.contract_version_id=v.id and exists(select 1 from jsonb_array_elements(items)x where x->>'key'=i.item_key)and not private.valid_signed_addition_criteria_v1(i.details))then'MISSING_SIGNED_CRITERIA'
 else'READY'end;
 result:=jsonb_build_object('amendment_id',am.id,'mission_id',m.id,'contract_version_id',v.id,'contract_hash',v.content_hash,'mission_row_version',m.row_version,'amendment_hash',am.content_hash,'status',state,'deadline_delta_days',am.deadline_delta_days,'items',items);
 return result||jsonb_build_object('preparation_hash',private.canonical_request_hash(result));
end$$;
revoke all on function private.mission_amendment_preparation_v1(uuid)from public,anon,authenticated,service_role;
create function public.get_mission_amendment_preparation_v1(p_amendment_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare c public.contracts%rowtype;result jsonb;
begin
 select c0.*into c from public.contract_amendments a join public.contracts c0 on c0.id=a.contract_id where a.id=p_amendment_id;
 if auth.uid()is null or c.id is null or not private.contract_party_access(c.id,auth.uid())then raise exception'AMENDMENT_EXECUTION_READ_DENIED'using errcode='42501';end if;
 result:=private.mission_amendment_preparation_v1(p_amendment_id);
 return result||jsonb_build_object('can_apply',private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid()));
end$$;
create function public.execute_signed_mission_amendment_v1(p_amendment_id uuid,p_expected_preparation_hash text,p_assignments jsonb,p_schedule_confirmed boolean,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();am public.contract_amendments%rowtype;c public.contracts%rowtype;m public.missions%rowtype;prep jsonb;request_hash text;r jsonb;item jsonb;criterion jsonb;assignment jsonb;milestone_id uuid;deliverable_id uuid;sort_position integer;date_value timestamptz;
begin
 select*into am from public.contract_amendments where id=p_amendment_id;select*into c from public.contracts where id=am.contract_id;
 if a is null or c.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)then raise exception'AMENDMENT_EXECUTION_DENIED'using errcode='42501';end if;
 if coalesce(p_expected_preparation_hash,'')!~'^[0-9a-f]{64}$'or jsonb_typeof(p_assignments)is distinct from'array'or jsonb_array_length(p_assignments)>50 or p_schedule_confirmed is distinct from true then raise exception'INVALID_AMENDMENT_EXECUTION'using errcode='22023';end if;
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);
 select*into c from public.contracts where id=c.id for update;
 select*into m from public.missions where contract_id=c.id for update;
 request_hash:=private.canonical_request_hash(jsonb_build_object('amendment',am.id,'preparation_hash',p_expected_preparation_hash,'assignments',p_assignments,'schedule_confirmed',p_schedule_confirmed));
 r:=private.begin_contract_command(c.client_organization_id,'mission.amendment.execute.'||am.id::text,p_idempotency_key,request_hash,a);if r is not null then return r;end if;
 prep:=private.mission_amendment_preparation_v1(am.id);
 if prep->>'preparation_hash'is distinct from p_expected_preparation_hash then raise exception'STALE_AMENDMENT_PREPARATION'using errcode='40001';end if;
 if prep->>'status'is distinct from'READY'then raise exception'AMENDMENT_EXECUTION_NOT_READY'using errcode='55000';end if;
 if jsonb_array_length(p_assignments)<>jsonb_array_length(prep->'items')or jsonb_array_length(p_assignments)<>(select count(distinct x->>'deliverable_key')from jsonb_array_elements(p_assignments)x)then raise exception'INVALID_AMENDMENT_ASSIGNMENT_SCOPE'using errcode='22023';end if;
 for assignment in select*from jsonb_array_elements(p_assignments)loop
  if jsonb_typeof(assignment)is distinct from'object'or assignment-array['deliverable_key','due_at']<>'{}'::jsonb or not exists(select 1 from jsonb_array_elements(prep->'items')x where x->>'key'=assignment->>'deliverable_key')or length(coalesce(assignment->>'due_at',''))not between 10 and 50 then raise exception'INVALID_AMENDMENT_ASSIGNMENT_SCOPE'using errcode='22023';end if;
  begin date_value:=(assignment->>'due_at')::timestamptz;exception when others then raise exception'INVALID_AMENDMENT_ASSIGNMENT_DATE'using errcode='22023';end;
  if date_value is null or not isfinite(date_value)then raise exception'INVALID_AMENDMENT_ASSIGNMENT_DATE'using errcode='22023';end if;
 end loop;
 update public.missions set contract_version_id=(prep->>'contract_version_id')::uuid where id=m.id;
 select coalesce(max(sort_order),0)into sort_position from public.mission_milestones where mission_id=m.id;
 for item in select*from jsonb_array_elements(prep->'items')loop
  select x into assignment from jsonb_array_elements(p_assignments)x where x->>'deliverable_key'=item->>'key';sort_position:=sort_position+1;
  insert into public.mission_milestones(mission_id,milestone_key,title_fr,title_ar,sort_order,due_at,owner_organization_id,validation_required)
  values(m.id,'AMD_'||am.amendment_number::text||'_'||upper(substr(md5(item->>'key'),1,16)),item->>'label_fr',item->>'label_ar',sort_position,(assignment->>'due_at')::timestamptz,c.provider_organization_id,true)returning id into milestone_id;
  insert into public.deliverables(mission_id,milestone_id,deliverable_key,label_fr,label_ar,proof_required)values(m.id,milestone_id,item->>'key',item->>'label_fr',item->>'label_ar',true)returning id into deliverable_id;
  for criterion in select*from jsonb_array_elements(item->'criteria')loop
   insert into public.acceptance_checklists(mission_id,deliverable_id,criterion_key,label_fr,label_ar)values(m.id,deliverable_id,criterion->>'key',criterion->>'label_fr',criterion->>'label_ar');
  end loop;
 end loop;
 insert into public.mission_amendment_executions_v1(amendment_id,mission_id,contract_version_id,preparation_hash,assignments_snapshot,previous_mission_snapshot,executed_by)values(am.id,m.id,(prep->>'contract_version_id')::uuid,p_expected_preparation_hash,p_assignments,to_jsonb(m),a);
 update public.missions set status=case when status='COMPLETED'then'ACTIVE'else status end,completed_at=case when status='COMPLETED'then null else completed_at end,row_version=row_version+1,updated_at=clock_timestamp()where id=m.id;
 r:=jsonb_build_object('outcome','MISSION_AMENDMENT_EXECUTED','amendment_id',am.id,'mission_id',m.id,'contract_version_id',prep->>'contract_version_id','created_deliverables',jsonb_array_length(prep->'items'));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.client_organization_id,a,'USER','mission.amendment.executed','mission',m.id::text,p_correlation_id,r||jsonb_build_object('preparation_hash',p_expected_preparation_hash,'assignments',p_assignments),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(c.client_organization_id,'mission',m.id::text,'MissionAmendmentExecutedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(c.client_organization_id,'mission.amendment.execute.'||am.id::text,p_idempotency_key,r);return r;
end$$;
revoke all on function public.get_mission_amendment_preparation_v1(uuid),public.execute_signed_mission_amendment_v1(uuid,text,jsonb,boolean,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_mission_amendment_preparation_v1(uuid),public.execute_signed_mission_amendment_v1(uuid,text,jsonb,boolean,text,uuid)to authenticated;
create function private.require_prepared_amendment_work_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.status='COMPLETED'and old.status<>'COMPLETED'and exists(select 1 from public.contract_amendments a join public.contract_items i on i.contract_version_id=new.contract_version_id
 where a.contract_id=new.contract_id and a.status='ACTIVE'and i.item_type='DELIVERABLE'
 and exists(select 1 from jsonb_array_elements(a.deliverables_delta)x where x->>'operation'='ADD'and x->>'item_type'='DELIVERABLE'and x->>'item_key'=i.item_key)
 and not exists(select 1 from public.deliverables d where d.mission_id=new.id and d.deliverable_key=i.item_key))then raise exception'MISSION_AMENDMENT_EXECUTION_REQUIRED'using errcode='55000';end if;
 return new;
end$$;
create trigger mission_signed_additions_required_v1 before update of status on public.missions for each row execute function private.require_prepared_amendment_work_v1();
revoke all on function private.require_prepared_amendment_work_v1()from public,anon,authenticated,service_role;

-- The same signed additions may precede the initial mission. Preserve the
-- published operational checklist while binding these receipts to the criteria
-- already accepted in the exact signed contractual item.
do $patch$declare src text;needle text;begin
 src:=pg_get_functiondef('public.get_client_mission_preparation_v1(uuid,uuid)'::regprocedure);
 needle:='''source_description'',case';
 if position(needle in src)=0 then raise exception'INITIAL_SIGNED_CRITERIA_READ_SOURCE_DRIFT';end if;
 execute replace(src,needle,'''required_criteria'',case when private.valid_signed_addition_criteria_v1(i.details)then i.details->''acceptance_criteria''else null end,'||needle);
 src:=pg_get_functiondef('public.create_client_prepared_mission_v1(uuid,uuid,text,jsonb,text,uuid)'::regprocedure);
 needle:='for k in select*from jsonb_array_elements_text(x->''criterion_keys'')loop';
 if position(needle in src)=0 then raise exception'INITIAL_SIGNED_CRITERIA_WRITE_SOURCE_DRIFT';end if;
 src:=replace(src,needle,'if jsonb_typeof(d->''required_criteria'')=''array''and jsonb_array_length(x->''criterion_keys'')<>jsonb_array_length(d->''required_criteria'')then raise exception''MISSION_SIGNED_CRITERIA_REQUIRED''using errcode=''22023'';end if;'||needle);
 needle:='if not exists(select 1 from jsonb_array_elements(plan->''criteria'')y where y->>''key''=k)then';
 if position(needle in src)=0 then raise exception'INITIAL_SIGNED_CRITERIA_SELECTION_SOURCE_DRIFT';end if;
 src:=replace(src,needle,'if not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(d->''required_criteria'')=''array''then d->''required_criteria''else plan->''criteria''end)y where y->>''key''=k)then');
 execute src;
end$patch$;
create function private.bind_signed_acceptance_criterion_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare details jsonb;criterion jsonb;
begin
 select i.details into details from public.deliverables d join public.missions m on m.id=d.mission_id join public.contract_items i on i.contract_version_id=m.contract_version_id and i.item_type='DELIVERABLE'and i.item_key=d.deliverable_key where d.id=new.deliverable_id and m.id=new.mission_id;
 if details?'acceptance_criteria'then
  if not private.valid_signed_addition_criteria_v1(details)then raise exception'INVALID_SIGNED_ACCEPTANCE_CRITERIA'using errcode='55000';end if;
  select x into criterion from jsonb_array_elements(details->'acceptance_criteria')x where x->>'key'=new.criterion_key;
  if criterion is null then raise exception'MISSION_SIGNED_CRITERIA_REQUIRED'using errcode='22023';end if;
  new.label_fr:=criterion->>'label_fr';new.label_ar:=criterion->>'label_ar';
 end if;return new;
end$$;
create trigger signed_acceptance_criterion_binding_v1 before insert on public.acceptance_checklists for each row execute function private.bind_signed_acceptance_criterion_v1();
revoke all on function private.bind_signed_acceptance_criterion_v1()from public,anon,authenticated,service_role;

create function public.list_mission_amendment_preparations_v1(p_amendment_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare item uuid;result jsonb:='[]';value jsonb;
begin
 if p_amendment_ids is null or cardinality(p_amendment_ids)>100 or cardinality(p_amendment_ids)<>(select count(distinct x)from unnest(p_amendment_ids)x)then raise exception'INVALID_AMENDMENT_PREPARATION_LIST'using errcode='22023';end if;
 foreach item in array p_amendment_ids loop
  value:=public.get_mission_amendment_preparation_v1(item);result:=result||jsonb_build_array(value||jsonb_build_object('amendment_id',item));
 end loop;return result;
end$$;
revoke all on function public.list_mission_amendment_preparations_v1(uuid[])from public,anon,authenticated,service_role;
grant execute on function public.list_mission_amendment_preparations_v1(uuid[])to authenticated;

commit;
