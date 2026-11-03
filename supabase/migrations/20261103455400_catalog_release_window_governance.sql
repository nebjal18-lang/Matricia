begin;
-- An orphan historical PUBLISHED snapshot is not silently cancelled or assigned
-- invented lineage. Two central humans explicitly close only its future window.
create table public.catalog_release_window_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),library_id uuid not null references public.catalog_libraries(id),release_id uuid not null references public.catalog_releases(id),
 source_snapshot jsonb not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),reason text not null check(length(btrim(reason))between 3 and 1000),
 requested_by uuid not null references auth.users(id),requested_at timestamptz not null default clock_timestamp()
);
create table public.catalog_release_window_decisions_v1(
 request_id uuid primary key references public.catalog_release_window_requests_v1(id),approved boolean not null,reason text not null check(length(btrim(reason))between 3 and 1000),
 decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp(),result jsonb not null
);
alter table public.catalog_release_window_requests_v1 enable row level security;
alter table public.catalog_release_window_decisions_v1 enable row level security;
revoke all on public.catalog_release_window_requests_v1,public.catalog_release_window_decisions_v1 from public,anon,authenticated,service_role;
grant select on public.catalog_release_window_requests_v1,public.catalog_release_window_decisions_v1 to authenticated;
create policy catalog_window_requests_read on public.catalog_release_window_requests_v1 for select to authenticated using(private.has_library_permission(library_id,'CATALOG_APPROVE'));
create policy catalog_window_decisions_read on public.catalog_release_window_decisions_v1 for select to authenticated using(exists(select 1 from public.catalog_release_window_requests_v1 q where q.id=request_id and private.has_library_permission(q.library_id,'CATALOG_APPROVE')));
create trigger catalog_window_requests_immutable before update or delete on public.catalog_release_window_requests_v1 for each row execute function private.prevent_update_delete();
create trigger catalog_window_decisions_immutable before update or delete on public.catalog_release_window_decisions_v1 for each row execute function private.prevent_update_delete();

create function private.assert_catalog_window_central_v1()returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if auth.uid()is null then raise exception'CATALOG_AUTH_REQUIRED'using errcode='42501';end if;
 if auth.role()is distinct from'authenticated'then raise exception'CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'CENTRAL_MFA_REQUIRED'using errcode='42501';end if;
 if private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],auth.uid())is distinct from true then raise exception'CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 perform private.assert_catalog_central_aal2_locked(auth.uid());
end$$;
revoke all on function private.assert_catalog_window_central_v1()from public,anon,authenticated,service_role;

create function private.catalog_release_window_source_v1(p_release uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare target public.catalog_releases%rowtype;current_release public.catalog_releases%rowtype;library public.catalog_libraries%rowtype;now_at timestamptz:=clock_timestamp();begin
 select*into target from public.catalog_releases where id=p_release;
 select*into library from public.catalog_libraries where id=target.library_id;
 select*into current_release from public.catalog_releases where id=library.current_release_id and library_id=library.id;
 if target.id is null or current_release.id is null or target.id=current_release.id or target.status is distinct from'PUBLISHED'or current_release.status is distinct from'PUBLISHED'
  or target.effective_from>=now_at or(target.effective_until is not null and target.effective_until<=now_at)
  or current_release.effective_from>now_at or(current_release.effective_until is not null and current_release.effective_until<=now_at)
  or private.canonical_catalog_audience(target.audience)is distinct from private.canonical_catalog_audience(current_release.audience)
 then raise exception'CATALOG_RELEASE_WINDOW_REVIEW_NOT_ELIGIBLE'using errcode='55000';end if;
 return jsonb_build_object('target',to_jsonb(target),'current',to_jsonb(current_release),'library',jsonb_build_object('id',library.id,'current_release_id',library.current_release_id,'row_version',library.row_version));
end$$;
revoke all on function private.catalog_release_window_source_v1(uuid)from public,anon,authenticated,service_role;

create function public.request_catalog_release_window_closure_v1(p_release_id uuid,p_expected_row_version integer,p_expected_snapshot_hash text,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();target public.catalog_releases%rowtype;lib public.catalog_libraries%rowtype;source jsonb;h text;command uuid;replay jsonb;request uuid:=extensions.gen_random_uuid();result jsonb;begin
 perform private.assert_catalog_window_central_v1();
 select*into target from public.catalog_releases where id=p_release_id;
 if target.id is null or private.has_library_permission(target.library_id,'CATALOG_APPROVE',actor)is distinct from true then raise exception'CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 if p_expected_row_version is null or p_expected_row_version<1 or coalesce(p_expected_snapshot_hash,'')!~'^[a-f0-9]{64}$'or length(btrim(coalesce(p_reason,'')))not between 3 and 1000 or p_correlation_id is null then raise exception'INVALID_CATALOG_WINDOW_REQUEST'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('release',p_release_id,'version',p_expected_row_version,'hash',p_expected_snapshot_hash,'reason',btrim(p_reason)));
 select b.command_id,b.response_body into command,replay from private.begin_catalog_command(actor,'catalog.release.window.request.v1',p_idempotency_key,h)b;if replay is not null then return replay;end if;
 -- A publishing lease owns its release row before the library row. Reject that
 -- ineligible target before taking the inverse governance/library lock order.
 if target.status is distinct from'PUBLISHED'then raise exception'CATALOG_RELEASE_WINDOW_REVIEW_NOT_ELIGIBLE'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-library:'||target.library_id::text,0));
 select*into lib from public.catalog_libraries where id=target.library_id for update;
 perform 1 from public.catalog_releases where id in(p_release_id,lib.current_release_id)order by id for update;
 source:=private.catalog_release_window_source_v1(p_release_id);
 if(source#>>'{target,row_version}')::integer is distinct from p_expected_row_version or coalesce(source#>>'{target,snapshot_hash}',source#>>'{target,source_bundle_hash}')is distinct from p_expected_snapshot_hash then raise exception'CATALOG_RELEASE_WINDOW_SOURCE_CHANGED'using errcode='40001';end if;
 perform private.assert_catalog_permission_locked(target.library_id,'CATALOG_APPROVE',actor);
 insert into public.catalog_release_window_requests_v1(id,library_id,release_id,source_snapshot,source_hash,reason,requested_by)values(request,target.library_id,p_release_id,source,private.canonical_request_hash(source),btrim(p_reason),actor);
 result:=jsonb_build_object('outcome','CATALOG_RELEASE_WINDOW_CLOSURE_REQUESTED','request_id',request,'source_hash',private.canonical_request_hash(source));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(lib.steward_organization_id,actor,'USER','catalog.release.window_closure_requested','catalog_release',p_release_id::text,p_correlation_id,jsonb_build_object('request_id',request,'source_hash',private.canonical_request_hash(source),'reason',btrim(p_reason),'current_release_id',lib.current_release_id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values(lib.steward_organization_id,'catalog_release_window_request',request::text,'CatalogReleaseWindowClosureRequestedV1',p_correlation_id,result,p_idempotency_key,command);
 perform private.finish_catalog_command(actor,'catalog.release.window.request.v1',p_idempotency_key,result);return result;
end$$;

create function public.decide_catalog_release_window_closure_v1(p_request_id uuid,p_expected_source_hash text,p_approved boolean,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();request public.catalog_release_window_requests_v1%rowtype;lib public.catalog_libraries%rowtype;source jsonb;h text;command uuid;replay jsonb;closed_at timestamptz;result jsonb;begin
 perform private.assert_catalog_window_central_v1();
 select*into request from public.catalog_release_window_requests_v1 where id=p_request_id;
 if request.id is null or private.has_library_permission(request.library_id,'CATALOG_APPROVE',actor)is distinct from true then raise exception'CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 if actor=request.requested_by then raise exception'CATALOG_WINDOW_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_expected_source_hash is null or p_expected_source_hash is distinct from request.source_hash then raise exception'CATALOG_RELEASE_WINDOW_SOURCE_CHANGED'using errcode='40001';end if;
 if p_approved is null or length(btrim(coalesce(p_reason,'')))not between 3 and 1000 or p_correlation_id is null then raise exception'INVALID_CATALOG_WINDOW_DECISION'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('request',p_request_id,'source_hash',p_expected_source_hash,'approved',p_approved,'reason',btrim(p_reason)));
 select b.command_id,b.response_body into command,replay from private.begin_catalog_command(actor,'catalog.release.window.decide.v1',p_idempotency_key,h)b;if replay is not null then return replay;end if;
 perform 1 from public.catalog_release_window_requests_v1 where id=request.id for update;
 if exists(select 1 from public.catalog_release_window_decisions_v1 where request_id=request.id)then raise exception'CATALOG_RELEASE_WINDOW_ALREADY_DECIDED'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-library:'||request.library_id::text,0));
 select*into lib from public.catalog_libraries where id=request.library_id for update;
 perform 1 from public.catalog_releases where id in(request.release_id,lib.current_release_id)order by id for update;
 perform private.assert_catalog_permission_locked(request.library_id,'CATALOG_APPROVE',actor);
 if p_approved then
  begin source:=private.catalog_release_window_source_v1(request.release_id);exception when sqlstate'55000'then raise exception'CATALOG_RELEASE_WINDOW_SOURCE_CHANGED'using errcode='40001';end;
  if source is distinct from request.source_snapshot or private.canonical_request_hash(source)is distinct from request.source_hash then raise exception'CATALOG_RELEASE_WINDOW_SOURCE_CHANGED'using errcode='40001';end if;
  closed_at:=clock_timestamp();
  update public.catalog_releases set effective_until=closed_at,status='RETIRED',retired_at=closed_at,row_version=row_version+1 where id=request.release_id;
 end if;
 result:=jsonb_build_object('outcome',case when p_approved then'CATALOG_RELEASE_WINDOW_CLOSED'else'CATALOG_RELEASE_WINDOW_CLOSURE_REJECTED'end,'request_id',request.id,'release_id',request.release_id,'effective_until',closed_at);
 insert into public.catalog_release_window_decisions_v1(request_id,approved,reason,decided_by,result)values(request.id,p_approved,btrim(p_reason),actor,result);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(lib.steward_organization_id,actor,'USER',case when p_approved then'catalog.release.window_closed'else'catalog.release.window_closure_rejected'end,'catalog_release',request.release_id::text,p_correlation_id,jsonb_build_object('request_id',request.id,'source_hash',request.source_hash,'current_release_id',lib.current_release_id,'effective_until',closed_at,'reason',btrim(p_reason),'historical_snapshot_preserved',true),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values(lib.steward_organization_id,'catalog_release_window_request',request.id::text,case when p_approved then'CatalogReleaseWindowClosedV1'else'CatalogReleaseWindowClosureRejectedV1'end,p_correlation_id,result,p_idempotency_key,command);
 perform private.finish_catalog_command(actor,'catalog.release.window.decide.v1',p_idempotency_key,result);return result;
end$$;

create function public.get_catalog_release_window_context_v1(p_library_id uuid default null,p_page integer default 1)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();conflicts jsonb:='[]';requests jsonb:='[]';item record;source jsonb;changed boolean;more boolean:=false;n integer:=0;begin
 perform private.assert_catalog_window_central_v1();
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_CATALOG_WINDOW_PAGE'using errcode='22023';end if;
 if p_library_id is not null and private.has_library_permission(p_library_id,'CATALOG_APPROVE',actor)is distinct from true then raise exception'CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 for item in select r.*,lib.code library_code,current_release.id current_id,current_release.release_key current_key
  from public.catalog_releases r join public.catalog_libraries lib on lib.id=r.library_id
  join public.catalog_releases current_release on current_release.id=lib.current_release_id and current_release.library_id=lib.id
  where(p_library_id is null or lib.id=p_library_id)and private.has_library_permission(lib.id,'CATALOG_APPROVE',actor)
   and r.id<>current_release.id and r.status='PUBLISHED'and current_release.status='PUBLISHED'
   and r.effective_from<clock_timestamp()and(r.effective_until is null or r.effective_until>clock_timestamp())
   and current_release.effective_from<=clock_timestamp()and(current_release.effective_until is null or current_release.effective_until>clock_timestamp())
   and private.canonical_catalog_audience(r.audience)=private.canonical_catalog_audience(current_release.audience)
  order by lib.code,r.release_key,r.id offset(p_page-1)*25 limit 26
 loop
  n:=n+1;if n>25 then more:=true;exit;end if;
  conflicts:=conflicts||jsonb_build_array(jsonb_build_object('releaseId',item.id,'libraryId',item.library_id,'libraryCode',item.library_code,'releaseKey',item.release_key,'expectedSnapshotHash',coalesce(item.snapshot_hash,item.source_bundle_hash),'rowVersion',item.row_version,'effectiveFrom',item.effective_from,'effectiveUntil',item.effective_until,'currentReleaseId',item.current_id,'currentReleaseKey',item.current_key,'canRequest',true));
 end loop;
 n:=0;
 for item in select q.*,lib.code library_code,d.approved,d.reason decision_reason,d.result decision_result,d.decided_at
  from public.catalog_release_window_requests_v1 q join public.catalog_libraries lib on lib.id=q.library_id
  left join public.catalog_release_window_decisions_v1 d on d.request_id=q.id
  where(p_library_id is null or q.library_id=p_library_id)and private.has_library_permission(q.library_id,'CATALOG_APPROVE',actor)
  order by q.requested_at desc,q.id offset(p_page-1)*25 limit 26
 loop
  n:=n+1;if n>25 then more:=true;exit;end if;
  changed:=false;
  if item.approved is null then
   begin source:=private.catalog_release_window_source_v1(item.release_id);changed:=source is distinct from item.source_snapshot;
   exception when sqlstate'55000'then changed:=true;end;
  end if;
  requests:=requests||jsonb_build_array(jsonb_build_object('id',item.id,'libraryId',item.library_id,'libraryCode',item.library_code,'releaseId',item.release_id,'releaseKey',item.source_snapshot#>>'{target,release_key}','currentReleaseKey',item.source_snapshot#>>'{current,release_key}','sourceHash',item.source_hash,'reason',item.reason,'requestedBy',item.requested_by,'requestedAt',item.requested_at,'status',case when item.approved is null then'PENDING'when item.approved then'CLOSED'else'REJECTED'end,'canDecide',item.approved is null and item.requested_by<>actor,'sourceChanged',changed,'decisionReason',item.decision_reason,'closedAt',item.decision_result->'effective_until'));
 end loop;
 return jsonb_build_object('complete',true,'page',p_page,'pageSize',25,'hasMore',more,'conflicts',conflicts,'requests',requests);
end$$;
revoke all on function public.request_catalog_release_window_closure_v1(uuid,integer,text,text,text,uuid),public.decide_catalog_release_window_closure_v1(uuid,text,boolean,text,text,uuid),public.get_catalog_release_window_context_v1(uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.request_catalog_release_window_closure_v1(uuid,integer,text,text,text,uuid),public.decide_catalog_release_window_closure_v1(uuid,text,boolean,text,text,uuid),public.get_catalog_release_window_context_v1(uuid,integer)to authenticated;

-- Future normal publication closes only its proven based-on/current predecessor,
-- at actual atomic replacement time, not retroactively at a delayed schedule.
create function private.close_catalog_predecessor_window_v1(p_previous uuid,p_successor uuid,p_correlation uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$
declare old_release public.catalog_releases%rowtype;next_release public.catalog_releases%rowtype;closed_at timestamptz:=clock_timestamp();until_at timestamptz;begin
 if p_previous is null then return;end if;
 select*into old_release from public.catalog_releases where id=p_previous for update;
 select*into next_release from public.catalog_releases where id=p_successor;
 if old_release.status is distinct from'PUBLISHED'then return;end if;
 if next_release.library_id is distinct from old_release.library_id or next_release.based_on_release_id is distinct from old_release.id
  or not exists(select 1 from public.catalog_libraries where id=old_release.library_id and current_release_id=old_release.id)
  or old_release.effective_from>=closed_at then raise exception'CATALOG_PREDECESSOR_WINDOW_INVALID'using errcode='55000';end if;
 until_at:=least(coalesce(old_release.effective_until,closed_at),closed_at);
 update public.catalog_releases set status='RETIRED',retired_at=closed_at,effective_until=until_at,row_version=row_version+1 where id=old_release.id;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)select steward_organization_id,'SYSTEM','catalog.release.window_superseded','catalog_release',old_release.id::text,p_correlation,jsonb_build_object('successor_release_id',next_release.id,'old_effective_until',old_release.effective_until,'effective_until',until_at,'snapshot_hash',old_release.snapshot_hash),repeat('0',64)from public.catalog_libraries where id=old_release.library_id;
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)select steward_organization_id,'catalog_release',old_release.id::text,'CatalogReleaseWindowSupersededV1',p_correlation,jsonb_build_object('previous_release_id',old_release.id,'successor_release_id',next_release.id,'effective_until',until_at),'catalog-window-superseded:'||next_release.id::text from public.catalog_libraries where id=old_release.library_id;
end$$;
revoke all on function private.close_catalog_predecessor_window_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;anchor text:='if v_previous is not null then update public.catalog_releases set status=''RETIRED'',retired_at=clock_timestamp(),row_version=row_version+1 where id=v_previous and status=''PUBLISHED''; end if;';begin
 definition:=pg_get_functiondef('public.complete_catalog_release_publish(uuid,uuid,integer,uuid)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'CATALOG_PREDECESSOR_WINDOW_SOURCE_MISMATCH';end if;
 execute replace(definition,anchor,'perform private.close_catalog_predecessor_window_v1(v_previous,p_release_id,p_correlation_id);');
end$$;
notify pgrst,'reload schema';
commit;
