begin;
-- Measurement evidence is read by scoped Client actors or by the existing
-- second-factor financial/compliance review authority. It grants no portfolio
-- mutation permission and does not replace independent decision checks.
create function private.client_measurement_read_v1(p_organization_id uuid)returns boolean
language sql stable security definer set search_path=pg_catalog,private as $$
 select auth.uid()is not null and p_organization_id is not null
 and exists(select 1 from public.organizations where id=p_organization_id)
 and(coalesce(private.client_portfolio_read(p_organization_id,auth.uid()),false)
 or coalesce(private.rewards_sensitive_aal2(auth.uid()),false))
$$;
revoke all on function private.client_measurement_read_v1(uuid)from public,anon,authenticated,service_role;

do $review_access$
declare signature regprocedure;definition text;needle text:='coalesce(private.client_portfolio_read(p_organization_id,auth.uid()),false)';
begin
 foreach signature in array array['public.list_client_measurement_context_v1(uuid)'::regprocedure,'private.client_measurement_evidence_v1(uuid,uuid)'::regprocedure]loop
  definition:=pg_get_functiondef(signature);
  if(length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception'CLIENT_MEASUREMENT_REVIEW_ACCESS_SOURCE_MISMATCH';end if;
  execute replace(definition,needle,'private.client_measurement_read_v1(p_organization_id)');
 end loop;
end $review_access$;
notify pgrst,'reload schema';
commit;
