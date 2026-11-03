import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { verifyCommandEvidence } from '../../../scripts/p05-e2e/privileged-fixture-adapter.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
async function rpc(client, name, input) {
  const result = await client.rpc(name, input);
  if (result.error) throw Object.assign(new Error(`LOCAL_CLIENT_${name.toUpperCase()}_FAILED`), {code: result.error.code});
  return result.data;
}

/** Published reference is a historical precondition; commands below are never bootstrapped. */
export async function createLocalQuestionnaireReference(fixture) {
  if (fixture.config.runtimeMode !== 'isolated-local-docker' || !fixture.config.localDockerVerified || !fixture.resources.localCatalog) throw new Error('LOCAL_REFERENCE_REQUIRED');
  const catalog = fixture.resources.localCatalog;
  const ids = Object.fromEntries(['questionnaire', 'version', 'section', 'question', 'questionVersion','rule','ruleVersion'].map(key => [key, randomUUID()]));
  fixture.resources.localClientQuestionnaire = ids;
  const actor = fixture.resources.userIds[0], digest = hash(ids.version), code = `LOCAL_${ids.questionnaire.replaceAll('-', '').toUpperCase()}`;
  await fixture.resources.database.begin(async tx => {
    await tx.unsafe("set local session_replication_role='replica'");
    await tx`insert into public.questionnaires(id,library_id,code,status,created_by) values(${ids.questionnaire}::uuid,${catalog.library}::uuid,${code},'DRAFT',${actor}::uuid)`;
    await tx`insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by) values(${ids.version}::uuid,${ids.questionnaire}::uuid,${catalog.library}::uuid,${catalog.release}::uuid,1,'DRAFT','Diagnostic de recette locale','تشخيص الاختبار المحلي','Référence historique synthétique pour recette locale','مرجع اصطناعي تاريخي للاختبار المحلي','CLIENT','2.0.0','LOCAL_ACCEPTANCE_V1',${digest},'APPROVED',${actor}::uuid,clock_timestamp(),${digest},1,'Précondition historique de recette locale',${actor}::uuid)`;
    await tx`insert into public.questionnaire_sections(id,questionnaire_version_id,section_key,label_fr,label_ar,sort_order,content_hash) values(${ids.section}::uuid,${ids.version}::uuid,'GENERAL','Général','عام',1,${digest})`;
    await tx`insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by) values(${ids.question}::uuid,${catalog.library}::uuid,'LOCAL_READINESS','SERVICE','DRAFT',${actor}::uuid)`;
    const questionPayload={label_fr:'Niveau de préparation',label_ar:'مستوى الاستعداد',answer_type:'INTEGER',data_key:'local.readiness',required_by_default:true,required_for_quote:false,required_for_publication:false,options:[],validation_schema:{minimum:0,maximum:1},structured_schema:null,sensitivity:'BUSINESS',nullable:false,weight:1,maximum_score:1,source_service_id:catalog.service};
    await tx`select private.assert_question_builder_payload(${catalog.library}::uuid,'SERVICE',${tx.json(questionPayload)})`;
    const[questionVersion]=await tx`select private.insert_question_builder_version(${ids.question}::uuid,${catalog.library}::uuid,${tx.json(questionPayload)},'Précondition historique de recette locale',${actor}::uuid,1)as id`;
    ids.questionVersion=questionVersion.id;
    await tx`update public.question_versions set status='PUBLISHED',published_at=clock_timestamp(),translation_review_status='APPROVED',translation_reviewer_user_id=${fixture.resources.userIds[2]}::uuid,translation_reviewed_at=clock_timestamp(),translation_review_proof_hash=${digest},translation_review_version=1 where id=${ids.questionVersion}::uuid`;
    await tx`update public.question_bank_questions set status='PUBLISHED',current_published_version_id=${ids.questionVersion}::uuid where id=${ids.question}::uuid`;
    await tx`insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order) values(${ids.version}::uuid,${catalog.library}::uuid,${ids.section}::uuid,${ids.questionVersion}::uuid,1)`;
    const rulePayload={condition_ast:{operator:'EQ',question_version_id:ids.questionVersion,value:1},actions:[
      {type:'SCORE',dimension:'PROCESS',delta_basis_points:5000},
      {type:'ANOMALY',target:'RECIPE_PROCESS_REVIEW',metadata:{label_fr:'Contrôle de processus requis (recette)',label_ar:'مراجعة العملية مطلوبة (اختبار)',title_fr:'Contrôle de processus requis (recette)',title_ar:'مراجعة العملية مطلوبة (اختبار)',client_text_fr:'La réponse publiée déclenche ce contrôle de recette.',client_text_ar:'تؤدي الإجابة إلى هذا الفحص التجريبي.',severity:'WARNING',blocking:false}},
      {type:'RECOMMENDATION',target:'RECIPE_REVIEW_PROCESS',metadata:{label_fr:'Vérifier le processus (recette)',label_ar:'التحقق من العملية (اختبار)',title_fr:'Vérifier le processus (recette)',title_ar:'التحقق من العملية (اختبار)',client_text_fr:'Examiner le processus décrit dans la réponse.',client_text_ar:'راجعوا العملية الموضحة في الإجابة.',priority_basis_points:5000,solution_level:'GUIDANCE'}},
      {type:'OPPORTUNITY',target:'RECIPE_PROCESS_IMPROVEMENT',metadata:{label_fr:'Amélioration du processus (recette)',label_ar:'تحسين العملية (اختبار)',title_fr:'Amélioration du processus (recette)',title_ar:'تحسين العملية (اختبار)',client_text_fr:'Une possibilité d’amélioration est publiée par la règle.',client_text_ar:'تشير القاعدة المنشورة إلى فرصة للتحسين.',priority_basis_points:6000,solution_level:'GUIDANCE',missing_fields:[]}},
      {type:'SOLUTION_LEVEL',target:'GUIDANCE'},
      {type:'SUGGEST_SERVICE',target:catalog.service},
    ],dependency_graph:{},priority:10,sensitive:false};
    await tx`select private.assert_advanced_rule_contract(${tx.json(rulePayload.condition_ast)},${tx.json(rulePayload.actions)},${tx.json(rulePayload.dependency_graph)},${[ids.questionVersion]}::text[])`;
    await tx`insert into public.question_rules(id,library_id,rule_key,status,created_by)values(${ids.rule}::uuid,${catalog.library}::uuid,'LOCAL_CLIENT_DECISION','DRAFT',${actor}::uuid)`;
    const[ruleVersion]=await tx`select private.insert_rule_builder_version(${ids.rule}::uuid,${catalog.library}::uuid,${tx.json(rulePayload)},'Précondition historique de règle publiée locale',${actor}::uuid,1)as id`;
    ids.ruleVersion=ruleVersion.id;
    await tx`update public.question_rule_versions set status='PUBLISHED',published_at=clock_timestamp()where id=${ids.ruleVersion}::uuid`;
    await tx`update public.question_rules set status='PUBLISHED',current_published_version_id=${ids.ruleVersion}::uuid where id=${ids.rule}::uuid`;
    await tx`insert into public.questionnaire_version_rules(questionnaire_version_id,library_id,rule_version_id,evaluation_order)values(${ids.version}::uuid,${catalog.library}::uuid,${ids.ruleVersion}::uuid,1)`;
    await tx`update public.questionnaire_versions set snapshot_hash=private.compute_questionnaire_snapshot_hash(id,jsonb_build_object('questionnaire_id',questionnaire_id,'library_id',library_id,'release_id',catalog_release_id,'version',version,'title_fr',title_fr,'title_ar',title_ar,'description_fr',description_fr,'description_ar',description_ar,'audience',audience,'engine_version',engine_version,'policy_version',policy_version)),status='PUBLISHED',published_at=clock_timestamp(),row_version=row_version+1 where id=${ids.version}::uuid`;
    await tx`update public.questionnaires set status='PUBLISHED',current_published_version_id=${ids.version}::uuid,row_version=row_version+1 where id=${ids.questionnaire}::uuid`;
  });
  return ids;
}

export async function prepareLocalClientJourneys(fixture,activatedActors) {
  const questionnaire = await createLocalQuestionnaireReference(fixture);
  const evidence = [], cases = {};
  const [service] = await fixture.resources.database`select code from public.catalog_services where id=${fixture.resources.localCatalog.service}::uuid`;
  for (const [locale, key] of [['fr','clientA'], ['ar','clientB']]) {
    const client = activatedActors?.[locale].client??fixture.sessions[key].client, foreign = activatedActors?.[locale==='fr'?'ar':'fr'].client??fixture.sessions[key === 'clientA' ? 'clientB' : 'clientA'].client;
    // P05 deliberately owns an unverified profile with anomalies. Create a
    // distinct new organization through the real command instead of bypassing
    // identity holds or claiming that the compliance review was completed.
    let organizationId=activatedActors?.[locale].organizationId;
    if(!organizationId){
    const organizationCorrelation=randomUUID();
    const ice=(BigInt(`0x${hash(`${fixture.manifest.runId}:${locale}:ice`).slice(0,14)}`)%1_000_000_000_000_000n).toString().padStart(15,'0');
    const organization=await rpc(client,'create_or_request_organization',{p_legal_name:`P05 E2E Client Journey ${locale} ${fixture.manifest.runId}`,p_display_name:`P05 E2E Client Journey ${locale} ${fixture.manifest.runId}`,p_ice:ice,p_owner_role:'CLIENT_OWNER',p_idempotency_key:randomUUID(),p_correlation_id:organizationCorrelation});
    assert.equal(organization.outcome,'ORGANIZATION_CREATED');
    organizationId=organization.organization_id;fixture.resources.organizationIds.push(organizationId);
    // Questionnaire START intentionally requires ACTIVE. Activation is a
    // declared historical local precondition, never a tested compliance decision.
    await fixture.resources.database`update public.organizations set status='ACTIVE',row_version=row_version+1,updated_at=clock_timestamp() where id=${organizationId}::uuid and status='PENDING'`;
    evidence.push({organizationId,correlationId:organizationCorrelation,action:'organization.created',eventType:'OrganizationCreatedV1'});
    }
    const payload = {need: `Objectif métier local ${locale} ${fixture.manifest.runId}`, location:'Casablanca',timing:'Dans deux semaines',constraints:'local.readiness: 1'};
    const intakeCorrelation = randomUUID();
    const intakeInput = {p_organization_id:organizationId,p_payload:payload,p_locale:locale,p_idempotency_key:hash(`${fixture.manifest.runId}:${locale}:intake`),p_correlation_id:intakeCorrelation};
    const intake = await rpc(client,'save_public_need_intake',intakeInput);
    const replayIntake = await rpc(client,'save_public_need_intake',intakeInput);
    assert.equal(intake.replayed,false); assert.equal(replayIntake.replayed,true); assert.equal(replayIntake.intake_id,intake.intake_id);
    evidence.push({organizationId,correlationId:intakeCorrelation,action:'public_need.intake.saved',eventType:'PublicNeedIntakeSavedV1'});
    const startCorrelation = randomUUID();
    const startInput = {p_organization_id:organizationId,p_questionnaire_version_id:questionnaire.version,p_locale:`${locale}-MA`,p_due_at:null,p_idempotency_key:`${fixture.manifest.runId}:${locale}:start`,p_correlation_id:startCorrelation,p_site_id:null};
    const started = await rpc(client,'start_questionnaire_session',startInput);
    const replayStart = await rpc(client,'start_questionnaire_session',startInput);
    assert.equal(replayStart.session_id,started.session_id); assert.equal(started.row_version,1);
    evidence.push({organizationId,correlationId:startCorrelation,action:'questionnaire.session.started',eventType:'QuestionnaireSessionStartedV1'});
    const saveCorrelation = randomUUID();
    const saveInput = {p_session_id:started.session_id,p_expected_row_version:1,p_answers:[{question_version_id:questionnaire.questionVersion,value:{kind:'INTEGER',value:'1'},expected_answer_row_version:0}],p_idempotency_key:`${fixture.manifest.runId}:${locale}:save`,p_correlation_id:saveCorrelation};
    const saved = await rpc(client,'autosave_questionnaire_answers',saveInput);
    assert.equal(saved.outcome,'AUTOSAVE_SAVED'); assert.equal(saved.server_row_version,2);
    assert.deepEqual(await rpc(client,'autosave_questionnaire_answers',saveInput),saved);
    evidence.push({organizationId,correlationId:saveCorrelation,action:'questionnaire.answers.autosaved',eventType:'QuestionnaireAnswersSavedV1'});
    const foreignSave = await foreign.rpc('autosave_questionnaire_answers',{...saveInput,p_idempotency_key:`${fixture.manifest.runId}:${locale}:foreign`});
    assert.equal(foreignSave.error?.code,'42501');
    const stale = await rpc(client,'autosave_questionnaire_answers',{...saveInput,p_idempotency_key:`${fixture.manifest.runId}:${locale}:stale`});
    assert.equal(stale.outcome,'AUTOSAVE_CONFLICT'); assert.equal(stale.server_row_version,2);
    const submitCorrelation = randomUUID();
    const submitInput = {p_session_id:started.session_id,p_expected_row_version:2,p_idempotency_key:`${fixture.manifest.runId}:${locale}:submit`,p_correlation_id:submitCorrelation};
    const submitted = await rpc(client,'submit_questionnaire_session',submitInput);
    assert.equal(submitted.outcome,'QUESTIONNAIRE_SESSION_SUBMITTED');
    assert.equal(submitted.score_basis_points,5000);
    assert.deepEqual(await rpc(client,'submit_questionnaire_session',submitInput),submitted);
    evidence.push({organizationId,correlationId:submitCorrelation,action:'questionnaire.session.submitted',eventType:'QuestionnaireSessionSubmittedV1'});
    const deniedRead = await foreign.from('questionnaire_sessions').select('id').eq('id',started.session_id);
    assert.equal(deniedRead.error,null); assert.equal(deniedRead.data?.length,0);
    cases[locale] = {organizationId,intakeId:intake.intake_id,sessionId:started.session_id,serviceCode:service.code,serviceId:fixture.resources.localCatalog.service,state:activatedActors?.[locale].state??fixture.manifest.states[key].path,foreignState:activatedActors?.[locale==='fr'?'ar':'fr'].state??fixture.manifest.states[key === 'clientA' ? 'clientB' : 'clientA'].path,activationVerified:activatedActors?.[locale].activationVerified===true,organizationName:activatedActors?.[locale].organizationName,description:`Mission de recette persistée ${locale} ${fixture.manifest.runId}`};
  }
  await verifyCommandEvidence(fixture.resources.database,evidence);
  return cases;
}

export async function verifyLocalClientJourneys(fixture,cases) {
  for (const [locale,item] of Object.entries(cases)) {
    const rows = await fixture.resources.database`select d.id as diagnostic_id,d.overall_score::text as score,d.rating,
      e.score_basis_points,d.input_manifest_hash=e.answer_manifest_hash as manifest_matches,
      d.explanation->>'evaluation_id'=e.id::text as evaluation_matches,
      d.explanation->>'evaluation_reproducibility_hash'=e.reproducibility_hash as reproducibility_matches,
      d.explanation->>'session_snapshot_hash'=snapshot.snapshot_hash as session_snapshot_matches,
      d.explanation->'triggered_actions'=e.triggered_actions as actions_match,
      d.explanation->>'questions_weight_used'='false'as authoritative_score,
      d.scoring_policy_snapshot->>'score_source'='FINAL_PUBLISHED_RULE_EVALUATION'as authoritative_source,
      d.scoring_policy_snapshot->>'content_hash'=private.canonical_request_hash(d.scoring_policy_snapshot-'content_hash')as policy_hash_matches,
      jsonb_array_length(e.triggered_actions)as actions,
      (select count(*)::int from jsonb_array_elements(d.scoring_policy_snapshot->'rules')r join public.question_rule_versions source on source.id=(r->>'id')::uuid where r->>'id'=${fixture.resources.localClientQuestionnaire.ruleVersion} and r->>'compiled_hash'=source.compiled_hash)as rule_matches,
      opportunity.id as opportunity_id,opportunity.status as opportunity_status,request.id as request_id,
      version.budget_minor::text as budget_minor,version.currency_code,version.description,request.client_organization_id,
      session.status as session_status,
      (select count(*)::int from public.audit_events a join public.event_outbox outbox on a.correlation_id=outbox.correlation_id where a.resource_id=request.id::text and a.action='rfq.request.created'and outbox.event_type='ServiceRequestCreatedV1')as request_evidence,
      (select count(*)::int from public.audit_events a join public.event_outbox outbox on a.correlation_id=outbox.correlation_id where a.resource_id=opportunity.id::text and a.action='diagnostic.opportunity.converted'and outbox.event_type='DiagnosticOpportunityConvertedV1')as conversion_evidence
      from public.diagnostic_runs d join public.questionnaire_session_evaluations e on e.session_id=d.questionnaire_session_id
      join public.questionnaire_session_snapshots snapshot on snapshot.id=e.session_snapshot_id
      join public.questionnaire_sessions session on session.id=e.session_id
      join public.diagnostic_opportunities opportunity on opportunity.diagnostic_run_id=d.id
      join public.service_requests request on request.id=opportunity.service_request_id
      join public.service_request_versions version on version.id=request.current_version_id
      where d.questionnaire_session_id=${item.sessionId}::uuid and d.status='COMPLETED'`;
    assert.equal(rows.length,1);const[proof]=rows;
    assert.ok(proof);assert.equal(proof.score,'50.00');assert.equal(proof.rating,'IMPORTANT');assert.equal(proof.score_basis_points,5000);
    for(const key of ['manifest_matches','evaluation_matches','reproducibility_matches','session_snapshot_matches','actions_match','authoritative_score','authoritative_source','policy_hash_matches'])assert.equal(proof[key],true);
    assert.equal(proof.actions,6);
    assert.equal(proof.rule_matches,1);assert.equal(proof.opportunity_status,'CONVERTED');assert.equal(proof.budget_minor,'125050');assert.equal(proof.currency_code,'MAD');assert.equal(proof.description,item.description);assert.equal(proof.client_organization_id,item.organizationId);assert.equal(proof.session_status,'SUBMITTED');assert.equal(proof.request_evidence,1);assert.equal(proof.conversion_evidence,1);
    const actors=fixture.resources.localJourneyActors;
    const client=actors?.[locale].client??fixture.sessions[locale==='fr'?'clientA':'clientB'].client,foreign=actors?.[locale==='fr'?'ar':'fr'].client??fixture.sessions[locale==='fr'?'clientB':'clientA'].client;
    const input={p_opportunity_id:proof.opportunity_id,p_payload:{},p_change_reason:'Vérification du rejeu local',p_correlation_id:randomUUID()};
    const replay=await rpc(client,'create_service_request_from_opportunity',input);assert.equal(replay.request_id,proof.request_id);assert.equal(replay.replayed,true);
    const denied=await foreign.rpc('create_service_request_from_opportunity',input);assert.equal(denied.error?.code,'42501');
    const needInput={p_intake_id:item.intakeId,p_service_code:item.serviceCode,p_payload:{description:`Besoin converti via SDK de recette ${locale}`,urgency:'NORMAL',desired_date:new Date(Date.now()+14*86400_000).toISOString().slice(0,10),budget_minor:'200000',currency_code:'MAD',region_code:'CASABLANCA_SETTAT',site_id:null},p_change_reason:'Conversion réelle du besoin de recette locale',p_correlation_id:randomUUID()};
    const need=await rpc(client,'create_service_request_from_need_intake',needInput);assert.equal(need.replayed,false);assert.notEqual(need.request_id,proof.request_id);
    const needReplay=await rpc(client,'create_service_request_from_need_intake',needInput);assert.equal(needReplay.request_id,need.request_id);assert.equal(needReplay.replayed,true);
    const deniedNeed=await foreign.rpc('create_service_request_from_need_intake',needInput);assert.equal(deniedNeed.error?.code,'42501');
    await verifyCommandEvidence(fixture.resources.database,[{organizationId:item.organizationId,correlationId:needInput.p_correlation_id,action:'rfq.request.created',eventType:'ServiceRequestCreatedV1'}]);
  }
  return {locales:['fr','ar'],realSdkIntakes:2,realSdkNeedConversions:2,submittedQuestionnaires:2,realUiDiagnostics:2,realUiRequests:2,publishedEvaluationScore:'50.00',publishedEvaluationAndRulesVerified:true,realUiOpportunityConversions:2,exactBudgetMinor:'125050',idempotenceAndOptimisticLockVerified:true,foreignSessionDenied:true};
}

export async function neutralizeLocalQuestionnaireReference(fixture) {
  const ids=fixture.resources.localClientQuestionnaire;
  if(!ids)return;
  await fixture.resources.database.begin(async tx=>{
    await tx.unsafe("set local session_replication_role='replica'");
    await tx`update public.questionnaire_versions set status='SUPERSEDED',superseded_at=clock_timestamp() where id=${ids.version}::uuid and status='PUBLISHED'`;
    await tx`update public.questionnaires set status='ARCHIVED',archived_at=clock_timestamp() where id=${ids.questionnaire}::uuid`;
    await tx`update public.question_versions set status='SUPERSEDED',superseded_at=clock_timestamp() where id=${ids.questionVersion}::uuid and status='PUBLISHED'`;
    await tx`update public.question_bank_questions set status='ARCHIVED',archived_at=clock_timestamp() where id=${ids.question}::uuid`;
    await tx`update public.question_rule_versions set status='SUPERSEDED',superseded_at=clock_timestamp()where id=${ids.ruleVersion}::uuid and status='PUBLISHED'`;
    await tx`update public.question_rules set status='ARCHIVED',archived_at=clock_timestamp()where id=${ids.rule}::uuid`;
  });
}
