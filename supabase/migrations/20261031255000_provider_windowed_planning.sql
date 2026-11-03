-- Calendar queries are scoped to the selected organization and time window, independent of list-page limits.
create function public.get_my_provider_planning_v1(p_provider_organization_id uuid,p_from timestamptz,p_until timestamptz,p_from_date date,p_until_date date,p_page integer default 1,p_page_size integer default 200)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare quote_access boolean;mission_access boolean;billing_access boolean;management_access boolean;r jsonb;
begin
 if auth.uid()is null or not private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_ACCOUNTING','PROVIDER_SALES','PROVIDER_TECHNICIAN','PROVIDER_VIEWER'],auth.uid())then raise exception'PROVIDER_PLANNING_SCOPE_DENIED'using errcode='42501';end if;
 if p_from is null or p_until is null or p_from_date is null or p_until_date is null or p_until<=p_from or p_until>p_from+interval'32 days'or p_until_date<=p_from_date or p_until_date>p_from_date+31 or p_page is null or p_page not between 1 and 100000 or p_page_size is null or p_page_size not between 1 and 200 then raise exception'INVALID_PROVIDER_PLANNING_WINDOW'using errcode='22023';end if;
 quote_access:=private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES'],auth.uid());
 mission_access:=private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_TECHNICIAN'],auth.uid());
 billing_access:=private.provider_billing_access(p_provider_organization_id,auth.uid());
 management_access:=private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],auth.uid());
 with events as(
  select rp.id as source_id,'consultation'::text kind,v.description label_fr,v.description label_ar,to_char(r.deadline at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')due_at,r.deadline sort_at,null::uuid parent_id,rp.status state
  from public.rfq_providers rp join public.rfqs r on r.id=rp.rfq_id join public.service_request_versions v on v.id=r.request_version_id
  where quote_access and rp.provider_organization_id=p_provider_organization_id and rp.status in('INVITED','VIEWED','ACCEPTED')and r.deadline>=p_from and r.deadline<p_until
  union all
  select q.id,'quote',rv.description,rv.description,to_char(v.valid_until at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),v.valid_until,null::uuid,q.status
  from public.quotes q join public.quote_versions v on v.id=q.current_version_id and v.provider_organization_id=q.provider_organization_id join public.rfqs r on r.id=q.rfq_id join public.service_request_versions rv on rv.id=r.request_version_id
  where quote_access and q.provider_organization_id=p_provider_organization_id and q.status in('DRAFT','SUBMITTED','REVISED')and v.valid_until>=p_from and v.valid_until<p_until
  union all
  select ms.id,'milestone',ms.title_fr,ms.title_ar,to_char(ms.due_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),ms.due_at,m.id,ms.status
  from public.mission_milestones ms join public.missions m on m.id=ms.mission_id
  where mission_access and m.provider_organization_id=p_provider_organization_id and m.status not in('COMPLETED','CANCELLED')and ms.status not in('DONE','COMPLETED','ACCEPTED','CANCELLED')and ms.due_at>=p_from and ms.due_at<p_until
  union all
  select v.id,'document',f.code,f.code,to_char(v.expires_on,'YYYY-MM-DD'),v.expires_on::timestamp at time zone'UTC',null::uuid,v.status
  from public.provider_document_families f join lateral(select d.*from public.provider_document_versions d where d.family_id=f.id order by d.version_number desc limit 1)v on true
  where f.provider_organization_id=p_provider_organization_id and v.expires_on>=p_from_date and v.expires_on<p_until_date
  union all
  select i.id,'invoice',i.invoice_number,i.invoice_number,to_char(i.due_on,'YYYY-MM-DD'),i.due_on::timestamp at time zone'UTC',null::uuid,i.payment_status
  from public.provider_invoice_balances i where billing_access and i.provider_organization_id=p_provider_organization_id and i.outstanding_minor>0 and i.due_on>=p_from_date and i.due_on<p_until_date
  union all
  select d.id,'renewal','Contrat partenaire','عقد الشراكة',to_char(d.partner_contract_expires_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),d.partner_contract_expires_at,null::uuid,d.partner_contract_status
  from(select*from public.provider_company_decisions where provider_organization_id=p_provider_organization_id order by decision_version desc limit 1)d
  where management_access and d.partner_contract_status='SIGNED'and d.partner_contract_expires_at>=p_from and d.partner_contract_expires_at<p_until
 ),numbered as(select*,row_number()over(order by sort_at,kind,source_id)ordinal from events),page as(select*from numbered order by ordinal offset((p_page-1)*p_page_size)limit(p_page_size+1))
 select jsonb_build_object('events',coalesce((select jsonb_agg(jsonb_build_object('source_id',source_id,'kind',kind,'label_fr',label_fr,'label_ar',label_ar,'due_at',due_at,'parent_id',parent_id,'state',state)order by ordinal)from page where ordinal<=(p_page*p_page_size)),'[]'::jsonb),'has_more',(select count(*)>p_page_size from page),'page',p_page,'billing_visible',billing_access)into r;
 return r;
end$$;
revoke all on function public.get_my_provider_planning_v1(uuid,timestamptz,timestamptz,date,date,integer,integer)from public,anon,service_role;
grant execute on function public.get_my_provider_planning_v1(uuid,timestamptz,timestamptz,date,date,integer,integer)to authenticated;
notify pgrst,'reload schema';
