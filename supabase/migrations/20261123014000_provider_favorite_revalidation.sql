begin;

-- Favorites share the current matching policy, including quarantine, effective
-- qualification dates and current mandatory document evidence.
create or replace function private.current_provider_service_eligibility(p_provider_organization_id uuid,p_service_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select private.provider_service_eligibility_snapshot(p_provider_organization_id,p_service_id)
$$;
revoke all on function private.current_provider_service_eligibility(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.revalidate_provider_favorite(p_favorite_id uuid,p_request_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
 v_actor uuid:=auth.uid();
 v_f public.client_provider_favorites%rowtype;
 v_r public.service_requests%rowtype;
 v_saved public.idempotency_keys%rowtype;
 v_explain jsonb;v_eligible boolean;v_reasons text[];v_hash text;v_replay jsonb;v_id uuid;v_response jsonb;
begin
 select * into v_f from public.client_provider_favorites where id=p_favorite_id for update;
 if not found then raise exception 'PROVIDER_FAVORITE_NOT_FOUND' using errcode='P0002';end if;
 if not private.has_org_role(v_f.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'],v_actor)then raise exception 'FAVORITE_CLIENT_SCOPE_DENIED' using errcode='42501';end if;
 if v_f.status<>'ACTIVE'then raise exception 'INACTIVE_PROVIDER_FAVORITE' using errcode='55000';end if;
 select * into v_r from public.service_requests where id=p_request_id and client_organization_id=v_f.client_organization_id;
 if not found then raise exception 'FAVORITE_REQUEST_SCOPE_DENIED' using errcode='42501';end if;
 if v_f.service_id is not null and v_f.service_id<>v_r.service_id then raise exception 'FAVORITE_SERVICE_MISMATCH' using errcode='22023';end if;

 -- Identity describes the requested check, never its volatile execution time.
 v_hash:=private.canonical_request_hash(jsonb_build_object('operation','provider.favorite.revalidate.v1','favorite',p_favorite_id,'request',p_request_id));
 perform pg_advisory_xact_lock(hashtextextended(v_f.client_organization_id::text||':provider.favorite.revalidate:'||p_idempotency_key,0));
 select * into v_saved from public.idempotency_keys where organization_id=v_f.client_organization_id and operation_scope='provider.favorite.revalidate' and key=p_idempotency_key for update;
 -- Old completed receipts hashed their original eligibility snapshot. Validate
 -- that exact stored snapshot to replay them without rewriting history.
 if found and v_saved.status='COMPLETED'
   and v_saved.response_body->>'favorite_id'=p_favorite_id::text
   and v_saved.response_body->>'request_id'=p_request_id::text
   and v_saved.request_hash=private.canonical_request_hash(jsonb_build_object('operation','provider.favorite.revalidate.v1','favorite',p_favorite_id,'request',p_request_id,'eligibility',v_saved.response_body->'explanation')) then
  v_hash:=v_saved.request_hash;
 end if;
 v_replay:=private.begin_provider_reputation_command(v_f.client_organization_id,v_actor,'provider.favorite.revalidate',p_idempotency_key,v_hash);
 if v_replay is not null then return v_replay;end if;

 v_explain:=private.current_provider_service_eligibility(v_f.provider_organization_id,v_r.service_id);
 v_eligible:=coalesce((v_explain->>'eligible')::boolean,false);
 select coalesce(array_agg(value),array[]::text[])into v_reasons from jsonb_array_elements_text(coalesce(v_explain->'reasons','[]'::jsonb));
 if not v_eligible and cardinality(v_reasons)=0 then v_reasons:=array['ELIGIBILITY_NOT_CONFIRMED'];end if;
 insert into public.favorite_eligibility_revalidations(favorite_id,client_organization_id,request_id,provider_organization_id,service_id,eligible,exclusion_reasons,eligibility_explanation,checked_by,correlation_id)
 values(v_f.id,v_f.client_organization_id,v_r.id,v_f.provider_organization_id,v_r.service_id,v_eligible,v_reasons,v_explain,v_actor,p_correlation_id)returning id into v_id;
 v_response:=jsonb_build_object('outcome','PROVIDER_FAVORITE_REVALIDATED','revalidation_id',v_id,'favorite_id',v_f.id,'request_id',v_r.id,'eligible',v_eligible,'exclusion_reasons',to_jsonb(v_reasons),'explanation',v_explain);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(v_f.client_organization_id,v_actor,'USER','provider.favorite.revalidated','favorite_eligibility_revalidation',v_id::text,p_correlation_id,jsonb_build_object('favorite_id',v_f.id,'request_id',v_r.id,'provider_organization_id',v_f.provider_organization_id,'eligible',v_eligible,'exclusion_reasons',to_jsonb(v_reasons)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)
 values(v_f.client_organization_id,'provider_favorite',v_f.id::text,'ProviderFavoriteRevalidatedV1',p_correlation_id,jsonb_build_object('revalidation_id',v_id,'request_id',v_r.id,'provider_organization_id',v_f.provider_organization_id,'eligible',v_eligible,'exclusion_reasons',to_jsonb(v_reasons)));
 perform private.finish_provider_reputation_command(v_f.client_organization_id,'provider.favorite.revalidate',p_idempotency_key,v_response);
 return v_response;
end$$;
revoke all on function private.revalidate_provider_favorite(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
