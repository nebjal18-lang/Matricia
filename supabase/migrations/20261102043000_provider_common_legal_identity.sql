begin;
-- One canonical legal profile command; public domain wrappers retain their
-- own authorization. Sharing the profile never grants a Client role or trial.
alter function public.save_client_profile_draft(uuid,jsonb,text,uuid) rename to save_organization_profile_draft_v1;
alter function public.save_organization_profile_draft_v1(uuid,jsonb,text,uuid) set schema private;
revoke all on function private.save_organization_profile_draft_v1(uuid,jsonb,text,uuid) from public,anon,authenticated,service_role;
do $$declare definition text;begin
 select pg_get_functiondef('private.save_organization_profile_draft_v1(uuid,jsonb,text,uuid)'::regprocedure) into definition;
 if strpos(definition,'array[''CLIENT_OWNER'', ''CLIENT_ADMIN'']')=0 then raise exception 'SHARED_IDENTITY_PROFILE_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'array[''CLIENT_OWNER'', ''CLIENT_ADMIN'']','array[''CLIENT_OWNER'', ''CLIENT_ADMIN'', ''PROVIDER_OWNER'', ''PROVIDER_MANAGER'']');execute definition;
end$$;
create function public.save_client_profile_draft(p_organization_id uuid,p_profile jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not coalesce(private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid()),false)then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return private.save_organization_profile_draft_v1(p_organization_id,p_profile,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.save_client_profile_draft(uuid,jsonb,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_client_profile_draft(uuid,jsonb,text,uuid)to authenticated;

create table public.provider_legal_identity_submissions_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 compliance_case_id uuid not null,profile_version integer not null,profile_hash text not null check(profile_hash~'^[a-f0-9]{64}$'),
 document_version_ids uuid[] not null check(cardinality(document_version_ids)=3),submitted_by uuid not null references auth.users(id),
 submitted_at timestamptz not null default clock_timestamp(),idempotency_key uuid not null,
 unique(organization_id,idempotency_key),unique(organization_id,profile_version),
 foreign key(compliance_case_id,organization_id,profile_version)references public.client_profile_versions(compliance_case_id,organization_id,version)
);
alter table public.provider_legal_identity_submissions_v1 enable row level security;
revoke all on public.provider_legal_identity_submissions_v1 from public,anon,authenticated,service_role;
grant select on public.provider_legal_identity_submissions_v1 to authenticated;
create policy provider_legal_identity_submission_read on public.provider_legal_identity_submissions_v1 for select to authenticated using(private.has_org_role(organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],auth.uid())or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid()));
create trigger provider_legal_identity_submission_immutable before update or delete on public.provider_legal_identity_submissions_v1 for each row execute function private.prevent_update_delete();

-- Existing history RLS must call runtime-safe predicates, without granting
-- execution on the private decision command helper.
alter policy provider_identity_history_read on public.provider_identity_verification_history using(private.is_active_org_member(organization_id,auth.uid())or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid()));

create table public.provider_shared_legal_profile_adoptions_v1(organization_id uuid primary key references public.organizations(id),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
alter table public.provider_shared_legal_profile_adoptions_v1 enable row level security;
revoke all on public.provider_shared_legal_profile_adoptions_v1 from public,anon,authenticated,service_role;
create trigger provider_shared_profile_adoption_immutable before update or delete on public.provider_shared_legal_profile_adoptions_v1 for each row execute function private.prevent_update_delete();

create function public.save_provider_legal_profile_v1(p_organization_id uuid,p_profile jsonb,p_expected_profile_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare current_version integer;r jsonb;begin
 if not coalesce(private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],auth.uid()),false)then raise exception 'PROVIDER_IDENTITY_SCOPE_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));perform id from public.organizations where id=p_organization_id for update;
 -- Existing idempotent command replay is checked by the canonical primitive.
 if not exists(select 1 from public.idempotency_keys where organization_id=p_organization_id and operation_scope='client.profile.save'and key=p_idempotency_key)then
  select coalesce(current_profile_version,0)into current_version from public.client_compliance_cases where organization_id=p_organization_id;
  if coalesce(current_version,0)is distinct from p_expected_profile_version then raise exception 'STALE_PROVIDER_LEGAL_PROFILE'using errcode='40001';end if;
 end if;
 r:=private.save_organization_profile_draft_v1(p_organization_id,p_profile,p_idempotency_key,p_correlation_id);
 insert into public.provider_shared_legal_profile_adoptions_v1(organization_id,created_by)values(p_organization_id,auth.uid())on conflict do nothing;
 return r;
end$$;

create function public.submit_provider_legal_identity_v1(p_organization_id uuid,p_expected_profile_version integer,p_idempotency_key uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c public.client_compliance_cases%rowtype;p public.client_profile_versions%rowtype;s public.provider_legal_identity_submissions_v1%rowtype;docs uuid[];r jsonb;begin
 if not coalesce(private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],auth.uid()),false)then raise exception 'PROVIDER_IDENTITY_SCOPE_DENIED'using errcode='42501';end if;
 if p_idempotency_key is null then raise exception 'INVALID_IDEMPOTENCY_KEY'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));perform id from public.organizations where id=p_organization_id for update;
 select*into s from public.provider_legal_identity_submissions_v1 where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then if s.profile_version is distinct from p_expected_profile_version or s.submitted_by<>auth.uid()then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','PROVIDER_LEGAL_IDENTITY_SUBMITTED','submission_id',s.id,'profile_version',s.profile_version);end if;
 select*into c from public.client_compliance_cases where organization_id=p_organization_id for update;
 select*into p from public.client_profile_versions where compliance_case_id=c.id and version=c.current_profile_version;
 if p.id is null or p.version is distinct from p_expected_profile_version then raise exception 'STALE_PROVIDER_LEGAL_PROFILE'using errcode='40001';end if;
 perform private.validate_client_profile_payload(p.profile_data);
 if not exists(select 1 from public.provider_profiles where provider_organization_id=p_organization_id)then raise exception 'PROVIDER_PROFILE_REQUIRED'using errcode='55000';end if;
 -- Submission records the exact current evidence; validation/cleanliness remain
 -- the existing independent document review and final identity command's gates.
 select array_agg(version_id order by kind)into docs from(
  select kind,(select v.id from public.provider_document_families f join lateral(select*from public.provider_document_versions where family_id=f.id order by version_number desc limit 1)v on true where f.provider_organization_id=p_organization_id and f.document_kind=kind and v.status in('SUBMITTED','UNDER_REVIEW','VERIFIED')order by v.created_at desc,v.id limit 1)version_id
  from unnest(array['LEGAL','FISCAL','INSURANCE'])kind
 )e where version_id is not null;
 if cardinality(docs)is distinct from 3 then raise exception 'PROVIDER_LEGAL_DOCUMENTS_REQUIRED'using errcode='55000';end if;
 insert into public.provider_legal_identity_submissions_v1(organization_id,compliance_case_id,profile_version,profile_hash,document_version_ids,submitted_by,idempotency_key)values(p_organization_id,c.id,p.version,private.canonical_request_hash(p.profile_data),docs,auth.uid(),p_idempotency_key)returning*into s;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,auth.uid(),'USER','provider.legal_identity.submitted','provider_legal_identity_submission',s.id::text,p_correlation_id,jsonb_build_object('profile_version',p.version,'document_version_ids',docs),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'provider_legal_identity',s.id::text,'ProviderLegalIdentitySubmittedV1',p_correlation_id,jsonb_build_object('organization_id',p_organization_id,'submission_id',s.id,'profile_version',p.version),p_idempotency_key::text);
 return jsonb_build_object('outcome','PROVIDER_LEGAL_IDENTITY_SUBMITTED','submission_id',s.id,'profile_version',s.profile_version);
end$$;

-- New shared profiles participate in the current Provider fingerprint even
-- before submission, so editing an address/representative invalidates old proof.
do $$declare definition text;begin
 select pg_get_functiondef('private.provider_current_identity_snapshot_v1(uuid)'::regprocedure)into definition;
 definition:=replace(definition,'then jsonb_build_object(''canonical_legal_profile_hash''','or exists(select 1 from public.provider_shared_legal_profile_adoptions_v1 where organization_id=o.id)then jsonb_build_object(''canonical_legal_profile_hash''');
 definition:=replace(definition,'''{client_case,legal_profile}''))','''{client_case,legal_profile}''),''shared_profile_hash'',(select private.canonical_request_hash(p.profile_data)from public.client_compliance_cases c join public.client_profile_versions p on p.compliance_case_id=c.id and p.version=c.current_profile_version where c.organization_id=o.id))');execute definition;
 select pg_get_functiondef('private.provider_canonical_registered_address_v1(uuid)'::regprocedure)into definition;
 definition:=replace(definition,'where organization_id=p_org)and length','where organization_id=p_org)or exists(select 1 from public.provider_shared_legal_profile_adoptions_v1 where organization_id=p_org))and length');
 definition:=replace(definition,'case when exists','case when(exists');execute definition;
 select pg_get_functiondef('public.get_provider_identity_review_context_v1(uuid)'::regprocedure)into definition;
 if strpos(definition,'''currently_verified'',')=0 then raise exception 'PROVIDER_SHARED_PROFILE_CONTEXT_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'''currently_verified'',','''canonical_organization_profile'',(select jsonb_build_object(''version'',cp.version,''profile'',cp.profile_data)from public.client_compliance_cases cc join public.client_profile_versions cp on cp.compliance_case_id=cc.id and cp.version=cc.current_profile_version where cc.organization_id=o.id),''currently_verified'',');execute definition;
 select pg_get_functiondef('public.revalidate_provider_identity_v1(uuid,integer,integer,text,uuid,text,uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'-- This explicit human command')=0 then raise exception 'PROVIDER_SHARED_IDENTITY_REVIEW_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'-- This explicit human command','if exists(select 1 from public.provider_shared_legal_profile_adoptions_v1 where organization_id=o.id)then
  if not exists(select 1 from public.provider_legal_identity_submissions_v1 s join public.client_compliance_cases c on c.organization_id=s.organization_id join public.client_profile_versions cp on cp.compliance_case_id=c.id and cp.version=c.current_profile_version where s.organization_id=o.id and s.profile_version=c.current_profile_version and s.profile_hash=private.canonical_request_hash(cp.profile_data)and s.submitted_by<>auth.uid()and cp.created_by<>auth.uid())then raise exception ''PROVIDER_INDEPENDENT_CURRENT_PROFILE_SUBMISSION_REQUIRED''using errcode=''42501'';end if;
 end if;
 -- This explicit human command');
 definition:=replace(definition,'if o.status=''PENDING''and not exists(select 1 from public.client_compliance_cases where organization_id=o.id and status<>''VERIFIED'')then','if o.status=''PENDING''and(not exists(select 1 from public.client_compliance_cases where organization_id=o.id and status<>''VERIFIED'')or(exists(select 1 from public.provider_legal_identity_submissions_v1 where organization_id=o.id)and not exists(select 1 from public.organization_memberships m join public.organization_member_roles mr on mr.membership_id=m.id and mr.revoked_at is null where m.organization_id=o.id and m.status=''ACTIVE''and mr.role_code like ''CLIENT_%'')))then');execute definition;
end$$;

create function public.get_my_provider_legal_identity_v1(p_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare c public.client_compliance_cases%rowtype;p public.client_profile_versions%rowtype;submission jsonb;o public.organizations%rowtype;begin
 if not coalesce(private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],auth.uid()),false)then raise exception 'PROVIDER_IDENTITY_SCOPE_DENIED'using errcode='42501';end if;
 select*into o from public.organizations where id=p_organization_id;select*into c from public.client_compliance_cases where organization_id=o.id;select*into p from public.client_profile_versions where compliance_case_id=c.id and version=c.current_profile_version;
 select jsonb_build_object('id',s.id,'profile_version',s.profile_version,'submitted_at',s.submitted_at)into submission from public.provider_legal_identity_submissions_v1 s where s.organization_id=o.id order by submitted_at desc,id desc limit 1;
 return jsonb_build_object('organization_id',o.id,'legal_name',o.legal_name,'ice',(select normalized_value::text from public.organization_identifiers where organization_id=o.id and identifier_type='ICE'and is_active),'profile_version',coalesce(p.version,0),'profile',p.profile_data,'case_status',c.status,'submission',submission,'provider_profile_ready',exists(select 1 from public.provider_profiles where provider_organization_id=o.id),'currently_verified',private.provider_current_identity_is_verified_v1(o.id));
end$$;
revoke all on function public.save_provider_legal_profile_v1(uuid,jsonb,integer,text,uuid),public.submit_provider_legal_identity_v1(uuid,integer,uuid,uuid),public.get_my_provider_legal_identity_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_provider_legal_profile_v1(uuid,jsonb,integer,text,uuid),public.submit_provider_legal_identity_v1(uuid,integer,uuid,uuid),public.get_my_provider_legal_identity_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
