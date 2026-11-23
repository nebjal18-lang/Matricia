begin;

-- Clone selectors need identifiers, never the private checklist payload.
grant select (id, service_version_id, version, created_at)
  on public.service_checklist_templates to authenticated;

create policy service_checklist_admin_clone_sources_read
  on public.service_checklist_templates
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.jwt()->>'aal') = 'aal2'
    and private.has_platform_role(
      array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER','READ_ONLY_AUDITOR'],
      (select auth.uid())
    )
  );

commit;
