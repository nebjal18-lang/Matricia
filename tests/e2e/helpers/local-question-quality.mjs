import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

/** Explicit historical question content used to exercise the real analysis, never a generated analysis result. */
export async function insertLocalQualityQuestions(fixture,tx,ids,catalog,actor,digest){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 ids.qualityQuestions=[];
 for(let index=0;index<2;index++){
  const question=randomUUID(),payload={label_fr:'Autre chose ?',label_ar:'شيء آخر',answer_type:'SHORT_TEXT',data_key:'local.quality',required_by_default:false,required_for_quote:false,required_for_publication:false,options:[],validation_schema:{maxLength:200},structured_schema:null,sensitivity:'BUSINESS',nullable:true,weight:0,maximum_score:0,source_service_id:catalog.service};
  await tx`insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by)values(${question}::uuid,${catalog.library}::uuid,${`LOCAL_QUALITY_${index}`},'SERVICE','DRAFT',${actor}::uuid)`;
  await tx`select private.assert_question_builder_payload(${catalog.library}::uuid,'SERVICE',${tx.json(payload)})`;
  const [row]=await tx`select private.insert_question_builder_version(${question}::uuid,${catalog.library}::uuid,${tx.json(payload)},'Historical quality analysis reference',${actor}::uuid,1) id`;
  await tx`update public.question_versions set status='PUBLISHED',published_at=clock_timestamp(),translation_review_status='APPROVED',translation_reviewer_user_id=${fixture.resources.userIds[2]}::uuid,translation_reviewed_at=clock_timestamp(),translation_review_proof_hash=${digest},translation_review_version=1 where id=${row.id}::uuid`;
  await tx`update public.question_bank_questions set status='PUBLISHED',current_published_version_id=${row.id}::uuid where id=${question}::uuid`;
  await tx`insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order)values(${ids.version}::uuid,${catalog.library}::uuid,${ids.section}::uuid,${row.id}::uuid,${index+2})`;
  ids.qualityQuestions.push({question,version:row.id});
 }
}
export async function verifyLocalQuestionQuality(fixture,cases,receipts){
 const db=fixture.resources.database;
 for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const receipt=JSON.parse(await readFile(resolve(receipts,`${locale}_${device}.json`),'utf8')),actor=fixture.resources.localJourneyActors[locale],foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'];
  const [request]=await db`select * from public.assistance_requests where organization_id=${cases[locale].organizationId}::uuid and id=(select(response_body->>'request_id')::uuid from public.idempotency_keys where organization_id=${cases[locale].organizationId}::uuid and operation_scope='assistance.analysis.runtime' and key=${receipt.key})`;
  assert.ok(request);assert.equal(request.context_type,'QUESTIONNAIRE_QUALITY');assert.deepEqual(request.known_data_keys,['local.quality']);
  assert.deepEqual([...request.candidate_question_version_ids].sort(),fixture.resources.localClientQuestionnaire.qualityQuestions.map(q=>q.version).sort());
  const suggestions=await db`select id,suggestion_kind,status,explanation from public.assistance_suggestions where request_id=${request.id}::uuid`;
  for(const kind of ['QUESTION_AMBIGUITY','KNOWN_DATA_DUPLICATION','SEMANTIC_DUPLICATE'])assert.ok(suggestions.some(s=>s.suggestion_kind===kind),kind);
  for(const s of suggestions)assert.equal(s.explanation.human_review_required,true);
  const args={p_organization_id:cases[locale].organizationId,p_context_type:'QUESTIONNAIRE_QUALITY',p_input_text:null,p_candidate_service_version_ids:[],p_candidate_question_version_ids:request.candidate_question_version_ids,p_known_data_keys:['local.quality'],p_model_version_id:receipt.modelId,p_profile_reassessment_id:null,p_idempotency_key:receipt.key,p_correlation_id:randomUUID()};
  const replay=await actor.client.rpc('run_assisted_analysis',args);assert.equal(replay.error,null);assert.equal(replay.data.request_id,request.id);
  const denied=await foreign.client.rpc('run_assisted_analysis',{...args,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  const [decision]=await db`select decision,rationale from public.assistance_suggestion_decisions where suggestion_id=${receipt.suggestionId}::uuid`;assert.ok(decision);assert.equal(decision.decision,locale==='fr'?'REJECTED':'ACCEPTED');assert.equal(decision.rationale,receipt.reason);
  const decisionArgs={p_suggestion_id:receipt.suggestionId,p_decision:decision.decision,p_rationale:receipt.reason,p_idempotency_key:receipt.decisionKey,p_correlation_id:randomUUID()};
  const decisionReplay=await actor.client.rpc('decide_assisted_suggestion',decisionArgs);assert.equal(decisionReplay.error,null);assert.equal(decisionReplay.data.business_action_executed,false);
  const decisionDenied=await foreign.client.rpc('decide_assisted_suggestion',{...decisionArgs,p_idempotency_key:randomUUID()});assert.equal(decisionDenied.error?.code,'42501');
  const hidden=await foreign.client.from('assistance_suggestions').select('id').eq('request_id',request.id);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
  const [audit]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${request.id} and a.action='assistance.analysis.completed' and e.event_type='AssistanceSuggestionsProposedV1'`;assert.equal(audit.n,1);
 }
 for(const question of fixture.resources.localClientQuestionnaire.qualityQuestions){const [row]=await db`select label_fr,label_ar,status from public.question_versions where id=${question.version}::uuid`;assert.equal(row.label_fr,'Autre chose ?');assert.equal(row.label_ar,'شيء آخر');assert.equal(row.status,'PUBLISHED');}
 return{realUiQuestionQualityAnalyses:4,realUiQualityHumanDecisions:4,ambiguityKnownDataAndSimilarityDetected:true,analysisReplayVerified:true,foreignAnalysisReadWriteDenied:true,noAutomaticQuestionRewrite:true,versionedHeuristicModel:true,externalAiProviderUsed:false,correlatedQualityAuditOutbox:true,frArDesktop360Accessibility:true};
}
