-- Durable, actor-scoped attachment drafts. CLEAN is a malware verdict, never anonymisation.
-- RFQ files remain unavailable before selection to protect contact details in arbitrary documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('private-message-attachments','private-message-attachments',false,10485760,array['application/pdf','image/jpeg','image/png','text/plain'])on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table public.internal_message_drafts(
 id uuid primary key default extensions.gen_random_uuid(),thread_id uuid not null references public.internal_message_threads(id),sender_organization_id uuid not null references public.organizations(id),actor_user_id uuid not null references auth.users(id),body text not null check(length(btrim(body))between 1 and 4000),row_version integer not null default 1 check(row_version>0),status text not null default'DRAFT'check(status in('DRAFT','SENT','CANCELLED')),message_id uuid references public.internal_messages(id),idempotency_key uuid not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(actor_user_id,idempotency_key),check((status='SENT')=(message_id is not null))
);
create index internal_message_drafts_actor_thread_idx on public.internal_message_drafts(actor_user_id,thread_id,created_at desc,id);
create table public.internal_message_draft_versions(draft_id uuid not null references public.internal_message_drafts(id),version integer not null check(version>0),body text not null,content_hash text not null check(content_hash~'^[0-9a-f]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),primary key(draft_id,version));
create table public.internal_message_draft_files(id uuid primary key default extensions.gen_random_uuid(),draft_id uuid not null references public.internal_message_drafts(id),current_upload_id uuid,removed boolean not null default false,created_at timestamptz not null default clock_timestamp());
create index internal_message_draft_files_draft_idx on public.internal_message_draft_files(draft_id,id);
create table public.internal_message_attachment_uploads(
 id uuid primary key default extensions.gen_random_uuid(),file_id uuid not null references public.internal_message_draft_files(id),draft_id uuid not null references public.internal_message_drafts(id),version integer not null check(version>0),reserved_draft_row_version integer not null check(reserved_draft_row_version>0),actor_user_id uuid not null references auth.users(id),storage_bucket text not null default'private-message-attachments'check(storage_bucket='private-message-attachments'),storage_path text not null unique,original_file_name text not null check(length(btrim(original_file_name))between 1 and 255),media_type text not null check(media_type in('application/pdf','image/jpeg','image/png','text/plain')),size_bytes bigint not null check(size_bytes between 1 and 10485760),expected_sha256 text not null check(expected_sha256~'^[0-9a-f]{64}$'),status text not null default'RESERVED'check(status in('RESERVED','UPLOADED','BOUND')),scan_status text not null default'PENDING'check(scan_status in('PENDING','CLEAN','REJECTED','ERROR')),scan_result_id uuid,audience_snapshot jsonb check(audience_snapshot is null or jsonb_typeof(audience_snapshot)='object'),attachment_id uuid unique references public.internal_message_attachments(id),idempotency_key uuid not null,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default(clock_timestamp()+interval'1 day'),unique(file_id,version),unique(actor_user_id,idempotency_key),check((status='BOUND')=(attachment_id is not null)),check((status='BOUND')=(audience_snapshot is not null))
);
alter table public.internal_message_draft_files add foreign key(current_upload_id)references public.internal_message_attachment_uploads(id);
create unique index internal_message_draft_file_current_upload_idx on public.internal_message_draft_files(current_upload_id);
create index internal_message_attachment_versions_draft_idx on public.internal_message_attachment_uploads(draft_id,file_id,version);
create index internal_message_attachment_scan_pending_idx on public.internal_message_attachment_uploads(created_at,id)where status='UPLOADED'and scan_status='PENDING';
create table private.internal_message_attachment_scan_claims(upload_id uuid primary key references public.internal_message_attachment_uploads(id),worker_id uuid not null,lease_token uuid not null,row_version integer not null check(row_version>0),attempt_count integer not null default 0 check(attempt_count between 0 and 5),leased_until timestamptz not null);
create table private.internal_message_attachment_scan_results(id uuid primary key default extensions.gen_random_uuid(),upload_id uuid not null references public.internal_message_attachment_uploads(id),result text not null check(result in('CLEAN','INFECTED','ERROR')),computed_sha256 text check(computed_sha256 is null or computed_sha256~'^[0-9a-f]{64}$'),engine_code text not null,engine_version text not null,worker_id uuid not null,lease_token uuid not null,row_version integer not null,idempotency_key text not null unique,created_at timestamptz not null default clock_timestamp());
alter table public.internal_message_attachment_uploads add foreign key(scan_result_id)references private.internal_message_attachment_scan_results(id);
create table private.internal_message_attachment_scan_retries(id bigint generated always as identity primary key,upload_id uuid not null references public.internal_message_attachment_uploads(id),attempt integer not null,failure_code text not null,worker_id uuid not null,lease_token uuid not null,created_at timestamptz not null default clock_timestamp());
create function private.internal_message_draft_can_send_v1(p_thread uuid,p_sender uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select auth.uid()is not null and exists(select 1 from public.internal_message_threads t join public.internal_message_participants p on p.thread_id=t.id and p.organization_id=p_sender where t.id=p_thread and t.status='OPEN'and private.is_internal_message_participant(t.id,p_sender,auth.uid())and(p.participant_kind<>'FRANCHISE'or private.franchise_message_can_write(t.franchise_id,auth.uid())))
$$;
create function private.internal_message_draft_owned_v1(p_draft uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$select exists(select 1 from public.internal_message_drafts d where d.id=p_draft and d.actor_user_id=auth.uid()and private.internal_message_draft_can_send_v1(d.thread_id,d.sender_organization_id))$$;
-- Only the selected Provider (or its Client/mandated Franchise counterpart) may exchange files.
create function private.internal_message_attachment_audience_allowed_v1(p_thread uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.internal_message_threads t join public.service_requests sr on sr.id=t.service_request_id where t.id=p_thread and(case when t.object_type in('RFQ','FRANCHISE_RFQ')then sr.status in('PROVIDER_SELECTED','CONTRACT_PENDING','CONTRACTED')and((t.object_type='FRANCHISE_RFQ'and exists(select 1 from public.internal_message_participants p where p.thread_id=t.id and p.participant_kind='CLIENT'))or exists(select 1 from public.quotes q where q.rfq_id=t.object_id and q.provider_organization_id=t.provider_organization_id and q.status='SELECTED'and q.selected_version_id is not null))else true end))
$$;
revoke all on function private.internal_message_draft_can_send_v1(uuid,uuid),private.internal_message_draft_owned_v1(uuid),private.internal_message_attachment_audience_allowed_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function private.internal_message_draft_owned_v1(uuid)to authenticated;
do $$declare name text;begin foreach name in array array['internal_message_drafts','internal_message_draft_versions','internal_message_draft_files','internal_message_attachment_uploads']loop execute format('alter table public.%I enable row level security',name);execute format('revoke all on public.%I from public,anon,authenticated,service_role',name);end loop;end$$;
alter table private.internal_message_attachment_scan_claims enable row level security;alter table private.internal_message_attachment_scan_results enable row level security;alter table private.internal_message_attachment_scan_retries enable row level security;
revoke all on private.internal_message_attachment_scan_claims,private.internal_message_attachment_scan_results,private.internal_message_attachment_scan_retries from public,anon,authenticated,service_role;
create trigger internal_message_draft_version_immutable before update or delete on public.internal_message_draft_versions for each row execute function private.prevent_update_delete();
create trigger internal_message_attachment_scan_result_immutable before update or delete on private.internal_message_attachment_scan_results for each row execute function private.prevent_update_delete();
create trigger internal_message_attachment_scan_retry_immutable before update or delete on private.internal_message_attachment_scan_retries for each row execute function private.prevent_update_delete();
create policy internal_message_attachment_reserved_insert on storage.objects for insert to authenticated with check(bucket_id='private-message-attachments'and exists(select 1 from public.internal_message_attachment_uploads u where u.storage_path=name and u.actor_user_id=auth.uid()and u.status='RESERVED'and u.expires_at>clock_timestamp()and private.internal_message_draft_owned_v1(u.draft_id)));
-- Storage INSERT policy needs only the actor's own reservations; source metadata is never public.
grant select on public.internal_message_attachment_uploads to authenticated;
create policy internal_message_attachment_upload_actor_read on public.internal_message_attachment_uploads for select to authenticated using(actor_user_id=auth.uid()and private.internal_message_draft_owned_v1(draft_id));
create function public.save_internal_message_draft_v1(p_thread_id uuid,p_sender_organization_id uuid,p_body text,p_idempotency_key uuid,p_draft_id uuid default null,p_expected_row_version integer default null)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.internal_message_drafts%rowtype;h text;begin
 if not private.internal_message_draft_can_send_v1(p_thread_id,p_sender_organization_id)then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
 if p_idempotency_key is null or length(btrim(coalesce(p_body,'')))not between 1 and 4000 then raise exception'INVALID_MESSAGE_DRAFT'using errcode='22023';end if;
 if p_draft_id is null then
  perform pg_advisory_xact_lock(hashtextextended('message-draft:'||auth.uid()::text||':'||p_idempotency_key::text,0));select*into d from public.internal_message_drafts where actor_user_id=auth.uid()and idempotency_key=p_idempotency_key;
  if found then if d.thread_id is distinct from p_thread_id or d.sender_organization_id is distinct from p_sender_organization_id or(select body from public.internal_message_draft_versions where draft_id=d.id order by version limit 1)is distinct from btrim(p_body)then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','INTERNAL_MESSAGE_DRAFT_SAVED','draft_id',d.id,'row_version',1);end if;
  insert into public.internal_message_drafts(thread_id,sender_organization_id,actor_user_id,body,idempotency_key)values(p_thread_id,p_sender_organization_id,auth.uid(),btrim(p_body),p_idempotency_key)returning*into d;
 else
  select*into d from public.internal_message_drafts where id=p_draft_id and actor_user_id=auth.uid()for update;
  if d.id is null or d.thread_id is distinct from p_thread_id or d.sender_organization_id is distinct from p_sender_organization_id then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
  if d.status<>'DRAFT'or d.row_version is distinct from p_expected_row_version then raise exception'MESSAGE_DRAFT_CHANGED'using errcode='40001';end if;
  if d.body=btrim(p_body)then return jsonb_build_object('outcome','INTERNAL_MESSAGE_DRAFT_SAVED','draft_id',d.id,'row_version',d.row_version);end if;
  update public.internal_message_drafts set body=btrim(p_body),row_version=row_version+1,updated_at=clock_timestamp()where id=d.id returning*into d;
 end if;
 h:=private.canonical_request_hash(jsonb_build_object('draft_id',d.id,'version',d.row_version,'body',d.body));insert into public.internal_message_draft_versions(draft_id,version,body,content_hash,created_by)values(d.id,d.row_version,d.body,h,auth.uid());
 return jsonb_build_object('outcome','INTERNAL_MESSAGE_DRAFT_SAVED','draft_id',d.id,'row_version',d.row_version);
end$$;
create function public.reserve_internal_message_attachment_v1(p_draft_id uuid,p_expected_row_version integer,p_name text,p_media_type text,p_size_bytes bigint,p_sha256 text,p_idempotency_key uuid,p_file_id uuid default null)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.internal_message_drafts%rowtype;f public.internal_message_draft_files%rowtype;u public.internal_message_attachment_uploads%rowtype;upload uuid:=extensions.gen_random_uuid();ver integer;begin
 if not private.internal_message_draft_owned_v1(p_draft_id)then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
 select*into d from public.internal_message_drafts where id=p_draft_id for update;
 select*into u from public.internal_message_attachment_uploads where actor_user_id=auth.uid()and idempotency_key=p_idempotency_key;
 if found then if u.draft_id is distinct from d.id or u.original_file_name is distinct from btrim(p_name)or u.media_type is distinct from p_media_type or u.size_bytes is distinct from p_size_bytes or u.expected_sha256 is distinct from p_sha256 or(p_file_id is not null and u.file_id is distinct from p_file_id)then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','INTERNAL_MESSAGE_ATTACHMENT_RESERVED','upload_id',u.id,'file_id',u.file_id,'row_version',u.reserved_draft_row_version,'storage_bucket',u.storage_bucket,'storage_path',u.storage_path);end if;
 if d.status<>'DRAFT'or d.row_version is distinct from p_expected_row_version then raise exception'MESSAGE_DRAFT_CHANGED'using errcode='40001';end if;
 if p_idempotency_key is null or length(btrim(coalesce(p_name,'')))not between 1 and 255 or p_media_type is null or p_media_type not in('application/pdf','image/jpeg','image/png','text/plain')or p_size_bytes is null or p_size_bytes not between 1 and 10485760 or coalesce(p_sha256,'')!~'^[0-9a-f]{64}$'then raise exception'INVALID_MESSAGE_ATTACHMENT'using errcode='22023';end if;
 if p_file_id is null then
  if(select count(*)from public.internal_message_draft_files where draft_id=d.id and not removed)>=5 then raise exception'MESSAGE_ATTACHMENT_LIMIT'using errcode='22023';end if;
  insert into public.internal_message_draft_files(draft_id)values(d.id)returning*into f;ver:=1;
 else
  select*into f from public.internal_message_draft_files where id=p_file_id and draft_id=d.id for update;if f.id is null then raise exception'MESSAGE_ATTACHMENT_SCOPE_DENIED'using errcode='42501';end if;
  if f.removed and(select count(*)from public.internal_message_draft_files where draft_id=d.id and not removed)>=5 then raise exception'MESSAGE_ATTACHMENT_LIMIT'using errcode='22023';end if;
  select coalesce(max(version),0)+1 into ver from public.internal_message_attachment_uploads where file_id=f.id;
 end if;
 insert into public.internal_message_attachment_uploads(id,file_id,draft_id,version,reserved_draft_row_version,actor_user_id,storage_path,original_file_name,media_type,size_bytes,expected_sha256,idempotency_key)values(upload,f.id,d.id,ver,d.row_version+1,auth.uid(),'internal-messages/'||d.thread_id::text||'/'||auth.uid()::text||'/'||upload::text,btrim(p_name),p_media_type,p_size_bytes,p_sha256,p_idempotency_key)returning*into u;
 update public.internal_message_draft_files set current_upload_id=u.id,removed=false where id=f.id;update public.internal_message_drafts set row_version=row_version+1,updated_at=clock_timestamp()where id=d.id returning*into d;
 return jsonb_build_object('outcome','INTERNAL_MESSAGE_ATTACHMENT_RESERVED','upload_id',u.id,'file_id',f.id,'row_version',d.row_version,'storage_bucket',u.storage_bucket,'storage_path',u.storage_path);
end$$;
create function public.commit_internal_message_attachment_upload_v1(p_upload_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare u public.internal_message_attachment_uploads%rowtype;o record;begin
 select*into u from public.internal_message_attachment_uploads where id=p_upload_id and actor_user_id=auth.uid()for update;
 if u.id is null or not private.internal_message_draft_owned_v1(u.draft_id)then raise exception'MESSAGE_ATTACHMENT_SCOPE_DENIED'using errcode='42501';end if;
 if u.status in('UPLOADED','BOUND')then return jsonb_build_object('outcome','INTERNAL_MESSAGE_ATTACHMENT_UPLOAD_COMMITTED','upload_id',u.id,'scan_status',u.scan_status);end if;
 if u.expires_at<=clock_timestamp()then raise exception'MESSAGE_UPLOAD_RESERVATION_EXPIRED'using errcode='55000';end if;
 select metadata->>'mimetype'mime,metadata->>'size'size into o from storage.objects where bucket_id=u.storage_bucket and name=u.storage_path;
 if not found or o.mime is distinct from u.media_type or coalesce(o.size,'')!~'^[0-9]+$'or o.size::bigint<>u.size_bytes then raise exception'MESSAGE_UPLOAD_STORAGE_MISMATCH'using errcode='22000';end if;
 update public.internal_message_attachment_uploads set status='UPLOADED'where id=u.id;
 return jsonb_build_object('outcome','INTERNAL_MESSAGE_ATTACHMENT_UPLOAD_COMMITTED','upload_id',u.id,'scan_status','PENDING');
end$$;
create function public.remove_internal_message_draft_file_v1(p_draft_id uuid,p_file_id uuid,p_expected_row_version integer)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$declare d public.internal_message_drafts%rowtype;begin
 if not private.internal_message_draft_owned_v1(p_draft_id)then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;select*into d from public.internal_message_drafts where id=p_draft_id for update;
 if d.status<>'DRAFT'or d.row_version is distinct from p_expected_row_version then raise exception'MESSAGE_DRAFT_CHANGED'using errcode='40001';end if;
 update public.internal_message_draft_files set removed=true where id=p_file_id and draft_id=d.id and not removed;if not found then raise exception'MESSAGE_ATTACHMENT_SCOPE_DENIED'using errcode='42501';end if;
 update public.internal_message_drafts set row_version=row_version+1,updated_at=clock_timestamp()where id=d.id returning*into d;
 return jsonb_build_object('outcome','INTERNAL_MESSAGE_DRAFT_FILE_REMOVED','row_version',d.row_version);
end$$;
create function public.cancel_internal_message_draft_v1(p_draft_id uuid,p_expected_row_version integer)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$declare d public.internal_message_drafts%rowtype;begin
 if not private.internal_message_draft_owned_v1(p_draft_id)then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;select*into d from public.internal_message_drafts where id=p_draft_id for update;
 if d.status='CANCELLED'then return jsonb_build_object('outcome','INTERNAL_MESSAGE_DRAFT_CANCELLED');end if;
 if d.status<>'DRAFT'or d.row_version is distinct from p_expected_row_version then raise exception'MESSAGE_DRAFT_CHANGED'using errcode='40001';end if;
 update public.internal_message_drafts set status='CANCELLED',row_version=row_version+1,updated_at=clock_timestamp()where id=d.id;
 return jsonb_build_object('outcome','INTERNAL_MESSAGE_DRAFT_CANCELLED');
end$$;
create function public.get_internal_message_attachment_drafts_v1(p_thread_id uuid,p_sender_organization_id uuid,p_draft_id uuid default null,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$declare result jsonb;begin
 if not private.internal_message_draft_can_send_v1(p_thread_id,p_sender_organization_id)then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_MESSAGE_DRAFT_PAGE'using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(item)order by created_at desc,id),'[]')into result from(select d.id,d.body,d.row_version,d.status,d.message_id,d.created_at,to_char(d.created_at at time zone'Africa/Casablanca','YYYY-MM-DD HH24:MI')created_label,
 coalesce((select jsonb_agg(jsonb_build_object('file_id',f.id,'upload_id',u.id,'version',u.version,'name',u.original_file_name,'media_type',u.media_type,'size_bytes',u.size_bytes::text,'upload_status',u.status,'scan_status',u.scan_status,'expired',u.expires_at<=clock_timestamp())order by f.created_at,f.id)from public.internal_message_draft_files f join public.internal_message_attachment_uploads u on u.id=f.current_upload_id where f.draft_id=d.id and not f.removed),'[]'::jsonb)files,
 coalesce((select jsonb_agg(jsonb_build_object('file_id',u.file_id,'version',u.version,'name',u.original_file_name,'scan_status',u.scan_status,'current',f.current_upload_id=u.id and not f.removed)order by u.file_id,u.version)from public.internal_message_attachment_uploads u join public.internal_message_draft_files f on f.id=u.file_id where u.draft_id=d.id),'[]'::jsonb)file_versions,
 coalesce((select jsonb_agg(jsonb_build_object('version',v.version,'body',v.body,'created_at',v.created_at)order by v.version)from public.internal_message_draft_versions v where v.draft_id=d.id),'[]'::jsonb)versions
 from public.internal_message_drafts d where d.thread_id=p_thread_id and d.sender_organization_id=p_sender_organization_id and d.actor_user_id=auth.uid()and(d.id=p_draft_id or(p_draft_id is null and d.status='DRAFT'))order by d.created_at desc,d.id limit 50 offset((p_page-1)*50))item;
 return jsonb_build_object('attachments_allowed',private.internal_message_attachment_audience_allowed_v1(p_thread_id),'drafts',result,'has_more',exists(select 1 from public.internal_message_drafts d where d.thread_id=p_thread_id and d.sender_organization_id=p_sender_organization_id and d.actor_user_id=auth.uid()and d.status='DRAFT'order by d.created_at desc,d.id offset(p_page*50)limit 1));
end$$;
create function public.claim_internal_message_attachment_scan_jobs(p_worker_id uuid,p_limit integer default 1,p_lease_seconds integer default 300)returns setof jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$declare item public.internal_message_attachment_uploads%rowtype;c private.internal_message_attachment_scan_claims%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
 if p_worker_id is null or p_limit is null or p_limit not between 1 and 10 or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then raise exception'INVALID_MESSAGE_SCAN_CLAIM'using errcode='22023';end if;
 for item in select u.*from public.internal_message_attachment_uploads u join public.internal_message_drafts d on d.id=u.draft_id and d.status='DRAFT'join public.internal_message_draft_files f on f.current_upload_id=u.id and not f.removed left join private.internal_message_attachment_scan_claims lease on lease.upload_id=u.id where u.status='UPLOADED'and u.scan_status='PENDING'and(lease.upload_id is null or lease.leased_until<=clock_timestamp())order by u.created_at,u.id for update of u skip locked limit p_limit loop
  insert into private.internal_message_attachment_scan_claims as claim(upload_id,worker_id,lease_token,row_version,leased_until)values(item.id,p_worker_id,extensions.gen_random_uuid(),1,clock_timestamp()+make_interval(secs=>p_lease_seconds))on conflict(upload_id)do update set worker_id=excluded.worker_id,lease_token=excluded.lease_token,row_version=claim.row_version+1,leased_until=excluded.leased_until returning*into c;
  return next jsonb_build_object('proof_id',item.id,'lease_token',c.lease_token,'worker_id',c.worker_id,'row_version',c.row_version,'attempt_count',c.attempt_count,'storage_bucket',item.storage_bucket,'storage_path',item.storage_path,'expected_sha256',item.expected_sha256,'media_type',item.media_type,'size_bytes',item.size_bytes);
 end loop;
end$$;
create function public.complete_internal_message_attachment_scan_job(p_proof_id uuid,p_lease_token uuid,p_worker_id uuid,p_expected_row_version integer,p_result text,p_engine_code text,p_engine_version text,p_computed_sha256 text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare c private.internal_message_attachment_scan_claims%rowtype;u public.internal_message_attachment_uploads%rowtype;prior private.internal_message_attachment_scan_results%rowtype;result_id uuid;org uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
 if p_proof_id is null or p_lease_token is null or p_worker_id is null or p_expected_row_version is null or p_expected_row_version<1 then raise exception'MESSAGE_ATTACHMENT_SCAN_LEASE_INVALID'using errcode='55000';end if;
 if p_result is null or p_result not in('CLEAN','INFECTED','ERROR')or(p_result<>'ERROR'and coalesce(p_computed_sha256,'')!~'^[0-9a-f]{64}$')or(p_computed_sha256 is not null and p_computed_sha256!~'^[0-9a-f]{64}$')or coalesce(p_engine_code,'')!~'^[A-Z][A-Z0-9_.-]{2,79}$'or length(btrim(coalesce(p_engine_version,'')))not between 1 and 80 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_MESSAGE_SCAN_VERDICT'using errcode='22023';end if;
 perform private.assert_scan_engine_environment_v1(p_result,p_engine_code);
 p_engine_version:=btrim(p_engine_version);
 select*into prior from private.internal_message_attachment_scan_results where idempotency_key=p_idempotency_key;
 if found then if prior.upload_id is distinct from p_proof_id or prior.lease_token is distinct from p_lease_token or prior.worker_id is distinct from p_worker_id or prior.row_version is distinct from p_expected_row_version or prior.result is distinct from p_result or prior.computed_sha256 is distinct from p_computed_sha256 or prior.engine_code is distinct from p_engine_code or prior.engine_version is distinct from p_engine_version then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','INTERNAL_MESSAGE_ATTACHMENT_SCAN_RECORDED','scan_result_id',prior.id);end if;
 select*into c from private.internal_message_attachment_scan_claims where upload_id=p_proof_id for update;
 if c.upload_id is null or c.lease_token is distinct from p_lease_token or c.worker_id is distinct from p_worker_id or c.row_version is distinct from p_expected_row_version or c.leased_until<=clock_timestamp()then raise exception'MESSAGE_ATTACHMENT_SCAN_LEASE_INVALID'using errcode='55000';end if;
 select*into u from public.internal_message_attachment_uploads where id=p_proof_id for update;
 if u.status<>'UPLOADED'or u.scan_status<>'PENDING'or(p_result='CLEAN'and u.expected_sha256 is distinct from p_computed_sha256)then raise exception'MESSAGE_ATTACHMENT_SCAN_SOURCE_INVALID'using errcode='22000';end if;
 insert into private.internal_message_attachment_scan_results(upload_id,result,computed_sha256,engine_code,engine_version,worker_id,lease_token,row_version,idempotency_key)values(u.id,p_result,p_computed_sha256,p_engine_code,btrim(p_engine_version),p_worker_id,p_lease_token,p_expected_row_version,p_idempotency_key)returning id into result_id;
 update public.internal_message_attachment_uploads set scan_status=case p_result when'INFECTED'then'REJECTED'else p_result end,scan_result_id=result_id where id=u.id;delete from private.internal_message_attachment_scan_claims where upload_id=u.id;
 select sender_organization_id into org from public.internal_message_drafts where id=u.draft_id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,null,'SERVICE','messaging.attachment.scan_recorded','internal_message_attachment_upload',u.id::text,p_correlation_id,jsonb_build_object('result',p_result,'sha256',p_computed_sha256,'scan_result_id',result_id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'internal_message_attachment_upload',u.id::text,'InternalMessageAttachmentScanRecordedV1',p_correlation_id,jsonb_build_object('upload_id',u.id,'scan_result_id',result_id,'result',p_result),'message-attachment-scan:'||result_id::text);
 return jsonb_build_object('outcome','INTERNAL_MESSAGE_ATTACHMENT_SCAN_RECORDED','scan_result_id',result_id);
end$$;
create function public.fail_internal_message_attachment_scan_job(p_proof_id uuid,p_lease_token uuid,p_worker_id uuid,p_expected_row_version integer,p_failure_code text,p_computed_sha256 text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare c private.internal_message_attachment_scan_claims%rowtype;n integer;r jsonb;org uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'TRUSTED_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
 if p_failure_code is null or p_failure_code not in('SCANNER_UNAVAILABLE','SCANNER_INVALID_RESPONSE','STORAGE_DOWNLOAD_FAILED','STORAGE_OBJECT_TOO_LARGE')or(p_computed_sha256 is not null and p_computed_sha256!~'^[0-9a-f]{64}$')then raise exception'INVALID_SCAN_FAILURE'using errcode='22023';end if;
 select*into c from private.internal_message_attachment_scan_claims where upload_id=p_proof_id for update;
 if c.upload_id is null or c.lease_token is distinct from p_lease_token or c.worker_id is distinct from p_worker_id or c.row_version is distinct from p_expected_row_version or c.leased_until<=clock_timestamp()then raise exception'MESSAGE_ATTACHMENT_SCAN_LEASE_INVALID'using errcode='55000';end if;
 n:=c.attempt_count+1;insert into private.internal_message_attachment_scan_retries(upload_id,attempt,failure_code,worker_id,lease_token)values(p_proof_id,n,p_failure_code,p_worker_id,p_lease_token);
 select d.sender_organization_id into org from public.internal_message_attachment_uploads u join public.internal_message_drafts d on d.id=u.draft_id where u.id=p_proof_id;
 if n>=5 then r:=public.complete_internal_message_attachment_scan_job(p_proof_id,p_lease_token,p_worker_id,p_expected_row_version,'ERROR','MATRICIA_MESSAGE_SCAN_DLQ','1.0.0',p_computed_sha256,'message-attachment-scan-dlq:'||p_proof_id::text,p_correlation_id);return jsonb_build_object('outcome','INTERNAL_MESSAGE_ATTACHMENT_SCAN_DEAD_LETTERED','attempt',n);end if;
 update private.internal_message_attachment_scan_claims set attempt_count=n,row_version=row_version+1,lease_token=extensions.gen_random_uuid(),leased_until=clock_timestamp()+make_interval(secs=>least(900,30*(2^n)))where upload_id=p_proof_id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,null,'SERVICE','messaging.attachment.scan_retry','internal_message_attachment_upload',p_proof_id::text,p_correlation_id,jsonb_build_object('attempt',n,'failure_code',p_failure_code),repeat('0',64));
 return jsonb_build_object('outcome','INTERNAL_MESSAGE_ATTACHMENT_SCAN_RETRY_SCHEDULED','attempt',n);
end$$;
alter table public.internal_message_attachments add column trusted_upload_id uuid unique references public.internal_message_attachment_uploads(id);
-- Preserve the latest RFQ/Franchise send implementation and all its mandate/participant gates.
alter function public.send_internal_message(uuid,uuid,text,jsonb,text,uuid)rename to send_internal_message_pre_attachments_v1;
revoke all on function public.send_internal_message_pre_attachments_v1(uuid,uuid,text,jsonb,text,uuid)from public,anon,authenticated,service_role;
create function public.send_internal_message(p_thread_id uuid,p_sender_organization_id uuid,p_body text,p_attachments jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare item jsonb;u public.internal_message_attachment_uploads%rowtype;d public.internal_message_drafts%rowtype;draft uuid;result jsonb;attachments jsonb:='[]';request_hash text;prior private.internal_message_command_keys%rowtype;object_record record;audience jsonb;begin
 if auth.uid()is null or not private.is_internal_message_participant(p_thread_id,p_sender_organization_id,auth.uid())then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
 p_attachments:=coalesce(p_attachments,'[]'::jsonb);
 if jsonb_typeof(p_attachments)is distinct from'array'or jsonb_array_length(p_attachments)>5 then raise exception'INVALID_MESSAGE_ATTACHMENTS'using errcode='22023';end if;
 request_hash:=private.canonical_request_hash(jsonb_build_object('operation','messaging.message.send.v1','thread_id',p_thread_id,'sender_organization_id',p_sender_organization_id,'body',btrim(p_body),'attachments',p_attachments));
 select*into prior from private.internal_message_command_keys where actor_user_id=auth.uid()and operation_scope='messaging.message.send'and key=p_idempotency_key;
 if found and prior.response_body is not null then if prior.request_hash is distinct from request_hash then raise exception'IDEMPOTENCY_KEY_REUSED'using errcode='22000';end if;return prior.response_body;end if;
 if not exists(select 1 from public.internal_message_threads where id=p_thread_id and status='OPEN')then raise exception'MESSAGE_THREAD_NOT_OPEN'using errcode='55000';end if;
 if not private.internal_message_draft_can_send_v1(p_thread_id,p_sender_organization_id)then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
 perform 1 from public.service_requests request join public.internal_message_threads thread on thread.service_request_id=request.id where thread.id=p_thread_id for update of request;
 select jsonb_build_object('thread_id',thread.id,'object_type',thread.object_type,'service_request_id',request.id,'request_row_version',request.row_version,'request_status',request.status,'contact_policy_version',thread.contact_policy_version,'provider_organization_id',thread.provider_organization_id,'selected_quote_version_id',(select q.selected_version_id from public.quotes q where q.rfq_id=thread.object_id and q.provider_organization_id=thread.provider_organization_id and q.status='SELECTED'),'authorized_at',clock_timestamp())into audience from public.internal_message_threads thread join public.service_requests request on request.id=thread.service_request_id where thread.id=p_thread_id;
 if not private.internal_message_attachment_audience_allowed_v1(p_thread_id)and private.contains_direct_contact(p_body)then raise exception'DIRECT_CONTACT_BLOCKED'using errcode='22023';end if;
 if jsonb_array_length(p_attachments)>0 and not private.internal_message_attachment_audience_allowed_v1(p_thread_id)then raise exception'MESSAGE_ATTACHMENTS_SELECTION_REQUIRED'using errcode='55000';end if;
 if jsonb_array_length(p_attachments)>0 then
  select draft_id into draft from public.internal_message_attachment_uploads where id::text=(p_attachments->0->>'upload_id')and actor_user_id=auth.uid();
  select*into d from public.internal_message_drafts where id=draft for update;
  if d.id is null or d.actor_user_id is distinct from auth.uid()or d.thread_id is distinct from p_thread_id or d.sender_organization_id is distinct from p_sender_organization_id or d.status<>'DRAFT'then raise exception'MESSAGE_ATTACHMENT_SCOPE_DENIED'using errcode='42501';end if;
 end if;
 for item in select value from jsonb_array_elements(p_attachments)loop
  select*into u from public.internal_message_attachment_uploads where id::text=item->>'upload_id'and actor_user_id=auth.uid()for update;
  if u.id is null or u.status<>'UPLOADED'or u.scan_status<>'CLEAN'or not exists(select 1 from private.internal_message_attachment_scan_results scan where scan.id=u.scan_result_id and scan.upload_id=u.id and scan.result='CLEAN'and scan.computed_sha256=u.expected_sha256)then raise exception'MESSAGE_ATTACHMENT_CLEAN_UPLOAD_REQUIRED'using errcode='55000';end if;
  if draft is not null and draft is distinct from u.draft_id then raise exception'MESSAGE_ATTACHMENT_SCOPE_DENIED'using errcode='42501';end if;draft:=u.draft_id;
  if not exists(select 1 from public.internal_message_draft_files f where f.id=u.file_id and f.draft_id=u.draft_id and f.current_upload_id=u.id and not f.removed)then raise exception'MESSAGE_ATTACHMENT_VERSION_CHANGED'using errcode='40001';end if;
  if(item->>'bucket')is distinct from u.storage_bucket or(item->>'path')is distinct from u.storage_path or(item->>'name')is distinct from u.original_file_name or(item->>'mime_type')is distinct from u.media_type or(item->>'size_bytes')is distinct from u.size_bytes::text or(item->>'sha256')is distinct from u.expected_sha256 then raise exception'MESSAGE_ATTACHMENT_SOURCE_MISMATCH'using errcode='22000';end if;
  select metadata->>'mimetype'mime,metadata->>'size'size into object_record from storage.objects where bucket_id=u.storage_bucket and name=u.storage_path;
  if not found or object_record.mime is distinct from u.media_type or coalesce(object_record.size,'')!~'^[0-9]+$'or object_record.size::bigint<>u.size_bytes then raise exception'MESSAGE_UPLOAD_STORAGE_MISMATCH'using errcode='22000';end if;
  attachments:=attachments||jsonb_build_array(item);
 end loop;
 if draft is not null then
  select*into d from public.internal_message_drafts where id=draft for update;
  if d.actor_user_id is distinct from auth.uid()or d.thread_id is distinct from p_thread_id or d.sender_organization_id is distinct from p_sender_organization_id or d.body is distinct from btrim(p_body)or d.status<>'DRAFT'then raise exception'MESSAGE_DRAFT_CHANGED'using errcode='40001';end if;
  if(select count(*)from public.internal_message_draft_files f where f.draft_id=d.id and not f.removed)<>jsonb_array_length(attachments)or(select count(distinct value->>'upload_id')from jsonb_array_elements(attachments))<>jsonb_array_length(attachments)then raise exception'MESSAGE_ATTACHMENT_SET_CHANGED'using errcode='40001';end if;
 end if;
 result:=public.send_internal_message_pre_attachments_v1(p_thread_id,p_sender_organization_id,p_body,attachments,p_idempotency_key,p_correlation_id);
 for item in select value from jsonb_array_elements(attachments)loop
  select*into u from public.internal_message_attachment_uploads where id=(item->>'upload_id')::uuid;
  update public.internal_message_attachments set trusted_upload_id=u.id,scan_status='CLEAN',scanned_at=(select created_at from private.internal_message_attachment_scan_results where id=u.scan_result_id),scan_result_code='TRUSTED_MESSAGE_SCAN'where message_id=(result->>'message_id')::uuid and storage_bucket=u.storage_bucket and storage_object_path=u.storage_path and scan_status='PENDING';
  if not found then raise exception'MESSAGE_ATTACHMENT_BINDING_FAILED'using errcode='55000';end if;
  update public.internal_message_attachment_uploads set status='BOUND',audience_snapshot=audience,attachment_id=(select id from public.internal_message_attachments where trusted_upload_id=u.id)where id=u.id;
 end loop;
 if draft is not null then update public.internal_message_drafts set status='SENT',message_id=(result->>'message_id')::uuid,row_version=row_version+1,updated_at=clock_timestamp()where id=draft;end if;
 return result;
end$$;
create function public.finalize_internal_message_draft_v1(p_draft_id uuid,p_expected_row_version integer)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.internal_message_drafts%rowtype;attachments jsonb;result jsonb;begin
 select*into d from public.internal_message_drafts where id=p_draft_id and actor_user_id=auth.uid();
 if d.id is null or not private.is_internal_message_participant(d.thread_id,d.sender_organization_id,auth.uid())then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
 perform 1 from public.service_requests request join public.internal_message_threads thread on thread.service_request_id=request.id where thread.id=d.thread_id for update of request;
 select*into d from public.internal_message_drafts where id=p_draft_id and actor_user_id=auth.uid()for update;
 if d.status='SENT'then select response_body into result from private.internal_message_command_keys where actor_user_id=auth.uid()and operation_scope='messaging.message.send'and key='draft:'||d.id::text;return result;end if;
 if d.status<>'DRAFT'or d.row_version is distinct from p_expected_row_version then raise exception'MESSAGE_DRAFT_CHANGED'using errcode='40001';end if;
 select coalesce(jsonb_agg(jsonb_build_object('upload_id',u.id,'bucket',u.storage_bucket,'path',u.storage_path,'name',u.original_file_name,'mime_type',u.media_type,'size_bytes',u.size_bytes::text,'sha256',u.expected_sha256)order by f.created_at,f.id),'[]')into attachments from public.internal_message_draft_files f join public.internal_message_attachment_uploads u on u.id=f.current_upload_id where f.draft_id=d.id and not f.removed;
 if(select count(*)from public.internal_message_draft_files where draft_id=d.id and not removed)<>jsonb_array_length(attachments)then raise exception'MESSAGE_ATTACHMENT_SET_CHANGED'using errcode='40001';end if;
 result:=public.send_internal_message(d.thread_id,d.sender_organization_id,d.body,attachments,'draft:'||d.id::text,d.id);
 if jsonb_array_length(attachments)=0 then update public.internal_message_drafts set status='SENT',message_id=(result->>'message_id')::uuid,row_version=row_version+1,updated_at=clock_timestamp()where id=d.id;end if;
 return result;
end$$;
create function private.internal_message_attachment_is_downloadable_v1(p_attachment_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private,storage as $$
 select exists(select 1 from public.internal_message_attachments a join public.internal_messages m on m.id=a.message_id join public.internal_message_threads t on t.id=m.thread_id join public.internal_message_attachment_uploads u on u.id=a.trusted_upload_id and u.attachment_id=a.id and u.status='BOUND'and u.scan_status='CLEAN'join private.internal_message_attachment_scan_results scan on scan.id=u.scan_result_id and scan.upload_id=u.id and scan.result='CLEAN'and scan.computed_sha256=a.sha256
 join storage.objects object on object.bucket_id=a.storage_bucket and object.name=a.storage_object_path join storage.buckets bucket on bucket.id=object.bucket_id and not bucket.public
 where a.id=p_attachment_id and a.scan_status='CLEAN'and a.scanned_at is not null and a.scan_result_code='TRUSTED_MESSAGE_SCAN'and a.storage_bucket=u.storage_bucket and a.storage_object_path=u.storage_path and a.sha256=u.expected_sha256 and a.mime_type=u.media_type and a.size_bytes=u.size_bytes and object.metadata->>'mimetype'=a.mime_type and object.metadata->>'size'=a.size_bytes::text and u.actor_user_id=m.sender_user_id and u.audience_snapshot->>'thread_id'=m.thread_id::text and u.audience_snapshot->>'service_request_id'=t.service_request_id::text and u.audience_snapshot->>'object_type'=t.object_type and(u.audience_snapshot->>'object_type'not in('RFQ','FRANCHISE_RFQ')or u.audience_snapshot->>'request_status'in('PROVIDER_SELECTED','CONTRACT_PENDING','CONTRACTED')))
$$;
create function private.internal_message_attachment_read_access_v1(p_attachment_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select private.internal_message_attachment_is_downloadable_v1(p_attachment_id)and exists(select 1 from public.internal_message_attachments a join public.internal_messages m on m.id=a.message_id where a.id=p_attachment_id and(exists(select 1 from public.internal_message_participants p where p.thread_id=m.thread_id and private.is_internal_message_participant(m.thread_id,p.organization_id,auth.uid()))or(auth.jwt()->>'aal'='aal2'and private.can_access_internal_message_thread(m.thread_id,auth.uid()))))
$$;
revoke all on function private.internal_message_attachment_is_downloadable_v1(uuid),private.internal_message_attachment_read_access_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function private.internal_message_attachment_read_access_v1(uuid)to authenticated;
create policy internal_message_attachment_clean_scoped_read on storage.objects for select to authenticated using(bucket_id='private-message-attachments'and exists(select 1 from public.internal_message_attachments a where a.storage_bucket=bucket_id and a.storage_object_path=name and private.internal_message_attachment_read_access_v1(a.id)));
create function public.get_internal_message_attachment_v1(p_attachment_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$declare a public.internal_message_attachments%rowtype;org uuid;begin
 if not coalesce(private.internal_message_attachment_read_access_v1(p_attachment_id),false)then raise exception'MESSAGE_ATTACHMENT_NOT_AVAILABLE'using errcode='42501';end if;
 select*into a from public.internal_message_attachments where id=p_attachment_id;select sender_organization_id into org from public.internal_messages where id=a.message_id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,auth.uid(),'USER','messaging.attachment.read_authorized','internal_message_attachment',a.id::text,extensions.gen_random_uuid(),jsonb_build_object('sha256',a.sha256,'size_bytes',a.size_bytes),repeat('0',64));
 return jsonb_build_object('bucket',a.storage_bucket,'path',a.storage_object_path,'sha256',a.sha256,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'name',a.original_file_name);
end$$;
create function private.protect_internal_message_draft_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if tg_op='DELETE'or old.status in('SENT','CANCELLED')then raise exception'IMMUTABLE_MESSAGE_DRAFT_STATE'using errcode='55000';end if;
 if row(new.id,new.thread_id,new.sender_organization_id,new.actor_user_id,new.idempotency_key,new.created_at)is distinct from row(old.id,old.thread_id,old.sender_organization_id,old.actor_user_id,old.idempotency_key,old.created_at)or new.row_version<>old.row_version+1 then raise exception'IMMUTABLE_MESSAGE_DRAFT_SCOPE'using errcode='55000';end if;return new;
end$$;
create trigger internal_message_draft_protected before update or delete on public.internal_message_drafts for each row execute function private.protect_internal_message_draft_v1();
revoke all on function private.protect_internal_message_draft_v1()from public,anon,authenticated,service_role;
create function private.protect_internal_message_upload_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if tg_op='DELETE'then raise exception'IMMUTABLE_MESSAGE_ATTACHMENT_SOURCE'using errcode='55000';end if;
 if row(new.id,new.file_id,new.draft_id,new.version,new.reserved_draft_row_version,new.actor_user_id,new.storage_bucket,new.storage_path,new.original_file_name,new.media_type,new.size_bytes,new.expected_sha256,new.idempotency_key,new.created_at,new.expires_at)is distinct from row(old.id,old.file_id,old.draft_id,old.version,old.reserved_draft_row_version,old.actor_user_id,old.storage_bucket,old.storage_path,old.original_file_name,old.media_type,old.size_bytes,old.expected_sha256,old.idempotency_key,old.created_at,old.expires_at)then raise exception'IMMUTABLE_MESSAGE_ATTACHMENT_SOURCE'using errcode='55000';end if;
 if old.status='BOUND'or(old.status='UPLOADED'and new.status not in('UPLOADED','BOUND'))or(old.status='RESERVED'and new.status not in('RESERVED','UPLOADED'))or(new.status='BOUND'and(new.scan_status<>'CLEAN'or new.attachment_id is null))then raise exception'INVALID_MESSAGE_ATTACHMENT_TRANSITION'using errcode='55000';end if;
 if new.audience_snapshot is distinct from old.audience_snapshot and not(old.status='UPLOADED'and new.status='BOUND')then raise exception'IMMUTABLE_MESSAGE_ATTACHMENT_AUDIENCE'using errcode='55000';end if;
 if(old.scan_status<>'PENDING'and row(new.scan_status,new.scan_result_id)is distinct from row(old.scan_status,old.scan_result_id))or(new.scan_status='PENDING'and new.scan_result_id is not null)or(new.scan_status<>'PENDING'and new.scan_result_id is null)then raise exception'IMMUTABLE_MESSAGE_ATTACHMENT_SCAN'using errcode='55000';end if;
 return new;
end$$;
create trigger internal_message_attachment_upload_protected before update or delete on public.internal_message_attachment_uploads for each row execute function private.protect_internal_message_upload_v1();
create function private.protect_internal_message_trusted_binding_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if new.trusted_upload_id is distinct from old.trusted_upload_id and not(old.trusted_upload_id is null and old.scan_status='PENDING'and new.scan_status='CLEAN'and new.trusted_upload_id is not null)then raise exception'IMMUTABLE_MESSAGE_ATTACHMENT_BINDING'using errcode='55000';end if;return new;
end$$;
create trigger internal_message_trusted_binding_protected before update on public.internal_message_attachments for each row execute function private.protect_internal_message_trusted_binding_v1();
create function private.audit_internal_message_draft_change_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$declare draft public.internal_message_drafts%rowtype;begin
 if tg_table_name='internal_message_drafts'then draft:=new;else select*into draft from public.internal_message_drafts where id=new.draft_id;end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(draft.sender_organization_id,auth.uid(),case when auth.uid()is null then'SERVICE'else'USER'end,'messaging.draft.'||lower(tg_op),tg_table_name,new.id::text,draft.id,jsonb_build_object('draft_id',draft.id,'draft_row_version',draft.row_version,'status',draft.status,'change_kind',case when tg_table_name='internal_message_draft_files'then'FILE_SELECTION'else'DRAFT_STATE'end),repeat('0',64));return new;
end$$;
create trigger internal_message_draft_audit after insert or update on public.internal_message_drafts for each row execute function private.audit_internal_message_draft_change_v1();
create trigger internal_message_draft_file_audit after insert or update on public.internal_message_draft_files for each row execute function private.audit_internal_message_draft_change_v1();
revoke all on function private.protect_internal_message_upload_v1(),private.protect_internal_message_trusted_binding_v1(),private.audit_internal_message_draft_change_v1()from public,anon,authenticated,service_role;
-- Preserve the approved read contracts; only replace the download readiness predicate.
do $$declare target regprocedure;definition text;name text;begin
 foreach name in array array['public.get_internal_message_thread(uuid,integer)','public.get_internal_message_thread_page(uuid,timestamp with time zone,uuid,integer)','public.get_admin_thread_message_page_v1(uuid,timestamp with time zone,uuid,integer)']loop
  target:=to_regprocedure(name);if target is null then raise exception'MESSAGE_ATTACHMENT_READER_PATCH_TARGET_MISSING: %',name;end if;
  select pg_get_functiondef(target)into definition;
  if strpos(definition,'a.scan_status=''CLEAN''')=0 then raise exception'MESSAGE_ATTACHMENT_READINESS_PATCH_TARGET_MISSING: %',name;end if;
  execute replace(definition,'a.scan_status=''CLEAN''','private.internal_message_attachment_is_downloadable_v1(a.id)');
 end loop;
 target:=to_regprocedure('public.get_admin_conversation_attachment_v1(uuid)');if target is null then raise exception'ADMIN_MESSAGE_ATTACHMENT_PATCH_TARGET_MISSING';end if;
 select pg_get_functiondef(target)into definition;
 if strpos(definition,'if a.scan_status<>''CLEAN''')=0 then raise exception'ADMIN_MESSAGE_ATTACHMENT_READ_PATCH_TARGET_MISSING';end if;
 execute replace(definition,'if a.scan_status<>''CLEAN''','if not private.internal_message_attachment_is_downloadable_v1(a.id)or a.scan_status<>''CLEAN''');
end$$;
revoke all on function public.save_internal_message_draft_v1(uuid,uuid,text,uuid,uuid,integer),public.reserve_internal_message_attachment_v1(uuid,integer,text,text,bigint,text,uuid,uuid),public.commit_internal_message_attachment_upload_v1(uuid),public.remove_internal_message_draft_file_v1(uuid,uuid,integer),public.cancel_internal_message_draft_v1(uuid,integer),public.get_internal_message_attachment_drafts_v1(uuid,uuid,uuid,integer),public.send_internal_message(uuid,uuid,text,jsonb,text,uuid),public.finalize_internal_message_draft_v1(uuid,integer),public.get_internal_message_attachment_v1(uuid)from public,anon,service_role;
grant execute on function public.save_internal_message_draft_v1(uuid,uuid,text,uuid,uuid,integer),public.reserve_internal_message_attachment_v1(uuid,integer,text,text,bigint,text,uuid,uuid),public.commit_internal_message_attachment_upload_v1(uuid),public.remove_internal_message_draft_file_v1(uuid,uuid,integer),public.cancel_internal_message_draft_v1(uuid,integer),public.get_internal_message_attachment_drafts_v1(uuid,uuid,uuid,integer),public.send_internal_message(uuid,uuid,text,jsonb,text,uuid),public.finalize_internal_message_draft_v1(uuid,integer),public.get_internal_message_attachment_v1(uuid)to authenticated;
revoke all on function public.claim_internal_message_attachment_scan_jobs(uuid,integer,integer),public.complete_internal_message_attachment_scan_job(uuid,uuid,uuid,integer,text,text,text,text,text,uuid),public.fail_internal_message_attachment_scan_job(uuid,uuid,uuid,integer,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.claim_internal_message_attachment_scan_jobs(uuid,integer,integer),public.complete_internal_message_attachment_scan_job(uuid,uuid,uuid,integer,text,text, text,text,text,uuid),public.fail_internal_message_attachment_scan_job(uuid,uuid,uuid,integer,text,text,uuid)to service_role;
notify pgrst,'reload schema';
