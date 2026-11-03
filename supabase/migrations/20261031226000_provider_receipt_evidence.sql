-- Both financial proof kinds share the existing trusted scanner; binding targets remain explicit.
alter table public.provider_payment_proof_uploads add column purpose text not null default 'PAYMENT' check(purpose in('PAYMENT','PAYABLE')),
 add column payable_event_id uuid;
alter table public.provider_payment_proof_uploads add foreign key(provider_organization_id,payable_event_id)references public.provider_payable_events(provider_organization_id,id)on delete restrict;
do $$declare item record;begin
 for item in select conname from pg_constraint where conrelid='public.provider_payment_proof_uploads'::regclass and contype='c'and pg_get_constraintdef(oid)like'%status%'and pg_get_constraintdef(oid)like'%bound_at%'loop execute format('alter table public.provider_payment_proof_uploads drop constraint %I',item.conname);end loop;
end$$;
alter table public.provider_payment_proof_uploads add constraint provider_financial_proof_binding_check check(
 (status='UPLOAD_PENDING'and payment_id is null and payable_event_id is null and bound_at is null)
 or(status='BOUND'and bound_at is not null and((purpose='PAYMENT'and payment_id is not null and payable_event_id is null)or(purpose='PAYABLE'and payable_event_id is not null and payment_id is null)))
);
create table public.provider_payable_event_proofs(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null,
 payable_event_id uuid not null,upload_id uuid not null unique,storage_bucket text not null default'provider-qualification'check(storage_bucket='provider-qualification'),
 storage_object_path text not null unique,original_file_name text not null,mime_type text not null check(mime_type in('application/pdf','image/jpeg','image/png')),
 size_bytes bigint not null check(size_bytes between 1 and 10485760),sha256 text not null check(sha256~'^[0-9a-f]{64}$'),
 scan_result_id uuid not null references private.provider_payment_proof_scan_results(id),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(provider_organization_id,payable_event_id)references public.provider_payable_events(provider_organization_id,id),
 foreign key(provider_organization_id,upload_id)references public.provider_payment_proof_uploads(provider_organization_id,id),unique(provider_organization_id,payable_event_id)
);
alter table public.provider_payable_event_proofs enable row level security;
revoke all on public.provider_payable_event_proofs from public,anon,authenticated,service_role;
grant select on public.provider_payable_event_proofs to authenticated;
create policy provider_payable_proof_read on public.provider_payable_event_proofs for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid()));
create trigger provider_payable_proof_immutable before update or delete on public.provider_payable_event_proofs for each row execute function private.prevent_update_delete();
create policy provider_payable_proof_storage_read on storage.objects for select to authenticated using(bucket_id='provider-qualification'and exists(select 1 from public.provider_payable_event_proofs p where p.storage_object_path=name and private.provider_billing_access(p.provider_organization_id,auth.uid())));
create function public.begin_provider_receipt_proof_upload(p_provider_organization_id uuid,p_original_file_name text,p_declared_mime_type text,p_declared_size_bytes bigint,p_declared_sha256 text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r jsonb;u public.provider_payment_proof_uploads%rowtype;
begin
 r:=public.begin_provider_payment_proof_upload(p_provider_organization_id,p_original_file_name,p_declared_mime_type,p_declared_size_bytes,p_declared_sha256,'receipt:'||p_idempotency_key,p_correlation_id);
 select * into u from public.provider_payment_proof_uploads where id=(r->>'upload_id')::uuid for update;
 if u.actor_user_id is distinct from auth.uid()or(u.purpose<>'PAYABLE'and u.status<>'UPLOAD_PENDING')then raise exception'RECEIPT_PROOF_RESERVATION_MISMATCH'using errcode='42501';end if;
 if u.purpose<>'PAYABLE'then update public.provider_payment_proof_uploads set purpose='PAYABLE'where id=u.id;end if;return r;
end$$;
revoke all on function public.begin_provider_receipt_proof_upload(uuid,text,text,bigint,text,text,uuid)from public,anon,service_role;
grant execute on function public.begin_provider_receipt_proof_upload(uuid,text,text,bigint,text,text,uuid)to authenticated;
-- Keep the mature tax/commission implementation, reachable only through the archival guard.
alter function public.record_provider_payable_event(uuid,text,date,character,bigint,text,text,text,uuid)rename to record_provider_payable_event_pre_archive_v1;
revoke all on function public.record_provider_payable_event_pre_archive_v1(uuid,text,date,character,bigint,text,text,text,uuid)from public,anon,authenticated,service_role;
create function public.record_provider_payable_event(p_mission_id uuid,p_event_type text,p_occurred_on date,p_currency char(3),p_gross_amount_minor bigint,p_client_receipt_reference text,p_proof_hash text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare r jsonb;e public.provider_payable_events%rowtype;u public.provider_payment_proof_uploads%rowtype;object_record record;proof uuid;
begin
 -- A missing or quarantined file rolls back the entire financial command, including its audit and Outbox.
 r:=public.record_provider_payable_event_pre_archive_v1(p_mission_id,p_event_type,p_occurred_on,p_currency,p_gross_amount_minor,p_client_receipt_reference,p_proof_hash,p_idempotency_key,p_correlation_id);
 select * into e from public.provider_payable_events where id=(r->>'payable_event_id')::uuid;
 select id into proof from public.provider_payable_event_proofs where payable_event_id=e.id and created_by=auth.uid()and sha256=p_proof_hash;
 if found then return r||jsonb_build_object('receipt_proof_id',proof);end if;
 select * into u from public.provider_payment_proof_uploads where provider_organization_id=e.provider_organization_id and actor_user_id=auth.uid()and purpose='PAYABLE'and declared_sha256=p_proof_hash and status='UPLOAD_PENDING'and expires_at>clock_timestamp()order by created_at desc,id desc limit 1 for update;
 if not found then raise exception'RECEIPT_PROOF_UPLOAD_REQUIRED'using errcode='23514';end if;
 if u.scan_status<>'CLEAN'or not exists(select 1 from private.provider_payment_proof_scan_results s where s.id=u.current_scan_result_id and s.upload_id=u.id and s.result='CLEAN'and s.computed_sha256=u.declared_sha256)then raise exception'RECEIPT_PROOF_SCAN_NOT_CLEAN'using errcode='55000';end if;
 select metadata->>'mimetype'mime,metadata->>'size'size_text into object_record from storage.objects where bucket_id=u.storage_bucket and name=u.storage_object_path;
 if not found or object_record.mime is distinct from u.declared_mime_type or coalesce(object_record.size_text,'')!~'^[0-9]+$'or object_record.size_text::bigint<>u.declared_size_bytes then raise exception'RECEIPT_PROOF_STORAGE_MISMATCH'using errcode='22000';end if;
 insert into public.provider_payable_event_proofs(provider_organization_id,payable_event_id,upload_id,storage_object_path,original_file_name,mime_type,size_bytes,sha256,scan_result_id,created_by)values(e.provider_organization_id,e.id,u.id,u.storage_object_path,u.original_file_name,u.declared_mime_type,u.declared_size_bytes,u.declared_sha256,u.current_scan_result_id,auth.uid())returning id into proof;
 update public.provider_payment_proof_uploads set status='BOUND',payable_event_id=e.id,bound_at=clock_timestamp()where id=u.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.provider_organization_id,auth.uid(),'USER','provider.payable.proof.archived','provider_payable_event_proof',proof::text,p_correlation_id,jsonb_build_object('payable_event_id',e.id,'sha256',u.declared_sha256),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(e.provider_organization_id,'provider_payable_event_proof',proof::text,'ProviderPayableEvidenceArchivedV1',p_correlation_id,jsonb_build_object('proof_id',proof,'payable_event_id',e.id),'payable-proof:'||e.id::text);
 return r||jsonb_build_object('receipt_proof_id',proof);
end$$;
revoke all on function public.record_provider_payable_event(uuid,text,date,character,bigint,text,text,text,uuid)from public,anon,service_role;
grant execute on function public.record_provider_payable_event(uuid,text,date,character,bigint,text,text,text,uuid)to authenticated;

create or replace function public.record_provider_payment(p_provider_organization_id uuid,p_payment_reference text,p_paid_on date,p_payment_method text,p_currency char(3),p_amount_minor bigint,p_proof_hash text,p_cash_account_id uuid,p_receivable_account_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions,storage as $$
declare a uuid:=auth.uid();h text;r jsonb;p uuid;j uuid:=extensions.gen_random_uuid();u public.provider_payment_proof_uploads%rowtype;proof uuid;object_record record;
begin
 if a is null or not(private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_ACCOUNTING'],a)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'],a))then raise exception'PROVIDER_PAYMENT_DENIED'using errcode='42501';end if;
 if p_amount_minor<=0 or p_currency!~'^[A-Z]{3}$'or p_payment_method not in('BANK_TRANSFER','CARD','CHECK','CASH','OTHER')or p_proof_hash!~'^[0-9a-f]{64}$'then raise exception'INVALID_PROVIDER_PAYMENT'using errcode='22023';end if;
 if not exists(select 1 from public.financial_accounts where id=p_cash_account_id and organization_id=p_provider_organization_id and currency=p_currency)or not exists(select 1 from public.financial_accounts where id=p_receivable_account_id and organization_id=p_provider_organization_id and currency=p_currency)then raise exception'INVALID_PROVIDER_LEDGER_ACCOUNT'using errcode='23514';end if;
 h:=private.canonical_request_hash(jsonb_build_object('provider',p_provider_organization_id,'reference',p_payment_reference,'paid_on',p_paid_on,'method',p_payment_method,'currency',p_currency,'amount',p_amount_minor,'proof_hash',p_proof_hash,'cash_account',p_cash_account_id,'receivable_account',p_receivable_account_id));
 r:=private.begin_provider_billing_command(p_provider_organization_id,'provider.billing.payment.record',p_idempotency_key,h,a);if r is not null then return r;end if;
 select*into u from public.provider_payment_proof_uploads candidate where candidate.provider_organization_id=p_provider_organization_id and candidate.actor_user_id=a and candidate.purpose='PAYMENT'and candidate.declared_sha256=p_proof_hash and candidate.status='UPLOAD_PENDING'and candidate.expires_at>clock_timestamp()order by candidate.created_at desc,candidate.id desc limit 1 for update;
 if not found then raise exception'PAYMENT_PROOF_UPLOAD_REQUIRED'using errcode='23514';end if;
 if u.scan_status<>'CLEAN'or u.current_scan_result_id is null or not exists(select 1 from private.provider_payment_proof_scan_results s where s.id=u.current_scan_result_id and s.upload_id=u.id and s.result='CLEAN'and s.computed_sha256=u.declared_sha256)then raise exception'PAYMENT_PROOF_SCAN_NOT_CLEAN'using errcode='55000';end if;
 select lower(o.metadata->>'mimetype')mime_type,o.metadata->>'size'size_text into object_record from storage.objects o where o.bucket_id=u.storage_bucket and o.name=u.storage_object_path;
 if not found or coalesce(object_record.size_text,'')!~'^[0-9]+$'or object_record.size_text::bigint<>u.declared_size_bytes or object_record.mime_type<>u.declared_mime_type then raise exception'PAYMENT_PROOF_STORAGE_METADATA_MISMATCH'using errcode='22000';end if;
 insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)values(j,p_provider_organization_id,'PROVIDER_PAYMENT',p_currency,'provider.billing.payment.record',p_idempotency_key,p_correlation_id,p_paid_on::timestamptz,'Provider payment '||p_payment_reference,a);
 insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(p_provider_organization_id,j,p_cash_account_id,'DEBIT',p_amount_minor,p_currency),(p_provider_organization_id,j,p_receivable_account_id,'CREDIT',p_amount_minor,p_currency);
 insert into public.provider_payments(provider_organization_id,payment_reference,paid_on,payment_method,currency,amount_minor,proof_hash,journal_id,correlation_id,recorded_by)values(p_provider_organization_id,p_payment_reference,p_paid_on,p_payment_method,p_currency,p_amount_minor,p_proof_hash,j,p_correlation_id,a)returning id into p;
 insert into public.provider_payment_proofs(provider_organization_id,payment_id,upload_id,storage_object_path,original_file_name,mime_type,size_bytes,sha256,created_by,scan_result_id)values(p_provider_organization_id,p,u.id,u.storage_object_path,u.original_file_name,u.declared_mime_type,u.declared_size_bytes,u.declared_sha256,a,u.current_scan_result_id)returning id into proof;
 update public.provider_payment_proof_uploads set status='BOUND',payment_id=p,bound_at=clock_timestamp()where id=u.id;
 r:=jsonb_build_object('outcome','PROVIDER_PAYMENT_RECORDED','payment_id',p,'payment_proof_id',proof,'journal_id',j,'amount_minor',p_amount_minor);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_provider_organization_id,a,'USER','provider.payment.recorded','provider_payment',p::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_provider_organization_id,'provider_payment',p::text,'ProviderPaymentRecordedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_provider_billing_command(p_provider_organization_id,'provider.billing.payment.record',p_idempotency_key,r);return r;
end$$;

-- Read only the current actor's reserved proof; never expose an object URL or a scan override.
create or replace function public.get_my_provider_payment_proof_status(p_provider_organization_id uuid,p_sha256 text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare u public.provider_payment_proof_uploads%rowtype;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_ACCOUNTING'],auth.uid()) or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'],auth.uid()),false) then raise exception 'PROVIDER_PAYMENT_PROOF_DENIED' using errcode='42501'; end if;
 select * into u from public.provider_payment_proof_uploads where provider_organization_id=p_provider_organization_id and actor_user_id=auth.uid() and purpose='PAYMENT'and declared_sha256=p_sha256 order by created_at desc,id desc limit 1;
 if not found then raise exception 'PAYMENT_PROOF_UPLOAD_REQUIRED' using errcode='P0002';end if;
 return jsonb_build_object('scan_status',u.scan_status,'expired',u.expires_at<=clock_timestamp(),'bound',u.status='BOUND');
end$$;
revoke all on function public.get_my_provider_payment_proof_status(uuid,text) from public,anon,service_role;
grant execute on function public.get_my_provider_payment_proof_status(uuid,text) to authenticated;

notify pgrst,'reload schema';
