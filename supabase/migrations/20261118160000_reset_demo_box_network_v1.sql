-- Reset scoped aux artefacts DEMO_ du réseau Box (jamais hors préfixe DEMO_).
-- À appeler uniquement en development/staging pour repartir propre avant reseed démo.

create or replace function public.reset_demo_box_network_v1()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  actor uuid := auth.uid();
  deleted_commitments integer := 0;
  deleted_agreements integer := 0;
begin
  if actor is null or not private.credits_admin_access(actor) then
    raise exception 'DEMO_BOX_RESET_DENIED' using errcode = '42501';
  end if;
  if auth.jwt()->>'aal' is distinct from 'aal2' then
    raise exception 'DEMO_BOX_RESET_AAL2_REQUIRED' using errcode = '42501';
  end if;

  delete from public.provider_capacity_commitments c
  using public.framework_agreements a
  where c.agreement_id = a.id
    and a.agreement_code like 'DEMO\_%' escape '\';
  get diagnostics deleted_commitments = row_count;

  delete from public.framework_agreement_versions v
  using public.framework_agreements a
  where v.agreement_id = a.id
    and a.agreement_code like 'DEMO\_%' escape '\';

  delete from public.framework_agreements
  where agreement_code like 'DEMO\_%' escape '\';
  get diagnostics deleted_agreements = row_count;

  -- SKU purement démo (codes DEMO_* uniquement — jamais les SKU métier hors préfixe)
  delete from public.service_skus
  where code like 'DEMO\_%' escape '\';

  return jsonb_build_object(
    'outcome', 'DEMO_BOX_NETWORK_RESET',
    'deleted_commitments', deleted_commitments,
    'deleted_agreements', deleted_agreements
  );
end
$$;

revoke all on function public.reset_demo_box_network_v1() from public, anon, authenticated, service_role;
grant execute on function public.reset_demo_box_network_v1() to authenticated;
