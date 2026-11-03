begin;
-- A durable upload event is only acknowledged after a terminal native verdict.
-- Busy/retry/delayed/dead-letter jobs never masquerade as an empty queue.
create function public.get_finance_cost_scan_state_v1(p_upload_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare u public.finance_cost_document_uploads_v1%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'FINANCE_COST_SCANNER_SERVICE_REQUIRED'using errcode='42501';end if;
 select*into u from public.finance_cost_document_uploads_v1 where id=p_upload_id;
 if u.id is null then raise exception'FINANCE_COST_DOCUMENT_NOT_FOUND'using errcode='42501';end if;
 return jsonb_build_object('upload_id',u.id,'status',u.status,'scan_status',u.scan_status,'attempt_count',u.attempt_count,'next_attempt_at',u.next_attempt_at);
end$$;
revoke all on function public.get_finance_cost_scan_state_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_finance_cost_scan_state_v1(uuid)to service_role;
commit;
