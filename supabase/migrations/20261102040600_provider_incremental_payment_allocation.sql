begin;
-- An immutable payment may be reconciled incrementally against the same invoice.
-- A batch still contains each invoice once; neither historical rows nor amounts
-- are changed by replacing the overly broad payment+invoice uniqueness.
alter table public.provider_payment_allocations drop constraint provider_payment_allocations_payment_id_invoice_id_key;
alter table public.provider_payment_allocations add constraint provider_payment_allocations_batch_invoice_key unique(provider_organization_id,reconciliation_batch_id,invoice_id);
do $migration$
declare definition text;needle text:=' perform 1 from public.provider_invoices where id in';
patch text:=$patch$
 if jsonb_typeof(p_allocations)is distinct from'array'or jsonb_array_length(p_allocations)not between 1 and 100 then raise exception'INVALID_PAYMENT_ALLOCATIONS'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_allocations)x where jsonb_typeof(x)is distinct from'object'or coalesce(x->>'invoice_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'or coalesce(x->>'amount_minor','')!~'^[1-9][0-9]{0,18}$')or exists(select 1 from jsonb_array_elements(p_allocations)x group by x->>'invoice_id' having count(*)>1)then raise exception'INVALID_PAYMENT_ALLOCATIONS'using errcode='22023';end if;
$patch$;
begin
 definition:=pg_get_functiondef('public.reconcile_provider_payment(uuid,jsonb,text,uuid)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception'PAYMENT_INCREMENTAL_ALLOCATION_PATCH_MISSING';end if;
 execute replace(definition,needle,patch||needle);
end $migration$;
notify pgrst,'reload schema';
commit;
