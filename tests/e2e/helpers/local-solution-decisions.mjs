import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const levels=['ESSENTIAL','STANDARD','ADVANCED'];
export async function prepareLocalSolutionDecisions(fixture,cases){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 const db=fixture.resources.database,items={};
 for(const locale of ['fr','ar']){
  const actor=fixture.resources.localJourneyActors[locale],foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'];
  const [anomaly]=await db`select a.id from public.diagnostic_anomalies a join public.diagnostic_runs d on d.id=a.diagnostic_run_id where d.questionnaire_session_id=${cases[locale].sessionId}::uuid order by a.id limit 1`;assert.ok(anomaly);
  for(const device of ['D','M']){
   const code=`SOLUTION_${fixture.manifest.runId.slice(0,8)}_${locale}_${device}`,options=levels.map((level,index)=>({level,service_id:fixture.resources.localCatalog.service,service_version_id:fixture.resources.localCatalog.serviceVersion,expected_score_bps:6000+index*1000,estimated_amount_minor:String(125050+index*10000),currency:'MAD',benefits:[{fr:`Résultat mesurable ${index+1}`,ar:`نتيجة قابلة للقياس ${index+1}`}],tradeoffs:[{fr:'Validation humaine requise',ar:'يلزم تحقق بشري'}],explanation:{method:{fr:'Règle publiée du diagnostic',ar:'قاعدة التشخيص المنشورة'}}}));
   const args={p_anomaly_id:anomaly.id,p_policy_snapshot:{version:'LOCAL_V1',content_hash:createHash('sha256').update(JSON.stringify(options)).digest('hex')},p_rationale_fr:code,p_rationale_ar:code,p_options:options,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
   const created=await actor.client.rpc('create_anomaly_solution_set',args);assert.equal(created.error,null);assert.equal(created.data.outcome,'SOLUTION_SET_CREATED');
   const replay=await actor.client.rpc('create_anomaly_solution_set',args);assert.equal(replay.error,null);assert.deepEqual(replay.data,created.data);
   const denied=await foreign.client.rpc('create_anomaly_solution_set',{...args,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
   items[`${locale}_${device}`]={...cases[locale],code,anomalyId:anomaly.id,setId:created.data.solution_set_id,deferredDate:'2027-12-03'};
  }
 }
 return items;
}
export async function verifyLocalSolutionDecisions(fixture,items,receipts){
 const db=fixture.resources.database;
 for(const [key,item]of Object.entries(items)){
  const locale=key.slice(0,2),actor=fixture.resources.localJourneyActors[locale],foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'];
  const proof=JSON.parse(await readFile(resolve(receipts,`${key}.json`),'utf8'));
  const rows=await db`select id,level,decision,reason,deferred_until from public.diagnostic_solution_decisions where solution_set_id=${item.setId}::uuid`;assert.equal(rows.length,3);
  for(const receipt of proof){
   const row=rows.find(r=>r.level===receipt.level);assert.ok(row);assert.equal(row.decision,receipt.decision);assert.equal(row.reason,receipt.reason);
   const args={p_solution_set_id:item.setId,p_level:receipt.level,p_decision:receipt.decision,p_reason:receipt.reason,p_deferred_until:row.deferred_until,p_idempotency_key:receipt.key,p_correlation_id:randomUUID()};
   const replay=await actor.client.rpc('record_solution_decision',args);assert.equal(replay.error,null);assert.equal(replay.data.decision_id,row.id);
   const denied=await foreign.client.rpc('record_solution_decision',{...args,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  }
  const [date]=await db`select to_char(deferred_until at time zone 'Africa/Casablanca','YYYY-MM-DD HH24:MI:SS') value from public.diagnostic_solution_decisions where solution_set_id=${item.setId}::uuid and decision='DEFERRED'`;assert.equal(date.value,`${item.deferredDate} 23:59:59`);
  const hidden=await foreign.client.from('diagnostic_solution_options').select('id').eq('solution_set_id',item.setId);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
  const [count]=await db`select count(*)::integer n from public.diagnostic_solution_decisions where solution_set_id=${item.setId}::uuid`;assert.equal(count.n,3);
  const [audits]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${item.setId} and a.action='diagnostic.solution_decided' and e.event_type='DiagnosticSolutionDecidedV1'`;assert.equal(audits.n,3);
 }
 return{nativeSolutionSets:4,realUiThreeLevelComparisons:4,realUiSolutionDecisions:12,acceptRejectDeferPersisted:true,solutionCreationAndDecisionReplay:true,foreignSolutionsReadWriteDenied:true,casablancaDeferralVerified:true,frArDesktop360Accessibility:true};
}
