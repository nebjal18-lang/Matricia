import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provision,elevateToAal2,toPlaywrightState} from '../../../scripts/p05-e2e/provision.mjs';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';

const root=process.cwd(),directory=resolve(root,'artifacts/test-results',`.local-template-editor-${randomUUID()}`);
let config,fixture,summary,failure,proof,stage='configuration',cleanupVerified=true;
const items=[];
async function rpc(client,name,input){const result=await client.rpc(name,input);assert.equal(result.error,null,`TEMPLATE_${name.toUpperCase()}_FAILED`);return result.data;}
try{
 config=await loadSafeConfiguration(root);
 assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 stage='fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);
 const db=fixture.resources.database,author=fixture.sessions.central.client,reviewer=fixture.sessions.noRole;
 const authorId=fixture.resources.userIds[2],reviewerId=fixture.resources.userIds[3];
 await db`insert into public.platform_user_roles(user_id,role_code,granted_by) values(${authorId}::uuid,'MATRICIA_ADMIN',null),(${reviewerId}::uuid,'MATRICIA_ADMIN',null)`;
 await elevateToAal2(reviewer);
 await mkdir(directory,{recursive:true,mode:0o700});
 const reviewerState=resolve(directory,'reviewer.json');
 await writeFile(reviewerState,JSON.stringify(toPlaywrightState(reviewer.cookies,config.baseUrl)),{mode:0o600});
 for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const suffix=`${locale}_${device}`,code=`A_E2E_${fixture.manifest.runId.replaceAll('-','').slice(0,12).toUpperCase()}_${suffix.toUpperCase()}`;
  const item={suffix,code,reference:`REF_${suffix}`,frSubject:`Revision ${suffix} {{reference}}`,frBody:`La revision bilingue ${suffix} concerne {{reference}}.`,arSubject:`مراجعة ${suffix} {{reference}}`,arBody:`تخص المراجعة ${suffix} المرجع {{reference}}.`};
  items.push(item);
  // Historical precondition only: the preview, proposal and activation are real commands.
  await db`insert into public.notification_template_versions(template_code,version,event_type,category_code,locale,subject_template,body_template,priority,mandatory,channels,variable_keys,status,effective_from,content_hash)
    select ${code},1,${code},'ADMIN_DIGEST',locale,'Original {{reference}}','Original bilingual message {{reference}}','NORMAL',false,array['IN_APP'],array['reference'],'ACTIVE',clock_timestamp()-interval '1 minute',private.canonical_request_hash(jsonb_build_object('code',${code}::text,'locale',locale)) from unnest(array['fr-MA','ar-MA'])locale`;
 }
 const before=await rpc(author,'get_notification_template_editor_v1',{p_page:1});
 for(const item of items){const pair=before.pairs.find(pair=>pair.code===item.code);assert.ok(pair);item.sourceHash=pair.source_pair_hash;}
 const manifestPath=resolve(directory,'manifest.json');
 await writeFile(manifestPath,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),reviewerState,items}),{mode:0o600});
 stage='browser';
 summary=await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_TEMPLATE_MANIFEST:manifestPath}),specifications:['tests/e2e/local-notification-templates.spec.ts'],output:resolve(directory,'browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']});
 stage='native-proof';
 const current=await rpc(author,'get_notification_template_editor_v1',{p_page:1});
 for(const item of items){
  const versions=await db`select version,locale,status,subject_template,body_template from public.notification_template_versions where template_code=${item.code} order by version,locale`;
  assert.equal(versions.length,4);assert.equal(versions.filter(v=>v.version===1&&v.status==='RETIRED').length,2);
  for(const row of versions.filter(v=>v.version===2)){assert.equal(row.status,'ACTIVE');assert.equal(row.subject_template,item[row.locale==='fr-MA'?'frSubject':'arSubject']);assert.equal(row.body_template,item[row.locale==='fr-MA'?'frBody':'arBody']);}
  const [proposal]=await db`select id,created_by,content_hash from public.notification_template_pair_proposals_v1 where template_code=${item.code}`;
  assert.equal(proposal.created_by,authorId);
  const decisions=await db`select decided_by,decision from public.notification_template_pair_decisions_v1 where proposal_id=${proposal.id}::uuid`;
  assert.deepEqual(decisions.map(d=>({actor:d.decided_by,decision:d.decision})),[{actor:reviewerId,decision:'APPROVE'}]);
  const activations=await db`select content_hash from public.notification_template_pair_activations_v1 where proposal_id=${proposal.id}::uuid`;assert.equal(activations.length,1);assert.equal(activations[0].content_hash,proposal.content_hash);
  const audit=await db`select action from public.audit_events where resource_id=${proposal.id} and action in('notification.template.pair_proposed','notification.template.pair_reviewed')`;assert.equal(audit.length,2);
  const outbox=await db`select e.payload from public.event_outbox e join public.audit_events a on a.correlation_id=e.correlation_id and a.resource_id=e.aggregate_id where e.aggregate_id=${proposal.id} and e.event_type='NotificationTemplatePairActivatedV1' and a.action='notification.template.pair_reviewed'`;assert.equal(outbox.length,1);assert.equal(outbox[0].payload.delivery_sent,false);
  const notifications=await db`select count(*)::integer count from public.notification_instances where event_type=${item.code}`;assert.equal(notifications[0].count,0);
  const self=await author.rpc('decide_notification_template_pair_v1',{p_proposal_id:proposal.id,p_expected_content_hash:proposal.content_hash,p_approve:true,p_review_confirmed:true,p_reason:'E2E self approval must remain denied',p_idempotency_key:randomUUID()});assert.equal(self.error?.code,'42501');
  const translations={'fr-MA':{subject:item.frSubject,body:item.frBody},'ar-MA':{subject:item.arSubject,body:item.arBody}};
  const preview={p_template_code:item.code,p_expected_pair_hash:item.sourceHash,p_translations:translations,p_variables:{reference:item.reference}};
  const start=Date.now(),stale=await author.rpc('preview_notification_template_pair_v1',preview);assert.equal(stale.error?.code,'PT409');assert.equal(stale.status,409);assert.ok(Date.now()-start<5000);
  const pair=current.pairs.find(pair=>pair.code===item.code);assert.ok(pair);
  const unknown=await author.rpc('preview_notification_template_pair_v1',{...preview,p_expected_pair_hash:pair.source_pair_hash,p_variables:{reference:item.reference,unknown:'refused'}});assert.equal(unknown.error?.code,'22023');
  const foreign=await fixture.sessions.clientB.client.rpc('preview_notification_template_pair_v1',{...preview,p_expected_pair_hash:pair.source_pair_hash});assert.equal(foreign.error?.code,'42501');
 }
 proof={realUiBilingualPreviews:4,realUiBilingualProposals:4,realUiIndependentActivations:4,exactPersistedTranslations:true,immutableVersionsRetained:true,selfApprovalDenied:true,unknownVariablesDenied:true,staleHttp409WithoutRetry:true,foreignAccessDenied:true,noNotificationSent:true,activationAuditAndOutbox:true};
}catch(error){failure=error;summary??=error.browserSummary;}
finally{
 if(fixture&&items.length)try{
  const db=fixture.resources.database,codes=items.map(item=>item.code);
  await db`update public.notification_template_versions set status='RETIRED',effective_until=clock_timestamp() where template_code=any(${codes}::text[]) and status<>'RETIRED'`;
  const [remaining]=await db`select count(*)::integer count from public.notification_template_versions where template_code=any(${codes}::text[]) and status<>'RETIRED'`;assert.equal(remaining.count,0);
 }catch(error){cleanupVerified=false;failure??=error;}
 for(const cleanup of[()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}
}
await writeLocalSuiteEvidence({root,suite:'notification-templates',config,summary,failure,cleanupVerified,proof:{...proof,stage,failureLine:Number(/local-notification-templates-run\.mjs:(\d+)/u.exec(failure?.stack??'')?.[1])||null}});
if(failure){console.error('NOTIFICATION_TEMPLATES_FAILED');process.exitCode=1;}else console.log('NOTIFICATION_TEMPLATES_PASSED');
