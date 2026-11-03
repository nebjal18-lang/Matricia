-- Reject malformed/null lease fencing for both provider queues.
create or replace function public.complete_provider_payment_proof_scan_job(
  p_proof_id uuid,p_lease_token uuid,p_worker_id uuid,p_expected_row_version integer,
  p_result text,p_engine_code text,p_engine_version text,p_computed_sha256 text,p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $$declare c private.provider_payment_proof_scan_claims%rowtype;r jsonb;begin
  if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
  select*into c from private.provider_payment_proof_scan_claims where upload_id=p_proof_id for update;
  if not found or c.lease_token is distinct from p_lease_token or c.worker_id is distinct from p_worker_id or c.row_version is distinct from p_expected_row_version or c.leased_until<=clock_timestamp()then raise exception'PROVIDER_PAYMENT_PROOF_SCAN_LEASE_INVALID'using errcode='55000';end if;
  r:=public.record_provider_payment_proof_scan_result(p_proof_id,p_result,p_engine_code,p_engine_version,p_computed_sha256,p_idempotency_key,p_correlation_id);
  delete from private.provider_payment_proof_scan_claims where upload_id=p_proof_id;return r;
end$$;
create or replace function public.fail_provider_payment_proof_scan_job(
  p_proof_id uuid,p_lease_token uuid,p_worker_id uuid,p_expected_row_version integer,
  p_failure_code text,p_computed_sha256 text,p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $$declare c private.provider_payment_proof_scan_claims%rowtype;n integer;r jsonb;u public.provider_payment_proof_uploads%rowtype;begin
  if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
  if p_failure_code not in('SCANNER_UNAVAILABLE','SCANNER_INVALID_RESPONSE','STORAGE_DOWNLOAD_FAILED')or coalesce(p_computed_sha256,'')!~'^[0-9a-f]{64}$'then raise exception'INVALID_SCAN_FAILURE'using errcode='22023';end if;
  select*into c from private.provider_payment_proof_scan_claims where upload_id=p_proof_id for update;
  if not found or c.lease_token is distinct from p_lease_token or c.worker_id is distinct from p_worker_id or c.row_version is distinct from p_expected_row_version or c.leased_until<=clock_timestamp()then raise exception'PROVIDER_PAYMENT_PROOF_SCAN_LEASE_INVALID'using errcode='55000';end if;
  select*into u from public.provider_payment_proof_uploads where id=p_proof_id;n:=c.attempt_count+1;
  insert into private.provider_payment_proof_scan_retry_history(upload_id,attempt,failure_code,worker_id,lease_token,correlation_id)values(p_proof_id,n,p_failure_code,p_worker_id,p_lease_token,p_correlation_id);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(u.provider_organization_id,null,'SERVICE',case when n>=5 then'provider.payment.proof.scan.dead_lettered'else'provider.payment.proof.scan.retry_scheduled'end,'provider_payment_proof_upload',p_proof_id::text,p_correlation_id,jsonb_build_object('attempt',n,'failure_code',p_failure_code),repeat('0',64));
  if n>=5 then r:=public.record_provider_payment_proof_scan_result(p_proof_id,'ERROR','MATRICIA_SCAN_DLQ','1.0.0',p_computed_sha256,'provider-payment-proof-scan-dlq:'||p_proof_id::text||':'||n,p_correlation_id);delete from private.provider_payment_proof_scan_claims where upload_id=p_proof_id;return jsonb_build_object('outcome','PROVIDER_PAYMENT_PROOF_SCAN_DEAD_LETTERED','proof_id',p_proof_id,'attempt',n,'scan',r);end if;
  update private.provider_payment_proof_scan_claims set attempt_count=n,row_version=row_version+1,lease_token=extensions.gen_random_uuid(),leased_until=clock_timestamp()+make_interval(secs=>least(900,30*(2^n)))where upload_id=p_proof_id;
  return jsonb_build_object('outcome','PROVIDER_PAYMENT_PROOF_SCAN_RETRY_SCHEDULED','proof_id',p_proof_id,'attempt',n,'failure_code',p_failure_code);
end$$;
create or replace function public.complete_provider_document_scan_job(
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
create or replace function public.fail_provider_document_scan_job(
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
