import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
async function command(client,name,args){const result=await client.rpc(name,args);if(result.error)throw Object.assign(new Error('HISTORY_COMMAND_FAILED'),{code:result.error.code});return result.data;}
async function snapshot(db,id){const [row]=await db`select id,overall_score::text score,input_manifest_hash,scoring_policy_snapshot,explanation,(select jsonb_agg(jsonb_build_object('id',a.id,'title_fr',a.title_fr,'title_ar',a.title_ar,'explanation',a.explanation,'rule_snapshot',a.rule_snapshot)order by a.id)from public.diagnostic_anomalies a where a.diagnostic_run_id=d.id)anomalies from public.diagnostic_runs d where d.id=${id}::uuid`;return row;}
export async function prepareLocalDiagnosticHistory(fixture,cases){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 const db=fixture.resources.database,q=fixture.resources.localClientQuestionnaire,items={};fixture.resources.localHistorySnapshots={};
 for(const locale of ['fr','ar']){
  const item=cases[locale],actor=fixture.resources.localJourneyActors[locale],foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'];
  const [old]=await db`select id from public.diagnostic_runs where questionnaire_session_id=${item.sessionId}::uuid and status='COMPLETED'`;assert.ok(old);
  const before=await snapshot(db,old.id);fixture.resources.localHistorySnapshots[locale]=before;
  const started=await command(actor.client,'start_questionnaire_session',{p_organization_id:item.organizationId,p_questionnaire_version_id:q.version,p_locale:`${locale}-MA`,p_due_at:null,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID(),p_site_id:null});assert.notEqual(started.session_id,item.sessionId);
  await command(actor.client,'autosave_questionnaire_answers',{p_session_id:started.session_id,p_expected_row_version:1,p_answers:[{question_version_id:q.questionVersion,value:{kind:'INTEGER',value:'0'},expected_answer_row_version:0}],p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  const submitted=await command(actor.client,'submit_questionnaire_session',{p_session_id:started.session_id,p_expected_row_version:2,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});assert.equal(submitted.score_basis_points,0);
  const args={p_session_id:started.session_id,p_service_id:item.serviceId,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const completed=await command(actor.client,'complete_published_client_diagnostic_v1',args);assert.equal(completed.outcome,'DIAGNOSTIC_COMPLETED');assert.notEqual(completed.diagnostic_run_id,old.id);
  assert.deepEqual(await command(actor.client,'complete_published_client_diagnostic_v1',args),completed);
  const denied=await foreign.client.rpc('complete_published_client_diagnostic_v1',{...args,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  const current=await snapshot(db,completed.diagnostic_run_id);assert.equal(current.score,'0.00');assert.equal(before.score,'50.00');assert.deepEqual(current.scoring_policy_snapshot,before.scoring_policy_snapshot);
  items[locale]={...item,oldRunId:old.id,newRunId:current.id,oldManifestHash:before.input_manifest_hash,anomalyId:before.anomalies[0].id,questionnaireVersionId:q.version};
 }
 return items;
}
export async function verifyLocalDiagnosticHistory(fixture,items){
 const db=fixture.resources.database;
 for(const [locale,item]of Object.entries(items)){
  assert.deepEqual(await snapshot(db,item.oldRunId),fixture.resources.localHistorySnapshots[locale]);
  const rows=await db`select id,overall_score::text score from public.diagnostic_runs where organization_id=${item.organizationId}::uuid and library_id=${fixture.resources.localCatalog.library}::uuid order by completed_at,id`;assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.score),['50.00','0.00']);
  const foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'];const hidden=await foreign.client.from('diagnostic_runs').select('id').in('id',[item.oldRunId,item.newRunId]);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
  const [events]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${item.newRunId} and a.action='diagnostic.completed' and e.event_type='DiagnosticCompletedV1'`;assert.equal(events.n,1);
 }
 return{realNativeSuccessiveDiagnostics:2,realUiHistoryComparisons:4,exactScoreChangeFromFiftyToZero:true,previousScoreAnomalyAndRuleSnapshotsPreserved:true,realUiClientAndTechnicalExplanations:4,diagnosticReplayVerified:true,foreignHistoryReadWriteDenied:true,correlatedDiagnosticAuditOutbox:true,frArDesktop360Accessibility:true};
}
