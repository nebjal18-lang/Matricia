-- Gold §16.9: descriptive native facts, never a presumption of fault.
-- No numeric favoritism threshold is supplied by the approved specification.
begin;
create table public.franchise_governance_signal_snapshots_v1(
 id uuid primary key default extensions.gen_random_uuid(),report_id uuid not null unique references public.franchise_control_reports_v1(id),
 franchise_id uuid not null references public.franchises(id),period_start date not null,period_end date not null,
 summary jsonb not null,methodology_version text not null check(methodology_version='NATIVE_GOVERNANCE_SIGNALS_V1'),
 source_evidence_hash text not null check(source_evidence_hash~'^[a-f0-9]{64}$'),collected_at timestamptz not null default clock_timestamp()
);
create table private.franchise_governance_signal_sources_v1(
 snapshot_id uuid not null references public.franchise_governance_signal_snapshots_v1(id),kind text not null,
 source_id text not null,evidence jsonb not null,evidence_hash text not null,
 primary key(snapshot_id,kind,source_id),check(kind in('PANEL_INVITATION','PREVIOUS_PANEL_INVITATION','MISSION','MATCHING_RUN','PANEL_PROPOSAL','QUALIFICATION_DECISION','CATALOG_REVIEW','CONFLICT_DISCLOSURE','REASSIGNMENT'))
);
create table private.franchise_governance_review_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),snapshot_id uuid not null references public.franchise_governance_signal_snapshots_v1(id),
 franchise_id uuid not null references public.franchises(id),origin text not null check(origin in('SYSTEM_FACT','MEMBER_REQUEST')),
 reason text not null,requested_by uuid references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table private.franchise_governance_review_proposals_v1(
 id uuid primary key default extensions.gen_random_uuid(),request_id uuid not null references private.franchise_governance_review_requests_v1(id),
 outcome text not null check(outcome in('OBSERVATION_ONLY','FURTHER_REVIEW_REQUIRED')),reason text not null check(length(btrim(reason))between 10 and 4000),
 evidence_hash text not null,proposed_by uuid not null references auth.users(id),proposed_at timestamptz not null default clock_timestamp()
);
create table private.franchise_governance_review_approvals_v1(
 proposal_id uuid primary key references private.franchise_governance_review_proposals_v1(id),decision text not null check(decision in('APPROVE','REJECT')),
 reason text not null check(length(btrim(reason))between 10 and 4000),decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp()
);
create index franchise_governance_signals_timeline_v1 on public.franchise_governance_signal_snapshots_v1(franchise_id,collected_at desc,id);
create index franchise_governance_requests_snapshot_v1 on private.franchise_governance_review_requests_v1(snapshot_id,id);
revoke all on private.franchise_governance_signal_sources_v1,private.franchise_governance_review_requests_v1,private.franchise_governance_review_proposals_v1,private.franchise_governance_review_approvals_v1 from public,anon,authenticated,service_role;
alter table public.franchise_governance_signal_snapshots_v1 enable row level security;
revoke all on public.franchise_governance_signal_snapshots_v1 from public,anon,authenticated,service_role;
grant select on public.franchise_governance_signal_snapshots_v1 to authenticated;
create policy franchise_governance_signal_summary_read on public.franchise_governance_signal_snapshots_v1 for select to authenticated using(private.franchise_native_control_read_access_v1(franchise_id));
create trigger franchise_governance_signal_snapshot_immutable before update or delete on public.franchise_governance_signal_snapshots_v1 for each row execute function private.prevent_franchise_history_change();
do $$declare t text;begin foreach t in array array['franchise_governance_signal_sources_v1','franchise_governance_review_requests_v1','franchise_governance_review_proposals_v1','franchise_governance_review_approvals_v1']loop execute format('create trigger %I before update or delete on private.%I for each row execute function private.prevent_franchise_history_change()',t||'_immutable',t);end loop;end$$;

create function private.franchise_governance_independent_reviewer_v1(p_franchise_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid()is not null and coalesce(auth.jwt()->>'aal','')='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and not exists(select 1 from public.organization_memberships m join public.franchises f on f.operator_organization_id=m.organization_id where f.id=p_franchise_id and m.user_id=auth.uid()and m.status='ACTIVE')
$$;
create function private.franchise_governance_admin_v1()returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid()is not null and coalesce(auth.jwt()->>'aal','')='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])
$$;
revoke all on function private.franchise_governance_independent_reviewer_v1(uuid),private.franchise_governance_admin_v1()from public,anon,authenticated,service_role;

create function private.lock_franchise_governance_authority_v1(p_franchise_id uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$declare org uuid;begin
 select operator_organization_id into org from public.franchises where id=p_franchise_id for share;
 perform 1 from public.platform_user_roles where user_id=auth.uid()for share;
 perform 1 from public.organization_memberships where organization_id=org and user_id=auth.uid()order by id for share;
 perform 1 from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.organization_id=org and m.user_id=auth.uid()order by r.role_code for share of r;
 perform 1 from public.organization_member_franchise_assignments a join public.organization_memberships m on m.id=a.membership_id where a.franchise_id=p_franchise_id and m.user_id=auth.uid()order by a.role_code for share of a;
end$$;
revoke all on function private.lock_franchise_governance_authority_v1(uuid)from public,anon,authenticated,service_role;

create function private.queue_franchise_governance_review_v1(p_snapshot_id uuid,p_origin text,p_reason text,p_actor uuid)returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare s public.franchise_governance_signal_snapshots_v1%rowtype;f public.franchises%rowtype;rid uuid;queue_id uuid;corr uuid:=extensions.gen_random_uuid();
begin
 select id into queue_id from public.admin_queue_versions where queue_key='RISK_FLAGS'and status='ACTIVE'for share;
 if queue_id is null then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_QUEUE_NOT_CONFIGURED'using errcode='55000';end if;
 select *into strict s from public.franchise_governance_signal_snapshots_v1 where id=p_snapshot_id;
 select *into strict f from public.franchises where id=s.franchise_id;
 insert into private.franchise_governance_review_requests_v1(snapshot_id,franchise_id,origin,reason,requested_by)values(s.id,s.franchise_id,p_origin,p_reason,p_actor)returning id into rid;
 -- The author reference is the originating mandate configuration author for a
 -- system task; the audit and metadata explicitly record the actual SYSTEM actor.
 insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)
 select id,f.operator_organization_id,'MANUAL_REVIEW','franchise_governance_signal_review',rid::text,'Examiner les faits de gouvernance de la franchise','فحص وقائع حكامة الامتياز','MEDIUM',clock_timestamp()+make_interval(mins=>sla_minutes),
 jsonb_build_object('request_id',rid,'snapshot_id',s.id,'source_hash',s.source_evidence_hash,'actor_origin',case when p_actor is null then'SYSTEM'else'USER'end,'no_fault_asserted',true,'review_path','gouvernance-franchise/signalements/'||rid::text),coalesce(p_actor,f.created_by)
 from public.admin_queue_versions where id=queue_id;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,p_actor,case when p_actor is null then'SYSTEM'else'USER'end,'franchise.governance.review_requested','franchise_governance_review',rid::text,corr,jsonb_build_object('snapshotId',s.id,'sourceHash',s.source_evidence_hash,'noFaultAsserted',true),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.operator_organization_id,'franchise_governance_review',rid::text,'MATRICIA_REVIEW_REQUIRED',corr,jsonb_build_object('requestId',rid,'franchiseId',f.id,'noFaultAsserted',true),'franchise-governance-review:'||rid::text);
 return rid;
end$$;

create function private.capture_franchise_governance_signals_v1(p_report_id uuid)returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare r public.franchise_control_reports_v1%rowtype;f public.franchises%rowtype;x uuid;start_at timestamptz;end_at timestamptz;previous_start timestamptz;facts jsonb;source_batch jsonb;public_facts jsonb;manifest text;disclosures integer;chronology integer;mission_count integer;distinct_providers integer;largest integer;proposal_count integer;matching_count integer;recomputed integer;panel_distinct integer;previous_panel integer;panel_count integer;qualification_min numeric;catalog_min numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended('franchise-governance-signals:'||p_report_id::text,0));
 select id into x from public.franchise_governance_signal_snapshots_v1 where report_id=p_report_id;if found then return x;end if;
 select *into strict r from public.franchise_control_reports_v1 where id=p_report_id;select *into strict f from public.franchises where id=r.franchise_id;
 start_at:=r.period_start::timestamp at time zone 'Africa/Casablanca';end_at:=(r.period_end+1)::timestamp at time zone 'Africa/Casablanca';previous_start:=(r.period_start-(r.period_end-r.period_start+1))::timestamp at time zone 'Africa/Casablanca';
 x:=extensions.gen_random_uuid();facts:='[]'::jsonb;
 -- Source facts are materialized once locally; parent and immutable rows then
 -- insert in FK order, including transactions with immediate constraints. Read APIs never expose
 -- these identities, declared conflicts or reviewer details to ordinary members.
 select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb)into source_batch from(
 select 'MISSION' as kind,m.id::text as source_id,jsonb_build_object('missionId',m.id,'providerOrganizationId',m.provider_organization_id,'contractVersionId',m.contract_version_id,'requestId',req.id,'status',m.status,'createdAt',m.created_at) as evidence,private.canonical_request_hash(to_jsonb(m)) as evidence_hash from public.missions m join public.contract_versions cv on cv.id=m.contract_version_id join public.quote_versions qv on qv.id=cv.selected_quote_version_id join public.rfqs q on q.id=qv.rfq_id join public.service_requests req on req.id=q.request_id where req.library_id=f.library_id and m.created_at>=start_at and m.created_at<end_at)source_rows;
 facts:=facts||source_batch;
 select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb)into source_batch from(
 select 'MATCHING_RUN' as kind,m.id::text as source_id,jsonb_build_object('matchingRunId',m.id,'requestId',m.request_id,'startedBy',m.started_by,'startedAt',m.started_at,'policyVersion',m.policy_version,'status',m.status) as evidence,private.canonical_request_hash(to_jsonb(m)) as evidence_hash from public.matching_runs m join public.service_requests req on req.id=m.request_id where req.library_id=f.library_id and m.started_at>=start_at and m.started_at<end_at)source_rows;
 facts:=facts||source_batch;
 select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb)into source_batch from(
 select 'PANEL_PROPOSAL' as kind,p.id::text as source_id,jsonb_build_object('proposalId',p.id,'requestId',p.request_id,'matchingRunId',p.matching_run_id,'providerIds',p.provider_ids,'createdBy',p.created_by,'createdAt',p.created_at,'actionRequestId',p.action_request_id,'authorizationReason',a.reason,'authorizationStatus',a.status) as evidence,private.canonical_request_hash(to_jsonb(p)||jsonb_build_object('authorization',to_jsonb(a))) as evidence_hash from public.admin_consultation_proposals_v1 p join public.service_requests req on req.id=p.request_id join public.admin_operational_action_requests a on a.id=p.action_request_id where req.library_id=f.library_id and p.created_at>=start_at and p.created_at<end_at)source_rows;
 facts:=facts||source_batch;
 select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb)into source_batch from(
 select 'QUALIFICATION_DECISION' as kind,d.id::text as source_id,jsonb_build_object('decisionId',d.id,'providerOrganizationId',d.provider_organization_id,'serviceId',d.service_id,'decidedBy',d.decided_by,'decidedAt',d.decided_at,'requestedAt',requested.occurred_at,'requestAuditId',requested.id,'status',d.status,'blockingConditionCount',jsonb_array_length(d.blocking_conditions)) as evidence,private.canonical_request_hash(to_jsonb(d)||jsonb_build_object('requestAudit',to_jsonb(requested))) as evidence_hash from public.provider_qualification_decisions d join public.provider_qualifications qualification on qualification.id=d.qualification_id join public.provider_services p on p.id=qualification.provider_service_id left join lateral(select a.id,a.occurred_at,a.event_hash from public.audit_events a where a.action='provider.service.requested'and a.resource_type='provider_service'and a.resource_id=p.id::text and a.organization_id=d.provider_organization_id and a.occurred_at<=d.decided_at order by a.occurred_at desc,a.id desc limit 1)requested on true join public.catalog_services svc on svc.id=d.service_id where svc.library_id=f.library_id and d.decided_at>=start_at and d.decided_at<end_at)source_rows;
 facts:=facts||source_batch;
 select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb)into source_batch from(
 select 'CATALOG_REVIEW' as kind,c.id::text as source_id,jsonb_build_object('reviewId',c.id,'targetType',c.target_type,'targetId',c.target_id,'requestedBy',c.requested_by,'reviewedBy',c.reviewed_by,'requestedAt',c.requested_at,'reviewedAt',c.reviewed_at,'status',c.status) as evidence,private.canonical_request_hash(to_jsonb(c)) as evidence_hash from public.catalog_change_requests c where c.library_id=f.library_id and c.reviewed_at>=start_at and c.reviewed_at<end_at)source_rows;
 facts:=facts||source_batch;
 select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb)into source_batch from(
 select 'CONFLICT_DISCLOSURE' as kind,c.id::text as source_id,jsonb_build_object('disclosureId',c.id,'subjectType',c.subject_type,'subjectId',c.subject_id,'decision',c.decision,'reason',c.reason,'declaredBy',c.declared_by,'declaredAt',c.declared_at) as evidence,private.canonical_request_hash(to_jsonb(c)) as evidence_hash from public.franchise_conflict_disclosures c where c.franchise_id=f.id and c.declared_at>=start_at and c.declared_at<end_at)source_rows;
 facts:=facts||source_batch;
 select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb)into source_batch from(
 select 'REASSIGNMENT' as kind,rr.id::text as source_id,jsonb_build_object('reassignmentId',rr.id,'sourceMissionId',rr.source_mission_id,'replacementMissionId',rr.replacement_mission_id,'proposedProviderOrganizationId',rr.proposed_provider_organization_id,'status',rr.status,'createdAt',rr.created_at) as evidence,private.canonical_request_hash(to_jsonb(rr)) as evidence_hash from public.mission_reassignments rr join public.missions m on m.id=rr.source_mission_id join public.contract_versions cv on cv.id=m.contract_version_id join public.quote_versions qv on qv.id=cv.selected_quote_version_id join public.rfqs q on q.id=qv.rfq_id join public.service_requests req on req.id=q.request_id where req.library_id=f.library_id and rr.created_at>=start_at and rr.created_at<end_at)source_rows;
 facts:=facts||source_batch;
 select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb)into source_batch from(
 select case when p.invited_at>=start_at then'PANEL_INVITATION'else'PREVIOUS_PANEL_INVITATION'end as kind,p.id::text as source_id,jsonb_build_object('invitationId',p.id,'providerOrganizationId',p.provider_organization_id,'requestId',req.id,'invitedAt',p.invited_at) as evidence,private.canonical_request_hash(to_jsonb(p)) as evidence_hash from public.rfq_providers p join public.rfqs q on q.id=p.rfq_id join public.service_requests req on req.id=q.request_id where req.library_id=f.library_id and p.invited_at>=previous_start and p.invited_at<end_at)source_rows;
 facts:=facts||source_batch;
 select count(*),count(distinct evidence->>'providerOrganizationId')into mission_count,distinct_providers from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='MISSION'and evidence->>'status'<>'CANCELLED';
 select max(n)into largest from(select count(*)n from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='MISSION'and evidence->>'status'<>'CANCELLED'group by evidence->>'providerOrganizationId')a;
 select count(*)into matching_count from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='MATCHING_RUN';
 select count(*)into recomputed from(select evidence->>'requestId'from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='MATCHING_RUN'group by evidence->>'requestId'having count(*)>1)a;
 select count(*)into proposal_count from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='PANEL_PROPOSAL';
 select count(distinct evidence->>'providerOrganizationId'),count(*)into panel_distinct,panel_count from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='PANEL_INVITATION';
 select case when count(*)=0 then null else count(distinct evidence->>'providerOrganizationId')::integer end into previous_panel from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='PREVIOUS_PANEL_INVITATION';
 select min(extract(epoch from((evidence->>'decidedAt')::timestamptz-(evidence->>'requestedAt')::timestamptz)))into qualification_min from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='QUALIFICATION_DECISION'and evidence->>'requestedAt'is not null;
 select min(extract(epoch from((evidence->>'reviewedAt')::timestamptz-(evidence->>'requestedAt')::timestamptz)))into catalog_min from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='CATALOG_REVIEW';
 select count(*)into disclosures from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where kind='CONFLICT_DISCLOSURE'and evidence->>'decision'in('CONFLICT_DECLARED','RECUSED');
 select count(*)into chronology from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text)where((kind='CATALOG_REVIEW'and(evidence->>'reviewedAt')::timestamptz<(evidence->>'requestedAt')::timestamptz)or(kind='QUALIFICATION_DECISION'and(evidence->>'decidedAt')::timestamptz<(evidence->>'requestedAt')::timestamptz));
 public_facts:=jsonb_build_object('missionCount',mission_count,'assignedProviderCount',distinct_providers,'largestProviderShareBps',case when mission_count>0 then trunc(largest::numeric*10000/mission_count)::integer end,'matchingRunCount',matching_count,'requestsWithSeveralRuns',recomputed,'governedPanelProposalCount',proposal_count,'panelInvitationCount',panel_count,'panelDistinctProviders',case when panel_count>0 then panel_distinct end,'previousPanelDistinctProviders',previous_panel,'panelDiversityDelta',case when previous_panel is not null and panel_count>0 then panel_distinct-previous_panel end,'qualificationShortestSeconds',qualification_min,'catalogReviewShortestSeconds',catalog_min,'scope','MANDATED_LIBRARY_AGGREGATE_NO_TERRITORY_ATTRIBUTION','libraryId',f.library_id,'mandateVersionId',f.current_mandate_version_id,'thresholdConfiguration','APPROVED_THRESHOLDS_NOT_PROVIDED','riskVerdict',null,'noFaultAsserted',true);
 select private.canonical_request_hash(coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',source_id,'hash',evidence_hash)order by kind,source_id),'[]'))into manifest from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text);
 insert into public.franchise_governance_signal_snapshots_v1(id,report_id,franchise_id,period_start,period_end,summary,methodology_version,source_evidence_hash)values(x,r.id,f.id,r.period_start,r.period_end,public_facts,'NATIVE_GOVERNANCE_SIGNALS_V1',manifest);
 insert into private.franchise_governance_signal_sources_v1(snapshot_id,kind,source_id,evidence,evidence_hash)select x,kind,source_id,evidence,evidence_hash from jsonb_to_recordset(facts)as frozen(kind text,source_id text,evidence jsonb,evidence_hash text);
 if disclosures>0 or chronology>0 then perform private.queue_franchise_governance_review_v1(x,'SYSTEM_FACT','DECLARED_OR_CHRONOLOGICAL_FACT_REQUIRES_HUMAN_REVIEW',null);end if;
 return x;
end$$;

create function private.capture_franchise_governance_report_trigger_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin perform private.capture_franchise_governance_signals_v1(new.id);return new;end$$;
create trigger franchise_control_report_governance_capture after insert on public.franchise_control_reports_v1 for each row execute function private.capture_franchise_governance_report_trigger_v1();
-- Existing reports are captured through the same bounded scheduled command on
-- its next cycle; creation time is never backdated to their reporting interval.
create or replace function public.run_franchise_performance_control_v1(p_limit integer default 25)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare f record;d date:=(statement_timestamp()at time zone 'Africa/Casablanca')::date;n integer:=0;failed integer:=0;start_month date:=date_trunc('month',(statement_timestamp()at time zone 'Africa/Casablanca'))::date;start_quarter date:=date_trunc('quarter',(statement_timestamp()at time zone 'Africa/Casablanca'))::date;report_id uuid;
begin
 if auth.role()<>'service_role'then raise exception 'FRANCHISE_CONTROL_SCHEDULER_ONLY'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'FRANCHISE_CONTROL_LIMIT_INVALID'using errcode='22023';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('franchise-performance-control-scheduler-v1',0))then return jsonb_build_object('outcome','FRANCHISE_CONTROL_BUSY','processed',0,'failed',0);end if;
 for f in select x.id from public.franchises x where x.status='ACTIVE'and(
 not exists(select 1 from public.franchise_control_reports_v1 r where r.franchise_id=x.id and r.kind='DAILY'and r.period_end=d-1)
 or exists(select 1 from public.franchise_control_reports_v1 r where r.franchise_id=x.id and((r.kind='DAILY'and r.period_end=d-1)or(r.kind='MONTHLY'and r.period_end=start_month-1)or(r.kind='QUARTERLY'and r.period_end=start_quarter-1))and not exists(select 1 from public.franchise_governance_signal_snapshots_v1 s where s.report_id=r.id)))order by x.id limit p_limit loop
  begin
   report_id:=private.generate_franchise_control_report_v1(f.id,'DAILY',d-1,d-1);perform private.capture_franchise_governance_signals_v1(report_id);
   report_id:=private.generate_franchise_control_report_v1(f.id,'MONTHLY',(start_month-interval'1 month')::date,start_month-1);perform private.capture_franchise_governance_signals_v1(report_id);
   report_id:=private.generate_franchise_control_report_v1(f.id,'QUARTERLY',(start_quarter-interval'3 months')::date,start_quarter-1);perform private.capture_franchise_governance_signals_v1(report_id);
   n:=n+1;
  exception when others then failed:=failed+1;
   insert into public.audit_events(actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values('SYSTEM','franchise.control.report_failed','franchise',f.id::text,extensions.gen_random_uuid(),jsonb_build_object('errorCategory',sqlstate),repeat('0',64));
  end;
 end loop;
 return jsonb_build_object('outcome','FRANCHISE_CONTROL_COMPLETED','processed',n,'failed',failed);
end$$;

create function public.get_franchise_governance_signals_v1(p_franchise_id uuid,p_report_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare s public.franchise_governance_signal_snapshots_v1%rowtype;benchmark jsonb;is_admin boolean:=private.franchise_governance_admin_v1();
begin
 if not private.franchise_native_control_read_access_v1(p_franchise_id)then raise exception 'FRANCHISE_GOVERNANCE_SIGNALS_READ_DENIED'using errcode='42501';end if;
 select *into s from public.franchise_governance_signal_snapshots_v1 where franchise_id=p_franchise_id and(p_report_id is null or report_id=p_report_id)order by period_end desc,collected_at desc,id limit 1;
 if not found then return jsonb_build_object('status','NOT_AVAILABLE','franchiseId',p_franchise_id);end if;
 if is_admin then
  select case when count(distinct peers.franchise_id)>=5 then jsonb_build_object('status','AVAILABLE','cohortSize',count(distinct peers.franchise_id),'medianLargestShareBps',percentile_disc(0.5)within group(order by(peers.summary->>'largestProviderShareBps')::integer))else jsonb_build_object('status','INSUFFICIENT_COHORT','minimumSize',5)end into benchmark
  from public.franchise_governance_signal_snapshots_v1 peers join public.franchise_control_reports_v1 pr on pr.id=peers.report_id join public.franchise_control_reports_v1 own on own.id=s.report_id
  where peers.franchise_id<>s.franchise_id and peers.methodology_version=s.methodology_version and pr.kind=own.kind and pr.model_id=own.model_id and peers.period_start=s.period_start and peers.period_end=s.period_end and peers.summary->>'largestProviderShareBps'is not null;
 else benchmark:=jsonb_build_object('status','ADMIN_ONLY');end if;
 return jsonb_build_object('status','AVAILABLE','franchiseId',p_franchise_id,'snapshot',to_jsonb(s),'benchmark',benchmark,
 'capabilities',jsonb_build_object('canRequestReview',coalesce(auth.jwt()->>'aal','')='aal2'and(private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or is_admin),'canInspect',is_admin,'requestRestriction',case when not(private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN']))then'ROLE_REQUIRED'when coalesce(auth.jwt()->>'aal','')<>'aal2' then'MFA_REQUIRED'end),
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'createdAt',q.created_at,'status',case when exists(select 1 from private.franchise_governance_review_proposals_v1 p join private.franchise_governance_review_approvals_v1 a on a.proposal_id=p.id where p.request_id=q.id and a.decision='APPROVE')then'HUMAN_REVIEW_RECORDED'else'MATRICIA_REVIEW_REQUIRED'end))from(select *from private.franchise_governance_review_requests_v1 where snapshot_id=s.id order by created_at desc,id desc limit 25)q),'[]'),'reviewCount',(select count(*)from private.franchise_governance_review_requests_v1 where snapshot_id=s.id));
end$$;

create function public.request_franchise_governance_review_v1(p_snapshot_id uuid,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();s public.franchise_governance_signal_snapshots_v1%rowtype;org uuid;h text;result jsonb;request_id uuid;
begin
 select *into s from public.franchise_governance_signal_snapshots_v1 where id=p_snapshot_id;
 if a is null or not found or not private.franchise_native_control_read_access_v1(s.franchise_id)or not(private.has_franchise_role(s.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN']))then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_REQUEST_DENIED'using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_MFA_REQUIRED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_REASON_REQUIRED'using errcode='22023';end if;
 perform private.lock_franchise_governance_authority_v1(s.franchise_id);
 if not private.franchise_native_control_read_access_v1(s.franchise_id)or not(private.has_franchise_role(s.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or private.franchise_governance_admin_v1())then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_REQUEST_DENIED'using errcode='42501';end if;
 select operator_organization_id into org from public.franchises where id=s.franchise_id;
 h:=private.canonical_request_hash(jsonb_build_object('snapshot',s.id,'sourceHash',s.source_evidence_hash,'reason',p_reason));result:=private.begin_contract_command(org,'franchise.governance.review.request.v1',p_idempotency_key,h,a);if result is not null then return result;end if;
 request_id:=private.queue_franchise_governance_review_v1(s.id,'MEMBER_REQUEST',p_reason,a);
 result:=jsonb_build_object('outcome','MATRICIA_REVIEW_REQUIRED','requestId',request_id);perform private.finish_contract_command(org,'franchise.governance.review.request.v1',p_idempotency_key,result);return result;
end$$;

create function public.inspect_franchise_governance_review_v1(p_request_id uuid,p_source_kind text,p_after_source_id text,p_limit integer,p_purpose text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare q private.franchise_governance_review_requests_v1%rowtype;rows jsonb;next_id text;
begin
 if auth.uid()is null then raise exception 'UNAUTHENTICATED'using errcode='28000';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2'then raise exception 'FRANCHISE_GOVERNANCE_INSPECTION_MFA_REQUIRED'using errcode='42501';end if;
 if not private.franchise_governance_admin_v1()then raise exception 'FRANCHISE_GOVERNANCE_INSPECTION_ADMIN_REQUIRED'using errcode='42501';end if;
 if length(btrim(coalesce(p_purpose,'')))not between 10 and 1000 or p_limit is null or p_limit not between 1 and 50 or p_source_kind is null or p_source_kind not in('PANEL_INVITATION','PREVIOUS_PANEL_INVITATION','MISSION','MATCHING_RUN','PANEL_PROPOSAL','QUALIFICATION_DECISION','CATALOG_REVIEW','CONFLICT_DISCLOSURE','REASSIGNMENT')or length(coalesce(p_after_source_id,''))>200 then raise exception 'FRANCHISE_GOVERNANCE_INSPECTION_INVALID'using errcode='22023';end if;
 select *into q from private.franchise_governance_review_requests_v1 where id=p_request_id;if not found then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_NOT_FOUND'using errcode='P0002';end if;
 select coalesce(jsonb_agg(jsonb_build_object('sourceId',r.source_id,'evidence',r.evidence,'evidenceHash',r.evidence_hash)order by r.source_id),'[]'),case when count(*)=p_limit then max(r.source_id)end into rows,next_id from(select *from private.franchise_governance_signal_sources_v1 where snapshot_id=q.snapshot_id and kind=p_source_kind and(p_after_source_id is null or source_id>p_after_source_id)order by source_id limit p_limit)r;
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(auth.uid(),'USER','franchise.governance.sources_inspected','franchise_governance_review',q.id::text,extensions.gen_random_uuid(),jsonb_build_object('purpose',p_purpose,'sourceKind',p_source_kind,'returned',jsonb_array_length(rows)),repeat('0',64));
 return jsonb_build_object('request',to_jsonb(q),'snapshot',(select to_jsonb(s)from public.franchise_governance_signal_snapshots_v1 s where s.id=q.snapshot_id),'sources',rows,'nextAfter',next_id,
 'canPropose',private.franchise_governance_independent_reviewer_v1(q.franchise_id)and q.requested_by is distinct from auth.uid()and not exists(select 1 from private.franchise_governance_review_proposals_v1 existing left join private.franchise_governance_review_approvals_v1 ap on ap.proposal_id=existing.id where existing.request_id=q.id and(ap.proposal_id is null or ap.decision='APPROVE')),
 'proposals',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('approval',(select to_jsonb(a)from private.franchise_governance_review_approvals_v1 a where a.proposal_id=p.id),'canApprove',private.franchise_governance_independent_reviewer_v1(q.franchise_id)and q.requested_by is distinct from auth.uid()and p.proposed_by<>auth.uid()and not exists(select 1 from private.franchise_governance_review_approvals_v1 ap where ap.proposal_id=p.id)))from private.franchise_governance_review_proposals_v1 p where p.request_id=q.id),'[]'));
end$$;

create function public.propose_franchise_governance_review_v1(p_request_id uuid,p_outcome text,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();q private.franchise_governance_review_requests_v1%rowtype;s public.franchise_governance_signal_snapshots_v1%rowtype;org uuid;h text;r jsonb;proposal_id uuid;
begin
 select *into q from private.franchise_governance_review_requests_v1 where id=p_request_id for update;
 if a is null then raise exception 'UNAUTHENTICATED'using errcode='28000';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2'then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_MFA_REQUIRED'using errcode='42501';end if;
 if not found or not private.franchise_governance_independent_reviewer_v1(q.franchise_id)or q.requested_by=a then raise exception 'FRANCHISE_GOVERNANCE_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 perform private.lock_franchise_governance_authority_v1(q.franchise_id);
 if not private.franchise_governance_independent_reviewer_v1(q.franchise_id)or q.requested_by=a then raise exception 'FRANCHISE_GOVERNANCE_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 if p_outcome is null or p_outcome not in('OBSERVATION_ONLY','FURTHER_REVIEW_REQUIRED')or length(btrim(coalesce(p_reason,'')))not between 10 and 4000 then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_INVALID'using errcode='22023';end if;
 select *into strict s from public.franchise_governance_signal_snapshots_v1 where id=q.snapshot_id;select operator_organization_id into org from public.franchises where id=q.franchise_id;
 h:=private.canonical_request_hash(jsonb_build_object('request',q.id,'outcome',p_outcome,'reason',p_reason,'sourceHash',s.source_evidence_hash));r:=private.begin_contract_command(org,'franchise.governance.review.propose.v1',p_idempotency_key,h,a);if r is not null then return r;end if;
 if exists(select 1 from private.franchise_governance_review_proposals_v1 p left join private.franchise_governance_review_approvals_v1 ap on ap.proposal_id=p.id where p.request_id=q.id and(ap.proposal_id is null or ap.decision='APPROVE'))then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_PENDING_OR_COMPLETED'using errcode='55000';end if;
 insert into private.franchise_governance_review_proposals_v1(request_id,outcome,reason,evidence_hash,proposed_by)values(q.id,p_outcome,p_reason,s.source_evidence_hash,a)returning id into proposal_id;
 r:=jsonb_build_object('outcome','FRANCHISE_GOVERNANCE_REVIEW_PROPOSED','proposalId',proposal_id,'requestId',q.id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,a,'USER','franchise.governance.review_proposed','franchise_governance_review',q.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'franchise_governance_review',q.id::text,'FranchiseGovernanceReviewProposedV1',extensions.gen_random_uuid(),r,'franchise-governance-proposal:'||proposal_id::text);
 perform private.finish_contract_command(org,'franchise.governance.review.propose.v1',p_idempotency_key,r);return r;
end$$;

create function private.guard_franchise_governance_review_resolution_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.resource_type='franchise_governance_signal_review'and new.status in('RESOLVED','DISMISSED')and not exists(select 1 from private.franchise_governance_review_proposals_v1 p join private.franchise_governance_review_approvals_v1 a on a.proposal_id=p.id where p.request_id::text=new.resource_id and a.decision='APPROVE')then raise exception 'FRANCHISE_GOVERNANCE_FOUR_EYES_REVIEW_REQUIRED'using errcode='42501';end if;return new;
end$$;
create trigger native_franchise_governance_review_resolution before update of status on public.admin_work_items for each row execute function private.guard_franchise_governance_review_resolution_v1();

create function public.approve_franchise_governance_review_v1(p_proposal_id uuid,p_decision text,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p private.franchise_governance_review_proposals_v1%rowtype;q private.franchise_governance_review_requests_v1%rowtype;org uuid;h text;r jsonb;w public.admin_work_items%rowtype;claim jsonb;key_hash text;
begin
 select *into p from private.franchise_governance_review_proposals_v1 where id=p_proposal_id;select *into q from private.franchise_governance_review_requests_v1 where id=p.request_id for update;
 if a is null then raise exception 'UNAUTHENTICATED'using errcode='28000';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2'then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_MFA_REQUIRED'using errcode='42501';end if;
 if p.id is null or not private.franchise_governance_independent_reviewer_v1(q.franchise_id)or a=p.proposed_by or a=q.requested_by then raise exception 'FRANCHISE_GOVERNANCE_SECOND_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 perform private.lock_franchise_governance_authority_v1(q.franchise_id);
 if not private.franchise_governance_independent_reviewer_v1(q.franchise_id)or a=p.proposed_by or a=q.requested_by then raise exception 'FRANCHISE_GOVERNANCE_SECOND_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 if p_decision is null or p_decision not in('APPROVE','REJECT')or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_INVALID'using errcode='22023';end if;
 select operator_organization_id into org from public.franchises where id=q.franchise_id;
 h:=private.canonical_request_hash(jsonb_build_object('proposal',p.id,'decision',p_decision,'reason',p_reason,'sourceHash',p.evidence_hash));r:=private.begin_contract_command(org,'franchise.governance.review.approve.v1',p_idempotency_key,h,a);if r is not null then return r;end if;
 if exists(select 1 from private.franchise_governance_review_approvals_v1 where proposal_id=p.id)then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_ALREADY_DECIDED'using errcode='55000';end if;
 insert into private.franchise_governance_review_approvals_v1(proposal_id,decision,reason,decided_by)values(p.id,p_decision,p_reason,a);
 if p_decision='APPROVE'then
  select *into w from public.admin_work_items where resource_type='franchise_governance_signal_review'and resource_id=q.id::text and status in('OPEN','CLAIMED','WAITING_INFORMATION')order by created_at limit 1 for update;
  if found then
   key_hash:=private.canonical_request_hash(jsonb_build_object('key',p_idempotency_key));
   if w.status='OPEN'then claim:=public.claim_admin_work_item(w.id,w.row_version,'Prise en charge de la revue indépendante','governance-claim:'||key_hash);w.row_version:=(claim->>'row_version')::integer;end if;
   perform public.resolve_admin_work_item(w.id,'GOVERNANCE_REVIEW_RECORDED',p_reason,jsonb_build_object('proposalId',p.id,'sourceHash',p.evidence_hash,'noSanctionApplied',true),w.row_version,'governance-resolve:'||key_hash);
  end if;
 end if;
 r:=jsonb_build_object('outcome','FRANCHISE_GOVERNANCE_REVIEW_DECIDED','proposalId',p.id,'decision',p_decision,'requestId',q.id,'noSanctionApplied',true);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,a,'USER','franchise.governance.review_decided','franchise_governance_review',q.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'franchise_governance_review',q.id::text,'FranchiseGovernanceReviewDecidedV1',extensions.gen_random_uuid(),r,'franchise-governance-decision:'||p.id::text);
 perform private.finish_contract_command(org,'franchise.governance.review.approve.v1',p_idempotency_key,r);return r;
end$$;

revoke all on function private.queue_franchise_governance_review_v1(uuid,text,text,uuid),private.capture_franchise_governance_signals_v1(uuid),private.capture_franchise_governance_report_trigger_v1(),private.guard_franchise_governance_review_resolution_v1()from public,anon,authenticated,service_role;
revoke all on function public.get_franchise_governance_signals_v1(uuid,uuid),public.request_franchise_governance_review_v1(uuid,text,text),public.inspect_franchise_governance_review_v1(uuid,text,text,integer,text),public.propose_franchise_governance_review_v1(uuid,text,text,text),public.approve_franchise_governance_review_v1(uuid,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.get_franchise_governance_signals_v1(uuid,uuid),public.request_franchise_governance_review_v1(uuid,text,text),public.inspect_franchise_governance_review_v1(uuid,text,text,integer,text),public.propose_franchise_governance_review_v1(uuid,text,text,text),public.approve_franchise_governance_review_v1(uuid,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
