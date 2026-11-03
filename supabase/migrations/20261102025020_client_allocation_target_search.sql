begin;
create function public.search_client_allocation_targets_v1(p_organization_id uuid,p_search text default '',p_after text default null,p_limit integer default 50)
returns table(id uuid,organization_id uuid,target_type text,label_fr text,label_ar text,cursor_key text)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or p_organization_id is null or not coalesce(private.client_budget_manage(p_organization_id,auth.uid()),false)then raise exception 'CLIENT_ALLOCATION_TARGETS_DENIED'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 or p_search is null or length(p_search)>160 or length(coalesce(p_after,''))>100 then raise exception 'INVALID_CLIENT_ALLOCATION_TARGET_QUERY'using errcode='22023';end if;
 return query with candidates as (
  select m.id,'MISSION'::text kind,'Mission · '||m.id::text fr,'مهمة تعاقدية · '||m.id::text ar
  from public.missions m where m.client_organization_id=p_organization_id
  union all
  select s.id,'MISSION_MILESTONE',s.title_fr,s.title_ar from public.mission_milestones s join public.missions m on m.id=s.mission_id where m.client_organization_id=p_organization_id
  union all
  select i.id,'INVOICE','Facture · '||i.invoice_number,'فاتورة · '||i.invoice_number from public.provider_invoices i
  where private.client_invoice_belongs_to(p_organization_id,i.id)
  and exists(select 1 from public.provider_statement_lines l join public.provider_payable_events p on p.id=l.payable_event_id and p.provider_organization_id=l.provider_organization_id where l.statement_id=i.statement_id and l.provider_organization_id=i.provider_organization_id and p.client_organization_id=p_organization_id)
  union all
  select d.id,'DOCUMENT',d.original_file_name,d.original_file_name from public.client_compliance_documents d where d.organization_id=p_organization_id
  union all
  select r.id,'RFQ',v.description,v.description from public.service_requests r join public.service_request_versions v on v.id=r.current_version_id and v.request_id=r.id where r.client_organization_id=p_organization_id
 )select c.id,p_organization_id,c.kind,left(c.fr,240),left(c.ar,240),c.kind||':'||c.id::text
 from candidates c where (p_after is null or c.kind||':'||c.id::text>p_after)
 and(p_search='' or strpos(lower(c.fr),lower(p_search))>0 or strpos(lower(c.ar),lower(p_search))>0)
 order by c.kind,c.id limit p_limit;
end$$;
revoke all on function public.search_client_allocation_targets_v1(uuid,text,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.search_client_allocation_targets_v1(uuid,text,text,integer)to authenticated;
notify pgrst,'reload schema';
commit;
