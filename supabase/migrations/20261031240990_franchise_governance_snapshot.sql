-- A single caller-visible MVCC snapshot replaces truncated multi-request history.
-- INVOKER preserves every existing table/column grant and RLS predicate.
create function public.franchise_governance_dashboard_snapshot(p_franchise_id uuid default null)returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog as $$
declare result jsonb;items jsonb;spec record;
begin
 if auth.uid()is null then raise exception 'FRANCHISE_DASHBOARD_SCOPE_DENIED'using errcode='42501';end if;
 if p_franchise_id is not null and not exists(select 1 from public.franchises where id=p_franchise_id)then raise exception 'FRANCHISE_DASHBOARD_SCOPE_DENIED'using errcode='42501';end if;
 result:=jsonb_build_object('complete',true,'snapshotAt',statement_timestamp(),'balances',(select coalesce(jsonb_agg(to_jsonb(balance)),'[]'::jsonb)from public.franchise_distribution_balances()balance));
 -- The query templates are a fixed server allow-list, never caller-controlled SQL.
 for spec in select * from(values
('franchises','x.id,x.library_id,x.operator_organization_id,x.franchise_type,x.operator_code,x.territory_code,x.status,x.activation_mode,x.current_mandate_version_id,x.row_version','fs','($1 is null or x.id=$1)','x.created_at desc,x.id'),
('catalog_libraries','x.id,x.code','ls','($1 is null or x.id=(select library_id from public.franchises where id=$1))','x.id'),
('catalog_library_versions','x.id,x.library_id,x.name_fr,x.name_ar','lvs','($1 is null or x.library_id=(select library_id from public.franchises where id=$1))','x.version desc,x.id'),
('franchise_territory_versions','x.id,x.franchise_id,x.version,x.territory_code,x.name_fr,x.name_ar,x.effective_from,x.effective_until,x.content_hash','ts','($1 is null or x.franchise_id=$1)','x.version desc,x.id'),
('franchise_mandate_versions','x.id,x.franchise_id,x.territory_version_id,x.economic_rule_version_id,x.version,x.mandate_status,x.entry_fee_minor::text as entry_fee_minor,x.entry_fee_mode,x.franchisee_share_bps,x.neoxa_share_bps,x.matricia_share_bps,x.effective_from,x.effective_until,x.content_hash','ms','($1 is null or x.franchise_id=$1)','x.version desc,x.id'),
('franchise_approval_requests','x.id,x.franchise_id,x.mandate_version_id,x.request_type,x.status,x.change_reason,x.requested_at,x.decided_at,x.row_version','aps','($1 is null or x.franchise_id=$1)','x.requested_at desc,x.id'),
('franchise_approval_decisions','x.approval_request_id,x.decision,x.reason,x.mandate_content_hash,x.decided_at','decisions','($1 is null or exists(select 1 from public.franchise_approval_requests q where q.id=x.approval_request_id and q.franchise_id=$1))','x.decided_at desc,x.id'),
('franchise_invitations','x.id,x.franchise_id,x.invited_email,x.status,x.expires_at,x.row_version','ins','($1 is null or x.franchise_id=$1)','x.created_at desc,x.id'),
('franchise_finance_rule_versions','x.id,x.franchise_type,x.version,x.entry_fee_required,x.franchisee_share_bps,x.neoxa_share_bps,x.asma_matricia_share_bps,x.effective_from','rs','x.status=''ACTIVE''','x.version desc,x.id'),
('franchise_pnl_books','x.id,x.library_id,x.franchise_organization_id,x.franchise_type,x.operator_code,x.currency,x.opened_under_rule_version_id,x.status','bs','($1 is null or exists(select 1 from public.franchises f where f.id=$1 and f.library_id=x.library_id and f.operator_organization_id=x.franchise_organization_id))','x.id'),
('franchise_entry_fee_schedules','x.id,x.book_id,x.mode,x.principal_minor::text as principal_minor,x.deposit_minor::text as deposit_minor,x.starts_on,x.due_on','fees','($1 is null or exists(select 1 from public.franchise_pnl_books b join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id where f.id=$1 and b.id=x.book_id))','x.id'),
('franchise_profit_closure_versions','x.id,x.book_id,x.period_start,x.period_end,x.version,x.supersedes_closure_id,x.rule_version_id,x.entry_cutoff_at,x.gross_revenue_ex_tax_minor::text as gross_revenue_ex_tax_minor,x.costs_and_refunds_minor::text as costs_and_refunds_minor,x.distributable_profit_minor::text as distributable_profit_minor,x.content_hash,x.closed_at','cs','($1 is null or exists(select 1 from public.franchise_pnl_books b join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id where f.id=$1 and b.id=x.book_id))','x.closed_at desc,x.id'),
('franchise_profit_allocations','x.id,x.closure_version_id,x.beneficiary_code,x.share_bps,x.amount_minor::text as amount_minor,x.rounding_adjustment_minor','als','($1 is null or exists(select 1 from public.franchise_profit_closure_versions c join public.franchise_pnl_books b on b.id=c.book_id join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id where f.id=$1 and c.id=x.closure_version_id))','x.id'),
('franchise_distribution_ledger_entries','x.id::text as id,x.book_id,x.closure_version_id,x.beneficiary_code,x.entry_type,x.amount_minor::text as amount_minor,x.reference_type,x.reference_id,x.proof_hash,x.created_at','ledgers','($1 is null or exists(select 1 from public.franchise_pnl_books b join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id where f.id=$1 and b.id=x.book_id))','x.id desc'),
('franchise_entry_fee_ledger_entries','x.id::text as id,x.schedule_id,x.entry_type,x.amount_minor::text as amount_minor,x.created_at','feeLedgers','($1 is null or exists(select 1 from public.franchise_entry_fee_schedules s join public.franchise_pnl_books b on b.id=s.book_id join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id where f.id=$1 and s.id=x.schedule_id))','x.id desc'))as allowed(table_name,fields,key_name,scope_filter,sort_order)loop
  execute format('select coalesce(jsonb_agg(to_jsonb(page)),''[]''::jsonb) from(select %s from public.%I x where %s order by %s limit 20001)page',spec.fields,spec.table_name,spec.scope_filter,spec.sort_order)into items using p_franchise_id;
  if jsonb_array_length(items)>20000 then raise exception 'FRANCHISE_DASHBOARD_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
  result:=jsonb_set(result,array[spec.key_name],items);
  if octet_length(result::text)>16777216 then raise exception 'FRANCHISE_DASHBOARD_SNAPSHOT_BUDGET_EXCEEDED'using errcode='54000';end if;
 end loop;
 -- Scope balances to the same exact books as the rest of this projection.
 result:=jsonb_set(result,array['balances'],coalesce((select jsonb_agg(balance)from jsonb_array_elements(result->'balances')balance where exists(select 1 from jsonb_array_elements(result->'bs')book where book->>'id'=balance->>'book_id')),'[]'::jsonb));
 return result;
end$$;
revoke all on function public.franchise_governance_dashboard_snapshot(uuid)from public,anon,authenticated,service_role;
grant execute on function public.franchise_governance_dashboard_snapshot(uuid)to authenticated;
