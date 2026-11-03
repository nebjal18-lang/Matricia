begin;
-- Keep eligibility based on current evidence, never superseded immutable history.
-- Preserve all role, quarantine, identity, financial and human-decision guards.
do $migration$
declare definition text; old_clause text;
begin
 definition:=pg_get_functiondef('private.provider_service_eligibility_snapshot(uuid,uuid)'::regprocedure);
 old_clause:='if exists(select 1 from public.provider_document_service_links link join public.provider_document_versions document on document.id=link.document_version_id where link.provider_service_id=service_row.id and link.is_mandatory and(document.status<>''VERIFIED''or not private.provider_document_is_clean(document.storage_object_path,document.content_hash)or(document.expires_on is not null and document.expires_on<=current_date)))';
 if position(old_clause in definition)=0 then raise exception 'PROVIDER_CURRENT_DOCUMENT_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,old_clause,'if exists(select 1 from public.provider_document_service_links link join public.provider_document_versions source on source.id=link.document_version_id join lateral(select d.* from public.provider_document_versions d where d.family_id=source.family_id order by d.version_number desc limit 1)document on true where source.provider_organization_id=p_provider_organization_id and link.provider_service_id=service_row.id and link.is_mandatory and(document.status<>''VERIFIED''or not private.provider_document_is_clean(document.storage_object_path,document.content_hash)or(document.expires_on is not null and document.expires_on<=current_date)))');
 definition:=replace(definition,'capacity text;','capacity text;capacity_units integer;capacity_lead integer;capacity_version integer;capacity_global boolean;');
 definition:=replace(definition,'select version.capacity_status into capacity from public.provider_capacity_versions version','select version.capacity_status,version.available_units,version.lead_time_days,version.version_number,version.service_id is null into capacity,capacity_units,capacity_lead,capacity_version,capacity_global from public.provider_capacity_versions version');
 definition:=replace(definition,'''checked_at'',statement_timestamp());','''checked_at'',statement_timestamp(),''capacity_available_units'',capacity_units,''capacity_lead_time_days'',capacity_lead,''capacity_version'',capacity_version,''capacity_global'',capacity_global,''rule_version'',qualification.rule_version,''qualification_rationale'',qualification.rationale,''qualification_blocking_conditions'',coalesce(qualification.blocking_conditions,''[]''::jsonb),''qualification_expires_at'',qualification.expires_at);');
 execute definition;
end
$migration$;

-- A service-specific certificate must not invalidate the entire legal dossier.
create function private.provider_required_documents_complete_v1(p_org uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select not exists(select 1 from unnest(array['LEGAL','FISCAL','INSURANCE'])kind where not exists(select 1 from public.provider_document_families f join lateral(select v.*from public.provider_document_versions v where v.family_id=f.id order by v.version_number desc limit 1)d on true where f.provider_organization_id=p_org and f.document_kind=kind and d.status='VERIFIED'and(d.expires_on is null or d.expires_on>current_date)and private.provider_document_is_clean(d.storage_object_path,d.content_hash)))
$$;
revoke all on function private.provider_required_documents_complete_v1(uuid)from public,anon,authenticated,service_role;
do $migration$
declare definition text;marker text;
begin
 definition:=pg_get_functiondef('public.record_provider_document_version(uuid,text,text,jsonb,uuid[],text,text,uuid)'::regprocedure);
 marker:='set documents_valid=false,updated_at=';
 if position(marker in definition)=0 then raise exception 'PROVIDER_TARGETED_DOCUMENT_PATCH_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,'set documents_valid=private.provider_required_documents_complete_v1(p_provider_organization_id),updated_at=');
end
$migration$;

-- A stable operation identity survives a lost response and reuses its path.
alter table public.provider_document_upload_reservations add column operation_key uuid,add column expected_content_hash text check(expected_content_hash is null or expected_content_hash~'^[0-9a-f]{64}$');
create unique index provider_document_upload_operation_idx on public.provider_document_upload_reservations(provider_organization_id,actor_user_id,operation_key)where operation_key is not null;
create function public.begin_provider_document_upload_v2(p_provider_organization_id uuid,p_declared_mime_type text,p_declared_size_bytes bigint,p_expected_content_hash text,p_operation_key uuid)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare actor uuid:=auth.uid();reservation public.provider_document_upload_reservations%rowtype;result jsonb;
begin
 if not private.can_manage_provider(p_provider_organization_id,actor)then raise exception 'PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if p_operation_key is null or p_expected_content_hash is null or p_expected_content_hash!~'^[0-9a-f]{64}$'or p_declared_mime_type not in('application/pdf','image/jpeg','image/png')or p_declared_size_bytes not between 1 and 10485760 then raise exception 'INVALID_PROVIDER_DOCUMENT_FILE'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('provider-upload:'||p_provider_organization_id::text||':'||actor::text||':'||p_operation_key::text,0));
 select*into reservation from public.provider_document_upload_reservations where provider_organization_id=p_provider_organization_id and actor_user_id=actor and operation_key=p_operation_key for update;
 if found then
  if reservation.declared_mime_type is distinct from p_declared_mime_type or reservation.declared_size_bytes is distinct from p_declared_size_bytes or reservation.expected_content_hash is distinct from p_expected_content_hash then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
  if reservation.status='UPLOAD_PENDING'and reservation.expires_at<=clock_timestamp()then update public.provider_document_upload_reservations set expires_at=clock_timestamp()+interval '30 minutes'where id=reservation.id returning*into reservation;end if;
 else
  result:=public.begin_provider_document_upload(p_provider_organization_id,p_declared_mime_type,p_declared_size_bytes);
  update public.provider_document_upload_reservations set operation_key=p_operation_key,expected_content_hash=p_expected_content_hash where id=(result->>'upload_id')::uuid returning*into reservation;
 end if;
 return jsonb_build_object('outcome','PROVIDER_DOCUMENT_UPLOAD_RESERVED','upload_id',reservation.id,'storage_bucket',reservation.storage_bucket,'storage_object_path',reservation.storage_object_path,'status',reservation.status);
end$$;
revoke all on function public.begin_provider_document_upload_v2(uuid,text,bigint,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.begin_provider_document_upload_v2(uuid,text,bigint,text,uuid)to authenticated;

-- Bind the reserved hash to the immutable source row too.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.validate_provider_document_storage_binding()'::regprocedure);
 if position('if not found then raise exception ''PROVIDER_DOCUMENT_UPLOAD_RESERVATION_REQUIRED'''in definition)=0 then raise exception 'PROVIDER_UPLOAD_HASH_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,'select lower(o.metadata->>''mimetype''),o.metadata->>''size'' into v_mime,v_size','if v_reservation.expected_content_hash is not null and new.content_hash is distinct from v_reservation.expected_content_hash then raise exception ''PROVIDER_DOCUMENT_HASH_MISMATCH''using errcode=''22000'';end if; select lower(o.metadata->>''mimetype''),o.metadata->>''size'' into v_mime,v_size');
 execute definition;
end
$migration$;

-- Filter current families before paging; historical versions remain readable by id.
create function public.list_provider_entry_documents_v1(p_provider_organization_id uuid,p_page integer default 1,p_search text default '',p_kinds text[]default '{}')returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;complete boolean;
begin
 if not private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_TECHNICIAN','PROVIDER_ACCOUNTING','PROVIDER_VIEWER'],auth.uid())then raise exception 'PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or p_search is null or length(p_search)>120 or p_kinds is null or cardinality(p_kinds)>9 or exists(select 1 from unnest(p_kinds)kind where kind is null or kind not in('LEGAL','FISCAL','INSURANCE','CERTIFICATION','LICENSE','ACCREDITATION','REFERENCE','PORTFOLIO','PARTNER_CONTRACT'))then raise exception 'INVALID_PROVIDER_DOCUMENT_FILTER'using errcode='22023';end if;
 with current_documents as(select d.*,f.code,f.document_kind from public.provider_document_families f join lateral(select v.*from public.provider_document_versions v where v.family_id=f.id order by v.version_number desc limit 1)d on true where f.provider_organization_id=p_provider_organization_id),filtered as(select*from current_documents where(cardinality(p_kinds)=0 or document_kind=any(p_kinds))and(p_search=''or strpos(lower(code||' '||document_kind||' '||status),lower(btrim(p_search)))>0)),paged as(select*from filtered order by created_at desc,id offset(p_page-1)*30 limit 31)
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',d.id,'version_number',d.version_number,'status',d.status,'expires_on',d.expires_on,'storage_object_path',d.storage_object_path,'provider_document_families',jsonb_build_object('document_kind',d.document_kind,'code',d.code))order by d.created_at desc,d.id),'[]'::jsonb))into result from paged d;
 select count(distinct f.document_kind)=3 into complete from public.provider_document_families f join lateral(select v.*from public.provider_document_versions v where v.family_id=f.id order by v.version_number desc limit 1)d on true where f.provider_organization_id=p_provider_organization_id and f.document_kind in('LEGAL','FISCAL','INSURANCE')and d.status='VERIFIED'and(d.expires_on is null or d.expires_on>current_date)and private.provider_document_is_clean(d.storage_object_path,d.content_hash);
 return result||jsonb_build_object('required_documents_complete',complete);
end$$;
revoke all on function public.list_provider_entry_documents_v1(uuid,integer,text,text[])from public,anon,authenticated,service_role;
grant execute on function public.list_provider_entry_documents_v1(uuid,integer,text,text[])to authenticated;
notify pgrst,'reload schema';

commit;
