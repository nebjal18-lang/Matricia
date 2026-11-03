begin;
-- Global account changes are distinct from membership changes. Their effects
-- are applied only after an independent, still-authorized MFA approval.
create table public.platform_account_change_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),target_user_id uuid not null references auth.users(id),
 action text not null check(action in('REVOKE_SESSIONS','SUSPEND_ACCOUNT','UNBLOCK_ACCOUNT','GRANT_PLATFORM_ROLE','REVOKE_PLATFORM_ROLE')),
 role_code text references public.role_definitions(code),source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),production_authorization_reference text,
 reason text not null check(length(btrim(reason))between 10 and 2000),request_hash text not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default(clock_timestamp()+interval'24 hours'),idempotency_key text not null,
 unique(created_by,idempotency_key),check((action in('GRANT_PLATFORM_ROLE','REVOKE_PLATFORM_ROLE'))=(role_code is not null)));
create table public.platform_account_change_decisions_v1(
 request_id uuid primary key references public.platform_account_change_requests_v1(id),decision text not null check(decision in('APPROVE','REJECT')),
 reason text not null check(length(btrim(reason))between 10 and 2000),decided_by uuid not null references auth.users(id),
 decided_at timestamptz not null default clock_timestamp(),result jsonb not null);
do $$declare t text;begin foreach t in array array['platform_account_change_requests_v1','platform_account_change_decisions_v1']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',t||'_immutable',t);
end loop;end$$;

create function private.platform_account_access_admin_v1(p_user uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select auth.uid()is not null and auth.jwt()->>'aal'='aal2' and p_user is not null
 and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],p_user)
 and not private.has_platform_role(array['READ_ONLY_AUDITOR'],p_user)
 and exists(select 1 from auth.users where id=p_user and deleted_at is null and(banned_until is null or banned_until<=statement_timestamp()))
$$;
create function private.platform_account_source_hash_v1(p_user uuid)returns text language sql stable security definer set search_path=pg_catalog,public,private,extensions as $$
 select private.canonical_request_hash(jsonb_build_object('user_id',u.id,
 'email_hash',encode(extensions.digest(convert_to(coalesce(u.email,''),'UTF8'),'sha256'),'hex'),
 'email_verified',u.email_confirmed_at is not null,'phone_verified',u.phone_confirmed_at is not null,
 'banned_until',u.banned_until,'deleted_at',u.deleted_at,
 'memberships',(select count(*)from public.organization_memberships where user_id=u.id),
 'platform_roles',coalesce((select jsonb_agg(jsonb_build_object('code',role_code,'granted_at',granted_at)order by role_code)from public.platform_user_roles where user_id=u.id and revoked_at is null),'[]')))
 from auth.users u where u.id=p_user
$$;
revoke all on function private.platform_account_access_admin_v1(uuid),private.platform_account_source_hash_v1(uuid)from public,anon,authenticated,service_role;

-- Native GoTrue suspension revokes refresh and sign-in. These three guards
-- also prevent an unexpired access token from creating a new tenant or from
-- receiving fresh organization/platform privileges while the account is banned.
create function private.require_active_auth_identity_v1(p_user uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$
declare u auth.users%rowtype;begin
 select*into u from auth.users where id=p_user for key share;
 if u.id is null or u.deleted_at is not null or u.banned_until>clock_timestamp()then raise exception'ACCOUNT_PRIVILEGE_GRANT_DENIED'using errcode='42501';end if;
end$$;
create function private.guard_active_auth_identity_grant_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if tg_table_name='organizations'then perform private.require_active_auth_identity_v1(new.created_by);
 elsif tg_table_name='organization_memberships'then
  if new.status='ACTIVE'then perform private.require_active_auth_identity_v1(new.user_id);end if;
 elsif tg_table_name='platform_user_roles'then
  if new.revoked_at is null then perform private.require_active_auth_identity_v1(new.user_id);end if;
 end if;
 return new;
end$$;
revoke all on function private.require_active_auth_identity_v1(uuid),private.guard_active_auth_identity_grant_v1()from public,anon,authenticated,service_role;
create trigger account_active_organization_creation before insert on public.organizations for each row execute function private.guard_active_auth_identity_grant_v1();
create trigger account_active_membership_grant before insert or update on public.organization_memberships for each row execute function private.guard_active_auth_identity_grant_v1();
create trigger account_active_platform_role_grant before insert or update on public.platform_user_roles for each row execute function private.guard_active_auth_identity_grant_v1();

create function public.request_platform_account_change_v1(p_target_user_id uuid,p_action text,p_role_code text,p_expected_source_hash text,p_reason text,p_idempotency_key text,p_application_environment text,p_production_authorization_reference text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.platform_account_change_requests_v1%rowtype;environment text;h text;source text;
begin
 if not private.platform_account_access_admin_v1()or p_target_user_id is not distinct from auth.uid()then raise exception'ACCOUNT_CHANGE_REQUEST_DENIED'using errcode='42501';end if;
 select e.environment into environment from private.admin_execution_environment_v1 e where singleton;
 if environment is null or p_application_environment is distinct from environment then raise exception'ACCOUNT_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
 if p_action is null or p_action not in('REVOKE_SESSIONS','SUSPEND_ACCOUNT','UNBLOCK_ACCOUNT','GRANT_PLATFORM_ROLE','REVOKE_PLATFORM_ROLE')or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200 or p_expected_source_hash is null or p_expected_source_hash!~'^[a-f0-9]{64}$'then raise exception'INVALID_ACCOUNT_CHANGE'using errcode='22023';end if;
 if(environment='PRODUCTION'and length(btrim(coalesce(p_production_authorization_reference,'')))not between 8 and 500)or(environment<>'PRODUCTION'and p_production_authorization_reference is not null)then raise exception'ACCOUNT_PRODUCTION_AUTHORIZATION_REQUIRED'using errcode='42501';end if;
 if(p_action in('GRANT_PLATFORM_ROLE','REVOKE_PLATFORM_ROLE'))is distinct from(p_role_code is not null)or(p_role_code is not null and not exists(select 1 from public.role_definitions where code=p_role_code and scope_type='PLATFORM'))then raise exception'INVALID_PLATFORM_ROLE'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('target',p_target_user_id,'action',p_action,'role',p_role_code,'source_hash',p_expected_source_hash,'reason',btrim(p_reason),'environment',environment,'production_reference',p_production_authorization_reference));
 perform pg_advisory_xact_lock(hashtextextended('platform.account.request:'||auth.uid()::text||':'||p_idempotency_key,0));
 select*into r from public.platform_account_change_requests_v1 where created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if r.id is not null then if r.request_hash<>h then raise exception'IDEMPOTENCY_KEY_REUSED'using errcode='22023';end if;return jsonb_build_object('outcome','ACCOUNT_CHANGE_REQUESTED','request_id',r.id);end if;
 source:=private.platform_account_source_hash_v1(p_target_user_id);
 if source is null or source is distinct from p_expected_source_hash then raise exception'STALE_ACCOUNT_SOURCE'using errcode='40001';end if;
 if p_action in('SUSPEND_ACCOUNT','UNBLOCK_ACCOUNT')and exists(select 1 from public.organization_memberships where user_id=p_target_user_id)then raise exception'ACCOUNT_MEMBERSHIP_REVIEW_REQUIRED'using errcode='55000';end if;
 insert into public.platform_account_change_requests_v1(target_user_id,action,role_code,source_hash,environment,production_authorization_reference,reason,request_hash,created_by,idempotency_key)
 values(p_target_user_id,p_action,p_role_code,p_expected_source_hash,environment,p_production_authorization_reference,btrim(p_reason),h,auth.uid(),p_idempotency_key)returning*into r;
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(auth.uid(),'USER','account.change.requested','user',r.target_user_id::text,r.id,jsonb_build_object('request_id',r.id,'action',r.action,'role_code',r.role_code,'source_hash',r.source_hash),repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('platform_account_change',r.id::text,'PlatformAccountChangeRequestedV1',r.id,jsonb_build_object('request_id',r.id,'target_user_id',r.target_user_id,'action',r.action),p_idempotency_key);
 return jsonb_build_object('outcome','ACCOUNT_CHANGE_REQUESTED','request_id',r.id);
end$$;

create function public.decide_platform_account_change_v1(p_request_id uuid,p_approve boolean,p_expected_source_hash text,p_reason text,p_application_environment text,p_expected_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.platform_account_change_requests_v1%rowtype;d public.platform_account_change_decisions_v1%rowtype;environment text;u auth.users%rowtype;result jsonb;revoked_sessions integer:=0;roles_changed integer:=0;
begin
 if not private.platform_account_access_admin_v1()then raise exception'ACCOUNT_CHANGE_REVIEW_DENIED'using errcode='42501';end if;
 select*into r from public.platform_account_change_requests_v1 where id=p_request_id for update;
 if r.id is null or r.created_by=auth.uid()or r.target_user_id=auth.uid()or not private.platform_account_access_admin_v1()or not private.platform_account_access_admin_v1(r.created_by)then raise exception'ACCOUNT_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 select e.environment into environment from private.admin_execution_environment_v1 e where singleton;
 if environment is null or p_application_environment is distinct from environment or r.environment is distinct from environment then raise exception'ACCOUNT_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
 if p_approve is null or p_expected_target_user_id is distinct from r.target_user_id or p_expected_source_hash is distinct from r.source_hash or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_ACCOUNT_REVIEW'using errcode='22023';end if;
 select*into d from public.platform_account_change_decisions_v1 where request_id=r.id;
 if d.request_id is not null then if d.decided_by<>auth.uid()or d.decision is distinct from(case when p_approve then'APPROVE'else'REJECT'end)or d.reason<>btrim(p_reason)then raise exception'ACCOUNT_CHANGE_ALREADY_DECIDED'using errcode='55000';end if;return d.result;end if;
 if r.expires_at<=clock_timestamp()then raise exception'ACCOUNT_CHANGE_EXPIRED'using errcode='55000';end if;
  -- Serialize changes that could remove the last recoverable Super Admin.
  perform pg_advisory_xact_lock(hashtextextended('platform.account.access',0));
  select e.environment into environment from private.admin_execution_environment_v1 e where singleton for share;
  if environment is null or environment is distinct from r.environment or environment is distinct from p_application_environment then raise exception'ACCOUNT_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
  perform id from auth.users where id in(auth.uid(),r.created_by)order by id for share;
  -- Waiters must re-read authority after the serialized security change.
  if r.expires_at<=clock_timestamp()then raise exception'ACCOUNT_CHANGE_EXPIRED'using errcode='55000';end if;
  if not private.platform_account_access_admin_v1()or not private.platform_account_access_admin_v1(r.created_by)or r.target_user_id=auth.uid()then raise exception'ACCOUNT_CHANGE_REVIEW_DENIED'using errcode='42501';end if;
 if p_approve then
  select*into u from auth.users where id=r.target_user_id for update;
  if not private.platform_account_access_admin_v1()or not private.platform_account_access_admin_v1(r.created_by)then raise exception'ACCOUNT_CHANGE_REVIEW_DENIED'using errcode='42501';end if;
  if u.id is null or u.deleted_at is not null or private.platform_account_source_hash_v1(u.id)is distinct from r.source_hash then raise exception'STALE_ACCOUNT_SOURCE'using errcode='40001';end if;
  if r.action in('SUSPEND_ACCOUNT','UNBLOCK_ACCOUNT')and exists(select 1 from public.organization_memberships where user_id=u.id)then raise exception'ACCOUNT_MEMBERSHIP_REVIEW_REQUIRED'using errcode='55000';end if;
  if(r.action in('GRANT_PLATFORM_ROLE','REVOKE_PLATFORM_ROLE')or(r.action='SUSPEND_ACCOUNT'and exists(select 1 from public.platform_user_roles where user_id=u.id and revoked_at is null))or exists(select 1 from public.platform_user_roles where user_id=u.id and role_code='SUPER_ADMIN'and revoked_at is null))and not(private.has_platform_role(array['SUPER_ADMIN'],r.created_by)or private.has_platform_role(array['SUPER_ADMIN']))then raise exception'ACCOUNT_SUPER_ADMIN_APPROVAL_REQUIRED'using errcode='42501';end if;
  if(r.action='SUSPEND_ACCOUNT'or(r.action='REVOKE_PLATFORM_ROLE'and r.role_code='SUPER_ADMIN'))and exists(select 1 from public.platform_user_roles where user_id=u.id and role_code='SUPER_ADMIN'and revoked_at is null)and not exists(select 1 from public.platform_user_roles s join auth.users a on a.id=s.user_id where s.role_code='SUPER_ADMIN'and s.revoked_at is null and s.user_id<>u.id and a.deleted_at is null and(a.banned_until is null or a.banned_until<=clock_timestamp())and(a.email_confirmed_at is not null or a.phone_confirmed_at is not null))then raise exception'LAST_SUPER_ADMIN_REQUIRED'using errcode='42501';end if;
  if r.action in('REVOKE_SESSIONS','SUSPEND_ACCOUNT')then delete from auth.sessions where user_id=u.id;get diagnostics revoked_sessions=row_count;end if;
  if r.action='SUSPEND_ACCOUNT'then
   update auth.users set banned_until=clock_timestamp()+interval'100 years',updated_at=clock_timestamp()where id=u.id;
   update public.platform_user_roles set revoked_at=clock_timestamp()where user_id=u.id and revoked_at is null;get diagnostics roles_changed=row_count;
  elsif r.action='UNBLOCK_ACCOUNT'then update auth.users set banned_until=null,updated_at=clock_timestamp()where id=u.id;
  elsif r.action='GRANT_PLATFORM_ROLE'then
   perform private.require_active_auth_identity_v1(u.id);
   if u.email_confirmed_at is null and u.phone_confirmed_at is null then raise exception'ACCOUNT_VERIFIED_IDENTITY_REQUIRED'using errcode='42501';end if;
   insert into public.platform_user_roles(user_id,role_code,granted_by)values(u.id,r.role_code,auth.uid())on conflict(user_id,role_code)do update set granted_by=excluded.granted_by,granted_at=clock_timestamp(),revoked_at=null;get diagnostics roles_changed=row_count;
  elsif r.action='REVOKE_PLATFORM_ROLE'then update public.platform_user_roles set revoked_at=clock_timestamp()where user_id=u.id and role_code=r.role_code and revoked_at is null;get diagnostics roles_changed=row_count;
  end if;
 end if;
 result:=jsonb_build_object('outcome',case when p_approve then'ACCOUNT_CHANGE_EXECUTED'else'ACCOUNT_CHANGE_REJECTED'end,'request_id',r.id,'target_user_id',r.target_user_id,'action',r.action,'sessions_revoked',revoked_sessions,'roles_changed',roles_changed,'roles_restored_on_unblock',false);
 insert into public.platform_account_change_decisions_v1(request_id,decision,reason,decided_by,result)values(r.id,case when p_approve then'APPROVE'else'REJECT'end,btrim(p_reason),auth.uid(),result);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(auth.uid(),'USER','account.change.decided','user',r.target_user_id::text,r.id,result||jsonb_build_object('approved',p_approve),repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('platform_account_change',r.id::text,case when p_approve then'PlatformAccountAccessChangedV1'else'PlatformAccountChangeRejectedV1'end,r.id,result,'account-change-'||r.id::text);
 return result;
end$$;

create function public.get_admin_account_access_v1(p_user_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare u auth.users%rowtype;requests jsonb;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'])then raise exception'ACCOUNT_ACCESS_READ_DENIED'using errcode='42501';end if;
 select*into u from auth.users where id=p_user_id;
 if u.id is null then raise exception'ACCOUNT_NOT_FOUND'using errcode='P0002';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'action',r.action,'role_code',r.role_code,'source_hash',r.source_hash,'created_by',r.created_by,'created_at',r.created_at,'expires_at',r.expires_at,'expired',r.expires_at<=statement_timestamp(),'reason',r.reason,'decision',d.decision,'result',d.result)order by r.created_at desc,r.id),'[]')into requests from public.platform_account_change_requests_v1 r left join public.platform_account_change_decisions_v1 d on d.request_id=r.id where r.target_user_id=u.id;
 if jsonb_array_length(requests)>10000 or octet_length(requests::text)>12000000 then raise exception'ACCOUNT_ACCESS_HISTORY_BUDGET_EXCEEDED'using errcode='54000';end if;
 return jsonb_build_object('user_id',u.id,'source_hash',private.platform_account_source_hash_v1(u.id),'can_request',private.platform_account_access_admin_v1()and u.id<>auth.uid(),'current_user_id',auth.uid(),'orphan',not exists(select 1 from public.organization_memberships where user_id=u.id),'suspended',u.banned_until>clock_timestamp(),'deleted',u.deleted_at is not null,'roles',coalesce((select jsonb_agg(role_code order by role_code)from public.platform_user_roles where user_id=u.id and revoked_at is null),'[]'),'available_roles',(select jsonb_agg(jsonb_build_object('code',code,'label_fr',label_fr,'label_ar',label_ar)order by code)from public.role_definitions where scope_type='PLATFORM'),'requests',requests);
end$$;
create function public.list_platform_account_change_reviews_v1(p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare rows jsonb;total bigint;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'])then raise exception'ACCOUNT_ACCESS_READ_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_PAGE'using errcode='22023';end if;
 select count(*)into total from public.platform_account_change_requests_v1 r where not exists(select 1 from public.platform_account_change_decisions_v1 where request_id=r.id)and r.expires_at>clock_timestamp();
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.target_user_id,'action',r.action,'role_code',r.role_code,'created_at',r.created_at,'created_by',r.created_by,'reason',r.reason)order by r.created_at,r.id),'[]')into rows from(select*from public.platform_account_change_requests_v1 x where not exists(select 1 from public.platform_account_change_decisions_v1 where request_id=x.id)and x.expires_at>clock_timestamp()order by x.created_at,x.id limit 25 offset((p_page-1)*25))r;
 return jsonb_build_object('rows',rows,'page',p_page,'has_next',p_page::bigint*25<total,'total',total);
end$$;
do $$declare f regprocedure;begin foreach f in array array['public.request_platform_account_change_v1(uuid,text,text,text,text,text,text,text)'::regprocedure,'public.decide_platform_account_change_v1(uuid,boolean,text,text,text,uuid)'::regprocedure,'public.get_admin_account_access_v1(uuid)'::regprocedure,'public.list_platform_account_change_reviews_v1(integer)'::regprocedure]loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);execute format('grant execute on function %s to authenticated',f);
end loop;end$$;
notify pgrst,'reload schema';
commit;
