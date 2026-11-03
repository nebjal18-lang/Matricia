begin;
-- Execution scope is intentionally explicit. These dispositions do not erase
-- identities, accounting ledgers, contracts, audit evidence or shared documents.
create table public.privacy_retention_execution_approvals_v1(
 id uuid primary key default extensions.gen_random_uuid(),action_request_id uuid not null unique references public.admin_operational_action_requests(id),organization_id uuid not null references public.organizations(id),retention_policy_id uuid not null references public.retention_policies(id),policy_version integer not null,policy_hash text not null check(policy_hash~'^[0-9a-f]{64}$'),target_kind text not null check(target_kind in('USER_PROFILE_DISPLAY_NAME_ONLY','CLIENT_ASSISTANCE_TEXT_ONLY')),legal_approval_reference text not null check(length(btrim(legal_approval_reference))between 8 and 500),created_at timestamptz not null default clock_timestamp());
create table public.privacy_retention_execution_jobs_v1(
 action_request_id uuid primary key references public.admin_operational_action_requests(id),organization_id uuid not null references public.organizations(id),retention_action_id uuid not null unique references public.privacy_retention_actions(id),dsr_id uuid not null references public.data_subject_requests(id),policy_approval_id uuid not null references public.privacy_retention_execution_approvals_v1(id),target_kind text not null,target_manifest_hash text not null check(target_manifest_hash~'^[0-9a-f]{64}$'),status text not null check(status='COMPLETED'),affected_rows integer not null,result_hash text not null check(result_hash~'^[0-9a-f]{64}$'),completed_at timestamptz not null default clock_timestamp());
alter table public.privacy_retention_execution_approvals_v1 enable row level security;
alter table public.privacy_retention_execution_jobs_v1 enable row level security;
revoke all on public.privacy_retention_execution_approvals_v1,public.privacy_retention_execution_jobs_v1 from public,anon,authenticated,service_role;
grant select on public.privacy_retention_execution_approvals_v1,public.privacy_retention_execution_jobs_v1 to authenticated;
create policy retention_execution_approval_read on public.privacy_retention_execution_approvals_v1 for select to authenticated using(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
create policy retention_execution_jobs_read on public.privacy_retention_execution_jobs_v1 for select to authenticated using(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
create trigger retention_execution_approvals_immutable before update or delete on public.privacy_retention_execution_approvals_v1 for each row execute function private.prevent_update_delete();
create trigger retention_execution_jobs_immutable before update or delete on public.privacy_retention_execution_jobs_v1 for each row execute function private.prevent_update_delete();
create function private.retention_policy_execution_hash_v1(p_policy_id uuid)returns text language sql stable security definer set search_path=pg_catalog,public,private as $$
 select private.canonical_request_hash(to_jsonb(p)||jsonb_build_object('category_key',d.category_key,'sensitivity',d.sensitivity))from public.retention_policies p join public.data_categories d on d.id=p.data_category_id where p.id=p_policy_id
$$;
create function private.execute_admin_privacy_retention_v1(p_action_request_id uuid,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype;p public.retention_policies%rowtype;a public.privacy_retention_actions%rowtype;d public.data_subject_requests%rowtype;
 approval public.privacy_retention_execution_approvals_v1%rowtype;target_user uuid;category text;kind text;manifest_hash text;proof text;affected integer:=0;n integer;threshold timestamptz;policy_hash text;
begin
 if auth.role()is distinct from'service_role'then raise exception'PRIVACY_RETENTION_EXECUTION_DENIED'using errcode='42501';end if;
 select*into x from public.admin_operational_action_requests where id=p_action_request_id for update;
 if x.status<>'AUTHORIZED'or x.action_type<>'MANUAL_EXCEPTION'or x.approvals_required<>2 then raise exception'PRIVACY_RETENTION_APPROVAL_REQUIRED'using errcode='42501';end if;
 if not exists(select 1 from public.admin_operational_action_decisions dec where dec.action_request_id=x.id and dec.decision='APPROVE'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],dec.decided_by))then raise exception'PRIVACY_RETENTION_COMPLIANCE_APPROVAL_REQUIRED'using errcode='42501';end if;
 if x.resource_type='PRIVACY_RETENTION_POLICY'then
  select*into p from public.retention_policies where id=(x.redacted_summary->>'policyId')::uuid for share;
  select category_key into category from public.data_categories where id=p.data_category_id;
  kind:=case when category='user-profile'and p.disposition='ANONYMIZE'then'USER_PROFILE_DISPLAY_NAME_ONLY'when category='client-assistance'and p.disposition='PURGE'then'CLIENT_ASSISTANCE_TEXT_ONLY'end;
  if p.id is null or p.organization_id is distinct from x.organization_id or p.status<>'ACTIVE'or p.effective_from>current_date or p.effective_until<current_date or kind is null or length(btrim(coalesce(x.redacted_summary->>'legalApprovalReference','')))not between 8 and 500 then raise exception'PRIVACY_RETENTION_EXECUTION_POLICY_NOT_APPROVED'using errcode='55000';end if;
  policy_hash:=private.retention_policy_execution_hash_v1(p.id);
  if policy_hash is distinct from x.redacted_summary->>'policyHash'then raise exception'STALE_PRIVACY_RETENTION_POLICY'using errcode='40001';end if;
  insert into public.privacy_retention_execution_approvals_v1(action_request_id,organization_id,retention_policy_id,policy_version,policy_hash,target_kind,legal_approval_reference)values(x.id,p.organization_id,p.id,p.version,policy_hash,kind,x.redacted_summary->>'legalApprovalReference')returning*into approval;
  return jsonb_build_object('policy_approval_id',approval.id,'target_kind',kind,'status','APPROVED_FOR_BOUNDED_EXECUTION');
 end if;
 if x.resource_type<>'PRIVACY_RETENTION_ACTION'then raise exception'PRIVACY_RETENTION_RESOURCE_NOT_ALLOWED'using errcode='22023';end if;
 select*into a from public.privacy_retention_actions where id=x.resource_id::uuid for update;
 select*into p from public.retention_policies where id=a.retention_policy_id for share;
 select*into approval from public.privacy_retention_execution_approvals_v1 where id=(x.redacted_summary->>'policyApprovalId')::uuid;
 select*into d from public.data_subject_requests where id=(x.redacted_summary->>'dsrId')::uuid for update;
 target_user:=(x.redacted_summary->>'subjectUserId')::uuid;
 if a.id is null or a.organization_id is distinct from x.organization_id or p.organization_id is distinct from a.organization_id or approval.organization_id is distinct from a.organization_id or approval.retention_policy_id is distinct from p.id or approval.policy_version is distinct from p.version or approval.policy_hash is distinct from private.retention_policy_execution_hash_v1(p.id)or p.status<>'ACTIVE'or p.effective_from>current_date or p.effective_until<current_date or a.action_type<>p.disposition then raise exception'PRIVACY_RETENTION_EXECUTION_POLICY_NOT_APPROVED'using errcode='55000';end if;
 if d.id is null or d.organization_id is distinct from a.organization_id or d.status<>'IN_REVIEW'or d.verified_at is null or d.request_type<>'ERASURE'or d.subject_reference_hash is distinct from a.subject_reference_hash or a.subject_reference_hash is distinct from encode(extensions.digest(convert_to(a.organization_id::text||':'||target_user::text,'UTF8'),'sha256'),'hex')then raise exception'PRIVACY_RETENTION_VERIFIED_SUBJECT_REQUIRED'using errcode='42501';end if;
 lock table public.privacy_legal_holds in share mode;
 if exists(select 1 from public.privacy_legal_holds where organization_id=a.organization_id and subject_reference_hash=a.subject_reference_hash and status='ACTIVE'and(ends_at is null or ends_at>clock_timestamp()))then raise exception'PRIVACY_LEGAL_HOLD_ACTIVE'using errcode='55000';end if;
 if not exists(select 1 from public.organization_memberships where organization_id=a.organization_id and user_id=target_user)then raise exception'PRIVACY_RETENTION_SUBJECT_SCOPE_DENIED'using errcode='42501';end if;
 threshold:=clock_timestamp()-make_interval(days=>p.retention_days);
 if approval.target_kind='USER_PROFILE_DISPLAY_NAME_ONLY'then
  lock table public.organization_memberships,public.platform_user_roles in share mode;
  perform 1 from public.user_profiles where id=target_user for update;
  if exists(select 1 from public.organization_memberships where user_id=target_user and(status in('ACTIVE','INVITED')or organization_id<>a.organization_id))or exists(select 1 from public.platform_user_roles where user_id=target_user and revoked_at is null)or exists(select 1 from public.user_profiles where id=target_user and updated_at>threshold)then raise exception'PRIVACY_RETENTION_PROFILE_STILL_REQUIRED'using errcode='55000';end if;
  perform 1 from public.user_profiles where id=target_user for update;
  manifest_hash:=private.canonical_request_hash(jsonb_build_object('target_kind',approval.target_kind,'subject_user_id',target_user,'organization_id',a.organization_id,'policy_hash',approval.policy_hash));
  update public.user_profiles set display_name='Utilisateur anonymisé',row_version=row_version+1,updated_at=clock_timestamp()where id=target_user;get diagnostics affected=row_count;
 elsif approval.target_kind='CLIENT_ASSISTANCE_TEXT_ONLY'then
  lock table public.client_assistance_messages in share mode;
  perform 1 from public.client_assistance_requests where organization_id=a.organization_id and created_by=target_user for update;
  if exists(select 1 from public.client_assistance_requests r where r.organization_id=a.organization_id and r.created_by=target_user and(r.status<>'CLOSED'or r.updated_at>threshold or exists(select 1 from public.client_assistance_messages m where m.request_id=r.id and m.created_at>threshold)))then raise exception'PRIVACY_RETENTION_ASSISTANCE_STILL_REQUIRED'using errcode='55000';end if;
  perform 1 from public.client_assistance_requests where organization_id=a.organization_id and created_by=target_user for update;
  manifest_hash:=private.canonical_request_hash(jsonb_build_object('target_kind',approval.target_kind,'organization_id',a.organization_id,'subject_user_id',target_user,'policy_hash',approval.policy_hash,'requests',coalesce((select jsonb_agg(id order by id)from public.client_assistance_requests where organization_id=a.organization_id and created_by=target_user),'[]'::jsonb)));
  update public.client_assistance_messages m set body='[Contenu effacé]'from public.client_assistance_requests r where m.request_id=r.id and r.organization_id=a.organization_id and r.created_by=target_user;get diagnostics n=row_count;affected:=affected+n;
  update public.client_assistance_requests set subject='[Contenu effacé]',body='[Contenu effacé]',document_ids='{}',row_version=row_version+1,updated_at=clock_timestamp()where organization_id=a.organization_id and created_by=target_user;get diagnostics n=row_count;affected:=affected+n;
 else raise exception'PRIVACY_RETENTION_TARGET_NOT_ALLOWLISTED'using errcode='22023';end if;
 if affected=0 then raise exception'PRIVACY_RETENTION_NO_TARGET'using errcode='55000';end if;
 proof:=private.canonical_request_hash(jsonb_build_object('action_id',a.id,'manifest_hash',manifest_hash,'target_kind',approval.target_kind,'affected_rows',affected,'preserved',array['AUTH_IDENTITY','FINANCE','CONTRACTS','AUDIT','SHARED_DOCUMENTS']));
 insert into public.privacy_retention_execution_jobs_v1(action_request_id,organization_id,retention_action_id,dsr_id,policy_approval_id,target_kind,target_manifest_hash,status,affected_rows,result_hash)values(x.id,a.organization_id,a.id,d.id,approval.id,approval.target_kind,manifest_hash,'COMPLETED',affected,proof);
 update public.privacy_retention_actions set status='COMPLETED',completed_at=clock_timestamp(),result_summary=jsonb_build_object('scope',approval.target_kind,'affected_rows',affected,'result_hash',proof,'dsr_fulfilled',false,'shared_documents_deleted',false)where id=a.id;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(a.organization_id,'SERVICE','privacy.retention.bounded_executed','privacy_retention_action',a.id::text,p_correlation_id,jsonb_build_object('scope',approval.target_kind,'affected_rows',affected,'result_hash',proof,'dsr_fulfilled',false),repeat('0',64));
 return jsonb_build_object('retention_action_id',a.id,'scope',approval.target_kind,'affected_rows',affected,'result_hash',proof,'dsr_fulfilled',false);
end$$;
revoke all on function private.retention_policy_execution_hash_v1(uuid),private.execute_admin_privacy_retention_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'elsif x.resource_type=''ORGANIZATION''then')=0 then raise exception'ADMIN_EXECUTOR_RETENTION_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'if not private.admin_command_access(x.requested_by)then','perform 1 from public.platform_user_roles where user_id=x.requested_by or user_id in(select decided_by from public.admin_operational_action_decisions where action_request_id=x.id) for share; if not private.admin_command_access(x.requested_by)then');
 definition:=replace(definition,'elsif x.resource_type=''ORGANIZATION''then','elsif x.resource_type in(''PRIVACY_RETENTION_POLICY'',''PRIVACY_RETENTION_ACTION'')then result:=private.execute_admin_privacy_retention_v1(x.id,p_correlation_id); elsif x.resource_type=''ORGANIZATION''then');
 execute definition;
end$$;
create function public.get_admin_retention_execution_console_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'ADMIN_RETENTION_CONSOLE_DENIED'using errcode='42501';end if;
 return jsonb_build_object(
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'organizationId',p.organization_id,'label',o.display_name||' · '||d.category_key||' · v'||p.version,'policyHash',private.retention_policy_execution_hash_v1(p.id)))from public.retention_policies p join public.data_categories d on d.id=p.data_category_id join public.organizations o on o.id=p.organization_id where p.status='ACTIVE'and((d.category_key='user-profile'and p.disposition='ANONYMIZE')or(d.category_key='client-assistance'and p.disposition='PURGE'))),'[]'::jsonb),
 'approvals',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'organizationId',a.organization_id,'label',o.display_name||' · '||a.target_kind||' · v'||a.policy_version))from public.privacy_retention_execution_approvals_v1 a join public.organizations o on o.id=a.organization_id),'[]'::jsonb),
 'actions',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'organizationId',a.organization_id,'label',o.display_name||' · '||a.action_type||' · '||a.status))from public.privacy_retention_actions a join public.organizations o on o.id=a.organization_id where a.status='PENDING'),'[]'::jsonb),
 'dsrs',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'organizationId',d.organization_id,'label',o.display_name||' · '||d.request_type||' · '||d.due_at::date))from public.data_subject_requests d join public.organizations o on o.id=d.organization_id where d.status='IN_REVIEW'and d.verified_at is not null and d.request_type='ERASURE'),'[]'::jsonb),
 'subjects',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'organizationId',m.organization_id,'label',o.display_name||' · '||coalesce(p.display_name,'Utilisateur')||' · '||m.status))from public.organization_memberships m join public.organizations o on o.id=m.organization_id left join public.user_profiles p on p.id=m.user_id),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.action_request_id,'scope',j.target_kind,'status',j.status,'affectedRows',j.affected_rows,'resultHash',j.result_hash,'completedAt',j.completed_at))from public.privacy_retention_execution_jobs_v1 j),'[]'::jsonb));
end$$;
revoke all on function public.get_admin_retention_execution_console_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_admin_retention_execution_console_v1()to authenticated;

notify pgrst,'reload schema';
commit;
