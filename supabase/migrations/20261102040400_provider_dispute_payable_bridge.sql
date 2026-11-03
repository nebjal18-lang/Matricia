begin;
create table public.provider_dispute_payable_sources_v1(consequence_id uuid primary key references public.dispute_financial_consequences(id),payable_event_id uuid not null unique references public.provider_payable_events(id),created_at timestamptz not null default clock_timestamp());
create table public.provider_dispute_reversal_credits_v1(reversal_id uuid primary key references public.dispute_financial_consequences(id),credit_note_id uuid not null unique references public.provider_credit_notes(id),reviewed_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
alter table public.provider_dispute_payable_sources_v1 enable row level security;
alter table public.provider_dispute_reversal_credits_v1 enable row level security;
revoke all on public.provider_dispute_payable_sources_v1,public.provider_dispute_reversal_credits_v1 from public,anon,authenticated,service_role;
grant select on public.provider_dispute_payable_sources_v1,public.provider_dispute_reversal_credits_v1 to authenticated;
create policy dispute_payable_source_read on public.provider_dispute_payable_sources_v1 for select to authenticated using(exists(select 1 from public.provider_payable_events e where e.id=payable_event_id and private.provider_billing_access(e.provider_organization_id,auth.uid())));
create policy dispute_reversal_credit_read on public.provider_dispute_reversal_credits_v1 for select to authenticated using(exists(select 1 from public.provider_credit_notes c where c.id=credit_note_id and private.provider_billing_access(c.provider_organization_id,auth.uid())));
create trigger dispute_payable_sources_immutable before update or delete on public.provider_dispute_payable_sources_v1 for each row execute function private.prevent_update_delete();
create trigger dispute_reversal_credits_immutable before update or delete on public.provider_dispute_reversal_credits_v1 for each row execute function private.prevent_update_delete();
alter table public.provider_billing_exceptions_v1 add column context jsonb not null default '{}';
create function private.ingest_provider_dispute_payables_v1(p_limit integer)returns integer language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare x record;rule public.tax_rule_versions%rowtype;resolved jsonb;event_id uuid;category text;counted integer:=0;corr uuid:=extensions.gen_random_uuid();ending date:=date_trunc('month',clock_timestamp()at time zone'Africa/Casablanca')::date-1;
begin
 for x in select c.*,d.decided_by,d.decided_at,m.id mission_id,m.client_organization_id,m.provider_organization_id,m.contract_version_id,v.price_minor,v.commission_rule_snapshot from public.dispute_financial_consequences c join public.dispute_decisions d on d.id=c.decision_id join public.dispute_cases dc on dc.id=c.dispute_case_id join public.missions m on m.id=dc.mission_id join public.contract_versions v on v.id=m.contract_version_id
 where c.direction='ACCRUAL'and dc.status in('DECIDED','CLOSED')and dc.appeal_due_at is not null and dc.appeal_due_at<=clock_timestamp()and d.outcome='NON_COMPLIANT_CONFIRMED'and c.payable_organization_id=m.provider_organization_id and c.currency=v.currency and not exists(select 1 from public.dispute_decisions newer where newer.dispute_case_id=d.dispute_case_id and newer.decision_number>d.decision_number)and not exists(select 1 from public.dispute_financial_consequences rev where rev.reverses_consequence_id=c.id and rev.direction='REVERSAL')and not exists(select 1 from public.provider_dispute_payable_sources_v1 s where s.consequence_id=c.id)order by c.created_at,c.id limit p_limit loop
 begin
  category:=case when x.consequence_type='CONTRACTUAL_PENALTY'then'PENALTY'else'PROVIDER_COMMISSION'end;
  resolved:=private.resolve_morocco_tax(category,(x.decided_at at time zone'Africa/Casablanca')::date,x.amount_minor,null);
  select*into rule from public.tax_rule_versions where id=(resolved->>'tax_rule_version_id')::uuid;
  if rule.professional_validation_status<>'VALIDATED'then raise exception'VALIDATED_TAX_RULE_REQUIRED'using errcode='55000';end if;
  insert into public.provider_payable_events(provider_organization_id,client_organization_id,mission_id,contract_version_id,event_type,occurred_on,currency,gross_amount_minor,commission_basis_points,commission_amount_minor,tax_rule_version_id,tax_rate_basis_points,tax_amount_minor,commission_rule_snapshot,client_receipt_reference,proof_hash,correlation_id,created_by)
  values(x.provider_organization_id,x.client_organization_id,x.mission_id,x.contract_version_id,case when x.consequence_type='CONTRACTUAL_PENALTY'then'PENALTY_ACCRUAL'else'COMMISSION_ACCRUAL'end,(x.decided_at at time zone'Africa/Casablanca')::date,x.currency,case when x.consequence_type='CONTRACTUAL_PENALTY'then x.amount_minor else greatest(x.amount_minor,x.price_minor)end,case when x.consequence_type='CONTRACTUAL_PENALTY'then 0 else coalesce((x.commission_rule_snapshot->>'commission_basis_points')::integer,(x.commission_rule_snapshot->>'basis_points')::integer,0)end,x.amount_minor,rule.id,rule.rate_basis_points,(resolved->>'tax_amount_minor')::bigint,x.commission_rule_snapshot||jsonb_build_object('source_type','FINAL_DISPUTE_CONSEQUENCE','consequence_id',x.id,'calculation','FIXED_CONTRACTUAL_AMOUNT'),'dispute-consequence:'||x.id::text,private.canonical_request_hash(jsonb_build_object('consequence_id',x.id,'decision_id',x.decision_id,'amount_minor',x.amount_minor::text,'rule_snapshot',x.rule_snapshot)),corr,x.decided_by)returning id into event_id;
  insert into public.provider_dispute_payable_sources_v1(consequence_id,payable_event_id)values(x.id,event_id);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(x.provider_organization_id,null,'SERVICE','provider.dispute.payable.accrued','provider_payable_event',event_id::text,corr,jsonb_build_object('consequence_id',x.id,'tax_category',category),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(x.provider_organization_id,'provider_payable_event',event_id::text,'ProviderDisputePayableAccruedV1',corr,jsonb_build_object('payable_event_id',event_id,'consequence_id',x.id),'dispute-payable:'||x.id::text);counted:=counted+1;
 exception when others then insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code)values(x.provider_organization_id,ending,x.id,case when sqlerrm='VALIDATED_TAX_RULE_REQUIRED'then sqlerrm else'DISPUTE_ACCRUAL_FAILED_'||sqlstate end)on conflict do nothing;
 end;
 end loop;
 -- Reversing an issued source creates a guided credit exception. No ledger or
 -- issued document is ever edited by this asynchronous reconciliation.
 insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code,context)
 select e.provider_organization_id,ending,rev.id,'DISPUTE_REVERSAL_CREDIT_NOTE_REQUIRED',jsonb_build_object('invoice_id',i.id,'invoice_number',i.invoice_number,'payable_event_id',e.id,'subtotal_minor',e.commission_amount_minor::text,'tax_minor',e.tax_amount_minor::text,'currency',e.currency)
 from public.dispute_financial_consequences rev join public.provider_dispute_payable_sources_v1 source on source.consequence_id=rev.reverses_consequence_id join public.provider_payable_events e on e.id=source.payable_event_id join public.provider_statement_lines l on l.payable_event_id=e.id join public.provider_invoices i on i.statement_id=l.statement_id where rev.direction='REVERSAL'and not exists(select 1 from public.provider_dispute_reversal_credits_v1 c where c.reversal_id=rev.id)on conflict do nothing;
 return counted;
end$$;
revoke all on function private.ingest_provider_dispute_payables_v1(integer)from public,anon,authenticated,service_role;
-- Extend the durable scheduler without adding an alternate service identity or an
-- ungoverned tax path. Finality and reversal checks also apply on closing retry.
do $$declare d text;needle text;begin
 select pg_get_functiondef('public.run_provider_billing_scheduler_v1(integer)'::regprocedure)into d;
 needle:='for cfg in select';if strpos(d,needle)=0 then raise exception'DISPUTE_INGEST_PATCH_TARGET_MISSING';end if;
 d:=replace(d,needle,'perform private.ingest_provider_dispute_payables_v1(p_limit);'||needle);
 needle:='and not exists(select 1 from public.provider_payable_admissions_v1 a where a.payable_event_id=e.id)';
 if strpos(d,needle)=0 then raise exception'DISPUTE_ADMISSION_PATCH_TARGET_MISSING';end if;
 d:=replace(d,needle,needle||'and not exists(select 1 from public.provider_dispute_payable_sources_v1 source where source.payable_event_id=e.id)');
 needle:='where pl.period_id=period.id and not exists';
 if strpos(d,needle)=0 then raise exception'DISPUTE_REVERSAL_PATCH_TARGET_MISSING';end if;
 d:=replace(d,needle,'where pl.period_id=period.id and not exists(select 1 from public.provider_dispute_payable_sources_v1 source join public.dispute_financial_consequences rev on rev.reverses_consequence_id=source.consequence_id and rev.direction=''REVERSAL''where source.payable_event_id=ev.id)and not exists');execute d;
end$$;
create function public.issue_provider_dispute_reversal_credit_v1(p_reversal_id uuid,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare rev public.dispute_financial_consequences%rowtype;e public.provider_payable_events%rowtype;i public.provider_invoices%rowtype;r jsonb;credit uuid;
begin
 if not private.provider_finance_reviewer_v1()then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 select*into rev from public.dispute_financial_consequences where id=p_reversal_id and direction='REVERSAL'for update;
 select ev.*into e from public.provider_dispute_payable_sources_v1 source join public.provider_payable_events ev on ev.id=source.payable_event_id where source.consequence_id=rev.reverses_consequence_id;
 if e.id is null or e.created_by=auth.uid()or exists(select 1 from public.dispute_decisions d where d.id=rev.decision_id and d.decided_by=auth.uid())or private.is_active_org_member(e.provider_organization_id,auth.uid())then raise exception'REVERSAL_CREDIT_DENIED'using errcode='42501';end if;
 select credit_note_id into credit from public.provider_dispute_reversal_credits_v1 where reversal_id=rev.id;if found then return jsonb_build_object('outcome','PROVIDER_DISPUTE_REVERSAL_CREDIT_ISSUED','credit_note_id',credit);end if;
 select invoice.*into i from public.provider_statement_lines l join public.provider_invoices invoice on invoice.statement_id=l.statement_id where l.payable_event_id=e.id for update of invoice;
 if i.id is null then raise exception'REVERSAL_NOT_INVOICED'using errcode='55000';end if;
 r:=public.issue_provider_credit_note(i.id,'AUTO',(clock_timestamp()at time zone'Africa/Casablanca')::date,e.commission_amount_minor,e.tax_amount_minor,p_reason,p_idempotency_key,rev.id);
 insert into public.provider_dispute_reversal_credits_v1(reversal_id,credit_note_id,reviewed_by)values(rev.id,(r->>'credit_note_id')::uuid,auth.uid());return r||jsonb_build_object('outcome','PROVIDER_DISPUTE_REVERSAL_CREDIT_ISSUED','reversal_id',rev.id);
end$$;
revoke all on function public.issue_provider_dispute_reversal_credit_v1(uuid,text,text)from public,anon,authenticated,service_role;
grant execute on function public.issue_provider_dispute_reversal_credit_v1(uuid,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
