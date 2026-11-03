begin;
create function private.execute_admin_invitation_followup_v1(p_request_id uuid,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype;i public.organization_invitations%rowtype;r jsonb;
begin
 select*into x from public.admin_operational_action_requests where id=p_request_id;
 if auth.role()is distinct from'service_role'or x.status<>'AUTHORIZED'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],x.requested_by)then raise exception'ADMIN_INVITATION_FOLLOWUP_DENIED'using errcode='42501';end if;
 select*into i from public.organization_invitations where id=x.resource_id::uuid for update;
 if i.id is null or(x.organization_id is not null and x.organization_id<>i.organization_id)then raise exception'ADMIN_INVITATION_SCOPE_DENIED'using errcode='42501';end if;
 if i.status<>'PENDING'then raise exception'INVITATION_NOT_PENDING'using errcode='55000';end if;
 if x.action_type='RESTRICT_ENTITY'then
  update public.organization_invitations set status='REVOKED',row_version=row_version+1 where id=i.id;
  r:=jsonb_build_object('invitation_id',i.id,'status','REVOKED');
 elsif x.action_type='CHANGE_CONFIGURATION'then
  if i.expires_at<=clock_timestamp()then raise exception'INVITATION_EXPIRED_CREATE_NEW_INVITATION'using errcode='55000';end if;
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(i.organization_id,'organization_invitation',i.id::text,'OrganizationEmailInvitationRequestedV1',p_correlation_id,jsonb_build_object('invitation_id',i.id,'organization_id',i.organization_id,'invited_email',i.invited_email,'expires_at',i.expires_at,'role_codes',coalesce((select jsonb_agg(role_code)from public.organization_invitation_roles where invitation_id=i.id),'[]'::jsonb)),'admin-invitation-resend:'||x.id::text);
  r:=jsonb_build_object('invitation_id',i.id,'status','PENDING','delivery','OUTBOX_PENDING');
 else raise exception'ADMIN_INVITATION_INTENT_NOT_ALLOWED'using errcode='22023';end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(i.organization_id,x.requested_by,'USER',case when x.action_type='RESTRICT_ENTITY'then'organization.invitation.revoked'else'organization.invitation.resend_requested'end,'organization_invitation',i.id::text,p_correlation_id,jsonb_build_object('action_request_id',x.id),repeat('0',64));
 return r;
end$$;
revoke all on function private.execute_admin_invitation_followup_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'elsif x.resource_type=''ORGANIZATION''then')=0 then raise exception'ADMIN_INVITATION_FOLLOWUP_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'elsif x.resource_type=''ORGANIZATION''then','elsif x.resource_type=''INVITATION''then result:=private.execute_admin_invitation_followup_v1(x.id,p_correlation_id); elsif x.resource_type=''ORGANIZATION''then');
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
