begin;
-- The public legacy P&L classifier and the canonical cost approval consume the
-- same immutable expense journal. Serialize their claim before admitting it.
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.decide_credit_economic_cost_v1(uuid,text,boolean,text)'::regprocedure);
 needle:='source:=private.credit_economic_cost_source_v1(p.component,p.target_id,p.financial_journal_id);';
 if strpos(definition,needle)=0 then raise exception'CREDIT_ECONOMIC_COST_JOURNAL_LOCK_SOURCE_CHANGED';end if;
 execute replace(definition,needle,'perform pg_advisory_xact_lock(hashtextextended(''franchise.pnl.journal.''||p.financial_journal_id::text,0));'||needle);
end $migration$;
commit;
