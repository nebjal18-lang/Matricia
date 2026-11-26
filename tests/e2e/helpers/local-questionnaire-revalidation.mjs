import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {verifyCommandEvidence} from '../../../scripts/p05-e2e/privileged-fixture-adapter.mjs';

async function rpc(client,name,input){const result=await client.rpc(name,input);assert.equal(result.error,null,`${name} must succeed`);return result.data;}

export async function prepareQuestionnaireRevalidation(fixture,cases){
 const items=[],q=fixture.resources.localClientQuestionnaire;
 for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const actor=fixture.resources.localJourneyActors[locale],item=cases[locale];
  const start={p_organization_id:item.organizationId,p_questionnaire_version_id:q.version,p_locale:`${locale}-MA`,p_due_at:null,p_site_id:null,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const session=await rpc(actor.client,'start_questionnaire_session',start);
  const save={p_session_id:session.session_id,p_expected_row_version:1,p_answers:[{question_version_id:q.questionVersion,value:{kind:'INTEGER',value:'1'},expected_answer_row_version:0}],p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const saved=await rpc(actor.client,'autosave_questionnaire_answers',save);assert.equal(saved.outcome,'AUTOSAVE_SAVED');
  const [revision]=await fixture.resources.database`select id,answer_hash,answered_at,expires_at from public.questionnaire_answer_revisions where session_id=${session.session_id}::uuid`;
  assert.ok(revision.expires_at);assert.ok(new Date(revision.expires_at)>new Date(revision.answered_at));
  items.push({locale,device,sessionId:session.session_id,organizationId:item.organizationId,state:item.state,foreignState:item.foreignState,revision});
  await verifyCommandEvidence(fixture.resources.database,[{organizationId:item.organizationId,correlationId:start.p_correlation_id,action:'questionnaire.session.started',eventType:'QuestionnaireSessionStartedV1'},{organizationId:item.organizationId,correlationId:save.p_correlation_id,action:'questionnaire.answers.autosaved',eventType:'QuestionnaireAnswersSavedV1'}]);
 }
 // Wait for the real server TTL. No clock rewrite or historical answer mutation.
 const expiry=Math.max(...items.map(i=>new Date(i.revision.expires_at).getTime()));
 while(Date.now()<=expiry)await delay(Math.min(1000,expiry-Date.now()+100));
 for(const item of items){
  const client=fixture.resources.localJourneyActors[item.locale].client;
  const denied=await client.rpc('submit_questionnaire_session',{p_session_id:item.sessionId,p_expected_row_version:2,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  assert.ok(denied.error,'Expired required answer must be rejected by server');
  assert.equal(denied.error.code,'23514');
  assert.equal(denied.error.message,'REQUIRED_ANSWERS_MISSING');
 }
 return items;
}

export async function verifyQuestionnaireRevalidation(fixture,items){
 for(const item of items){
  const db=fixture.resources.database,client=fixture.resources.localJourneyActors[item.locale].client,foreign=fixture.resources.localJourneyActors[item.locale==='fr'?'ar':'fr'].client;
  const revisions=await db`select id,revision,value,answer_hash,answered_at,expires_at from public.questionnaire_answer_revisions where session_id=${item.sessionId}::uuid order by revision`;
  assert.equal(revisions.length,2);assert.equal(revisions[0].id,item.revision.id);assert.equal(revisions[0].answer_hash,item.revision.answer_hash);assert.equal(new Date(revisions[0].expires_at).toISOString(),new Date(item.revision.expires_at).toISOString());
  assert.deepEqual(revisions[0].value,revisions[1].value);assert.ok(new Date(revisions[1].answered_at)>new Date(revisions[0].expires_at));assert.ok(new Date(revisions[1].expires_at)>new Date(revisions[1].answered_at));
  const [session]=await db`select status,row_version,submitted_at from public.questionnaire_sessions where id=${item.sessionId}::uuid`;assert.equal(session.status,'SUBMITTED');assert.ok(new Date(revisions[1].expires_at)>new Date(session.submitted_at));
  const evidence=await db`select a.action,count(*)::integer count from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${item.sessionId} and ((a.action='questionnaire.answers.autosaved' and e.event_type='QuestionnaireAnswersSavedV1') or (a.action='questionnaire.session.submitted' and e.event_type='QuestionnaireSessionSubmittedV1')) group by a.action`;
  assert.equal(evidence.find(e=>e.action==='questionnaire.answers.autosaved')?.count,2);assert.equal(evidence.find(e=>e.action==='questionnaire.session.submitted')?.count,1);
  const read=await foreign.from('questionnaire_sessions').select('id').eq('id',item.sessionId);assert.equal(read.error,null);assert.deepEqual(read.data,[]);
  const input={p_session_id:item.sessionId,p_expected_row_version:session.row_version,p_answers:[{question_version_id:fixture.resources.localClientQuestionnaire.questionVersion,value:{kind:'INTEGER',value:'0'},expected_answer_row_version:2}],p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const denied=await foreign.rpc('autosave_questionnaire_answers',input);assert.equal(denied.error?.code,'42501');
  const frozen=await client.rpc('autosave_questionnaire_answers',{...input,p_idempotency_key:randomUUID()});assert.equal(frozen.error?.code,'55000');assert.equal(frozen.error?.message,'SESSION_NOT_EDITABLE');
 }
 return{realUiAnswerRevalidations:4,realUiFreshSubmissions:4,realServerExpiry:true,expiredSubmissionDenied:true,immutableExpiredRevisionsPreserved:true,submittedSessionModificationDenied:true,foreignSessionReadAndWriteDenied:true,correlatedAnswerAndSubmissionEvidence:true};
}
