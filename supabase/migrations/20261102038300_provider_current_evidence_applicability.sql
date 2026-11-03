begin;
-- A current family version must remain explicitly applicable to every service
-- whose historical mandatory obligation it satisfies. A B-only renewal cannot
-- silently certify A, and superseded SUBMITTED rows are still ignored.
do $migration$
declare definition text;marker text;
begin
 definition:=pg_get_functiondef('private.provider_service_eligibility_snapshot(uuid,uuid)'::regprocedure);
 marker:='or(document.expires_on is not null and document.expires_on<=current_date)))then reasons:=array_append(reasons,''MANDATORY_DOCUMENT_INVALID'');';
 if position(marker in definition)=0 then raise exception 'PROVIDER_EVIDENCE_APPLICABILITY_PATCH_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,'or(document.expires_on is not null and document.expires_on<=current_date)or not exists(select 1 from public.provider_document_service_links current_link where current_link.document_version_id=document.id and current_link.provider_service_id=service_row.id and current_link.provider_organization_id=p_provider_organization_id)))then reasons:=array_append(reasons,''MANDATORY_DOCUMENT_INVALID'');');
end
$migration$;

-- RLS predicates must call helpers executable by the table reader. The command
-- helper remains private; platform read access preserves its role and MFA gate.
drop policy provider_work_scope_read on public.provider_work_scope_versions;
create policy provider_work_scope_read on public.provider_work_scope_versions for select to authenticated using(
 private.is_active_org_member(provider_organization_id,auth.uid())or(
 auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid())
 ));
notify pgrst,'reload schema';

commit;
