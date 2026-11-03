begin;
-- Qualify the two table-column references that conflict with the existing local
-- id variable. Preserve the financial command's guards, hash, audit and outbox.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.create_franchise_finance_rule(uuid,text,text,boolean,integer,integer,integer,jsonb,date,date,text,text,uuid)'::regprocedure);
 needle:='select 1 from public.organizations where id=p_audit_organization_id and status=''ACTIVE''';
 if strpos(definition,needle)=0 then raise exception'FRANCHISE_FINANCE_RULE_ORG_SOURCE_CHANGED';end if;
 definition:=replace(definition,needle,'select 1 from public.organizations approved_organization where approved_organization.id=p_audit_organization_id and approved_organization.status=''ACTIVE''');
 needle:='returning id into id;';if strpos(definition,needle)=0 then raise exception'FRANCHISE_FINANCE_RULE_RETURNING_SOURCE_CHANGED';end if;
 execute replace(definition,needle,'returning franchise_finance_rule_versions.id into id;');
end$$;

-- Role identity is used only to explain a missing prerequisite. The established
-- authorization helper already applies MFA and cannot classify that prerequisite.
-- This private helper grants no right: the final AAL2+finance-access gate remains.
create function private.finance_cost_role_identity_v1(p_write boolean)returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select p_write is not null and auth.uid()is not null and private.current_auth_session_active_v1()is true
  and exists(select 1 from public.platform_user_roles role where role.user_id=auth.uid()and role.revoked_at is null
   and role.granted_at<=statement_timestamp()and role.role_code=any(case when p_write then array['SUPER_ADMIN','FINANCE_MANAGER']else array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR']end))
  and(not p_write or not exists(select 1 from public.platform_user_roles role where role.user_id=auth.uid()and role.revoked_at is null and role.granted_at<=statement_timestamp()and role.role_code='READ_ONLY_AUDITOR'))
$$;
revoke all on function private.finance_cost_role_identity_v1(boolean)from public,anon,authenticated,service_role;
create or replace function private.assert_finance_cost_document_access_v1(p_write boolean)
returns void language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid()is null or private.current_auth_session_active_v1()is distinct from true then raise exception'FINANCE_COST_UNAUTHENTICATED'using errcode='42501';end if;
 if private.finance_cost_role_identity_v1(p_write)is distinct from true then
  if p_write then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';else raise exception'FINANCE_COST_DOCUMENT_READ_DENIED'using errcode='42501';end if;
 end if;
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'FINANCE_COST_MFA_REQUIRED'using errcode='42501';end if;
 if private.credit_revenue_finance_access_v1(auth.uid(),p_write)is distinct from true then
  if p_write then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';else raise exception'FINANCE_COST_DOCUMENT_READ_DENIED'using errcode='42501';end if;
 end if;
end$$;

-- Exact current retry eligibility. The existing manual retry command resets the
-- automatic worker's attempt budget; no new retry right or automatic loop is added.
create function private.finance_cost_scan_retry_allowed_v1(p_upload uuid)returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.credit_revenue_finance_access_v1(auth.uid(),true)is true and exists(
  select 1 from public.finance_cost_document_uploads_v1 upload where upload.id=p_upload and upload.created_by=auth.uid()
   and upload.status='UPLOADED'and upload.scan_status in('PENDING','ERROR')
   and not exists(select 1 from private.finance_cost_document_scan_claims_v1 claim where claim.upload_id=upload.id and claim.leased_until>statement_timestamp()))
$$;
revoke all on function private.finance_cost_scan_retry_allowed_v1(uuid)from public,anon,authenticated,service_role;
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.get_finance_cost_documents_v1(text,uuid,integer)'::regprocedure);
 needle:='u.scan_status,u.created_by,exists';if strpos(definition,needle)=0 then raise exception'FINANCE_COST_RETRY_CAPABILITY_SOURCE_CHANGED';end if;
 execute replace(definition,needle,'u.scan_status,u.created_by,private.finance_cost_scan_retry_allowed_v1(u.id)can_retry,exists');
end$$;
notify pgrst,'reload schema';
commit;
