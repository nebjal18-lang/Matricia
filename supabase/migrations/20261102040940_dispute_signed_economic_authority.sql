begin;
-- No approved legal wording, amount or economic rule is seeded. The resolver
-- accepts only structured terms already approved and included in a signed version.
-- Historical signature verification retains completed evidence checks while
-- allowing the frozen version of a dispute after a later contract amendment.
do $migration$
declare definition text;needle text:='or c.status not in(''ACTIVE'',''AMENDED'')or v.version<>c.current_version';
begin
 definition:=pg_get_functiondef('private.contract_version_signature_effective_v1(uuid,uuid)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception'HISTORICAL_DISPUTE_SIGNATURE_PATCH_MISSING';end if;
 definition:=replace(definition,'private.contract_version_signature_effective_v1','private.contract_version_dispute_signature_valid_v1');
 execute replace(definition,needle,'');
end $migration$;
revoke all on function private.contract_version_dispute_signature_valid_v1(uuid,uuid)from public,anon,authenticated,service_role;
create function private.resolve_contract_dispute_economics_v1(p_version_id uuid,p_obligation_key text)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v public.contract_versions%rowtype;t public.contract_policy_versions_v1%rowtype;approval public.contract_policy_decisions_v1%rowtype;economics jsonb;terms jsonb;scope record;sealed_at timestamptz;country text;
begin
 select*into v from public.contract_versions where id=p_version_id;
 if v.id is null or coalesce(v.clauses->>'template_policy_version_id','')!~*'^[0-9a-f-]{36}$'or not exists(select 1 from public.contract_items where contract_version_id=v.id and item_key=p_obligation_key)or not private.contract_version_dispute_signature_valid_v1(v.contract_id,v.id)then return null;end if;
 select*into t from public.contract_policy_versions_v1 where id=(v.clauses->>'template_policy_version_id')::uuid and kind='TEMPLATE';
 select*into approval from public.contract_policy_decisions_v1 where policy_version_id=t.id and decision='APPROVE'and content_hash=t.content_hash and decided_by<>t.created_by;
 if t.id is null or approval.policy_version_id is null or(v.clauses-array['template_policy_version_id','template_code','template_version','template_content_hash','approval_reference'])is distinct from t.data->'clauses'or v.clauses->>'template_content_hash'is distinct from t.content_hash or v.clauses->>'template_code'is distinct from t.code or v.clauses->>'template_version'is distinct from t.version::text or v.clauses->>'approval_reference'is distinct from t.approval_reference then return null;end if;
 select min(e.completed_at)into sealed_at from public.signature_envelopes e where e.contract_id=v.contract_id and e.status='SIGNED'and((e.contract_version_id=v.id and e.amendment_id is null)or exists(select 1 from public.contract_amendments a where a.id=e.amendment_id and a.activated_contract_version_id=v.id and a.status='ACTIVE'));
 select sr.library_id,sr.service_id into scope from public.quote_versions qv join public.quotes q on q.id=qv.quote_id join public.rfqs r on r.id=q.rfq_id join public.service_requests sr on sr.id=r.request_id where qv.id=v.selected_quote_version_id;
 select legal_snapshot->>'country_code'into country from public.contract_parties where contract_version_id=v.id and party_role='CLIENT';
 if sealed_at is null or approval.decided_at>sealed_at or scope.library_id is null or t.library_id is distinct from scope.library_id or(t.service_id is not null and t.service_id is distinct from scope.service_id)or t.country_code is distinct from country or t.valid_from>(sealed_at at time zone'Africa/Casablanca')::date or(t.valid_until is not null and t.valid_until<=(sealed_at at time zone'Africa/Casablanca')::date)or exists(select 1 from public.contract_policy_versions_v1 successor join public.contract_policy_decisions_v1 approved on approved.policy_version_id=successor.id and approved.decision='APPROVE'and approved.content_hash=successor.content_hash and approved.decided_by<>successor.created_by where successor.supersedes_policy_version_id=t.id and successor.valid_from<=(sealed_at at time zone'Africa/Casablanca')::date and approved.decided_at<=sealed_at)then return null;end if;
 economics:=t.data#>'{clauses,dispute_economics_v1}';terms:=economics#>array['obligations',p_obligation_key];
 if jsonb_typeof(economics)is distinct from'object'or(economics-array['schema_version','currency','obligations'])<>'{}'::jsonb or economics->>'schema_version'is distinct from'1'or economics->>'currency'is distinct from v.currency or jsonb_typeof(economics->'obligations')is distinct from'object'or jsonb_typeof(terms)is distinct from'object'or(terms-array['penalty_minor','commission_minor','penalty_beneficiary','commission_beneficiary'])<>'{}'::jsonb or terms->>'penalty_beneficiary'is distinct from'CLIENT'or terms->>'commission_beneficiary'is distinct from'MATRICIA'or coalesce(terms->>'penalty_minor','')!~'^(0|[1-9][0-9]{0,18})$'or coalesce(terms->>'commission_minor','')!~'^(0|[1-9][0-9]{0,18})$'then return null;end if;
 if(terms->>'penalty_minor')::numeric>9223372036854775807 or(terms->>'commission_minor')::numeric>9223372036854775807 then return null;end if;
 return jsonb_build_object('economic_status','AUTHORIZED_SIGNED_TEMPLATE','contract_version_id',v.id,'contract_content_hash',v.content_hash,'template_policy_version_id',t.id,'template_content_hash',t.content_hash,'obligation_key',p_obligation_key,'currency',v.currency,'penalty_minor',terms->>'penalty_minor','commission_minor',terms->>'commission_minor','penalty_beneficiary','CLIENT','commission_beneficiary','MATRICIA','calculation','FIXED_CONTRACTUAL_AMOUNT');
exception when invalid_text_representation then return null;
end$$;
revoke all on function private.resolve_contract_dispute_economics_v1(uuid,text)from public,anon,authenticated,service_role;
create function private.provider_dispute_consequence_economic_authorized_v1(p_consequence_id uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare consequence public.dispute_financial_consequences%rowtype;dispute public.dispute_cases%rowtype;economic jsonb;expected bigint;
begin
 select*into consequence from public.dispute_financial_consequences where id=p_consequence_id and direction='ACCRUAL';
 select*into dispute from public.dispute_cases where id=consequence.dispute_case_id;
 economic:=private.resolve_contract_dispute_economics_v1(dispute.contract_version_id,dispute.obligation_key);
 if economic is null or consequence.currency is distinct from economic->>'currency'or consequence.payable_organization_id is distinct from dispute.provider_organization_id then return false;end if;
 if consequence.consequence_type='MATRICIA_COMMISSION'then expected:=(economic->>'commission_minor')::bigint;if consequence.beneficiary_organization_id is not null then return false;end if;
 elsif consequence.consequence_type='CONTRACTUAL_PENALTY'then expected:=(economic->>'penalty_minor')::bigint;if consequence.beneficiary_organization_id is distinct from dispute.client_organization_id then return false;end if;
 else return false;end if;
 return expected>0 and consequence.amount_minor=expected;
end$$;
revoke all on function private.provider_dispute_consequence_economic_authorized_v1(uuid)from public,anon,authenticated,service_role;

create or replace function public.decide_mission_dispute(p_dispute_case_id uuid,p_outcome text,p_reason text,p_evidence_ids uuid[],p_rule_snapshot jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();d public.dispute_cases%rowtype;m public.missions%rowtype;v public.contract_versions%rowtype;h text;r jsonb;dec uuid;n integer;rn integer;prior public.dispute_decisions%rowtype;pen bigint;com bigint;cur text;ra uuid;economic jsonb;economic_rule jsonb;begin
 select * into d from public.dispute_cases where id=p_dispute_case_id;if a is null or not found or auth.jwt()->>'aal'is distinct from'aal2'or private.is_active_org_member(d.client_organization_id,a)or private.is_active_org_member(d.provider_organization_id,a)or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','DISPUTE_MANAGER'],a)then raise exception 'DISPUTE_DECISION_DENIED' using errcode='42501';end if;if p_outcome not in('COMPLIANT','MINOR_CORRECTION','OUT_OF_SCOPE','CLIENT_ABUSE','MUTUAL_AGREEMENT','NON_COMPLIANT_CONFIRMED')or length(btrim(coalesce(p_reason,'')))not between 10 and 4000 or coalesce(cardinality(p_evidence_ids),0)=0 or jsonb_typeof(p_rule_snapshot)is distinct from'object'or(p_outcome<>'NON_COMPLIANT_CONFIRMED'and(not(p_rule_snapshot?&array['version','content_hash'])or coalesce(p_rule_snapshot->>'content_hash','')!~'^[0-9a-f]{64}$'))or exists(select 1 from unnest(p_evidence_ids)e where not exists(select 1 from public.dispute_evidence de where de.id=e and de.dispute_case_id=d.id))then raise exception 'INVALID_DISPUTE_DECISION' using errcode='22023';end if;
 if p_outcome='NON_COMPLIANT_CONFIRMED'then
  economic:=private.resolve_contract_dispute_economics_v1(d.contract_version_id,d.obligation_key);
  economic_rule:=coalesce(economic,jsonb_build_object('economic_status','APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED','contract_version_id',d.contract_version_id,'obligation_key',d.obligation_key));
  p_rule_snapshot:=economic_rule||jsonb_build_object('version','SIGNED_CONTRACT_ECONOMICS_V1','content_hash',private.canonical_request_hash(economic_rule));
 end if;
 h:=private.canonical_request_hash(jsonb_build_object('case',d.id,'outcome',p_outcome,'reason',p_reason,'evidence_ids',to_jsonb(p_evidence_ids),'rule',p_rule_snapshot));r:=private.begin_contract_command(d.client_organization_id,'dispute.decide.'||d.id::text,p_idempotency_key,h,a);if r is not null then return r;end if;select * into d from public.dispute_cases where id=d.id for update;if not(d.status in('MEDIATION_REVIEW','APPEALED')or(d.status='WARNING_LEVEL_1'and clock_timestamp()>d.response_due_at))then raise exception 'STALE_DISPUTE_STATE' using errcode='40001';end if;select * into prior from public.dispute_decisions where dispute_case_id=d.id order by decision_number desc limit 1;n:=coalesce(prior.decision_number,0)+1;insert into public.dispute_decisions(dispute_case_id,decision_number,outcome,reason,evidence_ids,rule_snapshot,supersedes_decision_id,decided_by)values(d.id,n,p_outcome,p_reason,p_evidence_ids,p_rule_snapshot,prior.id,a)returning id into dec;
 if p_outcome='NON_COMPLIANT_CONFIRMED'and prior.id is null then if economic is not null then
 pen:=(economic->>'penalty_minor')::bigint;com:=(economic->>'commission_minor')::bigint;cur:=economic->>'currency';
 insert into public.dispute_financial_consequences(dispute_case_id,decision_id,consequence_type,direction,amount_minor,currency,payable_organization_id,beneficiary_organization_id,rule_snapshot)
 select d.id,dec,'CONTRACTUAL_PENALTY','ACCRUAL',pen,cur,d.provider_organization_id,d.client_organization_id,p_rule_snapshot where pen>0
 union all select d.id,dec,'MATRICIA_COMMISSION','ACCRUAL',com,cur,d.provider_organization_id,null,p_rule_snapshot where com>0;
 else
 insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code,context)values(d.provider_organization_id,date_trunc('month',clock_timestamp()at time zone'Africa/Casablanca')::date-1,dec,'APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED',jsonb_build_object('dispute_case_id',d.id,'contract_version_id',d.contract_version_id,'obligation_key',d.obligation_key))on conflict do nothing;
 end if;
 select * into m from public.missions where id=d.mission_id for update;select * into v from public.contract_versions where id=d.contract_version_id;update public.missions set status='CANCELLED',row_version=row_version+1,updated_at=now()where id=m.id and status<>'CANCELLED';insert into public.provider_performance_events(provider_organization_id,mission_id,dispute_case_id,event_type,rule_snapshot)values(d.provider_organization_id,d.mission_id,d.id,'NON_COMPLIANCE_CONFIRMED',p_rule_snapshot);select coalesce(max(mr.reassignment_number),0)+1 into rn from public.mission_reassignments mr where mr.root_mission_id=d.mission_id;insert into public.mission_reassignments(root_mission_id,source_mission_id,dispute_case_id,reassignment_number,original_cost_minor,currency)values(d.mission_id,d.mission_id,d.id,rn,v.price_minor,v.currency)returning id into ra;
 elsif prior.outcome='NON_COMPLIANT_CONFIRMED'and p_outcome<>'NON_COMPLIANT_CONFIRMED'then insert into public.dispute_financial_consequences(dispute_case_id,decision_id,consequence_type,direction,amount_minor,currency,payable_organization_id,beneficiary_organization_id,rule_snapshot,reverses_consequence_id)select d.id,dec,x.consequence_type,'REVERSAL',x.amount_minor,x.currency,x.payable_organization_id,x.beneficiary_organization_id,p_rule_snapshot,x.id from public.dispute_financial_consequences x where x.dispute_case_id=d.id and x.direction='ACCRUAL';insert into public.provider_performance_events(provider_organization_id,mission_id,dispute_case_id,event_type,rule_snapshot)values(d.provider_organization_id,d.mission_id,d.id,'NON_COMPLIANCE_REVERSED',p_rule_snapshot);update public.mission_reassignments set status='CANCELLED',updated_at=clock_timestamp(),row_version=row_version+1 where dispute_case_id=d.id and status<>'ACTIVATED';update public.missions set status='ACTIVE',row_version=row_version+1,updated_at=now()where id=d.mission_id and status='CANCELLED'and not exists(select 1 from public.mission_reassignments where dispute_case_id=d.id and status='ACTIVATED');end if;
 update public.dispute_cases set status=case when d.status='APPEALED'then'CLOSED'else'DECIDED'end,appeal_due_at=case when d.status='APPEALED'then appeal_due_at else clock_timestamp()+make_interval(hours=>(policy_snapshot->>'appeal_hours')::integer)end,row_version=row_version+1 where id=d.id;insert into public.dispute_case_events(dispute_case_id,event_type,from_status,to_status,actor_user_id,correlation_id,metadata)values(d.id,'HUMAN_DECISION',d.status,case when d.status='APPEALED'then'CLOSED'else'DECIDED'end,a,p_correlation_id,jsonb_build_object('decision_id',dec,'outcome',p_outcome,'decision_number',n));r:=jsonb_build_object('outcome',p_outcome,'dispute_case_id',d.id,'decision_id',dec,'decision_number',n,'reassignment_id',ra)||case when p_outcome='NON_COMPLIANT_CONFIRMED'then jsonb_build_object('economic_status',p_rule_snapshot->>'economic_status')else '{}'::jsonb end;insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.client_organization_id,a,'USER','dispute.decided','dispute_case',d.id::text,p_correlation_id,r,repeat('0',64));insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(d.client_organization_id,'dispute_case',d.id::text,case when p_outcome='NON_COMPLIANT_CONFIRMED'then'DisputeNonComplianceConfirmedV1'else'DisputeDecisionRecordedV1'end,p_correlation_id,r,p_idempotency_key);perform private.finish_contract_command(d.client_organization_id,'dispute.decide.'||d.id::text,p_idempotency_key,r);return r;end$$;
-- The decision UI can display the exact server authority without requesting
-- money, a validation boolean or a content hash from its operator.
create function public.get_mission_dispute_economic_context_v1(p_dispute_case_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare d public.dispute_cases%rowtype;economic jsonb;
begin
 select*into d from public.dispute_cases where id=p_dispute_case_id;
 if d.id is null or auth.uid()is null or not private.dispute_financial_access(d.id,auth.uid())then raise exception'DISPUTE_ECONOMIC_CONTEXT_DENIED'using errcode='42501';end if;
 economic:=private.resolve_contract_dispute_economics_v1(d.contract_version_id,d.obligation_key);
 return jsonb_build_object('dispute_case_id',d.id,'contract_version_id',d.contract_version_id,'obligation_key',d.obligation_key,'economic_status',coalesce(economic->>'economic_status','APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED'),'rule',economic,'caller_amounts_accepted',false);
end$$;
revoke all on function public.get_mission_dispute_economic_context_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_mission_dispute_economic_context_v1(uuid)to authenticated;

-- Revalidate both new and already ingested historical consequences. A trusted
-- worker or a historical boolean/hash cannot grant contractual money authority.
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('private.ingest_provider_dispute_payables_v1(integer)'::regprocedure);
 needle:='  if x.consequence_type=';
 if strpos(definition,needle)=0 then raise exception'DISPUTE_INGEST_ECONOMIC_PATCH_MISSING';end if;
 definition:=replace(definition,needle,$patch$
  if not private.provider_dispute_consequence_economic_authorized_v1(x.id)then
   insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code,context)values(x.provider_organization_id,ending,x.id,'APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED',jsonb_build_object('dispute_case_id',x.dispute_case_id,'contract_version_id',x.contract_version_id,'amount_minor',x.amount_minor::text,'currency',x.currency))on conflict do nothing;
   continue;
  end if;
$patch$||needle);
 needle:=' return counted;';
 if strpos(definition,needle)=0 then raise exception'HISTORICAL_DISPUTE_ECONOMIC_PATCH_MISSING';end if;
 definition:=replace(definition,needle,$patch$
 insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code,context)
 select e.provider_organization_id,ending,s.consequence_id,'APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED',jsonb_build_object('payable_event_id',e.id,'contract_version_id',e.contract_version_id,'already_invoiced',exists(select 1 from public.provider_statement_lines line where line.payable_event_id=e.id))from public.provider_dispute_payable_sources_v1 s join public.provider_payable_events e on e.id=s.payable_event_id where not private.provider_dispute_consequence_economic_authorized_v1(s.consequence_id)on conflict do nothing;
$patch$||needle);execute definition;
 definition:=pg_get_functiondef('public.run_provider_billing_scheduler_v1(integer)'::regprocedure);
 needle:='where pl.period_id=period.id and not exists';
 if strpos(definition,needle)=0 then raise exception'CLOSING_ECONOMIC_AUTHORITY_PATCH_MISSING';end if;
 definition:=replace(definition,needle,'where pl.period_id=period.id and not exists(select 1 from public.provider_dispute_payable_sources_v1 economic_source where economic_source.payable_event_id=ev.id and not private.provider_dispute_consequence_economic_authorized_v1(economic_source.consequence_id))and not exists');execute definition;
end $migration$;
notify pgrst,'reload schema';
commit;
