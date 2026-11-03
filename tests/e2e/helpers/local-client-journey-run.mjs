import { randomUUID } from 'node:crypto';
import { mkdir,readFile,rm,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSafeConfiguration } from '../../../scripts/p05-e2e/environment.mjs';
import { provision } from '../../../scripts/p05-e2e/provision.mjs';
import { buildChildEnvironment,validateFreshManifest } from '../../../scripts/p05-e2e/security.mjs';
import { provisionLocalCatalogReference,neutralizeLocalCatalogReference } from './local-catalog-reference.mjs';
import { prepareLocalClientJourneys,verifyLocalClientJourneys,neutralizeLocalQuestionnaireReference } from './local-client-journey-fixture.mjs';
import { runSecuredBrowserSuite,writeLocalSuiteEvidence } from './secured-browser-runner.mjs';
import { provisionLocalUiAuthFixture,verifyLocalUiAuthProof,neutralizeLocalUiAuthFixture } from './local-ui-auth-fixture.mjs';
import { activateUiRegisteredClients,persistCurrentLocalActorState } from './local-client-activation-fixture.mjs';
import {prepareLinkedLocalProviderReference,neutralizeLinkedLocalProviderReference} from './local-linked-provider-reference.mjs';
import {cleanLocalQuoteIdentityFiles} from './local-provider-identity-fixture.mjs';
import {createLinkedLocalContractPolicies,publishLinkedLocalFiscalMapping,publishLinkedLocalChecklist,createLinkedLocalSignaturePolicy,createLinkedLocalContract,archiveLinkedLocalContractPdfs,verifyLinkedLocalCanonicalPdfRetention,completeLinkedLocalMockSignature,completeLinkedLocalMission,verifyLinkedLocalBoundStorageGuards,disableLinkedLocalSignaturePolicies,clearLinkedLocalExtraPlatformRoles,clearLinkedLocalArtifacts,clearLinkedLocalDeliveryFiles} from './linked-commercial-commands.mjs';
import {ownedLocalHttpServer} from './owned-local-http-server.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const directory=resolve(root,'artifacts/test-results',`.local-client-journey-${randomUUID()}`);
let config,fixture,summary,failure,proof,httpServer;let cleanupFailed=false;
let stage='configuration',failedCommandStage;
const historicalOnly=process.argv.includes('--historical-active-only');
const commercial=process.argv.includes('--linked-commercial');
if(process.argv.slice(2).some(arg=>!['--historical-active-only','--linked-commercial'].includes(arg))||commercial&&historicalOnly)throw new Error('LOCAL_JOURNEY_ARGUMENTS_INVALID');
const summaries=[];
function codeLocations(error){return[...(error?.stack??'').matchAll(/(?:file:\/\/)?([^\s()]+?\.(?:mjs|cjs|js|ts)):(\d+):(\d+)/gu)].slice(0,4).map(match=>({file:match[1].split('/').at(-1),line:Number(match[2]),column:Number(match[3])}));}
function aggregate(){return summaries.length?{executed:summaries.reduce((n,s)=>n+s.executed,0),passed:summaries.reduce((n,s)=>n+s.passed,0),failed:summaries.reduce((n,s)=>n+s.failed,0),skipped:summaries.reduce((n,s)=>n+s.skipped,0),flaky:summaries.reduce((n,s)=>n+s.flaky,0),failures:summaries.flatMap(s=>s.failures),startedAt:summaries[0].startedAt,finishedAt:summaries.at(-1).finishedAt}:null;}
try{
 config=await loadSafeConfiguration(root);
 if(config.runtimeMode!=='isolated-local-docker'||!config.localDockerVerified)throw new Error('LOCAL_DOCKER_MODE_REQUIRED');
 stage='base-fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);
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
 await provisionLocalCatalogReference(fixture);
 let provider,policies,checklist,signaturePolicy;
 if(commercial){
  stage='commercial-historical-qualified-provider-reference';provider=await prepareLinkedLocalProviderReference(fixture);
  stage='commercial-real-policies-and-checklist';
  policies=await createLinkedLocalContractPolicies(fixture,{libraryId:fixture.resources.localCatalog.library,serviceId:fixture.resources.localCatalog.service});
  await publishLinkedLocalFiscalMapping(fixture,provider);
  checklist=await publishLinkedLocalChecklist(fixture);signaturePolicy=await createLinkedLocalSignaturePolicy(fixture);
 }
 stage='real-sdk-client-commands';
 const cases=await prepareLocalClientJourneys(fixture,activatedActors);
 const manifestPath=resolve(directory,'manifest.json');
 await writeFile(manifestPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),cases}),{mode:0o600});
 const environment=buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_CLIENT_JOURNEY_MANIFEST:manifestPath});
 stage='browser';summaries.push(await runSecuredBrowserSuite({root,config,environment,specifications:['tests/e2e/local-client-journey.spec.ts'],output:resolve(directory,'browser'),expectedTests:2,projects:['chromium-desktop']}));summary=aggregate();
 stage='persistence-and-isolation';
 proof={...proof,...await verifyLocalClientJourneys(fixture,cases)};
 if(commercial){
  stage='commercial-owned-local-http-server';httpServer=ownedLocalHttpServer(root,config);await httpServer.start();
  const chains={};
  for(const locale of ['fr','ar']){
   stage=`commercial-${locale}-contract`;
   let chain=await createLinkedLocalContract(fixture,{locale,clientCase:cases[locale],provider,policies,taxRuleVersionId:provider.taxRuleVersionId});
   stage=`commercial-${locale}-canonical-pdf-fr-ar`;chain=await archiveLinkedLocalContractPdfs(fixture,chain);
   stage=`commercial-${locale}-governed-dev-signature`;chain=await completeLinkedLocalMockSignature(fixture,{chain,provider,signaturePolicy});
   stage=`commercial-${locale}-private-delivery-and-reception`;chain=await completeLinkedLocalMission(fixture,{chain,provider,checklist});
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
  stage='commercial-native-storage-retention-and-revoked-member';
  const storageGuards=await verifyLinkedLocalBoundStorageGuards(fixture,{chains,provider});
  proof={...proof,...storageGuards,linkedCommercialChains:2,sameRequestToAcceptedDeliveryVerified:true,governedDevelopmentMockSignatures:2,contractualSignatureValidated:false,providerQualificationIsHistoricalPrecondition:true,taxReferenceIsSyntheticHistoricalPrecondition:true,realCanonicalContractPolicyReviews:true,realReviewedFiscalServiceMapping:true,realCanonicalPdfPairs:2,canonicalPdfCacheAndForeignDenialVerified:true,realPublishedChecklists:true,realPrivateDeliveryFiles:2,receptionBeforeScanDenied:true,foreignDeliveryAccessDenied:true,malwareEngineExternal:false,stageHashes:Object.fromEntries(Object.entries(chains).map(([locale,chain])=>[locale,{chainHash:chain.chainHash,contractHash:chain.contractHash,signatureFinalHash:chain.signatureFinalHash,deliverySha256:chain.deliverySha256,sourcePdfFrSha256:chain.canonicalPdfs.fr.sha256,sourcePdfArSha256:chain.canonicalPdfs.ar.sha256}]))};
 }
}catch(error){failure=error;failedCommandStage=fixture?.resources.localCommercialStage;if(error.browserSummary)summaries.push(error.browserSummary);summary=aggregate();}
finally{
 for(const cleanup of [()=>httpServer?.stop(),()=>commercial&&fixture&&disableLinkedLocalSignaturePolicies(fixture),()=>commercial&&fixture&&verifyLinkedLocalCanonicalPdfRetention(fixture),()=>commercial&&fixture&&clearLinkedLocalArtifacts(fixture),()=>commercial&&fixture&&clearLinkedLocalDeliveryFiles(fixture),()=>commercial&&fixture&&neutralizeLinkedLocalProviderReference(fixture),()=>commercial&&fixture&&cleanLocalQuoteIdentityFiles(fixture),()=>commercial&&fixture&&clearLinkedLocalExtraPlatformRoles(fixture),()=>fixture&&neutralizeLocalUiAuthFixture(fixture),()=>fixture&&neutralizeLocalQuestionnaireReference(fixture),()=>fixture&&neutralizeLocalCatalogReference(fixture),()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})]){
  try{await cleanup();}catch(error){cleanupFailed=true;failure??=error;}
 }
}
await writeLocalSuiteEvidence({root,suite:commercial?'linked-commercial':'client-journey',config,summary,failure,cleanupVerified:!cleanupFailed,proof:{...proof,stage,commandStage:commercial?failedCommandStage??fixture?.resources.localCommercialStage:null,activationStage:fixture?.resources.localActivationStage??null,lastThreeActivationStepsOk:fixture?.resources.localActivationLastOk?.slice(-3)??[],failureLocations:codeLocations(failure),assertionResponseCode:typeof failure?.actual?.code==='string'&&/^[A-Za-z0-9_]{1,64}$/u.test(failure.actual.code)?failure.actual.code:null,assertionResponseStatus:Number.isInteger(failure?.actual?.status)?failure.actual.status:null,commandDiagnostic:fixture?.resources.localCommercialCommandDiagnostic??null,lastThreeCommercialStepsOk:fixture?.resources.localCommercialLastOk?.slice(-3)??[],completedCommercialFacts:fixture?.resources.localCommercialFacts??[],httpDiagnostic:fixture?.resources.localCommercialHttpDiagnostic??null,storageDiagnostic:fixture?.resources.localCommercialStorageDiagnostic??null,retainedPrivateSyntheticCanonicalPdfs:commercial?fixture?.resources.localCommercialRetainedCanonicalPdfFiles??0:0,retainedPrivateSyntheticBoundDeliveryFiles:commercial?fixture?.resources.localCommercialRetainedDeliveryFiles??0:0,mode:commercial?'REAL_UI_SIGNUP_TO_NATIVE_ACCEPTED_DELIVERY_WITH_DEV_MOCK':historicalOnly?'HISTORICAL_ACTIVE_ORGANIZATION_SEGMENT':'REAL_UI_SIGNUP_ACTIVATION_TO_REQUEST',activeOrganizationsAreHistoricalPreconditions:historicalOnly,publishedCatalogueAndQuestionnaireAreHistoricalPreconditions:true}});
if(failure){console.error(`FAIL local Client journey (${failure.code??'LOCAL_JOURNEY_FAILED'}); private output discarded`);process.exitCode=1;}
else console.log('PASS local Client journey: real SDK mutations, UI diagnostic/request, exact budget, replay/tenant denial and cleanup');
