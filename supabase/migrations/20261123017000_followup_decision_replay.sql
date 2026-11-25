begin;

-- Preserve the established request hash, receipts, ACL and independent-review guard.
-- A completed command is replayed before checking mutable policy status.
do $migration$
declare definition text; changed text;
begin
  select pg_get_functiondef('public.decide_franchise_followup_policy(uuid,text,text,text,uuid)'::regprocedure) into definition;
  if position('if p.status <> ''PENDING_APPROVAL'' or p_decision not in' in definition)=0
    or position('if r is not null then return r; end if;' in definition)=0 then
    raise exception 'FOLLOWUP_DECISION_REPLAY_SOURCE_CHANGED';
  end if;
  changed:=replace(definition,'if p.status <> ''PENDING_APPROVAL'' or p_decision not in','if p_decision not in');
  changed:=replace(changed,'if r is not null then return r; end if;',
    'if r is not null then return r; end if;
  if p.status <> ''PENDING_APPROVAL'' then
    raise exception ''INVALID_FRANCHISE_FOLLOWUP_POLICY_DECISION'' using errcode = ''22023'';
  end if;');
  execute changed;
end $migration$;

notify pgrst,'reload schema';
commit;
