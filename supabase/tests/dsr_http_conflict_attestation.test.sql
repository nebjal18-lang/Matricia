begin;
set local search_path=public,extensions;
select plan(6);
select is((select count(*) from private.dsr_restriction_consumer_http_attestation_v1), 1::bigint,
  'only the reviewed notification transport receives a new attestation');
select ok(private.dsr_restriction_consumer_proof_v1('MARKETING')->>'ready'='true',
  'all installed restriction guards remain ready after the HTTP correction');
select ok(not has_table_privilege('authenticated','private.dsr_restriction_consumer_http_attestation_v1','SELECT')
  and not has_table_privilege('service_role','private.dsr_restriction_consumer_effective_guards_v1','SELECT'),
  'API roles cannot inspect private attestation evidence');
select ok(exists(select 1 from private.dsr_restriction_consumer_http_attestation_v1 a
  join private.dsr_restriction_consumer_guards_v1 g using(function_signature)
  where a.previous_source_hash=g.source_hash and a.source_hash<>g.source_hash),
  'original immutable evidence is retained alongside the reviewed source hash');
create temporary table original_http_guard as
  select pg_get_functiondef('public.authorize_notification_delivery_send_v1(uuid,uuid,text,uuid)'::regprocedure) definition;
do $$
declare definition text := (select g.definition from original_http_guard g);
begin
  -- Semantically harmless source drift still requires a fresh independent review.
  execute replace(definition, '$function$', E'$function$\n-- unreviewed source drift\n');
end $$;
select is(private.dsr_restriction_consumer_proof_v1('MARKETING'),null::jsonb,
  'unreviewed drift in the newly attested function fails closed');
do $$begin execute (select definition from original_http_guard); end$$;
select ok(private.dsr_restriction_consumer_proof_v1('MARKETING')->>'ready'='true',
  'restoring the exact reviewed definition restores readiness');
select * from finish();
rollback;
