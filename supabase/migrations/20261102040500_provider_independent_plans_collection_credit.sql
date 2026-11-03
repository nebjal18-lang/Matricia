begin;
-- Financial permissions apply to the legacy ABI too, including composite roles.
create or replace function public.request_provider_payment_plan(
  p_invoice_id uuid,
  p_installments jsonb,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  invoice public.provider_invoices%rowtype;
  hashed text;
  cached jsonb;
  plan uuid;
  outstanding bigint;
  installment_sum bigint;
begin
  select * into invoice from public.provider_invoices where id = p_invoice_id for update;
  if actor is null or not found or not (
    private.has_org_role(invoice.provider_organization_id, array['PROVIDER_OWNER','PROVIDER_ACCOUNTING'], actor)
    or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'], actor)
  ) then
    raise exception 'PROVIDER_PAYMENT_PLAN_DENIED' using errcode = '42501';
  end if;
  hashed := private.canonical_request_hash(jsonb_build_object('invoice', invoice.id, 'installments', p_installments, 'reason', btrim(p_reason)));
  cached := private.begin_provider_billing_command(invoice.provider_organization_id, 'provider.billing.payment_plan.request', p_idempotency_key, hashed, actor);
  if cached is not null then return cached; end if;
  outstanding := private.provider_invoice_outstanding_minor(invoice.id);
  if outstanding <= 0 or jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) not between 2 and 12 or length(btrim(p_reason)) < 10 then
    raise exception 'INVALID_PAYMENT_PLAN' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_installments) item
    where coalesce((item->>'amount_minor')::bigint, 0) <= 0
      or coalesce((item->>'due_on')::date, current_date) <= current_date
  ) then
    raise exception 'INVALID_PAYMENT_PLAN' using errcode = '22023';
  end if;
  select sum((item->>'amount_minor')::bigint) into installment_sum from jsonb_array_elements(p_installments) item;
  if installment_sum is distinct from outstanding then
    raise exception 'PAYMENT_PLAN_AMOUNT_MISMATCH' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.provider_payment_plans existing
    where existing.invoice_id = invoice.id
      and private.provider_payment_plan_status(existing.id) in ('REQUESTED','APPROVED')
  ) then
    raise exception 'PAYMENT_PLAN_ALREADY_OPEN' using errcode = '23505';
  end if;
  insert into public.provider_payment_plans(provider_organization_id, invoice_id, reason, requested_by)
  values (invoice.provider_organization_id, invoice.id, btrim(p_reason), actor) returning id into plan;
  insert into public.provider_payment_plan_decisions(plan_id, provider_organization_id, decision_version, status, reason, decided_by)
  values (plan, invoice.provider_organization_id, 1, 'REQUESTED', btrim(p_reason), actor);
  insert into public.provider_payment_plan_installments(plan_id, provider_organization_id, sequence, due_on, amount_minor)
  select plan, invoice.provider_organization_id, t.ordinality::integer, (t.item->>'due_on')::date, (t.item->>'amount_minor')::bigint
  from jsonb_array_elements(p_installments) with ordinality as t(item, ordinality);
  cached := jsonb_build_object('outcome', 'PROVIDER_PAYMENT_PLAN_REQUESTED', 'plan_id', plan, 'invoice_id', invoice.id);
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (invoice.provider_organization_id, actor, 'USER', 'provider.payment_plan.requested', 'provider_payment_plan', plan::text, p_correlation_id, cached, repeat('0', 64));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (invoice.provider_organization_id, 'provider_payment_plan', plan::text, 'ProviderPaymentPlanRequestedV1', p_correlation_id, cached, p_idempotency_key);
  perform private.finish_provider_billing_command(invoice.provider_organization_id, 'provider.billing.payment_plan.request', p_idempotency_key, cached);
  return cached;
end$$;
create or replace function public.decide_provider_payment_plan(
  p_plan_id uuid,
  p_status text,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  plan public.provider_payment_plans%rowtype;
  hashed text;
  cached jsonb;
  current_status text;
  next_version integer;
begin
  select * into plan from public.provider_payment_plans where id = p_plan_id;
  if not private.provider_finance_reviewer_v1() or plan.id is null or private.is_active_org_member(plan.provider_organization_id,actor) or plan.requested_by=actor then
    raise exception 'PROVIDER_PAYMENT_PLAN_DECISION_DENIED' using errcode = '42501';
  end if;
  perform 1 from public.provider_invoices where id=plan.invoice_id for update;
  select * into plan from public.provider_payment_plans where id=p_plan_id for update;
  if p_status is null or p_status not in ('APPROVED','REJECTED') or length(btrim(coalesce(p_reason,''))) not between 10 and 2000 then
    raise exception 'INVALID_PAYMENT_PLAN_DECISION' using errcode = '22023';
  end if;
  hashed := private.canonical_request_hash(jsonb_build_object('plan', plan.id, 'status', p_status, 'reason', btrim(p_reason)));
  cached := private.begin_provider_billing_command(plan.provider_organization_id, 'provider.billing.payment_plan.decide', p_idempotency_key, hashed, actor);
  if cached is not null then return cached; end if;
  if p_status='APPROVED'and exists(select 1 from public.provider_payment_plans other where other.invoice_id=plan.invoice_id and other.id<>plan.id and private.provider_payment_plan_status(other.id)='APPROVED')then raise exception'PAYMENT_PLAN_ALREADY_APPROVED'using errcode='23505';end if;
  current_status := private.provider_payment_plan_status(plan.id);
  if current_status is distinct from 'REQUESTED' then
    raise exception 'PAYMENT_PLAN_NOT_DECIDABLE' using errcode = '55000';
  end if;

  select coalesce(max(decision_version), 0) + 1 into next_version from public.provider_payment_plan_decisions where plan_id = plan.id;
  insert into public.provider_payment_plan_decisions(plan_id, provider_organization_id, decision_version, status, reason, decided_by)
  values (plan.id, plan.provider_organization_id, next_version, p_status, btrim(p_reason), actor);
  cached := jsonb_build_object('outcome', case when p_status = 'APPROVED' then 'PROVIDER_PAYMENT_PLAN_APPROVED' else 'PROVIDER_PAYMENT_PLAN_REJECTED' end, 'plan_id', plan.id, 'invoice_id', plan.invoice_id, 'status', p_status);
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (plan.provider_organization_id, actor, 'USER', 'provider.payment_plan.decided', 'provider_payment_plan', plan.id::text, p_correlation_id, cached, repeat('0', 64));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (plan.provider_organization_id, 'provider_payment_plan', plan.id::text, 'ProviderPaymentPlanDecidedV1', p_correlation_id, cached, p_idempotency_key);
  perform private.finish_provider_billing_command(plan.provider_organization_id, 'provider.billing.payment_plan.decide', p_idempotency_key, cached);
  return cached;
end$$;
create or replace function public.open_provider_collection_case(
  p_invoice_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  invoice public.provider_invoices%rowtype;
  hashed text;
  cached jsonb;
  opened uuid;
  plan uuid;
  next_version integer;
begin
  select * into invoice from public.provider_invoices where id = p_invoice_id for update;
  if not private.provider_finance_reviewer_v1() or invoice.id is null or private.is_active_org_member(invoice.provider_organization_id,actor) then
    raise exception 'PROVIDER_COLLECTION_DENIED' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'INVALID_COLLECTION_CASE'using errcode='22023';end if;
  hashed := private.canonical_request_hash(jsonb_build_object('invoice', invoice.id, 'reason', btrim(p_reason)));
  cached := private.begin_provider_billing_command(invoice.provider_organization_id, 'provider.billing.collection.open', p_idempotency_key, hashed, actor);
  if cached is not null then return cached; end if;
  if private.provider_invoice_overdue_minor_v1(invoice.id)<=0 then raise exception 'INVALID_COLLECTION_CASE'using errcode='22023';end if;
  insert into public.provider_collection_cases(provider_organization_id, invoice_id, reason, opened_by)
  values (invoice.provider_organization_id, invoice.id, btrim(p_reason), actor)
  returning id into opened;
  insert into public.provider_collection_case_decisions(case_id, provider_organization_id, decision_version, status, reason, decided_by)
  values (opened, invoice.provider_organization_id, 1, 'OPEN', btrim(p_reason), actor);
  select existing.id into plan
  from public.provider_payment_plans existing
  where existing.invoice_id = invoice.id and private.provider_payment_plan_status(existing.id) = 'APPROVED'
  limit 1;
  if plan is not null then
    select coalesce(max(decision_version), 0) + 1 into next_version from public.provider_payment_plan_decisions where plan_id = plan;
    insert into public.provider_payment_plan_decisions(plan_id, provider_organization_id, decision_version, status, reason, decided_by)
    values (plan, invoice.provider_organization_id, next_version, 'DEFAULTED', btrim(p_reason), actor);
  end if;
  cached := jsonb_build_object('outcome', 'PROVIDER_COLLECTION_OPENED', 'collection_case_id', opened, 'invoice_id', invoice.id);
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (invoice.provider_organization_id, actor, 'USER', 'provider.collection.opened', 'provider_collection_case', opened::text, p_correlation_id, cached, repeat('0', 64));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (invoice.provider_organization_id, 'provider_collection_case', opened::text, 'ProviderCollectionOpenedV1', p_correlation_id, cached, p_idempotency_key);
  perform private.finish_provider_billing_command(invoice.provider_organization_id, 'provider.billing.collection.open', p_idempotency_key, cached);
  return cached;
end$$;
create or replace function public.advance_provider_collection_case(
  p_case_id uuid,
  p_status text,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  opened public.provider_collection_cases%rowtype;
  hashed text;
  cached jsonb;
  current_status text;
  next_version integer;
begin
  select * into opened from public.provider_collection_cases where id = p_case_id for update;
  if not private.provider_finance_reviewer_v1() or opened.id is null or private.is_active_org_member(opened.provider_organization_id,actor) then
    raise exception 'PROVIDER_COLLECTION_DENIED' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('FORMAL_NOTICE','COLLECTION','CLOSED') or length(btrim(coalesce(p_reason,''))) not between 10 and 2000 then
    raise exception 'INVALID_COLLECTION_ADVANCE' using errcode = '22023';
  end if;
  hashed := private.canonical_request_hash(jsonb_build_object('case', opened.id, 'to', p_status, 'reason', btrim(p_reason)));
  cached := private.begin_provider_billing_command(opened.provider_organization_id, 'provider.billing.collection.advance.v2', p_idempotency_key, hashed, actor);
  if cached is not null then return cached; end if;
  current_status := private.provider_collection_case_status(opened.id);
  if current_status = 'CLOSED' or (current_status = 'OPEN' and p_status not in ('FORMAL_NOTICE','CLOSED'))
     or (current_status = 'FORMAL_NOTICE' and p_status not in ('COLLECTION','CLOSED'))
     or (current_status = 'COLLECTION' and p_status <> 'CLOSED') then
    raise exception 'COLLECTION_TRANSITION_DENIED' using errcode = '55000';
  end if;

  select coalesce(max(decision_version), 0) + 1 into next_version from public.provider_collection_case_decisions where case_id = opened.id;
  insert into public.provider_collection_case_decisions(case_id, provider_organization_id, decision_version, status, reason, decided_by)
  values (opened.id, opened.provider_organization_id, next_version, p_status, btrim(p_reason), actor);
  cached := jsonb_build_object('outcome', 'PROVIDER_COLLECTION_ADVANCED', 'collection_case_id', opened.id, 'status', p_status, 'prior_status', current_status);
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (opened.provider_organization_id, actor, 'USER', 'provider.collection.advanced', 'provider_collection_case', opened.id::text, p_correlation_id, cached, repeat('0', 64));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (opened.provider_organization_id, 'provider_collection_case', opened.id::text, 'ProviderCollectionAdvancedV1', p_correlation_id, cached, p_idempotency_key);
  perform private.finish_provider_billing_command(opened.provider_organization_id, 'provider.billing.collection.advance.v2', p_idempotency_key, cached);
  return cached;
end$$;
-- The archived invoice's fiscal engine remains authoritative; the retained
-- p_tax_minor ABI argument is deliberately not a caller-controlled tax override.
do $migration$
declare definition text;needle text:=$needle$if invoice.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'],auth.uid())then$needle$;
begin
 definition:=pg_get_functiondef('public.issue_provider_credit_note(uuid,text,date,bigint,bigint,text,text,uuid)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception 'PROVIDER_CREDIT_REVIEW_PATCH_MISSING';end if;
 execute replace(definition,needle,'if invoice.id is null or not private.provider_finance_reviewer_v1()or private.is_active_org_member(invoice.provider_organization_id,auth.uid())then');
end $migration$;
create trigger governed_provider_credit_insert before insert on public.provider_credit_notes for each row execute function private.guard_provider_billing_issuer_v1();
notify pgrst,'reload schema';
commit;
