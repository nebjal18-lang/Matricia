-- Read-only native verification of an existing post; this workflow cannot requeue or publish.
create table public.social_native_verification_requests(
 id uuid primary key default extensions.gen_random_uuid(),job_id uuid not null references public.social_publication_jobs(id),lease_token uuid not null,
 provider_publication_id text not null check(length(provider_publication_id)between 3 and 300 and provider_publication_id!~'[[:cntrl:]]'),
 requested_by uuid not null references auth.users(id),idempotency_key uuid not null unique,
 status text not null default'PENDING'check(status in('PENDING','CONFIRMED')),response_hash text check(response_hash~'^[0-9a-f]{64}$'),
 requested_at timestamptz not null default clock_timestamp(),verified_at timestamptz,native_created_at timestamptz
);
alter table public.social_native_verification_requests enable row level security;
revoke all on public.social_native_verification_requests from public,anon,authenticated,service_role;
create function public.request_social_native_verification_v1(p_job_id uuid,p_provider_publication_id text,p_idempotency_key uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid();j public.social_publication_jobs%rowtype;q public.social_native_verification_requests%rowtype;channel text;
begin
 if a is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)then raise exception'SOCIAL_VERIFICATION_DENIED'using errcode='42501';end if;
 if p_provider_publication_id is null or length(p_provider_publication_id)not between 3 and 300 or p_provider_publication_id~'[[:cntrl:]]'or p_idempotency_key is null then raise exception'INVALID_SOCIAL_VERIFICATION_REQUEST'using errcode='22023';end if;
 select*into q from public.social_native_verification_requests where idempotency_key=p_idempotency_key;
 if found then if q.job_id<>p_job_id or q.provider_publication_id<>p_provider_publication_id or q.requested_by<>a then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return q.id;end if;
 select*into j from public.social_publication_jobs where id=p_job_id for update;
 if not found or j.status<>'RECONCILIATION_REQUIRED'or j.lease_token is null then raise exception'SOCIAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 select c.channel into channel from public.marketing_calendar_items i join public.marketing_content_versions v on v.id=i.content_version_id join public.marketing_content c on c.id=v.content_id where i.id=j.calendar_item_id;
 if(j.provider='LINKEDIN'and p_provider_publication_id!~'^urn:li:(share|ugcPost):[A-Za-z0-9_-]+$')or(j.provider='META'and channel='FACEBOOK'and p_provider_publication_id!~'^[0-9]{3,40}(_[0-9]{3,40})?$')then raise exception'INVALID_SOCIAL_PUBLICATION_ID'using errcode='22023';end if;
 if channel not in('LINKEDIN','FACEBOOK')then raise exception'SOCIAL_NATIVE_MEDIA_PROOF_REQUIRED'using errcode='55000';end if;
 insert into public.social_native_verification_requests(job_id,lease_token,provider_publication_id,requested_by,idempotency_key)values(j.id,j.lease_token,p_provider_publication_id,a,p_idempotency_key)returning*into q;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(j.organization_id,a,'USER','marketing.publication.native_verification_requested','social_native_verification_request',q.id::text,q.id,jsonb_build_object('job_id',j.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(j.organization_id,'social_native_verification_request',q.id::text,'SocialNativeVerificationRequestedV1',q.id,jsonb_build_object('verification_request_id',q.id),'social-native:'||q.id::text);
 return q.id;
end$$;
create function public.prepare_social_native_verification_v1(p_request_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare q public.social_native_verification_requests%rowtype;j public.social_publication_jobs%rowtype;i public.marketing_calendar_items%rowtype;v public.marketing_content_versions%rowtype;c public.marketing_content%rowtype;claim public.social_publication_attempt_events%rowtype;s public.social_connection_security_versions%rowtype;account text;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 select*into q from public.social_native_verification_requests where id=p_request_id for update;
 if not found then raise exception'SOCIAL_VERIFICATION_NOT_FOUND'using errcode='P0002';end if;
 if q.status='CONFIRMED'then return jsonb_build_object('outcome','SOCIAL_ALREADY_VERIFIED');end if;
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],q.requested_by)then raise exception'REQUESTER_AUTHORIZATION_REVOKED'using errcode='42501';end if;
 select*into j from public.social_publication_jobs where id=q.job_id;
 if j.status='PUBLISHED'and exists(select 1 from public.marketing_publication_journal where job_id=j.id and provider_publication_id=q.provider_publication_id)then update public.social_native_verification_requests set status='CONFIRMED',verified_at=clock_timestamp(),native_created_at=(select published_at from public.marketing_publication_journal where job_id=j.id)where id=q.id;return jsonb_build_object('outcome','SOCIAL_ALREADY_VERIFIED');end if;
 if j.status<>'RECONCILIATION_REQUIRED'or j.lease_token is distinct from q.lease_token then raise exception'SOCIAL_RECONCILIATION_STATE_CHANGED'using errcode='40001';end if;
 select*into claim from public.social_publication_attempt_events where job_id=j.id and attempt=j.attempt_count and state='CLAIMED'and lease_token=q.lease_token;
 select*into s from public.social_connection_security_versions where id=(claim.evidence_snapshot->>'security_version_id')::uuid;
 select*into i from public.marketing_calendar_items where id=j.calendar_item_id;select*into v from public.marketing_content_versions where id=i.content_version_id;select*into c from public.marketing_content where id=v.content_id;
 select a.provider_account_reference into account from public.marketing_calendars calendar join public.marketing_schedule_rules rule on rule.id=calendar.schedule_rule_id join public.social_accounts a on a.id=rule.social_account_id and a.connection_id=i.social_connection_id and a.organization_id=j.organization_id where calendar.id=i.calendar_id;
 if claim.id is null or s.id is null or account is null or v.content_hash is distinct from claim.evidence_snapshot->>'content_hash'then raise exception'SOCIAL_ORIGINAL_CLAIM_PROOF_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('outcome','SOCIAL_VERIFICATION_AUTHORIZED','publication_id',q.provider_publication_id,'account_reference',account,'claimed_at',j.claimed_at,'lease_expires_at',j.lease_expires_at,'job',jsonb_build_object('outcome','JOB_CLAIMED','job_id',j.id,'lease_token',q.lease_token,'provider_idempotency_key',claim.provider_request_key,'attempt',j.attempt_count,'provider',j.provider,'channel',c.channel,'credential_reference',s.vault_credential_reference,'content',jsonb_build_object('language',v.language,'hook',v.hook,'body',v.body,'cta',v.cta,'hashtags',v.hashtags,'landing_url',v.landing_url,'media_url',v.media_url)));
end$$;
create function public.complete_social_native_verification_v1(p_request_id uuid,p_response_hash text,p_native_created_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare q public.social_native_verification_requests%rowtype;j public.social_publication_jobs%rowtype;work jsonb;evidence jsonb;checked text;key text;result jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 if p_response_hash is null or p_response_hash!~'^[0-9a-f]{64}$'or p_native_created_at is null or p_native_created_at>clock_timestamp()+interval'5 seconds'then raise exception'INVALID_SOCIAL_NATIVE_PROOF'using errcode='22023';end if;
 select*into q from public.social_native_verification_requests where id=p_request_id for update;
 if not found then raise exception'SOCIAL_VERIFICATION_NOT_FOUND'using errcode='P0002';end if;
 if q.status='CONFIRMED'then if q.response_hash is not null and q.response_hash<>p_response_hash then raise exception'SOCIAL_NATIVE_REPLAY_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','SOCIAL_NATIVE_VERIFIED','replayed',true);end if;
 work:=public.prepare_social_native_verification_v1(q.id);
 if work->>'outcome'='SOCIAL_ALREADY_VERIFIED'then return jsonb_build_object('outcome','SOCIAL_NATIVE_VERIFIED','replayed',true);end if;
 select*into j from public.social_publication_jobs where id=q.job_id for update;
 if p_native_created_at<j.claimed_at-interval'5 seconds'or p_native_created_at>j.lease_expires_at+interval'5 seconds'then raise exception'SOCIAL_NATIVE_PROOF_TIME_MISMATCH'using errcode='23514';end if;
 select provider_request_key into key from public.social_publication_attempt_events where job_id=j.id and attempt=j.attempt_count and state='CLAIMED'and lease_token=q.lease_token;
 checked:=clock_timestamp()::text;
 evidence:=jsonb_build_object('provider_state','PUBLISHED','checked_at',checked,'payload',jsonb_build_object('verification_method','NATIVE_API','response_sha256',p_response_hash,'native_created_at',p_native_created_at));
 evidence:=evidence||jsonb_build_object('evidence_hash',private.canonical_request_hash(jsonb_build_object('job_id',j.id,'provider',j.provider,'provider_request_key',key,'provider_state','PUBLISHED','checked_at',checked,'payload',evidence->'payload')));
 result:=public.reconcile_social_publication_attempt_v1(j.id,q.lease_token,'PUBLISHED',q.provider_publication_id,null,evidence,'social-native:'||q.id::text,q.id);
 update public.social_native_verification_requests set status='CONFIRMED',response_hash=p_response_hash,verified_at=clock_timestamp(),native_created_at=p_native_created_at where id=q.id;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(j.organization_id,'SERVICE','marketing.publication.native_verified','social_native_verification_request',q.id::text,q.id,jsonb_build_object('response_sha256',p_response_hash,'resolution','PUBLISHED'),repeat('0',64));
 return jsonb_build_object('outcome','SOCIAL_NATIVE_VERIFIED','replayed',false);
end$$;
create function public.list_social_native_operations_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'FORBIDDEN'using errcode='42501';end if;
 return jsonb_build_object('jobs',coalesce((select jsonb_agg(row_to_json(q))from(select j.id,j.provider,c.channel,j.claimed_at from public.social_publication_jobs j join public.marketing_calendar_items i on i.id=j.calendar_item_id join public.marketing_content_versions v on v.id=i.content_version_id join public.marketing_content c on c.id=v.content_id where j.status='RECONCILIATION_REQUIRED'order by j.created_at limit 100)q),'[]'::jsonb),'requests',coalesce((select jsonb_agg(row_to_json(q))from(select id,job_id,status,requested_at from public.social_native_verification_requests order by requested_at desc limit 100)q),'[]'::jsonb));
end$$;
revoke all on function public.request_social_native_verification_v1(uuid,text,uuid),public.list_social_native_operations_v1()from public,anon,service_role;
grant execute on function public.request_social_native_verification_v1(uuid,text,uuid),public.list_social_native_operations_v1()to authenticated;
revoke all on function public.prepare_social_native_verification_v1(uuid),public.complete_social_native_verification_v1(uuid,text,timestamptz)from public,anon,authenticated;
grant execute on function public.prepare_social_native_verification_v1(uuid),public.complete_social_native_verification_v1(uuid,text,timestamptz)to service_role;
notify pgrst,'reload schema';

create or replace function private.operational_event_replay_is_safe(p_type text,p_error text)returns boolean language sql immutable set search_path=pg_catalog as $$
 select p_type in('ClientCommercialDocumentIssuedV1','SocialNativeVerificationRequestedV1','AdminActionAuthorizedV1','DocumentUploadedV1','ProviderBillingPdfArchivedV1','ProviderInvoiceIssuedV1','ProviderStatementIssuedV1','ProviderBillingDocumentsReadyV1','PrivacyRetentionActionRequestedV1','SubscriptionRefundAuthorizedV1','SubscriptionRefundReconciliationAuthorizedV1')or coalesce(p_error in('INVITATION_LOAD_FAILED','INVITATION_LOAD_INVALID','EMAIL_MODE_UNCONFIGURED','EMAIL_LIVE_DISABLED','EMAIL_RECIPIENT_NOT_ALLOWLISTED','EMAIL_PROVIDER_NOT_CONFIGURED','DOMAIN_CONSUMER_REQUIRED'),false)
$$;
revoke all on function private.operational_event_replay_is_safe(text,text)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';

create or replace function public.reconcile_social_publication_attempt_v1(
  p_job_id uuid,p_lease_token uuid,p_resolution text,p_provider_publication_id text,p_error_code text,
  p_provider_evidence jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions
as $$declare j public.social_publication_jobs%rowtype;i public.marketing_calendar_items%rowtype;v public.marketing_content_versions%rowtype;h text;cached jsonb;r jsonb;auth_hash text;consent_hash text;checked timestamptz;expected_evidence_hash text;claim_evidence jsonb;claim_provider_key text;begin
  if auth.role()is distinct from'service_role'then raise exception'MARKETING_RECONCILIATION_DENIED'using errcode='42501';end if;
  if p_lease_token is null or p_resolution not in('PUBLISHED','REQUEUE','FAILED')
    or(p_resolution='PUBLISHED')<>(p_provider_publication_id is not null)
    or(p_provider_publication_id is not null and(length(p_provider_publication_id)not between 3 and 300
      or p_provider_publication_id~'[[:cntrl:]]'))
    or jsonb_typeof(p_provider_evidence)<>'object'or not(p_provider_evidence?'provider_state')or not(p_provider_evidence?'checked_at')or not(p_provider_evidence?'evidence_hash')
    or coalesce(p_provider_evidence->>'evidence_hash','')!~'^[0-9a-f]{64}$'
    or(p_resolution='PUBLISHED'and p_provider_evidence->>'provider_state'<>'PUBLISHED')
    or(p_resolution='REQUEUE'and p_provider_evidence->>'provider_state'<>'NOT_SENT')
    or(p_resolution='FAILED'and p_provider_evidence->>'provider_state'not in('FAILED','UNKNOWN'))
    or(p_error_code is not null and p_error_code!~'^[A-Z0-9][A-Z0-9_.:-]{1,99}$')then raise exception'INVALID_MARKETING_RECONCILIATION'using errcode='22023';end if;
  select * into j from public.social_publication_jobs where id=p_job_id for update;if not found then raise exception'MARKETING_JOB_NOT_FOUND'using errcode='P0002';end if;
  select evidence_snapshot,provider_request_key into claim_evidence,claim_provider_key from public.social_publication_attempt_events where job_id=j.id and attempt=j.attempt_count and state='CLAIMED'and lease_token=p_lease_token;
  if claim_evidence is null or claim_provider_key is null then raise exception'MARKETING_CLAIM_EVIDENCE_MISSING'using errcode='55000';end if;
  begin checked:=(p_provider_evidence->>'checked_at')::timestamptz;exception when others then raise exception'INVALID_MARKETING_RECONCILIATION_EVIDENCE_TIME'using errcode='22023';end;
  if checked>clock_timestamp()or checked<clock_timestamp()-interval'24 hours'then raise exception'STALE_MARKETING_RECONCILIATION_EVIDENCE'using errcode='22023';end if;
  expected_evidence_hash:=private.canonical_request_hash(jsonb_build_object('job_id',j.id,'provider',j.provider,'provider_request_key',claim_provider_key,'provider_state',p_provider_evidence->>'provider_state','checked_at',p_provider_evidence->>'checked_at','payload',coalesce(p_provider_evidence->'payload','{}'::jsonb)));
  if p_provider_evidence->>'evidence_hash'<>expected_evidence_hash then raise exception'MARKETING_RECONCILIATION_EVIDENCE_HASH_MISMATCH'using errcode='22000';end if;
  h:=private.canonical_request_hash(jsonb_build_object('job',j.id,'lease_token',p_lease_token,'resolution',p_resolution,'provider_publication_id',p_provider_publication_id,'error_code',p_error_code,'provider_evidence',p_provider_evidence));
  cached:=private.begin_marketing_worker_command('marketing.reconcile.'||j.id::text,p_idempotency_key,h);if cached is not null then return cached;end if;
  if j.status<>'RECONCILIATION_REQUIRED'or j.lease_token<>p_lease_token then raise exception'MARKETING_RECONCILIATION_LEASE_INVALID'using errcode='55000';end if;
  select * into i from public.marketing_calendar_items where id=j.calendar_item_id;select * into v from public.marketing_content_versions where id=i.content_version_id;
  if p_resolution='PUBLISHED'then
    insert into public.social_publication_results(job_id,attempt,outcome,provider_publication_id)values(j.id,j.attempt_count,'PUBLISHED',p_provider_publication_id);
    auth_hash:=claim_evidence->>'authorization_evidence_hash';consent_hash:=claim_evidence->>'consent_evidence_hash';
    insert into public.marketing_publication_journal(organization_id,job_id,content_version_id,provider,provider_publication_id,content_snapshot,content_hash,authorization_evidence_hash,consent_evidence_hash,published_at)
      values(j.organization_id,j.id,v.id,j.provider,p_provider_publication_id,jsonb_build_object('language',v.language,'hook',v.hook,'body',v.body,'cta',v.cta,'hashtags',v.hashtags,'landing_url',v.landing_url,'media_url',v.media_url),v.content_hash,auth_hash,consent_hash,coalesce(nullif(p_provider_evidence->'payload'->>'native_created_at','')::timestamptz,clock_timestamp()));
    update public.social_publication_jobs set status='PUBLISHED',lease_token=null,lease_expires_at=null where id=j.id;update public.marketing_calendar_items set status='PUBLISHED'where id=i.id;
  elsif p_resolution='REQUEUE'then update public.social_publication_jobs set status='QUEUED',available_at=clock_timestamp(),lease_token=null,lease_expires_at=null where id=j.id;update public.marketing_calendar_items set status='SCHEDULED'where id=i.id;
  else insert into public.social_publication_results(job_id,attempt,outcome,error_code)values(j.id,j.attempt_count,'PERMANENT_FAILURE',coalesce(p_error_code,'RECONCILIATION_FAILED'));update public.social_publication_jobs set status='FAILED',lease_token=null,lease_expires_at=null where id=j.id;update public.marketing_calendar_items set status='FAILED'where id=i.id;end if;
  insert into public.social_publication_attempt_events(organization_id,job_id,attempt,lease_token,worker_id,state,request_hash,provider_publication_id,error_code,correlation_id)
    values(j.organization_id,j.id,j.attempt_count,p_lease_token,j.claimed_by,case when p_resolution='PUBLISHED'then'SUCCEEDED'when p_resolution='REQUEUE'then'REQUEUED'else'FAILED'end,h,p_provider_publication_id,p_error_code,p_correlation_id);
  r:=jsonb_build_object('outcome','MARKETING_PUBLICATION_RECONCILED','job_id',j.id,'resolution',p_resolution,'provider_evidence_hash',p_provider_evidence->>'evidence_hash');
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(j.organization_id,null,'SERVICE','marketing.publication.reconciled','social_publication_job',j.id::text,p_correlation_id,r,repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(j.organization_id,'social_publication_job',j.id::text,'SocialPublicationReconciledV1',p_correlation_id,r,p_idempotency_key);
  perform private.finish_marketing_worker_command('marketing.reconcile.'||j.id::text,p_idempotency_key,r);return r;end$$;


notify pgrst,'reload schema';
