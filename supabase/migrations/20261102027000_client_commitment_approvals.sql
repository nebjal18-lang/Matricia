-- Client commitments consume independently approved, exact/versioned requests.
-- Existing commands keep their authorization, financial, signature and CAS guards.
begin;

alter table public.business_approval_policy_versions
  add column execution_scope jsonb not null default '{}'::jsonb
  check(jsonb_typeof(execution_scope)='object');

create function private.guard_client_approval_scope_v1() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if old.execution_scope is distinct from new.execution_scope then
  raise exception 'IMMUTABLE_BUSINESS_APPROVAL_POLICY_CONTENT' using errcode='55000';
 end if;
 return new;
end $$;
create trigger client_approval_scope_immutable before update on public.business_approval_policy_versions
for each row execute function private.guard_client_approval_scope_v1();

create function public.propose_client_approval_policy_v1(
 p_organization_id uuid,p_resource_type text,p_minimum_approvals integer,p_required_role_codes text[],
 p_minimum_amount_minor bigint,p_currency text,p_buyer_limit_minor bigint,p_effective_from timestamptz,
 p_change_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare actor uuid:=auth.uid();key_value text;scope_value jsonb;hash_value text;cached jsonb;result jsonb;version_value integer;policy_id uuid;
begin
 if actor is null or auth.jwt()->>'aal' is distinct from 'aal2' or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor) then
  raise exception 'CLIENT_APPROVAL_POLICY_DENIED' using errcode='42501';
 end if;
 if p_resource_type not in('QUOTE_SELECTION','CONTRACT_GENERATION','COST_ALLOCATION')
 or p_minimum_approvals is null or p_minimum_approvals not between 1 and 5
 or coalesce(cardinality(p_required_role_codes),0) not between 1 and 4
 or exists(select 1 from unnest(p_required_role_codes)r where r is null or r not in('CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'))
 or p_minimum_amount_minor is null or p_minimum_amount_minor<0 or p_currency is null or p_currency!~'^[A-Z]{3}$'
 or p_buyer_limit_minor<0 or p_effective_from is null
 or length(btrim(coalesce(p_change_reason,''))) not between 10 and 1000 then
  raise exception 'INVALID_CLIENT_APPROVAL_POLICY' using errcode='22023';
 end if;
 key_value:='CLIENT_'||p_resource_type||'_'||p_currency;
 scope_value:=jsonb_build_object('currency',p_currency,'minimum_amount_minor',p_minimum_amount_minor::text,'buyer_limit_minor',p_buyer_limit_minor::text);
 hash_value:=private.canonical_request_hash(jsonb_build_object('organization',p_organization_id,'policy',key_value,'resource_type',p_resource_type,
 'minimum',p_minimum_approvals,'roles',to_jsonb(p_required_role_codes),'separation',true,'effective_from',p_effective_from,'scope',scope_value,'reason',btrim(p_change_reason)));
 cached:=private.begin_contract_command(p_organization_id,'client.approval.policy.propose',p_idempotency_key,hash_value,actor);
 if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended('business-approval-policy:'||p_organization_id::text||':'||key_value,0));
 select coalesce(max(version),0)+1 into version_value from public.business_approval_policy_versions where organization_id=p_organization_id and policy_key=key_value;
 insert into public.business_approval_policy_versions(organization_id,policy_key,resource_type,version,minimum_approvals,required_role_codes,requester_cannot_approve,effective_from,change_reason,content_hash,execution_scope,created_by)
 values(p_organization_id,key_value,p_resource_type,version_value,p_minimum_approvals,p_required_role_codes,true,p_effective_from,btrim(p_change_reason),hash_value,scope_value,actor) returning id into policy_id;
 result:=jsonb_build_object('outcome','BUSINESS_APPROVAL_POLICY_PROPOSED','policy_version_id',policy_id,'version',version_value,'content_hash',hash_value);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(p_organization_id,actor,'USER','business.approval.policy_proposed','business_approval_policy',policy_id::text,p_correlation_id,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(p_organization_id,'business_approval_policy',policy_id::text,'BusinessApprovalPolicyProposedV1',p_correlation_id,result,p_idempotency_key);
 perform private.finish_contract_command(p_organization_id,'client.approval.policy.propose',p_idempotency_key,result);
 return result;
end $$;

-- Called only by the authorized canonical commands below. Browser-supplied
-- resource/amount/hash values can never stand in for their authoritative facts.
create function private.admit_client_commitment_v1(
 p_organization_id uuid,p_resource_type text,p_resource_id text,p_amount_minor bigint,p_currency text,
 p_payload_hash text,p_idempotency_key text,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare policy public.business_approval_policy_versions%rowtype;request public.business_approval_requests%rowtype;
 ids uuid[]:='{}';request_id uuid;response jsonb;action_key text;actor uuid:=auth.uid();is_buyer boolean;
begin
 if actor is null or auth.jwt()->>'aal' is distinct from 'aal2' or not private.is_active_org_member(p_organization_id,actor) then
  raise exception 'CLIENT_COMMITMENT_APPROVAL_DENIED' using errcode='42501';
 end if;
 if p_amount_minor is null or p_amount_minor<0 or p_payload_hash is null or p_payload_hash!~'^[0-9a-f]{64}$'
 or p_currency is null or p_currency!~'^[A-Z]{3}$' or p_idempotency_key is null or length(p_idempotency_key)not between 8 and 200 then
  raise exception 'INVALID_CLIENT_COMMITMENT_APPROVAL' using errcode='22023';
 end if;
 action_key:=p_resource_type||':'||private.canonical_request_hash(to_jsonb(p_idempotency_key));
 is_buyer:=private.has_org_role(p_organization_id,array['CLIENT_BUYER'],actor) and not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor);
 perform pg_advisory_xact_lock(hashtextextended('client-commitment-approval:'||p_organization_id::text,0));
 if exists(select 1 from public.business_approval_policy_versions where organization_id=p_organization_id and resource_type=p_resource_type and status='ACTIVE'and effective_from<=clock_timestamp())
 and not exists(select 1 from public.business_approval_policy_versions where organization_id=p_organization_id and resource_type=p_resource_type and status='ACTIVE'and effective_from<=clock_timestamp()and(execution_scope='{}'::jsonb or execution_scope->>'currency'=p_currency))then raise exception'CLIENT_APPROVAL_CURRENCY_POLICY_REQUIRED'using errcode='55000';end if;
 for policy in select * from public.business_approval_policy_versions
 where organization_id=p_organization_id and resource_type=p_resource_type and status='ACTIVE' and effective_from<=clock_timestamp()
 order by id for share loop
  if policy.execution_scope<>'{}'::jsonb then
   if policy.execution_scope->>'currency' is distinct from p_currency then continue;end if;
   if p_amount_minor<(policy.execution_scope->>'minimum_amount_minor')::bigint
   and not(is_buyer and policy.execution_scope->>'buyer_limit_minor' is not null and p_amount_minor>(policy.execution_scope->>'buyer_limit_minor')::bigint)then continue;end if;
  end if;
  select * into request from public.business_approval_requests where organization_id=p_organization_id and policy_version_id=policy.id
   and resource_type=p_resource_type and resource_id=p_resource_id and payload_hash=p_payload_hash for update;
  if request.id is null then
   response:=public.request_business_approval(p_organization_id,policy.policy_key,p_resource_type,p_resource_id,p_amount_minor,p_currency,p_payload_hash,
    'client-approval:'||policy.id::text||':'||p_payload_hash,p_correlation_id);
   return jsonb_build_object('outcome','CLIENT_APPROVAL_REQUIRED','approval_request_id',response->>'approval_request_id','status','PENDING','resource_type',p_resource_type);
  end if;
  if request.requested_by is distinct from actor then raise exception'CLIENT_APPROVAL_REQUEST_ACTOR_MISMATCH'using errcode='42501';end if;
  if request.consumed_at is not null and(request.consumed_by is distinct from actor or request.consumed_action is distinct from action_key)then raise exception'CLIENT_APPROVAL_ALREADY_CONSUMED'using errcode='55000';end if;
  if request.status<>'APPROVED'then
   return jsonb_build_object('outcome','CLIENT_APPROVAL_REQUIRED','approval_request_id',request.id,'status',request.status,'resource_type',p_resource_type);
  end if;
  if request.amount_minor is distinct from p_amount_minor or request.currency is distinct from p_currency then
   raise exception 'CLIENT_APPROVAL_FACTS_MISMATCH' using errcode='55000';
  end if;
  if request.consumed_at is null then ids:=array_append(ids,request.id);end if;
 end loop;
 -- Consume only after ALL policies passed. A pending second policy cannot burn
 -- the first approval. The business operation shares this transaction/rollback.
 foreach request_id in array ids loop
  update public.business_approval_requests set consumed_at=clock_timestamp(),consumed_by=actor,consumed_action=action_key,row_version=row_version+1 where id=request_id;
  response:=jsonb_build_object('approval_request_id',request_id,'resource_type',p_resource_type,'resource_id',p_resource_id,'payload_hash',p_payload_hash);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
  values(p_organization_id,actor,'USER','business.approval.consumed','business_approval_request',request_id::text,p_correlation_id,response,repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
  values(p_organization_id,'business_approval_request',request_id::text,'BusinessApprovalConsumedV1',p_correlation_id,response,'client-approval-consumed:'||request_id::text);
 end loop;
 return jsonb_build_object('outcome','CLIENT_APPROVAL_AUTHORIZED');
end $$;

alter function public.select_quote_and_notify(uuid,uuid,text,uuid,text,uuid) rename to select_quote_and_notify_pre_client_approval_v1;
alter function public.select_quote_and_notify_pre_client_approval_v1(uuid,uuid,text,uuid,text,uuid) set schema private;
create function public.select_quote_and_notify(p_quote_id uuid,p_expected_version_id uuid,p_selection_reason text,p_comparison_snapshot_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare org uuid;version public.quote_versions%rowtype;request_version uuid;approval jsonb;
begin
 select sr.client_organization_id,sr.current_version_id into org,request_version from public.quotes q join public.rfqs r on r.id=q.rfq_id join public.service_requests sr on sr.id=r.request_id where q.id=p_quote_id;
 if auth.uid()is null or org is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(org,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'])then raise exception'QUOTE_CLIENT_SCOPE_DENIED'using errcode='42501';end if;
 select * into version from public.quote_versions where id=p_expected_version_id and quote_id=p_quote_id;
 if version.id is null then raise exception'STALE_QUOTE_VERSION'using errcode='40001';end if;
 -- Existing selection is read/replayed by the original command; no second
 -- approval can be charged for an already immutable successful decision.
 if not exists(select 1 from public.quote_selection_decisions where selected_quote_id=p_quote_id and selected_quote_version_id=p_expected_version_id)then
  approval:=private.admit_client_commitment_v1(org,'QUOTE_SELECTION',version.id::text,version.total_minor,version.currency,
   private.canonical_request_hash(jsonb_build_object('actor',auth.uid(),'quote_version',version.id,'quote_hash',version.content_hash,'request_version',request_version,'comparison_hash',(select input_hash from public.quote_comparison_snapshots where id=p_comparison_snapshot_id and client_organization_id=org),'reason',btrim(p_selection_reason))),p_idempotency_key,p_correlation_id);
  if approval->>'outcome'='CLIENT_APPROVAL_REQUIRED'then return approval;end if;
 end if;
 return private.select_quote_and_notify_pre_client_approval_v1(p_quote_id,p_expected_version_id,p_selection_reason,p_comparison_snapshot_id,p_idempotency_key,p_correlation_id);
end $$;

alter function public.generate_selected_quote_contract_v1(uuid,uuid,integer,uuid,uuid,text,text,uuid) rename to generate_selected_quote_contract_pre_client_approval_v1;
alter function public.generate_selected_quote_contract_pre_client_approval_v1(uuid,uuid,integer,uuid,uuid,text,text,uuid) set schema private;
create function public.generate_selected_quote_contract_v1(p_request_id uuid,p_quote_version_id uuid,p_expected_request_row_version integer,p_template_version_id uuid,p_commission_policy_version_id uuid,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare request public.service_requests%rowtype;version public.quote_versions%rowtype;approval jsonb;
begin
 select * into request from public.service_requests where id=p_request_id;
 if auth.uid()is null or request.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(request.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'CONTRACT_GENERATE_DENIED'using errcode='42501';end if;
 select v.* into version from public.quote_versions v join public.quotes q on q.id=v.quote_id join public.rfqs r on r.id=q.rfq_id where v.id=p_quote_version_id and r.request_id=request.id and q.selected_version_id=v.id;
 if version.id is null then raise exception'SELECTED_QUOTE_REQUIRED'using errcode='55000';end if;
 if not exists(select 1 from public.selected_quote_contract_drafts_v1 where quote_version_id=version.id)then
  approval:=private.admit_client_commitment_v1(request.client_organization_id,'CONTRACT_GENERATION',version.id::text,version.total_minor,version.currency,
   private.canonical_request_hash(jsonb_build_object('actor',auth.uid(),'request',request.id,'request_version',request.current_version_id,'expected_row_version',p_expected_request_row_version,'quote_version',version.id,'quote_hash',version.content_hash,'template',p_template_version_id,'commission',p_commission_policy_version_id,'reason',btrim(p_reason))),p_idempotency_key,p_correlation_id);
  if approval->>'outcome'='CLIENT_APPROVAL_REQUIRED'then return approval;end if;
 end if;
 return private.generate_selected_quote_contract_pre_client_approval_v1(p_request_id,p_quote_version_id,p_expected_request_row_version,p_template_version_id,p_commission_policy_version_id,p_reason,p_idempotency_key,p_correlation_id);
end $$;

alter function public.record_client_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid) rename to record_client_cost_allocation_pre_client_approval_v1;
alter function public.record_client_cost_allocation_pre_client_approval_v1(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid) set schema private;
create function public.record_client_cost_allocation(p_organization_id uuid,p_cost_center_id uuid,p_budget_id uuid,p_project_id uuid,p_allocation_type text,p_amount_minor bigint,p_reference_type text,p_reference_id uuid,p_evidence_hash text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare budget public.client_annual_budgets%rowtype;approval jsonb;
begin
 if auth.uid()is null or not private.client_budget_manage(p_organization_id)then raise exception'CLIENT_COST_ALLOCATION_DENIED'using errcode='42501';end if;
 select * into budget from public.client_annual_budgets where id=p_budget_id and organization_id=p_organization_id for update;
 if budget.id is null then raise exception'INVALID_CLIENT_COST_ALLOCATION'using errcode='22023';end if;
 if not exists(select 1 from public.client_cost_allocations where organization_id=p_organization_id and idempotency_key=p_idempotency_key)then
  approval:=private.admit_client_commitment_v1(p_organization_id,'COST_ALLOCATION',budget.id::text,p_amount_minor,budget.currency,
   private.canonical_request_hash(jsonb_build_object('actor',auth.uid(),'budget',budget.id,'budget_version',budget.current_version,'cost_center',p_cost_center_id,'project',p_project_id,'type',p_allocation_type,'amount',p_amount_minor::text,'reference_type',p_reference_type,'reference_id',p_reference_id,'evidence_hash',p_evidence_hash)),p_idempotency_key,p_correlation_id);
  if approval->>'outcome'='CLIENT_APPROVAL_REQUIRED'then return approval;end if;
 end if;
 return private.record_client_cost_allocation_pre_client_approval_v1(p_organization_id,p_cost_center_id,p_budget_id,p_project_id,p_allocation_type,p_amount_minor,p_reference_type,p_reference_id,p_evidence_hash,p_idempotency_key,p_correlation_id);
end $$;

alter function public.record_client_typed_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid) rename to record_client_typed_cost_allocation_pre_client_approval_v1;
alter function public.record_client_typed_cost_allocation_pre_client_approval_v1(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid) set schema private;
create function public.record_client_typed_cost_allocation(p_organization_id uuid,p_cost_center_id uuid,p_budget_id uuid,p_project_id uuid,p_allocation_type text,p_amount_minor bigint,p_reference_type text,p_reference_id uuid,p_evidence_hash text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare budget public.client_annual_budgets%rowtype;approval jsonb;
begin
 if auth.uid()is null or not private.client_budget_manage(p_organization_id)then raise exception'CLIENT_COST_ALLOCATION_DENIED'using errcode='42501';end if;
 select * into budget from public.client_annual_budgets where id=p_budget_id and organization_id=p_organization_id for update;
 if budget.id is null then raise exception'INVALID_CLIENT_COST_ALLOCATION'using errcode='22023';end if;
 if not exists(select 1 from public.client_cost_allocations where organization_id=p_organization_id and idempotency_key=p_idempotency_key)then
  approval:=private.admit_client_commitment_v1(p_organization_id,'COST_ALLOCATION',budget.id::text,p_amount_minor,budget.currency,
   private.canonical_request_hash(jsonb_build_object('actor',auth.uid(),'budget',budget.id,'budget_version',budget.current_version,'cost_center',p_cost_center_id,'project',p_project_id,'type',p_allocation_type,'amount',p_amount_minor::text,'reference_type',p_reference_type,'reference_id',p_reference_id,'evidence_hash',p_evidence_hash)),p_idempotency_key,p_correlation_id);
  if approval->>'outcome'='CLIENT_APPROVAL_REQUIRED'then return approval;end if;
 end if;
 return private.record_client_typed_cost_allocation_pre_client_approval_v1(p_organization_id,p_cost_center_id,p_budget_id,p_project_id,p_allocation_type,p_amount_minor,p_reference_type,p_reference_id,p_evidence_hash,p_idempotency_key,p_correlation_id);
end $$;

-- Revisions retain annual consumption: approving a new budget version never
-- resets money already committed or spent under a preceding version.
do $budget_history$
declare body text;signature regprocedure;
begin
 foreach signature in array array[
 'private.record_client_cost_allocation_pre_client_approval_v1(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)'::regprocedure,
 'private.record_client_typed_cost_allocation_pre_client_approval_v1(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)'::regprocedure]loop
 body:=pg_get_functiondef(signature);
 if strpos(body,'and budget_version_id=bv.id')=0 then raise exception'CLIENT_BUDGET_HISTORY_PATCH_SOURCE_MISMATCH';end if;
 execute replace(body,'and budget_version_id=bv.id','');
 end loop;
end $budget_history$;

revoke all on function private.guard_client_approval_scope_v1(),private.admit_client_commitment_v1(uuid,text,text,bigint,text,text,text,uuid),
 private.select_quote_and_notify_pre_client_approval_v1(uuid,uuid,text,uuid,text,uuid),private.generate_selected_quote_contract_pre_client_approval_v1(uuid,uuid,integer,uuid,uuid,text,text,uuid),
 private.record_client_cost_allocation_pre_client_approval_v1(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)
,private.record_client_typed_cost_allocation_pre_client_approval_v1(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)
from public,anon,authenticated,service_role;
revoke all on function public.propose_client_approval_policy_v1(uuid,text,integer,text[],bigint,text,bigint,timestamptz,text,text,uuid),public.select_quote_and_notify(uuid,uuid,text,uuid,text,uuid),public.generate_selected_quote_contract_v1(uuid,uuid,integer,uuid,uuid,text,text,uuid),public.record_client_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid),public.record_client_typed_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)
from public,anon,authenticated,service_role;
grant execute on function public.propose_client_approval_policy_v1(uuid,text,integer,text[],bigint,text,bigint,timestamptz,text,text,uuid),public.select_quote_and_notify(uuid,uuid,text,uuid,text,uuid),public.generate_selected_quote_contract_v1(uuid,uuid,integer,uuid,uuid,text,text,uuid),public.record_client_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid),public.record_client_typed_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
