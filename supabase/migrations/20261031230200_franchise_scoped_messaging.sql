-- Separate two-party franchise conversations; existing client/provider RFQ threads remain private.
drop policy if exists internal_message_threads_franchise_library_read on public.internal_message_threads;
alter table public.internal_message_threads drop constraint internal_message_threads_object_type_check;
alter table public.internal_message_threads add constraint internal_message_threads_object_type_check check(object_type in('RFQ','FRANCHISE_RFQ'));
alter table public.internal_message_threads add column franchise_id uuid references public.franchises(id) on delete restrict;
alter table public.internal_message_threads add column counterparty_organization_id uuid references public.organizations(id) on delete restrict;
alter table public.internal_message_threads add constraint franchise_message_context check(
 (object_type='RFQ' and franchise_id is null and counterparty_organization_id is null)
 or(object_type='FRANCHISE_RFQ' and franchise_id is not null and counterparty_organization_id is not null and provider_organization_id=counterparty_organization_id));
-- Replace the original pair uniqueness with one index for each explicit conversation context.
do $$declare key_name text;begin
 select conname into key_name from pg_constraint where conrelid='public.internal_message_threads'::regclass and contype='u' and conkey=array[
 (select attnum from pg_attribute where attrelid='public.internal_message_threads'::regclass and attname='object_type'),
 (select attnum from pg_attribute where attrelid='public.internal_message_threads'::regclass and attname='object_id'),
 (select attnum from pg_attribute where attrelid='public.internal_message_threads'::regclass and attname='provider_organization_id')]::smallint[];
 if key_name is null then raise exception 'INTERNAL_MESSAGE_PAIR_CONSTRAINT_MISSING';end if;
 execute format('alter table public.internal_message_threads drop constraint %I',key_name);
end$$;
create unique index internal_rfq_message_pair on public.internal_message_threads(object_type,object_id,provider_organization_id)where object_type='RFQ';
create unique index internal_franchise_message_pair on public.internal_message_threads(object_id,franchise_id,counterparty_organization_id)where object_type='FRANCHISE_RFQ';
alter table public.internal_message_participants drop constraint internal_message_participants_participant_kind_check;
alter table public.internal_message_participants drop constraint internal_message_participants_display_alias_check;
alter table public.internal_message_participants add constraint internal_message_participants_participant_kind_check check(participant_kind in('CLIENT','PROVIDER','FRANCHISE'));
alter table public.internal_message_participants add constraint internal_message_participants_display_alias_check check(display_alias in('CLIENT','PROVIDER','FRANCHISE'));

create function private.active_franchise_messaging_scope(p_franchise_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.franchise_digest_role_access(p_franchise_id,false,p_actor)and exists(
 select 1 from public.franchises f join public.franchise_mandate_versions m on m.id=f.current_mandate_version_id and m.franchise_id=f.id
 where f.id=p_franchise_id and f.status='ACTIVE'and m.mandate_status='ACTIVE'and m.effective_from<=now()and(m.effective_until is null or m.effective_until>now()))
$$;
create function private.franchise_message_can_write(p_franchise_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.active_franchise_messaging_scope(p_franchise_id,p_actor)and exists(
 select 1 from public.franchises f join public.organization_memberships m on m.organization_id=f.operator_organization_id and m.user_id=p_actor and m.status='ACTIVE'
 join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null and r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER')
 where f.id=p_franchise_id and(r.franchise_id=f.id or(r.franchise_id is null and(select count(*)from public.franchises other where other.operator_organization_id=f.operator_organization_id and other.status='ACTIVE')=1)))
$$;
create function private.is_internal_message_participant(p_thread_id uuid,p_organization_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.internal_message_participants p join public.internal_message_threads t on t.id=p.thread_id
 where p.thread_id=p_thread_id and p.organization_id=p_organization_id and private.is_active_org_member(p.organization_id,p_actor)
 and(p.participant_kind<>'FRANCHISE'or exists(select 1 from public.franchises f where f.id=t.franchise_id and f.operator_organization_id=p.organization_id and private.active_franchise_messaging_scope(f.id,p_actor))))
$$;
create or replace function private.can_access_internal_message_thread(p_thread_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.internal_message_participants p where p.thread_id=p_thread_id and private.is_internal_message_participant(p_thread_id,p.organization_id,p_actor))
 or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR'],p_actor)
$$;

create function public.franchise_message_counterparties(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;result jsonb;
begin
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_MESSAGE_SCOPE_DENIED'using errcode='42501';end if;
 select * into f from public.franchises where id=p_franchise_id;
 select coalesce(jsonb_agg(jsonb_build_object('rfq_id',x.rfq_id,'organization_id',x.organization_id,'kind',x.kind)order by x.rfq_id,x.kind,x.organization_id),'[]'::jsonb)into result from(
 select r.id rfq_id,s.client_organization_id organization_id,'CLIENT'::text kind from public.rfqs r join public.service_requests s on s.id=r.request_id where s.library_id=f.library_id and r.status='OPEN'and s.status in('RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW')and s.client_organization_id<>f.operator_organization_id
 union
 select r.id,rp.provider_organization_id,'PROVIDER'from public.rfqs r join public.service_requests s on s.id=r.request_id join public.rfq_providers rp on rp.rfq_id=r.id and rp.status not in('WITHDRAWN','SUSPENDED')where s.library_id=f.library_id and r.status='OPEN'and s.status in('RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW')and rp.provider_organization_id<>f.operator_organization_id)x;
 return result;
end$$;

create function public.open_franchise_rfq_message_thread(p_franchise_id uuid,p_rfq_id uuid,p_counterparty_organization_id uuid,p_subject text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();f public.franchises%rowtype;r public.rfqs%rowtype;s public.service_requests%rowtype;kind text;h text;command uuid;replay jsonb;thread uuid;response jsonb;
begin
 if not private.franchise_message_can_write(p_franchise_id,a)then raise exception 'FRANCHISE_MESSAGE_SCOPE_DENIED'using errcode='42501';end if;
 select * into f from public.franchises where id=p_franchise_id;
 select * into r from public.rfqs where id=p_rfq_id;
 select * into s from public.service_requests where id=r.request_id;
 if s.library_id is distinct from f.library_id or r.status is distinct from'OPEN'or s.status not in('RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW')then raise exception 'FRANCHISE_MESSAGE_CONTEXT_DENIED'using errcode='42501';end if;
 if p_counterparty_organization_id=s.client_organization_id then kind:='CLIENT';
 elsif exists(select 1 from public.rfq_providers rp where rp.rfq_id=r.id and rp.provider_organization_id=p_counterparty_organization_id and rp.status not in('WITHDRAWN','SUSPENDED'))then kind:='PROVIDER';
 else raise exception 'FRANCHISE_MESSAGE_PARTICIPANT_DENIED'using errcode='42501';end if;
 if p_counterparty_organization_id=f.operator_organization_id or length(btrim(coalesce(p_subject,'')))not between 3 and 160 or private.contains_direct_contact(p_subject)then raise exception 'INVALID_MESSAGE_SUBJECT'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('operation','franchise.messaging.open.v1','franchise',f.id,'rfq',r.id,'counterparty',p_counterparty_organization_id,'subject',btrim(p_subject)));
 select b.command_id,b.response_body into command,replay from private.begin_internal_message_command(a,'messaging.thread.open',p_idempotency_key,h)b;
 if replay is not null then return replay;end if;
 insert into public.internal_message_threads(object_type,object_id,service_request_id,client_organization_id,provider_organization_id,franchise_id,counterparty_organization_id,subject,created_by)
 values('FRANCHISE_RFQ',r.id,s.id,f.operator_organization_id,p_counterparty_organization_id,f.id,p_counterparty_organization_id,btrim(p_subject),a)
 on conflict(object_id,franchise_id,counterparty_organization_id)where object_type='FRANCHISE_RFQ'do nothing returning id into thread;
 if thread is null then select id into thread from public.internal_message_threads where object_type='FRANCHISE_RFQ'and object_id=r.id and franchise_id=f.id and counterparty_organization_id=p_counterparty_organization_id;end if;
 insert into public.internal_message_participants(thread_id,organization_id,participant_kind,display_alias)values(thread,f.operator_organization_id,'FRANCHISE','FRANCHISE'),(thread,p_counterparty_organization_id,kind,kind)on conflict do nothing;
 response:=jsonb_build_object('outcome','MESSAGE_THREAD_OPENED','thread_id',thread,'command_id',command);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,a,'USER','franchise.messaging.thread_opened','internal_message_thread',thread::text,p_correlation_id,jsonb_build_object('franchise_id',f.id,'rfq_id',r.id,'counterparty_organization_id',p_counterparty_organization_id,'command_id',command),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values(f.operator_organization_id,'internal_message_thread',thread::text,'FranchiseMessageThreadOpenedV1',p_correlation_id,response,p_idempotency_key,command);
 perform private.finish_internal_message_command(a,'messaging.thread.open',p_idempotency_key,response);return response;
end$$;
create or replace function public.send_internal_message(
  p_thread_id uuid,p_sender_organization_id uuid,p_body text,p_attachments jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_thread public.internal_message_threads%rowtype;v_participant uuid;v_request_status text;v_hash text;v_command uuid;v_replay jsonb;v_message uuid:=extensions.gen_random_uuid();v_response jsonb;v_attachment jsonb;
begin
  select * into v_thread from public.internal_message_threads where id=p_thread_id;
  if not found or v_thread.status <> 'OPEN' then raise exception 'MESSAGE_THREAD_NOT_OPEN' using errcode='55000'; end if;
  select p.id into v_participant from public.internal_message_participants p where p.thread_id=p_thread_id and p.organization_id=p_sender_organization_id;
  if v_participant is null or not private.is_internal_message_participant(p_thread_id,p_sender_organization_id,v_actor) then raise exception 'MESSAGE_THREAD_SCOPE_DENIED' using errcode='42501'; end if;
  if v_thread.franchise_id is not null and exists(select 1 from public.internal_message_participants p where p.id=v_participant and p.participant_kind='FRANCHISE')and not private.franchise_message_can_write(v_thread.franchise_id,v_actor)then raise exception 'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
  if length(btrim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'INVALID_MESSAGE_BODY' using errcode='22023'; end if;
  select status into v_request_status from public.service_requests where id=v_thread.service_request_id;
  if v_request_status not in ('PROVIDER_SELECTED','CONTRACT_PENDING','CONTRACTED') and private.contains_direct_contact(p_body) then raise exception 'DIRECT_CONTACT_BLOCKED' using errcode='22023'; end if;
  if p_attachments is null then p_attachments:='[]'::jsonb; end if;
  if jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>5 then raise exception 'INVALID_MESSAGE_ATTACHMENTS' using errcode='22023'; end if;
  for v_attachment in select value from jsonb_array_elements(p_attachments) loop
    if coalesce(v_attachment->>'bucket','')<>'private-message-attachments'
       or coalesce(v_attachment->>'path','') not like ('internal-messages/'||p_thread_id::text||'/%')
       or length(btrim(coalesce(v_attachment->>'name',''))) not between 1 and 255
       or coalesce(v_attachment->>'mime_type','') not in ('application/pdf','image/jpeg','image/png','text/plain')
       or coalesce(v_attachment->>'size_bytes','') !~ '^[0-9]+$' or (v_attachment->>'size_bytes')::bigint not between 1 and 10485760
       or coalesce(v_attachment->>'sha256','') !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_MESSAGE_ATTACHMENT' using errcode='22023';
    end if;
  end loop;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('operation','messaging.message.send.v1','thread_id',p_thread_id,'sender_organization_id',p_sender_organization_id,'body',btrim(p_body),'attachments',p_attachments)::text,'UTF8'),'sha256'),'hex');
  select b.command_id,b.response_body into v_command,v_replay from private.begin_internal_message_command(v_actor,'messaging.message.send',p_idempotency_key,v_hash)b;
  if v_replay is not null then return v_replay; end if;
  insert into public.internal_messages(id,thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key)
  values(v_message,p_thread_id,v_participant,p_sender_organization_id,v_actor,btrim(p_body),p_idempotency_key);
  insert into public.internal_message_attachments(message_id,storage_bucket,storage_object_path,original_file_name,mime_type,size_bytes,sha256)
  select v_message,value->>'bucket',value->>'path',btrim(value->>'name'),value->>'mime_type',(value->>'size_bytes')::bigint,value->>'sha256' from jsonb_array_elements(p_attachments);
  v_response:=jsonb_build_object('outcome','INTERNAL_MESSAGE_SENT','message_id',v_message,'thread_id',p_thread_id,'command_id',v_command);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(p_sender_organization_id,v_actor,'USER','messaging.message.sent','internal_message',v_message::text,p_correlation_id,jsonb_build_object('thread_id',p_thread_id,'attachment_count',jsonb_array_length(p_attachments),'command_id',v_command),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)
  values(p_sender_organization_id,'internal_message',v_message::text,'InternalMessageSentV1',p_correlation_id,jsonb_build_object('message_id',v_message,'thread_id',p_thread_id,'attachment_count',jsonb_array_length(p_attachments)),p_idempotency_key,v_command);
  perform private.finish_internal_message_command(v_actor,'messaging.message.send',p_idempotency_key,v_response);
  return v_response;
end
$$;

create or replace function public.list_internal_message_inbox(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
  if p_limit not between 1 and 200 then raise exception 'INVALID_PAGE_LIMIT' using errcode='22023'; end if;
  select coalesce(jsonb_agg(row_value order by row_value->>'last_message_at' desc),'[]'::jsonb) into v_result from (
    select jsonb_build_object('id',t.id,'object_type',t.object_type,'object_id',t.object_id,'service_request_id',t.service_request_id,'subject',t.subject,'status',t.status,'contact_policy_version',t.contact_policy_version,'participant_organization_id',p.organization_id,'participant_kind',p.participant_kind,'franchise_id',t.franchise_id,'counterparty_alias',(select other.display_alias from public.internal_message_participants other where other.thread_id=t.id and other.organization_id<>p.organization_id order by other.joined_at limit 1),'created_at',t.created_at,'last_message_at',coalesce(max(m.created_at),t.created_at),'message_count',count(m.id)) row_value
    from public.internal_message_threads t join public.internal_message_participants p on p.thread_id=t.id and private.is_internal_message_participant(p.thread_id,p.organization_id,v_actor)
    left join public.internal_messages m on m.thread_id=t.id
    group by t.id,p.organization_id,p.participant_kind order by coalesce(max(m.created_at),t.created_at) desc limit p_limit
  ) q;
  return v_result;
end
$$;

create or replace function public.get_internal_message_thread(p_thread_id uuid,p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_thread public.internal_message_threads%rowtype;v_organization uuid;v_kind text;v_messages jsonb;
begin
  if v_actor is null or not private.can_access_internal_message_thread(p_thread_id,v_actor) then raise exception 'MESSAGE_THREAD_SCOPE_DENIED' using errcode='42501'; end if;
  if p_limit not between 1 and 500 then raise exception 'INVALID_PAGE_LIMIT' using errcode='22023'; end if;
  select * into v_thread from public.internal_message_threads where id=p_thread_id;
  select p.organization_id,p.participant_kind into v_organization,v_kind from public.internal_message_participants p where p.thread_id=p_thread_id and private.is_internal_message_participant(p.thread_id,p.organization_id,v_actor) order by p.joined_at limit 1;
  select coalesce(jsonb_agg(x.row_value order by x.created_at,x.id),'[]'::jsonb) into v_messages from (
    select m.id,m.created_at,jsonb_build_object('id',m.id,'sender_alias',p.display_alias,'mine',m.sender_organization_id=v_organization,'body',m.body,'created_at',m.created_at,'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.original_file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'scan_status',a.scan_status,'download_ready',a.scan_status='CLEAN') order by a.created_at,a.id) from public.internal_message_attachments a where a.message_id=m.id),'[]'::jsonb)) row_value
    from public.internal_messages m join public.internal_message_participants p on p.id=m.sender_participant_id where m.thread_id=p_thread_id order by m.created_at desc,m.id desc limit p_limit
  ) x;
  return jsonb_build_object('thread',jsonb_build_object('id',v_thread.id,'object_type',v_thread.object_type,'object_id',v_thread.object_id,'service_request_id',v_thread.service_request_id,'subject',v_thread.subject,'status',v_thread.status,'contact_policy_version',v_thread.contact_policy_version,'participant_organization_id',v_organization,'participant_kind',v_kind,'franchise_id',v_thread.franchise_id,'counterparty_alias',(select other.display_alias from public.internal_message_participants other where other.thread_id=p_thread_id and other.organization_id<>v_organization order by other.joined_at limit 1),'created_at',v_thread.created_at),'messages',v_messages);
end
$$;

create or replace function public.open_rfq_message_thread(
  p_rfq_id uuid,p_provider_organization_id uuid,p_subject text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_rfq public.rfqs%rowtype;v_request public.service_requests%rowtype;v_hash text;v_command uuid;v_replay jsonb;v_thread uuid;v_response jsonb;
begin
  select * into v_rfq from public.rfqs where id=p_rfq_id;
  if not found then raise exception 'RFQ_NOT_FOUND' using errcode='22023'; end if;
  select * into v_request from public.service_requests where id=v_rfq.request_id;
  if v_rfq.status <> 'OPEN' or v_request.status not in ('RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW') then raise exception 'RFQ_MESSAGING_NOT_OPEN' using errcode='55000'; end if;
  if not exists(select 1 from public.rfq_providers rp where rp.rfq_id=p_rfq_id and rp.provider_organization_id=p_provider_organization_id and rp.status not in ('WITHDRAWN','SUSPENDED')) then
    raise exception 'RFQ_PROVIDER_NOT_INVITED' using errcode='42501';
  end if;
  if not (private.can_manage_client_request(v_request.client_organization_id,v_actor) or private.is_provider_actor(p_provider_organization_id,v_actor)) then
    raise exception 'MESSAGE_THREAD_SCOPE_DENIED' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_subject,''))) not between 3 and 160 or private.contains_direct_contact(p_subject) then raise exception 'INVALID_MESSAGE_SUBJECT' using errcode='22023'; end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('operation','messaging.thread.open.v1','rfq_id',p_rfq_id,'provider_organization_id',p_provider_organization_id,'subject',btrim(p_subject))::text,'UTF8'),'sha256'),'hex');
  select b.command_id,b.response_body into v_command,v_replay from private.begin_internal_message_command(v_actor,'messaging.thread.open',p_idempotency_key,v_hash)b;
  if v_replay is not null then return v_replay; end if;
  insert into public.internal_message_threads(object_type,object_id,service_request_id,client_organization_id,provider_organization_id,subject,created_by)
  values('RFQ',p_rfq_id,v_rfq.request_id,v_request.client_organization_id,p_provider_organization_id,btrim(p_subject),v_actor)
  on conflict(object_type,object_id,provider_organization_id)where object_type='RFQ'do nothing returning id into v_thread;
  if v_thread is null then select id into v_thread from public.internal_message_threads where object_type='RFQ' and object_id=p_rfq_id and provider_organization_id=p_provider_organization_id; end if;
  insert into public.internal_message_participants(thread_id,organization_id,participant_kind,display_alias)
  values(v_thread,v_request.client_organization_id,'CLIENT','CLIENT'),(v_thread,p_provider_organization_id,'PROVIDER','PROVIDER') on conflict do nothing;
  v_response:=jsonb_build_object('outcome','MESSAGE_THREAD_OPENED','thread_id',v_thread,'command_id',v_command);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(v_request.client_organization_id,v_actor,'USER','messaging.thread.opened','internal_message_thread',v_thread::text,p_correlation_id,jsonb_build_object('rfq_id',p_rfq_id,'command_id',v_command,'contact_policy_version','CONTACT-MASK-V1'),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)
  values(v_request.client_organization_id,'internal_message_thread',v_thread::text,'InternalMessageThreadOpenedV1',p_correlation_id,jsonb_build_object('thread_id',v_thread,'rfq_id',p_rfq_id,'service_request_id',v_rfq.request_id),p_idempotency_key,v_command);
  perform private.finish_internal_message_command(v_actor,'messaging.thread.open',p_idempotency_key,v_response);
  return v_response;
end
$$;


create function public.list_franchise_message_inbox(p_franchise_id uuid,p_limit integer default 100)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;begin
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_MESSAGE_SCOPE_DENIED'using errcode='42501';end if;
 if p_limit not between 1 and 200 then raise exception 'INVALID_PAGE_LIMIT'using errcode='22023';end if;
 select coalesce(jsonb_agg(x.value order by x.latest desc),'[]'::jsonb)into result from(
 select coalesce(max(m.created_at),t.created_at)latest,jsonb_build_object('id',t.id,'object_type',t.object_type,'object_id',t.object_id,'service_request_id',t.service_request_id,'franchise_id',t.franchise_id,'subject',t.subject,'status',t.status,'contact_policy_version',t.contact_policy_version,'participant_organization_id',p.organization_id,'participant_kind',p.participant_kind,'counterparty_alias',(select other.display_alias from public.internal_message_participants other where other.thread_id=t.id and other.organization_id<>p.organization_id limit 1),'created_at',t.created_at,'last_message_at',coalesce(max(m.created_at),t.created_at),'message_count',count(m.id))value
 from public.internal_message_threads t join public.internal_message_participants p on p.thread_id=t.id and p.participant_kind='FRANCHISE'and private.is_internal_message_participant(t.id,p.organization_id)
 left join public.internal_messages m on m.thread_id=t.id where t.franchise_id=p_franchise_id
 group by t.id,p.organization_id,p.participant_kind order by coalesce(max(m.created_at),t.created_at)desc limit p_limit)x;
 return result;
end$$;
revoke all on function private.franchise_message_can_write(uuid,uuid),private.active_franchise_messaging_scope(uuid,uuid),private.is_internal_message_participant(uuid,uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.franchise_message_counterparties(uuid),public.open_franchise_rfq_message_thread(uuid,uuid,uuid,text,text,uuid),public.list_franchise_message_inbox(uuid,integer)from public,anon,service_role;
grant execute on function public.franchise_message_counterparties(uuid),public.open_franchise_rfq_message_thread(uuid,uuid,uuid,text,text,uuid),public.list_franchise_message_inbox(uuid,integer)to authenticated;
