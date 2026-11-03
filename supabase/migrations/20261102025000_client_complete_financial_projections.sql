begin;
-- RLS is evaluated as the authenticated invoker on every underlying relation.
-- Aggregate before paginating: a history window is never treated as the ledger.
create view public.client_credit_lot_positions_v1 with (security_invoker=true) as
select l.id,l.organization_id,l.wallet_id,l.source_type,l.quantity::text as quantity,l.expires_at,l.library_id,
 (l.quantity-coalesce(sum(case when m.movement_type='RESERVE' then m.quantity when m.movement_type='RELEASE' then -m.quantity else 0 end),0))::text as available,
 coalesce(sum(case when m.movement_type='RESERVE' then m.quantity else -m.quantity end),0)::text as reserved
from public.credit_lots l
left join public.credit_lot_movements m on m.credit_lot_id=l.id and m.organization_id=l.organization_id
group by l.id;
create view public.client_budget_totals_v1 with (security_invoker=true) as
select b.organization_id,b.id as budget_id,
 coalesce(sum(case when a.allocation_type='RELEASE' then -a.amount_minor else a.amount_minor end),0)::text as net_minor
from public.client_annual_budgets b
left join public.client_cost_allocations a on a.budget_id=b.id and a.organization_id=b.organization_id
group by b.id;
revoke all on public.client_credit_lot_positions_v1,public.client_budget_totals_v1 from public,anon,authenticated,service_role;
grant select on public.client_credit_lot_positions_v1,public.client_budget_totals_v1 to authenticated;

-- A separate paginated reader retains the existing two-argument API unchanged.
create function public.search_client_allocation_invoice_targets_v1(p_organization_id uuid,p_after uuid default null,p_search text default '',p_limit integer default 100)
returns table(id uuid,organization_id uuid,label_fr text,label_ar text)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or p_organization_id is null or not coalesce(private.client_budget_manage(p_organization_id,auth.uid()),false)then raise exception 'CLIENT_ALLOCATION_INVOICE_TARGETS_DENIED'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 or p_search is null or length(p_search)>160 then raise exception 'INVALID_CLIENT_ALLOCATION_TARGET_QUERY'using errcode='22023';end if;
 return query
 select i.id,p_organization_id,'Facture · '||i.invoice_number,'فاتورة · '||i.invoice_number
 from public.provider_invoices i
 where (p_after is null or i.id>p_after)
 and (p_search='' or strpos(lower(i.invoice_number),lower(p_search))>0)
 and private.client_invoice_belongs_to(p_organization_id,i.id)
 and exists(select 1 from public.provider_statement_lines l join public.provider_payable_events p on p.id=l.payable_event_id and p.provider_organization_id=l.provider_organization_id where l.statement_id=i.statement_id and l.provider_organization_id=i.provider_organization_id and p.client_organization_id=p_organization_id)
 order by i.id limit p_limit;
end$$;
revoke all on function public.search_client_allocation_invoice_targets_v1(uuid,uuid,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.search_client_allocation_invoice_targets_v1(uuid,uuid,text,integer)to authenticated;

notify pgrst,'reload schema';
commit;
