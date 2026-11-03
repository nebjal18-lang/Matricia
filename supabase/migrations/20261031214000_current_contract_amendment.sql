-- Propose an amendment against the exact immutable version the writer reviewed.
-- Commission and deliverables are derived from the governed contract, never a form.
begin;
create function public.create_current_contract_amendment_v1(
 p_contract_id uuid,p_expected_contract_version_id uuid,p_expected_contract_hash text,
 p_reason text,p_scope_delta jsonb,p_price_delta_minor bigint,p_deadline_delta_days integer,
 p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();c public.contracts%rowtype;v public.contract_versions%rowtype;cached jsonb;request_hash text;result jsonb;scope text;
begin
 select*into c from public.contracts where id=p_contract_id;
 if actor is null or c.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not(private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)or private.has_org_role(c.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],actor))then raise exception'AMENDMENT_CREATE_DENIED'using errcode='42501';end if;
 if p_expected_contract_version_id is null or coalesce(p_expected_contract_hash,'')!~'^[0-9a-f]{64}$'or p_price_delta_minor is null or p_deadline_delta_days is null or p_deadline_delta_days not between -3650 and 3650 or length(btrim(coalesce(p_reason,'')))not between 3 and 2000 or jsonb_typeof(p_scope_delta)is distinct from'object'or jsonb_typeof(p_scope_delta->'description')is distinct from'string'or length(btrim(p_scope_delta->>'description'))not between 2 and 4000 or p_scope_delta-'description'<>'{}'::jsonb or p_correlation_id is null then raise exception'INVALID_AMENDMENT'using errcode='22023';end if;
 -- Same lock order as financial adjustments, identity changes and the core bridge.
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);
 select*into c from public.contracts where id=p_contract_id for update;
 scope:='contract.amendment.current.'||c.id::text;
 request_hash:=private.canonical_request_hash(jsonb_build_object('contract',c.id,'base',p_expected_contract_version_id,'hash',p_expected_contract_hash,'reason',p_reason,'scope',p_scope_delta,'price_delta_minor',p_price_delta_minor,'deadline_delta_days',p_deadline_delta_days));
 cached:=private.begin_contract_command(c.client_organization_id,scope,p_idempotency_key,request_hash,actor);if cached is not null then return cached;end if;
 select*into v from public.contract_versions where contract_id=c.id and version=c.current_version;
 if v.id is distinct from p_expected_contract_version_id or v.content_hash is distinct from p_expected_contract_hash then raise exception'STALE_CONTRACT_VERSION'using errcode='40001';end if;
 if v.price_minor::numeric+p_price_delta_minor::numeric not between 0 and 9223372036854775807::numeric then raise exception'INVALID_AMENDMENT_TOTAL'using errcode='22023';end if;
 result:=public.create_contract_amendment(c.id,p_reason,p_scope_delta,p_price_delta_minor,p_deadline_delta_days,'[]'::jsonb,v.commission_rule_snapshot,p_idempotency_key,p_correlation_id);
 perform private.finish_contract_command(c.client_organization_id,scope,p_idempotency_key,result);
 return result;
end$$;
revoke all on function public.create_current_contract_amendment_v1(uuid,uuid,text,text,jsonb,bigint,integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.create_current_contract_amendment_v1(uuid,uuid,text,text,jsonb,bigint,integer,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
