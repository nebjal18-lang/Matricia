import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provision} from '../../../scripts/p05-e2e/provision.mjs';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';

const root=process.cwd(), directory=resolve(root,'artifacts/test-results',`.local-admin-decisions-${randomUUID()}`);
let config,fixture,summary,failure,proof,stage='configuration',cleanupVerified=true;
const items=[];
async function rpc(client,name,input){const r=await client.rpc(name,input);assert.equal(r.error,null,`ADMIN_${name.toUpperCase()}_FAILED`);return r.data;}
try {
  config=await loadSafeConfiguration(root);
  assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
  stage='fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);
  const client=fixture.sessions.central.client, db=fixture.resources.database, org=fixture.manifest.fixtures.organizationA.id;
  const organizationIds=[fixture.manifest.fixtures.organizationA.id,fixture.manifest.fixtures.organizationB.id];
  const before=await db`select id,status from public.organizations where id=any(${organizationIds}::uuid[]) order by id`;
  stage='native-opening';
  for(const locale of ['fr','ar'])for(const device of ['D','M'])for(const kind of ['RISK_FLAG','EXCEPTION']){
    const suffix=`${locale}_${device}`,title=`E2E ${kind} ${suffix} ${fixture.manifest.runId.slice(0,8)}`;
    const target=fixture.manifest.fixtures[locale==='fr'?'organizationA':'organizationB'];
    const input={p_queue_key:kind==='RISK_FLAG'?'RISK_FLAGS':'EXCEPTIONS',p_organization_id:target.id,p_source_kind:kind,p_resource_type:device==='D'?'organization':'client_compliance_case',p_resource_id:device==='D'?target.id:target.caseId,p_title_fr:title,p_title_ar:title,p_priority:'CRITICAL',p_due_at:new Date(Date.now()+600_000).toISOString(),p_redacted_context:{synthetic_test:true,automatic_sanction:false},p_reason:'Local human review acceptance',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
    const opened=await rpc(client,'open_admin_work_item',input);
    items.push({id:opened.work_item_id,suffix,kind,title});
    assert.deepEqual(await rpc(client,'open_admin_work_item',input),opened);
    const denied=await fixture.sessions.clientB.client.rpc('open_admin_work_item',{...input,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  }
  const afterOpening=await db`select id,status from public.organizations where id=any(${organizationIds}::uuid[]) order by id`;
  assert.deepEqual([...afterOpening],[...before],'RISK_FLAG_MUST_NOT_SANCTION_ORGANIZATION');
  await mkdir(directory,{recursive:true,mode:0o700});
  const path=resolve(directory,'manifest.json');
  await writeFile(path,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),items}),{mode:0o600});
  stage='browser';
  summary=await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_ADMIN_DECISIONS_MANIFEST:path}),specifications:['tests/e2e/local-admin-decisions.spec.ts'],output:resolve(directory,'browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']});
  stage='native-proof';
  for(const item of items){
    const [work]=await db`select status,row_version,resolution_code,resolution_reason,assigned_to from public.admin_work_items where id=${item.id}::uuid`;
    assert.equal(work.status,'RESOLVED');assert.equal(work.row_version,3);
    assert.equal(work.resolution_code,item.kind==='RISK_FLAG'?'FALSE_POSITIVE':'COMPLETED');
    assert.equal(work.resolution_reason,`E2E reviewed evidence and human decision ${item.suffix}`);
    assert.equal(work.assigned_to,fixture.resources.userIds[2]);
    const events=await db`select event_type from public.admin_work_item_events where work_item_id=${item.id}::uuid order by occurred_at,id`;
    assert.deepEqual(events.map(e=>e.event_type),['OPENED','CLAIMED','HUMAN_RESOLUTION']);
    const audit=await db`select action from public.audit_events where resource_id=${item.id} and action in ('admin.work_item.opened','admin.work_item.claimed','admin.work_item.resolved')`;
    assert.equal(audit.length,3);
    const outbox=await db`select e.event_type from public.event_outbox e join public.audit_events a on a.correlation_id=e.correlation_id and a.resource_id=e.aggregate_id where a.resource_id=${item.id} and e.event_type in ('AdminWorkItemOpenedV1','AdminWorkItemResolvedV1')`;
    assert.equal(outbox.length,2);
    const [claimKey]=await db`select key,response_body from private.admin_command_keys where actor_user_id=${work.assigned_to}::uuid and operation_scope=${'admin.work.claim.'+item.id}`;
    assert.ok(claimKey);
    const claimInput={p_work_item_id:item.id,p_expected_row_version:1,p_reason:`E2E human claim ${item.suffix}`,p_idempotency_key:claimKey.key};
    assert.deepEqual(await rpc(client,'claim_admin_work_item',claimInput),claimKey.response_body);
    const started=Date.now();const stale=await client.rpc('claim_admin_work_item',{...claimInput,p_idempotency_key:randomUUID()});assert.equal(stale.error?.code,'PT409');assert.equal(stale.status,409);assert.ok(Date.now()-started<5000,'STALE_CONFLICT_MUST_RETURN_WITHOUT_RETRY_LOOP');
    const read=await fixture.sessions.clientB.client.from('admin_work_items').select('id').eq('id',item.id);assert.equal(read.error,null);assert.deepEqual(read.data,[]);
    const denied=await fixture.sessions.clientB.client.rpc('claim_admin_work_item',{p_work_item_id:item.id,p_expected_row_version:3,p_reason:'Foreign claim refused',p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  }
  const after=await db`select id,status from public.organizations where id=any(${organizationIds}::uuid[]) order by id`;assert.deepEqual([...after],[...before]);
  proof={realNativeWorkItems:8,realUiClaims:8,realUiHumanResolutions:8,versionedWorkHistory:true,correlatedOpenAndResolveOutbox:true,claimReplayAfterResolution:true,staleClaimDenied:true,foreignReadAndWriteDenied:true,automaticSanctions:false};
}catch(error){failure=error;summary??=error.browserSummary;}
finally{
  if(fixture)for(const item of items){
    try{
      const db=fixture.resources.database,client=fixture.sessions.central.client;
      let [row]=await db`select status,row_version from public.admin_work_items where id=${item.id}::uuid`;
      if(row.status==='OPEN'){
        await rpc(client,'claim_admin_work_item',{p_work_item_id:item.id,p_expected_row_version:row.row_version,p_reason:'Local acceptance cleanup',p_idempotency_key:randomUUID()});
        [row]=await db`select status,row_version from public.admin_work_items where id=${item.id}::uuid`;
      }
      if(['CLAIMED','WAITING_INFORMATION'].includes(row.status))await rpc(client,'resolve_admin_work_item',{p_work_item_id:item.id,p_resolution_code:'NO_ACTION',p_reason:'Local acceptance fixture cleanup',p_evidence:{synthetic_test:true},p_expected_row_version:row.row_version,p_idempotency_key:randomUUID()});
    }catch(error){cleanupVerified=false;failure??=error;}
  }
  for(const cleanup of [()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}
}
const safeCode=value=>typeof value==='string'&&/^[A-Z0-9_]{2,100}$/u.test(value)?value:null;
await writeLocalSuiteEvidence({root,suite:'admin-decisions',config,summary,failure,cleanupVerified,proof:{...proof,stage,assertionLabel:safeCode(failure?.message?.split('\n')[0]),assertionActual:typeof failure?.actual==='number'?failure.actual:safeCode(failure?.actual),assertionExpected:typeof failure?.expected==='number'?failure.expected:safeCode(failure?.expected),failureLine:Number(/local-admin-decisions-run\.mjs:(\d+)/u.exec(failure?.stack??'')?.[1])||null,responseCode:safeCode(failure?.actual?.code),responseLabel:safeCode(failure?.actual?.message)}});
if(failure){console.error('ADMIN_DECISIONS_FAILED');process.exitCode=1;}else console.log('ADMIN_DECISIONS_PASSED');
