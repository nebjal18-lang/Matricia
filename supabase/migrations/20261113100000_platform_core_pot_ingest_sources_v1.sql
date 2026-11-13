-- Callable bridge: validated Core subscription + franchise entry-fee sources → platform_core_pot entries.

create function public.ingest_platform_core_pot_sources_v1(
 p_book_id uuid,
 p_financial_journal_id uuid,
 p_credit_revenue_ledger_id bigint default null,
 p_franchise_entry_fee_ledger_id bigint default null,
 p_reason text,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
 a uuid:=auth.uid();b public.platform_core_pot_books%rowtype;
 j public.financial_journals%rowtype;
 l public.credit_revenue_ledger_v1%rowtype;
 f public.credit_economic_funding_sources_v1%rowtype;
 fe public.franchise_entry_fee_ledger_entries%rowtype;
 pb public.franchise_pnl_books%rowtype;
 amount bigint;category text;source_type text;source_id text;effective_on date;
 inner_key text;r jsonb;
begin
 if a is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or auth.jwt()->>'aal'<>'aal2'then
  raise exception 'PLATFORM_CORE_POT_INGEST_DENIED'using errcode='42501';
 end if;
 select*into b from public.platform_core_pot_books where id=p_book_id;
 select*into j from public.financial_journals where id=p_financial_journal_id;
 if b.id is null or j.id is null or b.status<>'OPEN'or length(btrim(coalesce(p_reason,'')))not between 3 and 1000
  or length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200
 then raise exception 'INVALID_PLATFORM_CORE_POT_INGEST'using errcode='22023';end if;
 if(p_credit_revenue_ledger_id is null)=(p_franchise_entry_fee_ledger_id is null)then
  raise exception 'PLATFORM_CORE_POT_INGEST_SOURCE_REQUIRED'using errcode='22023';
 end if;
 if p_credit_revenue_ledger_id is not null then
  select*into l from public.credit_revenue_ledger_v1 where id=p_credit_revenue_ledger_id;
  if not found or l.revenue_class<>'CORE_SUBSCRIPTION_REVENUE'or l.amount_minor<=0
   or l.entry_type in('REFUND','REVERSE')or l.currency<>b.currency
  then raise exception 'INVALID_CORE_SUBSCRIPTION_POT_SOURCE'using errcode='22023';end if;
  select*into f from public.credit_economic_funding_sources_v1 where id=l.funding_source_id;
  if not found then raise exception 'INVALID_CORE_SUBSCRIPTION_POT_SOURCE'using errcode='22023';end if;
  amount:=l.amount_minor;category:='CORE_SUBSCRIPTION_REVENUE_ACQUIRED';source_type:='CREDIT_REVENUE_LEDGER';source_id:=l.id::text;
 else
  select*into fe from public.franchise_entry_fee_ledger_entries where id=p_franchise_entry_fee_ledger_id;
  if not found or fe.entry_type not in('PAYMENT','WITHHOLDING')or fe.amount_minor>=0 or fe.financial_journal_id is null
  then raise exception 'INVALID_ENTRY_FEE_POT_SOURCE'using errcode='22023';end if;
  select b.* into pb from public.franchise_pnl_books b join public.franchise_entry_fee_schedules s on s.book_id=b.id where s.id=fe.schedule_id;
  if not found or pb.franchise_type='IT'or pb.currency<>b.currency
  then raise exception 'IT_ENTRY_FEE_EXCLUDED_FROM_PLATFORM_POT'using errcode='23514';end if;
  amount:=-fe.amount_minor;category:='ENTRY_FEE_ACQUIRED';source_type:='FRANCHISE_ENTRY_FEE_PAYMENT';source_id:=fe.id::text;
 end if;
 effective_on:=(j.effective_at at time zone'Africa/Casablanca')::date;
 inner_key:='platform-core-pot-ingest-v1:'||btrim(p_idempotency_key);
 r:=public.post_platform_core_pot_entry(
  b.id,'REVENUE',category,amount,p_financial_journal_id,source_type,source_id,effective_on,p_reason,null,inner_key,p_correlation_id
 );
 return jsonb_build_object(
  'outcome','PLATFORM_CORE_POT_SOURCE_INGESTED','source_type',source_type,'source_id',source_id,'amount_minor',amount,'category',category,'post',r
 );
end$$;

revoke all on function public.ingest_platform_core_pot_sources_v1(uuid,uuid,bigint,bigint,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.ingest_platform_core_pot_sources_v1(uuid,uuid,bigint,bigint,text,text,uuid)to authenticated;
