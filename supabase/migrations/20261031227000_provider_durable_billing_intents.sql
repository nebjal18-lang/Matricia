-- Durable actor/tenant-bound financial drafts survive a browser refresh; money still moves only after CLEAN.
create function private.provider_billing_write_access(p_org uuid,p_actor uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select p_actor is not null and coalesce(private.has_org_role(p_org,array['PROVIDER_OWNER','PROVIDER_ACCOUNTING'],p_actor)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'],p_actor),false)$$;
revoke all on function private.provider_billing_write_access(uuid,uuid)from public,anon,authenticated,service_role;
create table public.provider_billing_intents(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),actor_user_id uuid not null references auth.users(id),
 kind text not null check(kind in('PAYMENT','PAYABLE')),idempotency_key uuid not null,payload jsonb not null check(jsonb_typeof(payload)='object'),request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),
 status text not null default'PENDING'check(status in('PENDING','EXPIRED','REJECTED','RECORDED','CANCELLED')),response jsonb,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(provider_organization_id,actor_user_id,kind,idempotency_key),check((status='RECORDED')=(response is not null))
);
alter table public.provider_billing_intents enable row level security;
revoke all on public.provider_billing_intents from public,anon,authenticated,service_role;
grant select on public.provider_billing_intents to authenticated;
create policy provider_billing_intent_owner_read on public.provider_billing_intents for select to authenticated using(actor_user_id=auth.uid()and private.provider_billing_access(provider_organization_id,auth.uid()));
create index provider_billing_intent_resume_idx on public.provider_billing_intents(provider_organization_id,actor_user_id,created_at desc)where status in('PENDING','EXPIRED','REJECTED');
create function public.save_my_provider_billing_intent(p_provider_organization_id uuid,p_kind text,p_payload jsonb,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare a uuid:=auth.uid();v jsonb;h text;r public.provider_billing_intents%rowtype;c text;proof text;amount bigint;reference text;
begin
 if not private.provider_billing_write_access(p_provider_organization_id,a)then raise exception'PROVIDER_BILLING_INTENT_DENIED'using errcode='42501';end if;
 if p_kind is null or p_kind not in('PAYMENT','PAYABLE')or p_idempotency_key is null or jsonb_typeof(p_payload)is distinct from'object'then raise exception'INVALID_BILLING_INTENT'using errcode='22023';end if;
 c:=p_payload->>'currency';proof:=p_payload->>'proofHash';reference:=case p_kind when'PAYMENT'then p_payload->>'paymentReference'else p_payload->>'clientReceiptReference'end;
 amount:=(case p_kind when'PAYMENT'then p_payload->>'amountMinor'else p_payload->>'grossAmountMinor'end)::bigint;
 if amount is null or amount<=0 or coalesce(c,'')!~'^[A-Z]{3}$'or coalesce(proof,'')!~'^[0-9a-f]{64}$'or length(btrim(coalesce(reference,'')))not between 3 and 200 then raise exception'INVALID_BILLING_INTENT'using errcode='22023';end if;
 if p_kind='PAYMENT'then
  if(p_payload->>'organizationId')::uuid is distinct from p_provider_organization_id or coalesce(p_payload->>'paymentMethod','')not in('BANK_TRANSFER','CARD','CHECK','CASH','OTHER')or nullif(p_payload->>'paidOn','')is null or nullif(p_payload->>'cashAccountId','')is null or nullif(p_payload->>'receivableAccountId','')is null then raise exception'INVALID_BILLING_INTENT'using errcode='22023';end if;
  v:=jsonb_build_object('organizationId',p_provider_organization_id::text,'paymentReference',reference,'paidOn',(p_payload->>'paidOn')::date::text,'paymentMethod',p_payload->>'paymentMethod','currency',c,'amountMinor',amount::text,'proofHash',proof,'cashAccountId',(p_payload->>'cashAccountId')::uuid::text,'receivableAccountId',(p_payload->>'receivableAccountId')::uuid::text,'idempotencyKey',p_idempotency_key::text);
 else
  if not exists(select 1 from public.missions where id=(p_payload->>'missionId')::uuid and provider_organization_id=p_provider_organization_id)or coalesce(p_payload->>'eventType','')not in('CLIENT_RECEIPT_CONFIRMED','COMMISSION_ACCRUAL','PENALTY_ACCRUAL','ADJUSTMENT')or nullif(p_payload->>'occurredOn','')is null then raise exception'INVALID_BILLING_INTENT'using errcode='22023';end if;
  v:=jsonb_build_object('missionId',(p_payload->>'missionId')::uuid::text,'eventType',p_payload->>'eventType','occurredOn',(p_payload->>'occurredOn')::date::text,'currency',c,'grossAmountMinor',amount::text,'clientReceiptReference',reference,'proofHash',proof,'idempotencyKey',p_idempotency_key::text);
 end if;
 h:=private.canonical_request_hash(jsonb_build_object('org',p_provider_organization_id,'kind',p_kind,'payload',v));
 perform pg_advisory_xact_lock(hashtextextended('billing-intent:'||a::text||':'||p_provider_organization_id::text||':'||p_kind||':'||p_idempotency_key::text,0));
 select * into r from public.provider_billing_intents where provider_organization_id=p_provider_organization_id and actor_user_id=a and kind=p_kind and idempotency_key=p_idempotency_key;
 if found then if r.request_hash<>h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('intent_id',r.id);end if;
 if not exists(select 1 from public.provider_payment_proof_uploads where provider_organization_id=p_provider_organization_id and actor_user_id=a and purpose=p_kind and declared_sha256=proof and status='UPLOAD_PENDING'and expires_at>clock_timestamp())then raise exception'BILLING_PROOF_UPLOAD_REQUIRED'using errcode='23514';end if;
 insert into public.provider_billing_intents(provider_organization_id,actor_user_id,kind,idempotency_key,payload,request_hash)values(p_provider_organization_id,a,p_kind,p_idempotency_key,v,h)returning*into r;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_provider_organization_id,a,'USER','provider.billing.intent.saved','provider_billing_intent',r.id::text,r.id,jsonb_build_object('kind',p_kind,'sha256',proof),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_provider_organization_id,'provider_billing_intent',r.id::text,'ProviderBillingIntentSavedV1',r.id,jsonb_build_object('intent_id',r.id,'kind',p_kind),'billing-intent:'||r.id::text);
 return jsonb_build_object('intent_id',r.id);
end$$;
create function public.finalize_my_provider_billing_intent(p_intent_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.provider_billing_intents%rowtype;u public.provider_payment_proof_uploads%rowtype;v jsonb;result jsonb;nextstatus text;
begin
 select * into r from public.provider_billing_intents where id=p_intent_id and actor_user_id=auth.uid()for update;
 if not found or not private.provider_billing_write_access(r.provider_organization_id,auth.uid())then raise exception'PROVIDER_BILLING_INTENT_DENIED'using errcode='42501';end if;
 if r.status='RECORDED'then return r.response;end if;
 if r.status='CANCELLED'then raise exception'BILLING_INTENT_CANCELLED'using errcode='55000';end if;
 v:=r.payload;
 select * into u from public.provider_payment_proof_uploads where provider_organization_id=r.provider_organization_id and actor_user_id=auth.uid()and purpose=r.kind and declared_sha256=v->>'proofHash'and status='UPLOAD_PENDING'order by created_at desc,id desc limit 1 for update;
 if not found or u.expires_at<=clock_timestamp()then nextstatus:='EXPIRED';result:=jsonb_build_object('outcome','PROVIDER_BILLING_PROOF_EXPIRED','intent_id',r.id);
 elsif u.scan_status='PENDING'then return jsonb_build_object('outcome','PROVIDER_BILLING_SCAN_PENDING','intent_id',r.id);
 elsif u.scan_status<>'CLEAN'then nextstatus:='REJECTED';result:=jsonb_build_object('outcome','PROVIDER_BILLING_PROOF_REJECTED','intent_id',r.id);
 else
  if r.kind='PAYMENT'then result:=public.record_provider_payment(r.provider_organization_id,v->>'paymentReference',(v->>'paidOn')::date,v->>'paymentMethod',(v->>'currency')::char(3),(v->>'amountMinor')::bigint,v->>'proofHash',(v->>'cashAccountId')::uuid,(v->>'receivableAccountId')::uuid,r.idempotency_key::text,r.id);
  else result:=public.record_provider_payable_event((v->>'missionId')::uuid,v->>'eventType',(v->>'occurredOn')::date,(v->>'currency')::char(3),(v->>'grossAmountMinor')::bigint,v->>'clientReceiptReference',v->>'proofHash',r.idempotency_key::text,r.id);end if;
  nextstatus:='RECORDED';
 end if;
 if r.status<>nextstatus then
  update public.provider_billing_intents set status=nextstatus,response=case when nextstatus='RECORDED'then result else null end,updated_at=clock_timestamp()where id=r.id;
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.provider_organization_id,auth.uid(),'USER','provider.billing.intent.finalized','provider_billing_intent',r.id::text,r.id,jsonb_build_object('status',nextstatus,'kind',r.kind),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(r.provider_organization_id,'provider_billing_intent',r.id::text,'ProviderBillingIntentFinalizedV1',r.id,jsonb_build_object('intent_id',r.id,'status',nextstatus),'billing-intent-final:'||r.id::text||':'||nextstatus);
 end if;return result;
end$$;
create function public.cancel_my_provider_billing_intent(p_intent_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.provider_billing_intents%rowtype;
begin
 select*into r from public.provider_billing_intents where id=p_intent_id and actor_user_id=auth.uid()for update;
 if not found or not private.provider_billing_write_access(r.provider_organization_id,auth.uid())then raise exception'PROVIDER_BILLING_INTENT_DENIED'using errcode='42501';end if;
 if r.status='RECORDED'then raise exception'RECORDED_BILLING_INTENT_IMMUTABLE'using errcode='55000';end if;
 if r.status<>'CANCELLED'then
 update public.provider_billing_intents set status='CANCELLED',updated_at=clock_timestamp()where id=r.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.provider_organization_id,auth.uid(),'USER','provider.billing.intent.cancelled','provider_billing_intent',r.id::text,r.id,'{}',repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(r.provider_organization_id,'provider_billing_intent',r.id::text,'ProviderBillingIntentCancelledV1',r.id,jsonb_build_object('intent_id',r.id),'billing-intent-cancel:'||r.id::text);
 end if;return jsonb_build_object('outcome','PROVIDER_BILLING_INTENT_CANCELLED');
end$$;
create function public.list_my_provider_billing_intents(p_provider_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$begin
 if not private.provider_billing_write_access(p_provider_organization_id,auth.uid())then raise exception'PROVIDER_BILLING_INTENT_DENIED'using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(rows))from(select i.id,i.kind,i.status,i.created_at,i.payload->>'currency'currency,case i.kind when'PAYMENT'then i.payload->>'paymentReference'else i.payload->>'clientReceiptReference'end reference,case i.kind when'PAYMENT'then i.payload->>'amountMinor'else i.payload->>'grossAmountMinor'end amount_minor,coalesce(u.scan_status,'ERROR')scan_status,coalesce(u.expires_at<=statement_timestamp(),true)expired from public.provider_billing_intents i left join lateral(select scan_status,expires_at from public.provider_payment_proof_uploads where provider_organization_id=i.provider_organization_id and actor_user_id=i.actor_user_id and purpose=i.kind and declared_sha256=i.payload->>'proofHash'and status='UPLOAD_PENDING'order by created_at desc,id desc limit 1)u on true where i.provider_organization_id=p_provider_organization_id and i.actor_user_id=auth.uid()and i.status in('PENDING','EXPIRED','REJECTED')order by i.created_at desc limit 100)rows),'[]'::jsonb);
end$$;
revoke all on function public.save_my_provider_billing_intent(uuid,text,jsonb,uuid),public.finalize_my_provider_billing_intent(uuid),public.cancel_my_provider_billing_intent(uuid),public.list_my_provider_billing_intents(uuid)from public,anon,service_role;
grant execute on function public.save_my_provider_billing_intent(uuid,text,jsonb,uuid),public.finalize_my_provider_billing_intent(uuid),public.cancel_my_provider_billing_intent(uuid),public.list_my_provider_billing_intents(uuid)to authenticated;
notify pgrst,'reload schema';
