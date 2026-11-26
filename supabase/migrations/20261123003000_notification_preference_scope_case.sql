-- Category codes remain canonical uppercase; operation scopes require lowercase.
-- Preserve the command body, ACLs and idempotent begin/finish pairing.
do $migration$
declare
  definition text := pg_get_functiondef('public.set_notification_preference(uuid,text,text,text,text,text,integer,text,uuid)'::regprocedure);
  before_text text := $scope$'notification.preference.set.'||p_category_code||'.'||lower(p_channel)$scope$;
  after_text text := $scope$'notification.preference.set.'||lower(p_category_code)||'.'||lower(p_channel)$scope$;
begin
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text) <> 2 then
    raise exception 'NOTIFICATION_PREFERENCE_SCOPE_PATCH_TARGET_MISMATCH';
  end if;
  execute replace(definition,before_text,after_text);
end
$migration$;
notify pgrst, 'reload schema';
