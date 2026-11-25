begin;
-- A client questionnaire or project can exist before commercial activation.
-- Metering starts when a trial or subscription exists and never falls back.
create or replace function private.assert_subscription_resource_capacity_v1(p_organization_id uuid,p_resource text,p_usage bigint,p_increment bigint default 1)returns void
language plpgsql volatile security definer set search_path=pg_catalog,private as $$
declare funding jsonb;plan public.subscription_plan_versions%rowtype;ent record;quota bigint;trial boolean;configured boolean:=false;enabled boolean:=false;limits jsonb;begin
 if p_resource is null or p_resource not in('USERS','SITES','PROJECTS','DIAGNOSTICS','REPORTS')or p_usage is null or p_increment is null or p_usage<0 or p_increment<0 then raise exception'INVALID_SUBSCRIPTION_QUOTA_RESOURCE'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 -- Onboarding precedes an activated trial. Existing onboarding remains possible;
 -- a subscription/trial that exists never falls back to unmetered onboarding.
 insert into private.client_subscription_quota_serializers_v1(organization_id,resource)values(p_organization_id,p_resource)on conflict(organization_id,resource)do update set revision=client_subscription_quota_serializers_v1.revision+1;
 if not exists(select 1 from public.subscriptions where organization_id=p_organization_id)and not exists(select 1 from public.client_trials where organization_id=p_organization_id)then
  return;
 end if;
 if not private.subscription_financially_clear(p_organization_id)or not private.client_identity_allows_new_operations(p_organization_id)then raise exception'SUBSCRIPTION_OPERATION_RESTRICTED'using errcode='55000';end if;
 funding:=private.current_subscription_funding_v1(p_organization_id,statement_timestamp());
 select exists(select 1 from public.client_trials where organization_id=p_organization_id and status='TRIAL_ACTIVE'and trial_ends_at>statement_timestamp())into trial;
 if funding is not null then
  select*into plan from public.subscription_plan_versions where id=(funding->>'funded_plan_version_id')::uuid;
  for ent in select e.enabled,e.quota_value from public.plan_entitlements e where e.plan_version_id=plan.id and coalesce(e.configuration->>'resource',e.entitlement_code)=p_resource loop
   configured:=true;enabled:=enabled or ent.enabled;
   if ent.enabled and ent.quota_value is not null then quota:=case when quota is null then ent.quota_value else least(quota,ent.quota_value)end;end if;
  end loop;
  limits:=plan.limits_snapshot;
 elsif trial then
  for ent in select e.enabled,e.quota_value from public.trial_entitlement_versions e where e.status='ACTIVE'and e.effective_from<=statement_timestamp()and(e.effective_to is null or e.effective_to>statement_timestamp())and coalesce(e.configuration->>'resource',e.entitlement_code)=p_resource loop
   configured:=true;enabled:=enabled or ent.enabled;
   if ent.enabled and ent.quota_value is not null then quota:=case when quota is null then ent.quota_value else least(quota,ent.quota_value)end;end if;
  end loop;
 else raise exception'SUBSCRIPTION_CURRENT_FUNDING_REQUIRED'using errcode='55000';end if;
 -- Legacy limits snapshots may carry canonical resource keys. They are accepted
 -- only as exact nonnegative integers; malformed limits fail closed.
 if limits?p_resource or limits?lower(p_resource)then
  if coalesce(limits->>p_resource,limits->>lower(p_resource))!~'^[0-9]+$'then raise exception'INVALID_PUBLISHED_SUBSCRIPTION_QUOTA'using errcode='23514';end if;
  quota:=least(coalesce(quota,9223372036854775807),coalesce(limits->>p_resource,limits->>lower(p_resource))::bigint);configured:=true;
  if not exists(select 1 from public.plan_entitlements e where e.plan_version_id=plan.id and coalesce(e.configuration->>'resource',e.entitlement_code)=p_resource)then enabled:=true;end if;
 end if;
 if not configured then raise exception'SUBSCRIPTION_ENTITLEMENT_CONFIGURATION_REQUIRED'using errcode='55000';end if;
 if not enabled or exists(select 1 from public.subscription_entitlement_suspensions x join public.subscriptions s on s.id=x.subscription_id where s.organization_id=p_organization_id and(x.entitlement_code=p_resource or exists(select 1 from public.plan_entitlements pe where pe.plan_version_id=plan.id and pe.entitlement_code=x.entitlement_code and pe.configuration->>'resource'=p_resource)or exists(select 1 from public.trial_entitlement_versions te where te.entitlement_code=x.entitlement_code and te.status='ACTIVE'and te.configuration->>'resource'=p_resource))and x.effective_from<=statement_timestamp()and(x.effective_to is null or x.effective_to>statement_timestamp()))then raise exception'SUBSCRIPTION_ENTITLEMENT_DENIED'using errcode='42501';end if;
 if quota is not null and p_usage::numeric+p_increment::numeric>quota::numeric then raise exception'SUBSCRIPTION_QUOTA_EXCEEDED'using errcode='54000';end if;
end$$;
revoke all on function private.assert_subscription_resource_capacity_v1(uuid,text,bigint,bigint)from public,anon,authenticated,service_role;
commit;
