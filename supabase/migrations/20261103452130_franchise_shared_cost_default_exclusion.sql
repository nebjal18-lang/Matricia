-- Gold Master: shared central costs are excluded without explicit approved,
-- versioned contractual allocation terms. A generic cost label is not that proof.
begin;
do $migration$
declare definition text;anchor text:='if p_effect_type in(''REVERSAL_REVENUE'',''REVERSAL_COST'')then';
begin
 definition:=pg_get_functiondef('public.post_franchise_pnl_entry(uuid,text,text,bigint,uuid,text,text,date,text,uuid,text,uuid)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'FRANCHISE_SHARED_COST_SOURCE_MISMATCH';end if;
 definition:=replace(definition,anchor,$guard$
 -- Correcting an existing record may undo its actual historical category;
 -- a new shared-central deduction cannot be justified by a freely supplied label.
 if p_effect_type='COST'and(p_category='APPROVED_SHARED_CENTRAL_COST'or j.journal_type~*'(SHARED|CENTRAL)')then
  raise exception 'FRANCHISE_SHARED_CENTRAL_COST_POLICY_REQUIRED'using errcode='55000';
 end if;
 if(p_effect_type in('REVENUE','REVERSAL_REVENUE'))is distinct from(p_category='COLLECTED_NET_REVENUE')then
  raise exception 'FRANCHISE_PNL_CATEGORY_EFFECT_MISMATCH'using errcode='22023';
 end if;
 if p_effect_type in('REVERSAL_REVENUE','REVERSAL_COST')then
 $guard$);
 execute definition;
end$migration$;
commit;
