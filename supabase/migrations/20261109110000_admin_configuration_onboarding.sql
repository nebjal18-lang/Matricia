begin;

-- Platform configuration is global to this database's trusted deployment. All
-- credentials are opaque authenticated ciphertext, never public profile data.
create table private.admin_configuration_revisions_v1 (
 id uuid primary key,
 environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 section text not null check(section in('COMPANY','RESEND','PAYPAL','YOUSIGN','SCANNER')),
 settings jsonb not null check(jsonb_typeof(settings)='object'),
 encrypted_secrets text not null,
 secret_keys text[] not null,
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 expected_active_id uuid references private.admin_configuration_revisions_v1(id),
 status text not null default 'DRAFT' check(status in('DRAFT','ACTIVE','REJECTED','RETIRED')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 retired_at timestamptz,
 check((section='COMPANY' and encrypted_secrets='' and cardinality(secret_keys)=0)
   or(section<>'COMPANY' and encrypted_secrets~'^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' and length(encrypted_secrets)<=100000 and cardinality(secret_keys)>0)),
 check(status<>'ACTIVE' or(approved_by is not null and approved_at is not null and approved_by<>created_by))
);
create unique index admin_configuration_single_active_v1 on private.admin_configuration_revisions_v1(environment,section) where status='ACTIVE';
create index admin_configuration_recent_v1 on private.admin_configuration_revisions_v1(environment,section,created_at desc,id);

create table private.admin_configuration_probe_leases_v1 (
 token_hash text primary key check(token_hash~'^[a-f0-9]{64}$'),
 revision_id uuid not null references private.admin_configuration_revisions_v1(id),
 content_hash text not null,
 actor_user_id uuid not null references auth.users(id),
 actor_session_id uuid,
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 check(expires_at>issued_at and expires_at<=issued_at+interval '2 minutes')
);
create table private.admin_configuration_probe_results_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 revision_id uuid not null references private.admin_configuration_revisions_v1(id),
 content_hash text not null,
 environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 status text not null check(status in('PASS','FAIL')),
 code text not null,
 checked_at timestamptz not null default clock_timestamp(),
 valid_until timestamptz not null,
 requested_by uuid not null references auth.users(id),
 check(valid_until>checked_at and valid_until<=checked_at+interval '24 hours')
);
create index admin_configuration_probe_latest_v1 on private.admin_configuration_probe_results_v1(revision_id,checked_at desc,id);
revoke all on private.admin_configuration_revisions_v1,private.admin_configuration_probe_leases_v1,private.admin_configuration_probe_results_v1 from public,anon,authenticated,service_role;
alter table private.admin_configuration_revisions_v1 enable row level security;
alter table private.admin_configuration_probe_leases_v1 enable row level security;
alter table private.admin_configuration_probe_results_v1 enable row level security;

create function private.admin_configuration_environment_v1() returns text
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare e text;begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null
  or auth.jwt()->>'aal' is distinct from 'aal2'
  or not private.current_auth_session_active_v1()
  or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],auth.uid()) then
  raise exception 'CONFIGURATION_ADMIN_AAL2_REQUIRED' using errcode='42501';
 end if;
 select environment into e from private.admin_execution_environment_v1 where singleton;
 if e is null then raise exception 'CONFIGURATION_ENVIRONMENT_UNCONFIGURED' using errcode='55000';end if;
 return e;
end$$;

create function private.admin_configuration_payload_immutable_v1() returns trigger
language plpgsql set search_path=pg_catalog as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-array['status','approved_by','approved_at','retired_at']) is distinct from (to_jsonb(old)-array['status','approved_by','approved_at','retired_at']) then
  raise exception 'IMMUTABLE_CONFIGURATION_REVISION' using errcode='55000';
 end if;
 return new;
end$$;
create trigger admin_configuration_payload_immutable_v1 before update or delete on private.admin_configuration_revisions_v1 for each row execute function private.admin_configuration_payload_immutable_v1();
create trigger admin_configuration_probe_results_immutable_v1 before update or delete on private.admin_configuration_probe_results_v1 for each row execute function private.prevent_admin_history_change();

create function private.admin_configuration_validate_payload_v1(p_section text,p_settings jsonb,p_secret_keys text[]) returns void
language plpgsql immutable set search_path=pg_catalog as $$
declare settings_allowed text[];secrets_required text[];k text;v jsonb;begin
 case p_section
 when 'COMPANY' then settings_allowed:=array['legalName','displayName','ice','rc','ifNumber','address','city','country','currency','supportEmail','supportPhone','websiteUrl','defaultLocale','timezone'];secrets_required:='{}';
 when 'RESEND' then settings_allowed:=array['RESEND_FROM_EMAIL','RESEND_FROM_NAME','EMAIL_RECIPIENT_ALLOWLIST'];secrets_required:=array['RESEND_API_KEY','RESEND_WEBHOOK_SECRET'];
 when 'PAYPAL' then settings_allowed:=array['PAYPAL_ENV','PAYPAL_CLIENT_ID','PAYPAL_WEBHOOK_ID','PAYPAL_WEBHOOK_CERT_URL','PAYPAL_ALLOWED_CURRENCIES'];secrets_required:=array['PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64'];
 when 'YOUSIGN' then settings_allowed:=array['YOUSIGN_ENVIRONMENT','YOUSIGN_WORKSPACE_ID'];secrets_required:=array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'];
 when 'SCANNER' then settings_allowed:=array['MALWARE_SCANNER_URL','MALWARE_SCANNER_ALLOWED_HOSTS'];secrets_required:=array['MALWARE_SCANNER_TOKEN'];
 else raise exception 'CONFIGURATION_SECTION_INVALID' using errcode='22023';end case;
 if p_settings is null or jsonb_typeof(p_settings)<>'object' or octet_length(p_settings::text)>32768 or p_secret_keys is null
  or cardinality(p_secret_keys)<>cardinality(secrets_required) or not p_secret_keys@>secrets_required or not p_secret_keys<@secrets_required then
  raise exception 'CONFIGURATION_PAYLOAD_INVALID' using errcode='22023';end if;
 for k,v in select * from jsonb_each(p_settings)loop
  if not k=any(settings_allowed) or jsonb_typeof(v)<>'string' or length(v#>>'{}')>4096 or (v#>>'{}')~'[\x00-\x08\x0B\x0C\x0E-\x1F]' then
   raise exception 'CONFIGURATION_SETTINGS_INVALID' using errcode='22023';end if;
 end loop;
 if p_section='COMPANY' and (length(btrim(coalesce(p_settings->>'legalName','')))<2 or length(btrim(coalesce(p_settings->>'displayName','')))<2 or coalesce(p_settings->>'currency','')!~'^[A-Z]{3}$' or coalesce(p_settings->>'supportEmail','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
  raise exception 'CONFIGURATION_COMPANY_INCOMPLETE' using errcode='22023';end if;
 if p_section='PAYPAL' and coalesce(p_settings->>'PAYPAL_ENV','') not in('sandbox','live') then raise exception 'CONFIGURATION_PROVIDER_ENVIRONMENT_INVALID' using errcode='22023';end if;
 if p_section='YOUSIGN' and coalesce(p_settings->>'YOUSIGN_ENVIRONMENT','') not in('sandbox','live') then raise exception 'CONFIGURATION_PROVIDER_ENVIRONMENT_INVALID' using errcode='22023';end if;
end$$;

create function public.save_admin_configuration_v1(p_revision_id uuid,p_section text,p_settings jsonb,p_encrypted_secrets text,p_secret_keys text[],p_expected_active_id uuid,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare e text:=private.admin_configuration_environment_v1();a uuid:=auth.uid();h text;r jsonb;active_id uuid;begin
 perform private.admin_configuration_validate_payload_v1(p_section,p_settings,p_secret_keys);
 if p_revision_id is null or p_encrypted_secrets is null then raise exception 'CONFIGURATION_PAYLOAD_INVALID' using errcode='22023';end if;
 if (p_section='PAYPAL' and (p_settings->>'PAYPAL_ENV') is distinct from case when e='PRODUCTION' then 'live' else 'sandbox' end)
  or(p_section='YOUSIGN' and (p_settings->>'YOUSIGN_ENVIRONMENT') is distinct from case when e='PRODUCTION' then 'live' else 'sandbox' end) then
  raise exception 'CONFIGURATION_PROVIDER_ENVIRONMENT_MISMATCH' using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('id',p_revision_id,'environment',e,'section',p_section,'settings',p_settings,'encrypted_secrets',p_encrypted_secrets,'secret_keys',p_secret_keys,'expected_active_id',p_expected_active_id));
 r:=private.begin_admin_command('configuration.save',p_idempotency_key,h,a);if r is not null then return r;end if;
 perform pg_advisory_xact_lock(hashtextextended('configuration:'||e||':'||p_section,0));
 if private.admin_configuration_environment_v1()is distinct from e then raise exception 'CONFIGURATION_ENVIRONMENT_CHANGED'using errcode='40001';end if;
 select id into active_id from private.admin_configuration_revisions_v1 where environment=e and section=p_section and status='ACTIVE';
 if active_id is distinct from p_expected_active_id then raise exception 'CONFIGURATION_ACTIVE_CHANGED' using errcode='40001';end if;
 insert into private.admin_configuration_revisions_v1(id,environment,section,settings,encrypted_secrets,secret_keys,content_hash,expected_active_id,created_by)
 values(p_revision_id,e,p_section,p_settings,p_encrypted_secrets,p_secret_keys,h,p_expected_active_id,a);
 r:=jsonb_build_object('outcome','CONFIGURATION_SAVED','revision_id',p_revision_id,'content_hash',h);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(a,'USER','configuration.revision.created','platform_configuration',p_revision_id::text,extensions.gen_random_uuid(),jsonb_build_object('section',p_section,'environment',e,'content_hash',h),repeat('0',64));
 perform private.finish_admin_command('configuration.save',p_idempotency_key,a,r);return r;
end$$;

create function public.get_admin_configuration_v1() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare e text:=private.admin_configuration_environment_v1();sections jsonb;begin
 select jsonb_agg(jsonb_build_object('section',section_name,'active_revision_id',(select id from private.admin_configuration_revisions_v1 where environment=e and section=section_name and status='ACTIVE'),
 'latest_revision_id',(select id from private.admin_configuration_revisions_v1 where environment=e and section=section_name order by created_at desc,id desc limit 1),
 'revisions',coalesce((select jsonb_agg(row_data order by created_at desc,id desc)from(select r.id,r.created_at,jsonb_build_object('id',r.id,'section',r.section,'environment',r.environment,'settings',r.settings,'secret_keys',r.secret_keys,'content_hash',r.content_hash,'status',r.status,'created_by',r.created_by,'created_at',r.created_at,'approved_by',r.approved_by,'approved_at',r.approved_at,
 'probe',(select jsonb_build_object('status',p.status,'code',p.code,'checked_at',p.checked_at,'valid_until',p.valid_until)from private.admin_configuration_probe_results_v1 p where p.revision_id=r.id and p.content_hash=r.content_hash order by checked_at desc,p.id desc limit 1))row_data
 from private.admin_configuration_revisions_v1 r where r.environment=e and r.section=section_name and(r.status='ACTIVE' or r.id in(select newest.id from private.admin_configuration_revisions_v1 newest where newest.environment=e and newest.section=section_name order by newest.created_at desc,newest.id desc limit 10)))recent),'[]'::jsonb)) order by ordinal)
 into sections from unnest(array['COMPANY','RESEND','PAYPAL','YOUSIGN','SCANNER'])with ordinality as s(section_name,ordinal);
 return jsonb_build_object('environment',e,'actor_id',auth.uid(),'can_write',true,'sections',sections);
end$$;

create function public.start_admin_configuration_probe_v1(p_revision_id uuid,p_expected_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare e text:=private.admin_configuration_environment_v1();r private.admin_configuration_revisions_v1%rowtype;t uuid:=extensions.gen_random_uuid();issued timestamptz:=clock_timestamp();session_id uuid;begin
 select * into r from private.admin_configuration_revisions_v1 where id=p_revision_id and environment=e and status in('DRAFT','ACTIVE');
 if r.id is null or r.content_hash is distinct from p_expected_hash then raise exception 'CONFIGURATION_REVISION_STALE' using errcode='40001';end if;
 session_id:=nullif(auth.jwt()->>'session_id','')::uuid;
 insert into private.admin_configuration_probe_leases_v1(token_hash,revision_id,content_hash,actor_user_id,actor_session_id,issued_at,expires_at)
 values(private.canonical_request_hash(to_jsonb(t::text)),r.id,r.content_hash,auth.uid(),session_id,issued,issued+interval '2 minutes');
 return jsonb_build_object('probe_token',t,'expires_at',issued+interval '2 minutes');
end$$;

create function private.admin_configuration_probe_authority_v1(p_lease private.admin_configuration_probe_leases_v1) returns boolean
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p_lease.expires_at>clock_timestamp() and p_lease.consumed_at is null
 and exists(select 1 from auth.users u where u.id=p_lease.actor_user_id and u.deleted_at is null and(u.banned_until is null or u.banned_until<=clock_timestamp()))
 and exists(select 1 from public.platform_user_roles role where role.user_id=p_lease.actor_user_id and role.role_code in('SUPER_ADMIN','MATRICIA_ADMIN') and role.revoked_at is null)
 and(p_lease.actor_session_id is null or exists(select 1 from auth.sessions s where s.id=p_lease.actor_session_id and s.user_id=p_lease.actor_user_id and s.aal='aal2' and(s.not_after is null or s.not_after>clock_timestamp())))
$$;

create function public.load_admin_configuration_probe_v1(p_probe_token uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare l private.admin_configuration_probe_leases_v1%rowtype;r private.admin_configuration_revisions_v1%rowtype;e text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'CONFIGURATION_SERVICE_REQUIRED' using errcode='42501';end if;
 select * into l from private.admin_configuration_probe_leases_v1 where token_hash=private.canonical_request_hash(to_jsonb(p_probe_token::text));
 select environment into e from private.admin_execution_environment_v1 where singleton;
 if l.token_hash is null or not private.admin_configuration_probe_authority_v1(l) then raise exception 'CONFIGURATION_PROBE_LEASE_INVALID' using errcode='42501';end if;
 select * into r from private.admin_configuration_revisions_v1 where id=l.revision_id and content_hash=l.content_hash and environment=e and status in('DRAFT','ACTIVE');
 if r.id is null then raise exception 'CONFIGURATION_REVISION_STALE' using errcode='40001';end if;
 return jsonb_build_object('id',r.id,'section',r.section,'environment',r.environment,'settings',r.settings,'encrypted_secrets',r.encrypted_secrets,'secret_keys',r.secret_keys,'content_hash',r.content_hash);
end$$;

create function public.record_admin_configuration_probe_v1(p_probe_token uuid,p_status text,p_code text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare l private.admin_configuration_probe_leases_v1%rowtype;r private.admin_configuration_revisions_v1%rowtype;e text;checked timestamptz:=clock_timestamp();expected_code text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'CONFIGURATION_SERVICE_REQUIRED' using errcode='42501';end if;
 select * into l from private.admin_configuration_probe_leases_v1 where token_hash=private.canonical_request_hash(to_jsonb(p_probe_token::text)) for update;
 select environment into e from private.admin_execution_environment_v1 where singleton;
 if l.token_hash is null or not private.admin_configuration_probe_authority_v1(l) then raise exception 'CONFIGURATION_PROBE_LEASE_INVALID' using errcode='42501';end if;
 select * into r from private.admin_configuration_revisions_v1 where id=l.revision_id and content_hash=l.content_hash and environment=e and status in('DRAFT','ACTIVE');
 if r.id is null then raise exception 'CONFIGURATION_REVISION_STALE' using errcode='40001';end if;
 expected_code:=case r.section when 'COMPANY' then 'COMPANY_VALIDATED' when 'RESEND' then 'RESEND_DOMAIN_VERIFIED' when 'PAYPAL' then 'PAYPAL_CREDENTIALS_VALID' when 'YOUSIGN' then 'YOUSIGN_CREDENTIALS_VALID' when 'SCANNER' then 'SCANNER_READY' end;
 if p_status is null or p_status not in('PASS','FAIL') or(p_status='PASS' and p_code is distinct from expected_code)
  or(p_status='FAIL' and(p_code is null or p_code not in('CONFIGURATION_INVALID','PROVIDER_UNAVAILABLE','PROVIDER_REJECTED','RESEND_DOMAIN_UNVERIFIED','SCANNER_HOST_NOT_ALLOWED','SCANNER_NOT_READY','PROVIDER_RESPONSE_INVALID','PAYPAL_CERTIFICATE_UNAVAILABLE','PAYPAL_CERTIFICATE_MISMATCH','PAYPAL_CERTIFICATE_INVALID','PROVIDER_ENVIRONMENT_MISMATCH')))then
  raise exception 'CONFIGURATION_PROBE_RESULT_INVALID' using errcode='22023';end if;
 insert into private.admin_configuration_probe_results_v1(revision_id,content_hash,environment,status,code,checked_at,valid_until,requested_by)
 values(r.id,r.content_hash,e,p_status,p_code,checked,checked+interval '24 hours',l.actor_user_id);
 update private.admin_configuration_probe_leases_v1 set consumed_at=checked where token_hash=l.token_hash;
 return jsonb_build_object('outcome','CONFIGURATION_PROBE_RECORDED','revision_id',r.id,'status',p_status,'code',p_code,'checked_at',checked,'valid_until',checked+interval '24 hours');
end$$;

create function public.approve_admin_configuration_v1(p_revision_id uuid,p_expected_hash text,p_approve boolean,p_reason text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare e text:=private.admin_configuration_environment_v1();a uuid:=auth.uid();r private.admin_configuration_revisions_v1%rowtype;h text;result jsonb;active_id uuid;latest_id uuid;probe private.admin_configuration_probe_results_v1%rowtype;correlation uuid:=extensions.gen_random_uuid();begin
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception 'CONFIGURATION_DECISION_INVALID' using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('id',p_revision_id,'hash',p_expected_hash,'approve',p_approve,'reason',p_reason,'environment',e));
 result:=private.begin_admin_command('configuration.decide',p_idempotency_key,h,a);if result is not null then return result;end if;
 select * into r from private.admin_configuration_revisions_v1 where id=p_revision_id and environment=e;
 if r.id is null or r.content_hash is distinct from p_expected_hash then raise exception 'CONFIGURATION_REVISION_STALE' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended('configuration:'||e||':'||r.section,0));
 if private.admin_configuration_environment_v1()is distinct from e then raise exception 'CONFIGURATION_ENVIRONMENT_CHANGED'using errcode='40001';end if;
 select * into r from private.admin_configuration_revisions_v1 where id=p_revision_id for update;
 if r.status<>'DRAFT' then raise exception 'CONFIGURATION_REVISION_STALE' using errcode='40001';end if;
 if r.created_by=a then raise exception 'CONFIGURATION_INDEPENDENT_REVIEW_REQUIRED' using errcode='42501';end if;
 if p_approve then
  select id into latest_id from private.admin_configuration_revisions_v1 where environment=e and section=r.section order by created_at desc,id desc limit 1;
  select id into active_id from private.admin_configuration_revisions_v1 where environment=e and section=r.section and status='ACTIVE';
  if latest_id<>r.id or active_id is distinct from r.expected_active_id then raise exception 'CONFIGURATION_ACTIVE_CHANGED' using errcode='40001';end if;
  if r.section<>'COMPANY' then
   select * into probe from private.admin_configuration_probe_results_v1 where revision_id=r.id and content_hash=r.content_hash and environment=e order by checked_at desc,id desc limit 1;
   if probe.id is null or probe.status<>'PASS' or probe.valid_until<=clock_timestamp() then raise exception 'CONFIGURATION_FRESH_PROBE_REQUIRED' using errcode='55000';end if;
  end if;
  update private.admin_configuration_revisions_v1 set status='RETIRED',retired_at=clock_timestamp() where id=active_id;
  update private.admin_configuration_revisions_v1 set status='ACTIVE',approved_by=a,approved_at=clock_timestamp() where id=r.id;
  if r.section='YOUSIGN' then
   if to_regprocedure('private.activate_configured_yousign_provider_v1(uuid)')is null then raise exception 'YOUSIGN_ADAPTER_REGISTRATION_REQUIRED' using errcode='55000';end if;
   perform private.activate_configured_yousign_provider_v1(r.id);
  end if;
 else
  update private.admin_configuration_revisions_v1 set status='REJECTED',approved_by=a,approved_at=clock_timestamp() where id=r.id;
 end if;
 result:=jsonb_build_object('outcome',case when p_approve then 'CONFIGURATION_ACTIVATED' else 'CONFIGURATION_REJECTED' end,'revision_id',r.id);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(a,'USER',case when p_approve then 'configuration.activated' else 'configuration.rejected' end,'platform_configuration',r.id::text,correlation,jsonb_build_object('section',r.section,'environment',e,'content_hash',r.content_hash,'reason',p_reason),repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values('platform_configuration',r.id::text,'PlatformConfigurationChangedV1',correlation,result||jsonb_build_object('section',r.section,'environment',e,'content_hash',r.content_hash),'configuration.decision:'||r.id::text||':'||a::text);
 perform private.finish_admin_command('configuration.decide',p_idempotency_key,a,result);return result;
end$$;

create function public.deactivate_admin_configuration_v1(p_section text,p_expected_active_id uuid,p_reason text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare e text:=private.admin_configuration_environment_v1();a uuid:=auth.uid();r private.admin_configuration_revisions_v1%rowtype;h text;result jsonb;correlation uuid:=extensions.gen_random_uuid();begin
 if p_expected_active_id is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception 'CONFIGURATION_DECISION_INVALID' using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('section',p_section,'active_id',p_expected_active_id,'reason',p_reason,'environment',e));
 result:=private.begin_admin_command('configuration.deactivate',p_idempotency_key,h,a);if result is not null then return result;end if;
 perform pg_advisory_xact_lock(hashtextextended('configuration:'||e||':'||p_section,0));
 if private.admin_configuration_environment_v1()is distinct from e then raise exception 'CONFIGURATION_ENVIRONMENT_CHANGED'using errcode='40001';end if;
 select * into r from private.admin_configuration_revisions_v1 where id=p_expected_active_id and environment=e and section=p_section and status='ACTIVE' for update;
 if r.id is null then raise exception 'CONFIGURATION_ACTIVE_CHANGED' using errcode='40001';end if;
 update private.admin_configuration_revisions_v1 set status='RETIRED',retired_at=clock_timestamp() where id=r.id;
 result:=jsonb_build_object('outcome','CONFIGURATION_DEACTIVATED','revision_id',r.id);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(a,'USER','configuration.deactivated','platform_configuration',r.id::text,correlation,jsonb_build_object('section',r.section,'environment',e,'content_hash',r.content_hash,'reason',p_reason),repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values('platform_configuration',r.id::text,'PlatformConfigurationChangedV1',correlation,result||jsonb_build_object('section',r.section,'environment',e),'configuration.deactivate:'||p_idempotency_key||':'||a::text);
 perform private.finish_admin_command('configuration.deactivate',p_idempotency_key,a,result);return result;
end$$;

create function public.get_active_platform_configuration_v1() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare e text;sections jsonb;managed jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'CONFIGURATION_SERVICE_REQUIRED' using errcode='42501';end if;
 select environment into e from private.admin_execution_environment_v1 where singleton;
 if e is null then raise exception 'CONFIGURATION_ENVIRONMENT_UNCONFIGURED' using errcode='55000';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'section',section,'environment',environment,'settings',settings,'encrypted_secrets',encrypted_secrets,'secret_keys',secret_keys,'content_hash',content_hash) order by section),'[]')into sections from private.admin_configuration_revisions_v1 where environment=e and status='ACTIVE';
 select coalesce(jsonb_agg(section order by section),'[]')into managed from(select distinct section from private.admin_configuration_revisions_v1 where environment=e and status in('ACTIVE','RETIRED')and approved_by is not null)source;
 return jsonb_build_object('environment',e,'sections',sections,'managed_sections',managed);
end$$;

revoke all on function private.admin_configuration_environment_v1(),private.admin_configuration_payload_immutable_v1(),private.admin_configuration_validate_payload_v1(text,jsonb,text[]),private.admin_configuration_probe_authority_v1(private.admin_configuration_probe_leases_v1) from public,anon,authenticated,service_role;
revoke all on function public.save_admin_configuration_v1(uuid,text,jsonb,text,text[],uuid,text),public.get_admin_configuration_v1(),public.start_admin_configuration_probe_v1(uuid,text),public.approve_admin_configuration_v1(uuid,text,boolean,text,text),public.deactivate_admin_configuration_v1(text,uuid,text,text),public.load_admin_configuration_probe_v1(uuid),public.record_admin_configuration_probe_v1(uuid,text,text),public.get_active_platform_configuration_v1() from public,anon,authenticated,service_role;
grant execute on function public.save_admin_configuration_v1(uuid,text,jsonb,text,text[],uuid,text),public.get_admin_configuration_v1(),public.start_admin_configuration_probe_v1(uuid,text),public.approve_admin_configuration_v1(uuid,text,boolean,text,text),public.deactivate_admin_configuration_v1(text,uuid,text,text) to authenticated;
grant execute on function public.load_admin_configuration_probe_v1(uuid),public.record_admin_configuration_probe_v1(uuid,text,text),public.get_active_platform_configuration_v1() to service_role;

-- No Storage paths or objects are introduced. Physical sources remain visible
-- to the governed DSR catalogue; encrypted credentials are security secrets,
-- never implied to be a subject's portable personal data.
notify pgrst,'reload schema';
commit;
