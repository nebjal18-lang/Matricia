begin;
-- Approved execution settings are separate from the legal issuer/tax registry.
create table public.provider_closing_policies_v1(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),currency char(3)not null,
 receivable_account_id uuid not null references public.financial_accounts(id),revenue_account_id uuid not null references public.financial_accounts(id),tax_account_id uuid not null references public.financial_accounts(id),
 due_days integer not null default 7 check(due_days between 1 and 365),dispute_days integer not null check(dispute_days between 1 and 31),
 effective_from date not null,reference text not null check(length(btrim(reference))between 3 and 500),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table public.provider_closing_policy_decisions_v1(policy_id uuid primary key references public.provider_closing_policies_v1(id),approved boolean not null,reason text not null,decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp());
create table public.provider_billing_periods_v1(
 id uuid primary key default extensions.gen_random_uuid(),policy_id uuid not null references public.provider_closing_policies_v1(id),provider_organization_id uuid not null references public.organizations(id),currency char(3)not null,
 period_end date not null,generated_at timestamptz not null default clock_timestamp(),dispute_until timestamptz not null,unique(provider_organization_id,currency,period_end)
);
create table public.provider_pre_statement_lines_v1(period_id uuid not null references public.provider_billing_periods_v1(id),payable_event_id uuid not null references public.provider_payable_events(id),source_snapshot jsonb not null,primary key(period_id,payable_event_id));
create table public.provider_billing_line_disputes_v1(id uuid primary key default extensions.gen_random_uuid(),period_id uuid not null,payable_event_id uuid not null,reason text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),foreign key(period_id,payable_event_id)references public.provider_pre_statement_lines_v1(period_id,payable_event_id),unique(period_id,payable_event_id));
create table public.provider_billing_dispute_resolutions_v1(dispute_id uuid primary key references public.provider_billing_line_disputes_v1(id),release_line boolean not null,reason text not null,decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp());
create table public.provider_billing_period_completions_v1(period_id uuid primary key references public.provider_billing_periods_v1(id),result jsonb not null,completed_at timestamptz not null default clock_timestamp());
create table public.provider_billing_exceptions_v1(id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.organizations(id),period_end date not null,source_id uuid not null,reason_code text not null,created_at timestamptz not null default clock_timestamp(),unique(provider_organization_id,period_end,source_id,reason_code));
create function private.provider_period_access_v1(p_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$select exists(select 1 from public.provider_billing_periods_v1 p where p.id=p_id and private.provider_billing_access(p.provider_organization_id,auth.uid()))$$;
revoke all on function private.provider_period_access_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function private.provider_period_access_v1(uuid)to authenticated;
do $$declare t text;begin foreach t in array array['provider_closing_policies_v1','provider_closing_policy_decisions_v1','provider_billing_periods_v1','provider_pre_statement_lines_v1','provider_billing_line_disputes_v1','provider_billing_dispute_resolutions_v1','provider_billing_period_completions_v1','provider_billing_exceptions_v1']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('grant select on public.%I to authenticated',t);execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',t||'_immutable',t);
 end loop;end$$;
create policy closing_policy_read on public.provider_closing_policies_v1 for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid()));
create policy closing_policy_decision_read on public.provider_closing_policy_decisions_v1 for select to authenticated using(exists(select 1 from public.provider_closing_policies_v1 p where p.id=policy_id));
create policy billing_period_read on public.provider_billing_periods_v1 for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid()));
create policy pre_statement_read on public.provider_pre_statement_lines_v1 for select to authenticated using(private.provider_period_access_v1(period_id));
create policy billing_line_dispute_read on public.provider_billing_line_disputes_v1 for select to authenticated using(private.provider_period_access_v1(period_id));
create policy billing_resolution_read on public.provider_billing_dispute_resolutions_v1 for select to authenticated using(exists(select 1 from public.provider_billing_line_disputes_v1 d where d.id=dispute_id));
create policy billing_completion_read on public.provider_billing_period_completions_v1 for select to authenticated using(private.provider_period_access_v1(period_id));
create policy billing_exception_read on public.provider_billing_exceptions_v1 for select to authenticated using(private.provider_billing_access(provider_organization_id,auth.uid()));
create function public.propose_provider_closing_policy_v1(p_org uuid,p_currency char(3),p_receivable uuid,p_revenue uuid,p_tax uuid,p_due_days integer,p_dispute_days integer,p_effective_from date,p_reference text)returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare id uuid;begin
 if not private.provider_finance_reviewer_v1()or private.is_active_org_member(p_org,auth.uid())then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_effective_from is null or not exists(select 1 from public.provider_profiles where provider_organization_id=p_org)then raise exception'PROVIDER_REQUIRED'using errcode='22023';end if;
 if p_receivable=p_revenue or p_receivable=p_tax or p_revenue=p_tax or(select count(*)from public.financial_accounts a where a.organization_id=p_org and a.currency=p_currency and((a.id=p_receivable and a.account_type='ASSET')or(a.id=p_revenue and a.account_type='REVENUE')or(a.id=p_tax and a.account_type='LIABILITY')))<>3 then raise exception'INVALID_CLOSING_ACCOUNTS'using errcode='23514';end if;
 insert into public.provider_closing_policies_v1(provider_organization_id,currency,receivable_account_id,revenue_account_id,tax_account_id,due_days,dispute_days,effective_from,reference,created_by)values(p_org,p_currency,p_receivable,p_revenue,p_tax,p_due_days,p_dispute_days,p_effective_from,p_reference,auth.uid())returning provider_closing_policies_v1.id into id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_org,auth.uid(),'USER','provider.closing.policy.proposed','provider_closing_policy',id::text,id,jsonb_build_object('reference',p_reference),repeat('0',64));return id;
end$$;
create function public.decide_provider_closing_policy_v1(p_policy_id uuid,p_approved boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare p public.provider_closing_policies_v1%rowtype;begin
 select*into p from public.provider_closing_policies_v1 where id=p_policy_id for update;
 if not private.provider_finance_reviewer_v1()or p.id is null or p.created_by=auth.uid()or private.is_active_org_member(p.provider_organization_id,auth.uid())then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_approved is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_REASON'using errcode='22023';end if;
 insert into public.provider_closing_policy_decisions_v1(policy_id,approved,reason,decided_by)values(p.id,p_approved,p_reason,auth.uid())on conflict do nothing;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p.provider_organization_id,auth.uid(),'USER','provider.closing.policy.decided','provider_closing_policy',p.id::text,p.id,jsonb_build_object('approved',p_approved),repeat('0',64));return jsonb_build_object('outcome','PROVIDER_CLOSING_POLICY_REVIEWED');
end$$;
create function public.dispute_provider_billing_line_v1(p_period_id uuid,p_event_id uuid,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare p public.provider_billing_periods_v1%rowtype;id uuid;begin
 select*into p from public.provider_billing_periods_v1 where provider_billing_periods_v1.id=p_period_id for update;
 if p.id is null or not private.has_org_role(p.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_ACCOUNTING'],auth.uid())then raise exception'LINE_DISPUTE_DENIED'using errcode='42501';end if;
 if clock_timestamp()>p.dispute_until or exists(select 1 from public.provider_billing_period_completions_v1 where period_id=p.id)then raise exception'LINE_DISPUTE_WINDOW_CLOSED'using errcode='55000';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_REASON'using errcode='22023';end if;
 insert into public.provider_billing_line_disputes_v1(period_id,payable_event_id,reason,created_by)values(p.id,p_event_id,p_reason,auth.uid())on conflict(period_id,payable_event_id)do nothing returning provider_billing_line_disputes_v1.id into id;
 return jsonb_build_object('outcome','PROVIDER_BILLING_LINE_DISPUTED','dispute_id',id);
end$$;
create function public.resolve_provider_billing_line_v1(p_dispute_id uuid,p_release boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.provider_billing_line_disputes_v1%rowtype;org uuid;begin
 select*into d from public.provider_billing_line_disputes_v1 where id=p_dispute_id;select provider_organization_id into org from public.provider_billing_periods_v1 where id=d.period_id;
 if not private.provider_finance_reviewer_v1()or d.id is null or private.is_active_org_member(org,auth.uid())or d.created_by=auth.uid()then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_release is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_REASON'using errcode='22023';end if;
 insert into public.provider_billing_dispute_resolutions_v1(dispute_id,release_line,reason,decided_by)values(d.id,p_release,p_reason,auth.uid())on conflict do nothing;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,auth.uid(),'USER','provider.billing.dispute.resolved','provider_billing_line_dispute',d.id::text,d.id,jsonb_build_object('release_line',p_release),repeat('0',64));return jsonb_build_object('outcome','PROVIDER_BILLING_DISPUTE_RESOLVED');
end$$;
-- An approved payment plan only defers the installments which are not yet due.
create function private.provider_invoice_overdue_minor_v1(p_invoice_id uuid,p_as_of date default current_date)returns bigint language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare b public.provider_invoices%rowtype;outstanding bigint;plan uuid;total bigint;due bigint;paid_since bigint;begin
 select*into b from public.provider_invoices where id=p_invoice_id;if b.id is null then return 0;end if;outstanding:=private.provider_invoice_outstanding_minor(b.id);
 select p.id into plan from public.provider_payment_plans p where p.invoice_id=b.id and private.provider_payment_plan_status(p.id)='APPROVED'order by p.created_at desc,p.id desc limit 1;
 if plan is null then return case when b.due_on<p_as_of then outstanding else 0 end;end if;
 select sum(amount_minor),coalesce(sum(amount_minor)filter(where due_on<p_as_of),0)into total,due from public.provider_payment_plan_installments where plan_id=plan;
 if total is null or total<=0 then return case when b.due_on<p_as_of then outstanding else 0 end;end if;
 paid_since:=greatest(total-outstanding,0);return least(outstanding,greatest(due-paid_since,0)+case when b.due_on<p_as_of then greatest(outstanding-total,0)else 0 end);
end$$;
create or replace function private.provider_has_overdue_matricia_invoice(p_provider_organization_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$select exists(select 1 from public.provider_invoices i where i.provider_organization_id=p_provider_organization_id and private.provider_invoice_overdue_minor_v1(i.id)>0)$$;
revoke all on function private.provider_invoice_overdue_minor_v1(uuid,date),private.provider_has_overdue_matricia_invoice(uuid)from public,anon,authenticated,service_role;
-- Snapshot every eligible source before opening the contradictory window. Unconfirmed or
-- fiscal/legal exceptions are carried independently and cannot block another clean provider.
create function public.run_provider_billing_scheduler_v1(p_limit integer default 100)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare today date:=(clock_timestamp()at time zone'Africa/Casablanca')::date;ending date:=date_trunc('month',clock_timestamp()at time zone'Africa/Casablanca')::date-1;cfg public.provider_closing_policies_v1%rowtype;period public.provider_billing_periods_v1%rowtype;e record;g record;recipient record;policy jsonb;parties jsonb;sid uuid;iid uuid;jid uuid;number text;sub bigint;tax bigint;h text;r jsonb;processed integer:=0;corr uuid:=extensions.gen_random_uuid();outputs jsonb;taxes jsonb;
begin
 if auth.role()is distinct from'service_role'then raise exception'PROVIDER_BILLING_SCHEDULER_DENIED'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 500 then raise exception'INVALID_SCHEDULER_PAGE'using errcode='22023';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('provider-monthly-closing',0))then return jsonb_build_object('outcome','PROVIDER_BILLING_BUSY','processed',0);end if;
 for cfg in select p.*from public.provider_closing_policies_v1 p join public.provider_closing_policy_decisions_v1 d on d.policy_id=p.id and d.approved where p.effective_from<=today and not exists(select 1 from public.provider_closing_policies_v1 newer join public.provider_closing_policy_decisions_v1 nd on nd.policy_id=newer.id and nd.approved where newer.provider_organization_id=p.provider_organization_id and newer.currency=p.currency and newer.effective_from<=today and(newer.effective_from,newer.created_at,newer.id)>(p.effective_from,p.created_at,p.id))and(not exists(select 1 from public.provider_billing_periods_v1 bp where bp.provider_organization_id=p.provider_organization_id and bp.currency=p.currency and bp.period_end=ending)or exists(select 1 from public.provider_billing_periods_v1 bp where bp.provider_organization_id=p.provider_organization_id and bp.currency=p.currency and bp.dispute_until<=clock_timestamp()and not exists(select 1 from public.provider_billing_period_completions_v1 c where c.period_id=bp.id)))order by p.provider_organization_id,p.currency limit p_limit loop
 begin
  select*into period from public.provider_billing_periods_v1 where provider_organization_id=cfg.provider_organization_id and currency=cfg.currency and period_end=ending;
  if period.id is null then
   insert into public.provider_billing_periods_v1(policy_id,provider_organization_id,currency,period_end,dispute_until)values(cfg.id,cfg.provider_organization_id,cfg.currency,ending,clock_timestamp()+make_interval(days=>cfg.dispute_days))returning*into period;
   for e in select ev.*from public.provider_payable_events ev where ev.provider_organization_id=cfg.provider_organization_id and ev.currency=cfg.currency and ev.occurred_on<=ending and not exists(select 1 from public.provider_statement_lines l where l.payable_event_id=ev.id)order by ev.occurred_on,ev.id loop
    if private.provider_contract_recipient_snapshot_v1(e.contract_version_id)is null then insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code)values(cfg.provider_organization_id,ending,e.id,'CONTRACT_RECIPIENT_REVIEW_REQUIRED')on conflict do nothing;continue;end if;
    if not exists(select 1 from public.tax_rule_versions t where t.id=e.tax_rule_version_id and t.professional_validation_status='VALIDATED')then insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code)values(cfg.provider_organization_id,ending,e.id,'VALIDATED_TAX_RULE_REQUIRED')on conflict do nothing;continue;end if;
    insert into public.provider_pre_statement_lines_v1(period_id,payable_event_id,source_snapshot)values(period.id,e.id,to_jsonb(e)||jsonb_build_object('gross_amount_minor',e.gross_amount_minor::text,'commission_amount_minor',e.commission_amount_minor::text,'tax_amount_minor',e.tax_amount_minor::text,'total_due_minor',e.total_due_minor::text));
   end loop;
   for recipient in select distinct m.user_id,case when u.raw_user_meta_data->>'locale'like'ar%'then'ar-MA'else'fr-MA'end locale from public.organization_memberships m join public.organization_member_roles mr on mr.membership_id=m.id and mr.revoked_at is null and mr.role_code in('PROVIDER_OWNER','PROVIDER_ACCOUNTING')join auth.users u on u.id=m.user_id where m.organization_id=cfg.provider_organization_id and m.status='ACTIVE'loop
    perform public.enqueue_notification(recipient.user_id,cfg.provider_organization_id,'PROVIDER_PRE_STATEMENT','ProviderPreStatementReadyV1',recipient.locale,jsonb_build_object('organization_id',cfg.provider_organization_id,'period_end',ending,'dispute_until',period.dispute_until::text),'provider-pre-statement:'||period.id::text||':'||recipient.user_id::text,'provider_billing_period',period.id::text,corr);
   end loop;
  end if;
  -- Resume every older unfinished period too, using its frozen execution policy.
  for period in select bp.*from public.provider_billing_periods_v1 bp where bp.provider_organization_id=cfg.provider_organization_id and bp.currency=cfg.currency and bp.dispute_until<=clock_timestamp()and not exists(select 1 from public.provider_billing_period_completions_v1 c where c.period_id=bp.id)order by bp.period_end for update loop
   outputs:='[]';select*into cfg from public.provider_closing_policies_v1 where id=period.policy_id;
   policy:=private.approved_billing_policy_snapshot(cfg.currency,today);if policy is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
   for g in select private.provider_contract_recipient_snapshot_v1(ev.contract_version_id)recipient,array_agg(ev.id order by ev.id)ids,min(ev.occurred_on)first_day,sum(ev.commission_amount_minor)::bigint subtotal,sum(ev.tax_amount_minor)::bigint tax from public.provider_pre_statement_lines_v1 pl join public.provider_payable_events ev on ev.id=pl.payable_event_id where pl.period_id=period.id and not exists(select 1 from public.provider_statement_lines l where l.payable_event_id=ev.id)and not exists(select 1 from public.provider_billing_line_disputes_v1 d left join public.provider_billing_dispute_resolutions_v1 dr on dr.dispute_id=d.id where d.payable_event_id=ev.id and coalesce(dr.release_line,false)=false)group by private.provider_contract_recipient_snapshot_v1(ev.contract_version_id)loop
    if g.recipient is null then raise exception'CONTRACT_RECIPIENT_REVIEW_REQUIRED'using errcode='55000';end if;
    sid:=extensions.gen_random_uuid();iid:=extensions.gen_random_uuid();jid:=extensions.gen_random_uuid();number:=private.allocate_billing_document_number_v1((policy->>'policy_id')::uuid,'INVOICE',today);h:=private.canonical_request_hash(jsonb_build_object('period',period.id,'events',g.ids,'recipient',g.recipient));
    insert into public.provider_statements(id,provider_organization_id,statement_number,period_start,period_end,currency,subtotal_minor,tax_minor,total_minor,document_hash,correlation_id,created_by)values(sid,cfg.provider_organization_id,'ST-'||number,g.first_day,period.period_end,cfg.currency,g.subtotal,g.tax,g.subtotal+g.tax,h,corr,cfg.created_by);
    insert into public.provider_statement_lines(provider_organization_id,statement_id,payable_event_id,subtotal_minor,tax_minor,total_minor)select cfg.provider_organization_id,sid,ev.id,ev.commission_amount_minor,ev.tax_amount_minor,ev.total_due_minor from public.provider_payable_events ev where ev.id=any(g.ids);
    insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(cfg.provider_organization_id,'statement',sid,h,(policy->>'policy_id')::uuid,policy||jsonb_build_object('recipient_snapshot',g.recipient),'ST-'||number,today,cfg.created_by);
    insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)values(jid,cfg.provider_organization_id,'PROVIDER_COMMISSION_INVOICE',cfg.currency,'provider.monthly.close',sid::text,corr,today::timestamptz,'Automated approved monthly commission invoice',cfg.created_by);
    insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(cfg.provider_organization_id,jid,cfg.receivable_account_id,'DEBIT',g.subtotal+g.tax,cfg.currency),(cfg.provider_organization_id,jid,cfg.revenue_account_id,'CREDIT',g.subtotal,cfg.currency);
    if g.tax>0 then insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(cfg.provider_organization_id,jid,cfg.tax_account_id,'CREDIT',g.tax,cfg.currency);end if;
    select coalesce(jsonb_agg(distinct jsonb_build_object('tax_rule_version_id',ev.tax_rule_version_id,'rate_basis_points',ev.tax_rate_basis_points)),'[]')into taxes from public.provider_payable_events ev where ev.id=any(g.ids);
    insert into public.provider_invoices(id,provider_organization_id,statement_id,invoice_number,currency,subtotal_minor,tax_minor,total_minor,issued_on,due_on,tax_rule_snapshot,document_hash,journal_id,correlation_id,created_by)values(iid,cfg.provider_organization_id,sid,number,cfg.currency,g.subtotal,g.tax,g.subtotal+g.tax,today,today+cfg.due_days,taxes,h,jid,corr,cfg.created_by);
    insert into public.provider_billing_source_policy_bindings(provider_organization_id,kind,source_id,source_hash,policy_id,policy_snapshot,document_number,issued_on,bound_by)values(cfg.provider_organization_id,'invoice',iid,h,(policy->>'policy_id')::uuid,policy||jsonb_build_object('recipient_snapshot',g.recipient),number,today,cfg.created_by);
    insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(cfg.provider_organization_id,'provider_statement',sid::text,'ProviderStatementIssuedV1',corr,jsonb_build_object('statement_id',sid),'monthly-statement:'||sid::text),(cfg.provider_organization_id,'provider_invoice',iid::text,'ProviderInvoiceIssuedV1',corr,jsonb_build_object('invoice_id',iid),'monthly-invoice:'||iid::text);
    outputs:=outputs||jsonb_build_array(jsonb_build_object('statement_id',sid,'invoice_id',iid,'number',number));
   end loop;
   insert into public.provider_billing_period_completions_v1(period_id,result)values(period.id,jsonb_build_object('documents',outputs));
   insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(cfg.provider_organization_id,null,'SERVICE','provider.billing.period.closed','provider_billing_period',period.id::text,corr,jsonb_build_object('documents',outputs,'policy_id',cfg.id),repeat('0',64));
  end loop;processed:=processed+1;
 exception when others then
  insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code)values(cfg.provider_organization_id,ending,cfg.id,case when sqlerrm in('BILLING_POLICY_REQUIRED','CONTRACT_RECIPIENT_REVIEW_REQUIRED')then sqlerrm else'BILLING_EXECUTION_FAILED_'||sqlstate end)on conflict do nothing;
 end;
 end loop;
 return jsonb_build_object('outcome','PROVIDER_BILLING_SCHEDULER_COMPLETED','processed',processed,'period_end',ending);
end$$;
-- Templates contain no invented issuer, banking details or legal approval.
insert into public.notification_template_versions(template_code,version,event_type,category_code,locale,subject_template,body_template,cta_path_template,priority,mandatory,channels,variable_keys,status,effective_from,content_hash)values
('PROVIDER_PRE_STATEMENT',1,'ProviderPreStatementReadyV1','BILLING_CRITICAL','fr-MA','Votre pré-relevé est disponible','Période au {{period_end}}. Vous pouvez contester chaque ligne avant le {{dispute_until}}.','/fr/sous-traitant/facturation/pre-releve?organizationId={{organization_id}}','CRITICAL',true,array['IN_APP','EMAIL'],array['organization_id','period_end','dispute_until'],'ACTIVE','2026-11-02',private.canonical_request_hash(jsonb_build_object('template','PROVIDER_PRE_STATEMENT','locale','fr-MA','version',1))),
('PROVIDER_PRE_STATEMENT',1,'ProviderPreStatementReadyV1','BILLING_CRITICAL','ar-MA','الكشف الأولي متاح','الفترة إلى {{period_end}}. يمكن الاعتراض على كل سطر قبل {{dispute_until}}.','/ar/sous-traitant/facturation/pre-releve?organizationId={{organization_id}}','CRITICAL',true,array['IN_APP','EMAIL'],array['organization_id','period_end','dispute_until'],'ACTIVE','2026-11-02',private.canonical_request_hash(jsonb_build_object('template','PROVIDER_PRE_STATEMENT','locale','ar-MA','version',1)));
revoke all on function public.propose_provider_closing_policy_v1(uuid,char,uuid,uuid,uuid,integer,integer,date,text),public.decide_provider_closing_policy_v1(uuid,boolean,text),public.dispute_provider_billing_line_v1(uuid,uuid,text),public.resolve_provider_billing_line_v1(uuid,boolean,text),public.run_provider_billing_scheduler_v1(integer)from public,anon,authenticated,service_role;
grant execute on function public.propose_provider_closing_policy_v1(uuid,char,uuid,uuid,uuid,integer,integer,date,text),public.decide_provider_closing_policy_v1(uuid,boolean,text),public.dispute_provider_billing_line_v1(uuid,uuid,text),public.resolve_provider_billing_line_v1(uuid,boolean,text)to authenticated;
grant execute on function public.run_provider_billing_scheduler_v1(integer)to service_role;
notify pgrst,'reload schema';

commit;
