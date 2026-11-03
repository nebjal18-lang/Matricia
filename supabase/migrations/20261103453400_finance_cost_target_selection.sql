begin;
-- Central Finance selects actual captured payments or independently received
-- service redemptions. No browser-supplied organization or free UUID is a scope.
create function public.list_finance_cost_reconciliation_targets_v1(p_locale text default'fr',p_page integer default 1,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare targets jsonb;more boolean;can_upload boolean;
begin
 perform private.assert_finance_cost_document_access_v1(false);
 if p_locale is null or p_locale not in('fr','ar')or p_page is null or p_page not between 1 and 10000 or length(coalesce(p_search,''))>100 then raise exception'INVALID_FINANCE_COST_TARGET_PAGE'using errcode='22023';end if;
 can_upload:=private.credit_revenue_finance_access_v1(auth.uid(),true)is true;
 with actual_targets as(
  select funding.id,'PSP_FEE'::text component,
   (case p_locale when'ar'then'تحصيل'else'Encaissement'end)||' · '||organization.display_name||' · '||coalesce(payment.payment_reference,funding.source_id)||' ('||funding.currency||')'label,funding.paid_at occurred_at
  from public.credit_economic_funding_sources_v1 funding join public.organizations organization on organization.id=funding.organization_id
  left join public.credit_pack_payment_events_v1 payment on funding.source_kind='CREDIT_PACK'and funding.source_id=payment.gateway||':'||payment.provider_environment||':'||payment.payment_reference
  where funding.source_hash=private.canonical_request_hash(funding.source_snapshot)
   and exists(select 1 from public.credit_economic_funding_evidence_v1 evidence where evidence.funding_source_id=funding.id and evidence.evidence_kind='NATIVE_CAPTURE')
   and(not can_upload or(not private.is_active_org_member(funding.organization_id,auth.uid())and not exists(select 1 from public.credit_economic_allocations_v1 allocated join public.franchise_pnl_books book on book.id=allocated.book_id where allocated.funding_source_id=funding.id and private.is_active_org_member(book.franchise_organization_id,auth.uid()))))
  union all
  select redemption.id,'FULFILLMENT_COST'::text,
   (case p_locale when'ar'then'خدمة مستلمة'else'Prestation reçue'end)||' · '||organization.display_name||' · '||(case p_locale when'ar'then benefit.name_ar else benefit.name_fr end),max(fact.consumed_at)
  from public.benefit_redemptions redemption join public.benefit_versions benefit on benefit.id=redemption.benefit_version_id join public.organizations organization on organization.id=redemption.organization_id
  join public.credit_economic_consumption_facts_v1 fact on fact.redemption_id=redemption.id
  join public.credit_economic_allocations_v1 allocated on allocated.consumption_fact_id=fact.id and allocated.allocation_kind='PURCHASE_CONSUMPTION'
  join public.franchise_pnl_books book on book.id=allocated.book_id
  where redemption.status='CONSUMED'and private.benefit_accepted_receipt_v1(redemption.id,redemption.delivery_proof_hash)is not null
   and(not can_upload or(not private.is_active_org_member(book.franchise_organization_id,auth.uid())and not private.is_active_org_member(redemption.organization_id,auth.uid())))
  group by redemption.id,organization.display_name,benefit.name_fr,benefit.name_ar
 ),matching as(select*from actual_targets where nullif(btrim(coalesce(p_search,'')),'')is null or label ilike'%'||btrim(p_search)||'%'),page as(select*from matching order by occurred_at desc,component,id offset((p_page-1)*20)limit 21)
 select coalesce((select jsonb_agg(jsonb_build_object('id',selected.id,'component',selected.component,'label',selected.label)order by selected.occurred_at desc,selected.component,selected.id)from(select*from page order by occurred_at desc,component,id limit 20)selected),'[]'),(select count(*)>20 from page)into targets,more;
 return jsonb_build_object('targets',targets,'canUpload',can_upload,'page',p_page,'page_size',20,'has_more',more);
end$$;
revoke all on function public.list_finance_cost_reconciliation_targets_v1(text,integer,text)from public,anon,authenticated,service_role;
grant execute on function public.list_finance_cost_reconciliation_targets_v1(text,integer,text)to authenticated;
commit;
