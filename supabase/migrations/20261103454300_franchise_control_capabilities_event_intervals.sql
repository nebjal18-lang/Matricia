-- Additive: UI decision capability matches independent authority and event counts use their actual event date.
begin;
create or replace function public.list_franchise_native_control_v1(p_franchise_id uuid,p_before timestamptz default null,p_limit integer default 20,p_before_id uuid default null,p_event_plan_id uuid default null,p_after_event_id bigint default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if auth.uid()is null or not private.franchise_native_control_read_access_v1(p_franchise_id)then raise exception 'FRANCHISE_CONTROL_READ_DENIED'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 or ((p_before is null)<>(p_before_id is null))or ((p_event_plan_id is null)<>(p_after_event_id is null))or p_after_event_id<0 then raise exception 'FRANCHISE_CONTROL_LIMIT_INVALID'using errcode='22023';end if;
 if p_event_plan_id is not null and not exists(select 1 from public.franchise_control_plan_proposals_v1 where id=p_event_plan_id and franchise_id=p_franchise_id)then raise exception 'FRANCHISE_CONTROL_PLAN_DENIED'using errcode='42501';end if;
 select jsonb_build_object('franchiseId',p_franchise_id,'reports',coalesce(jsonb_agg(to_jsonb(r)order by r.generated_at desc,r.id),'[]'),'nextCursor',case when count(*)=p_limit then(select jsonb_build_object('before',last.generated_at,'id',last.id)from public.franchise_control_reports_v1 last where last.franchise_id=p_franchise_id and(p_before is null or(last.generated_at,last.id)<(p_before,p_before_id))order by last.generated_at desc,last.id desc offset p_limit-1 limit 1)end)into result from(select *from public.franchise_control_reports_v1 where franchise_id=p_franchise_id and(p_before is null or(generated_at,id)<(p_before,p_before_id))order by generated_at desc,id desc limit p_limit)r;
 return result||jsonb_build_object('capabilities',jsonb_build_object('canWrite',private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and coalesce(auth.jwt()->>'aal','')='aal2'),'canDecide',private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and coalesce(auth.jwt()->>'aal','')='aal2'and not exists(select 1 from public.organization_memberships mem join public.franchises f on f.operator_organization_id=mem.organization_id where f.id=p_franchise_id and mem.user_id=auth.uid()and mem.status='ACTIVE')),'plans',private.franchise_control_plan_page_v1(p_franchise_id,coalesce((select array_agg((j->>'id')::uuid)from jsonb_array_elements(result->'reports')j),'{}'::uuid[]),p_event_plan_id,coalesce(p_after_event_id,0)));
end$$;


create or replace function private.collect_franchise_control_metrics_v1(p_franchise_id uuid,p_start date,p_end date,p_freshness_days integer default 365)returns jsonb
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
 'entryFeeApplicable',f.franchise_type<>'IT','entryFeeDueMinor',(select coalesce(sum(e.amount_minor),0)::text from public.franchise_entry_fee_ledger_entries e join public.franchise_entry_fee_schedules s on s.id=e.schedule_id join books b on b.id=s.book_id where s.due_on<=(statement_timestamp()at time zone 'Africa/Casablanca')::date),
 'entryFeeScheduleCount',(select count(*)from public.franchise_entry_fee_schedules s join books b on b.id=s.book_id),
 'financialBooks',(select count(*)from books),'contractualMandate',coalesce(f.activation_mode='CONTRACTUAL',false),'mandateEffective',exists(select 1 from public.franchise_mandate_versions m where m.id=f.current_mandate_version_id and m.franchise_id=f.id and m.mandate_status='ACTIVE'and m.effective_from<=statement_timestamp()and(m.effective_until is null or m.effective_until>statement_timestamp())),
 'openCorrectivePlans',(select count(*)from public.franchise_corrective_plan_versions p where p.franchise_id=f.id and p.status in('PROPOSED','APPROVED','ACTIVE')),
 'prospects',(select count(*)from public.franchise_crm_prospects p where p.franchise_id=f.id and p.created_at>=start_at and p.created_at<end_at),
 'verifiedProspects',(select count(*)from public.franchise_crm_prospects p where p.franchise_id=f.id and p.created_at>=start_at and p.created_at<end_at and p.pipeline_stage in('VERIFIED','DIAGNOSTIC_STARTED','OPPORTUNITY_CREATED','RFQ_STARTED','CONTRACT_SIGNED')),
 'diagnostics',(select count(*)from public.diagnostic_runs d where d.library_id=f.library_id and d.completed_at>=start_at and d.completed_at<end_at)
 )into r;
 if to_regclass('public.franchise_network_invitations')is null then inv:=jsonb_build_object('available',false);
 else execute $q$select jsonb_build_object('available',true,'sent',count(*)filter(where delivery_mode='EXTERNAL'and sent_at>=$2 and sent_at<$3),'opened',count(*)filter(where delivery_mode='EXTERNAL'and opened_at>=$2 and opened_at<$3),'registered',count(*)filter(where delivery_mode='EXTERNAL'and registered_at>=$2 and registered_at<$3),'queued',count(*)filter(where status='QUEUED'and expires_at>statement_timestamp()and created_at>=$2 and created_at<$3),'cohortSent',count(*)filter(where delivery_mode='EXTERNAL'and sent_at is not null and created_at>=$2 and created_at<$3),'cohortRegistered',count(*)filter(where delivery_mode='EXTERNAL'and registered_at is not null and created_at>=$2 and created_at<$3),'deliveredMode','EXTERNAL','pendingIncludesUnsent',true)from public.franchise_network_invitations where franchise_id=$1 and(delivery_mode is null or delivery_mode='EXTERNAL')$q$into inv using f.id,start_at,end_at;end if;
 return r||jsonb_build_object('networkInvitations',inv);
end$$;

create or replace function private.generate_franchise_control_report_v1(p_franchise_id uuid,p_kind text,p_start date,p_end date)returns uuid
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
 'CLIENT_NETWORK',case when (metrics#>>'{networkInvitations,available}')::boolean then private.franchise_control_ratio_v1((metrics#>>'{networkInvitations,cohortRegistered}')::numeric,(metrics#>>'{networkInvitations,cohortSent}')::numeric)else null end,
 'LIBRARY_QUALITY',private.franchise_control_ratio_v1((metrics->>'servicesPublished')::numeric+(metrics->>'servicesTranslated')::numeric+(metrics->>'servicesFresh')::numeric+(metrics->>'servicesWithChecklist')::numeric+(metrics->>'servicesWithQuestions')::numeric+(metrics->>'servicesWithRules')::numeric+(metrics->>'servicesTotal')::numeric-(metrics->>'servicesWithoutQualifiedProvider')::numeric,7*(metrics->>'servicesTotal')::numeric),
 'PROVIDER_NETWORK',private.franchise_control_ratio_v1((metrics->>'providerQualified')::numeric,(metrics->>'providerCandidates')::numeric),
 'DELIVERY_PERFORMANCE',private.franchise_control_ratio_v1((metrics->>'onTimeAcceptedMilestones')::numeric,(metrics->>'dueMilestones')::numeric),
 'CLIENT_SATISFACTION',private.franchise_control_ratio_v1((metrics->>'satisfactionBpsSum')::numeric,(metrics->>'feedbackCount')::numeric*10000),
 'COMPLIANCE_FINANCE',case when not(metrics->>'contractualMandate')::boolean then null when not(metrics->>'mandateEffective')::boolean then 0 when not(metrics->>'entryFeeApplicable')::boolean then 10000 when(metrics->>'entryFeeScheduleCount')::integer>0 then case when(metrics->>'entryFeeDueMinor')::numeric<=0 then 10000 else 0 end else null end);
 complete:=not exists(select 1 from jsonb_each(axis)where value='null'::jsonb);
 if complete then select trunc(sum((a.value::text)::numeric*(m.axis_weights->>a.key)::numeric)/10000)::integer into gscore from jsonb_each(axis)a;end if;
 select id into prev from public.franchise_control_reports_v1 where franchise_id=f.id and model_id=m.id and kind=p_kind and period_end<p_start order by period_end desc,generated_at desc limit 1;
 select case when count(*)>=5 then jsonb_build_object('status','AVAILABLE','cohortSize',count(*),'medianScoreBps',percentile_disc(0.5)within group(order by global_score_bps))else jsonb_build_object('status','INSUFFICIENT_COHORT','minimumSize',5)end into cmp from public.franchise_control_reports_v1 r where r.kind=p_kind and r.period_start=p_start and r.period_end=p_end and r.model_id=m.id and r.completeness='COMPLETE'and r.franchise_id<>f.id;
 insert into public.franchise_control_reports_v1(franchise_id,model_id,kind,period_start,period_end,completeness,global_score_bps,axis_scores,metrics,methodology,comparison,previous_report_id,source_evidence_hash)
 values(f.id,m.id,p_kind,p_start,p_end,case when complete then'COMPLETE'else'PARTIAL'end,gscore,axis,metrics,
 jsonb_build_object('version','NATIVE_FRANCHISE_CONTROL_V1','modelVersion',m.version,'axisWeights',m.axis_weights,'eventGrain','LIBRARY_AND_FRANCHISE_INTERVAL','inventoryGrain','CURRENT_LIBRARY_AT_COLLECTION','manualSnapshotsConsumed',false,'acquisitionScoreGrain','INVITATION_CREATED_COHORT_STATUS_AT_COLLECTION','invitationEventCountsGrain','EVENT_TIMESTAMP_IN_REPORTING_INTERVAL','collectedAt',statement_timestamp(),'timeZone','Africa/Casablanca','noAutomaticSanctions',true,'inventoryFreshnessDays',m.freshness_days,'scoreVariationBps',gscore-(select global_score_bps from public.franchise_control_reports_v1 where id=prev),'alerts',coalesce((select jsonb_agg(jsonb_build_object('axis',a.key,'scoreBps',a.value,'thresholdBps',m.warning_below_bps,'severity',case when(a.value::text)::integer<m.corrective_below_bps then'CRITICAL'else'WARNING'end))from jsonb_each(axis)a where a.value<>'null'::jsonb and(a.value::text)::integer<m.warning_below_bps),'[]'::jsonb)),cmp,prev,private.canonical_request_hash(jsonb_build_object('franchise',f.id,'start',p_start,'end',p_end,'metrics',metrics,'model',m.content_hash)))returning id into gid;
 select coalesce(jsonb_agg(jsonb_build_object('axis',a.key,'observedScoreBps',a.value,'targetScoreBps',m.warning_below_bps,'completionCriterion','REMEASURE_NATIVE_SOURCE_AT_OR_ABOVE_TARGET')),'[]')into objectives from jsonb_each(axis)a where a.value<>'null'::jsonb and(a.value::text)::integer<m.corrective_below_bps;
 if jsonb_array_length(objectives)>0 and not exists(
  select 1 from public.franchise_control_plan_proposals_v1 p join public.franchise_control_reports_v1 prior on prior.id=p.report_id
  where p.franchise_id=f.id and prior.model_id=m.id and p.due_on>=(statement_timestamp()at time zone 'Africa/Casablanca')::date
  and not exists(select 1 from public.franchise_control_plan_events_v1 e where e.plan_id=p.id and e.kind in('REJECTED','COMPLETED'))
  and not exists(select 1 from jsonb_array_elements(objectives)n where not exists(select 1 from jsonb_array_elements(p.objectives)o where o->>'axis'=n->>'axis'and(o->>'targetScoreBps')::integer>=(n->>'targetScoreBps')::integer))
 )then
  select mem.user_id into owner_id from public.organization_memberships mem join public.organization_member_roles r on r.membership_id=mem.id where mem.organization_id=f.operator_organization_id and mem.status='ACTIVE'and r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER')and r.revoked_at is null and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],mem.user_id)order by case when r.role_code='FRANCHISE_OWNER'then 0 else 1 end,mem.id limit 1;
  insert into public.franchise_control_plan_proposals_v1(report_id,franchise_id,objectives,suggested_owner_user_id,due_on)values(gid,f.id,objectives,owner_id,(statement_timestamp()at time zone 'Africa/Casablanca')::date+m.plan_days);
 end if;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,'SYSTEM','franchise.control.report_generated','franchise_control_report',gid::text,corr,jsonb_build_object('kind',p_kind,'complete',complete,'model',m.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.operator_organization_id,'franchise',f.id::text,'FranchiseControlReportGeneratedV1',corr,jsonb_build_object('reportId',gid,'franchiseId',f.id,'kind',p_kind,'completeness',case when complete then'COMPLETE'else'PARTIAL'end),'franchise-control-report:'||gid::text);
 return gid;
end$$;


notify pgrst,'reload schema';
commit;
