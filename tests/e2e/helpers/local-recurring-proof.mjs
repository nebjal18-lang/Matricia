import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyLocalRecurringRequests(fixture, cases) {
  const db = fixture.resources.database;
  let plansVerified = 0, clonesVerified = 0;
  for (const [locale, item] of Object.entries(cases)) {
    const client = fixture.resources.localJourneyActors?.[locale].client ?? fixture.sessions[locale === 'fr' ? 'clientA' : 'clientB'].client;
    const foreign = fixture.resources.localJourneyActors?.[locale === 'fr' ? 'ar' : 'fr'].client ?? fixture.sessions[locale === 'fr' ? 'clientB' : 'clientA'].client;
    const plans = await db`select p.id,p.status,p.current_version,p.row_version,v.cadence from public.recurring_service_plans p join public.recurring_service_plan_versions v on v.plan_id=p.id and v.version_number=1 where p.client_organization_id=${item.organizationId}::uuid`;
    assert.equal(plans.length, 6, 'SIX_UI_PLANS_PER_LOCALE_REQUIRED');
    assert.deepEqual(plans.map(p => p.cadence).sort(), ['ANNUALLY','ANNUALLY','MONTHLY','MONTHLY','QUARTERLY','QUARTERLY']);
    for (const plan of plans) {
      assert.equal(plan.status, 'ENDED');
      assert.equal(plan.current_version, 4);
      const versions = await db`select status from public.recurring_service_plan_versions where plan_id=${plan.id}::uuid order by version_number`;
      assert.deepEqual(versions.map(v => v.status), ['ACTIVE','PAUSED','ACTIVE','ENDED']);
      const occurrences = await db`select r.id,r.status,v.budget_minor::text,v.description,o.scheduled_on::text from public.recurring_service_occurrences o join public.service_requests r on r.id=o.generated_request_id join public.service_request_versions v on v.id=r.current_version_id where o.plan_id=${plan.id}::uuid order by o.scheduled_on`;
      assert.equal(occurrences.length, 2);
      for (const occurrence of occurrences) {
        assert.equal(occurrence.status, 'DRAFT');
        assert.equal(occurrence.budget_minor, '125050');
        assert.equal(occurrence.description, item.description);
      }
      const months = {MONTHLY:1,QUARTERLY:3,ANNUALLY:12}[plan.cadence];
      const [interval] = await db`select (${occurrences[0].scheduled_on}::date + make_interval(months => ${months}::integer))::date::text as expected`;
      assert.equal(occurrences[1].scheduled_on, interval.expected, 'EXACT_CADENCE_DATE_REQUIRED');
      const events = await db`select a.action,e.event_type,e.payload,e.idempotency_key from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.aggregate_id=a.resource_id where a.resource_id=${plan.id} and a.action in ('recurring.plan.created','recurring.plan.pause','recurring.plan.resume','recurring.plan.end','recurring.requests.generated')`;
      assert.equal(events.length, 5, 'FIVE_CORRELATED_PLAN_EVENTS_REQUIRED');
      assert.equal(new Set(events.map(e => e.idempotency_key)).size, 5);
      const generated = events.find(e => e.action === 'recurring.requests.generated');
      assert.equal(generated.payload.autonomous_spend, false);
      assert.equal(generated.payload.autonomous_invitations, false);
      const input = {p_plan_id:plan.id,p_through_date:generated.payload.through_date,p_max_occurrences:2,p_idempotency_key:generated.idempotency_key,p_correlation_id:randomUUID()};
      const replay = await client.rpc('generate_recurring_service_requests', input);
      assert.equal(replay.error, null);
      assert.deepEqual(replay.data, generated.payload, 'ENDED_PLAN_REPLAYS_ORIGINAL_GENERATION');
      const fresh = await client.rpc('generate_recurring_service_requests', {...input,p_idempotency_key:randomUUID()});
      assert.equal(fresh.error?.code, '55000');
      const denied = await foreign.rpc('generate_recurring_service_requests', {...input,p_idempotency_key:randomUUID()});
      assert.equal(denied.error?.code, '42501');
      const read = await foreign.from('recurring_service_plans').select('id').eq('id',plan.id);
      assert.equal(read.error, null);assert.deepEqual(read.data, []);
      plansVerified++;
    }
    const clones = await db`select p.*,r.status,v.budget_minor::text,v.description from public.service_request_clone_provenance p join public.service_requests r on r.id=p.cloned_request_id join public.service_request_versions v on v.id=p.cloned_request_version_id where p.client_organization_id=${item.organizationId}::uuid`;
    assert.equal(clones.length, 2, 'TWO_UI_CLONES_PER_LOCALE_REQUIRED');
    for (const clone of clones) {
      assert.notEqual(clone.source_request_id, clone.cloned_request_id);
      assert.equal(clone.status, 'DRAFT');assert.equal(clone.budget_minor, '125050');assert.equal(clone.description, item.description);
      const events = await db`select a.correlation_id from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.aggregate_id=a.resource_id where a.resource_id=${clone.cloned_request_id} and a.action='rfq.request.cloned' and e.event_type='ServiceRequestClonedV2'`;
      assert.equal(events.length, 1);
      const denied = await foreign.rpc('clone_service_request',{p_source_request_id:clone.source_request_id,p_desired_date:null,p_change_reason:'Foreign clone denied',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
      assert.equal(denied.error?.code, '42501');
      const read = await foreign.from('service_requests').select('id').eq('id',clone.cloned_request_id);
      assert.equal(read.error,null);assert.deepEqual(read.data,[]);
      clonesVerified++;
    }
  }
  return {realUiRecurringPlans:plansVerified,realUiClones:clonesVerified,allThreeCadences:true,governedPauseResumeEnd:true,generatedDraftsRetainExactBudget:true,endedReplayAndNewGenerationDenial:true,foreignReadAndWriteDenied:true,correlatedRecurringAuditOutbox:true};
}
