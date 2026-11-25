-- NUMERIC division chooses a result scale and can round a large quotient
-- before floor() sees it. DIV keeps the integer quotient exact instead.
-- Cast before abs() so the minimum bigint is representable as well.
create or replace function private.calculate_tax_minor(
  p_net_minor bigint,
  p_rate_basis_points integer
) returns bigint
language sql immutable strict set search_path=pg_catalog
as $$
  select (
    case when p_net_minor < 0 then -1::numeric else 1::numeric end
    * div(abs(p_net_minor::numeric) * p_rate_basis_points + 5000, 10000)
  )::bigint
$$;
-- CREATE OR REPLACE preserves the existing private function's privileges.
-- No historical quote, tax snapshot, or immutable ledger is rewritten.
