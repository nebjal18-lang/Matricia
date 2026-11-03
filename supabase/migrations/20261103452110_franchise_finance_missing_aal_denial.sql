-- Missing or JSON-null AAL must be denied just as AAL1. SQL NULL is never approval.
begin;
do $migration$
declare signature text;definition text;old_guard text:='auth.jwt()->>''aal''<>''aal2''';
begin
 foreach signature in array array[
  'public.create_franchise_finance_rule(uuid,text,text,boolean,integer,integer,integer,jsonb,date,date,text,text,uuid)',
  'public.open_franchise_pnl_book(uuid,uuid,text,text,text,uuid,text,uuid)',
  'public.create_franchise_entry_fee_schedule(uuid,text,bigint,bigint,integer,integer,date,date,jsonb,text,uuid)',
  'public.post_franchise_pnl_entry(uuid,text,text,bigint,uuid,text,text,date,text,uuid,text,uuid)',
  'public.close_franchise_profit_period(uuid,date,date,uuid,timestamptz,text,text,uuid)',
  'public.record_franchise_distribution_payout(uuid,text,bigint,uuid,text,text,text,uuid)'
 ]loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard)<>1 then
   raise exception 'FRANCHISE_FINANCE_AAL_SOURCE_MISMATCH: %',signature;
  end if;
  execute replace(definition,old_guard,'(auth.jwt()->>''aal'')is distinct from''aal2''');
 end loop;
end$migration$;
commit;
