-- Read aggregates over the complete caller-visible ledger; display pagination is independent.
create or replace function public.franchise_distribution_balances()
returns table(book_id uuid, beneficiary_code text, balance_minor text)
language sql stable security invoker
set search_path = pg_catalog, public
as $$
  select e.book_id, e.beneficiary_code, sum(e.amount_minor)::text
  from public.franchise_distribution_ledger_entries e
  group by e.book_id, e.beneficiary_code
$$;
revoke all on function public.franchise_distribution_balances() from public, anon;
grant execute on function public.franchise_distribution_balances() to authenticated;
