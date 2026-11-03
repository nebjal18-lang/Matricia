-- Private evidence and exact closure exports. Both successful and denied attempts are audited.
create function public.franchise_document_reference(p_franchise_id uuid,p_document_id uuid,p_action text default 'VIEW')returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();f public.franchises%rowtype;d public.provider_document_versions%rowtype;r public.provider_document_upload_reservations%rowtype;allowed boolean:=false;response jsonb;code text;provider_name text;
begin
 if a is null then return jsonb_build_object('outcome','DENIED');end if;
 if p_action not in('VIEW','PREVIEW','DOWNLOAD')then raise exception 'INVALID_DOCUMENT_ACCESS_ACTION'using errcode='22023';end if;
 select * into f from public.franchises where id=p_franchise_id;
 if found and private.active_franchise_messaging_scope(f.id,a)then
  select version.*into d from public.provider_document_versions version where version.id=p_document_id and exists(
   select 1 from public.provider_document_service_links link join public.provider_services service on service.id=link.provider_service_id join public.catalog_services catalog on catalog.id=service.service_id
   where link.document_version_id=version.id and catalog.library_id=f.library_id);
  if found then
   select *into r from public.provider_document_upload_reservations reservation where reservation.document_version_id=d.id and reservation.status='BOUND'and reservation.storage_object_path=d.storage_object_path;
   allowed:=found and private.provider_document_is_clean(d.storage_object_path,d.content_hash)and exists(select 1 from storage.objects object where object.bucket_id='provider-qualification'and object.name=d.storage_object_path);
  end if;
 end if;
 if f.id is not null then
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(f.operator_organization_id,a,'USER','franchise.document.access','provider_document_version',p_document_id::text,extensions.gen_random_uuid(),jsonb_build_object('franchise_id',f.id,'outcome',case when allowed then'ALLOWED'else'DENIED'end,'access_action',p_action),repeat('0',64));
 end if;
 if not allowed then return jsonb_build_object('outcome','DENIED');end if;
 select family.code into code from public.provider_document_families family where family.id=d.family_id;
 select organization.display_name into provider_name from public.organizations organization where organization.id=d.provider_organization_id;
 response:=jsonb_build_object('outcome','ALLOWED','id',d.id,'code',code,'providerName',provider_name,'version',d.version_number,'status',case when d.expires_on<current_date then'EXPIRED'else d.status end,'expiresOn',d.expires_on,'contentHash',d.content_hash,'bucket',r.storage_bucket,'path',r.storage_object_path,'mimeType',r.declared_mime_type,'sizeBytes',r.declared_size_bytes,
 'accessHistory',coalesce((select jsonb_agg(jsonb_build_object('at',x.created_at,'outcome',x.metadata->>'outcome','action',x.metadata->>'access_action')order by x.created_at desc)from(select event.occurred_at as created_at,event.metadata from public.audit_events event where event.resource_type='provider_document_version'and event.resource_id=d.id::text and event.action='franchise.document.access'and event.organization_id=f.operator_organization_id order by event.occurred_at desc limit 20)x),'[]'::jsonb));
 return response;
end$$;
create function private.franchise_document_download_allowed(p_document_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.provider_document_versions version where version.id=p_document_id and private.franchise_supervises_document_version(version.id,p_actor)and private.provider_document_is_clean(version.storage_object_path,version.content_hash))
$$;
revoke all on function private.franchise_document_download_allowed(uuid,uuid)from public,anon,service_role;
grant execute on function private.franchise_document_download_allowed(uuid,uuid)to authenticated;
create policy provider_qualification_storage_franchise_read on storage.objects for select to authenticated using(
 bucket_id='provider-qualification'and exists(select 1 from public.provider_document_versions version where version.storage_object_path=name and private.franchise_document_download_allowed(version.id)));


create function public.franchise_statement_export(p_franchise_id uuid,p_closure_id uuid,p_format text default 'VIEW')returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();f public.franchises%rowtype;c public.franchise_profit_closure_versions%rowtype;b public.franchise_pnl_books%rowtype;allocation public.franchise_profit_allocations%rowtype;allowed boolean:=false;beneficiary text;response jsonb;
begin
 if a is null then return jsonb_build_object('outcome','DENIED');end if;
 if p_format not in('VIEW','CSV')then raise exception 'INVALID_STATEMENT_FORMAT'using errcode='22023';end if;
 select *into f from public.franchises where id=p_franchise_id;
 if found and private.active_franchise_messaging_scope(f.id,a)then
  select *into c from public.franchise_profit_closure_versions where id=p_closure_id;
  if found then
   select *into b from public.franchise_pnl_books where id=c.book_id and library_id=f.library_id and franchise_organization_id=f.operator_organization_id;
   allowed:=found and private.franchise_book_access(b.id,a);
  end if;
 end if;
 if allowed then
  beneficiary:=case when b.franchise_type='IT'then'HATIM_AHMITECH'else'FRANCHISEE'end;
  select *into allocation from public.franchise_profit_allocations where closure_version_id=c.id and beneficiary_code=beneficiary;
  allowed:=found;
 end if;
 if f.id is not null then
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(f.operator_organization_id,a,'USER','franchise.statement.access','franchise_profit_closure',p_closure_id::text,extensions.gen_random_uuid(),jsonb_build_object('franchise_id',f.id,'outcome',case when allowed then'ALLOWED'else'DENIED'end,'format',p_format),repeat('0',64));
 end if;
 if not allowed then return jsonb_build_object('outcome','DENIED');end if;
 response:=jsonb_build_object('outcome','ALLOWED','id',c.id,'bookId',b.id,'version',c.version,'periodStart',c.period_start,'periodEnd',c.period_end,'currency',b.currency,'revenueMinor',c.gross_revenue_ex_tax_minor::text,'costsMinor',c.costs_and_refunds_minor::text,'profitMinor',c.distributable_profit_minor::text,'shareMinor',allocation.amount_minor::text,'contentHash',c.content_hash,'cutoffAt',c.entry_cutoff_at,'closedAt',c.closed_at,'ruleVersionId',c.rule_version_id,
 'proofs',coalesce((select jsonb_agg(jsonb_build_object('referenceType',entry.reference_type,'referenceId',entry.reference_id,'proofHash',entry.proof_hash,'amountMinor',entry.amount_minor::text)order by entry.id)from public.franchise_distribution_ledger_entries entry where entry.closure_version_id=c.id and entry.beneficiary_code=beneficiary),'[]'::jsonb),
 'accessHistory',coalesce((select jsonb_agg(jsonb_build_object('at',x.created_at,'outcome',x.metadata->>'outcome','action',x.metadata->>'format')order by x.created_at desc)from(select event.occurred_at as created_at,event.metadata from public.audit_events event where event.resource_type='franchise_profit_closure'and event.resource_id=c.id::text and event.action='franchise.statement.access'and event.organization_id=f.operator_organization_id order by event.occurred_at desc limit 20)x),'[]'::jsonb));
 return response;
end$$;
revoke all on function public.franchise_document_reference(uuid,uuid,text),public.franchise_statement_export(uuid,uuid,text)from public,anon,service_role;
grant execute on function public.franchise_document_reference(uuid,uuid,text),public.franchise_statement_export(uuid,uuid,text)to authenticated;
