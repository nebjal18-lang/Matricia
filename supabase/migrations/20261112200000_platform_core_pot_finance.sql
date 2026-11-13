-- Platform Core + entry-fee pot: after marketing/charges, remainder 50% Jalil-NEOXA / 50% Asma.
-- Additive: does not alter franchise IT 50/50 or STANDARD 50/25/25 engines.

create table public.platform_core_pot_rule_versions(
 id uuid primary key default extensions.gen_random_uuid(),
 version integer not null check(version>0),
 neoxa_jalil_share_bps integer not null check(neoxa_jalil_share_bps between 0 and 10000),
 asma_matricia_share_bps integer not null check(asma_matricia_share_bps between 0 and 10000),
 distribution_basis text not null check(distribution_basis='DISTRIBUTABLE_PLATFORM_POT'),
 formula_snapshot jsonb not null check(
  jsonb_typeof(formula_snapshot)='object'
  and formula_snapshot?&array['revenue_categories','deduction_categories','vat_treatment','rounding_policy']
 ),
 content_hash text not null check(content_hash~'^[0-9a-f]{64}$'),
 effective_from date not null,
 effective_to date,
 status text not null check(status in('ACTIVE','RETIRED')),
 approval_reason text not null check(length(btrim(approval_reason))between 10 and 1000),
 approved_by uuid references auth.users(id),
 approved_at timestamptz not null default clock_timestamp(),
 unique(version),
 check(neoxa_jalil_share_bps+asma_matricia_share_bps=10000),
 check(effective_to is null or effective_to>=effective_from),
 check(neoxa_jalil_share_bps=5000 and asma_matricia_share_bps=5000),
 check(formula_snapshot->>'vat_treatment'='EXCLUDED_FROM_REVENUE_AND_PROFIT'),
 check(formula_snapshot->>'rounding_policy'='ASMA_MATRICIA_REMAINDER')
);

create table public.platform_core_pot_books(
 id uuid primary key default extensions.gen_random_uuid(),
 audit_organization_id uuid not null references public.organizations(id)on delete restrict,
 currency char(3)not null check(currency~'^[A-Z]{3}$'),
 opened_under_rule_version_id uuid not null references public.platform_core_pot_rule_versions(id)on delete restrict,
 status text not null default'OPEN'check(status in('OPEN','CLOSED')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(audit_organization_id,currency),
 unique(id,audit_organization_id)
);

create table public.platform_core_pot_entries(
 id uuid primary key default extensions.gen_random_uuid(),
 book_id uuid not null references public.platform_core_pot_books(id)on delete restrict,
 effect_type text not null check(effect_type in('REVENUE','COST','REVERSAL_REVENUE','REVERSAL_COST')),
 category text not null check(category in(
  'CORE_SUBSCRIPTION_REVENUE_ACQUIRED',
  'ENTRY_FEE_ACQUIRED',
  'REFUND_CREDIT_NOTE',
  'MARKETING_COST',
  'OPERATING_CHARGE'
 )),
 amount_minor bigint not null check(amount_minor>0),
 currency char(3)not null check(currency~'^[A-Z]{3}$'),
 financial_journal_id uuid not null references public.financial_journals(id)on delete restrict,
 source_type text not null,
 source_id text not null,
 effective_on date not null,
 reason text not null check(length(btrim(reason))between 3 and 1000),
 reverses_entry_id uuid references public.platform_core_pot_entries(id)on delete restrict,
 correlation_id uuid not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(book_id,source_type,source_id,effect_type),
 check((effect_type in('REVENUE','COST')and reverses_entry_id is null)or(effect_type in('REVERSAL_REVENUE','REVERSAL_COST')and reverses_entry_id is not null)),
 check(
  (category in('CORE_SUBSCRIPTION_REVENUE_ACQUIRED','ENTRY_FEE_ACQUIRED')and effect_type in('REVENUE','REVERSAL_REVENUE'))
  or(category in('REFUND_CREDIT_NOTE','MARKETING_COST','OPERATING_CHARGE')and effect_type in('COST','REVERSAL_COST'))
 )
);

create table public.platform_core_pot_closure_versions(
 id uuid primary key default extensions.gen_random_uuid(),
 book_id uuid not null references public.platform_core_pot_books(id)on delete restrict,
 period_start date not null,
 period_end date not null,
 version integer not null check(version>0),
 supersedes_closure_id uuid references public.platform_core_pot_closure_versions(id)on delete restrict,
 rule_version_id uuid not null references public.platform_core_pot_rule_versions(id)on delete restrict,
 rule_snapshot jsonb not null check(jsonb_typeof(rule_snapshot)='object'),
 formula_snapshot jsonb not null check(jsonb_typeof(formula_snapshot)='object'),
 entry_cutoff_at timestamptz not null,
 gross_revenue_ex_tax_minor bigint not null,
 costs_and_refunds_minor bigint not null check(costs_and_refunds_minor>=0),
 distributable_remainder_minor bigint not null,
 content_hash text not null check(content_hash~'^[0-9a-f]{64}$'),
 closed_by uuid not null references auth.users(id),
 closed_at timestamptz not null default clock_timestamp(),
 unique(book_id,period_start,period_end,version),
 check(period_end>=period_start and period_end<period_start+interval'1 year')
);

create table public.platform_core_pot_allocations(
 id uuid primary key default extensions.gen_random_uuid(),
 closure_version_id uuid not null references public.platform_core_pot_closure_versions(id)on delete restrict,
 beneficiary_code text not null check(beneficiary_code in('NEOXA_JALIL','ASMA_MATRICIA')),
 share_bps integer not null check(share_bps between 0 and 10000),
 amount_minor bigint not null check(amount_minor>=0),
 currency char(3)not null check(currency~'^[A-Z]{3}$'),
 rounding_adjustment_minor integer not null default 0 check(abs(rounding_adjustment_minor)<=2),
 rights_snapshot jsonb not null check(jsonb_typeof(rights_snapshot)='object'),
 created_at timestamptz not null default clock_timestamp(),
 unique(closure_version_id,beneficiary_code)
);

create table public.platform_core_pot_distribution_ledger_entries(
 id bigint generated always as identity primary key,
 book_id uuid not null references public.platform_core_pot_books(id)on delete restrict,
 closure_version_id uuid references public.platform_core_pot_closure_versions(id)on delete restrict,
 allocation_id uuid references public.platform_core_pot_allocations(id)on delete restrict,
 beneficiary_code text not null check(beneficiary_code in('NEOXA_JALIL','ASMA_MATRICIA')),
 entry_type text not null check(entry_type in('ACCRUAL','ADJUSTMENT','PAYOUT','REVERSAL')),
 amount_minor bigint not null check(amount_minor<>0),
 currency char(3)not null check(currency~'^[A-Z]{3}$'),
 financial_journal_id uuid references public.financial_journals(id)on delete restrict,
 reference_type text not null,
 reference_id text not null,
 proof_hash text check(proof_hash~'^[0-9a-f]{64}$'),
 correlation_id uuid not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(book_id,beneficiary_code,entry_type,reference_type,reference_id),
 check((entry_type='ACCRUAL'and amount_minor>0)or(entry_type='PAYOUT'and amount_minor<0)or entry_type in('ADJUSTMENT','REVERSAL'))
);

create function private.platform_core_pot_access(p_book uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.platform_core_pot_books b where b.id=p_book)
  and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],p_actor)
$$;

create function private.prevent_platform_core_pot_change()returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'IMMUTABLE_PLATFORM_CORE_POT_RECORD'using errcode='55000';end$$;

create function private.assert_platform_core_pot_allocation_total()returns trigger
language plpgsql set search_path=pg_catalog,public as $$
declare cid uuid:=coalesce(new.closure_version_id,old.closure_version_id);expected bigint;actual bigint;items integer;
begin
 select greatest(distributable_remainder_minor,0)into expected from public.platform_core_pot_closure_versions where id=cid;
 select count(*),coalesce(sum(amount_minor),0)into items,actual from public.platform_core_pot_allocations where closure_version_id=cid;
 if items<>2 or actual<>expected then raise exception 'UNBALANCED_PLATFORM_CORE_POT_ALLOCATION'using errcode='23514';end if;
 return null;
end$$;

create function public.create_platform_core_pot_rule(
 p_audit_organization_id uuid,
 p_neoxa_jalil_share_bps integer,
 p_asma_matricia_share_bps integer,
 p_formula_snapshot jsonb,
 p_effective_from date,
 p_effective_to date,
 p_reason text,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();v integer;h text;r jsonb;id uuid;
begin
 if a is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or auth.jwt()->>'aal'<>'aal2'then
  raise exception 'PLATFORM_CORE_POT_RULE_DENIED'using errcode='42501';
 end if;
 if p_neoxa_jalil_share_bps<>5000 or p_asma_matricia_share_bps<>5000
  or jsonb_typeof(p_formula_snapshot)<>'object'
  or not(p_formula_snapshot?&array['revenue_categories','deduction_categories','vat_treatment','rounding_policy'])
  or p_formula_snapshot->>'vat_treatment'<>'EXCLUDED_FROM_REVENUE_AND_PROFIT'
  or p_formula_snapshot->>'rounding_policy'<>'ASMA_MATRICIA_REMAINDER'
  or length(btrim(coalesce(p_reason,'')))not between 10 and 1000
  or(p_effective_to is not null and p_effective_to<p_effective_from)
  or not exists(select 1 from public.organizations where id=p_audit_organization_id and status='ACTIVE')
 then raise exception 'INVALID_PLATFORM_CORE_POT_RULE'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object(
  'audit_organization_id',p_audit_organization_id,'shares',jsonb_build_array(p_neoxa_jalil_share_bps,p_asma_matricia_share_bps),
  'formula',p_formula_snapshot,'from',p_effective_from,'until',p_effective_to
 ));
 r:=private.begin_contract_command(p_audit_organization_id,'platform.core_pot.rule.create',p_idempotency_key,h,a);
 if r is not null then return r;end if;
 select coalesce(max(version),0)+1 into v from public.platform_core_pot_rule_versions;
 insert into public.platform_core_pot_rule_versions(
  version,neoxa_jalil_share_bps,asma_matricia_share_bps,distribution_basis,formula_snapshot,content_hash,effective_from,effective_to,status,approval_reason,approved_by
 )values(v,p_neoxa_jalil_share_bps,p_asma_matricia_share_bps,'DISTRIBUTABLE_PLATFORM_POT',p_formula_snapshot,h,p_effective_from,p_effective_to,'ACTIVE',p_reason,a)
 returning id into id;
 r:=jsonb_build_object('outcome','PLATFORM_CORE_POT_RULE_CREATED','rule_version_id',id,'version',v,'content_hash',h);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(p_audit_organization_id,a,'USER','platform.core_pot.rule.created','platform_core_pot_rule',id::text,p_correlation_id,jsonb_build_object('version',v),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(p_audit_organization_id,'platform_core_pot_rule',id::text,'PlatformCorePotRuleCreatedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(p_audit_organization_id,'platform.core_pot.rule.create',p_idempotency_key,r);
 return r;
end$$;

create function public.open_platform_core_pot_book(
 p_audit_organization_id uuid,
 p_currency text,
 p_rule_version_id uuid,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();v public.platform_core_pot_rule_versions%rowtype;h text;r jsonb;b uuid;
begin
 if a is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or auth.jwt()->>'aal'<>'aal2'then
  raise exception 'PLATFORM_CORE_POT_BOOK_DENIED'using errcode='42501';
 end if;
 select * into v from public.platform_core_pot_rule_versions where id=p_rule_version_id and status='ACTIVE';
 if not found or p_currency!~'^[A-Z]{3}$'or not exists(select 1 from public.organizations where id=p_audit_organization_id and status='ACTIVE')then
  raise exception 'INVALID_PLATFORM_CORE_POT_BOOK'using errcode='22023';
 end if;
 h:=private.canonical_request_hash(jsonb_build_object('organization',p_audit_organization_id,'currency',p_currency,'rule',p_rule_version_id));
 r:=private.begin_contract_command(p_audit_organization_id,'platform.core_pot.book.open',p_idempotency_key,h,a);
 if r is not null then return r;end if;
 insert into public.platform_core_pot_books(audit_organization_id,currency,opened_under_rule_version_id,created_by)
 values(p_audit_organization_id,p_currency,p_rule_version_id,a)returning id into b;
 r:=jsonb_build_object('outcome','PLATFORM_CORE_POT_BOOK_OPENED','book_id',b);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(p_audit_organization_id,a,'USER','platform.core_pot.book.opened','platform_core_pot_book',b::text,p_correlation_id,jsonb_build_object('rule_version_id',p_rule_version_id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(p_audit_organization_id,'platform_core_pot_book',b::text,'PlatformCorePotBookOpenedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(p_audit_organization_id,'platform.core_pot.book.open',p_idempotency_key,r);
 return r;
end$$;

create function public.post_platform_core_pot_entry(
 p_book_id uuid,
 p_effect_type text,
 p_category text,
 p_amount_minor bigint,
 p_financial_journal_id uuid,
 p_source_type text,
 p_source_id text,
 p_effective_on date,
 p_reason text,
 p_reverses_entry_id uuid,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();b public.platform_core_pot_books%rowtype;j public.financial_journals%rowtype;x public.platform_core_pot_entries%rowtype;h text;r jsonb;e uuid;
begin
 select * into b from public.platform_core_pot_books where id=p_book_id;
 select * into j from public.financial_journals where id=p_financial_journal_id;
 if a is null or b.id is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or auth.jwt()->>'aal'<>'aal2'then
  raise exception 'PLATFORM_CORE_POT_POST_DENIED'using errcode='42501';
 end if;
 if b.status<>'OPEN'or p_effect_type not in('REVENUE','COST','REVERSAL_REVENUE','REVERSAL_COST')
  or p_category not in('CORE_SUBSCRIPTION_REVENUE_ACQUIRED','ENTRY_FEE_ACQUIRED','REFUND_CREDIT_NOTE','MARKETING_COST','OPERATING_CHARGE')
  or p_amount_minor<=0 or j.id is null or j.organization_id<>b.audit_organization_id or j.currency<>b.currency or j.status<>'POSTED'
  or length(btrim(coalesce(p_reason,'')))not between 3 and 1000
 then raise exception 'INVALID_PLATFORM_CORE_POT_ENTRY'using errcode='22023';end if;
 -- Entry fees from IT books must never enter this pot (IT entry fee is structurally zero / exempt).
 if p_category='ENTRY_FEE_ACQUIRED'and p_source_type='FRANCHISE_ENTRY_FEE_PAYMENT'and exists(
  select 1 from public.franchise_entry_fee_ledger_entries fe
  join public.franchise_entry_fee_schedules s on s.id=fe.schedule_id
  join public.franchise_pnl_books pb on pb.id=s.book_id
  where fe.id::text=p_source_id and pb.franchise_type='IT'
 )then raise exception 'IT_ENTRY_FEE_EXCLUDED_FROM_PLATFORM_POT'using errcode='23514';end if;
 if p_effect_type in('REVERSAL_REVENUE','REVERSAL_COST')then
  select * into x from public.platform_core_pot_entries where id=p_reverses_entry_id and book_id=b.id;
  if not found or x.amount_minor<>p_amount_minor
   or(p_effect_type='REVERSAL_REVENUE'and x.effect_type<>'REVENUE')
   or(p_effect_type='REVERSAL_COST'and x.effect_type<>'COST')
   or exists(select 1 from public.platform_core_pot_entries where reverses_entry_id=x.id)
  then raise exception 'INVALID_PLATFORM_CORE_POT_REVERSAL'using errcode='22023';end if;
 elsif p_reverses_entry_id is not null then raise exception 'INVALID_PLATFORM_CORE_POT_REVERSAL'using errcode='22023';
 end if;
 h:=private.canonical_request_hash(jsonb_build_object(
  'book',b.id,'effect',p_effect_type,'category',p_category,'amount',p_amount_minor,'journal',j.id,
  'source_type',p_source_type,'source_id',p_source_id,'effective_on',p_effective_on,'reason',p_reason,'reverses',p_reverses_entry_id
 ));
 r:=private.begin_contract_command(b.audit_organization_id,'platform.core_pot.post.'||b.id::text,p_idempotency_key,h,a);
 if r is not null then return r;end if;
 insert into public.platform_core_pot_entries(
  book_id,effect_type,category,amount_minor,currency,financial_journal_id,source_type,source_id,effective_on,reason,reverses_entry_id,correlation_id,created_by
 )values(b.id,p_effect_type,p_category,p_amount_minor,b.currency,j.id,p_source_type,p_source_id,p_effective_on,p_reason,p_reverses_entry_id,p_correlation_id,a)
 returning id into e;
 r:=jsonb_build_object('outcome','PLATFORM_CORE_POT_ENTRY_POSTED','entry_id',e,'book_id',b.id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(b.audit_organization_id,a,'USER','platform.core_pot.entry.posted','platform_core_pot_entry',e::text,p_correlation_id,jsonb_build_object('category',p_category,'amount_minor',p_amount_minor),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(b.audit_organization_id,'platform_core_pot_book',b.id::text,'PlatformCorePotEntryPostedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(b.audit_organization_id,'platform.core_pot.post.'||b.id::text,p_idempotency_key,r);
 return r;
end$$;

create function public.close_platform_core_pot_period(
 p_book_id uuid,
 p_period_start date,
 p_period_end date,
 p_rule_version_id uuid,
 p_entry_cutoff_at timestamptz,
 p_reason text,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
 a uuid:=auth.uid();b public.platform_core_pot_books%rowtype;rv public.platform_core_pot_rule_versions%rowtype;
 prior public.platform_core_pot_closure_versions%rowtype;h text;r jsonb;c uuid;ver integer;
 revenue bigint;costs bigint;profit bigint;dist bigint;na bigint;aa bigint;rem bigint;benef text;alloc uuid;oldamt bigint;
begin
 select * into b from public.platform_core_pot_books where id=p_book_id;
 select * into rv from public.platform_core_pot_rule_versions where id=p_rule_version_id;
 if a is null or b.id is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or auth.jwt()->>'aal'<>'aal2'then
  raise exception 'PLATFORM_CORE_POT_CLOSE_DENIED'using errcode='42501';
 end if;
 if b.status<>'OPEN'or rv.id is null or rv.status<>'ACTIVE'
  or p_period_start<rv.effective_from or(rv.effective_to is not null and p_period_end>rv.effective_to)
  or p_period_end<p_period_start or p_period_end>=p_period_start+interval'1 year'
  or p_entry_cutoff_at>clock_timestamp()or length(btrim(coalesce(p_reason,'')))not between 10 and 1000
 then raise exception 'INVALID_PLATFORM_CORE_POT_CLOSURE'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(b.id::text||':core-pot:'||p_period_start::text||':'||p_period_end::text,0));
 select * into prior from public.platform_core_pot_closure_versions
  where book_id=b.id and period_start=p_period_start and period_end=p_period_end order by version desc limit 1;
 ver:=coalesce(prior.version,0)+1;
 select
  coalesce(sum(case when effect_type='REVENUE'then amount_minor when effect_type='REVERSAL_REVENUE'then-amount_minor else 0 end),0),
  coalesce(sum(case when effect_type='COST'then amount_minor when effect_type='REVERSAL_COST'then-amount_minor else 0 end),0)
 into revenue,costs
 from public.platform_core_pot_entries
 where book_id=b.id and effective_on between p_period_start and p_period_end and created_at<=p_entry_cutoff_at;
 if costs<0 then raise exception 'NEGATIVE_NET_COSTS_REQUIRE_REVIEW'using errcode='23514';end if;
 profit:=revenue-costs;
 h:=private.canonical_request_hash(jsonb_build_object(
  'book',b.id,'period_start',p_period_start,'period_end',p_period_end,'version',ver,'rule',to_jsonb(rv),
  'cutoff',p_entry_cutoff_at,'revenue',revenue,'costs',costs,'profit',profit,'reason',p_reason
 ));
 r:=private.begin_contract_command(b.audit_organization_id,'platform.core_pot.close.'||b.id::text||'.'||p_period_start::text||'.'||p_period_end::text,p_idempotency_key,h,a);
 if r is not null then return r;end if;
 insert into public.platform_core_pot_closure_versions(
  book_id,period_start,period_end,version,supersedes_closure_id,rule_version_id,rule_snapshot,formula_snapshot,
  entry_cutoff_at,gross_revenue_ex_tax_minor,costs_and_refunds_minor,distributable_remainder_minor,content_hash,closed_by
 )values(
  b.id,p_period_start,p_period_end,ver,prior.id,rv.id,to_jsonb(rv)-array['id','approved_by'],rv.formula_snapshot,
  p_entry_cutoff_at,revenue,costs,profit,h,a
 )returning id into c;
 dist:=greatest(profit,0);
 na:=dist*rv.neoxa_jalil_share_bps/10000;
 aa:=dist*rv.asma_matricia_share_bps/10000;
 rem:=dist-na-aa;
 aa:=aa+rem;
 for benef in select * from unnest(array['NEOXA_JALIL','ASMA_MATRICIA'])loop
  insert into public.platform_core_pot_allocations(
   closure_version_id,beneficiary_code,share_bps,amount_minor,currency,rounding_adjustment_minor,rights_snapshot
  )values(
   c,benef,
   case when benef='NEOXA_JALIL'then rv.neoxa_jalil_share_bps else rv.asma_matricia_share_bps end,
   case when benef='NEOXA_JALIL'then na else aa end,
   b.currency,
   case when benef='ASMA_MATRICIA'then rem else 0 end,
   jsonb_build_object('rule_version_id',rv.id,'rule_hash',rv.content_hash,'distribution_basis',rv.distribution_basis)
  )returning id into alloc;
  select coalesce(pa.amount_minor,0)into oldamt from public.platform_core_pot_allocations pa
   where pa.closure_version_id=prior.id and pa.beneficiary_code=benef;
  if not found then oldamt:=0;end if;
  if(case when benef='NEOXA_JALIL'then na else aa end)-oldamt<>0 then
   insert into public.platform_core_pot_distribution_ledger_entries(
    book_id,closure_version_id,allocation_id,beneficiary_code,entry_type,amount_minor,currency,reference_type,reference_id,correlation_id,created_by
   )values(
    b.id,c,alloc,benef,case when prior.id is null then'ACCRUAL'else'ADJUSTMENT'end,
    (case when benef='NEOXA_JALIL'then na else aa end)-oldamt,b.currency,'PLATFORM_CORE_POT_CLOSURE',c::text,p_correlation_id,a
   );
  end if;
 end loop;
 r:=jsonb_build_object(
  'outcome','PLATFORM_CORE_POT_CLOSED','closure_version_id',c,'version',ver,
  'gross_revenue_ex_tax_minor',revenue,'costs_and_refunds_minor',costs,'distributable_remainder_minor',profit
 );
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(b.audit_organization_id,a,'USER','platform.core_pot.closed','platform_core_pot_closure',c::text,p_correlation_id,jsonb_build_object('version',ver,'rule_version_id',rv.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(b.audit_organization_id,'platform_core_pot_closure',c::text,'PlatformCorePotClosedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(b.audit_organization_id,'platform.core_pot.close.'||b.id::text||'.'||p_period_start::text||'.'||p_period_end::text,p_idempotency_key,r);
 return r;
end$$;

create function public.record_platform_core_pot_payout(
 p_book_id uuid,
 p_beneficiary_code text,
 p_amount_minor bigint,
 p_financial_journal_id uuid,
 p_reference text,
 p_proof_hash text,
 p_idempotency_key text,
 p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();b public.platform_core_pot_books%rowtype;j public.financial_journals%rowtype;bal bigint;h text;r jsonb;e bigint;
begin
 select * into b from public.platform_core_pot_books where id=p_book_id;
 select * into j from public.financial_journals where id=p_financial_journal_id;
 if a is null or b.id is null or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)or auth.jwt()->>'aal'<>'aal2'then
  raise exception 'PLATFORM_CORE_POT_PAYOUT_DENIED'using errcode='42501';
 end if;
 if p_beneficiary_code not in('NEOXA_JALIL','ASMA_MATRICIA')or p_amount_minor<=0
  or j.id is null or j.organization_id<>b.audit_organization_id or j.currency<>b.currency or j.status<>'POSTED'
  or length(btrim(coalesce(p_reference,'')))<3 or p_proof_hash!~'^[0-9a-f]{64}$'
 then raise exception 'INVALID_PLATFORM_CORE_POT_PAYOUT'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(b.id::text||':core-pot:'||p_beneficiary_code,0));
 select coalesce(sum(amount_minor),0)into bal from public.platform_core_pot_distribution_ledger_entries
  where book_id=b.id and beneficiary_code=p_beneficiary_code;
 if bal<p_amount_minor then raise exception 'INSUFFICIENT_PLATFORM_CORE_POT_BALANCE'using errcode='23514';end if;
 h:=private.canonical_request_hash(jsonb_build_object(
  'book',b.id,'beneficiary',p_beneficiary_code,'amount',p_amount_minor,'journal',j.id,'reference',p_reference,'proof_hash',p_proof_hash
 ));
 r:=private.begin_contract_command(b.audit_organization_id,'platform.core_pot.payout.'||b.id::text,p_idempotency_key,h,a);
 if r is not null then return r;end if;
 insert into public.platform_core_pot_distribution_ledger_entries(
  book_id,beneficiary_code,entry_type,amount_minor,currency,financial_journal_id,reference_type,reference_id,proof_hash,correlation_id,created_by
 )values(b.id,p_beneficiary_code,'PAYOUT',-p_amount_minor,b.currency,j.id,'PAYOUT',p_reference,p_proof_hash,p_correlation_id,a)
 returning id into e;
 r:=jsonb_build_object('outcome','PLATFORM_CORE_POT_PAYOUT_RECORDED','ledger_entry_id',e,'remaining_balance_minor',bal-p_amount_minor);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(b.audit_organization_id,a,'USER','platform.core_pot.payout.recorded','platform_core_pot_distribution_entry',e::text,p_correlation_id,jsonb_build_object('beneficiary_code',p_beneficiary_code,'amount_minor',p_amount_minor),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(b.audit_organization_id,'platform_core_pot_book',b.id::text,'PlatformCorePotPayoutRecordedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(b.audit_organization_id,'platform.core_pot.payout.'||b.id::text,p_idempotency_key,r);
 return r;
end$$;

create trigger platform_core_pot_rules_immutable before update or delete on public.platform_core_pot_rule_versions for each row execute function private.prevent_platform_core_pot_change();
create trigger platform_core_pot_books_immutable before update or delete on public.platform_core_pot_books for each row execute function private.prevent_platform_core_pot_change();
create trigger platform_core_pot_entries_immutable before update or delete on public.platform_core_pot_entries for each row execute function private.prevent_platform_core_pot_change();
create trigger platform_core_pot_closures_immutable before update or delete on public.platform_core_pot_closure_versions for each row execute function private.prevent_platform_core_pot_change();
create trigger platform_core_pot_allocations_immutable before update or delete on public.platform_core_pot_allocations for each row execute function private.prevent_platform_core_pot_change();
create trigger platform_core_pot_distribution_immutable before update or delete on public.platform_core_pot_distribution_ledger_entries for each row execute function private.prevent_platform_core_pot_change();
create constraint trigger platform_core_pot_allocations_balanced after insert or update or delete on public.platform_core_pot_allocations deferrable initially deferred for each row execute function private.assert_platform_core_pot_allocation_total();

alter table public.platform_core_pot_rule_versions enable row level security;
alter table public.platform_core_pot_books enable row level security;
alter table public.platform_core_pot_entries enable row level security;
alter table public.platform_core_pot_closure_versions enable row level security;
alter table public.platform_core_pot_allocations enable row level security;
alter table public.platform_core_pot_distribution_ledger_entries enable row level security;

create policy platform_core_pot_rules_read on public.platform_core_pot_rule_versions for select to authenticated
 using(status='ACTIVE'or private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR']));
create policy platform_core_pot_books_read on public.platform_core_pot_books for select to authenticated using(private.platform_core_pot_access(id));
create policy platform_core_pot_entries_read on public.platform_core_pot_entries for select to authenticated using(private.platform_core_pot_access(book_id));
create policy platform_core_pot_closures_read on public.platform_core_pot_closure_versions for select to authenticated using(private.platform_core_pot_access(book_id));
create policy platform_core_pot_allocations_read on public.platform_core_pot_allocations for select to authenticated
 using(private.platform_core_pot_access((select c.book_id from public.platform_core_pot_closure_versions c where c.id=closure_version_id)));
create policy platform_core_pot_distribution_read on public.platform_core_pot_distribution_ledger_entries for select to authenticated using(private.platform_core_pot_access(book_id));

revoke all on public.platform_core_pot_rule_versions,public.platform_core_pot_books,public.platform_core_pot_entries,public.platform_core_pot_closure_versions,public.platform_core_pot_allocations,public.platform_core_pot_distribution_ledger_entries from public,anon,authenticated;
grant select on public.platform_core_pot_rule_versions,public.platform_core_pot_books,public.platform_core_pot_entries,public.platform_core_pot_closure_versions,public.platform_core_pot_allocations,public.platform_core_pot_distribution_ledger_entries to authenticated;

revoke all on function private.platform_core_pot_access(uuid,uuid),private.prevent_platform_core_pot_change(),private.assert_platform_core_pot_allocation_total()from public,anon,authenticated,service_role;
revoke all on function
 public.create_platform_core_pot_rule(uuid,integer,integer,jsonb,date,date,text,text,uuid),
 public.open_platform_core_pot_book(uuid,text,uuid,text,uuid),
 public.post_platform_core_pot_entry(uuid,text,text,bigint,uuid,text,text,date,text,uuid,text,uuid),
 public.close_platform_core_pot_period(uuid,date,date,uuid,timestamptz,text,text,uuid),
 public.record_platform_core_pot_payout(uuid,text,bigint,uuid,text,text,text,uuid)
from public,anon,authenticated,service_role;
grant execute on function
 public.create_platform_core_pot_rule(uuid,integer,integer,jsonb,date,date,text,text,uuid),
 public.open_platform_core_pot_book(uuid,text,uuid,text,uuid),
 public.post_platform_core_pot_entry(uuid,text,text,bigint,uuid,text,text,date,text,uuid,text,uuid),
 public.close_platform_core_pot_period(uuid,date,date,uuid,timestamptz,text,text,uuid),
 public.record_platform_core_pot_payout(uuid,text,bigint,uuid,text,text,text,uuid)
to authenticated;

create index platform_core_pot_rules_effective_idx on public.platform_core_pot_rule_versions(status,effective_from,effective_to);
create index platform_core_pot_books_org_idx on public.platform_core_pot_books(audit_organization_id,status,currency);
create index platform_core_pot_entries_period_idx on public.platform_core_pot_entries(book_id,effective_on,created_at);
create index platform_core_pot_closures_latest_idx on public.platform_core_pot_closure_versions(book_id,period_start,period_end,version desc);
create index platform_core_pot_allocations_beneficiary_idx on public.platform_core_pot_allocations(beneficiary_code,closure_version_id);
create index platform_core_pot_distribution_balance_idx on public.platform_core_pot_distribution_ledger_entries(book_id,beneficiary_code,id);

insert into public.platform_core_pot_rule_versions(
 version,neoxa_jalil_share_bps,asma_matricia_share_bps,distribution_basis,formula_snapshot,content_hash,effective_from,status,approval_reason
)values(
 1,5000,5000,'DISTRIBUTABLE_PLATFORM_POT',
 '{"revenue_categories":["CORE_SUBSCRIPTION_REVENUE_ACQUIRED","ENTRY_FEE_ACQUIRED"],"deduction_categories":["REFUND_CREDIT_NOTE","MARKETING_COST","OPERATING_CHARGE"],"vat_treatment":"EXCLUDED_FROM_REVENUE_AND_PROFIT","rounding_policy":"ASMA_MATRICIA_REMAINDER"}'::jsonb,
 private.canonical_request_hash('{"rule":"PLATFORM_CORE_POT_50_50_V1"}'::jsonb),
 '2026-11-12','ACTIVE',
 'Decision 2026-11-12 — Core + droits d''entrée hors IT : charges/marketing puis 50/50 Jalil-NEOXA / Asma'
)on conflict(version)do nothing;
