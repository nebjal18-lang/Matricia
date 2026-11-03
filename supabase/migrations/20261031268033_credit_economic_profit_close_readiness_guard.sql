begin;
-- The new credit attribution does not prove fulfillment costs or PSP fees.
-- Until their governed reconciliation is delivered, no distributable profit
-- may be closed from those facts. No override, assumed zero or payout is added.
create function private.assert_credit_economic_profit_close_ready_v1(p_book_id uuid,p_period_start date,p_period_end date)
returns void language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare book public.franchise_pnl_books%rowtype;begin
 select*into book from public.franchise_pnl_books where id=p_book_id;
 if exists(select 1 from public.credit_economic_allocations_v1 a join private.credit_economic_pnl_sources_v1 source on source.allocation_id=a.id join public.franchise_pnl_entries entry on entry.id=source.pnl_entry_id where a.book_id=book.id and entry.effective_on between p_period_start and p_period_end)
 or exists(select 1 from public.credit_economic_consumption_facts_v1 fact where fact.library_id=book.library_id and fact.currency=book.currency and fact.consumed_at::date between p_period_start and p_period_end
  and coalesce((private.credit_economic_book_route_v1(fact.library_id,fact.organization_id,fact.currency,fact.consumed_at)#>>'{book,id}')::uuid,book.id)=book.id)
 then raise exception'CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
end$$;
revoke all on function private.assert_credit_economic_profit_close_ready_v1(uuid,date,date)from public,anon,authenticated,service_role;
do $$declare definition text;marker text:='perform pg_advisory_xact_lock(hashtextextended(b.id::text||'':''||p_period_start::text||'':''||p_period_end::text,0));';guard text;begin
 select pg_get_functiondef('public.close_franchise_profit_period(uuid,date,date,uuid,timestamp with time zone,text,text,uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception'CREDIT_ECONOMIC_PROFIT_CLOSE_SOURCE_MISMATCH';end if;
 guard:=$guard$
 begin
  -- A committed snapshot must include every writer of these new facts. NOWAIT
  -- avoids a lock-order cycle and leaves the close entirely retryable. Other
  -- legacy financial tables and economic terms remain unchanged.
  lock table public.credit_economic_consumption_facts_v1,public.credit_economic_allocations_v1 in share mode nowait;
 exception when lock_not_available then
  raise exception'CREDIT_ECONOMIC_WRITES_IN_PROGRESS_RETRY_REQUIRED'using errcode='55P03';
 end;
 perform private.assert_credit_economic_profit_close_ready_v1(b.id,p_period_start,p_period_end);
 $guard$;
 execute replace(definition,marker,marker||chr(10)||guard);
end$$;
commit;
