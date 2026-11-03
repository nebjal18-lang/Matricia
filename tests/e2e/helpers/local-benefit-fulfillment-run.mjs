import {randomUUID}from'node:crypto';
import {mkdir,readFile,writeFile,rm}from'node:fs/promises';
import {dirname,resolve}from'node:path';
import {fileURLToPath}from'node:url';
import {loadSafeConfiguration}from'../../../scripts/p05-e2e/environment.mjs';
import {provision}from'../../../scripts/p05-e2e/provision.mjs';
import {buildChildEnvironment,validateFreshManifest}from'../../../scripts/p05-e2e/security.mjs';
import {provisionLocalUiAuthFixture,verifyLocalUiAuthProof,neutralizeLocalUiAuthFixture}from'./local-ui-auth-fixture.mjs';
import {activateUiRegisteredClients}from'./local-client-activation-fixture.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence}from'./secured-browser-runner.mjs';
import {prepareLocalBenefitFulfillment,verifyLocalBenefitFulfillment,neutralizeLocalBenefitFulfillment}from'./local-benefit-fulfillment-fixture.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),directory=resolve(root,'artifacts/test-results',`.local-benefit-fulfillment-${randomUUID()}`);
let config,fixture,failure,proof,stage='configuration',cleanupFailed=false;const summaries=[];
const aggregate=()=>summaries.length?{executed:summaries.reduce((n,s)=>n+s.executed,0),passed:summaries.reduce((n,s)=>n+s.passed,0),failed:summaries.reduce((n,s)=>n+s.failed,0),skipped:summaries.reduce((n,s)=>n+s.skipped,0),flaky:summaries.reduce((n,s)=>n+s.flaky,0),failures:summaries.flatMap(s=>s.failures),startedAt:summaries[0].startedAt,finishedAt:summaries.at(-1).finishedAt}:null;
try{
 if(process.argv.length!==2)throw new Error('LOCAL_BENEFIT_ARGUMENTS_INVALID');
 config=await loadSafeConfiguration(root);if(config.runtimeMode!=='isolated-local-docker'||!config.localDockerVerified)throw new Error('LOCAL_BENEFIT_DOCKER_REQUIRED');
 stage='base-fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);await mkdir(directory,{recursive:true,mode:0o700});
 stage='real-ui-auth';const authPath=await provisionLocalUiAuthFixture(fixture,fixture.manifest.runId,directory),auth=JSON.parse(await readFile(authPath,'utf8'));
 auth.registrationStatePaths=Object.fromEntries(['fr','ar'].map(locale=>[locale,resolve(directory,`registered-${locale}.json`)]));auth.centralStatePaths=Object.fromEntries(['fr','ar'].map(locale=>[locale,resolve(directory,`reviewer-${locale}.json`)]));await writeFile(authPath,JSON.stringify(auth),{mode:0o600});
 summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_UI_AUTH_MANIFEST:authPath}),specifications:['tests/e2e/local-auth-consent.spec.ts'],output:resolve(directory,'auth-browser'),expectedTests:4,projects:['chromium-desktop']}));proof=await verifyLocalUiAuthProof(fixture);
 stage='real-client-activation';const activated=await activateUiRegisteredClients(fixture,auth);proof={...proof,...activated.proof};
 stage='governed-gift-policy-and-reservation';const cases=await prepareLocalBenefitFulfillment(fixture,activated.actors,directory),manifestPath=resolve(directory,'manifest.json'),uiProofPath=resolve(directory,'ui-proof.json');
 await writeFile(manifestPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),cases,uiProofPath}),{mode:0o600});
 stage='real-ui-benefit-fulfillment';summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_BENEFIT_FULFILLMENT_MANIFEST:manifestPath}),specifications:['tests/e2e/local-benefit-fulfillment.spec.ts'],output:resolve(directory,'benefit-browser'),expectedTests:2,projects:['chromium-desktop']}));
 stage='canonical-receipts-and-unique-consumption';proof={...proof,...await verifyLocalBenefitFulfillment(fixture,cases,JSON.parse(await readFile(uiProofPath,'utf8')))};
}catch(error){failure=error;if(error.browserSummary)summaries.push(error.browserSummary);}
finally{for(const cleanup of[()=>fixture&&neutralizeLocalBenefitFulfillment(fixture),()=>fixture&&neutralizeLocalUiAuthFixture(fixture),()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupFailed=true;failure??=error;}}
await writeLocalSuiteEvidence({root,suite:'benefit-fulfillment',config,summary:aggregate(),failure,cleanupVerified:!cleanupFailed,proof:{...proof,mode:'REAL_UI_BENEFIT_EXECUTION_AND_CLIENT_RECEIPT',stage,commandStage:fixture?.resources.localBenefitStage??null,commandDiagnostic:fixture?.resources.localBenefitDiagnostic??null,financialFactsAndReceiptsRetained:proof?.canonicalReceiptAccountingProofs===2,fixtureRoleBootstrapExplicit:(fixture?.resources.localBenefitRoles?.length??0)>0,externalServiceDelivered:false}});
if(failure){console.error(`FAIL local benefit fulfillment (${failure.code??'LOCAL_BENEFIT_FAILED'}); private output discarded`);process.exitCode=1;}else console.log('PASS local benefit fulfillment: governed funding, independent receipts, unique consumption and cleanup');
