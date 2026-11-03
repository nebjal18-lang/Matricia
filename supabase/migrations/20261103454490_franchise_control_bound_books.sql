-- Exact governed book binding prevents cross-mandate aggregation when an operator
-- holds several franchises in one library. Unbound legacy books are not attributed.
begin;
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
 books as(select *from public.franchise_pnl_books b where b.library_id=f.library_id and b.franchise_organization_id=f.operator_organization_id and exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=b.id and binding.franchise_id=f.id))
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


revoke all on function private.collect_franchise_control_metrics_v1(uuid,date,date,integer) from public,anon,authenticated,service_role;
commit;
