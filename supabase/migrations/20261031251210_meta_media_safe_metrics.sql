-- Immediate numeric visibility of persisted media ambiguity, without captions/assets/identities.
create or replace function public.operational_metrics_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 return jsonb_build_object(
 'outbox',coalesce((select jsonb_agg(row_to_json(q))from(select case when event_type~'^[A-Z][A-Za-z0-9_]{1,159}$'then event_type else'UNCLASSIFIED'end as event,case when dead_lettered_at is not null then'DEAD_LETTER'when published_at is not null then'PUBLISHED'else'PENDING'end as status,count(*)::text as count,greatest(0,coalesce(extract(epoch from statement_timestamp()-min(occurred_at)filter(where published_at is null))::bigint,0))::text as oldest_seconds from public.event_outbox group by 1,2)q),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.notification_deliveries group by status)q),'[]'::jsonb),
 'publications',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.social_publication_jobs group by status)q),'[]'::jsonb),
 'refunds',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.subscription_refund_requests group by status)q),'[]'::jsonb),
 'social_media',coalesce((select jsonb_agg(row_to_json(q))from(select state as status,count(*)::text as count from public.social_media_executions group by state)q),'[]'::jsonb),
 'signatures',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.signature_envelopes group by status)q),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('service',service_code,'healthy',healthy and observed_at+make_interval(secs=>expires_after_seconds)>=statement_timestamp(),'age_seconds',greatest(0,extract(epoch from statement_timestamp()-observed_at)::bigint)::text,'duration_ms',last_duration_ms))from public.operational_heartbeats),'[]'::jsonb));
end$$;
revoke all on function public.operational_metrics_v1()from public,anon,authenticated;
grant execute on function public.operational_metrics_v1()to service_role;
notify pgrst,'reload schema';
