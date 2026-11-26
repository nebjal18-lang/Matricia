import {prepareLocalDiagnosticHistory,verifyLocalDiagnosticHistory} from './local-diagnostic-history.mjs';
import {verifyLocalQuestionQuality} from './local-question-quality.mjs';
import {prepareLocalSolutionBundles,verifyLocalSolutionBundles,cleanupLocalBundleReference} from './local-solution-bundles.mjs';
import {prepareLocalSolutionDecisions,verifyLocalSolutionDecisions} from './local-solution-decisions.mjs';
import { randomUUID } from 'node:crypto';
import {prepareQuestionnaireRevalidation,verifyQuestionnaireRevalidation} from './local-questionnaire-revalidation.mjs';
import {prepareQuestionnaireAssistance,verifyQuestionnaireAssistance} from './local-questionnaire-assistance.mjs';
import {pauseFavoriteProvider,verifyLocalFavorites} from './local-favorite-proof.mjs';
import { mkdir,readFile,rm,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSafeConfiguration } from '../../../scripts/p05-e2e/environment.mjs';
import { provision } from '../../../scripts/p05-e2e/provision.mjs';
import { buildChildEnvironment,validateFreshManifest } from '../../../scripts/p05-e2e/security.mjs';
import { provisionLocalCatalogReference,neutralizeLocalCatalogReference } from './local-catalog-reference.mjs';
import { prepareLocalClientJourneys,verifyLocalClientJourneys,neutralizeLocalQuestionnaireReference } from './local-client-journey-fixture.mjs';
import { runSecuredBrowserSuite as executeBrowserSuite,writeLocalSuiteEvidence } from './secured-browser-runner.mjs';
import { provisionLocalUiAuthFixture,verifyLocalUiAuthProof,neutralizeLocalUiAuthFixture } from './local-ui-auth-fixture.mjs';
import { activateUiRegisteredClients,persistCurrentLocalActorState } from './local-client-activation-fixture.mjs';
import {prepareLinkedLocalProviderReference,neutralizeLinkedLocalProviderReference} from './local-linked-provider-reference.mjs';
import {cleanLocalQuoteIdentityFiles} from './local-provider-identity-fixture.mjs';
import {createLinkedLocalContractPolicies,publishLinkedLocalFiscalMapping,publishLinkedLocalChecklist,createLinkedLocalSignaturePolicy,createLinkedLocalContract,archiveLinkedLocalContractPdfs,verifyLinkedLocalCanonicalPdfRetention,completeLinkedLocalMockSignature,completeLinkedLocalMission,verifyLinkedLocalBoundStorageGuards,disableLinkedLocalSignaturePolicies,clearLinkedLocalExtraPlatformRoles,clearLinkedLocalArtifacts,clearLinkedLocalDeliveryFiles} from './linked-commercial-commands.mjs';
import {ownedLocalHttpServer} from './owned-local-http-server.mjs';
import {verifyLocalRecurringRequests} from './local-recurring-proof.mjs';
import {prepareLocalReputation,collectLocalReputation,verifyLocalReputation} from './local-reputation-proof.mjs';
import {cleanReputationFinance} from './local-reputation-finance.mjs';
import {activateLocalAmendments,verifyLocalAmendmentExecutions} from './local-amendment-activation.mjs';
import {verifyLocalAmendments} from './local-amendment-proof.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const directory=resolve(root,'artifacts/test-results',`.local-client-journey-${randomUUID()}`);
let config,fixture,summary,failure,proof,httpServer;let cleanupFailed=false;
let stage='configuration',failedCommandStage;
const historicalOnly=process.argv.includes('--historical-active-only');
const favorites=process.argv.includes('--favorites');
const reputation=process.argv.includes('--reputation');
const amendmentActivation=process.argv.includes('--amendment-activation');
const amendments=process.argv.includes('--amendments')||amendmentActivation;
const commercial=process.argv.includes('--linked-commercial')||favorites||reputation||amendments;
const quality=process.argv.includes('--quality');
const history=process.argv.includes('--history');
const bundles=process.argv.includes('--bundles');
const solutions=process.argv.includes('--solutions');
const recurring=process.argv.includes('--recurring');
const revalidation=process.argv.includes('--revalidation');
const assistance=process.argv.includes('--assistance');
if((solutions||bundles||quality||history)&&process.argv.length!==3)throw new Error('LOCAL_SOLUTION_ARGUMENTS_INVALID');
if(process.argv.slice(2).some(arg=>!['--historical-active-only','--linked-commercial','--recurring','--favorites','--revalidation','--assistance','--reputation','--amendments','--amendment-activation','--solutions','--bundles','--quality','--history'].includes(arg))||[reputation,favorites,amendments].filter(Boolean).length>1||commercial&&(historicalOnly||recurring||revalidation||assistance)||revalidation&&(historicalOnly||recurring||assistance)||assistance&&(historicalOnly||recurring))throw new Error('LOCAL_JOURNEY_ARGUMENTS_INVALID');
const summaries=[];
// Reuse only this run's owned server; preserve fixture isolation and final cleanup.
async function runSecuredBrowserSuite(options){
 if(!httpServer){
  httpServer=ownedLocalHttpServer(root,config);
  await httpServer.start();
 }
 return executeBrowserSuite({...options,environment:{...options.environment,E2E_EXTERNAL_SERVER:'1'}});
}
function codeLocations(error){return[...(error?.stack??'').matchAll(/(?:file:\/\/)?([^\s()]+?\.(?:mjs|cjs|js|ts)):(\d+):(\d+)/gu)].slice(0,4).map(match=>({file:match[1].split('/').at(-1),line:Number(match[2]),column:Number(match[3])}));}
function aggregate(){return summaries.length?{executed:summaries.reduce((n,s)=>n+s.executed,0),passed:summaries.reduce((n,s)=>n+s.passed,0),failed:summaries.reduce((n,s)=>n+s.failed,0),skipped:summaries.reduce((n,s)=>n+s.skipped,0),flaky:summaries.reduce((n,s)=>n+s.flaky,0),failures:summaries.flatMap(s=>s.failures),startedAt:summaries[0].startedAt,finishedAt:summaries.at(-1).finishedAt}:null;}
try{
 config=await loadSafeConfiguration(root);
 if(config.runtimeMode!=='isolated-local-docker'||!config.localDockerVerified)throw new Error('LOCAL_DOCKER_MODE_REQUIRED');
 stage='base-fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);
 if(amendmentActivation){
  stage='casablanca-runtime-parity';
  const rows=await fixture.resources.database`select d::text sample_date,extract(epoch from(d at time zone 'Africa/Casablanca'))::text epoch from unnest(array['2024-01-15 14:30','2024-03-15 14:30','2026-09-19 14:30','2026-09-21 14:30','2026-12-03 14:30']::timestamp[])d`;
  for(const row of rows){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(Number(row.epoch)*1000));const part=t=>parts.find(p=>p.type===t)?.value;if(`${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`!==row.sample_date.slice(0,16))throw new Error('LOCAL_CASABLANCA_RUNTIME_MISMATCH');}
 }
 await mkdir(directory,{recursive:true,mode:0o700});
 let activatedActors;
 if(!historicalOnly){
  stage='real-ui-registration-and-mfa';
  const authPath=await provisionLocalUiAuthFixture(fixture,fixture.manifest.runId,directory);
  const authManifest=JSON.parse(await readFile(authPath,'utf8'));
  authManifest.registrationStatePaths=Object.fromEntries(['fr','ar'].map(locale=>[locale,resolve(directory,`registered-${locale}.json`)]));
  authManifest.centralStatePaths=Object.fromEntries(['fr','ar'].map(locale=>[locale,resolve(directory,`reviewer-${locale}.json`)]));
  await writeFile(authPath,JSON.stringify(authManifest),{mode:0o600});
  const authEnvironment=buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_UI_AUTH_MANIFEST:authPath});
  summaries.push(await runSecuredBrowserSuite({root,config,environment:authEnvironment,specifications:['tests/e2e/local-auth-consent.spec.ts'],output:resolve(directory,'auth-browser'),expectedTests:4,projects:['chromium-desktop']}));
  proof=await verifyLocalUiAuthProof(fixture);
  stage='real-profile-documents-and-activation';
  const activated=await activateUiRegisteredClients(fixture,authManifest);activatedActors=activated.actors;proof={...proof,...activated.proof};
 }
 stage='local-reference';
 await provisionLocalCatalogReference(fixture, { recurringEligible: recurring });
 let provider,policies,checklist,signaturePolicy;
 if(commercial){
  stage='commercial-historical-qualified-provider-reference';provider=await prepareLinkedLocalProviderReference(fixture);
  stage='commercial-real-policies-and-checklist';
  policies=await createLinkedLocalContractPolicies(fixture,{libraryId:fixture.resources.localCatalog.library,serviceId:fixture.resources.localCatalog.service});
  await publishLinkedLocalFiscalMapping(fixture,provider);
  checklist=await publishLinkedLocalChecklist(fixture);signaturePolicy=await createLinkedLocalSignaturePolicy(fixture);
 }
 stage='real-sdk-client-commands';
 const cases=await prepareLocalClientJourneys(fixture,activatedActors,revalidation?{validitySeconds:60}:assistance?{assistance:true}:quality?{quality:true}:undefined);
 const manifestPath=resolve(directory,'manifest.json');
 await writeFile(manifestPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),cases}),{mode:0o600});
 const environment=buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_CLIENT_JOURNEY_MANIFEST:manifestPath});
 stage='browser';summaries.push(await runSecuredBrowserSuite({root,config,environment,specifications:['tests/e2e/local-client-journey.spec.ts'],output:resolve(directory,'browser'),expectedTests:2,projects:['chromium-desktop']}));summary=aggregate();
 stage='persistence-and-isolation';
 proof={...proof,...await verifyLocalClientJourneys(fixture,cases)};
 if(history){
  stage='history-native-preparation';const items=await prepareLocalDiagnosticHistory(fixture,cases),historyPath=resolve(directory,'history.json');
  await writeFile(historyPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),items}),{mode:0o600});
  stage='history-browser';summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_HISTORY_MANIFEST:historyPath}),specifications:['tests/e2e/local-diagnostic-history.spec.ts'],output:resolve(directory,'history-browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
  stage='history-native-proof';proof={...proof,...await verifyLocalDiagnosticHistory(fixture,items)};
 }
 if(quality){
  stage='quality-browser';const qualityPath=resolve(directory,'quality.json'),receipts=resolve(directory,'quality-receipts');await mkdir(receipts,{recursive:true,mode:0o700});
  await writeFile(qualityPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),cases,questionVersionIds:fixture.resources.localClientQuestionnaire.qualityQuestions.map(q=>q.version)}),{mode:0o600});
  summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_QUALITY_MANIFEST:qualityPath,E2E_LOCAL_QUALITY_RECEIPTS:receipts}),specifications:['tests/e2e/local-question-quality.spec.ts'],output:resolve(directory,'quality-browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
  stage='quality-native-proof';proof={...proof,...await verifyLocalQuestionQuality(fixture,cases,receipts)};
 }
 if(bundles){
  stage='bundles-native-publication';const items=await prepareLocalSolutionBundles(fixture,cases),bundlesPath=resolve(directory,'bundles.json');
  await writeFile(bundlesPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),items}),{mode:0o600});
  stage='bundles-browser';summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_BUNDLES_MANIFEST:bundlesPath}),specifications:['tests/e2e/local-solution-bundles.spec.ts'],output:resolve(directory,'bundles-browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
  stage='bundles-native-proof';proof={...proof,...await verifyLocalSolutionBundles(fixture,items)};
 }
 if(solutions){
  stage='solutions-native-creation';const items=await prepareLocalSolutionDecisions(fixture,cases),solutionsPath=resolve(directory,'solutions.json'),receipts=resolve(directory,'solution-receipts');await mkdir(receipts,{recursive:true,mode:0o700});
  await writeFile(solutionsPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),items}),{mode:0o600});
  stage='solutions-browser';summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_SOLUTIONS_MANIFEST:solutionsPath,E2E_LOCAL_SOLUTIONS_RECEIPTS:receipts}),specifications:['tests/e2e/local-solution-decisions.spec.ts'],output:resolve(directory,'solutions-browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
  stage='solutions-native-proof';proof={...proof,...await verifyLocalSolutionDecisions(fixture,items,receipts)};
 }
 if(assistance){
  for(const phase of ['fresh','expired']){
   stage=`questionnaire-assistance-${phase}-prepare`;
   const items=await prepareQuestionnaireAssistance(fixture,cases,phase),assistancePath=resolve(directory,`assistance-${phase}.json`);
   await writeFile(assistancePath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),items,phase}),{mode:0o600});
   stage=`questionnaire-assistance-${phase}-browser`;
   summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_ASSISTANCE_MANIFEST:assistancePath}),specifications:['tests/e2e/local-questionnaire-assistance.spec.ts'],output:resolve(directory,`assistance-${phase}-browser`),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
  }
  stage='questionnaire-assistance-native-proof';proof={...proof,...await verifyQuestionnaireAssistance(fixture)};
 }
 if(revalidation){
  stage='real-questionnaire-expiration';
  const items=await prepareQuestionnaireRevalidation(fixture,cases);
  const revalidationPath=resolve(directory,'revalidation.json');
  await writeFile(revalidationPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),items}),{mode:0o600});
  stage='questionnaire-revalidation-browser';
  summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_REVALIDATION_MANIFEST:revalidationPath}),specifications:['tests/e2e/local-questionnaire-revalidation.spec.ts'],output:resolve(directory,'revalidation-browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
  stage='questionnaire-revalidation-native-proof';proof={...proof,...await verifyQuestionnaireRevalidation(fixture,items)};
 }
 if(recurring){
  stage='recurring-browser';
  summaries.push(await runSecuredBrowserSuite({root,config,environment,specifications:['tests/e2e/local-recurring-requests.spec.ts'],output:resolve(directory,'recurring-browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
  stage='recurring-native-proof';proof={...proof,...await verifyLocalRecurringRequests(fixture,cases)};
 }
 if(commercial){
  // Earlier browser phases already started this run's owned server.
  const chains={};
  for(const locale of ['fr','ar']){
   stage=`commercial-${locale}-contract`;
   let chain=await createLinkedLocalContract(fixture,{locale,clientCase:cases[locale],provider,policies,taxRuleVersionId:provider.taxRuleVersionId});
   stage=`commercial-${locale}-canonical-pdf-fr-ar`;chain=await archiveLinkedLocalContractPdfs(fixture,chain);
   stage=`commercial-${locale}-governed-dev-signature`;chain=await completeLinkedLocalMockSignature(fixture,{chain,provider,signaturePolicy});
   stage=`commercial-${locale}-private-delivery-and-reception`;chain=await completeLinkedLocalMission(fixture,{chain,provider,checklist,leaveReceptionPending:amendments});
   chains[locale]={...chain,state:cases[locale].state,foreignState:cases[locale].foreignState,providerState:fixture.manifest.states.noRole.path};
  }
  const currentStates={};
  for(const locale of ['fr','ar'])currentStates[locale]=await persistCurrentLocalActorState(fixture,fixture.resources.localJourneyActors[locale],resolve(directory,`commercial-current-${locale}.json`));
  const providerState=await persistCurrentLocalActorState(fixture,provider,resolve(directory,'commercial-current-provider.json'));
  for(const locale of ['fr','ar'])Object.assign(chains[locale],{state:currentStates[locale],foreignState:currentStates[locale==='fr'?'ar':'fr'],providerState});
  stage='commercial-both-parties-browser';
  const commercialPath=resolve(directory,'commercial.json');await writeFile(commercialPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),chains}),{mode:0o600});
  const commercialEnvironment=buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_LINKED_COMMERCIAL_MANIFEST:commercialPath,E2E_EXTERNAL_SERVER:'1'});
  summaries.push(await runSecuredBrowserSuite({root,config,environment:commercialEnvironment,specifications:['tests/e2e/local-linked-commercial.spec.ts'],output:resolve(directory,'commercial-browser'),expectedTests:2,projects:['chromium-desktop']}));summary=aggregate();
  if(amendments){
   stage='amendments-browser';const receipts=resolve(directory,'amendment-receipts');await mkdir(receipts,{recursive:true,mode:0o700});
   summaries.push(await runSecuredBrowserSuite({root,config,environment:{...commercialEnvironment,E2E_LOCAL_AMENDMENT_RECEIPTS:receipts},specifications:['tests/e2e/local-contract-amendments.spec.ts'],output:resolve(directory,'amendments-browser'),expectedTests:8,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
   stage='amendments-native-proof';proof={...proof,...await verifyLocalAmendments(fixture,chains,provider,receipts)};
   if(amendmentActivation){
    stage='amendments-sign-and-activate';const amendmentExecutions=await activateLocalAmendments(fixture,chains,provider,receipts);
    await writeFile(commercialPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),chains,amendmentExecutions}),{mode:0o600});
    for(const project of ['chromium-desktop','chromium-mobile-360']){
     stage='amendments-execution-browser';summaries.push(await runSecuredBrowserSuite({root,config,environment:{...commercialEnvironment,E2E_LOCAL_AMENDMENT_RECEIPTS:receipts},specifications:['tests/e2e/local-amendment-execution.spec.ts'],output:resolve(directory,`amendment-execution-${project}`),expectedTests:2,projects:[project]}));summary=aggregate();
    }
    stage='amendments-execution-proof';proof={...proof,...await verifyLocalAmendmentExecutions(fixture,chains,provider,amendmentExecutions,receipts)};
   }
  }
  if(reputation){
   stage='reputation-native-feedback-and-policy';
   const reference=await prepareLocalReputation(fixture,chains,provider),reputationPath=resolve(directory,'reputation.json');
   for(const phase of ['refresh','publish','provider']){
    if(phase==='publish'){stage='reputation-no-automatic-publication';reference.items=await collectLocalReputation(fixture);}
    await writeFile(reputationPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),reputation:reference}),{mode:0o600});
    stage=`reputation-${phase}-browser`;
    summaries.push(await runSecuredBrowserSuite({root,config,environment:{...commercialEnvironment,E2E_LOCAL_REPUTATION_MANIFEST:reputationPath,E2E_REPUTATION_PHASE:phase},specifications:['tests/e2e/local-provider-reputation.spec.ts'],output:resolve(directory,`reputation-${phase}`),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
   }
   stage='reputation-native-proof';proof={...proof,...await verifyLocalReputation(fixture)};
  }
  if(favorites){
   for(const phase of ['eligible','paused']){
    stage=`favorite-${phase}-browser`;
    if(phase==='paused')await pauseFavoriteProvider(fixture,provider);
    summaries.push(await runSecuredBrowserSuite({root,config,environment:{...commercialEnvironment,E2E_FAVORITE_PHASE:phase},specifications:['tests/e2e/local-provider-favorites.spec.ts'],output:resolve(directory,`favorite-${phase}`),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
    stage=`favorite-${phase}-native-proof`;const favoriteProof=await verifyLocalFavorites(fixture,chains,phase==='paused');
    if(phase==='paused')proof={...proof,...favoriteProof};
   }
  }
  stage='commercial-native-storage-retention-and-revoked-member';
  const storageGuards=await verifyLinkedLocalBoundStorageGuards(fixture,{chains,provider});
  proof={...proof,...storageGuards,linkedCommercialChains:2,sameRequestToAcceptedDeliveryVerified:!amendments,activeContractWithSubmittedDeliveryVerified:amendments,governedDevelopmentMockSignatures:2,contractualSignatureValidated:false,providerQualificationIsHistoricalPrecondition:true,taxReferenceIsSyntheticHistoricalPrecondition:true,realCanonicalContractPolicyReviews:true,realReviewedFiscalServiceMapping:true,realCanonicalPdfPairs:2,canonicalPdfCacheAndForeignDenialVerified:true,realPublishedChecklists:true,realPrivateDeliveryFiles:2,receptionBeforeScanDenied:true,foreignDeliveryAccessDenied:true,malwareEngineExternal:false,stageHashes:Object.fromEntries(Object.entries(chains).map(([locale,chain])=>[locale,{chainHash:chain.chainHash,contractHash:chain.contractHash,signatureFinalHash:chain.signatureFinalHash,deliverySha256:chain.deliverySha256,sourcePdfFrSha256:chain.canonicalPdfs.fr.sha256,sourcePdfArSha256:chain.canonicalPdfs.ar.sha256}]))};
 }
}catch(error){failure=error;failedCommandStage=fixture?.resources.localCommercialStage;if(error.browserSummary)summaries.push(error.browserSummary);summary=aggregate();}
finally{
 for(const cleanup of [()=>httpServer?.stop(),()=>reputation&&fixture&&cleanReputationFinance(fixture),()=>commercial&&fixture&&disableLinkedLocalSignaturePolicies(fixture),()=>commercial&&fixture&&verifyLinkedLocalCanonicalPdfRetention(fixture),()=>commercial&&fixture&&clearLinkedLocalArtifacts(fixture),()=>commercial&&fixture&&clearLinkedLocalDeliveryFiles(fixture),()=>commercial&&fixture&&neutralizeLinkedLocalProviderReference(fixture),()=>commercial&&fixture&&cleanLocalQuoteIdentityFiles(fixture),()=>commercial&&fixture&&clearLinkedLocalExtraPlatformRoles(fixture),()=>fixture&&neutralizeLocalUiAuthFixture(fixture),()=>fixture&&neutralizeLocalQuestionnaireReference(fixture),()=>bundles&&fixture&&cleanupLocalBundleReference(fixture),()=>fixture&&neutralizeLocalCatalogReference(fixture),()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})]){
  try{await cleanup();}catch(error){cleanupFailed=true;failure??=error;}
 }
}
await writeLocalSuiteEvidence({root,suite:history?'diagnostic-history':quality?'question-quality':bundles?'solution-bundles':solutions?'solution-decisions':amendmentActivation?'amendment-activation':amendments?'contract-amendments':reputation?'provider-reputation':assistance?'questionnaire-assistance':revalidation?'questionnaire-revalidation':favorites?'provider-favorites':recurring?'recurring-requests':commercial?'linked-commercial':'client-journey',config,summary,failure,cleanupVerified:!cleanupFailed,proof:{...proof,stage,commandStage:commercial?failedCommandStage??fixture?.resources.localCommercialStage:null,activationStage:fixture?.resources.localActivationStage??null,lastThreeActivationStepsOk:fixture?.resources.localActivationLastOk?.slice(-3)??[],failureLocations:codeLocations(failure),assertionResponseCode:typeof failure?.actual?.code==='string'&&/^[A-Za-z0-9_]{1,64}$/u.test(failure.actual.code)?failure.actual.code:null,assertionResponseReason:typeof failure?.actual?.message==='string'&&/^[A-Z][A-Z0-9_]{1,119}$/u.test(failure.actual.message)?failure.actual.message:null,assertionResponseStatus:Number.isInteger(failure?.actual?.status)?failure.actual.status:null,commandDiagnostic:fixture?.resources.localCommercialCommandDiagnostic??null,lastThreeCommercialStepsOk:fixture?.resources.localCommercialLastOk?.slice(-3)??[],completedCommercialFacts:fixture?.resources.localCommercialFacts??[],httpDiagnostic:fixture?.resources.localCommercialHttpDiagnostic??null,storageDiagnostic:fixture?.resources.localCommercialStorageDiagnostic??null,retainedPrivateSyntheticCanonicalPdfs:commercial?fixture?.resources.localCommercialRetainedCanonicalPdfFiles??0:0,retainedPrivateSyntheticBoundDeliveryFiles:commercial?fixture?.resources.localCommercialRetainedDeliveryFiles??0:0,mode:amendments?'REAL_UI_SIGNUP_TO_ACTIVE_CONTRACT_AMENDMENT_DRAFTS_WITH_DEV_MOCK':commercial?'REAL_UI_SIGNUP_TO_NATIVE_ACCEPTED_DELIVERY_WITH_DEV_MOCK':historicalOnly?'HISTORICAL_ACTIVE_ORGANIZATION_SEGMENT':'REAL_UI_SIGNUP_ACTIVATION_TO_REQUEST',activeOrganizationsAreHistoricalPreconditions:historicalOnly,publishedCatalogueAndQuestionnaireAreHistoricalPreconditions:true}});
if(failure){console.error(`FAIL local Client journey (${failure.code??'LOCAL_JOURNEY_FAILED'}); private output discarded`);process.exitCode=1;}
else console.log('PASS local Client journey: real SDK mutations, UI diagnostic/request, exact budget, replay/tenant denial and cleanup');
