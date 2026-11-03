begin;
-- A replay of a decided V1 must remain a replay after Provider submits V2.
-- A new stale command still fails before it can decide the current generation.
create or replace function public.accept_delivery_version_v1(p_deliverable_id uuid,p_expected_delivery_version integer,p_decisions jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.deliverables%rowtype;m public.missions%rowtype;receipt public.idempotency_keys%rowtype;expected_hash text;
begin
 select*into d from public.deliverables where id=p_deliverable_id for update;
 select*into m from public.missions where id=d.mission_id;
 if auth.uid()is null or m.id is null or not private.has_org_role(m.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'DELIVERY_ACCEPT_DENIED'using errcode='42501';end if;
 if p_expected_delivery_version is null or p_expected_delivery_version<1 or jsonb_typeof(p_decisions)is distinct from'array'or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_ACCEPTANCE'using errcode='22023';end if;
 select*into receipt from public.idempotency_keys where organization_id=m.client_organization_id and operation_scope='delivery.accept.'||d.id::text and key=p_idempotency_key;
 if found then
  if receipt.created_by is distinct from auth.uid()then raise exception'DELIVERY_RECEIPT_ACTOR_DENIED'using errcode='42501';end if;
  expected_hash:=private.canonical_request_hash(jsonb_build_object('deliverable',d.id,'version',p_expected_delivery_version,'decisions',p_decisions));
  if receipt.request_hash is distinct from expected_hash then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
  if receipt.status<>'COMPLETED'or receipt.response_body is null then raise exception'COMMAND_IN_PROGRESS'using errcode='55000';end if;
  return receipt.response_body;
 end if;
 if d.current_version<>p_expected_delivery_version then raise exception'DELIVERY_VERSION_CHANGED'using errcode='40001';end if;
 return public.accept_delivery(d.id,p_decisions,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.accept_delivery_version_v1(uuid,integer,jsonb,text,uuid)from public,anon,service_role;
grant execute on function public.accept_delivery_version_v1(uuid,integer,jsonb,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
