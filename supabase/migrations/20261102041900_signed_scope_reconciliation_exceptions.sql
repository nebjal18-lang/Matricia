begin;
-- Legacy REMOVE/REPLACE amendments have a signed legal effect, but the previous
-- ADD-only executor cannot safely retire/re-generate their operational receipts.
-- Quarantine this operational boundary explicitly; retain every historical row.
alter table public.missions add column scope_reconciliation_required boolean not null default false;
create table public.mission_scope_reconciliation_exceptions_v1(
 amendment_id uuid primary key references public.contract_amendments(id)on delete restrict,
 mission_id uuid not null references public.missions(id)on delete restrict,
 base_contract_version_id uuid not null references public.contract_versions(id)on delete restrict,
 signed_contract_version_id uuid not null references public.contract_versions(id)on delete restrict,
 signed_delta jsonb not null check(jsonb_typeof(signed_delta)='array'),
 previous_operational_snapshot jsonb not null check(jsonb_typeof(previous_operational_snapshot)='object'),
 admin_work_item_id uuid not null references public.admin_work_items(id)on delete restrict,
 detected_at timestamptz not null default clock_timestamp()
);
alter table public.mission_scope_reconciliation_exceptions_v1 enable row level security;
create policy mission_scope_exception_read on public.mission_scope_reconciliation_exceptions_v1 for select to authenticated using(private.mission_party_access(mission_id)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','SUPPORT_AGENT'],auth.uid()));
create trigger mission_scope_exception_immutable before update or delete on public.mission_scope_reconciliation_exceptions_v1 for each row execute function private.prevent_contract_immutable_change();
revoke all on public.mission_scope_reconciliation_exceptions_v1 from public,anon,authenticated,service_role;
grant select on public.mission_scope_reconciliation_exceptions_v1 to authenticated;

create function private.record_signed_scope_exception_v1(p_amendment_id uuid)returns void language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare am public.contract_amendments%rowtype;m public.missions%rowtype;q public.admin_queue_versions%rowtype;work_id uuid;context jsonb;snapshot jsonb;correlation uuid:=extensions.gen_random_uuid();
begin
 select*into am from public.contract_amendments where id=p_amendment_id;
 if am.status<>'ACTIVE'or am.activated_contract_version_id is null or not exists(select 1 from jsonb_array_elements(am.deliverables_delta)x where x->>'item_type'='DELIVERABLE'and x->>'operation'in('REMOVE','REPLACE'))then return;end if;
 select*into m from public.missions where contract_id=am.contract_id for update;
 -- Initial missions prepared after this signature already use the new scope.
 if m.id is null or m.created_at>am.activated_at or exists(select 1 from public.audit_events a where a.resource_type='mission'and a.resource_id=m.id::text and a.action='mission.created'and a.metadata->>'contract_version_id'=am.activated_contract_version_id::text)or exists(select 1 from public.mission_scope_reconciliation_exceptions_v1 where amendment_id=am.id)then return;end if;
 select*into q from public.admin_queue_versions where queue_key='EXCEPTIONS'and status='ACTIVE';
 if q.id is null then raise exception'SCOPE_EXCEPTION_QUEUE_UNAVAILABLE'using errcode='55000';end if;
 context:=jsonb_build_object('amendment_id',am.id,'mission_id',m.id,'base_contract_version_id',am.base_contract_version_id,'signed_contract_version_id',am.activated_contract_version_id,'reason_code','SIGNED_SCOPE_RECONCILIATION_REQUIRED','resolution_requirement','VERSIONED_OPERATIONAL_GENERATIONS_REQUIRED');
 snapshot:=jsonb_build_object('mission',to_jsonb(m),'deliverables',coalesce((select jsonb_agg(to_jsonb(d)order by d.id)from public.deliverables d where d.mission_id=m.id),'[]'),'milestones',coalesce((select jsonb_agg(to_jsonb(s)order by s.id)from public.mission_milestones s where s.mission_id=m.id),'[]'));
 insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)
 values(q.id,m.client_organization_id,'EXCEPTION','mission_scope_reconciliation',am.id::text,'Réconcilier le périmètre signé et les réceptions opérationnelles','مطابقة النطاق الموقع مع الاستلام التشغيلي','HIGH',clock_timestamp()+make_interval(mins=>q.sla_minutes),context,am.created_by)returning id into work_id;
 insert into public.admin_work_item_events(work_item_id,event_type,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(work_id,'SIGNED_SCOPE_EXCEPTION_DETECTED','OPEN',am.created_by,'Détection système : retrait ou remplacement signé sans génération opérationnelle correspondante.',context,correlation);
 insert into public.mission_scope_reconciliation_exceptions_v1(amendment_id,mission_id,base_contract_version_id,signed_contract_version_id,signed_delta,previous_operational_snapshot,admin_work_item_id)values(am.id,m.id,am.base_contract_version_id,am.activated_contract_version_id,am.deliverables_delta,snapshot,work_id);
 update public.missions set scope_reconciliation_required=true where id=m.id;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(m.client_organization_id,'SYSTEM','mission.signed_scope.reconciliation_required','mission',m.id::text,correlation,context||jsonb_build_object('admin_work_item_id',work_id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(m.client_organization_id,'mission',m.id::text,'MissionSignedScopeReconciliationRequiredV1',correlation,context||jsonb_build_object('admin_work_item_id',work_id),'signed-scope-exception:'||am.id::text);
end$$;
create function private.detect_signed_scope_exception_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$begin perform private.record_signed_scope_exception_v1(new.id);return new;end$$;
create trigger signed_scope_reconciliation_exception_v1 after update of status on public.contract_amendments for each row when(new.status='ACTIVE'and old.status is distinct from new.status)execute function private.detect_signed_scope_exception_v1();
-- Explicitly migrate already-active legacy boundaries, without changing their
-- delivery/receipt/proof/dispute/financial histories or pretending acceptance.
do $$declare a uuid;begin for a in select id from public.contract_amendments where status='ACTIVE'order by activated_at,id loop perform private.record_signed_scope_exception_v1(a);end loop;end$$;

-- A queue resolution or an unrelated newer ADD must never silently lift the
-- hold. Only a future, versioned reconciliation command may do that.
create function private.require_scope_reconciliation_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare mission_id uuid;
begin
 if tg_table_name='delivery_versions'then select d.mission_id into mission_id from public.deliverables d where d.id=new.deliverable_id;
 else mission_id:=new.mission_id;end if;
 if exists(select 1 from public.missions m where m.id=mission_id and m.scope_reconciliation_required)then raise exception'MISSION_SIGNED_SCOPE_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 return new;
end$$;
create trigger signed_scope_delivery_guard_v1 before insert on public.delivery_versions for each row execute function private.require_scope_reconciliation_v1();
create trigger signed_scope_deliverable_guard_v1 before update of status,current_version on public.deliverables for each row execute function private.require_scope_reconciliation_v1();
create trigger signed_scope_receipt_guard_v1 before update of status on public.acceptance_checklists for each row execute function private.require_scope_reconciliation_v1();
create trigger signed_scope_milestone_guard_v1 before update of status on public.mission_milestones for each row execute function private.require_scope_reconciliation_v1();
create trigger signed_scope_checklist_guard_v1 before update of status on public.mission_checklist_items for each row execute function private.require_scope_reconciliation_v1();

do $patch$declare src text;needle text;begin
 src:=pg_get_functiondef('private.mission_amendment_preparation_v1(uuid)'::regprocedure);
 needle:='when exists(select 1 from public.mission_amendment_executions_v1 e where e.amendment_id=am.id)then''APPLIED''';
 if position(needle in src)=0 then raise exception'SIGNED_SCOPE_PREPARATION_SOURCE_DRIFT';end if;
 execute replace(src,needle,'when m.scope_reconciliation_required then''SCOPE_RECONCILIATION_REQUIRED'' '||needle);
 src:=pg_get_functiondef('private.require_prepared_amendment_work_v1()'::regprocedure);
 needle:='if new.status=''COMPLETED''and old.status<>''COMPLETED''and exists';
 if position(needle in src)=0 then raise exception'SIGNED_SCOPE_COMPLETION_SOURCE_DRIFT';end if;
 execute replace(src,needle,'if new.status=''COMPLETED''and old.status<>''COMPLETED''and new.scope_reconciliation_required then raise exception''MISSION_SIGNED_SCOPE_RECONCILIATION_REQUIRED''using errcode=''55000'';end if; '||needle);
end$patch$;
create function private.prevent_unreconciled_scope_closure_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_table_name='missions'then
  if old.scope_reconciliation_required and not new.scope_reconciliation_required then raise exception'MISSION_SIGNED_SCOPE_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 elsif new.status in('RESOLVED','DISMISSED')and exists(select 1 from public.mission_scope_reconciliation_exceptions_v1 e join public.missions m on m.id=e.mission_id where e.admin_work_item_id=new.id and m.scope_reconciliation_required)then raise exception'MISSION_SIGNED_SCOPE_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 return new;
end$$;
create trigger signed_scope_hold_immutable_v1 before update of scope_reconciliation_required on public.missions for each row execute function private.prevent_unreconciled_scope_closure_v1();
create trigger signed_scope_admin_resolution_guard_v1 before update of status on public.admin_work_items for each row execute function private.prevent_unreconciled_scope_closure_v1();
revoke all on function private.prevent_unreconciled_scope_closure_v1()from public,anon,authenticated,service_role;
revoke all on function private.record_signed_scope_exception_v1(uuid),private.detect_signed_scope_exception_v1(),private.require_scope_reconciliation_v1()from public,anon,authenticated,service_role;
-- A held mission has no certified current operational due count. Preserve the
-- real active-mission count and expose an unavailable due count, never zero.
create or replace function public.get_provider_mission_counts_v1(p_organization_id uuid)returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 if not public.provider_mission_query_access_v1(p_organization_id)then raise exception'MISSION_READ_DENIED'using errcode='42501';end if;
 return jsonb_build_object('active_missions',(select count(*)from public.missions m where m.provider_organization_id=p_organization_id and m.status not in('COMPLETED','CANCELLED')),
 'deliverables_due',case when exists(select 1 from public.missions m where m.provider_organization_id=p_organization_id and m.scope_reconciliation_required)then null else
 (select count(*)from public.deliverables d join public.missions m on m.id=d.mission_id where m.provider_organization_id=p_organization_id and m.status not in('COMPLETED','CANCELLED')and d.status in('PENDING','REJECTED'))+
 (select count(*)from public.mission_milestones s join public.missions m on m.id=s.mission_id where m.provider_organization_id=p_organization_id and m.status not in('COMPLETED','CANCELLED')and s.status in('PENDING','IN_PROGRESS','SUBMITTED','REJECTED')and s.due_at<=current_timestamp+interval'7 days')end);
end$$;
notify pgrst,'reload schema';
commit;
