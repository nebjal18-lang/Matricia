-- A public command cannot manufacture request authority by naming an arbitrary
-- draft, a questionnaire from another library, or a caller-supplied hash.
create function private.assert_client_request_catalog_source_v1(p_organization_id uuid,p_library_id uuid,p_service_id uuid,p_catalog_hash text,p_questionnaire_version_id uuid,p_questionnaire_hash text,p_actor uuid default auth.uid())returns void
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare service_version uuid;questionnaire public.questionnaire_versions%rowtype;published_release public.catalog_releases%rowtype;
begin
 select v.id into service_version from public.catalog_services s join public.catalog_service_versions v on v.id=s.current_published_version_id and v.service_id=s.id and v.library_id=s.library_id where s.id=p_service_id and s.library_id=p_library_id and s.status='PUBLISHED'and v.status='PUBLISHED'and v.published_at is not null and v.content_hash=p_catalog_hash;
 if service_version is null then raise exception'REQUEST_PUBLISHED_SERVICE_SOURCE_REQUIRED'using errcode='55000';end if;
 -- An incomplete intake may omit its questionnaire, but cannot choose a draft
 -- questionnaire as authority for a later completed request.
 if p_questionnaire_version_id is null then return;end if;
 select v.*into questionnaire from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id and q.library_id=v.library_id and q.current_published_version_id=v.id and q.status='PUBLISHED'where v.id=p_questionnaire_version_id and v.library_id=p_library_id and v.status='PUBLISHED'and v.audience='CLIENT'and v.translation_review_status='APPROVED'and v.snapshot_hash=p_questionnaire_hash;
 if questionnaire.id is null then raise exception'REQUEST_PUBLISHED_CLIENT_QUESTIONNAIRE_REQUIRED'using errcode='55000';end if;
 select*into published_release from public.catalog_releases where id=questionnaire.catalog_release_id and library_id=p_library_id and status='PUBLISHED'and statement_timestamp()>=effective_from and(effective_until is null or statement_timestamp()<effective_until);
 if published_release.id is null or not coalesce(private.can_read_catalog_release(published_release.id,p_actor),false)or not coalesce(published_release.audience->>'kind'='PUBLIC'or(published_release.audience->>'kind'='ORGANIZATIONS'and coalesce(published_release.audience->'organization_ids','[]'::jsonb)?p_organization_id::text),false)then raise exception'REQUEST_CATALOG_RELEASE_ACCESS_REQUIRED'using errcode='55000';end if;
 if not exists(select 1 from public.catalog_release_items where release_id=published_release.id and library_id=p_library_id and object_type='SERVICE'and object_id=p_service_id and version_id=service_version and content_hash=p_catalog_hash)then raise exception'REQUEST_RELEASE_SERVICE_VERSION_REQUIRED'using errcode='55000';end if;
end$$;
revoke all on function private.assert_client_request_catalog_source_v1(uuid,uuid,uuid,text,uuid,text,uuid)from public,anon,authenticated,service_role;
create function private.assert_stored_client_request_catalog_source_v1(p_request_id uuid,p_actor uuid default auth.uid())returns void language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare r public.service_requests%rowtype;v public.service_request_versions%rowtype;begin
 select*into r from public.service_requests where id=p_request_id;select*into v from public.service_request_versions where id=r.current_version_id and request_id=r.id;
 if r.id is null or v.id is null then raise exception'REQUEST_CATALOG_SOURCE_MISSING'using errcode='55000';end if;
 if r.questionnaire_version_id is null then raise exception'REQUEST_PUBLISHED_CLIENT_QUESTIONNAIRE_REQUIRED'using errcode='55000';end if;
 perform private.assert_client_request_catalog_source_v1(r.client_organization_id,r.library_id,r.service_id,v.catalog_snapshot_hash,r.questionnaire_version_id,v.questionnaire_snapshot_hash,p_actor);
end$$;
revoke all on function private.assert_stored_client_request_catalog_source_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare source text;marker text;function_id text;begin
 select pg_get_functiondef('public.create_service_request(uuid,uuid,uuid,uuid,jsonb,text,text,uuid)'::regprocedure)into source;
 marker:=' p_payload:=jsonb_set(p_payload,''{required_quote_data}'',';
 if position(marker in source)=0 then raise exception'CLIENT_CATALOG_CREATE_PATCH_TARGET_MISSING';end if;
 execute replace(source,marker,' perform private.assert_client_request_catalog_source_v1(p_client_organization_id,p_library_id,p_service_id,p_payload->>''catalog_snapshot_hash'',p_questionnaire_version_id,p_payload->>''questionnaire_snapshot_hash'',v_actor);'||chr(10)||marker);
 select pg_get_functiondef('private.clone_request_core(uuid,date,uuid,text,boolean)'::regprocedure)into source;
 marker:=' v_request_version.required_quote_data:=private.client_request_tax_quote_data_v1';
 if position(marker in source)=0 then raise exception'CLIENT_CATALOG_CLONE_PATCH_TARGET_MISSING';end if;
 execute replace(source,marker,' perform private.assert_client_request_catalog_source_v1(v_request.client_organization_id,v_request.library_id,v_request.service_id,v_catalog_version.content_hash,v_questionnaire_version.id,coalesce(v_questionnaire_version.snapshot_hash,repeat(''0'',64)),p_actor);'||chr(10)||marker);
 select pg_get_functiondef('public.mark_service_request_ready(uuid,integer,text,text,uuid)'::regprocedure)into source;
 marker:=' declare canonical_data jsonb;';
 if position(marker in source)=0 then raise exception'CLIENT_CATALOG_READY_PATCH_TARGET_MISSING';end if;
 execute replace(source,marker,' perform private.assert_stored_client_request_catalog_source_v1(v_request.id,v_actor);'||chr(10)||marker);
 -- Both the Client command and the approved administrative executor must pass
 -- the same catalogue authority check before opening a new consultation.
 foreach function_id in array array['public.open_service_request_rfq(uuid,uuid,timestamptz,text,uuid)','private.open_approved_admin_rfq_v1(uuid,uuid,timestamptz,text,uuid,uuid,uuid[])']loop
  select pg_get_functiondef(function_id::regprocedure)into source;
  marker:=' perform pg_advisory_xact_lock(hashtextextended(''rfq-fair-rotation:''';
  if position(marker in source)=0 then raise exception'CLIENT_CATALOG_OPEN_PATCH_TARGET_MISSING %',function_id;end if;
  execute replace(source,marker,' perform private.assert_stored_client_request_catalog_source_v1(v_request.id,v_actor);'||chr(10)||marker);
 end loop;
end$$;
notify pgrst,'reload schema';
