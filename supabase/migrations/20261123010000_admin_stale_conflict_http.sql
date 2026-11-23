-- A stale form is a deterministic HTTP conflict, not a serialization failure.
-- PostgREST 14 retries 40001 indefinitely. Preserve authorization, CAS, history,
-- idempotency and ACLs; change only the three explicit business exceptions.
do $migration$
declare
  target record;
  definition text;
  original text;
begin
  for target in select * from (values
    ('public.claim_admin_work_item(uuid,integer,text,text,uuid)', 'STALE_ADMIN_WORK_ITEM'),
    ('public.resolve_admin_work_item(uuid,text,text,jsonb,integer,text,uuid)', 'STALE_ADMIN_WORK_ITEM'),
    ('public.decide_admin_operational_action(uuid,text,text,integer,text,uuid)', 'STALE_ADMIN_ACTION_REQUEST')
  ) as targets(signature, message)
  loop
    definition := pg_get_functiondef(target.signature::regprocedure);
    original := format('raise exception%Lusing errcode=''40001''', target.message);
    if (length(definition)-length(replace(definition,original,'')))/length(original) <> 1 then
      raise exception 'ADMIN_STALE_CONFLICT_PATCH_TARGET_MISMATCH';
    end if;
    execute replace(definition, original, format('raise exception%Lusing errcode=''PT409''', target.message));
  end loop;
end
$migration$;
notify pgrst, 'reload schema';
