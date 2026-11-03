begin;
create function public.get_admin_client_compliance_page_v1(p_page integer default 1,p_filter text default'all',p_case_id uuid default null)returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare rows jsonb;totals jsonb;n bigint;states text[];
begin
 if p_page is null or p_page not between 1 and 100000 or p_filter is null or p_filter not in('all','check','complement','review','decided')then raise exception'INVALID_COMPLIANCE_PAGE'using errcode='22023';end if;
 states:=case p_filter when'check'then array['DOCUMENTS_REQUIRED','UNDER_REVIEW']when'complement'then array['QUESTION_REQUIRED']when'review'then array['UNDER_REVIEW','RESPONSE_RECEIVED']when'decided'then array['VERIFIED','REJECTED']else null end;
 select jsonb_build_object('all',count(*),'check',count(*)filter(where status in('DOCUMENTS_REQUIRED','UNDER_REVIEW')),'complement',count(*)filter(where status='QUESTION_REQUIRED'),'review',count(*)filter(where status in('UNDER_REVIEW','RESPONSE_RECEIVED')),'decided',count(*)filter(where status in('VERIFIED','REJECTED')))into totals from public.client_compliance_cases;
 select count(*)into n from public.client_compliance_cases where(p_case_id is null or id=p_case_id)and(states is null or status=any(states));
 select coalesce(jsonb_agg(to_jsonb(c)order by c.updated_at desc,c.id desc),'[]')into rows from(select id,organization_id,status,current_profile_version,submitted_at,decision_reason_public,created_at,updated_at from public.client_compliance_cases where(p_case_id is null or id=p_case_id)and(states is null or status=any(states))order by updated_at desc,id desc limit 50 offset((p_page-1)*50))c;
 return jsonb_build_object('cases',rows,'page',p_page,'has_next',p_page::bigint*50<n,'counts',totals);
end$$;
revoke all on function public.get_admin_client_compliance_page_v1(integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_client_compliance_page_v1(integer,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
