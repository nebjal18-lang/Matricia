begin;
-- Keep the canonical history/cursor/attachment contract, but bind its presentation
-- to one explicitly authorized organization when a member acts for several.
create function public.get_internal_message_thread_page_for_organization_v1(
 p_thread_id uuid,p_organization_id uuid,p_before_created_at timestamptz default null,p_before_message_id uuid default null,p_page_size integer default 50
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;participant public.internal_message_participants%rowtype;other_alias text;messages jsonb;
begin
 if auth.uid() is null or p_organization_id is null or not private.is_internal_message_participant(p_thread_id,p_organization_id,auth.uid()) then
  raise exception 'MESSAGE_THREAD_SCOPE_DENIED' using errcode='42501';
 end if;
 select * into participant from public.internal_message_participants where thread_id=p_thread_id and organization_id=p_organization_id;
 if not found then raise exception 'MESSAGE_THREAD_SCOPE_DENIED' using errcode='42501';end if;
 -- The existing authoritative reader still enforces the complete scope, exact
 -- tuple cursor and trusted attachment download predicate. No read is widened.
 result:=public.get_internal_message_thread_page(p_thread_id,p_before_created_at,p_before_message_id,p_page_size);
 select display_alias into other_alias from public.internal_message_participants where thread_id=p_thread_id and organization_id<>p_organization_id order by joined_at,id limit 1;
 result:=jsonb_set(result,'{thread}',(result->'thread')||jsonb_build_object('participant_organization_id',p_organization_id,'participant_kind',participant.participant_kind,'counterparty_alias',other_alias));
 select coalesce(jsonb_agg(item.value||jsonb_build_object('mine',message.sender_organization_id=p_organization_id) order by item.ordinality),'[]'::jsonb) into messages
 from jsonb_array_elements(result->'messages') with ordinality as item(value,ordinality)
 join public.internal_messages message on message.id=(item.value->>'id')::uuid and message.thread_id=p_thread_id;
 return jsonb_set(result,'{messages}',messages);
end$$;
revoke all on function public.get_internal_message_thread_page_for_organization_v1(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_internal_message_thread_page_for_organization_v1(uuid,uuid,timestamptz,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
