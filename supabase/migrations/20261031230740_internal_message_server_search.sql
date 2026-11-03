create function public.search_internal_message_inbox(p_search text,p_organization_id uuid default null,p_page integer default 1)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if actor is null then raise exception 'AUTHENTICATION_REQUIRED'using errcode='42501';end if;
 if p_search is null or length(p_search)>120 or p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_MESSAGE_SEARCH'using errcode='22023';end if;
 with matches as(
 select t.*,p.organization_id,p.participant_kind,p.id participant_id from public.internal_message_threads t join public.internal_message_participants p on p.thread_id=t.id
 where private.is_internal_message_participant(t.id,p.organization_id,actor)and(p_organization_id is null or p.organization_id=p_organization_id)
 and(p_search=''or position(lower(p_search)in lower(t.subject))>0 or exists(select 1 from public.internal_messages m where m.thread_id=t.id and position(lower(p_search)in lower(m.body))>0))),
 enriched as(select t.*,coalesce((select max(m.created_at)from public.internal_messages m where m.thread_id=t.id),t.created_at)last_message_at,(select count(*)from public.internal_messages m where m.thread_id=t.id)message_count from matches t),
 paged as(select*from enriched order by last_message_at desc,id,organization_id limit 25 offset(p_page-1)*25)
 select jsonb_build_object('total',(select count(*)from matches),'page',p_page,'pageSize',25,'inbox',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'object_type',t.object_type,'object_id',t.object_id,'service_request_id',t.service_request_id,'subject',t.subject,'status',t.status,'contact_policy_version',t.contact_policy_version,'participant_organization_id',t.organization_id,'participant_kind',t.participant_kind,'franchise_id',t.franchise_id,'counterparty_alias',(select other.display_alias from public.internal_message_participants other where other.thread_id=t.id and other.organization_id<>t.organization_id order by other.joined_at limit 1),'created_at',t.created_at,'last_message_at',t.last_message_at,'message_count',t.message_count)order by t.last_message_at desc,t.id,t.organization_id)from paged t),'[]'::jsonb))into result;
 return result;
end$$;
revoke all on function public.search_internal_message_inbox(text,uuid,integer)from public,anon,service_role;
grant execute on function public.search_internal_message_inbox(text,uuid,integer)to authenticated;
