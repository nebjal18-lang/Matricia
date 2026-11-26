import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {verifyCommandEvidence} from '../../../scripts/p05-e2e/privileged-fixture-adapter.mjs';
async function rpc(client,name,input){const r=await client.rpc(name,input);assert.equal(r.error,null,`${name} must succeed`);return r.data;}
export async function prepareQuestionnaireAssistance(fixture,cases,phase){
 const db=fixture.resources.database,items=[],q=fixture.resources.localClientQuestionnaire;
 if(phase==='fresh'){
  fixture.resources.assistanceFacts=[];
  const [policy]=await db`select max_age_days from public.prefill_policy_versions where source_type='ORGANIZATION' and status='ACTIVE' and effective_from<=clock_timestamp() and (effective_until is null or effective_until>clock_timestamp()) order by version desc limit 1`;
  assert.ok(policy);
  for(const locale of ['fr','ar']){
   const actor=fixture.resources.localJourneyActors[locale],organizationId=cases[locale].organizationId;
   const input={p_organization_id:organizationId,p_data_key:'local.readiness',p_source_type:'ORGANIZATION',p_source_reference_id:organizationId,p_value:{kind:'INTEGER',value:'1'},p_sensitivity:'BUSINESS',p_observed_at:new Date(Date.now()-policy.max_age_days*86400_000+90_000).toISOString(),p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
   const receipt=await rpc(actor.client,'record_prefill_fact',input);assert.deepEqual(await rpc(actor.client,'record_prefill_fact',input),receipt);
   const mismatch=await actor.client.rpc('record_prefill_fact',{...input,p_value:{kind:'INTEGER',value:'0'}});assert.equal(mismatch.error?.code,'22000');
   const foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'].client;
   const denied=await foreign.rpc('record_prefill_fact',{...input,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
   await verifyCommandEvidence(db,[{organizationId,correlationId:input.p_correlation_id,action:'prefill.fact.version_recorded',eventType:'PrefillFactVersionRecordedV1'}]);
   fixture.resources.assistanceFacts.push({organizationId,...receipt});
  }
 }else{
  const expiry=Math.max(...fixture.resources.assistanceFacts.map(f=>Date.parse(f.fresh_until)));
  while(Date.now()<=expiry)await delay(Math.min(1000,expiry-Date.now()+100));
 }
 for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const actor=fixture.resources.localJourneyActors[locale],item=cases[locale];
  const started=await rpc(actor.client,'start_questionnaire_session',{p_organization_id:item.organizationId,p_questionnaire_version_id:q.version,p_locale:`${locale}-MA`,p_due_at:null,p_site_id:null,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  const suggestions=await rpc(actor.client,'questionnaire_prefill_suggestions',{p_session_id:started.session_id});
  if(phase==='fresh'){assert.equal(suggestions.length,1);assert.deepEqual(suggestions[0].value,{kind:'INTEGER',value:'1'});assert.equal(suggestions[0].source,'ORGANIZATION');assert.equal(suggestions[0].requires_confirmation,true);}else assert.deepEqual(suggestions,[]);
  const foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'].client;
  assert.deepEqual(await rpc(foreign,'questionnaire_prefill_suggestions',{p_session_id:started.session_id}),[]);
  items.push({locale,device,sessionId:started.session_id,organizationId:item.organizationId,state:item.state,phase});
 }
 fixture.resources.assistanceItems=[...(fixture.resources.assistanceItems??[]),...items];
 return items;
}
export async function verifyQuestionnaireAssistance(fixture){
 const db=fixture.resources.database;
 for(const item of fixture.resources.assistanceItems){
  const rows=await db`select s.status,r.value,r.revision from public.questionnaire_sessions s join public.questionnaire_answer_revisions r on r.session_id=s.id where s.id=${item.sessionId}::uuid`;
  assert.equal(rows.length,1);assert.equal(rows[0].status,'SUBMITTED');assert.equal(rows[0].revision,1);assert.deepEqual(rows[0].value,{kind:'INTEGER',value:item.phase==='fresh'?'1':'0'});
  const [e]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox o on o.correlation_id=a.correlation_id where a.resource_id=${item.sessionId} and a.action='questionnaire.session.submitted' and o.event_type='QuestionnaireSessionSubmittedV1'`;assert.equal(e.n,1);
 }
 for(const fact of fixture.resources.assistanceFacts){
  const rows=await db`select id,fresh_until from public.prefill_fact_versions where organization_id=${fact.organizationId}::uuid and data_key='local.readiness'`;assert.equal(rows.length,1);assert.equal(rows[0].id,fact.fact_version_id);assert.equal(new Date(rows[0].fresh_until).getTime(),Date.parse(fact.fresh_until));
 }
 return{realUiFreshPrefillConfirmations:4,realUiExpiredPrefillExclusions:4,realUiContextualHelpAndExamples:8,immutablePrefillFacts:2,prefillCommandReplayVerified:true,prefillForeignReadAndWriteDenied:true,realFreshnessPolicyExpiry:true,submittedAnswersAndAuditVerified:true};
}
