begin;
-- An analytical cost is admitted from the posted expense journal and canonical
-- payment/independent delivery receipt, never from a browser amount or hash.
-- Missing costs, zero-cost assertions and unhandled refunds stay fail-closed.
create table public.credit_economic_cost_proposals_v1(
 id uuid primary key default extensions.gen_random_uuid(),component text not null check(component in('PSP_FEE','FULFILLMENT_COST')),
 target_id uuid not null,financial_journal_id uuid not null references public.financial_journals(id),
 net_cost_minor bigint not null check(net_cost_minor>0),currency char(3)not null,
 source_snapshot jsonb not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 reason text not null check(length(btrim(reason))between 10 and 2000),created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),idempotency_key text not null,unique(created_by,idempotency_key)
);
create table public.credit_economic_cost_decisions_v1(
 proposal_id uuid primary key references public.credit_economic_cost_proposals_v1(id),approved boolean not null,
 source_hash text not null,reason text not null check(length(btrim(reason))between 10 and 2000),
 decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp(),response jsonb not null
);
create table public.credit_economic_cost_reconciliations_v1(
 id uuid primary key default extensions.gen_random_uuid(),proposal_id uuid not null unique references public.credit_economic_cost_proposals_v1(id),
 component text not null check(component in('PSP_FEE','FULFILLMENT_COST')),target_id uuid not null,
 financial_journal_id uuid not null unique references public.financial_journals(id),net_cost_minor bigint not null check(net_cost_minor>0),currency char(3)not null,
 source_hash text not null,created_at timestamptz not null default clock_timestamp(),unique(component,target_id)
);
create table public.credit_economic_cost_attributions_v1(
 allocation_id uuid not null references public.credit_economic_allocations_v1(id),component text not null check(component in('PSP_FEE','FULFILLMENT_COST')),
 reconciliation_id uuid not null references public.credit_economic_cost_reconciliations_v1(id),
 amount_minor bigint not null check(amount_minor>=0),pnl_entry_id uuid unique references public.franchise_pnl_entries(id),
 source_snapshot jsonb not null,source_hash text not null,created_at timestamptz not null default clock_timestamp(),
 primary key(allocation_id,component),check((amount_minor>0)=(pnl_entry_id is not null))
);
create table private.credit_economic_cost_write_capabilities_v1(
 backend_pid integer not null,transaction_id bigint not null,allocation_id uuid not null,component text not null,
 reconciliation_id uuid not null,amount_minor bigint not null,primary key(backend_pid,transaction_id,allocation_id,component)
);
alter table private.credit_economic_cost_write_capabilities_v1 enable row level security;
revoke all on private.credit_economic_cost_write_capabilities_v1 from public,anon,authenticated,service_role;
do $$declare t text;begin foreach t in array array['credit_economic_cost_proposals_v1','credit_economic_cost_decisions_v1','credit_economic_cost_reconciliations_v1','credit_economic_cost_attributions_v1']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy credit_cost_finance_read on public.%I for select to authenticated using(private.credit_revenue_finance_access_v1())',t);
 execute format('create trigger credit_cost_immutable before update or delete on public.%I for each row execute function private.prevent_update_delete()',t);
end loop;end$$;

create function private.credit_economic_cost_source_v1(p_component text,p_target uuid,p_journal uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare j public.financial_journals%rowtype;f public.credit_economic_funding_sources_v1%rowtype;
 d public.benefit_redemptions%rowtype;receipt jsonb;target jsonb;entries jsonb;cost numeric;balance numeric;org uuid;target_currency char(3);
begin
 select*into j from public.financial_journals where id=p_journal;
 if p_component='PSP_FEE'then
  select*into f from public.credit_economic_funding_sources_v1 where id=p_target;
  if f.id is null or f.source_hash<>private.canonical_request_hash(f.source_snapshot)
   or not exists(select 1 from public.credit_economic_funding_evidence_v1 e where e.funding_source_id=f.id and e.evidence_kind='NATIVE_CAPTURE'and e.evidence_hash=f.source_snapshot->>'first_evidence_hash'and e.evidence_hash=private.canonical_request_hash(e.evidence_snapshot))
   or not exists(select 1 from public.financial_journals cash where cash.id=f.financial_journal_id and cash.organization_id=f.organization_id and cash.currency=f.currency and cash.status='POSTED')
  then raise exception'CREDIT_ECONOMIC_CAPTURE_PROOF_REQUIRED'using errcode='55000';end if;
  org:=f.organization_id;target_currency:=f.currency;
  target:=jsonb_build_object('funding_source_id',f.id,'funding_source_hash',f.source_hash,'financial_journal_id',f.financial_journal_id,'gross_minor',f.gross_minor::text);
 elsif p_component='FULFILLMENT_COST'then
  select*into d from public.benefit_redemptions where id=p_target;
  receipt:=private.benefit_accepted_receipt_v1(d.id,d.delivery_proof_hash);
  if d.id is null or d.status<>'CONSUMED'or receipt is null then raise exception'CREDIT_ECONOMIC_RECEIPT_PROOF_REQUIRED'using errcode='55000';end if;
  select b.franchise_organization_id,b.currency into org,target_currency from public.credit_economic_allocations_v1 a
   join public.credit_economic_consumption_facts_v1 cf on cf.id=a.consumption_fact_id join public.franchise_pnl_books b on b.id=a.book_id
   where cf.redemption_id=d.id order by a.created_at,a.id limit 1;
  if org is null or exists(select 1 from public.credit_economic_consumption_facts_v1 cf
    left join public.credit_economic_allocations_v1 a on a.consumption_fact_id=cf.id and a.allocation_kind='PURCHASE_CONSUMPTION'
    left join public.franchise_pnl_books b on b.id=a.book_id
    where cf.redemption_id=d.id and(a.id is null or b.franchise_organization_id is distinct from org or b.currency is distinct from target_currency))
  then raise exception'CREDIT_ECONOMIC_COMPLETE_FULFILLMENT_ALLOCATION_REQUIRED'using errcode='55000';end if;
  target:=jsonb_build_object('redemption_id',d.id,'receipt',receipt,'facts',(select jsonb_agg(jsonb_build_object('id',cf.id,'source_hash',cf.source_hash,'quantity',cf.consumed_quantity::text)order by cf.movement_id)from public.credit_economic_consumption_facts_v1 cf where cf.redemption_id=d.id));
 else raise exception'INVALID_CREDIT_ECONOMIC_COST_COMPONENT'using errcode='22023';end if;
 if j.id is null or j.status<>'POSTED'or j.organization_id is distinct from org or j.currency is distinct from target_currency
  or j.journal_type is distinct from(case p_component when'PSP_FEE'then'CREDIT_PSP_FEE'else'BENEFIT_FULFILLMENT_COST'end)
  or j.effective_at>clock_timestamp()
 then raise exception'CREDIT_ECONOMIC_EXPENSE_JOURNAL_REQUIRED'using errcode='55000';end if;
 select coalesce(sum(case e.direction when'DEBIT'then e.amount_minor else-e.amount_minor end)filter(where a.account_type='EXPENSE'),0),
  sum(case e.direction when'DEBIT'then e.amount_minor else-e.amount_minor end),
  jsonb_agg(jsonb_build_object('account_id',e.account_id,'account_type',a.account_type,'direction',e.direction,'amount_minor',e.amount_minor::text)order by e.id)
 into cost,balance,entries from public.financial_entries e join public.financial_accounts a on a.id=e.account_id where e.journal_id=j.id;
 if cost<=0 or cost>9223372036854775807 or balance is distinct from 0 or entries is null
  or exists(select 1 from public.financial_entries e join public.financial_accounts a on a.id=e.account_id where e.journal_id=j.id and(a.organization_id<>org or a.currency<>target_currency or e.currency<>target_currency or a.account_type='REVENUE'))
 then raise exception'CREDIT_ECONOMIC_PROVEN_NET_EXPENSE_REQUIRED'using errcode='55000';end if;
 if exists(select 1 from public.franchise_pnl_entries e where e.financial_journal_id=j.id and e.source_type<>'CREDIT_ECONOMIC_COST_V1')then raise exception'CREDIT_ECONOMIC_COST_JOURNAL_ALREADY_ATTRIBUTED'using errcode='55000';end if;
 return jsonb_build_object('component',p_component,'target_id',p_target,'target',target,'journal',to_jsonb(j),'entries',entries,'net_cost_minor',cost::text,'currency',target_currency,'organization_id',org,'vat_treatment','EXPENSE_ACCOUNTS_ONLY_EXCLUDING_RECOVERABLE_TAX');
end$$;
revoke all on function private.credit_economic_cost_source_v1(text,uuid,uuid)from public,anon,authenticated,service_role;

create function public.propose_credit_economic_cost_v1(p_component text,p_target_id uuid,p_financial_journal_id uuid,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare source jsonb;h text;p public.credit_economic_cost_proposals_v1%rowtype;id uuid:=extensions.gen_random_uuid();response jsonb;
begin
 if not private.credit_revenue_finance_access_v1(auth.uid(),true)then raise exception'CREDIT_ECONOMIC_COST_REVIEW_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_CREDIT_ECONOMIC_COST_PROPOSAL'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-cost:'||p_component||':'||p_target_id::text,0));
 source:=private.credit_economic_cost_source_v1(p_component,p_target_id,p_financial_journal_id);h:=private.canonical_request_hash(source);
 select*into p from public.credit_economic_cost_proposals_v1 where created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if p.id is not null then
  if p.component is distinct from p_component or p.target_id is distinct from p_target_id or p.financial_journal_id is distinct from p_financial_journal_id or p.reason is distinct from btrim(p_reason)or p.source_hash<>h then raise exception'CREDIT_ECONOMIC_COST_REPLAY_MISMATCH'using errcode='22000';end if;
  return jsonb_build_object('outcome','CREDIT_ECONOMIC_COST_PROPOSED','proposal_id',p.id,'source_hash',p.source_hash,'net_cost_minor',p.net_cost_minor::text,'currency',p.currency);
 end if;
 if private.is_active_org_member((source->>'organization_id')::uuid,auth.uid())
  or exists(select 1 from public.credit_economic_allocations_v1 a join public.franchise_pnl_books b on b.id=a.book_id left join public.credit_economic_consumption_facts_v1 cf on cf.id=a.consumption_fact_id where(case p_component when'PSP_FEE'then a.funding_source_id=p_target_id else cf.redemption_id=p_target_id end)and(private.is_active_org_member(b.franchise_organization_id,auth.uid())or private.is_active_org_member(cf.organization_id,auth.uid())))then raise exception'CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED'using errcode='42501';end if;
 if exists(select 1 from public.credit_economic_cost_reconciliations_v1 where component=p_component and target_id=p_target_id)then raise exception'CREDIT_ECONOMIC_COST_ALREADY_RECONCILED'using errcode='55000';end if;
 insert into public.credit_economic_cost_proposals_v1(id,component,target_id,financial_journal_id,net_cost_minor,currency,source_snapshot,source_hash,reason,created_by,idempotency_key)
 values(id,p_component,p_target_id,p_financial_journal_id,(source->>'net_cost_minor')::bigint,source->>'currency',source,h,btrim(p_reason),auth.uid(),p_idempotency_key);
 response:=jsonb_build_object('outcome','CREDIT_ECONOMIC_COST_PROPOSED','proposal_id',id,'source_hash',h,'net_cost_minor',source->>'net_cost_minor','currency',source->>'currency');
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values((source->>'organization_id')::uuid,auth.uid(),'USER','credit.economic.cost.proposed','credit_economic_cost',id::text,id,response,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values((source->>'organization_id')::uuid,'credit_economic_cost',id::text,'CreditEconomicCostProposedV1',id,response,'credit-economic-cost-proposed:'||id::text);
 return response;
end$$;

create function public.decide_credit_economic_cost_v1(p_proposal_id uuid,p_expected_source_hash text,p_approved boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare p public.credit_economic_cost_proposals_v1%rowtype;d public.credit_economic_cost_decisions_v1%rowtype;source jsonb;h text;reconciled uuid:=extensions.gen_random_uuid();response jsonb;
begin
 if not private.credit_revenue_finance_access_v1(auth.uid(),true)then raise exception'CREDIT_ECONOMIC_COST_REVIEW_DENIED'using errcode='42501';end if;
 select*into p from public.credit_economic_cost_proposals_v1 where id=p_proposal_id for update;
 if p.id is null or p.created_by=auth.uid()or p.source_snapshot#>>'{journal,created_by}'=auth.uid()::text
  or private.is_active_org_member((p.source_snapshot->>'organization_id')::uuid,auth.uid())
  or p.source_snapshot#>>'{target,receipt,operator_user_id}'=auth.uid()::text
  or p.source_snapshot#>>'{target,receipt,accepted_by}'=auth.uid()::text
  or exists(select 1 from public.credit_economic_allocations_v1 a join public.franchise_pnl_books b on b.id=a.book_id left join public.credit_economic_consumption_facts_v1 cf on cf.id=a.consumption_fact_id where(case p.component when'PSP_FEE'then a.funding_source_id=p.target_id else cf.redemption_id=p.target_id end)and(private.is_active_org_member(b.franchise_organization_id,auth.uid())or private.is_active_org_member(cf.organization_id,auth.uid())))
 then raise exception'CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED'using errcode='42501';end if;
 if p_approved is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_CREDIT_ECONOMIC_COST_DECISION'using errcode='22023';end if;
 if p_expected_source_hash is distinct from p.source_hash then raise exception'CREDIT_ECONOMIC_COST_SOURCE_CHANGED'using errcode='40001';end if;
 select*into d from public.credit_economic_cost_decisions_v1 where proposal_id=p.id;
 if d.proposal_id is not null then
  if d.approved is distinct from p_approved then raise exception'DECISION_ALREADY_RECORDED'using errcode='22000';end if;
  return d.response;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-cost:'||p.component||':'||p.target_id::text,0));
 source:=private.credit_economic_cost_source_v1(p.component,p.target_id,p.financial_journal_id);h:=private.canonical_request_hash(source);
 if h is distinct from p.source_hash then raise exception'CREDIT_ECONOMIC_COST_SOURCE_CHANGED'using errcode='40001';end if;
 if p_approved then
  insert into public.credit_economic_cost_reconciliations_v1(id,proposal_id,component,target_id,financial_journal_id,net_cost_minor,currency,source_hash)
   values(reconciled,p.id,p.component,p.target_id,p.financial_journal_id,p.net_cost_minor,p.currency,h);
 end if;
 response:=jsonb_build_object('outcome',case when p_approved then'CREDIT_ECONOMIC_COST_RECONCILED'else'CREDIT_ECONOMIC_COST_REJECTED'end,'proposal_id',p.id,'reconciliation_id',case when p_approved then reconciled end,'net_cost_minor',p.net_cost_minor::text,'currency',p.currency);
 insert into public.credit_economic_cost_decisions_v1(proposal_id,approved,source_hash,reason,decided_by,response)values(p.id,p_approved,h,btrim(p_reason),auth.uid(),response);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values((source->>'organization_id')::uuid,auth.uid(),'USER','credit.economic.cost.decided','credit_economic_cost',p.id::text,p.id,response,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values((source->>'organization_id')::uuid,'credit_economic_cost',p.id::text,'CreditEconomicCostDecidedV1',p.id,response,'credit-economic-cost-decided:'||p.id::text);
 return response;
end$$;

create function private.credit_economic_cost_share_v1(p_allocation uuid,p_component text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare a public.credit_economic_allocations_v1%rowtype;cf public.credit_economic_consumption_facts_v1%rowtype;
 c public.credit_economic_classifications_v1%rowtype;r public.credit_economic_cost_reconciliations_v1%rowtype;
 before_quantity numeric;total_quantity numeric;quantity numeric;amount bigint;source jsonb;
begin
 select*into a from public.credit_economic_allocations_v1 where id=p_allocation;
 select*into cf from public.credit_economic_consumption_facts_v1 where id=a.consumption_fact_id;
 select*into c from public.credit_economic_classifications_v1 where id=a.classification_id and funding_source_id=a.funding_source_id;
 if a.id is null or cf.id is null or c.id is null or a.allocation_kind<>'PURCHASE_CONSUMPTION'or a.currency<>cf.currency
  or a.content_hash<>private.canonical_request_hash(a.allocation_snapshot)
  or cf.source_hash<>private.canonical_request_hash(cf.source_snapshot)
  or private.credit_lot_funding_status_v1(cf.credit_lot_id)<>'ELIGIBLE'
  or private.benefit_accepted_receipt_v1(cf.redemption_id,cf.delivery_proof_hash)is null
 then raise exception'CREDIT_ECONOMIC_ADMISSIBLE_ALLOCATION_REQUIRED'using errcode='55000';end if;
 select*into r from public.credit_economic_cost_reconciliations_v1 where component=p_component and target_id=case p_component when'PSP_FEE'then a.funding_source_id when'FULFILLMENT_COST'then cf.redemption_id end;
 if r.id is null or r.currency<>a.currency then raise exception'CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 source:=private.credit_economic_cost_source_v1(r.component,r.target_id,r.financial_journal_id);
 if r.source_hash<>private.canonical_request_hash(source)or r.net_cost_minor is distinct from(source->>'net_cost_minor')::bigint
  or not exists(select 1 from public.credit_economic_cost_decisions_v1 d join public.credit_economic_cost_proposals_v1 p on p.id=d.proposal_id where p.id=r.proposal_id and d.approved and d.source_hash=r.source_hash and p.source_hash=r.source_hash)
 then raise exception'CREDIT_ECONOMIC_COST_SOURCE_CHANGED'using errcode='55000';end if;
 if p_component='PSP_FEE'then
  total_quantity:=c.net_minor;quantity:=a.amount_minor;
  select coalesce(sum(x.amount_minor),0)into before_quantity from public.credit_economic_allocations_v1 x
   where x.funding_source_id=a.funding_source_id and x.allocation_kind in('PURCHASE_CONSUMPTION','SUBSCRIPTION_POOL')and(x.created_at,x.id)<(a.created_at,a.id);
  if total_quantity<=0 or before_quantity+quantity>total_quantity then raise exception'CREDIT_ECONOMIC_ALLOCATION_EXCEEDS_FUNDED_NET'using errcode='23514';end if;
 else
  select coalesce(sum(x.consumed_quantity),0),coalesce(sum(x.consumed_quantity)filter(where x.movement_id<cf.movement_id),0)
   into total_quantity,before_quantity from public.credit_economic_consumption_facts_v1 x where x.redemption_id=cf.redemption_id;
  quantity:=cf.consumed_quantity;
  if total_quantity<=0 or before_quantity+quantity>total_quantity then raise exception'CREDIT_ECONOMIC_INVALID_FULFILLMENT_QUANTITY'using errcode='23514';end if;
 end if;
 amount:=(floor(r.net_cost_minor::numeric*(before_quantity+quantity)/total_quantity)-floor(r.net_cost_minor::numeric*before_quantity/total_quantity))::bigint;
 return jsonb_build_object('reconciliation_id',r.id,'source_hash',r.source_hash,'allocation_hash',a.content_hash,'component',p_component,'amount_minor',amount::text,'before_weight',before_quantity::text,'weight',quantity::text,'total_weight',total_quantity::text,'rounding','CUMULATIVE_FLOOR_EXACT_MINOR','financial_journal_id',r.financial_journal_id);
end$$;
revoke all on function private.credit_economic_cost_share_v1(uuid,text)from public,anon,authenticated,service_role;

create function private.guard_credit_economic_cost_pnl_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare a public.credit_economic_allocations_v1%rowtype;r public.credit_economic_cost_reconciliations_v1%rowtype;cap private.credit_economic_cost_write_capabilities_v1%rowtype;
begin
 if new.reverses_entry_id is not null and exists(select 1 from public.credit_economic_cost_attributions_v1 x where x.pnl_entry_id=new.reverses_entry_id)then raise exception'CREDIT_ECONOMIC_COST_CORRECTION_REQUIRED'using errcode='55000';end if;
 if new.source_type<>'CREDIT_ECONOMIC_COST_V1'then
  if exists(select 1 from public.credit_economic_cost_reconciliations_v1 x where x.financial_journal_id=new.financial_journal_id)then raise exception'CREDIT_ECONOMIC_RESERVED_COST_SOURCE_REQUIRED'using errcode='42501';end if;
  return new;
 end if;
 select*into cap from private.credit_economic_cost_write_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and allocation_id::text||':'||component=new.source_id;
 select*into a from public.credit_economic_allocations_v1 where id=cap.allocation_id;
 select*into r from public.credit_economic_cost_reconciliations_v1 where id=cap.reconciliation_id;
 if cap.allocation_id is null or a.id is null or r.id is null or new.book_id<>a.book_id or new.amount_minor<>cap.amount_minor or new.currency<>a.currency or new.effect_type<>'COST'
  or new.financial_journal_id<>r.financial_journal_id or new.category<>(case cap.component when'PSP_FEE'then'PAYMENT_FEE'else'PROVIDER_FULFILLMENT_COST'end)
  or not exists(select 1 from private.credit_economic_pnl_sources_v1 s join public.franchise_pnl_entries e on e.id=s.pnl_entry_id where s.allocation_id=a.id and e.effective_on=new.effective_on)
 then raise exception'CREDIT_ECONOMIC_RESERVED_COST_SOURCE_REQUIRED'using errcode='42501';end if;
 return new;
end$$;
revoke all on function private.guard_credit_economic_cost_pnl_v1()from public,anon,authenticated,service_role;
create trigger credit_economic_reserved_cost_guard before insert on public.franchise_pnl_entries for each row execute function private.guard_credit_economic_cost_pnl_v1();

create function public.reconcile_credit_economic_profit_v1(p_book_id uuid,p_period_start date,p_period_end date,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare b public.franchise_pnl_books%rowtype;a record;cost_kind text;share jsonb;old public.credit_economic_cost_attributions_v1%rowtype;
 amount bigint;pnl uuid;h text;response jsonb;correlation uuid:=extensions.gen_random_uuid();counted integer:=0;
begin
 select*into b from public.franchise_pnl_books where id=p_book_id;
 if not private.credit_revenue_finance_access_v1(auth.uid(),true)or b.id is null or private.is_active_org_member(b.franchise_organization_id,auth.uid())then raise exception'CREDIT_ECONOMIC_COST_REVIEW_DENIED'using errcode='42501';end if;
 if p_period_start is null or p_period_end is null or p_period_end<p_period_start or p_period_end>=p_period_start+interval'1 year'or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_CREDIT_ECONOMIC_PROFIT_PERIOD'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-profit:'||b.id::text,0));
 h:=private.canonical_request_hash(jsonb_build_object('book',b.id,'start',p_period_start,'end',p_period_end,'reason',btrim(p_reason)));
 response:=private.begin_contract_command(b.franchise_organization_id,'credit.economic.profit.reconcile',p_idempotency_key,h,auth.uid());if response is not null then return response;end if;
 for a in select x.*,e.effective_on from public.credit_economic_allocations_v1 x join private.credit_economic_pnl_sources_v1 s on s.allocation_id=x.id join public.franchise_pnl_entries e on e.id=s.pnl_entry_id
  where x.book_id=b.id and e.effective_on between p_period_start and p_period_end order by x.created_at,x.id loop
  perform pg_advisory_xact_lock(hashtextextended('credit-economic-funding:'||a.funding_source_id::text,0));
  foreach cost_kind in array array['PSP_FEE','FULFILLMENT_COST']loop
   share:=private.credit_economic_cost_share_v1(a.id,cost_kind);h:=private.canonical_request_hash(share);amount:=(share->>'amount_minor')::bigint;
   select*into old from public.credit_economic_cost_attributions_v1 where allocation_id=a.id and credit_economic_cost_attributions_v1.component=cost_kind;
   if old.allocation_id is not null then
    if old.source_hash<>h or old.amount_minor<>amount then raise exception'CREDIT_ECONOMIC_COST_ATTRIBUTION_CHANGED'using errcode='55000';end if;
    continue;
   end if;
   pnl:=null;
   if amount>0 then
    pnl:=extensions.gen_random_uuid();
    insert into private.credit_economic_cost_write_capabilities_v1(backend_pid,transaction_id,allocation_id,component,reconciliation_id,amount_minor)values(pg_backend_pid(),txid_current(),a.id,cost_kind,(share->>'reconciliation_id')::uuid,amount);
    insert into public.franchise_pnl_entries(id,book_id,effect_type,category,amount_minor,currency,financial_journal_id,source_type,source_id,effective_on,reason,correlation_id,created_by)
     values(pnl,b.id,'COST',case cost_kind when'PSP_FEE'then'PAYMENT_FEE'else'PROVIDER_FULFILLMENT_COST'end,amount,a.currency,(share->>'financial_journal_id')::uuid,'CREDIT_ECONOMIC_COST_V1',a.id::text||':'||cost_kind,a.effective_on,btrim(p_reason),correlation,auth.uid());
    delete from private.credit_economic_cost_write_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and allocation_id=a.id and credit_economic_cost_write_capabilities_v1.component=cost_kind;
   end if;
   insert into public.credit_economic_cost_attributions_v1(allocation_id,component,reconciliation_id,amount_minor,pnl_entry_id,source_snapshot,source_hash)
    values(a.id,cost_kind,(share->>'reconciliation_id')::uuid,amount,pnl,share,h);counted:=counted+1;
  end loop;
 end loop;
 perform private.assert_credit_economic_profit_close_ready_v1(b.id,p_period_start,p_period_end);
 response:=jsonb_build_object('outcome','CREDIT_ECONOMIC_PROFIT_RECONCILED','book_id',b.id,'new_attributions',counted);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(b.franchise_organization_id,auth.uid(),'USER','credit.economic.profit.reconciled','franchise_pnl_book',b.id::text,correlation,response,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(b.franchise_organization_id,'franchise_pnl_book',b.id::text,'CreditEconomicProfitReconciledV1',correlation,response,'credit-economic-profit:'||b.id::text||':'||p_idempotency_key);
 perform private.finish_contract_command(b.franchise_organization_id,'credit.economic.profit.reconcile',p_idempotency_key,response);return response;
end$$;

-- The existing lock and fail-closed boundary remain. Each real allocation now
-- passes only with two approved, current canonical expense attributions.
create or replace function private.assert_credit_economic_profit_close_ready_v1(p_book_id uuid,p_period_start date,p_period_end date)
returns void language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare b public.franchise_pnl_books%rowtype;a record;cf record;cost_kind text;share jsonb;x public.credit_economic_cost_attributions_v1%rowtype;
begin
 select*into b from public.franchise_pnl_books where id=p_book_id;
 for cf in select fact.*from public.credit_economic_consumption_facts_v1 fact where fact.library_id=b.library_id and fact.currency=b.currency and fact.consumed_at::date between p_period_start and p_period_end
  and coalesce((private.credit_economic_book_route_v1(fact.library_id,fact.organization_id,fact.currency,fact.consumed_at)#>>'{book,id}')::uuid,b.id)=b.id loop
  if not exists(select 1 from public.credit_economic_allocations_v1 x where x.consumption_fact_id=cf.id and x.book_id=b.id and x.allocation_kind='PURCHASE_CONSUMPTION')then raise exception'CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
 end loop;
 for a in select x.*,e.effective_on,e.id revenue_entry_id from public.credit_economic_allocations_v1 x join private.credit_economic_pnl_sources_v1 s on s.allocation_id=x.id join public.franchise_pnl_entries e on e.id=s.pnl_entry_id
  where x.book_id=b.id and e.effective_on between p_period_start and p_period_end loop
  if exists(select 1 from public.franchise_pnl_entries reversal where reversal.reverses_entry_id=a.revenue_entry_id)then raise exception'CREDIT_ECONOMIC_REVERSAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
  foreach cost_kind in array array['PSP_FEE','FULFILLMENT_COST']loop
   share:=private.credit_economic_cost_share_v1(a.id,cost_kind);
   select*into x from public.credit_economic_cost_attributions_v1 t where t.allocation_id=a.id and t.component=cost_kind;
   if x.allocation_id is null or x.source_hash<>private.canonical_request_hash(share)or x.amount_minor is distinct from(share->>'amount_minor')::bigint
    or(x.amount_minor>0 and not exists(select 1 from public.franchise_pnl_entries e where e.id=x.pnl_entry_id and e.book_id=b.id and e.effect_type='COST'and e.amount_minor=x.amount_minor and e.effective_on=a.effective_on and e.source_type='CREDIT_ECONOMIC_COST_V1'and not exists(select 1 from public.franchise_pnl_entries rev where rev.reverses_entry_id=e.id)))
   then raise exception'CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED'using errcode='55000';end if;
  end loop;
 end loop;
end$$;
revoke all on function private.assert_credit_economic_profit_close_ready_v1(uuid,date,date)from public,anon,authenticated,service_role;

-- A cutoff must include all canonical source/cost rows of the chosen period.
-- Lock the cost writers too; NOWAIT preserves a safe retry instead of a deadlock.
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.close_franchise_profit_period(uuid,date,date,uuid,timestamp with time zone,text,text,uuid)'::regprocedure);
 needle:='lock table public.credit_economic_consumption_facts_v1,public.credit_economic_allocations_v1 in share mode nowait;';
 if strpos(definition,needle)=0 then raise exception'CREDIT_ECONOMIC_CLOSE_LOCK_SOURCE_CHANGED';end if;
 definition:=replace(definition,needle,'lock table public.credit_economic_consumption_facts_v1,public.credit_economic_allocations_v1,public.credit_economic_cost_reconciliations_v1,public.credit_economic_cost_attributions_v1,public.franchise_pnl_entries in share mode nowait;');
 needle:='perform private.assert_credit_economic_profit_close_ready_v1(b.id,p_period_start,p_period_end);';
 if strpos(definition,needle)=0 then raise exception'CREDIT_ECONOMIC_CLOSE_READINESS_SOURCE_CHANGED';end if;
 definition:=replace(definition,needle,needle||$guard$
 if exists(select 1 from public.franchise_pnl_entries e where e.book_id=b.id and e.effective_on between p_period_start and p_period_end and e.source_type in('CREDIT_ECONOMIC_ALLOCATION_V1','CREDIT_ECONOMIC_COST_V1')and e.created_at>p_entry_cutoff_at)then raise exception'CREDIT_ECONOMIC_CUTOFF_EXCLUDES_RECONCILED_SOURCE'using errcode='55000';end if;
 $guard$);execute definition;
end $migration$;

create function public.get_credit_economic_profit_context_v1(p_book_id uuid,p_period_start date,p_period_end date,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare b public.franchise_pnl_books%rowtype;ready boolean:=true;reason text;central boolean;allocations jsonb;proposals jsonb;journals jsonb;
begin
 select*into b from public.franchise_pnl_books where id=p_book_id;
 central:=private.credit_revenue_finance_access_v1();
 if auth.uid()is null or auth.jwt()->>'aal'<>'aal2'or b.id is null or not private.franchise_book_access(b.id,auth.uid())then raise exception'CREDIT_ECONOMIC_PROFIT_READ_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 or p_period_start is null or p_period_end is null or p_period_end<p_period_start or p_period_end>=p_period_start+interval'1 year'then raise exception'INVALID_CREDIT_ECONOMIC_PROFIT_PERIOD'using errcode='22023';end if;
 begin perform private.assert_credit_economic_profit_close_ready_v1(b.id,p_period_start,p_period_end);
 exception when sqlstate'55000'or sqlstate'23514' then ready:=false;reason:='CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED';end;
 select coalesce(jsonb_agg(to_jsonb(recorded)),'[]')into allocations from(select a.id,a.funding_source_id,cf.redemption_id,a.amount_minor::text revenue_minor,a.currency,
  (select t.amount_minor::text from public.credit_economic_cost_attributions_v1 t where t.allocation_id=a.id and t.component='PSP_FEE')psp_fee_minor,
  (select t.amount_minor::text from public.credit_economic_cost_attributions_v1 t where t.allocation_id=a.id and t.component='FULFILLMENT_COST')fulfillment_cost_minor
  from public.credit_economic_allocations_v1 a join private.credit_economic_pnl_sources_v1 ps on ps.allocation_id=a.id join public.franchise_pnl_entries e on e.id=ps.pnl_entry_id
  left join public.credit_economic_consumption_facts_v1 cf on cf.id=a.consumption_fact_id where a.book_id=b.id and e.effective_on between p_period_start and p_period_end order by a.created_at,a.id offset((p_page-1)*50)limit 50) recorded;
 if central then
  select coalesce(jsonb_agg(to_jsonb(recorded)),'[]')into proposals from(select p.id,p.component,p.target_id,p.financial_journal_id,p.net_cost_minor::text,p.currency,p.source_hash,p.created_by,d.approved,d.decided_by
   from public.credit_economic_cost_proposals_v1 p left join public.credit_economic_cost_decisions_v1 d on d.proposal_id=p.id
   where exists(select 1 from public.credit_economic_allocations_v1 a left join public.credit_economic_consumption_facts_v1 cf on cf.id=a.consumption_fact_id where a.book_id=b.id and(case p.component when'PSP_FEE'then a.funding_source_id=p.target_id else cf.redemption_id=p.target_id end))order by p.created_at desc,p.id limit 100) recorded;
  select coalesce(jsonb_agg(to_jsonb(recorded)),'[]')into journals from(select j.id,j.journal_type,j.description,j.currency,(j.effective_at at time zone'Africa/Casablanca')::date effective_on,j.created_by
   from public.financial_journals j where j.status='POSTED'and j.currency=b.currency and j.journal_type in('CREDIT_PSP_FEE','BENEFIT_FULFILLMENT_COST')
   and(j.organization_id=b.franchise_organization_id or exists(select 1 from public.credit_economic_allocations_v1 a join public.credit_economic_funding_sources_v1 f on f.id=a.funding_source_id where a.book_id=b.id and f.organization_id=j.organization_id))order by j.effective_at desc,j.id limit 100) recorded;
 end if;
 return jsonb_build_object('book_id',b.id,'period_start',p_period_start,'period_end',p_period_end,'ready',ready,'reason_code',reason,'currency',b.currency,'allocations',allocations,'page',p_page,
  'has_more',exists(select 1 from public.credit_economic_allocations_v1 a join private.credit_economic_pnl_sources_v1 ps on ps.allocation_id=a.id join public.franchise_pnl_entries e on e.id=ps.pnl_entry_id where a.book_id=b.id and e.effective_on between p_period_start and p_period_end order by a.created_at,a.id offset(p_page*50)limit 1),
  'can_reconcile',central and private.credit_revenue_finance_access_v1(auth.uid(),true)and not private.is_active_org_member(b.franchise_organization_id,auth.uid()),'proposals',coalesce(proposals,'[]'),'journals',coalesce(journals,'[]'));
end$$;
revoke all on function public.get_credit_economic_profit_context_v1(uuid,date,date,integer)from public,anon,authenticated,service_role;
grant execute on function public.get_credit_economic_profit_context_v1(uuid,date,date,integer)to authenticated;

revoke all on function public.propose_credit_economic_cost_v1(text,uuid,uuid,text,text),public.decide_credit_economic_cost_v1(uuid,text,boolean,text),public.reconcile_credit_economic_profit_v1(uuid,date,date,text,text)from public,anon,authenticated,service_role;
grant execute on function public.propose_credit_economic_cost_v1(text,uuid,uuid,text,text),public.decide_credit_economic_cost_v1(uuid,text,boolean,text),public.reconcile_credit_economic_profit_v1(uuid,date,date,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
