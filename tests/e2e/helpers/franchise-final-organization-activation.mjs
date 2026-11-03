import { fixtureState,privateDirectory,persistPrivate,actorSession,staffActor,sdk } from './franchise-final-support.mjs';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
const state=await fixtureState(),dir=await privateDirectory(state),file=resolve(dir,'actors.private.json'),cohort=JSON.parse(await readFile(file));
const owner=cohort.actors.find(value=>value.label==='owner'),native=await actorSession(state,owner,file,cohort),author=await staffActor(state,'governance-author');
const result=await native.client.from('organizations').select('id,row_version,status').eq('id',owner.organizationId).single();if(result.error)throw Error('EXACT_TEST_ORGANIZATION_READ_REQUIRED');
cohort.organizationActivation??={key:randomUUID(),correlation:randomUUID(),expectedRowVersion:result.data.row_version};await persistPrivate(file,cohort);const intent=cohort.organizationActivation;
const out=resolve('docs/franchise-completion/evidence/browser/organization-governance');await mkdir(out,{recursive:true});const proof={scope:'NATIVE_TEST_ORGANIZATION_ACTIVATION_WITH_TWO_APPROVALS',environment:'DEVELOPMENT_TEST_ONLY',applicationBrowserRecipe:false,sourceCommandOrigin:'df67da46f48def7cf804855ab985a28dec4aab6e',status:'RUNNING',identityLegallyVerified:false,contractSigned:false,steps:[]};
try{
 if(!intent.request){
  if(result.data.status!=='PENDING')throw Error('PRESERVE_EXISTING_ORGANIZATION_STATE');
  const summary={expectedRowVersion:intent.expectedRowVersion,expectedIce:owner.orgIntent.ice,intent:'CHANGE_CONFIGURATION',status:'ACTIVE'};
  const requested=await author.client.rpc('request_admin_operational_action',{p_work_item_id:null,p_organization_id:owner.organizationId,p_action_type:'MANUAL_EXCEPTION',p_target_environment:'DEVELOPMENT',p_resource_type:'ORGANIZATION',p_resource_id:owner.organizationId,p_request_payload_hash:createHash('sha256').update(JSON.stringify(summary)).digest('hex'),p_redacted_summary:summary,p_reason:'Activation de la seule organisation Franchisé TEST pour la recette locale ; aucune vérification légale ni signature contractuelle revendiquée.',p_production_authorization_reference:null,p_support_user_id:null,p_support_access_mode:null,p_support_expires_at:null,p_idempotency_key:intent.key,p_correlation_id:intent.correlation});
  if(requested.error||requested.data?.approvals_required!==2)throw Error('GOVERNED_ORGANIZATION_REQUEST_FAILED:'+requested.error?.code);intent.request=requested.data;await persistPrivate(file,cohort);
 }
 proof.steps.push({id:'SENSITIVE_REQUEST_REQUIRES_TWO_APPROVALS',status:'PASS',approvalsRequired:2});
 const requestId=intent.request.action_request_id;
 const own=await author.client.rpc('decide_admin_operational_action',{p_action_request_id:requestId,p_decision:'APPROVE',p_reason:'Auto approbation TEST doit être refusée',p_expected_row_version:1,p_idempotency_key:randomUUID()});if(own.error?.code!=='42501')throw Error('REQUESTER_CANNOT_APPROVE_SELF');proof.steps.push({id:'SELF_APPROVAL_DENIED',status:'PASS',code:own.error.code});
 intent.approvals??=[];
 for(const label of ['governance-reviewer','compliance-reviewer']){
  if(intent.approvals.some(value=>value.label===label))continue;
  const reviewer=await staffActor(state,label),current=await reviewer.client.from('admin_operational_action_requests').select('row_version,status').eq('id',requestId).single();if(current.error||current.data.status!=='PENDING_APPROVAL')throw Error('EXACT_PENDING_ORGANIZATION_REQUEST_REQUIRED');
  const approved=await reviewer.client.rpc('decide_admin_operational_action',{p_action_request_id:requestId,p_decision:'APPROVE',p_reason:'Approbation indépendante du statut de la seule organisation TEST pour la recette locale',p_expected_row_version:current.data.row_version,p_idempotency_key:randomUUID()});if(approved.error)throw Error('INDEPENDENT_ORGANIZATION_APPROVAL_FAILED:'+approved.error.code);intent.approvals.push({label,outcome:approved.data.outcome});await persistPrivate(file,cohort);
 }
 proof.steps.push({id:'TWO_DISTINCT_NATIVE_APPROVERS',status:'PASS',approverLabels:intent.approvals.map(value=>value.label)});
 if(!intent.executed){const executed=await sdk(state,state.serviceKey).rpc('execute_admin_operational_action_v1',{p_action_request_id:requestId,p_correlation_id:intent.correlation});if(executed.error||executed.data?.outcome!=='ADMIN_ACTION_EXECUTED')throw Error('NATIVE_ORGANIZATION_EXECUTION_FAILED:'+executed.error?.code+':'+executed.data?.outcome);intent.executed=executed.data;await persistPrivate(file,cohort);}
 const current=await native.client.from('organizations').select('id,status,row_version').eq('id',owner.organizationId).single(),request=await author.client.from('admin_operational_action_requests').select('status,approvals_required').eq('id',requestId).single();if(current.error||current.data.status!=='ACTIVE'||request.error||request.data.status!=='EXECUTED'||request.data.approvals_required!==2)throw Error('GOVERNED_ACTIVE_ORGANIZATION_NOT_PERSISTED');proof.steps.push({id:'NATIVE_APPROVED_EXECUTION_PERSISTED',status:'PASS',organizationStatus:current.data.status,requestStatus:request.data.status});proof.status='PASSED';
}catch(error){proof.status='FAILED';proof.failure=String(error).slice(0,1000);process.exitCode=1;}finally{await writeFile(resolve(out,'summary.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));}
