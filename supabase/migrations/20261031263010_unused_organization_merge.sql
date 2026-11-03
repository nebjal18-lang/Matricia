-- A merge resolves an UNUSED duplicate passport. It never transfers business
-- history, money, subscriptions, credits, memberships or economic permissions.
begin;
create table public.organization_merge_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),source_organization_id uuid not null references public.organizations(id),target_organization_id uuid not null references public.organizations(id),
 prepared_by uuid not null references auth.users(id),context_snapshot jsonb not null,context_hash text not null check(context_hash~'^[0-9a-f]{64}$'),
 proof_kind text not null check(proof_kind in('CLIENT','PROVIDER')),proof_id uuid not null,proof_snapshot jsonb not null,
 legal_reference text not null check(length(btrim(legal_reference))between 10 and 500),reason text not null check(length(btrim(reason))between 10 and 2000),
 source_onboarding_snapshot jsonb not null,request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),created_at timestamptz not null default clock_timestamp(),check(source_organization_id<>target_organization_id)
);
create table public.organization_merge_decisions_v1(
 request_id uuid primary key references public.organization_merge_requests_v1(id),approved boolean not null,decided_by uuid not null references auth.users(id),reason text not null check(length(btrim(reason))between 10 and 2000),request_hash text not null,decided_at timestamptz not null default clock_timestamp()
);
create table public.organization_aliases_v1(
 source_organization_id uuid primary key references public.organizations(id),target_organization_id uuid not null references public.organizations(id),request_id uuid not null unique references public.organization_merge_requests_v1(id),
 exact_ice_hash text not null check(exact_ice_hash~'^[0-9a-f]{64}$'),created_at timestamptz not null default clock_timestamp(),check(source_organization_id<>target_organization_id)
);
create table public.organization_merge_exception_cases_v1(id uuid primary key default extensions.gen_random_uuid(),source_organization_id uuid not null references public.organizations(id),target_organization_id uuid not null references public.organizations(id),opened_by uuid not null references auth.users(id),context_snapshot jsonb not null,reason text not null check(length(btrim(reason))between 10 and 2000),created_at timestamptz not null default clock_timestamp());
alter table public.organization_merge_exception_cases_v1 enable row level security;
revoke all on public.organization_merge_exception_cases_v1 from public,anon,authenticated,service_role;
create trigger organization_merge_exception_immutable before update or delete on public.organization_merge_exception_cases_v1 for each row execute function private.prevent_update_delete();
alter table public.organization_merge_requests_v1 enable row level security;
alter table public.organization_merge_decisions_v1 enable row level security;
alter table public.organization_aliases_v1 enable row level security;
revoke all on public.organization_merge_requests_v1,public.organization_merge_decisions_v1,public.organization_aliases_v1 from public,anon,authenticated,service_role;
create trigger organization_merge_request_immutable before update or delete on public.organization_merge_requests_v1 for each row execute function private.prevent_update_delete();
create trigger organization_merge_decision_immutable before update or delete on public.organization_merge_decisions_v1 for each row execute function private.prevent_update_delete();
create trigger organization_alias_immutable before update or delete on public.organization_aliases_v1 for each row execute function private.prevent_update_delete();
create index organization_merge_history_v1 on public.organization_merge_requests_v1(created_at desc,id);
create function private.organization_merge_admin_v1()returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'])$$;
create function private.organization_merge_source_history_v1(p_org uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare relation record;quantity bigint;result jsonb:='{}';
begin
 -- Fail closed on new business tables with an organization FK. Only passport,
 -- onboarding and administrative telemetry are explicitly exempted.
 for relation in select distinct n.nspname,c.relname,a.attname from pg_constraint fk join pg_class c on c.oid=fk.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=fk.conkey[1]
 where fk.contype='f'and fk.confrelid='public.organizations'::regclass and cardinality(fk.conkey)=1 and n.nspname='public'and c.relname not in(
 'organization_identifiers','organization_memberships','organization_administration_profiles','admin_organization_identity_revisions_v1','client_identity_verification_history','organization_sites','organization_contacts','organization_access_requests','organization_invitations','idempotency_keys',
 'client_compliance_cases','client_profile_versions','client_compliance_documents','client_compliance_anomalies','provider_profiles','provider_document_families','provider_document_versions','provider_document_scan_jobs',
 'audit_events','event_outbox','notification_instances','user_notification_preferences','notification_email_consents','notification_email_consent_challenges',
 'organization_merge_requests_v1','organization_merge_decisions_v1','organization_aliases_v1','organization_merge_exception_cases_v1')order by n.nspname,c.relname,a.attname loop
  execute format('select count(*) from %I.%I where %I=$1',relation.nspname,relation.relname,relation.attname)into quantity using p_org;
  if quantity>0 then result:=result||jsonb_build_object(relation.relname||'.'||relation.attname,quantity::text);end if;
 end loop;
 select count(*)into quantity from public.organization_access_requests where organization_id=p_org and status='PENDING';if quantity>0 then result:=result||jsonb_build_object('pending_access_requests',quantity::text);end if;
 select count(*)into quantity from public.organization_invitations where organization_id=p_org and status='PENDING';if quantity>0 then result:=result||jsonb_build_object('pending_invitations',quantity::text);end if;
 return result;
end$$;
create function private.organization_merge_proofs_v1(p_source uuid,p_target uuid)returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select coalesce(jsonb_agg(value order by value->>'kind',value->>'id'),'[]')from(
  select jsonb_build_object('kind','CLIENT','id',d.id,'organization_id',d.organization_id,'title',d.original_file_name,'sha256',d.declared_sha256,'version',d.version,'document_type',d.document_type,'download_path','/api/client/documents/'||d.id::text)value
  from public.client_compliance_documents d where d.organization_id in(p_source,p_target)and d.document_type in('REGISTRATION_DOCUMENT','REPRESENTATIVE_AUTHORITY')and d.status='VERIFIED'and d.scan_status='CLEAN'and(d.expires_on is null or d.expires_on>=current_date)
  and exists(select 1 from storage.objects o where o.bucket_id=d.storage_bucket and o.name=d.storage_object_path)
  and exists(select 1 from private.client_document_scan_results r where r.id=d.current_scan_result_id and r.document_id=d.id and r.organization_id=d.organization_id and r.result='CLEAN'and r.computed_sha256=d.declared_sha256)
  and not exists(select 1 from public.client_compliance_documents newer where newer.compliance_case_id=d.compliance_case_id and newer.document_type=d.document_type and newer.version>d.version)
  union all select jsonb_build_object('kind','PROVIDER','id',d.id,'organization_id',d.provider_organization_id,'title',f.code,'sha256',d.content_hash,'version',d.version_number,'document_type',f.document_kind,'download_path','/api/provider/documents/'||d.id::text)
  from public.provider_document_versions d join public.provider_document_families f on f.id=d.family_id where d.provider_organization_id in(p_source,p_target)and f.document_kind='LEGAL'and d.status='VERIFIED'and(d.expires_on is null or d.expires_on>current_date)and private.provider_document_is_clean(d.storage_object_path,d.content_hash)and exists(select 1 from storage.objects o where o.bucket_id='provider-qualification'and o.name=d.storage_object_path)
  and not exists(select 1 from public.provider_document_versions newer where newer.family_id=d.family_id and newer.version_number>d.version_number)
 )proofs
$$;
create function private.organization_merge_context_v1(p_source uuid,p_target uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare source public.organizations%rowtype;target public.organizations%rowtype;source_ice text;target_ice text;history jsonb;proofs jsonb;blockers jsonb:='[]';snapshot jsonb;
begin
 select*into source from public.organizations where id=p_source;select*into target from public.organizations where id=p_target;
 if source.id is null or target.id is null or p_source=p_target then raise exception'INVALID_MERGE_ORGANIZATIONS'using errcode='22023';end if;
 select normalized_value into source_ice from public.organization_identifiers where organization_id=p_source and identifier_type='ICE'order by is_active desc,created_at desc,id desc limit 1;
 select normalized_value into target_ice from public.organization_identifiers where organization_id=p_target and identifier_type='ICE'and is_active and verification_status='VERIFIED'order by created_at desc,id desc limit 1;
 if source.status not in('PENDING','ACTIVE')or target.status<>'ACTIVE'then blockers:=blockers||'"ORGANIZATION_STATE_NOT_ELIGIBLE"'::jsonb;end if;
 if source_ice is null or target_ice is null or source_ice is distinct from target_ice or source.country_code is distinct from target.country_code then blockers:=blockers||'"EXACT_VERIFIED_IDENTITY_REQUIRED"'::jsonb;end if;
 if exists(select 1 from public.organization_aliases_v1 where source_organization_id in(p_source,p_target)or target_organization_id=p_source)then blockers:=blockers||'"ALIAS_CHAIN_REVIEW_REQUIRED"'::jsonb;end if;
 history:=private.organization_merge_source_history_v1(p_source);if history<>'{}'::jsonb then blockers:=blockers||'"SOURCE_HISTORY_REQUIRES_ARCHIVE_ACCESS_PLAN"'::jsonb;end if;
 if not private.subscription_financially_clear(p_target)or not private.client_identity_allows_new_operations(p_target)then blockers:=blockers||'"TARGET_FINANCIAL_OR_IDENTITY_REVIEW_REQUIRED"'::jsonb;end if;
 if exists(select 1 from public.client_compliance_cases where organization_id=p_target)and private.current_client_contract_party_v1(p_target)is null then blockers:=blockers||'"TARGET_CURRENT_CLIENT_IDENTITY_REQUIRED"'::jsonb;end if;
 if exists(select 1 from public.provider_profiles where provider_organization_id=p_target)and not private.provider_current_identity_is_verified_v1(p_target)then blockers:=blockers||'"TARGET_CURRENT_PROVIDER_IDENTITY_REQUIRED"'::jsonb;end if;
 proofs:=private.organization_merge_proofs_v1(p_source,p_target);if jsonb_array_length(proofs)=0 then blockers:=blockers||'"VERIFIED_LEGAL_PROOF_REQUIRED"'::jsonb;end if;
 snapshot:=jsonb_build_object('schema_version',1,'mode','UNUSED_DUPLICATE_ARCHIVE_ONLY','source',jsonb_build_object('id',source.id,'legal_name',source.legal_name,'display_name',source.display_name,'country_code',source.country_code,'status',source.status,'row_version',source.row_version,'ice',source_ice),'target',jsonb_build_object('id',target.id,'legal_name',target.legal_name,'display_name',target.display_name,'country_code',target.country_code,'status',target.status,'row_version',target.row_version,'ice',target_ice),'source_history',history,'proofs',proofs,'blockers',blockers,'preserve_all_business_relations',true,'transfer_memberships',false,'historical_user_reader_provided',false);
 return snapshot||jsonb_build_object('context_hash',private.canonical_request_hash(snapshot));
end$$;
create function public.get_organization_merge_context_v1(p_source_organization_id uuid,p_target_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin if not private.organization_merge_admin_v1()then raise exception'ORGANIZATION_MERGE_DENIED'using errcode='42501';end if;return private.organization_merge_context_v1(p_source_organization_id,p_target_organization_id);end$$;
create function public.prepare_organization_merge_v1(p_source_organization_id uuid,p_target_organization_id uuid,p_expected_context_hash text,p_proof_kind text,p_proof_id uuid,p_legal_reference text,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();context jsonb;proof jsonb;hash text;cached jsonb;result jsonb;request_id uuid;onboarding jsonb;org uuid;
begin
 if not private.organization_merge_admin_v1()then raise exception'ORGANIZATION_MERGE_DENIED'using errcode='42501';end if;
 if p_source_organization_id is null or p_target_organization_id is null or p_source_organization_id=p_target_organization_id or length(btrim(coalesce(p_legal_reference,'')))not between 10 and 500 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or coalesce(p_proof_kind,'')not in('CLIENT','PROVIDER')or p_proof_id is null or coalesce(p_expected_context_hash,'')!~'^[a-f0-9]{64}$'or p_correlation_id is null then raise exception'INVALID_MERGE_REQUEST'using errcode='22023';end if;
 perform private.lock_contract_financial_parties_v1(p_source_organization_id,p_target_organization_id);
 for org in select id from public.organizations where id in(p_source_organization_id,p_target_organization_id)order by id for update loop null;end loop;
 hash:=private.canonical_request_hash(jsonb_build_object('source',p_source_organization_id,'target',p_target_organization_id,'context_hash',p_expected_context_hash,'proof_kind',p_proof_kind,'proof_id',p_proof_id,'legal_reference',p_legal_reference,'reason',p_reason));
 cached:=private.begin_contract_command(p_source_organization_id,'organization.merge.prepare',p_idempotency_key,hash,actor);if cached is not null then return cached;end if;
 context:=private.organization_merge_context_v1(p_source_organization_id,p_target_organization_id);
 if context->>'context_hash'is distinct from p_expected_context_hash then raise exception'STALE_ORGANIZATION_MERGE_CONTEXT'using errcode='40001';end if;
 if jsonb_array_length(context->'blockers')>0 then raise exception'ORGANIZATION_MERGE_REQUIRES_EXCEPTION_PLAN'using errcode='55000';end if;
 select value into proof from jsonb_array_elements(context->'proofs')where value->>'kind'=p_proof_kind and value->>'id'=p_proof_id::text;
 if proof is null then raise exception'VERIFIED_LEGAL_PROOF_REQUIRED'using errcode='55000';end if;
 onboarding:=jsonb_build_object('organization',(select to_jsonb(o)from public.organizations o where id=p_source_organization_id),'identifiers',coalesce((select jsonb_agg(to_jsonb(i)order by i.id)from public.organization_identifiers i where organization_id=p_source_organization_id),'[]'),'memberships',coalesce((select jsonb_agg(to_jsonb(m)order by m.id)from public.organization_memberships m where organization_id=p_source_organization_id),'[]'),'client_cases',coalesce((select jsonb_agg(to_jsonb(c)order by c.id)from public.client_compliance_cases c where organization_id=p_source_organization_id),'[]'),'client_profiles',coalesce((select jsonb_agg(to_jsonb(v)order by v.id)from public.client_profile_versions v where organization_id=p_source_organization_id),'[]'),'client_documents',coalesce((select jsonb_agg(to_jsonb(d)order by d.id)from public.client_compliance_documents d where organization_id=p_source_organization_id),'[]'),'provider_documents',coalesce((select jsonb_agg(to_jsonb(d)order by d.id)from public.provider_document_versions d where provider_organization_id=p_source_organization_id),'[]'),'member_roles',coalesce((select jsonb_agg(to_jsonb(r)order by r.membership_id,r.role_code)from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.organization_id=p_source_organization_id),'[]'),'administration_profile',(select to_jsonb(p)from public.organization_administration_profiles p where organization_id=p_source_organization_id),'identity_revisions',coalesce((select jsonb_agg(to_jsonb(v)order by v.action_request_id)from public.admin_organization_identity_revisions_v1 v where organization_id=p_source_organization_id),'[]'),'provider_profile',(select to_jsonb(p)from public.provider_profiles p where provider_organization_id=p_source_organization_id));
 insert into public.organization_merge_requests_v1(source_organization_id,target_organization_id,prepared_by,context_snapshot,context_hash,proof_kind,proof_id,proof_snapshot,legal_reference,reason,source_onboarding_snapshot,request_hash)values(p_source_organization_id,p_target_organization_id,actor,context,p_expected_context_hash,p_proof_kind,p_proof_id,proof,p_legal_reference,p_reason,onboarding,hash)returning id into request_id;
 result:=jsonb_build_object('outcome','ORGANIZATION_MERGE_PREPARED','request_id',request_id,'request_hash',hash);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_source_organization_id,actor,'USER','organization.merge.prepared','organization_merge_request',request_id::text,p_correlation_id,result,repeat('0',64));
 perform private.finish_contract_command(p_source_organization_id,'organization.merge.prepare',p_idempotency_key,result);return result;
end$$;
create function public.decide_organization_merge_v1(p_request_id uuid,p_accept boolean,p_expected_request_hash text,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();request public.organization_merge_requests_v1%rowtype;context jsonb;hash text;cached jsonb;result jsonb;org uuid;
begin
 if not private.organization_merge_admin_v1()then raise exception'ORGANIZATION_MERGE_DENIED'using errcode='42501';end if;
 select*into request from public.organization_merge_requests_v1 where id=p_request_id;
 if request.id is null or request.prepared_by=actor then raise exception'INDEPENDENT_MERGE_APPROVER_REQUIRED'using errcode='42501';end if;
 if p_accept is null or request.request_hash is distinct from p_expected_request_hash or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or p_correlation_id is null then raise exception'INVALID_MERGE_DECISION'using errcode='22023';end if;
 perform private.lock_contract_financial_parties_v1(request.source_organization_id,request.target_organization_id);
 for org in select id from public.organizations where id in(request.source_organization_id,request.target_organization_id)order by id for update loop null;end loop;
 hash:=private.canonical_request_hash(jsonb_build_object('request',request.id,'accepted',p_accept,'hash',p_expected_request_hash,'reason',p_reason));cached:=private.begin_contract_command(request.source_organization_id,'organization.merge.decide.'||request.id::text,p_idempotency_key,hash,actor);if cached is not null then return cached;end if;
 if exists(select 1 from public.organization_merge_decisions_v1 where request_id=request.id)then raise exception'MERGE_REQUEST_ALREADY_DECIDED'using errcode='55000';end if;
 if p_accept then
  context:=private.organization_merge_context_v1(request.source_organization_id,request.target_organization_id);
  if context->>'context_hash'is distinct from request.context_hash then raise exception'STALE_ORGANIZATION_MERGE_CONTEXT'using errcode='40001';end if;
  if jsonb_array_length(context->'blockers')>0 or not exists(select 1 from jsonb_array_elements(context->'proofs')p where p=request.proof_snapshot)then raise exception'ORGANIZATION_MERGE_REQUIRES_EXCEPTION_PLAN'using errcode='55000';end if;
  insert into public.organization_aliases_v1(source_organization_id,target_organization_id,request_id,exact_ice_hash)values(request.source_organization_id,request.target_organization_id,request.id,encode(extensions.digest(context->'source'->>'ice','sha256'),'hex'));
  update public.organizations set status='ARCHIVED',updated_at=clock_timestamp(),row_version=row_version+1 where id=request.source_organization_id;
 end if;
 insert into public.organization_merge_decisions_v1(request_id,approved,decided_by,reason,request_hash)values(request.id,p_accept,actor,p_reason,hash);
 result:=jsonb_build_object('outcome',case when p_accept then'ORGANIZATION_MERGED'else'ORGANIZATION_MERGE_REJECTED'end,'request_id',request.id,'source_organization_id',request.source_organization_id,'target_organization_id',request.target_organization_id,'mode','UNUSED_DUPLICATE_ARCHIVE_ONLY','business_relations_moved',false,'memberships_transferred',false);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(request.source_organization_id,actor,'USER',case when p_accept then'organization.merged'else'organization.merge.rejected'end,'organization_merge_request',request.id::text,p_correlation_id,result||jsonb_build_object('proof_sha256',request.proof_snapshot->>'sha256','legal_reference',request.legal_reference,'reason',p_reason),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(request.source_organization_id,'organization_merge_request',request.id::text,case when p_accept then'OrganizationMergedV1'else'OrganizationMergeRejectedV1'end,p_correlation_id,result,p_idempotency_key);
 perform private.finish_contract_command(request.source_organization_id,'organization.merge.decide.'||request.id::text,p_idempotency_key,result);return result;
end$$;
-- A command that checked membership just before archival must not insert later.
-- Parent row locks serialize this fence with archival. No role helper is widened.
create function private.guard_merged_organization_write_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
declare org uuid;column_name text;begin foreach column_name in array tg_argv loop org:=nullif(to_jsonb(new)->>column_name,'')::uuid;if org is not null then perform 1 from public.organizations where id=org for key share;if exists(select 1 from public.organization_aliases_v1 where source_organization_id=org)then raise exception'ORGANIZATION_ARCHIVED_BY_MERGE'using errcode='55000';end if;end if;end loop;return new;end$$;
do $$declare relation record;columns text;begin
 for relation in select n.nspname,c.relname,array_agg(distinct a.attname order by a.attname)columns from pg_constraint fk join pg_class c on c.oid=fk.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=fk.conkey[1]where fk.contype='f'and fk.confrelid='public.organizations'::regclass and cardinality(fk.conkey)=1 and n.nspname='public'and c.relname not in('audit_events','event_outbox','notification_instances','idempotency_keys','organization_merge_requests_v1','organization_aliases_v1','organization_merge_exception_cases_v1')group by n.nspname,c.relname loop
  select string_agg(quote_literal(value),',')into columns from unnest(relation.columns)value;
  execute format('create trigger organization_merge_write_fence before insert or update on %I.%I for each row execute function private.guard_merged_organization_write_v1(%s)',relation.nspname,relation.relname,columns);
 end loop;
end$$;
create function private.prevent_merged_organization_reactivation_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin if new.status<>'ARCHIVED'and exists(select 1 from public.organization_aliases_v1 where source_organization_id=old.id)then raise exception'MERGED_ORGANIZATION_REACTIVATION_REQUIRES_PLAN'using errcode='55000';end if;return new;end$$;
revoke all on function private.prevent_merged_organization_reactivation_v1()from public,anon,authenticated,service_role;
create trigger organization_merge_no_reactivation before update of status on public.organizations for each row execute function private.prevent_merged_organization_reactivation_v1();
create function public.record_organization_merge_exception_v1(p_source_organization_id uuid,p_target_organization_id uuid,p_expected_context_hash text,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare context jsonb;hash text;cached jsonb;result jsonb;case_id uuid;
begin
 if not private.organization_merge_admin_v1()then raise exception'ORGANIZATION_MERGE_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or p_correlation_id is null then raise exception'INVALID_MERGE_EXCEPTION'using errcode='22023';end if;
 hash:=private.canonical_request_hash(jsonb_build_object('source',p_source_organization_id,'target',p_target_organization_id,'context_hash',p_expected_context_hash,'reason',p_reason));cached:=private.begin_contract_command(p_source_organization_id,'organization.merge.exception',p_idempotency_key,hash,auth.uid());if cached is not null then return cached;end if;
 context:=private.organization_merge_context_v1(p_source_organization_id,p_target_organization_id);if context->>'context_hash'is distinct from p_expected_context_hash then raise exception'STALE_ORGANIZATION_MERGE_CONTEXT'using errcode='40001';end if;
 if jsonb_array_length(context->'blockers')=0 then raise exception'MERGE_EXCEPTION_HAS_NO_BLOCKER'using errcode='55000';end if;
 insert into public.organization_merge_exception_cases_v1(source_organization_id,target_organization_id,opened_by,context_snapshot,reason)values(p_source_organization_id,p_target_organization_id,auth.uid(),context,p_reason)returning id into case_id;
 result:=jsonb_build_object('outcome','ORGANIZATION_MERGE_EXCEPTION_RECORDED','case_id',case_id,'status','OPEN');
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_source_organization_id,auth.uid(),'USER','organization.merge.exception.recorded','organization_merge_exception',case_id::text,p_correlation_id,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_source_organization_id,'organization_merge_exception',case_id::text,'OrganizationMergeExceptionRaisedV1',p_correlation_id,result,p_idempotency_key);
 perform private.finish_contract_command(p_source_organization_id,'organization.merge.exception',p_idempotency_key,result);return result;
end$$;
revoke all on function public.record_organization_merge_exception_v1(uuid,uuid,text,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.record_organization_merge_exception_v1(uuid,uuid,text,text,text,uuid)to authenticated;
create function public.get_organization_merge_console_v1(p_query text default'',p_page integer default 1,p_request_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
begin
 if not private.organization_merge_admin_v1()then raise exception'ORGANIZATION_MERGE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or length(coalesce(p_query,''))>200 then raise exception'INVALID_MERGE_QUERY'using errcode='22023';end if;
 return jsonb_build_object('actor_user_id',auth.uid(),'page',p_page,'page_size',25,'request_total',(select count(*)from public.organization_merge_requests_v1 where p_request_id is null or id=p_request_id),'exception_total',(select count(*)from public.organization_merge_exception_cases_v1),'total',(select count(*)from public.organizations o where o.status in('PENDING','ACTIVE')and(position(lower(coalesce(p_query,''))in lower(o.legal_name||' '||o.display_name))>0 or exists(select 1 from public.organization_identifiers i where i.organization_id=o.id and i.identifier_type='ICE'and position(coalesce(p_query,'')in i.normalized_value)>0))),
 'organizations',coalesce((select jsonb_agg(to_jsonb(x))from(select o.id,o.display_name,o.legal_name,o.status,(select normalized_value from public.organization_identifiers where organization_id=o.id and identifier_type='ICE'order by is_active desc,created_at desc,id desc limit 1)ice from public.organizations o where o.status in('PENDING','ACTIVE')and(position(lower(coalesce(p_query,''))in lower(o.legal_name||' '||o.display_name))>0 or exists(select 1 from public.organization_identifiers i where i.organization_id=o.id and i.identifier_type='ICE'and position(coalesce(p_query,'')in i.normalized_value)>0))order by o.display_name,o.id limit 25 offset(p_page-1)*25)x),'[]'),
 'exceptions',coalesce((select jsonb_agg(to_jsonb(x))from(select e.id,e.context_snapshot,e.reason,e.created_at,case when exists(select 1 from public.organization_aliases_v1 a where a.source_organization_id=e.source_organization_id and a.target_organization_id=e.target_organization_id)then'RESOLVED_BY_EXECUTED_ARCHIVE'else'OPEN'end status from public.organization_merge_exception_cases_v1 e order by e.created_at desc,e.id desc limit 25 offset(p_page-1)*25)x),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(x))from(select r.id,r.context_snapshot,r.context_hash,r.proof_snapshot,r.legal_reference,r.reason,r.prepared_by,r.request_hash,r.created_at,case when d.request_id is null then'PENDING_APPROVAL'when d.approved then'EXECUTED'else'REJECTED'end status,d.decided_by,d.reason decision_reason from public.organization_merge_requests_v1 r left join public.organization_merge_decisions_v1 d on d.request_id=r.id where(p_request_id is null or r.id=p_request_id)order by r.created_at desc,r.id desc limit 25 offset case when p_request_id is null then(p_page-1)*25 else 0 end)x),'[]'));
end$$;
revoke all on function private.organization_merge_admin_v1(),private.organization_merge_source_history_v1(uuid),private.organization_merge_proofs_v1(uuid,uuid),private.organization_merge_context_v1(uuid,uuid),private.guard_merged_organization_write_v1()from public,anon,authenticated,service_role;
revoke all on function public.get_organization_merge_context_v1(uuid,uuid),public.prepare_organization_merge_v1(uuid,uuid,text,text,uuid,text,text,text,uuid),public.decide_organization_merge_v1(uuid,boolean,text,text,text,uuid),public.get_organization_merge_console_v1(text,integer,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_organization_merge_context_v1(uuid,uuid),public.prepare_organization_merge_v1(uuid,uuid,text,text,uuid,text,text,text,uuid),public.decide_organization_merge_v1(uuid,boolean,text,text,text,uuid),public.get_organization_merge_console_v1(text,integer,uuid)to authenticated;

create function public.verify_organization_workflow_event_v1(p_outbox_id bigint,p_event_type text,p_resource_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare event public.event_outbox%rowtype;receipt public.organization_join_requests%rowtype;
begin
 if auth.role()is distinct from'service_role'then raise exception'ORGANIZATION_WORKFLOW_EVENT_VERIFICATION_DENIED'using errcode='42501';end if;
 select*into event from public.event_outbox where id=p_outbox_id and event_type=p_event_type and aggregate_id=p_resource_id::text;
 if event.id is null then return false;end if;
 if p_event_type='OrganizationJoinRequestedV1'then
  select*into receipt from public.organization_join_requests where id=p_resource_id;
  return receipt.id is not null and exists(select 1 from public.audit_events where action='organization.join.requested'and resource_id=receipt.id::text)and(case when receipt.access_request_id is null then(event.payload->>'notification_count')::integer=0 else(select count(*)from public.notification_instances where source_aggregate_type='organization_join_request'and source_aggregate_id=receipt.id::text and event_type='OrganizationJoinRequestedV1')=(event.payload->>'notification_count')::integer end);
 elsif p_event_type='OrganizationJoinDecidedV1'then
  return exists(select 1 from public.organization_join_requests j join public.organization_access_requests a on a.id=j.access_request_id where j.id=p_resource_id and a.status in('APPROVED','REJECTED')and exists(select 1 from public.audit_events where action='organization.join.decided'and resource_id=j.id::text));
 elsif p_event_type='OrganizationMergedV1'then
  return exists(select 1 from public.organization_aliases_v1 a join public.organization_merge_requests_v1 r on r.id=a.request_id join public.organization_merge_decisions_v1 d on d.request_id=r.id and d.approved and d.decided_by<>r.prepared_by join public.organizations o on o.id=a.source_organization_id and o.status='ARCHIVED'where r.id=p_resource_id and a.target_organization_id=r.target_organization_id and exists(select 1 from public.audit_events where action='organization.merged'and resource_id=r.id::text));
 elsif p_event_type='OrganizationMergeExceptionRaisedV1'then return exists(select 1 from public.organization_merge_exception_cases_v1 where id=p_resource_id)and exists(select 1 from public.audit_events where action='organization.merge.exception.recorded'and resource_id=p_resource_id::text);
 elsif p_event_type='OrganizationMergeRejectedV1'then return exists(select 1 from public.organization_merge_decisions_v1 where request_id=p_resource_id and not approved);
 end if;return false;
end$$;
revoke all on function public.verify_organization_workflow_event_v1(bigint,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.verify_organization_workflow_event_v1(bigint,text,uuid)to service_role;
notify pgrst,'reload schema';
commit;
