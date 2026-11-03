-- Qualification originals retain immutable document versions. Mutable scan jobs are separate.
create table public.provider_document_scan_jobs(
 id uuid primary key default extensions.gen_random_uuid(),document_version_id uuid not null unique references public.provider_document_versions(id),
 provider_organization_id uuid not null references public.organizations(id),storage_bucket text not null default 'provider-qualification' check(storage_bucket='provider-qualification'),
 storage_object_path text not null unique,declared_sha256 text not null check(declared_sha256~'^[0-9a-f]{64}$'),
 declared_mime_type text not null check(declared_mime_type in('application/pdf','image/jpeg','image/png')),
 status text not null default 'UPLOAD_PENDING' check(status='UPLOAD_PENDING'),expires_at timestamptz not null default 'infinity',
 scan_status text not null default 'PENDING' check(scan_status in('PENDING','CLEAN','INFECTED','ERROR')),scanned_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
alter table public.provider_document_scan_jobs enable row level security;
revoke all on public.provider_document_scan_jobs from public,anon,authenticated,service_role;
grant select(document_version_id,provider_organization_id,storage_object_path,scan_status) on public.provider_document_scan_jobs to authenticated;
create policy provider_document_scan_scoped_read on public.provider_document_scan_jobs for select to authenticated using(
 private.is_active_org_member(provider_organization_id,auth.uid()) or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())
);
create table private.provider_document_scan_results(
  id uuid primary key default extensions.gen_random_uuid(),
  upload_id uuid not null references public.provider_document_scan_jobs(id) on delete restrict,
  sequence integer not null check(sequence>0),
  result text not null check(result in('CLEAN','INFECTED','ERROR')),
  engine_code text not null check(engine_code~'^[A-Z][A-Z0-9_.-]{2,79}$'),
  engine_version text not null check(length(btrim(engine_version))between 1 and 80),
  computed_sha256 text not null check(computed_sha256~'^[0-9a-f]{64}$'),
  scanner_principal text not null default 'SUPABASE_SERVICE_ROLE' check(scanner_principal='SUPABASE_SERVICE_ROLE'),
  correlation_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(upload_id,sequence)
);
alter table private.provider_document_scan_results enable row level security;
revoke all on private.provider_document_scan_results from public,anon,authenticated,service_role;
create trigger provider_document_scan_results_immutable before update or delete on private.provider_document_scan_results
for each row execute function private.prevent_update_delete();

alter table public.provider_document_scan_jobs
  add column current_scan_result_id uuid references private.provider_document_scan_results(id) on delete restrict,
  add constraint provider_document_scan_state_check check(
    (scan_status='PENDING' and scanned_at is null and current_scan_result_id is null)
    or(scan_status<>'PENDING' and scanned_at is not null and current_scan_result_id is not null)
  );

create index provider_document_scan_jobs_pending_scan_idx
on public.provider_document_scan_jobs(created_at,id)
where status='UPLOAD_PENDING'and scan_status='PENDING';

create table private.provider_document_scan_claims(
  upload_id uuid primary key references public.provider_document_scan_jobs(id) on delete cascade,
  worker_id uuid not null,
  lease_token uuid not null default extensions.gen_random_uuid(),
  leased_until timestamptz not null,
  row_version integer not null default 1 check(row_version>0),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  claimed_at timestamptz not null default clock_timestamp()
);
alter table private.provider_document_scan_claims enable row level security;
revoke all on private.provider_document_scan_claims from public,anon,authenticated,service_role;

create table private.provider_document_scan_retry_history(
  id uuid primary key default extensions.gen_random_uuid(),
  upload_id uuid not null references public.provider_document_scan_jobs(id) on delete restrict,
  attempt integer not null check(attempt between 1 and 5),
  failure_code text not null check(failure_code in('SCANNER_UNAVAILABLE','SCANNER_INVALID_RESPONSE','STORAGE_DOWNLOAD_FAILED')),
  worker_id uuid not null,lease_token uuid not null,correlation_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(upload_id,attempt)
);
alter table private.provider_document_scan_retry_history enable row level security;
revoke all on private.provider_document_scan_retry_history from public,anon,authenticated,service_role;
create trigger provider_document_scan_retry_history_immutable before update or delete on private.provider_document_scan_retry_history
for each row execute function private.prevent_update_delete();

create table private.provider_document_scan_idempotency(
  upload_id uuid not null references public.provider_document_scan_jobs(id) on delete restrict,
  key text not null,request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),
  response_body jsonb not null,created_at timestamptz not null default clock_timestamp(),
  primary key(upload_id,key)
);
alter table private.provider_document_scan_idempotency enable row level security;
revoke all on private.provider_document_scan_idempotency from public,anon,authenticated,service_role;
create trigger provider_document_scan_idempotency_immutable before update or delete on private.provider_document_scan_idempotency
for each row execute function private.prevent_update_delete();

create function public.claim_provider_document_scan_jobs(
  p_worker_id uuid,p_limit integer default 20,p_lease_seconds integer default 300
) returns table(
  proof_id uuid,lease_token uuid,worker_id uuid,row_version integer,attempt_count integer,
  storage_bucket text,storage_path text,expected_sha256 text,media_type text
) language plpgsql security definer set search_path=pg_catalog,public,private,extensions,storage
as $$
declare u public.provider_document_scan_jobs%rowtype;c private.provider_document_scan_claims%rowtype;
begin
  if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
  if p_worker_id is null or p_limit not between 1 and 100 or p_lease_seconds not between 30 and 900 then raise exception'INVALID_SCAN_CLAIM'using errcode='22023';end if;
  for u in select candidate.* from public.provider_document_scan_jobs candidate
    where candidate.status='UPLOAD_PENDING'and candidate.scan_status='PENDING'and candidate.expires_at>clock_timestamp()
      and exists(select 1 from storage.objects o where o.bucket_id=candidate.storage_bucket and o.name=candidate.storage_object_path)
      and not exists(select 1 from private.provider_document_scan_claims active where active.upload_id=candidate.id and active.leased_until>clock_timestamp())
    order by candidate.created_at,candidate.id for update skip locked limit p_limit
  loop
    insert into private.provider_document_scan_claims(upload_id,worker_id,leased_until)
    values(u.id,p_worker_id,clock_timestamp()+make_interval(secs=>p_lease_seconds))
    on conflict on constraint provider_document_scan_claims_pkey do update
      set worker_id=excluded.worker_id,lease_token=extensions.gen_random_uuid(),leased_until=excluded.leased_until,
          row_version=private.provider_document_scan_claims.row_version+1,claimed_at=clock_timestamp()
      where private.provider_document_scan_claims.leased_until<=clock_timestamp()
    returning*into c;
    if found then proof_id:=u.id;lease_token:=c.lease_token;worker_id:=c.worker_id;row_version:=c.row_version;attempt_count:=c.attempt_count;
      storage_bucket:=u.storage_bucket;storage_path:=u.storage_object_path;expected_sha256:=u.declared_sha256;media_type:=u.declared_mime_type;return next;end if;
  end loop;
end$$;

create function public.record_provider_document_scan_result(
  p_upload_id uuid,p_result text,p_engine_code text,p_engine_version text,p_computed_sha256 text,
  p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare u public.provider_document_scan_jobs%rowtype;s integer;i uuid;h text;r jsonb;prior private.provider_document_scan_idempotency%rowtype;
begin
  if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
  if p_result not in('CLEAN','INFECTED','ERROR')or p_engine_code!~'^[A-Z][A-Z0-9_.-]{2,79}$'
    or length(btrim(coalesce(p_engine_version,'')))not between 1 and 80 or coalesce(p_computed_sha256,'')!~'^[0-9a-f]{64}$'
    or length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200 then raise exception'INVALID_PROVIDER_DOCUMENT_SCAN'using errcode='22023';end if;
  h:=private.canonical_request_hash(jsonb_build_object('upload',p_upload_id,'result',p_result,'engine',p_engine_code,'version',p_engine_version,'sha256',p_computed_sha256));
  select*into prior from private.provider_document_scan_idempotency where upload_id=p_upload_id and key=p_idempotency_key;
  if found then if prior.request_hash<>h then raise exception'IDEMPOTENCY_CONFLICT'using errcode='23505';end if;return prior.response_body;end if;
  select*into u from public.provider_document_scan_jobs where id=p_upload_id for update;
  if not found or u.status<>'UPLOAD_PENDING'or u.scan_status<>'PENDING'then raise exception'PROVIDER_DOCUMENT_SCAN_STATE_INVALID'using errcode='55000';end if;
  if p_result='CLEAN'and p_computed_sha256<>u.declared_sha256 then raise exception'PROVIDER_DOCUMENT_SCAN_HASH_MISMATCH'using errcode='22000';end if;
  select coalesce(max(sequence),0)+1 into s from private.provider_document_scan_results where upload_id=u.id;
  insert into private.provider_document_scan_results(upload_id,sequence,result,engine_code,engine_version,computed_sha256,correlation_id)
  values(u.id,s,p_result,p_engine_code,btrim(p_engine_version),p_computed_sha256,p_correlation_id)returning id into i;
  update public.provider_document_scan_jobs set scan_status=p_result,scanned_at=clock_timestamp(),current_scan_result_id=i where id=u.id;
  r:=jsonb_build_object('outcome','PROVIDER_DOCUMENT_SCAN_RECORDED','proof_id',u.id,'scan_id',i,'result',p_result);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(u.provider_organization_id,null,'SERVICE','provider.document.scan.recorded','provider_document_upload',u.id::text,p_correlation_id,jsonb_build_object('result',p_result,'engine_code',p_engine_code),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
  values(u.provider_organization_id,'provider_document_upload',u.id::text,case when p_result='CLEAN'then'ProviderDocumentScanCleanV1'when p_result='INFECTED'then'ProviderDocumentQuarantinedV1'else'ProviderDocumentScanFailedV1'end,p_correlation_id,r,p_idempotency_key);
  insert into private.provider_document_scan_idempotency(upload_id,key,request_hash,response_body)values(u.id,p_idempotency_key,h,r);return r;
end$$;

create function public.complete_provider_document_scan_job(
  p_proof_id uuid,p_lease_token uuid,p_worker_id uuid,p_expected_row_version integer,
  p_result text,p_engine_code text,p_engine_version text,p_computed_sha256 text,p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $$declare c private.provider_document_scan_claims%rowtype;r jsonb;begin
  if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
  select*into c from private.provider_document_scan_claims where upload_id=p_proof_id for update;
  if not found or c.lease_token is distinct from p_lease_token or c.worker_id is distinct from p_worker_id or c.row_version is distinct from p_expected_row_version or c.leased_until<=clock_timestamp()then raise exception'PROVIDER_DOCUMENT_SCAN_LEASE_INVALID'using errcode='55000';end if;
  r:=public.record_provider_document_scan_result(p_proof_id,p_result,p_engine_code,p_engine_version,p_computed_sha256,p_idempotency_key,p_correlation_id);
  delete from private.provider_document_scan_claims where upload_id=p_proof_id;return r;
end$$;

create function public.fail_provider_document_scan_job(
  p_proof_id uuid,p_lease_token uuid,p_worker_id uuid,p_expected_row_version integer,
  p_failure_code text,p_computed_sha256 text,p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $$declare c private.provider_document_scan_claims%rowtype;n integer;r jsonb;u public.provider_document_scan_jobs%rowtype;begin
  if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
  if p_failure_code not in('SCANNER_UNAVAILABLE','SCANNER_INVALID_RESPONSE','STORAGE_DOWNLOAD_FAILED')or coalesce(p_computed_sha256,'')!~'^[0-9a-f]{64}$'then raise exception'INVALID_SCAN_FAILURE'using errcode='22023';end if;
  select*into c from private.provider_document_scan_claims where upload_id=p_proof_id for update;
  if not found or c.lease_token is distinct from p_lease_token or c.worker_id is distinct from p_worker_id or c.row_version is distinct from p_expected_row_version or c.leased_until<=clock_timestamp()then raise exception'PROVIDER_DOCUMENT_SCAN_LEASE_INVALID'using errcode='55000';end if;
  select*into u from public.provider_document_scan_jobs where id=p_proof_id;n:=c.attempt_count+1;
  insert into private.provider_document_scan_retry_history(upload_id,attempt,failure_code,worker_id,lease_token,correlation_id)values(p_proof_id,n,p_failure_code,p_worker_id,p_lease_token,p_correlation_id);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(u.provider_organization_id,null,'SERVICE',case when n>=5 then'provider.document.scan.dead_lettered'else'provider.document.scan.retry_scheduled'end,'provider_document_upload',p_proof_id::text,p_correlation_id,jsonb_build_object('attempt',n,'failure_code',p_failure_code),repeat('0',64));
  if n>=5 then r:=public.record_provider_document_scan_result(p_proof_id,'ERROR','MATRICIA_SCAN_DLQ','1.0.0',p_computed_sha256,'provider-document-scan-dlq:'||p_proof_id::text||':'||n,p_correlation_id);delete from private.provider_document_scan_claims where upload_id=p_proof_id;return jsonb_build_object('outcome','PROVIDER_DOCUMENT_SCAN_DEAD_LETTERED','proof_id',p_proof_id,'attempt',n,'scan',r);end if;
  update private.provider_document_scan_claims set attempt_count=n,row_version=row_version+1,lease_token=extensions.gen_random_uuid(),leased_until=clock_timestamp()+make_interval(secs=>least(900,30*(2^n)))where upload_id=p_proof_id;
  return jsonb_build_object('outcome','PROVIDER_DOCUMENT_SCAN_RETRY_SCHEDULED','proof_id',p_proof_id,'attempt',n,'failure_code',p_failure_code);
end$$;


create function private.enqueue_provider_document_scan()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$begin
 if new.reviewed_by is null then insert into public.provider_document_scan_jobs(document_version_id,provider_organization_id,storage_object_path,declared_sha256,declared_mime_type)
 values(new.id,new.provider_organization_id,new.storage_object_path,new.content_hash,new.metadata->>'declared_mime_type')on conflict(storage_object_path)do nothing;end if;return new;end$$;
create trigger provider_document_versions_enqueue_scan after insert on public.provider_document_versions for each row execute function private.enqueue_provider_document_scan();
-- Existing files are quarantined until a trusted worker has inspected their bytes.
insert into public.provider_document_scan_jobs(document_version_id,provider_organization_id,storage_object_path,declared_sha256,declared_mime_type)
 select distinct on(d.storage_object_path)d.id,d.provider_organization_id,d.storage_object_path,d.content_hash,r.declared_mime_type
 from public.provider_document_versions d join public.provider_document_upload_reservations r on r.storage_object_path=d.storage_object_path and r.status='BOUND'
 order by d.storage_object_path,d.version_number on conflict(storage_object_path)do nothing;
create function private.enforce_provider_document_clean_review()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$begin
 if new.status='VERIFIED'and not exists(select 1 from public.provider_document_scan_jobs j join private.provider_document_scan_results r on r.id=j.current_scan_result_id where j.storage_object_path=new.storage_object_path and j.provider_organization_id=new.provider_organization_id and j.scan_status='CLEAN'and r.result='CLEAN'and r.computed_sha256=new.content_hash)then raise exception'PROVIDER_DOCUMENT_SCAN_NOT_CLEAN'using errcode='55000';end if;return new;end$$;
create trigger provider_document_versions_clean_review before insert on public.provider_document_versions for each row execute function private.enforce_provider_document_clean_review();
-- Direct Storage reads must obey the same quarantine as the application download endpoint.
drop policy provider_qualification_storage_scoped_read on storage.objects;
create policy provider_qualification_storage_scoped_read on storage.objects for select to authenticated using(bucket_id='provider-qualification'and exists(select 1 from public.provider_document_versions d join public.provider_document_scan_jobs j on j.storage_object_path=d.storage_object_path where d.storage_object_path=name and j.scan_status='CLEAN'and(private.is_active_org_member(d.provider_organization_id,auth.uid())or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()))));
revoke all on function private.enqueue_provider_document_scan(),private.enforce_provider_document_clean_review()from public,anon,authenticated,service_role;
revoke all on function public.claim_provider_document_scan_jobs(uuid,integer,integer),public.record_provider_document_scan_result(uuid,text,text,text,text,text,uuid),public.complete_provider_document_scan_job(uuid,uuid,uuid,integer,text,text,text,text,text,uuid),public.fail_provider_document_scan_job(uuid,uuid,uuid,integer,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.claim_provider_document_scan_jobs(uuid,integer,integer),public.record_provider_document_scan_result(uuid,text,text,text,text,text,uuid),public.complete_provider_document_scan_job(uuid,uuid,uuid,integer,text,text,text,text,text,uuid),public.fail_provider_document_scan_job(uuid,uuid,uuid,integer,text,text,uuid)to service_role;
