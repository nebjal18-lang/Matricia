import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Read back UI mutations through SQL and real foreign-tenant sessions. No fixture inserts. */
export async function verifyFunctionalControls(fixture, roleFixture, runToken) {
  const db = fixture.resources.database;
  const prefix = `E2E_${runToken.slice(0, 8).toUpperCase()}_`;
  const sites = await db`select id,organization_id,code from public.client_sites where code like ${prefix + '%'}`;
  const centers = await db`select id,organization_id,code from public.client_cost_centers where code like ${prefix + '%'}`;
  const projects = await db`select id,site_id,status,progress_basis_points from public.client_projects where project_code like ${prefix + '%'}`;
  const tasks = await db`select t.id,t.project_id,t.task_type,t.status,t.due_at,v.acceptance_criteria from public.client_project_tasks t join public.client_project_task_versions v on v.task_id=t.id and v.version=t.current_version where t.task_key like ${prefix + '%'}`;
  const calendar = await db`select e.id,e.starts_at,e.ends_at from public.client_calendar_events e join public.client_projects p on p.id=e.project_id where p.project_code like ${prefix + '%'}`;
  const allocations = await db`select a.id,a.cost_center_id,a.project_id,a.budget_id,a.allocation_type,a.amount_minor::text,a.currency,a.reference_type,a.reference_id,a.evidence_hash,p.project_code from public.client_cost_allocations a join public.client_projects p on p.id=a.project_id where p.project_code like ${prefix + '%'}`;
  const budgets = await db`select b.id,b.project_id,b.status,v.amount_minor::text,v.approved_amount_minor::text from public.client_annual_budgets b join public.client_sites s on s.id=b.site_id join public.client_annual_budget_versions v on v.budget_id=b.id and v.version=b.current_version where s.code like ${prefix + '%'}`;
  const configs = await db`select id,version,frequency,enabled,time_zone,local_send_time::text,locale from public.franchise_daily_digest_config_versions where franchise_id=${roleFixture.franchiseId}::uuid and change_reason like ${'E2E ' + runToken + ' %'} order by version`;
  assert.equal(sites.length, 4, 'FOUR_UI_SITES_REQUIRED');
  assert.equal(centers.length, 4, 'FOUR_UI_COST_CENTERS_REQUIRED');
  assert.equal(projects.length, 4, 'FOUR_UI_PROJECTS_REQUIRED');
  assert.equal(tasks.length, 4, 'FOUR_UI_MILESTONES_REQUIRED');
  assert.equal(calendar.length, 4, 'FOUR_UI_CALENDAR_EVENTS_REQUIRED');
  assert.equal(allocations.length, 4, 'FOUR_UI_ACTUAL_COST_ALLOCATIONS_REQUIRED');
  for (const allocation of allocations) {
    assert.equal(allocation.allocation_type, 'ACTUAL');
    assert.equal(allocation.amount_minor, '1005');
    assert.equal(allocation.currency, 'MAD');
    assert.equal(allocation.reference_type, 'PROJECT_TASK');
    assert.ok(tasks.some(task => task.id === allocation.reference_id && task.project_id === allocation.project_id));
    assert.ok(centers.some(center => center.id === allocation.cost_center_id && center.code === allocation.project_code));
    assert.ok(budgets.some(budget => budget.id === allocation.budget_id && budget.project_id === allocation.project_id));
    const suffix = allocation.project_code.slice(prefix.length);
    assert.match(suffix, /^(FR|AR)_[MD]$/u);
    const expectedHash = await readFile(resolve('artifacts','test-results',`p24-p26-completion-${runToken}`,`allocation-${suffix}.sha256`),'utf8');
    assert.match(expectedHash,/^[a-f0-9]{64}$/u);
    assert.equal(allocation.evidence_hash, expectedHash, 'EXACT_UPLOADED_EVIDENCE_FINGERPRINT_REQUIRED');
  }
  for (const event of calendar) {
    assert.equal(new Date(event.starts_at).toISOString(), '2024-11-01T09:00:00.000Z');
    assert.equal(new Date(event.ends_at).toISOString(), '2024-11-01T10:00:00.000Z');
  }
  for (const project of projects) {
    assert.ok(sites.some(site => site.id === project.site_id), 'PROJECT_SITE_LINK_REQUIRED');
    assert.equal(project.progress_basis_points, 10000, 'ACCEPTED_WORK_COMPLETES_PROJECT_PROGRESS');
  }
  for (const task of tasks) {
    assert.ok(projects.some(project => project.id === task.project_id), 'TASK_PROJECT_LINK_REQUIRED');
    assert.equal(task.task_type, 'MILESTONE');
    assert.equal(task.status, 'ACCEPTED');
    const versions = await db`select version from public.client_project_task_versions where task_id=${task.id}::uuid order by version`;
    assert.deepEqual(versions.map(row => row.version), [1,2,3,4], 'FOUR_SEQUENTIAL_TASK_VERSIONS_REQUIRED');

    assert.equal(new Date(task.due_at).toISOString(), '2024-11-01T09:00:00.000Z');
    assert.deepEqual(task.acceptance_criteria, [{text:'Document reçu'},{text:'Validation du responsable'}]);
  }
  const [linkedBudgets] = await db`select count(*)::integer as count from public.client_annual_budgets b join public.client_projects p on p.id=b.project_id and p.site_id=b.site_id where p.project_code like ${prefix + '%'}`;
  assert.equal(linkedBudgets.count, 4, 'FOUR_SITE_PROJECT_BUDGET_LINKS_REQUIRED');
  assert.equal(configs.length, 4, 'FOUR_UI_DIGEST_VERSIONS_REQUIRED');
  assert.equal(budgets.length, 4, 'FOUR_UI_BUDGETS_REQUIRED');
  for (const budget of budgets) {
    assert.equal(budget.status, 'APPROVED');
    assert.equal(budget.amount_minor, '9007199254740993');
    assert.equal(budget.approved_amount_minor, '9007199254740993');
  }
  for (const row of configs) {
    assert.equal(row.frequency, 'WEEKDAYS');
    assert.equal(row.enabled, false);
    assert.equal(row.time_zone, 'Africa/Casablanca');
    assert.equal(row.local_send_time, '09:15:00');
  }
  for (let index = 1; index < configs.length; index++) assert.equal(configs[index].version, configs[index - 1].version + 1);
  for (const [rows, table, action, event] of [
    [sites, 'client_sites', 'client.site.created', 'ClientSiteCreatedV1'],
    [centers, 'client_cost_centers', 'client.cost_center.created', 'ClientCostCenterCreatedV1'],
    [projects, 'client_projects', 'client.project.created', 'ClientProjectCreatedV1'],
    [calendar, 'client_calendar_events', 'client.calendar_event.scheduled', 'ClientCalendarEventScheduledV1'],
    [allocations, 'client_cost_allocations', 'client.cost.typed_allocated', 'ClientTypedCostAllocatedV1'],
    [budgets, 'client_annual_budgets', 'client.budget.saved', 'ClientAnnualBudgetApprovedV1'],
    [configs, 'franchise_daily_digest_config_versions', 'franchise.daily_digest.configured', 'FranchiseDailyDigestConfiguredV1'],
  ]) {
    for (const row of rows) {
      const proof = await db`select a.correlation_id from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.aggregate_id=a.resource_id where a.resource_id=${row.id} and a.action=${action} and e.event_type=${event}`;
      assert.equal(proof.length, 1, 'ONE_CORRELATED_AUDIT_OUTBOX_REQUIRED');
      const foreign = await fixture.sessions.clientB.client.from(table).select('id').eq('id', row.id);
      assert.equal(foreign.error, null, 'FOREIGN_READ_REQUEST_MUST_SUCCEED_WITH_EMPTY_ROWS');
      assert.deepEqual(foreign.data, [], 'FOREIGN_TENANT_READ_DENIED');
    }
  }
  for (const task of tasks) {
    const proof = await db`select a.correlation_id from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${task.id} and a.action='client.project_task.saved' and e.aggregate_id=${task.project_id} and e.event_type='ClientProjectTaskSavedV1'`;
    assert.equal(proof.length, 4, 'FOUR_TASK_CORRELATED_AUDIT_OUTBOX_REQUIRED');
    const foreign = await fixture.sessions.clientB.client.from('client_project_tasks').select('id').eq('id', task.id);
    assert.equal(foreign.error, null);
    assert.deepEqual(foreign.data, [], 'FOREIGN_TASK_READ_DENIED');
  }
  const organizationId = sites[0].organization_id;
  const preferences = await db`select id,category_code,channel,delivery_mode,digest_frequency,row_version from public.user_notification_preferences where organization_id=${organizationId}::uuid`;
  assert.equal(preferences.length, 1, 'ONE_UI_PREFERENCE_REQUIRED');
  assert.equal(preferences[0].delivery_mode, 'IMMEDIATE');
  assert.equal(preferences[0].digest_frequency, null);
  assert.equal(preferences[0].row_version, 12, 'TWELVE_UI_PREFERENCE_TRANSITIONS_REQUIRED');
  const conflictStarted = Date.now();
  const stalePreference = await fixture.sessions.clientA.client.rpc('set_notification_preference', {
    p_organization_id:organizationId,p_category_code:preferences[0].category_code,p_channel:preferences[0].channel,p_delivery_mode:'IMMEDIATE',p_digest_frequency:null,p_locale:'fr-MA',p_expected_row_version:1,p_idempotency_key:randomUUID(),
  });
  assert.equal(stalePreference.error?.code,'PT409','STALE_PREFERENCE_MUST_BE_A_BUSINESS_CONFLICT');
  assert.equal(stalePreference.status,409);
  assert.ok(Date.now()-conflictStarted<5000,'STALE_PREFERENCE_MUST_NOT_RETRY_FOREVER');
  const events = await db`select e.id from public.event_outbox e join public.audit_events a on a.correlation_id=e.correlation_id where e.organization_id=${organizationId}::uuid and e.event_type='NotificationPreferenceSavedV1'`;
  assert.equal(events.length, 12, 'TWELVE_CORRELATED_NOTIFICATION_EVENTS_REQUIRED');
  const foreign = await fixture.sessions.clientB.client.from('user_notification_preferences').select('id').eq('id', preferences[0].id);
  assert.equal(foreign.error, null);
  assert.deepEqual(foreign.data, []);
  const [mandatory] = await db`select code from public.notification_preference_categories where mandatory and status='ACTIVE' order by code limit 1`;
  assert.ok(mandatory, 'MANDATORY_CATEGORY_REQUIRED');
  const denied = await fixture.sessions.clientA.client.rpc('set_notification_preference', {
    p_organization_id: organizationId, p_category_code: mandatory.code, p_channel: 'IN_APP', p_delivery_mode: 'DISABLED', p_digest_frequency: null, p_locale: 'fr-MA', p_expected_row_version: 0, p_idempotency_key: randomUUID(),
  });
  assert.equal(denied.error?.code, '22023', 'SERVER_MUST_REJECT_DISABLED_MANDATORY_CATEGORY');
  const [protectedCount] = await db`select count(*)::integer as count from public.user_notification_preferences where organization_id=${organizationId}::uuid and category_code=${mandatory.code}`;
  assert.equal(protectedCount.count, 0, 'DENIED_PREFERENCE_MUST_NOT_PERSIST');
  const analyses = await db`select id,context_type,status,profile_reassessment_id,input_text_expires_at,created_at from public.assistance_requests where organization_id=${organizationId}::uuid`;
  assert.equal(analyses.length, 8, 'EIGHT_UI_ASSISTED_ANALYSES_REQUIRED');
  assert.equal(analyses.filter(row => row.context_type === 'NEED_TEXT').length, 4);
  assert.equal(analyses.filter(row => row.context_type === 'PROFILE_CHANGE').length, 4);
  for (const analysis of analyses) {
    assert.equal(analysis.status, 'COMPLETED');
    if (analysis.context_type === 'NEED_TEXT') assert.ok(new Date(analysis.input_text_expires_at) > new Date(analysis.created_at), 'BOUNDED_INPUT_RETENTION_REQUIRED');
    const foreign = await fixture.sessions.clientB.client.from('assistance_requests').select('id').eq('id', analysis.id);
    assert.equal(foreign.error, null);
    assert.deepEqual(foreign.data, []);
  }
  const reassessments = await db`select q.id,q.status,q.changed_keys,q.profile_version_id,v.version,v.compliance_case_id
    from public.assistance_profile_reassessments q join public.client_profile_versions v on v.id=q.profile_version_id
    where q.organization_id=${organizationId}::uuid and v.profile_data->>'activity' like ${'E2E profile ' + runToken + ' %'}`;
  assert.equal(reassessments.length, 4, 'FOUR_UI_PROFILE_REASSESSMENTS_REQUIRED');
  for (const row of reassessments) {
    assert.equal(row.status, 'COMPLETED');
    assert.ok(row.changed_keys.includes('activity'), 'CHANGED_ACTIVITY_MUST_TRIGGER_REASSESSMENT');
    const linked = analyses.filter(analysis => analysis.profile_reassessment_id === row.id);
    assert.equal(linked.length, 1, 'ONE_ANALYSIS_PER_UI_PROFILE_CHANGE');
    const profileProof = await db`select a.correlation_id from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id
      where a.resource_id=${row.compliance_case_id} and a.action='client.profile.version.created'
      and (a.metadata->>'profile_version')::integer=${row.version} and e.event_type='ClientProfileVersionCreatedV1'`;
    assert.equal(profileProof.length, 1, 'PROFILE_CHANGE_AUDIT_OUTBOX_REQUIRED');
    const analysisProof = await db`select a.correlation_id from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id
      where a.resource_id=${linked[0].id} and a.action='assistance.analysis.completed' and e.event_type='AssistanceSuggestionsProposedV1'`;
    assert.equal(analysisProof.length, 1, 'PROFILE_ANALYSIS_AUDIT_OUTBOX_REQUIRED');
    for (const [table,id] of [['assistance_profile_reassessments',row.id],['client_profile_versions',row.profile_version_id]]) {
      const foreign = await fixture.sessions.clientB.client.from(table).select('id').eq('id',id);
      assert.equal(foreign.error, null);
      assert.deepEqual(foreign.data, [], 'FOREIGN_PROFILE_REASSESSMENT_READ_DENIED');
    }
  }
  const decisions = await db`select d.id,d.suggestion_id,d.decision,s.status,s.explanation from public.assistance_suggestion_decisions d join public.assistance_suggestions s on s.id=d.suggestion_id where d.organization_id=${organizationId}::uuid and d.rationale like ${'E2E ' + runToken + ' %'}`;
  assert.equal(decisions.length, 4, 'FOUR_EXPLICIT_UI_DECISIONS_REQUIRED');
  assert.equal(decisions.filter(row => row.decision === 'ACCEPTED').length, 2);
  assert.equal(decisions.filter(row => row.decision === 'REJECTED').length, 2);
  for (const decision of decisions) {
    assert.equal(decision.status, decision.decision);
    assert.equal(decision.explanation.human_review_required, true);
    const pairs = await db`select e.payload from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.aggregate_id=a.resource_id where a.resource_id=${decision.suggestion_id} and a.action=${'assistance.suggestion.' + decision.decision.toLowerCase()}`;
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].payload.business_action_executed, false);
    for (const [table,id] of [['assistance_suggestions',decision.suggestion_id],['assistance_suggestion_decisions',decision.id]]) {
      const foreign = await fixture.sessions.clientB.client.from(table).select('id').eq('id',id);
      assert.equal(foreign.error, null);
      assert.deepEqual(foreign.data, []);
    }
  }
  const deniedDecision = await fixture.sessions.clientB.client.rpc('decide_assisted_suggestion',{p_suggestion_id:decisions[0].suggestion_id,p_decision:'ACCEPTED',p_rationale:'Foreign tenant forbidden decision',p_idempotency_key:randomUUID()});
  assert.equal(deniedDecision.error?.code, '42501');
  const [businessRequests] = await db`select count(*)::integer as count from public.service_requests where client_organization_id=${organizationId}::uuid`;
  assert.equal(businessRequests.count, roleFixture.assistanceBusinessRequestCount, 'ASSISTANCE_MUST_NOT_CREATE_A_BUSINESS_REQUEST_AUTONOMOUSLY');
  return { stalePreferenceHttpConflictVerified:true, uiSites: 4, uiProjects: 4, uiProjectMilestones: 4, uiCalendarEvents:4, casablancaCalendarAndMilestoneInstantsVerified:true, uiActualCostAllocations:4, exactCostEvidenceFingerprintsVerified:true, uiSiteProjectBudgetLinks: 4, uiCostCenters: 4, uiApprovedExactBudgets: 4, uiDigestVersions: 4, uiNotificationTransitions: 12, mandatoryNotificationDisableDenied: true, uiAssistedAnalyses:8, uiProfileReassessments:4, uiHumanAssistanceDecisions:4, foreignAssistanceDecisionDenied:true, automaticBusinessRequestCreation:false, correlatedAuditOutbox: 68, uiProjectTaskTransitions:12, acceptedProjectProgressVerified:true, foreignReadsDenied: 57, digestVersionSequenceVerified: true };
}
