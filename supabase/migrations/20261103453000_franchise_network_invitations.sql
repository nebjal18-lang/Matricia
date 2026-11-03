-- Network acquisition is separate from membership invitations and franchise mandates.
-- No role, commission, balance or contractual approval is created by these commands.
create table public.franchise_network_invitations (
 id uuid primary key,
 franchise_id uuid not null references public.franchises(id) on delete restrict,
 prospect_id uuid not null references public.franchise_crm_prospects(id) on delete restrict,
 library_id uuid not null references public.catalog_libraries(id) on delete restrict,
 territory_version_id uuid not null references public.franchise_territory_versions(id) on delete restrict,
 prospect_type text not null check (prospect_type in ('CLIENT','PROVIDER')),
 contact_email extensions.citext not null,
 contact_phone text not null default '' check (length(contact_phone)<=40),
 locale text not null check (locale in ('fr','ar')),
 status text not null default 'QUEUED' check(status in ('QUEUED','SENT','OPENED','REGISTERED','EXPIRED','REVOKED')),
 expires_at timestamptz not null default clock_timestamp()+interval '30 days',
 queued_by uuid not null references auth.users(id),
 contact_permission_confirmed_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp(),
 sent_at timestamptz, opened_at timestamptz, registered_at timestamptz,
 delivery_mode text check (delivery_mode in ('EXTERNAL','NON_CONTRACTUAL_DEMO')),
 provider_message_id text,
 check (expires_at>created_at),
 check (status not in ('SENT','OPENED','REGISTERED') or sent_at is not null)
);
create index franchise_network_invitations_scope_idx on public.franchise_network_invitations(franchise_id,created_at desc,id);
create unique index franchise_network_invitation_active_idx on public.franchise_network_invitations(franchise_id,contact_email,prospect_type) where status in ('QUEUED','SENT','OPENED');
create table private.franchise_network_invitation_tokens (
 invitation_id uuid primary key references public.franchise_network_invitations(id) on delete restrict,
 token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$')
);
revoke all on private.franchise_network_invitation_tokens from public,anon,authenticated,service_role;

create table public.franchise_network_referrals (
 invitation_id uuid primary key references public.franchise_network_invitations(id) on delete restrict,
 source_franchise_id uuid not null references public.franchises(id) on delete restrict,
 prospect_id uuid not null references public.franchise_crm_prospects(id) on delete restrict,
 target_organization_id uuid not null references public.organizations(id) on delete restrict,
 prospect_type text not null check(prospect_type in ('CLIENT','PROVIDER')),
 accepted_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(target_organization_id,prospect_type)
);
create function private.protect_franchise_network_origin_v1() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if old.linked_organization_id is distinct from new.linked_organization_id and exists(select 1 from public.franchise_network_referrals r where r.prospect_id=old.id and r.target_organization_id is distinct from new.linked_organization_id) then raise exception 'FRANCHISE_NETWORK_ORIGIN_ALREADY_RECORDED' using errcode='23505';end if;
 return new;
end $$;
revoke all on function private.protect_franchise_network_origin_v1() from public,anon,authenticated,service_role;
create trigger franchise_network_prospect_origin_guard before update of linked_organization_id on public.franchise_crm_prospects for each row execute function private.protect_franchise_network_origin_v1();
create trigger franchise_network_referrals_immutable before update or delete on public.franchise_network_referrals for each row execute function private.prevent_franchise_history_change();
alter table public.franchise_network_invitations enable row level security;
alter table public.franchise_network_referrals enable row level security;
revoke all on public.franchise_network_invitations,public.franchise_network_referrals from public,anon,authenticated,service_role;
grant select on public.franchise_network_invitations,public.franchise_network_referrals to authenticated;
create policy franchise_network_invitations_read on public.franchise_network_invitations for select to authenticated using(private.franchise_access(franchise_id));
create policy franchise_network_referrals_read on public.franchise_network_referrals for select to authenticated using(private.franchise_access(source_franchise_id) or private.is_active_org_member(target_organization_id));

-- A read-only invoker projection computes expiry against the database clock.
create view public.franchise_network_invitation_status_v1 with (security_invoker=true) as
 select id,franchise_id,contact_email,locale,
 case when expires_at<=statement_timestamp() and status in ('QUEUED','SENT','OPENED') then 'EXPIRED' else status end as status,
 delivery_mode,created_at,sent_at,opened_at,registered_at,expires_at from public.franchise_network_invitations;
revoke all on public.franchise_network_invitation_status_v1 from public,anon,authenticated,service_role;
grant select on public.franchise_network_invitation_status_v1 to authenticated;

create function private.franchise_network_active_scope_v1(p_franchise_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.franchises f join public.franchise_mandate_versions m on m.id=f.current_mandate_version_id and m.franchise_id=f.id
 join public.organizations o on o.id=f.operator_organization_id
 where f.id=p_franchise_id and f.status='ACTIVE' and o.status='ACTIVE' and m.mandate_status='ACTIVE'
 and m.effective_from<=statement_timestamp() and (m.effective_until is null or m.effective_until>statement_timestamp()))
$$;
revoke all on function private.franchise_network_active_scope_v1(uuid) from public,anon,authenticated,service_role;

create function public.queue_franchise_network_invitations_v1(p_franchise_id uuid,p_territory_version_id uuid,p_prospect_type text,p_owner_user_id uuid,p_rows jsonb,p_contact_permission_confirmed boolean,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare actor uuid:=auth.uid(); org uuid; lib uuid; invitation_row jsonb; email text; pid uuid; iid uuid; h text; result jsonb; created integer:=0; skipped integer:=0; ids jsonb:='[]'; seen text[]:='{}';
begin
 if actor is null or not private.franchise_crm_write_access(p_franchise_id,actor) then raise exception 'FRANCHISE_NETWORK_INVITATION_DENIED' using errcode='42501';end if;
 if auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'FRANCHISE_NETWORK_MFA_REQUIRED' using errcode='42501';end if;
 -- Serializes batches and rate limits for this exact mandate, including replays.
 perform pg_advisory_xact_lock(hashtextextended('franchise-network:'||p_franchise_id::text,0));
 select operator_organization_id,library_id into org,lib from public.franchises where id=p_franchise_id;
 perform 1 from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id where m.organization_id=org and m.user_id=actor for share of m,r;
 perform 1 from public.organization_member_franchise_assignments a join public.organization_memberships m on m.id=a.membership_id where a.franchise_id=p_franchise_id and m.user_id=actor for share of a;
 perform 1 from public.platform_user_roles p where p.user_id=actor for share of p;
 if not private.franchise_crm_write_access(p_franchise_id,actor) then raise exception 'FRANCHISE_NETWORK_INVITATION_DENIED' using errcode='42501';end if;
 perform 1 from public.franchises f join public.franchise_mandate_versions m on m.id=f.current_mandate_version_id where f.id=p_franchise_id for share of f,m;
 if not private.franchise_network_active_scope_v1(p_franchise_id) then raise exception 'FRANCHISE_NETWORK_MANDATE_INACTIVE' using errcode='42501';end if;
 select operator_organization_id,library_id into org,lib from public.franchises where id=p_franchise_id;
 if p_contact_permission_confirmed is distinct from true or p_prospect_type is null or p_prospect_type not in ('CLIENT','PROVIDER')
 or p_owner_user_id is null or (p_owner_user_id<>actor and not private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],p_owner_user_id))
 or not exists(select 1 from public.franchise_territory_versions t join public.franchises f on f.id=t.franchise_id join public.franchise_mandate_versions m on m.id=f.current_mandate_version_id and m.territory_version_id=t.id where t.id=p_territory_version_id and t.franchise_id=p_franchise_id and t.effective_from<=statement_timestamp() and (t.effective_until is null or t.effective_until>statement_timestamp()))
 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 50 or length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'FRANCHISE_NETWORK_INVITATION_INVALID' using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('franchise',p_franchise_id,'territory',p_territory_version_id,'type',p_prospect_type,'owner',p_owner_user_id,'rows',p_rows,'permission',p_contact_permission_confirmed));
 result:=private.begin_contract_command(org,'franchise.network.invitation.queue',p_idempotency_key,h,actor);if result is not null then return result;end if;
 if (select count(*) from public.franchise_network_invitations where franchise_id=p_franchise_id and created_at>clock_timestamp()-interval '1 day')+jsonb_array_length(p_rows)>100 then raise exception 'FRANCHISE_NETWORK_RATE_LIMITED' using errcode='54000';end if;
 for invitation_row in select value from jsonb_array_elements(p_rows) loop
  email:=lower(btrim(invitation_row->>'contact_email'));
  if email is null or length(email)>320 or email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(btrim(coalesce(invitation_row->>'display_name',''))) not between 2 and 200
  or length(coalesce(invitation_row->>'organization_name',''))>200 or length(coalesce(invitation_row->>'phone',''))>40 or invitation_row->>'locale' is null or invitation_row->>'locale' not in ('fr','ar')
  or coalesce(invitation_row->>'token_hash','')!~'^[0-9a-f]{64}$' or coalesce(invitation_row->>'source_code','')!~'^[A-Z][A-Z0-9_]{2,63}$'
  or coalesce(invitation_row->>'invitation_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then raise exception 'FRANCHISE_NETWORK_INVITATION_INVALID' using errcode='22023';end if;
  if email=any(seen) then skipped:=skipped+1;continue;end if;seen:=array_append(seen,email);
  update public.franchise_network_invitations set status='EXPIRED' where franchise_id=p_franchise_id and contact_email=email and prospect_type=p_prospect_type and expires_at<=clock_timestamp() and status in ('QUEUED','SENT','OPENED');
  if exists(select 1 from public.franchise_network_invitations where franchise_id=p_franchise_id and contact_email=email and prospect_type=p_prospect_type and status in ('QUEUED','SENT','OPENED','REGISTERED')) then skipped:=skipped+1;continue;end if;
  select id into pid from public.franchise_crm_prospects where franchise_id=p_franchise_id and contact_email=email and prospect_type=p_prospect_type;
  if pid is null then
   insert into public.franchise_crm_prospects(franchise_id,territory_version_id,prospect_type,display_name,contact_email,organization_name,source_code,next_followup_at,owner_user_id,created_by)
   values(p_franchise_id,p_territory_version_id,p_prospect_type,btrim(invitation_row->>'display_name'),email,nullif(invitation_row->>'organization_name',''),invitation_row->>'source_code',nullif(invitation_row->>'next_followup_at','')::timestamptz,p_owner_user_id,actor) returning id into pid;
  end if;
  iid:=(invitation_row->>'invitation_id')::uuid;
  insert into public.franchise_network_invitations(id,franchise_id,prospect_id,library_id,territory_version_id,prospect_type,contact_email,contact_phone,locale,queued_by)
  values(iid,p_franchise_id,pid,lib,p_territory_version_id,p_prospect_type,email,coalesce(invitation_row->>'phone',''),invitation_row->>'locale',actor);
  insert into private.franchise_network_invitation_tokens(invitation_id,token_hash) values(iid,invitation_row->>'token_hash');
  insert into public.franchise_crm_activities(franchise_id,prospect_id,activity_type,occurred_at,summary,evidence_refs,actor_user_id,correlation_id)
  values(p_franchise_id,pid,'INVITATION',clock_timestamp(),case when invitation_row->>'locale'='ar' then 'طُلب إرسال دعوة؛ الإرسال لم يُؤكَّد بعد.' else 'Envoi d’invitation demandé ; envoi non encore confirmé.' end,jsonb_build_array(jsonb_build_object('invitation_id',iid,'status','QUEUED')),actor,p_correlation_id);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(org,actor,'USER','franchise.network.invitation_queued','franchise_network_invitation',iid::text,p_correlation_id,jsonb_build_object('franchise_id',p_franchise_id,'prospect_id',pid,'locale',invitation_row->>'locale','contact_permission_confirmed',true),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
  values(org,'franchise_network_invitation',iid::text,'FranchiseNetworkInvitationRequestedV1',p_correlation_id,jsonb_build_object('invitation_id',iid),'franchise-network-invitation:'||iid::text);
  created:=created+1;ids:=ids||jsonb_build_array(iid);pid:=null;
 end loop;
 result:=jsonb_build_object('outcome','FRANCHISE_NETWORK_INVITATIONS_QUEUED','created',created,'skipped',skipped,'invitation_ids',ids,'delivery','OUTBOX_PENDING');
 perform private.finish_contract_command(org,'franchise.network.invitation.queue',p_idempotency_key,result);return result;
end $$;

create function public.load_franchise_network_invitation_delivery_v1(p_outbox_id bigint,p_invitation_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare i public.franchise_network_invitations%rowtype; f public.franchises%rowtype; name text;
begin
 if not exists(select 1 from public.event_outbox where id=p_outbox_id and aggregate_type='franchise_network_invitation' and aggregate_id=p_invitation_id::text and event_type='FranchiseNetworkInvitationRequestedV1' and payload->>'invitation_id'=p_invitation_id::text) then raise exception 'FRANCHISE_NETWORK_EVENT_MISMATCH' using errcode='42501';end if;
 select * into i from public.franchise_network_invitations where id=p_invitation_id for update;
 if i.id is null then raise exception 'FRANCHISE_NETWORK_INVITATION_NOT_FOUND' using errcode='P0002';end if;
 if i.status in ('REGISTERED','OPENED','SENT') then return jsonb_build_object('outcome','ALREADY_SENT','invitation_id',i.id);end if;
 if i.expires_at<=clock_timestamp() then update public.franchise_network_invitations set status='EXPIRED' where id=i.id;return jsonb_build_object('outcome','CANCELLED','invitation_id',i.id);end if;
 if i.status in ('EXPIRED','REVOKED') or not private.franchise_network_active_scope_v1(i.franchise_id) then update public.franchise_network_invitations set status='REVOKED' where id=i.id and status='QUEUED';return jsonb_build_object('outcome','CANCELLED','invitation_id',i.id);end if;
 select * into f from public.franchises where id=i.franchise_id; select display_name into name from public.organizations where id=f.operator_organization_id;
 return jsonb_build_object('outcome','READY','invitation_id',i.id,'locale',i.locale,'contact_email',i.contact_email,'operator_name',name,'prospect_type',i.prospect_type,'expires_at',i.expires_at,'token_hash',(select token_hash from private.franchise_network_invitation_tokens where invitation_id=i.id));
end $$;

create function public.complete_franchise_network_invitation_delivery_v1(p_outbox_id bigint,p_invitation_id uuid,p_provider_message_id text,p_delivery_mode text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare i public.franchise_network_invitations%rowtype; org uuid; env text;
begin
 if p_delivery_mode is null or p_delivery_mode not in ('EXTERNAL','NON_CONTRACTUAL_DEMO') or length(btrim(coalesce(p_provider_message_id,''))) not between 3 and 200 then raise exception 'FRANCHISE_NETWORK_DELIVERY_INVALID' using errcode='22023';end if;
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if p_delivery_mode='NON_CONTRACTUAL_DEMO' and env is distinct from 'DEVELOPMENT' and env is distinct from 'STAGING' then raise exception 'FRANCHISE_NETWORK_DEMO_FORBIDDEN' using errcode='42501';end if;
 perform public.load_franchise_network_invitation_delivery_v1(p_outbox_id,p_invitation_id);
 select * into i from public.franchise_network_invitations where id=p_invitation_id for update;
 if i.status in ('SENT','OPENED','REGISTERED') then
  if i.provider_message_id is distinct from p_provider_message_id or i.delivery_mode is distinct from p_delivery_mode then raise exception 'FRANCHISE_NETWORK_DELIVERY_MISMATCH' using errcode='22000';end if;
  return jsonb_build_object('outcome','FRANCHISE_NETWORK_INVITATION_SENT','invitation_id',i.id);
 end if;
 if i.status<>'QUEUED' then return jsonb_build_object('outcome','CANCELLED','invitation_id',i.id);end if;
 select operator_organization_id into org from public.franchises where id=i.franchise_id;
 update public.franchise_network_invitations set status='SENT',sent_at=clock_timestamp(),provider_message_id=p_provider_message_id,delivery_mode=p_delivery_mode where id=i.id;
 insert into public.franchise_crm_activities(franchise_id,prospect_id,activity_type,occurred_at,summary,evidence_refs,actor_user_id,correlation_id)
 values(i.franchise_id,i.prospect_id,'EMAIL',clock_timestamp(),case when p_delivery_mode='NON_CONTRACTUAL_DEMO' then 'Simulation de remise d’invitation — aucun email réel envoyé.' else 'Invitation acceptée par le fournisseur d’email ; réception non certifiée.' end,jsonb_build_array(jsonb_build_object('invitation_id',i.id,'delivery_mode',p_delivery_mode)),i.queued_by,(select correlation_id from public.event_outbox where id=p_outbox_id));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(org,null,'SYSTEM','franchise.network.invitation_sent','franchise_network_invitation',i.id::text,(select correlation_id from public.event_outbox where id=p_outbox_id),jsonb_build_object('delivery_mode',p_delivery_mode,'provider_message_hash',encode(extensions.digest(p_provider_message_id,'sha256'),'hex')),repeat('0',64));
 return jsonb_build_object('outcome','FRANCHISE_NETWORK_INVITATION_SENT','invitation_id',i.id);
end $$;

create function private.franchise_network_recipient_v1(p_invitation_id uuid,p_token_hash text) returns public.franchise_network_invitations language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare i public.franchise_network_invitations%rowtype; email text;
begin
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 select * into i from public.franchise_network_invitations x where x.id=p_invitation_id and lower(x.contact_email::text)=email and exists(select 1 from private.franchise_network_invitation_tokens t where t.invitation_id=x.id and t.token_hash=p_token_hash);
 if i.id is null or auth.uid() is null then raise exception 'FRANCHISE_NETWORK_RECIPIENT_DENIED' using errcode='42501';end if;
 if i.expires_at<=clock_timestamp() or i.status not in ('SENT','OPENED','REGISTERED') or not private.franchise_network_active_scope_v1(i.franchise_id) then raise exception 'FRANCHISE_NETWORK_INVITATION_INACTIVE' using errcode='55000';end if;
 return i;
end $$;
revoke all on function private.franchise_network_recipient_v1(uuid,text) from public,anon,authenticated,service_role;

create function public.open_franchise_network_invitation_v1(p_invitation_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare i public.franchise_network_invitations%rowtype; org uuid; options jsonb;
begin
 perform 1 from public.franchise_network_invitations where id=p_invitation_id for update;
 i:=private.franchise_network_recipient_v1(p_invitation_id,p_token_hash);
 if i.opened_at is null then
  update public.franchise_network_invitations set opened_at=clock_timestamp(),status=case when status='SENT' then 'OPENED' else status end where id=i.id;
  update public.franchise_crm_prospects set pipeline_stage='OPENED',row_version=row_version+1,updated_at=clock_timestamp() where id=i.prospect_id and pipeline_stage='SENT';
  select operator_organization_id into org from public.franchises where id=i.franchise_id;
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash) values(org,auth.uid(),'USER','franchise.network.invitation_opened','franchise_network_invitation',i.id::text,extensions.gen_random_uuid(),'{}',repeat('0',64));
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.display_name) order by o.display_name,o.id),'[]') into options from public.organizations o where o.status='ACTIVE' and o.id<>(select operator_organization_id from public.franchises where id=i.franchise_id) and private.has_org_role(o.id,case when i.prospect_type='CLIENT' then array['CLIENT_OWNER','CLIENT_ADMIN'] else array['PROVIDER_OWNER','PROVIDER_MANAGER'] end,auth.uid());
 return jsonb_build_object('invitation_id',i.id,'prospect_type',i.prospect_type,'status',case when i.status='SENT' then 'OPENED' else i.status end,'organizations',options,'expires_at',i.expires_at,'delivery_mode',i.delivery_mode);
end $$;

create function public.accept_franchise_network_invitation_v1(p_invitation_id uuid,p_token_hash text,p_target_organization_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare i public.franchise_network_invitations%rowtype; org uuid; result jsonb; h text; previous public.franchise_network_referrals%rowtype;
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'FRANCHISE_NETWORK_MFA_REQUIRED' using errcode='42501';end if;
 perform 1 from public.franchise_network_invitations where id=p_invitation_id for update;
 i:=private.franchise_network_recipient_v1(p_invitation_id,p_token_hash);
 select operator_organization_id into org from public.franchises where id=i.franchise_id;
 if p_target_organization_id is null or p_target_organization_id=org or not private.has_org_role(p_target_organization_id,case when i.prospect_type='CLIENT' then array['CLIENT_OWNER','CLIENT_ADMIN'] else array['PROVIDER_OWNER','PROVIDER_MANAGER'] end,auth.uid()) or not exists(select 1 from public.organizations where id=p_target_organization_id and status='ACTIVE') then raise exception 'FRANCHISE_NETWORK_TARGET_DENIED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('franchise-network-origin:'||p_target_organization_id::text||':'||i.prospect_type,0));
 h:=private.canonical_request_hash(jsonb_build_object('invitation',i.id,'token_hash',p_token_hash,'target',p_target_organization_id));
 result:=private.begin_contract_command(p_target_organization_id,'franchise.network.invitation.accept',p_idempotency_key,h,auth.uid());if result is not null then return result;end if;
 select * into previous from public.franchise_network_referrals where target_organization_id=p_target_organization_id and prospect_type=i.prospect_type;
 if previous.invitation_id is not null and previous.invitation_id<>i.id then raise exception 'FRANCHISE_NETWORK_ORIGIN_ALREADY_RECORDED' using errcode='23505';end if;
 if exists(select 1 from public.franchise_network_referrals where invitation_id=i.id and target_organization_id<>p_target_organization_id) then raise exception 'FRANCHISE_NETWORK_ORIGIN_ALREADY_RECORDED' using errcode='23505';end if;
 if previous.invitation_id=i.id then
  result:=jsonb_build_object('outcome','FRANCHISE_NETWORK_REFERRAL_REGISTERED','invitation_id',i.id,'organization_id',p_target_organization_id,'prospect_type',i.prospect_type);
  perform private.finish_contract_command(p_target_organization_id,'franchise.network.invitation.accept',p_idempotency_key,result);return result;
 end if;
 insert into public.franchise_network_referrals(invitation_id,source_franchise_id,prospect_id,target_organization_id,prospect_type,accepted_by) values(i.id,i.franchise_id,i.prospect_id,p_target_organization_id,i.prospect_type,auth.uid()) on conflict(invitation_id) do nothing;
 update public.franchise_network_invitations set status='REGISTERED',opened_at=coalesce(opened_at,clock_timestamp()),registered_at=coalesce(registered_at,clock_timestamp()) where id=i.id;
 update public.franchise_crm_prospects set pipeline_stage=case when pipeline_stage in ('SENT','OPENED') then 'REGISTERED' else pipeline_stage end,linked_organization_id=p_target_organization_id,row_version=row_version+1,updated_at=clock_timestamp() where id=i.prospect_id and (linked_organization_id is null or linked_organization_id=p_target_organization_id);
 if not found then raise exception 'FRANCHISE_NETWORK_ORIGIN_ALREADY_RECORDED' using errcode='23505';end if;
 result:=jsonb_build_object('outcome','FRANCHISE_NETWORK_REFERRAL_REGISTERED','invitation_id',i.id,'organization_id',p_target_organization_id,'prospect_type',i.prospect_type);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash) values(p_target_organization_id,auth.uid(),'USER','franchise.network.referral_registered','franchise_network_invitation',i.id::text,p_correlation_id,jsonb_build_object('source_franchise_id',i.franchise_id,'economic_grant',false,'role_grant',false),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key) values(p_target_organization_id,'franchise_network_invitation',i.id::text,'FranchiseNetworkReferralRegisteredV1',p_correlation_id,result,'franchise-network-referral:'||i.id::text) on conflict do nothing;
 perform private.finish_contract_command(p_target_organization_id,'franchise.network.invitation.accept',p_idempotency_key,result);return result;
end $$;

revoke all on function public.queue_franchise_network_invitations_v1(uuid,uuid,text,uuid,jsonb,boolean,text,uuid),public.open_franchise_network_invitation_v1(uuid,text),public.accept_franchise_network_invitation_v1(uuid,text,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.queue_franchise_network_invitations_v1(uuid,uuid,text,uuid,jsonb,boolean,text,uuid),public.open_franchise_network_invitation_v1(uuid,text),public.accept_franchise_network_invitation_v1(uuid,text,uuid,text,uuid) to authenticated;
revoke all on function public.load_franchise_network_invitation_delivery_v1(bigint,uuid),public.complete_franchise_network_invitation_delivery_v1(bigint,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.load_franchise_network_invitation_delivery_v1(bigint,uuid),public.complete_franchise_network_invitation_delivery_v1(bigint,uuid,text,text) to service_role;
notify pgrst,'reload schema';
