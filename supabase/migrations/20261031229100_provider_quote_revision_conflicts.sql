-- Stale browser drafts cannot silently replace the current immutable quote version.
alter function public.create_quote_revision(uuid,jsonb,text,text,uuid)rename to create_quote_revision_pre_cas_v1;
revoke all on function public.create_quote_revision_pre_cas_v1(uuid,jsonb,text,text,uuid)from public,anon,authenticated,service_role;
create function public.create_quote_revision(p_rfq_provider_id uuid,p_payload jsonb,p_change_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare org uuid;rfq uuid;current_version uuid;expected uuid;body jsonb;h text;prior public.idempotency_keys%rowtype;
begin
 select provider_organization_id,rfq_id into org,rfq from public.rfq_providers where id=p_rfq_provider_id for update;
 if auth.uid()is null or org is null or not private.has_org_role(org,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES'],auth.uid())then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if jsonb_typeof(p_payload)is distinct from'object'or not(p_payload?'expected_current_version_id')then raise exception'QUOTE_EXPECTED_VERSION_REQUIRED'using errcode='40001';end if;
 expected:=nullif(p_payload->>'expected_current_version_id','')::uuid;body:=p_payload-'expected_current_version_id';
 h:=private.canonical_request_hash(jsonb_build_object('operation','quote.revision.create.v1','rfq_provider_id',p_rfq_provider_id,'payload',body,'change_reason',btrim(p_change_reason)));
 perform pg_advisory_xact_lock(hashtextextended(org::text||':quote.revision.create:'||p_idempotency_key,0));
 select*into prior from public.idempotency_keys where organization_id=org and operation_scope='quote.revision.create'and key=p_idempotency_key;
 if found then if prior.request_hash<>h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;if prior.status='COMPLETED'then return prior.response_body;end if;raise exception'IDEMPOTENCY_IN_PROGRESS'using errcode='55000';end if;
 select current_version_id into current_version from public.quotes where rfq_id=rfq and provider_organization_id=org for update;
 if current_version is distinct from expected then raise exception'QUOTE_VERSION_CONFLICT'using errcode='40001';end if;
 return public.create_quote_revision_pre_cas_v1(p_rfq_provider_id,body,p_change_reason,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.create_quote_revision(uuid,jsonb,text,text,uuid)from public,anon,service_role;
grant execute on function public.create_quote_revision(uuid,jsonb,text,text,uuid)to authenticated;
notify pgrst,'reload schema';
