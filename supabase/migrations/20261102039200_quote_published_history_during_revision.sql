begin;
-- A working revision must not erase the previously published offer or expose
-- the new draft to the Client. Selection still checks the current published CAS.
alter table public.quotes add column last_published_version_id uuid;
alter table public.quotes add constraint quote_last_published_version_fk foreign key(last_published_version_id,id)references public.quote_versions(id,quote_id);
update public.quotes q set last_published_version_id=(select v.id from public.quote_versions v where v.quote_id=q.id and v.submitted_at is not null order by v.version_number desc limit 1);
create function private.keep_last_published_quote_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.status='SUBMITTED'and exists(select 1 from public.quote_versions v where v.id=new.current_version_id and v.quote_id=new.id and v.submitted_at is not null)then new.last_published_version_id:=new.current_version_id;
 elsif tg_op='UPDATE'then new.last_published_version_id:=old.last_published_version_id;
 else new.last_published_version_id:=null;
 end if;
 return new;
end$$;
revoke all on function private.keep_last_published_quote_v1()from public,anon,authenticated,service_role;
create trigger quote_last_published_version before insert or update on public.quotes for each row execute function private.keep_last_published_quote_v1();

create or replace function private.can_read_quote(p_quote_id uuid,p_user_id uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.quotes q join public.rfqs r on r.id=q.rfq_id join public.service_requests sr on sr.id=r.request_id where q.id=p_quote_id and(
 private.has_org_role(q.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_VIEWER'],p_user_id)
 or((q.status in('SUBMITTED','REVISION_REQUESTED','SELECTED','NOT_SELECTED','WITHDRAWN','EXPIRED')or(q.status='REVISED'and q.last_published_version_id is not null))and private.has_org_role(sr.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_VIEWER'],p_user_id))
 or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR'],p_user_id)))
$$;
create function private.can_read_quote_version_v1(p_version_id uuid,p_user_id uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.quote_versions v where v.id=p_version_id and private.can_read_quote(v.quote_id,p_user_id)and(
 private.has_org_role(v.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_VIEWER'],p_user_id)
 or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR'],p_user_id)
 or v.submitted_at is not null))
$$;
revoke all on function private.can_read_quote_version_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function private.can_read_quote_version_v1(uuid,uuid)to authenticated;
alter policy quote_versions_read on public.quote_versions using(private.can_read_quote_version_v1(id,auth.uid()));
alter policy quote_items_read on public.quote_items using(private.can_read_quote_version_v1(quote_version_id,auth.uid()));
alter policy quote_options_read on public.quote_options using(private.can_read_quote_version_v1(quote_version_id,auth.uid()));
alter policy quote_attachments_read on public.quote_attachments using(private.can_read_quote_version_v1(quote_version_id,auth.uid()));

create or replace function public.authorize_quote_attachment_download_v1(p_attachment_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare a public.quote_attachments%rowtype;d public.provider_document_versions%rowtype;s text;begin
 select*into a from public.quote_attachments where id=p_attachment_id;
 if auth.uid()is null or a.id is null or not private.can_read_quote_version_v1(a.quote_version_id,auth.uid())then raise exception'QUOTE_ATTACHMENT_SCOPE_DENIED'using errcode='42501';end if;
 select*into d from public.provider_document_versions where id=a.document_version_id and provider_organization_id=a.provider_organization_id and content_hash=a.source_sha256;
 select scan_status into s from public.provider_document_scan_jobs where storage_object_path=d.storage_object_path for share;
 if d.id is null or s is distinct from'CLEAN'then raise exception'QUOTE_ATTACHMENT_QUARANTINED'using errcode='55000';end if;
 return jsonb_build_object('attachment_id',a.id,'title',a.title,'bucket','provider-qualification','object_path',d.storage_object_path,'sha256',d.content_hash,'mime_type',d.metadata->>'declared_mime_type','size_bytes',d.metadata->>'declared_size_bytes');
end$$;

-- Reject a stale historical/draft selection before creating an approval request.
-- The original locked selection CAS remains the final authority under races.
do $$declare definition text;marker text;begin
 definition:=pg_get_functiondef('public.select_quote_and_notify(uuid,uuid,text,uuid,text,uuid)'::regprocedure);
 marker:=' -- Existing selection is read/replayed by the original command;';
 if position(marker in definition)=0 then raise exception'QUOTE_PUBLICATION_SELECTION_PATCH_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,$patch$
 if not exists(select 1 from public.quote_selection_decisions where selected_quote_id=p_quote_id and selected_quote_version_id=p_expected_version_id)
 and not exists(select 1 from public.quotes q where q.id=p_quote_id and q.status='SUBMITTED'and q.current_version_id=p_expected_version_id and q.last_published_version_id=p_expected_version_id)then raise exception'STALE_QUOTE_VERSION'using errcode='40001';end if;
$patch$||marker);
end$$;
notify pgrst,'reload schema';
commit;
