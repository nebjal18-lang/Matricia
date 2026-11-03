-- Native diagnostic candidate, additive after 45430.
begin;
create or replace function private.generate_franchise_control_report_v1(p_franchise_id uuid,p_kind text,p_start date,p_end date)returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;m public.franchise_control_model_versions_v1%rowtype;metrics jsonb;axis jsonb;gid uuid;prev uuid;gscore integer;complete boolean;cmp jsonb;v_objectives jsonb;corr uuid:=extensions.gen_random_uuid();owner_id uuid;
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
 select coalesce(jsonb_agg(jsonb_build_object('axis',a.key,'observedScoreBps',a.value,'targetScoreBps',m.warning_below_bps,'completionCriterion','REMEASURE_NATIVE_SOURCE_AT_OR_ABOVE_TARGET')),'[]')into v_objectives from jsonb_each(axis)a where a.value<>'null'::jsonb and(a.value::text)::integer<m.corrective_below_bps;
 if jsonb_array_length(v_objectives)>0 and not exists(
  select 1 from public.franchise_control_plan_proposals_v1 p join public.franchise_control_reports_v1 prior on prior.id=p.report_id
  where p.franchise_id=f.id and prior.model_id=m.id and p.due_on>=(statement_timestamp()at time zone 'Africa/Casablanca')::date
  and not exists(select 1 from public.franchise_control_plan_events_v1 e where e.plan_id=p.id and e.kind in('REJECTED','COMPLETED'))
  and not exists(select 1 from jsonb_array_elements(v_objectives)n where not exists(select 1 from jsonb_array_elements(p.objectives)o where o->>'axis'=n->>'axis'and(o->>'targetScoreBps')::integer>=(n->>'targetScoreBps')::integer))
 )then
  select mem.user_id into owner_id from public.organization_memberships mem join public.organization_member_roles r on r.membership_id=mem.id where mem.organization_id=f.operator_organization_id and mem.status='ACTIVE'and r.role_code in('FRANCHISE_OWNER','FRANCHISE_MANAGER')and r.revoked_at is null and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],mem.user_id)order by case when r.role_code='FRANCHISE_OWNER'then 0 else 1 end,mem.id limit 1;
  insert into public.franchise_control_plan_proposals_v1(report_id,franchise_id,objectives,suggested_owner_user_id,due_on)values(gid,f.id,v_objectives,owner_id,(statement_timestamp()at time zone 'Africa/Casablanca')::date+m.plan_days);
 end if;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,'SYSTEM','franchise.control.report_generated','franchise_control_report',gid::text,corr,jsonb_build_object('kind',p_kind,'complete',complete,'model',m.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.operator_organization_id,'franchise',f.id::text,'FranchiseControlReportGeneratedV1',corr,jsonb_build_object('reportId',gid,'franchiseId',f.id,'kind',p_kind,'completeness',case when complete then'COMPLETE'else'PARTIAL'end),'franchise-control-report:'||gid::text);
 return gid;
end$$;



notify pgrst,'reload schema';
commit;
