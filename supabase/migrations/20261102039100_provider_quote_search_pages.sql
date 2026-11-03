begin;
-- Search/filter before pagination; a technical failure is never an empty page.
create function public.list_provider_quote_invitation_page_v1(p_organization_id uuid,p_page integer default 1,p_query text default'',p_mode text default'consultations',p_tab text default'all')returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare rows jsonb;n bigint;counts jsonb;begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_VIEWER'],auth.uid())then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or length(coalesce(p_query,''))>200 or p_mode not in('consultations','quotes')or p_tab is null or(p_mode='consultations'and p_tab not in('all','answer','preparing','done'))or(p_mode='quotes'and p_tab not in('all','drafts','submit','submitted','revise','finished'))then raise exception'QUOTE_SEARCH_INVALID'using errcode='22023';end if;
 with filtered as(
 select rp.id,rp.invited_at from public.rfq_providers rp join public.rfqs r on r.id=rp.rfq_id join public.service_request_versions v on v.id=r.request_version_id left join public.quotes q on q.rfq_provider_id=rp.id
 where rp.provider_organization_id=p_organization_id
 and strpos(lower(v.description||' '||coalesce(v.required_quote_data->>'region_code','')||' '||coalesce(q.status,rp.status)||' '||case coalesce(q.status,rp.status)when'SUBMITTED'then'Soumise مرسل'when'DRAFT'then'Brouillon مسودة'when'REVISED'then'Révisée مراجع'when'REVISION_REQUESTED'then'Révision demandée طلب مراجعة'when'SELECTED'then'Retenue مختار'when'NOT_SELECTED'then'Non retenue غير مختار'when'INVITED'then'Invitée مدعو'when'VIEWED'then'Consultée تم الاطلاع'when'ACCEPTED'then'Acceptée مقبول'when'DECLINED'then'Refusée مرفوض'when'WITHDRAWN'then'Retirée مسحوب'when'SUSPENDED'then'Suspendue معلق'when'EXPIRED'then'Expirée منتهي'else''end),lower(btrim(coalesce(p_query,''))))>0
 and case when p_mode='quotes'then q.id is not null and case p_tab when'all'then true when'drafts'then q.status='DRAFT'when'submit'then q.status in('DRAFT','REVISED')when'submitted'then q.status='SUBMITTED'when'revise'then q.status in('REVISED','REVISION_REQUESTED')when'finished'then q.status in('SELECTED','NOT_SELECTED','WITHDRAWN','EXPIRED')else false end
 else case p_tab when'all'then true when'answer'then rp.status in('INVITED','VIEWED')and(q.id is null or q.status='DRAFT')when'preparing'then q.status in('DRAFT','REVISED','REVISION_REQUESTED')when'done'then rp.status in('DECLINED','WITHDRAWN','SUSPENDED')or q.status in('SUBMITTED','SELECTED','NOT_SELECTED','WITHDRAWN','EXPIRED')else false end end
 ),page as(select id from filtered order by invited_at desc,id desc offset((p_page-1)*25)limit 25)
 select(select count(*)from filtered),(select coalesce(jsonb_agg(id),'[]')from page)into n,rows;
 select jsonb_build_object('consultations_due',count(*)filter(where rp.status in('INVITED','VIEWED','ACCEPTED')and(q.id is null or q.status in('DRAFT','REVISED','REVISION_REQUESTED'))),'quotes_in_progress',count(*)filter(where q.status in('DRAFT','SUBMITTED','REVISED','REVISION_REQUESTED')))into counts from public.rfq_providers rp left join public.quotes q on q.rfq_provider_id=rp.id where rp.provider_organization_id=p_organization_id;
 return jsonb_build_object('ids',rows,'total',n,'page',p_page,'page_size',25,'counts',counts);
end$$;
revoke all on function public.list_provider_quote_invitation_page_v1(uuid,integer,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.list_provider_quote_invitation_page_v1(uuid,integer,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
