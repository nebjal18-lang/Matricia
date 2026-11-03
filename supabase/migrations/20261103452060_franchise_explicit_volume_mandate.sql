-- Explicit mandate commands never pick another territory by creation order.
begin;
create or replace function public.propose_franchise_volume_purchase_for_mandate_v1(
  p_franchise_id uuid,
  p_library_id uuid,
  p_sku_id uuid,
  p_forecast_units numeric,
  p_minimum_commitment_units numeric,
  p_maximum_units numeric,
  p_payment_model text,
  p_period_start date,
  p_period_end date,
  p_rationale text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  a uuid := auth.uid();
  f public.franchises%rowtype;
  s public.service_skus%rowtype;
  v_hash text;
  r jsonb;
  pid uuid;
begin
  select * into f from public.franchises where id=p_franchise_id and library_id=p_library_id and status='ACTIVE';
  if a is null or not found or not private.franchise_access(f.id, a)
     or not private.has_franchise_role(f.id, array['FRANCHISE_OWNER', 'FRANCHISE_MANAGER'], a) then
    raise exception 'FRANCHISE_VOLUME_PROPOSAL_DENIED' using errcode = '42501';
  end if;
  select * into s from public.service_skus where id = p_sku_id and status = 'ACTIVE';
  if not found or not exists (select 1 from public.catalog_services cs where cs.id = s.service_id and cs.library_id = p_library_id) then
    raise exception 'VOLUME_SKU_NOT_IN_MANDATE' using errcode = '22023';
  end if;
  if p_forecast_units is null or p_forecast_units <= 0
     or trim_scale(p_forecast_units)::text!~'^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
     or trim_scale(p_minimum_commitment_units)::text!~'^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
     or trim_scale(p_maximum_units)::text!~'^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
     or p_period_start is null or p_period_end is null
     or p_minimum_commitment_units is null or p_minimum_commitment_units < 0
     or p_maximum_units is null or p_maximum_units <= 0
     or p_minimum_commitment_units > p_maximum_units
     or p_forecast_units > p_maximum_units
     or p_payment_model not in ('PAY_PER_USE', 'PREPAID', 'HYBRID')
     or p_period_end < p_period_start
     or length(btrim(coalesce(p_rationale, ''))) not between 10 and 4000
  then
    raise exception 'INVALID_VOLUME_PROPOSAL' using errcode = '22023';
  end if;
  v_hash := private.canonical_request_hash(jsonb_build_object(
    'franchise',f.id,'library', p_library_id, 'sku', p_sku_id, 'forecast', p_forecast_units,
    'min', p_minimum_commitment_units, 'max', p_maximum_units, 'model', p_payment_model,
    'start', p_period_start, 'end', p_period_end, 'rationale', btrim(p_rationale)
  ));
  r := private.begin_contract_command(f.operator_organization_id, 'franchise.volume.propose.'||f.id::text, p_idempotency_key, v_hash, a);
  if r is not null then return r; end if;
  insert into public.franchise_volume_proposals (
    franchise_id, library_id, sku_id, service_id, forecast_units, minimum_commitment_units,
    maximum_units, payment_model, period_start, period_end, rationale, content_hash, created_by
  ) values (
    f.id, p_library_id, p_sku_id, s.service_id, p_forecast_units, p_minimum_commitment_units,
    p_maximum_units, p_payment_model, p_period_start, p_period_end, btrim(p_rationale), v_hash, a
  ) returning id into pid;
  r := jsonb_build_object('outcome', 'FRANCHISE_VOLUME_PROPOSED', 'proposal_id', pid, 'status', 'PROPOSED', 'sku_id', p_sku_id);
  insert into public.audit_events (organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (f.operator_organization_id, a, 'USER', 'franchise.volume.proposed', 'franchise_volume_proposal', pid::text, p_correlation_id, r, repeat('0', 64));
  insert into public.event_outbox (organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (f.operator_organization_id, 'franchise_volume_proposal', pid::text, 'FranchiseVolumeProposedV1', p_correlation_id, r, p_idempotency_key);
  perform private.finish_contract_command(f.operator_organization_id, 'franchise.volume.propose.'||f.id::text, p_idempotency_key, r);
  return r;
end
$$;
revoke all on function public.propose_franchise_volume_purchase_for_mandate_v1(uuid,uuid,uuid,numeric,numeric,numeric,text,date,date,text,text,uuid)from public,anon,service_role;
grant execute on function public.propose_franchise_volume_purchase_for_mandate_v1(uuid,uuid,uuid,numeric,numeric,numeric,text,date,date,text,text,uuid)to authenticated;

do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.propose_franchise_volume_purchase(uuid,uuid,numeric,numeric,numeric,text,date,date,text,text,uuid)'::regprocedure)into definition;
 if strpos(definition,'select * into f from public.franchises where library_id = p_library_id and status = ''ACTIVE'' order by created_at desc limit 1;')=0 or strpos(definition,'private.has_org_role(f.operator_organization_id, array[''FRANCHISE_OWNER'', ''FRANCHISE_MANAGER''], a)')=0 then raise exception 'FRANCHISE_VOLUME_SCOPE_SOURCE_MISMATCH';end if;
 definition:=replace(definition,'select * into f from public.franchises where library_id = p_library_id and status = ''ACTIVE'' order by created_at desc limit 1;','if(select count(*)from public.franchises candidate where candidate.library_id=p_library_id and candidate.status=''ACTIVE''and private.has_franchise_role(candidate.id,array[''FRANCHISE_OWNER'',''FRANCHISE_MANAGER''],a))>1 then raise exception ''FRANCHISE_VOLUME_SELECTION_REQUIRED''using errcode=''22023'';end if;
select * into f from public.franchises where library_id=p_library_id and status=''ACTIVE''and private.has_franchise_role(id,array[''FRANCHISE_OWNER'',''FRANCHISE_MANAGER''],a);');
 definition:=replace(definition,'private.has_org_role(f.operator_organization_id, array[''FRANCHISE_OWNER'', ''FRANCHISE_MANAGER''], a)','private.has_franchise_role(f.id, array[''FRANCHISE_OWNER'', ''FRANCHISE_MANAGER''], a)');
 execute definition;
end$migration$;
commit;
