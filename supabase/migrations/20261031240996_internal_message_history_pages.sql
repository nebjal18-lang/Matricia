-- Read-only pages retain exact participant authorization, with immutable tuple
-- cursors so equal timestamps and concurrent new messages do not shift history.
create index if not exists internal_messages_history_cursor_idx on public.internal_messages(thread_id,created_at desc,id desc);
create function public.get_internal_message_thread_page(p_thread_id uuid,p_before_created_at timestamptz default null,p_before_message_id uuid default null,p_page_size integer default 50)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;thread jsonb;messages jsonb;has_more boolean;cursor jsonb;
begin
 -- Reuse the authoritative current thread reader for identity and participant scope.
 thread:=public.get_internal_message_thread(p_thread_id,1)->'thread';
 if p_page_size is null or p_page_size not between 1 and 100 then raise exception 'INVALID_PAGE_LIMIT'using errcode='22023';end if;
 if(p_before_created_at is null)<>(p_before_message_id is null)then raise exception 'INVALID_MESSAGE_CURSOR'using errcode='22023';end if;
 if p_before_message_id is not null and not exists(select 1 from public.internal_messages where thread_id=p_thread_id and id=p_before_message_id and created_at=p_before_created_at)then raise exception 'INVALID_MESSAGE_CURSOR'using errcode='22023';end if;
 with candidates as(select m.*from public.internal_messages m where m.thread_id=p_thread_id and(p_before_created_at is null or(m.created_at,m.id)<(p_before_created_at,p_before_message_id))order by m.created_at desc,m.id desc limit p_page_size+1),
 shown as(select*from candidates order by created_at desc,id desc limit p_page_size)
 select coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sender_alias',p.display_alias,'mine',m.sender_organization_id=(thread->>'participant_organization_id')::uuid,'body',m.body,'created_at',m.created_at,'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.original_file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'scan_status',a.scan_status,'download_ready',a.scan_status='CLEAN')order by a.created_at,a.id)from public.internal_message_attachments a where a.message_id=m.id),'[]'::jsonb))order by m.created_at,m.id)from shown m join public.internal_message_participants p on p.id=m.sender_participant_id),'[]'::jsonb),(select count(*)>p_page_size from candidates)into messages,has_more;
 cursor:=case when has_more then jsonb_build_object('createdAt',messages->0->'created_at','id',messages->0->'id')else null end;
 return jsonb_build_object('thread',thread,'messages',messages,'hasMore',has_more,'nextCursor',cursor,'total',(select count(*)from public.internal_messages where thread_id=p_thread_id));
end$$;

create function public.search_franchise_message_inbox(p_franchise_id uuid,p_search text default '',p_page integer default 1)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if not private.active_franchise_messaging_scope(p_franchise_id,actor)then raise exception 'FRANCHISE_MESSAGE_SCOPE_DENIED'using errcode='42501';end if;
 if p_search is null or length(p_search)>120 or p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_MESSAGE_SEARCH'using errcode='22023';end if;
 with matches as(
 select t.*,p.organization_id,p.participant_kind,p.id participant_id from public.internal_message_threads t join public.internal_message_participants p on p.thread_id=t.id and p.participant_kind='FRANCHISE'
 where t.franchise_id=p_franchise_id and private.is_internal_message_participant(t.id,p.organization_id,actor)
 and(p_search=''or position(lower(p_search)in lower(t.subject))>0 or exists(select 1 from public.internal_messages m where m.thread_id=t.id and position(lower(p_search)in lower(m.body))>0))),
 enriched as(select t.*,coalesce((select max(m.created_at)from public.internal_messages m where m.thread_id=t.id),t.created_at)last_message_at,(select count(*)from public.internal_messages m where m.thread_id=t.id)message_count from matches t),
 paged as(select*from enriched order by last_message_at desc,id limit 25 offset(p_page-1)*25)
 select jsonb_build_object('total',(select count(*)from matches),'page',p_page,'pageSize',25,'inbox',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'object_type',t.object_type,'object_id',t.object_id,'service_request_id',t.service_request_id,'subject',t.subject,'status',t.status,'contact_policy_version',t.contact_policy_version,'participant_organization_id',t.organization_id,'participant_kind',t.participant_kind,'franchise_id',t.franchise_id,'counterparty_alias',(select other.display_alias from public.internal_message_participants other where other.thread_id=t.id and other.organization_id<>t.organization_id order by other.joined_at,other.id limit 1),'created_at',t.created_at,'last_message_at',t.last_message_at,'message_count',t.message_count)order by t.last_message_at desc,t.id)from paged t),'[]'::jsonb))into result;
 return result;
end$$;
revoke all on function public.get_internal_message_thread_page(uuid,timestamptz,uuid,integer),public.search_franchise_message_inbox(uuid,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.get_internal_message_thread_page(uuid,timestamptz,uuid,integer),public.search_franchise_message_inbox(uuid,text,integer)to authenticated;
