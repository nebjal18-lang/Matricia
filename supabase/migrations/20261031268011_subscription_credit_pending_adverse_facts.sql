-- A verified adverse inbox fact already blocks new value, even while routing
-- has not yet materialized subscription_financial_holds. Never rewrite history.
-- Depends on Integrations268002 payment_capture_has_adverse_fact_v1.
begin;
create function private.subscription_credit_payment_held_v1(p_payment_event_id bigint)returns boolean
language plpgsql stable security definer set search_path=pg_catalog,private as $$declare pay public.subscription_payment_events%rowtype;begin
 select*into pay from public.subscription_payment_events where id=p_payment_event_id;
 if pay.id is null then return true;end if;
 -- A partial native refund is already a value reversal even if aggregate
 -- subscription_financial_holds has not reached its full-refund threshold.
 return exists(select 1 from public.subscription_payment_adjustments where payment_event_id=pay.id and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED'))
 or exists(select 1 from public.subscription_financial_holds where payment_event_id=pay.id and active)
 or coalesce(private.payment_capture_has_adverse_fact_v1(pay.gateway,pay.provider_environment,pay.payment_reference),true);
end$$;
revoke all on function private.subscription_credit_payment_held_v1(bigint)from public,anon,authenticated,service_role;
do $$declare definition text;needle text;
begin
 definition:=pg_get_functiondef('private.bind_subscription_credit_payment_v1()'::regprocedure);
 needle:=' month_index:=coalesce';
 if position(needle in definition)=0 then raise exception'CREDIT_PENDING_ADVERSE_BIND_PATCH_MISMATCH';end if;
 definition:=replace(definition,needle,
  ' if private.subscription_credit_payment_held_v1(s.payment_event_id)then raise exception''SUBSCRIPTION_FINANCIAL_HOLD''using errcode=''55000'';end if;'||chr(10)||needle);
 execute definition;
 definition:=pg_get_functiondef('private.credit_lot_funding_status_v1(uuid)'::regprocedure);
 needle:=' if exists(select 1 from public.subscription_financial_holds';
 if position(needle in definition)=0 then raise exception'CREDIT_PENDING_ADVERSE_STATUS_PATCH_MISMATCH';end if;
 definition:=replace(definition,needle,
  ' if private.subscription_credit_payment_held_v1(s.payment_event_id)then return''PAYMENT_HELD'';end if;'||chr(10)||needle);
 execute definition;
 definition:=pg_get_functiondef('public.get_subscription_credit_grant_context_v1(uuid,bigint,integer)'::regprocedure);
 needle:=' if not private.subscription_financially_clear(p_organization_id)then';
 if position(needle in definition)=0 then raise exception'CREDIT_PENDING_ADVERSE_CONTEXT_PATCH_MISMATCH';end if;
 definition:=replace(definition,needle,
  ' if private.subscription_credit_payment_held_v1(p_payment_event_id)then blocked:=array_append(blocked,''SUBSCRIPTION_FINANCIAL_HOLD'');end if;'||chr(10)||needle);
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
