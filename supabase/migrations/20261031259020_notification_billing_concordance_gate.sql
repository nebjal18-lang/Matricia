begin;
-- This is a last pre-transport check. An authorization already returned before a correction
-- can have reached the provider; no recall or delivery success is claimed.
create or replace function public.authorize_notification_delivery_send_v1(p_delivery_id uuid,p_lease_token uuid,p_worker_id text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare d public.notification_deliveries%rowtype;n public.notification_instances%rowtype;allowed boolean:=false;r jsonb;billing_blocked boolean:=false;
begin
 if auth.role()is distinct from'service_role'then raise exception'NOTIFICATION_SEND_AUTH_DENIED'using errcode='42501';end if;
 select*into d from public.notification_deliveries where id=p_delivery_id for update;select*into n from public.notification_instances where id=d.notification_id;
 if d.id is null or d.lease_token is distinct from p_lease_token or d.lease_owner is distinct from btrim(p_worker_id)or d.leased_until<=clock_timestamp()then raise exception'NOTIFICATION_LEASE_INVALID'using errcode='40001';end if;
 if n.event_type='ProviderBillingPdfReadyV1' then
  if to_regprocedure('private.provider_billing_notification_send_authorized_v1(uuid)')is null then raise exception'BILLING_NOTIFICATION_AUTHORIZATION_UNAVAILABLE'using errcode='55000';end if;
  billing_blocked:=not coalesce(private.provider_billing_notification_send_authorized_v1(n.id),false);
 end if;
 if billing_blocked then allowed:=false;
 elsif d.channel='EMAIL'and exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then allowed:=false;
 elsif d.channel<>'EMAIL'then allowed:=true;
 elsif n.mandatory then allowed:=exists(select 1 from public.notification_mandatory_policy_versions mp where mp.id=n.mandatory_policy_version_id and mp.category_code=n.category_code and mp.legal_basis=n.legal_basis and mp.status='ACTIVE'and mp.effective_from<=clock_timestamp()and(mp.effective_until is null or mp.effective_until>clock_timestamp()));
 else allowed:=private.notification_email_consent_active(n.recipient_user_id,n.organization_id,n.category_code)and exists(select 1 from public.user_notification_preferences p where p.user_id=n.recipient_user_id and p.organization_id=n.organization_id and p.category_code=n.category_code and p.channel='EMAIL'and p.delivery_mode in('IMMEDIATE','DIGEST')and p.delivery_mode=d.delivery_mode);
 end if;
 if allowed then return jsonb_build_object('outcome','NOTIFICATION_SEND_AUTHORIZED','authorized',true,'delivery_id',d.id);end if;
 update public.notification_deliveries set status='SKIPPED',next_attempt_at=null,last_error_code=case when billing_blocked then'BILLING_DOCUMENT_SUPERSEDED_OR_RECIPIENT_INVALID'when exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then'EMAIL_RECIPIENT_SUPPRESSED'when n.mandatory then'MANDATORY_LEGAL_BASIS_INACTIVE'else'PREFERENCE_WITHDRAWN'end,lease_token=null,lease_owner=null,leased_until=null,terminal_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp()where id=d.id;
 r:=jsonb_build_object('outcome','NOTIFICATION_SEND_BLOCKED','authorized',false,'delivery_id',d.id,'reason',case when billing_blocked then'BILLING_DOCUMENT_SUPERSEDED_OR_RECIPIENT_INVALID'when exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then'EMAIL_RECIPIENT_SUPPRESSED'when n.mandatory then'MANDATORY_LEGAL_BASIS_INACTIVE'else'PREFERENCE_WITHDRAWN'end);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(n.organization_id,null,'SERVICE','notification.delivery.send_blocked','notification_delivery',d.id::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(n.organization_id,'notification_delivery',d.id::text,'NotificationDeliveryBlockedV1',p_correlation_id,r,'notification-send-blocked:'||d.id::text||':'||d.row_version::text)on conflict do nothing;
 return r;
end$$;

notify pgrst,'reload schema';
commit;
