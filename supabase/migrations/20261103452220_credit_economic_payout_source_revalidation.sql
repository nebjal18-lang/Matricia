begin;
-- Native analytical revenue writers share the franchise book lock with
-- closing/corrections/payouts; close takes its table locks NOWAIT to avoid the
-- historical funding-before-book order becoming a deadlock cycle.
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('private.post_credit_economic_allocation_v1(uuid,uuid,uuid,text,text,bigint,uuid,jsonb,jsonb,date,uuid)'::regprocedure);
 needle:='perform pg_advisory_xact_lock(hashtextextended(''credit-economic-funding:''||f.id::text,0));';
 if strpos(definition,needle)=0 then raise exception'CREDIT_ECONOMIC_ALLOCATION_LOCK_SOURCE_CHANGED';end if;
 execute replace(definition,needle,'perform pg_advisory_xact_lock(hashtextextended(''franchise.pnl.book.''||(p_route#>>''{book,id}''),0));'||needle);
end $migration$;

-- A new payout must still be backed by admissible sources after closing.
-- A historical replay returns before this guard in the public command.
create function private.assert_native_franchise_payout_ready_v1(p_book_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare period record;
begin
 begin
  lock table public.credit_economic_consumption_facts_v1,public.credit_economic_allocations_v1,public.credit_economic_cost_reconciliations_v1,public.credit_economic_cost_attributions_v1,public.credit_pack_payment_adjustments_v1,public.credit_pack_native_resolutions_v1,public.franchise_pnl_entries in share mode nowait;
 exception when lock_not_available then raise exception'CREDIT_ECONOMIC_WRITES_IN_PROGRESS_RETRY_REQUIRED'using errcode='55P03';end;
 for period in select distinct c.period_start,c.period_end from public.franchise_profit_closure_versions c where c.book_id=p_book_id loop
  perform private.assert_credit_economic_profit_close_ready_v1(p_book_id,period.period_start,period.period_end);
 end loop;
end$$;
revoke all on function private.assert_native_franchise_payout_ready_v1(uuid)from public,anon,authenticated,service_role;
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.record_franchise_distribution_payout(uuid,text,bigint,uuid,text,text,text,uuid)'::regprocedure);
 needle:='perform pg_advisory_xact_lock(hashtextextended(b.id::text||'':''||p_beneficiary_code,0));';
 if strpos(definition,needle)=0 then raise exception'CREDIT_ECONOMIC_PAYOUT_SOURCE_CHANGED';end if;
 execute replace(definition,needle,needle||'perform private.assert_native_franchise_payout_ready_v1(b.id);');
end $migration$;

notify pgrst,'reload schema';
commit;
