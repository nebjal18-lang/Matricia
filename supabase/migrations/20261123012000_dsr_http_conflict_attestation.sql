begin;

-- Preserve the immutable original evidence and attest only the reviewed HTTP
-- conflict change. Any other function drift must still fail closed.
create table private.dsr_restriction_consumer_http_attestation_v1 (
  function_signature text primary key,
  previous_source_hash text not null,
  source_hash text not null,
  check (previous_source_hash ~ '^[a-f0-9]{64}$'),
  check (source_hash ~ '^[a-f0-9]{64}$')
);
revoke all on private.dsr_restriction_consumer_http_attestation_v1 from public, anon, authenticated, service_role;
create trigger dsr_restriction_consumer_http_attestation_immutable
  before update or delete on private.dsr_restriction_consumer_http_attestation_v1
  for each row execute function private.prevent_update_delete();

do $migration$
declare
  signature constant text := 'public.authorize_notification_delivery_send_v1(uuid,uuid,text,uuid)';
  definition text := pg_get_functiondef(signature::regprocedure);
  original_hash text;
  original_definition text;
  pattern constant text := $pattern$(raise\s+exception\s*'[A-Z0-9_]+'\s*using\s+errcode\s*=\s*)'PT409'$pattern$;
begin
  select source_hash into strict original_hash
  from private.dsr_restriction_consumer_guards_v1
  where function_signature = signature;
  if (select count(*) from regexp_matches(definition, pattern, 'gi')) <> 1 then
    raise exception 'DSR_HTTP_ATTESTATION_CHANGE_COUNT_MISMATCH';
  end if;
  original_definition := regexp_replace(definition, pattern, $replacement$\1'40001'$replacement$, 'gi');
  if encode(extensions.digest(convert_to(original_definition, 'UTF8'), 'sha256'), 'hex') <> original_hash then
    raise exception 'DSR_HTTP_ATTESTATION_UNREVIEWED_SOURCE_DRIFT';
  end if;
  insert into private.dsr_restriction_consumer_http_attestation_v1
  values (signature, original_hash, encode(extensions.digest(convert_to(definition, 'UTF8'), 'sha256'), 'hex'));
end
$migration$;

create view private.dsr_restriction_consumer_effective_guards_v1 as
select g.guard_type, g.function_signature, coalesce(a.source_hash, g.source_hash) as source_hash,
  g.scope, g.subject_field, g.organization_field
from private.dsr_restriction_consumer_guards_v1 g
left join private.dsr_restriction_consumer_http_attestation_v1 a
  on a.function_signature = g.function_signature and a.previous_source_hash = g.source_hash;
revoke all on private.dsr_restriction_consumer_effective_guards_v1 from public, anon, authenticated, service_role;

do $migration$
declare
  definition text := pg_get_functiondef('private.dsr_restriction_consumer_proof_v1(text)'::regprocedure);
begin
  if definition not like '%private.dsr_restriction_consumer_guards_v1%' then
    raise exception 'DSR_HTTP_ATTESTATION_PROOF_SOURCE_MISMATCH';
  end if;
  execute replace(definition, 'private.dsr_restriction_consumer_guards_v1', 'private.dsr_restriction_consumer_effective_guards_v1');
end
$migration$;

commit;
