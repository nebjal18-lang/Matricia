begin;
create table public.admin_consultation_proposals_v1(
 id uuid primary key default extensions.gen_random_uuid(),action_request_id uuid not null unique references public.admin_operational_action_requests(id),organization_id uuid not null references public.organizations(id),request_id uuid not null references public.service_requests(id),matching_run_id uuid not null references public.matching_runs(id),provider_ids uuid[]not null,note text not null,context text not null,due_at date,status text not null check(status in('DRAFT','PENDING_CLIENT_DECISION')),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
alter table public.admin_consultation_proposals_v1 enable row level security;
revoke all on public.admin_consultation_proposals_v1 from public,anon,authenticated,service_role;
grant select on public.admin_consultation_proposals_v1 to authenticated;
create policy admin_consultation_proposals_read on public.admin_consultation_proposals_v1 for select to authenticated using(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())or(status='PENDING_CLIENT_DECISION'and auth.jwt()->>'aal'='aal2'and private.has_org_role(organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'],auth.uid())));
create function public.list_my_admin_consultation_proposals_v1(p_request_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare o uuid;
begin
 select client_organization_id into o from public.service_requests where id=p_request_id;
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(o,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'],auth.uid())then raise exception'CLIENT_CONSULTATION_PROPOSALS_DENIED'using errcode='42501';end if;
 return jsonb_build_object('proposals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'note',p.note,'context',p.context,'due_at',p.due_at,'provider_ids',p.provider_ids,'status',case when exists(select 1 from public.rfqs r where r.matching_run_id=p.matching_run_id and r.request_id=p.request_id)then'RFQ_OPENED'else p.status end)order by p.created_at desc)from public.admin_consultation_proposals_v1 p where p.request_id=p_request_id and p.status='PENDING_CLIENT_DECISION'),'[]'::jsonb));
end$$;
revoke all on function public.list_my_admin_consultation_proposals_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.list_my_admin_consultation_proposals_v1(uuid)to authenticated;
create table public.admin_membership_capability_reviews_v1(
 action_request_id uuid primary key references public.admin_operational_action_requests(id),membership_id uuid not null references public.organization_memberships(id),requested_capabilities text[]not null,status text not null default'PENDING_POLICY_REVIEW'check(status in('PENDING_POLICY_REVIEW','REVIEWED')),created_at timestamptz not null default clock_timestamp());
alter table public.admin_membership_capability_reviews_v1 enable row level security;
revoke all on public.admin_membership_capability_reviews_v1 from public,anon,authenticated,service_role;
grant select on public.admin_membership_capability_reviews_v1 to authenticated;
create policy admin_membership_capability_reviews_read on public.admin_membership_capability_reviews_v1 for select to authenticated using(private.admin_command_access(auth.uid())or private.has_platform_role(array['READ_ONLY_AUDITOR'],auth.uid()));
create or replace function public.execute_admin_operational_action_v1(p_action_request_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype; payload jsonb; org public.organizations%rowtype;
 member public.organization_memberships%rowtype; result jsonb; result_hash text; target uuid; new_role text; approvals integer; invitation uuid; invited_user uuid; invited_email text; matching public.matching_runs%rowtype; selected_providers uuid[];proposal uuid; failure_code text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'ADMIN_ACTION_EXECUTION_DENIED' using errcode='42501';end if;
 select * into x from public.admin_operational_action_requests where id=p_action_request_id for update;
 if not found then raise exception 'ADMIN_ACTION_NOT_FOUND' using errcode='P0002';end if;
 if x.target_environment is distinct from(select environment from private.admin_execution_environment_v1 where singleton)then raise exception'ADMIN_DEPLOYMENT_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
 if not exists(select 1 from private.admin_execution_environment_v1 where singleton and environment is not null)then raise exception'ADMIN_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED'using errcode='55000';end if;
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
  if jsonb_array_length(coalesce(payload->'capabilities','[]'))>0 then
   insert into public.admin_membership_capability_reviews_v1(action_request_id,membership_id,requested_capabilities)values(x.id,member.id,array(select jsonb_array_elements_text(payload->'capabilities')));
   insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)
   select id,x.organization_id,'MANUAL_REVIEW','membership_capability_review',x.id::text,'Revoir les capacités demandées pour ce rôle','مراجعة القدرات المطلوبة لهذا الدور','MEDIUM',clock_timestamp()+interval'1 day',jsonb_build_object('membership_id',member.id,'action_request_id',x.id,'effective_access','ROLE_RLS'),x.requested_by from public.admin_queue_versions where queue_key='CENTRAL_APPROVALS'and status='ACTIVE';
  end if;
  result:=jsonb_build_object('membership_id',member.id,'effective_access','ROLE_RLS','capability_review_pending',jsonb_array_length(coalesce(payload->'capabilities','[]'))>0);
 elsif x.resource_type='MATCHING'and payload->>'view'='consultation'then
  select*into matching from public.matching_runs where id=x.resource_id::uuid;
  if matching.id is null or not exists(select 1 from public.service_requests where id=matching.request_id and client_organization_id=x.organization_id)then raise exception'ADMIN_CONSULTATION_SCOPE_DENIED'using errcode='42501';end if;
  select coalesce(array_agg(distinct v::uuid),'{}')into selected_providers from jsonb_array_elements_text(coalesce(payload->'providerIds','[]'))v;
  if exists(select 1 from unnest(selected_providers)p where not exists(select 1 from public.matching_candidates where matching_run_id=matching.id and provider_organization_id=p and eligible))or(length(coalesce(payload->>'note',''))not between 3 and 2000)or length(coalesce(payload->>'context',''))>10000 or coalesce(payload->>'channel','platform')<>'platform' then raise exception'INVALID_ADMIN_CONSULTATION_PROPOSAL'using errcode='22023';end if;
  if payload->>'decision'in('SEND','SUBMIT')and cardinality(selected_providers)=0 then raise exception'ADMIN_CONSULTATION_CANDIDATES_REQUIRED'using errcode='22023';end if;
  insert into public.admin_consultation_proposals_v1(action_request_id,organization_id,request_id,matching_run_id,provider_ids,note,context,due_at,status,created_by)
  values(x.id,x.organization_id,matching.request_id,matching.id,selected_providers,payload->>'note',coalesce(payload->>'context',''),nullif(payload->>'dueAt','')::date,case when payload->>'decision'in('SEND','SUBMIT')then'PENDING_CLIENT_DECISION'else'DRAFT'end,x.requested_by)returning id into proposal;
  result:=jsonb_build_object('proposal_id',proposal,'status',case when payload->>'decision'in('SEND','SUBMIT')then'PENDING_CLIENT_DECISION'else'DRAFT'end,'rfq_opened',false);
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
