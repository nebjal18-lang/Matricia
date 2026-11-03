begin;
-- MAT-FUNC-014/020/027. Keep revisions immutable, scoped and restartable.
-- A clean scan is a technical prerequisite, never a legal verification.
create table public.quote_attachments (
 id uuid primary key default extensions.gen_random_uuid(),
 quote_version_id uuid not null references public.quote_versions(id),
 provider_organization_id uuid not null references public.organizations(id),
 document_version_id uuid not null references public.provider_document_versions(id),
 title text not null check(length(btrim(title)) between 2 and 255),
 source_sha256 text not null check(source_sha256~'^[0-9a-f]{64}$'),
 shared_by uuid not null references auth.users(id),
 shared_at timestamptz not null default clock_timestamp(),
 unique(quote_version_id,document_version_id)
);
alter table public.quote_attachments enable row level security;
revoke all on public.quote_attachments from public,anon,authenticated,service_role;
grant select on public.quote_attachments to authenticated;
create policy quote_attachments_read on public.quote_attachments for select to authenticated using(exists(
 select 1 from public.quote_versions v where v.id=quote_version_id and private.can_read_quote(v.quote_id,auth.uid())
 and(private.has_org_role(v.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_VIEWER'],auth.uid()) or v.submitted_at is not null)
));
create trigger quote_attachments_immutable before update or delete on public.quote_attachments for each row execute function private.prevent_update_delete();
create index quote_attachments_version_idx on public.quote_attachments(quote_version_id,id);

create function private.check_quote_attachment_publication_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare item record;state text;begin
 if new.submitted_at is not null and old.submitted_at is null then
  for item in select a.source_sha256,d.content_hash,d.storage_object_path from public.quote_attachments a join public.provider_document_versions d on d.id=a.document_version_id and d.provider_organization_id=a.provider_organization_id where a.quote_version_id=new.id loop
   select scan_status into state from public.provider_document_scan_jobs where storage_object_path=item.storage_object_path for share;
   if state is distinct from'CLEAN'or item.source_sha256 is distinct from item.content_hash then raise exception'QUOTE_ATTACHMENT_QUARANTINED'using errcode='55000';end if;
  end loop;
 end if;
 return new;
end$$;
revoke all on function private.check_quote_attachment_publication_v1()from public,anon,authenticated,service_role;
create trigger quote_attachment_publication_guard before update of submitted_at,lifecycle_status on public.quote_versions for each row execute function private.check_quote_attachment_publication_v1();

create function private.assert_provider_quote_extras_v1(p_payload jsonb,p_org uuid,p_previous_version uuid)returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare item jsonb;doc public.provider_document_versions%rowtype;scan text;
begin
 if jsonb_array_length(p_payload->'items')>50 then raise exception'QUOTE_TOO_MANY_LINES'using errcode='22023';end if;
 if jsonb_typeof(coalesce(p_payload->'options','[]'))is distinct from'array' or jsonb_array_length(coalesce(p_payload->'options','[]'))>20 then raise exception'QUOTE_OPTIONS_INVALID'using errcode='22023';end if;
 if jsonb_array_length(coalesce(p_payload->'options','[]'))>0 and p_payload#>'{sla,quote_options_pricing_v1}'is distinct from'{"basis":"EXCLUDING_TAX","included_in_base_total":false,"activation":"NEW_TAXED_QUOTE_VERSION"}'::jsonb then raise exception'QUOTE_OPTION_PRICING_BASIS_REQUIRED'using errcode='22023';end if;
 if jsonb_array_length(coalesce(p_payload->'options','[]'))>0 and exists(select 1 from public.quote_options where quote_version_id=p_previous_version)and exists(select 1 from public.quote_versions v where v.id=p_previous_version and v.sla#>'{quote_options_pricing_v1}'is distinct from'{"basis":"EXCLUDING_TAX","included_in_base_total":false,"activation":"NEW_TAXED_QUOTE_VERSION"}'::jsonb)and p_payload#>'{sla,quote_options_repricing_confirmed_v1}'is distinct from'true'::jsonb then raise exception'QUOTE_HISTORICAL_OPTION_REPRICING_CONFIRMATION_REQUIRED'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_payload->'options','[]'))x group by x->>'option_key' having count(*)>1)then raise exception'QUOTE_OPTION_DUPLICATE'using errcode='22023';end if;
 for item in select value from jsonb_array_elements(coalesce(p_payload->'options','[]'))loop
  if jsonb_typeof(item)is distinct from'object' or coalesce(item->>'option_key','')!~'^[A-Z][A-Z0-9_]{1,63}$'or length(btrim(coalesce(item->>'label_fr','')))not between 2 and 500 or coalesce(item->>'amount_minor','')!~'^[0-9]{1,18}$'or item->>'currency'is distinct from p_payload->>'currency'or item->'included_by_default'is distinct from'false'::jsonb then raise exception'QUOTE_OPTION_INVALID'using errcode='22023';end if;
 end loop;
 if jsonb_typeof(coalesce(p_payload->'attachments','[]'))is distinct from'array'or jsonb_array_length(coalesce(p_payload->'attachments','[]'))>20 then raise exception'QUOTE_ATTACHMENTS_INVALID'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_payload->'attachments','[]'))x group by x->>'document_version_id' having count(*)>1)then raise exception'QUOTE_ATTACHMENT_DUPLICATE'using errcode='22023';end if;
 for item in select value from jsonb_array_elements(coalesce(p_payload->'attachments','[]'))loop
  if jsonb_typeof(item)is distinct from'object'or coalesce(item->>'document_version_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or length(btrim(coalesce(item->>'title','')))not between 2 and 255 or item->'share_confirmed'is distinct from'true'::jsonb then raise exception'QUOTE_ATTACHMENT_CONSENT_REQUIRED'using errcode='22023';end if;
  select d.*into doc from public.provider_document_versions d join public.provider_document_families f on f.id=d.family_id where d.id=(item->>'document_version_id')::uuid and d.provider_organization_id=p_org and f.document_kind in('PORTFOLIO','REFERENCE');
  if not found then raise exception'QUOTE_ATTACHMENT_SCOPE_DENIED'using errcode='42501';end if;
  select scan_status into scan from public.provider_document_scan_jobs where storage_object_path=doc.storage_object_path for share;
  if scan is distinct from'CLEAN'then raise exception'QUOTE_ATTACHMENT_QUARANTINED'using errcode='55000';end if;
 end loop;
end$$;
revoke all on function private.assert_provider_quote_extras_v1(jsonb,uuid,uuid)from public,anon,authenticated,service_role;

-- Extend only the proven writer. Existing authorization, exact fiscal mapping,
-- RFQ lock/deadline, CAS, audit, outbox and idempotency remain in place.
do $$declare definition text;marker text;begin
 definition:=pg_get_functiondef('private.assert_quote_payload(jsonb)'::regprocedure);
 marker:='''items'',''options'']';
 if position(marker in definition)=0 then raise exception'QUOTE_PAYLOAD_EXTRAS_PATCH_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,'''items'',''options'',''attachments'']');
 definition:=pg_get_functiondef('public.create_quote_revision_legacy_0156(uuid,jsonb,text,text,uuid)'::regprocedure);
 marker:='elsif v_quote.status not in(''DRAFT'',''REVISION_REQUESTED'',''REVISED'')';
 if position(marker in definition)=0 then raise exception'QUOTE_VOLUNTARY_REVISION_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,marker,'elsif v_quote.status not in(''DRAFT'',''REVISION_REQUESTED'',''REVISED'',''SUBMITTED'')');
 marker:=' select coalesce(max(version_number),0)+1 into v_number';
 if position(marker in definition)=0 then raise exception'QUOTE_EXTRAS_VALIDATION_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,marker,' perform private.assert_provider_quote_extras_v1(p_payload,v_rp.provider_organization_id,v_quote.current_version_id);'||chr(10)||marker);
 marker:=' update public.quotes set current_version_id=v_version';
 if position(marker in definition)=0 then raise exception'QUOTE_EXTRAS_WRITE_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,marker,$patch$
 insert into public.quote_options(quote_version_id,option_key,label_fr,label_ar,amount_minor,currency,included_by_default)
 select v_version,x->>'option_key',btrim(x->>'label_fr'),nullif(btrim(x->>'label_ar'),''),(x->>'amount_minor')::bigint,p_payload->>'currency',false from jsonb_array_elements(coalesce(p_payload->'options','[]'))x;
 insert into public.quote_attachments(quote_version_id,provider_organization_id,document_version_id,title,source_sha256,shared_by)
 select v_version,v_rp.provider_organization_id,d.id,btrim(x->>'title'),d.content_hash,v_actor from jsonb_array_elements(coalesce(p_payload->'attachments','[]'))x join public.provider_document_versions d on d.id=(x->>'document_version_id')::uuid and d.provider_organization_id=v_rp.provider_organization_id;
$patch$||marker);
 execute definition;
end$$;

create function public.list_provider_quote_attachment_choices_v1(p_organization_id uuid,p_query text default'',p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;n bigint;begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_VIEWER'],auth.uid())then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page<1 or p_page>100000 or length(coalesce(p_query,''))>200 then raise exception'QUOTE_SEARCH_INVALID'using errcode='22023';end if;
 select count(*)into n from public.provider_document_versions d join public.provider_document_families f on f.id=d.family_id join public.provider_document_scan_jobs s on s.storage_object_path=d.storage_object_path where d.provider_organization_id=p_organization_id and s.scan_status='CLEAN'and f.document_kind in('PORTFOLIO','REFERENCE') and strpos(lower(f.code||' '||coalesce(d.reference_number,'')),lower(btrim(coalesce(p_query,''))))>0;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]')into result from(select d.id,f.code,d.version_number,d.status review_status,s.scan_status from public.provider_document_versions d join public.provider_document_families f on f.id=d.family_id join public.provider_document_scan_jobs s on s.storage_object_path=d.storage_object_path where d.provider_organization_id=p_organization_id and s.scan_status='CLEAN'and f.document_kind in('PORTFOLIO','REFERENCE')and strpos(lower(f.code||' '||coalesce(d.reference_number,'')),lower(btrim(coalesce(p_query,''))))>0 order by d.created_at desc,d.id desc offset((p_page-1)*25)limit 25)x;
 return jsonb_build_object('items',result,'total',n,'page',p_page);
end$$;
revoke all on function public.list_provider_quote_attachment_choices_v1(uuid,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_provider_quote_attachment_choices_v1(uuid,text,integer)to authenticated;

create function public.authorize_quote_attachment_download_v1(p_attachment_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare a public.quote_attachments%rowtype;v public.quote_versions%rowtype;d public.provider_document_versions%rowtype;s text;begin
 select*into a from public.quote_attachments where id=p_attachment_id;
 select*into v from public.quote_versions where id=a.quote_version_id;
 if auth.uid()is null or a.id is null or not private.can_read_quote(v.quote_id,auth.uid())or(not private.has_org_role(v.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_VIEWER'],auth.uid())and v.submitted_at is null)then raise exception'QUOTE_ATTACHMENT_SCOPE_DENIED'using errcode='42501';end if;
 select*into d from public.provider_document_versions where id=a.document_version_id and provider_organization_id=a.provider_organization_id and content_hash=a.source_sha256;
 select scan_status into s from public.provider_document_scan_jobs where storage_object_path=d.storage_object_path for share;
 if d.id is null or s is distinct from'CLEAN'then raise exception'QUOTE_ATTACHMENT_QUARANTINED'using errcode='55000';end if;
 return jsonb_build_object('attachment_id',a.id,'title',a.title,'bucket','provider-qualification','object_path',d.storage_object_path,'sha256',d.content_hash,'mime_type',d.metadata->>'declared_mime_type','size_bytes',d.metadata->>'declared_size_bytes');
end$$;
revoke all on function public.authorize_quote_attachment_download_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.authorize_quote_attachment_download_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
