begin;
-- Resolve a decision's real dossier in one bounded, authorized query. Free text
-- stays as authored; only the surrounding interface labels are localized.
create function public.list_client_approval_subjects_v1(p_organization_id uuid,p_request_ids uuid[])
returns table(approval_request_id uuid,label_fr text,label_ar text,path text)
language plpgsql stable security definer set search_path=pg_catalog,private as $$
begin
 if auth.uid()is null or not private.is_active_org_member(p_organization_id)then raise exception'CLIENT_APPROVAL_SUBJECTS_DENIED'using errcode='42501';end if;
 if p_request_ids is null or cardinality(p_request_ids)not between 1 and 25 then raise exception'INVALID_CLIENT_APPROVAL_SUBJECTS'using errcode='22023';end if;
 return query select a.id,
 case when sr.id is not null then 'Demande · '||left(rv.description,200)when b.id is not null then 'Budget '||b.fiscal_year::text else 'Dossier métier'end,
 case when sr.id is not null then 'طلب · '||left(rv.description,200)when b.id is not null then 'ميزانية '||b.fiscal_year::text else 'ملف مهني'end,
 case when sr.id is not null then '/client/demandes/'||sr.id::text||case a.resource_type when'QUOTE_SELECTION'then'/comparaison'else''end
 when b.id is not null then '/client/portefeuille#budgets'else null end
 from public.business_approval_requests a
 left join public.quote_versions v on a.resource_type in('QUOTE_SELECTION','CONTRACT_GENERATION')and v.id=case when pg_input_is_valid(a.resource_id,'uuid')then a.resource_id::uuid end
 left join public.quotes q on q.id=v.quote_id left join public.rfqs r on r.id=q.rfq_id
 left join public.service_requests sr on sr.id=r.request_id and sr.client_organization_id=a.organization_id
 left join public.service_request_versions rv on rv.id=r.request_version_id and rv.request_id=sr.id
 left join public.client_annual_budgets b on a.resource_type='COST_ALLOCATION'and b.organization_id=a.organization_id and b.id=case when pg_input_is_valid(a.resource_id,'uuid')then a.resource_id::uuid end
 where a.organization_id=p_organization_id and a.id=any(p_request_ids);
end$$;
revoke all on function public.list_client_approval_subjects_v1(uuid,uuid[])from public,anon,authenticated,service_role;
grant execute on function public.list_client_approval_subjects_v1(uuid,uuid[])to authenticated;
notify pgrst,'reload schema';
commit;
