import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir,readFile,rm,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSafeConfiguration } from '../../../scripts/p05-e2e/environment.mjs';
import { sourceIdentity,validateLocalSuiteEvidence } from '../../../scripts/release/local-acceptance-evidence.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const reports=resolve(root,'artifacts/test-results/local-acceptance');
const legacyReport='artifacts/test-results/authenticated-route-smoke-summary.json';
const phases=[
 {id:'ui-auth',script:'tests/e2e/helpers/p24-p26-completion-run.mjs',args:['--local-auth-ui-only'],report:legacyReport,expectedTests:4,mode:'LOCAL_UI_OTP_CONSENT_AND_MFA'},
 {id:'route-smoke',script:'tests/e2e/helpers/p24-p26-completion-run.mjs',args:['--authenticated-route-smoke-only'],report:legacyReport,expectedTests:16,mode:'AUTHENTICATED_ROUTE_SMOKE_ONLY'},
 {id:'p05-onboarding',script:'scripts/p05-e2e/run.mjs',expectedTests:28},
 {id:'v1-critical',script:'tests/e2e/helpers/v1-critical-flows-run.mjs',expectedTests:24},
 {id:'client-journey',script:'tests/e2e/helpers/local-client-journey-run.mjs',expectedTests:6,requiredProof:{mode:'REAL_UI_SIGNUP_ACTIVATION_TO_REQUEST',sameUiRegisteredIdentitiesActivated:true,realVerifiedCases:2,realTrialActivations:2,authenticatedAal1ReviewDenied:true,selfApprovalDenied:true,realUiDiagnostics:2,realUiRequests:2,publishedEvaluationAndRulesVerified:true,realUiOpportunityConversions:2,realSdkNeedConversions:2,idempotenceAndOptimisticLockVerified:true,foreignSessionDenied:true,correlatedCommandEvidenceVerified:true}},
 {id:'linked-commercial',script:'tests/e2e/helpers/local-client-journey-run.mjs',args:['--linked-commercial'],expectedTests:8,requiredProof:{mode:'REAL_UI_SIGNUP_TO_NATIVE_ACCEPTED_DELIVERY_WITH_DEV_MOCK',linkedCommercialChains:2,sameRequestToAcceptedDeliveryVerified:true,governedDevelopmentMockSignatures:2,contractualSignatureValidated:false,realCanonicalContractPolicyReviews:true,realReviewedFiscalServiceMapping:true,realCanonicalPdfPairs:2,canonicalPdfCacheAndForeignDenialVerified:true,realPublishedChecklists:true,realPrivateDeliveryFiles:2,receptionBeforeScanDenied:true,foreignDeliveryAccessDenied:true,nativeBoundStorageApiDeleteDenied:true,nativeBoundStorageApiBytesPreserved:true,revokedProviderProofHidden:true,revokedProviderPrivateDownloadDenied:true,remainingClientPrivateDownloadPreserved:true,membershipRevocationIsPrivilegedFixtureRestriction:true}},
 {id:'benefit-fulfillment',script:'tests/e2e/helpers/local-benefit-fulfillment-run.mjs',expectedTests:6,requiredProof:{mode:'REAL_UI_BENEFIT_EXECUTION_AND_CLIENT_RECEIPT',realGovernedGiftExecutions:2,independentFinanceReviews:true,realApprovedAdmissionPolicy:true,realClientReservations:2,realUiSchedules:2,realUiStarts:2,realUiRejectedThenAccepted:2,realUiUniqueConsumptions:2,canonicalReceiptAccountingProofs:2,correlatedPolicyGiftAndReceiptEvents:true,foreignReadDenied:true,zeroGiftRevenueVerified:true,nativeServiceFileBytesVerified:false,externalClientServiceDelivered:false}},
 {id:'p23-quotes',script:'tests/e2e/helpers/p23-provider-quotes-run.mjs',expectedTests:4,requiredProof:{quoteFinancialAndAuditVerified:true}},
 {id:'final-core',script:'tests/e2e/helpers/final-core-product-run.mjs',expectedTests:4,requiredProof:{providerCapacityAuditVerified:true,providerIdentityRevalidatedViaRealAal2Command:true}},
 {id:'p24-p26',script:'tests/e2e/helpers/p24-p26-completion-run.mjs',report:legacyReport,expectedTests:64,mode:'FULL_P24_P26'},
];
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--step'&&phases.some(phase=>phase.id===args[1])))throw new Error('USE_NO_ARGUMENTS_OR_STEP_WITH_KNOWN_PHASE');
const selected=args.length?phases.filter(phase=>phase.id===args[1]):phases;
const startedAt=new Date().toISOString();let failure,identity;const results=[];
await mkdir(reports,{recursive:true,mode:0o700});
try{
 const config=await loadSafeConfiguration(root);
 if(config.runtimeMode!=='isolated-local-docker'||!config.localDockerVerified||process.env.E2E_EXTERNAL_SERVER)throw new Error('ISOLATED_LOCAL_MANAGED_SERVER_REQUIRED');
 identity=await sourceIdentity(root);
 for(const phase of selected){
  const reportPath=resolve(root,phase.report??`artifacts/test-results/local-acceptance/${phase.id}.json`);
  await rm(reportPath,{force:true});const beginning=Date.now();
  console.log(`RUN local acceptance ${phase.id}: ${phase.expectedTests} tests required`);
  const child=spawn(process.execPath,[resolve(root,phase.script),...(phase.args??[])],{cwd:root,env:process.env,shell:false,stdio:['ignore','pipe','pipe']});
  // Authenticated DOM and traces may include private information. Only the strict sanitized evidence is read.
  child.stdout.resume();child.stderr.resume();
  let code;
  try{code=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',(value,signal)=>signal?reject(new Error('LOCAL_ACCEPTANCE_INTERRUPTED')):done(value??1));});}
  catch{code=1;}
  let evidence,bytes;
  try{bytes=await readFile(reportPath);evidence=JSON.parse(bytes);}catch{}
  let phaseFailure;
  try{if(code!==0)throw new Error('LOCAL_ACCEPTANCE_CHILD_FAILED');validateLocalSuiteEvidence(evidence??{}, {...phase,startedAt:beginning});}
  catch(error){phaseFailure=error;}
  const record={id:phase.id,status:phaseFailure?'FAILED':'PASSED',expectedTests:phase.expectedTests,browser:evidence?.browser??null,cleanupVerified:evidence?.cleanupVerified??(evidence?.cleanup?.remoteFixturesNeutralized===true&&evidence?.cleanup?.localAuthenticationArtifactsRemoved===true),evidence:bytes?{path:`artifacts/test-results/local-acceptance/${phase.id}.json`,sha256:createHash('sha256').update(bytes).digest('hex')}:null};
  if(bytes&&phase.report)await writeFile(resolve(reports,`${phase.id}.json`),bytes,{mode:0o600});
  results.push(record);console.log(`${record.status} local acceptance ${phase.id}`);
  if(phaseFailure)throw phaseFailure;
 }
 const finalIdentity=await sourceIdentity(root);
 if(identity.applicationAndRecipeTreeSha256!==finalIdentity.applicationAndRecipeTreeSha256||identity.gitHead!==finalIdentity.gitHead)throw new Error('LOCAL_ACCEPTANCE_SOURCE_CHANGED');
}catch(error){failure=error;}
for(const phase of selected)if(!results.some(result=>result.id===phase.id))results.push({id:phase.id,status:'NOT_RUN',expectedTests:phase.expectedTests});
const manifest={schemaVersion:1,environment:'development-local-docker',startedAt,completedAt:new Date().toISOString(),scope:args.length?'SINGLE_LOCAL_SEGMENT':'LOCAL_SEGMENTS',status:failure?'FAILED':args.length?'LOCAL_SEGMENT_PASSED':'LOCAL_SEGMENTS_PASSED',source:identity??null,phases:results,expectedTests:selected.reduce((sum,phase)=>sum+phase.expectedTests,0),passedTests:results.reduce((sum,phase)=>sum+(phase.status==='PASSED'?phase.expectedTests:0),0),externalRequirements:{stagingDeployment:'NOT_VALIDATED',hostedRestoreAndStorage:'NOT_VALIDATED',signatureProvider:'NOT_VALIDATED',livePaymentAndFiscalApproval:'NOT_VALIDATED',clientAcceptanceAndSignature:'NOT_SIGNED'},failureCode:failure?.message??null};
await writeFile(resolve(reports,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
console.log(`${manifest.status}: ${manifest.passedTests}/${manifest.expectedTests} local tests; external delivery requirements remain separate`);
if(failure)process.exitCode=1;
