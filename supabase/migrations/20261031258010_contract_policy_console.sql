begin;
create function public.get_admin_contract_policy_console_v1(p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare policies jsonb;libraries jsonb;services jsonb;total bigint;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','READ_ONLY_AUDITOR'])then raise exception'CONTRACT_POLICY_CONSOLE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_PAGE'using errcode='22023';end if;
 if(select count(*)from public.catalog_libraries)>1000 or(select count(*)from public.catalog_services)>1000 then raise exception'CONTRACT_POLICY_CATALOG_SELECTION_BUDGET_EXCEEDED'using errcode='54000';end if;
 select count(*)into total from public.contract_policy_versions_v1;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('decision',(select to_jsonb(d)from public.contract_policy_decisions_v1 d where d.policy_version_id=p.id))order by p.created_at desc,p.id desc),'[]')into policies from(select*from public.contract_policy_versions_v1 order by created_at desc,id desc limit 25 offset((p_page-1)*25))p;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name_fr',coalesce(v.name_fr,l.code),'name_ar',coalesce(v.name_ar,l.code))order by l.code,l.id),'[]')into libraries from public.catalog_libraries l left join public.catalog_library_versions v on v.id=coalesce(l.current_published_version_id,l.current_draft_version_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'library_id',s.library_id,'name_fr',coalesce(v.name_fr,s.code),'name_ar',coalesce(v.name_ar,s.code))order by s.code,s.id),'[]')into services from public.catalog_services s left join public.catalog_service_versions v on v.id=coalesce(s.current_published_version_id,s.current_draft_version_id);
 return jsonb_build_object('policies',policies,'libraries',libraries,'services',services,'page',p_page,'has_next',p_page::bigint*25<total);
end$$;
revoke all on function public.get_admin_contract_policy_console_v1(integer)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_contract_policy_console_v1(integer)to authenticated;
notify pgrst,'reload schema';
commit;
