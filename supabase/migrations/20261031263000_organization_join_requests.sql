-- Explicit, non-enumerating join requests reuse the established membership model.
begin;
create table public.organization_join_requests(
 id uuid primary key default extensions.gen_random_uuid(),requester_user_id uuid not null references auth.users(id),
 access_request_id uuid unique references public.organization_access_requests(id),ice_hash text not null check(ice_hash~'^[0-9a-f]{64}$'),
 requested_role_code text not null check(requested_role_code in('CLIENT_VIEWER','PROVIDER_VIEWER')),
 message text not null check(length(btrim(message))between 10 and 1000),request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),created_at timestamptz not null default clock_timestamp()
);
create table private.organization_join_decision_permits(transaction_id bigint not null,access_request_id uuid not null,actor_user_id uuid not null,expected_version integer not null,primary key(transaction_id,access_request_id));
alter table public.organization_join_requests enable row level security;
alter table private.organization_join_decision_permits enable row level security;
revoke all on public.organization_join_requests,private.organization_join_decision_permits from public,anon,authenticated,service_role;
create index organization_join_requester_history on public.organization_join_requests(requester_user_id,created_at desc,id);
create trigger organization_join_content_immutable before update or delete on public.organization_join_requests for each row execute function private.prevent_update_delete();
create function private.organization_join_owner(p_org uuid,p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select p_actor is not null and auth.jwt()->>'aal'='aal2'and private.has_org_role(p_org,array['CLIENT_OWNER','PROVIDER_OWNER','FRANCHISE_OWNER'],p_actor)$$;
revoke all on function private.organization_join_owner(uuid,uuid)from public,anon,authenticated,service_role;
-- A legacy decision RPC cannot bypass the owner/CAS gate for these new requests.
create function private.guard_organization_join_decision()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if new.status is distinct from old.status and exists(select 1 from public.organization_join_requests where access_request_id=old.id)then
  if auth.uid()=old.requester_user_id or not private.organization_join_owner(old.organization_id)or not exists(select 1 from private.organization_join_decision_permits where transaction_id=txid_current()and access_request_id=old.id and actor_user_id=auth.uid()and expected_version=old.row_version)then raise exception'OWNER_JOIN_REVIEW_REQUIRED'using errcode='42501';end if;
  new.row_version:=old.row_version+1;
 end if;return new;
end$$;
revoke all on function private.guard_organization_join_decision()from public,anon,authenticated,service_role;
create trigger organization_join_decision_guard before update on public.organization_access_requests for each row execute function private.guard_organization_join_decision();
insert into public.notification_preference_categories(code,label_fr,label_ar,mandatory,status)values('ORGANIZATION_ACCESS','Accès à l’entreprise','الوصول إلى المؤسسة',false,'ACTIVE');
insert into public.notification_template_versions(template_code,version,event_type,category_code,locale,subject_template,body_template,cta_path_template,priority,mandatory,channels,variable_keys,status,effective_from,content_hash)
select 'ORGANIZATION_JOIN_OWNER',1,'OrganizationJoinRequestedV1','ORGANIZATION_ACCESS',locale,subject,body,path,'IMPORTANT',false,array['IN_APP'],array[]::text[],'ACTIVE',clock_timestamp(),private.canonical_request_hash(jsonb_build_object('locale',locale,'subject',subject,'body',body,'path',path))from(values
 ('fr-MA','Demande de rattachement à votre entreprise','Une personne demande un accès en lecture à votre entreprise. Consultez son message puis acceptez ou refusez explicitement.','/fr/organisation/rattachements'),
 ('ar-MA','طلب الانضمام إلى مؤسستكم','يطلب شخص صلاحية القراءة في مؤسستكم. راجعوا رسالته ثم وافقوا أو ارفضوا بشكل صريح.','/ar/organisation/rattachements'))v(locale,subject,body,path);
create function private.notify_organization_join_owners(p_receipt uuid,p_org uuid,p_correlation uuid)returns integer language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare owner_id uuid;template public.notification_template_versions%rowtype;notification uuid;total integer:=0;delivery_mode text;
begin
 for owner_id in select distinct m.user_id from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null where m.organization_id=p_org and m.status='ACTIVE'and r.role_code in('CLIENT_OWNER','PROVIDER_OWNER','FRANCHISE_OWNER')loop
  select*into template from public.notification_template_versions where template_code='ORGANIZATION_JOIN_OWNER'and locale=coalesce((select preferred_locale from public.user_profiles where id=owner_id),'fr-MA') and status='ACTIVE';
  insert into public.notification_instances(recipient_user_id,organization_id,template_version_id,category_code,event_type,locale,subject,body,cta_path,priority,mandatory,deduplication_key,source_aggregate_type,source_aggregate_id,variables_snapshot,correlation_id)
  values(owner_id,p_org,template.id,template.category_code,template.event_type,template.locale,template.subject_template,template.body_template,template.cta_path_template||'?organizationId='||p_org::text,template.priority,false,'organization-join:'||p_receipt::text,'organization_join_request',p_receipt::text,'{}',p_correlation)on conflict(recipient_user_id,organization_id,deduplication_key)do nothing returning id into notification;
  if notification is not null then select p.delivery_mode into delivery_mode from public.user_notification_preferences p where p.user_id=owner_id and p.organization_id=p_org and p.category_code='ORGANIZATION_ACCESS'and p.channel='IN_APP';delivery_mode:=coalesce(delivery_mode,'IMMEDIATE');insert into public.notification_deliveries(notification_id,channel,delivery_mode,status,next_attempt_at)values(notification,'IN_APP',delivery_mode,case delivery_mode when'DISABLED'then'SKIPPED'when'DIGEST'then'QUEUED_DIGEST'else'DELIVERED'end,case when delivery_mode='DIGEST'then date_trunc('day',clock_timestamp())+interval'1 day 8 hours'else null end);total:=total+1;end if;
 end loop;return total;
end$$;
revoke all on function private.notify_organization_join_owners(uuid,uuid,uuid)from public,anon,authenticated,service_role;
create function public.request_organization_join_v1(p_ice text,p_requested_role_code text,p_message text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();ice text;org uuid;access_id uuid;receipt uuid;hash text;cached private.identity_idempotency_keys%rowtype;result jsonb;notified integer;
begin
 if actor is null or auth.jwt()->>'aal'is distinct from'aal2'or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null)then raise exception'JOIN_REQUEST_DENIED'using errcode='42501';end if;
 ice:=private.normalize_ice(p_ice);
 if coalesce(ice,'')!~'^[0-9]{15}$'or coalesce(p_requested_role_code,'')not in('CLIENT_VIEWER','PROVIDER_VIEWER')or length(btrim(coalesce(p_message,'')))not between 10 and 1000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 or p_correlation_id is null then raise exception'INVALID_JOIN_REQUEST'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('organization-join:'||actor::text,0));
 hash:=private.canonical_request_hash(jsonb_build_object('ice',ice,'role',p_requested_role_code,'message',btrim(p_message)));
 select*into cached from private.identity_idempotency_keys where actor_user_id=actor and operation_scope='organization.join'and key=p_idempotency_key;
 if found then if cached.request_hash is distinct from hash then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return cached.response_body;end if;
 if(select count(*)from public.organization_join_requests where requester_user_id=actor and created_at>clock_timestamp()-interval'1 day')>=10 then raise exception'JOIN_REQUEST_RATE_LIMIT'using errcode='54000';end if;
 select i.organization_id into org from public.organization_identifiers i join public.organizations o on o.id=i.organization_id and o.status in('PENDING','ACTIVE')where i.identifier_type='ICE'and i.normalized_value=ice and i.is_active
 and exists(select 1 from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null where m.organization_id=o.id and m.status='ACTIVE'and r.role_code=split_part(p_requested_role_code,'_',1)||'_OWNER')
 and not exists(select 1 from public.organization_memberships where organization_id=o.id and user_id=actor and status='ACTIVE');
 if org is not null then
  insert into public.organization_access_requests(organization_id,requester_user_id,requested_role_code)values(org,actor,p_requested_role_code)on conflict(organization_id,requester_user_id,requested_role_code)where status='PENDING'do nothing returning id into access_id;
  if access_id is null then select id into access_id from public.organization_access_requests where organization_id=org and requester_user_id=actor and requested_role_code=p_requested_role_code and status='PENDING';end if;
  select id into receipt from public.organization_join_requests where access_request_id=access_id;
 end if;
 if receipt is null then
  insert into public.organization_join_requests(requester_user_id,access_request_id,ice_hash,requested_role_code,message,request_hash)values(actor,access_id,encode(extensions.digest(ice,'sha256'),'hex'),p_requested_role_code,btrim(p_message),hash)returning id into receipt;
  if org is not null then notified:=private.notify_organization_join_owners(receipt,org,p_correlation_id);end if;
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,actor,'USER','organization.join.requested','organization_join_request',receipt::text,p_correlation_id,jsonb_build_object('requested_role',p_requested_role_code),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'organization_join_request',receipt::text,'OrganizationJoinRequestedV1',p_correlation_id,jsonb_build_object('receipt_id',receipt,'notification_count',coalesce(notified,0)),p_idempotency_key);
 end if;
 result:=jsonb_build_object('outcome','JOIN_REQUEST_RECORDED','receipt_id',receipt);
 insert into private.identity_idempotency_keys(actor_user_id,operation_scope,key,request_hash,response_body,expires_at)values(actor,'organization.join',p_idempotency_key,hash,result,clock_timestamp()+interval'7 days');return result;
end$$;
create function public.get_organization_join_workspace_v1(p_organization_id uuid default null,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if actor is null or auth.jwt()->>'aal'is distinct from'aal2'then raise exception'JOIN_WORKSPACE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_PAGE'using errcode='22023';end if;
 return jsonb_build_object('page',p_page,'page_size',25,
 'my_total',(select count(*)from public.organization_join_requests where requester_user_id=actor),
 'my_requests',coalesce((select jsonb_agg(to_jsonb(x))from(select j.id,j.requested_role_code role_code,coalesce(a.status,'PENDING')status,j.created_at from public.organization_join_requests j left join public.organization_access_requests a on a.id=j.access_request_id where j.requester_user_id=actor order by j.created_at desc,j.id desc limit 25 offset(p_page-1)*25)x),'[]'),
 'review_total',(select count(*)from public.organization_join_requests j join public.organization_access_requests a on a.id=j.access_request_id where a.status='PENDING'and(p_organization_id is null or a.organization_id=p_organization_id)and private.organization_join_owner(a.organization_id,actor)),
 'review_requests',coalesce((select jsonb_agg(to_jsonb(x))from(select j.id,a.organization_id,o.display_name organization_name,u.email::text requester_email,j.message,j.requested_role_code role_code,a.row_version,j.request_hash,j.created_at from public.organization_join_requests j join public.organization_access_requests a on a.id=j.access_request_id join public.organizations o on o.id=a.organization_id join auth.users u on u.id=j.requester_user_id where a.status='PENDING'and(p_organization_id is null or a.organization_id=p_organization_id)and private.organization_join_owner(a.organization_id,actor)order by j.created_at,j.id limit 25 offset(p_page-1)*25)x),'[]'));
end$$;
create function public.decide_organization_join_v1(p_receipt_id uuid,p_accept boolean,p_expected_row_version integer,p_expected_request_hash text,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();j public.organization_join_requests%rowtype;a public.organization_access_requests%rowtype;hash text;cached jsonb;result jsonb;
begin
 select*into j from public.organization_join_requests where id=p_receipt_id;
 select*into a from public.organization_access_requests where id=j.access_request_id;
 if j.id is null or a.id is null or actor=j.requester_user_id or not private.organization_join_owner(a.organization_id,actor)then raise exception'JOIN_DECISION_DENIED'using errcode='42501';end if;
 if p_accept is null or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 or p_correlation_id is null then raise exception'INVALID_JOIN_DECISION'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('organization-join-decision:'||a.id::text,0));
 hash:=private.canonical_request_hash(jsonb_build_object('receipt',j.id,'accept',p_accept,'version',p_expected_row_version,'hash',p_expected_request_hash,'reason',p_reason));cached:=private.begin_contract_command(a.organization_id,'organization.join.decide.'||j.id::text,p_idempotency_key,hash,actor);if cached is not null then return cached;end if;
 select*into a from public.organization_access_requests where id=j.access_request_id for update;
 if a.row_version is distinct from p_expected_row_version or j.request_hash is distinct from p_expected_request_hash then raise exception'STALE_JOIN_REQUEST'using errcode='40001';end if;
 if a.status<>'PENDING'then raise exception'JOIN_REQUEST_NOT_PENDING'using errcode='55000';end if;
 insert into private.organization_join_decision_permits values(txid_current(),a.id,actor,a.row_version);
 perform public.decide_organization_access_request(a.id,p_accept,p_correlation_id);
 delete from private.organization_join_decision_permits where transaction_id=txid_current()and access_request_id=a.id;
 result:=jsonb_build_object('outcome',case when p_accept then'JOIN_REQUEST_APPROVED'else'JOIN_REQUEST_REJECTED'end,'receipt_id',j.id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(a.organization_id,actor,'USER','organization.join.decided','organization_join_request',j.id::text,p_correlation_id,jsonb_build_object('accepted',p_accept,'reason',p_reason,'request_hash',j.request_hash),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(a.organization_id,'organization_join_request',j.id::text,'OrganizationJoinDecidedV1',p_correlation_id,result,p_idempotency_key);
 perform private.finish_contract_command(a.organization_id,'organization.join.decide.'||j.id::text,p_idempotency_key,result);return result;
end$$;
revoke all on function public.request_organization_join_v1(text,text,text,text,uuid),public.get_organization_join_workspace_v1(uuid,integer),public.decide_organization_join_v1(uuid,boolean,integer,text,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.request_organization_join_v1(text,text,text,text,uuid),public.get_organization_join_workspace_v1(uuid,integer),public.decide_organization_join_v1(uuid,boolean,integer,text,text,text,uuid)to authenticated;

-- Collision is a request to join, never an implicit request for ownership.
do $$declare definition text;start_at integer;end_at integer;begin
 select pg_get_functiondef('public.create_or_request_organization(text,text,text,text,text,uuid)'::regprocedure)into definition;
 start_at:=strpos(definition,'  else'||chr(10)||'    if exists(select 1 from public.organization_memberships where organization_id=v_org');
 end_at:=strpos(definition,'  end if;'||chr(10)||'  insert into private.identity_idempotency_keys');
 if start_at=0 or end_at<=start_at then raise exception'ORGANIZATION_JOIN_COLLISION_PATCH_TARGET_MISSING';end if;
 definition:=left(definition,start_at-1)||'  else
    if p_owner_role=''FRANCHISE_OWNER''then raise exception''FRANCHISE_JOIN_REQUIRES_APPROVED_MANDATE''using errcode=''55000'';end if;
    v_response:=public.request_organization_join_v1(v_ice,case when p_owner_role=''PROVIDER_OWNER''then''PROVIDER_VIEWER''else''CLIENT_VIEWER''end,''Demande de rattachement depuis le passeport de l’entreprise.'',p_idempotency_key,p_correlation_id);
    v_response:=jsonb_build_object(''outcome'',''ACCESS_REQUESTED'',''request_id'',v_response->>''receipt_id'');
'||substr(definition,end_at);
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
