begin;
-- Financial due dates share the existing Morocco civil calendar. Do not change
-- TimeZone, the clock, signed hashes, invoice dates, or any immutable ledger row.
create or replace function private.provider_invoice_overdue_minor_v1(
 p_invoice_id uuid,
 p_as_of date default private.provider_finance_civil_date_v1(clock_timestamp())
) returns bigint language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare b public.provider_invoices%rowtype;outstanding bigint;plan uuid;total bigint;due bigint;paid_since bigint;begin
 select*into b from public.provider_invoices where id=p_invoice_id;if b.id is null then return 0;end if;outstanding:=private.provider_invoice_outstanding_minor(b.id);
 select p.id into plan from public.provider_payment_plans p where p.invoice_id=b.id and private.provider_payment_plan_status(p.id)='APPROVED'order by p.created_at desc,p.id desc limit 1;
 if plan is null then return case when b.due_on<p_as_of then outstanding else 0 end;end if;
 select sum(amount_minor),coalesce(sum(amount_minor)filter(where due_on<p_as_of),0)into total,due from public.provider_payment_plan_installments where plan_id=plan;
 if total is null or total<=0 then return case when b.due_on<p_as_of then outstanding else 0 end;end if;
 paid_since:=greatest(total-outstanding,0);return least(outstanding,greatest(due-paid_since,0)+case when b.due_on<p_as_of then greatest(outstanding-total,0)else 0 end);
end$$;
revoke all on function private.provider_invoice_overdue_minor_v1(uuid,date)from public,anon,authenticated,service_role;

do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.request_provider_payment_plan(uuid,jsonb,text,text,uuid)'::regprocedure);
 needle:='coalesce((item->>''due_on'')::date, current_date) <= current_date';
 if strpos(definition,needle)=0 then raise exception'PROVIDER_PLAN_CIVIL_CALENDAR_PATCH_MISSING';end if;
 execute replace(definition,needle,'coalesce((item->>''due_on'')::date, private.provider_finance_civil_date_v1(clock_timestamp())) <= private.provider_finance_civil_date_v1(clock_timestamp())');
 -- The invoker view must only call built-ins here: do not widen EXECUTE on a
 -- private helper just to render the fallback status.
 definition:=pg_get_viewdef('public.provider_invoice_balances'::regclass,true);
 if (length(definition)-length(replace(definition,'CURRENT_DATE','')))/length('CURRENT_DATE')<>1 then
  raise exception'PROVIDER_BALANCE_CIVIL_CALENDAR_PATCH_MISSING';
 end if;
 execute 'create or replace view public.provider_invoice_balances with(security_invoker=true)as '||replace(definition,'CURRENT_DATE','(clock_timestamp() at time zone ''Africa/Casablanca'')::date');
end $migration$;
notify pgrst,'reload schema';
commit;
