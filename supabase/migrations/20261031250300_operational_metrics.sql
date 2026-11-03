-- Safe numeric telemetry only: no payloads, recipients, orgs, secrets or money amounts.
alter table public.operational_heartbeats add column last_duration_ms integer check(last_duration_ms between 0 and 3600000);
create or replace function public.record_operational_heartbeat_v1(p_service_code text,p_healthy boolean,p_expires_after_seconds integer default 60)
returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_healthy is null then raise exception 'INVALID_HEARTBEAT' using errcode='22023';end if;
 insert into public.operational_heartbeats(service_code,observed_at,healthy,expires_after_seconds)values(p_service_code,clock_timestamp(),p_healthy,p_expires_after_seconds)
 on conflict(service_code) do update set observed_at=excluded.observed_at,healthy=excluded.healthy,expires_after_seconds=excluded.expires_after_seconds;
end $$;

create function public.record_operational_job_run_v1(p_service_code text,p_healthy boolean,p_expires_after_seconds integer,p_duration_ms integer)returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 perform public.record_operational_heartbeat_v1(p_service_code,p_healthy,p_expires_after_seconds);
 update public.operational_heartbeats set last_duration_ms=p_duration_ms where service_code=p_service_code;
end$$;
revoke all on function public.record_operational_job_run_v1(text,boolean,integer,integer)from public,anon,authenticated;
grant execute on function public.record_operational_job_run_v1(text,boolean,integer,integer)to service_role;
create function public.operational_metrics_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 return jsonb_build_object(
 'outbox',coalesce((select jsonb_agg(row_to_json(q))from(select case when event_type~'^[A-Z][A-Za-z0-9_]{1,159}$'then event_type else'UNCLASSIFIED'end as event,case when dead_lettered_at is not null then'DEAD_LETTER'when published_at is not null then'PUBLISHED'else'PENDING'end as status,count(*)::text as count,greatest(0,coalesce(extract(epoch from statement_timestamp()-min(occurred_at)filter(where published_at is null))::bigint,0))::text as oldest_seconds from public.event_outbox group by 1,2)q),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.notification_deliveries group by status)q),'[]'::jsonb),
 'publications',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.social_publication_jobs group by status)q),'[]'::jsonb),
 'refunds',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.subscription_refund_requests group by status)q),'[]'::jsonb),
 'signatures',coalesce((select jsonb_agg(row_to_json(q))from(select status,count(*)::text as count from public.signature_envelopes group by status)q),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('service',service_code,'healthy',healthy and observed_at+make_interval(secs=>expires_after_seconds)>=statement_timestamp(),'age_seconds',greatest(0,extract(epoch from statement_timestamp()-observed_at)::bigint)::text,'duration_ms',last_duration_ms))from public.operational_heartbeats),'[]'::jsonb));
end$$;
revoke all on function public.operational_metrics_v1()from public,anon,authenticated;
grant execute on function public.operational_metrics_v1()to service_role;
notify pgrst,'reload schema';

create function public.defer_outbox_document_dependency_v1(p_event_id bigint,p_worker_id uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 update public.event_outbox set available_at=clock_timestamp()+interval'60 seconds',locked_at=null,locked_by=null,last_error_code='ANTIVIRUS_UNAVAILABLE'
 where id=p_event_id and event_type='DocumentUploadedV1'and locked_by=p_worker_id and locked_at>=clock_timestamp()-interval'5 minutes'and published_at is null and dead_lettered_at is null;
 if not found then raise exception'OUTBOX_DOCUMENT_CLAIM_NOT_OWNED'using errcode='55000';end if;
end$$;
revoke all on function public.defer_outbox_document_dependency_v1(bigint,uuid)from public,anon,authenticated;
grant execute on function public.defer_outbox_document_dependency_v1(bigint,uuid)to service_role;

notify pgrst,'reload schema';
