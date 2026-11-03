-- Native control is separate from administrator-declared, historical score snapshots.
-- Missing observations remain null. No procedure below changes franchise health/status.
create table public.franchise_control_model_versions_v1 (
 id uuid primary key default extensions.gen_random_uuid(), version integer not null unique check(version>0),
 axis_weights jsonb not null, warning_below_bps integer not null check(warning_below_bps between 0 and 10000),
 corrective_below_bps integer not null check(corrective_below_bps between 0 and warning_below_bps),
 plan_days integer not null check(plan_days between 1 and 90), freshness_days integer not null default 365 check(freshness_days between 1 and 3650), effective_from date not null,
 origin text not null check(origin in('GOLD_MASTER_DEFAULT','HUMAN_PROPOSAL')),
 proposed_by uuid references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 check((origin='GOLD_MASTER_DEFAULT')=(proposed_by is null)),
 check(jsonb_typeof(axis_weights)='object' and axis_weights ?& array['CLIENT_NETWORK','LIBRARY_QUALITY','PROVIDER_NETWORK','DELIVERY_PERFORMANCE','CLIENT_SATISFACTION','COMPLIANCE_FINANCE'])
);
create table private.franchise_control_model_command_keys_v1 (
 actor_user_id uuid not null references auth.users(id),key text not null,request_hash text not null,
 model_id uuid not null references public.franchise_control_model_versions_v1(id),primary key(actor_user_id,key)
);
revoke all on private.franchise_control_model_command_keys_v1 from public,anon,authenticated,service_role;
create table public.franchise_control_model_reviews_v1 (
 model_id uuid primary key references public.franchise_control_model_versions_v1(id),
 decision text not null check(decision in('APPROVED','REJECTED')), reason text not null check(length(btrim(reason))between 10 and 1000),
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default clock_timestamp()
);
create table public.franchise_control_reports_v1 (
 id uuid primary key default extensions.gen_random_uuid(), franchise_id uuid not null references public.franchises(id),
 model_id uuid not null references public.franchise_control_model_versions_v1(id),
 kind text not null check(kind in('DAILY','MONTHLY','QUARTERLY')), period_start date not null,period_end date not null,
 completeness text not null check(completeness in('COMPLETE','PARTIAL')), global_score_bps integer check(global_score_bps between 0 and 10000),
 axis_scores jsonb not null, metrics jsonb not null, methodology jsonb not null,
 comparison jsonb not null, previous_report_id uuid references public.franchise_control_reports_v1(id),
 source_evidence_hash text not null check(source_evidence_hash~'^[a-f0-9]{64}$'), generated_at timestamptz not null default clock_timestamp(),
 unique(franchise_id,model_id,kind,period_start,period_end),check(period_end>=period_start),
 check((completeness='COMPLETE')=(global_score_bps is not null))
);
create table public.franchise_control_plan_proposals_v1 (
 id uuid primary key default extensions.gen_random_uuid(), report_id uuid not null unique references public.franchise_control_reports_v1(id),
 franchise_id uuid not null references public.franchises(id), objectives jsonb not null check(jsonb_typeof(objectives)='array'and jsonb_array_length(objectives)>0),
 suggested_owner_user_id uuid references auth.users(id), due_on date not null,
 created_at timestamptz not null default clock_timestamp(), origin text not null default 'SYSTEM_PROPOSAL' check(origin='SYSTEM_PROPOSAL')
);
create table public.franchise_control_plan_events_v1 (
 id bigint generated always as identity primary key, plan_id uuid not null references public.franchise_control_plan_proposals_v1(id),
 kind text not null check(kind in('COMMENT','PROGRESS','APPROVED','REJECTED','COMPLETED')),
 comment text not null check(length(btrim(comment))between 3 and 2000), progress_percent integer check(progress_percent between 0 and 100),
 actor_user_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 idempotency_key text not null, unique(plan_id,actor_user_id,idempotency_key),check((kind='PROGRESS')=(progress_percent is not null))
);

create function private.validate_franchise_control_model_v1() returns trigger language plpgsql set search_path=pg_catalog as $$
declare k text;v jsonb;total integer:=0;
begin
 if (select count(*)from jsonb_object_keys(new.axis_weights))<>6 then raise exception 'FRANCHISE_CONTROL_AXIS_WEIGHTS_INVALID'using errcode='22023';end if;
 for k,v in select * from jsonb_each(new.axis_weights) loop
  if jsonb_typeof(v)<>'number' or v::text!~'^\d+$'or v::integer not between 1 and 10000 then raise exception 'FRANCHISE_CONTROL_AXIS_WEIGHTS_INVALID'using errcode='22023';end if;
  total:=total+v::integer;
 end loop;
 if total<>10000 then raise exception 'FRANCHISE_CONTROL_AXIS_WEIGHTS_INVALID'using errcode='22023';end if;
 return new;
end$$;
create trigger franchise_control_model_validate before insert on public.franchise_control_model_versions_v1 for each row execute function private.validate_franchise_control_model_v1();
insert into public.franchise_control_model_versions_v1(id,version,axis_weights,warning_below_bps,corrective_below_bps,plan_days,effective_from,origin,content_hash)
select 'f0365000-0000-4000-8000-000000000001',1,'{"CLIENT_NETWORK":2000,"LIBRARY_QUALITY":2000,"PROVIDER_NETWORK":1500,"DELIVERY_PERFORMANCE":2000,"CLIENT_SATISFACTION":1500,"COMPLIANCE_FINANCE":1000}',6000,4000,30,'2026-09-10','GOLD_MASTER_DEFAULT',
 private.canonical_request_hash(jsonb_build_object('authority','Gold Master V4 FINAL §16.7','version',1,'warning',6000,'corrective',4000,'days',30));

create function public.propose_franchise_control_model_v1(p_axis_weights jsonb,p_warning_below_bps integer,p_corrective_below_bps integer,p_plan_days integer,p_effective_from date,p_idempotency_key text,p_freshness_days integer default 365)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();h text;x uuid;v integer;existing private.franchise_control_model_command_keys_v1%rowtype;
begin
 if a is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FRANCHISE_CONTROL_ADMIN_AAL2_REQUIRED'using errcode='42501';end if;
 if p_effective_from is null or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception 'FRANCHISE_CONTROL_MODEL_INVALID'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('weights',p_axis_weights,'warning',p_warning_below_bps,'corrective',p_corrective_below_bps,'days',p_plan_days,'effective',p_effective_from,'freshnessDays',p_freshness_days,'key',p_idempotency_key,'actor',a));
 perform pg_advisory_xact_lock(hashtextextended('franchise-control-model',0));
 select * into existing from private.franchise_control_model_command_keys_v1 where actor_user_id=a and key=p_idempotency_key;
 if found then if existing.request_hash<>h then raise exception 'FRANCHISE_CONTROL_IDEMPOTENCY_CONFLICT'using errcode='23514';end if;return jsonb_build_object('outcome','FRANCHISE_CONTROL_MODEL_PROPOSED','modelId',existing.model_id);end if;
 if p_effective_from<(statement_timestamp()at time zone 'Africa/Casablanca')::date then raise exception 'FRANCHISE_CONTROL_MODEL_INVALID'using errcode='22023';end if;
 select coalesce(max(version),0)+1 into v from public.franchise_control_model_versions_v1;
 insert into public.franchise_control_model_versions_v1(version,axis_weights,warning_below_bps,corrective_below_bps,plan_days,freshness_days,effective_from,origin,proposed_by,content_hash)
 values(v,p_axis_weights,p_warning_below_bps,p_corrective_below_bps,p_plan_days,p_freshness_days,p_effective_from,'HUMAN_PROPOSAL',a,h)returning id into x;
 insert into private.franchise_control_model_command_keys_v1(actor_user_id,key,request_hash,model_id)values(a,p_idempotency_key,h,x);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(a,'USER','franchise.control.model_proposed','franchise_control_model',x::text,extensions.gen_random_uuid(),jsonb_build_object('version',v,'hash',h),repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('franchise_control_model',x::text,'FranchiseControlModelProposedV1',extensions.gen_random_uuid(),jsonb_build_object('modelId',x,'version',v,'contentHash',h),'franchise-control-model-proposed:'||x::text);
 return jsonb_build_object('outcome','FRANCHISE_CONTROL_MODEL_PROPOSED','modelId',x);
end$$;
create function public.review_franchise_control_model_v1(p_model_id uuid,p_decision text,p_reason text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();m public.franchise_control_model_versions_v1%rowtype;r public.franchise_control_model_reviews_v1%rowtype;
begin
 if a is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FRANCHISE_CONTROL_ADMIN_AAL2_REQUIRED'using errcode='42501';end if;
 select * into m from public.franchise_control_model_versions_v1 where id=p_model_id for update;
 if not found or m.proposed_by is null or m.proposed_by=a then raise exception 'FRANCHISE_CONTROL_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 select *into r from public.franchise_control_model_reviews_v1 where model_id=m.id;
 if found then if r.decision<>p_decision or r.reason<>p_reason or r.reviewed_by<>a then raise exception 'FRANCHISE_CONTROL_REVIEW_CONFLICT'using errcode='23514';end if;
 else insert into public.franchise_control_model_reviews_v1(model_id,decision,reason,reviewed_by)values(m.id,p_decision,p_reason,a);end if;
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)select a,'USER','franchise.control.model_reviewed','franchise_control_model',m.id::text,extensions.gen_random_uuid(),jsonb_build_object('decision',p_decision,'hash',m.content_hash),repeat('0',64)where r.model_id is null;
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)select 'franchise_control_model',m.id::text,'FranchiseControlModelReviewedV1',extensions.gen_random_uuid(),jsonb_build_object('modelId',m.id,'decision',p_decision),'franchise-control-model-reviewed:'||m.id::text where r.model_id is null;
 return jsonb_build_object('outcome','FRANCHISE_CONTROL_MODEL_REVIEWED','modelId',m.id);
end$$;

create function private.franchise_native_control_read_access_v1(p_franchise_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid()is not null and(private.active_franchise_messaging_scope(p_franchise_id)or(coalesce(auth.jwt()->>'aal','')='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR'])))
$$;
revoke all on function private.franchise_native_control_read_access_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function private.franchise_native_control_read_access_v1(uuid)to authenticated;

-- Inventory indicators are explicitly current at collection; event indicators
-- use the Casablanca civil reporting interval. No manual measurement is consumed.
create function private.collect_franchise_control_metrics_v1(p_franchise_id uuid,p_start date,p_end date,p_freshness_days integer default 365)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;r jsonb;inv jsonb;start_at timestamptz:=p_start::timestamp at time zone 'Africa/Casablanca';end_at timestamptz:=(p_end+1)::timestamp at time zone 'Africa/Casablanca';
begin
 select *into strict f from public.franchises where id=p_franchise_id;
 with services as(select s.*,v.name_fr,v.name_ar,v.translation_review_status,v.created_at version_created_at from public.catalog_services s left join public.catalog_service_versions v on v.id=s.current_published_version_id where s.library_id=f.library_id and s.status not in('RETIRED','ARCHIVED')),
 requests as(select *from public.service_requests s where s.library_id=f.library_id),
 rfqs as(select q.*from public.rfqs q join requests r on r.id=q.request_id),
 missions as(select m.*from public.missions m join public.contract_versions cv on cv.id=m.contract_version_id join public.quote_versions qv on qv.id=cv.selected_quote_version_id join rfqs q on q.id=qv.rfq_id),
 providers as(select p.*from public.provider_services p join services s on s.id=p.service_id where p.request_status<>'WITHDRAWN'),
 current_qualifications as(select q.*,d.status decision_status,d.expires_at,d.decided_at from public.provider_qualifications q join providers p on p.id=q.provider_service_id left join public.provider_qualification_decisions d on d.id=q.current_decision_id),
 relevant_milestones as(select ml.*from public.mission_milestones ml join missions m on m.id=ml.mission_id where not exists(select 1 from public.mission_milestone_retirements_v1 x where x.milestone_id=ml.id)),
 due_milestones as(select *from relevant_milestones where due_at>=start_at and due_at<end_at),
 feedback as(select fb.*from public.mission_provider_feedback fb join missions m on m.id=fb.mission_id where fb.submitted_at>=start_at and fb.submitted_at<end_at),
 books as(select *from public.franchise_pnl_books b where b.library_id=f.library_id and b.franchise_organization_id=f.operator_organization_id)
 select jsonb_build_object(
 'servicesTotal',(select count(*)from services),'servicesPublished',(select count(*)from services where status='PUBLISHED'and current_published_version_id is not null),
 'servicesTranslated',(select count(*)from services where length(btrim(coalesce(name_fr,'')))>0 and length(btrim(coalesce(name_ar,'')))>0 and translation_review_status='APPROVED'),
 'servicesWithoutQualifiedProvider',(select count(*)from services s where not exists(select 1 from current_qualifications q where q.service_id=s.id and q.decision_status='APPROVED'and(q.expires_at is null or q.expires_at>statement_timestamp()))),
 'servicesFresh',(select count(*)from services where version_created_at>statement_timestamp()-make_interval(days=>p_freshness_days)),
 'servicesWithChecklist',(select count(*)from services s where exists(select 1 from public.service_checklist_templates t where t.service_version_id=s.current_published_version_id and jsonb_array_length(t.items)>0)),
 'servicesWithQuestions',(select count(*)from services s where exists(select 1 from public.question_versions v join public.question_bank_questions q on q.current_published_version_id=v.id where v.source_service_id=s.id and q.status<>'ARCHIVED')),
 'servicesWithRules',(select count(*)from services s where exists(select 1 from public.question_versions v join public.questionnaire_version_questions qvq on qvq.question_version_id=v.id join public.questionnaires q on q.current_published_version_id=qvq.questionnaire_version_id join public.questionnaire_version_rules qvr on qvr.questionnaire_version_id=qvq.questionnaire_version_id where v.source_service_id=s.id and q.status<>'ARCHIVED')),
 'anomaliesWithoutRecommendation',(select count(*)from public.anomaly_definitions a where a.library_id=f.library_id and a.status='PUBLISHED'and not exists(select 1 from public.recommendation_definitions r join public.recommendation_definition_versions v on v.id=r.current_version_id where r.library_id=f.library_id and r.status='PUBLISHED'and v.anomaly_definition_id=a.id)),
 'recommendationsWithoutPublishedService',(select count(*)from public.recommendation_definitions r join public.recommendation_definition_versions v on v.id=r.current_version_id where r.library_id=f.library_id and r.status='PUBLISHED'and not exists(select 1 from services s where s.id=v.service_id and s.status='PUBLISHED')),
 'questionnairesAbandoned',(select count(*)from public.questionnaire_sessions s where s.library_id=f.library_id and not s.is_simulation and s.started_at>=start_at and s.started_at<end_at and s.status in('ABANDONED','EXPIRED')),
 'questionnairesStarted',(select count(*)from public.questionnaire_sessions s where s.library_id=f.library_id and not s.is_simulation and s.started_at>=start_at and s.started_at<end_at),
 'providerCandidates',(select count(*)from providers),'providerQualified',(select count(*)from current_qualifications q where q.decision_status='APPROVED'and(q.expires_at is null or q.expires_at>statement_timestamp())),
 'providerQualificationAverageSeconds',(select round(avg(greatest(0,extract(epoch from(q.decided_at-p.requested_at)))))from current_qualifications q join providers p on p.id=q.provider_service_id where p.requested_at is not null and q.decided_at>=start_at and q.decided_at<end_at),
 'rfqCount',(select count(*)from rfqs where opened_at>=start_at and opened_at<end_at),
 'rfqInvitations',(select count(*)from public.rfq_providers p join rfqs q on q.id=p.rfq_id where p.invited_at>=start_at and p.invited_at<end_at),
 'rfqResponses',(select count(*)from public.rfq_providers p join rfqs q on q.id=p.rfq_id where p.invited_at>=start_at and p.invited_at<end_at and p.responded_at is not null),
 'submittedQuotes',(select count(*)from public.quote_versions v join rfqs q on q.id=v.rfq_id where v.submitted_at>=start_at and v.submitted_at<end_at),
 'missionCount',(select count(*)from missions where created_at>=start_at and created_at<end_at),
 'dueMilestones',(select count(*)from due_milestones),'onTimeAcceptedMilestones',(select count(*)from due_milestones where status='ACCEPTED'and decided_at<=due_at),
 'milestoneCorrections',(select count(*)from public.mission_milestone_corrections_v1 c join relevant_milestones m on m.id=c.milestone_id where c.submitted_at>=start_at and c.submitted_at<end_at),
 'feedbackCount',(select count(*)from feedback),'satisfactionBpsSum',(select coalesce(sum(satisfaction_basis_points),0)from feedback),
 'entryFeeApplicable',f.franchise_type<>'IT','entryFeeDueMinor',(select coalesce(sum(e.amount_minor),0)::text from public.franchise_entry_fee_ledger_entries e join public.franchise_entry_fee_schedules s on s.id=e.schedule_id join books b on b.id=s.book_id),
 'entryFeeScheduleCount',(select count(*)from public.franchise_entry_fee_schedules s join books b on b.id=s.book_id),
 'financialBooks',(select count(*)from books),'contractualMandate',coalesce(f.activation_mode='CONTRACTUAL',false),'mandateEffective',exists(select 1 from public.franchise_mandate_versions m where m.id=f.current_mandate_version_id and m.franchise_id=f.id and m.mandate_status='ACTIVE'and m.effective_from<=statement_timestamp()and(m.effective_until is null or m.effective_until>statement_timestamp())),
 'openCorrectivePlans',(select count(*)from public.franchise_corrective_plan_versions p where p.franchise_id=f.id and p.status in('PROPOSED','APPROVED','ACTIVE')),
 'prospects',(select count(*)from public.franchise_crm_prospects p where p.franchise_id=f.id and p.created_at>=start_at and p.created_at<end_at),
 'verifiedProspects',(select count(*)from public.franchise_crm_prospects p where p.franchise_id=f.id and p.created_at>=start_at and p.created_at<end_at and p.pipeline_stage in('VERIFIED','DIAGNOSTIC_STARTED','OPPORTUNITY_CREATED','RFQ_STARTED','CONTRACT_SIGNED')),
 'diagnostics',(select count(*)from public.diagnostic_runs d where d.library_id=f.library_id and d.completed_at>=start_at and d.completed_at<end_at)
 )into r;
 if to_regclass('public.franchise_network_invitations')is null then inv:=jsonb_build_object('available',false);
 else execute $q$select jsonb_build_object('available',true,'sent',count(*)filter(where sent_at is not null),'opened',count(*)filter(where opened_at is not null),'registered',count(*)filter(where registered_at is not null),'queued',count(*)filter(where status='QUEUED'),'deliveryMode','EXTERNAL')from public.franchise_network_invitations where franchise_id=$1 and created_at>=$2 and created_at<$3 and delivery_mode='EXTERNAL'$q$into inv using f.id,start_at,end_at;end if;
 return r||jsonb_build_object('networkInvitations',inv);
end$$;

create function private.franchise_control_ratio_v1(p_numerator numeric,p_denominator numeric)returns integer language sql immutable set search_path=pg_catalog as $$
 select case when p_denominator>0 and p_numerator>=0 then least(10000,trunc(p_numerator*10000/p_denominator))::integer else null end
$$;

create function private.generate_franchise_control_report_v1(p_franchise_id uuid,p_kind text,p_start date,p_end date)returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;m public.franchise_control_model_versions_v1%rowtype;metrics jsonb;axis jsonb;gid uuid;prev uuid;gscore integer;complete boolean;cmp jsonb;objectives jsonb;corr uuid:=extensions.gen_random_uuid();owner_id uuid;
begin
 if p_kind not in('DAILY','MONTHLY','QUARTERLY')or p_end<p_start or p_end>=(statement_timestamp()at time zone 'Africa/Casablanca')::date then raise exception 'FRANCHISE_CONTROL_REPORT_PERIOD_INVALID'using errcode='22023';end if;
 select *into strict f from public.franchises where id=p_franchise_id and status='ACTIVE';
 select x.*into strict m from public.franchise_control_model_versions_v1 x where x.effective_from<=(statement_timestamp()at time zone 'Africa/Casablanca')::date and(x.origin='GOLD_MASTER_DEFAULT'or exists(select 1 from public.franchise_control_model_reviews_v1 r where r.model_id=x.id and r.decision='APPROVED'))order by x.version desc limit 1;
 perform pg_advisory_xact_lock(hashtextextended(p_franchise_id::text||p_kind||p_start::text||p_end::text||m.id::text,0));
 select id into gid from public.franchise_control_reports_v1 where franchise_id=f.id and model_id=m.id and kind=p_kind and period_start=p_start and period_end=p_end;
 if found then return gid;end if;
 metrics:=private.collect_franchise_control_metrics_v1(f.id,p_start,p_end,m.freshness_days);
 axis:=jsonb_build_object(
 'CLIENT_NETWORK',case when (metrics#>>'{networkInvitations,available}')::boolean then private.franchise_control_ratio_v1((metrics#>>'{networkInvitations,registered}')::numeric,(metrics#>>'{networkInvitations,sent}')::numeric)else null end,
 'LIBRARY_QUALITY',private.franchise_control_ratio_v1((metrics->>'servicesPublished')::numeric+(metrics->>'servicesTranslated')::numeric+(metrics->>'servicesFresh')::numeric+(metrics->>'servicesWithChecklist')::numeric+(metrics->>'servicesWithQuestions')::numeric+(metrics->>'servicesWithRules')::numeric+(metrics->>'servicesTotal')::numeric-(metrics->>'servicesWithoutQualifiedProvider')::numeric,7*(metrics->>'servicesTotal')::numeric),
 'PROVIDER_NETWORK',private.franchise_control_ratio_v1((metrics->>'providerQualified')::numeric,(metrics->>'providerCandidates')::numeric),
 'DELIVERY_PERFORMANCE',private.franchise_control_ratio_v1((metrics->>'onTimeAcceptedMilestones')::numeric,(metrics->>'dueMilestones')::numeric),
 'CLIENT_SATISFACTION',private.franchise_control_ratio_v1((metrics->>'satisfactionBpsSum')::numeric,(metrics->>'feedbackCount')::numeric*10000),
 'COMPLIANCE_FINANCE',case when not(metrics->>'contractualMandate')::boolean then null when not(metrics->>'mandateEffective')::boolean then 0 when not(metrics->>'entryFeeApplicable')::boolean then 10000 when(metrics->>'entryFeeScheduleCount')::integer>0 then case when(metrics->>'entryFeeDueMinor')::numeric<=0 then 10000 else 0 end else null end);
 complete:=not exists(select 1 from jsonb_each(axis)where value='null'::jsonb);
 if complete then select trunc(sum((a.value::text)::numeric*(m.axis_weights->>a.key)::numeric)/10000)::integer into gscore from jsonb_each(axis)a;end if;
 select id into prev from public.franchise_control_reports_v1 where franchise_id=f.id and kind=p_kind and period_end<p_start order by period_end desc,generated_at desc limit 1;
 select case when count(*)>=5 then jsonb_build_object('status','AVAILABLE','cohortSize',count(*),'medianScoreBps',percentile_disc(0.5)within group(order by global_score_bps))else jsonb_build_object('status','INSUFFICIENT_COHORT','minimumSize',5)end into cmp from public.franchise_control_reports_v1 r where r.kind=p_kind and r.period_start=p_start and r.period_end=p_end and r.model_id=m.id and r.completeness='COMPLETE'and r.franchise_id<>f.id;
 insert into public.franchise_control_reports_v1(franchise_id,model_id,kind,period_start,period_end,completeness,global_score_bps,axis_scores,metrics,methodology,comparison,previous_report_id,source_evidence_hash)
 values(f.id,m.id,p_kind,p_start,p_end,case when complete then'COMPLETE'else'PARTIAL'end,gscore,axis,metrics,
 jsonb_build_object('version','NATIVE_FRANCHISE_CONTROL_V1','modelVersion',m.version,'axisWeights',m.axis_weights,'eventGrain','LIBRARY_AND_FRANCHISE_INTERVAL','inventoryGrain','CURRENT_LIBRARY_AT_COLLECTION','manualSnapshotsConsumed',false,'collectedAt',statement_timestamp(),'timeZone','Africa/Casablanca','noAutomaticSanctions',true,'inventoryFreshnessDays',m.freshness_days,'scoreVariationBps',gscore-(select global_score_bps from public.franchise_control_reports_v1 where id=prev),'alerts',coalesce((select jsonb_agg(jsonb_build_object('axis',a.key,'scoreBps',a.value,'thresholdBps',m.warning_below_bps,'severity',case when(a.value::text)::integer<m.corrective_below_bps then'CRITICAL'else'WARNING'end))from jsonb_each(axis)a where a.value<>'null'::jsonb and(a.value::text)::integer<m.warning_below_bps),'[]'::jsonb)),cmp,prev,private.canonical_request_hash(jsonb_build_object('franchise',f.id,'start',p_start,'end',p_end,'metrics',metrics,'model',m.content_hash)))returning id into gid;
 select coalesce(jsonb_agg(jsonb_build_object('axis',a.key,'observedScoreBps',a.value,'targetScoreBps',m.warning_below_bps,'completionCriterion','REMEASURE_NATIVE_SOURCE_AT_OR_ABOVE_TARGET')),'[]')into objectives from jsonb_each(axis)a where a.value<>'null'::jsonb and(a.value::text)::integer<m.corrective_below_bps;
 if jsonb_array_length(objectives)>0 then
  select mem.user_id into owner_id from public.organization_memberships mem join public.organization_member_roles r on r.membership_id=mem.id where mem.organization_id=f.operator_organization_id and mem.status='ACTIVE'and r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER')and r.revoked_at is null and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],mem.user_id)order by case when r.role_code='FRANCHISE_OWNER'then 0 else 1 end,mem.id limit 1;
  insert into public.franchise_control_plan_proposals_v1(report_id,franchise_id,objectives,suggested_owner_user_id,due_on)values(gid,f.id,objectives,owner_id,(statement_timestamp()at time zone 'Africa/Casablanca')::date+m.plan_days);
 end if;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,'SYSTEM','franchise.control.report_generated','franchise_control_report',gid::text,corr,jsonb_build_object('kind',p_kind,'complete',complete,'model',m.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.operator_organization_id,'franchise',f.id::text,'FranchiseControlReportGeneratedV1',corr,jsonb_build_object('reportId',gid,'franchiseId',f.id,'kind',p_kind,'completeness',case when complete then'COMPLETE'else'PARTIAL'end),'franchise-control-report:'||gid::text);
 return gid;
end$$;

create function public.run_franchise_performance_control_v1(p_limit integer default 25)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare f record;d date:=(statement_timestamp()at time zone 'Africa/Casablanca')::date;n integer:=0;failed integer:=0;start_month date:=date_trunc('month',(statement_timestamp()at time zone 'Africa/Casablanca'))::date;start_quarter date:=date_trunc('quarter',(statement_timestamp()at time zone 'Africa/Casablanca'))::date;
begin
 if auth.role()<>'service_role' then raise exception 'FRANCHISE_CONTROL_SCHEDULER_ONLY'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'FRANCHISE_CONTROL_LIMIT_INVALID'using errcode='22023';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('franchise-performance-control-scheduler-v1',0))then return jsonb_build_object('outcome','FRANCHISE_CONTROL_BUSY','processed',0,'failed',0);end if;
 for f in select x.id from public.franchises x where x.status='ACTIVE'and not exists(select 1 from public.franchise_control_reports_v1 r where r.franchise_id=x.id and r.kind='DAILY'and r.period_end=d-1)order by x.id limit p_limit loop
  begin
   perform private.generate_franchise_control_report_v1(f.id,'DAILY',d-1,d-1);
   perform private.generate_franchise_control_report_v1(f.id,'MONTHLY',(start_month-interval'1 month')::date,start_month-1);
   perform private.generate_franchise_control_report_v1(f.id,'QUARTERLY',(start_quarter-interval'3 months')::date,start_quarter-1);
   n:=n+1;
  exception when others then failed:=failed+1;
   insert into public.audit_events(actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values('SYSTEM','franchise.control.report_failed','franchise',f.id::text,extensions.gen_random_uuid(),jsonb_build_object('errorCategory',sqlstate),repeat('0',64));
  end;
 end loop;
 return jsonb_build_object('outcome','FRANCHISE_CONTROL_COMPLETED','processed',n,'failed',failed);
end$$;

create function public.list_franchise_native_control_v1(p_franchise_id uuid,p_before timestamptz default null,p_limit integer default 20,p_before_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if auth.uid()is null or not private.franchise_native_control_read_access_v1(p_franchise_id)then raise exception 'FRANCHISE_CONTROL_READ_DENIED'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 or ((p_before is null)<>(p_before_id is null))then raise exception 'FRANCHISE_CONTROL_LIMIT_INVALID'using errcode='22023';end if;
 select jsonb_build_object('franchiseId',p_franchise_id,'reports',coalesce(jsonb_agg(to_jsonb(r)order by r.generated_at desc,r.id),'[]'),'nextCursor',case when count(*)=p_limit then(select jsonb_build_object('before',last.generated_at,'id',last.id)from public.franchise_control_reports_v1 last where last.franchise_id=p_franchise_id and(p_before is null or(last.generated_at,last.id)<(p_before,p_before_id))order by last.generated_at desc,last.id desc offset p_limit-1 limit 1)end)into result from(select *from public.franchise_control_reports_v1 where franchise_id=p_franchise_id and(p_before is null or(generated_at,id)<(p_before,p_before_id))order by generated_at desc,id desc limit p_limit)r;
 return result||jsonb_build_object('capabilities',jsonb_build_object('canWrite',private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and coalesce(auth.jwt()->>'aal','')='aal2'),'canDecide',private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and coalesce(auth.jwt()->>'aal','')='aal2'),'plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e)order by e.id)from public.franchise_control_plan_events_v1 e where e.plan_id=p.id),'[]')))from public.franchise_control_plan_proposals_v1 p where p.franchise_id=p_franchise_id),'[]'));
end$$;

create function public.record_franchise_control_plan_event_v1(p_plan_id uuid,p_kind text,p_comment text,p_progress_percent integer,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p public.franchise_control_plan_proposals_v1%rowtype;e public.franchise_control_plan_events_v1%rowtype;
begin
 select *into p from public.franchise_control_plan_proposals_v1 where id=p_plan_id;
 if a is null or not found or not private.franchise_native_control_read_access_v1(p.franchise_id)then raise exception 'FRANCHISE_CONTROL_PLAN_DENIED'using errcode='42501';end if;
 if p_kind in('APPROVED','REJECTED','COMPLETED')then
  if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FRANCHISE_CONTROL_ADMIN_AAL2_REQUIRED'using errcode='42501';end if;
 elsif p_kind in('COMMENT','PROGRESS')then
  if not(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],a)or(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)and coalesce(auth.jwt()->>'aal','')='aal2'))then raise exception 'FRANCHISE_CONTROL_PLAN_DENIED'using errcode='42501';end if;
 else raise exception 'FRANCHISE_CONTROL_PLAN_EVENT_INVALID'using errcode='22023';end if;
 if length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception 'FRANCHISE_CONTROL_PLAN_EVENT_INVALID'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.id::text,0));
 select *into e from public.franchise_control_plan_events_v1 where plan_id=p.id and actor_user_id=a and idempotency_key=p_idempotency_key;
 if found then if e.kind<>p_kind or e.comment<>p_comment or e.progress_percent is distinct from p_progress_percent then raise exception 'FRANCHISE_CONTROL_PLAN_EVENT_CONFLICT'using errcode='23514';end if;
 else
  if p_kind='APPROVED'and(p.suggested_owner_user_id is null or not private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],p.suggested_owner_user_id))then raise exception 'FRANCHISE_CONTROL_PLAN_ACTIVE_OWNER_REQUIRED'using errcode='23514';end if;
  if p_kind in('APPROVED','REJECTED')and exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind in('APPROVED','REJECTED','COMPLETED'))then raise exception 'FRANCHISE_CONTROL_PLAN_DECISION_ALREADY_RECORDED'using errcode='23514';end if;
  if p_kind in('PROGRESS','COMPLETED')and exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind in('REJECTED','COMPLETED'))then raise exception 'FRANCHISE_CONTROL_PLAN_CLOSED'using errcode='23514';end if;
  if p_kind='COMPLETED'and exists(select 1 from jsonb_array_elements(p.objectives)o where not exists(select 1 from public.franchise_control_reports_v1 r where r.franchise_id=p.franchise_id and r.generated_at>p.created_at and(r.axis_scores->>(o->>'axis'))::integer>=(o->>'targetScoreBps')::integer))then raise exception 'FRANCHISE_CONTROL_REMEASUREMENT_REQUIRED'using errcode='23514';end if;
  if p_kind='COMPLETED'and not exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind='APPROVED')then raise exception 'FRANCHISE_CONTROL_PLAN_APPROVAL_REQUIRED'using errcode='23514';end if;
  insert into public.franchise_control_plan_events_v1(plan_id,kind,comment,progress_percent,actor_user_id,idempotency_key)values(p.id,p_kind,p_comment,p_progress_percent,a,p_idempotency_key)returning *into e;
  insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(a,'USER','franchise.control.plan_event','franchise_control_plan',p.id::text,extensions.gen_random_uuid(),jsonb_build_object('eventId',e.id,'kind',e.kind),repeat('0',64));
  insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('franchise_control_plan',p.id::text,'FranchiseControlPlanEventRecordedV1',extensions.gen_random_uuid(),jsonb_build_object('planId',p.id,'eventId',e.id,'kind',e.kind),'franchise-control-plan-event:'||e.id::text);
 end if;
 return jsonb_build_object('outcome','FRANCHISE_CONTROL_PLAN_EVENT_RECORDED','eventId',e.id);
end$$;

-- All new records are append-only, API writes exclusively through bounded RPCs.
do $$declare t text;begin foreach t in array array['franchise_control_model_versions_v1','franchise_control_model_reviews_v1','franchise_control_reports_v1','franchise_control_plan_proposals_v1','franchise_control_plan_events_v1']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_franchise_history_change()',t||'_immutable',t);
 end loop;end$$;
create policy franchise_control_models_read on public.franchise_control_model_versions_v1 for select to authenticated using(origin='GOLD_MASTER_DEFAULT'or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR']));
create policy franchise_control_model_reviews_read on public.franchise_control_model_reviews_v1 for select to authenticated using(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR']));
create policy franchise_control_reports_read on public.franchise_control_reports_v1 for select to authenticated using(private.franchise_native_control_read_access_v1(franchise_id));
create policy franchise_control_plans_read on public.franchise_control_plan_proposals_v1 for select to authenticated using(private.franchise_native_control_read_access_v1(franchise_id));
create policy franchise_control_plan_events_read on public.franchise_control_plan_events_v1 for select to authenticated using(exists(select 1 from public.franchise_control_plan_proposals_v1 p where p.id=plan_id and private.franchise_native_control_read_access_v1(p.franchise_id)));
grant select on public.franchise_control_model_versions_v1,public.franchise_control_model_reviews_v1,public.franchise_control_reports_v1,public.franchise_control_plan_proposals_v1,public.franchise_control_plan_events_v1 to authenticated;
revoke all on function private.validate_franchise_control_model_v1(),private.collect_franchise_control_metrics_v1(uuid,date,date,integer),private.franchise_control_ratio_v1(numeric,numeric),private.generate_franchise_control_report_v1(uuid,text,date,date)from public,anon,authenticated,service_role;
revoke all on function public.propose_franchise_control_model_v1(jsonb,integer,integer,integer,date,text,integer),public.review_franchise_control_model_v1(uuid,text,text),public.run_franchise_performance_control_v1(integer),public.list_franchise_native_control_v1(uuid,timestamptz,integer,uuid),public.record_franchise_control_plan_event_v1(uuid,text,text,integer,text)from public,anon,authenticated,service_role;
grant execute on function public.run_franchise_performance_control_v1(integer)to service_role;
grant execute on function public.propose_franchise_control_model_v1(jsonb,integer,integer,integer,date,text,integer),public.review_franchise_control_model_v1(uuid,text,text),public.list_franchise_native_control_v1(uuid,timestamptz,integer,uuid),public.record_franchise_control_plan_event_v1(uuid,text,text,integer,text)to authenticated;
notify pgrst,'reload schema';
