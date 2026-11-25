begin;
-- Simulation is a read-only editorial operation. A library mandate and its
-- active catalogue policy are sufficient; a central platform role is not
-- additionally required. Respondent visibility alone never grants this right.
create or replace function private.can_execute_questionnaire_rule_engine(
  p_library_id uuid,
  p_actor_id uuid default auth.uid()
) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select p_actor_id is not null
    and auth.jwt()->>'aal'='aal2'
    and private.has_library_permission(p_library_id,'CATALOG_VIEW_DRAFT',p_actor_id)
$$;
revoke all on function private.can_execute_questionnaire_rule_engine(uuid,uuid)
from public,anon,authenticated,service_role;
commit;
