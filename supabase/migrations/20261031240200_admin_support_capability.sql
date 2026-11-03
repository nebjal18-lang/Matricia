begin;
-- Capability projection: no tenant role impersonation, no raw message/document data.
create function public.get_my_admin_support_case_v1(p_work_item_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare w public.admin_work_items%rowtype;g public.admin_support_access_grants%rowtype;organization jsonb;resource jsonb;c uuid:=extensions.gen_random_uuid();
begin
 if auth.uid()is null or auth.role()is distinct from'authenticated'or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPPORT_AGENT','SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid())then raise exception'SUPPORT_CASE_DENIED'using errcode='42501';end if;
 select*into w from public.admin_work_items where id=p_work_item_id;
 select*into g from public.admin_support_access_grants where support_user_id=auth.uid()and target_organization_id=w.organization_id and resource_type=w.resource_type and resource_id=w.resource_id and revoked_at is null and expires_at>clock_timestamp()order by expires_at desc limit 1;
 if w.id is null or g.id is null then raise exception'SUPPORT_CASE_GRANT_REQUIRED'using errcode='42501';end if;
 select jsonb_build_object('id',id,'displayName',display_name,'status',status)into organization from public.organizations where id=w.organization_id;
 case lower(w.resource_type)
 when'organization'then resource:=organization;
 when'service_request'then select jsonb_build_object('id',id,'status',status,'createdAt',created_at)into resource from public.service_requests where id::text=w.resource_id and client_organization_id=w.organization_id;
 when'mission'then select jsonb_build_object('id',id,'status',status)into resource from public.missions where id::text=w.resource_id and(client_organization_id=w.organization_id or provider_organization_id=w.organization_id);
 when'contract'then select jsonb_build_object('id',id,'status',status)into resource from public.contracts where id::text=w.resource_id and(client_organization_id=w.organization_id or provider_organization_id=w.organization_id);
 else resource:=jsonb_build_object('id',w.resource_id,'type',w.resource_type,'status',w.status);
 end case;
 if resource is null then raise exception'SUPPORT_CASE_RESOURCE_SCOPE_DENIED'using errcode='42501';end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(w.organization_id,auth.uid(),'USER','admin.support.case_read','admin_work_item',w.id::text,c,jsonb_build_object('grant_id',g.id,'access_mode',g.access_mode),repeat('0',64));
 return jsonb_build_object('grantId',g.id,'expiresAt',g.expires_at,'accessMode',g.access_mode,'organization',organization,'resource',resource,'titleFr',w.title_fr,'titleAr',w.title_ar,'status',w.status);
end$$;
create function public.revoke_admin_support_access_v1(p_grant_id uuid,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare g public.admin_support_access_grants%rowtype;c uuid:=extensions.gen_random_uuid();
begin
 select*into g from public.admin_support_access_grants where id=p_grant_id for update;
 if g.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid())or(g.support_user_id=auth.uid()and private.has_platform_role(array['SUPPORT_AGENT'],auth.uid())))then raise exception'SUPPORT_REVOKE_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 3 and 500 then raise exception'INVALID_SUPPORT_REVOKE_REASON'using errcode='22023';end if;
 update public.admin_support_access_grants set revoked_at=coalesce(revoked_at,clock_timestamp())where id=g.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(g.target_organization_id,auth.uid(),'USER','admin.support.revoked','admin_support_access_grant',g.id::text,c,jsonb_build_object('reason_recorded',true),repeat('0',64));
 return jsonb_build_object('outcome','ADMIN_SUPPORT_ACCESS_REVOKED');
end$$;
revoke all on function public.get_my_admin_support_case_v1(uuid),public.revoke_admin_support_access_v1(uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.get_my_admin_support_case_v1(uuid),public.revoke_admin_support_access_v1(uuid,text)to authenticated;
notify pgrst,'reload schema';
commit;
