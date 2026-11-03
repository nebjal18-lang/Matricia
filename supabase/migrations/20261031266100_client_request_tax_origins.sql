-- Freeze the request's source, jurisdiction and fiscal date on the server even
-- when its reviewed service classification has not yet been configured.
create table public.service_request_tax_origins_v1(
 request_id uuid primary key references public.service_requests(id),
 organization_id uuid not null references public.organizations(id),
 service_version_id uuid not null references public.catalog_service_versions(id),
 service_content_hash text not null check(service_content_hash~'^[0-9a-f]{64}$'),
 country_code text not null check(country_code~'^[A-Z]{2}$'),
 currency char(3)not null check(currency~'^[A-Z]{3}$'),
 tax_effective_on date not null check(isfinite(tax_effective_on)),
 origin_kind text not null check(origin_kind in('SERVER_CREATED','LEGACY_EXACT_SOURCE')),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.service_request_tax_origins_v1 enable row level security;
revoke all on public.service_request_tax_origins_v1 from public,anon,authenticated,service_role;
create trigger client_request_tax_origin_immutable before update or delete on public.service_request_tax_origins_v1 for each row execute function private.prevent_update_delete();
create function private.client_request_tax_quote_data_v1(p_request_id uuid,p_catalog_hash text,p_currency char(3),p_quote_data jsonb,p_require_mapping boolean,p_new_request boolean default false)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.service_requests%rowtype;o public.organizations%rowtype;origin public.service_request_tax_origins_v1%rowtype;source_ids uuid[];country text;policy jsonb;result jsonb;
begin
 select*into r from public.service_requests where id=p_request_id;
 if r.id is null or jsonb_typeof(p_quote_data)is distinct from'object'or p_require_mapping is null or p_new_request is null or p_currency is null or p_currency!~'^[A-Z]{3}$'then raise exception'INVALID_REQUEST_TAX_ORIGIN'using errcode='22023';end if;
 select*into origin from public.service_request_tax_origins_v1 where request_id=r.id;
 if origin.request_id is null then
  if p_new_request then
   select array_agg(v.id order by v.id)into source_ids from public.catalog_services s join public.catalog_service_versions v on v.id=s.current_published_version_id and v.service_id=s.id and v.library_id=s.library_id where s.id=r.service_id and s.library_id=r.library_id and s.status='PUBLISHED'and v.content_hash=p_catalog_hash and v.status='PUBLISHED'and v.published_at is not null;
  else
   select array_agg(id order by id)into source_ids from public.catalog_service_versions where service_id=r.service_id and library_id=r.library_id and content_hash=p_catalog_hash and status in('PUBLISHED','RETIRED')and published_at is not null;
  end if;
  if coalesce(cardinality(source_ids),0)<>1 then raise exception'SERVICE_TAX_EXACT_SOURCE_REQUIRED'using errcode='55000';end if;
  select*into o from public.organizations where id=r.client_organization_id;
  country:=o.country_code;
  -- Legacy caller JSON is never accepted as proof of the original country.
  -- A country revision after creation needs an explicit origin review instead
  -- of silently applying the present jurisdiction to an older request.
  if not p_new_request and exists(select 1 from public.admin_organization_identity_revisions_v1 i join public.admin_operational_action_requests a on a.id=i.action_request_id where i.organization_id=o.id and i.created_at>r.created_at and a.redacted_summary?'country')then
   raise exception'SERVICE_TAX_ORIGIN_REVIEW_REQUIRED'using errcode='55000';
  end if;
  insert into public.service_request_tax_origins_v1(request_id,organization_id,service_version_id,service_content_hash,country_code,currency,tax_effective_on,origin_kind)
  values(r.id,r.client_organization_id,source_ids[1],p_catalog_hash,country,p_currency,(r.created_at at time zone'Africa/Casablanca')::date,case when p_new_request then'SERVER_CREATED'else'LEGACY_EXACT_SOURCE'end)returning*into origin;
 end if;
 if origin.organization_id is distinct from r.client_organization_id or origin.service_content_hash is distinct from p_catalog_hash or origin.currency is distinct from p_currency then raise exception'SERVICE_TAX_ORIGIN_CHANGED'using errcode='40001';end if;
 begin policy:=private.resolve_service_tax_category_v1(origin.service_version_id,origin.country_code,origin.currency,origin.tax_effective_on);
 exception when sqlstate'55000'then if p_require_mapping then raise;end if;policy:=null;
 end;
 -- Both new and legacy caller-supplied fiscal keys are replaced by canonical
 -- origins and (when available) the approved mapping, before content hashing.
 result:=(p_quote_data-'service_version_id'-'country_code'-'tax_effective_on'-'tax_category_code'-'tax_category_policy_snapshot')||jsonb_build_object('service_version_id',origin.service_version_id,'country_code',origin.country_code,'tax_effective_on',origin.tax_effective_on::text);
 if policy is not null then result:=result||jsonb_build_object('tax_category_code',policy->>'category_code','tax_category_policy_snapshot',policy);end if;
 return result;
end$$;
revoke all on function private.client_request_tax_quote_data_v1(uuid,text,char(3),jsonb,boolean,boolean)from public,anon,authenticated,service_role;

-- Preserve the current entitlement/security wrappers, original command hash,
-- and original replay. Canonical tax facts are added only after that replay.
do $$declare source text;marker text;addition text;begin
 select pg_get_functiondef('public.create_service_request(uuid,uuid,uuid,uuid,jsonb,text,text,uuid)'::regprocedure)into source;
 marker:=' insert into public.service_request_versions(';
 addition:=$patch$ p_payload:=jsonb_set(p_payload,'{required_quote_data}',private.client_request_tax_quote_data_v1(v_request,p_payload->>'catalog_snapshot_hash',coalesce(nullif(p_payload->>'currency_code',''),'MAD')::char(3),coalesce(p_payload->'required_quote_data','{}'::jsonb),false,true));
 v_content:=private.canonical_request_hash(jsonb_build_object('request_id',v_request,'version',1,'payload',p_payload));
$patch$;
 if position(marker in source)=0 then raise exception'CLIENT_TAX_CREATE_PATCH_TARGET_MISSING';end if;
 execute replace(source,marker,addition||marker);
 select pg_get_functiondef('private.clone_request_core(uuid,date,uuid,text,boolean)'::regprocedure)into source;
 marker:=' insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description';
 addition:=$patch$ v_request_version.required_quote_data:=private.client_request_tax_quote_data_v1(v_new_request_id,v_catalog_version.content_hash,v_request_version.currency_code,v_request_version.required_quote_data,false,true);
 v_content_hash:=private.canonical_request_hash(jsonb_build_object('request_id',v_new_request_id,'version',1,'source_request_id',v_request.id,'catalog_hash',v_catalog_version.content_hash,'questionnaire_hash',coalesce(v_questionnaire_version.snapshot_hash,repeat('0',64)),'scheduled_on',p_scheduled_on,'required_quote_data',v_request_version.required_quote_data));
$patch$;
 if position(marker in source)=0 then raise exception'CLIENT_TAX_CLONE_PATCH_TARGET_MISSING';end if;
 execute replace(source,marker,addition||marker);
 select pg_get_functiondef('public.complete_service_request_information(uuid,integer,jsonb,text,text,uuid)'::regprocedure)into source;
 marker:='  missing := private.service_request_missing_quote_keys(request.service_id, quote_data);';
 if position(marker in source)=0 then raise exception'CLIENT_TAX_COMPLETE_PATCH_TARGET_MISSING';end if;
 execute replace(source,marker,'  quote_data := private.client_request_tax_quote_data_v1(request.id,version.catalog_snapshot_hash,version.currency_code,quote_data,false,false);'||chr(10)||marker);
 select pg_get_functiondef('public.mark_service_request_ready(uuid,integer,text,text,uuid)'::regprocedure)into source;
 source:=replace(source,'v_request.row_version<>p_expected_row_version','v_request.row_version is distinct from p_expected_row_version');
 marker:=' update public.service_requests set status=''READY''';
 addition:=$patch$ declare canonical_data jsonb;next_id uuid;begin
 canonical_data:=private.client_request_tax_quote_data_v1(v_request.id,v_version.catalog_snapshot_hash,v_version.currency_code,v_version.required_quote_data,true,false);
 if canonical_data is distinct from v_version.required_quote_data then
  next_id:=extensions.gen_random_uuid();
  insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,desired_date,budget_minor,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
  values(next_id,v_request.id,v_request.client_organization_id,v_request.library_id,v_version.version_number+1,v_version.description,v_version.urgency,v_version.desired_date,v_version.budget_minor,v_version.currency_code,canonical_data,v_version.required_fields_complete,v_version.catalog_snapshot_hash,v_version.questionnaire_snapshot_hash,'Classification fiscale approuvée avant consultation',private.canonical_request_hash(jsonb_build_object('request_id',v_request.id,'version',v_version.version_number+1,'base',v_version.content_hash,'required_quote_data',canonical_data)),v_actor);
  update public.service_requests set current_version_id=next_id where id=v_request.id;
  select*into v_version from public.service_request_versions where id=next_id;
 end if;end;
$patch$;
 if position(marker in source)=0 then raise exception'CLIENT_TAX_READY_PATCH_TARGET_MISSING';end if;
 execute replace(source,marker,addition||marker);
end$$;
notify pgrst,'reload schema';
