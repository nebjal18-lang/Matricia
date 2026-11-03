begin;
-- Read archived paid cycles without exposing unrelated retired commercial plans.
create function public.list_client_subscription_cycle_page_v1(p_subscription_id uuid,p_after_cycle integer default null,p_limit integer default 100)
returns table(id uuid,cycle_number integer,period_start timestamptz,period_end timestamptz,currency text,amount_minor text,plan jsonb)
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare subscription public.subscriptions%rowtype;
begin
 select *into subscription from public.subscriptions where subscriptions.id=p_subscription_id;
 if auth.uid()is null or subscription.id is null or not private.has_org_role(subscription.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING','CLIENT_VIEWER'])then raise exception'SUBSCRIPTION_HISTORY_ACCESS_DENIED'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 or p_after_cycle<=0 then raise exception'SUBSCRIPTION_HISTORY_LIMIT_INVALID'using errcode='22023';end if;
 return query select c.id,c.cycle_number,c.period_start,c.period_end,c.currency::text,c.amount_minor::text,private.project_subscription_plan_version(c.plan_version_id)
 from public.subscription_cycles c where c.subscription_id=subscription.id and c.organization_id=subscription.organization_id and(p_after_cycle is null or c.cycle_number<p_after_cycle)
 order by c.cycle_number desc limit p_limit;
end$$;
revoke all on function public.list_client_subscription_cycle_page_v1(uuid,integer,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_client_subscription_cycle_page_v1(uuid,integer,integer)to authenticated;
notify pgrst,'reload schema';
commit;
