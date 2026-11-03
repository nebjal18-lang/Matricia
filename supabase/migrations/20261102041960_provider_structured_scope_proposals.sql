begin;
-- Provider proposal keeps its existing exact-version CAS and governed financial
-- admission. Withdrawal and replacement targets are signed contractual keys.
create or replace function public.propose_provider_contract_amendment_v1(
 p_contract_id uuid,p_expected_contract_version_id uuid,p_expected_contract_hash text,p_reason text,p_scope_delta jsonb,
 p_price_delta_minor bigint,p_deadline_delta_days integer,p_deliverables_delta jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare actor uuid:=auth.uid();c public.contracts%rowtype;v public.contract_versions%rowtype;cached jsonb;request_hash text;result jsonb;scope text;item jsonb;target public.contract_items%rowtype;
begin
 select*into c from public.contracts where id=p_contract_id;
 if actor is null or c.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],actor)then raise exception'AMENDMENT_CREATE_DENIED'using errcode='42501';end if;
 if p_expected_contract_version_id is null or coalesce(p_expected_contract_hash,'')!~'^[0-9a-f]{64}$'or p_price_delta_minor is null or p_deadline_delta_days is null or p_deadline_delta_days not between -3650 and 3650 or length(btrim(coalesce(p_reason,'')))not between 3 and 2000 or jsonb_typeof(p_scope_delta)is distinct from'object'or jsonb_typeof(p_scope_delta->'description')is distinct from'string'or length(btrim(p_scope_delta->>'description'))not between 2 and 4000 or p_scope_delta-'description'<>'{}'::jsonb or p_correlation_id is null then raise exception'INVALID_AMENDMENT'using errcode='22023';end if;
 if jsonb_typeof(p_deliverables_delta)is distinct from'array'or jsonb_array_length(p_deliverables_delta)>50 then raise exception'INVALID_AMENDMENT_DELIVERABLE_DELTA'using errcode='22023';end if;
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);
 select*into c from public.contracts where id=p_contract_id for update;
 scope:='contract.amendment.provider.'||c.id::text;
 request_hash:=private.canonical_request_hash(jsonb_build_object('contract',c.id,'base',p_expected_contract_version_id,'hash',p_expected_contract_hash,'reason',p_reason,'scope',p_scope_delta,'price_delta_minor',p_price_delta_minor,'deadline_delta_days',p_deadline_delta_days,'deliverables',p_deliverables_delta));
 cached:=private.begin_contract_command(c.client_organization_id,scope,p_idempotency_key,request_hash,actor);if cached is not null then return cached;end if;
 select*into v from public.contract_versions where contract_id=c.id and version=c.current_version;
 if v.id is distinct from p_expected_contract_version_id or v.content_hash is distinct from p_expected_contract_hash then raise exception'STALE_CONTRACT_VERSION'using errcode='40001';end if;
 if v.price_minor::numeric+p_price_delta_minor::numeric not between 0 and 9223372036854775807::numeric then raise exception'INVALID_AMENDMENT_TOTAL'using errcode='22023';end if;
 if jsonb_array_length(p_deliverables_delta)<>(select count(distinct x->>'item_key')from jsonb_array_elements(p_deliverables_delta)x)then raise exception'INVALID_AMENDMENT_DELIVERABLE_DELTA'using errcode='22023';end if;
 for item in select*from jsonb_array_elements(p_deliverables_delta)loop
  if jsonb_typeof(item)is distinct from'object'or item->>'operation'not in('ADD','REMOVE','REPLACE')or item->>'operation'is null or item->>'item_type'is distinct from'DELIVERABLE'or coalesce(item->>'item_key','')!~'^[A-Z][A-Z0-9_-]{1,79}$'then raise exception'INVALID_AMENDMENT_DELIVERABLE_DELTA'using errcode='22023';end if;
  select*into target from public.contract_items where contract_version_id=v.id and item_key=item->>'item_key';
  if item->>'operation'='REMOVE'then
   if item-array['operation','item_type','item_key']<>'{}'::jsonb or target.id is null or target.item_type<>'DELIVERABLE'then raise exception'INVALID_AMENDMENT_DELIVERABLE_DELTA'using errcode='22023';end if;
  else
   if length(btrim(coalesce(item->>'label_fr','')))not between 1 and 500 or length(btrim(coalesce(item->>'label_ar','')))not between 1 and 500 or coalesce(item->>'sort_order','')!~'^[1-9][0-9]{0,5}$'or item-array['operation','item_type','item_key','label_fr','label_ar','details','sort_order']<>'{}'::jsonb or not private.valid_signed_addition_criteria_v1(item->'details')then raise exception'INVALID_AMENDMENT_DELIVERABLE_DELTA'using errcode='22023';end if;
   if item->>'operation'='ADD'and(target.id is not null or exists(select 1 from public.contract_items i where i.contract_version_id=v.id and i.sort_order=(item->>'sort_order')::integer))then raise exception'AMENDMENT_DELIVERABLE_CONFLICT'using errcode='40001';end if;
   if item->>'operation'='REPLACE'and(target.id is null or target.item_type<>'DELIVERABLE'or target.sort_order<>(item->>'sort_order')::integer)then raise exception'INVALID_AMENDMENT_DELIVERABLE_DELTA'using errcode='22023';end if;
  end if;
 end loop;
 if(select count(*)from jsonb_array_elements(p_deliverables_delta)x where x->>'operation'<>'REMOVE')<>(select count(distinct x->>'sort_order')from jsonb_array_elements(p_deliverables_delta)x where x->>'operation'<>'REMOVE')then raise exception'INVALID_AMENDMENT_DELIVERABLE_DELTA'using errcode='22023';end if;
 result:=public.create_contract_amendment(c.id,p_reason,p_scope_delta,p_price_delta_minor,p_deadline_delta_days,p_deliverables_delta,v.commission_rule_snapshot,p_idempotency_key,p_correlation_id);
 perform private.finish_contract_command(c.client_organization_id,scope,p_idempotency_key,result);return result;
end$$;
revoke all on function public.propose_provider_contract_amendment_v1(uuid,uuid,text,text,jsonb,bigint,integer,jsonb,text,uuid)from public,anon,service_role;
grant execute on function public.propose_provider_contract_amendment_v1(uuid,uuid,text,text,jsonb,bigint,integer,jsonb,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
