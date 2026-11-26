begin;

-- Keep the published fact shape/hash and historical rows unchanged. Command
-- identity covers caller input, not the policy selected at execution time.
do $migration$
declare
 definition text:=pg_get_functiondef('public.record_prefill_fact(uuid,text,text,uuid,jsonb,text,timestamptz,text,uuid)'::regprocedure);
 marker text:='select*into policy from public.prefill_policy_versions';
 guard text:=$guard$
 if p_correlation_id is null or p_data_key is null or p_source_type is null or p_sensitivity is null or p_observed_at is null then
  raise exception 'INVALID_PREFILL_FACT' using errcode='22023';
 end if;
 h:=private.canonical_request_hash(jsonb_build_object('operation','prefill.fact.record.v1','org',p_organization_id,'key',p_data_key,'source',p_source_type,'reference',p_source_reference_id,'value',p_value,'sensitivity',p_sensitivity,'observed',p_observed_at));
 r:=private.begin_contract_command(p_organization_id,'prefill.fact.record',p_idempotency_key,h,a);
 if r is not null then return r;end if;
 -- Former versions stored their receipt only in the outbox. Replay a unique
 -- matching receipt, but fail closed on ambiguous historical duplicate keys.
 select count(*) into legacy_count from public.event_outbox where organization_id=p_organization_id and event_type='PrefillFactVersionRecordedV1' and idempotency_key=p_idempotency_key;
 if legacy_count>1 then raise exception 'PREFILL_LEGACY_COMMAND_AMBIGUOUS' using errcode='55000';end if;
 if legacy_count=1 then
  select payload into r from public.event_outbox where organization_id=p_organization_id and event_type='PrefillFactVersionRecordedV1' and idempotency_key=p_idempotency_key;
  select content_hash into legacy_hash from public.prefill_fact_versions where id=(r->>'fact_version_id')::uuid and organization_id=p_organization_id;
  if legacy_hash is null or legacy_hash<>private.canonical_request_hash(jsonb_build_object('org',p_organization_id,'key',p_data_key,'source',p_source_type,'reference',p_source_reference_id,'value',p_value,'sensitivity',p_sensitivity,'observed',p_observed_at,'policy',(r->>'policy_version_id')::uuid)) then
   raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH' using errcode='22000';
  end if;
  perform private.finish_contract_command(p_organization_id,'prefill.fact.record',p_idempotency_key,r);
  return r;
 end if;
 -- Serialize versions of the same fact, including different command keys.
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':prefill.fact:'||p_source_type||':'||p_data_key,0));
 select*into policy from public.prefill_policy_versions
 $guard$;
begin
 if (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1
   or position('h text;x uuid;r jsonb;' in definition)=0
   or position('p_idempotency_key);return r;' in definition)=0 then
  raise exception 'PREFILL_COMMAND_DEFINITION_DRIFT';
 end if;
 definition:=replace(definition,'h text;x uuid;r jsonb;','h text;x uuid;r jsonb;legacy_count bigint;legacy_hash text;');
 definition:=replace(definition,marker,guard);
 definition:=replace(definition,'p_idempotency_key);return r;', 'p_idempotency_key);perform private.finish_contract_command(p_organization_id,''prefill.fact.record'',p_idempotency_key,r);return r;');
 execute definition;
end
$migration$;

notify pgrst,'reload schema';
commit;
