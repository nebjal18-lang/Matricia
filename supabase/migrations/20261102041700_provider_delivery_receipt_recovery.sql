begin;
-- Recover an exact committed command without reading its quarantined bytes.
-- Current organisation/assignment permissions are checked again on every read.
create function public.get_provider_delivery_command_receipt_v1(p_deliverable_id uuid,p_description text,p_links jsonb,p_proofs jsonb,p_idempotency_key text)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare d public.deliverables%rowtype;m public.missions%rowtype;receipt public.idempotency_keys%rowtype;expected_hash text;
begin
 select * into d from public.deliverables where id=p_deliverable_id;
 select * into m from public.missions where id=d.mission_id;
 if auth.uid()is null or m.id is null or not private.provider_mission_execution_access_v1(m.id,auth.uid())then raise exception 'DELIVERY_SUBMIT_DENIED'using errcode='42501';end if;
 if length(coalesce(p_idempotency_key,''))not between 8 and 200 or jsonb_typeof(p_links)is distinct from'array'or jsonb_typeof(p_proofs)is distinct from'array'then raise exception'INVALID_DELIVERY_RECEIPT_REQUEST'using errcode='22023';end if;
 select*into receipt from public.idempotency_keys where organization_id=m.client_organization_id and operation_scope='delivery.submit.'||d.id::text and key=p_idempotency_key;
 if not found then return jsonb_build_object('status','NOT_RECORDED');end if;
 if receipt.created_by is distinct from auth.uid()then raise exception'DELIVERY_RECEIPT_ACTOR_DENIED'using errcode='42501';end if;
 expected_hash:=private.canonical_request_hash(jsonb_build_object('deliverable',d.id,'description',p_description,'links',p_links,'proofs',p_proofs));
 if receipt.request_hash is distinct from expected_hash then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
 if receipt.status<>'COMPLETED'or receipt.response_body is null then raise exception'COMMAND_IN_PROGRESS'using errcode='55000';end if;
 return jsonb_build_object('status','COMPLETED','response',receipt.response_body);
end$$;
revoke all on function public.get_provider_delivery_command_receipt_v1(uuid,text,jsonb,jsonb,text)from public,anon,authenticated,service_role;
grant execute on function public.get_provider_delivery_command_receipt_v1(uuid,text,jsonb,jsonb,text)to authenticated;
notify pgrst,'reload schema';
commit;
