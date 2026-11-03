-- PAY03: adverse subscription financial events block new operations, never rewrite balances.
-- Depends on 20261031250200, which creates subscription_financial_holds.
begin;
create function private.subscription_financially_clear(p_organization_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select not exists(select 1 from public.subscription_financial_holds h where h.organization_id=p_organization_id and h.active)
$$;
revoke all on function private.subscription_financially_clear(uuid)from public,anon,authenticated,service_role;
create or replace function private.client_may_open_new_service_request(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    private.subscription_financially_clear(p_organization_id)
    and not exists (
      select 1
      from public.subscriptions subscription
      where subscription.organization_id = p_organization_id
        and subscription.status not in ('TRIAL_ACTIVE', 'ACTIVE')
    )
    and not exists (
      select 1
      from public.client_trials trial
      where trial.organization_id = p_organization_id
        and (trial.status = 'TRIAL_EXPIRED' or trial.trial_ends_at <= now())
        and not exists (
          select 1
          from public.subscriptions paid
          where paid.organization_id = p_organization_id
            and paid.status = 'ACTIVE'
        )
    )
    and not exists (
      select 1
      from public.client_administrative_anomalies anomaly
      where anomaly.organization_id = p_organization_id
        and anomaly.anomaly_code = 'DOCUMENT_EXPIRED'
        and anomaly.status in ('OPEN', 'QUESTIONED')
    );
$$;
create or replace function public.subscription_has_entitlement(p_organization_id uuid,p_entitlement_code text,p_at timestamptz default clock_timestamp())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$select private.subscription_read_access(p_organization_id,auth.uid())and private.subscription_financially_clear(p_organization_id)and case when exists(select 1 from public.client_trials t join public.trial_entitlement_versions te on te.entitlement_code=p_entitlement_code and te.status='ACTIVE'and te.enabled and te.effective_from<=p_at and(te.effective_to is null or te.effective_to>p_at)where t.organization_id=p_organization_id and t.status='TRIAL_ACTIVE'and p_at<t.trial_ends_at and not exists(select 1 from public.subscriptions s join public.subscription_entitlement_suspensions x on x.subscription_id=s.id where s.organization_id=p_organization_id and x.entitlement_code=p_entitlement_code and x.effective_from<=p_at and(x.effective_to is null or x.effective_to>p_at)))then true else exists(select 1 from public.subscriptions s join public.plan_entitlements e on e.plan_version_id=s.plan_version_id where s.organization_id=p_organization_id and s.status='ACTIVE'and p_at<s.current_period_end and e.entitlement_code=p_entitlement_code and e.enabled and not exists(select 1 from public.subscription_entitlement_suspensions x where x.subscription_id=s.id and x.entitlement_code=e.entitlement_code and x.effective_from<=p_at and(x.effective_to is null or x.effective_to>p_at)))end$$;
-- Both sides of a hold transition use one organization lock. The mutation guards
-- deliberately read in a VOLATILE trigger after acquiring the lock, so a waiter
-- sees a concurrently committed hold, rather than an earlier statement snapshot.
create function private.lock_subscription_financial_hold_transition()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if tg_op='UPDATE'and new.organization_id is distinct from old.organization_id then raise exception 'IMMUTABLE_FINANCIAL_HOLD_ORGANIZATION'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.organization_id::text,0));
 return new;
end$$;
create trigger subscription_financial_hold_transition_lock before insert or update on public.subscription_financial_holds for each row execute function private.lock_subscription_financial_hold_transition();
create function private.guard_subscription_financial_credit_operation()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if new.entry_type in('RESERVE','CONSUME')or(new.entry_type='GRANT'and new.reference_type='SUBSCRIPTION_GRANT')then
  perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.organization_id::text,0));
  if exists(select 1 from public.subscription_financial_holds h where h.organization_id=new.organization_id and h.active)then raise exception 'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 end if;
 return new;
end$$;
create trigger credit_entry_subscription_financial_hold before insert on public.credit_ledger_entries for each row execute function private.guard_subscription_financial_credit_operation();
create function private.guard_subscription_financial_new_request()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.client_organization_id::text,0));
 if exists(select 1 from public.subscription_financial_holds h where h.organization_id=new.client_organization_id and h.active)then raise exception 'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 return new;
end$$;
create trigger service_request_subscription_financial_hold before insert on public.service_requests for each row execute function private.guard_subscription_financial_new_request();
revoke all on function private.lock_subscription_financial_hold_transition(),private.guard_subscription_financial_credit_operation(),private.guard_subscription_financial_new_request()from public,anon,authenticated,service_role;
revoke all on function private.client_may_open_new_service_request(uuid)from public,anon,authenticated,service_role;
-- Payment history includes immutable after-payment adjustments and a current receipt state.
create or replace function public.list_client_financial_page(p_organization_id uuid,p_kind text default '',p_status text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING','CLIENT_VIEWER'],auth.uid())then raise exception 'CLIENT_FINANCE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or p_kind is null or p_kind not in('','SUBSCRIPTION','MISSION_RECEIPT')or p_status is null or p_status not in('','PENDING','CONFIRMED','PARTIALLY_REFUNDED','REFUNDED','REVERSED','DISPUTED','DISPUTE_LOST')then raise exception 'INVALID_FINANCE_FILTER'using errcode='22023';end if;
 with entries as(
 select i.id,'SUBSCRIPTION'::text kind,coalesce(e.payment_reference,i.provider_intent_id) reference,i.amount_minor::text amount_minor,i.currency::text currency,
 case when e.id is null then'PENDING'when dispute.event_type='DISPUTE_OPENED'then'DISPUTED'when dispute.event_type='DISPUTE_LOST'then'DISPUTE_LOST'when a.returned>=e.amount_minor then case when a.reversed>0 then'REVERSED'else'REFUNDED'end when a.returned>0 then'PARTIALLY_REFUNDED'else'CONFIRMED'end status,
 coalesce(e.paid_at,i.created_at)occurred_at,null::uuid mission_id,i.gateway='DEMO'is_demo,case when e.id is null then'PAYMENT_INTENT'else'PAYMENT_SUCCEEDED'end event_type,
 coalesce(a.returned,0)::text refunded_minor,(case when e.id is null then 0 else greatest(e.amount_minor-coalesce(a.returned,0),0)end)::text remaining_minor,coalesce(h.active,false)financial_hold
 from public.subscription_payment_intents i
 left join lateral(select e.*from public.subscription_payment_events e where e.payment_intent_id=i.id and e.organization_id=i.organization_id order by e.received_at,e.id limit 1)e on true
 left join lateral(select coalesce(sum(x.amount_minor)filter(where x.event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED')),0)returned,coalesce(sum(x.amount_minor)filter(where x.event_type='PAYMENT_REVERSED'),0)reversed from public.subscription_payment_adjustments x where x.payment_event_id=e.id)a on true
 left join lateral(select x.event_type from public.subscription_payment_adjustments x where x.payment_event_id=e.id and x.event_type in('DISPUTE_OPENED','DISPUTE_WON','DISPUTE_LOST')order by x.occurred_at desc,x.recorded_at desc,x.id desc limit 1)dispute on true
 left join public.subscription_financial_holds h on h.payment_event_id=e.id and h.organization_id=i.organization_id
 where i.organization_id=p_organization_id
 union all
 select x.id,'SUBSCRIPTION',x.provider_adjustment_id,x.amount_minor::text,x.currency::text,
 case x.event_type when'REFUND_SUCCEEDED'then'REFUNDED'when'PAYMENT_REVERSED'then'REVERSED'when'DISPUTE_OPENED'then'DISPUTED'when'DISPUTE_LOST'then'DISPUTE_LOST'else'CONFIRMED'end,
 x.occurred_at,null::uuid,false,x.event_type,'0','0',coalesce(h.active,false)
 from public.subscription_payment_adjustments x join public.subscription_payment_events e on e.id=x.payment_event_id
 left join public.subscription_financial_holds h on h.payment_event_id=e.id and h.organization_id=e.organization_id
 where e.organization_id=p_organization_id
 union all
 select e.id,'MISSION_RECEIPT',e.client_receipt_reference,e.gross_amount_minor::text,e.currency::text,'CONFIRMED',e.occurred_on::timestamptz,e.mission_id,false,'MISSION_RECEIPT','0',e.gross_amount_minor::text,false from public.provider_payable_events e where e.client_organization_id=p_organization_id and e.event_type='CLIENT_RECEIPT_CONFIRMED'
 ),page as(select *from entries where(p_kind=''or kind=p_kind)and(p_status=''or status=p_status)order by occurred_at desc,id offset(p_page-1)*20 limit 21)
 select coalesce(jsonb_agg(to_jsonb(page)order by occurred_at desc,id),'[]'::jsonb)into result from page;
 return result;
end$$;
revoke all on function public.list_client_financial_page(uuid,text,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_client_financial_page(uuid,text,text,integer)to authenticated;

commit;
