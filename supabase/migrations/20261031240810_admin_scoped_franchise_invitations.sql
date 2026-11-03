begin;
alter table public.organization_invitation_roles add column franchise_id uuid references public.franchises(id)on delete restrict;
create function private.admin_invitation_franchise_scope_v1(p_organization_id uuid,p_role text,p_franchise_id uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_role not like'FRANCHISE\_%'escape'\'then
  if p_franchise_id is not null then raise exception'INVITATION_FRANCHISE_SCOPE_NOT_APPLICABLE'using errcode='22023';end if;return null;
 end if;
 if p_franchise_id is null or not exists(select 1 from public.franchises f join public.franchise_mandate_versions v on v.id=f.current_mandate_version_id and v.franchise_id=f.id where f.id=p_franchise_id and f.operator_organization_id=p_organization_id and f.status='ACTIVE'and v.mandate_status='ACTIVE'and v.effective_from<=clock_timestamp()and(v.effective_until is null or v.effective_until>clock_timestamp()))then raise exception'INVITATION_FRANCHISE_SCOPE_REQUIRED'using errcode='42501';end if;
 return p_franchise_id;
end$$;
revoke all on function private.admin_invitation_franchise_scope_v1(uuid,text,uuid)from public,anon,authenticated,service_role;
create function public.list_admin_assignable_franchises_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid())then raise exception'ADMIN_FRANCHISE_ASSIGNMENTS_DENIED'using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'organizationId',f.operator_organization_id,'label',f.territory_code))from public.franchises f join public.franchise_mandate_versions v on v.id=f.current_mandate_version_id and v.franchise_id=f.id where f.status='ACTIVE'and v.mandate_status='ACTIVE'and v.effective_from<=clock_timestamp()and(v.effective_until is null or v.effective_until>clock_timestamp())),'[]'::jsonb);
end$$;
revoke all on function public.list_admin_assignable_franchises_v1()from public,anon,authenticated,service_role;
grant execute on function public.list_admin_assignable_franchises_v1()to authenticated;
do $$declare definition text;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'insert into public.organization_invitation_roles(invitation_id,role_code)values(invitation,new_role);')=0 then raise exception'ADMIN_INVITATION_SCOPE_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'insert into public.organization_invitation_roles(invitation_id,role_code)values(invitation,new_role);','insert into public.organization_invitation_roles(invitation_id,role_code,franchise_id)values(invitation,new_role,private.admin_invitation_franchise_scope_v1(x.organization_id,new_role,nullif(payload->>''franchiseId'','''')::uuid));');
 execute definition;
end$$;
alter function public.accept_organization_invitation(uuid,uuid)rename to accept_organization_invitation_delivery_internal;
revoke all on function public.accept_organization_invitation_delivery_internal(uuid,uuid)from public,anon,authenticated,service_role;
create function public.accept_organization_invitation(p_invitation_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns uuid language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare membership uuid;role_record record;target uuid;o uuid;inviter uuid;
begin
 -- The original command verifies the authenticated, verified invitee and locks
 -- the pending invitation. Any subsequent scope failure rolls back that command.
 membership:=public.accept_organization_invitation_delivery_internal(p_invitation_id,p_correlation_id);
 select organization_id,invited_by into o,inviter from public.organization_invitations where id=p_invitation_id;
 for role_record in select role_code,franchise_id from public.organization_invitation_roles where invitation_id=p_invitation_id and role_code like'FRANCHISE\_%'escape'\'loop
  if auth.jwt()->>'aal'is distinct from'aal2' then raise exception'FRANCHISE_INVITATION_MFA_REQUIRED'using errcode='42501';end if;
  target:=role_record.franchise_id;
  if target is null then select min(id::text)::uuid into target from public.franchises where operator_organization_id=o and status='ACTIVE'having count(*)=1;end if;
  target:=private.admin_invitation_franchise_scope_v1(o,role_record.role_code,target);
  perform private.grant_franchise_role_assignment_v1(membership,role_record.role_code,target,inviter,p_correlation_id);
 end loop;
 return membership;
end$$;
revoke all on function public.accept_organization_invitation(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.accept_organization_invitation(uuid,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
