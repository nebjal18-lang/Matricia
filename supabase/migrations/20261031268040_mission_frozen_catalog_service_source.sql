-- Canonical contracts freeze request-version JSON, with service provenance in
-- required_quote_data. Resolve that signed source without changing its bytes.
begin;
create function private.contract_service_version_for_mission_v1(p_contract_version_id uuid)
returns uuid language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare cv public.contract_versions%rowtype;c public.contracts%rowtype;qv public.quote_versions%rowtype;
 q public.quotes%rowtype;rfq public.rfqs%rowtype;r public.service_requests%rowtype;rv public.service_request_versions%rowtype;
 origin public.service_request_tax_origins_v1%rowtype;sv public.catalog_service_versions%rowtype;
 root_ref text;nested_ref text;request_ref text;source_id uuid;value text;
begin
 select*into cv from public.contract_versions where id=p_contract_version_id;
 select*into c from public.contracts where id=cv.contract_id;
 select*into qv from public.quote_versions where id=cv.selected_quote_version_id;
 select*into q from public.quotes where id=qv.quote_id;
 select*into rfq from public.rfqs where id=q.rfq_id;
 select*into r from public.service_requests where id=rfq.request_id;
 select*into rv from public.service_request_versions where id=rfq.request_version_id and request_id=r.id;
 if cv.id is null or c.id is null or qv.id is null or q.id is null or rfq.id is null or r.id is null or rv.id is null
  or c.client_organization_id is distinct from r.client_organization_id
  or c.provider_organization_id is distinct from q.provider_organization_id
  or c.provider_organization_id is distinct from qv.provider_organization_id
  or rv.client_organization_id is distinct from r.client_organization_id or rv.library_id is distinct from r.library_id then
  raise exception'CONTRACT_SERVICE_SOURCE_INCOHERENT'using errcode='22023';
 end if;
 root_ref:=cv.request_snapshot->>'service_version_id';
 nested_ref:=cv.request_snapshot#>>'{required_quote_data,service_version_id}';
 request_ref:=rv.required_quote_data->>'service_version_id';
 if root_ref is null and nested_ref is null then raise exception'MISSION_SERVICE_VERSION_SNAPSHOT_REQUIRED'using errcode='22023';end if;
 foreach value in array array[root_ref,nested_ref,request_ref]loop
  if value is not null then
   if value!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'then raise exception'CONTRACT_SERVICE_SOURCE_INCOHERENT'using errcode='22023';end if;
   if source_id is not null and source_id is distinct from value::uuid then raise exception'CONTRACT_SERVICE_SOURCE_DIVERGENCE'using errcode='22023';end if;
   source_id:=value::uuid;
  end if;
 end loop;
 -- The nested shape is accepted only when it is the immutable RFQ request's
 -- actual JSON. It is not a second caller-supplied way to choose a catalogue.
 if nested_ref is not null and(cv.request_snapshot->'required_quote_data'is distinct from rv.required_quote_data
  or cv.request_snapshot->>'catalog_snapshot_hash'is distinct from rv.catalog_snapshot_hash)then
  raise exception'CONTRACT_SERVICE_SOURCE_INCOHERENT'using errcode='22023';
 end if;
 if(cv.request_snapshot?'request_id'and lower(cv.request_snapshot->>'request_id')is distinct from r.id::text)
  or(cv.request_snapshot?'request_version_id'and lower(cv.request_snapshot->>'request_version_id')is distinct from rv.id::text)
  or(cv.request_snapshot?'catalog_snapshot_hash'and cv.request_snapshot->>'catalog_snapshot_hash'is distinct from rv.catalog_snapshot_hash)then
  raise exception'CONTRACT_SERVICE_SOURCE_INCOHERENT'using errcode='22023';
 end if;
 select*into sv from public.catalog_service_versions where id=source_id;
 if sv.id is null or sv.service_id is distinct from r.service_id or sv.library_id is distinct from r.library_id
  or sv.content_hash is distinct from rv.catalog_snapshot_hash or sv.published_at is null or sv.status not in('PUBLISHED','RETIRED')then
  raise exception'CONTRACT_SERVICE_SOURCE_INCOHERENT'using errcode='22023';
 end if;
 select*into origin from public.service_request_tax_origins_v1 where request_id=r.id;
 if found and(origin.organization_id is distinct from r.client_organization_id or origin.service_version_id is distinct from sv.id
  or origin.service_content_hash is distinct from sv.content_hash)then raise exception'CONTRACT_SERVICE_SOURCE_DIVERGENCE'using errcode='22023';end if;
 return sv.id;
end$$;
revoke all on function private.contract_service_version_for_mission_v1(uuid)from public,anon,authenticated,service_role;

create function private.contract_mission_checklist_template_v1(p_contract_version_id uuid)
returns uuid language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare service_version uuid;ids uuid[];template public.service_checklist_templates%rowtype;
begin
 service_version:=private.contract_service_version_for_mission_v1(p_contract_version_id);
 select array_agg(id order by id)into ids from public.service_checklist_templates
 where service_version_id=service_version and publication_status='PUBLISHED'and published_at is not null and published_by is not null
  and version=(select max(p.version)from public.service_checklist_templates p where p.service_version_id=service_version and p.publication_status='PUBLISHED'and p.published_at is not null and p.published_by is not null);
 if cardinality(ids)>1 then raise exception'MISSION_CHECKLIST_TEMPLATE_AMBIGUOUS'using errcode='55000';end if;
 if cardinality(ids)is distinct from 1 then raise exception'MISSION_CHECKLIST_TEMPLATE_REQUIRED'using errcode='22023';end if;
 select*into template from public.service_checklist_templates where id=ids[1];
 if not private.valid_published_checklist_items_v1(template.items)then raise exception'MISSION_CHECKLIST_TEMPLATE_REQUIRED'using errcode='22023';end if;
 return template.id;
end$$;
revoke all on function private.contract_mission_checklist_template_v1(uuid)from public,anon,authenticated,service_role;

-- Preserve the existing function OID, authorization, signature guards, mission
-- idempotency, snapshot creation, audit and outbox. Replace only the lookup.
do $$declare definition text;start_at integer;end_at integer;old_query text;
begin
 definition:=pg_get_functiondef('public.create_mission_legacy_0191(uuid,uuid,jsonb,jsonb,jsonb,text,uuid)'::regprocedure);
 start_at:=position('  select t.* into v_template'in definition);
 end_at:=position('  if v_template.id is null'in definition);
 if start_at=0 or end_at<=start_at then raise exception'MISSION_FROZEN_SOURCE_PATCH_MISMATCH';end if;
 old_query:=substring(definition from start_at for end_at-start_at);
 definition:=replace(definition,old_query,'  select t.* into v_template from public.service_checklist_templates t'||chr(10)||
  '  where t.id=private.contract_mission_checklist_template_v1(p_contract_version_id);'||chr(10)||chr(10));
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
