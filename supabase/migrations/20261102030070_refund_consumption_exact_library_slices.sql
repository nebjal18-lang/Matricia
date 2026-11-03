begin;
-- A consumption owns its original-credit positions even while its mandate or
-- fiscal recognition is pending. Refunding it frees exactly those positions.
-- Reconciliation order must never move a pending library's value to another.
create function private.credit_economic_consumption_slices_v1(p_fact uuid)
returns int8multirange language plpgsql stable security definer
set search_path=pg_catalog set timezone='UTC' as $$
declare
 f public.credit_economic_consumption_facts_v1%rowtype;
 l public.credit_lots%rowtype;m public.credit_lot_movements%rowtype;
 occupied int8multirange:='{}'::int8multirange;
 free_positions int8multirange;chosen int8multirange;span int8range;
 redemption_ids uuid[]:='{}';slices int8multirange[]:='{}';returned uuid[]:='{}';
 position_index integer;remaining bigint;take_quantity bigint;assigned_quantity numeric;
begin
 select*into f from public.credit_economic_consumption_facts_v1 where id=p_fact;
 select*into l from public.credit_lots where id=f.credit_lot_id and organization_id=f.organization_id;
 if f.id is null or l.id is null or f.source_hash<>private.canonical_request_hash(f.source_snapshot)then raise exception'CREDIT_CONSUMPTION_SLICE_SOURCE_REQUIRED'using errcode='23514';end if;
 for m in select*from public.credit_lot_movements where credit_lot_id=l.id and id<=f.movement_id and movement_type in('CONSUME','REFUND')order by id loop
  if m.organization_id is distinct from f.organization_id then raise exception'CREDIT_CONSUMPTION_SLICE_SCOPE_MISMATCH'using errcode='23514';end if;
  if m.movement_type='CONSUME'then
   if array_position(redemption_ids,m.redemption_id)is not null then raise exception'DUPLICATE_CREDIT_CONSUMPTION_SLICE'using errcode='23514';end if;
   remaining:=m.quantity;chosen:='{}'::int8multirange;
   free_positions:=int8multirange(int8range(0,l.quantity,'[)'))-occupied;
   for span in select r from unnest(free_positions)r order by lower(r)loop
    exit when remaining=0;
    take_quantity:=least(remaining,upper(span)-lower(span));
    chosen:=chosen+int8multirange(int8range(lower(span),lower(span)+take_quantity,'[)'));
    remaining:=remaining-take_quantity;
   end loop;
   if remaining<>0 then raise exception'ECONOMIC_CONSUMPTION_EXCEEDS_CREDIT_LOT'using errcode='23514';end if;
   occupied:=occupied+chosen;
   redemption_ids:=array_append(redemption_ids,m.redemption_id);slices:=array_append(slices,chosen);
   if m.id=f.movement_id then
    if m.redemption_id is distinct from f.redemption_id or m.quantity is distinct from f.consumed_quantity then raise exception'CREDIT_CONSUMPTION_SLICE_FACT_MISMATCH'using errcode='23514';end if;
    return chosen;
   end if;
  else
   position_index:=array_position(redemption_ids,m.redemption_id);
   if position_index is null or m.redemption_id=any(returned)then raise exception'CREDIT_REFUND_SLICE_SOURCE_REQUIRED'using errcode='23514';end if;
   select coalesce(sum(upper(r)::numeric-lower(r)::numeric),0)into assigned_quantity from unnest(slices[position_index])r;
   if assigned_quantity<>m.quantity then raise exception'CREDIT_REFUND_SLICE_QUANTITY_MISMATCH'using errcode='23514';end if;
   occupied:=occupied-slices[position_index];returned:=array_append(returned,m.redemption_id);
  end if;
 end loop;
 raise exception'CREDIT_CONSUMPTION_SLICE_MOVEMENT_REQUIRED'using errcode='23514';
end$$;
revoke all on function private.credit_economic_consumption_slices_v1(uuid)from public,anon,authenticated,service_role;

-- The same immutable positions and cumulative-floor rounding price this fact
-- alone. Other posted or pending consumptions cannot change its exact amount.
create or replace function private.credit_economic_refund_aware_amount_v1(p_fact uuid,p_classification uuid)
returns bigint language plpgsql stable security definer
set search_path=pg_catalog set timezone='UTC' as $$
declare f public.credit_economic_consumption_facts_v1%rowtype;l public.credit_lots%rowtype;c public.credit_economic_classifications_v1%rowtype;positions int8multirange;amount numeric;
begin
 select*into f from public.credit_economic_consumption_facts_v1 where id=p_fact;
 select*into l from public.credit_lots where id=f.credit_lot_id and organization_id=f.organization_id;
 select*into c from public.credit_economic_classifications_v1 where id=p_classification and funding_source_id=f.funding_source_id;
 if f.id is null or l.id is null or c.id is null then raise exception'CREDIT_CONSUMPTION_SLICE_CLASSIFICATION_REQUIRED'using errcode='23514';end if;
 positions:=private.credit_economic_consumption_slices_v1(f.id);
 select coalesce(sum(floor(c.unallocated_credit_minor::numeric*upper(r)/l.quantity)-floor(c.unallocated_credit_minor::numeric*lower(r)/l.quantity)),0)into amount from unnest(positions)r;
 return amount::bigint;
end$$;
revoke all on function private.credit_economic_refund_aware_amount_v1(uuid,uuid)from public,anon,authenticated,service_role;

do $$declare d text;needle text:='''lot_quantity'',l.quantity::text,''rounding'',policy.policy_snapshot->>''purchase_rounding''';begin
 select pg_get_functiondef('private.allocate_credit_economic_consumption_v1(uuid,uuid)'::regprocedure)into d;
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception'CREDIT_REFUND_SLICE_EVIDENCE_SOURCE_CONTRACT_MISMATCH';end if;
 execute replace(d,needle,'''lot_quantity'',l.quantity::text,''credit_position_slices'',private.credit_economic_consumption_slices_v1(fact.id)::text,''slice_algorithm'',''IMMUTABLE_LOT_POSITIONS_LOWEST_FREE_V1'',''rounding'',policy.policy_snapshot->>''purchase_rounding''');
end$$;
notify pgrst,'reload schema';
commit;
