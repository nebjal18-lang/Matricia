begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('private-message-attachments','private-message-attachments',false,10485760,array['application/pdf','image/jpeg','image/png','text/plain'])on conflict(id)do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create function public.get_admin_conversation_attachment_v1(p_attachment_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,storage as $$
declare a public.internal_message_attachments%rowtype;t public.internal_message_threads%rowtype;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'])then raise exception'ADMIN_CONVERSATION_SCOPE_DENIED'using errcode='42501';end if;
 select*into a from public.internal_message_attachments where id=p_attachment_id;
 select thread.*into t from public.internal_messages m join public.internal_message_threads thread on thread.id=m.thread_id where m.id=a.message_id;
 if a.id is null or t.id is null or not private.can_access_internal_message_thread(t.id,auth.uid())then raise exception'ADMIN_CONVERSATION_SCOPE_DENIED'using errcode='42501';end if;
 if a.scan_status<>'CLEAN'or a.scanned_at is null or a.scan_result_code is null or a.storage_bucket<>'private-message-attachments'or a.storage_object_path not like('internal-messages/'||t.id::text||'/%')or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id=a.storage_bucket and o.name=a.storage_object_path and not b.public)then raise exception'ADMIN_ATTACHMENT_NOT_AVAILABLE'using errcode='55000';end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(t.client_organization_id,auth.uid(),'USER','admin.message.attachment.read_authorized','internal_message_attachment',a.id::text,gen_random_uuid(),jsonb_build_object('thread_id',t.id,'sha256',a.sha256,'size_bytes',a.size_bytes),repeat('0',64));
 return jsonb_build_object('bucket',a.storage_bucket,'path',a.storage_object_path,'sha256',a.sha256,'mime_type',a.mime_type,'size_bytes',a.size_bytes);
end$$;
revoke all on function public.get_admin_conversation_attachment_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_conversation_attachment_v1(uuid)to authenticated;
do $$declare definition text;begin
 select pg_get_functiondef('public.get_admin_thread_message_page_v1(uuid,timestamptz,uuid,integer)'::regprocedure)into definition;
 if strpos(definition,'''downloadReady'',a.scan_status=''CLEAN''')=0 then raise exception'ADMIN_ATTACHMENT_PROJECTION_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'''downloadReady'',a.scan_status=''CLEAN''','''downloadReady'',a.scan_status=''CLEAN''and exists(select 1 from storage.objects object join storage.buckets bucket on bucket.id=object.bucket_id where object.bucket_id=a.storage_bucket and object.name=a.storage_object_path and not bucket.public)');execute definition;
end$$;
notify pgrst,'reload schema';
commit;
