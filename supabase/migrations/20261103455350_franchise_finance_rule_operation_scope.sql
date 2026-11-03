begin;
-- Type codes are uppercase business data, whereas the existing command registry
-- requires a lowercase operation scope. No registry constraint is relaxed.
do $$declare definition text;needle text:='''franchise.rule.create.''||p_franchise_type';occurrences integer;begin
 definition:=pg_get_functiondef('public.create_franchise_finance_rule(uuid,text,text,boolean,integer,integer,integer,jsonb,date,date,text,text,uuid)'::regprocedure);
 occurrences:=(length(definition)-length(replace(definition,needle,'')))/length(needle);
 if occurrences<>2 then raise exception'FRANCHISE_FINANCE_RULE_SCOPE_SOURCE_CHANGED: %',occurrences;end if;
 execute replace(definition,needle,'''franchise.rule.create.''||lower(p_franchise_type)');
end$$;
commit;
