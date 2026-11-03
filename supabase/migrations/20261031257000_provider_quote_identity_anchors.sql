-- A published offer carries the exact provider identity that was verified and explicitly confirmed at publication.
create table public.provider_quote_identity_snapshots(
 quote_version_id uuid primary key references public.quote_versions(id),quote_id uuid not null references public.quotes(id),provider_organization_id uuid not null references public.organizations(id),
 source_quote_hash text not null check(source_quote_hash~'^[0-9a-f]{64}$'),identity_review_id uuid not null references public.provider_identity_verification_history(id),identity_hash text not null check(identity_hash~'^[0-9a-f]{64}$'),
 identity_snapshot jsonb not null check(jsonb_typeof(identity_snapshot)='object'),snapshot_hash text not null check(snapshot_hash~'^[0-9a-f]{64}$'),submitted_by uuid not null references auth.users(id),submitted_at timestamptz not null,
 idempotency_key text not null,request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),response_body jsonb not null,unique(provider_organization_id,idempotency_key)
);
alter table public.provider_quote_identity_snapshots enable row level security;
revoke all on public.provider_quote_identity_snapshots from public,anon,authenticated,service_role;
grant select on public.provider_quote_identity_snapshots to authenticated;
create policy provider_quote_identity_snapshot_read on public.provider_quote_identity_snapshots for select to authenticated using(private.can_read_quote(quote_id,auth.uid()));
create trigger provider_quote_identity_snapshot_immutable before update or delete on public.provider_quote_identity_snapshots for each row execute function private.prevent_update_delete();
create function private.provider_quote_identity_snapshot_v1(p_quote_version_id uuid)returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
 select a.identity_snapshot from public.provider_quote_identity_snapshots a join public.quote_versions v on v.id=a.quote_version_id and v.quote_id=a.quote_id and v.provider_organization_id=a.provider_organization_id and v.content_hash=a.source_quote_hash and v.submitted_at=a.submitted_at
 where a.quote_version_id=p_quote_version_id and v.lifecycle_status in('SUBMITTED','REVISED')and a.snapshot_hash=private.canonical_request_hash(a.identity_snapshot)
$$;
revoke all on function private.provider_quote_identity_snapshot_v1(uuid)from public,anon,authenticated,service_role;
alter function public.submit_quote(uuid,uuid,text,uuid)rename to submit_quote_pre_identity_v1;
revoke all on function public.submit_quote_pre_identity_v1(uuid,uuid,text,uuid)from public,anon,authenticated,service_role;
create function public.submit_provider_quote_with_identity_v1(p_quote_id uuid,p_expected_version_id uuid,p_expected_identity_hash text,p_registered_address text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare q public.quotes%rowtype;v public.quote_versions%rowtype;a public.provider_quote_identity_snapshots%rowtype;h public.provider_identity_verification_history%rowtype;snapshot jsonb;request_hash text;r jsonb;current_hash text;org uuid;
begin
 select provider_organization_id into org from public.quotes where id=p_quote_id;
 if auth.uid()is null or org is null or not private.has_org_role(org,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES'],auth.uid())then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if p_expected_identity_hash is null or p_expected_identity_hash!~'^[0-9a-f]{64}$'or length(btrim(coalesce(p_registered_address,'')))not between 5 and 1000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'QUOTE_IDENTITY_CONFIRMATION_REQUIRED'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||org::text,0));
 select*into q from public.quotes where id=p_quote_id for update;
 request_hash:=private.canonical_request_hash(jsonb_build_object('quote',p_quote_id,'version',p_expected_version_id,'identity_hash',p_expected_identity_hash,'registered_address',btrim(p_registered_address),'actor',auth.uid()));
 select*into a from public.provider_quote_identity_snapshots where provider_organization_id=org and idempotency_key=p_idempotency_key;
 if found then if a.request_hash is distinct from request_hash then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return a.response_body;end if;
 select*into v from public.quote_versions where id=p_expected_version_id and quote_id=q.id and provider_organization_id=org for update;
 if v.id is null or q.current_version_id is distinct from v.id then raise exception'QUOTE_VERSION_STALE'using errcode='40001';end if;
 if v.lifecycle_status<>'DRAFT'or exists(select 1 from public.provider_quote_identity_snapshots where quote_version_id=v.id)then raise exception'QUOTE_IDENTITY_REPUBLICATION_REQUIRED'using errcode='55000';end if;
 snapshot:=private.provider_current_identity_snapshot_v1(org);current_hash:=private.canonical_request_hash(snapshot);
 if current_hash is distinct from p_expected_identity_hash then raise exception'QUOTE_PROVIDER_IDENTITY_CHANGED'using errcode='40001';end if;
 if not private.provider_current_identity_is_verified_v1(org)then raise exception'PROVIDER_CURRENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 select*into h from public.provider_identity_verification_history where organization_id=org and identity_hash=current_hash order by verified_at desc,id desc limit 1;
 if h.id is null then raise exception'PROVIDER_CURRENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 snapshot:=snapshot||jsonb_build_object('schema_version',1,'organization_id',org,'registered_address',btrim(p_registered_address),'verified_identity_hash',current_hash,'identity_review_id',h.id,'verified_at',h.verified_at);
 r:=public.submit_quote_pre_identity_v1(p_quote_id,p_expected_version_id,p_idempotency_key,p_correlation_id);
 select*into v from public.quote_versions where id=p_expected_version_id;
 insert into public.provider_quote_identity_snapshots(quote_version_id,quote_id,provider_organization_id,source_quote_hash,identity_review_id,identity_hash,identity_snapshot,snapshot_hash,submitted_by,submitted_at,idempotency_key,request_hash,response_body)values(v.id,q.id,org,v.content_hash,h.id,current_hash,snapshot,private.canonical_request_hash(snapshot),auth.uid(),v.submitted_at,p_idempotency_key,request_hash,r);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,auth.uid(),'USER','provider.quote.identity_anchored','quote_version',v.id::text,p_correlation_id,jsonb_build_object('quote_id',q.id,'identity_review_id',h.id,'identity_hash',current_hash,'snapshot_hash',private.canonical_request_hash(snapshot)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values(org,'quote_version',v.id::text,'ProviderQuoteIdentityAnchoredV1',p_correlation_id,jsonb_build_object('quote_id',q.id,'quote_version_id',v.id,'identity_review_id',h.id,'identity_hash',current_hash),p_idempotency_key,v.id);
 return r;
end$$;
-- The old signature can read the already anchored publication result, never create a historical anchor.
create function public.submit_quote(p_quote_id uuid,p_expected_version_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare a public.provider_quote_identity_snapshots%rowtype;org uuid;
begin
 select provider_organization_id into org from public.quotes where id=p_quote_id;
 if auth.uid()is null or org is null or not private.has_org_role(org,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES'],auth.uid())then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 select*into a from public.provider_quote_identity_snapshots where quote_id=p_quote_id and quote_version_id=p_expected_version_id;
 if not found then raise exception'QUOTE_IDENTITY_REPUBLICATION_REQUIRED'using errcode='55000';end if;
 return a.response_body;
end$$;
create function public.reopen_provider_quote_for_identity_review_v1(p_quote_id uuid,p_expected_version_id uuid,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare q public.quotes%rowtype;prior public.idempotency_keys%rowtype;h text;r jsonb;
begin
 select*into q from public.quotes where id=p_quote_id for update;
 if auth.uid()is null or q.id is null or not private.has_org_role(q.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES'],auth.uid())then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 1000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_QUOTE_IDENTITY_REPUBLICATION'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('quote',q.id,'version',p_expected_version_id,'reason',btrim(p_reason),'actor',auth.uid()));
 select*into prior from public.idempotency_keys where organization_id=q.provider_organization_id and operation_scope='provider.quote.identity.reopen'and key=p_idempotency_key;
 if found then if prior.request_hash is distinct from h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return prior.response_body;end if;
 if q.current_version_id is distinct from p_expected_version_id then raise exception'QUOTE_VERSION_STALE'using errcode='40001';end if;
 if q.status<>'SUBMITTED'or exists(select 1 from public.provider_quote_identity_snapshots where quote_version_id=p_expected_version_id)or exists(select 1 from public.contract_versions where selected_quote_version_id=p_expected_version_id)or not exists(select 1 from public.rfqs where id=q.rfq_id and status='OPEN'and deadline>clock_timestamp())then raise exception'QUOTE_IDENTITY_REPUBLICATION_NOT_ALLOWED'using errcode='55000';end if;
 update public.quotes set status='REVISION_REQUESTED'where id=q.id;
 r:=jsonb_build_object('outcome','QUOTE_IDENTITY_REPUBLICATION_REQUESTED','quote_id',q.id,'quote_version_id',p_expected_version_id);
 insert into public.idempotency_keys(organization_id,operation_scope,key,request_hash,created_by,status,response_code,response_body,completed_at,expires_at)values(q.provider_organization_id,'provider.quote.identity.reopen',p_idempotency_key,h,auth.uid(),'COMPLETED',200,r,clock_timestamp(),clock_timestamp()+interval'7 days');
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(q.provider_organization_id,auth.uid(),'USER','provider.quote.identity_republication_requested','quote',q.id::text,p_correlation_id,jsonb_build_object('quote_version_id',p_expected_version_id,'reason',btrim(p_reason)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(q.provider_organization_id,'quote',q.id::text,'ProviderQuoteIdentityRepublicationRequestedV1',p_correlation_id,jsonb_build_object('quote_id',q.id,'quote_version_id',p_expected_version_id),p_idempotency_key);
 return r;
end$$;
create or replace function public.get_my_provider_identity_status_v1(p_provider_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare snapshot jsonb;verified boolean;h public.provider_identity_verification_history%rowtype;
begin
 if auth.uid()is null or not(private.is_active_org_member(p_provider_organization_id,auth.uid())or private.can_decide_provider_qualification(auth.uid()))then raise exception'PROVIDER_IDENTITY_STATUS_DENIED'using errcode='42501';end if;
 snapshot:=private.provider_current_identity_snapshot_v1(p_provider_organization_id);verified:=private.provider_current_identity_is_verified_v1(p_provider_organization_id);
 select*into h from public.provider_identity_verification_history where organization_id=p_provider_organization_id order by verified_at desc,id desc limit 1;
 return jsonb_build_object('verified',verified,'last_verified_at',h.verified_at,'identity_hash',private.canonical_request_hash(snapshot),'identity_review_id',case when verified then h.id else null end,'identity_snapshot',snapshot);
end$$;
revoke all on function public.submit_quote(uuid,uuid,text,uuid),public.submit_provider_quote_with_identity_v1(uuid,uuid,text,text,text,uuid),public.reopen_provider_quote_for_identity_review_v1(uuid,uuid,text,text,uuid)from public,anon,service_role;
grant execute on function public.submit_quote(uuid,uuid,text,uuid),public.submit_provider_quote_with_identity_v1(uuid,uuid,text,text,text,uuid),public.reopen_provider_quote_for_identity_review_v1(uuid,uuid,text,text,uuid)to authenticated;
notify pgrst,'reload schema';
