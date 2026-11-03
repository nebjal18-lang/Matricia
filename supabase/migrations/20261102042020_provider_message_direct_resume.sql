begin;
-- A dossier deep link can resume a thread older than the current inbox page.
create function public.find_provider_rfq_message_thread_v1(p_rfq_id uuid,p_organization_id uuid)returns uuid
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result uuid;
begin
 if auth.uid() is null or p_organization_id is null or not private.is_active_org_member(p_organization_id,auth.uid())then raise exception'MESSAGE_THREAD_SCOPE_DENIED'using errcode='42501';end if;
 select t.id into result from public.internal_message_threads t
 where t.object_type='RFQ'and t.object_id=p_rfq_id and t.provider_organization_id=p_organization_id
 and private.is_internal_message_participant(t.id,p_organization_id,auth.uid());
 return result;
end$$;
revoke all on function public.find_provider_rfq_message_thread_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.find_provider_rfq_message_thread_v1(uuid,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
