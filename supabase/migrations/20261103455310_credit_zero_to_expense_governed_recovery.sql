begin;
-- A withdrawn zero statement may be corrected with a real expense. Both the
-- withdrawn source and every analytical version remain immutable and visible.
alter table public.credit_economic_cost_proposals_v1 add column supersedes_reconciliation_id uuid references public.credit_economic_cost_reconciliations_v1(id);
alter table public.credit_economic_cost_reconciliations_v1 add column supersedes_reconciliation_id uuid references public.credit_economic_cost_reconciliations_v1(id);

create function private.credit_economic_cost_decider_allowed_v1(p_proposal uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select p_actor is not null and private.credit_revenue_finance_access_v1(p_actor,true)is true and exists(
  select 1 from public.credit_economic_cost_proposals_v1 p where p.id=p_proposal
  and p.created_by is distinct from p_actor
  and p.source_snapshot#>>'{journal,created_by}'is distinct from p_actor::text
  and p.source_snapshot#>>'{document,created_by}'is distinct from p_actor::text
  and p.source_snapshot#>>'{target,receipt,operator_user_id}'is distinct from p_actor::text
  and p.source_snapshot#>>'{target,receipt,accepted_by}'is distinct from p_actor::text
  and private.is_active_org_member((p.source_snapshot->>'organization_id')::uuid,p_actor)is false
  and not exists(select 1 from public.credit_economic_allocations_v1 allocation join public.franchise_pnl_books book on book.id=allocation.book_id
   left join public.credit_economic_consumption_facts_v1 fact on fact.id=allocation.consumption_fact_id
   where(case p.component when'PSP_FEE'then allocation.funding_source_id=p.target_id else fact.redemption_id=p.target_id end)
    and(private.is_active_org_member(book.franchise_organization_id,p_actor)or private.is_active_org_member(fact.organization_id,p_actor))))
$$;
revoke all on function private.credit_economic_cost_decider_allowed_v1(uuid,uuid)from public,anon,authenticated,service_role;

create function private.credit_economic_revoked_zero_predecessor_v1(p_component text,p_target uuid)returns uuid
language plpgsql stable security definer set search_path=pg_catalog as $$
declare prior public.credit_economic_cost_reconciliations_v1%rowtype;
begin
 select*into prior from public.credit_economic_cost_reconciliations_v1 where component=p_component and target_id=p_target order by version desc limit 1;
 if prior.id is null then return null;end if;
 if prior.evidence_mode is distinct from'ZERO_COST_DOCUMENT'or prior.net_cost_minor<>0
  or not exists(select 1 from public.finance_cost_document_revocations_v1 revoked where revoked.upload_id=prior.document_upload_id)
  or not exists(select 1 from public.credit_economic_cost_proposals_v1 proposal join public.credit_economic_cost_decisions_v1 decision on decision.proposal_id=proposal.id
   where proposal.id=prior.proposal_id and proposal.evidence_mode='ZERO_COST_DOCUMENT'and proposal.component=prior.component and proposal.target_id=prior.target_id
    and proposal.document_upload_id=prior.document_upload_id and decision.approved and decision.source_hash=prior.source_hash
    and proposal.source_hash=prior.source_hash and private.canonical_request_hash(proposal.source_snapshot)=prior.source_hash)
 then raise exception'CREDIT_ECONOMIC_COST_ALREADY_RECONCILED'using errcode='55000';end if;
 return prior.id;
end$$;
revoke all on function private.credit_economic_revoked_zero_predecessor_v1(text,uuid)from public,anon,authenticated,service_role;

create function private.assert_credit_expense_recovery_scope_v1(p_component text,p_target uuid,p_journal uuid)returns void
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare item record;journal_day date;target_day date;
begin
 for item in select distinct allocation.book_id from public.credit_economic_allocations_v1 allocation left join public.credit_economic_consumption_facts_v1 fact on fact.id=allocation.consumption_fact_id
  where(case p_component when'PSP_FEE'then allocation.funding_source_id=p_target else fact.redemption_id=p_target end)order by allocation.book_id loop
  perform pg_advisory_xact_lock(hashtextextended('franchise.pnl.book.'||item.book_id::text,0));
 end loop;
 if exists(select 1 from public.credit_economic_allocations_v1 allocation left join public.credit_economic_consumption_facts_v1 fact on fact.id=allocation.consumption_fact_id
  join private.credit_economic_pnl_sources_v1 bridge on bridge.allocation_id=allocation.id join public.franchise_pnl_entries entry on entry.id=bridge.pnl_entry_id
  join public.franchise_profit_closure_versions closure on closure.book_id=allocation.book_id and entry.effective_on between closure.period_start and closure.period_end
  where(case p_component when'PSP_FEE'then allocation.funding_source_id=p_target else fact.redemption_id=p_target end))
 then raise exception'CREDIT_ECONOMIC_CLOSED_PERIOD_REVIEW_REQUIRED'using errcode='55000';end if;
 select(j.effective_at at time zone'Africa/Casablanca')::date into journal_day from public.financial_journals j where j.id=p_journal;
 if p_component='PSP_FEE'then
  select(j.effective_at at time zone'Africa/Casablanca')::date into target_day from public.credit_economic_funding_sources_v1 funding join public.financial_journals j on j.id=funding.financial_journal_id where funding.id=p_target;
  if journal_day is null or journal_day is distinct from target_day then raise exception'CREDIT_ECONOMIC_RECOVERY_PERIOD_REQUIRED'using errcode='55000';end if;
 elsif p_component='FULFILLMENT_COST'then
  if journal_day is null or not exists(select 1 from public.credit_economic_consumption_facts_v1 fact where fact.redemption_id=p_target)
   or exists(select 1 from public.credit_economic_consumption_facts_v1 fact where fact.redemption_id=p_target and(fact.consumed_at at time zone'Africa/Casablanca')::date is distinct from journal_day)
  then raise exception'CREDIT_ECONOMIC_RECOVERY_PERIOD_REQUIRED'using errcode='55000';end if;
 else raise exception'INVALID_CREDIT_ECONOMIC_COST_COMPONENT'using errcode='22023';end if;
end$$;
revoke all on function private.assert_credit_expense_recovery_scope_v1(text,uuid,uuid)from public,anon,authenticated,service_role;

create function private.assert_credit_zero_expense_attribution_v1(p_old uuid,p_new uuid,p_allocation uuid)returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare old_source public.credit_economic_cost_reconciliations_v1%rowtype;new_source public.credit_economic_cost_reconciliations_v1%rowtype;
begin
 select*into old_source from public.credit_economic_cost_reconciliations_v1 where id=p_old;
 select*into new_source from public.credit_economic_cost_reconciliations_v1 where id=p_new;
 if old_source.id is null or new_source.id is null or old_source.evidence_mode<>'ZERO_COST_DOCUMENT'or old_source.net_cost_minor<>0
  or new_source.evidence_mode<>'EXPENSE_JOURNAL'or new_source.net_cost_minor<=0 or new_source.component<>old_source.component or new_source.target_id<>old_source.target_id or new_source.currency<>old_source.currency
  or new_source.version<=old_source.version or not exists(select 1 from public.credit_economic_cost_reconciliations_v1 predecessor where predecessor.id=new_source.supersedes_reconciliation_id and predecessor.component=new_source.component and predecessor.target_id=new_source.target_id and predecessor.version=new_source.version-1)
  or(select count(*)from public.credit_economic_cost_reconciliations_v1 prior where prior.component=new_source.component and prior.target_id=new_source.target_id and prior.version>=old_source.version and prior.version<new_source.version)<>new_source.version-old_source.version
  or exists(select 1 from public.credit_economic_cost_reconciliations_v1 prior where prior.component=new_source.component and prior.target_id=new_source.target_id and prior.version>=old_source.version and prior.version<new_source.version
   and(prior.evidence_mode<>'ZERO_COST_DOCUMENT'or prior.net_cost_minor<>0 or not exists(select 1 from public.finance_cost_document_revocations_v1 revoked where revoked.upload_id=prior.document_upload_id)))
  or not exists(select 1 from public.credit_economic_allocations_v1 allocation left join public.credit_economic_consumption_facts_v1 fact on fact.id=allocation.consumption_fact_id where allocation.id=p_allocation and(case new_source.component when'PSP_FEE'then allocation.funding_source_id=new_source.target_id else fact.redemption_id=new_source.target_id end))
 then raise exception'CREDIT_ECONOMIC_COST_ATTRIBUTION_CHANGED'using errcode='55000';end if;
 perform private.assert_credit_expense_recovery_scope_v1(new_source.component,new_source.target_id,new_source.financial_journal_id);
end$$;
revoke all on function private.assert_credit_zero_expense_attribution_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;

-- Preserve all reviewed command bodies, including journal locks, receipt/scan
-- checks, idempotence and audit/outbox. Patch only the proven admission gaps.
do $migration$
declare definition text;needle text;replacement text;start_at integer;end_at integer;signature text;
begin
 definition:=pg_get_functiondef('public.propose_credit_economic_cost_v1(text,uuid,uuid,text,text)'::regprocedure);
 needle:='declare source jsonb;';if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_PROPOSAL_DECLARATION_CHANGED';end if;
 definition:=replace(definition,needle,'declare prior uuid;source jsonb;');
 needle:='if exists(select 1 from public.credit_economic_cost_reconciliations_v1 where component=p_component and target_id=p_target_id)then raise exception''CREDIT_ECONOMIC_COST_ALREADY_RECONCILED''using errcode=''55000'';end if;';
 if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_PROPOSAL_SOURCE_CHANGED';end if;
 definition:=replace(definition,needle,'prior:=private.credit_economic_revoked_zero_predecessor_v1(p_component,p_target_id);if prior is not null then perform private.assert_credit_expense_recovery_scope_v1(p_component,p_target_id,p_financial_journal_id);end if;');
 needle:='source_hash,reason,created_by,idempotency_key)';if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_PROPOSAL_FIELDS_CHANGED';end if;
 definition:=replace(definition,needle,'source_hash,reason,created_by,idempotency_key,supersedes_reconciliation_id)');
 needle:='source,h,btrim(p_reason),auth.uid(),p_idempotency_key);';if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_PROPOSAL_VALUES_CHANGED';end if;
 execute replace(definition,needle,'source,h,btrim(p_reason),auth.uid(),p_idempotency_key,prior);');

 foreach signature in array array['public.decide_credit_economic_cost_v1(uuid,text,boolean,text)','private.decide_credit_economic_expense_cost_v1(uuid,text,boolean,text)']loop
  definition:=pg_get_functiondef(signature::regprocedure);
  needle:=case when signature like'public.%'then'if p.created_by=auth.uid()or p.source_snapshot#>>''{document,created_by}'''else'if p.id is null or p.created_by=auth.uid()or p.source_snapshot#>>''{journal,created_by}'''end;
  start_at:=strpos(definition,needle);if start_at=0 then raise exception'EXPENSE_RECOVERY_DECIDER_SOURCE_CHANGED';end if;
  needle:='then raise exception''CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED''using errcode=''42501'';end if;';
  end_at:=strpos(substr(definition,start_at),needle);if end_at=0 then raise exception'EXPENSE_RECOVERY_DECIDER_END_CHANGED';end if;
  definition:=overlay(definition placing 'if private.credit_economic_cost_decider_allowed_v1(p.id,auth.uid())is distinct from true then raise exception''CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED''using errcode=''42501'';end if;' from start_at for end_at+length(needle)-1);
  if signature like'private.%'then
   needle:='declare p public.credit_economic_cost_proposals_v1%rowtype;';if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_DECISION_DECLARATION_CHANGED';end if;
   definition:=replace(definition,needle,'declare prior uuid;new_version integer;p public.credit_economic_cost_proposals_v1%rowtype;');
   needle:='perform pg_advisory_xact_lock(hashtextextended(''franchise.pnl.journal.''||p.financial_journal_id::text,0));';if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_JOURNAL_LOCK_CHANGED';end if;
   replacement:=$patch$
   if p_approved then
    prior:=private.credit_economic_revoked_zero_predecessor_v1(p.component,p.target_id);
    if prior is distinct from p.supersedes_reconciliation_id then raise exception'CREDIT_ECONOMIC_COST_SOURCE_CHANGED'using errcode='40001';end if;
    if prior is not null then perform private.assert_credit_expense_recovery_scope_v1(p.component,p.target_id,p.financial_journal_id);end if;
    select coalesce(max(version),0)+1 into new_version from public.credit_economic_cost_reconciliations_v1 where component=p.component and target_id=p.target_id;
   end if;
$patch$;
   definition:=replace(definition,needle,replacement||needle);
   needle:='net_cost_minor,currency,source_hash)';if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_DECISION_FIELDS_CHANGED';end if;
   definition:=replace(definition,needle,'net_cost_minor,currency,source_hash,version,supersedes_reconciliation_id)');
   needle:='p.net_cost_minor,p.currency,h);';if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_DECISION_VALUES_CHANGED';end if;
   definition:=replace(definition,needle,'p.net_cost_minor,p.currency,h,new_version,prior);');
  end if;
  execute definition;
 end loop;

 definition:=pg_get_functiondef('public.get_finance_cost_documents_v1(text,uuid,integer)'::regprocedure);
 needle:='(private.credit_revenue_finance_access_v1(auth.uid(),true)is true and decision.proposal_id is null';start_at:=strpos(definition,needle);
 if start_at=0 then raise exception'EXPENSE_RECOVERY_CAPABILITY_SOURCE_CHANGED';end if;
 needle:=')can_decide,';end_at:=strpos(substr(definition,start_at),needle);if end_at=0 then raise exception'EXPENSE_RECOVERY_CAPABILITY_END_CHANGED';end if;
 replacement:='(private.credit_economic_cost_decider_allowed_v1(p.id,auth.uid())is true and decision.proposal_id is null and u.scan_status=''CLEAN''and not exists(select 1 from public.finance_cost_document_revocations_v1 revoked where revoked.upload_id=u.id))can_decide,';
 execute overlay(definition placing replacement from start_at for end_at+length(needle)-1);

 definition:=pg_get_functiondef('public.reconcile_credit_economic_profit_v1(uuid,date,date,text,text)'::regprocedure);
 needle:='if old.amount_minor<>0 or amount<>0 or not exists(select 1 from public.credit_economic_cost_reconciliations_v1 old_source where old_source.id=old.reconciliation_id and old_source.evidence_mode=''ZERO_COST_DOCUMENT'')or share->>''evidence_mode''is distinct from''ZERO_COST_DOCUMENT''then raise exception''CREDIT_ECONOMIC_COST_ATTRIBUTION_CHANGED''using errcode=''55000'';end if;';
 if strpos(definition,needle)=0 then raise exception'EXPENSE_RECOVERY_ATTRIBUTION_SOURCE_CHANGED';end if;
 replacement:=$patch$
    if old.amount_minor<>0 or old.pnl_entry_id is not null then raise exception'CREDIT_ECONOMIC_COST_ATTRIBUTION_CHANGED'using errcode='55000';end if;
    if share->>'evidence_mode'='ZERO_COST_DOCUMENT'then
     if amount<>0 or not exists(select 1 from public.credit_economic_cost_reconciliations_v1 old_source where old_source.id=old.reconciliation_id and old_source.evidence_mode='ZERO_COST_DOCUMENT')then raise exception'CREDIT_ECONOMIC_COST_ATTRIBUTION_CHANGED'using errcode='55000';end if;
    else
     perform private.assert_credit_zero_expense_attribution_v1(old.reconciliation_id,(share->>'reconciliation_id')::uuid,a.id);
    end if;
$patch$;
 execute replace(definition,needle,replacement);
end$migration$;
notify pgrst,'reload schema';
commit;
