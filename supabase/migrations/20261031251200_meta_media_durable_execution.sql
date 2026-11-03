-- Explicit approved assets and durable Meta media checkpoints. No ambiguous POST is replayed.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values
 ('marketing-media-source','marketing-media-source',false,52428800,array['image/jpeg','video/mp4']),
 ('marketing-media-public','marketing-media-public',true,52428800,array['image/jpeg','video/mp4']);
create table public.social_media_assets(
 id uuid primary key default extensions.gen_random_uuid(),job_id uuid not null unique references public.social_publication_jobs(id),
 organization_id uuid not null references public.organizations(id),content_version_id uuid not null references public.marketing_content_versions(id),
 sha256 text not null check(sha256~'^[0-9a-f]{64}$'),media_type text not null check(media_type in('image/jpeg','video/mp4')),
 byte_length integer not null check(byte_length between 12 and 52428800 and(media_type<>'image/jpeg'or byte_length<=8388608)),storage_path text not null unique,
 approved_by uuid not null references auth.users(id),approved_at timestamptz not null default clock_timestamp(),uploaded_at timestamptz,
 approval_scope text not null default'PUBLIC_SOCIAL_MEDIA_WITH_TRACKING'check(approval_scope='PUBLIC_SOCIAL_MEDIA_WITH_TRACKING')
);
create table public.social_media_executions(
 id uuid primary key default extensions.gen_random_uuid(),job_id uuid not null unique references public.social_publication_jobs(id),lease_token uuid not null,
 organization_id uuid not null references public.organizations(id),asset_id uuid references public.social_media_assets(id),account_reference text not null,
 state text not null default'ASSET_REQUIRED'check(state in('ASSET_REQUIRED','FREEZING','READY','CREATE_STARTED','CONTAINER_CREATED','PROCESSING','READY_TO_PUBLISH','PUBLISH_STARTED','VERIFYING','PUBLISHED','UNKNOWN','FAILED')),
 caption text,public_asset_url text,delivery_sha256 text check(delivery_sha256~'^[0-9a-f]{64}$'),container_id text check(container_id~'^[0-9]{3,40}$'),publication_id text check(publication_id~'^[0-9]{3,40}$'),
 started_at timestamptz not null default clock_timestamp(),deadline_at timestamptz not null default clock_timestamp()+interval'30 minutes',next_check_at timestamptz not null default clock_timestamp(),
 worker_token uuid,worker_until timestamptz,error_code text,completed_at timestamptz
);
create index social_media_executions_due_idx on public.social_media_executions(next_check_at)where state not in('PUBLISHED','FAILED');
create table public.social_media_step_events(
 id bigint generated always as identity primary key,execution_id uuid not null references public.social_media_executions(id),
 state text not null,response_sha256 text check(response_sha256~'^[0-9a-f]{64}$'),evidence jsonb not null default'{}'::jsonb,
 occurred_at timestamptz not null default clock_timestamp()
);
create table public.social_media_investigations(
 id uuid primary key default extensions.gen_random_uuid(),execution_id uuid not null unique references public.social_media_executions(id),
 requested_by uuid not null references auth.users(id),reason text not null check(length(btrim(reason))between 20 and 1000),
 status text not null default'OPEN'check(status in('OPEN','NATIVE_VERIFIED')),created_at timestamptz not null default clock_timestamp()
);
alter table public.social_media_assets enable row level security;
alter table public.social_media_executions enable row level security;
alter table public.social_media_step_events enable row level security;
alter table public.social_media_investigations enable row level security;
revoke all on public.social_media_assets,public.social_media_executions,public.social_media_step_events,public.social_media_investigations from public,anon,authenticated,service_role;
create trigger social_media_step_events_immutable before update or delete on public.social_media_step_events for each row execute function private.prevent_marketing_history_change();
create function public.reserve_social_media_asset_v1(p_job_id uuid,p_sha256 text,p_media_type text,p_byte_length integer,p_public_use_approved boolean)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare j public.social_publication_jobs%rowtype;v uuid;channel text;a public.social_media_assets%rowtype;actor uuid:=auth.uid();begin
 if actor is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],actor)then raise exception'FORBIDDEN'using errcode='42501';end if;
 if p_public_use_approved is distinct from true or p_sha256 is null or p_sha256!~'^[0-9a-f]{64}$'or p_byte_length not between 12 and 52428800 or(p_media_type='image/jpeg'and p_byte_length>8388608)or p_media_type not in('image/jpeg','video/mp4')then raise exception'MEDIA_EXPLICIT_APPROVAL_REQUIRED'using errcode='22023';end if;
 select*into j from public.social_publication_jobs where id=p_job_id for update;
 select i.content_version_id,c.channel into v,channel from public.marketing_calendar_items i join public.marketing_content_versions cv on cv.id=i.content_version_id join public.marketing_content c on c.id=cv.content_id where i.id=j.calendar_item_id;
 if j.provider is distinct from'META'or channel not in('INSTAGRAM','REEL')or j.status not in('QUEUED','CLAIMED')or(channel='REEL')<>(p_media_type='video/mp4')then raise exception'MEDIA_JOB_NOT_ELIGIBLE'using errcode='55000';end if;
 if exists(select 1 from public.social_media_executions where job_id=j.id and state<>'ASSET_REQUIRED')then raise exception'MEDIA_EXECUTION_ALREADY_FROZEN'using errcode='55000';end if;
 select*into a from public.social_media_assets where job_id=j.id;
 if found then if a.sha256<>p_sha256 or a.media_type<>p_media_type or a.byte_length<>p_byte_length then raise exception'MEDIA_ASSET_IMMUTABLE'using errcode='22000';end if;return jsonb_build_object('asset_id',a.id,'storage_path',a.storage_path,'uploaded',a.uploaded_at is not null);end if;
 insert into public.social_media_assets(job_id,organization_id,content_version_id,sha256,media_type,byte_length,storage_path,approved_by)values(j.id,j.organization_id,v,p_sha256,p_media_type,p_byte_length,j.organization_id::text||'/'||j.id::text||'/'||p_sha256,actor)returning*into a;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(j.organization_id,actor,'USER','marketing.media.public_use_approved','social_media_asset',a.id::text,a.id,jsonb_build_object('job_id',j.id,'sha256',p_sha256,'scope',a.approval_scope),repeat('0',64));
 return jsonb_build_object('asset_id',a.id,'storage_path',a.storage_path,'uploaded',false);
end$$;
create function public.complete_social_media_asset_v1(p_asset_id uuid,p_sha256 text)returns void language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 update public.social_media_assets set uploaded_at=coalesce(uploaded_at,clock_timestamp())where id=p_asset_id and sha256=p_sha256;
 if not found then raise exception'MEDIA_HASH_MISMATCH'using errcode='22000';end if;
end$$;
create function public.begin_social_media_execution_v1(p_job_id uuid,p_lease_token uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare j public.social_publication_jobs%rowtype;i public.marketing_calendar_items%rowtype;channel text;account text;e uuid;begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 select*into j from public.social_publication_jobs where id=p_job_id for update;
 if j.status<>'CLAIMED'or j.lease_token is distinct from p_lease_token or j.lease_expires_at<=clock_timestamp()then raise exception'MEDIA_CLAIM_INVALID'using errcode='55000';end if;
 select*into i from public.marketing_calendar_items where id=j.calendar_item_id;
 select c.channel into channel from public.marketing_content_versions v join public.marketing_content c on c.id=v.content_id where v.id=i.content_version_id;
 select a.provider_account_reference into account from public.marketing_calendars c join public.marketing_schedule_rules r on r.id=c.schedule_rule_id join public.social_accounts a on a.id=r.social_account_id and a.connection_id=i.social_connection_id and a.organization_id=j.organization_id and a.status='ACTIVE'where c.id=i.calendar_id;
 if j.provider<>'META'or channel not in('INSTAGRAM','REEL')or account is null or account!~'^[0-9]{3,40}$'or not private.marketing_publication_ready_v41(j.organization_id,j.provider,i.social_connection_id,i.content_version_id)then raise exception'MEDIA_PUBLICATION_POLICY_REQUIRED'using errcode='55000';end if;
 insert into public.social_media_executions(job_id,lease_token,organization_id,account_reference)values(j.id,j.lease_token,j.organization_id,account)on conflict(job_id)do nothing returning id into e;
 if e is null then select id into e from public.social_media_executions where job_id=j.id and lease_token=p_lease_token;end if;
 if e is null then raise exception'MEDIA_CLAIM_CHANGED'using errcode='55000';end if;
 update public.social_publication_jobs set lease_expires_at=(select deadline_at+interval'1 minute'from public.social_media_executions where id=e)where id=j.id;
 return e;
end$$;
create function public.claim_social_media_step_v1(p_execution_id uuid default null)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare e public.social_media_executions%rowtype;j public.social_publication_jobs%rowtype;i public.marketing_calendar_items%rowtype;v public.marketing_content_versions%rowtype;c public.marketing_content%rowtype;s public.social_connection_security_versions%rowtype;a public.social_media_assets%rowtype;claim jsonb;token uuid:=extensions.gen_random_uuid();begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 select*into e from public.social_media_executions where(p_execution_id is null or id=p_execution_id)and state not in('PUBLISHED','FAILED')and next_check_at<=clock_timestamp()and(worker_until is null or worker_until<=clock_timestamp())order by next_check_at,id for update skip locked limit 1;
 if not found then return jsonb_build_object('outcome','NO_MEDIA_STEP');end if;
 -- A crashed POST start is durable ambiguity. It can never become a new POST permit.
 if e.state in('CREATE_STARTED','PUBLISH_STARTED')then update public.social_media_executions set state=case when e.container_id is null then'UNKNOWN'else'VERIFYING'end,error_code='META_POST_RESPONSE_UNKNOWN'where id=e.id;select*into e from public.social_media_executions where id=e.id;end if;
 if e.deadline_at<=clock_timestamp()and e.state not in('VERIFYING','UNKNOWN')then update public.social_media_executions set state='UNKNOWN',error_code='META_PROCESSING_DEADLINE'where id=e.id;select*into e from public.social_media_executions where id=e.id;end if;
 if e.state='UNKNOWN'and e.container_id is null then update public.social_media_executions set next_check_at=clock_timestamp()+interval'24 hours'where id=e.id;return jsonb_build_object('outcome','MEDIA_OPERATOR_REQUIRED','execution_id',e.id);end if;
 select*into j from public.social_publication_jobs where id=e.job_id;
 select*into i from public.marketing_calendar_items where id=j.calendar_item_id;select*into v from public.marketing_content_versions where id=i.content_version_id;select*into c from public.marketing_content where id=v.content_id;
 select evidence_snapshot into claim from public.social_publication_attempt_events where job_id=j.id and lease_token=e.lease_token and state='CLAIMED';
 select*into s from public.social_connection_security_versions where id=(claim->>'security_version_id')::uuid;
 select*into a from public.social_media_assets where job_id=j.id and uploaded_at is not null;
 if claim is null or s.id is null or v.content_hash is distinct from claim->>'content_hash'then raise exception'MEDIA_ORIGINAL_CLAIM_REQUIRED'using errcode='55000';end if;
 update public.social_media_executions set worker_token=token,worker_until=clock_timestamp()+interval'30 seconds',next_check_at=clock_timestamp()+interval'30 seconds'where id=e.id;
 return jsonb_build_object('outcome','MEDIA_STEP_CLAIMED','execution',to_jsonb(e)-'worker_token'-'worker_until','worker_token',token,'asset',case when a.id is null then null else to_jsonb(a)end,'job',jsonb_build_object('outcome','JOB_CLAIMED','job_id',j.id,'lease_token',e.lease_token,'provider_idempotency_key',(select provider_request_key from public.social_publication_attempt_events where job_id=j.id and lease_token=e.lease_token and state='CLAIMED'),'attempt',j.attempt_count,'provider',j.provider,'channel',c.channel,'credential_reference',s.vault_credential_reference,'content',jsonb_build_object('language',v.language,'hook',v.hook,'body',v.body,'cta',v.cta,'hashtags',v.hashtags,'landing_url',v.landing_url,'media_url',v.media_url)));
end$$;
create function public.advance_social_media_step_v1(p_execution_id uuid,p_worker_token uuid,p_state text,p_evidence jsonb default'{}')returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare e public.social_media_executions%rowtype;j public.social_publication_jobs%rowtype;i public.marketing_calendar_items%rowtype;a public.social_media_assets%rowtype;allowed boolean:=false;proof jsonb;checked text;key text;begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 select*into e from public.social_media_executions where id=p_execution_id for update;
 if not found or p_worker_token is null or e.worker_token is null or e.worker_until is null or e.worker_token is distinct from p_worker_token or e.worker_until<=clock_timestamp()then raise exception'MEDIA_STEP_LEASE_INVALID'using errcode='55000';end if;
 select*into j from public.social_publication_jobs where id=e.job_id for update;select*into i from public.marketing_calendar_items where id=j.calendar_item_id;
 if p_state in('FREEZING','CREATE_STARTED','PUBLISH_STARTED')and(not exists(select 1 from public.marketing_calendars cal join public.marketing_schedule_rules rule on rule.id=cal.schedule_rule_id join public.social_accounts account on account.id=rule.social_account_id and account.connection_id=i.social_connection_id and account.organization_id=j.organization_id where cal.id=i.calendar_id and account.provider_account_reference=e.account_reference and account.status='ACTIVE')or e.deadline_at<=clock_timestamp()or j.status<>'CLAIMED'or not private.marketing_publication_ready_v41(j.organization_id,j.provider,i.social_connection_id,i.content_version_id)or (select id from public.social_connection_security_versions where social_connection_id=i.social_connection_id order by version desc limit 1)is distinct from (select(evidence_snapshot->>'security_version_id')::uuid from public.social_publication_attempt_events where job_id=j.id and lease_token=e.lease_token and state='CLAIMED'))then raise exception'MEDIA_SEND_POLICY_REVOKED'using errcode='42501';end if;
 allowed:=case e.state when'ASSET_REQUIRED'then p_state in('ASSET_REQUIRED','FREEZING','FAILED')when'FREEZING'then p_state in('FREEZING','READY','FAILED')when'READY'then p_state in('CREATE_STARTED','FAILED')when'CREATE_STARTED'then p_state in('CONTAINER_CREATED','UNKNOWN')when'CONTAINER_CREATED'then p_state in('PROCESSING','READY_TO_PUBLISH','UNKNOWN','FAILED','VERIFYING')when'PROCESSING'then p_state in('PROCESSING','READY_TO_PUBLISH','UNKNOWN','FAILED','VERIFYING')when'READY_TO_PUBLISH'then p_state in('PUBLISH_STARTED','UNKNOWN','FAILED')when'PUBLISH_STARTED'then p_state in('VERIFYING','UNKNOWN')when'VERIFYING'then p_state in('VERIFYING','PUBLISHED','UNKNOWN')when'UNKNOWN'then p_state in('UNKNOWN','VERIFYING','PUBLISHED')else false end;
 if not allowed then raise exception'MEDIA_TRANSITION_DENIED'using errcode='55000';end if;
 if p_state='FREEZING'then
  select*into a from public.social_media_assets where job_id=j.id and uploaded_at is not null;
  if a.id is null or p_evidence->>'asset_sha256'is distinct from a.sha256 then raise exception'MEDIA_SOURCE_PROOF_REQUIRED'using errcode='23514';end if;
  update public.social_media_executions set asset_id=a.id where id=e.id;
 end if;
 if p_state='READY'then
  select*into a from public.social_media_assets where job_id=j.id and uploaded_at is not null;
  if a.id is null or p_evidence->>'asset_sha256'is distinct from a.sha256 or length(p_evidence->>'caption')>2200 or position('mref='||e.id::text in coalesce(p_evidence->>'caption',''))=0 or coalesce(p_evidence->>'public_asset_url','')!~'^https://[^/]+/storage/v1/object/public/marketing-media-public/'or right(p_evidence->>'public_asset_url',length(a.storage_path))<>a.storage_path or coalesce(p_evidence->>'delivery_sha256','')!~'^[0-9a-f]{64}$'then raise exception'MEDIA_FROZEN_PROOF_REQUIRED'using errcode='23514';end if;
  update public.social_media_executions set asset_id=a.id,caption=p_evidence->>'caption',public_asset_url=p_evidence->>'public_asset_url',delivery_sha256=p_evidence->>'delivery_sha256'where id=e.id;
 end if;
 if p_state='CONTAINER_CREATED'then if coalesce(p_evidence->>'container_id','')!~'^[0-9]{3,40}$'or coalesce(p_evidence->>'response_sha256','')!~'^[0-9a-f]{64}$'then raise exception'MEDIA_CONTAINER_PROOF_REQUIRED'using errcode='23514';end if;update public.social_media_executions set container_id=p_evidence->>'container_id'where id=e.id;end if;
 if p_state='VERIFYING'and p_evidence?'publication_id'then if coalesce(p_evidence->>'publication_id','')!~'^[0-9]{3,40}$'then raise exception'MEDIA_PUBLICATION_ID_INVALID'using errcode='22023';end if;update public.social_media_executions set publication_id=p_evidence->>'publication_id'where id=e.id;end if;
 if p_state='FAILED'and j.status='CLAIMED'and j.lease_expires_at>clock_timestamp()then
  perform public.record_social_publication_worker_result_v42(j.id,e.lease_token,'PERMANENT_FAILURE',null,coalesce(p_evidence->>'error_code','META_MEDIA_FAILED'),'meta-media-failed:'||e.id::text,e.id);
 end if;
 if p_state='PUBLISHED'then
  if e.container_id is null or e.asset_id is null or e.delivery_sha256 is null or coalesce(p_evidence->>'publication_id','')!~'^[0-9]{3,40}$'or coalesce(p_evidence->>'response_sha256','')!~'^[0-9a-f]{64}$'or p_evidence->>'container_state'is distinct from'PUBLISHED'or p_evidence->>'native_created_at'is null or(p_evidence->>'native_created_at')::timestamptz not between e.started_at-interval'5 seconds'and e.deadline_at+interval'5 seconds'then raise exception'MEDIA_NATIVE_PROOF_REQUIRED'using errcode='23514';end if;
  if j.status='CLAIMED'then update public.social_publication_jobs set status='RECONCILIATION_REQUIRED'where id=j.id and status='CLAIMED';end if;
  select provider_request_key into key from public.social_publication_attempt_events where job_id=j.id and lease_token=e.lease_token and state='CLAIMED';checked:=clock_timestamp()::text;
  proof:=jsonb_build_object('provider_state','PUBLISHED','checked_at',checked,'payload',p_evidence||jsonb_build_object('execution_id',e.id,'container_id',e.container_id,'asset_id',e.asset_id,'delivery_sha256',e.delivery_sha256));
  proof:=proof||jsonb_build_object('evidence_hash',private.canonical_request_hash(jsonb_build_object('job_id',j.id,'provider',j.provider,'provider_request_key',key,'provider_state','PUBLISHED','checked_at',checked,'payload',proof->'payload')));
  perform public.reconcile_social_publication_attempt_v1(j.id,e.lease_token,'PUBLISHED',p_evidence->>'publication_id',null,proof,'meta-media:'||e.id::text,e.id);
  update public.social_media_executions set publication_id=p_evidence->>'publication_id',completed_at=clock_timestamp()where id=e.id;
  update public.social_media_investigations set status='NATIVE_VERIFIED'where execution_id=e.id;
 end if;
 insert into public.social_media_step_events(execution_id,state,response_sha256,evidence)values(e.id,p_state,p_evidence->>'response_sha256',p_evidence);
 update public.social_media_executions set state=p_state,error_code=p_evidence->>'error_code',next_check_at=clock_timestamp()+case when p_state='UNKNOWN'then interval'1 hour'else interval'30 seconds'end,worker_token=case when p_state in('FREEZING','CREATE_STARTED','PUBLISH_STARTED')then p_worker_token else null end,worker_until=case when p_state in('FREEZING','CREATE_STARTED','PUBLISH_STARTED')then e.worker_until else null end where id=e.id;
 return jsonb_build_object('outcome','MEDIA_STEP_RECORDED','state',p_state);
end$$;
create function public.request_social_media_investigation_v1(p_execution_id uuid,p_reason text)returns uuid language plpgsql security definer set search_path=pg_catalog,private,extensions as $$declare result uuid;begin
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],auth.uid())then raise exception'FORBIDDEN'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 20 and 1000 or not exists(select 1 from public.social_media_executions where id=p_execution_id and state in('UNKNOWN','VERIFYING','PROCESSING'))then raise exception'MEDIA_INVESTIGATION_INVALID'using errcode='22023';end if;
 insert into public.social_media_investigations(execution_id,requested_by,reason)values(p_execution_id,auth.uid(),p_reason)on conflict(execution_id)do update set execution_id=excluded.execution_id returning id into result;
 -- This only schedules native reads; it never changes a state to a POST-permitted phase.
 update public.social_media_executions set next_check_at=clock_timestamp()where id=p_execution_id and container_id is not null;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)select organization_id,auth.uid(),'USER','marketing.media.investigation_tracked','social_media_execution',id::text,result,jsonb_build_object('work_item_id',result,'effect','NATIVE_READ_ONLY'),repeat('0',64)from public.social_media_executions where id=p_execution_id;
 return result;
end$$;
create function public.list_social_media_operations_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.uid()is null or coalesce(auth.jwt()->>'aal','')<>'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'FORBIDDEN'using errcode='42501';end if;
 return jsonb_build_object('jobs',coalesce((select jsonb_agg(to_jsonb(q))from(select j.id,c.channel,exists(select 1 from public.social_media_assets where job_id=j.id and uploaded_at is not null)as asset_ready from public.social_publication_jobs j join public.marketing_calendar_items i on i.id=j.calendar_item_id join public.marketing_content_versions v on v.id=i.content_version_id join public.marketing_content c on c.id=v.content_id where j.status in('QUEUED','CLAIMED')and c.channel in('INSTAGRAM','REEL')order by j.available_at limit 100)q),'[]'::jsonb),'executions',coalesce((select jsonb_agg(to_jsonb(q))from(select e.id,e.job_id,e.state,e.error_code,e.container_id,e.deadline_at,(select status from public.social_media_investigations where execution_id=e.id)as investigation_status from public.social_media_executions e order by started_at desc limit 100)q),'[]'::jsonb));
end$$;
revoke all on function public.reserve_social_media_asset_v1(uuid,text,text,integer,boolean),public.request_social_media_investigation_v1(uuid,text),public.list_social_media_operations_v1()from public,anon,service_role;
grant execute on function public.reserve_social_media_asset_v1(uuid,text,text,integer,boolean),public.request_social_media_investigation_v1(uuid,text),public.list_social_media_operations_v1()to authenticated;
revoke all on function public.complete_social_media_asset_v1(uuid,text),public.begin_social_media_execution_v1(uuid,uuid),public.claim_social_media_step_v1(uuid),public.advance_social_media_step_v1(uuid,uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.complete_social_media_asset_v1(uuid,text),public.begin_social_media_execution_v1(uuid,uuid),public.claim_social_media_step_v1(uuid),public.advance_social_media_step_v1(uuid,uuid,text,jsonb)to service_role;
notify pgrst,'reload schema';
