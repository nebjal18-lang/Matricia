begin;
-- Renewal starts a new, fully paid period only after the preceding period has
-- ended. It never truncates or rewrites an existing immutable paid cycle.
create or replace function private.assert_subscription_checkout_activatable_v1(p_organization_id uuid)returns void language plpgsql volatile security definer set search_path=pg_catalog,private as $$
declare s public.subscriptions%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 select*into s from public.subscriptions where organization_id=p_organization_id;
 if s.id is null or not(s.status in('TRIAL_ACTIVE','TRIAL_EXPIRED','PAST_DUE','SUSPENDED')or(s.status in('ACTIVE','CANCELLED')and s.current_period_end is not null and s.current_period_end<=statement_timestamp()))then raise exception'SUBSCRIPTION_NOT_ACTIVATABLE'using errcode='55000';end if;
 if not private.subscription_financially_clear(p_organization_id)then raise exception'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 if not private.client_identity_allows_new_operations(p_organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
end$$;
-- Keep the canonical trusted payment implementation and every runtime/amount/
-- replay/posting check. Only expand the state admission for an ended period;
-- payment timestamp also has to be after its end, even for delayed callbacks.
do $$declare definition text;marker text:='if not found or subscription.status not in (''TRIAL_ACTIVE'',''TRIAL_EXPIRED'',''PAST_DUE'',''SUSPENDED'') then';replacement text:='if not found or not(subscription.status in (''TRIAL_ACTIVE'',''TRIAL_EXPIRED'',''PAST_DUE'',''SUSPENDED'')or(subscription.status in(''ACTIVE'',''CANCELLED'')and subscription.current_period_end is not null and subscription.current_period_end<=p_paid_at and subscription.current_period_end<=statement_timestamp()))then';begin
 select pg_get_functiondef('private.process_subscription_payment_context_core_v1(text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception'SUBSCRIPTION_RENEWAL_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,replacement);
end$$;
notify pgrst,'reload schema';
commit;
