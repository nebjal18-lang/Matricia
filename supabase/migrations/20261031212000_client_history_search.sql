-- Complete tenant history search: filter before pagination, expose exact matched counts.
begin;
create or replace function public.list_client_request_page(p_organization_id uuid,p_query text default'',p_status text default'',p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_VIEWER'],auth.uid())then raise exception 'CLIENT_REQUEST_LIST_DENIED'using errcode='42501';end if;
 if p_page is null or p_page<1 or p_page>100000 or length(coalesce(p_query,''))>200 or p_status is null or p_status not in('','DRAFT','INFORMATION_REQUIRED','READY','MATCHING','RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW','PROVIDER_SELECTED','CONTRACT_PENDING','CONTRACTED','CANCELLED','EXPIRED','NO_PROVIDER_AVAILABLE')then raise exception 'INVALID_REQUEST_FILTER'using errcode='22023';end if;
 select coalesce(jsonb_agg(row_value order by created_at desc,id),'[]')into result from(
  select r.id,r.created_at,jsonb_build_object('id',r.id,'client_organization_id',r.client_organization_id,'library_id',r.library_id,'service_id',r.service_id,'current_version_id',r.current_version_id,'status',r.status,'created_at',r.created_at,'row_version',r.row_version)row_value
  from public.service_requests r left join public.service_request_versions v on v.id=r.current_version_id
  where r.client_organization_id=p_organization_id and(p_status=''or r.status=p_status)and(coalesce(p_query,'')=''or strpos(lower(coalesce(v.description,'')||' '||r.id::text||' '||r.status),lower(p_query))>0)
  order by r.created_at desc,r.id offset((p_page-1)*20)limit 21
 )q;
 return result;
end$$;
create function public.count_client_request_results(p_organization_id uuid,p_query text default '',p_status text default '')returns bigint language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result bigint;
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_VIEWER'],auth.uid())then raise exception 'CLIENT_REQUEST_LIST_DENIED'using errcode='42501';end if;
 if length(coalesce(p_query,''))>200 or p_status is null or p_status not in('','DRAFT','INFORMATION_REQUIRED','READY','MATCHING','RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW','PROVIDER_SELECTED','CONTRACT_PENDING','CONTRACTED','CANCELLED','EXPIRED','NO_PROVIDER_AVAILABLE')then raise exception 'INVALID_REQUEST_FILTER'using errcode='22023';end if;
 select count(*)into result from public.service_requests r left join public.service_request_versions v on v.id=r.current_version_id where r.client_organization_id=p_organization_id and(p_status=''or r.status=p_status)and(coalesce(p_query,'')=''or strpos(lower(coalesce(v.description,'')||' '||r.id::text||' '||r.status),lower(p_query))>0);
 return result;
end$$;
create function public.list_client_document_page(p_organization_id uuid,p_query text default '',p_page integer default 1,p_include_pending boolean default false)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception 'CLIENT_VAULT_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or length(coalesce(p_query,''))>200 or p_include_pending is null then raise exception 'INVALID_DOCUMENT_FILTER'using errcode='22023';end if;
 with matched as(
 select id,organization_id,document_type,version,original_file_name,expires_on,status,scan_status,current_scan_result_id,created_at from public.client_compliance_documents d
 where d.organization_id=p_organization_id and(p_include_pending or(d.status='VERIFIED'and d.scan_status='CLEAN'and d.current_scan_result_id is not null))
 and(coalesce(p_query,'')=''or strpos(lower(d.original_file_name||' '||d.document_type||' '||d.id::text),lower(p_query))>0)
 ),page as(select*from matched order by created_at desc,id offset(p_page-1)*25 limit 26)
 select jsonb_build_object('documents',coalesce((select jsonb_agg(to_jsonb(page)order by created_at desc,id)from page),'[]'::jsonb),'total',(select count(*)from matched),'expired_count',(select count(*)from matched where expires_on<(current_timestamp at time zone 'Africa/Casablanca')::date and status='VERIFIED'and scan_status='CLEAN'))into result;
 return result;
end$$;
revoke all on function public.count_client_request_results(uuid,text,text),public.list_client_document_page(uuid,text,integer,boolean)from public,anon,authenticated,service_role;
grant execute on function public.count_client_request_results(uuid,text,text),public.list_client_document_page(uuid,text,integer,boolean)to authenticated;
commit;
