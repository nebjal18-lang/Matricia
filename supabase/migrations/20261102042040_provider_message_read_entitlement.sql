begin;
-- A shared organisation is not an automatic Provider entitlement. Retain the
-- read roles actually assigned, and the authoritative Technician assignment.
create or replace function private.provider_message_participant_scope_v1(p_thread_id uuid,p_provider_organization_id uuid,p_actor uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare target public.internal_message_threads%rowtype;
begin
 if p_actor is null then return false;end if;
 if private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_ACCOUNTING','PROVIDER_VIEWER'],p_actor)then return true;end if;
 if not private.has_org_role(p_provider_organization_id,array['PROVIDER_TECHNICIAN'],p_actor)then return false;end if;
 select * into target from public.internal_message_threads where id=p_thread_id;
 return found and target.object_type='RFQ'and target.provider_organization_id=p_provider_organization_id
 and private.contract_message_technician_scope_v1(target.object_id,p_provider_organization_id,p_actor);
end$$;
revoke all on function private.provider_message_participant_scope_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
