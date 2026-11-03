begin;
-- A small, purpose-scoped selector for the real financial command. No browser
-- supplies an arbitrary type/operator/split or needs a raw mandate identifier.
create function public.franchise_book_opening_context_v1(p_franchise_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare actor uuid:=auth.uid();item record;book_currency text;source jsonb;choices jsonb:='[]';counted integer:=0;bound uuid;review boolean:=false;
begin
 if actor is null or private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],actor)is distinct from true then raise exception'FRANCHISE_BOOK_DENIED'using errcode='42501';end if;
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'AAL2_REQUIRED'using errcode='42501';end if;
 if p_franchise_id is not null and not exists(select 1 from public.franchises where id=p_franchise_id)then raise exception'FRANCHISE_BOOK_SCOPE_NOT_FOUND'using errcode='22023';end if;
 for item in
  select f.id franchise_id,f.status,f.territory_code,lib.code library_code,org.display_name organization_name,m.id mandate_id,m.version mandate_version,m.content_hash,m.entry_fee_minor,m.effective_from,m.effective_until,
   r.id rule_id,r.version rule_version,e.currency
  from public.franchises f join public.franchise_mandate_versions m on m.franchise_id=f.id
  join public.franchise_approval_requests q on q.mandate_version_id=m.id and q.franchise_id=f.id and q.status='APPROVED'
  join public.franchise_approval_decisions d on d.approval_request_id=q.id and d.decision='APPROVE'and d.decided_by<>q.requested_by and d.mandate_content_hash=m.content_hash
  join public.franchise_economic_rule_versions e on e.id=m.economic_rule_version_id
  join public.franchise_finance_rule_versions r on r.franchise_type=f.franchise_type and r.operator_code=f.operator_code
   and r.franchisee_share_bps=m.franchisee_share_bps and r.neoxa_share_bps=m.neoxa_share_bps and r.asma_matricia_share_bps=m.matricia_share_bps
   and r.effective_from<=(m.effective_from at time zone'Africa/Casablanca')::date
   and(r.effective_to is null or r.effective_to>=(m.effective_from at time zone'Africa/Casablanca')::date)
  join public.catalog_libraries lib on lib.id=f.library_id join public.organizations org on org.id=f.operator_organization_id
  where(p_franchise_id is null or f.id=p_franchise_id)
  order by lib.code,f.territory_code,m.version desc,r.version desc,f.id limit 129
 loop
  counted:=counted+1;if counted>128 then raise exception'FRANCHISE_BOOK_SELECTOR_SCOPE_REQUIRED'using errcode='54000';end if;
  begin source:=private.franchise_book_basis_source_v1(item.franchise_id,item.mandate_id,item.rule_id);
  exception when sqlstate'55000'then review:=true;continue;end;
  for book_currency in select item.currency::text union select book.currency::text from public.franchise_pnl_books book
   where book.library_id=(source->>'library_id')::uuid and book.franchise_organization_id=(source->>'organization_id')::uuid
    and book.franchise_type=source->>'franchise_type'and book.operator_code=source->>'operator_code'and book.opened_under_rule_version_id=item.rule_id
    and(not exists(select 1 from public.franchise_pnl_book_bindings_v1 other where other.book_id=book.id)
     or exists(select 1 from public.franchise_pnl_book_bindings_v1 other where other.book_id=book.id and other.franchise_id=item.franchise_id and other.approved_mandate_version_id=item.mandate_id))
  loop
  if jsonb_array_length(choices)>=128 then raise exception'FRANCHISE_BOOK_SELECTOR_SCOPE_REQUIRED'using errcode='54000';end if;
  select binding.book_id into bound from public.franchise_pnl_book_bindings_v1 binding where binding.franchise_id=item.franchise_id and binding.approved_mandate_version_id=item.mandate_id and binding.finance_rule_version_id=item.rule_id and binding.currency=book_currency;
  choices:=choices||jsonb_build_array(jsonb_build_object('franchiseId',item.franchise_id,'franchiseStatus',item.status,'approvedMandateVersionId',item.mandate_id,'expectedMandateHash',item.content_hash,'mandateVersion',item.mandate_version,
   'financeRuleId',item.rule_id,'financeRuleVersion',item.rule_version,'libraryCode',item.library_code,'territoryCode',item.territory_code,'organizationName',item.organization_name,
   'entryFeeMinor',item.entry_fee_minor::text,'feeCurrency',item.currency,'currency',book_currency,'effectiveFrom',item.effective_from,'effectiveUntil',item.effective_until,'boundBookId',bound));
  end loop;
 end loop;
 review:=review or exists(select 1 from public.franchise_pnl_books book join public.franchises f on f.library_id=book.library_id and f.operator_organization_id=book.franchise_organization_id
  where(p_franchise_id is null or f.id=p_franchise_id)and not exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=book.id));
 return jsonb_build_object('complete',true,'choices',choices,'reviewRequired',review);
end$$;
revoke all on function public.franchise_book_opening_context_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.franchise_book_opening_context_v1(uuid)to authenticated;
commit;
