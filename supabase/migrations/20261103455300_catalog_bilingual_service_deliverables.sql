begin;
-- Extend only the already-supported deliverables contract. Existing plain text
-- remains plain text; bilingual objects require both supplied catalogue labels.
create function private.is_valid_service_deliverable_v1(p_value jsonb)returns boolean
language sql immutable security definer set search_path=pg_catalog as $$
 select coalesce(case jsonb_typeof(p_value)
  when'string'then length(btrim(p_value#>>'{}'))between 1 and 500
  when'object'then jsonb_typeof(p_value->'label_fr')='string'and jsonb_typeof(p_value->'label_ar')='string'
   and length(btrim(p_value->>'label_fr'))between 1 and 500 and length(btrim(p_value->>'label_ar'))between 1 and 500
   and not exists(select 1 from jsonb_object_keys(p_value)key where key not in('label_fr','label_ar'))
  else false end,false)
$$;
revoke all on function private.is_valid_service_deliverable_v1(jsonb)from public,anon,authenticated,service_role;
-- Keep the function OID, all other schema keys/types, limits, and ACL checks.
do $$declare definition text;anchor text:='and(jsonb_typeof(a)<>''string'' or length(btrim(a#>>''{}'')) not between 1 and 500)';begin
 definition:=pg_get_functiondef('private.is_valid_service_fulfillment_config(jsonb)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'CATALOG_SERVICE_DELIVERABLE_VALIDATOR_SOURCE_MISMATCH';end if;
 execute replace(definition,anchor,'and(case when e.key=''deliverables''then not private.is_valid_service_deliverable_v1(a)else jsonb_typeof(a)<>''string''or length(btrim(a#>>''{}''))not between 1 and 500 end)');
end$$;
commit;
