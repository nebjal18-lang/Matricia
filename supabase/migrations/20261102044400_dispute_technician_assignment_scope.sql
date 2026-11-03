begin;
-- Mission-bound incidents and their private evidence inherit the same technical
-- assignment scope as deliveries. Platform and Client permissions are retained.
create or replace function private.dispute_case_access(p_case_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p_actor is not null and(exists(select 1 from public.dispute_cases d where d.id=p_case_id and(
 private.is_active_org_member(d.client_organization_id,p_actor)or private.provider_mission_access_v1(d.mission_id,p_actor)))
 or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','DISPUTE_MANAGER','READ_ONLY_AUDITOR'],p_actor))
$$;
create or replace function private.dispute_evidence_access(p_evidence_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p_actor is not null and exists(select 1 from public.dispute_evidence e join public.dispute_cases d on d.id=e.dispute_case_id where e.id=p_evidence_id and(
 private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','DISPUTE_MANAGER','READ_ONLY_AUDITOR'],p_actor)
 or(e.visibility='BOTH_PARTIES'and(private.is_active_org_member(d.client_organization_id,p_actor)or private.provider_mission_access_v1(d.mission_id,p_actor)))
 or(e.visibility='CLIENT_ONLY'and private.is_active_org_member(d.client_organization_id,p_actor))
 or(e.visibility='PROVIDER_ONLY'and private.provider_mission_access_v1(d.mission_id,p_actor))))
$$;
-- Preserve the narrowly granted RLS predicates, not their private command helpers.
revoke all on function private.dispute_case_access(uuid,uuid),private.dispute_evidence_access(uuid,uuid)from public,anon,service_role;
grant execute on function private.dispute_case_access(uuid,uuid),private.dispute_evidence_access(uuid,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
