begin;
create table public.organization_member_franchise_assignments(
 membership_id uuid not null,role_code text not null,franchise_id uuid not null references public.franchises(id)on delete restrict,
 granted_by uuid references auth.users(id),granted_at timestamptz not null default clock_timestamp(),revoked_at timestamptz,
 primary key(membership_id,role_code,franchise_id),foreign key(membership_id,role_code)references public.organization_member_roles(membership_id,role_code)on delete cascade);
alter table public.organization_member_franchise_assignments enable row level security;
revoke all on public.organization_member_franchise_assignments from public,anon,authenticated,service_role;
grant select on public.organization_member_franchise_assignments to authenticated;
create policy member_franchise_assignments_read on public.organization_member_franchise_assignments for select to authenticated using(exists(select 1 from public.organization_memberships m where m.id=membership_id and(private.is_active_org_member(m.organization_id,auth.uid())or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()))));
create function private.has_franchise_role(p_franchise_id uuid,p_role_codes text[],p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p_actor is not null and exists(select 1 from public.franchises f join public.franchise_mandate_versions v on v.id=f.current_mandate_version_id and v.franchise_id=f.id and v.mandate_status='ACTIVE'and v.effective_from<=clock_timestamp()and(v.effective_until is null or v.effective_until>clock_timestamp())join public.organization_memberships m on m.organization_id=f.operator_organization_id and m.user_id=p_actor and m.status='ACTIVE'join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null and r.role_code=any(p_role_codes)
 where f.id=p_franchise_id and f.status='ACTIVE'and(
 exists(select 1 from public.organization_member_franchise_assignments a where a.membership_id=r.membership_id and a.role_code=r.role_code and a.franchise_id=f.id and a.revoked_at is null)
 or(not exists(select 1 from public.organization_member_franchise_assignments a where a.membership_id=r.membership_id and a.role_code=r.role_code)and(r.franchise_id=f.id or(r.franchise_id is null and(select count(*)from public.franchises other where other.operator_organization_id=f.operator_organization_id and other.status='ACTIVE')=1)))))
$$;
create function private.materialize_legacy_franchise_assignment_v1(p_membership_id uuid,p_role_code text)returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.organization_member_roles%rowtype;org uuid;target uuid;
begin
 select*into r from public.organization_member_roles where membership_id=p_membership_id and role_code=p_role_code for update;
 if r.membership_id is null or r.revoked_at is not null or p_role_code not like'FRANCHISE\_%'escape'\'or exists(select 1 from public.organization_member_franchise_assignments where membership_id=p_membership_id and role_code=p_role_code)then return;end if;
 select organization_id into org from public.organization_memberships where id=p_membership_id;
 if r.franchise_id is not null then select id into target from public.franchises where id=r.franchise_id and operator_organization_id=org;
 elsif(select count(*)from public.franchises where operator_organization_id=org and status='ACTIVE')=1 then select id into target from public.franchises where operator_organization_id=org and status='ACTIVE';end if;
 if target is not null then insert into public.organization_member_franchise_assignments(membership_id,role_code,franchise_id,granted_by,granted_at)values(p_membership_id,p_role_code,target,r.granted_by,r.granted_at)on conflict do nothing;end if;
end$$;
create function private.grant_franchise_role_assignment_v1(p_membership_id uuid,p_role_code text,p_franchise_id uuid,p_actor uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns void language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare m public.organization_memberships%rowtype;f public.franchises%rowtype;already boolean;
begin
 select*into m from public.organization_memberships where id=p_membership_id for update;
 select*into f from public.franchises where id=p_franchise_id for share;
 if m.id is null or m.status<>'ACTIVE'or f.id is null or f.operator_organization_id<>m.organization_id or f.status<>'ACTIVE'or not exists(select 1 from public.role_definitions where code=p_role_code and scope_type='FRANCHISE')or not exists(select 1 from public.franchise_mandate_versions where id=f.current_mandate_version_id and franchise_id=f.id and mandate_status='ACTIVE'and effective_from<=clock_timestamp()and(effective_until is null or effective_until>clock_timestamp()))then raise exception'FRANCHISE_ROLE_ASSIGNMENT_SCOPE_DENIED'using errcode='42501';end if;
 perform private.materialize_legacy_franchise_assignment_v1(m.id,p_role_code);
 select exists(select 1 from public.organization_member_franchise_assignments where membership_id=m.id and role_code=p_role_code and franchise_id=f.id and revoked_at is null)into already;
 insert into public.organization_member_roles(membership_id,role_code,granted_by)values(m.id,p_role_code,p_actor)on conflict(membership_id,role_code)do update set revoked_at=null,granted_by=excluded.granted_by;
 insert into public.organization_member_franchise_assignments(membership_id,role_code,franchise_id,granted_by)values(m.id,p_role_code,f.id,p_actor)on conflict(membership_id,role_code,franchise_id)do update set revoked_at=null,granted_by=excluded.granted_by,granted_at=clock_timestamp();
 if not already then
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(m.organization_id,p_actor,'USER','identity.franchise.role_assigned','organization_membership',m.id::text,p_correlation_id,jsonb_build_object('franchise_id',f.id,'role_code',p_role_code),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(m.organization_id,'organization_membership',m.id::text,'FranchiseRoleAssignedV1',p_correlation_id,jsonb_build_object('membership_id',m.id,'franchise_id',f.id,'role_code',p_role_code));
 end if;
end$$;
create function private.revoke_franchise_role_assignment_v1(p_membership_id uuid,p_role_code text,p_franchise_id uuid,p_actor uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns void language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare org uuid;
begin
 select organization_id into org from public.organization_memberships where id=p_membership_id for update;
 if org is null or not exists(select 1 from public.franchises where id=p_franchise_id and operator_organization_id=org)then raise exception'FRANCHISE_ROLE_ASSIGNMENT_SCOPE_DENIED'using errcode='42501';end if;
 perform private.materialize_legacy_franchise_assignment_v1(p_membership_id,p_role_code);
 -- A tombstone suppresses legacy fallback even if no prior explicit binding existed.
 insert into public.organization_member_franchise_assignments(membership_id,role_code,franchise_id,granted_by,revoked_at)values(p_membership_id,p_role_code,p_franchise_id,p_actor,clock_timestamp())on conflict(membership_id,role_code,franchise_id)do update set revoked_at=coalesce(organization_member_franchise_assignments.revoked_at,clock_timestamp());
 if not exists(select 1 from public.organization_member_franchise_assignments where membership_id=p_membership_id and role_code=p_role_code and revoked_at is null)then update public.organization_member_roles set revoked_at=clock_timestamp()where membership_id=p_membership_id and role_code=p_role_code;end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,p_actor,'USER','identity.franchise.role_revoked','organization_membership',p_membership_id::text,p_correlation_id,jsonb_build_object('franchise_id',p_franchise_id,'role_code',p_role_code),repeat('0',64));
end$$;
create function private.revoke_franchise_assignments_with_base_role_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$begin
 if old.revoked_at is null and new.revoked_at is not null then update public.organization_member_franchise_assignments set revoked_at=coalesce(revoked_at,new.revoked_at)where membership_id=new.membership_id and role_code=new.role_code;end if;return new;
end$$;
create trigger member_role_revokes_franchise_assignments after update of revoked_at on public.organization_member_roles for each row execute function private.revoke_franchise_assignments_with_base_role_v1();
revoke all on function private.has_franchise_role(uuid,text[],uuid),private.materialize_legacy_franchise_assignment_v1(uuid,text),private.grant_franchise_role_assignment_v1(uuid,text,uuid,uuid,uuid),private.revoke_franchise_role_assignment_v1(uuid,text,uuid,uuid,uuid),private.revoke_franchise_assignments_with_base_role_v1()from public,anon,authenticated,service_role;
grant execute on function private.has_franchise_role(uuid,text[],uuid)to authenticated;
create function public.get_admin_role_editor_context_v1(p_membership_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare org uuid;
begin
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid())then raise exception'ADMIN_ROLE_EDITOR_DENIED'using errcode='42501';end if;
 select organization_id into org from public.organization_memberships where id=p_membership_id;
 if org is null then raise exception'MEMBERSHIP_NOT_FOUND'using errcode='P0002';end if;
 return jsonb_build_object('roles',coalesce((select jsonb_agg(jsonb_build_object('roleCode',r.role_code,'franchiseId',a.franchise_id,'franchiseLabel',f.territory_code))from public.organization_member_roles r left join lateral(select b.franchise_id from public.organization_member_franchise_assignments b where b.membership_id=r.membership_id and b.role_code=r.role_code and b.revoked_at is null union all select coalesce(r.franchise_id,(select min(only_f.id::text)::uuid from public.franchises only_f where only_f.operator_organization_id=org and only_f.status='ACTIVE'having count(*)=1))where r.role_code like'FRANCHISE\_%'escape'\'and not exists(select 1 from public.organization_member_franchise_assignments b where b.membership_id=r.membership_id and b.role_code=r.role_code))a on true left join public.franchises f on f.id=a.franchise_id where r.membership_id=p_membership_id and r.revoked_at is null),'[]'::jsonb),
 'franchises',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'label',f.territory_code))from public.franchises f join public.franchise_mandate_versions v on v.id=f.current_mandate_version_id and v.franchise_id=f.id where f.operator_organization_id=org and f.status='ACTIVE'and v.mandate_status='ACTIVE'and v.effective_from<=clock_timestamp()and(v.effective_until is null or v.effective_until>clock_timestamp())),'[]'::jsonb));
end$$;
revoke all on function public.get_admin_role_editor_context_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_role_editor_context_v1(uuid)to authenticated;
create function private.execute_admin_membership_mutation_v1(p_action_request_id uuid,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype;payload jsonb;m public.organization_memberships%rowtype;u uuid;new_role text;old_role text;source_franchise uuid;target_franchise uuid;
begin
 select*into x from public.admin_operational_action_requests where id=p_action_request_id;
 if auth.role()is distinct from'service_role'or x.status<>'AUTHORIZED'then raise exception'ADMIN_MEMBERSHIP_EXECUTION_DENIED'using errcode='42501';end if;
 payload:=x.redacted_summary;u:=coalesce(nullif(payload->>'userId','')::uuid,x.resource_id::uuid);
 select*into m from public.organization_memberships where organization_id=x.organization_id and user_id=u for update;
 if m.id is null then raise exception'MEMBERSHIP_NOT_FOUND'using errcode='P0002';end if;
 old_role:=nullif(payload->>'currentRole','');new_role:=nullif(payload->>'newRole','');source_franchise:=nullif(payload->>'currentFranchiseId','')::uuid;target_franchise:=nullif(payload->>'franchiseId','')::uuid;
 if old_role is not null and not exists(select 1 from public.organization_member_roles where membership_id=m.id and role_code=old_role and revoked_at is null)then raise exception'STALE_MEMBERSHIP_ROLE'using errcode='40001';end if;
 if x.action_type in('SUSPEND_ENTITY','RESTRICT_ENTITY')then
  if source_franchise is not null and old_role like'FRANCHISE\_%'escape'\'then perform private.revoke_franchise_role_assignment_v1(m.id,old_role,source_franchise,x.requested_by,p_correlation_id);
  else update public.organization_memberships set status=case when x.action_type='RESTRICT_ENTITY'then'REVOKED'else'SUSPENDED'end,updated_at=clock_timestamp(),row_version=row_version+1 where id=m.id;end if;
 else
  if not exists(select 1 from public.role_definitions where code=new_role and scope_type in('ORGANIZATION','FRANCHISE'))then raise exception'ADMIN_ROLE_NOT_ALLOWED'using errcode='22023';end if;
  if old_role like'FRANCHISE\_%'escape'\'and source_franchise is null and old_role is distinct from new_role then raise exception'ADMIN_CURRENT_FRANCHISE_REQUIRED'using errcode='22023';end if;
  if source_franchise is not null and not private.has_franchise_role(source_franchise,array[old_role],u)then raise exception'ADMIN_CURRENT_FRANCHISE_SCOPE_DENIED'using errcode='42501';end if;
  if new_role like'FRANCHISE\_%'escape'\'then
   if target_franchise is null then raise exception'ADMIN_TARGET_FRANCHISE_REQUIRED'using errcode='22023';end if;
   if old_role like'FRANCHISE\_%'escape'\'and source_franchise is not null and source_franchise<>target_franchise then raise exception'ADMIN_ROLE_TRANSFER_REQUIRES_EXPLICIT_ADD'using errcode='22023';end if;
   perform private.grant_franchise_role_assignment_v1(m.id,new_role,target_franchise,x.requested_by,p_correlation_id);
  else
   if target_franchise is not null then raise exception'ADMIN_FRANCHISE_SCOPE_NOT_APPLICABLE'using errcode='22023';end if;
   insert into public.organization_member_roles(membership_id,role_code,granted_by)values(m.id,new_role,x.requested_by)on conflict(membership_id,role_code)do update set revoked_at=null,granted_by=excluded.granted_by,granted_at=clock_timestamp();
  end if;
  if old_role is not null and old_role is distinct from new_role then
   if old_role like'FRANCHISE\_%'escape'\'then perform private.revoke_franchise_role_assignment_v1(m.id,old_role,source_franchise,x.requested_by,p_correlation_id);
   else update public.organization_member_roles set revoked_at=clock_timestamp()where membership_id=m.id and role_code=old_role and revoked_at is null;end if;
  end if;
  update public.organization_memberships set row_version=row_version+1,updated_at=clock_timestamp()where id=m.id;
 end if;
 if jsonb_array_length(coalesce(payload->'capabilities','[]'))>0 then
  insert into public.admin_membership_capability_reviews_v1(action_request_id,membership_id,requested_capabilities)values(x.id,m.id,array(select jsonb_array_elements_text(payload->'capabilities')));
  insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)
  select id,x.organization_id,'MANUAL_REVIEW','membership_capability_review',x.id::text,'Revoir les capacités demandées pour ce rôle','مراجعة القدرات المطلوبة لهذا الدور','MEDIUM',clock_timestamp()+interval'1 day',jsonb_build_object('membership_id',m.id,'action_request_id',x.id,'effective_access','ROLE_RLS'),x.requested_by from public.admin_queue_versions where queue_key='CENTRAL_APPROVALS'and status='ACTIVE';
 end if;
 return jsonb_build_object('membership_id',m.id,'franchise_id',target_franchise,'effective_access','ROLE_RLS','capability_review_pending',jsonb_array_length(coalesce(payload->'capabilities','[]'))>0);
end$$;
revoke all on function private.execute_admin_membership_mutation_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;first_pos integer;last_pos integer;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 first_pos:=strpos(definition,'elsif x.resource_type in(''MEMBERSHIP'',''USER'')then');
 last_pos:=strpos(definition,'elsif x.resource_type=''MATCHING''and');
 if first_pos=0 or last_pos<=first_pos then raise exception'ADMIN_EXECUTOR_MEMBERSHIP_PATCH_TARGET_NOT_FOUND';end if;
 definition:=substring(definition from 1 for first_pos-1)||'elsif x.resource_type in(''MEMBERSHIP'',''USER'')then result:=private.execute_admin_membership_mutation_v1(x.id,p_correlation_id); '||substring(definition from last_pos);
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
