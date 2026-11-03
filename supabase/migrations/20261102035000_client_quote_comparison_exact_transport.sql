begin;
-- PostgreSQL JSON numbers preserve bigint internally, JavaScript JSON numbers
-- do not. Project exact decimal text at the transport boundary. Never rewrite
-- the immutable comparison, its canonical input hash or cached command facts.
create function private.quote_comparison_money_transport_v1(p_rows jsonb)returns jsonb language sql immutable set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(item||jsonb_build_object('subtotal_minor',item->>'subtotal_minor','tax_minor',item->>'tax_minor','total_minor',item->>'total_minor','recurring_subtotal_minor',item->>'recurring_subtotal_minor')order by ordinal),'[]'::jsonb)
 from jsonb_array_elements(p_rows)with ordinality as rows(item,ordinal)
$$;
alter function public.compare_quotes(uuid,text,uuid)rename to compare_quotes_before_exact_transport_v1;
alter function public.compare_quotes_before_exact_transport_v1(uuid,text,uuid)set schema private;
revoke all on function private.compare_quotes_before_exact_transport_v1(uuid,text,uuid),private.quote_comparison_money_transport_v1(jsonb)from public,anon,authenticated,service_role;
create function public.compare_quotes(p_rfq_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;begin
 result:=private.compare_quotes_before_exact_transport_v1(p_rfq_id,p_idempotency_key,p_correlation_id);
 return jsonb_set(result,'{rows}',private.quote_comparison_money_transport_v1(result->'rows'),false);
end$$;
revoke all on function public.compare_quotes(uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.compare_quotes(uuid,text,uuid)to authenticated;
-- SECURITY INVOKER keeps the original tenant/role RLS as authority. The query
-- only transforms four monetary values in a returned copy, with stable ordering.
create function public.get_client_quote_comparison_exact_v1(p_rfq_id uuid)
returns table(id uuid,rfq_id uuid,normalization_version text,currency text,comparison jsonb,created_at timestamptz)
language sql stable security invoker set search_path=pg_catalog as $$
 select source.id,source.rfq_id,source.normalization_version,source.currency::text,
 jsonb_set(source.comparison,'{rows}',(select coalesce(jsonb_agg(item||jsonb_build_object('subtotal_minor',item->>'subtotal_minor','tax_minor',item->>'tax_minor','total_minor',item->>'total_minor','recurring_subtotal_minor',item->>'recurring_subtotal_minor')order by ordinal),'[]'::jsonb)from jsonb_array_elements(source.comparison->'rows')with ordinality as rows(item,ordinal)),false),source.created_at
 from public.quote_comparison_snapshots source where source.rfq_id=p_rfq_id
 order by source.created_at desc,source.id desc limit 1
$$;
revoke all on function public.get_client_quote_comparison_exact_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_quote_comparison_exact_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
