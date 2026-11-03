begin;
create function private.dsr_all_redact_security_json_v1(p_schema text,p_table text,p_value jsonb)returns jsonb language plpgsql immutable set search_path=pg_catalog,private as $$
declare result jsonb;entry record;begin
 case jsonb_typeof(p_value)
 when'object'then result:='{}';for entry in select*from jsonb_each(p_value)loop if private.dsr_all_business_identifier_v1(p_schema,p_table,entry.key)or entry.key!~*'(password|encrypted|secret|token|credential|authorization|api_?key|private_?key|hmac|access_key|ciphertext|(^|_)key($|_)|nonce|auth_code|code_verifier)'then result:=result||jsonb_build_object(entry.key,private.dsr_all_redact_security_json_v1(p_schema,p_table,entry.value));end if;end loop;
 when'array'then select coalesce(jsonb_agg(private.dsr_all_redact_security_json_v1(p_schema,p_table,value)order by n),'[]')into result from jsonb_array_elements(p_value)with ordinality e(value,n);
 else result:=p_value;end case;return result;
end$$;
revoke all on function private.dsr_all_redact_security_json_v1(text,text,jsonb)from public,anon,authenticated,service_role;
create function private.dsr_all_external_processing_sources_v1(p_request_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare org uuid;controller uuid;ready boolean:=false;entries jsonb;begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 select organization_id into org from public.data_subject_requests where id=p_request_id;select controller_organization_id into controller from private.platform_privacy_deployment_scope_v1 where singleton;
 if controller is not null then begin ready:=private.assert_privacy_registry_ready_v1(controller);exception when sqlstate'55000'then ready:=false;end;end if;
 select coalesce(jsonb_agg(value||jsonb_build_object('source_hash',private.canonical_request_hash(value))order by value->>'source_key'),'[]')into entries from(
 select jsonb_build_object('source_key','PROCESSOR:'||p.id::text,'kind','PROCESSOR','name',p.legal_name,'provider_key',p.provider_key,'services',p.services,'regions',p.processing_regions,'status',p.status,'registered_at',p.created_at,'updated_at',p.updated_at)value from public.processors p where p.organization_id in(org,controller)
 union all select jsonb_build_object('source_key','SUBPROCESSOR:'||p.id::text,'kind','SUBPROCESSOR','name',p.legal_name,'service_purpose',p.service_purpose,'regions',p.countries_regions,'status',p.authorization_status,'effective_from',p.effective_from,'effective_until',p.effective_until)value from public.subprocessor_register p where p.organization_id in(org,controller)
 union all select jsonb_build_object('source_key','SYSTEM:'||a.id::text||':'||system,'kind','SYSTEM','name',system,'activity_id',a.id,'status',a.status,'registered_at',a.created_at,'updated_at',a.updated_at)value from public.processing_activities a cross join lateral unnest(a.systems)system where a.organization_id in(org,controller))registered;
 return jsonb_build_object('configured',controller is not null and coalesce(ready,false),'controller_organization_id',controller,'entries',entries,'hash',private.canonical_request_hash(entries));
end$$;
revoke all on function private.dsr_all_external_processing_sources_v1(uuid)from public,anon,authenticated,service_role;
-- One STABLE invocation fixes the MVCC read cut for every source. The caller
-- persists only the resulting immutable snapshot, never live queries later.
create function private.dsr_all_build_snapshot_v1(p_request_id uuid,p_inventory_version_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare d public.data_subject_requests%rowtype;inventory public.dsr_all_inventory_versions_v1%rowtype;subject_value uuid;item jsonb;source jsonb;config_value jsonb;col jsonb;path jsonb;source_records jsonb;financial jsonb;file_sources jsonb;external_sources jsonb;external_slots jsonb;all_sources jsonb:='[]';source_hash text;subject_sql text;org_sql text;projection_sql text;field_name text;expression_sql text;n integer;total_rows bigint:=0;begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 select*into d from public.data_subject_requests where id=p_request_id;subject_value:=private.dsr_account_subject_v1(d.id);
 select*into inventory from public.dsr_all_inventory_versions_v1 where id=p_inventory_version_id;
 if d.id is null or d.status<>'IN_REVIEW'or d.verified_at is null or d.request_type not in('ACCESS','PORTABILITY')or subject_value is null then raise exception'DSR_VERIFIED_SUBJECT_REQUIRED'using errcode='42501';end if;
 if inventory.id is null or not exists(select 1 from public.dsr_all_inventory_decisions_v1 where inventory_version_id=inventory.id and decision='APPROVE'and content_hash=inventory.content_hash and decided_by<>inventory.created_by)then raise exception'DSR_ALL_APPROVED_INVENTORY_REQUIRED'using errcode='55000';end if;
 if inventory.catalog_hash is distinct from private.canonical_request_hash(private.dsr_all_catalog_v1())then raise exception'STALE_DSR_TECHNICAL_INVENTORY'using errcode='40001';end if;
 for item in select value from jsonb_array_elements(inventory.inventory_json)loop
  source:=item->'source';config_value:=item->'config';perform private.dsr_all_validate_config_v1(source,config_value);
  if config_value->>'mode'='EXCLUDE'then
   all_sources:=all_sources||jsonb_build_array(jsonb_build_object('source_key',source->>'key','status','EXCLUDED_BY_REVIEWED_POLICY','fields',source->'columns','exclusions',config_value->'excluded_fields','legal_reference',config_value->>'legal_reference','reason',config_value->>'reason','config_hash',private.canonical_request_hash(config_value),'records','[]'::jsonb));continue;
  end if;
  if source->>'key'='@subject_financial_records_v1'then
   financial:=private.dsr_subject_financial_records_v1(d.id);
   if financial->>'format'is distinct from'MATRICIA_SUBJECT_FINANCIAL_RECORDS_V1'or jsonb_typeof(financial->'records')is distinct from'array'then raise exception'DSR_FINANCIAL_ASSEMBLER_CONTRACT_CHANGED'using errcode='55000';end if;
   if exists(select 1 from jsonb_array_elements(financial->'records')r,jsonb_object_keys(r)k where not exists(select 1 from jsonb_array_elements(source->'columns')c where c->>'name'=k))then raise exception'DSR_FINANCIAL_ASSEMBLER_FIELDS_CHANGED'using errcode='55000';end if;
   select coalesce(jsonb_agg(jsonb_build_object('record_hash',private.canonical_request_hash(jsonb_build_object('position',position,'fields',fields)),'fields',fields)order by position),'[]'::jsonb)into source_records from(select ordinality position,(select coalesce(jsonb_object_agg(key,case when jsonb_typeof(value)='number'then to_jsonb(value::text)else value end),'{}')from jsonb_each(r.value)where(config_value->'fields')?key)fields from jsonb_array_elements(financial->'records')with ordinality r(value,ordinality))selected;
  else
  if config_value->>'subject_path_id'='HASH_REFERENCE'then subject_sql:='t.subject_reference_hash=$3';else select value into path from jsonb_array_elements(source->'subject_paths')where value->>'id'=config_value->>'subject_path_id';subject_sql:=private.dsr_all_path_predicate_v1(path->'steps','t','$1');end if;
  org_sql:='';
  if(config_value->>'account_global')::boolean then org_sql:='true';else
   for path in select value from jsonb_array_elements(source->'organization_paths')where(config_value->'organization_path_ids')?(value->>'id')loop
    org_sql:=org_sql||case when org_sql<>''then' or 'else''end||private.dsr_all_path_predicate_v1(path->'steps','t','$2');
    if(config_value->>'include_null_organization')::boolean then org_sql:=org_sql||format(' or t.%I is null',path#>>'{steps,0,source_columns,0}');end if;
   end loop;
  end if;
  projection_sql:='';
  for field_name in select value from jsonb_array_elements_text(config_value->'fields')loop
   select value into col from jsonb_array_elements(source->'columns')where value->>'name'=field_name;
   if not(col->>'exportable')::boolean then raise exception'DSR_NONEXPORTABLE_SOURCE_FIELD'using errcode='22023';end if;
   if col->>'type'in('int2','int4','int8','numeric','decimal','float4','float8','money')then expression_sql:=format('to_jsonb(t.%I::text)',field_name);
   elsif col->>'type'in('json','jsonb')then expression_sql:=format('private.dsr_all_redact_security_json_v1(%L,%L,to_jsonb(t.%I))',source->>'schema',source->>'table',field_name);
   elsif coalesce((col->>'references_user')::boolean,false)then expression_sql:=format('case when t.%I=$1 then to_jsonb(t.%I)else''null''::jsonb end',field_name,field_name);
   else expression_sql:=format('to_jsonb(t.%I)',field_name);end if;
   projection_sql:=projection_sql||case when projection_sql<>''then','else''end||format('%L,%s',field_name,expression_sql);
  end loop;
  execute format('select coalesce(jsonb_agg(jsonb_build_object(''record_hash'',private.canonical_request_hash(jsonb_build_object(''position'',position,''fields'',record)),''fields'',record)order by position),''[]''::jsonb)from(select record,row_number()over(order by record::text)position from(select jsonb_build_object(%s)record from %I.%I t where(%s)and(%s)limit 20001)selected)numbered',projection_sql,source->>'schema',source->>'table',subject_sql,org_sql)into source_records using subject_value,d.organization_id,d.subject_reference_hash;
  end if;
  n:=jsonb_array_length(source_records);total_rows:=total_rows+n;
  if n>20000 or total_rows>20000 then raise exception'PRIVACY_EXPORT_REQUIRES_BATCH_JOB'using errcode='55000';end if;
  source_hash:=private.canonical_request_hash(jsonb_build_object('source_key',source->>'key','config_hash',private.canonical_request_hash(config_value),'records',source_records));
  all_sources:=all_sources||jsonb_build_array(jsonb_build_object('source_key',source->>'key','status','EXTRACTED','source_hash',source_hash,'config_hash',private.canonical_request_hash(config_value),'included_fields',config_value->'fields','excluded_fields',config_value->'excluded_fields','legal_reference',config_value->>'legal_reference','record_count',n,'records',source_records,'system_redactions',jsonb_build_array('NON_SUBJECT_AUTH_USER_REFERENCES','NESTED_AUTHENTICATION_SECRET_KEYS')));
 end loop;
 if to_regprocedure('private.dsr_all_collect_file_sources_v1(uuid)')is not null then execute'select private.dsr_all_collect_file_sources_v1($1)'into file_sources using d.id;else file_sources:=jsonb_build_object('collector_version',null,'entries','[]'::jsonb,'hash',null,'coverage_complete',false,'reason','FILE_COLLECTOR_REQUIRED');end if;
 external_sources:=private.dsr_all_external_processing_sources_v1(d.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',private.canonical_request_hash(jsonb_build_object('type','EXTERNAL_DSR_EXPORT','source',e->>'source_key')),'source_type','EXTERNAL_DSR_EXPORT','source_id',e->>'source_key','source_hash',e->>'source_hash','bucket',null,'path',null,'sha256',null,'size_bytes',null,'mime_type',null,'file_name',e->>'name','storage_object_id',null,'trust_kind','EXTERNAL_EXPORT_REQUIRED','personal_data_review_required',true,'third_party_review_required',true)order by e->>'source_key'),'[]')into external_slots from jsonb_array_elements(external_sources->'entries')e;
 file_sources:=file_sources||jsonb_build_object('entries',coalesce(file_sources->'entries','[]'::jsonb)||external_slots,'hash',private.canonical_request_hash(coalesce(file_sources->'entries','[]'::jsonb)||external_slots),'coverage_complete',coalesce((file_sources->>'coverage_complete')::boolean,false)and coalesce((external_sources->>'configured')::boolean,false));
 return jsonb_build_object('format','MATRICIA_DSR_ALL_CAPTURE_V1','request_id',d.id,'organization_id',d.organization_id,'subject_user_id',subject_value,'inventory_version_id',inventory.id,'inventory_hash',inventory.content_hash,'catalog_hash',inventory.catalog_hash,'capture_cut_at',statement_timestamp(),'mvcc_cut_hash',private.canonical_request_hash(to_jsonb(pg_current_snapshot()::text)),'source_count',jsonb_array_length(all_sources),'record_count',total_rows,'sources',all_sources,'file_sources',file_sources,'content_review_required',true,'external_processing_review_required',true,'external_processing',external_sources);
end$$;
revoke all on function private.dsr_all_build_snapshot_v1(uuid,uuid)from public,anon,authenticated,service_role;
create function public.capture_admin_dsr_all_v1(p_request_id uuid,p_expected_scope_version_id uuid,p_inventory_version_id uuid,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare correlation_value uuid:=extensions.gen_random_uuid();d public.data_subject_requests%rowtype;s public.dsr_scope_versions_v1%rowtype;p public.dsr_all_packages_v1%rowtype;snapshot_value jsonb;encoded text;sha text;result jsonb;begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 select*into d from public.data_subject_requests where id=p_request_id for update;select*into s from public.dsr_scope_versions_v1 where request_id=d.id order by version desc limit 1;
 if s.id is distinct from p_expected_scope_version_id or s.requested_scopes is distinct from array['ALL']::text[]then raise exception'DSR_ALL_CURRENT_CONFIRMED_SCOPE_REQUIRED'using errcode='40001';end if;
 if p_inventory_version_id is null or length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200 then raise exception'INVALID_DSR_ALL_CAPTURE'using errcode='22023';end if;
 select*into p from public.dsr_all_packages_v1 where request_id=d.id and idempotency_key=p_idempotency_key;
 if p.id is not null then if p.scope_version_id<>s.id or p.inventory_version_id<>p_inventory_version_id then raise exception'IDEMPOTENCY_KEY_REUSED'using errcode='22023';end if;return jsonb_build_object('outcome','DSR_ALL_CAPTURED','package_id',p.id,'source_sha256',p.source_sha256);end if;
 snapshot_value:=private.dsr_all_build_snapshot_v1(d.id,p_inventory_version_id);encoded:=snapshot_value::text;
 if octet_length(convert_to(encoded,'UTF8'))>16777216 then raise exception'PRIVACY_EXPORT_REQUIRES_BATCH_JOB'using errcode='55000';end if;sha:=encode(extensions.digest(convert_to(encoded,'UTF8'),'sha256'),'hex');
 insert into public.dsr_all_packages_v1(request_id,scope_version_id,inventory_version_id,subject_user_id,organization_id,source_sha256,snapshot_json,captured_at,created_by,idempotency_key)values(d.id,s.id,p_inventory_version_id,s.subject_user_id,d.organization_id,sha,encoded,(snapshot_value->>'capture_cut_at')::timestamptz,auth.uid(),p_idempotency_key)returning*into p;
 result:=jsonb_build_object('outcome','DSR_ALL_CAPTURED','package_id',p.id,'source_sha256',sha,'source_count',snapshot_value->'source_count','record_count',snapshot_value->'record_count','complete',false);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','privacy.all.captured','dsr_all_package',p.id::text,correlation_value,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(d.organization_id,'dsr_all_package',p.id::text,'DsrAllCapturedV1',correlation_value,result,'privacy-all-capture:'||p.id::text);return result;
end$$;
-- Object paths support selective redaction without accepting replacement
-- content. Array indexes are rejected because sequential deletion shifts them.
create function private.dsr_all_disclosure_path_v1(p_field text)returns text[]language plpgsql immutable set search_path=pg_catalog as $$
declare path text[];begin
 if p_field is null or length(p_field)not between 1 and 1000 then raise exception'INVALID_DSR_DISCLOSURE_PATH'using errcode='22023';end if;
 if left(p_field,1)<>'/'then return array[p_field];end if;
 if p_field~'~([^01]|$)'then raise exception'INVALID_DSR_DISCLOSURE_PATH'using errcode='22023';end if;
 select array_agg(replace(replace(value,'~1','/'),'~0','~')order by n)into path from unnest(string_to_array(substring(p_field from 2),'/'))with ordinality e(value,n);
 if cardinality(path)not between 1 and 32 or path[1]=''then raise exception'INVALID_DSR_DISCLOSURE_PATH'using errcode='22023';end if;return path;
end$$;
revoke all on function private.dsr_all_disclosure_path_v1(text)from public,anon,authenticated,service_role;
create function private.dsr_all_disclosure_remove_path_v1(p_fields jsonb,p_field text)returns jsonb language plpgsql immutable set search_path=pg_catalog,private as $$
declare path text[]:=private.dsr_all_disclosure_path_v1(p_field);i integer;parent jsonb;begin
 if cardinality(path)>1 then for i in 1..cardinality(path)-1 loop
  parent:=p_fields#>path[1:i];if parent is null then return p_fields;end if;
  if jsonb_typeof(parent)='array'then raise exception'DSR_JSON_ARRAY_REQUIRES_WHOLE_FIELD_REVIEW'using errcode='22023';end if;
  if jsonb_typeof(parent)<>'object'then raise exception'INVALID_DSR_DISCLOSURE_PATH'using errcode='22023';end if;
 end loop;end if;return p_fields#-path;
end$$;
revoke all on function private.dsr_all_disclosure_remove_path_v1(jsonb,text)from public,anon,authenticated,service_role;
create function public.propose_admin_dsr_all_exclusion_v1(p_package_id uuid,p_expected_source_sha256 text,p_source_key text,p_expected_source_hash text,p_fields text[],p_record_hashes text[],p_basis_code text,p_legal_reference text,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare correlation_value uuid:=extensions.gen_random_uuid();p public.dsr_all_packages_v1%rowtype;source jsonb;f text;touched boolean;h text;cached jsonb;proposal uuid;result jsonb;begin
 if not private.dsr_all_legal_staff_v1()then raise exception'DSR_LEGAL_STAFF_REQUIRED'using errcode='42501';end if;
 select*into p from public.dsr_all_packages_v1 where id=p_package_id;
 if p.id is null or p_expected_source_sha256 is distinct from p.source_sha256 then raise exception'STALE_DSR_ALL_PACKAGE'using errcode='40001';end if;
 if not exists(select 1 from public.data_subject_requests where id=p.request_id and status='IN_REVIEW'and verified_at is not null)then raise exception'DSR_RESPONSE_REVIEW_REQUIRED'using errcode='55000';end if;
 select value into source from jsonb_array_elements(p.snapshot_json::jsonb->'sources')where value->>'source_key'=p_source_key;
 if source is null or source->>'status'<>'EXTRACTED'or p_expected_source_hash is distinct from source->>'source_hash'then raise exception'STALE_DSR_ALL_SOURCE'using errcode='40001';end if;
 if p_fields is null or p_record_hashes is null or(cardinality(p_fields)=0 and cardinality(p_record_hashes)=0)or coalesce(p_basis_code,'')not in('THIRD_PARTY_RIGHTS','NOT_PERSONAL_DATA','LEGAL_RETENTION_RESTRICTION','LEGAL_PRIVILEGE')or length(btrim(coalesce(p_legal_reference,'')))not between 8 and 1000 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'DSR_DOCUMENTED_EXCLUSION_REQUIRED'using errcode='22023';end if;
 foreach f in array p_record_hashes loop if f is null or not exists(select 1 from jsonb_array_elements(source->'records')r where r->>'record_hash'=f)then raise exception'UNKNOWN_DSR_SOURCE_RECORD'using errcode='22023';end if;end loop;
 foreach f in array p_fields loop
  if f is null or not(source->'included_fields')?(private.dsr_all_disclosure_path_v1(f))[1]then raise exception'UNKNOWN_DSR_DISCLOSURE_FIELD'using errcode='22023';end if;
  select bool_or(private.dsr_all_disclosure_remove_path_v1(r->'fields',f)is distinct from r->'fields')into touched from jsonb_array_elements(source->'records')r where cardinality(p_record_hashes)=0 or r->>'record_hash'=any(p_record_hashes);if touched is distinct from true then raise exception'UNKNOWN_DSR_DISCLOSURE_FIELD'using errcode='22023';end if;
 end loop;

 h:=private.canonical_request_hash(jsonb_build_object('package_id',p.id,'source_key',p_source_key,'source_hash',p_expected_source_hash,'fields',p_fields,'record_hashes',p_record_hashes,'basis_code',p_basis_code,'legal_reference',btrim(p_legal_reference),'reason',btrim(p_reason)));
 cached:=private.begin_admin_command('privacy.all.exclusion.propose',p_idempotency_key,h,auth.uid());if cached is not null then return cached;end if;
 insert into public.dsr_all_exclusion_proposals_v1(package_id,source_key,source_hash,fields,record_hashes,basis_code,legal_reference,reason,content_hash,proposed_by)values(p.id,p_source_key,p_expected_source_hash,p_fields,p_record_hashes,p_basis_code,btrim(p_legal_reference),btrim(p_reason),h,auth.uid())returning id into proposal;
 result:=jsonb_build_object('outcome','DSR_ALL_EXCLUSION_PROPOSED','proposal_id',proposal,'content_hash',h,'package_id',p.id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p.organization_id,auth.uid(),'USER','privacy.all.exclusion.proposed','dsr_all_exclusion',proposal::text,correlation_value,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p.organization_id,'dsr_all_exclusion',proposal::text,'DsrAllExclusionProposedV1',correlation_value,result,'privacy-all-exclusion-propose:'||proposal::text);
 perform private.finish_admin_command('privacy.all.exclusion.propose',p_idempotency_key,auth.uid(),result);return result;
end$$;
create function public.decide_admin_dsr_all_exclusion_v1(p_proposal_id uuid,p_expected_content_hash text,p_approve boolean,p_review_confirmed boolean,p_legal_reference text,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare correlation_value uuid:=extensions.gen_random_uuid();p public.dsr_all_exclusion_proposals_v1%rowtype;package public.dsr_all_packages_v1%rowtype;decision public.dsr_all_exclusion_decisions_v1%rowtype;result jsonb;begin
 if not private.dsr_all_legal_staff_v1()then raise exception'DSR_LEGAL_STAFF_REQUIRED'using errcode='42501';end if;
 select*into p from public.dsr_all_exclusion_proposals_v1 where id=p_proposal_id for update;select*into package from public.dsr_all_packages_v1 where id=p.package_id;
 if p.id is null or p.proposed_by=auth.uid()then raise exception'DSR_EXCLUSION_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_expected_content_hash is distinct from p.content_hash then raise exception'STALE_DSR_ALL_EXCLUSION'using errcode='40001';end if;
 if not exists(select 1 from public.data_subject_requests where id=package.request_id and status='IN_REVIEW'and verified_at is not null)then raise exception'DSR_RESPONSE_REVIEW_REQUIRED'using errcode='55000';end if;
 if p_approve is null or(p_approve and p_review_confirmed is distinct from true)or length(btrim(coalesce(p_legal_reference,'')))not between 8 and 1000 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'DSR_DOCUMENTED_LEGAL_REVIEW_REQUIRED'using errcode='22023';end if;
 select*into decision from public.dsr_all_exclusion_decisions_v1 where proposal_id=p.id;
 result:=jsonb_build_object('outcome','DSR_ALL_EXCLUSION_REVIEWED','proposal_id',p.id,'content_hash',p.content_hash,'decision',case when p_approve then'APPROVE'else'REJECT'end);
 if decision.proposal_id is not null then if decision.decided_by=auth.uid()and decision.content_hash=p.content_hash and decision.decision=result->>'decision'and decision.reason=btrim(p_reason)and decision.legal_reference=btrim(p_legal_reference)then return result;end if;raise exception'DSR_ALL_EXCLUSION_ALREADY_REVIEWED'using errcode='55000';end if;
 insert into public.dsr_all_exclusion_decisions_v1(proposal_id,content_hash,decision,legal_reference,reason,decided_by)values(p.id,p.content_hash,result->>'decision',btrim(p_legal_reference),btrim(p_reason),auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(package.organization_id,auth.uid(),'USER','privacy.all.exclusion.reviewed','dsr_all_exclusion',p.id::text,correlation_value,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(package.organization_id,'dsr_all_exclusion',p.id::text,'DsrAllExclusionReviewedV1',correlation_value,result,'privacy-all-exclusion-review:'||p.id::text);return result;
end$$;
create function public.prepare_admin_dsr_all_response_v1(p_package_id uuid,p_expected_source_sha256 text,p_expected_file_manifest_hash text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions set timezone='UTC' as $$
declare correlation_value uuid:=extensions.gen_random_uuid();package public.dsr_all_packages_v1%rowtype;request public.data_subject_requests%rowtype;scope public.dsr_scope_versions_v1%rowtype;response public.dsr_private_responses_v1%rowtype;snapshot_value jsonb;source jsonb;record_value jsonb;fields_value jsonb;cut record;field_name text;omit boolean;sources_value jsonb:='[]';records_value jsonb;exclusions jsonb;file_manifest jsonb;document jsonb;encoded text;sha text;proof uuid;complete_value boolean;result jsonb;
begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 select*into package from public.dsr_all_packages_v1 where id=p_package_id;
 if package.id is null or p_expected_source_sha256 is distinct from package.source_sha256 then raise exception'STALE_DSR_ALL_PACKAGE'using errcode='40001';end if;
 select*into request from public.data_subject_requests where id=package.request_id for update;select*into scope from public.dsr_scope_versions_v1 where request_id=request.id order by version desc limit 1;
 if request.status<>'IN_REVIEW'or request.verified_at is null or scope.id is distinct from package.scope_version_id or scope.requested_scopes is distinct from array['ALL']::text[]or scope.subject_user_id is distinct from package.subject_user_id then raise exception'DSR_ALL_CURRENT_CONFIRMED_SCOPE_REQUIRED'using errcode='40001';end if;
 if length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200 then raise exception'INVALID_IDEMPOTENCY_KEY'using errcode='22023';end if;
 select r.*into response from public.dsr_private_responses_v1 r join public.dsr_all_response_packages_v1 b on b.response_id=r.id where r.request_id=request.id and r.idempotency_key=p_idempotency_key;
 if response.id is not null then if response.scope_version_id<>scope.id or not exists(select 1 from public.dsr_all_response_packages_v1 where response_id=response.id and package_id=package.id and file_manifest_hash=p_expected_file_manifest_hash)then raise exception'IDEMPOTENCY_KEY_REUSED'using errcode='22023';end if;return jsonb_build_object('outcome','DSR_ALL_RESPONSE_PREPARED','response_id',response.id,'sha256',response.sha256,'complete',response.complete);end if;
 snapshot_value:=package.snapshot_json::jsonb;
 if encode(extensions.digest(convert_to(package.snapshot_json,'UTF8'),'sha256'),'hex')is distinct from package.source_sha256 or snapshot_value->>'catalog_hash'is distinct from private.canonical_request_hash(private.dsr_all_catalog_v1())then raise exception'STALE_DSR_TECHNICAL_INVENTORY'using errcode='40001';end if;
 if exists(select 1 from public.dsr_all_exclusion_proposals_v1 p where p.package_id=package.id and not exists(select 1 from public.dsr_all_exclusion_decisions_v1 d where d.proposal_id=p.id))then raise exception'DSR_ALL_EXCLUSION_REVIEW_PENDING'using errcode='55000';end if;
 if to_regprocedure('private.dsr_all_file_manifest_v1(uuid)')is null then raise exception'DSR_ALL_FILE_MANIFEST_REQUIRED'using errcode='55000';end if;
 execute'select private.dsr_all_file_manifest_v1($1)'into file_manifest using package.id;
 if coalesce(p_expected_file_manifest_hash,'')!~'^[a-f0-9]{64}$'or file_manifest->>'manifest_hash'is distinct from p_expected_file_manifest_hash then raise exception'STALE_DSR_ALL_FILE_MANIFEST'using errcode='40001';end if;
 for source in select value from jsonb_array_elements(snapshot_value->'sources')loop
  if source->>'status'='EXCLUDED_BY_REVIEWED_POLICY'then sources_value:=sources_value||jsonb_build_array(source);continue;end if;
  records_value:='[]';
  for record_value in select value from jsonb_array_elements(source->'records')loop
   fields_value:=record_value->'fields';omit:=false;
   for cut in select p.*from public.dsr_all_exclusion_proposals_v1 p join public.dsr_all_exclusion_decisions_v1 d on d.proposal_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.proposed_by where p.package_id=package.id and p.source_key=source->>'source_key'and p.source_hash=source->>'source_hash'and(cardinality(p.record_hashes)=0 or record_value->>'record_hash'=any(p.record_hashes))loop
    if cardinality(cut.fields)=0 then omit:=true;else foreach field_name in array cut.fields loop fields_value:=private.dsr_all_disclosure_remove_path_v1(fields_value,field_name);end loop;end if;
   end loop;
   if not omit then records_value:=records_value||jsonb_build_array(jsonb_build_object('record_hash',record_value->>'record_hash','fields',fields_value));end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('proof_id',p.id,'content_hash',p.content_hash,'fields',p.fields,'record_count',cardinality(p.record_hashes),'basis_code',p.basis_code,'legal_reference',p.legal_reference,'reason',p.reason,'review_reference',d.legal_reference)order by p.proposed_at,p.id),'[]')into exclusions from public.dsr_all_exclusion_proposals_v1 p join public.dsr_all_exclusion_decisions_v1 d on d.proposal_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.proposed_by where p.package_id=package.id and p.source_key=source->>'source_key'and p.source_hash=source->>'source_hash';
  sources_value:=sources_value||jsonb_build_array((source-'records')||jsonb_build_object('records',records_value,'disclosed_record_count',jsonb_array_length(records_value),'reviewed_exclusions',exclusions));
 end loop;
 complete_value:=coalesce((file_manifest->>'complete')::boolean,false)and coalesce((snapshot_value#>>'{file_sources,coverage_complete}')::boolean,false)and coalesce((snapshot_value#>>'{external_processing,configured}')::boolean,false);
 document:=jsonb_build_object('format','MATRICIA_DSR_ALL_RESPONSE_V1','request_id',request.id,'scope_version_id',scope.id,'scope_version',scope.version,'capture_cut_at',snapshot_value->'capture_cut_at','mvcc_cut_hash',snapshot_value->>'mvcc_cut_hash','source_package_hash',package.source_sha256,'inventory_version_id',package.inventory_version_id,'inventory_hash',snapshot_value->>'inventory_hash','catalog_hash',snapshot_value->>'catalog_hash','sources',sources_value,'file_manifest',file_manifest,'requested_scopes',array['ALL']::text[],'covered_scopes',case when complete_value then array['ALL']::text[]else'{}'::text[]end,'uncovered_scopes',case when complete_value then'{}'::text[]else array['ALL']::text[]end,'complete',complete_value,'limitations',case when complete_value then'[]'::jsonb else jsonb_build_array('FILE_OR_EXTERNAL_PROCESSING_DISPOSITION_REQUIRED')end,'generated_at',clock_timestamp());
 encoded:=document::text;if octet_length(convert_to(encoded,'UTF8'))>16777216 then raise exception'PRIVACY_EXPORT_REQUIRES_BATCH_JOB'using errcode='55000';end if;sha:=encode(extensions.digest(convert_to(encoded,'UTF8'),'sha256'),'hex');
 insert into public.privacy_data_subject_export_proofs_v1(request_id,organization_id,generated_by,sha256,size_bytes,scope)values(request.id,request.organization_id,auth.uid(),sha,octet_length(convert_to(encoded,'UTF8')),'ALL_PERSONAL_INVENTORY')returning id into proof;
 insert into public.dsr_private_responses_v1(request_id,scope_version_id,subject_user_id,response_json,sha256,covered_scopes,uncovered_scopes,complete,created_by,source_export_proof_id,idempotency_key)values(request.id,scope.id,scope.subject_user_id,encoded,sha,case when complete_value then array['ALL']::text[]else'{}'::text[]end,case when complete_value then'{}'::text[]else array['ALL']::text[]end,complete_value,auth.uid(),proof,p_idempotency_key)returning*into response;
 insert into public.dsr_all_response_packages_v1(response_id,package_id,file_manifest_hash,disclosure_hash)values(response.id,package.id,p_expected_file_manifest_hash,sha);
 result:=jsonb_build_object('outcome','DSR_ALL_RESPONSE_PREPARED','response_id',response.id,'sha256',sha,'complete',complete_value,'reference','privacy-response:'||response.id::text);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(request.organization_id,auth.uid(),'USER','privacy.all.response.prepared','data_subject_request',request.id::text,correlation_value,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(request.organization_id,'data_subject_request',request.id::text,'DsrAllResponsePreparedV1',correlation_value,result,'privacy-all-response:'||response.id::text);return result;
end$$;
alter table public.privacy_data_subject_export_proofs_v1 drop constraint privacy_data_subject_export_proofs_v1_scope_check;
alter table public.privacy_data_subject_export_proofs_v1 add constraint privacy_data_subject_export_proofs_v1_scope_check check(scope in('PERSONAL_ACCOUNT_AND_OWN_CORRESPONDENCE','ALL_PERSONAL_INVENTORY'));
create function private.dsr_all_response_files_complete_v1(p_response_id uuid,p_subject_user_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare r public.dsr_private_responses_v1%rowtype;b public.dsr_all_response_packages_v1%rowtype;manifest jsonb;acknowledged boolean;begin
 select*into r from public.dsr_private_responses_v1 where id=p_response_id;select*into b from public.dsr_all_response_packages_v1 where response_id=r.id;
 if r.id is null or b.response_id is null or r.subject_user_id is distinct from p_subject_user_id or b.disclosure_hash is distinct from r.sha256 or to_regprocedure('private.dsr_all_file_manifest_v1(uuid)')is null or to_regprocedure('private.dsr_all_files_acknowledged_v1(uuid,uuid)')is null then return false;end if;
 execute'select private.dsr_all_file_manifest_v1($1)'into manifest using b.package_id;
 if manifest->>'manifest_hash'is distinct from b.file_manifest_hash or coalesce((manifest->>'complete')::boolean,false)is not true then return false;end if;
 execute'select private.dsr_all_files_acknowledged_v1($1,$2)'into acknowledged using r.id,p_subject_user_id;return coalesce(acknowledged,false);
end$$;
revoke all on function private.dsr_all_response_files_complete_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;target text;begin
 select pg_get_functiondef('public.acknowledge_my_dsr_response_v1(uuid,uuid,text)'::regprocedure)into definition;
 target:='if r.id is null or p_scope_version_id is distinct from r.scope_version_id';
 if strpos(definition,target)=0 then raise exception'DSR_ALL_ACK_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,target,'if r.complete and''ALL''=any(r.covered_scopes)and not private.dsr_all_response_files_complete_v1(r.id,auth.uid())then raise exception''DSR_ALL_FILE_ACKNOWLEDGEMENTS_REQUIRED''using errcode=''55000'';end if;'||target);execute definition;
end$$;
create or replace function private.dsr_acknowledged_complete_response_v1(p_request_id uuid,p_reference text)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.dsr_private_responses_v1 r join public.dsr_private_response_decisions_v1 d on d.response_id=r.id and d.decision='APPROVE'and d.sha256=r.sha256 and d.decided_by<>r.created_by join public.dsr_private_response_ack_v1 a on a.response_id=r.id and a.sha256=r.sha256 and a.subject_user_id=r.subject_user_id join public.dsr_scope_versions_v1 s on s.id=r.scope_version_id where r.request_id=p_request_id and p_reference='privacy-response:'||r.id::text and r.complete and cardinality(r.uncovered_scopes)=0 and r.covered_scopes=s.requested_scopes and s.version=(select max(version)from public.dsr_scope_versions_v1 where request_id=r.request_id)and(not'ALL'=any(r.covered_scopes)or private.dsr_all_response_files_complete_v1(r.id,r.subject_user_id)))
$$;
revoke all on function private.dsr_acknowledged_complete_response_v1(uuid,text)from public,anon,authenticated,service_role;
revoke all on function public.capture_admin_dsr_all_v1(uuid,uuid,uuid,text),public.propose_admin_dsr_all_exclusion_v1(uuid,text,text,text,text[],text[],text,text,text,text),public.decide_admin_dsr_all_exclusion_v1(uuid,text,boolean,boolean,text,text),public.prepare_admin_dsr_all_response_v1(uuid,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.capture_admin_dsr_all_v1(uuid,uuid,uuid,text),public.propose_admin_dsr_all_exclusion_v1(uuid,text,text,text,text[],text[],text,text,text,text),public.decide_admin_dsr_all_exclusion_v1(uuid,text,boolean,boolean,text,text),public.prepare_admin_dsr_all_response_v1(uuid,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
