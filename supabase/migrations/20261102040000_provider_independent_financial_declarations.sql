begin;
-- Declarations never settle debt. Only an independent Finance reviewer may record cash.
create table public.provider_financial_declarations_v1(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),
 client_organization_id uuid references public.organizations(id),kind text not null check(kind in('PAYMENT','PAYABLE')),
 payload jsonb not null,upload_id uuid not null unique references public.provider_payment_proof_uploads(id),
 declared_by uuid not null references auth.users(id),idempotency_key text not null,request_hash text not null,
 declared_at timestamptz not null default clock_timestamp(),unique(provider_organization_id,kind,idempotency_key)
);
create table public.provider_financial_declaration_decisions_v1(
 id uuid primary key default extensions.gen_random_uuid(),declaration_id uuid not null references public.provider_financial_declarations_v1(id),
 decision text not null check(decision in('CLIENT_CONFIRMED','CLIENT_CONTESTED','APPROVED','REJECTED')),
 reason text not null check(length(btrim(reason))between 10 and 2000),decided_by uuid not null references auth.users(id),
 decided_at timestamptz not null default clock_timestamp(),response jsonb not null default '{}',unique(declaration_id,decision)
);
create function private.provider_finance_reviewer_v1()returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid())$$;
revoke all on function private.provider_finance_reviewer_v1()from public,anon,authenticated,service_role;
create function private.provider_declaration_access_v1(p_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$select exists(select 1 from public.provider_financial_declarations_v1 d where d.id=p_id and(private.provider_billing_access(d.provider_organization_id,auth.uid())or private.has_org_role(d.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'],auth.uid())))$$;
revoke all on function private.provider_declaration_access_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function private.provider_declaration_access_v1(uuid)to authenticated;
alter table public.provider_financial_declarations_v1 enable row level security;
alter table public.provider_financial_declaration_decisions_v1 enable row level security;
create policy declaration_read on public.provider_financial_declarations_v1 for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid())or private.has_org_role(client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'],auth.uid()));
create policy declaration_decision_read on public.provider_financial_declaration_decisions_v1 for select to authenticated using(private.provider_declaration_access_v1(declaration_id));
revoke all on public.provider_financial_declarations_v1,public.provider_financial_declaration_decisions_v1 from public,anon,authenticated,service_role;
grant select on public.provider_financial_declarations_v1,public.provider_financial_declaration_decisions_v1 to authenticated;
create trigger financial_declarations_immutable before update or delete on public.provider_financial_declarations_v1 for each row execute function private.prevent_update_delete();
create trigger financial_declaration_decisions_immutable before update or delete on public.provider_financial_declaration_decisions_v1 for each row execute function private.prevent_update_delete();
create function private.declare_provider_finance_v1(p_org uuid,p_client uuid,p_kind text,p_payload jsonb,p_key text,p_correlation uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare u public.provider_payment_proof_uploads%rowtype;d public.provider_financial_declarations_v1%rowtype;h text;r jsonb;o record;
begin
 if not private.provider_billing_write_access(p_org,auth.uid())then raise exception'DECLARATION_DENIED'using errcode='42501';end if;
 if p_kind='PAYABLE'and coalesce(p_payload->>'paymentMethod','')not in('BANK_TRANSFER','CARD','CHECK','CASH','OTHER')then raise exception'RECEIPT_METHOD_REQUIRED'using errcode='22023';end if;
 h:=private.canonical_request_hash(p_payload);perform pg_advisory_xact_lock(hashtextextended('provider-declaration:'||p_org::text||':'||p_kind||':'||p_key,0));
 select*into d from public.provider_financial_declarations_v1 where provider_organization_id=p_org and kind=p_kind and idempotency_key=p_key;
 if found then if d.request_hash<>h or d.declared_by<>auth.uid()then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','PROVIDER_FINANCIAL_DECLARATION_SUBMITTED','declaration_id',d.id);end if;
 if length(coalesce(p_key,''))not between 8 and 200 or coalesce(p_payload->>'proofHash','')!~'^[0-9a-f]{64}$'then raise exception'INVALID_DECLARATION'using errcode='22023';end if;
 select*into u from public.provider_payment_proof_uploads where provider_organization_id=p_org and actor_user_id=auth.uid()and purpose=p_kind and declared_sha256=p_payload->>'proofHash'and status='UPLOAD_PENDING'and expires_at>clock_timestamp()order by created_at desc,id desc limit 1 for update;
 if not found or u.scan_status<>'CLEAN'or not exists(select 1 from private.provider_payment_proof_scan_results s where s.id=u.current_scan_result_id and s.upload_id=u.id and s.result='CLEAN'and s.computed_sha256=u.declared_sha256)then raise exception'CLEAN_DECLARATION_PROOF_REQUIRED'using errcode='55000';end if;
 select metadata->>'mimetype'mime,metadata->>'size'size into o from storage.objects where bucket_id=u.storage_bucket and name=u.storage_object_path;
 if not found or o.mime is distinct from u.declared_mime_type or coalesce(o.size,'')!~'^[0-9]+$'or o.size::bigint<>u.declared_size_bytes then raise exception'PROOF_STORAGE_MISMATCH'using errcode='22000';end if;
 insert into public.provider_financial_declarations_v1(provider_organization_id,client_organization_id,kind,payload,upload_id,declared_by,idempotency_key,request_hash)values(p_org,p_client,p_kind,p_payload,u.id,auth.uid(),p_key,h)returning*into d;
 r:=jsonb_build_object('outcome','PROVIDER_FINANCIAL_DECLARATION_SUBMITTED','declaration_id',d.id,'kind',p_kind);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_org,auth.uid(),'USER','provider.financial.declared','provider_financial_declaration',d.id::text,p_correlation,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_org,'provider_financial_declaration',d.id::text,'ProviderFinancialDeclarationSubmittedV1',p_correlation,r,'provider-declaration:'||d.id::text);
 return r;
end$$;
revoke all on function private.declare_provider_finance_v1(uuid,uuid,text,jsonb,text,uuid)from public,anon,authenticated,service_role;
create or replace function public.record_provider_payment(p_provider_organization_id uuid,p_payment_reference text,p_paid_on date,p_payment_method text,p_currency char(3),p_amount_minor bigint,p_proof_hash text,p_cash_account_id uuid,p_receivable_account_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if p_amount_minor is null or p_amount_minor<=0 or p_paid_on is null or p_paid_on>current_date or p_payment_method not in('BANK_TRANSFER','CARD','CHECK','CASH','OTHER')or length(btrim(coalesce(p_payment_reference,'')))not between 3 and 200 then raise exception'INVALID_PAYMENT_DECLARATION'using errcode='22023';end if;
 if not exists(select 1 from public.financial_accounts where id=p_cash_account_id and organization_id=p_provider_organization_id and currency=p_currency and account_type='ASSET')or not exists(select 1 from public.financial_accounts where id=p_receivable_account_id and organization_id=p_provider_organization_id and currency=p_currency and account_type='ASSET')or p_cash_account_id=p_receivable_account_id then raise exception'INVALID_PROVIDER_LEDGER_ACCOUNT'using errcode='23514';end if;
 return private.declare_provider_finance_v1(p_provider_organization_id,null,'PAYMENT',jsonb_build_object('paymentReference',p_payment_reference,'paidOn',p_paid_on,'paymentMethod',p_payment_method,'currency',p_currency,'amountMinor',p_amount_minor::text,'proofHash',p_proof_hash,'cashAccountId',p_cash_account_id,'receivableAccountId',p_receivable_account_id),p_idempotency_key,p_correlation_id);
end$$;
create or replace function public.record_provider_payable_event(p_mission_id uuid,p_event_type text,p_occurred_on date,p_currency char(3),p_gross_amount_minor bigint,p_client_receipt_reference text,p_proof_hash text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare m public.missions%rowtype;v public.contract_versions%rowtype;
begin
 select*into m from public.missions where id=p_mission_id;select*into v from public.contract_versions where id=m.contract_version_id;
 if m.id is null or m.status in('PLANNED','CANCELLED')or p_event_type is distinct from'CLIENT_RECEIPT_CONFIRMED'or p_currency is distinct from v.currency or p_gross_amount_minor is null or p_gross_amount_minor<=0 or p_occurred_on is null or p_occurred_on>current_date or length(btrim(coalesce(p_client_receipt_reference,'')))not between 3 and 200 then raise exception'INVALID_RECEIPT_DECLARATION'using errcode='22023';end if;
 return private.declare_provider_finance_v1(m.provider_organization_id,m.client_organization_id,'PAYABLE',jsonb_build_object('missionId',m.id,'eventType',p_event_type,'occurredOn',p_occurred_on,'currency',v.currency,'grossAmountMinor',p_gross_amount_minor::text,'clientReceiptReference',p_client_receipt_reference,'proofHash',p_proof_hash,'paymentMethod',(select payload->>'paymentMethod'from public.provider_billing_intents where provider_organization_id=m.provider_organization_id and actor_user_id=auth.uid()and kind='PAYABLE'and idempotency_key::text=p_idempotency_key)),p_idempotency_key,p_correlation_id);
end$$;
create function public.confirm_provider_receipt_declaration_v1(p_declaration_id uuid,p_confirmed boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.provider_financial_declarations_v1%rowtype;r jsonb;
begin
 select*into d from public.provider_financial_declarations_v1 where id=p_declaration_id for update;
 if d.id is null or d.kind<>'PAYABLE'or not private.has_org_role(d.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'],auth.uid())or d.declared_by=auth.uid()or private.is_active_org_member(d.provider_organization_id,auth.uid())then raise exception'CLIENT_RECEIPT_CONFIRMATION_DENIED'using errcode='42501';end if;
 if p_confirmed is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_REASON'using errcode='22023';end if;
 select response into r from public.provider_financial_declaration_decisions_v1 where declaration_id=d.id and decision in('CLIENT_CONFIRMED','CLIENT_CONTESTED');if found then return r;end if;
 r:=jsonb_build_object('outcome',case when p_confirmed then'CLIENT_RECEIPT_CONFIRMED'else'CLIENT_RECEIPT_CONTESTED'end,'declaration_id',d.id);
 insert into public.provider_financial_declaration_decisions_v1(declaration_id,decision,reason,decided_by,response)values(d.id,case when p_confirmed then'CLIENT_CONFIRMED'else'CLIENT_CONTESTED'end,p_reason,auth.uid(),r);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.provider_organization_id,auth.uid(),'USER','provider.receipt.client_decision','provider_financial_declaration',d.id::text,d.id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(d.provider_organization_id,'provider_financial_declaration',d.id::text,'ProviderReceiptClientDecisionV1',d.id,r,'receipt-client:'||d.id::text);return r;
end$$;
create function public.review_provider_financial_declaration_v1(p_declaration_id uuid,p_approved boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare d public.provider_financial_declarations_v1%rowtype;u public.provider_payment_proof_uploads%rowtype;v jsonb;r jsonb;p uuid;j uuid:=extensions.gen_random_uuid();proof uuid;o record;
begin
 if not private.provider_finance_reviewer_v1()then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 select*into d from public.provider_financial_declarations_v1 where id=p_declaration_id for update;
 if d.id is null or d.declared_by=auth.uid()or private.is_active_org_member(d.provider_organization_id,auth.uid())or(d.client_organization_id is not null and private.is_active_org_member(d.client_organization_id,auth.uid()))then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_approved is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_REASON'using errcode='22023';end if;
 select response into r from public.provider_financial_declaration_decisions_v1 where declaration_id=d.id and decision in('APPROVED','REJECTED');if found then return r;end if;
 if p_approved then
  if d.kind='PAYABLE'and not exists(select 1 from public.provider_financial_declaration_decisions_v1 where declaration_id=d.id and decision='CLIENT_CONFIRMED')then raise exception'CLIENT_RECEIPT_CONFIRMATION_REQUIRED'using errcode='55000';end if;
  select*into u from public.provider_payment_proof_uploads where id=d.upload_id for update;v:=d.payload;
  if u.status<>'UPLOAD_PENDING'or u.scan_status<>'CLEAN'or u.declared_sha256 is distinct from v->>'proofHash'or not exists(select 1 from private.provider_payment_proof_scan_results s where s.id=u.current_scan_result_id and s.upload_id=u.id and s.result='CLEAN'and s.computed_sha256=u.declared_sha256)then raise exception'CLEAN_DECLARATION_PROOF_REQUIRED'using errcode='55000';end if;
  select metadata->>'mimetype'mime,metadata->>'size'size into o from storage.objects where bucket_id=u.storage_bucket and name=u.storage_object_path;
  if not found or o.mime is distinct from u.declared_mime_type or coalesce(o.size,'')!~'^[0-9]+$'or o.size::bigint<>u.declared_size_bytes then raise exception'PROOF_STORAGE_MISMATCH'using errcode='22000';end if;
  if d.kind='PAYMENT'then
   insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)values(j,d.provider_organization_id,'PROVIDER_PAYMENT',v->>'currency','provider.payment.review',d.id::text,d.id,(v->>'paidOn')::date::timestamptz,'Reviewed provider payment',auth.uid());
   insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(d.provider_organization_id,j,(v->>'cashAccountId')::uuid,'DEBIT',(v->>'amountMinor')::bigint,v->>'currency'),(d.provider_organization_id,j,(v->>'receivableAccountId')::uuid,'CREDIT',(v->>'amountMinor')::bigint,v->>'currency');
   insert into public.provider_payments(provider_organization_id,payment_reference,paid_on,payment_method,currency,amount_minor,proof_hash,journal_id,correlation_id,recorded_by)values(d.provider_organization_id,v->>'paymentReference',(v->>'paidOn')::date,v->>'paymentMethod',v->>'currency',(v->>'amountMinor')::bigint,v->>'proofHash',j,d.id,auth.uid())returning id into p;
   insert into public.provider_payment_proofs(provider_organization_id,payment_id,upload_id,storage_object_path,original_file_name,mime_type,size_bytes,sha256,created_by,scan_result_id)values(d.provider_organization_id,p,u.id,u.storage_object_path,u.original_file_name,u.declared_mime_type,u.declared_size_bytes,u.declared_sha256,d.declared_by,u.current_scan_result_id)returning id into proof;
   update public.provider_payment_proof_uploads set status='BOUND',payment_id=p,bound_at=clock_timestamp()where id=u.id;
   r:=jsonb_build_object('outcome','PROVIDER_PAYMENT_APPROVED','declaration_id',d.id,'payment_id',p);
  else
   r:=public.record_provider_payable_event_pre_archive_v1((v->>'missionId')::uuid,'CLIENT_RECEIPT_CONFIRMED',(v->>'occurredOn')::date,(v->>'currency')::char(3),(v->>'grossAmountMinor')::bigint,v->>'clientReceiptReference',v->>'proofHash','review:'||d.id::text,d.id);p:=(r->>'payable_event_id')::uuid;
   insert into public.provider_payable_event_proofs(provider_organization_id,payable_event_id,upload_id,storage_object_path,original_file_name,mime_type,size_bytes,sha256,scan_result_id,created_by)values(d.provider_organization_id,p,u.id,u.storage_object_path,u.original_file_name,u.declared_mime_type,u.declared_size_bytes,u.declared_sha256,u.current_scan_result_id,d.declared_by)returning id into proof;
   update public.provider_payment_proof_uploads set status='BOUND',payable_event_id=p,bound_at=clock_timestamp()where id=u.id;
   r:=r||jsonb_build_object('declaration_id',d.id,'receipt_proof_id',proof);
  end if;
 else r:=jsonb_build_object('outcome','PROVIDER_FINANCIAL_DECLARATION_REJECTED','declaration_id',d.id);end if;
 insert into public.provider_financial_declaration_decisions_v1(declaration_id,decision,reason,decided_by,response)values(d.id,case when p_approved then'APPROVED'else'REJECTED'end,p_reason,auth.uid(),r);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.provider_organization_id,auth.uid(),'USER','provider.financial.reviewed','provider_financial_declaration',d.id::text,d.id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(d.provider_organization_id,'provider_financial_declaration',d.id::text,'ProviderFinancialDeclarationReviewedV1',d.id,r,'declaration-review:'||d.id::text);return r;
end$$;
-- Only Finance may allocate a confirmed payment; cache lookup precedes state validation on replay.
alter function public.reconcile_provider_payment(uuid,jsonb,text,uuid)rename to reconcile_provider_payment_pre_review_v1;
revoke all on function public.reconcile_provider_payment_pre_review_v1(uuid,jsonb,text,uuid)from public,anon,authenticated,service_role;
create function public.reconcile_provider_payment(p_payment_id uuid,p_allocations jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare p public.provider_payments%rowtype;r jsonb;h text;
begin
 if not private.provider_finance_reviewer_v1()then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 select*into p from public.provider_payments where id=p_payment_id for update;
 if p.id is null or private.is_active_org_member(p.provider_organization_id,auth.uid())then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 perform 1 from public.provider_invoices where id in(select (x->>'invoice_id')::uuid from jsonb_array_elements(p_allocations)x)order by id for update;
 h:=private.canonical_request_hash(jsonb_build_object('payment',p.id,'allocations',p_allocations));
 select response_body into r from public.idempotency_keys where organization_id=p.provider_organization_id and operation_scope='provider.billing.payment.reconcile'and key=p_idempotency_key and request_hash=h and status='COMPLETED';if found then return r;end if;
 return public.reconcile_provider_payment_pre_review_v1(p_payment_id,p_allocations,p_idempotency_key,p_correlation_id);
end$$;
-- Finalizing a scanned draft now records a declaration, never a payment/commission.
-- Existing RECORDED drafts and immutable historical ledgers remain untouched.
grant execute on function public.reconcile_provider_payment(uuid,jsonb,text,uuid)to authenticated;
revoke all on function public.reconcile_provider_payment(uuid,jsonb,text,uuid)from public,anon,service_role;
revoke all on function public.confirm_provider_receipt_declaration_v1(uuid,boolean,text),public.review_provider_financial_declaration_v1(uuid,boolean,text)from public,anon,authenticated,service_role;
grant execute on function public.confirm_provider_receipt_declaration_v1(uuid,boolean,text),public.review_provider_financial_declaration_v1(uuid,boolean,text)to authenticated;
notify pgrst,'reload schema';

-- The receipt declaration captures the actual mode as well as date/reference/proof.
do $$declare d text;needle text;begin
 select pg_get_functiondef('public.save_my_provider_billing_intent(uuid,text,jsonb,uuid)'::regprocedure)into d;
 needle:='v:=jsonb_build_object(''missionId'',(p_payload->>''missionId'')::uuid::text,';
 if strpos(d,needle)=0 then raise exception'RECEIPT_INTENT_METHOD_PATCH_MISSING';end if;
 d:=replace(d,needle,'if coalesce(p_payload->>''paymentMethod'','''')not in(''BANK_TRANSFER'',''CARD'',''CHECK'',''CASH'',''OTHER'')then raise exception''RECEIPT_METHOD_REQUIRED''using errcode=''22023'';end if;'||needle);
 d:=replace(d,'''eventType'',p_payload->>''eventType'',''occurredOn''','''eventType'',p_payload->>''eventType'',''paymentMethod'',p_payload->>''paymentMethod'',''occurredOn''');execute d;

end$$;
notify pgrst,'reload schema';

commit;
