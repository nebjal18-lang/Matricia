begin;
-- Reuse the domain's current-work projection; no DSR identifiers or content leave the domain.
create function private.privacy_file_operational_counts_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare raw jsonb;row_value jsonb;result jsonb:='[]';begin
 raw:=private.dsr_file_scan_queue_metrics_v1();if jsonb_typeof(raw)is distinct from'array'then raise exception'PRIVACY_FILE_METRICS_UNAVAILABLE'using errcode='55000';end if;
 for row_value in select*from jsonb_array_elements(raw)loop
  if coalesce(row_value->>'status','')not in('PENDING','RETRY_PENDING','DEAD_LETTER','CLEAN','REJECTED','HISTORICAL_ERROR')or coalesce(row_value->>'count','')!~'^[0-9]+$'or coalesce(row_value->>'oldest_seconds','')!~'^[0-9]+$'then raise exception'PRIVACY_FILE_METRICS_UNAVAILABLE'using errcode='55000';end if;
  result:=result||jsonb_build_array(jsonb_build_object('status',row_value->>'status','count',row_value->>'count','oldest_seconds',row_value->>'oldest_seconds'));
 end loop;return result;
end$$;
revoke all on function private.privacy_file_operational_counts_v1()from public,anon,authenticated,service_role;
create function public.get_privacy_file_operations_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'authenticated'or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'PRIVACY_FILE_OPERATIONS_AAL2_REQUIRED'using errcode='42501';end if;
 return private.privacy_file_operational_counts_v1();
end$$;
revoke all on function public.get_privacy_file_operations_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_privacy_file_operations_v1()to authenticated;
alter function public.operational_metrics_v1()set schema private;
alter function private.operational_metrics_v1()rename to operational_metrics_before_privacy_files_v1;
revoke all on function private.operational_metrics_before_privacy_files_v1()from public,anon,authenticated,service_role;
create function public.operational_metrics_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'then raise exception'FORBIDDEN'using errcode='42501';end if;
 return private.operational_metrics_before_privacy_files_v1()||jsonb_build_object('privacy_file_scans',private.privacy_file_operational_counts_v1());
end$$;
revoke all on function public.operational_metrics_v1()from public,anon,authenticated,service_role;
grant execute on function public.operational_metrics_v1()to service_role;
notify pgrst,'reload schema';
commit;
