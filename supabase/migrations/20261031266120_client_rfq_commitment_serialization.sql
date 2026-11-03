-- Serialize new RFQs with refunds and identity transitions. Historical retries
-- require current authorization/MFA, but never repeat a committed invitation.
do $$declare source text;function_id text;marker text;initial_entitlement text;initial_deadline text;before_lock text;after_lock text;begin
 initial_entitlement:=' if not private.client_may_open_new_service_request(v_request.client_organization_id) then raise exception ''CLIENT_REQUEST_NOT_ENTITLED'' using errcode=''42501'';end if;';
 initial_deadline:=' if p_deadline<=statement_timestamp()+interval ''1 hour'' then raise exception ''INVALID_RFQ_DEADLINE'' using errcode=''22023'';end if;';
 before_lock:=$patch$ if not private.can_manage_client_request(v_request.client_organization_id,v_actor)then raise exception'REQUEST_SCOPE_DENIED'using errcode='42501';end if;
 if v_replay is not null then return v_replay;end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||v_request.client_organization_id::text,0));
 if not private.can_manage_client_request(v_request.client_organization_id,v_actor)then raise exception'REQUEST_SCOPE_DENIED'using errcode='42501';end if;
 if not exists(select 1 from public.organizations where id=v_request.client_organization_id and status='ACTIVE')or not private.client_may_open_new_service_request(v_request.client_organization_id)then raise exception'CLIENT_REQUEST_NOT_ENTITLED'using errcode='42501';end if;
 if p_deadline is null or not isfinite(p_deadline)or p_deadline<=statement_timestamp()+interval'1 hour'then raise exception'INVALID_RFQ_DEADLINE'using errcode='22023';end if;
$patch$;
 after_lock:=$patch$ if not private.can_manage_client_request(v_request.client_organization_id,v_actor)then raise exception'REQUEST_SCOPE_DENIED'using errcode='42501';end if;
 if not exists(select 1 from public.organizations where id=v_request.client_organization_id and status='ACTIVE')or not private.client_may_open_new_service_request(v_request.client_organization_id)then raise exception'CLIENT_REQUEST_NOT_ENTITLED'using errcode='42501';end if;
$patch$;
 foreach function_id in array array['public.open_service_request_rfq(uuid,uuid,timestamptz,text,uuid)','private.open_approved_admin_rfq_v1(uuid,uuid,timestamptz,text,uuid,uuid,uuid[])']loop
  select pg_get_functiondef(function_id::regprocedure)into source;
  if position(initial_entitlement in source)=0 or position(initial_deadline in source)=0 then raise exception'CLIENT_RFQ_INITIAL_GUARD_TARGET_MISSING %',function_id;end if;
  source:=replace(replace(source,initial_entitlement,''),initial_deadline,'');
  marker:=' perform pg_advisory_xact_lock(hashtextextended(''service-request:''||p_request_id::text,0));';
  if position(marker in source)=0 then raise exception'CLIENT_RFQ_LOCK_TARGET_MISSING %',function_id;end if;
  source:=replace(source,marker,before_lock||marker);
  marker:=' perform private.assert_stored_client_request_catalog_source_v1(v_request.id,v_actor);';
  if position(marker in source)=0 then raise exception'CLIENT_RFQ_POST_LOCK_TARGET_MISSING %',function_id;end if;
  source:=replace(source,marker,after_lock||marker);
  if function_id like'public.%'then
   marker:=E'begin\n';if position(marker in source)=0 then raise exception'CLIENT_RFQ_AUTH_TARGET_MISSING';end if;
   source:=replace(source,marker,marker||' if auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''then raise exception''RFQ_OPEN_MFA_REQUIRED''using errcode=''42501'';end if;'||chr(10));
  end if;
  execute source;
 end loop;
end$$;
notify pgrst,'reload schema';
