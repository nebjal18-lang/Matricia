import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provision} from '../../../scripts/p05-e2e/provision.mjs';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';
import {prepareLocalFranchiseCrm,neutralizeLocalFranchiseCrm} from './local-franchise-crm-reference.mjs';
import {neutralizeLocalCatalogReference} from './local-catalog-reference.mjs';
import {createLocalQuestionnaireReference,neutralizeLocalQuestionnaireReference} from './local-client-journey-fixture.mjs';
import {ownedLocalHttpServer} from './owned-local-http-server.mjs';
const root=process.cwd(),directory=resolve(root,'artifacts/test-results',`.local-questionnaire-simulation-${randomUUID()}`);
let config,fixture,reference,server,summary,failure,proof,stage='configuration',cleanupVerified=true;
async function boundary(db,version){const [row]=await db`select (select count(*)::integer from public.questionnaire_sessions where questionnaire_version_id=${version}::uuid) sessions,(select snapshot_hash from public.questionnaire_versions where id=${version}::uuid) snapshot,(select row_version from public.questionnaire_versions where id=${version}::uuid) version`;return row;}
try{
 config=await loadSafeConfiguration(root);assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 fixture=await provision();await validateFreshManifest(fixture.manifest,config);await mkdir(directory,{recursive:true,mode:0o700});
 stage='historical-reference';reference=await prepareLocalFranchiseCrm(fixture,directory);const questionnaire=await createLocalQuestionnaireReference(fixture);
 const db=fixture.resources.database,client=fixture.sessions.noRole.client,foreign=fixture.sessions.clientB.client,before=await boundary(db,questionnaire.version);
 stage='workspace-native-preflight';
 const workspace=await client.rpc('franchise_catalog_workspace_v1',{p_franchise_id:reference.franchiseId,p_kind:'QUESTIONNAIRE',p_object_id:questionnaire.questionnaire});
 assert.equal(workspace.error,null);assert.ok(workspace.data.questionnaires.some(q=>q.id===questionnaire.questionnaire));assert.ok(workspace.data.questionVersions.some(q=>q.id===questionnaire.questionVersion));assert.ok(workspace.data.questionnaireQuestions.some(q=>q.question_version_id===questionnaire.questionVersion));
 stage='engine-native-preflight';
 const preview=await client.rpc('simulate_questionnaire_rule_engine',{p_questionnaire_version_id:questionnaire.version,p_answers:{[questionnaire.questionVersion]:0},p_previous_answers:{}});
 if(preview.error)throw Object.assign(new Error('SIMULATION_ENGINE_REFUSED'),{code:preview.error.code,reason:/^[A-Z][A-Z0-9_]{1,100}$/.test(preview.error.message)?preview.error.message:null});
 assert.equal(preview.data.score_basis_points,0);
 const path=resolve(directory,'manifest.json');await writeFile(path,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),reference,questionnaire}),{mode:0o600});
 stage='owned-server';server=ownedLocalHttpServer(root,config,{applicationEncryptionKey:randomBytes(32).toString('hex')});await server.start();
 stage='simulation-browser';summary=await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_EXTERNAL_SERVER:'1',E2E_LOCAL_SIMULATION_MANIFEST:path}),specifications:['tests/e2e/local-questionnaire-simulation.spec.ts'],output:resolve(directory,'browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']});
 stage='simulation-native-proof';
 for(const answer of [0,1]){
  const args={p_questionnaire_version_id:questionnaire.version,p_answers:{[questionnaire.questionVersion]:answer},p_previous_answers:{}};
  const result=await client.rpc('simulate_questionnaire_rule_engine',args);assert.equal(result.error,null);assert.equal(result.data.score_basis_points,answer*5000);assert.equal(result.data.engine_version,'2.0.0');assert.equal(result.data.simulation,true);
  assert.equal(result.data.triggered_actions.length,answer===1?6:0);
  const repeat=await client.rpc('simulate_questionnaire_rule_engine',args);assert.equal(repeat.error,null);assert.deepEqual(repeat.data,result.data);
  const denied=await foreign.rpc('simulate_questionnaire_rule_engine',args);assert.equal(denied.error?.code,'42501');
 }
 const invalid=await client.rpc('simulate_questionnaire_rule_engine',{p_questionnaire_version_id:questionnaire.version,p_answers:{[questionnaire.questionVersion]:2},p_previous_answers:{}});assert.ok(invalid.error);
 assert.deepEqual(await boundary(db,questionnaire.version),before);assert.equal(before.sessions,0);
 proof={realUiScenarioEvaluations:8,realUiInvalidAnswerRejections:4,zeroAndFiveThousandScores:true,deterministicNativeEvaluation:true,foreignSimulationDenied:true,publishedSnapshotUnchanged:true,noRealQuestionnaireSessionCreated:true,historicalPublishedReference:true,frArDesktop360Accessibility:true};
}catch(error){failure=error;summary??=error.browserSummary;}
finally{
 for(const cleanup of[()=>server?.stop(),()=>fixture&&neutralizeLocalQuestionnaireReference(fixture),()=>fixture&&neutralizeLocalFranchiseCrm(fixture),()=>fixture&&neutralizeLocalCatalogReference(fixture),()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}
}
const failureLocations=[...(failure?.stack??'').matchAll(/([^\s/\\()]+\.(?:mjs|ts)):(\d+):(\d+)/gu)].slice(0,4).map(m=>({file:m[1],line:Number(m[2]),column:Number(m[3])}));
await writeLocalSuiteEvidence({root,suite:'questionnaire-simulation',config,summary,failure,cleanupVerified,proof:{...proof,stage,failureLocations,engineReason:failure?.reason??null}});
if(failure){console.error('LOCAL_QUESTIONNAIRE_SIMULATION_FAILED');process.exitCode=1;}else console.log('LOCAL_QUESTIONNAIRE_SIMULATION_PASSED');
