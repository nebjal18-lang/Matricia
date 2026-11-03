begin;
-- Source PDFs are immutable renditions, never a certificate or a claim of signature.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('signature-source-documents','signature-source-documents',false,20971520,array['application/pdf'])on conflict(id)do nothing;
alter table private.contract_signature_source_artifacts_v1 add column locale text check(locale in('fr','ar')),add column render_version text,add column size_bytes bigint check(size_bytes between 1 and 20971520);
create unique index signature_source_archive_locale_unique on private.contract_signature_source_artifacts_v1(source_kind,source_id,locale)where locale is not null;
create policy signature_source_private_only on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'signature-source-documents')with check(bucket_id<>'signature-source-documents');
-- Existing unclassified artifacts remain unclassified; no language/readback proof is backfilled.
create function private.signature_source_artifact_json_v1(a private.contract_signature_source_artifacts_v1)returns jsonb language sql immutable set search_path=pg_catalog as $$select jsonb_build_object('id',a.id,'locale',a.locale,'source_hash',a.source_hash,'parties_hash',a.parties_hash,'pdf_sha256',a.pdf_sha256,'storage_path',a.storage_path,'size_bytes',a.size_bytes,'render_version',a.render_version)$$;
create function private.recompute_signature_document_version_hash_v1(p_version_id uuid)returns text language plpgsql stable security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare v public.contract_versions%rowtype;b public.contract_versions%rowtype;am public.contract_amendments%rowtype;cr public.change_requests%rowtype;computed text;expected_request jsonb;expected_items jsonb;actual_items jsonb;n integer:=0;
begin
 select*into v from public.contract_versions where id=p_version_id;if v.id is null then return null;end if;
 loop
  n:=n+1;if n>1000 then return null;end if;
  computed:=private.recompute_contract_document_source_hash_v1(v.id);
  if computed is not null then return case when computed=v.content_hash then (select content_hash from public.contract_versions where id=p_version_id)else null end;end if;
  -- The sole fallback is an actual activated amendment, never arbitrary legacy JSON.
  select*into am from public.contract_amendments where activated_contract_version_id=v.id and contract_id=v.contract_id and status='ACTIVE';
  select*into b from public.contract_versions where id=am.base_contract_version_id and contract_id=v.contract_id and version=v.version-1;
  select*into cr from public.change_requests where id=am.change_request_id and contract_id=v.contract_id and status='ACCEPTED';
  if am.id is null or b.id is null or cr.id is null or am.activated_at is null then return null;end if;
  if am.content_hash is distinct from private.canonical_request_hash(jsonb_build_object('contract',v.contract_id,'reason',cr.reason,'scope',cr.scope_delta,'price_delta_minor',am.price_delta_minor,'deadline_delta_days',am.deadline_delta_days,'deliverables',am.deliverables_delta,'commission',am.commission_rule_snapshot))then return null;end if;
  expected_request:=b.request_snapshot||jsonb_build_object('amendment_id',am.id,'scope_delta',cr.scope_delta,'deadline_delta_days',am.deadline_delta_days);
  computed:=private.canonical_request_hash(jsonb_build_object('contract',v.contract_id,'version',v.version,'request',expected_request,'quote',b.quote_snapshot,'clauses',b.clauses,'price_minor',b.price_minor::numeric+am.price_delta_minor,'currency',b.currency,'commission',am.commission_rule_snapshot,'amendment_hash',am.content_hash));
  if computed is distinct from v.content_hash or v.selected_quote_version_id is distinct from b.selected_quote_version_id or v.request_snapshot is distinct from expected_request or v.quote_snapshot is distinct from b.quote_snapshot or v.clauses is distinct from b.clauses or v.price_minor::numeric is distinct from b.price_minor::numeric+am.price_delta_minor or v.currency is distinct from b.currency or v.commission_rule_snapshot is distinct from am.commission_rule_snapshot or am.commission_rule_snapshot is distinct from b.commission_rule_snapshot or private.contract_signature_parties_hash_v1(v.id)is distinct from private.contract_signature_parties_hash_v1(b.id)then return null;end if;
  select coalesce(jsonb_agg(x order by x->>'item_key'),'[]')into expected_items from(
   select jsonb_build_object('item_key',i.item_key,'item_type',i.item_type,'label_fr',i.label_fr,'label_ar',i.label_ar,'details',i.details,'sort_order',i.sort_order)x from public.contract_items i where i.contract_version_id=b.id and not exists(select 1 from jsonb_array_elements(am.deliverables_delta)d where d->>'item_key'=i.item_key and d->>'operation'in('REMOVE','REPLACE'))
   union all select jsonb_build_object('item_key',d->>'item_key','item_type',d->>'item_type','label_fr',d->>'label_fr','label_ar',d->>'label_ar','details',coalesce(d->'details','{}'),'sort_order',(d->>'sort_order')::integer)from jsonb_array_elements(am.deliverables_delta)d where d->>'operation'in('ADD','REPLACE'))items;
  select coalesce(jsonb_agg(jsonb_build_object('item_key',item_key,'item_type',item_type,'label_fr',label_fr,'label_ar',label_ar,'details',details,'sort_order',sort_order)order by item_key),'[]')into actual_items from public.contract_items where contract_version_id=v.id;
  if actual_items is distinct from expected_items then return null;end if;
  v:=b;
 end loop;
exception when numeric_value_out_of_range or invalid_text_representation then return null;
end$$;
create function private.signature_document_source_v1(p_kind text,p_source_id uuid,p_actor uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare v public.contract_versions%rowtype;c public.contracts%rowtype;am public.contract_amendments%rowtype;cr public.change_requests%rowtype;source_hash text;party_value jsonb;items jsonb;applied jsonb:='[]';walk public.contract_versions%rowtype;prior public.contract_amendments%rowtype;result jsonb;n integer:=0;
begin
 if p_kind='CONTRACT'then select*into v from public.contract_versions where id=p_source_id;
 elsif p_kind='AMENDMENT'then select*into am from public.contract_amendments where id=p_source_id;select*into v from public.contract_versions where id=am.base_contract_version_id;else raise exception'SIGNATURE_DOCUMENT_NOT_FOUND'using errcode='42501';end if;
 select*into c from public.contracts where id=v.contract_id;
 if p_actor is null or c.id is null or not private.contract_party_access(c.id,p_actor)then raise exception'SIGNATURE_DOCUMENT_NOT_FOUND'using errcode='42501';end if;
 if private.recompute_signature_document_version_hash_v1(v.id)is distinct from v.content_hash then raise exception'SIGNATURE_CANONICAL_DOCUMENT_SOURCE_REQUIRED'using errcode='55000';end if;
 source_hash:=v.content_hash;
 if p_kind='AMENDMENT'then
  select*into cr from public.change_requests where id=am.change_request_id and contract_id=c.id;
  if am.contract_id is distinct from c.id or cr.id is null or am.content_hash is distinct from private.canonical_request_hash(jsonb_build_object('contract',c.id,'reason',cr.reason,'scope',cr.scope_delta,'price_delta_minor',am.price_delta_minor,'deadline_delta_days',am.deadline_delta_days,'deliverables',am.deliverables_delta,'commission',am.commission_rule_snapshot))or am.commission_rule_snapshot is distinct from v.commission_rule_snapshot or v.price_minor::numeric+am.price_delta_minor not between 0 and 9223372036854775807 then raise exception'SIGNATURE_CANONICAL_DOCUMENT_SOURCE_REQUIRED'using errcode='55000';end if;
  source_hash:=am.content_hash;
 end if;
 select jsonb_agg(jsonb_build_object('party_role',party_role,'organization_id',organization_id,'legal_snapshot',legal_snapshot)order by party_role)into party_value from public.contract_parties where contract_version_id=v.id;
 select coalesce(jsonb_agg(jsonb_build_object('item_key',item_key,'item_type',item_type,'label_fr',label_fr,'label_ar',label_ar,'details_canonical',details::text,'sort_order',sort_order)order by sort_order,item_key),'[]')into items from public.contract_items where contract_version_id=v.id;
 walk:=v;loop n:=n+1;if n>1000 then raise exception'SIGNATURE_CANONICAL_DOCUMENT_SOURCE_REQUIRED'using errcode='55000';end if;
  select*into prior from public.contract_amendments where activated_contract_version_id=walk.id and contract_id=c.id and status='ACTIVE';exit when prior.id is null;
  applied:=jsonb_build_array(jsonb_build_object('id',prior.id,'number',prior.amendment_number,'price_delta_minor',prior.price_delta_minor::text,'deadline_delta_days',prior.deadline_delta_days,'source_hash',prior.content_hash))||applied;
  select*into walk from public.contract_versions where id=prior.base_contract_version_id;
 end loop;
 result:=jsonb_build_object('source_kind',p_kind,'source_id',p_source_id,'source_hash',source_hash,'parties_hash',private.contract_signature_parties_hash_v1(v.id),'contract_id',c.id,'contract_version_id',v.id,'contract_version',v.version,'created_at',case when p_kind='AMENDMENT'then am.created_at else v.created_at end,'price_minor',case when p_kind='AMENDMENT'then(v.price_minor::numeric+am.price_delta_minor)::text else v.price_minor::text end,'currency',v.currency,'parties',party_value,'clauses',v.clauses,'commission',v.commission_rule_snapshot,'quote',v.quote_snapshot,'contract_items',items,'request_snapshot_canonical',v.request_snapshot::text,'quote_snapshot_canonical',v.quote_snapshot::text,'commission_snapshot_canonical',v.commission_rule_snapshot::text,'parties_snapshot_canonical',party_value::text,'applied_amendments',applied,'amendment',case when p_kind='AMENDMENT'then jsonb_build_object('id',am.id,'number',am.amendment_number,'reason',cr.reason,'scope_canonical',cr.scope_delta::text,'price_delta_minor',am.price_delta_minor::text,'deadline_delta_days',am.deadline_delta_days,'deliverables_canonical',am.deliverables_delta::text,'commission_canonical',am.commission_rule_snapshot::text)else null end);
 if octet_length(result::text)>8388608 then raise exception'SIGNATURE_DOCUMENT_SOURCE_TOO_LARGE'using errcode='54000';end if;
 return result;
end$$;
create function private.assert_signature_document_reader_v1(p_contract_id uuid)returns void language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.uid()is null or not private.contract_party_access(p_contract_id,auth.uid())then raise exception'SIGNATURE_DOCUMENT_NOT_FOUND'using errcode='42501';end if;
 if not exists(select 1 from public.contracts c where c.id=p_contract_id and(private.is_active_org_member(c.client_organization_id,auth.uid())or private.is_active_org_member(c.provider_organization_id,auth.uid())))and auth.jwt()->>'aal'is distinct from'aal2'then raise exception'SIGNATURE_DOCUMENT_AAL2_REQUIRED'using errcode='42501';end if;
end$$;
create function public.get_contract_signature_document_source_v1(p_contract_id uuid,p_contract_version_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare version_id uuid;begin
 perform private.assert_signature_document_reader_v1(p_contract_id);select v.id into version_id from public.contract_versions v join public.contracts c on c.id=v.contract_id where c.id=p_contract_id and(case when p_contract_version_id is null then v.version=c.current_version else v.id=p_contract_version_id end);
 return private.signature_document_source_v1('CONTRACT',version_id,auth.uid());
end$$;
create function public.get_amendment_signature_document_source_v1(p_amendment_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare cid uuid;begin
 select contract_id into cid from public.contract_amendments where id=p_amendment_id;perform private.assert_signature_document_reader_v1(cid);return private.signature_document_source_v1('AMENDMENT',p_amendment_id,auth.uid());end$$;
create function public.get_signature_document_archive_v1(p_source_kind text,p_source_id uuid,p_locale text)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare cid uuid;a private.contract_signature_source_artifacts_v1%rowtype;begin
 if p_source_kind='CONTRACT'then select contract_id into cid from public.contract_versions where id=p_source_id;elsif p_source_kind='AMENDMENT'then select contract_id into cid from public.contract_amendments where id=p_source_id;end if;
 perform private.assert_signature_document_reader_v1(cid);if p_locale not in('fr','ar')then raise exception'INVALID_SIGNATURE_DOCUMENT_LOCALE'using errcode='22023';end if;
 select*into a from private.contract_signature_source_artifacts_v1 where source_kind=p_source_kind and source_id=p_source_id and locale=p_locale and exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.id=storage_object_id and o.bucket_id='signature-source-documents'and not b.public and o.name=storage_path and o.metadata->>'mimetype'='application/pdf'and o.metadata->>'size'=size_bytes::text);
 return case when a.id is null then null else private.signature_source_artifact_json_v1(a)end;
end$$;
create function public.register_signature_document_archive_pair_v1(p_source_kind text,p_source_id uuid,p_actor_id uuid,p_source_hash text,p_parties_hash text,p_render_version text,p_artifacts jsonb)returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare source jsonb;x jsonb;a private.contract_signature_source_artifacts_v1%rowtype;obj storage.objects%rowtype;result jsonb:='[]';expected_path text;begin
 if auth.role()is distinct from'service_role'then raise exception'SIGNATURE_ARCHIVE_SERVICE_REQUIRED'using errcode='42501';end if;
 source:=private.signature_document_source_v1(p_source_kind,p_source_id,p_actor_id);
 if source->>'source_hash'is distinct from p_source_hash or source->>'parties_hash'is distinct from p_parties_hash or p_render_version is distinct from'SIGNATURE_SOURCE_PDF_V1'or jsonb_typeof(p_artifacts)is distinct from'array'or jsonb_array_length(p_artifacts)<>2 or(select array_agg(j.value->>'locale'order by j.value->>'locale')from jsonb_array_elements(p_artifacts)j(value))is distinct from array['ar','fr']or(select count(distinct j.value->>'pdf_sha256')from jsonb_array_elements(p_artifacts)j(value))<>2 then raise exception'SIGNATURE_ARCHIVE_SOURCE_MISMATCH'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('signature-source-pdf:'||p_source_kind||':'||p_source_id::text,0));
 for x in select*from jsonb_array_elements(p_artifacts)loop
  if coalesce(x->>'pdf_sha256','')!~'^[a-f0-9]{64}$'or coalesce(x->>'size_bytes','')!~'^[0-9]{1,8}$'or(x->>'size_bytes')::bigint not between 1 and 20971520 then raise exception'SIGNATURE_ARCHIVE_INVALID'using errcode='22023';end if;
  expected_path:=lower(p_source_kind)||'/'||p_source_id::text||'/'||p_source_hash||'/'||(x->>'locale')||'/'||(x->>'pdf_sha256')||'.pdf';
  if x->>'storage_path'is distinct from expected_path then raise exception'SIGNATURE_ARCHIVE_INVALID_PATH'using errcode='23514';end if;
  select o.*into obj from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id='signature-source-documents'and not b.public and o.name=expected_path;
  if obj.id is null or obj.metadata->>'mimetype'is distinct from'application/pdf'or coalesce(obj.metadata->>'size','')!~'^[0-9]+$'or(obj.metadata->>'size')::bigint<>(x->>'size_bytes')::bigint then raise exception'SIGNATURE_ARCHIVE_OBJECT_REQUIRED'using errcode='55000';end if;
  select*into a from private.contract_signature_source_artifacts_v1 where source_kind=p_source_kind and source_id=p_source_id and locale=x->>'locale';
  if a.id is not null then
   if a.source_hash<>p_source_hash or a.parties_hash<>p_parties_hash or a.pdf_sha256<>x->>'pdf_sha256'or a.storage_path<>expected_path or a.storage_object_id<>obj.id or a.size_bytes<>(x->>'size_bytes')::bigint or a.render_version<>p_render_version then raise exception'SIGNATURE_ARCHIVE_IMMUTABLE_CONFLICT'using errcode='23514';end if;
  else
   insert into private.contract_signature_source_artifacts_v1(source_kind,source_id,contract_version_id,source_hash,parties_hash,pdf_sha256,storage_object_id,storage_path,verified_at,verification_reference,locale,render_version,size_bytes)values(p_source_kind,p_source_id,(source->>'contract_version_id')::uuid,p_source_hash,p_parties_hash,x->>'pdf_sha256',obj.id,expected_path,clock_timestamp(),'HTTP_READBACK_SHA256_V1',x->>'locale',p_render_version,(x->>'size_bytes')::bigint)returning*into a;
   insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)select c.client_organization_id,p_actor_id,'SYSTEM','signature.source_pdf_archived','contract_version',a.contract_version_id::text,extensions.gen_random_uuid(),jsonb_build_object('artifact_id',a.id,'source_kind',p_source_kind,'source_id',p_source_id,'locale',a.locale,'source_hash',a.source_hash,'pdf_sha256',a.pdf_sha256,'render_version',a.render_version),repeat('0',64)from public.contracts c where c.id=(source->>'contract_id')::uuid;
  end if;
  result:=result||jsonb_build_array(private.signature_source_artifact_json_v1(a));
 end loop;
 return result;
end$$;
create function private.signature_document_archive_pair_exists_v1(p_kind text,p_source uuid,p_version uuid,p_hash text,p_parties text)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select count(distinct a.locale)=2 from private.contract_signature_source_artifacts_v1 a join storage.objects o on o.id=a.storage_object_id join storage.buckets b on b.id=o.bucket_id where a.source_kind=p_kind and a.source_id=p_source and a.contract_version_id=p_version and a.source_hash=p_hash and a.parties_hash=p_parties and a.locale in('fr','ar')and a.render_version='SIGNATURE_SOURCE_PDF_V1'and a.verification_reference='HTTP_READBACK_SHA256_V1'and a.size_bytes between 1 and 20971520 and o.bucket_id='signature-source-documents'and not b.public and o.name=a.storage_path and o.metadata->>'mimetype'='application/pdf'and o.metadata->>'size'=a.size_bytes::text$$;
-- Enforce both localizations before any real READY; source binding schema stays unchanged.
create function private.guard_signature_canonical_archive_pair_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$declare p private.contract_signature_policy_versions_v1%rowtype;v public.contract_versions%rowtype;am public.contract_amendments%rowtype;kind text;source uuid;h text;begin
 if new.status<>'READY_FOR_SIGNATURE'or old.status='READY_FOR_SIGNATURE'then return new;end if;
 select*into v from public.contract_versions where id=new.contract_version_id;select*into am from public.contract_amendments where id=new.amendment_id;kind:=case when am.id is null then'CONTRACT'else'AMENDMENT'end;source:=coalesce(am.id,v.id);h:=case when am.id is null then v.content_hash else am.content_hash end;p:=private.require_contract_signature_policy_v1(kind);
 if not p.allow_development_mock and(not private.signature_document_archive_pair_exists_v1(kind,source,v.id,h,private.contract_signature_parties_hash_v1(v.id))or not exists(select 1 from private.contract_signature_source_artifacts_v1 a join public.signature_documents d on d.envelope_id=new.id and d.storage_path=a.storage_path and d.sha256=a.pdf_sha256 where a.source_kind=kind and a.source_id=source and a.locale in('fr','ar')and a.pdf_sha256=new.document_set_hash))then raise exception'SIGNATURE_DOCUMENT_ARCHIVE_PAIR_REQUIRED'using errcode='55000';end if;
 return new;
end$$;
create trigger signature_canonical_archive_pair_guard before update of status on public.signature_envelopes for each row execute function private.guard_signature_canonical_archive_pair_v1();
alter function private.contract_signature_readiness_v1(uuid,uuid)rename to contract_signature_readiness_before_archives_v1;
create function private.contract_signature_readiness_v1(p_contract_id uuid,p_amendment_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare r jsonb;p private.contract_signature_policy_versions_v1%rowtype;v public.contract_versions%rowtype;am public.contract_amendments%rowtype;kind text;source uuid;h text;begin
 r:=private.contract_signature_readiness_before_archives_v1(p_contract_id,p_amendment_id);
 if r->>'status'in('SIGNED','NOT_CONFIGURED','BLOCKED')then return r;end if;
 kind:=case when p_amendment_id is null then'CONTRACT'else'AMENDMENT'end;
 begin p:=private.require_contract_signature_policy_v1(kind);exception when sqlstate'55000'or sqlstate'42501'then return r;end;
 if p.allow_development_mock then return r;end if;
 if p_amendment_id is not null then select*into am from public.contract_amendments where id=p_amendment_id;end if;
 select v1.*into v from public.contract_versions v1 join public.contracts c on c.id=v1.contract_id where c.id=p_contract_id and(case when p_amendment_id is null then v1.version=c.current_version else v1.id=am.base_contract_version_id end);
 source:=coalesce(am.id,v.id);h:=case when am.id is null then v.content_hash else am.content_hash end;
 if not private.signature_document_archive_pair_exists_v1(kind,source,v.id,h,private.contract_signature_parties_hash_v1(v.id))then return r||jsonb_build_object('status','DOCUMENT_ARCHIVE_REQUIRED','ready',false,'reason','SIGNATURE_DOCUMENT_ARCHIVE_PAIR_REQUIRED');end if;return r;
end$$;
revoke all on function private.contract_signature_readiness_before_archives_v1(uuid,uuid),private.contract_signature_readiness_v1(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function private.signature_source_artifact_json_v1(private.contract_signature_source_artifacts_v1),private.recompute_signature_document_version_hash_v1(uuid),private.signature_document_source_v1(text,uuid,uuid),private.assert_signature_document_reader_v1(uuid),private.signature_document_archive_pair_exists_v1(text,uuid,uuid,text,text),private.guard_signature_canonical_archive_pair_v1()from public,anon,authenticated,service_role;
revoke all on function public.get_contract_signature_document_source_v1(uuid,uuid),public.get_amendment_signature_document_source_v1(uuid),public.get_signature_document_archive_v1(text,uuid,text),public.register_signature_document_archive_pair_v1(text,uuid,uuid,text,text,text,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.get_contract_signature_document_source_v1(uuid,uuid),public.get_amendment_signature_document_source_v1(uuid),public.get_signature_document_archive_v1(text,uuid,text)to authenticated;
grant execute on function public.register_signature_document_archive_pair_v1(text,uuid,uuid,text,text,text,jsonb)to service_role;
notify pgrst,'reload schema';
commit;
