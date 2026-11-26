begin;
-- Mandated catalogue editors retain access after publication, independently of
-- the respondent audience. Existing scope and platform MFA checks still apply.
create or replace function private.can_read_questionnaire_version(p_version_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.questionnaire_versions v where v.id=p_version_id and (
    (v.status in ('DRAFT','LOCAL_TEST','FRANCHISE_REVIEW','CENTRAL_REVIEW','APPROVED','SCHEDULED','PUBLISHED') and private.has_library_permission(v.library_id,'CATALOG_VIEW_DRAFT',auth.uid()) and (auth.jwt()->>'aal'='aal2' or not private.has_any_questionnaire_platform_role()))
    or (v.status='PUBLISHED' and (
      (v.audience='INTERNAL' and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER'],auth.uid()))
      or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id and o.status='ACTIVE' join public.catalog_releases r on r.id=v.catalog_release_id and r.status='PUBLISHED' and statement_timestamp()>=r.effective_from and (r.effective_until is null or statement_timestamp()<r.effective_until) where m.user_id=auth.uid() and m.status='ACTIVE' and (r.audience->>'kind'='PUBLIC' or (r.audience->>'kind'='ORGANIZATIONS' and coalesce(r.audience->'organization_ids','[]'::jsonb)?m.organization_id::text)) and private.has_questionnaire_audience_access(m.organization_id,v.library_id,v.audience,'READ',auth.uid()))
    ))
    or (v.status='SUPERSEDED' and exists(
      select 1
      from public.questionnaire_sessions s
      join public.organization_memberships m on m.organization_id=s.organization_id and m.user_id=auth.uid() and m.status='ACTIVE'
      join public.organizations o on o.id=s.organization_id and o.status='ACTIVE'
      where s.questionnaire_version_id=v.id and s.actor_user_id=auth.uid()
        and private.has_questionnaire_audience_access(s.organization_id,v.library_id,v.audience,'READ',auth.uid())
    ))
  ))
$$;
commit;
