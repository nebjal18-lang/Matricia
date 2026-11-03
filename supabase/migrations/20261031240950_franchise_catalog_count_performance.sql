-- Avoid recursive question RLS work for exhaustive counts. This guard exactly requires the full draft-bank read branch; questionnaire audience checks remain per version.
create function private.franchise_catalog_reader_library(p_franchise_id uuid)returns uuid
language plpgsql stable security definer set search_path=pg_catalog as $$
declare lib uuid;
begin
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 select library_id into lib from public.franchises where id=p_franchise_id;
 if not private.has_library_permission(lib,'CATALOG_VIEW_DRAFT',auth.uid())or(private.has_any_questionnaire_platform_role()and auth.jwt()->>'aal'is distinct from'aal2')then raise exception 'FRANCHISE_CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 return lib;
end$$;
revoke all on function private.franchise_catalog_reader_library(uuid)from public,anon,authenticated,service_role;
create or replace function public.franchise_catalog_page(p_franchise_id uuid,p_kind text default'SERVICE',p_search text default'',p_page integer default 1,p_object_id uuid default null,p_status text default'ALL',p_category_id uuid default null,p_language text default'ALL',p_completeness text default'ALL',p_validation text default'ALL')returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare lib uuid;result jsonb;
begin
 lib:=private.franchise_catalog_reader_library(p_franchise_id);
 if p_kind is null or p_page is null or p_search is null or p_kind not in('SERVICE','QUESTIONNAIRE','RULE','QUESTION','ALL')or p_page not between 1 and 100000 or length(p_search)>120 then raise exception 'INVALID_FRANCHISE_CATALOG_PAGE'using errcode='22023';end if;

 with objects as(
 select'SERVICE'kind,s.id,coalesce(s.current_draft_version_id,s.current_published_version_id)version_id,s.code,coalesce(v.status,s.status)status,coalesce(v.name_fr,'')fr,coalesce(v.name_ar,'')ar,coalesce(v.short_description_fr,'')description,s.primary_subcategory_id subcategory_id,sub.category_id from public.catalog_services s left join public.catalog_service_versions v on v.id=coalesce(s.current_draft_version_id,s.current_published_version_id)left join public.catalog_subcategories sub on sub.id=s.primary_subcategory_id where s.library_id=lib
 union all select'QUESTIONNAIRE',q.id,coalesce(q.current_draft_version_id,q.current_published_version_id),q.code,coalesce(v.status,q.status),coalesce(v.title_fr,''),coalesce(v.title_ar,''),'',null,null from public.questionnaires q left join public.questionnaire_versions v on v.id=coalesce(q.current_draft_version_id,q.current_published_version_id)where q.library_id=lib and private.can_read_questionnaire_version(v.id)
 union all select'RULE',r.id,coalesce(r.current_draft_version_id,r.current_published_version_id),r.rule_key,coalesce(v.status,r.status),r.rule_key,r.rule_key,'',null,null from public.question_rules r left join public.question_rule_versions v on v.id=coalesce(r.current_draft_version_id,r.current_published_version_id)where r.library_id=lib
 union all select'QUESTION',q.id,coalesce(q.current_draft_version_id,q.current_published_version_id),q.question_key,coalesce(v.status,q.status),coalesce(v.label_fr,''),coalesce(v.label_ar,''),'',null,null from public.question_bank_questions q join public.question_versions v on v.id=coalesce(q.current_draft_version_id,q.current_published_version_id)where q.library_id=lib),
 filtered as(select*from objects where(p_kind<>'ALL'and kind<>p_kind)or((p_search=''or position(lower(p_search)in lower(code||' '||fr||' '||ar))>0)and(p_status='ALL'or status=p_status or(p_status='REVIEW'and status in('IN_REVIEW','FRANCHISE_REVIEW','CENTRAL_REVIEW','LOCAL_TEST'))or(p_status='RETURNS'and(status in('REJECTED','CHANGES_REQUESTED')or(select cr.status from public.catalog_change_requests cr where cr.target_id=objects.id and cr.library_id=lib order by cr.requested_at desc,cr.id desc limit 1)='REJECTED'))or(p_status='DONE'and status in('APPROVED','PUBLISHED')))and(p_category_id is null or category_id=p_category_id or subcategory_id=p_category_id)and(p_language='ALL'or(p_language='FR'and fr<>'')or(p_language='AR'and ar<>''))and(p_completeness='ALL'or(p_completeness='FULL'and fr<>''and ar<>''and description<>'')or(p_completeness='PARTIAL'and(fr=''or ar=''or description='')))and(p_validation='ALL'or(p_validation='DRAFT'and status='DRAFT')or(p_validation='REVIEW'and status in('IN_REVIEW','FRANCHISE_REVIEW','CENTRAL_REVIEW','LOCAL_TEST'))or(p_validation='PUBLISHED'and status in('APPROVED','PUBLISHED'))))),
 ranked as(select*,row_number()over(partition by kind order by code,id)rn from filtered),
 kinds as(select unnest(array['SERVICE','QUESTIONNAIRE','RULE','QUESTION'])kind)
 select jsonb_build_object('page',p_page,'pageSize',25,'kind',p_kind,'search',p_search,'status',p_status,'categoryId',p_category_id,'language',p_language,'completeness',p_completeness,'validation',p_validation,
 'bucketCounts',coalesce((select jsonb_object_agg(status,n)from(select status,count(*)n from objects where kind<>'QUESTION'group by status)c),'{}'::jsonb),'counts',jsonb_build_object('drafts',(select count(*)from objects where kind<>'QUESTION'and status='DRAFT'),'inReview',(select count(*)from objects where kind<>'QUESTION'and status in('IN_REVIEW','FRANCHISE_REVIEW','CENTRAL_REVIEW','LOCAL_TEST')),'published',(select count(*)from objects where kind<>'QUESTION'and status in('APPROVED','PUBLISHED')),'returns',(select count(*)from public.catalog_change_requests where library_id=lib and status='REJECTED')),
 'groups',(select jsonb_object_agg(k.kind,jsonb_build_object('total',(select count(*)from filtered f where f.kind=k.kind),'ids',coalesce((select jsonb_agg(r.id order by r.code,r.id)from ranked r where r.kind=k.kind and((r.rn>case when k.kind=p_kind or p_kind='ALL' then(p_page-1)*25 else 0 end and r.rn<=case when k.kind=p_kind or p_kind='ALL' then p_page*25 else 25 end)or r.id=p_object_id or r.version_id=p_object_id)),'[]'::jsonb),'versionIds',coalesce((select jsonb_agg(distinct o.version_id)from objects o where o.kind=k.kind and(o.id=p_object_id or o.version_id=p_object_id or exists(select 1 from ranked r where r.id=o.id and r.rn>case when k.kind=p_kind or p_kind='ALL' then(p_page-1)*25 else 0 end and r.rn<=case when k.kind=p_kind or p_kind='ALL' then p_page*25 else 25 end))and o.version_id is not null),'[]'::jsonb)))from kinds k))into result;
 return result;
end$$;
revoke all on function public.franchise_catalog_page(uuid,text,text,integer,uuid,text,uuid,text,text,text)from public,anon,service_role;
grant execute on function public.franchise_catalog_page(uuid,text,text,integer,uuid,text,uuid,text,text,text)to authenticated;
create or replace function public.franchise_catalog_bank(p_franchise_id uuid,p_kind text,p_search text default'',p_page integer default 1)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare lib uuid;result jsonb;
begin
 lib:=private.franchise_catalog_reader_library(p_franchise_id);
 if p_kind is null or p_page is null or p_search is null or p_kind not in('QUESTION','RULE')or p_page not between 1 and 100000 or length(p_search)>120 then raise exception 'INVALID_FRANCHISE_CATALOG_PAGE'using errcode='22023';end if;

 with candidates as(
 select v.id,v.question_id object_id,q.question_key code,v.label_fr fr,v.label_ar ar,v.answer_type,v.status,v.version from public.question_versions v join public.question_bank_questions q on q.id=v.question_id where p_kind='QUESTION'and v.library_id=lib and v.status in('APPROVED','PUBLISHED')and q.status<>'ARCHIVED'
 union all select v.id,v.rule_id,r.rule_key,r.rule_key,r.rule_key,null,v.status,v.version from public.question_rule_versions v join public.question_rules r on r.id=v.rule_id where p_kind='RULE'and v.library_id=lib and v.status in('APPROVED','PUBLISHED')and r.status<>'ARCHIVED'),
 filtered as(select*from candidates where p_search=''or position(lower(p_search)in lower(code||' '||fr||' '||ar))>0),
 paged as(select*from filtered order by code,version desc,id limit 25 offset(p_page-1)*25)
 select jsonb_build_object('total',(select count(*)from filtered),'page',p_page,'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'objectId',object_id,'code',code,'labelFr',fr,'labelAr',ar,'answerType',answer_type,'status',status,'version',version)order by code,version desc,id)from paged),'[]'::jsonb))into result;
 return result;
end$$;
revoke all on function public.franchise_catalog_bank(uuid,text,text,integer)from public,anon,service_role;
grant execute on function public.franchise_catalog_bank(uuid,text,text,integer)to authenticated;
