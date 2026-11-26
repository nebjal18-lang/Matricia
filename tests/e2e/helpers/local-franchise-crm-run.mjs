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
import {ownedLocalHttpServer} from './owned-local-http-server.mjs';
const root=process.cwd(),directory=resolve(root,'artifacts/test-results',`.local-franchise-crm-${randomUUID()}`);
let config,fixture,reference,server,summary,failure,proof,stage='configuration',cleanupVerified=true;
const summaries=[],items=[];
function aggregate(){return summaries.length?{executed:summaries.reduce((n,s)=>n+s.executed,0),passed:summaries.reduce((n,s)=>n+s.passed,0),failed:summaries.reduce((n,s)=>n+s.failed,0),skipped:summaries.reduce((n,s)=>n+s.skipped,0),flaky:summaries.reduce((n,s)=>n+s.flaky,0),failures:summaries.flatMap(s=>s.failures),startedAt:summaries[0].startedAt,finishedAt:summaries.at(-1).finishedAt}:null;}
async function boundary(db,org){const [r]=await db`select (select count(*)::integer from public.organization_memberships where organization_id=${org}::uuid) members,(select count(*)::integer from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.organization_id=${org}::uuid) roles,(select count(*)::integer from public.client_trials where organization_id=${org}::uuid) trials`;return r;}
try{
 config=await loadSafeConfiguration(root);assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 stage='base-fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);await mkdir(directory,{recursive:true,mode:0o700});
 stage='historical-mandate-reference';reference=await prepareLocalFranchiseCrm(fixture,directory);
 const db=fixture.resources.database,client=fixture.sessions.noRole.client,foreign=fixture.sessions.clientB.client,before=await boundary(db,reference.organizationId);
 for(const locale of ['fr','ar'])for(const device of ['D','M'])for(const type of ['CLIENT','PROVIDER']){
  const suffix=`${locale}_${device}_${type}`,token=fixture.manifest.runId.slice(0,8);
  // Reserved .test domain: no delivery worker runs; .invalid contacts are hidden by the operational directory.
  items.push({locale,device,type,suffix,displayName:`Contact ${suffix} ${token}`,organizationName:`Societe ${suffix} ${token}`,email:`crm-${token}-${suffix.toLowerCase()}@crm.example.test`,note:`Suivi local ${suffix} ${token}`});
 }
 stage='owned-server';server=ownedLocalHttpServer(root,config,{applicationEncryptionKey:randomBytes(32).toString('hex')});await server.start();
 for(const phase of ['invitations','activities']){
  const path=resolve(directory,`${phase}.json`);await writeFile(path,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),reference,items,phase}),{mode:0o600});
  stage=`${phase}-browser`;
  summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_EXTERNAL_SERVER:'1',E2E_LOCAL_CRM_MANIFEST:path}),specifications:['tests/e2e/local-franchise-crm.spec.ts'],output:resolve(directory,phase),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));summary=aggregate();
  stage=`${phase}-native-proof`;
  for(const item of items){
   const rows=await db`select i.id,i.prospect_id,i.status,i.locale,i.sent_at,i.delivery_mode,i.provider_message_id,p.pipeline_stage,p.row_version from public.franchise_network_invitations i join public.franchise_crm_prospects p on p.id=i.prospect_id where i.franchise_id=${reference.franchiseId}::uuid and i.contact_email=${item.email} and i.prospect_type=${item.type}`;
   assert.equal(rows.length,1);const row=rows[0];assert.equal(row.status,'QUEUED');assert.equal(row.locale,item.locale);assert.equal(row.sent_at,null);assert.equal(row.delivery_mode,null);assert.equal(row.provider_message_id,null);item.prospectId=row.prospect_id;
   const [event]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.aggregate_id=a.resource_id where a.resource_id=${row.id} and a.action='franchise.network.invitation_queued' and e.event_type='FranchiseNetworkInvitationRequestedV1'`;assert.equal(event.n,1);
   if(phase==='invitations'){
    assert.equal(row.pipeline_stage,'SENT');
    const [token]=await db`select token_hash from private.franchise_network_invitation_tokens where invitation_id=${row.id}::uuid`;
    const [receipt]=await db`select key,response_body from public.idempotency_keys where organization_id=${reference.organizationId}::uuid and operation_scope='franchise.network.invitation.queue' and response_body->'invitation_ids' @> ${db.json([row.id])}::jsonb`;assert.ok(receipt);
    const args={p_franchise_id:reference.franchiseId,p_territory_version_id:reference.territoryId,p_prospect_type:item.type,p_owner_user_id:reference.actor,p_rows:[{invitation_id:row.id,token_hash:token.token_hash,display_name:item.displayName,contact_email:item.email,organization_name:item.organizationName,source_code:'INVITE',next_followup_at:'',phone:'',locale:item.locale}],p_contact_permission_confirmed:true,p_idempotency_key:receipt.key};
    const replay=await client.rpc('queue_franchise_network_invitations_v1',args);assert.equal(replay.error,null);assert.deepEqual(replay.data,receipt.response_body);
    const denied=await foreign.rpc('queue_franchise_network_invitations_v1',{...args,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
   }else{
    assert.equal(row.pipeline_stage,'OPENED');assert.equal(row.row_version,4);
    const activities=await db`select id,summary,correlation_id from public.franchise_crm_activities where prospect_id=${row.prospect_id}::uuid and activity_type='NOTE' order by id`;
    assert.deepEqual(activities.map(a=>a.summary),[`${item.note} 1`,`${item.note} 2`]);
    for(const a of activities){const [e]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox o on o.correlation_id=a.correlation_id where a.correlation_id=${a.correlation_id}::uuid and a.action='franchise.crm.activity_recorded' and o.event_type='FranchiseActivityRecordedV1'`;assert.equal(e.n,1);}
    const transitions=await db`select from_stage,to_stage,reason_code,evidence_refs,idempotency_key,correlation_id from public.franchise_pipeline_events where prospect_id=${row.prospect_id}::uuid`;
    assert.equal(transitions.length,1);const transition=transitions[0];assert.equal(transition.from_stage,'SENT');assert.equal(transition.to_stage,'OPENED');assert.equal(transition.reason_code,'CONTACT_CONFIRMED');
    const args={p_prospect_id:row.prospect_id,p_to_stage:'OPENED',p_reason_code:transition.reason_code,p_evidence_refs:transition.evidence_refs,p_expected_row_version:3,p_idempotency_key:transition.idempotency_key,p_correlation_id:transition.correlation_id};
    const replay=await client.rpc('advance_franchise_pipeline',args);assert.equal(replay.error,null);assert.equal(replay.data.row_version,4);
    const denied=await foreign.rpc('advance_franchise_pipeline',{...args,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
    const read=await foreign.from('franchise_crm_prospects').select('id').eq('id',row.prospect_id);assert.equal(read.error,null);assert.deepEqual(read.data,[]);
    const [e]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox o on o.correlation_id=a.correlation_id where a.correlation_id=${transition.correlation_id}::uuid and a.action='franchise.crm.pipeline_advanced' and o.event_type='FranchisePipelineAdvancedV1'`;assert.equal(e.n,1);
   }
  }
  assert.deepEqual(await boundary(db,reference.organizationId),before);
 }
 proof={realUiQueuedInvitations:8,realUiDuplicateInvitationsSkipped:8,realUiRecordedActivities:16,realUiManualPipelineTransitions:8,exactInvitationAndPipelineReplay:true,foreignReadAndWriteDenied:true,correlatedCrmAuditOutbox:true,noMembershipRoleOrTrialGranted:true,externalEmailDelivered:false,historicalLocalMandate:true};
}catch(error){failure=error;if(error.browserSummary)summaries.push(error.browserSummary);summary=aggregate();}
finally{
 for(const cleanup of[()=>server?.stop(),()=>fixture&&neutralizeLocalFranchiseCrm(fixture),()=>fixture&&neutralizeLocalCatalogReference(fixture),()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}
}
const failureLocations=[...(failure?.stack??'').matchAll(/([^\s/\\()]+\.(?:mjs|ts)):(\d+):(\d+)/gu)].slice(0,4).map(m=>({file:m[1],line:Number(m[2]),column:Number(m[3])}));
await writeLocalSuiteEvidence({root,suite:'franchise-crm',config,summary,failure,cleanupVerified,proof:{...proof,stage,failureLocations}});
if(failure){console.error('LOCAL_FRANCHISE_CRM_FAILED');process.exitCode=1;}else console.log('LOCAL_FRANCHISE_CRM_PASSED');
