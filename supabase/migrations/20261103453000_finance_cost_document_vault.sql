begin;
-- Finance evidence vault: real private files, immutable target and byte identity,
-- trusted leased scans, and audited retrieval before independent business review.
create function private.credit_economic_cost_target_v1(p_component text,p_target uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare f public.credit_economic_funding_sources_v1%rowtype;d public.benefit_redemptions%rowtype;receipt jsonb;org uuid;curr char(3);snapshot jsonb;
begin
 if p_component='PSP_FEE'then
  select*into f from public.credit_economic_funding_sources_v1 where id=p_target;
  if f.id is null or f.source_hash<>private.canonical_request_hash(f.source_snapshot)
   or not exists(select 1 from public.credit_economic_funding_evidence_v1 ev where ev.funding_source_id=f.id and ev.evidence_kind='NATIVE_CAPTURE'and ev.evidence_hash=f.source_snapshot->>'first_evidence_hash'and ev.evidence_hash=private.canonical_request_hash(ev.evidence_snapshot))
   or exists(select 1 from public.credit_pack_payment_events_v1 pe where pe.gateway||':'||pe.provider_environment||':'||pe.payment_reference=f.source_id and coalesce(private.payment_capture_has_adverse_fact_v1(pe.gateway,pe.provider_environment,pe.payment_reference),true))
  then raise exception'FINANCE_COST_CANONICAL_CAPTURE_REQUIRED'using errcode='55000';end if;
  org:=f.organization_id;curr:=f.currency;snapshot:=jsonb_build_object('funding_source_id',f.id,'source_hash',f.source_hash,'financial_journal_id',f.financial_journal_id,'gross_minor',f.gross_minor::text);
 elsif p_component='FULFILLMENT_COST'then
  select*into d from public.benefit_redemptions where id=p_target;receipt:=private.benefit_accepted_receipt_v1(d.id,d.delivery_proof_hash);
  if d.id is null or d.status<>'CONSUMED'or receipt is null then raise exception'FINANCE_COST_CANONICAL_RECEIPT_REQUIRED'using errcode='55000';end if;
  select book.franchise_organization_id,book.currency into org,curr from public.credit_economic_allocations_v1 alloc join public.credit_economic_consumption_facts_v1 fact on fact.id=alloc.consumption_fact_id join public.franchise_pnl_books book on book.id=alloc.book_id where fact.redemption_id=d.id order by alloc.created_at,alloc.id limit 1;
  if org is null or exists(select 1 from public.credit_economic_consumption_facts_v1 fact left join public.credit_economic_allocations_v1 alloc on alloc.consumption_fact_id=fact.id and alloc.allocation_kind='PURCHASE_CONSUMPTION'left join public.franchise_pnl_books book on book.id=alloc.book_id where fact.redemption_id=d.id and(alloc.id is null or book.franchise_organization_id is distinct from org or book.currency is distinct from curr or private.credit_lot_funding_status_v1(fact.credit_lot_id)is distinct from'ELIGIBLE'))then raise exception'FINANCE_COST_COMPLETE_ALLOCATION_REQUIRED'using errcode='55000';end if;
  snapshot:=jsonb_build_object('redemption_id',d.id,'receipt',receipt,'facts',(select jsonb_agg(jsonb_build_object('id',fact.id,'source_hash',fact.source_hash,'quantity',fact.consumed_quantity::text)order by fact.movement_id)from public.credit_economic_consumption_facts_v1 fact where fact.redemption_id=d.id));
 else raise exception'INVALID_FINANCE_COST_COMPONENT'using errcode='22023';end if;
 return jsonb_build_object('component',p_component,'target_id',p_target,'organization_id',org,'currency',curr,'target',snapshot);
end$$;
revoke all on function private.credit_economic_cost_target_v1(text,uuid)from public,anon,authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('finance-cost-proofs','finance-cost-proofs',false,10485760,array['application/pdf','image/png','image/jpeg'])on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table public.finance_cost_document_uploads_v1(
 id uuid primary key default extensions.gen_random_uuid(),component text not null check(component in('PSP_FEE','FULFILLMENT_COST')),target_id uuid not null,organization_id uuid not null references public.organizations(id),
 target_snapshot jsonb not null,target_hash text not null check(target_hash~'^[a-f0-9]{64}$'),
 storage_bucket text not null default'finance-cost-proofs'check(storage_bucket='finance-cost-proofs'),storage_path text not null unique,
 file_name text not null check(length(file_name)between 3 and 255),mime_type text not null check(mime_type in('application/pdf','image/png','image/jpeg')),
 size_bytes integer not null check(size_bytes between 1 and 10485760),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 status text not null default'RESERVED'check(status in('RESERVED','UPLOADED')),scan_status text not null default'PENDING'check(scan_status in('PENDING','CLEAN','REJECTED','ERROR')),
 scan_result_id uuid,row_version integer not null default 1,attempt_count integer not null default 0 check(attempt_count between 0 and 5),next_attempt_at timestamptz not null default clock_timestamp(),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),uploaded_at timestamptz,idempotency_key uuid not null,unique(created_by,idempotency_key)
);
create table private.finance_cost_document_scan_claims_v1(upload_id uuid primary key references public.finance_cost_document_uploads_v1(id),worker_id uuid not null,lease_token uuid not null,row_version integer not null,leased_until timestamptz not null);
create table private.finance_cost_document_scan_results_v1(
 id uuid primary key default extensions.gen_random_uuid(),upload_id uuid not null references public.finance_cost_document_uploads_v1(id),result text not null check(result in('CLEAN','INFECTED','ERROR')),
 computed_sha256 text,computed_size_bytes integer,engine_code text not null,engine_version text not null,worker_id uuid not null,lease_token uuid not null,row_version integer not null,
 created_at timestamptz not null default clock_timestamp(),unique(upload_id,lease_token)
);
alter table public.finance_cost_document_uploads_v1 add foreign key(scan_result_id)references private.finance_cost_document_scan_results_v1(id);
create table private.finance_cost_document_read_capabilities_v1(id uuid primary key default extensions.gen_random_uuid(),upload_id uuid not null references public.finance_cost_document_uploads_v1(id),actor_id uuid not null references auth.users(id),scan_result_id uuid not null,sha256 text not null,expires_at timestamptz not null);
create table private.finance_cost_document_read_receipts_v1(id uuid primary key default extensions.gen_random_uuid(),capability_id uuid not null unique references private.finance_cost_document_read_capabilities_v1(id),upload_id uuid not null references public.finance_cost_document_uploads_v1(id),actor_id uuid not null references auth.users(id),scan_result_id uuid not null,sha256 text not null,read_at timestamptz not null default clock_timestamp());
create table public.finance_cost_document_revocations_v1(upload_id uuid primary key references public.finance_cost_document_uploads_v1(id),reason text not null check(length(btrim(reason))between 10 and 2000),revoked_by uuid not null references auth.users(id),revoked_at timestamptz not null default clock_timestamp());
alter table public.finance_cost_document_uploads_v1 enable row level security;
alter table public.finance_cost_document_revocations_v1 enable row level security;
revoke all on public.finance_cost_document_uploads_v1,public.finance_cost_document_revocations_v1 from public,anon,authenticated,service_role;
grant select on public.finance_cost_document_uploads_v1,public.finance_cost_document_revocations_v1 to authenticated;
create policy finance_cost_doc_read on public.finance_cost_document_uploads_v1 for select to authenticated using(private.credit_revenue_finance_access_v1()is true);
create policy finance_cost_doc_revocation_read on public.finance_cost_document_revocations_v1 for select to authenticated using(private.credit_revenue_finance_access_v1()is true);
create trigger finance_cost_doc_revocation_immutable before update or delete on public.finance_cost_document_revocations_v1 for each row execute function private.prevent_update_delete();
do $$declare t text;begin foreach t in array array['finance_cost_document_scan_claims_v1','finance_cost_document_scan_results_v1','finance_cost_document_read_capabilities_v1','finance_cost_document_read_receipts_v1']loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);end loop;end$$;
create trigger finance_cost_scan_result_immutable before update or delete on private.finance_cost_document_scan_results_v1 for each row execute function private.prevent_update_delete();
create trigger finance_cost_read_receipt_immutable before update or delete on private.finance_cost_document_read_receipts_v1 for each row execute function private.prevent_update_delete();
create function private.protect_finance_cost_document_source_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if tg_op='DELETE'then raise exception'FINANCE_COST_DOCUMENT_IMMUTABLE'using errcode='55000';end if;
 if row(new.id,new.component,new.target_id,new.organization_id,new.target_snapshot,new.target_hash,new.storage_bucket,new.storage_path,new.file_name,new.mime_type,new.size_bytes,new.sha256,new.created_by,new.created_at,new.idempotency_key)is distinct from row(old.id,old.component,old.target_id,old.organization_id,old.target_snapshot,old.target_hash,old.storage_bucket,old.storage_path,old.file_name,old.mime_type,old.size_bytes,old.sha256,old.created_by,old.created_at,old.idempotency_key)then raise exception'FINANCE_COST_DOCUMENT_IMMUTABLE'using errcode='55000';end if;return new;
end$$;
create trigger finance_cost_document_source_immutable before update or delete on public.finance_cost_document_uploads_v1 for each row execute function private.protect_finance_cost_document_source_v1();
revoke all on function private.protect_finance_cost_document_source_v1()from public,anon,authenticated,service_role;

create function public.reserve_finance_cost_document_v1(p_component text,p_target_id uuid,p_file_name text,p_mime_type text,p_size_bytes integer,p_sha256 text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare context jsonb;h text;u public.finance_cost_document_uploads_v1%rowtype;id uuid:=extensions.gen_random_uuid();
begin
 if private.credit_revenue_finance_access_v1(auth.uid(),true)is distinct from true then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';end if;
 if p_idempotency_key is null or length(btrim(coalesce(p_file_name,'')))not between 3 and 255 or p_file_name~'[\\/[:cntrl:]]'or p_size_bytes is null or p_size_bytes not between 1 and 10485760 or coalesce(p_sha256,'')!~'^[a-f0-9]{64}$'or p_mime_type is null or p_mime_type not in('application/pdf','image/jpeg','image/png')
  or(p_mime_type='application/pdf'and lower(p_file_name)not like'%.pdf')or(p_mime_type='image/png'and lower(p_file_name)not like'%.png')or(p_mime_type='image/jpeg'and lower(p_file_name)not like'%.jpg'and lower(p_file_name)not like'%.jpeg')then raise exception'INVALID_FINANCE_COST_DOCUMENT'using errcode='22023';end if;
 context:=private.credit_economic_cost_target_v1(p_component,p_target_id);h:=private.canonical_request_hash(context);
 if private.is_active_org_member((context->>'organization_id')::uuid,auth.uid())then raise exception'FINANCE_COST_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('finance-cost-document:'||auth.uid()::text||':'||p_idempotency_key::text,0));
 select*into u from public.finance_cost_document_uploads_v1 where created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if u.id is not null then
  if u.component is distinct from p_component or u.target_id is distinct from p_target_id or u.file_name<>btrim(p_file_name)or u.mime_type<>p_mime_type or u.size_bytes<>p_size_bytes or u.sha256<>p_sha256 or u.target_hash<>h then raise exception'FINANCE_COST_DOCUMENT_REPLAY_MISMATCH'using errcode='22000';end if;
 else
  insert into public.finance_cost_document_uploads_v1(id,component,target_id,organization_id,target_snapshot,target_hash,storage_path,file_name,mime_type,size_bytes,sha256,created_by,idempotency_key)
   values(id,p_component,p_target_id,(context->>'organization_id')::uuid,context,h,'finance-cost/'||id::text,btrim(p_file_name),p_mime_type,p_size_bytes,p_sha256,auth.uid(),p_idempotency_key)returning*into u;
 end if;
 return jsonb_build_object('upload_id',u.id,'bucket',u.storage_bucket,'path',u.storage_path,'status',u.status,'scan_status',u.scan_status,'sha256',u.sha256,'size_bytes',u.size_bytes,'mime_type',u.mime_type);
end$$;

create function private.finance_cost_storage_write_allowed_v1(p_path text)returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select private.credit_revenue_finance_access_v1(auth.uid(),true)is true and exists(select 1 from public.finance_cost_document_uploads_v1 u where u.storage_path=p_path and u.created_by=auth.uid()and u.status='RESERVED'and u.created_at>clock_timestamp()-interval'1 day')
$$;
create function private.finance_cost_storage_read_allowed_v1(p_path text)returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select private.credit_revenue_finance_access_v1()is true and exists(select 1 from public.finance_cost_document_uploads_v1 u join private.finance_cost_document_scan_results_v1 s on s.id=u.scan_result_id and s.upload_id=u.id and s.result='CLEAN'and s.computed_sha256=u.sha256 and s.computed_size_bytes=u.size_bytes where u.storage_path=p_path and u.status='UPLOADED'and u.scan_status='CLEAN'and not exists(select 1 from public.finance_cost_document_revocations_v1 r where r.upload_id=u.id))
$$;
revoke all on function private.finance_cost_storage_write_allowed_v1(text),private.finance_cost_storage_read_allowed_v1(text)from public,anon,authenticated,service_role;
grant execute on function private.finance_cost_storage_write_allowed_v1(text),private.finance_cost_storage_read_allowed_v1(text)to authenticated;
create policy finance_cost_doc_storage_insert on storage.objects for insert to authenticated with check(bucket_id='finance-cost-proofs'and private.finance_cost_storage_write_allowed_v1(name));
-- No direct authenticated SELECT or signed download: the server-authorized
-- endpoint records actual verified retrieval before returning private bytes.

create function public.get_finance_cost_upload_context_v1(p_upload_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare u public.finance_cost_document_uploads_v1%rowtype;begin
 if private.credit_revenue_finance_access_v1(auth.uid(),true)is distinct from true then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';end if;
 select*into u from public.finance_cost_document_uploads_v1 where id=p_upload_id and created_by=auth.uid();
 if u.id is null then raise exception'FINANCE_COST_DOCUMENT_NOT_FOUND'using errcode='42501';end if;
 return jsonb_build_object('upload_id',u.id,'bucket',u.storage_bucket,'path',u.storage_path,'sha256',u.sha256,'size_bytes',u.size_bytes,'mime_type',u.mime_type,'status',u.status,'scan_status',u.scan_status);
end$$;
create function public.commit_finance_cost_document_upload_v1(p_upload_id uuid,p_computed_sha256 text,p_computed_size_bytes integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u public.finance_cost_document_uploads_v1%rowtype;
begin
 if private.credit_revenue_finance_access_v1(auth.uid(),true)is distinct from true then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';end if;
 select*into u from public.finance_cost_document_uploads_v1 where id=p_upload_id and created_by=auth.uid()for update;
 if u.id is null then raise exception'FINANCE_COST_DOCUMENT_NOT_FOUND'using errcode='42501';end if;
 if p_computed_sha256 is distinct from u.sha256 or p_computed_size_bytes is distinct from u.size_bytes or not exists(select 1 from storage.objects o where o.bucket_id=u.storage_bucket and o.name=u.storage_path and o.metadata->>'mimetype'=u.mime_type and o.metadata->>'size'=u.size_bytes::text)then raise exception'FINANCE_COST_DOCUMENT_BYTES_MISMATCH'using errcode='55000';end if;
 if u.status='RESERVED'then
  update public.finance_cost_document_uploads_v1 set status='UPLOADED',uploaded_at=clock_timestamp(),row_version=row_version+1 where id=u.id;
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(u.organization_id,'finance_cost_document',u.id::text,'FinanceCostDocumentUploadedV1',u.id,jsonb_build_object('upload_id',u.id),'finance-cost-document-uploaded:'||u.id::text);
 end if;
 return jsonb_build_object('outcome','FINANCE_COST_DOCUMENT_UPLOADED','upload_id',u.id,'scan_status',u.scan_status);
end$$;

create function public.claim_finance_cost_document_scan_jobs_v1(p_worker_id uuid,p_upload_id uuid default null,p_limit integer default 1,p_lease_seconds integer default 90)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u public.finance_cost_document_uploads_v1%rowtype;token uuid;result jsonb:='[]';
begin
 if auth.role()is distinct from'service_role'then raise exception'FINANCE_COST_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
 if p_worker_id is null or p_limit is null or p_limit not between 1 and 5 or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then raise exception'INVALID_FINANCE_COST_SCAN_CLAIM'using errcode='22023';end if;
 for u in select proof.*from public.finance_cost_document_uploads_v1 proof where proof.status='UPLOADED'and proof.scan_status in('PENDING','ERROR')and proof.attempt_count<5 and proof.next_attempt_at<=clock_timestamp()and(p_upload_id is null or proof.id=p_upload_id)
  and not exists(select 1 from private.finance_cost_document_scan_claims_v1 claim where claim.upload_id=proof.id and claim.leased_until>clock_timestamp())order by proof.next_attempt_at,proof.created_at,proof.id for update skip locked limit p_limit loop
  token:=extensions.gen_random_uuid();
  update public.finance_cost_document_uploads_v1 set row_version=row_version+1,attempt_count=attempt_count+1 where id=u.id returning*into u;
  insert into private.finance_cost_document_scan_claims_v1(upload_id,worker_id,lease_token,row_version,leased_until)values(u.id,p_worker_id,token,u.row_version,clock_timestamp()+make_interval(secs=>p_lease_seconds))on conflict(upload_id)do update set worker_id=excluded.worker_id,lease_token=excluded.lease_token,row_version=excluded.row_version,leased_until=excluded.leased_until;
  result:=result||jsonb_build_array(jsonb_build_object('upload_id',u.id,'lease_token',token,'row_version',u.row_version,'bucket',u.storage_bucket,'path',u.storage_path,'expected_sha256',u.sha256,'mime_type',u.mime_type,'size_bytes',u.size_bytes));
 end loop;return result;
end$$;
create function public.complete_finance_cost_document_scan_v1(p_upload_id uuid,p_worker_id uuid,p_lease_token uuid,p_expected_row_version integer,p_result text,p_computed_sha256 text,p_computed_size_bytes integer,p_engine_code text,p_engine_version text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u public.finance_cost_document_uploads_v1%rowtype;claim private.finance_cost_document_scan_claims_v1%rowtype;prior private.finance_cost_document_scan_results_v1%rowtype;result_id uuid:=extensions.gen_random_uuid();environment text;
begin
 if auth.role()is distinct from'service_role'then raise exception'FINANCE_COST_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
 select*into u from public.finance_cost_document_uploads_v1 where id=p_upload_id for update;
 select*into prior from private.finance_cost_document_scan_results_v1 where upload_id=p_upload_id and lease_token=p_lease_token;
 if prior.id is not null then
  if prior.worker_id is distinct from p_worker_id or prior.row_version is distinct from p_expected_row_version or prior.result is distinct from p_result or prior.computed_sha256 is distinct from p_computed_sha256 or prior.computed_size_bytes is distinct from p_computed_size_bytes then raise exception'FINANCE_COST_SCAN_REPLAY_MISMATCH'using errcode='22000';end if;
  return jsonb_build_object('outcome','FINANCE_COST_DOCUMENT_SCAN_RECORDED','upload_id',u.id,'scan_status',u.scan_status);
 end if;
 select*into claim from private.finance_cost_document_scan_claims_v1 where upload_id=p_upload_id;
 if u.id is null or claim.upload_id is null or claim.worker_id is distinct from p_worker_id or claim.lease_token is distinct from p_lease_token or claim.row_version is distinct from p_expected_row_version or claim.leased_until<=clock_timestamp()or u.row_version<>p_expected_row_version then raise exception'FINANCE_COST_SCAN_LEASE_STALE'using errcode='40001';end if;
 if p_result is null or p_result not in('CLEAN','INFECTED','ERROR')or(p_computed_sha256 is not null and p_computed_sha256!~'^[a-f0-9]{64}$')or(p_computed_size_bytes is not null and p_computed_size_bytes<0)or(p_result<>'ERROR'and(p_computed_sha256 is null or p_computed_size_bytes is null)) or coalesce(p_engine_code,'')!~'^[A-Z][A-Z0-9_.-]{2,79}$'or length(btrim(coalesce(p_engine_version,'')))not between 1 and 80 then raise exception'INVALID_FINANCE_COST_SCAN_RESULT'using errcode='22023';end if;
 select configuration.environment into environment from private.admin_execution_environment_v1 configuration where configuration.singleton;
 if p_engine_code='MATRICIA_SANDBOX'and environment is distinct from'DEVELOPMENT'and environment is distinct from'STAGING'then raise exception'FINANCE_COST_REAL_SCANNER_REQUIRED'using errcode='42501';end if;
 if p_result='CLEAN'and(p_computed_sha256 is distinct from u.sha256 or p_computed_size_bytes is distinct from u.size_bytes or not exists(select 1 from storage.objects object where object.bucket_id=u.storage_bucket and object.name=u.storage_path and object.metadata->>'mimetype'=u.mime_type and object.metadata->>'size'=u.size_bytes::text))then raise exception'FINANCE_COST_DOCUMENT_BYTES_MISMATCH'using errcode='55000';end if;
 insert into private.finance_cost_document_scan_results_v1(id,upload_id,result,computed_sha256,computed_size_bytes,engine_code,engine_version,worker_id,lease_token,row_version)values(result_id,u.id,p_result,p_computed_sha256,p_computed_size_bytes,p_engine_code,p_engine_version,p_worker_id,p_lease_token,p_expected_row_version);
 update public.finance_cost_document_uploads_v1 set scan_status=case p_result when'CLEAN'then'CLEAN'when'INFECTED'then'REJECTED'else'ERROR'end,scan_result_id=result_id,row_version=row_version+1,next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,30*(2^attempt_count)::integer))where id=u.id returning*into u;
 delete from private.finance_cost_document_scan_claims_v1 where upload_id=u.id;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(u.organization_id,'SERVICE','finance.cost.document.scanned','finance_cost_document',u.id::text,result_id,jsonb_build_object('result',p_result,'scan_result_id',result_id,'sha256',p_computed_sha256,'size_bytes',p_computed_size_bytes),repeat('0',64));
 return jsonb_build_object('outcome','FINANCE_COST_DOCUMENT_SCAN_RECORDED','upload_id',u.id,'scan_status',u.scan_status);
end$$;
create function public.retry_finance_cost_document_scan_v1(p_upload_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u public.finance_cost_document_uploads_v1%rowtype;
begin
 if private.credit_revenue_finance_access_v1(auth.uid(),true)is distinct from true then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';end if;
 select*into u from public.finance_cost_document_uploads_v1 where id=p_upload_id and created_by=auth.uid()for update;
 if u.id is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_FINANCE_COST_SCAN_RETRY'using errcode='22023';end if;
 if u.status<>'UPLOADED'or u.scan_status not in('PENDING','ERROR')then raise exception'FINANCE_COST_SCAN_RETRY_UNAVAILABLE'using errcode='55000';end if;
 if exists(select 1 from private.finance_cost_document_scan_claims_v1 where upload_id=u.id and leased_until>clock_timestamp())then raise exception'FINANCE_COST_SCAN_BUSY'using errcode='55P03';end if;
 update public.finance_cost_document_uploads_v1 set scan_status='PENDING',next_attempt_at=clock_timestamp(),attempt_count=0,row_version=row_version+1 where id=u.id returning*into u;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(u.organization_id,auth.uid(),'USER','finance.cost.document.scan_retried','finance_cost_document',u.id::text,u.id,jsonb_build_object('reason',btrim(p_reason),'row_version',u.row_version),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(u.organization_id,'finance_cost_document',u.id::text,'FinanceCostDocumentUploadedV1',u.id,jsonb_build_object('upload_id',u.id),'finance-cost-document-retry:'||u.id::text||':'||u.row_version::text);
 return jsonb_build_object('outcome','FINANCE_COST_DOCUMENT_RETRY_SCHEDULED','upload_id',u.id,'scan_status',u.scan_status);
end$$;

create function public.authorize_finance_cost_document_read_v1(p_upload_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u public.finance_cost_document_uploads_v1%rowtype;cap uuid:=extensions.gen_random_uuid();
begin
 if private.credit_revenue_finance_access_v1()is distinct from true then raise exception'FINANCE_COST_DOCUMENT_READ_DENIED'using errcode='42501';end if;
 select*into u from public.finance_cost_document_uploads_v1 where id=p_upload_id;
 if u.id is null or private.finance_cost_storage_read_allowed_v1(u.storage_path)is distinct from true then raise exception'FINANCE_COST_DOCUMENT_NOT_CLEAN'using errcode='55000';end if;
 insert into private.finance_cost_document_read_capabilities_v1(id,upload_id,actor_id,scan_result_id,sha256,expires_at)values(cap,u.id,auth.uid(),u.scan_result_id,u.sha256,clock_timestamp()+interval'2 minutes');
 return jsonb_build_object('upload_id',u.id,'bucket',u.storage_bucket,'path',u.storage_path,'sha256',u.sha256,'size_bytes',u.size_bytes,'mime_type',u.mime_type,'file_name',u.file_name,'read_capability_id',cap,'actor_id',auth.uid());
end$$;
create function public.record_finance_cost_document_read_v1(p_capability_id uuid,p_computed_sha256 text,p_computed_size_bytes integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare cap private.finance_cost_document_read_capabilities_v1%rowtype;u public.finance_cost_document_uploads_v1%rowtype;receipt uuid:=extensions.gen_random_uuid();
begin
 if auth.role()is distinct from'service_role'then raise exception'FINANCE_COST_DOCUMENT_SERVER_REQUIRED'using errcode='42501';end if;
 select*into cap from private.finance_cost_document_read_capabilities_v1 where id=p_capability_id for update;
 select*into u from public.finance_cost_document_uploads_v1 where id=cap.upload_id;
 if cap.id is null or cap.expires_at<=clock_timestamp()or u.id is null or u.scan_status<>'CLEAN'or cap.scan_result_id is distinct from u.scan_result_id or cap.sha256 is distinct from u.sha256 or p_computed_sha256 is distinct from u.sha256 or p_computed_size_bytes is distinct from u.size_bytes or exists(select 1 from public.finance_cost_document_revocations_v1 r where r.upload_id=u.id)then raise exception'FINANCE_COST_DOCUMENT_READ_CHANGED'using errcode='40001';end if;
 if not exists(select 1 from private.finance_cost_document_read_receipts_v1 where capability_id=cap.id)then
  insert into private.finance_cost_document_read_receipts_v1(id,capability_id,upload_id,actor_id,scan_result_id,sha256)values(receipt,cap.id,u.id,cap.actor_id,u.scan_result_id,u.sha256);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(u.organization_id,cap.actor_id,'USER','finance.cost.document.downloaded','finance_cost_document',u.id::text,receipt,jsonb_build_object('sha256',u.sha256,'size_bytes',u.size_bytes,'scan_result_id',u.scan_result_id),repeat('0',64));
 end if;
 return jsonb_build_object('outcome','FINANCE_COST_DOCUMENT_READ_RECORDED','upload_id',u.id);
end$$;
create function public.revoke_finance_cost_document_v1(p_upload_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u public.finance_cost_document_uploads_v1%rowtype;
begin
 if private.credit_revenue_finance_access_v1(auth.uid(),true)is distinct from true then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';end if;
 select*into u from public.finance_cost_document_uploads_v1 where id=p_upload_id for update;
 if u.id is null or u.created_by=auth.uid()or private.is_active_org_member(u.organization_id,auth.uid())then raise exception'FINANCE_COST_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_FINANCE_COST_REVOCATION'using errcode='22023';end if;
 if not exists(select 1 from public.finance_cost_document_revocations_v1 r where r.upload_id=u.id)then
  insert into public.finance_cost_document_revocations_v1(upload_id,reason,revoked_by)values(u.id,btrim(p_reason),auth.uid());
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(u.organization_id,auth.uid(),'USER','finance.cost.document.revoked','finance_cost_document',u.id::text,u.id,jsonb_build_object('reason',btrim(p_reason),'sha256',u.sha256),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(u.organization_id,'finance_cost_document',u.id::text,'FinanceCostDocumentRevokedV1',u.id,jsonb_build_object('upload_id',u.id),'finance-cost-document-revoked:'||u.id::text);
 end if;
 return jsonb_build_object('outcome','FINANCE_COST_DOCUMENT_REVOKED','upload_id',u.id);
end$$;

do $$declare signature regprocedure;begin
 for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array['reserve_finance_cost_document_v1','get_finance_cost_upload_context_v1','commit_finance_cost_document_upload_v1','retry_finance_cost_document_scan_v1','authorize_finance_cost_document_read_v1','revoke_finance_cost_document_v1'])loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);execute format('grant execute on function %s to authenticated',signature);
 end loop;
 for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array['claim_finance_cost_document_scan_jobs_v1','complete_finance_cost_document_scan_v1','record_finance_cost_document_read_v1'])loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);execute format('grant execute on function %s to service_role',signature);
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
