begin;
-- Immutable verification anchors preserve the identity that was verified at a
-- financial event's date. Reverification never restarts or rewrites a trial.
create table public.client_identity_verification_history(
 id uuid primary key default extensions.gen_random_uuid(),
 compliance_case_id uuid not null, organization_id uuid not null,
 profile_version integer not null, verified_at timestamptz not null,
 verified_by uuid references auth.users(id),source text not null check(source in('HISTORICAL_TRIAL','COMPLIANCE_DECISION')),
 unique(compliance_case_id,profile_version),
 foreign key(compliance_case_id,organization_id,profile_version) references public.client_profile_versions(compliance_case_id,organization_id,version));
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)
select compliance_case_id,organization_id,verified_profile_version,trial_started_at,activated_by,'HISTORICAL_TRIAL'from public.client_trials;
create index client_identity_verification_history_asof_idx on public.client_identity_verification_history(organization_id,verified_at desc,id);
alter table public.client_identity_verification_history enable row level security;
revoke all on public.client_identity_verification_history from public,anon,authenticated,service_role;
create trigger client_identity_verification_history_immutable before update or delete on public.client_identity_verification_history for each row execute function private.prevent_client_delivery_history_change();
create function private.record_client_identity_verification_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.status='VERIFIED'and(old.status is distinct from'VERIFIED'or old.current_profile_version is distinct from new.current_profile_version)then
  insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values(new.id,new.organization_id,new.current_profile_version,new.verified_at,new.decided_by,'COMPLIANCE_DECISION')on conflict(compliance_case_id,profile_version)do nothing;
 end if;return new;
end$$;
revoke all on function private.record_client_identity_verification_v1()from public,anon,authenticated,service_role;
create trigger client_identity_verification_record after update on public.client_compliance_cases for each row execute function private.record_client_identity_verification_v1();
-- A reviewer can approve only the current canonical identity snapshot. An old
-- evidence/case version cannot silently restore a former legal identity.
create function private.enforce_current_client_identity_review_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare profile public.client_profile_versions%rowtype;o public.organizations%rowtype;ice text;
begin
 if new.status='VERIFIED'and(old.status is distinct from'VERIFIED'or old.current_profile_version is distinct from new.current_profile_version)then
  select*into profile from public.client_profile_versions where compliance_case_id=new.id and version=new.current_profile_version;
  select*into o from public.organizations where id=new.organization_id;
  select normalized_value::text into ice from public.organization_identifiers where organization_id=o.id and identifier_type='ICE'and is_active and verification_status='VERIFIED';
  if profile.id is null or ice is null or profile.organization_snapshot->'identifiers'->>'ICE'is distinct from ice or profile.organization_snapshot->>'legal_name'is distinct from o.legal_name or profile.organization_snapshot->>'country_code'is distinct from o.country_code
   or not exists(select 1 from public.organization_identifiers where organization_id=o.id and identifier_type='IF'and is_active and verification_status='VERIFIED'and normalized_value::text=profile.profile_data->>'if_number')
   or not exists(select 1 from public.organization_identifiers where organization_id=o.id and identifier_type='RC'and is_active and verification_status='VERIFIED'and normalized_value::text=profile.profile_data->>'rc_number')then
   raise exception'CLIENT_CURRENT_IDENTITY_SNAPSHOT_MISMATCH'using errcode='55000';
  end if;
 end if;return new;
end$$;
revoke all on function private.enforce_current_client_identity_review_v1()from public,anon,authenticated,service_role;
create trigger client_current_identity_review before update on public.client_compliance_cases for each row execute function private.enforce_current_client_identity_review_v1();
-- Reverification retains the original trial; a new immutable anchor above is
-- created only after all existing evidence / dual-control triggers succeed.
do $$declare definition text;begin
 select pg_get_functiondef('public.decide_client_compliance(uuid,text,text,text,uuid)'::regprocedure)into definition;
 if strpos(definition,') returning id into v_trial_id;')=0 then raise exception'CLIENT_TRIAL_REVERIFICATION_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'v_trial_id uuid;','v_trial_id uuid; v_trial_created boolean:=false;');
 definition:=replace(definition,') returning id into v_trial_id;',') on conflict(organization_id)do nothing returning id into v_trial_id; v_trial_created:=v_trial_id is not null; if v_trial_id is null then select id into v_trial_id from public.client_trials where organization_id=v_case.organization_id;end if;');
 definition:=replace(definition,E'if p_decision = ''VERIFIED'' then\n    insert into public.audit_events',E'if p_decision = ''VERIFIED''and v_trial_created then\n    insert into public.audit_events');
 execute definition;
end$$;
create table public.admin_organization_identity_revisions_v1(
 action_request_id uuid primary key references public.admin_operational_action_requests(id),
 organization_id uuid not null references public.organizations(id),compliance_case_id uuid references public.client_compliance_cases(id),
 old_profile_version integer,new_profile_version integer,previous_identity_hash text not null,new_identity_hash text not null,
 reason text not null check(length(btrim(reason))between 10 and 5000),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
alter table public.admin_organization_identity_revisions_v1 enable row level security;
revoke all on public.admin_organization_identity_revisions_v1 from public,anon,authenticated,service_role;
grant select on public.admin_organization_identity_revisions_v1 to authenticated;
create policy admin_organization_identity_revision_read on public.admin_organization_identity_revisions_v1 for select to authenticated using(auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
create trigger admin_organization_identity_revision_immutable before update or delete on public.admin_organization_identity_revisions_v1 for each row execute function private.prevent_client_delivery_history_change();
create function private.execute_admin_organization_mutation_v1(p_action_request_id uuid,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype;p jsonb;o public.organizations%rowtype;c public.client_compliance_cases%rowtype;prior public.client_profile_versions%rowtype;ice text;old_ice text;changed boolean:=false;old_hash text;new_hash text;snapshot jsonb;new_version integer;new_status text;
begin
 if auth.role()is distinct from'service_role'then raise exception'ADMIN_ORGANIZATION_EXECUTION_DENIED'using errcode='42501';end if;
 select*into x from public.admin_operational_action_requests where id=p_action_request_id;
 if x.status<>'AUTHORIZED'or x.resource_type<>'ORGANIZATION'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],x.requested_by)then raise exception'ADMIN_ORGANIZATION_EXECUTION_DENIED'using errcode='42501';end if;
 p:=x.redacted_summary;
 if x.organization_id is not null and x.organization_id<>x.resource_id::uuid then raise exception'ADMIN_RESOURCE_SCOPE_MISMATCH'using errcode='42501';end if;
 if p->>'intent'='CREATE_ORGANIZATION'then
  ice:=private.normalize_ice(p->>'ice');
  if ice!~'^[0-9]{15}$'or length(btrim(coalesce(p->>'legalName','')))<2 or length(btrim(coalesce(p->>'displayName','')))<2 then raise exception'INVALID_ORGANIZATION_IDENTITY'using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('identity.ice.'||ice,0));
  if exists(select 1 from public.organization_identifiers where identifier_type='ICE'and is_active and normalized_value=ice)then raise exception'ORGANIZATION_ICE_ALREADY_EXISTS'using errcode='23505';end if;
  insert into public.organizations(id,legal_name,display_name,country_code,status,created_by)values(x.resource_id::uuid,btrim(p->>'legalName'),btrim(p->>'displayName'),coalesce(nullif(upper(p->>'country'),''),'MA'),'PENDING',x.requested_by)returning*into o;
  insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)values(o.id,'ICE',ice,'PENDING',true);
 else
  select*into o from public.organizations where id=x.resource_id::uuid for update;
  if not found then raise exception'ORGANIZATION_NOT_FOUND'using errcode='P0002';end if;
  if (p->>'expectedRowVersion')::integer is distinct from o.row_version then raise exception'STALE_ORGANIZATION'using errcode='40001';end if;
  select normalized_value::text into old_ice from public.organization_identifiers where organization_id=o.id and identifier_type='ICE'and is_active for update;
  ice:=coalesce(nullif(private.normalize_ice(p->>'ice'),''),old_ice);
  if p?'expectedIce'and private.normalize_ice(p->>'expectedIce')is distinct from coalesce(old_ice,'')then raise exception'STALE_ORGANIZATION_IDENTITY'using errcode='40001';end if;
  changed:=coalesce(nullif(p->>'legalName',''),o.legal_name)is distinct from o.legal_name or coalesce(nullif(upper(p->>'country'),''),o.country_code)is distinct from o.country_code or ice is distinct from old_ice;
  select*into c from public.client_compliance_cases where organization_id=o.id for update;
  if changed then
   if ice!~'^[0-9]{15}$'or x.action_type<>'MANUAL_EXCEPTION'or x.approvals_required<2 then raise exception'IDENTITY_CHANGE_REQUIRES_DUAL_APPROVAL'using errcode='42501';end if;
   perform pg_advisory_xact_lock(hashtextextended('identity.ice.'||ice,0));
   if exists(select 1 from public.organization_identifiers where identifier_type='ICE'and is_active and normalized_value=ice and organization_id<>o.id)then raise exception'ORGANIZATION_ICE_ALREADY_EXISTS'using errcode='23505';end if;
   if length(btrim(coalesce(x.reason,'')))<10 then raise exception'IDENTITY_CHANGE_REASON_REQUIRED'using errcode='22023';end if;
   old_hash:=private.canonical_request_hash(jsonb_build_object('legal_name',o.legal_name,'country_code',o.country_code,'ice',old_ice,'profile_version',c.current_profile_version));
   update public.organization_identifiers set is_active=false where organization_id=o.id and identifier_type='ICE'and is_active;
   insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)values(o.id,'ICE',ice,'PENDING',true)on conflict(organization_id,identifier_type,normalized_value)do update set is_active=true,verification_status='PENDING';
   update public.organization_identifiers set verification_status='PENDING'where organization_id=o.id and identifier_type in('IF','RC')and is_active;
  end if;
  new_status:=case when x.action_type='RESTRICT_ENTITY'then'ARCHIVED'when x.action_type='SUSPEND_ENTITY'then'SUSPENDED'when changed and c.id is not null then'PENDING'else coalesce(nullif(p->>'status',''),o.status)end;
  if new_status='ACTIVE'and c.id is not null and c.status<>'VERIFIED'then raise exception'CLIENT_REVERIFICATION_REQUIRED'using errcode='55000';end if;
  update public.organizations set legal_name=coalesce(nullif(p->>'legalName',''),legal_name),display_name=coalesce(nullif(p->>'displayName',''),display_name),country_code=coalesce(nullif(upper(p->>'country'),''),country_code),status=new_status,row_version=row_version+1,updated_at=clock_timestamp()where id=o.id returning*into o;
  if changed then
   if c.id is not null and c.current_profile_version is not null then
    select*into prior from public.client_profile_versions where compliance_case_id=c.id and version=c.current_profile_version;
    new_version:=c.current_profile_version+1;
    select jsonb_build_object('legal_name',o.legal_name,'display_name',o.display_name,'country_code',o.country_code,'row_version',o.row_version,'identifiers',coalesce((select jsonb_object_agg(identifier_type,normalized_value::text)from public.organization_identifiers where organization_id=o.id and is_active),'{}'::jsonb))into snapshot;
    insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values(c.id,o.id,new_version,prior.profile_data,snapshot,o.row_version,x.requested_by);
    update public.client_compliance_cases set current_profile_version=new_version,status='DOCUMENTS_REQUIRED',submitted_at=null,decided_by=null,decided_at=null,decision_reason_public=null,verified_at=null,activated_at=null where id=c.id;
    -- An earlier accepted exception must never authorize a different identity.
    update public.client_administrative_anomalies set status='OPEN',resolved_by=null,resolved_at=null,row_version=row_version+1 where compliance_case_id=c.id and anomaly_code='ICE_NOT_VERIFIED';
    perform private.set_client_compliance_anomaly(c.id,o.id,'ICE_NOT_VERIFIED','identifiers.ICE',true,'Identité modifiée : une nouvelle vérification est requise.','تغيّرت الهوية: يلزم تحقق جديد.',x.requested_by,private.canonical_request_hash(to_jsonb(old_ice)),private.canonical_request_hash(to_jsonb(ice)));
   end if;
   new_hash:=private.canonical_request_hash(jsonb_build_object('legal_name',o.legal_name,'country_code',o.country_code,'ice',ice,'profile_version',new_version));
   insert into public.admin_organization_identity_revisions_v1(action_request_id,organization_id,compliance_case_id,old_profile_version,new_profile_version,previous_identity_hash,new_identity_hash,reason,created_by)values(x.id,o.id,c.id,c.current_profile_version,new_version,old_hash,new_hash,x.reason,x.requested_by);
   insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(o.id,x.requested_by,'USER','organization.identity.review_reopened','organization',o.id::text,p_correlation_id,jsonb_build_object('action_request_id',x.id,'old_profile_version',c.current_profile_version,'new_profile_version',new_version,'previous_identity_hash',old_hash,'new_identity_hash',new_hash,'reason',x.reason),repeat('0',64));
   insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(o.id,'organization',o.id::text,'OrganizationIdentityReviewReopenedV1',p_correlation_id,jsonb_build_object('organization_id',o.id,'compliance_case_id',c.id,'profile_version',new_version,'new_identity_hash',new_hash));
  end if;
 end if;
 insert into public.organization_administration_profiles(organization_id,role_codes,details,updated_by)values(o.id,case when p->>'kind'in('CLIENT','PROVIDER','FRANCHISE','INTERNAL')then array[p->>'kind']else'{}'end,p||jsonb_build_object('ice',ice),x.requested_by)on conflict(organization_id)do update set details=organization_administration_profiles.details||excluded.details,role_codes=case when cardinality(excluded.role_codes)>0 then excluded.role_codes else organization_administration_profiles.role_codes end,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 return jsonb_build_object('organization_id',o.id,'identity_review_reopened',changed and c.id is not null,'profile_version',new_version,'status',o.status);
end$$;
revoke all on function private.execute_admin_organization_mutation_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;start_pos integer;end_pos integer;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 start_pos:=strpos(definition,'elsif x.resource_type=''ORGANIZATION''then');end_pos:=strpos(definition,'elsif x.resource_type in(''MEMBERSHIP'',''USER'')then');
 if start_pos=0 or end_pos<start_pos then raise exception'ADMIN_ORGANIZATION_CANONICAL_PATCH_TARGET_MISSING';end if;
 definition:=substring(definition from 1 for start_pos-1)||'elsif x.resource_type=''ORGANIZATION''then result:=private.execute_admin_organization_mutation_v1(x.id,p_correlation_id); '||substring(definition from end_pos);execute definition;
 select pg_get_functiondef('public.get_admin_organization_fiche(uuid)'::regprocedure)into definition;
 definition:=replace(definition,'''administration_details'',coalesce(d,''{}''::jsonb)', '''administration_details'',coalesce(d,''{}''::jsonb)||jsonb_build_object(''ice'',(select normalized_value::text from public.organization_identifiers where organization_id=p_organization_id and identifier_type=''ICE''and is_active))');execute definition;
end$$;
notify pgrst,'reload schema';
commit;
