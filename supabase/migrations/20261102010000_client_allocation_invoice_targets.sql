-- Read only the invoice references that the native typed allocation command
-- accepts for this Client. The private calendar source column remains private.
begin;

create function public.list_client_allocation_invoice_targets(
  p_organization_id uuid,
  p_limit integer default 101
) returns table(id uuid, organization_id uuid, label_fr text, label_ar text)
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or p_organization_id is null
    or not coalesce(private.client_budget_manage(p_organization_id, actor), false) then
    raise exception 'CLIENT_ALLOCATION_INVOICE_TARGETS_DENIED' using errcode='42501';
  end if;
  if p_limit is null or p_limit not between 1 and 101 then
    raise exception 'INVALID_CLIENT_ALLOCATION_TARGET_LIMIT' using errcode='22023';
  end if;

  return query
  with candidates as (
    select distinct invoice.id, invoice.invoice_number
    from public.provider_invoices invoice
    join public.provider_statement_lines line
      on line.statement_id=invoice.statement_id
      and line.provider_organization_id=invoice.provider_organization_id
    join public.provider_payable_events payable
      on payable.id=line.payable_event_id
      and payable.provider_organization_id=line.provider_organization_id
    where payable.client_organization_id=p_organization_id
      -- A single line for this Client is insufficient: the native predicate
      -- also rejects every invoice containing another Client's payable event.
      and private.client_invoice_belongs_to(p_organization_id, invoice.id)
  )
  select candidate.id, p_organization_id,
    'Facture · ' || candidate.invoice_number,
    'فاتورة · ' || candidate.invoice_number
  from candidates candidate
  order by candidate.id
  limit p_limit;
end;
$$;

revoke all on function public.list_client_allocation_invoice_targets(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.list_client_allocation_invoice_targets(uuid,integer)
  to authenticated;

comment on function public.list_client_allocation_invoice_targets(uuid,integer) is
  'Read-only Client budget allocation targets: actual invoice references exclusively belonging to the selected authorized organization; no base table privileges are expanded.';

notify pgrst,'reload schema';
commit;
