begin;
-- Validate an activated clone from its exact approved version. Current status or
-- expiry must not confiscate rights earned while that version was effective.
create function private.franchise_book_active_basis_v1(p_book uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare source jsonb;binding public.franchise_pnl_book_bindings_v1%rowtype;approved public.franchise_mandate_versions%rowtype;active public.franchise_mandate_versions%rowtype;evidence public.franchise_activation_evidence%rowtype;until_at timestamptz;next_at timestamptz;environment text;
begin
 source:=private.assert_franchise_book_binding_v1(p_book);
 select*into binding from public.franchise_pnl_book_bindings_v1 where book_id=p_book;
 select*into approved from public.franchise_mandate_versions where id=binding.approved_mandate_version_id;
 select*into evidence from public.franchise_activation_evidence where franchise_id=binding.franchise_id and approved_mandate_version_id=approved.id;
 select*into active from public.franchise_mandate_versions where id=evidence.active_mandate_version_id and franchise_id=binding.franchise_id;
 if evidence.invitation_id is null or active.id is null or evidence.mandate_hash is distinct from approved.content_hash
  or evidence.evidence_hash is distinct from private.canonical_request_hash(evidence.evidence_snapshot)
  or evidence.evidence_snapshot->>'approvedMandateVersionId'is distinct from approved.id::text
  or evidence.evidence_snapshot->>'activeMandateVersionId'is distinct from active.id::text
  or evidence.evidence_snapshot->>'franchiseId'is distinct from binding.franchise_id::text
  or active.content_hash is distinct from approved.content_hash
  or (to_jsonb(active)-array['id','version','mandate_status','created_by','created_at','effective_from'])is distinct from(to_jsonb(approved)-array['id','version','mandate_status','created_by','created_at','effective_from'])
  or active.effective_from<approved.effective_from
 then raise exception'FRANCHISE_BOOK_ACTIVATION_EVIDENCE_REQUIRED'using errcode='55000';end if;
 select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;
 if evidence.activation_mode='NON_CONTRACTUAL_DEMO'and(environment is null or environment not in('DEVELOPMENT','STAGING'))then raise exception'FRANCHISE_DEMO_FINANCIAL_BASIS_NOT_PRODUCTION'using errcode='55000';end if;
 select min(other.effective_from)into next_at from public.franchise_activation_evidence event join public.franchise_mandate_versions other on other.id=event.active_mandate_version_id
  where event.franchise_id=binding.franchise_id and other.id<>active.id and other.effective_from>active.effective_from;
 until_at:=least(active.effective_until,next_at);
 return source||jsonb_build_object('active_mandate_version_id',active.id,'effective_from',active.effective_from,'effective_until',until_at,'activation_mode',evidence.activation_mode);
end$$;
revoke all on function private.franchise_book_active_basis_v1(uuid)from public,anon,authenticated,service_role;

create function private.assert_franchise_book_period_basis_v1(p_book uuid,p_start date,p_end date,p_rule uuid)
returns void language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare source jsonb;from_at timestamptz;until_at timestamptz;
begin
 source:=private.franchise_book_active_basis_v1(p_book);from_at:=(source->>'effective_from')::timestamptz;until_at:=(source->>'effective_until')::timestamptz;
 if p_start is null or p_end is null or p_end<p_start or p_rule is distinct from(source#>>'{finance_rule,id}')::uuid
  or ((p_end+1)::timestamp at time zone'Africa/Casablanca')<=from_at or(until_at is not null and(p_start::timestamp at time zone'Africa/Casablanca')>=until_at)
  or exists(select 1 from public.franchise_pnl_entries entry where entry.book_id=p_book and entry.effective_on between p_start and p_end
   and(entry.effective_on<(from_at at time zone'Africa/Casablanca')::date or(until_at is not null and(entry.effective_on::timestamp at time zone'Africa/Casablanca')>=until_at)))
  or exists(select 1 from public.credit_economic_allocations_v1 allocation join public.credit_economic_consumption_facts_v1 fact on fact.id=allocation.consumption_fact_id
   join private.credit_economic_pnl_sources_v1 bridge on bridge.allocation_id=allocation.id join public.franchise_pnl_entries entry on entry.id=bridge.pnl_entry_id
   where allocation.book_id=p_book and entry.effective_on between p_start and p_end and(fact.consumed_at<from_at or(until_at is not null and fact.consumed_at>=until_at)))
 then raise exception'FRANCHISE_HISTORICAL_BOOK_BASIS_RECONCILIATION_REQUIRED'using errcode='55000';end if;
end$$;
revoke all on function private.assert_franchise_book_period_basis_v1(uuid,date,date,uuid)from public,anon,authenticated,service_role;

-- The guards are table triggers so later corrected command bodies cannot erase
-- them. Existing historical records are retained and checked on the next action.
create function private.guard_franchise_bound_financial_write_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare source jsonb;period record;
begin
 perform pg_advisory_xact_lock(hashtextextended('franchise.pnl.book.'||new.book_id::text,0));
 source:=private.assert_franchise_book_binding_v1(new.book_id);
 if tg_table_name='franchise_profit_closure_versions'then
  perform private.assert_franchise_book_period_basis_v1(new.book_id,new.period_start,new.period_end,new.rule_version_id);
  if (new.rule_snapshot->>'franchise_type',new.rule_snapshot->>'operator_code',new.rule_snapshot->>'franchisee_share_bps',new.rule_snapshot->>'neoxa_share_bps',new.rule_snapshot->>'asma_matricia_share_bps')
   is distinct from(source#>>'{finance_rule,franchise_type}',source#>>'{finance_rule,operator_code}',source#>>'{finance_rule,franchisee_share_bps}',source#>>'{finance_rule,neoxa_share_bps}',source#>>'{finance_rule,asma_matricia_share_bps}')
   or new.formula_snapshot is distinct from source#>'{finance_rule,formula_snapshot}'
  then raise exception'FRANCHISE_CLOSURE_APPROVED_TERMS_MISMATCH'using errcode='55000';end if;
 elsif tg_table_name='franchise_distribution_ledger_entries'then
  if new.entry_type='PAYOUT'then
   if not exists(select 1 from public.franchise_profit_closure_versions c where c.book_id=new.book_id)or exists(select 1 from public.franchise_distribution_ledger_entries entitlement where entitlement.book_id=new.book_id and entitlement.amount_minor>0 and not exists(select 1 from public.franchise_profit_closure_versions c where c.id=entitlement.closure_version_id and c.book_id=entitlement.book_id))then raise exception'FRANCHISE_DISTRIBUTION_APPROVED_BASIS_REQUIRED'using errcode='55000';end if;
   for period in select distinct c.period_start,c.period_end,c.rule_version_id from public.franchise_profit_closure_versions c where c.book_id=new.book_id loop
    perform private.assert_franchise_book_period_basis_v1(new.book_id,period.period_start,period.period_end,period.rule_version_id);
   end loop;
  elsif new.closure_version_id is not null then
   select*into period from public.franchise_profit_closure_versions where id=new.closure_version_id and book_id=new.book_id;
   if not found then raise exception'FRANCHISE_DISTRIBUTION_APPROVED_BASIS_REQUIRED'using errcode='55000';end if;
   perform private.assert_franchise_book_period_basis_v1(new.book_id,period.period_start,period.period_end,period.rule_version_id);
  end if;
 elsif tg_table_name='franchise_entry_fee_schedules'then
  if new.rule_version_id is distinct from(source#>>'{finance_rule,id}')::uuid or new.mode is distinct from source#>>'{approved_mandate,entry_fee_mode}'
   or new.principal_minor is distinct from(source#>>'{approved_mandate,entry_fee_minor}')::bigint
   or(new.mode='UPFRONT'and new.due_on is distinct from new.starts_on)
   or(new.mode='INSTALLMENT'and new.installment_count is distinct from(source#>>'{approved_mandate,entry_fee_term_months}')::integer)
   or(new.mode in('INSTALLMENT','REVENUE_WITHHOLDING')and new.due_on>(new.starts_on+make_interval(months=>(source#>>'{approved_mandate,entry_fee_term_months}')::integer))::date)
   or(source#>>'{approved_mandate,entry_fee_minor}')::bigint>0 and source->>'currency'is distinct from source#>>'{economic_rule,currency}'
   or exists(select 1 from public.franchise_entry_fee_schedules other join public.franchise_pnl_book_bindings_v1 binding on binding.book_id=other.book_id
    where binding.franchise_id=(source->>'franchise_id')::uuid)
  then raise exception'FRANCHISE_ENTRY_FEE_APPROVED_TERMS_REQUIRED'using errcode='55000';end if;
 end if;
 return new;
end$$;
revoke all on function private.guard_franchise_bound_financial_write_v1()from public,anon,authenticated,service_role;
create trigger franchise_pnl_bound_book_guard before insert on public.franchise_pnl_entries for each row execute function private.guard_franchise_bound_financial_write_v1();
create trigger franchise_closure_bound_book_guard before insert on public.franchise_profit_closure_versions for each row execute function private.guard_franchise_bound_financial_write_v1();
create trigger franchise_distribution_bound_book_guard before insert on public.franchise_distribution_ledger_entries for each row execute function private.guard_franchise_bound_financial_write_v1();
create trigger franchise_entry_fee_bound_book_guard before insert on public.franchise_entry_fee_schedules for each row execute function private.guard_franchise_bound_financial_write_v1();
revoke insert,update,delete on public.franchise_pnl_books,public.franchise_pnl_entries,public.franchise_profit_closure_versions,public.franchise_profit_allocations,public.franchise_distribution_ledger_entries,public.franchise_entry_fee_schedules from anon,authenticated,service_role;

create or replace function private.credit_economic_book_route_v1(p_library uuid,p_client uuid,p_currency char(3),p_consumed_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare route jsonb;b public.franchise_pnl_books%rowtype;f public.franchises%rowtype;m public.franchise_mandate_versions%rowtype;source jsonb;
begin
 route:=private.approved_credit_revenue_policy_v1('BOOK_ROUTE','LIBRARY',p_library,p_currency,(p_consumed_at at time zone'Africa/Casablanca')::date,p_client);if route is null then return null;end if;
 select*into b from public.franchise_pnl_books where id=(route#>>'{policy_snapshot,book_id}')::uuid and library_id=p_library and currency=p_currency and status='OPEN';
 select*into f from public.franchises where id=(route#>>'{policy_snapshot,franchise_id}')::uuid and library_id=p_library and operator_organization_id=b.franchise_organization_id;
 select*into m from public.franchise_mandate_versions where id=(route#>>'{policy_snapshot,mandate_version_id}')::uuid and franchise_id=f.id;
 if b.id is null or f.id is null or m.id is null then return null;end if;
 source:=private.franchise_book_active_basis_v1(b.id);
 if (source->>'franchise_id')::uuid is distinct from f.id or(source->>'active_mandate_version_id')::uuid is distinct from m.id
  or p_consumed_at<(source->>'effective_from')::timestamptz or(source->>'effective_until'is not null and p_consumed_at>=(source->>'effective_until')::timestamptz)
 then raise exception'CREDIT_BOOK_APPROVED_MANDATE_BASIS_MISMATCH'using errcode='55000';end if;
 -- Current activity still gates a NEW allocation. Already-created historical
 -- allocations are rechecked by their frozen basis when closing/paying later.
 if f.status<>'ACTIVE'or f.current_mandate_version_id is distinct from m.id or not private.franchise_activation_mode_allowed_v1(f.id)
  or not exists(select 1 from public.organizations where id=f.operator_organization_id and status='ACTIVE')then return null;end if;
 return route||jsonb_build_object('book',to_jsonb(b),'franchise',to_jsonb(f),'mandate',to_jsonb(m));
end$$;
-- Historical closes use the bound rule; retiring its administrative status does
-- not erase the right to close an already-elapsed eligible contractual period.
do $$declare definition text;needle text:='rv.status<>''ACTIVE''or';begin
 definition:=pg_get_functiondef('public.close_franchise_profit_period(uuid,date,date,uuid,timestamptz,text,text,uuid)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception'FRANCHISE_CLOSE_RULE_STATUS_SOURCE_MISMATCH';end if;
 execute replace(definition,needle,'');
end$$;

create or replace function private.franchise_book_access(p_book uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR'],p_actor)
 or exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=p_book
  and private.has_franchise_role(binding.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER'],p_actor))
 or exists(select 1 from public.franchise_pnl_books book join public.franchises f on f.library_id=book.library_id and f.operator_organization_id=book.franchise_organization_id
  where book.id=p_book and not exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=book.id)
  and f.franchise_type=book.franchise_type and f.operator_code=book.operator_code
  and(select count(*)from public.franchises other where other.library_id=book.library_id and other.operator_organization_id=book.franchise_organization_id)=1
  and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_ACCOUNTING','FRANCHISE_VIEWER'],p_actor))
$$;

create function private.franchise_book_matches_scope_v1(p_book uuid,p_franchise uuid)returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select private.franchise_access(p_franchise)and exists(
  select 1 from public.franchise_pnl_books book join public.franchises f on f.id=p_franchise and f.library_id=book.library_id and f.operator_organization_id=book.franchise_organization_id
  where book.id=p_book and(exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=book.id and binding.franchise_id=f.id)
   or(not exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=book.id)and book.franchise_type=f.franchise_type and book.operator_code=f.operator_code
    and(select count(*)from public.franchises other where other.library_id=book.library_id and other.operator_organization_id=book.franchise_organization_id)=1)))
$$;
revoke all on function private.franchise_book_matches_scope_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function private.franchise_book_matches_scope_v1(uuid,uuid)to authenticated;

create function private.franchise_book_binding_review_required_v1(p_book uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if private.franchise_book_access(p_book)is distinct from true then raise exception'FRANCHISE_BOOK_SCOPE_DENIED'using errcode='42501';end if;
 begin perform private.assert_franchise_book_binding_v1(p_book);return false;
 exception when sqlstate'55000'then return true;end;
end$$;
revoke all on function private.franchise_book_binding_review_required_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function private.franchise_book_binding_review_required_v1(uuid)to authenticated;

create function private.franchise_scope_has_unbound_book_v1(p_franchise uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if private.franchise_access(p_franchise)is distinct from true then raise exception'FRANCHISE_BOOK_SCOPE_DENIED'using errcode='42501';end if;
 return exists(select 1 from public.franchise_pnl_books book join public.franchises f on f.id=p_franchise and f.library_id=book.library_id and f.operator_organization_id=book.franchise_organization_id
  where not exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=book.id));
end$$;
revoke all on function private.franchise_scope_has_unbound_book_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function private.franchise_scope_has_unbound_book_v1(uuid)to authenticated;

-- Keep the final INVOKER projection, its fixed query allow-list, row-budget,
-- column grants and RLS. Only book scope and explicit binding diagnostics change.
do $projection$
declare definition text;old text;replacement text;
begin
 definition:=pg_get_functiondef('public.franchise_governance_dashboard_snapshot(uuid)'::regprocedure);
 old:='x.id,x.library_id,x.franchise_organization_id,x.franchise_type,x.operator_code,x.currency,x.opened_under_rule_version_id,x.status';
 replacement:=old||', (select binding.franchise_id from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=x.id) as franchise_id, private.franchise_book_binding_review_required_v1(x.id) as binding_review_required';
 if strpos(definition,old)=0 then raise exception'FRANCHISE_BOOK_SNAPSHOT_FIELDS_SOURCE_MISMATCH';end if;
 definition:=replace(definition,old,replacement);
 old:='exists(select 1 from public.franchises f where f.id=$1 and f.library_id=x.library_id and f.operator_organization_id=x.franchise_organization_id)';
 if strpos(definition,old)=0 then raise exception'FRANCHISE_BOOK_SNAPSHOT_SCOPE_SOURCE_MISMATCH';end if;
 definition:=replace(definition,old,'private.franchise_book_matches_scope_v1(x.id,$1)');
 old:='join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id where f.id=$1 and b.id=x.book_id';
 definition:=replace(definition,old,'where private.franchise_book_matches_scope_v1(b.id,$1)and b.id=x.book_id');
 old:='join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id where f.id=$1 and c.id=x.closure_version_id';
 definition:=replace(definition,old,'where private.franchise_book_matches_scope_v1(b.id,$1)and c.id=x.closure_version_id');
 old:='join public.franchises f on f.library_id=b.library_id and f.operator_organization_id=b.franchise_organization_id where f.id=$1 and s.id=x.schedule_id';
 definition:=replace(definition,old,'where private.franchise_book_matches_scope_v1(b.id,$1)and s.id=x.schedule_id');
 old:=' return result;';
 if strpos(definition,old)=0 then raise exception'FRANCHISE_BOOK_SNAPSHOT_RESULT_SOURCE_MISMATCH';end if;
 definition:=replace(definition,old,$source$
 result:=jsonb_set(result,array['bookBindingReviewRequired'],to_jsonb(case when p_franchise_id is not null then private.franchise_scope_has_unbound_book_v1(p_franchise_id)or exists(select 1 from jsonb_array_elements(result->'bs')book where(book->>'binding_review_required')::boolean)else exists(select 1 from jsonb_array_elements(result->'bs')book where(book->>'binding_review_required')::boolean)end));
 return result;$source$);
 execute definition;
 definition:=pg_get_functiondef('public.franchise_statement_export(uuid,uuid,text)'::regprocedure);
 old:='select *into b from public.franchise_pnl_books where id=c.book_id and library_id=f.library_id and franchise_organization_id=f.operator_organization_id;';
 if strpos(definition,old)=0 then raise exception'FRANCHISE_STATEMENT_BOUND_SCOPE_SOURCE_MISMATCH';end if;
 execute replace(definition,old,'select book.*into b from public.franchise_pnl_books book where book.id=c.book_id and private.franchise_book_matches_scope_v1(book.id,f.id);');
end$projection$;

notify pgrst,'reload schema';
commit;
