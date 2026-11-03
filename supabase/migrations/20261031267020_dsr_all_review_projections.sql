begin;
create function public.get_dsr_all_inventory_version_v1(p_inventory_version_id uuid,p_page integer default 1,p_search text default'')returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v public.dsr_all_inventory_versions_v1%rowtype;items jsonb;total bigint;begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or length(coalesce(p_search,''))>200 then raise exception'INVALID_DSR_INVENTORY_PAGE'using errcode='22023';end if;
 select*into v from public.dsr_all_inventory_versions_v1 where id=p_inventory_version_id;
 if v.id is null then raise exception'DSR_INVENTORY_VERSION_NOT_FOUND'using errcode='22023';end if;
 select count(*)into total from jsonb_array_elements(v.inventory_json)e where p_search=''or e#>>'{source,key}'ilike'%'||p_search||'%';
 select coalesce(jsonb_agg(value order by value#>>'{source,key}'),'[]')into items from(select value from jsonb_array_elements(v.inventory_json)where p_search=''or value#>>'{source,key}'ilike'%'||p_search||'%'order by value#>>'{source,key}'limit 25 offset((p_page-1)*25))selected;
 return jsonb_build_object('id',v.id,'version',v.version::text,'created_by',v.created_by,'created_at',v.created_at,'content_hash',v.content_hash,'catalog_hash',v.catalog_hash,'catalog_current',v.catalog_hash=private.canonical_request_hash(private.dsr_all_catalog_v1()),'legal_reference',v.legal_reference,'decision',(select decision from public.dsr_all_inventory_decisions_v1 where inventory_version_id=v.id),'can_decide',private.dsr_all_legal_staff_v1()and v.created_by<>auth.uid()and not exists(select 1 from public.dsr_all_inventory_decisions_v1 where inventory_version_id=v.id),'source_total',jsonb_array_length(v.inventory_json),'filtered_total',total,'items',items,'page',p_page,'has_next',p_page::bigint*25<total);
end$$;
create function public.get_dsr_all_case_console_v1(p_request_id uuid,p_package_id uuid default null,p_source_key text default null,p_page integer default 1)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.data_subject_requests%rowtype;s public.dsr_scope_versions_v1%rowtype;p public.dsr_all_packages_v1%rowtype;packages jsonb;snapshot_value jsonb;source jsonb;sources jsonb;records_value jsonb;cuts jsonb;files jsonb;effective_inventory jsonb;begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_DSR_INVENTORY_PAGE'using errcode='22023';end if;
 select*into d from public.data_subject_requests where id=p_request_id;
 if d.id is null or d.request_type not in('ACCESS','PORTABILITY')then raise exception'DSR_ALL_REQUEST_NOT_FOUND'using errcode='22023';end if;
 select*into s from public.dsr_scope_versions_v1 where request_id=d.id order by version desc limit 1;
 select jsonb_build_object('id',v.id,'version',v.version::text,'content_hash',v.content_hash)into effective_inventory from public.dsr_all_inventory_versions_v1 v join public.dsr_all_inventory_decisions_v1 decision on decision.inventory_version_id=v.id and decision.decision='APPROVE'and decision.content_hash=v.content_hash and decision.decided_by<>v.created_by where v.catalog_hash=private.canonical_request_hash(private.dsr_all_catalog_v1())order by v.version desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'scope_version_id',scope_version_id,'inventory_version_id',inventory_version_id,'source_sha256',source_sha256,'captured_at',captured_at,'created_by',created_by)order by captured_at desc,id),'[]')into packages from(select*from public.dsr_all_packages_v1 where request_id=d.id order by captured_at desc,id limit 25 offset((p_page-1)*25))selected;
 if p_package_id is not null then select*into p from public.dsr_all_packages_v1 where id=p_package_id and request_id=d.id;
 else select*into p from public.dsr_all_packages_v1 where request_id=d.id order by captured_at desc,id desc limit 1;end if;
 if p_package_id is not null and p.id is null then raise exception'DSR_ALL_PACKAGE_NOT_FOUND'using errcode='22023';end if;
 if p.id is not null then
  snapshot_value:=p.snapshot_json::jsonb;
  select coalesce(jsonb_agg(value-'records'order by value->>'source_key'),'[]')into sources from(select value from jsonb_array_elements(snapshot_value->'sources')order by value->>'source_key'limit 25 offset((p_page-1)*25))selected;
  if p_source_key is not null then
   select value into source from jsonb_array_elements(snapshot_value->'sources')where value->>'source_key'=p_source_key;
   if source is null then raise exception'DSR_ALL_SOURCE_NOT_FOUND'using errcode='22023';end if;
   select coalesce(jsonb_agg(value order by value->>'record_hash'),'[]')into records_value from(select value from jsonb_array_elements(source->'records')order by value->>'record_hash'limit 25 offset((p_page-1)*25))selected;
   select coalesce(jsonb_agg(jsonb_build_object('id',proposal.id,'content_hash',proposal.content_hash,'source_key',proposal.source_key,'fields',proposal.fields,'record_hashes',proposal.record_hashes,'basis_code',proposal.basis_code,'legal_reference',proposal.legal_reference,'reason',proposal.reason,'proposed_by',proposal.proposed_by,'proposed_at',proposal.proposed_at,'decision',decision.decision,'review_reason',decision.reason,'can_decide',private.dsr_all_legal_staff_v1()and proposal.proposed_by<>auth.uid()and decision.proposal_id is null)order by proposal.proposed_at desc,proposal.id),'[]')into cuts from(select*from public.dsr_all_exclusion_proposals_v1 where package_id=p.id and source_key=p_source_key order by proposed_at desc,id limit 25 offset((p_page-1)*25))proposal left join public.dsr_all_exclusion_decisions_v1 decision on decision.proposal_id=proposal.id where proposal.package_id=p.id and proposal.source_key=p_source_key;
  end if;
  if to_regprocedure('private.dsr_all_file_manifest_v1(uuid)')is not null then execute'select private.dsr_all_file_manifest_v1($1)'into files using p.id;end if;
 end if;
 if source is not null then insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','privacy.all.source.previewed','dsr_all_package',p.id::text,extensions.gen_random_uuid(),jsonb_build_object('request_id',d.id,'source_key',p_source_key,'page',p_page,'record_count',jsonb_array_length(records_value),'source_sha256',p.source_sha256),repeat('0',64));end if;
 return jsonb_build_object('actor_id',auth.uid(),'can_legal_manage',private.dsr_all_legal_staff_v1(),'request',jsonb_build_object('id',d.id,'status',d.status,'verified',d.verified_at is not null,'organization_id',d.organization_id,'scope',case when s.id is not null then jsonb_build_object('id',s.id,'version',s.version,'requested_scopes',s.requested_scopes)end),'effective_inventory',effective_inventory,'packages',packages,'packages_has_next',exists(select 1 from public.dsr_all_packages_v1 where request_id=d.id offset(p_page*25)),'page',p_page,'selected_package',case when p.id is not null then jsonb_build_object('id',p.id,'source_sha256',p.source_sha256,'scope_version_id',p.scope_version_id,'inventory_version_id',p.inventory_version_id,'captured_at',p.captured_at,'source_count',snapshot_value->'source_count','record_count',snapshot_value->'record_count','file_coverage_complete',snapshot_value#>'{file_sources,coverage_complete}','external_processing_configured',snapshot_value#>'{external_processing,configured}','source_summaries',sources,'sources_has_next',(snapshot_value->>'source_count')::bigint>p_page::bigint*25,'file_manifest',files,'selected_source',case when source is not null then(source-'records')||jsonb_build_object('records',records_value,'exclusion_proposals',cuts,'exclusions_has_next',exists(select 1 from public.dsr_all_exclusion_proposals_v1 where package_id=p.id and source_key=p_source_key offset(p_page*25)),'records_has_next',jsonb_array_length(source->'records')>p_page::bigint*25)end)end);
end$$;
do $$declare definition text;target text;begin
 select pg_get_functiondef('public.get_dsr_delivery_console_v1(boolean,integer)'::regprocedure)into definition;
 target:=$target$'reference','privacy-response:'||r.id::text$target$;
 if strpos(definition,target)=0 then raise exception'DSR_ALL_DELIVERY_BINDING_PROJECTION_TARGET_MISSING';end if;
 if strpos(definition,'''all_package''')=0 then definition:=replace(definition,target,$replacement$'all_package',exists(select 1 from public.dsr_all_response_packages_v1 where response_id=r.id),'reference','privacy-response:'||r.id::text$replacement$);execute definition;end if;
end$$;
revoke all on function public.get_dsr_all_inventory_version_v1(uuid,integer,text),public.get_dsr_all_case_console_v1(uuid,uuid,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.get_dsr_all_inventory_version_v1(uuid,integer,text),public.get_dsr_all_case_console_v1(uuid,uuid,text,integer)to authenticated;
notify pgrst,'reload schema';
commit;
