-- A canonical reviewed legal profile fixes the address of future offers.
-- Existing immutable quote anchors and exact command replays remain preserved.
create or replace function public.submit_provider_quote_with_identity_v1(p_quote_id uuid,p_expected_version_id uuid,p_expected_identity_hash text,p_registered_address text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare q public.quotes%rowtype;v public.quote_versions%rowtype;a public.provider_quote_identity_snapshots%rowtype;h public.provider_identity_verification_history%rowtype;snapshot jsonb;request_hash text;r jsonb;current_hash text;org uuid;canonical_address text;
begin
 select provider_organization_id into org from public.quotes where id=p_quote_id;
 if auth.uid()is null or org is null or not private.has_org_role(org,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES'],auth.uid())then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if p_expected_identity_hash is null or p_expected_identity_hash!~'^[0-9a-f]{64}$'or length(btrim(coalesce(p_registered_address,'')))not between 5 and 1000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'QUOTE_IDENTITY_CONFIRMATION_REQUIRED'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||org::text,0));
 select*into q from public.quotes where id=p_quote_id for update;
 request_hash:=private.canonical_request_hash(jsonb_build_object('quote',p_quote_id,'version',p_expected_version_id,'identity_hash',p_expected_identity_hash,'registered_address',btrim(p_registered_address),'actor',auth.uid()));
 select*into a from public.provider_quote_identity_snapshots where provider_organization_id=org and idempotency_key=p_idempotency_key;
 if found then if a.request_hash is distinct from request_hash then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return a.response_body;end if;
 if not exists(select 1 from public.organizations where id=org and status='ACTIVE')then raise exception'PROVIDER_ORGANIZATION_NOT_ACTIVE'using errcode='55000';end if;
 if exists(select 1 from public.client_compliance_cases where organization_id=org)and not coalesce(private.client_identity_allows_new_operations(org),false)then raise exception'PROVIDER_ORGANIZATION_CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 select*into v from public.quote_versions where id=p_expected_version_id and quote_id=q.id and provider_organization_id=org for update;
 if v.id is null or q.current_version_id is distinct from v.id then raise exception'QUOTE_VERSION_STALE'using errcode='40001';end if;
 if v.lifecycle_status<>'DRAFT'or exists(select 1 from public.provider_quote_identity_snapshots where quote_version_id=v.id)then raise exception'QUOTE_IDENTITY_REPUBLICATION_REQUIRED'using errcode='55000';end if;
 snapshot:=private.provider_current_identity_snapshot_v1(org);current_hash:=private.canonical_request_hash(snapshot);
 if current_hash is distinct from p_expected_identity_hash then raise exception'QUOTE_PROVIDER_IDENTITY_CHANGED'using errcode='40001';end if;
 if not private.provider_current_identity_is_verified_v1(org)then raise exception'PROVIDER_CURRENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 canonical_address:=private.provider_canonical_registered_address_v1(org);
 if canonical_address is not null and btrim(p_registered_address)is distinct from canonical_address then raise exception'QUOTE_CANONICAL_REGISTERED_ADDRESS_REQUIRED'using errcode='22023';end if;
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

create or replace function public.get_my_provider_identity_status_v1(p_provider_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare snapshot jsonb;verified boolean;client_ready boolean;organization_active boolean;publication_reason text;h public.provider_identity_verification_history%rowtype;
begin
 if auth.uid()is null or not(private.is_active_org_member(p_provider_organization_id,auth.uid())or private.can_decide_provider_qualification(auth.uid()))then raise exception'PROVIDER_IDENTITY_STATUS_DENIED'using errcode='42501';end if;
 snapshot:=private.provider_current_identity_snapshot_v1(p_provider_organization_id);verified:=private.provider_current_identity_is_verified_v1(p_provider_organization_id);
 client_ready:=not exists(select 1 from public.client_compliance_cases where organization_id=p_provider_organization_id)or coalesce(private.client_identity_allows_new_operations(p_provider_organization_id),false);
 organization_active:=exists(select 1 from public.organizations where id=p_provider_organization_id and status='ACTIVE');
 publication_reason:=case when not verified then'PROVIDER_IDENTITY_REVIEW_REQUIRED'when not client_ready then'CLIENT_IDENTITY_REVIEW_REQUIRED'when not organization_active then'ORGANIZATION_NOT_ACTIVE'else null end;
 select*into h from public.provider_identity_verification_history where organization_id=p_provider_organization_id order by verified_at desc,id desc limit 1;
 return jsonb_build_object('verified',verified,'last_verified_at',h.verified_at,'identity_hash',private.canonical_request_hash(snapshot),'identity_review_id',case when verified then h.id else null end,'identity_snapshot',snapshot,'canonical_registered_address',private.provider_canonical_registered_address_v1(p_provider_organization_id),'publication_allowed',verified and client_ready and organization_active,'publication_block_reason',publication_reason);
end$$;
notify pgrst,'reload schema';
