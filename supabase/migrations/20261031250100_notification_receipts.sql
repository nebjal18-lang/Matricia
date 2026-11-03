create or replace function public.record_notification_delivery_worker_result_v1(
 p_delivery_id uuid,p_lease_token uuid,p_worker_id text,p_outcome text,p_provider_message_id text,p_error_code text,p_result_snapshot jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare d public.notification_deliveries%rowtype;n public.notification_instances%rowtype;pol public.notification_retry_policy_versions%rowtype;prior public.notification_delivery_attempts%rowtype;attempt integer;nextat timestamptz;newstatus text;r jsonb;delay_seconds integer;attempt_status text;h text;cached jsonb;
begin
 if auth.role()is distinct from'service_role'then raise exception'NOTIFICATION_RESULT_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('delivery_id',p_delivery_id,'lease_token',p_lease_token,'worker_id',btrim(p_worker_id),'outcome',p_outcome,'provider_message_id',p_provider_message_id,'error_code',p_error_code,'result',p_result_snapshot));perform pg_advisory_xact_lock(hashtextextended(p_delivery_id::text||':'||coalesce(p_idempotency_key,''),0));select request_hash,response_body into h,cached from private.notification_worker_command_keys where delivery_id=p_delivery_id and idempotency_key=p_idempotency_key;if found then if h<>private.canonical_request_hash(jsonb_build_object('delivery_id',p_delivery_id,'lease_token',p_lease_token,'worker_id',btrim(p_worker_id),'outcome',p_outcome,'provider_message_id',p_provider_message_id,'error_code',p_error_code,'result',p_result_snapshot))then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;if cached is not null then return cached||jsonb_build_object('outcome','NOTIFICATION_RESULT_REPLAYED');end if;raise exception'IDEMPOTENCY_IN_PROGRESS'using errcode='55000';end if;h:=private.canonical_request_hash(jsonb_build_object('delivery_id',p_delivery_id,'lease_token',p_lease_token,'worker_id',btrim(p_worker_id),'outcome',p_outcome,'provider_message_id',p_provider_message_id,'error_code',p_error_code,'result',p_result_snapshot));insert into private.notification_worker_command_keys(delivery_id,idempotency_key,request_hash)values(p_delivery_id,p_idempotency_key,h);
 select*into d from public.notification_deliveries where id=p_delivery_id for update;
 if not found or d.lease_token is distinct from p_lease_token or d.lease_owner is distinct from btrim(p_worker_id)or d.leased_until<=clock_timestamp()then raise exception'NOTIFICATION_LEASE_INVALID'using errcode='40001';end if;
 if p_outcome not in('SENT','DELIVERED','RETRYABLE_FAILURE','PERMANENT_FAILURE')or jsonb_typeof(p_result_snapshot)<>'object'or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_NOTIFICATION_RESULT'using errcode='22023';end if;
 if p_outcome in('SENT','DELIVERED')and(p_error_code is not null or length(coalesce(p_provider_message_id,''))<3)then raise exception'INVALID_NOTIFICATION_RESULT'using errcode='22023';end if;
 if p_outcome not in('SENT','DELIVERED')and length(coalesce(p_error_code,''))<2 then raise exception'INVALID_NOTIFICATION_RESULT'using errcode='22023';end if;
 select*into n from public.notification_instances where id=d.notification_id;select*into pol from public.notification_retry_policy_versions where status='ACTIVE'order by version desc limit 1;if pol.id is null then raise exception'NOTIFICATION_RETRY_POLICY_MISSING'using errcode='55000';end if;
 attempt:=d.attempt_count+1;attempt_status:=case when p_outcome in('SENT','DELIVERED')then p_outcome else'FAILED'end;
 if p_outcome in('SENT','DELIVERED')then newstatus:=p_outcome;nextat:=null;
 elsif p_outcome='PERMANENT_FAILURE'or attempt>=pol.max_attempts then newstatus:='DEAD_LETTER';nextat:=null;
 else delay_seconds:=least(pol.max_backoff_seconds,(pol.base_backoff_seconds*power(2,attempt-1))::integer);newstatus:='FAILED';nextat:=clock_timestamp()+make_interval(secs=>delay_seconds);end if;
 insert into public.notification_delivery_attempts(delivery_id,attempt_number,status,scheduled_at,next_retry_at,provider_message_id,error_code,result_snapshot,idempotency_key,correlation_id)values(d.id,attempt,attempt_status,d.next_attempt_at,nextat,p_provider_message_id,p_error_code,p_result_snapshot,p_idempotency_key,p_correlation_id);
 update public.notification_deliveries set status=newstatus,attempt_count=attempt,next_attempt_at=nextat,last_error_code=p_error_code,provider_message_id=coalesce(p_provider_message_id,provider_message_id),lease_token=null,lease_owner=null,leased_until=null,terminal_at=case when newstatus in('DELIVERED','DEAD_LETTER')then clock_timestamp()end,row_version=row_version+1,updated_at=clock_timestamp()where id=d.id;
 r:=jsonb_build_object('outcome','NOTIFICATION_RESULT_RECORDED','delivery_id',d.id,'status',newstatus,'attempt_count',attempt,'next_retry_at',nextat);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(n.organization_id,null,'SERVICE','notification.delivery.worker_result','notification_delivery',d.id::text,p_correlation_id,jsonb_build_object('channel',d.channel,'status',newstatus,'attempt_count',attempt,'error_code',p_error_code,'worker_id_hash',encode(extensions.digest(convert_to(btrim(p_worker_id),'UTF8'),'sha256'),'hex')),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(n.organization_id,'notification_delivery',d.id::text,case newstatus when'DELIVERED'then'NotificationDeliveredV1'when'DEAD_LETTER'then'NotificationDeadLetteredV1'when'SENT'then'NotificationAcceptedV1'else'NotificationDeliveryRetryScheduledV1'end,p_correlation_id,r,p_idempotency_key)on conflict do nothing;
 update private.notification_worker_command_keys set response_body=r,completed_at=clock_timestamp()where delivery_id=p_delivery_id and idempotency_key=p_idempotency_key;
 return r;
end$$;

create table public.notification_provider_receipts(
 provider_event_id text primary key,delivery_id uuid not null references public.notification_deliveries(id),
 status text not null check(status in('DELIVERED','BOUNCED','COMPLAINED')),payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp()
);
alter table public.notification_provider_receipts enable row level security;
create index notification_receipt_delivery_idx on public.notification_provider_receipts(delivery_id);
create index notification_provider_message_idx on public.notification_deliveries(provider_message_id)where provider_message_id is not null;
create function private.deny_notification_receipt_mutation()returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception'IMMUTABLE_NOTIFICATION_RECEIPT'using errcode='55000';end$$;
revoke all on function private.deny_notification_receipt_mutation()from public,anon,authenticated,service_role;
create trigger immutable_notification_receipts before update or delete on public.notification_provider_receipts for each row execute function private.deny_notification_receipt_mutation();
revoke all on public.notification_provider_receipts from public,anon,authenticated,service_role;
create table public.notification_email_suppressions(user_id uuid not null references auth.users(id),mailbox_hash text not null check(mailbox_hash~'^[0-9a-f]{64}$'),reason text not null check(reason in('BOUNCED','COMPLAINED')),created_at timestamptz not null default clock_timestamp(),primary key(user_id,mailbox_hash));
alter table public.notification_email_suppressions enable row level security;
revoke all on public.notification_email_suppressions from public,anon,authenticated,service_role;
create function public.record_resend_receipt_v1(p_event_id text,p_provider_message_id text,p_status text,p_payload_hash text,p_occurred_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare d public.notification_deliveries%rowtype;n public.notification_instances%rowtype;prior public.notification_provider_receipts%rowtype;mailbox text;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 if p_status is null or p_status not in('DELIVERED','BOUNCED','COMPLAINED')or p_payload_hash is null or p_occurred_at is null or length(coalesce(p_provider_message_id,''))not between 3 and 300 or length(coalesce(p_event_id,''))not between 3 and 200 or p_payload_hash!~'^[0-9a-f]{64}$'or p_occurred_at>clock_timestamp()+interval'5 minutes'then raise exception'INVALID_EMAIL_RECEIPT'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('resend:'||p_event_id,0));
 select * into prior from public.notification_provider_receipts where provider_event_id=p_event_id;
 if found then if prior.payload_hash<>p_payload_hash then raise exception'EMAIL_RECEIPT_REPLAY_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','EMAIL_RECEIPT_REPLAYED');end if;
 select * into d from public.notification_deliveries where provider_message_id=p_provider_message_id and channel='EMAIL'for update;
 if not found or not exists(select 1 from public.notification_delivery_attempts where delivery_id=d.id and provider_message_id=p_provider_message_id and result_snapshot->>'adapter'='EMAIL_RESEND')then raise exception'EMAIL_DELIVERY_NOT_FOUND'using errcode='P0002';end if;
 select * into n from public.notification_instances where id=d.notification_id;
 insert into public.notification_provider_receipts values(p_event_id,d.id,p_status,p_payload_hash,p_occurred_at,clock_timestamp());
 if p_status in('BOUNCED','COMPLAINED')then
  select result_snapshot->>'recipientHash'into mailbox from public.notification_delivery_attempts where delivery_id=d.id and provider_message_id=p_provider_message_id and result_snapshot->>'adapter'='EMAIL_RESEND'order by attempt_number desc limit 1;
  if mailbox is null or mailbox!~'^[0-9a-f]{64}$'then raise exception'EMAIL_RECEIPT_MAILBOX_BINDING_REQUIRED'using errcode='55000';end if;
  insert into public.notification_email_suppressions(user_id,mailbox_hash,reason)values(n.recipient_user_id,mailbox,p_status)on conflict(user_id,mailbox_hash)do nothing;
  update public.notification_deliveries set status='DEAD_LETTER',terminal_at=clock_timestamp(),next_attempt_at=null,last_error_code='EMAIL_'||p_status,row_version=row_version+1 where id=d.id;
 elsif not exists(select 1 from public.notification_provider_receipts where delivery_id=d.id and status in('BOUNCED','COMPLAINED'))then
  update public.notification_deliveries set status='DELIVERED',terminal_at=clock_timestamp(),next_attempt_at=null,last_error_code=null,row_version=row_version+1 where id=d.id;
 end if;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(n.organization_id,'SERVICE','notification.provider.receipt','notification_delivery',d.id::text,d.id,jsonb_build_object('status',p_status),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(n.organization_id,'notification_delivery',d.id::text,'NotificationProviderReceiptRecordedV1',d.id,jsonb_build_object('delivery_id',d.id,'status',p_status),'resend-receipt:'||p_event_id)on conflict do nothing;
 return jsonb_build_object('outcome','EMAIL_RECEIPT_RECORDED','status',p_status);
end$$;
revoke all on function public.record_resend_receipt_v1(text,text,text,text,timestamptz)from public,anon,authenticated;
grant execute on function public.record_resend_receipt_v1(text,text,text,text,timestamptz)to service_role;

create or replace function public.authorize_notification_delivery_send_v1(p_delivery_id uuid,p_lease_token uuid,p_worker_id text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare d public.notification_deliveries%rowtype;n public.notification_instances%rowtype;allowed boolean:=false;r jsonb;
begin
 if auth.role()is distinct from'service_role'then raise exception'NOTIFICATION_SEND_AUTH_DENIED'using errcode='42501';end if;
 select*into d from public.notification_deliveries where id=p_delivery_id for update;select*into n from public.notification_instances where id=d.notification_id;
 if d.id is null or d.lease_token is distinct from p_lease_token or d.lease_owner is distinct from btrim(p_worker_id)or d.leased_until<=clock_timestamp()then raise exception'NOTIFICATION_LEASE_INVALID'using errcode='40001';end if;
 if d.channel='EMAIL'and exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then allowed:=false;
 elsif d.channel<>'EMAIL'then allowed:=true;
 elsif n.mandatory then allowed:=exists(select 1 from public.notification_mandatory_policy_versions mp where mp.id=n.mandatory_policy_version_id and mp.category_code=n.category_code and mp.legal_basis=n.legal_basis and mp.status='ACTIVE'and mp.effective_from<=clock_timestamp()and(mp.effective_until is null or mp.effective_until>clock_timestamp()));
 else allowed:=private.notification_email_consent_active(n.recipient_user_id,n.organization_id,n.category_code)and exists(select 1 from public.user_notification_preferences p where p.user_id=n.recipient_user_id and p.organization_id=n.organization_id and p.category_code=n.category_code and p.channel='EMAIL'and p.delivery_mode in('IMMEDIATE','DIGEST')and p.delivery_mode=d.delivery_mode);
 end if;
 if allowed then return jsonb_build_object('outcome','NOTIFICATION_SEND_AUTHORIZED','authorized',true,'delivery_id',d.id);end if;
 update public.notification_deliveries set status='SKIPPED',next_attempt_at=null,last_error_code=case when exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then'EMAIL_RECIPIENT_SUPPRESSED'when n.mandatory then'MANDATORY_LEGAL_BASIS_INACTIVE'else'PREFERENCE_WITHDRAWN'end,lease_token=null,lease_owner=null,leased_until=null,terminal_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp()where id=d.id;
 r:=jsonb_build_object('outcome','NOTIFICATION_SEND_BLOCKED','authorized',false,'delivery_id',d.id,'reason',case when exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then'EMAIL_RECIPIENT_SUPPRESSED'when n.mandatory then'MANDATORY_LEGAL_BASIS_INACTIVE'else'PREFERENCE_WITHDRAWN'end);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(n.organization_id,null,'SERVICE','notification.delivery.send_blocked','notification_delivery',d.id::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(n.organization_id,'notification_delivery',d.id::text,'NotificationDeliveryBlockedV1',p_correlation_id,r,'notification-send-blocked:'||d.id::text||':'||d.row_version::text)on conflict do nothing;
 return r;
end$$;
notify pgrst,'reload schema';
