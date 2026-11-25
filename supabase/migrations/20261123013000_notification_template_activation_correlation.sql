begin;

-- An activation and its audit receipt are one command, including on replay.
do $migration$
declare
  definition text := pg_get_functiondef('public.decide_notification_template_pair_v1(uuid,text,boolean,boolean,text,text)'::regprocedure);
  declaration constant text := 'activated boolean:=false;';
begin
  if definition not like '%' || declaration || '%'
    or (length(definition)-length(replace(definition,'extensions.gen_random_uuid()','')))/length('extensions.gen_random_uuid()') <> 2 then
    raise exception 'NOTIFICATION_TEMPLATE_CORRELATION_SOURCE_MISMATCH';
  end if;
  definition := replace(definition,'extensions.gen_random_uuid()','command_correlation');
  definition := replace(definition,declaration,declaration || 'command_correlation uuid:=extensions.gen_random_uuid();');
  execute definition;
end
$migration$;

notify pgrst,'reload schema';
commit;
