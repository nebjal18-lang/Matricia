begin;
-- Hosted development recorded 20261102023010 without keeping the serializer.
-- Recreate it so onboarding memberships can lock quota capacity.
create table if not exists private.client_subscription_quota_serializers_v1(
  organization_id uuid not null references public.organizations(id),
  resource text not null check(resource in('USERS','SITES','PROJECTS','DIAGNOSTICS','REPORTS')),
  revision bigint not null default 1,
  primary key(organization_id, resource)
);
alter table private.client_subscription_quota_serializers_v1 enable row level security;
revoke all on private.client_subscription_quota_serializers_v1 from public, anon, authenticated, service_role;
commit;
