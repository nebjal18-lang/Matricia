begin;
-- A verified adverse receipt is authoritative before asynchronous domain import.
-- The funding guard already reads it. Include its writers in the same NOWAIT
-- source snapshot boundary for closing and every new payout.
do $migration$
declare signature text;definition text;needle text:='public.franchise_pnl_entries in share mode nowait;';replacement text;
begin
 foreach signature in array array[
  'public.close_franchise_profit_period(uuid,date,date,uuid,timestamp with time zone,text,text,uuid)',
  'private.assert_native_franchise_payout_ready_v1(uuid)'
 ]loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if(length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception'CREDIT_ECONOMIC_INBOX_LOCK_SOURCE_CHANGED: %',signature;end if;
  replacement:='public.franchise_pnl_entries,private.verified_payment_dispatch_inbox_v1';
  if strpos(definition,'public.credit_pack_payment_adjustments_v1')=0 then replacement:=replacement||',public.credit_pack_payment_adjustments_v1,public.credit_pack_native_resolutions_v1';end if;
  execute replace(definition,needle,replacement||' in share mode nowait;');
 end loop;
end $migration$;
commit;
