begin;
-- Reject unproved historical income as well as new sources. A denial never
-- rewrites an old recognition, closure, allocation or completed payout.
create or replace function private.assert_credit_economic_profit_close_ready_v1(p_book_id uuid,p_period_start date,p_period_end date)
returns void language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare b public.franchise_pnl_books%rowtype;a record;cf record;cost_kind text;share jsonb;attribution_row public.credit_economic_cost_attributions_v1%rowtype;
begin
 select*into b from public.franchise_pnl_books where id=p_book_id;
 if exists(select 1 from public.franchise_pnl_entries legacy where legacy.book_id=b.id and legacy.effective_on between p_period_start and p_period_end and legacy.effect_type='REVENUE'
  and not exists(select 1 from private.credit_economic_pnl_sources_v1 native join public.credit_economic_allocations_v1 alloc on alloc.id=native.allocation_id
   where native.pnl_entry_id=legacy.id and alloc.book_id=b.id and legacy.source_type='CREDIT_ECONOMIC_ALLOCATION_V1'and legacy.source_id=alloc.id::text and legacy.amount_minor=alloc.amount_minor and legacy.currency=alloc.currency))
 then raise exception'FRANCHISE_CANONICAL_REVENUE_RECONCILIATION_REQUIRED'using errcode='55000';end if;

 for cf in select fact.*from public.credit_economic_consumption_facts_v1 fact where fact.library_id=b.library_id and fact.currency=b.currency and fact.consumed_at::date between p_period_start and p_period_end
  and coalesce((private.credit_economic_book_route_v1(fact.library_id,fact.organization_id,fact.currency,fact.consumed_at)#>>'{book,id}')::uuid,b.id)=b.id loop
  if not exists(select 1 from public.credit_economic_allocations_v1 alloc where alloc.consumption_fact_id=cf.id and alloc.book_id=b.id and alloc.allocation_kind='PURCHASE_CONSUMPTION')then raise exception'CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 end loop;
 for a in select alloc.*,e.effective_on,e.id revenue_entry_id from public.credit_economic_allocations_v1 alloc join private.credit_economic_pnl_sources_v1 s on s.allocation_id=alloc.id join public.franchise_pnl_entries e on e.id=s.pnl_entry_id
  where alloc.book_id=b.id and e.effective_on between p_period_start and p_period_end loop
  if exists(select 1 from public.franchise_pnl_entries reversal where reversal.reverses_entry_id=a.revenue_entry_id)then raise exception'CREDIT_ECONOMIC_REVERSAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
  foreach cost_kind in array array['PSP_FEE','FULFILLMENT_COST']loop
   share:=private.credit_economic_cost_share_v1(a.id,cost_kind);
   select*into attribution_row from public.credit_economic_cost_attributions_v1 t where t.allocation_id=a.id and t.component=cost_kind;
   if attribution_row.allocation_id is null or attribution_row.source_hash<>private.canonical_request_hash(share)or attribution_row.amount_minor is distinct from(share->>'amount_minor')::bigint
    or(attribution_row.amount_minor>0 and not exists(select 1 from public.franchise_pnl_entries e where e.id=attribution_row.pnl_entry_id and e.book_id=b.id and e.effect_type='COST'and e.amount_minor=attribution_row.amount_minor and e.effective_on=a.effective_on and e.source_type='CREDIT_ECONOMIC_COST_V1'and not exists(select 1 from public.franchise_pnl_entries rev where rev.reverses_entry_id=e.id)))
   then raise exception'CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
  end loop;
 end loop;
end$$;
revoke all on function private.assert_credit_economic_profit_close_ready_v1(uuid,date,date)from public,anon,authenticated,service_role;
commit;
