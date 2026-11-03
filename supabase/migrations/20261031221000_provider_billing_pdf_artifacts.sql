-- Immutable rendered artifacts remain separate from the immutable accounting source.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('provider-billing','provider-billing',false,10485760,array['application/pdf']) on conflict(id)do nothing;
create table public.provider_billing_document_artifacts(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in('invoice','statement')),source_id uuid not null,locale text not null check(locale in('fr','ar')),
 source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),pdf_sha256 text not null check(pdf_sha256~'^[0-9a-f]{64}$'),
 storage_path text not null unique check(storage_path!~'(^|/)\.\.(/|$)'),snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 unique(kind,source_id,locale)
);
alter table public.provider_billing_document_artifacts enable row level security;
revoke all on public.provider_billing_document_artifacts from public,anon,authenticated,service_role;
grant select on public.provider_billing_document_artifacts to authenticated;
create policy provider_billing_artifact_read on public.provider_billing_document_artifacts for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid()));
create trigger provider_billing_artifact_immutable before update or delete on public.provider_billing_document_artifacts for each row execute function private.prevent_update_delete();
create function public.register_provider_billing_document_artifact(p_provider_organization_id uuid,p_kind text,p_source_id uuid,p_locale text,p_source_hash text,p_pdf_sha256 text,p_storage_path text,p_snapshot jsonb,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare result public.provider_billing_document_artifacts%rowtype;expected text;correlation uuid:=extensions.gen_random_uuid();
begin
 if auth.role() is distinct from 'service_role' or not coalesce(private.provider_billing_access(p_provider_organization_id,p_actor_id),false)then raise exception'BILLING_ARTIFACT_DENIED'using errcode='42501';end if;
 if p_kind='invoice'then select document_hash into expected from public.provider_invoices where id=p_source_id and provider_organization_id=p_provider_organization_id;
 elsif p_kind='statement'then select document_hash into expected from public.provider_statements where id=p_source_id and provider_organization_id=p_provider_organization_id;
 else raise exception'INVALID_BILLING_ARTIFACT_KIND'using errcode='22023';end if;
 if expected is null or expected<>p_source_hash or (p_snapshot->>'sourceHash') is distinct from expected then raise exception'BILLING_ARTIFACT_SOURCE_MISMATCH'using errcode='22000';end if;
 if p_storage_path is distinct from p_provider_organization_id::text||'/'||p_kind||'/'||p_source_id::text||'/'||p_locale||'/'||p_pdf_sha256||'.pdf'then raise exception'BILLING_ARTIFACT_PATH_MISMATCH'using errcode='22000';end if;
 if not exists(select 1 from storage.objects where bucket_id='provider-billing'and name=p_storage_path and metadata->>'mimetype'='application/pdf')then raise exception'BILLING_ARTIFACT_UPLOAD_REQUIRED'using errcode='23514';end if;
 insert into public.provider_billing_document_artifacts(provider_organization_id,kind,source_id,locale,source_hash,pdf_sha256,storage_path,snapshot,created_by)
 values(p_provider_organization_id,p_kind,p_source_id,p_locale,p_source_hash,p_pdf_sha256,p_storage_path,p_snapshot,p_actor_id)on conflict(kind,source_id,locale)do nothing returning * into result;
 if found then
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_provider_organization_id,p_actor_id,'USER','provider.billing.pdf.archived','provider_billing_document_artifact',result.id::text,correlation,jsonb_build_object('source_id',p_source_id,'kind',p_kind,'locale',p_locale,'source_hash',p_source_hash,'pdf_sha256',p_pdf_sha256),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_provider_organization_id,'provider_billing_document_artifact',result.id::text,'ProviderBillingPdfArchivedV1',correlation,jsonb_build_object('artifact_id',result.id,'source_id',p_source_id,'kind',p_kind,'locale',p_locale,'pdf_sha256',p_pdf_sha256),'provider-billing-pdf:'||p_kind||':'||p_source_id::text||':'||p_locale);
 end if;
 select * into result from public.provider_billing_document_artifacts where kind=p_kind and source_id=p_source_id and locale=p_locale;
 return jsonb_build_object('storage_path',result.storage_path,'pdf_sha256',result.pdf_sha256);
end$$;
revoke all on function public.register_provider_billing_document_artifact(uuid,text,uuid,text,text,text,text,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.register_provider_billing_document_artifact(uuid,text,uuid,text,text,text,text,jsonb,uuid)to service_role;
