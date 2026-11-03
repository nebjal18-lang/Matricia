begin;
-- Zero is a positively reviewed document fact, not an absent journal or a
-- caller-supplied waiver. Existing expense-based proposals keep their contract.
alter table public.credit_economic_cost_proposals_v1 add column evidence_mode text not null default'EXPENSE_JOURNAL'check(evidence_mode in('EXPENSE_JOURNAL','ZERO_COST_DOCUMENT'));
alter table public.credit_economic_cost_proposals_v1 add column document_upload_id uuid references public.finance_cost_document_uploads_v1(id);
alter table public.credit_economic_cost_proposals_v1 alter column financial_journal_id drop not null;
alter table public.credit_economic_cost_proposals_v1 drop constraint credit_economic_cost_proposals_v1_net_cost_minor_check;
alter table public.credit_economic_cost_proposals_v1 add constraint credit_cost_proposal_evidence_exact check((evidence_mode='EXPENSE_JOURNAL'and net_cost_minor>0 and financial_journal_id is not null and document_upload_id is null)or(evidence_mode='ZERO_COST_DOCUMENT'and net_cost_minor=0 and financial_journal_id is null and document_upload_id is not null));
alter table public.credit_economic_cost_reconciliations_v1 add column evidence_mode text not null default'EXPENSE_JOURNAL'check(evidence_mode in('EXPENSE_JOURNAL','ZERO_COST_DOCUMENT'));
alter table public.credit_economic_cost_reconciliations_v1 add column document_upload_id uuid references public.finance_cost_document_uploads_v1(id);
alter table public.credit_economic_cost_reconciliations_v1 add column version integer not null default 1 check(version>0);
alter table public.credit_economic_cost_reconciliations_v1 alter column financial_journal_id drop not null;
alter table public.credit_economic_cost_reconciliations_v1 drop constraint credit_economic_cost_reconciliations_v1_net_cost_minor_check;
alter table public.credit_economic_cost_reconciliations_v1 drop constraint credit_economic_cost_reconciliations_v1_component_target_id_key;
alter table public.credit_economic_cost_reconciliations_v1 add constraint credit_cost_reconciliation_version unique(component,target_id,version);
alter table public.credit_economic_cost_reconciliations_v1 add constraint credit_cost_reconciliation_evidence_exact check((evidence_mode='EXPENSE_JOURNAL'and net_cost_minor>0 and financial_journal_id is not null and document_upload_id is null)or(evidence_mode='ZERO_COST_DOCUMENT'and net_cost_minor=0 and financial_journal_id is null and document_upload_id is not null));
alter table public.credit_economic_cost_attributions_v1 add column version integer not null default 1 check(version>0);
alter table public.credit_economic_cost_attributions_v1 drop constraint credit_economic_cost_attributions_v1_pkey;
alter table public.credit_economic_cost_attributions_v1 add primary key(allocation_id,component,version);

create function private.credit_economic_zero_cost_source_v1(p_component text,p_target uuid,p_upload uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare context jsonb;u public.finance_cost_document_uploads_v1%rowtype;scan private.finance_cost_document_scan_results_v1%rowtype;
begin
 context:=private.credit_economic_cost_target_v1(p_component,p_target);
 select*into u from public.finance_cost_document_uploads_v1 where id=p_upload;
 select*into scan from private.finance_cost_document_scan_results_v1 where id=u.scan_result_id and upload_id=u.id and result='CLEAN';
 if u.id is null or u.component is distinct from p_component or u.target_id is distinct from p_target or u.organization_id is distinct from(context->>'organization_id')::uuid or u.target_hash is distinct from private.canonical_request_hash(context)then raise exception'FINANCE_COST_DOCUMENT_TARGET_CHANGED'using errcode='40001';end if;
 if u.status<>'UPLOADED'or u.scan_status<>'CLEAN'or scan.id is null or scan.computed_sha256 is distinct from u.sha256 or scan.computed_size_bytes is distinct from u.size_bytes
  or not exists(select 1 from storage.objects object where object.bucket_id=u.storage_bucket and object.name=u.storage_path and object.metadata->>'mimetype'=u.mime_type and object.metadata->>'size'=u.size_bytes::text)
 then raise exception'FINANCE_COST_CLEAN_DOCUMENT_REQUIRED'using errcode='55000';end if;
 if exists(select 1 from public.finance_cost_document_revocations_v1 revoked where revoked.upload_id=u.id)then raise exception'FINANCE_COST_DOCUMENT_REVOKED'using errcode='55000';end if;
 return jsonb_build_object('component',p_component,'target_id',p_target,'target',context->'target','organization_id',u.organization_id,'currency',context->>'currency','net_cost_minor','0','evidence_mode','ZERO_COST_DOCUMENT',
  'document',jsonb_build_object('upload_id',u.id,'file_name',u.file_name,'storage_bucket',u.storage_bucket,'storage_path',u.storage_path,'mime_type',u.mime_type,'size_bytes',u.size_bytes,'sha256',u.sha256,'created_by',u.created_by,'scan_result_id',scan.id,'engine_code',scan.engine_code,'engine_version',scan.engine_version));
end$$;
revoke all on function private.credit_economic_zero_cost_source_v1(text,uuid,uuid)from public,anon,authenticated,service_role;

create function public.propose_credit_economic_zero_cost_v1(p_component text,p_target_id uuid,p_upload_id uuid,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare source jsonb;h text;p public.credit_economic_cost_proposals_v1%rowtype;prior public.credit_economic_cost_reconciliations_v1%rowtype;id uuid:=extensions.gen_random_uuid();response jsonb;
begin
 if private.credit_revenue_finance_access_v1(auth.uid(),true)is distinct from true then raise exception'CREDIT_ECONOMIC_COST_REVIEW_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_CREDIT_ECONOMIC_COST_PROPOSAL'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-cost:'||p_component||':'||p_target_id::text,0));
 source:=private.credit_economic_zero_cost_source_v1(p_component,p_target_id,p_upload_id);h:=private.canonical_request_hash(source);
 if private.is_active_org_member((source->>'organization_id')::uuid,auth.uid())or exists(select 1 from public.credit_economic_allocations_v1 alloc join public.franchise_pnl_books book on book.id=alloc.book_id left join public.credit_economic_consumption_facts_v1 fact on fact.id=alloc.consumption_fact_id where(case p_component when'PSP_FEE'then alloc.funding_source_id=p_target_id else fact.redemption_id=p_target_id end)and(private.is_active_org_member(book.franchise_organization_id,auth.uid())or private.is_active_org_member(fact.organization_id,auth.uid())))then raise exception'CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED'using errcode='42501';end if;
 select*into p from public.credit_economic_cost_proposals_v1 where created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if p.id is not null then
  if p.evidence_mode<>'ZERO_COST_DOCUMENT'or p.component is distinct from p_component or p.target_id is distinct from p_target_id or p.document_upload_id is distinct from p_upload_id or p.reason<>btrim(p_reason)or p.source_hash<>h then raise exception'CREDIT_ECONOMIC_COST_REPLAY_MISMATCH'using errcode='22000';end if;
  return jsonb_build_object('outcome','CREDIT_ECONOMIC_COST_PROPOSED','proposal_id',p.id,'source_hash',p.source_hash,'net_cost_minor','0','currency',p.currency);
 end if;
 select*into prior from public.credit_economic_cost_reconciliations_v1 where component=p_component and target_id=p_target_id order by version desc limit 1;
 if prior.id is not null and(prior.evidence_mode<>'ZERO_COST_DOCUMENT'or not exists(select 1 from public.finance_cost_document_revocations_v1 r where r.upload_id=prior.document_upload_id))then raise exception'CREDIT_ECONOMIC_COST_ALREADY_RECONCILED'using errcode='55000';end if;
 insert into public.credit_economic_cost_proposals_v1(id,component,target_id,financial_journal_id,net_cost_minor,currency,source_snapshot,source_hash,reason,created_by,idempotency_key,evidence_mode,document_upload_id)
 values(id,p_component,p_target_id,null,0,source->>'currency',source,h,btrim(p_reason),auth.uid(),p_idempotency_key,'ZERO_COST_DOCUMENT',p_upload_id);
 response:=jsonb_build_object('outcome','CREDIT_ECONOMIC_COST_PROPOSED','proposal_id',id,'source_hash',h,'net_cost_minor','0','currency',source->>'currency');
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values((source->>'organization_id')::uuid,auth.uid(),'USER','credit.economic.zero_cost.proposed','credit_economic_cost',id::text,id,response||jsonb_build_object('document_upload_id',p_upload_id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values((source->>'organization_id')::uuid,'credit_economic_cost',id::text,'CreditEconomicZeroCostProposedV1',id,response,'credit-economic-zero-cost-proposed:'||id::text);return response;
end$$;

-- Preserve the already reviewed expense implementation and its journal lock.
alter function public.decide_credit_economic_cost_v1(uuid,text,boolean,text)rename to decide_credit_economic_expense_cost_v1;
alter function public.decide_credit_economic_expense_cost_v1(uuid,text,boolean,text)set schema private;
revoke all on function private.decide_credit_economic_expense_cost_v1(uuid,text,boolean,text)from public,anon,authenticated,service_role;
create function public.decide_credit_economic_cost_v1(p_proposal_id uuid,p_expected_source_hash text,p_approved boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare p public.credit_economic_cost_proposals_v1%rowtype;d public.credit_economic_cost_decisions_v1%rowtype;prior public.credit_economic_cost_reconciliations_v1%rowtype;
 source jsonb;h text;new_id uuid:=extensions.gen_random_uuid();response jsonb;new_version integer;
begin
 if private.credit_revenue_finance_access_v1(auth.uid(),true)is distinct from true then raise exception'CREDIT_ECONOMIC_COST_REVIEW_DENIED'using errcode='42501';end if;
 select*into p from public.credit_economic_cost_proposals_v1 where id=p_proposal_id for update;
 if p.id is null then raise exception'CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED'using errcode='42501';end if;
 if p.evidence_mode='EXPENSE_JOURNAL'then return private.decide_credit_economic_expense_cost_v1(p_proposal_id,p_expected_source_hash,p_approved,p_reason);end if;
 if p.created_by=auth.uid()or p.source_snapshot#>>'{document,created_by}'=auth.uid()::text or private.is_active_org_member((p.source_snapshot->>'organization_id')::uuid,auth.uid())
  or p.source_snapshot#>>'{target,receipt,operator_user_id}'=auth.uid()::text or p.source_snapshot#>>'{target,receipt,accepted_by}'=auth.uid()::text
  or exists(select 1 from public.credit_economic_allocations_v1 alloc join public.franchise_pnl_books book on book.id=alloc.book_id left join public.credit_economic_consumption_facts_v1 fact on fact.id=alloc.consumption_fact_id where(case p.component when'PSP_FEE'then alloc.funding_source_id=p.target_id else fact.redemption_id=p.target_id end)and(private.is_active_org_member(book.franchise_organization_id,auth.uid())or private.is_active_org_member(fact.organization_id,auth.uid())))then raise exception'CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED'using errcode='42501';end if;
 if p_approved is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_CREDIT_ECONOMIC_COST_DECISION'using errcode='22023';end if;
 if p_expected_source_hash is distinct from p.source_hash then raise exception'CREDIT_ECONOMIC_COST_SOURCE_CHANGED'using errcode='40001';end if;
 select*into d from public.credit_economic_cost_decisions_v1 where proposal_id=p.id;
 if d.proposal_id is not null then
  if d.approved is distinct from p_approved then raise exception'DECISION_ALREADY_RECORDED'using errcode='22000';end if;return d.response;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-cost:'||p.component||':'||p.target_id::text,0));
 source:=private.credit_economic_zero_cost_source_v1(p.component,p.target_id,p.document_upload_id);h:=private.canonical_request_hash(source);
 if h is distinct from p.source_hash then raise exception'CREDIT_ECONOMIC_COST_SOURCE_CHANGED'using errcode='40001';end if;
 if not exists(select 1 from private.finance_cost_document_read_receipts_v1 read_receipt where read_receipt.upload_id=p.document_upload_id and read_receipt.actor_id=auth.uid()and read_receipt.sha256=p.source_snapshot#>>'{document,sha256}'and read_receipt.scan_result_id=(p.source_snapshot#>>'{document,scan_result_id}')::uuid)then raise exception'FINANCE_COST_DOCUMENT_REVIEW_READ_REQUIRED'using errcode='55000';end if;
 select*into prior from public.credit_economic_cost_reconciliations_v1 where component=p.component and target_id=p.target_id order by version desc limit 1;
 if prior.id is not null and(prior.evidence_mode<>'ZERO_COST_DOCUMENT'or not exists(select 1 from public.finance_cost_document_revocations_v1 revoked where revoked.upload_id=prior.document_upload_id))then raise exception'CREDIT_ECONOMIC_COST_ALREADY_RECONCILED'using errcode='55000';end if;
 new_version:=coalesce(prior.version,0)+1;
 if p_approved then insert into public.credit_economic_cost_reconciliations_v1(id,proposal_id,component,target_id,financial_journal_id,net_cost_minor,currency,source_hash,evidence_mode,document_upload_id,version)
  values(new_id,p.id,p.component,p.target_id,null,0,p.currency,h,'ZERO_COST_DOCUMENT',p.document_upload_id,new_version);end if;
 response:=jsonb_build_object('outcome',case when p_approved then'CREDIT_ECONOMIC_COST_RECONCILED'else'CREDIT_ECONOMIC_COST_REJECTED'end,'proposal_id',p.id,'reconciliation_id',case when p_approved then new_id end,'net_cost_minor','0','currency',p.currency,'version',new_version);
 insert into public.credit_economic_cost_decisions_v1(proposal_id,approved,source_hash,reason,decided_by,response)values(p.id,p_approved,h,btrim(p_reason),auth.uid(),response);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values((source->>'organization_id')::uuid,auth.uid(),'USER','credit.economic.zero_cost.decided','credit_economic_cost',p.id::text,p.id,response||jsonb_build_object('document_upload_id',p.document_upload_id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values((source->>'organization_id')::uuid,'credit_economic_cost',p.id::text,'CreditEconomicZeroCostDecidedV1',p.id,response,'credit-economic-zero-cost-decided:'||p.id::text);return response;
end$$;

-- Append-only evidence replacement after independent revocation. An expense
-- ledger cannot be erased by submitting a zero document. Only zero→zero proof
-- replacement appends a new analytical evidence version without journal rows.
do $migration$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('private.credit_economic_cost_share_v1(uuid,text)'::regprocedure);
 needle:='where component=p_component and target_id=case p_component when''PSP_FEE''then a.funding_source_id when''FULFILLMENT_COST''then cf.redemption_id end;';
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_SHARE_VERSION_SOURCE_CHANGED';end if;
 definition:=replace(definition,needle,replace(needle,'end;','end order by version desc limit 1;'));
 needle:='source:=private.credit_economic_cost_source_v1(r.component,r.target_id,r.financial_journal_id);';
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_SHARE_SOURCE_CHANGED';end if;
 replacement:=$patch$
 if r.evidence_mode='ZERO_COST_DOCUMENT'then
  source:=private.credit_economic_zero_cost_source_v1(r.component,r.target_id,r.document_upload_id);
  if r.net_cost_minor<>0 or r.source_hash<>private.canonical_request_hash(source)or not exists(select 1 from public.credit_economic_cost_decisions_v1 decision join public.credit_economic_cost_proposals_v1 proposal on proposal.id=decision.proposal_id where proposal.id=r.proposal_id and proposal.evidence_mode='ZERO_COST_DOCUMENT'and proposal.document_upload_id=r.document_upload_id and decision.approved and decision.source_hash=r.source_hash and proposal.source_hash=r.source_hash)then raise exception'CREDIT_ECONOMIC_COST_SOURCE_CHANGED'using errcode='55000';end if;
  return jsonb_build_object('reconciliation_id',r.id,'source_hash',r.source_hash,'allocation_hash',a.content_hash,'component',p_component,'amount_minor','0','evidence_mode','ZERO_COST_DOCUMENT','document_upload_id',r.document_upload_id,'rounding','PROVEN_DOCUMENT_ZERO_NO_JOURNAL','financial_journal_id',null);
 end if;
 $patch$;
 execute replace(definition,needle,replacement||needle);

 definition:=pg_get_functiondef('public.reconcile_credit_economic_profit_v1(uuid,date,date,text,text)'::regprocedure);
 needle:='where allocation_id=a.id and credit_economic_cost_attributions_v1.component=cost_kind;';
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_ATTRIBUTION_VERSION_SOURCE_CHANGED';end if;
 definition:=replace(definition,needle,replace(needle,';',' order by version desc limit 1;'));
 needle:=$needle$   if old.allocation_id is not null then
    if old.source_hash<>h or old.amount_minor<>amount then raise exception'CREDIT_ECONOMIC_COST_ATTRIBUTION_CHANGED'using errcode='55000';end if;
    continue;
   end if;$needle$;
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_ATTRIBUTION_REPLAY_SOURCE_CHANGED';end if;
 replacement:=$patch$
   if old.allocation_id is not null then
    if old.source_hash=h and old.amount_minor=amount then continue;end if;
    if old.amount_minor<>0 or amount<>0 or not exists(select 1 from public.credit_economic_cost_reconciliations_v1 old_source where old_source.id=old.reconciliation_id and old_source.evidence_mode='ZERO_COST_DOCUMENT')or share->>'evidence_mode'is distinct from'ZERO_COST_DOCUMENT'then raise exception'CREDIT_ECONOMIC_COST_ATTRIBUTION_CHANGED'using errcode='55000';end if;
   end if;
 $patch$;
 definition:=replace(definition,needle,replacement);
 needle:='insert into public.credit_economic_cost_attributions_v1(allocation_id,component,reconciliation_id,amount_minor,pnl_entry_id,source_snapshot,source_hash)';
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_ATTRIBUTION_INSERT_SOURCE_CHANGED';end if;
 definition:=replace(definition,needle,replace(needle,'source_hash)','source_hash,version)'));
 needle:='values(a.id,cost_kind,(share->>''reconciliation_id'')::uuid,amount,pnl,share,h);';
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_ATTRIBUTION_VALUES_SOURCE_CHANGED';end if;
 execute replace(definition,needle,'values(a.id,cost_kind,(share->>''reconciliation_id'')::uuid,amount,pnl,share,h,coalesce(old.version,0)+1);');

 definition:=pg_get_functiondef('private.assert_credit_economic_profit_close_ready_v1(uuid,date,date)'::regprocedure);
 needle:='where t.allocation_id=a.id and t.component=cost_kind;';
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_READY_VERSION_SOURCE_CHANGED';end if;
 execute replace(definition,needle,replace(needle,';',' order by t.version desc limit 1;'));

 definition:=pg_get_functiondef('public.get_credit_economic_profit_context_v1(uuid,date,date,integer)'::regprocedure);
 needle:='t.component=''PSP_FEE'')psp_fee_minor';
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_CONTEXT_PSP_SOURCE_CHANGED';end if;
 definition:=replace(definition,needle,'t.component=''PSP_FEE''order by t.version desc limit 1)psp_fee_minor');
 needle:='t.component=''FULFILLMENT_COST'')fulfillment_cost_minor';
 if strpos(definition,needle)=0 then raise exception'ZERO_COST_CONTEXT_FULFILLMENT_SOURCE_CHANGED';end if;
 execute replace(definition,needle,'t.component=''FULFILLMENT_COST''order by t.version desc limit 1)fulfillment_cost_minor');
end $migration$;

-- Revocation is a source writer, so it participates in the existing coherent
-- close/payout snapshot. Cutoffs include the zero-evidence attribution ledger.
do $migration$
declare signature text;definition text;needle text;extra text;
begin
 foreach signature in array array['public.close_franchise_profit_period(uuid,date,date,uuid,timestamp with time zone,text,text,uuid)','private.assert_native_franchise_payout_ready_v1(uuid)']loop
  definition:=pg_get_functiondef(signature::regprocedure);
  needle:='private.verified_payment_dispatch_inbox_v1';
  if strpos(definition,needle)=0 then raise exception'ZERO_COST_REVOCATION_LOCK_SOURCE_CHANGED';end if;
  definition:=replace(definition,needle,needle||',public.finance_cost_document_revocations_v1');
  if signature like'public.%'then
   needle:='perform private.assert_credit_economic_profit_close_ready_v1(b.id,p_period_start,p_period_end);';
   if strpos(definition,needle)=0 then raise exception'ZERO_COST_CUTOFF_SOURCE_CHANGED';end if;
   extra:=$patch$
 if exists(select 1 from public.credit_economic_cost_attributions_v1 attributed join public.credit_economic_allocations_v1 alloc on alloc.id=attributed.allocation_id join private.credit_economic_pnl_sources_v1 source on source.allocation_id=alloc.id join public.franchise_pnl_entries entry on entry.id=source.pnl_entry_id where alloc.book_id=b.id and entry.effective_on between p_period_start and p_period_end and attributed.created_at>p_entry_cutoff_at)then raise exception'CREDIT_ECONOMIC_CUTOFF_EXCLUDES_RECONCILED_SOURCE'using errcode='55000';end if;
 $patch$;
   definition:=replace(definition,needle,needle||extra);
  end if;
  execute definition;
 end loop;
end $migration$;

create function public.get_finance_cost_documents_v1(p_component text,p_target_id uuid,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare docs jsonb;proposals jsonb;has_more boolean;
begin
 if private.credit_revenue_finance_access_v1()is distinct from true then raise exception'FINANCE_COST_DOCUMENT_READ_DENIED'using errcode='42501';end if;
 if p_component is null or p_component not in('PSP_FEE','FULFILLMENT_COST')or p_target_id is null or p_page is null or p_page not between 1 and 10000 then raise exception'INVALID_FINANCE_COST_DOCUMENT_PAGE'using errcode='22023';end if;
 if(p_component='PSP_FEE'and not exists(select 1 from public.credit_economic_funding_sources_v1 where id=p_target_id))or(p_component='FULFILLMENT_COST'and not exists(select 1 from public.benefit_redemptions where id=p_target_id))then raise exception'FINANCE_COST_DOCUMENT_SCOPE_REQUIRED'using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(scoped)),'[]')into docs from(select u.id upload_id,u.file_name,u.sha256,u.mime_type,u.size_bytes,u.status,u.scan_status,u.created_by,exists(select 1 from public.finance_cost_document_revocations_v1 r where r.upload_id=u.id)revoked from public.finance_cost_document_uploads_v1 u where u.component=p_component and u.target_id=p_target_id order by u.created_at desc,u.id offset((p_page-1)*20)limit 20)scoped;
 select coalesce(jsonb_agg(to_jsonb(scoped)),'[]')into proposals from(select p.id,p.component,p.target_id,p.source_hash,p.currency,case when decision.approved then'APPROVED'when decision.approved=false then'REJECTED'else'PENDING'end status,
  (private.credit_revenue_finance_access_v1(auth.uid(),true)is true and decision.proposal_id is null and p.created_by<>auth.uid()and u.created_by<>auth.uid()and private.is_active_org_member(u.organization_id,auth.uid())is false
   and p.source_snapshot#>>'{target,receipt,operator_user_id}'is distinct from auth.uid()::text and p.source_snapshot#>>'{target,receipt,accepted_by}'is distinct from auth.uid()::text
   and u.scan_status='CLEAN'and not exists(select 1 from public.finance_cost_document_revocations_v1 r where r.upload_id=u.id))can_decide,
  jsonb_build_object('upload_id',u.id,'file_name',u.file_name,'sha256',u.sha256,'mime_type',u.mime_type,'size_bytes',u.size_bytes)proof
  from public.credit_economic_cost_proposals_v1 p join public.finance_cost_document_uploads_v1 u on u.id=p.document_upload_id left join public.credit_economic_cost_decisions_v1 decision on decision.proposal_id=p.id
  where p.evidence_mode='ZERO_COST_DOCUMENT'and p.component=p_component and p.target_id=p_target_id order by p.created_at desc,p.id offset((p_page-1)*20)limit 20)scoped;
 has_more:=exists(select 1 from public.finance_cost_document_uploads_v1 u where u.component=p_component and u.target_id=p_target_id order by u.created_at desc,u.id offset(p_page*20)limit 1)or exists(select 1 from public.credit_economic_cost_proposals_v1 p where p.evidence_mode='ZERO_COST_DOCUMENT'and p.component=p_component and p.target_id=p_target_id order by p.created_at desc,p.id offset(p_page*20)limit 1);
 return jsonb_build_object('documents',docs,'proposals',proposals,'page',p_page,'page_size',20,'has_more',has_more);
end$$;
revoke all on function public.propose_credit_economic_zero_cost_v1(text,uuid,uuid,text,text),public.decide_credit_economic_cost_v1(uuid,text,boolean,text),public.get_finance_cost_documents_v1(text,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.propose_credit_economic_zero_cost_v1(text,uuid,uuid,text,text),public.decide_credit_economic_cost_v1(uuid,text,boolean,text),public.get_finance_cost_documents_v1(text,uuid,integer)to authenticated;
notify pgrst,'reload schema';
commit;
