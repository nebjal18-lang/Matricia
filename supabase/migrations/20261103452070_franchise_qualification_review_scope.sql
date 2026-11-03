-- Restore the service-specific franchise review authority already enforced by
-- native qualification decisions before the purpose-bound projection was added.
-- No general questionnaire-session or organization SELECT permission is granted.
begin;
create or replace function private.provider_qualification_review_target_v1(p_qualification_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare target record;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'then raise exception 'QUALIFICATION_REVIEW_MFA_REQUIRED'using errcode='42501';end if;
 select q.id,q.provider_organization_id,q.service_id,q.row_version,s.library_id into target
 from public.provider_qualifications q join public.provider_services ps on ps.id=q.provider_service_id and ps.provider_organization_id=q.provider_organization_id and ps.service_id=q.service_id
 join public.catalog_services s on s.id=q.service_id where q.id=p_qualification_id;
 if not found then raise exception 'QUALIFICATION_REVIEW_DENIED'using errcode='42501';end if;
 if(private.can_decide_provider_qualification(auth.uid())or private.can_decide_franchise_service_qualification(target.service_id,auth.uid()))is distinct from true
 or private.is_active_org_member(target.provider_organization_id,auth.uid())then raise exception 'QUALIFICATION_REVIEW_DENIED'using errcode='42501';end if;
 return jsonb_build_object('qualificationId',target.id,'organizationId',target.provider_organization_id,'serviceId',target.service_id,'libraryId',target.library_id,'qualificationRowVersion',target.row_version);
end$$;
revoke all on function private.provider_qualification_review_target_v1(uuid)from public,anon,authenticated,service_role;
commit;
