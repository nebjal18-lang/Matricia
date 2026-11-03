-- A reviewer can issue a fresh private invitation code for a dossier when the first e-mail did not reach the candidate.
-- Only the hash is stored; the previous code stops working. The invitation, mandate and approval are unchanged.
-- Rollback: revoke the function. Rotated hashes cannot be restored.

create function public.rotate_franchise_application_invitation_code(
  p_application_id uuid,
  p_token_hash text,
  p_reason text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  application public.franchise_applications%rowtype;
  invitation public.franchise_invitations%rowtype;
begin
  if actor is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','LIBRARY_MANAGER'], actor) then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_DENIED' using errcode = '42501';
  end if;
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$'
     or length(btrim(coalesce(p_reason, ''))) not between 3 and 1000
     or length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'FRANCHISE_APPLICATION_REVIEW_INVALID' using errcode = '22023';
  end if;
  select * into application from public.franchise_applications where id = p_application_id for update;
  if not found then raise exception 'FRANCHISE_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into invitation from public.franchise_invitations
  where franchise_id = application.franchise_id order by created_at desc, id limit 1 for update;
  if exists (select 1 from public.franchise_application_events event where event.application_id = application.id and event.idempotency_key = 'invitation-code:' || p_idempotency_key) then
    return jsonb_build_object('outcome','FRANCHISE_INVITATION_CODE_ROTATED','application_id',application.id,'invitation_id',invitation.id,'replayed',true);
  end if;
  if invitation.id is null or invitation.status <> 'SENT' or invitation.expires_at <= clock_timestamp()
     or application.status not in ('CONTRACT_PENDING','LIBRARY_ASSIGNED') then
    raise exception 'FRANCHISE_INVITATION_NOT_PENDING' using errcode = '55000';
  end if;
  update private.franchise_invitation_tokens set token_hash = p_token_hash where invitation_id = invitation.id;
  if not found then raise exception 'FRANCHISE_INVITATION_NOT_PENDING' using errcode = '55000'; end if;
  insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
  values (application.id, application.status, application.status, btrim(p_reason), actor, 'invitation-code:' || p_idempotency_key);
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (application.organization_id, actor, 'USER', 'franchise.invitation.code_rotated', 'franchise_invitation', invitation.id::text, extensions.gen_random_uuid(),
    jsonb_build_object('application_id', application.id), repeat('0',64));
  return jsonb_build_object('outcome','FRANCHISE_INVITATION_CODE_ROTATED','application_id',application.id,'invitation_id',invitation.id,'replayed',false);
end;
$$;
revoke all on function public.rotate_franchise_application_invitation_code(uuid,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.rotate_franchise_application_invitation_code(uuid,text,text,text) to authenticated;
notify pgrst, 'reload schema';
