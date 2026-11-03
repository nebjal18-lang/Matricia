-- Consume Admin's additive per-mandate assignments without replacing the legacy member-role PK.
create or replace function private.franchise_access(p_franchise_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','LIBRARY_MANAGER','READ_ONLY_AUDITOR'],p_actor)
 or private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER'],p_actor)
$$;
create or replace function private.franchise_crm_write_access(p_franchise uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],p_actor)or private.has_franchise_role(p_franchise,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],p_actor)
$$;
create or replace function private.franchise_crm_row_access(p_franchise_id uuid,p_territory_version_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.franchise_territory_versions t where t.franchise_id=p_franchise_id and t.id=p_territory_version_id)
 and(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],p_actor)or private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_VIEWER'],p_actor))
$$;
create or replace function private.franchise_book_access(p_book uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],p_actor)or exists(
 select 1 from public.franchise_pnl_books b join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id
 where b.id=p_book and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER'],p_actor))
$$;
create or replace function private.franchise_digest_role_access(p_franchise_id uuid,p_allow_platform_admin boolean default true,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.franchises f where f.id=p_franchise_id and f.status='ACTIVE'and(
 (p_allow_platform_admin and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR'],p_actor))
 or private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_VIEWER'],p_actor)))
$$;
create or replace function private.franchise_message_can_write(p_franchise_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.active_franchise_messaging_scope(p_franchise_id,p_actor)and private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],p_actor)
$$;
create or replace function private.has_library_permission(p_library_id uuid,p_permission_code text,p_actor_id uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.platform_user_roles r join public.catalog_permission_policies p on p.role_code=r.role_code
 where r.user_id=p_actor_id and r.revoked_at is null and p.permission_code=p_permission_code and p.active and statement_timestamp()>=p.valid_from and(p.valid_until is null or statement_timestamp()<p.valid_until))
 or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id and o.status='ACTIVE'
 join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null
 join public.catalog_permission_policies p on p.role_code=r.role_code
 join public.catalog_library_mandates x on x.library_id=p_library_id and x.organization_id=m.organization_id
 where m.user_id=p_actor_id and m.status='ACTIVE'and p.permission_code=p_permission_code and p.policy_version=x.policy_version and p.active
 and statement_timestamp()>=p.valid_from and(p.valid_until is null or statement_timestamp()<p.valid_until)
 and x.status='ACTIVE'and statement_timestamp()>=x.valid_from and(x.valid_until is null or statement_timestamp()<x.valid_until)
 and((r.role_code not in('FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER')and r.library_id=p_library_id)
 or(r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER')and exists(select 1 from public.franchises f where f.library_id=p_library_id and f.operator_organization_id=m.organization_id and private.has_franchise_role(f.id,array[r.role_code],p_actor_id)))))
$$;

create or replace function public.accept_franchise_invitation(p_invitation_id uuid,p_token_hash text,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();i public.franchise_invitations%rowtype;f public.franchises%rowtype;m public.franchise_mandate_versions%rowtype;h text;r jsonb;active_m uuid;legacy record;previous_franchise uuid;
begin select * into i from public.franchise_invitations where id=p_invitation_id;select * into f from public.franchises where id=i.franchise_id;
 if a is null or not found or not private.has_org_role(f.operator_organization_id,array['FRANCHISE_OWNER'],a)then raise exception 'FRANCHISE_INVITATION_ACCEPT_DENIED' using errcode='42501';end if;if p_token_hash!~'^[0-9a-f]{64}$'then raise exception 'INVALID_FRANCHISE_INVITATION_TOKEN' using errcode='22023';end if;
 select mv.* into m from public.franchise_mandate_versions mv join public.franchise_approval_requests q on q.mandate_version_id=mv.id where q.franchise_id=f.id and q.status='APPROVED'order by q.decided_at desc limit 1;if not found then raise exception 'FRANCHISE_CENTRAL_APPROVAL_REQUIRED' using errcode='55000';end if;
 h:=private.canonical_request_hash(jsonb_build_object('invitation',i.id,'token_hash',p_token_hash,'expected',p_expected_row_version,'mandate_hash',m.content_hash));r:=private.begin_contract_command(f.operator_organization_id,'franchise.invitation.accept.'||i.id::text,p_idempotency_key,h,a);if r is not null then return r;end if;
 update public.franchise_invitations set status='ACCEPTED',accepted_by=a,accepted_at=clock_timestamp(),row_version=row_version+1 where id=i.id and status='SENT'and expires_at>clock_timestamp()and row_version=p_expected_row_version and exists(select 1 from private.franchise_invitation_tokens t where t.invitation_id=i.id and t.token_hash=p_token_hash);if not found then raise exception 'STALE_OR_EXPIRED_FRANCHISE_INVITATION' using errcode='40001';end if;
 insert into public.franchise_mandate_versions(franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,effective_until,content_hash,created_by)values(m.franchise_id,m.territory_version_id,m.economic_rule_version_id,m.version+1,'ACTIVE',m.rights_snapshot,m.obligations_snapshot,m.contract_snapshot,m.entry_fee_minor,m.entry_fee_mode,m.entry_fee_term_months,m.franchisee_share_bps,m.neoxa_share_bps,m.matricia_share_bps,m.distribution_basis,greatest(m.effective_from,clock_timestamp()),m.effective_until,m.content_hash,a)returning id into active_m;
 -- Freeze existing unambiguous legacy grants before a second active franchise makes NULL ambiguous.
 select min(id::text)::uuid into previous_franchise from public.franchises where operator_organization_id=f.operator_organization_id and status='ACTIVE'having count(*)=1;
 if previous_franchise is not null then
  for legacy in select membership.id membership_id,role.role_code from public.organization_memberships membership join public.organization_member_roles role on role.membership_id=membership.id and role.revoked_at is null
  where membership.organization_id=f.operator_organization_id and membership.status='ACTIVE'and role.franchise_id is null and role.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER')
  and not exists(select 1 from public.organization_member_franchise_assignments assignment where assignment.membership_id=role.membership_id and assignment.role_code=role.role_code)
  loop perform private.grant_franchise_role_assignment_v1(legacy.membership_id,legacy.role_code,previous_franchise,a);end loop;
 end if;
 update public.franchises set status='ACTIVE',current_mandate_version_id=active_m,updated_at=clock_timestamp(),row_version=row_version+1 where id=f.id and status='LIBRARY_ASSIGNED';if not found then raise exception 'STALE_FRANCHISE_STATE' using errcode='40001';end if;
 perform private.grant_franchise_role_assignment_v1((select membership.id from public.organization_memberships membership where membership.organization_id=f.operator_organization_id and membership.user_id=a and membership.status='ACTIVE'),'FRANCHISE_OWNER',f.id,a);
 insert into public.franchise_governance_events(franchise_id,event_type,from_status,to_status,actor_user_id,correlation_id,metadata)values(f.id,'INVITATION_ACCEPTED','LIBRARY_ASSIGNED','ACTIVE',a,p_correlation_id,jsonb_build_object('invitation_id',i.id,'active_mandate_version_id',active_m));
 r:=jsonb_build_object('outcome','FRANCHISE_ACTIVATED','franchise_id',f.id,'active_mandate_version_id',active_m,'row_version',f.row_version+1);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,a,'USER','franchise.activated','franchise',f.id::text,p_correlation_id,jsonb_build_object('invitation_id',i.id,'mandate_version_id',active_m,'economic_rule_version_id',m.economic_rule_version_id),repeat('0',64));insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.operator_organization_id,'franchise',f.id::text,'FranchiseActivatedV1',p_correlation_id,r,p_idempotency_key);perform private.finish_contract_command(f.operator_organization_id,'franchise.invitation.accept.'||i.id::text,p_idempotency_key,r);return r;
end$$;

create or replace function private.assert_catalog_permission_locked(p_library_id uuid,p_permission text,p_actor uuid) returns void
language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 perform 1 from public.catalog_libraries l join public.organizations o on o.id=l.steward_organization_id
  where l.id=p_library_id and o.status='ACTIVE' for share of l,o;
 if not found then raise exception 'CATALOG_SCOPE_DENIED' using errcode='42501';end if;
 perform 1 from public.platform_user_roles r join public.catalog_permission_policies p on p.role_code=r.role_code
  where r.user_id=p_actor and r.revoked_at is null and p.permission_code=p_permission and p.active
   and statement_timestamp()>=p.valid_from and (p.valid_until is null or statement_timestamp()<p.valid_until) for share of r,p;
 perform 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
  join public.organization_member_roles r on r.membership_id=m.id
  join public.catalog_permission_policies p on p.role_code=r.role_code
  join public.catalog_library_mandates x on x.library_id=p_library_id and x.organization_id=m.organization_id
  where m.user_id=p_actor and m.status='ACTIVE' and o.status='ACTIVE' and r.revoked_at is null and r.library_id=p_library_id
   and p.permission_code=p_permission and p.policy_version=x.policy_version and p.active
   and statement_timestamp()>=p.valid_from and (p.valid_until is null or statement_timestamp()<p.valid_until)
   and x.status='ACTIVE' and statement_timestamp()>=x.valid_from and (x.valid_until is null or statement_timestamp()<x.valid_until)
  for share of m,o,r,p,x;
 perform 1 from public.organization_member_franchise_assignments assignment
 join public.organization_member_roles role on role.membership_id=assignment.membership_id and role.role_code=assignment.role_code
 join public.organization_memberships membership on membership.id=role.membership_id
 join public.franchises franchise on franchise.id=assignment.franchise_id
 join public.catalog_library_mandates mandate on mandate.library_id=franchise.library_id and mandate.organization_id=membership.organization_id
 join public.catalog_permission_policies policy on policy.role_code=role.role_code and policy.policy_version=mandate.policy_version
 where membership.user_id=p_actor and franchise.library_id=p_library_id and assignment.revoked_at is null and role.revoked_at is null and membership.status='ACTIVE'
 and mandate.status='ACTIVE'and policy.permission_code=p_permission and policy.active
 for share of assignment,role,membership,franchise,mandate,policy;
 if p_actor is null or not private.has_library_permission(p_library_id,p_permission,p_actor) then raise exception 'CATALOG_SCOPE_DENIED' using errcode='42501';end if;
end$$;