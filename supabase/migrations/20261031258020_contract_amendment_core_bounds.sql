begin;
-- The public legacy ABI remains callable by party writers. Validation belongs
-- in its core as well as in the convenient current-version wrapper.
do $$declare definition text;target text;begin
 select pg_get_functiondef('public.create_contract_amendment(uuid,text,jsonb,bigint,integer,jsonb,jsonb,text,uuid)'::regprocedure)into definition;
 target:='if p_commission_rule_snapshot is distinct from';
 if strpos(definition,target)=0 then raise exception'AMENDMENT_CORE_BOUNDS_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,target,'if p_price_delta_minor is null or p_deadline_delta_days is null or p_deadline_delta_days not between -3650 and 3650 or jsonb_typeof(p_scope_delta)is distinct from''object''or jsonb_typeof(p_deliverables_delta)is distinct from''array''or jsonb_typeof(p_commission_rule_snapshot)is distinct from''object''or not exists(select 1 from public.contract_versions base where base.id=v and base.price_minor::numeric+p_price_delta_minor::numeric between 0 and 9223372036854775807)then raise exception''INVALID_AMENDMENT''using errcode=''22023'';end if;'||target);
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
