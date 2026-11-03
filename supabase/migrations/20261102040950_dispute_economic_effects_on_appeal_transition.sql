begin;
-- An admissible appeal may overturn an earlier non-punitive finding. Apply the
-- canonical effects on that transition once, retaining all earlier decisions.
do $migration$
declare definition text;needle text:='if p_outcome=''NON_COMPLIANT_CONFIRMED''and prior.id is null then';
begin
 definition:=pg_get_functiondef('public.decide_mission_dispute(uuid,text,text,uuid[],jsonb,text,uuid)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception'DISPUTE_APPEAL_EFFECTS_PATCH_MISSING';end if;
 execute replace(definition,needle,'if p_outcome=''NON_COMPLIANT_CONFIRMED''and(prior.id is null or prior.outcome is distinct from''NON_COMPLIANT_CONFIRMED'')then');
end $migration$;
notify pgrst,'reload schema';
commit;
