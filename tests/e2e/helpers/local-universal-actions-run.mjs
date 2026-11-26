import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provision} from '../../../scripts/p05-e2e/provision.mjs';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';
import {prepareLocalFranchiseCrm,neutralizeLocalFranchiseCrm} from './local-franchise-crm-reference.mjs';
import {neutralizeLocalCatalogReference} from './local-catalog-reference.mjs';
const root=process.cwd(),directory=resolve(root,'artifacts/test-results',`.local-universal-actions-${randomUUID()}`),items=[];
let config,fixture,reference,summary,failure,proof,actors,stage='configuration',cleanupVerified=true;
async function rpc(client,name,args){const r=await client.rpc(name,args);assert.equal(r.error,null,`ACTIONS_${name.toUpperCase()}_FAILED`);return r.data;}
try{
 config=await loadSafeConfiguration(root);assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 stage='fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);await mkdir(directory,{recursive:true,mode:0o700});reference=await prepareLocalFranchiseCrm(fixture,directory);
 const db=fixture.resources.database,[clientId,providerId,adminId]=fixture.resources.userIds;
 const orgA=fixture.manifest.fixtures.organizationA.id,orgB=fixture.manifest.fixtures.organizationB.id;
 await db`insert into public.platform_user_roles(user_id,role_code) values(${adminId}::uuid,'MATRICIA_ADMIN') on conflict do nothing`;
 await db`insert into public.organization_member_roles(membership_id,role_code,granted_by) select id,'PROVIDER_OWNER',${providerId}::uuid from public.organization_memberships where organization_id=${orgB}::uuid and user_id=${providerId}::uuid and status='ACTIVE' on conflict do nothing`;
 actors={client:{state:fixture.manifest.states.clientA.path,org:orgA,user:clientId,session:'clientA'},provider:{state:fixture.manifest.states.clientB.path,org:orgB,user:providerId,session:'clientB'},franchise:{state:reference.state,org:reference.organizationId,user:reference.actor,session:'noRole'},admin:{state:fixture.manifest.states.centralAal2.path,org:orgA,user:adminId,session:'central'}};
 const code=`ACTIONS_${fixture.manifest.runId.replaceAll('-','').toUpperCase()}`;
 // Published historical IN_APP template; actual notification enqueue/read commands follow.
 for(const locale of ['fr','ar'])await db`insert into public.notification_template_versions(template_code,version,event_type,category_code,locale,subject_template,body_template,cta_path_template,priority,mandatory,channels,variable_keys,status,effective_from,content_hash) values(${code},1,${code},'SECURITY_CRITICAL',${locale+'-MA'},'{{reference}}',${locale==='fr'?'Une action requiert votre attention.':'إجراء يتطلب انتباهكم.'},${`/${locale}/notifications`},'CRITICAL',true,array['IN_APP'],array['reference'],'ACTIVE',clock_timestamp()-interval '1 minute',private.canonical_request_hash(jsonb_build_object('code',${code}::text,'locale',${locale}::text)))`;
 stage='native-task-opening';
 for(const role of Object.keys(actors))for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const actor=actors[role],title=`Action ${role} ${locale} ${device} ${fixture.manifest.runId.slice(0,8)}`;
  if(role==='admin'){
   const target=fixture.manifest.fixtures[locale==='fr'?'organizationA':'organizationB'];
   const input={p_queue_key:'EXCEPTIONS',p_organization_id:target.id,p_source_kind:'EXCEPTION',p_resource_type:device==='D'?'organization':'client_compliance_case',p_resource_id:device==='D'?target.id:target.caseId,p_title_fr:title,p_title_ar:title,p_priority:'CRITICAL',p_due_at:new Date(Date.now()+600_000).toISOString(),p_redacted_context:{synthetic_test:true},p_reason:'Universal action center verification',p_idempotency_key:randomUUID()};
    const result=await rpc(fixture.sessions.central.client,'open_admin_work_item',{...input,p_correlation_id:randomUUID()});items.push({role,locale,device,title,id:result.work_item_id});
  }else{
   const key=randomUUID(),correlation=randomUUID();
   const result=await db.begin(async tx=>{await tx`set local role service_role`;await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
    const [row]=await tx`select public.enqueue_notification(${actor.user}::uuid,${actor.org}::uuid,${code},${code},${locale+'-MA'},${tx.json({reference:title})}::jsonb,${key},'organization',${actor.org},${correlation}::uuid) receipt`;
    const [again]=await tx`select public.enqueue_notification(${actor.user}::uuid,${actor.org}::uuid,${code},${code},${locale+'-MA'},${tx.json({reference:title})}::jsonb,${key},'organization',${actor.org},${correlation}::uuid) receipt`;assert.equal(again.receipt.notification_id,row.receipt.notification_id);return row.receipt;
   });items.push({role,locale,device,title,id:result.notification_id});
  }
 }
 const path=resolve(directory,'manifest.json');await writeFile(path,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),actors,items}),{mode:0o600});stage='browser';
 summary=await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_ACTIONS_MANIFEST:path}),specifications:['tests/e2e/local-universal-actions.spec.ts'],output:resolve(directory,'browser'),expectedTests:16,projects:['chromium-desktop','chromium-mobile-360']});
 stage='native-read-proof';
 for(const item of items){
  if(item.role==='admin'){const [w]=await db`select status,row_version from public.admin_work_items where id=${item.id}::uuid`;assert.equal(w.status,'OPEN');assert.equal(w.row_version,1);continue;}
  const actor=actors[item.role],client=fixture.sessions[actor.session].client;
  const [row]=await db`select read_at,row_version from public.notification_instances where id=${item.id}::uuid`;assert.ok(row.read_at);assert.equal(row.row_version,2);
  const [receipt]=await db`select key,response_body from public.idempotency_keys where organization_id=${actor.org}::uuid and operation_scope=${'notification.read.'+item.id}`;assert.ok(receipt);
  assert.deepEqual(await rpc(client,'mark_notification_read',{p_notification_id:item.id,p_expected_row_version:1,p_idempotency_key:receipt.key}),receipt.response_body);
  const other=fixture.sessions[item.role==='client'?'clientB':'clientA'].client;
  const denied=await other.rpc('mark_notification_read',{p_notification_id:item.id,p_expected_row_version:2,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  const hidden=await other.from('notification_instances').select('id').eq('id',item.id);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
  const [audit]=await db`select count(*)::integer n from public.audit_events where resource_id=${item.id} and action='notification.read'`;assert.equal(audit.n,1);
  const [enqueue]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.aggregate_id=a.resource_id where a.resource_id=${item.id} and a.action='notification.enqueued' and e.event_type='NotificationPreparedV1'`;assert.equal(enqueue.n,1);
 }
 proof={realRoleActionViews:16,realUiNotificationReads:12,realAdminTaskLinks:4,readActionsDisappear:true,notificationReplayAndAudit:true,foreignNotificationReadAndWriteDenied:true,frArDesktop360Accessibility:true,noAutomaticAdministrativeDecision:true,externalEmailDelivered:false};
}catch(error){failure=error;summary??=error.browserSummary;}
finally{
 if(fixture)for(const item of items)try{
  const db=fixture.resources.database;
  if(item.role==='admin'){
   let [row]=await db`select status,row_version from public.admin_work_items where id=${item.id}::uuid`;
   if(row.status==='OPEN'){await rpc(fixture.sessions.central.client,'claim_admin_work_item',{p_work_item_id:item.id,p_expected_row_version:row.row_version,p_reason:'Universal action fixture cleanup',p_idempotency_key:randomUUID()});[row]=await db`select status,row_version from public.admin_work_items where id=${item.id}::uuid`;}
   if(row.status==='CLAIMED')await rpc(fixture.sessions.central.client,'resolve_admin_work_item',{p_work_item_id:item.id,p_resolution_code:'NO_ACTION',p_reason:'Universal action fixture cleanup',p_evidence:{synthetic_test:true},p_expected_row_version:row.row_version,p_idempotency_key:randomUUID()});
  }else{const [row]=await db`select read_at,row_version from public.notification_instances where id=${item.id}::uuid`;if(!row.read_at)await rpc(fixture.sessions[actors[item.role].session].client,'mark_notification_read',{p_notification_id:item.id,p_expected_row_version:row.row_version,p_idempotency_key:randomUUID()});}
 }catch(error){cleanupVerified=false;failure??=error;}
 for(const cleanup of[()=>fixture&&neutralizeLocalFranchiseCrm(fixture),()=>fixture&&neutralizeLocalCatalogReference(fixture),()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}
}
const failureLocations=[...(failure?.stack??'').matchAll(/([^\s/\\()]+\.(?:mjs|ts)):(\d+):(\d+)/gu)].slice(0,4).map(m=>({file:m[1],line:Number(m[2]),column:Number(m[3])}));
const safe=value=>typeof value==='string'&&/^[A-Z0-9_]{2,100}$/u.test(value)?value:null;
await writeLocalSuiteEvidence({root,suite:'universal-actions',config,summary,failure,cleanupVerified,proof:{...proof,stage,failureLocations,responseCode:safe(failure?.actual?.code),responseLabel:safe(failure?.actual?.message)}});
if(failure){console.error('LOCAL_UNIVERSAL_ACTIONS_FAILED');process.exitCode=1;}else console.log('LOCAL_UNIVERSAL_ACTIONS_PASSED');
