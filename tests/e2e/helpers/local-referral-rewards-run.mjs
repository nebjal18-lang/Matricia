import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {provision} from '../../../scripts/p05-e2e/provision.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {provisionLocalUiAuthFixture,verifyLocalUiAuthProof,neutralizeLocalUiAuthFixture} from './local-ui-auth-fixture.mjs';
import {activateUiRegisteredClients} from './local-client-activation-fixture.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';
import {prepareLocalReferralRewards,collectLocalReferralApprovals,verifyLocalReferralRewards,cleanupLocalReferralRewardRoles} from './local-referral-reward-proof.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),directory=resolve(root,'artifacts/test-results',`.local-referral-rewards-${randomUUID()}`);
let config,fixture,failure,proof,stage='configuration',cleanupFailed=false;
const summaries=[];
const aggregate=()=>summaries.length?{executed:summaries.reduce((n,s)=>n+s.executed,0),passed:summaries.reduce((n,s)=>n+s.passed,0),failed:summaries.reduce((n,s)=>n+s.failed,0),skipped:summaries.reduce((n,s)=>n+s.skipped,0),flaky:summaries.reduce((n,s)=>n+s.flaky,0),failures:summaries.flatMap(s=>s.failures),startedAt:summaries[0].startedAt,finishedAt:summaries.at(-1).finishedAt}:null;
try{
 if(process.argv.length!==2)throw new Error('LOCAL_REFERRAL_REWARDS_ARGUMENTS_INVALID');
 config=await loadSafeConfiguration(root);
 if(config.runtimeMode!=='isolated-local-docker'||!config.localDockerVerified)throw new Error('LOCAL_REFERRAL_REWARDS_DOCKER_REQUIRED');
 stage='base-fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);await mkdir(directory,{recursive:true,mode:0o700});
 stage='real-ui-auth';
 const authPath=await provisionLocalUiAuthFixture(fixture,fixture.manifest.runId,directory),auth=JSON.parse(await readFile(authPath,'utf8'));
 auth.registrationStatePaths=Object.fromEntries(['fr','ar'].map(locale=>[locale,resolve(directory,`registered-${locale}.json`)]));
 auth.centralStatePaths=Object.fromEntries(['fr','ar'].map(locale=>[locale,resolve(directory,`reviewer-${locale}.json`)]));
 await writeFile(authPath,JSON.stringify(auth),{mode:0o600});
 summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_UI_AUTH_MANIFEST:authPath}),specifications:['tests/e2e/local-auth-consent.spec.ts'],output:resolve(directory,'auth-browser'),expectedTests:4,projects:['chromium-desktop']}));
 proof=await verifyLocalUiAuthProof(fixture);
 stage='real-client-activation';const activated=await activateUiRegisteredClients(fixture,auth);proof={...proof,...activated.proof};
 stage='governed-referral-activation';const reference=await prepareLocalReferralRewards(fixture,activated.actors,directory),manifestPath=resolve(directory,'manifest.json');
 const persist=()=>writeFile(manifestPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+30*60_000).toISOString(),reference}),{mode:0o600});
 for(const [phase,projects,expectedTests] of [['review',['chromium-desktop'],2],['pending',['chromium-mobile-360'],2],['execute',['chromium-mobile-360'],2],['granted',['chromium-desktop','chromium-mobile-360'],4]]){
  stage=`real-ui-${phase}`;await persist();
  summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_REFERRAL_REWARDS_MANIFEST:manifestPath,E2E_LOCAL_REFERRAL_REWARDS_PHASE:phase}),specifications:['tests/e2e/local-referral-rewards.spec.ts'],output:resolve(directory,`${phase}-browser`),expectedTests,projects}));
  if(phase==='review')await collectLocalReferralApprovals(fixture,reference);
 }
 stage='immutable-grant-and-ledger-proof';proof={...proof,...await verifyLocalReferralRewards(fixture,reference),frArDesktop360Accessibility:true};
}catch(error){failure=error;if(error.browserSummary)summaries.push(error.browserSummary);}
finally{
 for(const cleanup of[()=>fixture&&cleanupLocalReferralRewardRoles(fixture),()=>fixture&&neutralizeLocalUiAuthFixture(fixture),()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupFailed=true;failure??=error;}
}
await writeLocalSuiteEvidence({root,suite:'referral-rewards',config,summary:aggregate(),failure,cleanupVerified:!cleanupFailed,proof:{...proof,mode:'REAL_UI_INDEPENDENT_APPROVAL_AND_FINANCE_EXECUTION',stage,commandStage:fixture?.resources.localReferralRewardStage??null}});
if(failure){console.error(`FAIL local referral rewards (${failure.code??'LOCAL_REFERRAL_REWARDS_FAILED'}); private output discarded`);process.exitCode=1;}else console.log('PASS local referral rewards: independent decisions, finance issuance, immutable credits and cleanup');
