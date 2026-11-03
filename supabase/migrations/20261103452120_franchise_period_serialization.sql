-- One book-wide lock serializes classifications, all close intervals and payouts.
-- A correction may version the exact same period; a second overlapping period
-- must never accrue the same profit twice. Existing history is never rewritten.
begin;
do $migration$
declare signature text;definition text;anchor text;operation text;
begin
 foreach operation in array array['POST','CLOSE','PAYOUT']loop
  signature:=case operation when'POST'then'public.post_franchise_pnl_entry(uuid,text,text,bigint,uuid,text,text,date,text,uuid,text,uuid)'when'CLOSE'then'public.close_franchise_profit_period(uuid,date,date,uuid,timestamptz,text,text,uuid)'else'public.record_franchise_distribution_payout(uuid,text,bigint,uuid,text,text,text,uuid)'end;
  definition:=pg_get_functiondef(signature::regprocedure);
  anchor:='then raise exception ''FRANCHISE_'||case operation when'POST'then'PNL_POST'else operation end||'_DENIED''using errcode=''42501'';end if;';
  if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'FRANCHISE_BOOK_LOCK_SOURCE_MISMATCH: %',operation;end if;
  definition:=replace(definition,anchor,anchor||chr(10)||'perform pg_advisory_xact_lock(hashtextextended(''franchise.pnl.book.''||b.id::text,0));');
  if operation='CLOSE'then
   anchor:='insert into public.franchise_profit_closure_versions';
   if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'FRANCHISE_PERIOD_OVERLAP_SOURCE_MISMATCH';end if;
   definition:=replace(definition,anchor,$guard$
    if exists(select 1 from public.franchise_profit_closure_versions existing where existing.book_id=b.id and existing.period_start<=p_period_end and existing.period_end>=p_period_start and(existing.period_start,existing.period_end)is distinct from(p_period_start,p_period_end))then raise exception 'FRANCHISE_OVERLAPPING_PERIOD_REVIEW_REQUIRED'using errcode='23514';end if;
    insert into public.franchise_profit_closure_versions
   $guard$);
  end if;
  execute definition;
 end loop;
end$migration$;
commit;
