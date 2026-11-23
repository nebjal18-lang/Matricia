import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provision} from '../../../scripts/p05-e2e/provision.mjs';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';
const root=process.cwd(),directory=resolve(root,'artifacts/test-results',`.local-admin-summary-${randomUUID()}`),items=[];
let config,fixture,summary,failure,proof,stage='configuration',cleanupVerified=true;
async function rpc(client,name,args){const r=await client.rpc(name,args);assert.equal(r.error,null,`SUMMARY_${name.toUpperCase()}_FAILED`);return r.data;}
try{
 config=await loadSafeConfiguration(root);assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 stage='fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);const client=fixture.sessions.central.client,db=fixture.resources.database;
 stage='native-opening';
 for(const locale of ['fr','ar'])for(const device of ['D','M'])for(const priority of ['CRITICAL','LOW']){
  const suffix=`${locale}_${device}`,target=fixture.manifest.fixtures[locale==='fr'?'organizationA':'organizationB'],kind=priority==='CRITICAL'?'EXCEPTION':'RISK_FLAG',title=`Priority ${priority} ${suffix} ${fixture.manifest.runId.slice(0,8)}`;
  const args={p_queue_key:priority==='CRITICAL'?'EXCEPTIONS':'RISK_FLAGS',p_organization_id:target.id,p_source_kind:kind,p_resource_type:device==='D'?'organization':'client_compliance_case',p_resource_id:device==='D'?target.id:target.caseId,p_title_fr:title,p_title_ar:title,p_priority:priority,p_due_at:new Date(Date.now()+3600_000).toISOString(),p_redacted_context:{synthetic_test:true,automatic_sanction:false},p_reason:'Executive summary priority verification',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const opened=await rpc(client,'open_admin_work_item',args);items.push({id:opened.work_item_id,suffix,priority,title});assert.deepEqual(await rpc(client,'open_admin_work_item',args),opened);
 }
 await mkdir(directory,{recursive:true,mode:0o700});const path=resolve(directory,'manifest.json');await writeFile(path,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),items}),{mode:0o600});stage='browser';
 summary=await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_ADMIN_SUMMARY_MANIFEST:path}),specifications:['tests/e2e/local-admin-summary.spec.ts'],output:resolve(directory,'browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']});
 stage='native-proof';
 for(const item of items){const [row]=await db`select status,row_version,priority,assigned_to from public.admin_work_items where id=${item.id}::uuid`;assert.equal(row.status,'OPEN');assert.equal(row.row_version,1);assert.equal(row.priority,item.priority);assert.equal(row.assigned_to,null);
  const events=await db`select event_type from public.admin_work_item_events where work_item_id=${item.id}::uuid`;assert.deepEqual(events.map(e=>e.event_type),['OPENED']);
  const [audit]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.aggregate_id=a.resource_id where a.resource_id=${item.id} and a.action='admin.work_item.opened' and e.event_type='AdminWorkItemOpenedV1'`;assert.equal(audit.n,1);
  const read=await fixture.sessions.clientB.client.from('admin_work_items').select('id').eq('id',item.id);assert.equal(read.error,null);assert.deepEqual(read.data,[]);
 }
 proof={realNativePriorityItems:8,realUiPriorityOrderings:4,realUiContextualSelections:4,countsMatchRenderedQueue:true,triageBeforeSecondaryTools:true,noDecisionOrAssignmentOnSelection:true,foreignTaskReadDenied:true,frArDesktop360Accessibility:true};
}catch(error){failure=error;summary??=error.browserSummary;}
finally{
 if(fixture)for(const item of items)try{
  const db=fixture.resources.database,client=fixture.sessions.central.client;let [row]=await db`select status,row_version from public.admin_work_items where id=${item.id}::uuid`;
  if(row.status==='OPEN'){await rpc(client,'claim_admin_work_item',{p_work_item_id:item.id,p_expected_row_version:row.row_version,p_reason:'Executive summary fixture cleanup',p_idempotency_key:randomUUID()});[row]=await db`select status,row_version from public.admin_work_items where id=${item.id}::uuid`;}
  if(row.status==='CLAIMED')await rpc(client,'resolve_admin_work_item',{p_work_item_id:item.id,p_resolution_code:'NO_ACTION',p_reason:'Executive summary fixture cleanup',p_evidence:{synthetic_test:true},p_expected_row_version:row.row_version,p_idempotency_key:randomUUID()});
 }catch(error){cleanupVerified=false;failure??=error;}
 for(const cleanup of[()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}
}
const safe=value=>typeof value==='string'&&/^[A-Z0-9_]{2,100}$/u.test(value)?value:null;
await writeLocalSuiteEvidence({root,suite:'admin-summary',config,summary,failure,cleanupVerified,proof:{...proof,stage,responseCode:safe(failure?.actual?.code),responseLabel:safe(failure?.actual?.message)}});
if(failure){console.error('LOCAL_ADMIN_SUMMARY_FAILED');process.exitCode=1;}else console.log('LOCAL_ADMIN_SUMMARY_PASSED');
