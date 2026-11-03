begin;
create index internal_message_attachment_operational_scan_idx on public.internal_message_attachment_uploads(scan_status,created_at)where status in('UPLOADED','BOUND');
create function private.internal_message_attachment_queue_metrics_v1()returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select coalesce(jsonb_agg(to_jsonb(q)order by status),'[]'::jsonb)from(
 select case when scan_status='ERROR'and not is_active and upload_status<>'BOUND'then'HISTORICAL_ERROR'when scan_status='ERROR'then'DEAD_LETTER'when scan_status='PENDING'and coalesce(attempt_count,0)>0 then'RETRY_PENDING'else scan_status end status,count(*)::text count,
 greatest(0,coalesce(extract(epoch from statement_timestamp()-min(created_at)filter(where scan_status in('PENDING','ERROR')and(is_active or upload_status='BOUND')))::bigint,0))::text oldest_seconds from(
 select upload.scan_status,upload.status upload_status,upload.created_at,claim.attempt_count,(upload.status='UPLOADED'and draft.status='DRAFT'and file.current_upload_id=upload.id and not file.removed)is_active
 from public.internal_message_attachment_uploads upload join public.internal_message_draft_files file on file.id=upload.file_id join public.internal_message_drafts draft on draft.id=upload.draft_id left join private.internal_message_attachment_scan_claims claim on claim.upload_id=upload.id)facts
 where is_active or upload_status='BOUND'or scan_status='ERROR' group by 1)q
$$;
revoke all on function private.internal_message_attachment_queue_metrics_v1()from public,anon,authenticated,service_role;
create function public.get_internal_message_attachment_operations_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'authenticated'or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'ATTACHMENT_OPERATIONS_AAL2_REQUIRED'using errcode='42501';end if;
 return private.internal_message_attachment_queue_metrics_v1();
end$$;
revoke all on function public.get_internal_message_attachment_operations_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_internal_message_attachment_operations_v1()to authenticated;
create or replace function public.operational_metrics_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 return jsonb_build_object(
 'outbox',coalesce((select jsonb_agg(row_to_json(q))from(select case when event_type~'^[A-Z][A-Za-z0-9_]{1,159}$'then event_type else'UNCLASSIFIED'end as event,case when dead_lettered_at is not null then'DEAD_LETTER'when published_at is not null then'PUBLISHED'else'PENDING'end as status,count(*)::text as count,greatest(0,coalesce(extract(epoch from statement_timestamp()-min(occurred_at)filter(where published_at is null))::bigint,0))::text as oldest_seconds from public.event_outbox group by 1,2)q),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.notification_deliveries group by status)q),'[]'::jsonb),
 'publications',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.social_publication_jobs group by status)q),'[]'::jsonb),
 'refunds',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.subscription_refund_requests group by status)q),'[]'::jsonb),
 'social_media',coalesce((select jsonb_agg(row_to_json(q))from(select state as status,count(*)::text as count from public.social_media_executions group by state)q),'[]'::jsonb),
 'signatures',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.signature_envelopes group by status)q),'[]'::jsonb),
 'message_attachment_scans',private.internal_message_attachment_queue_metrics_v1(),
 'services',coalesce((select jsonb_agg(jsonb_build_object('service',service_code,'healthy',healthy and observed_at+make_interval(secs=>expires_after_seconds)>=statement_timestamp(),'age_seconds',greatest(0,extract(epoch from statement_timestamp()-observed_at)::bigint)::text,'duration_ms',last_duration_ms))from public.operational_heartbeats),'[]'::jsonb));
end$$;

notify pgrst,'reload schema';
commit;
